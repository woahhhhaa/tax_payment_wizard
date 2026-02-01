import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  generatePortalToken,
  getPortalBaseUrl,
  getPortalLinkExpiresAt,
  hashPortalToken
} from "@/lib/portal-token";
import { extractWizardPayments } from "@/lib/wizard-payments";

async function getOrCreatePlanBatch(userId: string) {
  const existing = await prisma.batch.findFirst({
    where: { userId, kind: "PLAN" },
    orderBy: { createdAt: "asc" }
  });

  if (existing) return existing;

  return prisma.batch.create({
    data: {
      userId,
      name: "Client Plans",
      kind: "PLAN",
      snapshotJson: {}
    }
  });
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const batchId = String(body?.batchId || "").trim();
  const wizardClientId = String(body?.wizardClientId || "").trim();

  if (!batchId || !wizardClientId) {
    return NextResponse.json({ error: "Missing batchId or wizardClientId" }, { status: 400 });
  }

  const batch = await prisma.batch.findFirst({
    where: { id: batchId, userId, kind: "WIZARD" }
  });

  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  const client = await prisma.client.findFirst({
    where: { userId, wizardClientId }
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const wizardRun = await prisma.run.findFirst({
    where: {
      batchId,
      clientId: client.id,
      userId
    }
  });

  if (!wizardRun) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const planBatch = await getOrCreatePlanBatch(userId);
  const planRun = await prisma.run.upsert({
    where: {
      batchId_clientId: {
        batchId: planBatch.id,
        clientId: client.id
      }
    },
    create: {
      userId,
      batchId: planBatch.id,
      clientId: client.id,
      snapshotJson: (wizardRun.snapshotJson ?? {}) as Prisma.InputJsonValue
    },
    update: {
      snapshotJson: (wizardRun.snapshotJson ?? {}) as Prisma.InputJsonValue
    }
  });

  const planPayments = await prisma.payment.count({
    where: { userId, runId: planRun.id }
  });

  if (planPayments === 0) {
    const extractedPayments = extractWizardPayments(wizardRun.snapshotJson as Record<string, any>);
    if (extractedPayments.length) {
      await prisma.payment.createMany({
        data: extractedPayments.map((payment) => ({
          userId,
          runId: planRun.id,
          status: "DRAFT",
          scope: payment.scope,
          stateCode: payment.stateCode,
          paymentType: payment.paymentType,
          quarter: payment.quarter,
          dueDate: payment.dueDate,
          amount: payment.amount,
          taxYear: payment.taxYear,
          notes: payment.notes,
          method: payment.method,
          sortOrder: payment.sortOrder
        }))
      });
    }
  }

  const token = generatePortalToken();
  const tokenHash = hashPortalToken(token);
  const now = new Date();
  const expiresAt = getPortalLinkExpiresAt(now);

  await prisma.portalLink.updateMany({
    where: {
      userId,
      runId: planRun.id,
      scope: "PLAN",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
    },
    data: { expiresAt: now }
  });

  await prisma.portalLink.create({
    data: {
      userId,
      clientId: client.id,
      runId: planRun.id,
      scope: "PLAN",
      tokenHash,
      expiresAt
    }
  });

  const portalBaseUrl = getPortalBaseUrl(request);
  const portalUrl = `${portalBaseUrl}/p/${token}`;

  return NextResponse.json({ portalUrl });
}
