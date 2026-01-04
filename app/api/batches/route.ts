import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createEmptySession } from "@/lib/wizard-session";

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const snapshot = createEmptySession();
  const name = String(body?.name || snapshot.name).trim() || snapshot.name;

  const batch = await prisma.batch.create({
    data: {
      userId,
      name,
      snapshotJson: snapshot
    }
  });

  return NextResponse.json({ batchId: batch.id, snapshot });
}
