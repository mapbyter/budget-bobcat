<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatMoney } from '$lib/money';
	import { categoryOptions } from '$lib/tree';
	import { describe } from '$lib/recurrence';
	let { data, form } = $props();

	const fmt = (c: number) => formatMoney(c, data.currency);
	const opts = $derived(categoryOptions(data.groups, data.cats));
	const allOpts = $derived(categoryOptions(data.groups, data.cats, true));
	const catLabel = $derived(new Map(allOpts.map((o) => [o.id, o.label])));
	const KINDS: Record<string, string> = { expense: 'Expense', deposit: 'Deposit', income: 'Income' };
	let newKind = $state('expense');

	const field = 'rounded-md border border-border bg-bg px-2 py-1.5 text-sm';
	const btn = 'rounded-md border border-border px-2 py-1 text-sm hover:bg-bg';
	type Rule = (typeof data.rules)[number];
</script>

{#snippet fields(r: Rule | null, kind: string)}
	<div class="grid gap-2 sm:grid-cols-2">
		<input name="label" placeholder={kind === 'income' ? 'Name (e.g. Paycheck)' : 'Payee (e.g. Landlord)'} maxlength="80" value={r?.label} aria-label="Name" class={field} />
		<input name="amount" inputmode="decimal" placeholder="0.00" required value={r ? (r.amountCents / 100).toFixed(2) : undefined} aria-label="Amount" class="{field} text-right tabular-nums" />
		{#if kind !== 'income'}
			<select name="categoryId" required class="{field} sm:col-span-2" aria-label="Category">
				{#each r ? allOpts : opts as o}<option value={o.id} selected={o.id === r?.categoryId}>{o.label}</option>{/each}
			</select>
		{/if}
		<div class="flex items-center gap-2 text-sm sm:col-span-2">
			Every
			<input name="intervalN" type="number" min="1" max="100" value={r?.intervalN ?? 1} aria-label="Repeat every" class="{field} w-16" />
			<select name="frequency" class={field} aria-label="Unit">
				<option value="week" selected={r?.frequency === 'week'}>week(s)</option>
				<option value="month" selected={!r || r.frequency === 'month'}>month(s)</option>
				<option value="year" selected={r?.frequency === 'year'}>year(s)</option>
			</select>
		</div>
		<label class="text-sm">{r ? 'Anchor date' : 'First date'}
			<input name="startDate" type="date" required value={r?.startDate ?? data.today} class="{field} mt-1 w-full" />
		</label>
		<label class="text-sm">End date (optional)
			<input name="endDate" type="date" value={r?.endDate ?? ''} class="{field} mt-1 w-full" />
		</label>
		<input name="note" placeholder="Note" maxlength="200" value={r?.note} aria-label="Note" class="{field} sm:col-span-2" />
		<label class="flex items-center gap-2 text-sm sm:col-span-2">
			<input type="checkbox" name="autoPost" checked={r ? r.autoPost : true} /> Post automatically (uncheck to confirm each time first)
		</label>
	</div>
{/snippet}

<svelte:head><title>Recurring · Budget Bobcat</title></svelte:head>
<h1 class="mt-4 text-2xl font-semibold tracking-tight">Recurring</h1>
<p class="mt-1 max-w-prose text-sm text-muted">Rules for bills, regular deposits and paychecks. Dates use the {data.timezone} timezone. A first date in the past isn't back-filled.</p>

{#if form?.error}<p class="mt-3 text-sm text-danger" role="alert">{form.error}</p>{/if}

<section class="mt-4 rounded-2xl border border-border bg-surface px-4">
	{#each data.rules as r (r.id)}
		<details class="border-t border-border first:border-t-0">
			<summary class="flex cursor-pointer items-center justify-between gap-3 py-3 {r.active ? '' : 'opacity-60'}">
				<span class="min-w-0">
					<span class="block truncate">{r.label || catLabel.get(r.categoryId ?? '') || 'Income'}</span>
					<span class="block truncate text-xs text-muted">
						{KINDS[r.kind]} · {describe(r)} · {r.active ? `next ${r.nextDate}` : 'Paused'}{r.autoPost ? '' : ' · asks first'}
					</span>
				</span>
				<span class="tabular-nums">{fmt(r.amountCents)}</span>
			</summary>
			<div class="mb-3 space-y-3 rounded-xl bg-bg p-3">
				<form method="POST" action="?/update" use:enhance={() => async ({ update }) => update({ reset: false })} class="space-y-2">
					<input type="hidden" name="id" value={r.id} />
					{@render fields(r, r.kind)}
					<button class={btn}>Save changes</button>
					<span class="text-xs text-muted">Changes apply to future occurrences only.</span>
				</form>
				<div class="flex flex-wrap gap-2">
					<form method="POST" action="?/setActive" use:enhance><input type="hidden" name="id" value={r.id} /><input type="hidden" name="value" value={String(!r.active)} /><button class={btn}>{r.active ? 'Pause' : 'Resume'}</button></form>
					<form method="POST" action="?/skip" use:enhance><input type="hidden" name="id" value={r.id} /><button class={btn}>Skip next ({r.nextDate})</button></form>
					<form method="POST" action="?/remove" use:enhance><input type="hidden" name="id" value={r.id} /><button class="{btn} text-danger">Delete rule</button></form>
				</div>
			</div>
		</details>
	{:else}
		<p class="py-6 text-sm text-muted">No recurring rules yet. Add your first one below.</p>
	{/each}
</section>

<form method="POST" action="?/create" use:enhance class="mt-4 space-y-3 rounded-2xl border border-border bg-surface p-4">
	<h2 class="font-semibold">New rule</h2>
	<select name="kind" bind:value={newKind} class={field} aria-label="Type">
		{#each Object.entries(KINDS) as [v, l]}<option value={v}>{l}</option>{/each}
	</select>
	{#if newKind === 'income'}<p class="text-xs text-muted">Adds a take-home pay line to each month it falls in.</p>
	{:else if newKind === 'deposit'}<p class="text-xs text-muted">Adds money into a category. It isn't income.</p>{/if}
	{#key newKind}{@render fields(null, newKind)}{/key}
	<button class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg">Add rule</button>
</form>
