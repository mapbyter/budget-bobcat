<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { formatMoney, monthLabel } from '$lib/money';
	import { rollupGroup, type Totals } from '$lib/budget-math';
	let { data, form } = $props();

	const fmt = (c: number) => formatMoney(c, data.currency);

	// Open the take-home pay editor when a month has no income yet, so it's the obvious first step.
	let incomeOpen = $state(untrack(() => data.income.length === 0));
	let shownMonth = untrack(() => data.month);
	$effect(() => {
		if (data.month !== shownMonth) {
			shownMonth = data.month;
			incomeOpen = data.income.length === 0;
		}
	});
	// Remember which groups are collapsed, per device, across refreshes and months.
	let collapsed = $state<string[]>(untrack(() => data.collapsed));
	function setOpen(id: string, open: boolean) {
		const has = collapsed.includes(id);
		if (open && has) collapsed = collapsed.filter((x) => x !== id);
		else if (!open && !has) collapsed = [...collapsed, id];
		else return;
		document.cookie = `budget_collapsed=${collapsed.join('.')}; path=/; max-age=31536000; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`;
	}
	const dollars = (c: number) => (c / 100).toFixed(2);
	const left = $derived(data.incomeTotal - data.assigned);
	const tone = $derived(left === 0 ? 'text-ok border-ok' : left > 0 ? 'text-warn border-warn' : 'text-danger border-danger');
	const status = $derived(
		left === 0 ? 'Every dollar has a job' : left > 0 ? 'Still to assign' : `Over-assigned by ${fmt(-left)}`
	);

	const subgroups = (pid: string | null) => data.groups.filter((g) => g.parentId === pid);
	const catsIn = (gid: string) => data.cats.filter((c) => c.groupId === gid);
	const rollup = (gid: string) => rollupGroup(data.groups, data.cats, data.totals, gid);

	const grid = 'grid grid-cols-3 items-center gap-x-2 sm:grid-cols-[1fr_7rem_6.5rem_6.5rem]';
	const field = 'rounded-md border border-border bg-bg px-2 py-1 text-sm';
	const btn = 'rounded-md border border-border px-2 py-1 text-sm hover:bg-bg';
	const avail = (n: number) => (n < 0 ? 'text-danger' : n === 0 ? 'text-muted' : '');
</script>

{#snippet cell(label: string, value: number, cls = '')}
	<div class="text-right tabular-nums {cls}"><span class="block text-xs text-muted sm:hidden">{label}</span>{fmt(value)}</div>
{/snippet}

{#snippet chevron()}
	<svg viewBox="0 0 24 24" class="chev h-4 w-4 shrink-0 text-accent" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
{/snippet}

<!-- How much of this category's money is used up. Spending categories: spent vs what was available this month.
     Savings categories: balance vs goal (only when a goal is set). -->
{#snippet meter(c: (typeof data.cats)[number], ct: Totals)}
	{@const sp = data.spent[c.id] ?? 0}
	{#if c.type === 'savings'}
		{#if c.goalCents}
			{@const pct = Math.max(0, Math.min(100, Math.round((ct.available / c.goalCents) * 100)))}
			<div class="col-span-3 mt-1.5 sm:col-span-4">
				<div class="h-2 overflow-hidden rounded-full bg-bg" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100" aria-label="{c.name} savings goal progress">
					<div class="h-full rounded-full bg-accent" style="width: {pct}%"></div>
				</div>
				<div class="mt-0.5 text-xs text-muted">{fmt(ct.available)} of {fmt(c.goalCents)} saved</div>
			</div>
		{/if}
	{:else}
		{@const funds = sp + ct.available}
		{@const over = ct.available < 0}
		{@const pct = over ? 100 : funds > 0 ? Math.min(100, Math.round((sp / funds) * 100)) : 0}
		<div class="col-span-3 mt-1.5 sm:col-span-4">
			<div class="h-2 overflow-hidden rounded-full bg-bg" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100" aria-label="{c.name} spent so far">
				<div class="h-full rounded-full {over ? 'bg-danger' : pct >= 85 ? 'bg-warn' : 'bg-accent'}" style="width: {pct}%"></div>
			</div>
			<div class="mt-0.5 text-xs {over ? 'text-danger' : 'text-muted'}">
				{#if over}Overspent by {fmt(-ct.available)}
				{:else if funds > 0}{fmt(sp)} of {fmt(funds)} spent
				{:else}Nothing available yet{/if}
			</div>
		</div>
	{/if}
{/snippet}

{#snippet branch(pid: string | null, depth: number)}
	{#each subgroups(pid) as g (g.id)}
		{@const t = rollup(g.id)}
		<details open={!collapsed.includes(g.id)} ontoggle={(e) => setOpen(g.id, e.currentTarget.open)} class={depth === 0 ? 'mt-3 overflow-hidden rounded-xl border border-border bg-surface' : ''}>
			<summary class="{grid} cursor-pointer list-none px-3 py-2.5 [&::-webkit-details-marker]:hidden {depth === 0 ? 'bg-accent/10 shadow-[inset_4px_0_0_var(--accent)]' : 'border-t border-border bg-bg shadow-[inset_3px_0_0_var(--accent)]'}">
				<span class="col-span-3 flex min-w-0 items-center gap-2 sm:col-span-1" style="padding-left: {depth * 0.75}rem">
					{@render chevron()}
					<span class="truncate {depth === 0 ? 'text-sm font-bold uppercase tracking-wide' : 'text-sm font-semibold'}">{g.name}</span>
				</span>
				{@render cell('Assigned', t.assigned, 'font-medium')}
				{@render cell('Activity', t.activity)}
				{@render cell('Available', t.available, avail(t.available))}
			</summary>
			{@render branch(g.id, depth + 1)}
			{#each catsIn(g.id) as c (c.id)}
				{@const ct = data.totals[c.id]}
				<form method="POST" action="?/assign" use:enhance={() => async ({ update }) => update({ reset: false })}
					class="{grid} border-t border-border px-3 py-2.5 {c.archived ? 'opacity-60' : ''}">
					<input type="hidden" name="categoryId" value={c.id} />
					<span class="col-span-3 flex min-w-0 items-start gap-2 sm:col-span-1" style="padding-left: {(depth + 1) * 0.75}rem">
						<span class="mt-[0.45rem] h-2 w-2 shrink-0 rounded-full {c.type === 'savings' ? 'bg-accent' : 'bg-muted/50'}" aria-hidden="true"></span>
						<span class="min-w-0">
							<span class="block truncate">
								{c.name}
								{#if c.type === 'savings'}<span class="ml-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">Savings</span>{/if}
							</span>
							{#if data.scheduled[c.id]}<span class="block text-xs text-muted">{fmt(data.scheduled[c.id])} scheduled still to come</span>{/if}
						</span>
					</span>
					<label class="block text-right">
						<span class="block text-xs text-muted sm:hidden">Assigned</span>
						<input name="amount" inputmode="decimal" value={dollars(ct.assigned)} aria-label="Assigned to {c.name}"
							onfocus={(e) => e.currentTarget.select()}
							onchange={(e) => e.currentTarget.form?.requestSubmit()}
							class="{field} w-full text-right tabular-nums" />
					</label>
					{#if ct.activity !== 0}
						<a href="/transactions?cat={c.id}&month={data.month}" class="text-right tabular-nums underline decoration-dotted underline-offset-4" aria-label="See {c.name} transactions">
							<span class="block text-xs text-muted sm:hidden">Activity</span>{fmt(ct.activity)}
						</a>
					{:else}
						{@render cell('Activity', ct.activity, 'text-muted')}
					{/if}
					{@render cell('Available', ct.available, avail(ct.available))}
					{@render meter(c, ct)}
				</form>
			{/each}
		</details>
	{/each}
{/snippet}

<svelte:head><title>{monthLabel(data.month)} · Budget Bobcat</title></svelte:head>

<div class="mt-2 flex items-center justify-between gap-2">
	<a href="/budget/{data.prev}" class={btn} aria-label="Previous month">‹</a>
	<div class="text-center">
		<h1 class="text-xl font-semibold tracking-tight">{monthLabel(data.month)}</h1>
		<a href="/" class="text-xs text-accent">Jump to this month</a>
	</div>
	<a href="/budget/{data.next}" class={btn} aria-label="Next month">›</a>
</div>

<div class="sticky top-2 z-10 mt-4 max-h-[75vh] overflow-y-auto rounded-2xl border-2 bg-surface p-4 shadow-sm {tone}">
	<div class="flex items-baseline justify-between gap-3" aria-live="polite">
		<div>
			<div class="text-sm text-muted">Left to assign</div>
			<div class="text-3xl font-semibold tabular-nums">{fmt(left)}</div>
		</div>
		<div class="text-right text-sm">
			<div class="font-medium">{status}</div>
			<div class="text-muted">{fmt(data.incomeTotal)} income − {fmt(data.assigned)} assigned</div>
		</div>
	</div>
	<details bind:open={incomeOpen} class="mt-3 border-t border-border pt-3">
		<summary class="flex cursor-pointer list-none items-center justify-between gap-2 text-sm [&::-webkit-details-marker]:hidden">
			<span class="flex items-center gap-1.5 font-medium">
				<svg viewBox="0 0 24 24" class="h-4 w-4 transition-transform {incomeOpen ? 'rotate-90' : ''}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
				Take-home pay
			</span>
			<span class="tabular-nums">{fmt(data.incomeTotal)}</span>
		</summary>
		<div class="mt-2 text-fg">
	{#each data.income as line (line.id)}
		<div class="mt-2 flex flex-wrap items-center gap-2">
			<form method="POST" action="?/saveIncome" use:enhance class="flex flex-1 items-center gap-2">
				<input type="hidden" name="id" value={line.id} />
				<input name="label" value={line.label} maxlength="60" aria-label="Income label" class="{field} min-w-0 flex-1" />
				<input name="amount" inputmode="decimal" value={dollars(line.amountCents)} aria-label="Income amount" class="{field} w-28 text-right tabular-nums" />
				<button class={btn}>Save</button>
			</form>
			<form method="POST" action="?/removeIncome" use:enhance>
				<input type="hidden" name="id" value={line.id} /><button class="{btn} text-danger">Remove</button>
			</form>
		</div>
	{/each}
	<form method="POST" action="?/addIncome" use:enhance class="mt-3 flex flex-wrap items-center gap-2">
		<input name="label" placeholder={data.income.length ? 'Another income (e.g. paycheck 2)' : 'Take-home pay'} maxlength="60" aria-label="New income label" class="{field} min-w-0 flex-1" />
		<input name="amount" inputmode="decimal" placeholder="0.00" required aria-label="New income amount" class="{field} w-28 text-right tabular-nums" />
		<button class={btn}>Add income</button>
	</form>
		</div>
	</details>
</div>

{#if form?.error}<p class="mt-3 text-sm text-danger" role="alert">{form.error}</p>{/if}

{#if data.canCopy}
	<form method="POST" action="?/copyPrev" use:enhance class="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-4">
		<p class="text-sm text-muted">This month is empty. Start from last month's income and assignments?</p>
		<button class="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg">Copy {monthLabel(data.prev)}</button>
	</form>
{/if}

<section class="mt-2">
	<div class="{grid} mt-2 hidden px-3 py-2 text-sm text-muted sm:grid">
		<span>Category</span><span class="text-right">Assigned</span><span class="text-right">Activity</span><span class="text-right">Available</span>
	</div>
	{#if data.groups.length === 0}
		<p class="mt-3 rounded-2xl border border-border bg-surface p-6 text-sm text-muted">No categories yet. <a class="text-accent underline" href="/categories">Set up your categories</a> first.</p>
	{:else}
		{@render branch(null, 0)}
	{/if}
</section>

<style>
	.chev { transition: transform 0.15s; }
	details[open] > summary .chev { transform: rotate(90deg); }
</style>
