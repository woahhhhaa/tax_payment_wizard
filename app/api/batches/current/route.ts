import { PaymentTaskStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeSession, createEmptySession } from "@/lib/wizard-session";
import { STATE_NAME_TO_CODE } from "@/lib/us-states";

function parseQuarter(value: unknown): number | null {
  const raw = String(value || "").toUpperCase().replace(/[^Q0-9]/g, "");
  if (!raw) return null;
  const match = raw.match(/Q([1-4])/);
  if (match) return Number(match[1]);
  const asNum = Number(raw);
  return Number.isFinite(asNum) ? asNum : null;
}

function parseAmount(value: unknown): Prisma.Decimal | null {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return null;
  return new Prisma.Decimal(num);
}

function parseDueDate(value: unknown): Date | null {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const date = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const mdyMatch = str.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (mdyMatch) {
    const date = new Date(`${mdyMatch[3]}-${mdyMatch[1]}-${mdyMatch[2]}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const fallback = new Date(str);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function parseTaxYear(value: unknown): number | null {
  const cleaned = String(value || "").replace(/[^0-9]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

type WizardPayment = {
  scope: "federal" | "state";
  stateCode?: string | null;
  paymentType: string;
  quarter?: number | null;
  dueDate?: Date | null;
  amount?: Prisma.Decimal | null;
  taxYear?: number | null;
  notes?: string | null;
  method?: string | null;
  sortOrder?: number | null;
};

function extractPayments(clientData: Record<string, any>): WizardPayment[] {
  const payments: WizardPayment[] = [];
  const federal = Array.isArray(clientData?.federalPayments) ? clientData.federalPayments : [];
  federal.forEach((payment: any, index: number) => {
    payments.push({
      scope: "federal",
      paymentType: String(payment?.type || "Federal").trim() || "Federal",
      quarter: parseQuarter(payment?.quarter),
      dueDate: parseDueDate(payment?.dueDate),
      amount: parseAmount(payment?.amount),
      taxYear: parseTaxYear(payment?.taxPeriod),
      notes: payment?.description ? String(payment.description) : null,
      method: payment?.method ? String(payment.method) : null,
      sortOrder: index + 1
    });
  });

  const states = Array.isArray(clientData?.statePayments) ? clientData.statePayments : [];
  states.forEach((stateEntry: any, stateIndex: number) => {
    const stateName = String(stateEntry?.stateName || "").trim();
    const stateCode = STATE_NAME_TO_CODE[stateName.toLowerCase()] || null;
    const statePayments = Array.isArray(stateEntry?.payments) ? stateEntry.payments : [];
    statePayments.forEach((payment: any, paymentIndex: number) => {
      payments.push({
        scope: "state",
        stateCode,
        paymentType: String(payment?.type || "State").trim() || "State",
        quarter: parseQuarter(payment?.quarter),
        dueDate: parseDueDate(payment?.dueDate),
        amount: parseAmount(payment?.amount),
        taxYear: parseTaxYear(payment?.taxPeriod),
        notes: payment?.description ? String(payment.description) : null,
        method: payment?.method ? String(payment.method) : null,
        sortOrder: stateIndex * 100 + paymentIndex + 1
      });
    });
  });

  return payments;
}

function makePaymentKey(payment: { scope: string; stateCode?: string | null; sortOrder?: number | null }) {
  const stateCode = payment.stateCode ?? "";
  const sortOrder = payment.sortOrder ?? "";
  return `${payment.scope}:${stateCode}:${sortOrder}`;
}

async function getOrCreateLatestBatch(userId: string) {
  const latest = await prisma.batch.findFirst({
    where: { userId },
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
      snapshotJson: snapshot
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
      where: { id: String(body.batchId), userId }
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

    const run = await prisma.run.upsert({
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

    const existingPayments = await prisma.payment.findMany({
      where: { runId: run.id, userId }
    });
    const existingByKey = new Map(existingPayments.map((payment) => [makePaymentKey(payment), payment]));
    const seenKeys = new Set<string>();

    for (const payment of extractPayments(clientData)) {
      const key = makePaymentKey(payment);
      const existing = existingByKey.get(key);
      const data = {
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
      };

      if (existing) {
        const statusUpdate =
          existing.status === PaymentTaskStatus.CANCELLED ? { status: PaymentTaskStatus.DRAFT } : {};
        await prisma.payment.update({
          where: { id: existing.id },
          data: { ...data, ...statusUpdate }
        });
      } else {
        await prisma.payment.create({
          data: {
            userId,
            runId: run.id,
            status: PaymentTaskStatus.DRAFT,
            ...data
          }
        });
      }
      seenKeys.add(key);
    }

    const cancelledIds = existingPayments
      .filter((payment) => !seenKeys.has(makePaymentKey(payment)))
      .map((payment) => payment.id);

    if (cancelledIds.length) {
      await prisma.payment.updateMany({
        where: { id: { in: cancelledIds } },
        data: { status: PaymentTaskStatus.CANCELLED }
      });
    }
  }

  return NextResponse.json({ ok: true, batchId: batch.id });
}
