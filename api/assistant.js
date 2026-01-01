import OpenAI from "openai";

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
        required: ["type"],
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

          client_id: { type: "string" },
          client_name: { type: "string" },

          addressee_name: { type: "string" },
          sender_name: { type: "string" },
          pay_by_date: { type: "string" },
          show_due_date_reminder: { type: "boolean" },
          show_disclaimers: { type: "boolean" },

          entity_type: { type: "string", enum: ["individual", "business"] },
          business_type: {
            type: "string",
            enum: ["ccorp", "scorp", "partnership", "llc"],
          },
          entity_name: { type: "string" },
          entity_id: { type: "string" },
          ca_corp_form: { type: "string" },

          // payment
          payment_type: { type: "string" },
          quarter: { type: "string" },
          due_date: { type: "string" },
          amount: { type: ["string", "number"] },
          tax_year: { type: "string" },
          notes: { type: "string" },

          // state payment only
          state: { type: "string" },
          method: { type: "string", enum: ["electronic", "mail"] },
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
      if (
        c?.type === "output_text" &&
        typeof c?.text === "string" &&
        c.text.trim()
      ) {
        return c.text.trim();
      }
    }
  }
  return "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ assistant_message: "Method not allowed", actions: [] });
    return;
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      res.status(500).json({
        assistant_message:
          "Server is missing OPENAI_API_KEY. Set it in Vercel Project Settings → Environment Variables.",
        actions: [],
      });
      return;
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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

    res.status(200).setHeader("Content-Type", "application/json");
    res.send(jsonText);
  } catch (err) {
    console.error(err);
    res.status(500).json({ assistant_message: "Server error", actions: [] });
  }
}

