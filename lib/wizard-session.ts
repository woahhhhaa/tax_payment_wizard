import { randomUUID } from "crypto";

export type WizardClient = {
  clientId: string;
  data: Record<string, unknown>;
};

export type WizardSession = {
  version: number;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  clients: WizardClient[];
};

export function createEmptySession(): WizardSession {
  const now = new Date().toISOString();
  return {
    version: 1,
    id: randomUUID(),
    name: "Untitled Session",
    createdAt: now,
    updatedAt: now,
    clients: []
  };
}

export function normalizeSession(input: unknown): WizardSession {
  if (!input || typeof input !== "object") {
    return createEmptySession();
  }

  const session = input as Partial<WizardSession>;
  const base = createEmptySession();

  return {
    version: typeof session.version === "number" ? session.version : base.version,
    id: typeof session.id === "string" && session.id ? session.id : base.id,
    name:
      typeof session.name === "string" && session.name.trim()
        ? session.name.trim()
        : base.name,
    createdAt:
      typeof session.createdAt === "string" && session.createdAt
        ? session.createdAt
        : base.createdAt,
    updatedAt: new Date().toISOString(),
    clients: Array.isArray(session.clients)
      ? session.clients
          .map((client) => ({
            clientId: String(client?.clientId || "").trim(),
            data:
              client && typeof client === "object" && client.data
                ? (client.data as Record<string, unknown>)
                : {}
          }))
          .filter((client) => client.clientId)
      : []
  };
}
