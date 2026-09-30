import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { publicUser } from './public-user';
import { UpdateProfileDto } from '../auth/dto/update-profile.dto';
import { streamUpload } from '../common/uploads';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private sanitize(user: User) {
    return publicUser(user);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    return this.sanitize(user);
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...dto,
        ...(dto.phoneNumber !== undefined
          ? { phoneNumber: dto.phoneNumber.trim() || null }
          : {}),
      },
    });
    return this.sanitize(user);
  }

  /** Own avatar bytes. Streamed rather than served statically for the same reason as the
   * bone-age scans — `uploads/` is not a public directory. */
  async avatar(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    return streamUpload('avatars', user.avatarUrl);
  }

  async uploadAvatar(userId: string, avatarUrl: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });
    return this.sanitize(user);
  }

  /**
   * Hard-deletes the account (not a soft delete): a prior soft-delete implementation left the
   * email permanently stuck (unique constraint kept blocking re-registration with that email).
   *
   * Children this user is the only *parent* of are deleted with all their history, which also
   * ends every caretaker's and doctor's access to them. A caretaker or doctor closing their
   * account only loses their own link; the child stays with the family.
   */
  async deleteMe(userId: string) {
    const parentLinks = await this.prisma.childGuardian.findMany({
      where: { userId, role: 'PARENT' },
      select: { childId: true },
    });
    const childIds = parentLinks.map((l) => l.childId);

    if (childIds.length > 0) {
      const parentCounts = await this.prisma.childGuardian.groupBy({
        by: ['childId'],
        where: { childId: { in: childIds }, role: 'PARENT' },
        _count: { userId: true },
      });
      const soleParentChildIds = parentCounts
        .filter((c) => c._count.userId === 1)
        .map((c) => c.childId);
      if (soleParentChildIds.length > 0) {
        await this.prisma.child.deleteMany({
          where: { id: { in: soleParentChildIds } },
        });
      }
    }

    await this.prisma.user.delete({ where: { id: userId } });
    return { success: true };
  }
}
