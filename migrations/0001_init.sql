create extension if not exists pgcrypto;

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table budgets (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My budget',
  currency_symbol text not null default '$',
  timezone text not null default 'UTC',
  created_at timestamptz not null default now()
);

create table budget_members (
  budget_id uuid not null references budgets(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  primary key (budget_id, user_id)
);

create table sessions (
  id text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null
);
create index sessions_user_idx on sessions(user_id);
