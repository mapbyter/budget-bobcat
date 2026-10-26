create table transactions (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budgets(id) on delete cascade,
  category_id uuid not null references categories(id) on delete restrict,
  type text not null check (type in ('expense','refund','deposit','savings_withdrawal')),
  amount_cents integer not null check (amount_cents > 0),
  date date not null,
  payee text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);
create index transactions_budget_date_idx on transactions(budget_id, date desc);
create index transactions_category_idx on transactions(category_id, date);
