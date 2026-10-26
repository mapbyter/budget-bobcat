// Pure budget math. Nothing here is stored: balances are always recomputed from allocations and activity,
// so editing an old month corrects every later month.
export type MonthRow = { categoryId: string; month: string; assigned: number; activity: number };
export type Totals = { assigned: number; activity: number; available: number };

/**
 * rows: per-category, per-month amounts for every month up to and including `month`.
 * - assigned/activity: this month's figures only.
 * - available: with rollover (always the case for savings) the running sum of assigned + activity
 *   across all months up to `month`, so overspending carries forward too; without rollover, this month only.
 */
export function categoryTotals(
	cats: { id: string; rollover: boolean; type: string }[],
	rows: MonthRow[],
	month: string
): Record<string, Totals> {
	const out: Record<string, Totals> = {};
	const carries = new Map<string, boolean>();
	for (const c of cats) {
		out[c.id] = { assigned: 0, activity: 0, available: 0 };
		carries.set(c.id, c.rollover || c.type === 'savings');
	}
	for (const r of rows) {
		const t = out[r.categoryId];
		if (!t || r.month > month) continue;
		if (r.month === month) {
			t.assigned += r.assigned;
			t.activity += r.activity;
		}
		if (r.month === month || carries.get(r.categoryId)) t.available += r.assigned + r.activity;
	}
	return out;
}

/** Left to assign = take-home pay minus everything assigned this month (spending and savings alike). */
export const leftToAssign = (incomeCents: number, assignedCents: number) => incomeCents - assignedCents;

/** Effect of each transaction type on its category's balance (amounts are stored positive). */
export const SIGN = { expense: -1, refund: 1, deposit: 1, savings_withdrawal: -1 } as const;
export type TxType = keyof typeof SIGN;

/** A group's totals including every subgroup and category beneath it, at any depth. */
export function rollupGroup(
	groups: { id: string; parentId: string | null }[],
	cats: { id: string; groupId: string }[],
	totals: Record<string, Totals>,
	groupId: string
): Totals {
	const r: Totals = { assigned: 0, activity: 0, available: 0 };
	const add = (t?: Totals) => {
		if (!t) return;
		r.assigned += t.assigned; r.activity += t.activity; r.available += t.available;
	};
	for (const c of cats) if (c.groupId === groupId) add(totals[c.id]);
	for (const g of groups) if (g.parentId === groupId) add(rollupGroup(groups, cats, totals, g.id));
	return r;
}
