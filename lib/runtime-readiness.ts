export type ReadinessStatus = "ok" | "warn" | "fail";

export type ReadinessCheck = {
  status: ReadinessStatus;
  message: string;
};

function normalizeTransport(value: string | undefined) {
  const transport = String(value || "").trim().toLowerCase();
  if (transport === "console") return "console";
  if (!transport || transport === "smtp") return "smtp";
  return "unknown";
}

function hasPlaceholderSecret(secret: string) {
  const lowered = secret.toLowerCase();
  return (
    lowered.includes("replace-with-a-strong-secret") ||
    lowered.includes("change-in-production") ||
    lowered.includes("example")
  );
}

export function checkDatabaseEnv(env = process.env): ReadinessCheck {
  const url = String(env.DATABASE_URL || "").trim();
  if (!url) {
    return {
      status: "fail",
      message: "DATABASE_URL is missing."
    };
  }

  return {
    status: "ok",
    message: "Database connection string configured."
  };
}

export function checkAuthEnv(env = process.env): ReadinessCheck {
  const secret = String(env.NEXTAUTH_SECRET || "").trim();
  if (!secret) {
    return {
      status: "fail",
      message: "NEXTAUTH_SECRET is missing."
    };
  }

  if (secret.length < 16 || hasPlaceholderSecret(secret)) {
    return {
      status: "warn",
      message: "NEXTAUTH_SECRET looks weak or placeholder-like."
    };
  }

  return {
    status: "ok",
    message: "Auth secret configured."
  };
}

export function checkEmailEnv(env = process.env): ReadinessCheck {
  const transport = normalizeTransport(env.EMAIL_TRANSPORT);
  if (transport === "unknown") {
    return {
      status: "fail",
      message: "EMAIL_TRANSPORT must be 'smtp' or 'console'."
    };
  }

  if (transport === "console") {
    return {
      status: "warn",
      message: "Email is in console mode. Messages are logged, not delivered."
    };
  }

  const host = String(env.SMTP_HOST || "").trim();
  const from = String(env.SMTP_FROM || "").trim();
  if (!host || !from) {
    return {
      status: "fail",
      message: "SMTP_HOST and SMTP_FROM are required for smtp transport."
    };
  }

  return {
    status: "ok",
    message: "SMTP transport configured."
  };
}

export function summarizeStatus(checks: ReadinessCheck[]): ReadinessStatus {
  if (checks.some((check) => check.status === "fail")) return "fail";
  if (checks.some((check) => check.status === "warn")) return "warn";
  return "ok";
}
