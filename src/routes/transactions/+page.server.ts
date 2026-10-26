import { fail } from '@sveltejs/kit';
import { and, asc, desc, eq, gte, ilike, lt, or, sql, type SQL } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { signedCents } from '$lib/server/activity';
import { budgets, categoryGroups as G, categories as C, transactions as T, recurringRules as R, recurringPending as P } from '$lib/server/db/schema';
import { materialize } from '$lib/server/recurring';
import { addMonths, isMonth, parseCents } from '$lib/money';

const TYPES = ['expense', 'refund', 'deposit'];
const FILTER_TYPES = [...TYPES, 'savings_withdrawal'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMIT = 200;

export const load = async ({ url, locals }) => {
	const b = locals.user!.budgetId;
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
	const cat = url.searchParams.get('cat') ?? '';
	const type = url.searchParams.get('type') ?? '';
	const month = url.searchParams.get('month') ?? '';

	const conds: SQL[] = [eq(T.budgetId, b)];
	if (q) {
		const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
		conds.push(or(ilike(T.payee, like), ilike(T.note, like))!);
	}
	if (UUID.test(cat)) conds.push(eq(T.categoryId, cat));
	if (FILTER_TYPES.includes(type)) conds.push(eq(T.type, type));
	if (isMonth(month)) conds.push(gte(T.date, `${month}-01`), lt(T.date, `${addMonths(month, 1)}-01`));

	const [[budget], groups, cats, txns, [net], due] = await Promise.all([
		db.select().from(budgets).where(eq(budgets.id, b)),
		db.select().from(G).where(eq(G.budgetId, b)).orderBy(asc(G.sortOrder), asc(G.name)),
		db.select().from(C).where(eq(C.budgetId, b)).orderBy(asc(C.sortOrder), asc(C.name)),
		db.select().from(T).where(and(...conds)).orderBy(desc(T.date), desc(T.createdAt)).limit(LIMIT + 1),
		db.select({ n: sql<number>`coalesce(sum(${signedCents}), 0)::int` }).from(T).where(and(...conds)),
		db
			.select({ id: P.id, date: P.occurrenceDate, kind: R.kind, label: R.label, categoryId: R.categoryId, amountCents: R.amountCents })
			.from(P)
			.innerJoin(R, eq(R.id, P.ruleId))
			.where(eq(P.budgetId, b))
			.orderBy(asc(P.occurrenceDate))
	]);
	return {
		currency: budget.currencySymbol,
		groups,
		cats,
		txns: txns.slice(0, LIMIT),
		truncated: txns.length > LIMIT,
		net: net.n,
		due,
		filters: { q, cat, type, month }
	};
};

const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s).toISOString().slice(0, 10) === s;

async function parse(f: FormData, b: string) {
	const type = String(f.get('type'));
	const cents = parseCents(f.get('amount'));
	const date = String(f.get('date'));
	const [cat] = await db.select({ id: C.id }).from(C).where(and(eq(C.id, String(f.get('categoryId'))), eq(C.budgetId, b)));
	if (!TYPES.includes(type)) return { error: 'Pick a transaction type.' };
	if (!cents || cents <= 0) return { error: 'Enter an amount greater than zero.' };
	if (!validDate(date)) return { error: 'Enter a valid date.' };
	if (!cat) return { error: 'Pick a category.' };
	return {
		values: {
			type, amountCents: cents, date, categoryId: cat.id,
			payee: String(f.get('payee') ?? '').trim().slice(0, 80),
			note: String(f.get('note') ?? '').trim().slice(0, 200)
		}
	};
}

export const actions = {
	add: async ({ request, locals }) => {
		const b = locals.user!.budgetId;
		const p = await parse(await request.formData(), b);
		if (!p.values) return fail(400, { error: p.error });
		await db.insert(T).values({ budgetId: b, ...p.values });
	},
	edit: async ({ request, locals }) => {
		const b = locals.user!.budgetId;
		const f = await request.formData();
		const p = await parse(f, b);
		if (!p.values) return fail(400, { error: p.error });
		await db.update(T).set(p.values).where(and(eq(T.id, String(f.get('id'))), eq(T.budgetId, b)));
	},
	confirm: async ({ request, locals }) => {
		const b = locals.user!.budgetId;
		const f = await request.formData();
		const cents = parseCents(f.get('amount'));
		if (!cents || cents <= 0) return fail(400, { error: 'Enter an amount greater than zero.' });
		await db.transaction(async (tx) => {
			const [row] = await tx.select({ p: P, r: R }).from(P).innerJoin(R, eq(R.id, P.ruleId)).where(and(eq(P.id, String(f.get('id'))), eq(P.budgetId, b)));
			if (!row) return;
			await materialize(tx, row.r, row.p.occurrenceDate, cents);
			await tx.delete(P).where(eq(P.id, row.p.id));
		});
	},
	dismiss: async ({ request, locals }) => {
		await db.delete(P).where(and(eq(P.id, String((await request.formData()).get('id'))), eq(P.budgetId, locals.user!.budgetId)));
	},
	delete: async ({ request, locals }) => {
		const f = await request.formData();
		await db.delete(T).where(and(eq(T.id, String(f.get('id'))), eq(T.budgetId, locals.user!.budgetId)));
	}
};
