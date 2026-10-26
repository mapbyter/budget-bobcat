import { and, asc, eq, gte, lt, lte, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { signedCents } from '$lib/server/activity';
import { budgets, categoryGroups as G, categories as C, allocations as A, transactions as T, incomeLines as I } from '$lib/server/db/schema';
import { addMonths, isMonth } from '$lib/money';
import { todayIn } from '$lib/server/recurring';

const mexpr = sql<string>`to_char(${T.date}, 'YYYY-MM')`;
const sum = (col: unknown) => sql<number>`sum(${col})::int`;

export const load = async ({ url, locals }) => {
	const b = locals.user!.budgetId;
	const param = url.searchParams.get('month') ?? '';
	const month = isMonth(param) ? param : todayIn(locals.user!.timezone).slice(0, 7);
	const count = url.searchParams.get('range') === '6' ? 6 : 12;
	const months = Array.from({ length: count }, (_, i) => addMonths(month, i - (count - 1)));
	const from = `${months[0]}-01`, before = `${addMonths(month, 1)}-01`;
	const inTx = and(eq(T.budgetId, b), gte(T.date, from), lt(T.date, before));

	const [[budget], groups, cats, income, assigned, txByType, spentByCat, savAlloc, savTx, assignedRows] = await Promise.all([
		db.select().from(budgets).where(eq(budgets.id, b)),
		db.select().from(G).where(eq(G.budgetId, b)).orderBy(asc(G.sortOrder), asc(G.name)),
		db.select().from(C).where(eq(C.budgetId, b)).orderBy(asc(C.sortOrder), asc(C.name)),
		db.select({ month: I.month, total: sum(I.amountCents) }).from(I).where(and(eq(I.budgetId, b), gte(I.month, months[0]), lte(I.month, month))).groupBy(I.month),
		db.select({ month: A.month, type: C.type, total: sum(A.amountCents) }).from(A).innerJoin(C, eq(C.id, A.categoryId))
			.where(and(eq(A.budgetId, b), gte(A.month, months[0]), lte(A.month, month))).groupBy(A.month, C.type),
		db.select({ month: mexpr, type: T.type, total: sum(T.amountCents) }).from(T).where(inTx).groupBy(mexpr, T.type),
		db.select({ categoryId: T.categoryId, total: sql<number>`sum(case when ${T.type} = 'expense' then ${T.amountCents} when ${T.type} = 'refund' then -${T.amountCents} else 0 end)::int` })
			.from(T).where(and(eq(T.budgetId, b), gte(T.date, `${month}-01`), lt(T.date, before))).groupBy(T.categoryId),
		db.select({ month: A.month, total: sum(A.amountCents) }).from(A).innerJoin(C, eq(C.id, A.categoryId))
			.where(and(eq(A.budgetId, b), eq(C.type, 'savings'), lte(A.month, month))).groupBy(A.month),
		db.select({ month: mexpr, total: sum(signedCents) }).from(T).innerJoin(C, eq(C.id, T.categoryId))
			.where(and(eq(T.budgetId, b), eq(C.type, 'savings'), lt(T.date, before))).groupBy(mexpr),
		db.select({ categoryId: A.categoryId, total: A.amountCents }).from(A).where(and(eq(A.budgetId, b), eq(A.month, month)))
	]);

	// How this month's assignments split across top-level groups (subgroups and categories roll up into them).
	const groupById = new Map(groups.map((g) => [g.id, g]));
	const topOf = (id: string) => {
		let g = groupById.get(id);
		while (g?.parentId) g = groupById.get(g.parentId);
		return g;
	};
	const groupOfCat = new Map(cats.map((c) => [c.id, c.groupId]));
	const sliceMap = new Map<string, { id: string; name: string; cents: number }>();
	for (const r of assignedRows) {
		const top = r.total > 0 ? topOf(groupOfCat.get(r.categoryId) ?? '') : undefined;
		if (!top) continue;
		const e = sliceMap.get(top.id) ?? { id: top.id, name: top.name, cents: 0 };
		e.cents += r.total;
		sliceMap.set(top.id, e);
	}
	const slices = [...sliceMap.values()].sort((a, b) => b.cents - a.cents);

	const pick = <R extends { month: string }>(rows: R[], f: (r: R) => number = () => 1) =>
		months.map((m) => rows.filter((r) => r.month === m).reduce((s, r) => s + f(r), 0));
	const typeTotal = (t: string) => pick(txByType, (r) => ((r as { type: string }).type === t ? (r as { total: number }).total : 0));

	// savings balance at the end of each month: all assigned + deposits - withdrawals up to that month
	const delta = new Map<string, number>();
	for (const r of [...savAlloc, ...savTx]) delta.set(r.month, (delta.get(r.month) ?? 0) + r.total);
	const savings = months.map((m) => [...delta].filter(([k]) => k <= m).reduce((s, [, v]) => s + v, 0));

	const incomeSeries = pick(income, (r) => r.total);
	const assignedSpending = pick(assigned, (r) => ((r as { type: string }).type === 'spending' ? (r as { total: number }).total : 0));
	const assignedAll = pick(assigned, (r) => r.total);
	const spent = months.map((_, i) => typeTotal('expense')[i] - typeTotal('refund')[i]);
	const deposits = typeTotal('deposit');
	const last = count - 1;

	return {
		currency: budget.currencySymbol, month, count, months, groups, cats, slices,
		spentByCat: Object.fromEntries(spentByCat.map((r) => [r.categoryId, r.total])),
		series: { assignedSpending, spent, savings },
		summary: {
			income: incomeSeries[last], assigned: assignedAll[last], spent: spent[last],
			deposits: deposits[last], depositsRange: deposits.reduce((s, v) => s + v, 0)
		}
	};
};
