import { notFound, redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClientDetail } from "./ClientDetail";

export const dynamic = "force-dynamic";

async function getOrCreatePlanBatch(userId: string) {
  const existing = await prisma.batch.findFirst({
    where: { userId, kind: "PLAN" },
    orderBy: { createdAt: "asc" }
  });

  if (existing) return existing;

  return prisma.batch.create({
    data: {
      userId,
      name: "Client Plans",
      kind: "PLAN",
      snapshotJson: {}
    }
  });
}

export default async function ClientPage({ params }: { params: { clientId: string } }) {
  const session = await getServerAuthSession();
  const userId = session?.user?.id;

  if (!userId) {
    redirect(`/login?next=/app/clients/${params.clientId}`);
  }

  const client = await prisma.client.findFirst({
    where: { id: params.clientId, userId }
  });

  if (!client) {
    notFound();
  }

  const planBatch = await getOrCreatePlanBatch(userId);
  const planRun = await prisma.run.upsert({
    where: {
      batchId_clientId: {
        batchId: planBatch.id,
        clientId: client.id
      }
    },
    create: {
      userId,
      batchId: planBatch.id,
      clientId: client.id,
      snapshotJson: {}
    },
    update: {}
  });

  const [payments, notifications] = await Promise.all([
    prisma.payment.findMany({
      where: { userId, runId: planRun.id, status: { not: "CANCELLED" } },
      orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }]
    }),
    prisma.notificationLog.findMany({
      where: {
        userId,
        clientId: client.id,
        channel: "EMAIL",
        messageType: "QUARTERLY_PAYMENT_INSTRUCTIONS"
      },
      orderBy: { createdAt: "desc" },
      take: 25
    })
  ]);

  const serializablePayments = payments.map((payment) => ({
    id: payment.id,
    scope: payment.scope,
    stateCode: payment.stateCode,
    paymentType: payment.paymentType,
    quarter: payment.quarter,
    dueDate: payment.dueDate ? payment.dueDate.toISOString().slice(0, 10) : null,
    amount: payment.amount ? payment.amount.toString() : null,
    taxYear: payment.taxYear,
    notes: payment.notes,
    method: payment.method,
    status: payment.status
  }));

  const serializableNotifications = notifications.map((log) => ({
    id: log.id,
    status: log.status,
    recipient: log.recipient,
    sendAt: log.sendAt ? log.sendAt.toISOString() : null,
    sentAt: log.sentAt ? log.sentAt.toISOString() : null,
    errorMessage: log.errorMessage,
    metadata: log.metadata ?? null,
    createdAt: log.createdAt.toISOString()
  }));

  return (
    <ClientDetail
      client={{
        id: client.id,
        name: client.name,
        addresseeName: client.addresseeName,
        entityType: client.entityType,
        primaryEmail: client.primaryEmail
      }}
      payments={serializablePayments}
      notifications={serializableNotifications}
    />
  );
}

