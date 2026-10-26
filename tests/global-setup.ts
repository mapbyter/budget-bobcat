import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import postgres from 'postgres';
import type { TestProject } from 'vitest/node';

const freePort = () =>
	new Promise<number>((resolve, reject) => {
		const s = createServer();
		s.listen(0, '127.0.0.1', () => {
			const port = (s.address() as { port: number }).port;
			s.close(() => resolve(port));
		});
		s.on('error', reject);
	});

export default async function setup({ provide }: TestProject) {
	let stop = async () => {};
	let admin = process.env.TEST_DATABASE_URL;

	if (!admin) {
		const mod = 'embedded-postgres'; // loaded lazily so the app itself never depends on it
		let EmbeddedPostgres: any;
		try {
			EmbeddedPostgres = (await import(/* @vite-ignore */ mod)).default;
		} catch {
			throw new Error('No test database. Set TEST_DATABASE_URL, or run: npm install --no-save embedded-postgres');
		}
		const dir = mkdtempSync(path.join(os.tmpdir(), 'budget-pg-'));
		const port = await freePort();
		const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'postgres', port, persistent: false, createPostgresUser: process.getuid?.() === 0, onLog: () => {}, onError: () => {} });
		await pg.initialise();
		await pg.start();
		admin = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;
		stop = async () => {
			await pg.stop();
			rmSync(dir, { recursive: true, force: true });
		};
	}

	const sql = postgres(admin, { max: 1, onnotice: () => {} });
	const urls: Record<string, string> = {};
	for (const name of ['it', 'e2e']) {
		const db = `budget_test_${name}`;
		await sql.unsafe(`drop database if exists ${db} with (force)`);
		await sql.unsafe(`create database ${db}`);
		const u = new URL(admin);
		u.pathname = `/${db}`;
		urls[name] = u.toString();
		// the real migrations, exactly as the container runs them
		execFileSync('node', ['migrate.mjs'], { env: { ...process.env, DATABASE_URL: urls[name] }, stdio: 'pipe' });
	}
	await sql.end();
	provide('dbUrls', urls as { it: string; e2e: string });
	return stop;
}
