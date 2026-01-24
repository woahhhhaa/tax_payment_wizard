import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function normalizeEmail(value: unknown): string | null {
  const trimmed = String(value || "").trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed.length > 320) return null;
  if (!trimmed.includes("@")) return null;
  return trimmed;
}

export async function PATCH(request: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerAuthSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = String(params.clientId || "").trim();
  if (!clientId) {
    return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const primaryEmail = normalizeEmail(body?.primaryEmail);

  if (body?.primaryEmail && !primaryEmail) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, userId }
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  await prisma.client.update({
    where: { id: client.id },
    data: { primaryEmail }
  });

  return NextResponse.json({ ok: true });
}

