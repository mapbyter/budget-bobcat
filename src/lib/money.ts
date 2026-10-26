// Money is always integer cents. Months are 'YYYY-MM' strings (they sort correctly as text).
export const isMonth = (m: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

export function addMonths(m: string, n: number): string {
	const [y, mo] = m.split('-').map(Number);
	const d = new Date(Date.UTC(y, mo - 1 + n, 1));
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(m: string): string {
	const [y, mo] = m.split('-').map(Number);
	return new Date(Date.UTC(y, mo - 1, 1)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** "1,234.5" -> 123450. Returns null when the text is not a valid amount. Empty text counts as 0. */
export function parseCents(v: unknown): number | null {
	const s = String(v ?? '').replace(/[$,\s]/g, '');
	if (s === '') return 0;
	if (!/^-?(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(s)) return null;
	return Math.round(parseFloat(s) * 100);
}

export function formatMoney(cents: number, symbol = '$'): string {
	const abs = (Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	return `${cents < 0 ? '-' : ''}${symbol}${abs}`;
}
