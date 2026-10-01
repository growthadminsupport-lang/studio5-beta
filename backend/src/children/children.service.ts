import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Child, ChildRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { removeUpload } from '../common/uploads';
import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';
import { can, Capability, ChildAccess } from './child-access';

/** A doctor link grants nothing unless the account is an approved doctor. */
function isApprovedDoctor(user: { role: string; doctorStatus: string | null }) {
  return user.role === 'DOCTOR' && user.doctorStatus === 'APPROVED';
}

const CAPABILITY_MESSAGES: Partial<Record<Capability, string>> = {
  'child.edit': "Only the child's parent can change these details",
  'child.delete': "Only the child's parent can delete this profile",
  'members.manage': "Only the child's parent can manage who has access",
  'puberty.result':
    'Puberty screening results are shared with the parent and doctor only',
  'boneAge.write': "Only the child's doctor can add or change bone-age records",
  'boneAge.full': "Only the child's doctor can see the full bone-age record",
};

@Injectable()
export class ChildrenService {
  constructor(private prisma: PrismaService) {}

  /**
   * The caller's role on a child, and what it allows. Every module that reads or writes a
   * child's records goes through here, so the permission matrix in child-access.ts is the
   * only place those rules live.
   *
   * Throws 403 if the caller has no link, if the link is a doctor's and the account is not an
   * approved doctor (approval can be withdrawn), or if `capability` is given and not allowed.
   */
  async access(
    childId: string,
    userId: string,
    capability?: Capability,
  ): Promise<ChildAccess> {
    const link = await this.prisma.childGuardian.findUnique({
      where: { childId_userId: { childId, userId } },
      include: {
        user: { select: { role: true, doctorStatus: true } },
        child: { select: { deletedAt: true } },
      },
    });
    if (!link || link.child.deletedAt) {
      throw new ForbiddenException('You do not have access to this child');
    }
    if (link.role === 'DOCTOR' && !isApprovedDoctor(link.user)) {
      throw new ForbiddenException('Your doctor account is not approved');
    }
    if (capability && !can(link.role, capability)) {
      throw new ForbiddenException(
        CAPABILITY_MESSAGES[capability] ?? 'Not allowed for your role',
      );
    }
    return { childId, userId, role: link.role, can: (c) => can(link.role, c) };
  }

  /** Strip what this role may not see from a child row, and add the caller's role. */
  private present(child: Child, role: ChildRole, familyName: string | null) {
    const { hn, ...rest } = child;
    return {
      ...rest,
      ...(can(role, 'child.readHn') ? { hn } : {}),
      myRole: role,
      /** The primary parent's name. Caretakers and doctors group children by it. */
      familyName,
    };
  }

  private async primaryParentNames(childIds: string[]) {
    const parents = await this.prisma.childGuardian.findMany({
      where: { childId: { in: childIds }, role: 'PARENT' },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      include: { user: { select: { fullName: true } } },
    });
    const names = new Map<string, string>();
    for (const p of parents) {
      if (!names.has(p.childId)) names.set(p.childId, p.user.fullName);
    }
    return names;
  }

  async create(userId: string, dto: CreateChildDto) {
    const { relation, ...childFields } = dto;
    const child = await this.prisma.child.create({
      data: {
        ...childFields,
        dateOfBirth: new Date(dto.dateOfBirth),
        guardians: {
          create: { userId, role: 'PARENT', isPrimary: true, relation },
        },
      },
    });
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { fullName: true },
    });
    return this.present(child, 'PARENT', me.fullName);
  }

  /**
   * Every child the caller can see. `hn` narrows to the caller's own patients whose hospital
   * number contains it; it never reaches a child the caller is not already linked to.
   */
  async findAllForUser(userId: string, hn?: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { role: true, doctorStatus: true },
    });
    const doctorOk = isApprovedDoctor(user);

    const links = await this.prisma.childGuardian.findMany({
      where: {
        userId,
        child: {
          deletedAt: null,
          ...(hn?.trim()
            ? { hn: { contains: hn.trim(), mode: 'insensitive' as const } }
            : {}),
        },
        ...(hn?.trim() ? { role: 'DOCTOR' as const } : {}),
      },
      include: { child: true },
      orderBy: { child: { createdAt: 'asc' } },
    });
    const visible = links.filter((l) => l.role !== 'DOCTOR' || doctorOk);
    const names = await this.primaryParentNames(visible.map((l) => l.childId));
    return visible.map((l) =>
      this.present(l.child, l.role, names.get(l.childId) ?? null),
    );
  }

  async findOne(userId: string, childId: string) {
    const { role } = await this.access(childId, userId, 'child.read');
    const child = await this.prisma.child.findUnique({
      where: { id: childId },
    });
    if (!child || child.deletedAt) {
      throw new NotFoundException('Child not found');
    }
    const names = await this.primaryParentNames([childId]);
    return this.present(child, role, names.get(childId) ?? null);
  }

  /**
   * Parents change anything. A doctor may only set the hospital number, which is often the
   * one detail the doctor knows and the parent does not.
   */
  async update(userId: string, childId: string, dto: UpdateChildDto) {
    const access = await this.access(childId, userId, 'child.read');
    const { dateOfBirth, relation, hn, ...rest } = dto;
    const touchesDetails =
      Object.values(rest).some((v) => v !== undefined) ||
      dateOfBirth ||
      relation;

    if (touchesDetails && !access.can('child.edit')) {
      throw new ForbiddenException(
        "Only the child's parent can change these details",
      );
    }
    if (hn !== undefined && !access.can('child.setHn')) {
      throw new ForbiddenException(
        'Only the parent or doctor can set the hospital number',
      );
    }

    if (relation) {
      await this.prisma.childGuardian.update({
        where: { childId_userId: { childId, userId } },
        data: { relation },
      });
    }
    const child = await this.prisma.child.update({
      where: { id: childId },
      data: {
        ...rest,
        ...(hn !== undefined ? { hn: hn.trim() || null } : {}),
        ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth) } : {}),
      },
    });
    const names = await this.primaryParentNames([childId]);
    return this.present(child, access.role, names.get(childId) ?? null);
  }

  /**
   * A real delete, not a soft delete: the confirm dialog promises this permanently removes the
   * child's growth, screening and bone-age history, and every caretaker's and doctor's access
   * with it (all cascade from Child). If another parent shares the child, only this parent's
   * link is removed and the child stays with the other.
   */
  async remove(userId: string, childId: string) {
    await this.access(childId, userId, 'child.delete');
    const parentCount = await this.prisma.childGuardian.count({
      where: { childId, role: 'PARENT' },
    });
    if (parentCount <= 1) {
      const xrays = await this.prisma.boneAgePrediction.findMany({
        where: { childId },
        select: { imageUrl: true },
      });
      await this.prisma.child.delete({ where: { id: childId } });
      // The rows cascade; the radiographs on disk do not.
      await Promise.all(xrays.map((x) => removeUpload('bone-age', x.imageUrl)));
    } else {
      await this.prisma.childGuardian.delete({
        where: { childId_userId: { childId, userId } },
      });
    }
    return { success: true };
  }

  /** Who has access, and invitations not yet used. Parents only. */
  async members(userId: string, childId: string) {
    await this.access(childId, userId, 'members.manage');
    const [links, invites] = await Promise.all([
      this.prisma.childGuardian.findMany({
        where: { childId },
        orderBy: { createdAt: 'asc' },
        include: {
          user: {
            select: { id: true, fullName: true, email: true, hospital: true },
          },
        },
      }),
      this.prisma.childInvite.findMany({
        where: {
          childId,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          role: true,
          email: true,
          expiresAt: true,
          createdAt: true,
        },
      }),
    ]);
    return {
      members: links.map((l) => ({
        userId: l.user.id,
        fullName: l.user.fullName,
        email: l.user.email,
        hospital: l.role === 'DOCTOR' ? l.user.hospital : null,
        role: l.role,
        relation: l.relation,
        joinedAt: l.createdAt,
        isMe: l.userId === userId,
      })),
      pendingInvites: invites,
    };
  }

  /**
   * Remove someone's access. Anyone may remove themselves (a caretaker who stops working for
   * the family, a doctor handing over). A parent may remove caretakers and doctors. The last
   * parent cannot leave; deleting the child is the way out, and it says what it does.
   */
  async removeMember(userId: string, childId: string, memberId: string) {
    const access = await this.access(childId, userId, 'child.read');
    const target = await this.prisma.childGuardian.findUnique({
      where: { childId_userId: { childId, userId: memberId } },
    });
    if (!target) {
      throw new NotFoundException(
        'That person does not have access to this child',
      );
    }

    if (memberId !== userId) {
      if (!access.can('members.manage')) {
        throw new ForbiddenException(
          "Only the child's parent can remove people",
        );
      }
      if (target.role === 'PARENT') {
        throw new ForbiddenException(
          'A parent can only be removed by leaving themselves',
        );
      }
    } else if (target.role === 'PARENT') {
      const parentCount = await this.prisma.childGuardian.count({
        where: { childId, role: 'PARENT' },
      });
      if (parentCount <= 1) {
        throw new BadRequestException(
          "You are this child's only parent. Delete the child's profile instead of leaving it.",
        );
      }
    }

    await this.prisma.childGuardian.delete({
      where: { childId_userId: { childId, userId: memberId } },
    });
    return { success: true };
  }
}
