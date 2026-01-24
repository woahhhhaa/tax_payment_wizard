-- CreateEnum
CREATE TYPE "BatchKind" AS ENUM ('WIZARD', 'PLAN');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN "primaryEmail" TEXT;

-- AlterTable
ALTER TABLE "Batch" ADD COLUMN "kind" "BatchKind" NOT NULL DEFAULT 'WIZARD';

-- AlterTable
ALTER TABLE "NotificationLog" ADD COLUMN "sendAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Batch_userId_kind_updatedAt_idx" ON "Batch"("userId", "kind", "updatedAt");

-- CreateIndex
CREATE INDEX "NotificationLog_status_sendAt_idx" ON "NotificationLog"("status", "sendAt");

