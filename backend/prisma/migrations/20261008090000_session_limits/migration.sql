-- Session limits (src/auth/session-limits.ts): whether the session was remembered, and when it
-- ends however active it is. Existing sessions were all issued with 7-day sliding tokens; they
-- count as remembered and end 30 days after their latest token was issued.
ALTER TABLE "sessions" ADD COLUMN "persistent" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "sessions" ADD COLUMN "absoluteExpiresAt" TIMESTAMP(3);
UPDATE "sessions" SET "absoluteExpiresAt" = "createdAt" + INTERVAL '30 days';
ALTER TABLE "sessions" ALTER COLUMN "absoluteExpiresAt" SET NOT NULL;
