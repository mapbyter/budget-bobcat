import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { verify } from '@node-rs/argon2';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { startSession } from '$lib/server/auth';
import { isLimited, recordFailure, resetLimit } from '$lib/server/ratelimit';

export const load = ({ locals }) => {
	if (locals.user) redirect(303, '/');
};

export const actions = {
	default: async (event) => {
		let ip = 'unknown';
		try { ip = event.getClientAddress(); } catch {}
		const key = `login:${ip}`;
		if (isLimited(key)) return fail(429, { error: 'Too many failed attempts. Try again in a few minutes.', email: '' });
		const form = await event.request.formData();
		const email = String(form.get('email') ?? '').trim().toLowerCase();
		const password = String(form.get('password') ?? '');
		const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
		const ok = user && (await verify(user.passwordHash, password));
		if (!ok) {
			recordFailure(key);
			return fail(400, { error: 'Email or password is incorrect.', email });
		}
		resetLimit(key);
		await startSession(event, user.id);
		redirect(303, '/');
	}
};
