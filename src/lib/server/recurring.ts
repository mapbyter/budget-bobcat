import { and, eq, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from './db';
import { budgets, recurringRules as R, recurringPending as P, transactions as T, incomeLines as I } from './db/schema';
import { occurrence } from '$lib/recurrence';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Rule = typeof R.$inferSelect;

export function todayIn(timeZone: string): string {
	try {
		return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
	} catch {
		return new Date().toISOString().slice(0, 10);
	}
}

/** Turns one occurrence into a real transaction or income line. Safe to call twice for the same date. */
export async function materialize(tx: Tx, r: Rule, date: string, amountCents: number) {
	if (r.kind === 'income') {
		await tx.insert(I).values({
			budgetId: r.budgetId, month: date.slice(0, 7), label: r.label || 'Income',
			amountCents, recurringRuleId: r.id, occurrenceDate: date
		}).onConflictDoNothing();
	} else {
		await tx.insert(T).values({
			budgetId: r.budgetId, categoryId: r.categoryId!, type: r.kind, amountCents, date,
			payee: r.label, note: r.note, recurringRuleId: r.id, occurrenceDate: date
		}).onConflictDoNothing();
	}
}

/** Posts (or queues for confirmation) every occurrence that has come due, including ones missed while the app was down. */
export async function runDue(budgetId?: string) {
	await db.transaction(async (tx) => {
		const lock = (await tx.execute(sql`select pg_try_advisory_xact_lock(727275) as ok`)) as unknown as { ok: boolean }[];
		if (!lock[0]?.ok) return; // another instance is already doing this
		const list = await tx.select({ id: budgets.id, tz: budgets.timezone }).from(budgets).where(budgetId ? eq(budgets.id, budgetId) : undefined);
		for (const b of list) {
			const today = todayIn(b.tz);
			const rules = await tx.select().from(R).where(and(
				eq(R.budgetId, b.id), eq(R.active, true), lte(R.nextDate, today),
				or(isNull(R.endDate), sql`${R.nextDate} <= ${R.endDate}`)
			));
			for (const r of rules) {
				let idx = r.nextIndex;
				let date = occurrence(r, idx);
				for (let n = 0; date <= today && (!r.endDate || date <= r.endDate) && n < 500; n++) {
					if (r.autoPost) await materialize(tx, r, date, r.amountCents);
					else await tx.insert(P).values({ ruleId: r.id, budgetId: r.budgetId, occurrenceDate: date }).onConflictDoNothing();
					date = occurrence(r, ++idx);
				}
				if (idx !== r.nextIndex) await tx.update(R).set({ nextIndex: idx, nextDate: date }).where(eq(R.id, r.id));
			}
		}
	});
}

const lastRun = new Map<string, number>();
/** Called when someone opens the app; throttled so navigation stays fast. */
export async function catchUp(budgetId: string) {
	if (Date.now() - (lastRun.get(budgetId) ?? 0) < 60_000) return;
	lastRun.set(budgetId, Date.now());
	try { await runDue(budgetId); } catch (e) { console.error('recurring catch-up failed', e); }
}

export async function runAll() {
	try { await runDue(); } catch (e) { console.error('recurring run failed', e); }
}
