import { type ChildProcess, execSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

// Starts the real built app (node build) against a real Postgres and drives it over HTTP like a browser would.
let proc: ChildProcess;
let BASE = '';
let sql: ReturnType<typeof postgres>;
let cookie = '';
const email = 'owner@example.com';
const password = 'correct horse battery';
const now = new Date();
const today = now.toISOString().slice(0, 10);
const month = today.slice(0, 7);

async function call(path: string, o: { form?: Record<string, string>; cookie?: string } = {}) {
	const res = await fetch(BASE + path, {
		method: o.form ? 'POST' : 'GET',
		redirect: 'manual',
		headers: { accept: 'text/html', ...(o.cookie ? { cookie: o.cookie } : {}), ...(o.form ? { 'content-type': 'application/x-www-form-urlencoded', origin: BASE } : {}) },
		body: o.form ? new URLSearchParams(o.form).toString() : undefined
	});
	return { status: res.status, location: res.headers.get('location'), text: await res.text(), headers: res.headers };
}
const authed = (path: string, form?: Record<string, string>) => call(path, { form, cookie });
const catId = async (name: string) => (await sql`select id from categories where name = ${name}`)[0].id as string;
const leftToAssign = (html: string) => /Left to assign[\s\S]{0,300}?(-?\$[\d,]+\.\d\d)/.exec(html)?.[1];

beforeAll(async () => {
	if (!existsSync('build/index.js')) execSync('npm run build', { stdio: 'pipe' });
	const port = await new Promise<number>((resolve) => {
		const s = createServer().listen(0, '127.0.0.1', () => {
			const p = (s.address() as { port: number }).port;
			s.close(() => resolve(p));
		});
	});
	BASE = `http://127.0.0.1:${port}`;
	const url = inject('dbUrls').e2e;
	sql = postgres(url, { max: 2, onnotice: () => {} });
	proc = spawn('node', ['build'], {
		env: { ...process.env, DATABASE_URL: url, SESSION_SECRET: 'test-secret-0123456789abcdef', ORIGIN: BASE, PORT: String(port), HOST: '127.0.0.1', NODE_ENV: 'production', ALLOW_REGISTRATION: 'false' },
		stdio: 'pipe'
	});
	for (let i = 0; i < 80; i++) {
		try { if ((await fetch(BASE + '/healthz')).ok) return; } catch {}
		await new Promise((r) => setTimeout(r, 250));
	}
	throw new Error('app did not start');
});

afterAll(async () => {
	proc?.kill();
	await sql?.end();
});

describe('public pages and access control', () => {
	it('reports healthy', async () => {
		const r = await call('/healthz');
		expect(r.status).toBe(200);
		expect(JSON.parse(r.text)).toEqual({ ok: true });
	});
	it('serves the PWA files', async () => {
		expect((await call('/manifest.webmanifest')).text).toContain('"display": "standalone"');
		expect((await call('/offline.html')).status).toBe(200);
		expect((await call('/service-worker.js')).status).toBe(200);
		expect((await call('/icon-512.png')).status).toBe(200);
	});
	it('sends signed-out visitors to the login page', async () => {
		for (const p of ['/', `/budget/${month}`, '/transactions', '/settings/export?format=json']) {
			const r = await call(p);
			expect(r.status, p).toBe(303);
			expect(r.location).toBe('/login');
		}
	});
});

describe('accounts', () => {
	it('lets the very first account register and signs it in', async () => {
		const r = await call('/register', { form: { email, password } });
		expect(r.status).toBe(303);
		cookie = r.headers.getSetCookie().find((c) => c.startsWith('session='))!.split(';')[0];
		expect(cookie).toBeTruthy();
		expect((await authed('/')).status).toBe(200);
	});
	it('refuses further sign-ups while registration is closed', async () => {
		const r = await call('/register', { form: { email: 'intruder@example.com', password: 'another long password' } });
		expect(r.status).toBe(403);
		expect((await sql`select count(*)::int as n from users`)[0].n).toBe(1);
	});
	it('rejects a wrong password and accepts the right one', async () => {
		expect((await call('/login', { form: { email, password: 'wrong password!' } })).status).toBe(400);
		const ok = await call('/login', { form: { email, password } });
		expect(ok.status).toBe(303);
	});
	it('ends the session on sign out', async () => {
		const login = await call('/login', { form: { email, password } });
		const c2 = login.headers.getSetCookie().find((x) => x.startsWith('session='))!.split(';')[0];
		await call('/logout', { form: {}, cookie: c2 });
		expect((await call('/', { cookie: c2 })).status).toBe(303);
	});
});

describe('budgeting flow', () => {
	it('creates the starter categories', async () => {
		expect((await authed('/categories?/seed', {})).status).toBe(200);
		const page = await authed('/categories');
		for (const name of ['Expenses', 'Insurance', 'Motorcycle', 'Travel savings']) expect(page.text).toContain(name);
		// Insurance is nested under Expenses, three categories beneath it
		const rows = await sql`select g.name as grp, p.name as parent, count(c.id)::int as n from category_groups g left join category_groups p on p.id = g.parent_id left join categories c on c.group_id = g.id where g.name = 'Insurance' group by g.name, p.name`;
		expect(rows[0]).toMatchObject({ parent: 'Expenses', n: 3 });
	});

	it('counts down Left to assign as income is entered and envelopes are filled', async () => {
		expect((await authed(`/budget/${month}?/addIncome`, { label: 'Paycheck', amount: '3000' })).status).toBe(200);
		expect(leftToAssign((await authed(`/budget/${month}`)).text)).toBe('$3,000.00');
		expect((await authed(`/budget/${month}?/assign`, { categoryId: await catId('Groceries'), amount: '500' })).status).toBe(200);
		expect(leftToAssign((await authed(`/budget/${month}`)).text)).toBe('$2,500.00');
	});

	it('treats money assigned to savings as spent', async () => {
		await authed(`/budget/${month}?/assign`, { categoryId: await catId('Emergency fund'), amount: '300' });
		expect(leftToAssign((await authed(`/budget/${month}`)).text)).toBe('$2,200.00');
	});

	it('adds a direct deposit to savings without touching income or Left to assign', async () => {
		const r = await authed('/transactions?/add', { type: 'deposit', amount: '200', categoryId: await catId('Travel savings'), date: today, payee: 'Sold bike', note: '' });
		expect(r.status).toBe(200);
		expect(leftToAssign((await authed(`/budget/${month}`)).text)).toBe('$2,200.00');
		expect((await sql`select coalesce(sum(amount_cents),0)::int as n from income_lines`)[0].n).toBe(300000);
		const savings = await authed('/savings');
		expect(savings.status).toBe(200);
		expect(savings.text).toContain('$200.00');
	});

	it('shows spending against the envelope and leaves Left to assign alone', async () => {
		await authed('/transactions?/add', { type: 'expense', amount: '40', categoryId: await catId('Groceries'), date: today, payee: 'Market', note: '' });
		const page = (await authed(`/budget/${month}`)).text;
		expect(page).toContain('$460.00'); // available: 500 - 40
		expect(page).toMatch(/\$40\.00 of \$500\.00 spent/);
		expect(leftToAssign(page)).toBe('$2,200.00');
	});

	it('rejects bad input without changing anything', async () => {
		const before = (await sql`select count(*)::int as n from transactions`)[0].n;
		const r = await authed('/transactions?/add', { type: 'expense', amount: '-5', categoryId: await catId('Groceries'), date: today, payee: '', note: '' });
		expect(r.status).toBe(400);
		expect((await authed(`/budget/${month}?/assign`, { categoryId: await catId('Groceries'), amount: 'abc' })).status).toBe(400);
		expect((await sql`select count(*)::int as n from transactions`)[0].n).toBe(before);
	});

	it('lets a savings withdrawal be added back to income, and not exceed the balance', async () => {
		const travel = await catId('Travel savings');
		const tooMuch = await authed('/savings?/withdraw', { categoryId: travel, amount: '999', date: today, note: '', addBack: 'on' });
		expect(tooMuch.status).toBe(400);
		expect((await authed('/savings?/withdraw', { categoryId: travel, amount: '50', date: today, note: '', addBack: 'on' })).status).toBe(200);
		expect(leftToAssign((await authed(`/budget/${month}`)).text)).toBe('$2,250.00');
	});
});

describe('recurring', () => {
	it('posts a due rule once, however often the app runs it', async () => {
		const r = await authed('/recurring?/create', { kind: 'expense', label: 'Gym', amount: '25', categoryId: await catId('Subscriptions'), frequency: 'week', intervalN: '1', startDate: today, endDate: '', note: '', autoPost: 'on' });
		expect(r.status).toBe(200);
		for (let i = 0; i < 3; i++) await authed('/transactions');
		const csv = (await authed('/settings/export?format=csv')).text;
		expect(csv.split('\n').filter((l) => l.includes(',Gym,'))).toHaveLength(1);
		expect((await authed('/transactions')).text).toContain('Recurring');
	});
	it('holds confirm-first rules in the Due inbox until confirmed', async () => {
		await authed('/recurring?/create', { kind: 'expense', label: 'Electric', amount: '80', categoryId: await catId('Utilities'), frequency: 'month', intervalN: '1', startDate: today, endDate: '', note: '' });
		const page = (await authed('/transactions')).text;
		expect(page).toContain('Due: confirm to post');
		expect((await sql`select count(*)::int as n from transactions where payee = 'Electric'`)[0].n).toBe(0);
		const [p] = await sql`select id from recurring_pending`;
		await authed('/transactions?/confirm', { id: p.id, amount: '92.50' });
		const [t] = await sql`select amount_cents from transactions where payee = 'Electric'`;
		expect(t.amount_cents).toBe(9250);
		expect((await sql`select count(*)::int as n from recurring_pending`)[0].n).toBe(0);
	});
});

describe('every screen renders against real data', () => {
	for (const path of ['/', '/more', '/categories', '/transactions', '/savings', '/recurring', '/reports', '/settings']) {
		it(path, async () => expect((await authed(path)).status, path).toBe(200));
	}
	it('shows the assignment pie by top-level group', async () => {
		const page = (await authed(`/reports?month=${month}`)).text;
		expect(page).toContain('How the budget was assigned');
		expect(page).toContain('Savings &amp; investments');
		expect(page).toContain('Total assigned');
	});
	it('reports and category API respond', async () => {
		expect(JSON.parse((await authed('/api/categories')).text).options.length).toBeGreaterThan(5);
		expect((await authed('/budget/2026-13')).status).toBe(404);
	});
});

describe('export', () => {
	it('exports everything as JSON with amounts in cents and no password hashes', async () => {
		const r = await authed('/settings/export?format=json');
		const data = JSON.parse(r.text);
		expect(data.transactions.length).toBeGreaterThan(3);
		expect(data.recurringRules.length).toBe(2);
		expect(r.text).not.toContain('argon2');
	});
	it('neutralises spreadsheet formulas in the CSV', async () => {
		await authed('/transactions?/add', { type: 'expense', amount: '1', categoryId: await catId('Groceries'), date: today, payee: '=HYPERLINK("http://evil")', note: '' });
		const csv = (await authed('/settings/export?format=csv')).text;
		expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
	});
});

describe('login throttling', () => {
	it('blocks repeated failed sign-ins', async () => {
		let blocked = false;
		for (let i = 0; i < 14 && !blocked; i++) blocked = (await call('/login', { form: { email, password: `nope-${i}` } })).status === 429;
		expect(blocked).toBe(true);
	});
});
