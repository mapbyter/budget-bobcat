import { redirect, type Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { COOKIE, userFromToken } from '$lib/server/auth';
import { runAll } from '$lib/server/recurring';

// In-process scheduler: a first run shortly after start (catches up after downtime), then hourly.
// A Postgres advisory lock keeps several instances from running it at once.
if (!building) {
	setTimeout(runAll, 10_000);
	setInterval(runAll, 3_600_000);
}

const PUBLIC = ['/login', '/register', '/healthz'];

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(COOKIE);
	event.locals.user = token ? await userFromToken(token) : null;

	const isPublic = PUBLIC.some((p) => event.url.pathname === p);
	if (!event.locals.user && !isPublic) redirect(303, '/login');
	return resolve(event);
};
