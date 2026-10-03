-- Well-child check-up reminders: the email opt-out, and a log so a dismissed reminder stays gone.
ALTER TABLE "users" ADD COLUMN "checkupReminderEmails" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "reminders_sent" (
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailedAt" TIMESTAMP(3),

    CONSTRAINT "reminders_sent_pkey" PRIMARY KEY ("userId","key")
);

ALTER TABLE "reminders_sent" ADD CONSTRAINT "reminders_sent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
