import { asc, desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { categoryGroups as G, categories as C, allocations as A, incomeLines as I, transactions as T, recurringRules as R } from '$lib/server/db/schema';
import { categoryOptions } from '$lib/tree';
import { SIGN, type TxType } from '$lib/budget-math';

import { csvText as text } from '$lib/csv';

export async function GET({ url, locals }) {
	const b = locals.user!.budgetId;
	const stamp = new Date().toISOString().slice(0, 10);
	const [groups, cats, allocs, income, txns, rules] = await Promise.all([
		db.select().from(G).where(eq(G.budgetId, b)).orderBy(asc(G.sortOrder)),
		db.select().from(C).where(eq(C.budgetId, b)).orderBy(asc(C.sortOrder)),
		db.select().from(A).where(eq(A.budgetId, b)).orderBy(asc(A.month)),
		db.select().from(I).where(eq(I.budgetId, b)).orderBy(asc(I.month)),
		db.select().from(T).where(eq(T.budgetId, b)).orderBy(desc(T.date)),
		db.select().from(R).where(eq(R.budgetId, b))
	]);

	if (url.searchParams.get('format') === 'csv') {
		const label = new Map(categoryOptions(groups, cats, true).map((o) => [o.id, o.label]));
		const lines = ['date,type,amount,category,payee,note'];
		for (const t of txns)
			lines.push([t.date, t.type, ((SIGN[t.type as TxType] * t.amountCents) / 100).toFixed(2), text(label.get(t.categoryId)), text(t.payee), text(t.note)].join(','));
		return new Response('\ufeff' + lines.join('\r\n') + '\r\n', {
			headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="budget-transactions-${stamp}.csv"` }
		});
	}
	const body = JSON.stringify({ exportedAt: new Date().toISOString(), note: 'All amounts are in cents.', groups, categories: cats, allocations: allocs, incomeLines: income, transactions: txns, recurringRules: rules }, null, 2);
	return new Response(body, {
		headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="budget-export-${stamp}.json"` }
	});
}
