// Small in-memory limiter for failed sign-in attempts (resets on restart, which is fine for one instance).
const hits = new Map<string, { n: number; reset: number }>();
const WINDOW = 15 * 60_000;

export function isLimited(key: string, max = 10): boolean {
	const h = hits.get(key);
	return !!h && h.reset > Date.now() && h.n >= max;
}
export function recordFailure(key: string) {
	const now = Date.now();
	if (hits.size > 1000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
	const h = hits.get(key);
	if (!h || h.reset < now) hits.set(key, { n: 1, reset: now + WINDOW });
	else h.n++;
}
export const resetLimit = (key: string) => hits.delete(key);
