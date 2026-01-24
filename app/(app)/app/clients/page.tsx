import type { SVGProps } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PaymentTaskStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type PlanStatusFilter = "all" | "not_started" | "in_progress" | "complete";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isPlanStatusFilter(value: string | undefined): value is PlanStatusFilter {
  return value === "all" || value === "not_started" || value === "in_progress" || value === "complete";
}

function activeSinceDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function formatActivity(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function ClientsPage({ searchParams }: { searchParams?: SearchParams }) {
  const session = await getServerAuthSession();
  const userId = session?.user?.id;
  const params = searchParams ?? {};

  if (!userId) {
    redirect("/login?next=/app/clients");
  }

  const q = firstParam(params.q)?.trim() || "";
  const includeArchived = firstParam(params.archived) === "1";
  const planStatusParam = firstParam(params.status);
  const planStatus = isPlanStatusFilter(planStatusParam) ? planStatusParam : "all";
  const activeSince = activeSinceDate(90);

  const where = {
    userId,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { addresseeName: { contains: q, mode: "insensitive" as const } },
            { primaryEmail: { contains: q, mode: "insensitive" as const } }
          ]
        }
      : {}),
    ...(!includeArchived ? { updatedAt: { gte: activeSince } } : {})
  };

  const planBatch = await prisma.batch.findFirst({
    where: { userId, kind: "PLAN" },
    orderBy: { createdAt: "asc" }
  });

  const yearParam = parseNumber(firstParam(params.taxYear));
  const yearsFromPayments = await prisma.payment.findMany({
    where: {
      userId,
      taxYear: { not: null },
      run: {
        batch: {
          kind: "PLAN"
        }
      }
    },
    distinct: ["taxYear"],
    select: { taxYear: true }
  });

  const taxYears = yearsFromPayments
    .map((row) => row.taxYear)
    .filter((year): year is number => typeof year === "number")
    .sort((a, b) => b - a);

  const selectedTaxYear = yearParam && taxYears.includes(yearParam) ? yearParam : taxYears[0] ?? new Date().getFullYear();

  const [total, clients] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 50
    })
  ]);

  const clientIds = clients.map((client) => client.id);
  const planRuns = planBatch
    ? await prisma.run.findMany({
        where: {
          userId,
          batchId: planBatch.id,
          clientId: { in: clientIds }
        },
        select: { id: true, clientId: true }
      })
    : [];

  const runIdByClientId = new Map(planRuns.map((run) => [run.clientId, run.id]));
  const runIds = planRuns.map((run) => run.id);

  const payments = runIds.length
    ? await prisma.payment.findMany({
        where: {
          userId,
          runId: { in: runIds },
          taxYear: selectedTaxYear,
          status: { not: PaymentTaskStatus.CANCELLED }
        },
        select: {
          runId: true,
          status: true,
          dueDate: true,
          amount: true,
          updatedAt: true
        },
        orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }]
      })
    : [];

  const paymentsByRunId = payments.reduce((map, payment) => {
    const existing = map.get(payment.runId);
    if (existing) {
      existing.push(payment);
    } else {
      map.set(payment.runId, [payment]);
    }
    return map;
  }, new Map<string, typeof payments>());

  const rows = clients.map((client) => {
    const runId = runIdByClientId.get(client.id);
    const clientPayments = runId ? paymentsByRunId.get(runId) ?? [] : [];
    const totalPayments = clientPayments.length;
    const confirmedPayments = clientPayments.filter(
      (payment) => payment.status === PaymentTaskStatus.CONFIRMED || payment.status === PaymentTaskStatus.VERIFIED
    ).length;
    const hasSent = clientPayments.some(
      (payment) =>
        payment.status === PaymentTaskStatus.SENT ||
        payment.status === PaymentTaskStatus.VIEWED ||
        payment.status === PaymentTaskStatus.CONFIRMED ||
        payment.status === PaymentTaskStatus.VERIFIED
    );

    const incomplete = clientPayments.filter(
      (payment) => payment.status !== PaymentTaskStatus.CONFIRMED && payment.status !== PaymentTaskStatus.VERIFIED
    );
    const nextDue = incomplete
      .filter((payment) => payment.dueDate)
      .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0))[0]?.dueDate;

    const lastPaymentActivity = clientPayments.reduce<Date | null>((latest, payment) => {
      if (!latest) return payment.updatedAt;
      return payment.updatedAt > latest ? payment.updatedAt : latest;
    }, null);

    const lastActivity =
      lastPaymentActivity && lastPaymentActivity > client.updatedAt ? lastPaymentActivity : client.updatedAt;

    const progress =
      totalPayments === 0 ? 0 : Math.min(Math.round((confirmedPayments / totalPayments) * 100), 100);

    const planState =
      totalPayments === 0
        ? "not_started"
        : confirmedPayments === totalPayments
          ? "complete"
          : "in_progress";

    return {
      client,
      runId,
      totalPayments,
      confirmedPayments,
      hasSent,
      progress,
      nextDue,
      lastActivity,
      planState
    };
  });

  const filteredRows =
    planStatus === "all"
      ? rows
      : rows.filter((row) => {
          if (planStatus === "not_started") return row.planState === "not_started";
          if (planStatus === "complete") return row.planState === "complete";
          if (planStatus === "in_progress") return row.planState === "in_progress";
          return true;
        });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Clients</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Clients</h1>
          <p className="text-sm text-muted-foreground">
            Click into a client to review quarterly estimates and send instructions.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="bg-secondary/70">
            {filteredRows.length} shown
          </Badge>
          <Badge variant="secondary" className="bg-secondary/70">
            {total} total
          </Badge>
          <Button asChild className="gap-2">
            <Link href="/wizard">
              <PlusIcon className="h-4 w-4" aria-hidden />
              New client
            </Link>
          </Button>
        </div>
      </div>

      <Card className="bg-card/70 backdrop-blur">
        <CardHeader className="space-y-2">
          <CardTitle className="text-base">Filters</CardTitle>
          <form method="get" className="grid gap-3 lg:grid-cols-[1.4fr_0.55fr_0.7fr_0.9fr_auto] lg:items-end">
            <div className="grid gap-2">
              <Label htmlFor="q">Search</Label>
              <div className="relative">
                <SearchIcon
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="q"
                  name="q"
                  defaultValue={q}
                  placeholder="Client, email, or tags"
                  className="pl-9"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="taxYear">Tax year</Label>
              <Select id="taxYear" name="taxYear" defaultValue={String(selectedTaxYear)}>
                {taxYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
                {!taxYears.length ? <option value={selectedTaxYear}>{selectedTaxYear}</option> : null}
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">Plan status</Label>
              <Select id="status" name="status" defaultValue={planStatus}>
                <option value="all">All</option>
                <option value="not_started">Not started</option>
                <option value="in_progress">In progress</option>
                <option value="complete">Complete</option>
              </Select>
            </div>

            <div className="flex items-center gap-3 rounded-xl border bg-background px-3 py-2">
              <input
                id="archived"
                name="archived"
                value="1"
                type="checkbox"
                defaultChecked={includeArchived}
                className="h-4 w-4 rounded border-input text-primary accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
              />
              <Label htmlFor="archived" className="text-sm font-normal text-muted-foreground">
                Include archived
              </Label>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="secondary" className="gap-2">
                <FilterIcon className="h-4 w-4" aria-hidden />
                Apply
              </Button>
              <Button asChild type="button" variant="outline">
                <Link href="/app/clients">Reset</Link>
              </Button>
            </div>
          </form>
        </CardHeader>
      </Card>

      <Card className="overflow-hidden bg-card/70 backdrop-blur">
        <CardHeader className="py-4">
          <CardTitle className="text-base font-semibold">Client list</CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          {filteredRows.length ? (
            <Table>
              <TableHeader className="bg-background/80 backdrop-blur">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[110px]">Tax year</TableHead>
                  <TableHead className="w-[220px]">Status</TableHead>
                  <TableHead className="w-[120px] text-center">Checklist</TableHead>
                  <TableHead className="hidden md:table-cell">Next due</TableHead>
                  <TableHead className="hidden md:table-cell">Last activity</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => {
                  const label = row.client.name || row.client.addresseeName || "Unnamed";
                  const progressLabel =
                    row.totalPayments === 0
                      ? "Not started"
                      : row.confirmedPayments === row.totalPayments
                        ? "Complete"
                        : row.progress > 0
                          ? `In progress ${row.progress}%`
                          : "In progress";

                  const mainBadgeVariant =
                    row.totalPayments === 0
                      ? ("outline" as const)
                      : row.confirmedPayments === row.totalPayments
                        ? ("success" as const)
                        : ("warning" as const);

                  const nextDueLabel = row.nextDue ? formatActivity(row.nextDue) : "—";

                  return (
                    <TableRow key={row.client.id} className="odd:bg-muted/10">
                      <TableCell className="min-w-[280px]">
                        <div className="space-y-0.5">
                          <Link
                            href={`/app/clients/${row.client.id}`}
                            className="font-medium leading-tight text-foreground hover:underline"
                          >
                            {label}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {row.client.primaryEmail ? row.client.primaryEmail : `ID ${row.client.id.slice(0, 8)}`}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium tabular-nums">{selectedTaxYear}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={mainBadgeVariant}>{progressLabel}</Badge>
                          {row.hasSent && row.totalPayments > 0 && row.confirmedPayments < row.totalPayments ? (
                            <Badge variant="secondary">Sent</Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {row.totalPayments ? (
                          <span className="font-medium">
                            {row.confirmedPayments}/{row.totalPayments}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell whitespace-nowrap text-sm text-muted-foreground">
                        {nextDueLabel}
                      </TableCell>
                      <TableCell className="hidden md:table-cell whitespace-nowrap text-sm text-muted-foreground">
                        {formatActivity(row.lastActivity)}
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          aria-label={`Actions for ${label}`}
                        >
                          <MoreIcon className="h-4 w-4" aria-hidden />
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-10 text-center">
              <p className="text-sm font-medium">No clients found</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Try adjusting your filters or run the wizard to add clients.
              </p>
              <div className="mt-6 flex justify-center">
                <Button asChild className="gap-2">
                  <Link href="/wizard">
                    <PlusIcon className="h-4 w-4" aria-hidden />
                    Open wizard
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M21 21l-4.3-4.3" />
      <circle cx="11" cy="11" r="7" />
    </svg>
  );
}

function FilterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M4 6h16" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </svg>
  );
}

function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function MoreIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 12h.01" />
      <path d="M12 5h.01" />
      <path d="M12 19h.01" />
    </svg>
  );
}
