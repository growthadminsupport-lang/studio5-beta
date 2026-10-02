import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { publicUser } from '../users/public-user';
import { MailService } from '../mail/mail.service';
import { assertDeliverableEmail } from '../common/email-check';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const REFRESH_TOKEN_BYTES = 48;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private mail: MailService,
  ) {}

  private async issueTokens(user: { id: string; email: string; role: string }) {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.getOrThrow<string>(
          'JWT_ACCESS_EXPIRES_IN',
        ) as any,
      },
    );

    const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const refreshExpiresIn =
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    const days = parseInt(refreshExpiresIn.replace(/[^0-9]/g, ''), 10) || 7;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: hashToken(refreshToken),
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: User) {
    return publicUser(user);
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException(
        existing.googleId && !existing.passwordHash
          ? {
              code: 'GOOGLE_ACCOUNT',
              message:
                'This email already has a GrowTH account that signs in with Google. Continue with Google to use it; you can add a password afterwards in Settings.',
            }
          : {
              code: 'EMAIL_TAKEN',
              message:
                'An account with this email already exists. Please log in instead.',
            },
      );
    }
    await assertDeliverableEmail(email, { checkDns: this.isProduction });

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const verifyToken = randomBytes(32).toString('hex');
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: dto.fullName.trim(),
        phoneNumber: dto.phoneNumber?.trim() || null,
        termsAcceptedAt: new Date(),
        isVerified: false,
        emailVerifyTokenHash: hashToken(verifyToken),
        emailVerifyExpiresAt: new Date(Date.now() + VERIFY_TTL_MS),
        ...doctorFields(dto),
      },
    });
    await this.mail.sendVerificationEmail(email, verifyToken, user.fullName);

    const tokens = await this.issueTokens(user);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // A Google-only account has no hash. bcrypt.compare throws on a null hash rather than
    // returning false, so without this the request 500s instead of failing authentication —
    // and a 500 here is also an account-existence oracle.
    if (!user.passwordHash) {
      // Says which way in works rather than "invalid credentials", which would leave someone
      // who signed up with Google retrying passwords they never set.
      throw new UnauthorizedException({
        code: 'GOOGLE_ACCOUNT',
        message:
          'This account signs in with Google. Use “Continue with Google”. You can add a password afterwards in Settings to use both.',
      });
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokens(user);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  /**
   * Sign in with Google, via an ID token from Google Identity Services.
   *
   * The ID-token flow rather than the authorization-code flow: this is a SPA with its own JWT
   * sessions, so all we need from Google is a trustworthy assertion of who the user is. That
   * needs only the public client ID to verify — no client secret is involved anywhere, which
   * is one fewer credential to leak.
   *
   * `verifyIdToken` checks Google's signature against their published keys, the expiry, the
   * issuer, and that the audience is *our* client ID. That last check is what stops someone
   * presenting a valid Google token minted for a different application.
   */
  async googleLogin(dto: GoogleLoginDto) {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      this.logger.error(
        'GOOGLE_CLIENT_ID is not set — refusing Google sign-in',
      );
      throw new BadRequestException('Google sign-in is not configured');
    }

    let payload;
    try {
      const ticket = await new OAuth2Client(clientId).verifyIdToken({
        idToken: dto.credential,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch {
      // Deliberately not logging the token or the underlying error text — it can contain the
      // credential itself.
      throw new UnauthorizedException('Could not verify that Google sign-in');
    }

    if (!payload?.email || !payload.sub) {
      throw new UnauthorizedException('Google did not return an email address');
    }

    // Linking an existing account by email is only safe because Google has verified it. An
    // unverified address would let anyone who can create a Google account with someone else's
    // address walk into their account.
    if (!payload.email_verified) {
      throw new UnauthorizedException(
        'That Google account has an unverified email address',
      );
    }

    const email = payload.email.toLowerCase();
    const byGoogle = await this.prisma.user.findUnique({
      where: { googleId: payload.sub },
    });
    const existing =
      byGoogle ?? (await this.prisma.user.findUnique({ where: { email } }));

    if (existing?.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (existing?.googleId) {
      const tokens = await this.issueTokens(existing);
      return { user: this.sanitizeUser(existing), ...tokens };
    }

    if (existing) {
      // A password account with this address. Linking makes Google a second way into the same
      // account (same id, same children), but only once the person says so.
      if (!dto.linkAccount) {
        return { linkRequired: true as const, email };
      }
      // If that address was never confirmed, whoever chose the password has not proven they
      // own the mailbox; Google just proved this person does. Keeping the password would let
      // someone who registered the address first keep a way in, so it is removed, along with
      // every session it opened.
      const takeover = !existing.isVerified;
      const user = await this.prisma.$transaction(async (tx) => {
        if (takeover) {
          await tx.session.updateMany({
            where: { userId: existing.id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
        return tx.user.update({
          where: { id: existing.id },
          data: {
            googleId: payload.sub,
            isVerified: true,
            emailVerifyTokenHash: null,
            emailVerifyExpiresAt: null,
            ...(takeover ? { passwordHash: null } : {}),
          },
        });
      });
      const tokens = await this.issueTokens(user);
      return {
        user: this.sanitizeUser(user),
        ...tokens,
        ...(takeover ? { passwordRemoved: true } : {}),
      };
    }

    // No account yet: the client shows the welcome form, prefilled from Google.
    if (!dto.signup) {
      return {
        signupRequired: true as const,
        email,
        fullName: payload.name ?? '',
        picture: payload.picture ?? null,
      };
    }

    // FR-2: terms have to be accepted before an account exists, and the Google button skips
    // the registration form that normally enforces that.
    if (dto.acceptedTerms !== true) {
      throw new BadRequestException(
        'You must accept the terms of use and privacy notice to create an account',
      );
    }
    if (
      dto.accountType === 'DOCTOR' &&
      (!dto.licenseNumber?.trim() || !dto.hospital?.trim())
    ) {
      throw new BadRequestException(
        'Doctors need to give their medical licence number and hospital or clinic',
      );
    }
    // Google has verified the mailbox; this only refuses throwaway domains.
    await assertDeliverableEmail(email, { checkDns: false });

    const user = await this.prisma.user.create({
      data: {
        email,
        googleId: payload.sub,
        // No password. `login` refuses these accounts before it reaches bcrypt.
        passwordHash: null,
        fullName: dto.fullName?.trim() || payload.name || email.split('@')[0],
        phoneNumber: dto.phoneNumber?.trim() || null,
        avatarUrl: payload.picture ?? null,
        // Google has already verified the address, which is what this flag means.
        isVerified: true,
        termsAcceptedAt: new Date(),
        ...doctorFields(dto),
      },
    });

    const tokens = await this.issueTokens(user);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  /**
   * Adds a password to an account that signs in with Google, so both ways in reach the same
   * account. Being signed in is the proof of ownership: Google verified the address.
   */
  async setPassword(userId: string, newPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (user.passwordHash) {
      throw new BadRequestException(
        'This account already has a password. Use “Change password” instead.',
      );
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });
    return { success: true, user: this.sanitizeUser(updated) };
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findUnique({
      where: { emailVerifyTokenHash: hashToken(token) },
    });
    if (
      !user ||
      !user.emailVerifyExpiresAt ||
      user.emailVerifyExpiresAt < new Date()
    ) {
      throw new BadRequestException(
        'This confirmation link is invalid or has expired. Sign in and ask for a new one.',
      );
    }
    // The link stays valid until it expires, and opening it again just says "confirmed". People
    // open it twice (a second tab, phone then laptop), mail scanners open it first, and a
    // single-use token showed them "invalid or expired" for an address that was confirmed.
    // It can only confirm this one address, so keeping it gives nothing away.
    if (!user.isVerified) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true },
      });
    }
    return { success: true };
  }

  async resendVerification(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (user.isVerified) return { success: true, alreadyVerified: true };
    const token = randomBytes(32).toString('hex');
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerifyTokenHash: hashToken(token),
        emailVerifyExpiresAt: new Date(Date.now() + VERIFY_TTL_MS),
      },
    });
    const sent = await this.mail.sendVerificationEmail(
      user.email,
      token,
      user.fullName,
    );
    // Outside production, hand the token back so the flow is testable without a mail provider.
    return { success: true, ...(!sent && !this.isProduction ? { token } : {}) };
  }

  private get isProduction() {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  /** Ends every session, including the rotation grace of recently refreshed tokens. */
  private revokeAllSessions(userId: string) {
    return this.prisma.session.updateMany({
      where: {
        userId,
        OR: [{ revokedAt: null }, { rotatedAt: { not: null } }],
      },
      data: { revokedAt: new Date(), rotatedAt: null },
    });
  }

  async logout(refreshToken: string) {
    await this.prisma.session.updateMany({
      where: { refreshToken: hashToken(refreshToken) },
      data: { revokedAt: new Date(), rotatedAt: null },
    });
    return { success: true };
  }

  async refresh(refreshToken: string) {
    const hashed = hashToken(refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshToken: hashed },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (session.revokedAt) {
      // Refresh tokens rotate, and two tabs, or a reload that interrupts the first refresh,
      // can present the same token twice. Without a grace period the second one fails and that
      // tab is signed out. A token that was *rotated* (not revoked by logout or a password
      // change) is accepted again for a few seconds.
      const rotatedRecently =
        session.rotatedAt !== null &&
        Date.now() - session.rotatedAt.getTime() < ROTATION_GRACE_MS;
      if (!rotatedRecently) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }
    } else {
      const now = new Date();
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: now, rotatedAt: now },
      });
    }

    const tokens = await this.issueTokens(session.user);
    return { user: this.sanitizeUser(session.user), ...tokens };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    // Always return success shape to avoid leaking whether an email is registered.
    if (!user) {
      return { success: true };
    }

    const resetToken = randomBytes(32).toString('hex');
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash: hashToken(resetToken),
        resetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const sent = await this.mail.sendPasswordResetEmail(
      user.email,
      resetToken,
      user.fullName,
    );
    if (sent) {
      return { success: true };
    }

    // Outside production, hand the token straight back so the reset flow stays testable
    // without a mail provider. Never in production: this endpoint is unauthenticated, so a
    // live token in the response body turns "I know this email address" into full account
    // takeover the moment mail is misconfigured or the provider has an outage — which is
    // precisely when this branch runs.
    if (this.config.get<string>('NODE_ENV') === 'production') {
      this.logger.error(
        `Password reset requested for ${user.email} but no mail transport is configured — ` +
          'the user received nothing. Set RESEND_API_KEY (or SMTP_HOST/PORT/USER/PASS).',
      );
      return { success: true };
    }

    return { success: true, resetToken };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: { resetTokenHash: hashToken(token) },
    });

    if (
      !user ||
      !user.resetTokenExpiresAt ||
      user.resetTokenExpiresAt < new Date()
    ) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    // A reset is what someone does after losing control of the account, so every session
    // signed in with the old password ends here, not when its refresh token runs out.
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, resetTokenHash: null, resetTokenExpiresAt: null },
      }),
      this.revokeAllSessions(user.id),
    ]);

    return { success: true };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    // A Google-only account has no current password to verify against. Letting it through on
    // an empty comparison would turn "change password" into "set a password on any account
    // whose session you hold", so it is refused outright. Setting a first password on a
    // Google account needs its own flow with its own proof of ownership; it does not exist yet.
    if (!user.passwordHash) {
      throw new BadRequestException(
        'This account signs in with Google and has no password to change.',
      );
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      // 400, not 401: the caller is signed in. A 401 here reads as an expired session.
      throw new BadRequestException('Current password is incorrect');
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      this.revokeAllSessions(userId),
    ]);
    // Every other device is signed out; this one gets a fresh pair so it stays signed in.
    return { success: true, ...(await this.issueTokens(user)) };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    return this.sanitizeUser(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...dto,
        ...(dto.phoneNumber !== undefined
          ? { phoneNumber: dto.phoneNumber.trim() || null }
          : {}),
      },
    });
    return this.sanitizeUser(user);
  }
}

const VERIFY_TTL_MS = 48 * 60 * 60 * 1000;
/** How long a just-rotated refresh token is still accepted (two tabs, an interrupted reload). */
const ROTATION_GRACE_MS = 30 * 1000;

/** Doctor accounts start pending; an admin approves them. */
function doctorFields(dto: {
  accountType?: 'USER' | 'DOCTOR';
  licenseNumber?: string;
  hospital?: string;
}) {
  return dto.accountType === 'DOCTOR'
    ? {
        role: 'DOCTOR' as const,
        doctorStatus: 'PENDING' as const,
        licenseNumber: dto.licenseNumber?.trim(),
        hospital: dto.hospital?.trim(),
      }
    : {};
}
