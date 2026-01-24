import { PaymentTaskStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeSession, createEmptySession } from "@/lib/wizard-session";
import { extractWizardPayments } from "@/lib/wizard-payments";

async function getOrCreateLatestBatch(userId: string) {
  const latest = await prisma.batch.findFirst({
    where: { userId, kind: "WIZARD" },
    orderBy: { updatedAt: "desc" }
  });

  if (latest) {
    return latest;
  }

  const snapshot = createEmptySession();
  return prisma.batch.create({
    data: {
      userId,
      name: snapshot.name,
      kind: "WIZARD",
      snapshotJson: snapshot
    }
  });
}

async function getOrCreatePlanBatch(userId: string) {
  const existing = await prisma.batch.findFirst({
    where: { userId, kind: "PLAN" },
    orderBy: { createdAt: "asc" }
  });

  if (existing) {
    return existing;
  }

  return prisma.batch.create({
    data: {
      userId,
      name: "Client Plans",
      kind: "PLAN",
      snapshotJson: {}
    }
  });
}

export async function GET() {
  const session = await getServerAuthSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const batch = await getOrCreateLatestBatch(userId);
  const snapshot = normalizeSession(batch.snapshotJson);

  return NextResponse.json({
    batchId: batch.id,
    snapshot
  });
}

export async function PUT(request: Request) {
  const session = await getServerAuthSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const incomingSnapshot = body?.snapshot ?? body?.snapshotJson ?? body;
  const normalized = normalizeSession(incomingSnapshot);

  let batch = null;
  if (body?.batchId) {
    batch = await prisma.batch.findFirst({
      where: { id: String(body.batchId), userId, kind: "WIZARD" }
    });
  }
  if (!batch) {
    batch = await getOrCreateLatestBatch(userId);
  }

  batch = await prisma.batch.update({
    where: { id: batch.id },
    data: {
      name: normalized.name,
      snapshotJson: normalized
    }
  });

  const planBatch = await getOrCreatePlanBatch(userId);

  for (const client of normalized.clients) {
    const clientData = client.data ?? {};
    const addresseeName = String(clientData?.addresseeName || "").trim();
    const entityName = String(clientData?.entityName || "").trim();
    const entityType = String(clientData?.entityType || "").trim();

    const clientRecord = await prisma.client.upsert({
      where: {
        userId_wizardClientId: {
          userId,
          wizardClientId: client.clientId
        }
      },
      create: {
        userId,
        wizardClientId: client.clientId,
        name: entityName || addresseeName || client.clientId,
        addresseeName,
        entityType
      },
      update: {
        name: entityName || addresseeName || client.clientId,
        addresseeName,
        entityType
      }
    });

    await prisma.run.upsert({
      where: {
        batchId_clientId: {
          batchId: batch.id,
          clientId: clientRecord.id
        }
      },
      create: {
        userId,
        batchId: batch.id,
        clientId: clientRecord.id,
        snapshotJson: clientData
      },
      update: {
        snapshotJson: clientData
      }
    });

    const planRun = await prisma.run.upsert({
      where: {
        batchId_clientId: {
          batchId: planBatch.id,
          clientId: clientRecord.id
        }
      },
      create: {
        userId,
        batchId: planBatch.id,
        clientId: clientRecord.id,
        snapshotJson: clientData
      },
      update: {
        snapshotJson: clientData
      }
    });

    const existingPlanPayments = await prisma.payment.count({
      where: { userId, runId: planRun.id }
    });

    if (existingPlanPayments === 0) {
      const extractedPayments = extractWizardPayments(clientData);
      if (extractedPayments.length) {
        await prisma.payment.createMany({
          data: extractedPayments.map((payment) => ({
            userId,
            runId: planRun.id,
            status: PaymentTaskStatus.DRAFT,
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
  }

  return NextResponse.json({ ok: true, batchId: batch.id });
}
