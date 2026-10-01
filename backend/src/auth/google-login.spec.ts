import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

/**
 * Google sign-in, at the decisions that carry security weight:
 * verifying the token, linking to an existing account, and FR-2.
 *
 * `verifyIdToken` is stubbed. Testing that Google's own signature check works would be
 * testing google-auth-library; what matters here is what we do with the payload it returns,
 * and that we refuse the payloads we should.
 */

const verifyIdToken = jest.fn();
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: (...args: unknown[]) => verifyIdToken(...args),
  })),
}));

const CLIENT_ID = '850663910657-test.apps.googleusercontent.com';

type UserRow = Record<string, unknown> | null;

function build(existing: UserRow) {
  const created: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];
  const revoked: unknown[] = [];

  const user = {
    findUnique: async ({ where }: { where: Record<string, unknown> }) => {
      if (!existing) return null;
      if ('googleId' in where) {
        return existing.googleId === where.googleId ? existing : null;
      }
      return existing.email === where.email ? existing : null;
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      created.push(data);
      return {
        id: 'new-user',
        role: 'USER',
        createdAt: new Date(),
        phoneNumber: null,
        ...data,
      };
    },
    update: async ({ data }: { data: Record<string, unknown> }) => {
      updated.push(data);
      return { ...(existing as object), ...data };
    },
  };
  const session = {
    create: async () => ({}),
    updateMany: async (args: unknown) => {
      revoked.push(args);
      return { count: 1 };
    },
  };
  const prisma = {
    user,
    session,
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ user, session }),
  } as unknown as PrismaService;

  const config = {
    get: (k: string) => (k === 'GOOGLE_CLIENT_ID' ? CLIENT_ID : undefined),
    getOrThrow: (k: string) => (k === 'JWT_ACCESS_SECRET' ? 'secret' : '15m'),
  } as unknown as ConfigService;

  const jwt = {
    signAsync: async () => 'access-token',
  } as unknown as JwtService;
  const mail = {} as MailService;

  return {
    service: new AuthService(prisma, jwt, config, mail),
    created,
    updated,
    revoked,
  };
}

const googlePayload = (over: Record<string, unknown> = {}) => ({
  getPayload: () => ({
    sub: 'google-subject-1',
    email: 'Parent@Example.com',
    email_verified: true,
    name: 'A Parent',
    picture: 'https://example.com/a.png',
    ...over,
  }),
});

const SIGNUP = {
  credential: 'tok',
  signup: true,
  acceptedTerms: true,
  accountType: 'USER' as const,
};

beforeEach(() => verifyIdToken.mockReset());

describe('googleLogin', () => {
  it('checks the token was minted for this application', async () => {
    verifyIdToken.mockResolvedValue(googlePayload());
    const { service } = build(null);
    await service.googleLogin(SIGNUP);

    // Without the audience check, any valid Google ID token from any app would be accepted.
    expect(verifyIdToken).toHaveBeenCalledWith(
      expect.objectContaining({ idToken: 'tok', audience: CLIENT_ID }),
    );
  });

  it('rejects a token Google will not verify', async () => {
    verifyIdToken.mockRejectedValue(new Error('bad signature'));
    const { service } = build(null);
    await expect(
      service.googleLogin({ credential: 'forged' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuses an unverified Google email address', async () => {
    verifyIdToken.mockResolvedValue(googlePayload({ email_verified: false }));
    const { service } = build(null);
    await expect(service.googleLogin(SIGNUP)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  describe('a new address', () => {
    it('asks for the welcome form first, prefilled from Google', async () => {
      verifyIdToken.mockResolvedValue(googlePayload());
      const { service, created } = build(null);
      await expect(service.googleLogin({ credential: 'tok' })).resolves.toEqual(
        {
          signupRequired: true,
          email: 'parent@example.com',
          fullName: 'A Parent',
          picture: 'https://example.com/a.png',
        },
      );
      expect(created).toHaveLength(0);
    });

    it('refuses without accepted terms — FR-2', async () => {
      verifyIdToken.mockResolvedValue(googlePayload());
      const { service, created } = build(null);
      await expect(
        service.googleLogin({ ...SIGNUP, acceptedTerms: false }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(created).toHaveLength(0);
    });

    it('needs a licence and hospital for a doctor account', async () => {
      verifyIdToken.mockResolvedValue(googlePayload());
      const { service, created } = build(null);
      await expect(
        service.googleLogin({ ...SIGNUP, accountType: 'DOCTOR' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(created).toHaveLength(0);
    });

    it('stores no password, records consent, the phone and the Google name', async () => {
      verifyIdToken.mockResolvedValue(googlePayload());
      const { service, created } = build(null);
      await service.googleLogin({ ...SIGNUP, phoneNumber: '081 234 5678' });

      expect(created).toHaveLength(1);
      expect(created[0]).toMatchObject({
        passwordHash: null,
        email: 'parent@example.com',
        googleId: 'google-subject-1',
        isVerified: true,
        fullName: 'A Parent',
        phoneNumber: '081 234 5678',
      });
      expect(created[0].termsAcceptedAt).toBeInstanceOf(Date);
    });

    it('creates a pending doctor with licence and hospital', async () => {
      verifyIdToken.mockResolvedValue(googlePayload());
      const { service, created } = build(null);
      await service.googleLogin({
        ...SIGNUP,
        accountType: 'DOCTOR',
        licenseNumber: 'MD-12345',
        hospital: 'Srinagarind Hospital',
      });
      expect(created[0]).toMatchObject({
        role: 'DOCTOR',
        doctorStatus: 'PENDING',
        licenseNumber: 'MD-12345',
        hospital: 'Srinagarind Hospital',
      });
    });
  });

  describe('a password account with the same address', () => {
    const passwordAccount = (verified: boolean) => ({
      id: 'u1',
      email: 'parent@example.com',
      fullName: 'A Parent',
      passwordHash: 'hash',
      googleId: null,
      isVerified: verified,
      role: 'USER',
      createdAt: new Date(),
      deletedAt: null,
    });

    it('asks before linking, and changes nothing until then', async () => {
      verifyIdToken.mockResolvedValue(googlePayload());
      const { service, created, updated } = build(passwordAccount(true));
      await expect(service.googleLogin({ credential: 'tok' })).resolves.toEqual(
        { linkRequired: true, email: 'parent@example.com' },
      );
      expect(created).toHaveLength(0);
      expect(updated).toHaveLength(0);
    });

    it('links to the same account and keeps a confirmed password', async () => {
      verifyIdToken.mockResolvedValue(googlePayload());
      const { service, updated } = build(passwordAccount(true));
      const res = await service.googleLogin({
        credential: 'tok',
        linkAccount: true,
      });
      expect(res).toHaveProperty('accessToken');
      expect(res).not.toHaveProperty('passwordRemoved');
      expect(updated[0].googleId).toBe('google-subject-1');
      expect(updated[0]).not.toHaveProperty('passwordHash');
    });

    it('removes a password set on an address nobody confirmed, and its sessions', async () => {
      // Someone registered the address first without owning it. Google proves this person
      // owns it, so the stranger's password and sessions must not survive the link.
      verifyIdToken.mockResolvedValue(googlePayload());
      const { service, updated, revoked } = build(passwordAccount(false));
      const res = await service.googleLogin({
        credential: 'tok',
        linkAccount: true,
      });
      expect(res).toHaveProperty('passwordRemoved', true);
      expect(updated[0].passwordHash).toBeNull();
      expect(revoked).toHaveLength(1);
    });
  });

  describe('an account already linked to Google', () => {
    const linked = {
      id: 'u1',
      email: 'parent@example.com',
      fullName: 'A Parent',
      passwordHash: null,
      googleId: 'google-subject-1',
      isVerified: true,
      role: 'USER',
      createdAt: new Date(),
      deletedAt: null,
    };

    it('signs in without asking for terms again', async () => {
      verifyIdToken.mockResolvedValue(googlePayload());
      const { service } = build(linked);
      await expect(
        service.googleLogin({ credential: 'tok' }),
      ).resolves.toHaveProperty('accessToken');
    });

    it('refuses a deleted account', async () => {
      verifyIdToken.mockResolvedValue(googlePayload());
      const { service } = build({ ...linked, deletedAt: new Date() });
      await expect(
        service.googleLogin({ credential: 'tok' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('never returns the password hash or the Google id', async () => {
      verifyIdToken.mockResolvedValue(googlePayload());
      const { service } = build(linked);
      const result = (await service.googleLogin({ credential: 'tok' })) as {
        user: object;
      };
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user).not.toHaveProperty('googleId');
    });
  });

  it('refuses to run at all when the client id is unset', async () => {
    const { service } = build(null);
    (service as unknown as { config: ConfigService }).config = {
      get: () => undefined,
    } as unknown as ConfigService;
    await expect(service.googleLogin(SIGNUP)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
