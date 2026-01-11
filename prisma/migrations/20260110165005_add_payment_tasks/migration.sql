-- CreateEnum
CREATE TYPE "PaymentTaskStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'CONFIRMED', 'VERIFIED', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PortalLinkScope" AS ENUM ('PLAN', 'PAYMENT');

-- CreateEnum
CREATE TYPE "PaymentEventActorType" AS ENUM ('CLIENT', 'STAFF', 'SYSTEM');

-- CreateEnum
CREATE TYPE "KarbonSyncStatus" AS ENUM ('NOT_LINKED', 'LINKED', 'ERROR');

-- CreateEnum
CREATE TYPE "KarbonObjectType" AS ENUM ('CLIENT', 'PAYMENT', 'PLAN');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "status" "PaymentTaskStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "confirmedAt" TIMESTAMP(3),
ADD COLUMN "confirmedByEmail" TEXT,
ADD COLUMN "confirmedAmount" DECIMAL(12,2),
ADD COLUMN "confirmedDate" TIMESTAMP(3),
ADD COLUMN "confirmationNumber" TEXT,
ADD COLUMN "confirmationNote" TEXT,
ADD COLUMN "proofFileId" TEXT,
ADD COLUMN "verifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PortalLink" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "runId" UUID,
    "paymentId" UUID,
    "scope" "PortalLinkScope" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentConfirmationEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorType" "PaymentEventActorType" NOT NULL,
    "actorEmail" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentConfirmationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KarbonMapping" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "objectType" "KarbonObjectType" NOT NULL,
    "localId" TEXT NOT NULL,
    "karbonKey" TEXT,
    "status" "KarbonSyncStatus" NOT NULL DEFAULT 'NOT_LINKED',
    "errorMessage" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KarbonMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "clientId" UUID,
    "paymentId" UUID,
    "portalLinkId" UUID,
    "messageType" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "recipient" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "sentAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PortalLink_tokenHash_key" ON "PortalLink"("tokenHash");

-- CreateIndex
CREATE INDEX "PortalLink_userId_clientId_idx" ON "PortalLink"("userId", "clientId");

-- CreateIndex
CREATE INDEX "PortalLink_userId_runId_idx" ON "PortalLink"("userId", "runId");

-- CreateIndex
CREATE INDEX "PortalLink_userId_paymentId_idx" ON "PortalLink"("userId", "paymentId");

-- CreateIndex
CREATE INDEX "PaymentConfirmationEvent_userId_createdAt_idx" ON "PaymentConfirmationEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentConfirmationEvent_paymentId_createdAt_idx" ON "PaymentConfirmationEvent"("paymentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "KarbonMapping_userId_objectType_localId_key" ON "KarbonMapping"("userId", "objectType", "localId");

-- CreateIndex
CREATE INDEX "KarbonMapping_userId_status_idx" ON "KarbonMapping"("userId", "status");

-- CreateIndex
CREATE INDEX "NotificationLog_userId_createdAt_idx" ON "NotificationLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationLog_clientId_createdAt_idx" ON "NotificationLog"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationLog_paymentId_createdAt_idx" ON "NotificationLog"("paymentId", "createdAt");

-- AddForeignKey
ALTER TABLE "PortalLink" ADD CONSTRAINT "PortalLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalLink" ADD CONSTRAINT "PortalLink_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalLink" ADD CONSTRAINT "PortalLink_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalLink" ADD CONSTRAINT "PortalLink_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentConfirmationEvent" ADD CONSTRAINT "PaymentConfirmationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentConfirmationEvent" ADD CONSTRAINT "PaymentConfirmationEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KarbonMapping" ADD CONSTRAINT "KarbonMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_portalLinkId_fkey" FOREIGN KEY ("portalLinkId") REFERENCES "PortalLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
