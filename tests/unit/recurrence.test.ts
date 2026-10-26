import { describe, expect, it } from 'vitest';
import { describe as label, firstIndexOnOrAfter, occurrence } from '$lib/recurrence';

const monthly = (startDate: string, intervalN = 1) => ({ frequency: 'month', intervalN, startDate });

describe('month-end handling', () => {
	it('lands on the last day of shorter months, then returns to the 31st', () => {
		const r = monthly('2026-01-31');
		expect([0, 1, 2, 3, 4].map((k) => occurrence(r, k))).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
	});
	it('uses Feb 29 in leap years', () => {
		expect(occurrence(monthly('2024-01-31'), 1)).toBe('2024-02-29');
		expect(occurrence(monthly('2025-01-31'), 1)).toBe('2025-02-28');
	});
	it('handles the 30th and 29th too', () => {
		expect(occurrence(monthly('2026-01-30'), 1)).toBe('2026-02-28');
		expect(occurrence(monthly('2026-01-29'), 1)).toBe('2026-02-28');
		expect(occurrence(monthly('2024-01-29'), 1)).toBe('2024-02-29');
	});
	it('does not drift: the Nth date comes from the start, not the previous date', () => {
		expect(occurrence(monthly('2026-01-31'), 12)).toBe('2027-01-31');
	});
	it('supports every-N-months and crosses year ends', () => {
		const r = monthly('2026-11-15', 3);
		expect([0, 1, 2].map((k) => occurrence(r, k))).toEqual(['2026-11-15', '2027-02-15', '2027-05-15']);
	});
});

describe('weekly and yearly', () => {
	it('steps by 7 days times the interval', () => {
		const r = { frequency: 'week', intervalN: 2, startDate: '2026-10-01' };
		expect([0, 1, 2].map((k) => occurrence(r, k))).toEqual(['2026-10-01', '2026-10-15', '2026-10-29']);
	});
	it('crosses month and year boundaries', () => {
		expect(occurrence({ frequency: 'week', intervalN: 1, startDate: '2026-12-28' }, 1)).toBe('2027-01-04');
	});
	it('moves a Feb 29 yearly rule to Feb 28 in common years', () => {
		const r = { frequency: 'year', intervalN: 1, startDate: '2024-02-29' };
		expect([0, 1, 2, 4].map((k) => occurrence(r, k))).toEqual(['2024-02-29', '2025-02-28', '2026-02-28', '2028-02-29']);
	});
});

describe('firstIndexOnOrAfter', () => {
	const r = { frequency: 'week', intervalN: 2, startDate: '2026-10-01' };
	it('is 0 when the start date is today or later', () => {
		expect(firstIndexOnOrAfter(r, '2026-10-01')).toBe(0);
		expect(firstIndexOnOrAfter(r, '2026-09-01')).toBe(0);
	});
	it('skips past occurrences (no back-fill)', () => {
		expect(firstIndexOnOrAfter(r, '2026-10-25')).toBe(2); // 10-29
		expect(occurrence(r, firstIndexOnOrAfter(r, '2026-10-15'))).toBe('2026-10-15'); // today counts
	});
});

describe('describe', () => {
	it('names common schedules', () => {
		expect(label({ frequency: 'month', intervalN: 1 })).toBe('Monthly');
		expect(label({ frequency: 'week', intervalN: 1 })).toBe('Weekly');
		expect(label({ frequency: 'week', intervalN: 2 })).toBe('Every 2 weeks');
		expect(label({ frequency: 'year', intervalN: 1 })).toBe('Yearly');
	});
});
