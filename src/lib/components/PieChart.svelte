<script lang="ts">
	import { formatMoney } from '$lib/money';
	type Slice = { id: string; name: string; cents: number };
	let { slices, symbol = '$', title }: { slices: Slice[]; symbol?: string; title: string } = $props();

	// Distinguishable in both light and dark mode. The legend repeats every value, so color is never the only cue.
	const PALETTE = ['#0f766e', '#2563eb', '#d97706', '#9333ea', '#dc2626', '#0891b2', '#65a30d', '#db2777'];
	const total = $derived(slices.reduce((s, x) => s + x.cents, 0));
	const R = 90, C = 100;

	const arcs = $derived.by(() => {
		let angle = -Math.PI / 2;
		return slices.map((s, i) => {
			const sweep = (s.cents / total) * Math.PI * 2;
			const a0 = angle, a1 = angle + sweep;
			angle = a1;
			const pt = (a: number) => `${(C + R * Math.cos(a)).toFixed(3)} ${(C + R * Math.sin(a)).toFixed(3)}`;
			const d = slices.length === 1 ? '' : `M ${C} ${C} L ${pt(a0)} A ${R} ${R} 0 ${sweep > Math.PI ? 1 : 0} 1 ${pt(a1)} Z`;
			const pct = (s.cents / total) * 100;
			return { ...s, d, color: PALETTE[i % PALETTE.length], pct: pct < 1 ? '<1%' : `${Math.round(pct)}%` };
		});
	});
</script>

<div class="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
	<svg viewBox="0 0 200 200" role="img" aria-label={title} class="h-52 w-52 shrink-0">
		{#each arcs as a (a.id)}
			{#if slices.length === 1}
				<circle cx={C} cy={C} r={R} fill={a.color}><title>{a.name}: {formatMoney(a.cents, symbol)} (100%)</title></circle>
			{:else}
				<path d={a.d} fill={a.color} stroke="var(--surface)" stroke-width="2" stroke-linejoin="round"><title>{a.name}: {formatMoney(a.cents, symbol)} ({a.pct})</title></path>
			{/if}
		{/each}
	</svg>
	<ul class="w-full min-w-0 flex-1 text-sm">
		{#each arcs as a (a.id)}
			<li class="flex items-center gap-2 border-t border-border py-2 first:border-t-0">
				<span class="h-3 w-3 shrink-0 rounded-sm" style="background: {a.color}" aria-hidden="true"></span>
				<span class="min-w-0 flex-1 truncate">{a.name}</span>
				<span class="tabular-nums text-muted">{a.pct}</span>
				<span class="w-24 text-right tabular-nums">{formatMoney(a.cents, symbol)}</span>
			</li>
		{/each}
		<li class="flex justify-between border-t border-border py-2 font-medium"><span>Total assigned</span><span class="tabular-nums">{formatMoney(total, symbol)}</span></li>
	</ul>
</div>
