import { beforeAll, describe, expect, it } from 'vitest';
import { inject } from 'vitest';

type Mods = {
	db: typeof import('../../src/lib/server/db').db;
	s: typeof import('../../src/lib/server/db/schema');
	runDue: typeof import('../../src/lib/server/recurring').runDue;
	orm: typeof import('drizzle-orm');
};
let m: Mods;

beforeAll(async () => {
	process.env.DATABASE_URL = inject('dbUrls').it;
	const [{ db }, s, { runDue }, orm] = await Promise.all([
		import('../../src/lib/server/db'),
		import('../../src/lib/server/db/schema'),
		import('../../src/lib/server/recurring'),
		import('drizzle-orm')
	]);
	m = { db, s, runDue, orm };
});

// dates relative to today (the test budgets use UTC)
const day = (offset: number) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

async function setup() {
	const { db, s } = m;
	const [b] = await db.insert(s.budgets).values({ timezone: 'UTC' }).returning({ id: s.budgets.id });
	const [g] = await db.insert(s.categoryGroups).values({ budgetId: b.id, name: 'Expenses' }).returning({ id: s.categoryGroups.id });
	const [c] = await db.insert(s.categories).values({ budgetId: b.id, groupId: g.id, name: 'Gym' }).returning({ id: s.categories.id });
	return { budgetId: b.id, categoryId: c.id };
}

async function rule(ctx: { budgetId: string; categoryId: string }, over: Partial<typeof m.s.recurringRules.$inferInsert> = {}) {
	const start = (over.startDate as string) ?? day(-21);
	const [r] = await m.db.insert(m.s.recurringRules).values({
		budgetId: ctx.budgetId, kind: 'expense', categoryId: ctx.categoryId, label: 'Gym', amountCents: 2500,
		frequency: 'week', intervalN: 1, startDate: start, nextIndex: 0, nextDate: start, autoPost: true, active: true, ...over
	}).returning();
	return r;
}

const txns = (budgetId: string) =>
	m.db.select().from(m.s.transactions).where(m.orm.eq(m.s.transactions.budgetId, budgetId)).orderBy(m.orm.asc(m.s.transactions.date));

describe('recurring engine (real Postgres)', () => {
	it('catches up every missed occurrence, backdated to its own date', async () => {
		const ctx = await setup();
		const r = await rule(ctx); // weekly, started 21 days ago and never run
		await m.runDue(ctx.budgetId);
		const t = await txns(ctx.budgetId);
		expect(t.map((x) => x.date)).toEqual([day(-21), day(-14), day(-7), day(0)]);
		expect(t.every((x) => x.type === 'expense' && x.amountCents === 2500 && x.payee === 'Gym' && x.recurringRuleId === r.id)).toBe(true);
		const [after] = await m.db.select().from(m.s.recurringRules).where(m.orm.eq(m.s.recurringRules.id, r.id));
		expect(after.nextIndex).toBe(4);
		expect(after.nextDate).toBe(day(7));
	});

	it('running again creates nothing new', async () => {
		const ctx = await setup();
		await rule(ctx);
		await m.runDue(ctx.budgetId);
		await m.runDue(ctx.budgetId);
		expect(await txns(ctx.budgetId)).toHaveLength(4);
	});

	it('cannot duplicate an occurrence even if a stale run replays old dates', async () => {
		const ctx = await setup();
		const r = await rule(ctx);
		await m.runDue(ctx.budgetId);
		await m.db.update(m.s.recurringRules).set({ nextIndex: 0, nextDate: day(-21) }).where(m.orm.eq(m.s.recurringRules.id, r.id));
		await m.runDue(ctx.budgetId);
		expect(await txns(ctx.budgetId)).toHaveLength(4);
	});

	it('is safe when two runs start at the same moment', async () => {
		const ctx = await setup();
		await rule(ctx);
		await Promise.all([m.runDue(ctx.budgetId), m.runDue(ctx.budgetId), m.runDue(ctx.budgetId)]);
		expect(await txns(ctx.budgetId)).toHaveLength(4);
	});

	it('does not bring back an occurrence the person deleted', async () => {
		const ctx = await setup();
		await rule(ctx);
		await m.runDue(ctx.budgetId);
		const [first] = await txns(ctx.budgetId);
		await m.db.delete(m.s.transactions).where(m.orm.eq(m.s.transactions.id, first.id));
		await m.runDue(ctx.budgetId);
		expect(await txns(ctx.budgetId)).toHaveLength(3);
	});

	it('queues confirm-first rules as pending, with no transactions and no duplicates', async () => {
		const ctx = await setup();
		await rule(ctx, { autoPost: false });
		await m.runDue(ctx.budgetId);
		await m.runDue(ctx.budgetId);
		expect(await txns(ctx.budgetId)).toHaveLength(0);
		const pending = await m.db.select().from(m.s.recurringPending).where(m.orm.eq(m.s.recurringPending.budgetId, ctx.budgetId));
		expect(pending.map((p) => p.occurrenceDate).sort()).toEqual([day(-21), day(-14), day(-7), day(0)]);
	});

	it('turns recurring income into income lines in the right month', async () => {
		const ctx = await setup();
		await rule(ctx, { kind: 'income', categoryId: null, label: 'Paycheck', amountCents: 150000, startDate: day(-7), nextDate: day(-7) });
		await m.runDue(ctx.budgetId);
		const lines = await m.db.select().from(m.s.incomeLines).where(m.orm.eq(m.s.incomeLines.budgetId, ctx.budgetId));
		expect(lines).toHaveLength(2);
		expect(lines.map((l) => l.occurrenceDate).sort()).toEqual([day(-7), day(0)]);
		for (const l of lines) expect(l.month).toBe(l.occurrenceDate!.slice(0, 7));
		expect(lines.every((l) => l.label === 'Paycheck' && l.amountCents === 150000)).toBe(true);
	});

	it('stops at the end date', async () => {
		const ctx = await setup();
		await rule(ctx, { endDate: day(-8) });
		await m.runDue(ctx.budgetId);
		expect((await txns(ctx.budgetId)).map((x) => x.date)).toEqual([day(-21), day(-14)]);
	});

	it('ignores paused rules', async () => {
		const ctx = await setup();
		await rule(ctx, { active: false });
		await m.runDue(ctx.budgetId);
		expect(await txns(ctx.budgetId)).toHaveLength(0);
	});

	it('keeps month-end rules on the last day of short months across years', async () => {
		const ctx = await setup();
		await rule(ctx, { frequency: 'month', startDate: '2024-01-31', nextDate: '2024-01-31' });
		await m.runDue(ctx.budgetId);
		const dates = (await txns(ctx.budgetId)).map((x) => x.date);
		expect(dates.slice(0, 5)).toEqual(['2024-01-31', '2024-02-29', '2024-03-31', '2024-04-30', '2024-05-31']);
		expect(dates).toContain('2025-02-28');
		expect(new Set(dates).size).toBe(dates.length);
		expect(dates.at(-1)! <= day(0)).toBe(true);
	});

	it('leaves other budgets alone', async () => {
		const a = await setup(), b = await setup();
		await rule(a);
		await m.runDue(b.budgetId);
		expect(await txns(a.budgetId)).toHaveLength(0);
	});
});
