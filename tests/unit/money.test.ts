import { describe, expect, it } from 'vitest';
import { addMonths, formatMoney, isMonth, monthLabel, parseCents } from '$lib/money';

describe('parseCents', () => {
	it('parses plain and formatted amounts to integer cents', () => {
		expect(parseCents('12')).toBe(1200);
		expect(parseCents('12.5')).toBe(1250);
		expect(parseCents('$1,234.56')).toBe(123456);
		expect(parseCents('.99')).toBe(99);
		expect(parseCents('-3.10')).toBe(-310);
	});
	it('treats empty input as zero', () => {
		expect(parseCents('')).toBe(0);
		expect(parseCents('   ')).toBe(0);
		expect(parseCents(null)).toBe(0);
	});
	it('rejects junk and sub-cent precision', () => {
		for (const bad of ['abc', '1.234', '1..2', '12-', '1e3', '--5']) expect(parseCents(bad)).toBeNull();
	});
	it('never produces float drift', () => {
		expect(parseCents('0.29')).toBe(29);
		expect(parseCents('1.15')).toBe(115);
		expect(parseCents('19.99')).toBe(1999);
	});
});

describe('formatMoney', () => {
	it('formats with thousands separators and a sign', () => {
		expect(formatMoney(123456)).toBe('$1,234.56');
		expect(formatMoney(-500)).toBe('-$5.00');
		expect(formatMoney(0, '€')).toBe('€0.00');
	});
});

describe('months', () => {
	it('validates YYYY-MM', () => {
		expect(isMonth('2026-10')).toBe(true);
		for (const bad of ['2026-13', '2026-00', '26-10', '2026-1', '2026-10-01', '']) expect(isMonth(bad)).toBe(false);
	});
	it('adds months across year boundaries', () => {
		expect(addMonths('2026-12', 1)).toBe('2027-01');
		expect(addMonths('2026-01', -1)).toBe('2025-12');
		expect(addMonths('2026-10', -12)).toBe('2025-10');
		expect(addMonths('2026-10', 0)).toBe('2026-10');
	});
	it('labels months', () => expect(monthLabel('2026-10')).toBe('October 2026'));
});
