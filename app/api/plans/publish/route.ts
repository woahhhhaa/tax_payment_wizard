import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePortalToken, getRequestOrigin, hashPortalToken } from "@/lib/portal-token";

const LINK_TTL_DAYS = 365;

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const batchId = String(body?.batchId || "").trim();
  const wizardClientId = String(body?.wizardClientId || "").trim();

  if (!batchId || !wizardClientId) {
    return NextResponse.json({ error: "Missing batchId or wizardClientId" }, { status: 400 });
  }

  const batch = await prisma.batch.findFirst({
    where: { id: batchId, userId }
  });

  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  const client = await prisma.client.findFirst({
    where: { userId, wizardClientId }
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const run = await prisma.run.findFirst({
    where: {
      batchId,
      clientId: client.id,
      userId
    }
  });

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  await prisma.portalLink.deleteMany({
    where: {
      userId,
      runId: run.id,
      scope: "PLAN"
    }
  });

  const token = generatePortalToken();
  const tokenHash = hashPortalToken(token);
  const expiresAt = new Date(Date.now() + LINK_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.portalLink.create({
    data: {
      userId,
      clientId: client.id,
      runId: run.id,
      scope: "PLAN",
      tokenHash,
      expiresAt
    }
  });

  await prisma.payment.updateMany({
    where: {
      userId,
      runId: run.id,
      status: "DRAFT"
    },
    data: { status: "SENT" }
  });

  const origin = getRequestOrigin(request);
  const portalUrl = `${origin}/p/${token}`;

  return NextResponse.json({ portalUrl });
}
