#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";

const USAGE = `
Import a Tax Payment Wizard session JSON export into Postgres.

Usage:
  node scripts/import-session.mjs <path/to/session.json> --user-email you@domain.com
  node scripts/import-session.mjs <path/to/session.json> --dry-run

Env:
  DATABASE_URL (required unless --dry-run)
  TPW_USER_EMAIL (optional fallback for --user-email)
`.trim();

function parseArgs(argv) {
  const args = [...argv];
  const out = {
    file: null,
    userEmail: null,
    batchName: null,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--help" || a === "-h") {
      out.help = true;
      continue;
    }
    if (a === "--dry-run") {
      out.dryRun = true;
      continue;
    }
    if (a === "--user-email") {
      out.userEmail = args[i + 1] || null;
      i++;
      continue;
    }
    if (a === "--batch-name") {
      out.batchName = args[i + 1] || null;
      i++;
      continue;
    }
    if (a === "--file") {
      out.file = args[i + 1] || null;
      i++;
      continue;
    }
    if (!out.file && !String(a).startsWith("--")) {
      out.file = a;
      continue;
    }
  }

  if (!out.userEmail) out.userEmail = process.env.TPW_USER_EMAIL || null;
  return out;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
}

function toIsoDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const mdy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (mdy) {
    const mm = String(mdy[1]).padStart(2, "0");
    const dd = String(mdy[2]).padStart(2, "0");
    const yyyy = String(mdy[3]);
    return `${yyyy}-${mm}-${dd}`;
  }

  const ymd = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (ymd) {
    const yyyy = String(ymd[1]);
    const mm = String(ymd[2]).padStart(2, "0");
    const dd = String(ymd[3]).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const d = new Date(raw.replace(/-/g, "/"));
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function toTimestamptz(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function normalizeQuarter(value) {
  const raw = String(value || "")
    .trim()
    .toUpperCase();
  if (!raw) return null;
  const m = raw.match(/^Q?([1-4])$/);
  if (!m) return null;
  return Number(m[1]);
}

function normalizeAmount(value) {
  if (value === null || value === undefined) return null;
  const raw =
    typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : String(value).trim();
  if (!raw) return null;

  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  if (!/^[-+]?\d*(?:\.\d+)?$/.test(cleaned)) return null;
  return cleaned;
}

function normalizeTaxYear(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n)) return null;
  if (n < 1900 || n > 2100) return null;
  return n;
}

const STATES = [
  ["AL", "Alabama"],
  ["AK", "Alaska"],
  ["AZ", "Arizona"],
  ["AR", "Arkansas"],
  ["CA", "California"],
  ["CO", "Colorado"],
  ["CT", "Connecticut"],
  ["DE", "Delaware"],
  ["FL", "Florida"],
  ["GA", "Georgia"],
  ["HI", "Hawaii"],
  ["ID", "Idaho"],
  ["IL", "Illinois"],
  ["IN", "Indiana"],
  ["IA", "Iowa"],
  ["KS", "Kansas"],
  ["KY", "Kentucky"],
  ["LA", "Louisiana"],
  ["ME", "Maine"],
  ["MD", "Maryland"],
  ["MA", "Massachusetts"],
  ["MI", "Michigan"],
  ["MN", "Minnesota"],
  ["MS", "Mississippi"],
  ["MO", "Missouri"],
  ["MT", "Montana"],
  ["NE", "Nebraska"],
  ["NV", "Nevada"],
  ["NH", "New Hampshire"],
  ["NJ", "New Jersey"],
  ["NM", "New Mexico"],
  ["NY", "New York"],
  ["NC", "North Carolina"],
  ["ND", "North Dakota"],
  ["OH", "Ohio"],
  ["OK", "Oklahoma"],
  ["OR", "Oregon"],
  ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"],
  ["SC", "South Carolina"],
  ["SD", "South Dakota"],
  ["TN", "Tennessee"],
  ["TX", "Texas"],
  ["UT", "Utah"],
  ["VT", "Vermont"],
  ["VA", "Virginia"],
  ["WA", "Washington"],
  ["WV", "West Virginia"],
  ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
  ["DC", "District of Columbia"],
];

const STATE_CODE_TO_NAME = Object.fromEntries(STATES);
const STATE_NAME_TO_CODE = Object.fromEntries(
  STATES.map(([code, name]) => [name.toLowerCase(), code])
);

function normalizeStateCode(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const upper = raw.toUpperCase();
  if (upper.length === 2 && STATE_CODE_TO_NAME[upper]) return upper;

  const nameKey = raw.replace(/\s+/g, " ").trim().toLowerCase();
  return STATE_NAME_TO_CODE[nameKey] || null;
}

function buildImportPlan(session) {
  const createdAt = toTimestamptz(session?.createdAt) || new Date().toISOString();
  const updatedAt = toTimestamptz(session?.updatedAt) || createdAt;

  const batchId = isUuid(session?.id) ? String(session.id) : crypto.randomUUID();
  const batchName = String(session?.name || "").trim() || "Untitled Session";

  const clients = Array.isArray(session?.clients) ? session.clients : [];

  const clientPlans = clients
    .map((c) => {
      const clientCode = String(c?.clientId || "").trim();
      if (!clientCode) return null;

      const data = c?.data && typeof c.data === "object" ? c.data : {};

      const entityType =
        data.entityType === "business" ? "business" : "individual";

      const runPayByDate = toIsoDate(data.paymentDueDate);
      if (!runPayByDate) {
        throw new Error(
          `Client ${clientCode} is missing a valid pay-by date (paymentDueDate).`
        );
      }

      const runSnapshot = {
        clientId: clientCode,
        ...data,
      };

      const payments = [];
      let sortOrder = 0;

      const federal = Array.isArray(data.federalPayments)
        ? data.federalPayments
        : [];
      for (const fp of federal) {
        const paymentType = String(fp?.type || "").trim();
        const dueDate = toIsoDate(fp?.dueDate);
        const amount = normalizeAmount(fp?.amount);
        if (!paymentType || !dueDate || !amount) continue;

        payments.push({
          scope: "federal",
          stateCode: null,
          paymentType,
          quarter: normalizeQuarter(fp?.quarter),
          dueDate,
          amount,
          taxYear: normalizeTaxYear(fp?.taxPeriod),
          notes: String(fp?.description || "").trim() || null,
          method: null,
          sortOrder: sortOrder++,
        });
      }

      const stateGroups = Array.isArray(data.statePayments)
        ? data.statePayments
        : [];
      for (const sg of stateGroups) {
        const stateCode = normalizeStateCode(sg?.stateName);
        if (!stateCode) continue;

        const rows = Array.isArray(sg?.payments) ? sg.payments : [];
        for (const sp of rows) {
          const paymentType = String(sp?.type || "").trim();
          const dueDate = toIsoDate(sp?.dueDate);
          const amount = normalizeAmount(sp?.amount);
          if (!paymentType || !dueDate || !amount) continue;

          const methodRaw = String(sp?.method || "").trim().toLowerCase();
          const method =
            methodRaw === "electronic" || methodRaw === "mail"
              ? methodRaw
              : null;

          payments.push({
            scope: "state",
            stateCode,
            paymentType,
            quarter: normalizeQuarter(sp?.quarter),
            dueDate,
            amount,
            taxYear: normalizeTaxYear(sp?.taxPeriod),
            notes: String(sp?.description || "").trim() || null,
            method,
            sortOrder: sortOrder++,
          });
        }
      }

      return {
        clientCode,
        addresseeName: String(data.addresseeName || "").trim(),
        entityType,
        businessType: String(data.businessType || "").trim() || null,
        entityName: String(data.entityName || "").trim() || null,
        entityId: String(data.entityId || "").trim() || null,
        caCorpForm: String(data.caCorpForm || "").trim() || null,
        run: {
          payByDate: runPayByDate,
          senderName: String(data.senderName || "").trim() || null,
          showDueDateReminder: Boolean(data.showDueDateReminder ?? true),
          showDisclaimers: Boolean(data.showDisclaimers ?? true),
          snapshotJson: runSnapshot,
          createdAt,
          updatedAt,
        },
        payments,
      };
    })
    .filter(Boolean);

  return {
    batch: {
      id: batchId,
      name: batchName,
      createdAt,
      updatedAt,
      snapshotJson: session,
    },
    clients: clientPlans,
  };
}

function formatCount(n, label) {
  return `${n} ${label}${n === 1 ? "" : "s"}`;
}

function summarizePlan(plan) {
  const clientCount = plan.clients.length;
  const paymentCount = plan.clients.reduce((sum, c) => sum + c.payments.length, 0);
  return { clientCount, paymentCount };
}

function wantsSsl(databaseUrl) {
  try {
    const u = new URL(databaseUrl);
    if (u.searchParams.get("sslmode") === "require") return true;
    return !["localhost", "127.0.0.1"].includes(u.hostname);
  } catch {
    return false;
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(USAGE);
    return;
  }
  if (!opts.file) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  const filePath = path.resolve(opts.file);
  const raw = await fs.readFile(filePath, "utf8");
  const session = JSON.parse(raw);

  if (!session || typeof session !== "object") {
    throw new Error("Session JSON is not an object.");
  }

  const plan = buildImportPlan(session);
  if (opts.batchName) plan.batch.name = String(opts.batchName).trim() || plan.batch.name;

  const { clientCount, paymentCount } = summarizePlan(plan);

  if (opts.dryRun) {
    console.log(`Dry run: ${path.basename(filePath)}`);
    console.log(`Batch: ${plan.batch.name} (${plan.batch.id})`);
    console.log(`- ${formatCount(clientCount, "client")}`);
    console.log(`- ${formatCount(paymentCount, "payment")}`);
    return;
  }

  if (!opts.userEmail) {
    console.error("Missing --user-email (or TPW_USER_EMAIL).");
    process.exitCode = 1;
    return;
  }

  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) {
    console.error("Missing DATABASE_URL.");
    process.exitCode = 1;
    return;
  }

  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: wantsSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
  });

  const db = await pool.connect();
  try {
    await db.query("begin");

    const userEmail = String(opts.userEmail).trim().toLowerCase();
    const userRes = await db.query(
      `
      insert into users (email)
      values ($1)
      on conflict (email) do update set updated_at = now()
      returning id
      `,
      [userEmail]
    );
    const userId = userRes.rows[0]?.id;
    if (!userId) throw new Error("Could not create/find user.");

    const batchRes = await db.query(
      `
      insert into batches (id, owner_user_id, name, snapshot_json, created_at, updated_at)
      values ($1, $2, $3, $4::jsonb, $5::timestamptz, $6::timestamptz)
      on conflict (id) do update set
        owner_user_id = excluded.owner_user_id,
        name = excluded.name,
        snapshot_json = excluded.snapshot_json,
        updated_at = excluded.updated_at
      returning id
      `,
      [
        plan.batch.id,
        userId,
        plan.batch.name,
        JSON.stringify(plan.batch.snapshotJson),
        plan.batch.createdAt,
        plan.batch.updatedAt,
      ]
    );
    const batchId = batchRes.rows[0]?.id;
    if (!batchId) throw new Error("Could not create batch.");

    const statesNeeded = new Set();
    for (const c of plan.clients) {
      for (const p of c.payments) {
        if (p.scope === "state" && p.stateCode) statesNeeded.add(p.stateCode);
      }
    }
    for (const code of statesNeeded) {
      const name = STATE_CODE_TO_NAME[code];
      if (!name) continue;
      await db.query(
        `insert into states (code, name) values ($1, $2) on conflict (code) do nothing`,
        [code, name]
      );
    }

    for (const c of plan.clients) {
      const clientRes = await db.query(
        `
        insert into clients (
          owner_user_id,
          client_code,
          addressee_name,
          entity_type,
          business_type,
          entity_name,
          entity_id,
          ca_corp_form
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8)
        on conflict (owner_user_id, client_code) do update set
          addressee_name = coalesce(nullif(excluded.addressee_name, ''), clients.addressee_name),
          entity_type = excluded.entity_type,
          business_type = coalesce(excluded.business_type, clients.business_type),
          entity_name = coalesce(excluded.entity_name, clients.entity_name),
          entity_id = coalesce(excluded.entity_id, clients.entity_id),
          ca_corp_form = coalesce(excluded.ca_corp_form, clients.ca_corp_form)
        returning id
        `,
        [
          userId,
          c.clientCode,
          c.addresseeName,
          c.entityType,
          c.businessType,
          c.entityName,
          c.entityId,
          c.caCorpForm,
        ]
      );
      const clientId = clientRes.rows[0]?.id;
      if (!clientId) throw new Error(`Could not upsert client ${c.clientCode}.`);

      const runId = crypto.randomUUID();
      await db.query(
        `
        insert into runs (
          id,
          owner_user_id,
          client_id,
          batch_id,
          pay_by_date,
          sender_name,
          show_due_date_reminder,
          show_disclaimers,
          snapshot_json,
          created_at,
          updated_at
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::timestamptz,$11::timestamptz)
        `,
        [
          runId,
          userId,
          clientId,
          batchId,
          c.run.payByDate,
          c.run.senderName,
          c.run.showDueDateReminder,
          c.run.showDisclaimers,
          JSON.stringify(c.run.snapshotJson),
          c.run.createdAt,
          c.run.updatedAt,
        ]
      );

      for (const p of c.payments) {
        await db.query(
          `
          insert into payments (
            run_id,
            scope,
            state_code,
            payment_type,
            quarter,
            due_date,
            amount,
            tax_year,
            notes,
            method,
            sort_order
          )
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          `,
          [
            runId,
            p.scope,
            p.stateCode,
            p.paymentType,
            p.quarter,
            p.dueDate,
            p.amount,
            p.taxYear,
            p.notes,
            p.method,
            p.sortOrder,
          ]
        );
      }
    }

    await db.query("commit");
    console.log(
      `Imported batch "${plan.batch.name}" (${plan.batch.id}) with ${formatCount(
        clientCount,
        "client"
      )} and ${formatCount(paymentCount, "payment")}.`
    );
  } catch (err) {
    await db.query("rollback");
    throw err;
  } finally {
    db.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err?.stack || err?.message || String(err));
  process.exitCode = 1;
});
