/** One text cell for a CSV file. A leading = + - @ would run as a formula in a spreadsheet, so it gets an apostrophe. */
export function csvText(v: unknown): string {
	let s = String(v ?? '');
	if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
	return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
