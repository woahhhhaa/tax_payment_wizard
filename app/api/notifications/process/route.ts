import { NextResponse } from "next/server";
import { PaymentTaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildQuarterlyInstructionsEmail } from "@/lib/quarterly-email";
import { sendEmail } from "@/lib/email";
import {
  generatePortalToken,
  getPortalBaseUrl,
  getPortalLinkExpiresAt,
  hashPortalToken
} from "@/lib/portal-token";
const MAX_PER_RUN = 25;

function getMetaNumber(meta: unknown, key: string): number | null {
  if (!meta || typeof meta !== "object") return null;
  const value = (meta as any)[key];
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "CRON_SECRET must be configured in production." },
      { status: 503 }
    );
  }

  if (expectedSecret) {
    const actual = request.headers.get("x-cron-secret");
    if (actual !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const portalBaseUrl = getPortalBaseUrl(request);

  const due = await prisma.notificationLog.findMany({
    where: {
      status: "QUEUED",
      channel: "EMAIL",
      messageType: "QUARTERLY_PAYMENT_INSTRUCTIONS",
      sendAt: { lte: now },
      clientId: { not: null }
    },
    orderBy: { sendAt: "asc" },
    take: MAX_PER_RUN
  });

  let sent = 0;
  let failed = 0;

  for (const log of due) {
    const quarter = getMetaNumber(log.metadata, "quarter");
    const taxYear = getMetaNumber(log.metadata, "taxYear");

    if (!log.clientId || !quarter || !taxYear) {
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: "FAILED",
          errorMessage: "Missing clientId/taxYear/quarter metadata"
        }
      });
      failed += 1;
      continue;
    }

    const client = await prisma.client.findFirst({
      where: { id: log.clientId, userId: log.userId }
    });

    if (!client) {
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: "FAILED",
          errorMessage: "Client not found"
        }
      });
      failed += 1;
      continue;
    }

    const planBatch = await prisma.batch.findFirst({
      where: { userId: log.userId, kind: "PLAN" }
    });

    if (!planBatch) {
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: "FAILED",
          errorMessage: "Plan batch not found"
        }
      });
      failed += 1;
      continue;
    }

    const run = await prisma.run.findFirst({
      where: { userId: log.userId, batchId: planBatch.id, clientId: client.id }
    });

    if (!run) {
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: "FAILED",
          errorMessage: "Plan run not found"
        }
      });
      failed += 1;
      continue;
    }

    const payments = await prisma.payment.findMany({
      where: {
        userId: log.userId,
        runId: run.id,
        taxYear,
        quarter,
        status: { not: PaymentTaskStatus.CANCELLED }
      },
      orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }]
    });

    if (!payments.length) {
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: "FAILED",
          errorMessage: `No payments found for Q${quarter} ${taxYear}`
        }
      });
      failed += 1;
      continue;
    }

    const recipient = client.primaryEmail || log.recipient;
    if (!recipient) {
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: "FAILED",
          errorMessage: "Missing recipient email"
        }
      });
      failed += 1;
      continue;
    }

    try {
      const token = generatePortalToken();
      const tokenHash = hashPortalToken(token);
      const now = new Date();
      const expiresAt = getPortalLinkExpiresAt(now);

      await prisma.portalLink.updateMany({
        where: {
          userId: log.userId,
          runId: run.id,
          scope: "PLAN",
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
        },
        data: { expiresAt: now }
      });

      const portalLink = await prisma.portalLink.create({
        data: {
          userId: log.userId,
          clientId: client.id,
          runId: run.id,
          scope: "PLAN",
          tokenHash,
          expiresAt
        }
      });

      const portalUrl = `${portalBaseUrl}/p/${token}`;

      const { subject, html, text } = buildQuarterlyInstructionsEmail({
        client,
        quarter,
        taxYear,
        payments,
        checklistUrl: portalUrl
      });

      const result = await sendEmail({
        to: recipient,
        subject,
        html,
        text
      });

      await prisma.$transaction([
        prisma.notificationLog.update({
          where: { id: log.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
            providerMessageId: result.messageId,
            portalLinkId: portalLink.id,
            recipient,
            errorMessage: null,
            metadata: {
              ...(typeof log.metadata === "object" && log.metadata ? (log.metadata as object) : {}),
              portalUrl,
              paymentIds: payments.map((payment) => payment.id)
            }
          }
        }),
        prisma.payment.updateMany({
          where: {
            userId: log.userId,
            id: { in: payments.map((payment) => payment.id) },
            status: PaymentTaskStatus.DRAFT
          },
          data: { status: PaymentTaskStatus.SENT }
        })
      ]);

      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown send error";
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: "FAILED",
          errorMessage: message
        }
      });
      failed += 1;
    }
  }

  return NextResponse.json({ ok: true, processed: due.length, sent, failed });
}
