<script lang="ts">
	import Chart from '$lib/components/Chart.svelte';
	import PieChart from '$lib/components/PieChart.svelte';
	import { addMonths, formatMoney, monthLabel } from '$lib/money';
	let { data } = $props();

	const fmt = (c: number) => formatMoney(c, data.currency);
	const labels = $derived(
		data.months.map((m: string, i: number) => {
			const d = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5) - 1, 1));
			const mon = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
			return i === 0 || m.endsWith('-01') ? `${mon} ’${m.slice(2, 4)}` : mon;
		})
	);

	const subgroups = (pid: string | null) => data.groups.filter((g) => g.parentId === pid);
	const catsIn = (gid: string) => data.cats.filter((c) => c.groupId === gid);
	function rollup(gid: string): number {
		return catsIn(gid).reduce((s, c) => s + (data.spentByCat[c.id] ?? 0), 0) + subgroups(gid).reduce((s, g) => s + rollup(g.id), 0);
	}
	const totalSpent = $derived(data.summary.spent);
	const share = (v: number) => (totalSpent > 0 ? Math.max(0, Math.min(100, (v / totalSpent) * 100)) : 0);
	const link = (m: string) => `/reports?month=${m}&range=${data.count}`;
	const btn = 'rounded-md border border-border px-2 py-1 text-sm hover:bg-bg';
</script>

{#snippet bar(v: number)}
	<span class="mt-1 block h-1.5 overflow-hidden rounded-full bg-bg"><span class="block h-full rounded-full bg-accent" style="width: {share(v)}%"></span></span>
{/snippet}

{#snippet branch(pid: string | null, depth: number)}
	{#each subgroups(pid) as g (g.id)}
		{@const v = rollup(g.id)}
		{#if v !== 0}
			<details open={depth === 0} class="border-t border-border first:border-t-0">
				<summary class="cursor-pointer py-3" style="padding-left: {depth}rem">
					<span class="flex items-baseline justify-between gap-3"><span class="font-semibold">{g.name}</span><span class="tabular-nums">{fmt(v)}</span></span>
					<span style="display:block">{@render bar(v)}</span>
				</summary>
				{@render branch(g.id, depth + 1)}
				{#each catsIn(g.id).filter((c) => (data.spentByCat[c.id] ?? 0) !== 0) as c (c.id)}
					<div class="border-t border-border py-2" style="padding-left: {depth + 1}rem">
						<div class="flex items-baseline justify-between gap-3">
							<a class="min-w-0 truncate hover:underline" href="/transactions?cat={c.id}&month={data.month}">{c.name}</a>
							<span class="tabular-nums">{fmt(data.spentByCat[c.id])}</span>
						</div>
						{@render bar(data.spentByCat[c.id])}
					</div>
				{/each}
			</details>
		{/if}
	{/each}
{/snippet}

<svelte:head><title>Reports · Budget Bobcat</title></svelte:head>

<div class="mt-2 flex items-center justify-between gap-2">
	<a href={link(addMonths(data.month, -1))} class={btn} aria-label="Previous month">‹</a>
	<div class="text-center">
		<h1 class="text-xl font-semibold tracking-tight">{monthLabel(data.month)}</h1>
		<a href="/reports?range={data.count}" class="text-xs text-accent">Jump to this month</a>
	</div>
	<a href={link(addMonths(data.month, 1))} class={btn} aria-label="Next month">›</a>
</div>

<div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
	{#each [['Income', data.summary.income, ''], ['Assigned', data.summary.assigned, ''], ['Spent', data.summary.spent, ''], ['Outside-income deposits', data.summary.deposits, `${fmt(data.summary.depositsRange)} over ${data.count} months`]] as [name, v, note]}
		<div class="rounded-2xl border border-border bg-surface p-3">
			<div class="text-sm text-muted">{name}</div>
			<div class="text-xl font-semibold tabular-nums">{fmt(v as number)}</div>
			{#if note}<div class="text-xs text-muted">{note}</div>{/if}
		</div>
	{/each}
</div>
<p class="mt-2 text-xs text-muted">Spent is expenses minus refunds. Deposits added straight to categories are shown separately so they don't distort income or spending.</p>

<section class="mt-6 rounded-2xl border border-border bg-surface p-4">
	<h2 class="font-semibold">How the budget was assigned</h2>
	<p class="mb-3 text-sm text-muted">Share of {monthLabel(data.month)}'s assignments by top-level group, savings included.</p>
	{#if data.slices.length}
		<PieChart slices={data.slices} symbol={data.currency} title="Pie chart of budget assigned to each top-level group in {monthLabel(data.month)}" />
	{:else}
		<p class="text-sm text-muted">Nothing was assigned in {monthLabel(data.month)}.</p>
	{/if}
</section>

<section class="mt-6 rounded-2xl border border-border bg-surface px-4">
	<h2 class="pt-4 font-semibold">Spending by group</h2>
	<div class="pb-2">
		{#if totalSpent === 0 && Object.values(data.spentByCat).every((v) => v === 0)}
			<p class="py-4 text-sm text-muted">No spending recorded in {monthLabel(data.month)}.</p>
		{:else}
			{@render branch(null, 0)}
		{/if}
	</div>
</section>

<section class="mt-6 rounded-2xl border border-border bg-surface p-4">
	<div class="mb-3 flex items-center justify-between gap-2">
		<h2 class="font-semibold">Assigned vs spent</h2>
		<span class="flex gap-1 text-sm">
			<a class="{btn} {data.count === 6 ? 'bg-bg' : ''}" href="/reports?month={data.month}&range=6">6 months</a>
			<a class="{btn} {data.count === 12 ? 'bg-bg' : ''}" href="/reports?month={data.month}&range=12">12 months</a>
		</span>
	</div>
	<Chart type="bar" {labels} symbol={data.currency} title="Assigned to spending categories versus spent, by month"
		series={[{ name: 'Assigned to spending', values: data.series.assignedSpending, color: 'var(--muted)' }, { name: 'Spent', values: data.series.spent, color: 'var(--accent)' }]} />
</section>

<section class="mt-6 rounded-2xl border border-border bg-surface p-4">
	<h2 class="mb-3 font-semibold">Savings growth</h2>
	<Chart type="line" {labels} symbol={data.currency} title="Total savings balance at the end of each month"
		series={[{ name: 'Total saved', values: data.series.savings, color: 'var(--accent)' }]} />
</section>
