import { error, fail } from '@sveltejs/kit';
import { and, asc, eq, inArray, isNull, lt, lte, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { budgets, categoryGroups as G, categories as C, allocations as A, incomeLines as I, transactions as T, recurringRules as R } from '$lib/server/db/schema';
import { signedCents } from '$lib/server/activity';
import { addMonths, isMonth, parseCents } from '$lib/money';
import { firstIndexOnOrAfter, occurrence } from '$lib/recurrence';
import { categoryTotals, type MonthRow } from '$lib/budget-math';

export const load = async ({ params, locals, cookies }) => {
	const m = params.month;
	if (!isMonth(m)) error(404, 'Month not found');
	const b = locals.user!.budgetId;
	const prev = addMonths(m, -1);

	const [[budget], groups, cats, allocs, incomeRows, activity, rules] = await Promise.all([
		db.select().from(budgets).where(eq(budgets.id, b)),
		db.select().from(G).where(eq(G.budgetId, b)).orderBy(asc(G.sortOrder), asc(G.name)),
		db.select().from(C).where(eq(C.budgetId, b)).orderBy(asc(C.sortOrder), asc(C.name)),
		db.select().from(A).where(and(eq(A.budgetId, b), lte(A.month, m))),
		db.select().from(I).where(and(eq(I.budgetId, b), inArray(I.month, [m, prev]))),
		db
			.select({ categoryId: T.categoryId, month: sql<string>`to_char(${T.date}, 'YYYY-MM')`, total: sql<number>`sum(${signedCents})::int`, spent: sql<number>`sum(case when ${T.type} = 'expense' then ${T.amountCents} when ${T.type} = 'refund' then -${T.amountCents} else 0 end)::int` })
			.from(T)
			.where(and(eq(T.budgetId, b), lt(T.date, `${addMonths(m, 1)}-01`)))
			.groupBy(T.categoryId, sql`to_char(${T.date}, 'YYYY-MM')`),
		db.select().from(R).where(and(eq(R.budgetId, b), eq(R.active, true), eq(R.kind, 'expense')))
	]);

	// Informational only: recurring expenses still to come this month, per category.
	const scheduled: Record<string, number> = {};
	const monthStart = `${m}-01`, monthEnd = `${addMonths(m, 1)}-01`;
	for (const r of rules) {
		let k = Math.max(r.nextIndex, firstIndexOnOrAfter(r, monthStart));
		for (let i = 0; i < 100; i++, k++) {
			const d = occurrence(r, k);
			if (d >= monthEnd || (r.endDate && d > r.endDate)) break;
			scheduled[r.categoryId!] = (scheduled[r.categoryId!] ?? 0) + r.amountCents;
		}
	}

	const rows: MonthRow[] = [
		...allocs.map((a) => ({ categoryId: a.categoryId, month: a.month, assigned: a.amountCents, activity: 0 })),
		...activity.map((a) => ({ categoryId: a.categoryId, month: a.month, assigned: 0, activity: a.total }))
	];
	const totals = categoryTotals(cats, rows, m);
	const spent: Record<string, number> = {};
	for (const a of activity) if (a.month === m) spent[a.categoryId] = a.spent;
	const visible = cats.filter((c) => !c.archived || totals[c.id].assigned !== 0 || totals[c.id].available !== 0 || totals[c.id].activity !== 0);

	// Groups the person collapsed on this device (kept in a cookie so the server can draw them closed with no flicker).
	const known = new Set(groups.map((g) => g.id));
	const collapsed = (cookies.get('budget_collapsed') ?? '').split('.').filter((id) => known.has(id));

	const income = incomeRows.filter((r) => r.month === m);
	return {
		month: m,
		prev,
		next: addMonths(m, 1),
		currency: budget.currencySymbol,
		groups,
		cats: visible,
		totals,
		scheduled,
		collapsed,
		spent,
		income,
		incomeTotal: income.reduce((s, r) => s + r.amountCents, 0),
		assigned: allocs.filter((a) => a.month === m).reduce((s, a) => s + a.amountCents, 0),
		canCopy:
			!allocs.some((a) => a.month === m) &&
			(incomeRows.some((r) => r.month === prev && !r.recurringRuleId && !r.sourceTransactionId) || allocs.some((a) => a.month === prev))
	};
};

const money = (f: FormData, key: string) => {
	const c = parseCents(f.get(key));
	return c === null || c < 0 ? null : c;
};

export const actions = {
	assign: async ({ params, request, locals }) => {
		const b = locals.user!.budgetId;
		const f = await request.formData();
		const cents = money(f, 'amount');
		if (!isMonth(params.month) || cents === null) return fail(400, { error: 'Enter a valid amount (0 or more).' });
		const [cat] = await db.select({ id: C.id }).from(C).where(and(eq(C.id, String(f.get('categoryId'))), eq(C.budgetId, b)));
		if (!cat) return fail(400, { error: 'Category not found.' });
		await db
			.insert(A)
			.values({ budgetId: b, categoryId: cat.id, month: params.month, amountCents: cents })
			.onConflictDoUpdate({ target: [A.categoryId, A.month], set: { amountCents: cents } });
	},

	addIncome: async ({ params, request, locals }) => {
		const f = await request.formData();
		const cents = money(f, 'amount');
		const label = String(f.get('label') ?? '').trim().slice(0, 60) || 'Take-home pay';
		if (!isMonth(params.month) || cents === null) return fail(400, { error: 'Enter a valid income amount.' });
		await db.insert(I).values({ budgetId: locals.user!.budgetId, month: params.month, label, amountCents: cents });
	},

	saveIncome: async ({ request, locals }) => {
		const f = await request.formData();
		const cents = money(f, 'amount');
		const label = String(f.get('label') ?? '').trim().slice(0, 60) || 'Take-home pay';
		if (cents === null) return fail(400, { error: 'Enter a valid income amount.' });
		await db.update(I).set({ label, amountCents: cents }).where(and(eq(I.id, String(f.get('id'))), eq(I.budgetId, locals.user!.budgetId)));
	},

	removeIncome: async ({ request, locals }) => {
		const f = await request.formData();
		await db.delete(I).where(and(eq(I.id, String(f.get('id'))), eq(I.budgetId, locals.user!.budgetId)));
	},

	copyPrev: async ({ params, locals }) => {
		const b = locals.user!.budgetId;
		const m = params.month;
		if (!isMonth(m)) return fail(400, { error: 'Invalid month.' });
		const prev = addMonths(m, -1);
		await db.transaction(async (tx) => {
			const [hasIncome] = await tx.select({ id: I.id }).from(I).where(and(eq(I.budgetId, b), eq(I.month, m))).limit(1);
			if (!hasIncome) {
				const lines = await tx.select().from(I).where(and(eq(I.budgetId, b), eq(I.month, prev), isNull(I.recurringRuleId), isNull(I.sourceTransactionId)));
				if (lines.length) await tx.insert(I).values(lines.map((l) => ({ budgetId: b, month: m, label: l.label, amountCents: l.amountCents })));
			}
			const prevAllocs = await tx.select().from(A).where(and(eq(A.budgetId, b), eq(A.month, prev)));
			if (prevAllocs.length)
				await tx.insert(A).values(prevAllocs.map((a) => ({ budgetId: b, categoryId: a.categoryId, month: m, amountCents: a.amountCents }))).onConflictDoNothing();
		});
	}
};
