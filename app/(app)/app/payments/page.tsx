import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PortalLinkActions } from "./PortalLinkActions";
import { BulkChecklistActions } from "./BulkChecklistActions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaymentTaskStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS: PaymentTaskStatus[] = [
  PaymentTaskStatus.DRAFT,
  PaymentTaskStatus.SENT,
  PaymentTaskStatus.VIEWED,
  PaymentTaskStatus.CONFIRMED,
  PaymentTaskStatus.VERIFIED,
  PaymentTaskStatus.OVERDUE,
  PaymentTaskStatus.CANCELLED
];

function isPaymentStatus(value: string): value is PaymentTaskStatus {
  return STATUS_OPTIONS.includes(value as PaymentTaskStatus);
}

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function statusBadge(status: string) {
  switch (status) {
    case "CONFIRMED":
    case "VERIFIED":
      return <Badge variant="success">{status}</Badge>;
    case "VIEWED":
      return <Badge variant="info">{status}</Badge>;
    case "OVERDUE":
      return <Badge variant="destructive">{status}</Badge>;
    case "CANCELLED":
      return (
        <Badge variant="outline" className="text-muted-foreground">
          {status}
        </Badge>
      );
    case "DRAFT":
    case "SENT":
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default async function PaymentsPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const session = await getServerAuthSession();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login?next=/app/payments");
  }

  const rangeParam = Array.isArray(searchParams?.range) ? searchParams?.range[0] : searchParams?.range;
  const statusParam = Array.isArray(searchParams?.status) ? searchParams?.status[0] : searchParams?.status;
  const parsedRange = Number(rangeParam ?? 30);
  const rangeDays = Number.isFinite(parsedRange) ? Math.min(Math.max(parsedRange, 1), 365) : 30;
  const statusFilter = statusParam && isPaymentStatus(statusParam) ? statusParam : undefined;

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + rangeDays);

  const payments = await prisma.payment.findMany({
    where: {
      userId,
      dueDate: { lte: endDate },
      run: {
        batch: {
          kind: "PLAN"
        }
      },
      ...(statusFilter ? { status: statusFilter } : {})
    },
    include: {
      run: {
        include: {
          client: true
        }
      }
    },
    orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }]
  });

  const runSummaries = Array.from(
    payments.reduce((map, payment) => {
      if (!map.has(payment.runId)) {
        map.set(payment.runId, {
          runId: payment.runId,
          clientLabel: payment.run.client?.name || payment.run.client?.addresseeName || "Client"
        });
      }
      return map;
    }, new Map<string, { runId: string; clientLabel: string }>())
  ).map(([, value]) => value);

  const totalPayments = payments.length;
  const confirmedPayments = payments.filter((payment) =>
    ["CONFIRMED", "VERIFIED"].includes(payment.status)
  ).length;
  const overduePayments = payments.filter((payment) => payment.status === "OVERDUE").length;
  const dueSoonPayments = payments.filter((payment) => {
    if (!payment.dueDate) return false;
    if (["CONFIRMED", "VERIFIED", "CANCELLED"].includes(payment.status)) return false;
    const daysUntil = (payment.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysUntil >= 0 && daysUntil <= 7;
  }).length;
  const totalAmount = payments.reduce(
    (sum, payment) => sum + (payment.amount ? Number(payment.amount) : 0),
    0
  );

  return (
    <div className="grid gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Payments board
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Payments</h1>
          <p className="text-sm text-muted-foreground">
            Filter upcoming estimated payments and publish client checklist links in bulk.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="bg-secondary/70">
            Due ≤ {rangeDays} days
          </Badge>
          <Badge variant="secondary" className="bg-secondary/70">
            {statusFilter ? `Status: ${statusFilter}` : "All statuses"}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card/70 backdrop-blur">
          <CardHeader className="pb-3">
            <CardDescription>Payments in view</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{totalPayments}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-card/70 backdrop-blur">
          <CardHeader className="pb-3">
            <CardDescription>Due soon (7 days)</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{dueSoonPayments}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-card/70 backdrop-blur">
          <CardHeader className="pb-3">
            <CardDescription>Overdue</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{overduePayments}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-card/70 backdrop-blur">
          <CardHeader className="pb-3">
            <CardDescription>Total amount</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatCurrency(totalAmount)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <Card className="bg-card/70 backdrop-blur">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Control the rows shown in the board.</CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            <form method="get" className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="grid gap-2">
                <Label htmlFor="range">Due in (days)</Label>
                <Select id="range" name="range" defaultValue={String(rangeDays)}>
                  <option value="7">7</option>
                  <option value="14">14</option>
                  <option value="30">30</option>
                  <option value="90">90</option>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select id="status" name="status" defaultValue={statusFilter}>
                  <option value="">All</option>
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit">Apply filters</Button>
            </form>
          </CardContent>
        </Card>

        <BulkChecklistActions runs={runSummaries} />
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Payments</CardTitle>
            <CardDescription>
              {confirmedPayments} confirmed • {Math.max(totalPayments - confirmedPayments, 0)} remaining
            </CardDescription>
          </div>
          <Badge variant="secondary" className="bg-secondary/70">
            {totalPayments} rows
          </Badge>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          {payments.length ? (
            <Table>
              <TableHeader className="bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/40">
                <TableRow>
                  <TableHead className="sticky top-0 bg-background/90 backdrop-blur">Due date</TableHead>
                  <TableHead className="sticky top-0 bg-background/90 backdrop-blur">Client</TableHead>
                  <TableHead className="sticky top-0 bg-background/90 backdrop-blur">Scope</TableHead>
                  <TableHead className="sticky top-0 bg-background/90 backdrop-blur text-right">Amount</TableHead>
                  <TableHead className="sticky top-0 bg-background/90 backdrop-blur">Status</TableHead>
                  <TableHead className="sticky top-0 bg-background/90 backdrop-blur">Confirmed</TableHead>
                  <TableHead className="sticky top-0 bg-background/90 backdrop-blur">Checklist</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id} className="odd:bg-muted/20">
                    <TableCell className="whitespace-nowrap font-medium">
                      {payment.dueDate ? payment.dueDate.toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      {payment.run.client?.name || payment.run.client?.addresseeName || "Client"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {payment.scope}
                      {payment.stateCode ? ` (${payment.stateCode})` : ""}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                      {formatCurrency(payment.amount ? Number(payment.amount) : null)}
                    </TableCell>
                    <TableCell>{statusBadge(payment.status)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {payment.confirmedAt ? payment.confirmedAt.toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="min-w-[280px]">
                      <PortalLinkActions
                        runId={payment.runId}
                        clientLabel={
                          payment.run.client?.name || payment.run.client?.addresseeName || "Client"
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-10">
              <div className="rounded-2xl border border-dashed bg-muted/20 p-10 text-center">
                <p className="text-sm font-medium">No payments found</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  No payments match the selected filters yet.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
