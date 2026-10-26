import { redirect } from '@sveltejs/kit';
import { endSession } from '$lib/server/auth';

export async function POST(event) {
	await endSession(event);
	redirect(303, '/login');
}
