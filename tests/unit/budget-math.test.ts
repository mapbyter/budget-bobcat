import { describe, expect, it } from 'vitest';
import { categoryTotals, leftToAssign, rollupGroup, SIGN, type MonthRow } from '$lib/budget-math';

const spendingCat = { id: 'groceries', rollover: true, type: 'spending' };
const row = (categoryId: string, month: string, assigned: number, activity = 0): MonthRow => ({ categoryId, month, assigned, activity });

describe('categoryTotals: rollover', () => {
	it('carries leftover money into the next month by default', () => {
		const rows = [row('groceries', '2026-09', 50000, -30000), row('groceries', '2026-10', 50000, -10000)];
		const t = categoryTotals([spendingCat], rows, '2026-10').groceries;
		expect(t).toEqual({ assigned: 50000, activity: -10000, available: 60000 }); // 20000 carried + 50000 - 10000
	});
	it('carries overspending forward as a negative balance', () => {
		const rows = [row('groceries', '2026-09', 10000, -15000), row('groceries', '2026-10', 10000)];
		expect(categoryTotals([spendingCat], rows, '2026-10').groceries.available).toBe(5000); // -5000 + 10000
	});
	it('resets every month when rollover is off', () => {
		const cat = { ...spendingCat, rollover: false };
		const rows = [row('groceries', '2026-09', 50000), row('groceries', '2026-10', 20000, -5000)];
		expect(categoryTotals([cat], rows, '2026-10').groceries.available).toBe(15000);
	});
	it('ignores months after the one being viewed', () => {
		const rows = [row('groceries', '2026-10', 10000), row('groceries', '2026-11', 99999)];
		expect(categoryTotals([spendingCat], rows, '2026-10').groceries.available).toBe(10000);
	});
	it('corrects later months when an earlier month is edited', () => {
		const before = [row('groceries', '2026-08', 10000), row('groceries', '2026-10', 5000)];
		const after = [row('groceries', '2026-08', 30000), row('groceries', '2026-10', 5000)];
		expect(categoryTotals([spendingCat], before, '2026-10').groceries.available).toBe(15000);
		expect(categoryTotals([spendingCat], after, '2026-10').groceries.available).toBe(35000);
	});
	it('returns zeros for categories with no rows', () => {
		expect(categoryTotals([spendingCat], [], '2026-10').groceries).toEqual({ assigned: 0, activity: 0, available: 0 });
	});
});

describe('categoryTotals: savings', () => {
	const savings = { id: 'travel', rollover: false, type: 'savings' }; // rollover flag is ignored for savings
	it('always accumulates, even if the rollover flag is off', () => {
		const rows = [row('travel', '2026-08', 10000), row('travel', '2026-09', 10000), row('travel', '2026-10', 10000)];
		expect(categoryTotals([savings], rows, '2026-10').travel.available).toBe(30000);
	});
	it('adds direct deposits and subtracts withdrawals', () => {
		const rows = [row('travel', '2026-09', 10000), row('travel', '2026-10', 0, 20000 - 5000)]; // +200 deposit, -50 withdrawal
		expect(categoryTotals([savings], rows, '2026-10').travel.available).toBe(25000);
	});
});

describe('Left to assign', () => {
	it('is income minus everything assigned, spending and savings alike', () => {
		expect(leftToAssign(300000, 250000)).toBe(50000);
		expect(leftToAssign(300000, 300000)).toBe(0);
		expect(leftToAssign(300000, 310000)).toBe(-10000);
	});
	it('is not affected by direct deposits, refunds or spending', () => {
		const assigned = 120000;
		const quiet = categoryTotals([spendingCat], [row('groceries', '2026-10', assigned)], '2026-10');
		const busy = categoryTotals([spendingCat], [row('groceries', '2026-10', assigned, 20000 - 3500 + 1200)], '2026-10');
		const sum = (t: typeof quiet) => Object.values(t).reduce((s, x) => s + x.assigned, 0);
		expect(leftToAssign(300000, sum(quiet))).toBe(leftToAssign(300000, sum(busy)));
		expect(busy.groceries.available).toBeGreaterThan(quiet.groceries.available); // but the envelope itself did change
	});
});

describe('transaction signs', () => {
	it('expenses and withdrawals reduce a balance; deposits and refunds raise it', () => {
		expect(SIGN).toEqual({ expense: -1, refund: 1, deposit: 1, savings_withdrawal: -1 });
	});
});

describe('rollupGroup', () => {
	// Expenses > (Rent, Insurance > (Car, Home)); Savings > Travel
	const groups = [
		{ id: 'exp', parentId: null }, { id: 'ins', parentId: 'exp' }, { id: 'sav', parentId: null }
	];
	const cats = [
		{ id: 'rent', groupId: 'exp' }, { id: 'car', groupId: 'ins' }, { id: 'home', groupId: 'ins' }, { id: 'travel', groupId: 'sav' }
	];
	const t = (assigned: number, activity: number, available: number) => ({ assigned, activity, available });
	const totals = { rent: t(100, -100, 0), car: t(50, -20, 30), home: t(40, 0, 40), travel: t(10, 0, 10) };

	it('sums nested subgroups at any depth', () => {
		expect(rollupGroup(groups, cats, totals, 'ins')).toEqual(t(90, -20, 70));
		expect(rollupGroup(groups, cats, totals, 'exp')).toEqual(t(190, -120, 70));
	});
	it('keeps sibling top-level groups separate', () => {
		expect(rollupGroup(groups, cats, totals, 'sav')).toEqual(t(10, 0, 10));
	});
	it('tolerates categories without totals', () => {
		expect(rollupGroup(groups, cats, {}, 'exp')).toEqual(t(0, 0, 0));
	});
});
