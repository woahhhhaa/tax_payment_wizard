import type { Prisma } from "@prisma/client";

type PaymentLine = {
  scope: string;
  stateCode: string | null;
  paymentType: string;
  dueDate: Date | null;
  amount: Prisma.Decimal | null;
  method: string | null;
  notes: string | null;
};

type ClientLike = {
  name: string | null;
  addresseeName: string | null;
};

function formatCurrency(amount: Prisma.Decimal | null) {
  if (!amount) return "—";
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return amount.toString();
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(numeric);
}

function formatDate(date: Date | null) {
  if (!date) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function paymentLabel(payment: PaymentLine) {
  if (payment.scope === "state") {
    return `State${payment.stateCode ? ` (${payment.stateCode})` : ""}`;
  }
  return "Federal";
}

export function buildQuarterlyInstructionsEmail({
  client,
  quarter,
  taxYear,
  payments,
  checklistUrl
}: {
  client: ClientLike;
  quarter: number;
  taxYear: number;
  payments: PaymentLine[];
  checklistUrl: string;
}) {
  const recipientName = client.addresseeName || client.name || "there";
  const subject = `${client.name || client.addresseeName || "Client"} — Q${quarter} ${taxYear} estimated tax payments`;

  const linesHtml = payments
    .map((payment) => {
      const method = payment.method ? escapeHtml(payment.method) : "—";
      const notes = payment.notes ? escapeHtml(payment.notes) : "";
      const notesHtml = notes ? `<div style="margin-top:4px;color:#64748b;font-size:12px;">${notes}</div>` : "";
      return `
        <tr>
          <td style="padding:10px 12px;border-top:1px solid #e2e8f0;">
            <div style="font-weight:600;color:#0f172a;">${escapeHtml(paymentLabel(payment))}</div>
            <div style="color:#64748b;font-size:12px;">${escapeHtml(payment.paymentType)}</div>
            ${notesHtml}
          </td>
          <td style="padding:10px 12px;border-top:1px solid #e2e8f0;white-space:nowrap;color:#0f172a;">${escapeHtml(
            formatDate(payment.dueDate)
          )}</td>
          <td style="padding:10px 12px;border-top:1px solid #e2e8f0;white-space:nowrap;text-align:right;font-weight:600;color:#0f172a;">${escapeHtml(
            formatCurrency(payment.amount)
          )}</td>
          <td style="padding:10px 12px;border-top:1px solid #e2e8f0;color:#0f172a;">${method}</td>
        </tr>
      `;
    })
    .join("");

  const html = `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,Helvetica,Arial;line-height:1.45;color:#0f172a;">
      <p style="margin:0 0 12px;">Hi ${escapeHtml(recipientName)},</p>
      <p style="margin:0 0 16px;">
        Below are the <strong>Q${quarter}</strong> estimated tax payments for <strong>${taxYear}</strong>.
        Please submit each payment by the due date and keep the confirmation number/receipt.
      </p>

      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="text-align:left;padding:10px 12px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;">Jurisdiction</th>
            <th style="text-align:left;padding:10px 12px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;">Due</th>
            <th style="text-align:right;padding:10px 12px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;">Amount</th>
            <th style="text-align:left;padding:10px 12px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;">Method</th>
          </tr>
        </thead>
        <tbody>
          ${linesHtml || ""}
        </tbody>
      </table>

      <p style="margin:16px 0 0;">
        After you’ve submitted the payments, please confirm them here:
        <a href="${escapeHtml(checklistUrl)}" style="color:#2127de;text-decoration:underline;">${escapeHtml(checklistUrl)}</a>
      </p>

      <hr style="border:none;border-top:1px solid #e2e8f0;margin:18px 0;" />
      <p style="margin:0;color:#64748b;font-size:12px;">
        Note: This message provides payment instructions only and does not constitute tax advice. If anything looks off, reply and we’ll adjust.
      </p>
    </div>
  `;

  const text = `Hi ${recipientName},

Below are the Q${quarter} estimated tax payments for ${taxYear}.

${payments
  .map((payment) => {
    const label = paymentLabel(payment);
    const due = formatDate(payment.dueDate);
    const amt = formatCurrency(payment.amount);
    return `- ${label}: ${amt} due ${due}`;
  })
  .join("\n")}

After you submit the payments, confirm them here: ${checklistUrl}
`;

  return { subject, html, text };
}
