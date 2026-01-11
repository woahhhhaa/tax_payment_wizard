import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPortalToken } from "@/lib/portal-token";
import { ClientChecklist } from "./ClientChecklist";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type PortalPageProps = {
  params: { token: string };
};

export default async function PortalPage({ params }: PortalPageProps) {
  const token = params.token;
  if (!token) {
    notFound();
  }

  const tokenHash = hashPortalToken(token);
  const now = new Date();

  const portalLink = await prisma.portalLink.findFirst({
    where: {
      tokenHash,
      scope: "PLAN",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
    },
    include: {
      client: true,
      run: {
        include: {
          client: true,
          payments: {
            orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }]
          }
        }
      }
    }
  });

  if (!portalLink?.run) {
    notFound();
  }

  await prisma.$transaction([
    prisma.portalLink.update({
      where: { id: portalLink.id },
      data: { lastUsedAt: now }
    }),
    prisma.payment.updateMany({
      where: {
        runId: portalLink.run.id,
        status: "SENT"
      },
      data: { status: "VIEWED" }
    })
  ]);

  const clientName =
    portalLink.client?.name || portalLink.run.client?.name || portalLink.run.client?.addresseeName || "Client";

  const payments = portalLink.run.payments.map((payment) => ({
    id: payment.id,
    scope: payment.scope,
    stateCode: payment.stateCode,
    paymentType: payment.paymentType,
    dueDate: payment.dueDate ? payment.dueDate.toISOString().slice(0, 10) : null,
    amount: payment.amount ? payment.amount.toString() : null,
    status: payment.status
  }));

  const totalPayments = payments.length;
  const confirmedPayments = payments.filter((payment) => ["CONFIRMED", "VERIFIED"].includes(payment.status)).length;
  const remainingPayments = totalPayments - confirmedPayments;
  const nextDue = payments.find((payment) => !["CONFIRMED", "VERIFIED", "CANCELLED"].includes(payment.status));

  return (
    <div className="grid gap-8">
      <Card className="relative overflow-hidden bg-card/70 backdrop-blur">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(70%_60%_at_10%_0%,hsl(var(--primary)_/_0.16),transparent_70%)]"
        />
        <CardHeader className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Tax Payment Checklist
          </p>
          <CardTitle className="relative text-2xl">{clientName}</CardTitle>
          <CardDescription>
            Confirm each payment after you submit it to the IRS or state portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border bg-background/60 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Remaining</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{remainingPayments}</p>
            </div>
            <div className="rounded-2xl border bg-background/60 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Confirmed</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{confirmedPayments}</p>
            </div>
            <div className="rounded-2xl border bg-background/60 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Next due</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{nextDue?.dueDate || "All set"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <ClientChecklist token={token} payments={payments} clientName={clientName} />
    </div>
  );
}
