create table recurring_rules (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budgets(id) on delete cascade,
  kind text not null check (kind in ('expense','deposit','income')),
  category_id uuid references categories(id) on delete restrict,
  label text not null default '',
  note text not null default '',
  amount_cents integer not null check (amount_cents > 0),
  frequency text not null check (frequency in ('week','month','year')),
  interval_n integer not null default 1 check (interval_n between 1 and 100),
  start_date date not null,
  end_date date,
  next_index integer not null default 0,
  next_date date not null,
  auto_post boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((kind = 'income') = (category_id is null))
);
create index recurring_rules_due_idx on recurring_rules(budget_id, active, next_date);

create table recurring_pending (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references recurring_rules(id) on delete cascade,
  budget_id uuid not null references budgets(id) on delete cascade,
  occurrence_date date not null,
  unique (rule_id, occurrence_date)
);

alter table transactions add column recurring_rule_id uuid references recurring_rules(id) on delete set null, add column occurrence_date date;
alter table income_lines add column recurring_rule_id uuid references recurring_rules(id) on delete set null, add column occurrence_date date;
-- the same occurrence can never be created twice, even if two instances run at once
create unique index transactions_occurrence_uq on transactions(recurring_rule_id, occurrence_date);
create unique index income_occurrence_uq on income_lines(recurring_rule_id, occurrence_date);
