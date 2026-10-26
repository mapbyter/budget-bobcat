import { fail, redirect } from '@sveltejs/kit';
import { count } from 'drizzle-orm';
import { hash } from '@node-rs/argon2';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { users, budgets, budgetMembers } from '$lib/server/db/schema';
import { startSession } from '$lib/server/auth';

async function registrationOpen() {
	if (env.ALLOW_REGISTRATION === 'true') return true;
	const [{ n }] = await db.select({ n: count() }).from(users);
	return n === 0; // the first account can always be created
}

export const load = async ({ locals }) => {
	if (locals.user) redirect(303, '/');
	return { open: await registrationOpen() };
};

export const actions = {
	default: async (event) => {
		if (!(await registrationOpen())) return fail(403, { error: 'Registration is closed.', email: '' });
		const form = await event.request.formData();
		const email = String(form.get('email') ?? '').trim().toLowerCase();
		const password = String(form.get('password') ?? '');
		if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(400, { error: 'Enter a valid email address.', email });
		if (password.length < 10) return fail(400, { error: 'Use a password with at least 10 characters.', email });

		const passwordHash = await hash(password);
		try {
			const userId = await db.transaction(async (tx) => {
				const [u] = await tx.insert(users).values({ email, passwordHash }).returning({ id: users.id });
				const [b] = await tx.insert(budgets).values({}).returning({ id: budgets.id });
				await tx.insert(budgetMembers).values({ budgetId: b.id, userId: u.id });
				return u.id;
			});
			await startSession(event, userId);
		} catch {
			return fail(400, { error: 'An account with that email already exists.', email });
		}
		redirect(303, '/');
	}
};
