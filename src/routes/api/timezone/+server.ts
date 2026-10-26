import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { budgets } from '$lib/server/db/schema';

export async function POST({ request, locals }) {
	const { timezone } = await request.json().catch(() => ({}));
	try {
		new Intl.DateTimeFormat('en-CA', { timeZone: String(timezone) });
	} catch {
		return json({ ok: false }, { status: 400 });
	}
	await db.update(budgets).set({ timezone: String(timezone) }).where(eq(budgets.id, locals.user!.budgetId));
	return json({ ok: true });
}
