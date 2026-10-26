import { fail } from '@sveltejs/kit';
import { and, eq, ne } from 'drizzle-orm';
import { hash, verify } from '@node-rs/argon2';
import { db } from '$lib/server/db';
import { budgets, users, sessions } from '$lib/server/db/schema';
import { currentSessionId } from '$lib/server/auth';
import { isLimited, recordFailure, resetLimit } from '$lib/server/ratelimit';

export const load = async ({ locals }) => {
	const [b] = await db.select().from(budgets).where(eq(budgets.id, locals.user!.budgetId));
	return { email: locals.user!.email, currency: b.currencySymbol, timezone: b.timezone };
};

export const actions = {
	general: async ({ request, locals }) => {
		const f = await request.formData();
		const currency = String(f.get('currency') ?? '').trim();
		const timezone = String(f.get('timezone') ?? '').trim();
		if (!currency || currency.length > 3) return fail(400, { section: 'general', error: 'Use a currency symbol of 1 to 3 characters.' });
		try { new Intl.DateTimeFormat('en-CA', { timeZone: timezone }); } catch { return fail(400, { section: 'general', error: 'Unknown timezone. Use a name like America/Chicago.' }); }
		await db.update(budgets).set({ currencySymbol: currency, timezone }).where(eq(budgets.id, locals.user!.budgetId));
		return { section: 'general', saved: true };
	},

	password: async (event) => {
		const uid = event.locals.user!.id;
		const key = `pw:${uid}`;
		if (isLimited(key, 5)) return fail(429, { section: 'password', error: 'Too many attempts. Try again in a few minutes.' });
		const f = await event.request.formData();
		const current = String(f.get('current') ?? '');
		const next = String(f.get('next') ?? '');
		if (next.length < 10) return fail(400, { section: 'password', error: 'Use a new password with at least 10 characters.' });
		if (next !== String(f.get('confirm') ?? '')) return fail(400, { section: 'password', error: 'The new passwords do not match.' });
		const [u] = await db.select().from(users).where(eq(users.id, uid));
		if (!(await verify(u.passwordHash, current))) {
			recordFailure(key);
			return fail(400, { section: 'password', error: 'Your current password is incorrect.' });
		}
		resetLimit(key);
		await db.update(users).set({ passwordHash: await hash(next) }).where(eq(users.id, uid));
		// sign out every other device
		const cur = currentSessionId(event);
		await db.delete(sessions).where(cur ? and(eq(sessions.userId, uid), ne(sessions.id, cur)) : eq(sessions.userId, uid));
		return { section: 'password', saved: true };
	}
};
