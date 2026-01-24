import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function parseAmount(value: unknown): Prisma.Decimal | null {
  if (value === null || value === undefined || value === "") return null;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return null;
  return new Prisma.Decimal(num);
}

function parseTaxYear(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const cleaned = String(value).replace(/[^0-9]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function parseQuarter(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const raw = String(value || "").replace(/[^0-9]/g, "");
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 1 || num > 4) return null;
  return num;
}

function parseDueDate(value: unknown): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!isoMatch) return null;
  const date = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

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

export async function POST(request: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerAuthSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = String(params.clientId || "").trim();
  if (!clientId) {
    return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, userId }
  });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const scope = String(body?.scope || "").trim();
  const stateCode = body?.stateCode ? String(body.stateCode).trim().toUpperCase() : null;
  const paymentType = String(body?.paymentType || "").trim();
  const quarter = parseQuarter(body?.quarter);
  const dueDate = parseDueDate(body?.dueDate);
  const amount = parseAmount(body?.amount);
  const taxYear = parseTaxYear(body?.taxYear);
  const method = body?.method ? String(body.method).trim() : null;
  const notes = body?.notes ? String(body.notes).trim() : null;

  if (scope !== "federal" && scope !== "state") {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }
  if (scope === "state" && stateCode && stateCode.length !== 2) {
    return NextResponse.json({ error: "State code must be 2 letters" }, { status: 400 });
  }
  if (!paymentType) {
    return NextResponse.json({ error: "Payment type is required" }, { status: 400 });
  }
  if (!quarter) {
    return NextResponse.json({ error: "Quarter is required (1-4)" }, { status: 400 });
  }
  if (!taxYear) {
    return NextResponse.json({ error: "Tax year is required" }, { status: 400 });
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
      snapshotJson: {}
    },
    update: {}
  });

  const payment = await prisma.payment.create({
    data: {
      userId,
      runId: planRun.id,
      status: "DRAFT",
      scope,
      stateCode: scope === "state" ? stateCode : null,
      paymentType,
      quarter,
      dueDate,
      amount,
      taxYear,
      method,
      notes
    }
  });

  return NextResponse.json({ ok: true, paymentId: payment.id });
}

