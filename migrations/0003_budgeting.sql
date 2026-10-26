create table income_lines (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budgets(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  label text not null default 'Take-home pay',
  amount_cents integer not null check (amount_cents >= 0)
);
create index income_lines_idx on income_lines(budget_id, month);

create table allocations (
  budget_id uuid not null references budgets(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  amount_cents integer not null check (amount_cents >= 0),
  primary key (category_id, month)
);
create index allocations_budget_idx on allocations(budget_id, month);
