create table category_groups (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budgets(id) on delete cascade,
  name text not null,
  parent_id uuid references category_groups(id) on delete restrict,
  sort_order integer not null default 0
);
create index category_groups_budget_idx on category_groups(budget_id, parent_id);

create table categories (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budgets(id) on delete cascade,
  group_id uuid not null references category_groups(id) on delete restrict,
  name text not null,
  type text not null default 'spending' check (type in ('spending','savings')),
  rollover boolean not null default true,
  archived boolean not null default false,
  goal_cents integer,
  sort_order integer not null default 0
);
create index categories_budget_idx on categories(budget_id, group_id);
