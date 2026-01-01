import express from "express";
import OpenAI from "openai";

const PORT = Number(process.env.PORT || 3000);

const app = express();
app.use(express.json({ limit: "1mb" }));

// Serve this folder so you can open:
// http://localhost:3000/tax_payment_wizard_new.html
app.use(express.static(process.cwd()));

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// JSON Schema the model must output
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
          "method",
        ],
        properties: {
          type: {
            type: "string",
            enum: [
              "create_client",
              "select_client",
              "set_basic_info",
              "add_federal_payment",
              "add_state_payment",
            ],
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
            enum: ["individual", "business", null],
          },
          business_type: {
            type: ["string", "null"],
            enum: ["ccorp", "scorp", "partnership", "llc", null],
          },
          entity_name: { type: ["string", "null"] },
          entity_id: { type: ["string", "null"] },
          ca_corp_form: { type: ["string", "null"] },

          // payment
          payment_type: { type: ["string", "null"] },
          quarter: { type: ["string", "null"] },
          due_date: { type: ["string", "null"] },
          amount: { type: ["string", "number", "null"] },
          tax_year: { type: ["string", "null"] },
          notes: { type: ["string", "null"] },

          // state payment only
          state: { type: ["string", "null"] },
          method: {
            type: ["string", "null"],
            enum: ["electronic", "mail", null],
          },
        },
      },
    },
  },
};

function extractJsonText(resp) {
  if (resp && typeof resp.output_text === "string" && resp.output_text.trim()) {
    return resp.output_text.trim();
  }
  const out = Array.isArray(resp?.output) ? resp.output : [];
  for (const item of out) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const c of content) {
      if (c?.type === "output_text" && typeof c?.text === "string" && c.text.trim()) {
        return c.text.trim();
      }
    }
  }
  return "";
}

app.post("/api/assistant", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      res.status(500).json({
        assistant_message:
          "OPENAI_API_KEY is not set on the server. Set it in your environment and restart.",
        actions: [],
      });
      return;
    }

    const { message, context } = req.body || {};

    const system = `
You are an AI assistant embedded in a Tax Payment Wizard.
Convert the user's request into an action plan that matches the provided JSON schema.

Rules:
- If user asks for a new client, include create_client (and optionally set_basic_info with addressee_name).
- Only set pay_by_date if the user explicitly specifies a pay-by date.
- For Federal payments, prefer payment_type values: Extension, Estimated, Balance Due.
- For California individual estimated payments, use payment_type: "Estimated Tax Payment (Form 540-ES)".
- Dates may be given as MM/DD/YYYY or YYYY-MM-DD; return the same string you received.
- If tax_year is not specified and this is an Estimated Q4 payment due in January, infer tax_year = due_year - 1.

Return ONLY JSON that matches the schema.
`.trim();

    const input = [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify({ message, context }) },
    ];

    const resp = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input,
      text: {
        format: {
          type: "json_schema",
          name: "wizard_actions",
          strict: true,
          schema: ACTION_SCHEMA,
        },
      },
    });

    const jsonText = extractJsonText(resp);
    if (!jsonText) {
      res.status(500).json({
        assistant_message: "No structured output returned from the model.",
        actions: [],
      });
      return;
    }

    const plan = JSON.parse(jsonText);
    res.json(plan);
  } catch (err) {
    console.error(err);
    const status = err?.status || err?.response?.status;
    const message =
      err?.message ||
      err?.response?.data?.error?.message ||
      err?.error?.message ||
      "Unknown error";
    res.status(500).json({
      assistant_message: `Server error calling OpenAI${status ? ` (status ${status})` : ""}: ${message}`,
      actions: [],
    });
  }
});

app.listen(PORT, () => {
  console.log(
    `Server running: http://localhost:${PORT}/tax_payment_wizard_new.html`
  );
});
