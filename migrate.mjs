// Applies SQL files in ./migrations in order, once each. Safe to run from several containers at once.
import postgres from 'postgres';
import fs from 'node:fs';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is required'); process.exit(1); }

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
	await sql`select pg_advisory_lock(727274)`;
	await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
	const done = new Set((await sql`select name from schema_migrations`).map((r) => r.name));
	for (const file of fs.readdirSync('migrations').filter((f) => f.endsWith('.sql')).sort()) {
		if (done.has(file)) continue;
		console.log(`Applying ${file}`);
		await sql.begin(async (tx) => {
			await tx.unsafe(fs.readFileSync(`migrations/${file}`, 'utf8'));
			await tx`insert into schema_migrations (name) values (${file})`;
		});
	}
	await sql`select pg_advisory_unlock(727274)`;
	console.log('Migrations up to date');
} catch (e) {
	console.error('Migration failed:', e);
	process.exit(1);
} finally {
	await sql.end();
}
