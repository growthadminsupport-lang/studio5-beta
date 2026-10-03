import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { RemindersService } from './reminders.service';

/**
 * The daily email run, against stubs. The case that matters: a parent who opened GrowTH first
 * already has the in-app reminder, and must still get the email.
 */
type Row = {
  userId: string;
  key: string;
  createdAt: Date;
  emailedAt: Date | null;
  user: {
    email: string;
    fullName: string;
    isVerified: boolean;
    checkupReminderEmails: boolean;
  };
};

const NOW = new Date('2026-10-03T01:00:00Z');
const user = (over: Partial<Row['user']> = {}) => ({
  email: 'p@x.test',
  fullName: 'Pat',
  isVerified: true,
  checkupReminderEmails: true,
  ...over,
});

function build(rows: Row[], sendResult = true) {
  const sent: string[] = [];
  const prisma = {
    childGuardian: { findMany: () => Promise.resolve([]) }, // no new reminders today
    reminderSent: {
      findMany: () => Promise.resolve(rows.filter((r) => r.emailedAt === null)),
      update: ({
        where,
        data,
      }: {
        where: { userId_key: { userId: string; key: string } };
        data: { emailedAt: Date };
      }) => {
        const row = rows.find(
          (r) =>
            r.userId === where.userId_key.userId &&
            r.key === where.userId_key.key,
        );
        if (row) row.emailedAt = data.emailedAt;
        return Promise.resolve(row);
      },
    },
    child: {
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(
          where.id === 'gone' ? null : { fullName: 'Nok Test', nickname: null },
        ),
    },
  } as unknown as PrismaService;
  const mail = {
    sendCheckupReminder: (
      to: string,
      _name: string,
      child: string,
      label: string,
    ) => {
      sent.push(`${to} ${child} ${label}`);
      return Promise.resolve(sendResult);
    },
  } as unknown as MailService;
  return { svc: new RemindersService(prisma, mail), sent };
}

const row = (key: string, u = user(), userId = 'u1'): Row => ({
  userId,
  key,
  createdAt: NOW,
  emailedAt: null,
  user: u,
});

describe('RemindersService.runAll', () => {
  it('emails a reminder that was already shown in the app, once', async () => {
    const rows = [row('checkup:c1:2')];
    const { svc, sent } = build(rows);
    expect(await svc.runAll(NOW)).toMatchObject({ emailed: 1 });
    expect(sent).toEqual(['p@x.test Nok 2-month']);
    expect(rows[0].emailedAt).toEqual(NOW);
    expect(await svc.runAll(NOW)).toMatchObject({ emailed: 0 });
  });

  it('skips opted-out and unconfirmed addresses', async () => {
    const rows = [
      row('checkup:c1:24', user({ checkupReminderEmails: false })),
      row('checkup:c2:30', user({ isVerified: false }), 'u2'),
    ];
    const { svc, sent } = build(rows);
    expect(await svc.runAll(NOW)).toMatchObject({ emailed: 0 });
    expect(sent).toEqual([]);
  });

  it('keeps a reminder whose email failed for the next run', async () => {
    const rows = [row('checkup:c1:84')];
    const { svc } = build(rows, false);
    await svc.runAll(NOW);
    expect(rows[0].emailedAt).toBeNull();
  });

  it('closes a reminder whose child was deleted, without emailing', async () => {
    const rows = [row('checkup:gone:12')];
    const { svc, sent } = build(rows);
    await svc.runAll(NOW);
    expect(sent).toEqual([]);
    expect(rows[0].emailedAt).toEqual(NOW);
  });
});
