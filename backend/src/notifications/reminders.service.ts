import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService, checkupAgeText } from '../mail/mail.service';
import { checkupLabel, checkupWindow, measuredFor } from '../common/well-child';

/** A reminder this old is not emailed any more (e.g. when emails were only just set up). */
const EMAIL_WITHIN_DAYS = 14;

export interface CreatedReminder {
  userId: string;
  childId: string;
  childName: string;
  label: string;
}

/**
 * Check-up reminders (common/well-child.ts). When a child reaches a well-child check-up age and
 * nothing has been measured since, each parent gets one notice: book the check-up, then add the
 * height and weight measured there.
 *
 * Render's free instance sleeps, so nothing here relies on a timer inside the API. In-app
 * notices are created when the account loads its notifications (`refresh`); emails go out from
 * `runAll`, which a daily GitHub Actions job calls (.github/workflows/checkup-reminders.yml).
 * `reminders_sent` records every reminder once, so a dismissed notice is not created again and
 * nobody is emailed twice for the same check-up.
 *
 * Parents only: caretakers record measurements too, but booking the check-up is the parent's.
 */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  /** Creates any due in-app reminders for one account. Returns those created now. */
  async refresh(userId: string, now = new Date()): Promise<CreatedReminder[]> {
    const links = await this.prisma.childGuardian.findMany({
      where: { userId, role: 'PARENT' },
      select: {
        child: {
          select: {
            id: true,
            fullName: true,
            nickname: true,
            dateOfBirth: true,
            growthRecords: {
              where: { deletedAt: null },
              orderBy: { measuredAt: 'desc' },
              take: 1,
              select: { measuredAt: true },
            },
          },
        },
      },
    });

    const created: CreatedReminder[] = [];
    for (const { child } of links) {
      const { current } = checkupWindow(child.dateOfBirth, now);
      if (!current) continue;
      const latest = child.growthRecords[0];
      if (latest && measuredFor(current.date, latest.measuredAt)) continue;

      const childName = child.nickname?.trim() || child.fullName.split(' ')[0];
      const key = `checkup:${child.id}:${current.months}`;
      try {
        await this.prisma.$transaction([
          this.prisma.reminderSent.create({ data: { userId, key } }),
          this.prisma.notification.create({
            data: {
              userId,
              childId: child.id,
              type: 'MEASUREMENT_REMINDER',
              title: `${childName}'s ${current.label} check-up`,
              body: `A routine check-up is recommended at ${checkupAgeText(current.label)} (American Academy of Pediatrics schedule). Book it with your child's doctor or clinic, then add the height and weight measured there.`,
            },
          }),
        ]);
        created.push({
          userId,
          childId: child.id,
          childName,
          label: current.label,
        });
      } catch (err) {
        // Already sent (another request got there first, or the user dismissed it): fine.
        if (
          !(err instanceof Prisma.PrismaClientKnownRequestError) ||
          err.code !== 'P2002'
        ) {
          throw err;
        }
      }
    }
    return created;
  }

  /**
   * Creates every parent's due reminders, then emails each reminder not emailed yet: one made
   * here, or one made earlier when the parent opened GrowTH (the in-app notice must not use up
   * the email). Only to confirmed addresses with check-up emails on; reminders older than two
   * weeks are not emailed late. Called once a day; safe to call more often.
   */
  async runAll(now = new Date()) {
    const parents = await this.prisma.childGuardian.findMany({
      where: { role: 'PARENT' },
      distinct: ['userId'],
      select: { userId: true },
    });
    let created = 0;
    for (const { userId } of parents) {
      created += (await this.refresh(userId, now)).length;
    }

    const pending = await this.prisma.reminderSent.findMany({
      where: {
        emailedAt: null,
        createdAt: {
          gte: new Date(now.getTime() - EMAIL_WITHIN_DAYS * 86_400_000),
        },
      },
      include: {
        user: {
          select: {
            email: true,
            fullName: true,
            isVerified: true,
            checkupReminderEmails: true,
          },
        },
      },
    });
    let emailed = 0;
    for (const r of pending) {
      const [, childId, months] = r.key.split(':');
      if (!r.user.isVerified || !r.user.checkupReminderEmails) continue;
      const child = await this.prisma.child.findUnique({
        where: { id: childId },
        select: { fullName: true, nickname: true },
      });
      // The child may have been deleted since; nothing to send.
      if (child) {
        const sent = await this.mail
          .sendCheckupReminder(
            r.user.email,
            r.user.fullName,
            child.nickname?.trim() || child.fullName.split(' ')[0],
            checkupLabel(Number(months)),
            `/children/${childId}/growth`,
          )
          .catch((err: Error) => {
            this.logger.warn(`Reminder email failed: ${err.message}`);
            return false;
          });
        // Not sent (mail not configured, or it failed): leave it for the next run.
        if (!sent) continue;
        emailed++;
      }
      await this.prisma.reminderSent.update({
        where: { userId_key: { userId: r.userId, key: r.key } },
        data: { emailedAt: now },
      });
    }
    this.logger.log(
      `Check-up reminders: ${parents.length} parents, ${created} new, ${emailed} emailed`,
    );
    return { parents: parents.length, created, emailed };
  }
}
