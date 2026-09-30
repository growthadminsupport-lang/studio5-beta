import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ChildRole, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

export interface NoticeInput {
  type: NotificationType;
  childId?: string;
  title: string;
  body: string;
  /** Frontend path the notice links to, e.g. `/children/<id>/puberty`. */
  path: string;
  /** Also email it. The email carries the title and body only, never results. */
  email?: boolean;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  findAll(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async assertOwner(userId: string, id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (notification.userId !== userId) {
      throw new ForbiddenException();
    }
    return notification;
  }

  async markRead(userId: string, id: string) {
    await this.assertOwner(userId, id);
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  }

  async remove(userId: string, id: string) {
    await this.assertOwner(userId, id);
    await this.prisma.notification.delete({ where: { id } });
    return { success: true };
  }

  async clearAll(userId: string) {
    await this.prisma.notification.deleteMany({ where: { userId } });
    return { success: true };
  }

  /** Notify specific accounts. Email failures are logged, never thrown. */
  async notify(userIds: string[], notice: NoticeInput) {
    const ids = [...new Set(userIds)];
    if (ids.length === 0) return;
    await this.prisma.notification.createMany({
      data: ids.map((userId) => ({
        userId,
        type: notice.type,
        childId: notice.childId,
        title: notice.title,
        body: notice.body,
      })),
    });
    if (!notice.email) return;
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { email: true },
    });
    await Promise.all(
      users.map((u) =>
        this.mail.sendNotice(u.email, notice.title, notice.body, notice.path),
      ),
    ).catch((err) =>
      this.logger.error('Notification email failed', err as Error),
    );
  }

  /** Notify everyone linked to a child in the given roles, except whoever caused it. */
  async notifyChildMembers(
    childId: string,
    roles: ChildRole[],
    exceptUserId: string,
    notice: NoticeInput,
  ) {
    const links = await this.prisma.childGuardian.findMany({
      where: { childId, role: { in: roles }, userId: { not: exceptUserId } },
      select: { userId: true },
    });
    await this.notify(
      links.map((l) => l.userId),
      { ...notice, childId },
    );
  }
}
