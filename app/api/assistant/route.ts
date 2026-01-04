import OpenAI from "openai";
import { NextResponse } from "next/server";

function getApiKey() {
  return (
    process.env.OPENAI_API_KEY ||
    process.env.OPENAI_KEY ||
    process.env.OPENAI_APIKEY ||
    ""
  ).trim();
}

function getModel() {
  return (process.env.OPENAI_MODEL || "gpt-4.1-mini").trim();
}

const ACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["assistant_message", "actions"],
  properties: {
    assistant_message: { type: "string" },
    actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "type",
          "client_id",
          "client_name",
          "addressee_name",
          "sender_name",
          "pay_by_date",
          "show_due_date_reminder",
          "show_disclaimers",
          "entity_type",
          "business_type",
          "entity_name",
          "entity_id",
          "ca_corp_form",
          "payment_type",
          "quarter",
          "due_date",
          "amount",
          "tax_year",
          "notes",
          "state",
          "method"
        ],
        properties: {
          type: {
            type: "string",
            enum: [
              "create_client",
              "select_client",
              "set_basic_info",
              "add_federal_payment",
              "add_state_payment"
            ]
          },
          client_id: { type: ["string", "null"] },
          client_name: { type: ["string", "null"] },
          addressee_name: { type: ["string", "null"] },
          sender_name: { type: ["string", "null"] },
          pay_by_date: { type: ["string", "null"] },
          show_due_date_reminder: { type: ["boolean", "null"] },
          show_disclaimers: { type: ["boolean", "null"] },
          entity_type: {
            type: ["string", "null"],
            enum: ["individual", "business", null]
          },
          business_type: {
            type: ["string", "null"],
            enum: ["ccorp", "scorp", "partnership", "llc", null]
          },
          entity_name: { type: ["string", "null"] },
          entity_id: { type: ["string", "null"] },
          ca_corp_form: { type: ["string", "null"] },
          payment_type: { type: ["string", "null"] },
          quarter: { type: ["string", "null"] },
          due_date: { type: ["string", "null"] },
          amount: { type: ["string", "number", "null"] },
          tax_year: { type: ["string", "null"] },
          notes: { type: ["string", "null"] },
          state: { type: ["string", "null"] },
          method: {
            type: ["string", "null"],
            enum: ["electronic", "mail", null]
          }
        }
      }
    }
  }
};

function extractJsonText(resp: {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
}) {
  if (resp && typeof resp.output_text === "string" && resp.output_text.trim()) {
    return resp.output_text.trim();
  }
  const out = Array.isArray(resp?.output) ? resp.output : [];
  for (const item of out) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const chunk of content) {
      if (
        chunk?.type === "output_text" &&
        typeof chunk?.text === "string" &&
        chunk.text.trim()
      ) {
        return chunk.text.trim();
      }
    }
  }
  return "";
}

function hasNonEmptyText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasAmount(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value);
  return String(value).trim().length > 0;
}

function isEstimatedType(paymentType: unknown) {
  return String(paymentType || "").toLowerCase().includes("estimated");
}

function enforceAssistantRequirements(plan: unknown) {
  const input = plan && typeof plan === "object" ? (plan as Record<string, any>) : {};
  const actions = Array.isArray(input.actions) ? input.actions : [];

  const kept = [];
  const issues = [];

  for (const action of actions) {
    const type = String(action?.type || "");

    if (type === "add_federal_payment") {
      const missing = [];
      if (!hasNonEmptyText(action?.payment_type)) missing.push("payment type");
      if (!hasAmount(action?.amount)) missing.push("amount");
      if (!hasNonEmptyText(action?.due_date)) missing.push("due date");
      if (isEstimatedType(action?.payment_type) && !hasNonEmptyText(action?.quarter)) {
        missing.push("quarter (Q1–Q4)");
      }

      if (missing.length) {
        issues.push(`Federal payment is missing: ${missing.join(", ")}.`);
        continue;
      }
      kept.push(action);
      continue;
    }

    if (type === "add_state_payment") {
      const missing = [];
      if (!hasNonEmptyText(action?.state)) missing.push("state");
      if (!hasNonEmptyText(action?.payment_type)) missing.push("payment type");
      if (!hasAmount(action?.amount)) missing.push("amount");
      if (!hasNonEmptyText(action?.due_date)) missing.push("due date");
      if (isEstimatedType(action?.payment_type) && !hasNonEmptyText(action?.quarter)) {
        missing.push("quarter (Q1–Q4)");
      }

      if (missing.length) {
        const label = hasNonEmptyText(action?.state)
          ? `${String(action.state).trim()} state payment`
          : "State payment";
        issues.push(`${label} is missing: ${missing.join(", ")}.`);
        continue;
      }
      kept.push(action);
      continue;
    }

    kept.push(action);
  }

  let assistantMessage = hasNonEmptyText(input.assistant_message)
    ? String(input.assistant_message)
    : "";

  if (issues.length) {
    const lines = [
      assistantMessage ? assistantMessage.trim() : "I need a bit more info before I can add those payment(s).",
      "",
      "Missing required details:",
      ...issues.map((text) => `- ${text}`),
      "",
      'Example reply: "Federal Estimated Q1 $5000 due 06/15/2026"'
    ].filter(Boolean);
    assistantMessage = lines.join("\n");
  }

  return {
    assistant_message: assistantMessage,
    actions: kept
  };
}

export async function GET() {
  const hasKey = Boolean(getApiKey());
  return NextResponse.json({
    ok: true,
    has_openai_key: hasKey,
    model: getModel(),
    message: "POST JSON { message, context } to this endpoint to use the assistant."
  });
}

export async function POST(request: Request) {
  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      return NextResponse.json(
        {
          assistant_message:
            "Server is missing OPENAI_API_KEY. Set it in Vercel Project Settings → Environment Variables, then redeploy.",
          actions: []
        },
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey });
    const body = await request.json().catch(() => ({}));
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const context = body?.context ?? {};

    if (!message) {
      return NextResponse.json(
        { assistant_message: "Missing 'message' in request body.", actions: [] },
        { status: 400 }
      );
    }

    const system = `
You are an AI assistant embedded in a Tax Payment Wizard.
Your job: convert the user's request into an action plan that matches the provided JSON schema.

INPUT FORMAT:
- The user message content is JSON: { "message": string, "context": object }.
- "message" is what the user just typed.
- "context" may include:
  - sessionName
  - clients: [{ clientId, clientName }]
  - activeClientId
  - activeClient (current form data snapshot)
  - assistantThread: an array of prior messages [{ role: "user"|"assistant", text: string }]

ABSOLUTE OUTPUT RULE:
- Return ONLY valid JSON matching the schema (no prose outside JSON).
- Every action object must include ALL schema keys; set irrelevant ones to null.

CRITICAL “DO NOT GUESS” RULE:
- Do NOT invent or guess missing amounts, due dates, quarters, tax years, entity IDs, or entity legal names.
- If required details are missing, ask follow-up questions in assistant_message and DO NOT emit payment actions yet.
- You MAY emit safe actions that don’t require guessing (create_client, select_client, set_basic_info for known fields).

HOW TO HANDLE FOLLOW-UPS:
- If the user’s latest message is a short answer (e.g., “$10k due 6/15/2026”), use context.assistantThread and context.activeClient to infer what they are answering.
- Ask for ALL missing required fields at once (avoid multiple back-and-forth turns).

CLIENT TARGETING RULES:
- If the user asks to create a new client, include create_client.
- If the user references an existing client by name/id, include select_client.
- Otherwise, assume edits apply to context.activeClientId.

FIELD REQUIREMENTS (ENFORCE THESE):
A) Business client basics (when entity_type="business"):
- business_type is required (ccorp/scorp/partnership/llc).
- entity_name and entity_id are required before creating state payment actions for a business.
- ca_corp_form is optional; ask only if needed or explicitly mentioned.

B) add_federal_payment requirements:
- MUST have payment_type, amount, due_date.
- If payment_type is Estimated, MUST have quarter (Q1–Q4).
- tax_year and notes may be null.

C) add_state_payment requirements:
- MUST have state, payment_type, amount, due_date.
- If payment_type is Estimated (or contains “estimated”), MUST have quarter.
- method may be null unless the user explicitly requests mail; default is electronic when null.
- tax_year and notes may be null.

NORMALIZATION / PREFERENCES:
- Federal payment_type must be one of: Extension, Estimated, Balance Due.
- For California individual estimated payments, use payment_type: "Estimated Tax Payment (Form 540-ES)".
- For California business PTE, prefer payment_type: "pte".
- If state abbreviations are given (e.g. "CA"), convert to full name ("California").

DATE HANDLING:
- Dates may be given as MM/DD/YYYY or YYYY-MM-DD; return the same string you received.
- If tax_year is not specified and this is an Estimated Q4 payment due in January, infer tax_year = due_year - 1.
- Otherwise, leave tax_year null unless explicitly provided.

FOLLOW-UP MESSAGE FORMAT (assistant_message):
When details are missing:
1) Confirm what you did (e.g., created/selected client, set entity type).
2) List missing required items as bullets.
3) Provide a single example reply the user can paste.

Return ONLY JSON that matches the schema.
`.trim();

    const input = [
      {
        role: "system",
        content: [{ type: "input_text", text: system }]
      },
      {
        role: "user",
        content: [{ type: "input_text", text: JSON.stringify({ message, context }) }]
      }
    ];

    const resp = await client.responses.create({
      model: getModel(),
      input,
      text: {
        format: {
          type: "json_schema",
          name: "wizard_actions",
          strict: true,
          schema: ACTION_SCHEMA
        }
      }
    });

    const jsonText = extractJsonText(resp);
    if (!jsonText) {
      return NextResponse.json(
        { assistant_message: "No structured output returned from the model.", actions: [] },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(jsonText);
    const plan = enforceAssistantRequirements(parsed);
    return NextResponse.json(plan);
  } catch (err: any) {
    console.error(err);
    const status = err?.status || err?.response?.status;
    const message =
      err?.message ||
      err?.response?.data?.error?.message ||
      err?.error?.message ||
      "Unknown error";

    return NextResponse.json(
      {
        assistant_message: `Server error calling OpenAI${
          status ? ` (status ${status})` : ""
        }: ${message}`,
        actions: []
      },
      { status: 500 }
    );
  }
}
