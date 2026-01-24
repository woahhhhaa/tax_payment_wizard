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
  const runId = String(body?.runId || "").trim();

  if (!runId) {
    return NextResponse.json({ error: "Missing runId" }, { status: 400 });
  }

  const run = await prisma.run.findFirst({
    where: { id: runId, userId },
    include: { client: true }
  });

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const token = generatePortalToken();
  const tokenHash = hashPortalToken(token);
  const expiresAt = new Date(Date.now() + LINK_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.portalLink.create({
    data: {
      userId,
      clientId: run.clientId,
      runId: run.id,
      scope: "PLAN",
      tokenHash,
      expiresAt
    }
  });

  const origin = getRequestOrigin(request);
  const portalUrl = `${origin}/p/${token}`;

  return NextResponse.json({ portalUrl });
}
