-- When a refresh token was rotated (as opposed to revoked by logout or a password change).
ALTER TABLE "sessions" ADD COLUMN "rotatedAt" TIMESTAMP(3);
