import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPortalToken } from "@/lib/portal-token";

function parseAmount(value: unknown): Prisma.Decimal | null {
  if (value === null || value === undefined || value === "") return null;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return null;
  return new Prisma.Decimal(num);
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(request: Request, { params }: { params: { token: string } }) {
  const token = params.token;
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const tokenHash = hashPortalToken(token);
  const now = new Date();

  const portalLink = await prisma.portalLink.findFirst({
    where: {
      tokenHash,
      scope: "PLAN",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
    }
  });

  if (!portalLink?.runId) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const paymentId = String(body?.paymentId || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();

  if (!paymentId || !email) {
    return NextResponse.json({ error: "PaymentId and email are required" }, { status: 400 });
  }

  if (!email.includes("@") || email.length > 320) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      runId: portalLink.runId,
      userId: portalLink.userId
    }
  });

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const confirmedDate = parseDate(body?.paidDate);
  const confirmedAmount = parseAmount(body?.paidAmount);
  const confirmationNumber = body?.confirmationNumber ? String(body.confirmationNumber) : null;
  const confirmationNote = body?.note ? String(body.note) : null;

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "CONFIRMED",
        confirmedAt: now,
        confirmedByEmail: email,
        confirmedDate,
        confirmedAmount,
        confirmationNumber,
        confirmationNote
      }
    }),
    prisma.paymentConfirmationEvent.create({
      data: {
        userId: portalLink.userId,
        paymentId: payment.id,
        eventType: "CONFIRMED",
        actorType: "CLIENT",
        actorEmail: email,
        metadata: {
          paidDate: confirmedDate ? confirmedDate.toISOString() : null,
          paidAmount: confirmedAmount ? confirmedAmount.toString() : null,
          confirmationNumber,
          note: confirmationNote
        }
      }
    })
  ]);

  return NextResponse.json({ ok: true });
}
