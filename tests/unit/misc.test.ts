import { beforeEach, describe, expect, it, vi } from 'vitest';
import { categoryOptions } from '$lib/tree';
import { csvText } from '$lib/csv';
import { isLimited, recordFailure, resetLimit } from '../../src/lib/server/ratelimit';

describe('categoryOptions', () => {
	const groups = [
		{ id: 'exp', parentId: null, name: 'Expenses' },
		{ id: 'ins', parentId: 'exp', name: 'Insurance' }
	];
	const cats = [
		{ id: 'car', groupId: 'ins', name: 'Car', archived: false },
		{ id: 'old', groupId: 'exp', name: 'Old', archived: true }
	];
	it('labels categories with their full group path', () => {
		expect(categoryOptions(groups, cats)).toEqual([{ id: 'car', label: 'Expenses › Insurance › Car' }]);
	});
	it('can include archived categories', () => {
		expect(categoryOptions(groups, cats, true).map((o) => o.id).sort()).toEqual(['car', 'old']);
	});
});

describe('csvText', () => {
	it('quotes cells with commas, quotes and newlines', () => {
		expect(csvText('a,b')).toBe('"a,b"');
		expect(csvText('say "hi"')).toBe('"say ""hi"""');
		expect(csvText('line\nbreak')).toBe('"line\nbreak"');
	});
	it('neutralises spreadsheet formulas', () => {
		for (const bad of ['=SUM(A1)', '+1', '-1', '@x']) expect(csvText(bad).startsWith("'")).toBe(true);
		expect(csvText('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
	});
	it('leaves ordinary text and empty values alone', () => {
		expect(csvText('Groceries')).toBe('Groceries');
		expect(csvText(null)).toBe('');
	});
});

describe('login rate limit', () => {
	beforeEach(() => resetLimit('ip'));
	it('blocks after the allowed number of failures', () => {
		for (let i = 0; i < 9; i++) recordFailure('ip');
		expect(isLimited('ip')).toBe(false);
		recordFailure('ip');
		expect(isLimited('ip')).toBe(true);
	});
	it('is per key and clears on reset', () => {
		for (let i = 0; i < 10; i++) recordFailure('ip');
		expect(isLimited('other')).toBe(false);
		resetLimit('ip');
		expect(isLimited('ip')).toBe(false);
	});
	it('expires after the window', () => {
		vi.useFakeTimers();
		for (let i = 0; i < 10; i++) recordFailure('ip');
		expect(isLimited('ip')).toBe(true);
		vi.advanceTimersByTime(16 * 60_000);
		expect(isLimited('ip')).toBe(false);
		vi.useRealTimers();
	});
});
