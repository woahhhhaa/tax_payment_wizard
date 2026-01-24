"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ClientSummary = {
  id: string;
  name: string | null;
  addresseeName: string | null;
  entityType: string | null;
  primaryEmail: string | null;
};

type PaymentRow = {
  id: string;
  scope: string;
  stateCode: string | null;
  paymentType: string;
  quarter: number | null;
  dueDate: string | null;
  amount: string | null;
  taxYear: number | null;
  notes: string | null;
  method: string | null;
  status: string;
};

type NotificationRow = {
  id: string;
  status: string;
  recipient: string;
  sendAt: string | null;
  sentAt: string | null;
  errorMessage: string | null;
  metadata: unknown;
  createdAt: string;
};

type PaymentDraft = {
  scope: string;
  stateCode: string;
  paymentType: string;
  quarter: string;
  dueDate: string;
  amount: string;
  taxYear: string;
  method: string;
  notes: string;
};

function formatCurrency(value: string | null) {
  if (!value) return "—";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function formatTimestamp(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function normalizeDateInput(value: string | null) {
  return value ?? "";
}

function getMetaQuarter(meta: unknown): number | null {
  if (!meta || typeof meta !== "object") return null;
  const value = (meta as any).quarter;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getMetaTaxYear(meta: unknown): number | null {
  if (!meta || typeof meta !== "object") return null;
  const value = (meta as any).taxYear;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function ClientDetail({
  client,
  payments,
  notifications
}: {
  client: ClientSummary;
  payments: PaymentRow[];
  notifications: NotificationRow[];
}) {
  const router = useRouter();
  const title = client.name || client.addresseeName || "Client";

  const [email, setEmail] = useState(client.primaryEmail || "");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const taxYears = useMemo(() => {
    const years = Array.from(new Set(payments.map((p) => p.taxYear).filter((y): y is number => !!y)));
    years.sort((a, b) => b - a);
    if (!years.length) years.push(new Date().getFullYear());
    return years;
  }, [payments]);

  const [selectedTaxYear, setSelectedTaxYear] = useState<number>(taxYears[0] ?? new Date().getFullYear());

  const paymentsForYear = useMemo(
    () => payments.filter((payment) => payment.taxYear === selectedTaxYear),
    [payments, selectedTaxYear]
  );

  const [newPayment, setNewPayment] = useState<PaymentDraft>({
    scope: "federal",
    stateCode: "",
    paymentType: "Estimated Tax",
    quarter: "1",
    dueDate: "",
    amount: "",
    taxYear: String(selectedTaxYear),
    method: "",
    notes: ""
  });
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<PaymentDraft | null>(null);
  const [savingPayment, setSavingPayment] = useState(false);

  const [preview, setPreview] = useState<{ quarter: number; subject: string; html: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendingQuarter, setSendingQuarter] = useState<number | null>(null);
  const [scheduleByQuarter, setScheduleByQuarter] = useState<Record<number, string>>({});

  async function saveClientEmail() {
    setSavingEmail(true);
    setEmailError(null);
    try {
      const response = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryEmail: email })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Unable to save email.");
      }
      router.refresh();
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Unable to save email.");
    } finally {
      setSavingEmail(false);
    }
  }

  async function createPayment() {
    setCreatingPayment(true);
    setPaymentError(null);
    try {
      const response = await fetch(`/api/clients/${client.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: newPayment.scope,
          stateCode: newPayment.scope === "state" ? newPayment.stateCode : null,
          paymentType: newPayment.paymentType,
          quarter: Number(newPayment.quarter),
          dueDate: newPayment.dueDate || null,
          amount: newPayment.amount || null,
          taxYear: Number(newPayment.taxYear),
          method: newPayment.method || null,
          notes: newPayment.notes || null
        })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Unable to add payment.");
      }
      setNewPayment((current) => ({ ...current, amount: "", notes: "" }));
      router.refresh();
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Unable to add payment.");
    } finally {
      setCreatingPayment(false);
    }
  }

  function startEdit(payment: PaymentRow) {
    setEditingId(payment.id);
    setEditDraft({
      scope: payment.scope,
      stateCode: payment.stateCode || "",
      paymentType: payment.paymentType,
      quarter: payment.quarter ? String(payment.quarter) : "",
      dueDate: normalizeDateInput(payment.dueDate),
      amount: payment.amount || "",
      taxYear: payment.taxYear ? String(payment.taxYear) : "",
      method: payment.method || "",
      notes: payment.notes || ""
    });
  }

  async function saveEdit(paymentId: string) {
    if (!editDraft) return;
    setSavingPayment(true);
    setPaymentError(null);
    try {
      const response = await fetch(`/api/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: editDraft.scope,
          stateCode: editDraft.scope === "state" ? editDraft.stateCode : null,
          paymentType: editDraft.paymentType,
          quarter: editDraft.quarter ? Number(editDraft.quarter) : null,
          dueDate: editDraft.dueDate || null,
          amount: editDraft.amount || null,
          taxYear: editDraft.taxYear ? Number(editDraft.taxYear) : null,
          method: editDraft.method || null,
          notes: editDraft.notes || null
        })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Unable to save payment.");
      }
      setEditingId(null);
      setEditDraft(null);
      router.refresh();
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Unable to save payment.");
    } finally {
      setSavingPayment(false);
    }
  }

  async function cancelPayment(paymentId: string) {
    setSavingPayment(true);
    setPaymentError(null);
    try {
      const response = await fetch(`/api/payments/${paymentId}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Unable to cancel payment.");
      }
      router.refresh();
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Unable to cancel payment.");
    } finally {
      setSavingPayment(false);
    }
  }

  async function loadPreview(quarter: number) {
    setPreviewLoading(true);
    setSendError(null);
    try {
      const response = await fetch(
        `/api/clients/${client.id}/quarter-email?taxYear=${encodeURIComponent(String(selectedTaxYear))}&quarter=${encodeURIComponent(String(quarter))}`
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Unable to load preview.");
      }
      const payload = await response.json();
      setPreview({ quarter, subject: payload.subject || "", html: payload.html || "" });
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Unable to load preview.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function sendQuarter(quarter: number) {
    setSendingQuarter(quarter);
    setSendError(null);
    try {
      const response = await fetch(`/api/clients/${client.id}/quarter-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxYear: selectedTaxYear, quarter, action: "send" })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Unable to send email.");
      }
      router.refresh();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Unable to send email.");
    } finally {
      setSendingQuarter(null);
    }
  }

  async function scheduleQuarter(quarter: number) {
    const dateValue = scheduleByQuarter[quarter] || "";
    if (!dateValue) return;
    setSendingQuarter(quarter);
    setSendError(null);
    try {
      const sendAt = new Date(dateValue).toISOString();
      const response = await fetch(`/api/clients/${client.id}/quarter-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxYear: selectedTaxYear, quarter, action: "schedule", sendAt })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Unable to schedule email.");
      }
      setScheduleByQuarter((current) => ({ ...current, [quarter]: "" }));
      router.refresh();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Unable to schedule email.");
    } finally {
      setSendingQuarter(null);
    }
  }

  return (
    <div className="space-y-8">
      <Card className="bg-card/70 backdrop-blur">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Client</p>
            <CardTitle className="text-2xl sm:text-3xl">{title}</CardTitle>
            <CardDescription>
              {client.entityType ? <span>{client.entityType}</span> : <span>Client workspace</span>}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">ID {client.id.slice(0, 8)}</Badge>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="grid gap-2">
              <Label htmlFor="client-email">Client email (for automated sends)</Label>
              <Input
                id="client-email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="client@example.com"
                autoComplete="email"
              />
              {emailError ? <p className="text-sm text-destructive">{emailError}</p> : null}
            </div>
            <Button type="button" onClick={saveClientEmail} disabled={savingEmail}>
              {savingEmail ? "Saving..." : "Save email"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Estimate schedule</CardTitle>
            <CardDescription>Edit the quarterly estimated payments you plan to send for this client.</CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="tax-year">Tax year</Label>
                <Select
                  id="tax-year"
                  value={String(selectedTaxYear)}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setSelectedTaxYear(Number.isFinite(next) ? next : selectedTaxYear);
                    setNewPayment((current) => ({ ...current, taxYear: event.target.value }));
                  }}
                >
                  {taxYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              <div className="grid gap-4 md:grid-cols-[0.8fr_1fr_0.6fr_0.8fr_1fr] md:items-end">
                <div className="grid gap-2">
                  <Label>Scope</Label>
                  <Select
                    value={newPayment.scope}
                    onChange={(event) =>
                      setNewPayment((current) => ({ ...current, scope: event.target.value }))
                    }
                  >
                    <option value="federal">Federal</option>
                    <option value="state">State</option>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>State (if applicable)</Label>
                  <Input
                    value={newPayment.stateCode}
                    onChange={(event) =>
                      setNewPayment((current) => ({ ...current, stateCode: event.target.value.toUpperCase() }))
                    }
                    placeholder="CA"
                    disabled={newPayment.scope !== "state"}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Quarter</Label>
                  <Select
                    value={newPayment.quarter}
                    onChange={(event) => setNewPayment((current) => ({ ...current, quarter: event.target.value }))}
                  >
                    <option value="1">Q1</option>
                    <option value="2">Q2</option>
                    <option value="3">Q3</option>
                    <option value="4">Q4</option>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Due date</Label>
                  <Input
                    type="date"
                    value={newPayment.dueDate}
                    onChange={(event) => setNewPayment((current) => ({ ...current, dueDate: event.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Amount</Label>
                  <Input
                    value={newPayment.amount}
                    onChange={(event) => setNewPayment((current) => ({ ...current, amount: event.target.value }))}
                    placeholder="5000"
                    inputMode="decimal"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr_1fr_auto] md:items-end">
                <div className="grid gap-2">
                  <Label>Payment type</Label>
                  <Input
                    value={newPayment.paymentType}
                    onChange={(event) =>
                      setNewPayment((current) => ({ ...current, paymentType: event.target.value }))
                    }
                    placeholder="Estimated Tax"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Method (optional)</Label>
                  <Input
                    value={newPayment.method}
                    onChange={(event) => setNewPayment((current) => ({ ...current, method: event.target.value }))}
                    placeholder="IRS Direct Pay"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Notes (optional)</Label>
                  <Input
                    value={newPayment.notes}
                    onChange={(event) => setNewPayment((current) => ({ ...current, notes: event.target.value }))}
                    placeholder="Use 2025 voucher"
                  />
                </div>
                <Button type="button" onClick={createPayment} disabled={creatingPayment}>
                  {creatingPayment ? "Adding..." : "Add"}
                </Button>
              </div>

              {paymentError ? <p className="text-sm text-destructive">{paymentError}</p> : null}
            </div>

            <div className="mt-6 overflow-hidden rounded-xl border">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Quarter</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[220px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentsForYear.length ? (
                    paymentsForYear.map((payment) => {
                      const isEditing = editingId === payment.id;
                      const draft = isEditing ? editDraft : null;
                      return (
                        <TableRow key={payment.id} className="odd:bg-muted/10">
                          <TableCell className="whitespace-nowrap">
                            {isEditing ? (
                              <Select
                                value={draft?.quarter || ""}
                                onChange={(event) =>
                                  setEditDraft((current) =>
                                    current ? { ...current, quarter: event.target.value } : current
                                  )
                                }
                              >
                                <option value="1">Q1</option>
                                <option value="2">Q2</option>
                                <option value="3">Q3</option>
                                <option value="4">Q4</option>
                              </Select>
                            ) : (
                              <span className="font-medium">{payment.quarter ? `Q${payment.quarter}` : "—"}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <div className="grid gap-2">
                                <Select
                                  value={draft?.scope || ""}
                                  onChange={(event) =>
                                    setEditDraft((current) =>
                                      current ? { ...current, scope: event.target.value } : current
                                    )
                                  }
                                >
                                  <option value="federal">Federal</option>
                                  <option value="state">State</option>
                                </Select>
                                <Input
                                  value={draft?.stateCode || ""}
                                  onChange={(event) =>
                                    setEditDraft((current) =>
                                      current
                                        ? { ...current, stateCode: event.target.value.toUpperCase() }
                                        : current
                                    )
                                  }
                                  placeholder="CA"
                                  disabled={draft?.scope !== "state"}
                                />
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <p className="font-medium">
                                  {payment.scope === "state"
                                    ? `State${payment.stateCode ? ` (${payment.stateCode})` : ""}`
                                    : "Federal"}
                                </p>
                                <p className="text-xs text-muted-foreground">{payment.paymentType}</p>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {isEditing ? (
                              <Input
                                type="date"
                                value={draft?.dueDate || ""}
                                onChange={(event) =>
                                  setEditDraft((current) =>
                                    current ? { ...current, dueDate: event.target.value } : current
                                  )
                                }
                              />
                            ) : (
                              <span>{payment.dueDate || "—"}</span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right tabular-nums">
                            {isEditing ? (
                              <Input
                                value={draft?.amount || ""}
                                onChange={(event) =>
                                  setEditDraft((current) =>
                                    current ? { ...current, amount: event.target.value } : current
                                  )
                                }
                                inputMode="decimal"
                                className="text-right"
                              />
                            ) : (
                              <span className="font-medium">{formatCurrency(payment.amount)}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={payment.status === "CONFIRMED" ? "success" : "secondary"}>
                              {payment.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {isEditing ? (
                              <div className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => saveEdit(payment.id)}
                                  disabled={savingPayment}
                                >
                                  {savingPayment ? "Saving..." : "Save"}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingId(null);
                                    setEditDraft(null);
                                  }}
                                  disabled={savingPayment}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => startEdit(payment)}>
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => cancelPayment(payment.id)}
                                  disabled={savingPayment}
                                >
                                  Remove
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                        No payments yet for {selectedTaxYear}. Add one above, or import via the wizard.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="bg-card/70 backdrop-blur">
            <CardHeader>
              <CardTitle>Quarterly instructions</CardTitle>
              <CardDescription>Generate and schedule one email per quarter (includes Fed + any states).</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6">
              {!email ? (
                <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                  Add a client email above to enable send + scheduling.
                </div>
              ) : null}

              <div className="grid gap-4">
                {[1, 2, 3, 4].map((quarter) => {
                  const quarterPayments = paymentsForYear.filter(
                    (payment) => payment.quarter === quarter && payment.status !== "CANCELLED"
                  );
                  const quarterTotal = quarterPayments.reduce(
                    (sum, payment) => sum + (payment.amount ? Number(payment.amount) : 0),
                    0
                  );
                  return (
                    <div key={quarter} className="rounded-2xl border bg-background/60 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold">Q{quarter}</p>
                          <p className="text-sm text-muted-foreground">
                            {quarterPayments.length} payment{quarterPayments.length === 1 ? "" : "s"} •{" "}
                            {formatCurrency(String(quarterTotal))}
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => loadPreview(quarter)}
                            disabled={previewLoading}
                          >
                            {previewLoading ? "Loading..." : "Preview"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => sendQuarter(quarter)}
                            disabled={!email || sendingQuarter === quarter || quarterPayments.length === 0}
                          >
                            {sendingQuarter === quarter ? "Sending..." : "Send now"}
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                        <div className="grid gap-2">
                          <Label htmlFor={`schedule-${quarter}`}>Schedule send</Label>
                          <Input
                            id={`schedule-${quarter}`}
                            type="datetime-local"
                            value={scheduleByQuarter[quarter] || ""}
                            onChange={(event) =>
                              setScheduleByQuarter((current) => ({ ...current, [quarter]: event.target.value }))
                            }
                            disabled={!email}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => scheduleQuarter(quarter)}
                          disabled={!email || sendingQuarter === quarter || !(scheduleByQuarter[quarter] || "")}
                        >
                          {sendingQuarter === quarter ? "Scheduling..." : "Schedule"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {sendError ? <p className="mt-4 text-sm text-destructive">{sendError}</p> : null}
            </CardContent>
          </Card>

          {preview ? (
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Email preview • Q{preview.quarter}</CardTitle>
                <CardDescription className="break-words">Subject: {preview.subject}</CardDescription>
              </CardHeader>
              <Separator />
              <CardContent className="pt-6">
                <div
                  className="max-w-none rounded-xl border bg-background p-4 text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: preview.html }}
                />
                <p className="mt-3 text-xs text-muted-foreground">
                  The checklist link is inserted when the email is sent.
                </p>
              </CardContent>
            </Card>
          ) : null}

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Automation log</CardTitle>
              <CardDescription>Queued and sent quarterly instruction emails.</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="p-0">
              {notifications.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quarter</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Send at</TableHead>
                      <TableHead>Sent at</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notifications.map((log) => {
                      const quarter = getMetaQuarter(log.metadata);
                      const taxYear = getMetaTaxYear(log.metadata);
                      return (
                        <TableRow key={log.id} className="odd:bg-muted/10">
                          <TableCell className="font-medium">
                            {quarter ? `Q${quarter}` : "—"} {taxYear ? `(${taxYear})` : ""}
                          </TableCell>
                          <TableCell>
                            <Badge variant={log.status === "SENT" ? "success" : log.status === "FAILED" ? "destructive" : "secondary"}>
                              {log.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatTimestamp(log.sendAt)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatTimestamp(log.sentAt)}
                            {log.errorMessage ? (
                              <p className="mt-1 text-xs text-destructive">{log.errorMessage}</p>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No quarterly emails scheduled or sent yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
