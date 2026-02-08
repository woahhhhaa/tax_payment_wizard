# Tax Payment Wizard SaaS (Next.js)

This repo is the foundation for a commercial SaaS tax payment workflow. The primary planning UI is now the in-app Client Plans workspace, and persistence/authentication are server-backed.

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
| `NEXTAUTH_URL` | Public app URL used by auth callbacks |
| `OPENAI_API_KEY` | Server-side key for `/api/assistant` |
| `OPENAI_MODEL` | Defaults to `gpt-4.1-mini` |
| `STRIPE_SECRET_KEY` | Placeholder for billing scaffolding |
| `STRIPE_WEBHOOK_SECRET` | Placeholder for billing scaffolding |
| `EMAIL_TRANSPORT` | `smtp` (default) or `console` for local-only logging |
| `SMTP_HOST` / `SMTP_FROM` | Required when `EMAIL_TRANSPORT=smtp` (default) |
| `CRON_SECRET` | Required in production for `/api/notifications/process` |

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
| `/plans` | Client Plans workspace (requires auth) |
| `/wizard` | Legacy redirect to `/plans` |
| `/api/health` | Runtime readiness check (DB/auth/email) |

The legacy static wizard is still available at `/tax_payment_wizard_new.html` for migration/debugging.

## Deployment (Vercel)

1. Add the env vars listed above in your Vercel project settings.
2. Use the standard Next.js build (`npm run build`) and start commands.
3. Run migrations against your managed Postgres database (e.g. Vercel Postgres, Supabase, RDS).
4. If you are not ready to configure SMTP yet, set `EMAIL_TRANSPORT=console` to prevent email routes from failing.
5. Set `CRON_SECRET` and configure your cron caller to send `x-cron-secret`.

## Prisma scripts

```bash
npm run prisma:migrate
npm run prisma:generate
npm run prisma:studio
npm run prisma:seed
```
