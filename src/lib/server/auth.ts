import { createHmac, randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from './db';
import { sessions, users, budgetMembers, budgets } from './db/schema';

export const COOKIE = 'session';
const DAYS = 30;

const hashToken = (token: string) =>
	createHmac('sha256', env.SESSION_SECRET ?? '').update(token).digest('hex');

const secure = () => (env.ORIGIN ?? '').startsWith('https://');

export async function startSession(event: RequestEvent, userId: string) {
	const token = randomBytes(32).toString('base64url');
	const expiresAt = new Date(Date.now() + DAYS * 864e5);
	await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
	event.cookies.set(COOKIE, token, {
		path: '/', httpOnly: true, sameSite: 'lax', secure: secure(), expires: expiresAt
	});
}

export async function endSession(event: RequestEvent) {
	const token = event.cookies.get(COOKIE);
	if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
	event.cookies.delete(COOKIE, { path: '/' });
}

export async function userFromToken(token: string) {
	const [row] = await db
		.select({ id: users.id, email: users.email, budgetId: budgetMembers.budgetId, timezone: budgets.timezone })
		.from(sessions)
		.innerJoin(users, eq(users.id, sessions.userId))
		.innerJoin(budgetMembers, eq(budgetMembers.userId, users.id))
		.innerJoin(budgets, eq(budgets.id, budgetMembers.budgetId))
		.where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
		.limit(1);
	return row ?? null;
}

export function currentSessionId(event: RequestEvent) {
	const token = event.cookies.get(COOKIE);
	return token ? hashToken(token) : null;
}
