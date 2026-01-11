"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type PaymentRow = {
  id: string;
  scope: string;
  stateCode: string | null;
  paymentType: string;
  dueDate: string | null;
  amount: string | null;
  status: string;
};

type FormState = {
  email: string;
  paidDate: string;
  paidAmount: string;
  confirmationNumber: string;
  note: string;
};

const EMPTY_FORM: FormState = {
  email: "",
  paidDate: "",
  paidAmount: "",
  confirmationNumber: "",
  note: ""
};

function formatAmount(amount: string | null) {
  if (!amount) return "—";
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return amount;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(numeric);
}

function formatStatus(status: string) {
  if (!status) return "Unknown";
  const label = status.toLowerCase().replace(/_/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function statusBadge(status: string) {
  const label = formatStatus(status);
  switch (status) {
    case "CONFIRMED":
    case "VERIFIED":
      return <Badge variant="success">{label}</Badge>;
    case "VIEWED":
      return <Badge variant="info">{label}</Badge>;
    case "OVERDUE":
      return <Badge variant="destructive">{label}</Badge>;
    case "CANCELLED":
      return (
        <Badge variant="outline" className="text-muted-foreground">
          {label}
        </Badge>
      );
    case "DRAFT":
    case "SENT":
    default:
      return <Badge variant="secondary">{label}</Badge>;
  }
}

export function ClientChecklist({
  token,
  payments
}: {
  token: string;
  payments: PaymentRow[];
  clientName?: string;
}) {
  const router = useRouter();
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePayment = useMemo(
    () => payments.find((payment) => payment.id === activePaymentId) || null,
    [activePaymentId, payments]
  );

  function openForm(payment: PaymentRow) {
    setActivePaymentId(payment.id);
    setFormState({
      ...EMPTY_FORM,
      paidAmount: payment.amount || ""
    });
    setError(null);
  }

  function closeForm() {
    setActivePaymentId(null);
    setFormState(EMPTY_FORM);
    setError(null);
  }

  async function submitConfirmation() {
    if (!activePayment) return;
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/p/${token}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: activePayment.id,
          email: formState.email,
          paidDate: formState.paidDate || undefined,
          paidAmount: formState.paidAmount || undefined,
          confirmationNumber: formState.confirmationNumber || undefined,
          note: formState.note || undefined
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Unable to confirm payment.");
      }

      closeForm();
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to confirm payment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="grid gap-4">
      {payments.map((payment) => {
        const isPaid = ["CONFIRMED", "VERIFIED"].includes(payment.status);
        const isCancelled = payment.status === "CANCELLED";
        const scopeLabel =
          payment.scope === "state"
            ? `State${payment.stateCode ? ` ${payment.stateCode}` : ""}`
            : "Federal";

        return (
          <Card
            key={payment.id}
            className={cn(
              "overflow-hidden bg-card/70 backdrop-blur transition-colors",
              activePaymentId === payment.id ? "ring-1 ring-primary/20" : "hover:bg-card/80"
            )}
          >
            <CardHeader className="space-y-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold leading-none tracking-tight">{scopeLabel}</p>
                    <p className="text-sm text-muted-foreground">{payment.paymentType}</p>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                    <span>
                      Due: <span className="text-foreground">{payment.dueDate || "—"}</span>
                    </span>
                    <span>
                      Amount:{" "}
                      <span className="text-foreground tabular-nums">{formatAmount(payment.amount)}</span>
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {statusBadge(payment.status)}
                  {!isPaid && !isCancelled && (
                    <Button type="button" size="sm" onClick={() => openForm(payment)}>
                      Mark as paid
                    </Button>
                  )}
                  {isPaid && <span className="text-sm text-muted-foreground">Confirmed</span>}
                  {isCancelled && <span className="text-sm text-muted-foreground">Cancelled</span>}
                </div>
              </div>
            </CardHeader>

            {activePaymentId === payment.id && (
              <CardContent className="pt-0">
                <div className="grid gap-4 rounded-lg border bg-muted/10 p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor={`email-${payment.id}`}>Your email</Label>
                      <Input
                        id={`email-${payment.id}`}
                        type="email"
                        value={formState.email}
                        onChange={(event) => setFormState({ ...formState, email: event.target.value })}
                        required
                        disabled={submitting}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`paid-date-${payment.id}`}>Paid date (optional)</Label>
                      <Input
                        id={`paid-date-${payment.id}`}
                        type="date"
                        value={formState.paidDate}
                        onChange={(event) => setFormState({ ...formState, paidDate: event.target.value })}
                        disabled={submitting}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`paid-amount-${payment.id}`}>Paid amount (optional)</Label>
                      <Input
                        id={`paid-amount-${payment.id}`}
                        type="number"
                        step="0.01"
                        value={formState.paidAmount}
                        onChange={(event) => setFormState({ ...formState, paidAmount: event.target.value })}
                        disabled={submitting}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`confirmation-${payment.id}`}>Confirmation number (optional)</Label>
                      <Input
                        id={`confirmation-${payment.id}`}
                        type="text"
                        value={formState.confirmationNumber}
                        onChange={(event) =>
                          setFormState({ ...formState, confirmationNumber: event.target.value })
                        }
                        disabled={submitting}
                      />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                      <Label htmlFor={`note-${payment.id}`}>Note (optional)</Label>
                      <Textarea
                        id={`note-${payment.id}`}
                        value={formState.note}
                        onChange={(event) => setFormState({ ...formState, note: event.target.value })}
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {error}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={submitConfirmation} disabled={submitting}>
                      {submitting ? "Submitting..." : "Confirm payment"}
                    </Button>
                    <Button variant="outline" type="button" onClick={closeForm} disabled={submitting}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </section>
  );
}
