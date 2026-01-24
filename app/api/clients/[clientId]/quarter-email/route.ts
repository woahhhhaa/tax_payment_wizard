import { NextResponse } from "next/server";
import { PaymentTaskStatus } from "@prisma/client";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildQuarterlyInstructionsEmail } from "@/lib/quarterly-email";
import { sendEmail } from "@/lib/email";
import { generatePortalToken, getRequestOrigin, hashPortalToken } from "@/lib/portal-token";

const LINK_TTL_DAYS = 365;

function parseQuarter(value: string | null) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1 || num > 4) return null;
  return num;
}

function parseTaxYear(value: string | null) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1900 || num > 2200) return null;
  return num;
}

function parseIsoDateTime(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
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

async function getOrCreatePlanRun(userId: string, clientId: string) {
  const planBatch = await getOrCreatePlanBatch(userId);
  return prisma.run.upsert({
    where: {
      batchId_clientId: {
        batchId: planBatch.id,
        clientId
      }
    },
    create: {
      userId,
      batchId: planBatch.id,
      clientId,
      snapshotJson: {}
    },
    update: {}
  });
}

async function getQuarterPayments(userId: string, runId: string, taxYear: number, quarter: number) {
  return prisma.payment.findMany({
    where: {
      userId,
      runId,
      taxYear,
      quarter,
      status: { not: PaymentTaskStatus.CANCELLED }
    },
    orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }]
  });
}

export async function GET(request: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerAuthSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = String(params.clientId || "").trim();
  if (!clientId) {
    return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
  }

  const url = new URL(request.url);
  const taxYear = parseTaxYear(url.searchParams.get("taxYear"));
  const quarter = parseQuarter(url.searchParams.get("quarter"));
  if (!taxYear || !quarter) {
    return NextResponse.json({ error: "taxYear and quarter are required" }, { status: 400 });
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, userId }
  });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const run = await getOrCreatePlanRun(userId, client.id);
  const payments = await getQuarterPayments(userId, run.id, taxYear, quarter);

  const { subject, html } = buildQuarterlyInstructionsEmail({
    client,
    quarter,
    taxYear,
    payments,
    checklistUrl: "{{CHECKLIST_LINK}}"
  });

  return NextResponse.json({ subject, html, count: payments.length });
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

  const body = await request.json().catch(() => ({}));
  const taxYear = parseTaxYear(body?.taxYear ? String(body.taxYear) : null);
  const quarter = parseQuarter(body?.quarter ? String(body.quarter) : null);
  const action = String(body?.action || "").trim();

  if (!taxYear || !quarter) {
    return NextResponse.json({ error: "taxYear and quarter are required" }, { status: 400 });
  }
  if (action !== "send" && action !== "schedule") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, userId }
  });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  if (!client.primaryEmail) {
    return NextResponse.json({ error: "Client email is required" }, { status: 400 });
  }

  const run = await getOrCreatePlanRun(userId, client.id);
  const payments = await getQuarterPayments(userId, run.id, taxYear, quarter);
  if (!payments.length) {
    return NextResponse.json({ error: `No payments found for Q${quarter} ${taxYear}` }, { status: 400 });
  }

  if (action === "schedule") {
    const sendAt = parseIsoDateTime(body?.sendAt);
    if (!sendAt) {
      return NextResponse.json({ error: "sendAt is required for scheduling" }, { status: 400 });
    }

    await prisma.notificationLog.create({
      data: {
        userId,
        clientId: client.id,
        messageType: "QUARTERLY_PAYMENT_INSTRUCTIONS",
        channel: "EMAIL",
        recipient: client.primaryEmail,
        status: "QUEUED",
        sendAt,
        metadata: {
          taxYear,
          quarter
        }
      }
    });

    return NextResponse.json({ ok: true });
  }

  const token = generatePortalToken();
  const tokenHash = hashPortalToken(token);
  const expiresAt = new Date(Date.now() + LINK_TTL_DAYS * 24 * 60 * 60 * 1000);

  const portalLink = await prisma.portalLink.create({
    data: {
      userId,
      clientId: client.id,
      runId: run.id,
      scope: "PLAN",
      tokenHash,
      expiresAt
    }
  });

  const origin = getRequestOrigin(request);
  const portalUrl = `${origin}/p/${token}`;

  const { subject, html, text } = buildQuarterlyInstructionsEmail({
    client,
    quarter,
    taxYear,
    payments,
    checklistUrl: portalUrl
  });

  const result = await sendEmail({
    to: client.primaryEmail,
    subject,
    html,
    text
  });

  await prisma.$transaction([
    prisma.notificationLog.create({
      data: {
        userId,
        clientId: client.id,
        portalLinkId: portalLink.id,
        messageType: "QUARTERLY_PAYMENT_INSTRUCTIONS",
        channel: "EMAIL",
        recipient: client.primaryEmail,
        status: "SENT",
        sendAt: new Date(),
        sentAt: new Date(),
        providerMessageId: result.messageId,
        metadata: {
          taxYear,
          quarter,
          paymentIds: payments.map((payment) => payment.id)
        }
      }
    }),
    prisma.payment.updateMany({
      where: {
        userId,
        id: { in: payments.map((payment) => payment.id) },
        status: PaymentTaskStatus.DRAFT
      },
      data: { status: PaymentTaskStatus.SENT }
    })
  ]);

  return NextResponse.json({ ok: true, portalUrl });
}

