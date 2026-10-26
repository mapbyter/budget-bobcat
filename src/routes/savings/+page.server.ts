import { fail } from '@sveltejs/kit';
import { and, asc, desc, eq, inArray, lt, lte, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { signedCents } from '$lib/server/activity';
import { budgets, categoryGroups as G, categories as C, allocations as A, transactions as T, incomeLines as I } from '$lib/server/db/schema';
import { addMonths, formatMoney, parseCents } from '$lib/money';
import { categoryTotals, type MonthRow } from '$lib/budget-math';
import { todayIn } from '$lib/server/recurring';

type Cat = typeof C.$inferSelect;

/** Savings balances as of a month: everything assigned plus deposits, minus withdrawals, never reset by rollover. */
async function totalsFor(b: string, cats: Cat[], month: string) {
	const ids = cats.map((c) => c.id);
	if (!ids.length) return {};
	const [allocs, act] = await Promise.all([
		db.select().from(A).where(and(eq(A.budgetId, b), inArray(A.categoryId, ids), lte(A.month, month))),
		db
			.select({ categoryId: T.categoryId, month: sql<string>`to_char(${T.date}, 'YYYY-MM')`, total: sql<number>`sum(${signedCents})::int` })
			.from(T)
			.where(and(eq(T.budgetId, b), inArray(T.categoryId, ids), lt(T.date, `${addMonths(month, 1)}-01`)))
			.groupBy(T.categoryId, sql`to_char(${T.date}, 'YYYY-MM')`)
	]);
	const rows: MonthRow[] = [
		...allocs.map((a) => ({ categoryId: a.categoryId, month: a.month, assigned: a.amountCents, activity: 0 })),
		...act.map((a) => ({ categoryId: a.categoryId, month: a.month, assigned: 0, activity: a.total }))
	];
	return categoryTotals(cats, rows, month);
}

export const load = async ({ locals }) => {
	const b = locals.user!.budgetId;
	const today = todayIn(locals.user!.timezone);
	const month = today.slice(0, 7);
	const [[budget], groups, all] = await Promise.all([
		db.select().from(budgets).where(eq(budgets.id, b)),
		db.select().from(G).where(eq(G.budgetId, b)).orderBy(asc(G.sortOrder), asc(G.name)),
		db.select().from(C).where(and(eq(C.budgetId, b), eq(C.type, 'savings'))).orderBy(asc(C.sortOrder), asc(C.name))
	]);
	const totals = await totalsFor(b, all, month);
	const cats = all.filter((c) => !c.archived || totals[c.id].available !== 0);
	const ids = cats.map((c) => c.id);
	const [allocs, txns] = ids.length
		? await Promise.all([
				db.select().from(A).where(and(eq(A.budgetId, b), inArray(A.categoryId, ids))).orderBy(desc(A.month)).limit(500),
				db.select().from(T).where(and(eq(T.budgetId, b), inArray(T.categoryId, ids))).orderBy(desc(T.date)).limit(300)
			])
		: [[], []];
	return { currency: budget.currencySymbol, today, month, groups, cats, totals, allocs, txns };
};

const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s).toISOString().slice(0, 10) === s;

async function savingsCat(b: string, f: FormData) {
	const [c] = await db.select().from(C).where(and(eq(C.id, String(f.get('categoryId'))), eq(C.budgetId, b), eq(C.type, 'savings')));
	return c ?? null;
}

export const actions = {
	deposit: async ({ request, locals }) => {
		const b = locals.user!.budgetId;
		const f = await request.formData();
		const cat = await savingsCat(b, f);
		const cents = parseCents(f.get('amount'));
		const date = String(f.get('date'));
		if (!cat) return fail(400, { error: 'Savings category not found.' });
		if (!cents || cents <= 0) return fail(400, { error: 'Enter an amount greater than zero.' });
		if (!validDate(date)) return fail(400, { error: 'Enter a valid date.' });
		await db.insert(T).values({
			budgetId: b, categoryId: cat.id, type: 'deposit', amountCents: cents, date,
			payee: '', note: String(f.get('note') ?? '').trim().slice(0, 200)
		});
	},

	withdraw: async ({ request, locals }) => {
		const b = locals.user!.budgetId;
		const f = await request.formData();
		const cat = await savingsCat(b, f);
		const cents = parseCents(f.get('amount'));
		const date = String(f.get('date'));
		if (!cat) return fail(400, { error: 'Savings category not found.' });
		if (!cents || cents <= 0) return fail(400, { error: 'Enter an amount greater than zero.' });
		if (!validDate(date)) return fail(400, { error: 'Enter a valid date.' });
		const balance = (await totalsFor(b, [cat], date.slice(0, 7)))[cat.id].available;
		const sym = (await db.select().from(budgets).where(eq(budgets.id, b)))[0].currencySymbol;
		if (cents > balance) return fail(400, { error: `You can withdraw at most ${formatMoney(balance, sym)} from ${cat.name}.` });
		await db.transaction(async (tx) => {
			const [t] = await tx.insert(T).values({
				budgetId: b, categoryId: cat.id, type: 'savings_withdrawal', amountCents: cents, date,
				payee: '', note: String(f.get('note') ?? '').trim().slice(0, 200)
			}).returning({ id: T.id });
			if (f.get('addBack') === 'on')
				await tx.insert(I).values({ budgetId: b, month: date.slice(0, 7), label: `From ${cat.name}`.slice(0, 60), amountCents: cents, sourceTransactionId: t.id });
		});
	},

	setGoal: async ({ request, locals }) => {
		const b = locals.user!.budgetId;
		const f = await request.formData();
		const cents = parseCents(f.get('goal'));
		if (cents === null || cents < 0) return fail(400, { error: 'Enter a valid goal amount, or leave it blank to remove the goal.' });
		await db.update(C).set({ goalCents: cents || null }).where(and(eq(C.id, String(f.get('categoryId'))), eq(C.budgetId, b), eq(C.type, 'savings')));
	}
};
