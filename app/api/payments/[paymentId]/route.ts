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

export async function PATCH(request: Request, { params }: { params: { paymentId: string } }) {
  const session = await getServerAuthSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const paymentId = String(params.paymentId || "").trim();
  if (!paymentId) {
    return NextResponse.json({ error: "Missing paymentId" }, { status: 400 });
  }

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, userId },
    include: { run: { include: { batch: true } } }
  });

  if (!payment || payment.run.batch.kind !== "PLAN") {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const scope = body?.scope ? String(body.scope).trim() : payment.scope;
  const stateCode = body?.stateCode ? String(body.stateCode).trim().toUpperCase() : null;
  const paymentType = body?.paymentType ? String(body.paymentType).trim() : payment.paymentType;
  const quarter = body?.quarter !== undefined ? parseQuarter(body.quarter) : payment.quarter;
  const dueDate = body?.dueDate !== undefined ? parseDueDate(body.dueDate) : payment.dueDate;
  const amount = body?.amount !== undefined ? parseAmount(body.amount) : payment.amount;
  const taxYear = body?.taxYear !== undefined ? parseTaxYear(body.taxYear) : payment.taxYear;
  const method = body?.method !== undefined ? (body.method ? String(body.method).trim() : null) : payment.method;
  const notes = body?.notes !== undefined ? (body.notes ? String(body.notes).trim() : null) : payment.notes;

  if (scope !== "federal" && scope !== "state") {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }
  if (scope === "state" && stateCode && stateCode.length !== 2) {
    return NextResponse.json({ error: "State code must be 2 letters" }, { status: 400 });
  }
  if (!paymentType) {
    return NextResponse.json({ error: "Payment type is required" }, { status: 400 });
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
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

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: { paymentId: string } }) {
  void request;
  const session = await getServerAuthSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const paymentId = String(params.paymentId || "").trim();
  if (!paymentId) {
    return NextResponse.json({ error: "Missing paymentId" }, { status: 400 });
  }

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, userId },
    include: { run: { include: { batch: true } } }
  });

  if (!payment || payment.run.batch.kind !== "PLAN") {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "CANCELLED" }
  });

  return NextResponse.json({ ok: true });
}

