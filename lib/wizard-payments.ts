import { Prisma } from "@prisma/client";
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

export type WizardPayment = {
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

export function extractWizardPayments(clientData: Record<string, any>): WizardPayment[] {
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

