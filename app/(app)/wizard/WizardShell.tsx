"use client";

import type { SVGProps } from "react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { US_STATES } from "@/lib/us-states";
import { cn } from "@/lib/utils";

type WizardStep = "basic" | "federal" | "state" | "review";

type SaveState = "loading" | "saved" | "saving" | "error";

type WizardPayment = {
  type: string;
  quarter: string;
  dueDate: string;
  amount: string;
  taxPeriod: string;
  description: string;
  method: string;
  [key: string]: unknown;
};

type WizardStatePaymentGroup = {
  stateName: string;
  payments: WizardPayment[];
  [key: string]: unknown;
};

type WizardClientData = {
  addresseeName: string;
  primaryEmail: string;
  senderName: string;
  paymentDueDate: string;
  showDueDateReminder: boolean;
  showDisclaimers: boolean;
  entityType: "individual" | "business";
  businessType: string;
  entityId: string;
  entityName: string;
  caCorpForm: string;
  federalPayments: WizardPayment[];
  statePayments: WizardStatePaymentGroup[];
  [key: string]: unknown;
};

type WizardClient = {
  clientId: string;
  data: WizardClientData;
};

type WizardSession = {
  version: number;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  clients: WizardClient[];
};

type SaveStatus = {
  state: SaveState;
  message: string;
};

type StepConfig = {
  id: WizardStep;
  title: string;
  hint: string;
};

const STEPS: StepConfig[] = [
  { id: "basic", title: "Client profile", hint: "Contacts, entity setup, and defaults" },
  { id: "federal", title: "Federal plan", hint: "IRS estimates, extensions, and balances" },
  { id: "state", title: "State plan", hint: "Jurisdiction-specific payment planning" },
  { id: "review", title: "Publish", hint: "Final review and portal launch" }
];

const FEDERAL_PAYMENT_TYPES = ["Extension", "Estimated", "Balance Due"];
const STATE_PAYMENT_TYPES = ["Estimated", "Extension", "Balance Due", "PTE"];
const PAYMENT_METHODS = ["electronic", "mail"];
const BUSINESS_TYPES = ["ccorp", "scorp", "partnership", "llc"];
const CA_CORP_FORMS = ["100", "100S", "100W", "100X"];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `wiz-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function defaultPayByDateISO() {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  return nextWeek.toISOString().slice(0, 10);
}

function normalizeDateInput(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const mdy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (mdy) {
    const mm = String(mdy[1]).padStart(2, "0");
    const dd = String(mdy[2]).padStart(2, "0");
    return `${mdy[3]}-${mm}-${dd}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function normalizeMethod(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return "";
  return PAYMENT_METHODS.includes(normalized) ? normalized : "";
}

function createBlankPayment(overrides?: Partial<WizardPayment>): WizardPayment {
  return {
    type: "Estimated",
    quarter: "",
    dueDate: "",
    amount: "",
    taxPeriod: "",
    description: "",
    method: "",
    ...overrides
  };
}

function normalizePayment(input: unknown): WizardPayment {
  const payment = asRecord(input);
  const type = String(payment.type ?? "Estimated").trim() || "Estimated";
  const isEstimated = type.toLowerCase().includes("estimated");
  const quarter = isEstimated ? String(payment.quarter ?? "").trim().toUpperCase() : "";

  return {
    ...payment,
    type,
    quarter,
    dueDate: normalizeDateInput(payment.dueDate),
    amount: payment.amount == null ? "" : String(payment.amount).trim(),
    taxPeriod: String(payment.taxPeriod ?? "").trim(),
    description: String(payment.description ?? "").trim(),
    method: normalizeMethod(payment.method)
  };
}

function normalizeStateGroup(input: unknown): WizardStatePaymentGroup | null {
  const state = asRecord(input);
  const stateName = String(state.stateName ?? "").trim();
  if (!stateName) return null;

  const payments = Array.isArray(state.payments) ? state.payments.map(normalizePayment) : [];

  return {
    ...state,
    stateName,
    payments
  };
}

function createBlankClientData(): WizardClientData {
  return {
    addresseeName: "",
    primaryEmail: "",
    senderName: "",
    paymentDueDate: defaultPayByDateISO(),
    showDueDateReminder: true,
    showDisclaimers: true,
    entityType: "individual",
    businessType: "",
    entityId: "",
    entityName: "",
    caCorpForm: "",
    federalPayments: [],
    statePayments: []
  };
}

function normalizeClientData(input: unknown): WizardClientData {
  const source = asRecord(input);
  const base = createBlankClientData();
  const entityType = String(source.entityType ?? base.entityType).trim().toLowerCase();

  const federalPayments = Array.isArray(source.federalPayments)
    ? source.federalPayments.map(normalizePayment)
    : [];

  const statePayments = Array.isArray(source.statePayments)
    ? source.statePayments
        .map(normalizeStateGroup)
        .filter((group): group is WizardStatePaymentGroup => group !== null)
    : [];

  return {
    ...base,
    ...source,
    addresseeName: String(source.addresseeName ?? base.addresseeName).trim(),
    primaryEmail: String(source.primaryEmail ?? "").trim(),
    senderName: String(source.senderName ?? base.senderName).trim(),
    paymentDueDate: normalizeDateInput(source.paymentDueDate) || base.paymentDueDate,
    showDueDateReminder: source.showDueDateReminder !== false,
    showDisclaimers: source.showDisclaimers !== false,
    entityType: entityType === "business" ? "business" : "individual",
    businessType: String(source.businessType ?? base.businessType).trim(),
    entityId: String(source.entityId ?? base.entityId).trim(),
    entityName: String(source.entityName ?? base.entityName).trim(),
    caCorpForm: String(source.caCorpForm ?? base.caCorpForm).trim(),
    federalPayments,
    statePayments
  };
}

function createEmptySession(name?: string): WizardSession {
  const now = new Date().toISOString();
  return {
    version: 1,
    id: createId(),
    name: name?.trim() || "Untitled Workflow",
    createdAt: now,
    updatedAt: now,
    clients: []
  };
}

function normalizeSession(input: unknown): WizardSession {
  const source = asRecord(input);
  const base = createEmptySession();

  const clients = Array.isArray(source.clients)
    ? source.clients
        .map((item) => {
          const client = asRecord(item);
          const clientId = String(client.clientId ?? "").trim();
          if (!clientId) return null;

          return {
            clientId,
            data: normalizeClientData(client.data)
          } as WizardClient;
        })
        .filter((client): client is WizardClient => client !== null)
    : [];

  return {
    version: typeof source.version === "number" ? source.version : base.version,
    id: String(source.id ?? base.id),
    name: String(source.name ?? base.name).trim() || base.name,
    createdAt: String(source.createdAt ?? base.createdAt),
    updatedAt: new Date().toISOString(),
    clients
  };
}

function createClientId(existing: Set<string>) {
  for (let index = 1; index < 10000; index += 1) {
    const id = `client-${String(index).padStart(3, "0")}`;
    if (!existing.has(id)) return id;
  }
  return `client-${Date.now()}`;
}

function safeNumber(value: string) {
  const parsed = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeDate(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function csvCell(value: unknown) {
  const stringValue = String(value ?? "");
  const escaped = stringValue.replace(/"/g, '""');
  return `"${escaped}"`;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(amount);
}

function formatSaveMessage(status: SaveStatus, lastSavedAt: Date | null) {
  if (status.state === "saved" && lastSavedAt) {
    return `Saved ${lastSavedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  return status.message;
}

export function WizardShell() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<WizardSession | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<WizardStep>("basic");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ state: "loading", message: "Loading" });
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [publishingChecklist, setPublishingChecklist] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [newStateCode, setNewStateCode] = useState("CA");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef<WizardSession | null>(null);
  const batchIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef(false);
  const readyRef = useRef(false);
  const savingRef = useRef(false);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    batchIdRef.current = batchId;
  }, [batchId]);

  const activeClient = useMemo(() => {
    if (!session || !activeClientId) return null;
    return session.clients.find((client) => client.clientId === activeClientId) ?? null;
  }, [session, activeClientId]);

  const allPayments = useMemo(() => {
    if (!session) return [];

    return session.clients.flatMap((client) => {
      const federal = client.data.federalPayments.map((payment) => ({
        clientId: client.clientId,
        clientName: client.data.addresseeName || client.clientId,
        scope: "Federal",
        state: "",
        payment
      }));

      const statePayments = client.data.statePayments.flatMap((group) =>
        group.payments.map((payment) => ({
          clientId: client.clientId,
          clientName: client.data.addresseeName || client.clientId,
          scope: "State",
          state: group.stateName,
          payment
        }))
      );

      return [...federal, ...statePayments];
    });
  }, [session]);

  const totals = useMemo(() => {
    const clients = session?.clients.length ?? 0;
    const federal = session?.clients.reduce((sum, client) => sum + client.data.federalPayments.length, 0) ?? 0;
    const state =
      session?.clients.reduce(
        (sum, client) => sum + client.data.statePayments.reduce((groupSum, group) => groupSum + group.payments.length, 0),
        0
      ) ?? 0;

    const amount = allPayments.reduce((sum, row) => sum + safeNumber(row.payment.amount), 0);

    const upcoming = allPayments.filter((row) => {
      const due = safeDate(row.payment.dueDate);
      if (!due) return false;
      const days = (due.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return days >= 0 && days <= 21;
    }).length;

    return {
      clients,
      federal,
      state,
      amount,
      upcoming,
      payments: federal + state
    };
  }, [allPayments, session]);

  const completion = useMemo(() => {
    const data = activeClient?.data;
    const basicComplete = Boolean(data?.addresseeName?.trim());
    const federalComplete = Boolean(data?.federalPayments.length);
    const stateComplete = Boolean(data?.statePayments.some((group) => group.payments.length > 0));
    const reviewReady = basicComplete && (federalComplete || stateComplete);

    return {
      basic: basicComplete,
      federal: federalComplete,
      state: stateComplete,
      review: reviewReady
    };
  }, [activeClient]);

  const persistSession = useCallback(async () => {
    const snapshot = sessionRef.current;
    if (!snapshot || savingRef.current || !pendingSaveRef.current) return;

    pendingSaveRef.current = false;
    savingRef.current = true;
    setSaveStatus({ state: "saving", message: "Saving..." });

    try {
      const response = await fetch("/api/batches/current", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: batchIdRef.current,
          snapshot
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Unable to save your workspace right now.");
      }

      const payload = await response.json().catch(() => ({}));
      if (typeof payload.batchId === "string" && payload.batchId) {
        batchIdRef.current = payload.batchId;
        setBatchId(payload.batchId);
      }

      setSaveStatus({ state: "saved", message: "Saved" });
      setLastSavedAt(new Date());
    } catch (error) {
      pendingSaveRef.current = true;
      setSaveStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Save failed"
      });
    } finally {
      savingRef.current = false;
      if (pendingSaveRef.current) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          void persistSession();
        }, 900);
      }
    }
  }, []);

  const queueAutosave = useCallback(() => {
    if (!readyRef.current) return;

    pendingSaveRef.current = true;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persistSession();
    }, 900);
  }, [persistSession]);

  useEffect(() => {
    let ignore = false;

    async function loadCurrentBatch() {
      setLoading(true);
      setSaveStatus({ state: "loading", message: "Loading" });

      try {
        const response = await fetch("/api/batches/current", { cache: "no-store" });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error || "Unable to load your planning workspace.");
        }

        const payload = await response.json();
        if (ignore) return;

        const snapshot = normalizeSession(payload?.snapshot);
        sessionRef.current = snapshot;
        setSession(snapshot);
        setBatchId(typeof payload?.batchId === "string" ? payload.batchId : null);
        setActiveClientId(snapshot.clients[0]?.clientId ?? null);
        setPublishError(null);
        setPortalUrl(null);
        setSaveStatus({ state: "saved", message: "Ready" });
        setLastSavedAt(new Date());
      } catch (error) {
        if (ignore) return;

        const fallback = createEmptySession("New Workflow");
        sessionRef.current = fallback;
        setSession(fallback);
        setBatchId(null);
        setActiveClientId(null);
        setSaveStatus({
          state: "error",
          message: error instanceof Error ? error.message : "Unable to load workspace"
        });
      } finally {
        if (ignore) return;
        readyRef.current = true;
        setLoading(false);
      }
    }

    void loadCurrentBatch();

    return () => {
      ignore = true;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [persistSession]);

  const updateSession = useCallback(
    (mutator: (current: WizardSession) => WizardSession) => {
      setSession((current) => {
        if (!current) return current;
        const next = mutator(current);
        const touched = {
          ...next,
          updatedAt: new Date().toISOString()
        };
        sessionRef.current = touched;
        return touched;
      });

      queueAutosave();
    },
    [queueAutosave]
  );

  const updateActiveClient = useCallback(
    (mutator: (client: WizardClient) => WizardClient) => {
      if (!activeClientId) return;

      updateSession((current) => {
        const index = current.clients.findIndex((client) => client.clientId === activeClientId);
        if (index === -1) return current;

        const nextClients = [...current.clients];
        nextClients[index] = mutator(nextClients[index]);

        return {
          ...current,
          clients: nextClients
        };
      });
    },
    [activeClientId, updateSession]
  );

  const onSessionNameChange = useCallback(
    (name: string) => {
      updateSession((current) => ({ ...current, name }));
    },
    [updateSession]
  );

  const createClient = useCallback(() => {
    if (!sessionRef.current) return;

    const existing = new Set(sessionRef.current.clients.map((client) => client.clientId));
    const clientId = createClientId(existing);

    updateSession((current) => ({
      ...current,
      clients: [...current.clients, { clientId, data: createBlankClientData() }]
    }));

    setActiveClientId(clientId);
    setActiveStep("basic");
    setPortalUrl(null);
    setPublishError(null);
  }, [updateSession]);

  const duplicateClient = useCallback(() => {
    if (!activeClient || !sessionRef.current) return;

    const existing = new Set(sessionRef.current.clients.map((client) => client.clientId));
    const clientId = createClientId(existing);

    updateSession((current) => ({
      ...current,
      clients: [
        ...current.clients,
        {
          clientId,
          data: normalizeClientData(JSON.parse(JSON.stringify(activeClient.data)))
        }
      ]
    }));

    setActiveClientId(clientId);
    setActiveStep("basic");
    setPortalUrl(null);
    setPublishError(null);
  }, [activeClient, updateSession]);

  const deleteActiveClient = useCallback(() => {
    if (!activeClient || !sessionRef.current) return;

    const clientName = activeClient.data.addresseeName || activeClient.clientId;
    const confirmed = window.confirm(`Delete ${clientName}? This removes the client from this workflow.`);
    if (!confirmed) return;

    updateSession((current) => {
      const nextClients = current.clients.filter((client) => client.clientId !== activeClient.clientId);
      return {
        ...current,
        clients: nextClients
      };
    });

    const remaining = sessionRef.current.clients.filter((client) => client.clientId !== activeClient.clientId);
    setActiveClientId(remaining[0]?.clientId ?? null);
    setPortalUrl(null);
    setPublishError(null);
  }, [activeClient, updateSession]);

  const newBatch = useCallback(async () => {
    setSaveStatus({ state: "saving", message: "Creating a new workflow..." });
    setPublishError(null);
    setPortalUrl(null);

    try {
      const response = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Workflow ${new Date().toLocaleDateString()}` })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Unable to create a new workflow.");
      }

      const payload = await response.json();
      const snapshot = normalizeSession(payload?.snapshot);

      setBatchId(typeof payload?.batchId === "string" ? payload.batchId : null);
      setSession(snapshot);
      sessionRef.current = snapshot;
      setActiveClientId(snapshot.clients[0]?.clientId ?? null);
      setActiveStep("basic");
      setSaveStatus({ state: "saved", message: "New workflow ready" });
      setLastSavedAt(new Date());
    } catch (error) {
      setSaveStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Unable to create workflow"
      });
    }
  }, []);

  const saveNow = useCallback(async () => {
    pendingSaveRef.current = true;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    await persistSession();
  }, [persistSession]);

  const exportJson = useCallback(() => {
    const snapshot = sessionRef.current;
    if (!snapshot) return;

    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const filename = `${(snapshot.name || "workflow").replace(/\s+/g, "-").toLowerCase()}-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();

    URL.revokeObjectURL(url);
  }, []);

  const exportCsv = useCallback(() => {
    const snapshot = sessionRef.current;
    if (!snapshot) return;

    const rows: string[] = [];
    rows.push(
      [
        "ClientId",
        "ClientName",
        "PrimaryEmail",
        "Scope",
        "State",
        "PaymentType",
        "Quarter",
        "DueDate",
        "Amount",
        "TaxYear",
        "Method",
        "Notes"
      ]
        .map(csvCell)
        .join(",")
    );

    snapshot.clients.forEach((client) => {
      const clientName = client.data.addresseeName || "";
      const primaryEmail = client.data.primaryEmail || "";

      client.data.federalPayments.forEach((payment) => {
        rows.push(
          [
            client.clientId,
            clientName,
            primaryEmail,
            "Federal",
            "",
            payment.type,
            payment.quarter,
            payment.dueDate,
            payment.amount,
            payment.taxPeriod,
            payment.method,
            payment.description
          ]
            .map(csvCell)
            .join(",")
        );
      });

      client.data.statePayments.forEach((group) => {
        group.payments.forEach((payment) => {
          rows.push(
            [
              client.clientId,
              clientName,
              primaryEmail,
              "State",
              group.stateName,
              payment.type,
              payment.quarter,
              payment.dueDate,
              payment.amount,
              payment.taxPeriod,
              payment.method,
              payment.description
            ]
              .map(csvCell)
              .join(",")
          );
        });
      });
    });

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const filename = `${(snapshot.name || "workflow").replace(/\s+/g, "-").toLowerCase()}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();

    URL.revokeObjectURL(url);
  }, []);

  const importJson = useCallback(
    async (file: File) => {
      setImportError(null);

      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const next = normalizeSession(parsed);

        setSession(next);
        sessionRef.current = next;
        setActiveClientId(next.clients[0]?.clientId ?? null);
        setActiveStep("basic");
        setPortalUrl(null);
        setPublishError(null);

        pendingSaveRef.current = true;
        void saveNow();
      } catch (error) {
        setImportError(error instanceof Error ? error.message : "Unable to import file");
      }
    },
    [saveNow]
  );

  const triggerImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const updateClientField = useCallback(
    <K extends keyof WizardClientData>(field: K, value: WizardClientData[K]) => {
      updateActiveClient((client) => ({
        ...client,
        data: {
          ...client.data,
          [field]: value
        }
      }));
    },
    [updateActiveClient]
  );

  const addFederalPayment = useCallback(() => {
    updateActiveClient((client) => ({
      ...client,
      data: {
        ...client.data,
        federalPayments: [...client.data.federalPayments, createBlankPayment()]
      }
    }));
  }, [updateActiveClient]);

  const updateFederalPayment = useCallback(
    (index: number, mutator: (payment: WizardPayment) => WizardPayment) => {
      updateActiveClient((client) => {
        const payments = [...client.data.federalPayments];
        const current = payments[index];
        if (!current) return client;
        payments[index] = normalizePayment(mutator(current));

        return {
          ...client,
          data: {
            ...client.data,
            federalPayments: payments
          }
        };
      });
    },
    [updateActiveClient]
  );

  const removeFederalPayment = useCallback(
    (index: number) => {
      updateActiveClient((client) => ({
        ...client,
        data: {
          ...client.data,
          federalPayments: client.data.federalPayments.filter((_, paymentIndex) => paymentIndex !== index)
        }
      }));
    },
    [updateActiveClient]
  );

  const addStateGroup = useCallback(() => {
    const stateName = US_STATES.find((state) => state.code === newStateCode)?.name;
    if (!stateName) return;

    updateActiveClient((client) => {
      const exists = client.data.statePayments.some((group) => group.stateName === stateName);
      if (exists) return client;

      return {
        ...client,
        data: {
          ...client.data,
          statePayments: [...client.data.statePayments, { stateName, payments: [] }]
        }
      };
    });
  }, [newStateCode, updateActiveClient]);

  const removeStateGroup = useCallback(
    (groupIndex: number) => {
      updateActiveClient((client) => ({
        ...client,
        data: {
          ...client.data,
          statePayments: client.data.statePayments.filter((_, index) => index !== groupIndex)
        }
      }));
    },
    [updateActiveClient]
  );

  const addStatePayment = useCallback(
    (groupIndex: number) => {
      updateActiveClient((client) => {
        const groups = [...client.data.statePayments];
        const group = groups[groupIndex];
        if (!group) return client;

        groups[groupIndex] = {
          ...group,
          payments: [...group.payments, createBlankPayment()]
        };

        return {
          ...client,
          data: {
            ...client.data,
            statePayments: groups
          }
        };
      });
    },
    [updateActiveClient]
  );

  const updateStatePayment = useCallback(
    (
      groupIndex: number,
      paymentIndex: number,
      mutator: (payment: WizardPayment) => WizardPayment
    ) => {
      updateActiveClient((client) => {
        const groups = [...client.data.statePayments];
        const group = groups[groupIndex];
        if (!group) return client;

        const payments = [...group.payments];
        const payment = payments[paymentIndex];
        if (!payment) return client;

        payments[paymentIndex] = normalizePayment(mutator(payment));
        groups[groupIndex] = {
          ...group,
          payments
        };

        return {
          ...client,
          data: {
            ...client.data,
            statePayments: groups
          }
        };
      });
    },
    [updateActiveClient]
  );

  const removeStatePayment = useCallback(
    (groupIndex: number, paymentIndex: number) => {
      updateActiveClient((client) => {
        const groups = [...client.data.statePayments];
        const group = groups[groupIndex];
        if (!group) return client;

        groups[groupIndex] = {
          ...group,
          payments: group.payments.filter((_, index) => index !== paymentIndex)
        };

        return {
          ...client,
          data: {
            ...client.data,
            statePayments: groups
          }
        };
      });
    },
    [updateActiveClient]
  );

  const publishChecklist = useCallback(async () => {
    if (!activeClientId || !batchIdRef.current) {
      setPublishError("Save your changes and choose a client first.");
      return;
    }

    setPublishingChecklist(true);
    setPublishError(null);

    try {
      await saveNow();

      const response = await fetch("/api/plans/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: batchIdRef.current,
          wizardClientId: activeClientId
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Unable to generate checklist link.");
      }

      const payload = await response.json().catch(() => ({}));
      const url = String(payload?.portalUrl || "").trim();
      if (!url) {
        throw new Error("Checklist link was generated but no URL was returned.");
      }

      setPortalUrl(url);
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "Unable to publish checklist");
    } finally {
      setPublishingChecklist(false);
    }
  }, [activeClientId, saveNow]);

  const copyChecklistLink = useCallback(async () => {
    if (!portalUrl) return;

    try {
      await navigator.clipboard.writeText(portalUrl);
      setPublishError(null);
    } catch {
      setPublishError("Checklist URL copied failed. You can copy it from the field.");
    }
  }, [portalUrl]);

  if (loading || !session) {
    return (
      <Card className="bg-card/70 backdrop-blur">
        <CardContent className="py-16 text-center text-sm text-muted-foreground">Loading Client Plans...</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden bg-card/70 backdrop-blur">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(80%_70%_at_0%_0%,hsl(var(--primary)_/_0.18),transparent_70%)]"
        />
        <CardHeader className="relative space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Client Plans</p>
              <CardTitle className="text-2xl tracking-tight sm:text-3xl">Payment Planning Workspace</CardTitle>
              <CardDescription>
                Build polished client payment plans and publish secure portals in one cohesive workspace.
              </CardDescription>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" className="gap-2" onClick={newBatch}>
                <PlusIcon className="h-4 w-4" aria-hidden />
                New workflow
              </Button>
              <Button type="button" variant="outline" className="gap-2" onClick={triggerImport}>
                <UploadIcon className="h-4 w-4" aria-hidden />
                Import JSON
              </Button>
              <Button type="button" variant="outline" className="gap-2" onClick={exportJson}>
                <DownloadIcon className="h-4 w-4" aria-hidden />
                Export JSON
              </Button>
              <Button type="button" variant="outline" className="gap-2" onClick={exportCsv}>
                <FileIcon className="h-4 w-4" aria-hidden />
                Export CSV
              </Button>
              <Button type="button" onClick={saveNow} className="gap-2">
                <SaveIcon className="h-4 w-4" aria-hidden />
                Save now
              </Button>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="grid gap-2">
              <Label htmlFor="workflow-name">Workflow name</Label>
              <Input
                id="workflow-name"
                value={session.name}
                onChange={(event) => onSessionNameChange(event.target.value)}
                placeholder="2026 Estimated Payment Portfolio"
              />
            </div>
            <div className="flex items-center gap-2 pb-1">
              <Badge
                variant={
                  saveStatus.state === "error"
                    ? "destructive"
                    : saveStatus.state === "saving"
                      ? "info"
                      : saveStatus.state === "loading"
                        ? "secondary"
                        : "success"
                }
              >
                {formatSaveMessage(saveStatus, lastSavedAt)}
              </Badge>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void importJson(file);
              }
              event.currentTarget.value = "";
            }}
          />
          {importError ? <p className="text-sm text-destructive">{importError}</p> : null}
        </CardHeader>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Clients" value={String(totals.clients)} />
        <MetricCard label="Federal obligations" value={String(totals.federal)} />
        <MetricCard label="State obligations" value={String(totals.state)} />
        <MetricCard label="Upcoming deadlines" value={String(totals.upcoming)} />
        <MetricCard label="Planned value" value={formatCurrency(totals.amount)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit bg-card/70 backdrop-blur">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Client portfolio</CardTitle>
            <CardDescription>
              Build each client plan in one place.{" "}
              {totals.clients ? `${totals.clients} clients currently in scope.` : "Add your first client to begin."}
            </CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="space-y-4 pt-5">
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" className="gap-2" onClick={createClient}>
                <PlusIcon className="h-3.5 w-3.5" aria-hidden />
                Add client
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={duplicateClient}
                disabled={!activeClient}
              >
                <CopyIcon className="h-3.5 w-3.5" aria-hidden />
                Duplicate
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="gap-2"
                onClick={deleteActiveClient}
                disabled={!activeClient}
              >
                <TrashIcon className="h-3.5 w-3.5" aria-hidden />
                Delete
              </Button>
            </div>

            {session.clients.length ? (
              <div className="space-y-2">
                {session.clients.map((client) => {
                  const isActive = client.clientId === activeClientId;
                  const stateCount = client.data.statePayments.reduce(
                    (sum, state) => sum + state.payments.length,
                    0
                  );
                  const paymentCount = client.data.federalPayments.length + stateCount;

                  return (
                    <button
                      key={client.clientId}
                      type="button"
                      onClick={() => {
                        setActiveClientId(client.clientId);
                        setPortalUrl(null);
                        setPublishError(null);
                      }}
                      className={cn(
                        "w-full rounded-xl border px-3 py-2 text-left transition-colors",
                        isActive
                          ? "border-primary/30 bg-primary/10"
                          : "border-border bg-background hover:bg-muted/40"
                      )}
                    >
                      <p className="truncate text-sm font-medium">
                        {client.data.addresseeName || "Unnamed client"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{client.clientId}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {paymentCount} payments
                        </Badge>
                        {client.data.entityType === "business" ? (
                          <Badge variant="outline" className="text-[10px]">
                            business
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            individual
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                No clients yet.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {activeClient ? (
            <Card className="bg-card/70 backdrop-blur">
              <CardHeader className="pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Current Client
                    </p>
                    <CardTitle className="text-xl">
                      {activeClient.data.addresseeName || "Unnamed client"}
                    </CardTitle>
                    <CardDescription>
                      {activeClient.data.entityType === "business" ? "Business entity" : "Individual"} •{" "}
                      {activeClient.data.federalPayments.length +
                        activeClient.data.statePayments.reduce((sum, group) => sum + group.payments.length, 0)}{" "}
                      planned payments
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="font-mono text-[11px]">
                    {activeClient.clientId}
                  </Badge>
                </div>
              </CardHeader>
            </Card>
          ) : null}

          <Card className="overflow-hidden">
            <CardHeader className="space-y-3">
              <CardTitle className="text-base">Plan builder</CardTitle>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {STEPS.map((step) => {
                  const isActive = activeStep === step.id;
                  const isComplete = completion[step.id];

                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => setActiveStep(step.id)}
                      className={cn(
                        "rounded-xl border px-3 py-3 text-left transition-colors",
                        isActive
                          ? "border-primary/35 bg-primary/10"
                          : "border-border bg-background hover:bg-muted/40"
                      )}
                    >
                      <p className="text-sm font-semibold">{step.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{step.hint}</p>
                      <div className="mt-2">
                        <Badge variant={isComplete ? "success" : "secondary"} className="text-[10px]">
                          {isComplete ? "Complete" : "Pending"}
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardHeader>
          </Card>

          {!activeClient ? (
            <Card>
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                Choose a client from the portfolio, or add a new one to begin.
              </CardContent>
            </Card>
          ) : null}

          {activeClient && activeStep === "basic" ? (
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="text-xl">Client profile</CardTitle>
                <CardDescription>
                  Define recipient details, filing profile, and communication defaults.
                </CardDescription>
              </CardHeader>
              <Separator />
              <CardContent className="grid gap-5 pt-6 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="addressee-name">Recipient name</Label>
                  <Input
                    id="addressee-name"
                    value={activeClient.data.addresseeName}
                    onChange={(event) => updateClientField("addresseeName", event.target.value)}
                    placeholder="Katelynn Wilson"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="primary-email">Recipient email</Label>
                  <Input
                    id="primary-email"
                    type="email"
                    value={activeClient.data.primaryEmail}
                    onChange={(event) => updateClientField("primaryEmail", event.target.value)}
                    placeholder="client@example.com"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="sender-name">Sender name</Label>
                  <Input
                    id="sender-name"
                    value={activeClient.data.senderName}
                    onChange={(event) => updateClientField("senderName", event.target.value)}
                    placeholder="Kyle Milner"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="payment-due-date">Target pay-by date</Label>
                  <Input
                    id="payment-due-date"
                    type="date"
                    value={activeClient.data.paymentDueDate}
                    onChange={(event) => updateClientField("paymentDueDate", event.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="entity-type">Entity type</Label>
                  <Select
                    id="entity-type"
                    value={activeClient.data.entityType}
                    onChange={(event) => {
                      const nextType = event.target.value === "business" ? "business" : "individual";
                      updateActiveClient((client) => ({
                        ...client,
                        data: {
                          ...client.data,
                          entityType: nextType,
                          businessType: nextType === "business" ? client.data.businessType || "ccorp" : "",
                          entityName: nextType === "business" ? client.data.entityName : "",
                          entityId: nextType === "business" ? client.data.entityId : "",
                          caCorpForm: nextType === "business" ? client.data.caCorpForm : ""
                        }
                      }));
                    }}
                  >
                    <option value="individual">Individual</option>
                    <option value="business">Business</option>
                  </Select>
                </div>

                {activeClient.data.entityType === "business" ? (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="business-type">Business type</Label>
                      <Select
                        id="business-type"
                        value={activeClient.data.businessType || "ccorp"}
                        onChange={(event) => updateClientField("businessType", event.target.value)}
                      >
                        {BUSINESS_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type.toUpperCase()}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="entity-name">Business legal name</Label>
                      <Input
                        id="entity-name"
                        value={activeClient.data.entityName}
                        onChange={(event) => updateClientField("entityName", event.target.value)}
                        placeholder="Acme Tax Advisory LLC"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="entity-id">Tax ID / entity ID</Label>
                      <Input
                        id="entity-id"
                        value={activeClient.data.entityId}
                        onChange={(event) => updateClientField("entityId", event.target.value)}
                        placeholder="12-3456789"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="ca-corp-form">CA corp form (if applicable)</Label>
                      <Select
                        id="ca-corp-form"
                        value={activeClient.data.caCorpForm}
                        onChange={(event) => updateClientField("caCorpForm", event.target.value)}
                      >
                        <option value="">Not applicable</option>
                        {CA_CORP_FORMS.map((form) => (
                          <option key={form} value={form}>
                            Form {form}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </>
                ) : null}

                <div className="flex items-center gap-3 rounded-xl border bg-background px-3 py-2">
                  <input
                    id="show-reminder"
                    type="checkbox"
                    checked={activeClient.data.showDueDateReminder}
                    onChange={(event) => updateClientField("showDueDateReminder", event.target.checked)}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  <Label htmlFor="show-reminder" className="text-sm font-normal text-muted-foreground">
                    Include due date reminder in generated instructions
                  </Label>
                </div>

                <div className="flex items-center gap-3 rounded-xl border bg-background px-3 py-2">
                  <input
                    id="show-disclaimers"
                    type="checkbox"
                    checked={activeClient.data.showDisclaimers}
                    onChange={(event) => updateClientField("showDisclaimers", event.target.checked)}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  <Label htmlFor="show-disclaimers" className="text-sm font-normal text-muted-foreground">
                    Include payment/disclaimer section
                  </Label>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {activeClient && activeStep === "federal" ? (
            <Card className="overflow-hidden">
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">Federal plan</CardTitle>
                  <CardDescription>
                    Add extension, estimated, and balance due obligations for this client.
                  </CardDescription>
                </div>
                <Button type="button" className="gap-2" onClick={addFederalPayment}>
                  <PlusIcon className="h-4 w-4" aria-hidden />
                  Add federal obligation
                </Button>
              </CardHeader>
              <Separator />
              <CardContent className="p-0">
                {activeClient.data.federalPayments.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[170px]">Type</TableHead>
                        <TableHead className="w-[110px]">Quarter</TableHead>
                        <TableHead className="w-[140px]">Due date</TableHead>
                        <TableHead className="w-[140px]">Amount</TableHead>
                        <TableHead className="w-[120px]">Tax year</TableHead>
                        <TableHead className="w-[130px]">Method</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="w-[56px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeClient.data.federalPayments.map((payment, index) => {
                        const isEstimated = payment.type.toLowerCase().includes("estimated");

                        return (
                          <TableRow key={`federal-${index}`}>
                            <TableCell>
                              <Select
                                value={payment.type}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  updateFederalPayment(index, (current) => ({
                                    ...current,
                                    type: value,
                                    quarter: value.toLowerCase().includes("estimated")
                                      ? current.quarter
                                      : ""
                                  }));
                                }}
                              >
                                {FEDERAL_PAYMENT_TYPES.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={payment.quarter}
                                disabled={!isEstimated}
                                onChange={(event) => {
                                  updateFederalPayment(index, (current) => ({
                                    ...current,
                                    quarter: event.target.value
                                  }));
                                }}
                              >
                                <option value="">—</option>
                                <option value="Q1">Q1</option>
                                <option value="Q2">Q2</option>
                                <option value="Q3">Q3</option>
                                <option value="Q4">Q4</option>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="date"
                                value={payment.dueDate}
                                onChange={(event) => {
                                  updateFederalPayment(index, (current) => ({
                                    ...current,
                                    dueDate: event.target.value
                                  }));
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.01"
                                value={payment.amount}
                                onChange={(event) => {
                                  updateFederalPayment(index, (current) => ({
                                    ...current,
                                    amount: event.target.value
                                  }));
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={payment.taxPeriod}
                                onChange={(event) => {
                                  updateFederalPayment(index, (current) => ({
                                    ...current,
                                    taxPeriod: event.target.value
                                  }));
                                }}
                                placeholder="2026"
                              />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={payment.method}
                                onChange={(event) => {
                                  updateFederalPayment(index, (current) => ({
                                    ...current,
                                    method: event.target.value
                                  }));
                                }}
                              >
                                <option value="">Select</option>
                                {PAYMENT_METHODS.map((method) => (
                                  <option key={method} value={method}>
                                    {method}
                                  </option>
                                ))}
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Textarea
                                value={payment.description}
                                onChange={(event) => {
                                  updateFederalPayment(index, (current) => ({
                                    ...current,
                                    description: event.target.value
                                  }));
                                }}
                                rows={2}
                                className="min-h-[64px]"
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => removeFederalPayment(index)}
                                aria-label="Remove payment"
                              >
                                <TrashIcon className="h-4 w-4" aria-hidden />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-10">
                    <div className="rounded-2xl border border-dashed bg-muted/20 p-10 text-center text-sm text-muted-foreground">
                      No federal obligations added yet.
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          {activeClient && activeStep === "state" ? (
            <Card className="overflow-hidden">
              <CardHeader className="space-y-4">
                <div>
                  <CardTitle className="text-xl">State plan</CardTitle>
                  <CardDescription>
                    Group obligations by state and capture filing details by jurisdiction.
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Select
                    value={newStateCode}
                    onChange={(event) => setNewStateCode(event.target.value)}
                    className="sm:w-[220px]"
                  >
                    {US_STATES.map((state) => (
                      <option key={state.code} value={state.code}>
                        {state.name}
                      </option>
                    ))}
                  </Select>
                  <Button type="button" className="gap-2" onClick={addStateGroup}>
                    <PlusIcon className="h-4 w-4" aria-hidden />
                    Add state
                  </Button>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="space-y-5 pt-6">
                {activeClient.data.statePayments.length ? (
                  activeClient.data.statePayments.map((group, groupIndex) => (
                    <Card key={`${group.stateName}-${groupIndex}`} className="overflow-hidden border-dashed">
                      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-4">
                        <div>
                          <CardTitle className="text-base">{group.stateName}</CardTitle>
                          <CardDescription>{group.payments.length} payments</CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => addStatePayment(groupIndex)}
                          >
                            <PlusIcon className="h-3.5 w-3.5" aria-hidden />
                            Add obligation
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="gap-1"
                            onClick={() => removeStateGroup(groupIndex)}
                          >
                            <TrashIcon className="h-3.5 w-3.5" aria-hidden />
                            Remove state
                          </Button>
                        </div>
                      </CardHeader>
                      <Separator />
                      <CardContent className="p-0">
                        {group.payments.length ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[170px]">Type</TableHead>
                                <TableHead className="w-[110px]">Quarter</TableHead>
                                <TableHead className="w-[140px]">Due date</TableHead>
                                <TableHead className="w-[130px]">Amount</TableHead>
                                <TableHead className="w-[120px]">Tax year</TableHead>
                                <TableHead className="w-[120px]">Method</TableHead>
                                <TableHead>Notes</TableHead>
                                <TableHead className="w-[56px]" />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.payments.map((payment, paymentIndex) => {
                                const isEstimated = payment.type.toLowerCase().includes("estimated");
                                return (
                                  <TableRow key={`${group.stateName}-${paymentIndex}`}>
                                    <TableCell>
                                      <Select
                                        value={payment.type}
                                        onChange={(event) => {
                                          const value = event.target.value;
                                          updateStatePayment(groupIndex, paymentIndex, (current) => ({
                                            ...current,
                                            type: value,
                                            quarter: value.toLowerCase().includes("estimated")
                                              ? current.quarter
                                              : ""
                                          }));
                                        }}
                                      >
                                        {STATE_PAYMENT_TYPES.map((option) => (
                                          <option key={option} value={option}>
                                            {option}
                                          </option>
                                        ))}
                                      </Select>
                                    </TableCell>
                                    <TableCell>
                                      <Select
                                        value={payment.quarter}
                                        disabled={!isEstimated}
                                        onChange={(event) => {
                                          updateStatePayment(groupIndex, paymentIndex, (current) => ({
                                            ...current,
                                            quarter: event.target.value
                                          }));
                                        }}
                                      >
                                        <option value="">—</option>
                                        <option value="Q1">Q1</option>
                                        <option value="Q2">Q2</option>
                                        <option value="Q3">Q3</option>
                                        <option value="Q4">Q4</option>
                                      </Select>
                                    </TableCell>
                                    <TableCell>
                                      <Input
                                        type="date"
                                        value={payment.dueDate}
                                        onChange={(event) => {
                                          updateStatePayment(groupIndex, paymentIndex, (current) => ({
                                            ...current,
                                            dueDate: event.target.value
                                          }));
                                        }}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={payment.amount}
                                        onChange={(event) => {
                                          updateStatePayment(groupIndex, paymentIndex, (current) => ({
                                            ...current,
                                            amount: event.target.value
                                          }));
                                        }}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Input
                                        value={payment.taxPeriod}
                                        onChange={(event) => {
                                          updateStatePayment(groupIndex, paymentIndex, (current) => ({
                                            ...current,
                                            taxPeriod: event.target.value
                                          }));
                                        }}
                                        placeholder="2026"
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Select
                                        value={payment.method}
                                        onChange={(event) => {
                                          updateStatePayment(groupIndex, paymentIndex, (current) => ({
                                            ...current,
                                            method: event.target.value
                                          }));
                                        }}
                                      >
                                        <option value="">Select</option>
                                        {PAYMENT_METHODS.map((method) => (
                                          <option key={method} value={method}>
                                            {method}
                                          </option>
                                        ))}
                                      </Select>
                                    </TableCell>
                                    <TableCell>
                                      <Textarea
                                        value={payment.description}
                                        onChange={(event) => {
                                          updateStatePayment(groupIndex, paymentIndex, (current) => ({
                                            ...current,
                                            description: event.target.value
                                          }));
                                        }}
                                        rows={2}
                                        className="min-h-[64px]"
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => removeStatePayment(groupIndex, paymentIndex)}
                                        aria-label="Remove payment"
                                      >
                                        <TrashIcon className="h-4 w-4" aria-hidden />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        ) : (
                          <div className="p-6 text-sm text-muted-foreground">No obligations yet for this state.</div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed bg-muted/20 p-10 text-center text-sm text-muted-foreground">
                    No state plans yet.
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          {activeClient && activeStep === "review" ? (
            <Card className="overflow-hidden">
              <CardHeader className="space-y-2">
                <CardTitle className="text-xl">Publish plan</CardTitle>
                <CardDescription>
                  Validate this client plan, then publish a secure portal link for confirmation.
                </CardDescription>
              </CardHeader>
              <Separator />
              <CardContent className="space-y-6 pt-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricCard
                    label="Current client"
                    value={activeClient.data.addresseeName || "Unnamed"}
                    compact
                  />
                  <MetricCard
                    label="Federal items"
                    value={String(activeClient.data.federalPayments.length)}
                    compact
                  />
                  <MetricCard
                    label="State items"
                    value={String(
                      activeClient.data.statePayments.reduce((sum, group) => sum + group.payments.length, 0)
                    )}
                    compact
                  />
                  <MetricCard
                    label="Total planned"
                    value={formatCurrency(
                      activeClient.data.federalPayments.reduce((sum, payment) => sum + safeNumber(payment.amount), 0) +
                        activeClient.data.statePayments.reduce(
                          (sum, group) =>
                            sum + group.payments.reduce((paymentSum, payment) => paymentSum + safeNumber(payment.amount), 0),
                          0
                        )
                    )}
                    compact
                  />
                </div>

                <div className="rounded-2xl border bg-background/80 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">Portal publishing</p>
                      <p className="text-sm text-muted-foreground">
                        Save and generate a secure client portal URL.
                      </p>
                    </div>
                    <Button
                      type="button"
                      className="gap-2"
                      onClick={publishChecklist}
                      disabled={publishingChecklist}
                    >
                      <LinkIcon className="h-4 w-4" aria-hidden />
                      {publishingChecklist ? "Publishing..." : "Generate portal link"}
                    </Button>
                  </div>

                  {publishError ? <p className="mt-3 text-sm text-destructive">{publishError}</p> : null}

                  {portalUrl ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                      <Input readOnly value={portalUrl} />
                      <Button type="button" variant="outline" onClick={copyChecklistLink}>
                        Copy
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border bg-background/80 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">Planned payment schedule</p>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/app/payments">Open payments board</Link>
                    </Button>
                  </div>

                  {activeClient.data.federalPayments.length ||
                  activeClient.data.statePayments.some((group) => group.payments.length) ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Scope</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Quarter</TableHead>
                          <TableHead>Due</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeClient.data.federalPayments.map((payment, index) => (
                          <TableRow key={`review-fed-${index}`}>
                            <TableCell>Federal</TableCell>
                            <TableCell>{payment.type || "—"}</TableCell>
                            <TableCell>{payment.quarter || "—"}</TableCell>
                            <TableCell>{payment.dueDate || "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {payment.amount ? formatCurrency(safeNumber(payment.amount)) : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                        {activeClient.data.statePayments.flatMap((group, groupIndex) =>
                          group.payments.map((payment, paymentIndex) => (
                            <TableRow key={`review-state-${groupIndex}-${paymentIndex}`}>
                              <TableCell>{group.stateName}</TableCell>
                              <TableCell>{payment.type || "—"}</TableCell>
                              <TableCell>{payment.quarter || "—"}</TableCell>
                              <TableCell>{payment.dueDate || "—"}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {payment.amount ? formatCurrency(safeNumber(payment.amount)) : "—"}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground">No payment rows yet for this client.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  return (
    <Card className={cn("bg-card/70 backdrop-blur", compact && "shadow-none")}> 
      <CardHeader className={cn("pb-3", compact && "p-4 pb-2")}> 
        <CardDescription className={cn(compact && "text-xs")}>{label}</CardDescription>
        <CardTitle className={cn("text-2xl tabular-nums", compact && "text-lg")}>{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function UploadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 20V10" />
      <path d="m7 14 5-5 5 5" />
      <path d="M5 4h14" />
    </svg>
  );
}

function DownloadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 4v10" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  );
}

function SaveIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M8 4v6h8" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}

function LinkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1" />
      <path d="M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 1 1-7-7l1-1" />
    </svg>
  );
}

function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function CopyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <rect x="2" y="2" width="13" height="13" rx="2" />
    </svg>
  );
}

function FileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h8" />
    </svg>
  );
}
