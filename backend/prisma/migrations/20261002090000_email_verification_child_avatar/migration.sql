-- Confirmation links for password-registered addresses.
ALTER TABLE "users" ADD COLUMN "emailVerifyTokenHash" TEXT;
ALTER TABLE "users" ADD COLUMN "emailVerifyExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "users_emailVerifyTokenHash_key" ON "users"("emailVerifyTokenHash");

-- The illustrated child avatar ({ skin, hair, hairColor }).
ALTER TABLE "children" ADD COLUMN "avatar" JSONB;
