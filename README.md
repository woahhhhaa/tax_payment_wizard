# Tax Payment Wizard SaaS (Next.js)

This repo is now the foundation for a commercial SaaS tax payment workflow. The legacy wizard UI still lives in `public/tax_payment_wizard_new.html`, but all persistence and authentication are now server-backed.

## Local setup

1. Start Postgres:

```bash
docker compose up -d
```

2. Install dependencies:

```bash
npm install
```

3. Configure env vars:

```bash
cp .env.example .env
```

4. Run migrations + seed states:

```bash
npm run prisma:migrate
npm run prisma:seed
```

5. Start the dev server:

```bash
npm run dev
```

## Required env vars

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `NEXTAUTH_SECRET` | Secret for Auth.js JWT signing |
| `OPENAI_API_KEY` | Server-side key for `/api/assistant` |
| `OPENAI_MODEL` | Defaults to `gpt-4.1-mini` |
| `STRIPE_SECRET_KEY` | Placeholder for billing scaffolding |
| `STRIPE_WEBHOOK_SECRET` | Placeholder for billing scaffolding |

## Authentication (Credentials MVP)

Auth uses Auth.js (NextAuth) with a Credentials provider. Users register with email + password, and passwords are stored in Postgres as bcrypt hashes. This is a local-first setup (no external auth required).

### Upgrade path

When ready, add OAuth or magic-link providers in `lib/auth.ts` and configure the appropriate env vars (e.g. Google, Microsoft, or email providers). The credentials flow can remain enabled for internal admins.

## App routes

| Route | Description |
| --- | --- |
| `/` | Landing page |
| `/login` | Log in |
| `/register` | Register |
| `/app` | Minimal dashboard |
| `/wizard` | Legacy wizard UI (requires auth) |

The wizard is still served as a static HTML file. It now loads and autosaves sessions via `/api/batches/current`.

## Deployment (Vercel)

1. Add the env vars listed above in your Vercel project settings.
2. Use the standard Next.js build (`npm run build`) and start commands.
3. Run migrations against your managed Postgres database (e.g. Vercel Postgres, Supabase, RDS).

## Prisma scripts

```bash
npm run prisma:migrate
npm run prisma:generate
npm run prisma:studio
npm run prisma:seed
```
