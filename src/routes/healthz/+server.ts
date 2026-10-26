import { sql } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';

export async function GET() {
	try {
		await db.execute(sql`select 1`);
		return json({ ok: true });
	} catch {
		return json({ ok: false }, { status: 503 });
	}
}
