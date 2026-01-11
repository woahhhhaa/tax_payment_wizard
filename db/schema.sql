-- Tax Payment Wizard: Postgres schema (hybrid normalized + JSON snapshots)
-- LEGACY: Prisma schema in prisma/schema.prisma is the source of truth.

create extension if not exists pgcrypto;

-- STATES (reference)
create table if not exists states (
  code char(2) primary key,
  name text not null unique
);

-- USERS
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text,
  default_state_code char(2) references states(code),
  default_sender_name text,
  default_show_due_date_reminder boolean not null default true,
  default_show_disclaimers boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- CLIENTS (persistent client library, scoped to a user)
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references users(id) on delete cascade,

  client_code text not null,
  addressee_name text not null,

  entity_type text not null check (entity_type in ('individual', 'business')),
  business_type text check (business_type in ('ccorp','scorp','partnership','llc')),
  entity_name text,
  entity_id text,
  ca_corp_form text,

  default_state_code char(2) references states(code),

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (owner_user_id, client_code)
);

-- BATCHES (aka browser sessions)
create table if not exists batches (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references users(id) on delete cascade,
  name text not null,
  snapshot_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RUNS (aka instruction sets / wizard runs)
create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references users(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  batch_id uuid references batches(id) on delete set null,

  pay_by_date date not null,
  sender_name text,
  show_due_date_reminder boolean not null default true,
  show_disclaimers boolean not null default true,

  custom_greeting text,
  personal_note text,

  generated_html text,
  edited_html text,

  snapshot_json jsonb,

  status text not null default 'draft'
    check (status in ('draft','finalized','sent','archived')),
  finalized_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- PAYMENTS (normalized line items)
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,

  scope text not null check (scope in ('federal','state')),
  state_code char(2) references states(code),

  payment_type text not null,
  quarter smallint check (quarter between 1 and 4),
  due_date date not null,
  amount numeric(12,2) not null,
  tax_year int,
  notes text,
  method text,
  sort_order int not null default 0,

  created_at timestamptz not null default now(),

  constraint payments_state_code_required check (
    (scope = 'state' and state_code is not null and btrim(state_code) <> '')
    or
    (scope = 'federal' and state_code is null)
  )
);

-- UPDATED_AT trigger helper
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_users_updated_at on users;
create trigger trg_users_updated_at
before update on users
for each row execute function set_updated_at();

drop trigger if exists trg_clients_updated_at on clients;
create trigger trg_clients_updated_at
before update on clients
for each row execute function set_updated_at();

drop trigger if exists trg_batches_updated_at on batches;
create trigger trg_batches_updated_at
before update on batches
for each row execute function set_updated_at();

drop trigger if exists trg_runs_updated_at on runs;
create trigger trg_runs_updated_at
before update on runs
for each row execute function set_updated_at();

-- Helpful indexes
create index if not exists idx_clients_owner on clients(owner_user_id);
create index if not exists idx_runs_owner on runs(owner_user_id);
create index if not exists idx_runs_client on runs(client_id);
create index if not exists idx_runs_batch on runs(batch_id);
create index if not exists idx_payments_run on payments(run_id);
create index if not exists idx_payments_due_date on payments(due_date);
create index if not exists idx_payments_state_code on payments(state_code);
