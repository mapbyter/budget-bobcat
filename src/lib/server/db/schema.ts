import { pgTable, uuid, text, timestamp, primaryKey } from 'drizzle-orm/pg-core';

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const users = pgTable('users', {
	id: uuid('id').primaryKey().defaultRandom(),
	email: text('email').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	createdAt: ts('created_at').notNull().defaultNow()
});

export const budgets = pgTable('budgets', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull().default('My budget'),
	currencySymbol: text('currency_symbol').notNull().default('$'),
	timezone: text('timezone').notNull().default('UTC'),
	createdAt: ts('created_at').notNull().defaultNow()
});

export const budgetMembers = pgTable(
	'budget_members',
	{
		budgetId: uuid('budget_id').notNull().references(() => budgets.id, { onDelete: 'cascade' }),
		userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.budgetId, t.userId] })]
);

export const sessions = pgTable('sessions', {
	id: text('id').primaryKey(),
	userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: ts('expires_at').notNull()
});

import { integer, boolean, type AnyPgColumn } from 'drizzle-orm/pg-core';

export const categoryGroups = pgTable('category_groups', {
	id: uuid('id').primaryKey().defaultRandom(),
	budgetId: uuid('budget_id').notNull().references(() => budgets.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	parentId: uuid('parent_id').references((): AnyPgColumn => categoryGroups.id, { onDelete: 'restrict' }),
	sortOrder: integer('sort_order').notNull().default(0)
});

export const categories = pgTable('categories', {
	id: uuid('id').primaryKey().defaultRandom(),
	budgetId: uuid('budget_id').notNull().references(() => budgets.id, { onDelete: 'cascade' }),
	groupId: uuid('group_id').notNull().references(() => categoryGroups.id, { onDelete: 'restrict' }),
	name: text('name').notNull(),
	type: text('type').notNull().default('spending'), // 'spending' | 'savings'
	rollover: boolean('rollover').notNull().default(true),
	archived: boolean('archived').notNull().default(false),
	goalCents: integer('goal_cents'),
	sortOrder: integer('sort_order').notNull().default(0)
});

export const incomeLines = pgTable('income_lines', {
	id: uuid('id').primaryKey().defaultRandom(),
	budgetId: uuid('budget_id').notNull().references(() => budgets.id, { onDelete: 'cascade' }),
	month: text('month').notNull(), // 'YYYY-MM'
	label: text('label').notNull().default('Take-home pay'),
	amountCents: integer('amount_cents').notNull(),
	recurringRuleId: uuid('recurring_rule_id'),
	occurrenceDate: date('occurrence_date', { mode: 'string' }),
	sourceTransactionId: uuid('source_transaction_id')
});

export const allocations = pgTable(
	'allocations',
	{
		budgetId: uuid('budget_id').notNull().references(() => budgets.id, { onDelete: 'cascade' }),
		categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
		month: text('month').notNull(),
		amountCents: integer('amount_cents').notNull()
	},
	(t) => [primaryKey({ columns: [t.categoryId, t.month] })]
);

import { date } from 'drizzle-orm/pg-core';

export const transactions = pgTable('transactions', {
	id: uuid('id').primaryKey().defaultRandom(),
	budgetId: uuid('budget_id').notNull().references(() => budgets.id, { onDelete: 'cascade' }),
	categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'restrict' }),
	type: text('type').notNull(), // 'expense' | 'refund' | 'deposit' | 'savings_withdrawal'
	amountCents: integer('amount_cents').notNull(), // always positive; the type decides the direction
	date: date('date', { mode: 'string' }).notNull(),
	payee: text('payee').notNull().default(''),
	note: text('note').notNull().default(''),
	recurringRuleId: uuid('recurring_rule_id'),
	occurrenceDate: date('occurrence_date', { mode: 'string' }),
	createdAt: ts('created_at').notNull().defaultNow()
});

export const recurringRules = pgTable('recurring_rules', {
	id: uuid('id').primaryKey().defaultRandom(),
	budgetId: uuid('budget_id').notNull().references(() => budgets.id, { onDelete: 'cascade' }),
	kind: text('kind').notNull(), // 'expense' | 'deposit' | 'income'
	categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'restrict' }),
	label: text('label').notNull().default(''),
	note: text('note').notNull().default(''),
	amountCents: integer('amount_cents').notNull(),
	frequency: text('frequency').notNull(), // 'week' | 'month' | 'year'
	intervalN: integer('interval_n').notNull().default(1),
	startDate: date('start_date', { mode: 'string' }).notNull(),
	endDate: date('end_date', { mode: 'string' }),
	nextIndex: integer('next_index').notNull().default(0),
	nextDate: date('next_date', { mode: 'string' }).notNull(),
	autoPost: boolean('auto_post').notNull().default(true),
	active: boolean('active').notNull().default(true),
	createdAt: ts('created_at').notNull().defaultNow()
});

export const recurringPending = pgTable('recurring_pending', {
	id: uuid('id').primaryKey().defaultRandom(),
	ruleId: uuid('rule_id').notNull().references(() => recurringRules.id, { onDelete: 'cascade' }),
	budgetId: uuid('budget_id').notNull().references(() => budgets.id, { onDelete: 'cascade' }),
	occurrenceDate: date('occurrence_date', { mode: 'string' }).notNull()
});
