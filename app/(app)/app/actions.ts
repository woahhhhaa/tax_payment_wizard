"use server";

import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createEmptySession } from "@/lib/wizard-session";

export async function createNewBatch() {
  const session = await getServerAuthSession();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/login");
  }

  const snapshot = createEmptySession();
  await prisma.batch.create({
    data: {
      userId,
      name: `Workflow ${new Date().toLocaleDateString()}`,
      snapshotJson: snapshot
    }
  });

  redirect("/wizard");
}
