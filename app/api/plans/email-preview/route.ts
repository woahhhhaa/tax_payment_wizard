import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/lib/auth";
import { buildQuarterlyInstructionsEmail } from "@/lib/quarterly-email";
import { extractWizardPayments } from "@/lib/wizard-payments";

type EmailPreviewBody = {
  quarter?: unknown;
  taxYear?: unknown;
  clientData?: unknown;
  addresseeName?: unknown;
  clientName?: unknown;
};

function parseQuarter(value: unknown) {
  const raw = String(value ?? "").trim().toUpperCase();
  const normalized = raw.replace(/[^Q0-9]/g, "");
  if (!normalized) return null;
  const qMatch = normalized.match(/Q([1-4])/);
  if (qMatch) return Number(qMatch[1]);
  const asNum = Number(normalized);
  if (!Number.isFinite(asNum) || asNum < 1 || asNum > 4) return null;
  return asNum;
}

function parseTaxYear(value: unknown) {
  const normalized = String(value ?? "").replace(/[^0-9]/g, "");
  if (!normalized) return null;
  const year = Number(normalized);
  if (!Number.isFinite(year) || year < 1900 || year > 2200) return null;
  return year;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as EmailPreviewBody;
  const quarter = parseQuarter(body.quarter);
  const taxYear = parseTaxYear(body.taxYear);
  if (!quarter || !taxYear) {
    return NextResponse.json({ error: "quarter and taxYear are required." }, { status: 400 });
  }

  const source = asRecord(body.clientData);
  const addresseeName = String(body.addresseeName ?? source.addresseeName ?? source.entityName ?? "").trim();
  const clientName = String(body.clientName ?? source.entityName ?? source.addresseeName ?? "").trim();

  const extracted = extractWizardPayments(source);
  const payments = extracted
    .filter((payment) => payment.quarter === quarter && payment.taxYear === taxYear)
    .sort((a, b) => {
      const dueA = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const dueB = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (dueA !== dueB) return dueA - dueB;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });

  if (!payments.length) {
    return NextResponse.json(
      { error: `No payments found for Q${quarter} ${taxYear}.` },
      { status: 400 }
    );
  }

  const { subject, html, text } = buildQuarterlyInstructionsEmail({
    client: {
      name: clientName || null,
      addresseeName: addresseeName || null
    },
    quarter,
    taxYear,
    payments: payments.map((payment) => ({
      scope: payment.scope,
      stateCode: payment.stateCode ?? null,
      paymentType: payment.paymentType,
      dueDate: payment.dueDate ?? null,
      amount: payment.amount ?? null,
      method: payment.method ?? null,
      notes: payment.notes ?? null
    })),
    checklistUrl: "{{CHECKLIST_LINK}}"
  });

  return NextResponse.json({
    subject,
    html,
    text,
    quarter,
    taxYear,
    paymentCount: payments.length
  });
}
