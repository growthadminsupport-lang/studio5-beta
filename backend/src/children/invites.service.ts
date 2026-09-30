import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChildrenService } from './children.service';
import { CreateInviteDto } from './dto/create-invite.dto';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

/** The child's first name only: a leaked link should reveal as little as possible. */
function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0];
}

type InviteState = 'valid' | 'expired' | 'used' | 'revoked';

/**
 * A parent invites a caretaker or doctor to one child by link, shown as a QR code or emailed.
 *
 * The link is the credential, so only its hash is stored, it works once, and it expires after
 * seven days. Accepting still needs an account, and a doctor invitation needs an approved
 * doctor account: holding the link alone gets nobody in.
 */
@Injectable()
export class InvitesService {
  constructor(
    private prisma: PrismaService,
    private children: ChildrenService,
    private mail: MailService,
    private notifications: NotificationsService,
  ) {}

  async create(userId: string, childId: string, dto: CreateInviteDto) {
    await this.children.access(childId, userId, 'members.manage');
    const [child, inviter] = await Promise.all([
      this.prisma.child.findUniqueOrThrow({
        where: { id: childId },
        select: { fullName: true },
      }),
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { fullName: true },
      }),
    ]);

    const token = randomBytes(24).toString('base64url');
    const invite = await this.prisma.childInvite.create({
      data: {
        childId,
        role: dto.role,
        tokenHash: hashToken(token),
        email: dto.email?.toLowerCase(),
        invitedById: userId,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });

    const path = `/invite/${token}`;
    const link = `${this.mail.appUrl}${path}`;
    let emailed = false;
    if (dto.email) {
      const roleText = dto.role === 'DOCTOR' ? 'doctor' : 'caretaker';
      emailed = await this.mail.sendNotice(
        dto.email,
        `${inviter.fullName} invited you to GrowTH`,
        `${inviter.fullName} invited you to follow ${firstName(child.fullName)}'s growth on GrowTH as their ${roleText}. ` +
          'The invitation works once and expires in 7 days.',
        path,
      );
    }

    return {
      id: invite.id,
      role: invite.role,
      email: invite.email,
      expiresAt: invite.expiresAt,
      link,
      emailed,
    };
  }

  async revoke(userId: string, childId: string, inviteId: string) {
    await this.children.access(childId, userId, 'members.manage');
    const invite = await this.prisma.childInvite.findUnique({
      where: { id: inviteId },
    });
    if (!invite || invite.childId !== childId) {
      throw new NotFoundException('Invitation not found');
    }
    await this.prisma.childInvite.update({
      where: { id: inviteId },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  private state(invite: {
    expiresAt: Date;
    acceptedAt: Date | null;
    revokedAt: Date | null;
  }): InviteState {
    if (invite.revokedAt) return 'revoked';
    if (invite.acceptedAt) return 'used';
    if (invite.expiresAt < new Date()) return 'expired';
    return 'valid';
  }

  private async findByToken(token: string) {
    const invite = await this.prisma.childInvite.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        child: { select: { fullName: true, deletedAt: true } },
        invitedBy: { select: { fullName: true } },
      },
    });
    if (!invite || invite.child.deletedAt) {
      throw new NotFoundException('This invitation does not exist');
    }
    return invite;
  }

  /** What the invitation page shows before anyone signs in. */
  async preview(token: string) {
    const invite = await this.findByToken(token);
    return {
      childFirstName: firstName(invite.child.fullName),
      invitedBy: invite.invitedBy.fullName,
      role: invite.role,
      expiresAt: invite.expiresAt,
      state: this.state(invite),
    };
  }

  async accept(userId: string, token: string) {
    const invite = await this.findByToken(token);
    const state = this.state(invite);
    if (state !== 'valid') {
      throw new GoneException(
        {
          expired:
            'This invitation has expired. Ask the parent to send a new one.',
          used: 'This invitation has already been used. Ask the parent to send a new one.',
          revoked: 'This invitation was cancelled by the parent.',
        }[state],
      );
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { role: true, doctorStatus: true, fullName: true },
    });
    if (invite.role === 'DOCTOR') {
      if (user.role !== 'DOCTOR') {
        throw new ForbiddenException(
          'This invitation is for a doctor account.',
        );
      }
      if (user.doctorStatus !== 'APPROVED') {
        throw new ForbiddenException(
          'Your doctor account is waiting for approval. The invitation will work once it is approved, until it expires.',
        );
      }
    }

    const existing = await this.prisma.childGuardian.findUnique({
      where: { childId_userId: { childId: invite.childId, userId } },
    });
    if (existing) {
      throw new ConflictException('You already have access to this child.');
    }
    if (invite.invitedById === userId) {
      throw new BadRequestException('You cannot accept your own invitation.');
    }

    // Claim the invitation and create the link together, so two people opening the same link
    // at once cannot both get in: the conditional update only matches while it is unused.
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.childInvite.updateMany({
        where: { id: invite.id, acceptedAt: null, revokedAt: null },
        data: { acceptedAt: new Date(), acceptedById: userId },
      });
      if (claimed.count !== 1) {
        throw new GoneException('This invitation has already been used.');
      }
      await tx.childGuardian.create({
        data: {
          childId: invite.childId,
          userId,
          role: invite.role,
          isPrimary: false,
          relation: 'GUARDIAN',
        },
      });
    });

    await this.notifications.notify([invite.invitedById], {
      type: 'INVITE_ACCEPTED',
      childId: invite.childId,
      title: `${user.fullName} joined as ${invite.role === 'DOCTOR' ? 'doctor' : 'caretaker'}`,
      body: `${user.fullName} accepted your invitation for ${firstName(invite.child.fullName)}.`,
      path: `/children/${invite.childId}/people`,
    });

    return { childId: invite.childId, role: invite.role };
  }
}
