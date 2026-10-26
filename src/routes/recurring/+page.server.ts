import { fail } from '@sveltejs/kit';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { budgets, categoryGroups as G, categories as C, recurringRules as R } from '$lib/server/db/schema';
import { parseCents } from '$lib/money';
import { firstIndexOnOrAfter, occurrence, type Frequency } from '$lib/recurrence';
import { runDue, todayIn } from '$lib/server/recurring';

export const load = async ({ locals }) => {
	const b = locals.user!.budgetId;
	const [[budget], groups, cats, rules] = await Promise.all([
		db.select().from(budgets).where(eq(budgets.id, b)),
		db.select().from(G).where(eq(G.budgetId, b)).orderBy(asc(G.sortOrder), asc(G.name)),
		db.select().from(C).where(eq(C.budgetId, b)).orderBy(asc(C.sortOrder), asc(C.name)),
		db.select().from(R).where(eq(R.budgetId, b)).orderBy(desc(R.active), asc(R.nextDate))
	]);
	return { currency: budget.currencySymbol, today: todayIn(budget.timezone), timezone: budget.timezone, groups, cats, rules };
};

const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s).toISOString().slice(0, 10) === s;

async function parse(f: FormData, b: string, kind: string) {
	const cents = parseCents(f.get('amount'));
	const frequency = String(f.get('frequency'));
	const intervalN = Number(f.get('intervalN'));
	const startDate = String(f.get('startDate'));
	const endDate = String(f.get('endDate') ?? '') || null;
	if (!['expense', 'deposit', 'income'].includes(kind)) return { error: 'Pick a type.' };
	if (!cents || cents <= 0) return { error: 'Enter an amount greater than zero.' };
	if (!['week', 'month', 'year'].includes(frequency)) return { error: 'Pick how often it repeats.' };
	if (!Number.isInteger(intervalN) || intervalN < 1 || intervalN > 100) return { error: 'Repeat interval must be between 1 and 100.' };
	if (!validDate(startDate)) return { error: 'Enter a valid start date.' };
	if (endDate && (!validDate(endDate) || endDate < startDate)) return { error: 'The end date must be on or after the start date.' };
	let categoryId: string | null = null;
	if (kind !== 'income') {
		const [cat] = await db.select({ id: C.id }).from(C).where(and(eq(C.id, String(f.get('categoryId'))), eq(C.budgetId, b)));
		if (!cat) return { error: 'Pick a category.' };
		categoryId = cat.id;
	}
	return {
		values: {
			categoryId, amountCents: cents, frequency, intervalN, startDate, endDate,
			label: String(f.get('label') ?? '').trim().slice(0, 80),
			note: String(f.get('note') ?? '').trim().slice(0, 200),
			autoPost: f.get('autoPost') === 'on'
		}
	};
}

export const actions = {
	create: async ({ request, locals }) => {
		const b = locals.user!.budgetId;
		const f = await request.formData();
		const kind = String(f.get('kind'));
		const p = await parse(f, b, kind);
		if (!p.values) return fail(400, { error: p.error });
		// A start date in the past is not back-filled: the first occurrence is the first one on or after today.
		const sch = { frequency: p.values.frequency as Frequency, intervalN: p.values.intervalN, startDate: p.values.startDate };
		const idx = firstIndexOnOrAfter(sch, todayIn(locals.user!.timezone));
		await db.insert(R).values({ budgetId: b, kind, ...p.values, nextIndex: idx, nextDate: occurrence(sch, idx) });
		await runDue(b);
	},

	update: async ({ request, locals }) => {
		const b = locals.user!.budgetId;
		const f = await request.formData();
		const [r] = await db.select().from(R).where(and(eq(R.id, String(f.get('id'))), eq(R.budgetId, b)));
		if (!r) return fail(400, { error: 'Rule not found.' });
		const p = await parse(f, b, r.kind);
		if (!p.values) return fail(400, { error: p.error });
		const v = p.values;
		const changed = v.frequency !== r.frequency || v.intervalN !== r.intervalN || v.startDate !== r.startDate;
		const sch = { frequency: v.frequency as Frequency, intervalN: v.intervalN, startDate: v.startDate };
		const idx = changed ? firstIndexOnOrAfter(sch, todayIn(locals.user!.timezone)) : r.nextIndex;
		// Only future occurrences change; anything already posted stays as it is.
		await db.update(R).set({ ...v, nextIndex: idx, nextDate: occurrence(sch, idx) }).where(eq(R.id, r.id));
		await runDue(b);
	},

	setActive: async ({ request, locals }) => {
		const b = locals.user!.budgetId;
		const f = await request.formData();
		const [r] = await db.select().from(R).where(and(eq(R.id, String(f.get('id'))), eq(R.budgetId, b)));
		if (!r) return;
		if (f.get('value') === 'true') {
			// Resuming never back-fills the paused period.
			const idx = firstIndexOnOrAfter(r, todayIn(locals.user!.timezone));
			await db.update(R).set({ active: true, nextIndex: idx, nextDate: occurrence(r, idx) }).where(eq(R.id, r.id));
			await runDue(b);
		} else await db.update(R).set({ active: false }).where(eq(R.id, r.id));
	},

	skip: async ({ request, locals }) => {
		const [r] = await db.select().from(R).where(and(eq(R.id, String((await request.formData()).get('id'))), eq(R.budgetId, locals.user!.budgetId)));
		if (r) await db.update(R).set({ nextIndex: r.nextIndex + 1, nextDate: occurrence(r, r.nextIndex + 1) }).where(eq(R.id, r.id));
	},

	remove: async ({ request, locals }) => {
		await db.delete(R).where(and(eq(R.id, String((await request.formData()).get('id'))), eq(R.budgetId, locals.user!.budgetId)));
	}
};
