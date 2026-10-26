<script lang="ts">
	import { formatMoney } from '$lib/money';
	type Series = { name: string; values: number[]; color: string };
	let { labels, series, type, symbol = '$', title }: { labels: string[]; series: Series[]; type: 'bar' | 'line'; symbol?: string; title: string } = $props();

	const W = 600, H = 240, L = 58, R = 12, T = 12, B = 28;
	const all = $derived(series.flatMap((s) => s.values));
	const max = $derived(Math.max(0, ...all));
	const min = $derived(Math.min(0, ...all));
	const span = $derived(max - min || 1);
	const slot = $derived((W - L - R) / Math.max(labels.length, 1));
	const ticks = $derived([0, 1, 2, 3, 4].map((i) => min + (span * i) / 4));
	const y = (v: number) => T + (H - T - B) * (1 - (v - min) / span);
	const cx = (i: number) => L + slot * (i + 0.5);
	const axis = (v: number) => `${symbol}${Math.round(v / 100).toLocaleString('en-US')}`;
	const bw = $derived(Math.min(24, (slot * 0.8) / series.length));
</script>

<figure>
	<svg viewBox="0 0 {W} {H}" role="img" aria-label={title} class="h-auto w-full">
		{#each ticks as t}
			<line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--border)" />
			<text x={L - 6} y={y(t) + 3} text-anchor="end" font-size="10" fill="var(--muted)">{axis(t)}</text>
		{/each}
		{#each labels as l, i}
			<text x={cx(i)} y={H - 8} text-anchor="middle" font-size="10" fill="var(--muted)">{l}</text>
		{/each}
		{#if type === 'bar'}
			{#each series as s, si}
				{#each s.values as v, i}
					<rect x={cx(i) - (bw * series.length) / 2 + bw * si} y={Math.min(y(v), y(0))} width={bw} height={Math.abs(y(v) - y(0))} fill={s.color} rx="2" />
				{/each}
			{/each}
		{:else}
			{#each series as s}
				<polyline fill="none" stroke={s.color} stroke-width="2.5" stroke-linejoin="round" points={s.values.map((v, i) => `${cx(i)},${y(v)}`).join(' ')} />
				{#each s.values as v, i}<circle cx={cx(i)} cy={y(v)} r="3" fill={s.color} />{/each}
			{/each}
		{/if}
	</svg>
	<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
		{#each series as s}
			<span class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rounded-full" style="background: {s.color}"></span>{s.name}</span>
		{/each}
	</div>
	<details class="mt-2">
		<summary class="cursor-pointer text-sm text-muted">Show values</summary>
		<div class="overflow-x-auto">
			<table class="mt-2 w-full text-sm tabular-nums">
				<thead><tr class="text-left text-muted"><th class="py-1 pr-3 font-normal">Month</th>{#each series as s}<th class="py-1 pr-3 text-right font-normal">{s.name}</th>{/each}</tr></thead>
				<tbody>
					{#each labels as l, i}
						<tr class="border-t border-border"><td class="py-1 pr-3">{l}</td>{#each series as s}<td class="py-1 pr-3 text-right">{formatMoney(s.values[i], symbol)}</td>{/each}</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</details>
</figure>
