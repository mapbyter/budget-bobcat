import { json } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { categoryGroups as G, categories as C } from '$lib/server/db/schema';
import { categoryOptions } from '$lib/tree';

// Category choices for the quick-add sheet, fetched each time it opens so they're never stale.
export async function GET({ locals }) {
	const b = locals.user!.budgetId;
	const [groups, cats] = await Promise.all([
		db.select().from(G).where(eq(G.budgetId, b)).orderBy(asc(G.sortOrder), asc(G.name)),
		db.select().from(C).where(eq(C.budgetId, b)).orderBy(asc(C.sortOrder), asc(C.name))
	]);
	return json({ options: categoryOptions(groups, cats) });
}
