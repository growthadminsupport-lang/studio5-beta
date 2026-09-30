-- CreateEnum
CREATE TYPE "DoctorStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ChildRole" AS ENUM ('PARENT', 'CARETAKER', 'DOCTOR');

-- CreateEnum
CREATE TYPE "BoneAgeReview" AS ENUM ('NORMAL', 'ADVANCED', 'DELAYED');

-- CreateEnum
CREATE TYPE "SupportKind" AS ENUM ('CONTACT', 'PROBLEM');

-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('NEW', 'READ', 'RESOLVED');

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('USER', 'DOCTOR', 'ADMIN');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
-- PARENT and EDUCATOR accounts become USER: being a parent is now a per-child role
-- (child_guardians.role), not an account type. A plain cast would fail on those values.
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING (
  CASE WHEN "role"::text = 'ADMIN' THEN 'ADMIN' ELSE 'USER' END
)::"UserRole_new";
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'USER';
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'PUBERTY_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'INVITE_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'DOCTOR_REVIEWED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "doctorReviewNote" TEXT,
ADD COLUMN     "doctorStatus" "DoctorStatus",
ADD COLUMN     "hospital" TEXT,
ADD COLUMN     "licenseNumber" TEXT,
ALTER COLUMN "role" SET DEFAULT 'USER';

-- AlterTable
ALTER TABLE "children" ADD COLUMN     "hn" TEXT;

-- AlterTable
ALTER TABLE "child_guardians" ADD COLUMN     "role" "ChildRole" NOT NULL DEFAULT 'PARENT';

-- AlterTable
ALTER TABLE "growth_records" ADD COLUMN     "recordedById" TEXT;

-- AlterTable
ALTER TABLE "puberty_screenings" ADD COLUMN     "submittedById" TEXT;

-- AlterTable
ALTER TABLE "bone_age_predictions" ADD COLUMN     "chronologicalAgeMonths" INTEGER,
ADD COLUMN     "doctorNote" TEXT,
ADD COLUMN     "examDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "review" "BoneAgeReview",
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "uploadedById" TEXT;

-- Existing records were uploaded on the day they were taken, as far as anyone knows.
UPDATE "bone_age_predictions" SET "examDate" = "createdAt";

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "childId" TEXT;

-- AlterTable
ALTER TABLE "support_messages" ADD COLUMN     "context" JSONB,
ADD COLUMN     "kind" "SupportKind" NOT NULL DEFAULT 'CONTACT',
ADD COLUMN     "status" "SupportStatus" NOT NULL DEFAULT 'NEW';

-- CreateTable
CREATE TABLE "child_invites" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "role" "ChildRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT,
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "child_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "child_invites_tokenHash_key" ON "child_invites"("tokenHash");

-- CreateIndex
CREATE INDEX "child_invites_childId_idx" ON "child_invites"("childId");

-- CreateIndex
CREATE INDEX "children_hn_idx" ON "children"("hn");

-- AddForeignKey
ALTER TABLE "child_invites" ADD CONSTRAINT "child_invites_childId_fkey" FOREIGN KEY ("childId") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_invites" ADD CONSTRAINT "child_invites_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

