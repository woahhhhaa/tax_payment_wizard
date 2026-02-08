import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  checkAuthEnv,
  checkDatabaseEnv,
  checkEmailEnv,
  summarizeStatus,
  type ReadinessCheck
} from "@/lib/runtime-readiness";

export const dynamic = "force-dynamic";

async function checkDatabaseConnection(): Promise<ReadinessCheck> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: "ok",
      message: "Database connection check passed."
    };
  } catch (error) {
    return {
      status: "fail",
      message: error instanceof Error ? error.message : "Database connection check failed."
    };
  }
}

export async function GET() {
  const checks = {
    database_env: checkDatabaseEnv(),
    database_connection: await checkDatabaseConnection(),
    auth_env: checkAuthEnv(),
    email_env: checkEmailEnv()
  };

  const overall = summarizeStatus(Object.values(checks));

  const payload = {
    status: overall,
    timestamp: new Date().toISOString(),
    checks,
    deployment: {
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
      region: process.env.VERCEL_REGION || null,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || null
    }
  };

  return NextResponse.json(payload, {
    status: overall === "fail" ? 503 : 200,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
