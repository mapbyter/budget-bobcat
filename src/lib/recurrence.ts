// Pure schedule math. The Nth occurrence is always computed from the start date, never from the previous
// occurrence, so a rule on the 31st lands on the 30th (or 28th) in short months and returns to the 31st after.
export type Frequency = 'week' | 'month' | 'year';
export type Schedule = { frequency: string; intervalN: number; startDate: string };

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function occurrence(r: Schedule, k: number): string {
	const [y, m, d] = r.startDate.split('-').map(Number);
	if (r.frequency === 'week') return iso(new Date(Date.UTC(y, m - 1, d + 7 * r.intervalN * k)));
	const months = (r.frequency === 'year' ? 12 : 1) * r.intervalN * k;
	const first = new Date(Date.UTC(y, m - 1 + months, 1));
	const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
	return iso(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, lastDay))));
}

/** Index of the first occurrence on or after `date` (dates are 'YYYY-MM-DD' and compare as text). */
export function firstIndexOnOrAfter(r: Schedule, date: string): number {
	let k = 0;
	while (k < 20000 && occurrence(r, k) < date) k++;
	return k;
}

export function describe(r: { frequency: string; intervalN: number }): string {
	const unit = { week: 'week', month: 'month', year: 'year' }[r.frequency] ?? r.frequency;
	if (r.intervalN === 1) return { week: 'Weekly', month: 'Monthly', year: 'Yearly' }[r.frequency] ?? unit;
	return `Every ${r.intervalN} ${unit}s`;
}
