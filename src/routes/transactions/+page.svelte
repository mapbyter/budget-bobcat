<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import { formatMoney } from '$lib/money';
	import { categoryOptions } from '$lib/tree';
	import { SIGN, type TxType } from '$lib/budget-math';
	let { data, form } = $props();

	const fmt = (c: number) => formatMoney(c, data.currency);
	const addOpts = $derived(categoryOptions(data.groups, data.cats));
	const allOpts = $derived(categoryOptions(data.groups, data.cats, true));
	const catLabel = $derived(new Map(allOpts.map((o) => [o.id, o.label])));
	const TYPES = [['expense', 'Expense'], ['deposit', 'Deposit'], ['refund', 'Refund']] as const;

	let type = $state<string>('expense');
	let amount = $state(''), categoryId = $state(''), date = $state(''), payee = $state(''), note = $state('');
	onMount(() => {
		const d = new Date();
		date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	});

	const field = 'rounded-md border border-border bg-bg px-2 py-1.5 text-sm';
	const btn = 'rounded-md border border-border px-2 py-1 text-sm hover:bg-bg';
	const signed = (t: { type: string; amountCents: number }) => SIGN[t.type as TxType] * t.amountCents;
	const hint: Record<string, string> = {
		deposit: "Adds money straight into the category. It isn't income and doesn't change Left to assign.",
		refund: 'Gives money back to the category you spent it from.'
	};
</script>

{#snippet fields(t: (typeof data.txns)[number] | null, opts: { id: string; label: string }[])}
	<div class="grid gap-2 sm:grid-cols-2">
		<input name="amount" inputmode="decimal" placeholder="0.00" required value={t ? (t.amountCents / 100).toFixed(2) : undefined} aria-label="Amount" class="{field} text-right tabular-nums" />
		<input name="date" type="date" required value={t?.date} aria-label="Date" class={field} />
		<select name="categoryId" required class="{field} sm:col-span-2" aria-label="Category">
			{#each opts as o}<option value={o.id} selected={o.id === t?.categoryId}>{o.label}</option>{/each}
		</select>
		<input name="payee" placeholder="Payee" maxlength="80" value={t?.payee} aria-label="Payee" class={field} />
		<input name="note" placeholder="Note" maxlength="200" value={t?.note} aria-label="Note" class={field} />
	</div>
{/snippet}

<svelte:head><title>Transactions · Budget Bobcat</title></svelte:head>
<h1 class="mt-4 text-2xl font-semibold tracking-tight">Transactions</h1>

{#if form?.error}<p class="mt-3 text-sm text-danger" role="alert">{form.error}</p>{/if}

{#if data.due.length}
	<section class="mt-4 rounded-2xl border-2 border-warn bg-surface p-4">
		<h2 class="font-semibold">Due: confirm to post</h2>
		<p class="text-xs text-muted">Change the amount if this one is different, then confirm. Nothing counts until you do.</p>
		{#each data.due as d (d.id)}
			<div class="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
				<span class="min-w-0">
					<span class="block truncate">{d.label || (d.categoryId ? catLabel.get(d.categoryId) : 'Income')}</span>
					<span class="block truncate text-xs text-muted">{d.date} · {d.kind === 'income' ? 'Income' : catLabel.get(d.categoryId ?? '')}</span>
				</span>
				<span class="flex items-center gap-2">
					<form method="POST" action="?/confirm" use:enhance class="flex items-center gap-2">
						<input type="hidden" name="id" value={d.id} />
						<input name="amount" inputmode="decimal" value={(d.amountCents / 100).toFixed(2)} aria-label="Amount" class="{field} w-28 text-right tabular-nums" />
						<button class="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg">Confirm</button>
					</form>
					<form method="POST" action="?/dismiss" use:enhance><input type="hidden" name="id" value={d.id} /><button class={btn}>Skip</button></form>
				</span>
			</div>
		{/each}
	</section>
{/if}

<form method="POST" action="?/add" class="mt-4 rounded-2xl border border-border bg-surface p-4"
	use:enhance={() => async ({ result, update }) => {
		await update({ reset: false });
		if (result.type === 'success') { amount = ''; payee = ''; note = ''; }
	}}>
	<div class="inline-flex rounded-lg border border-border p-0.5" role="radiogroup" aria-label="Transaction type">
		{#each TYPES as [v, l]}
			<label class="cursor-pointer">
				<input type="radio" name="type" value={v} bind:group={type} class="peer sr-only" />
				<span class="block rounded-md px-3 py-1 text-sm text-muted peer-checked:bg-accent peer-checked:text-accent-fg peer-focus-visible:outline-2">{l}</span>
			</label>
		{/each}
	</div>
	{#if hint[type]}<p class="mt-2 text-xs text-muted">{hint[type]}</p>{/if}
	<div class="mt-3 grid gap-2 sm:grid-cols-2">
		<input name="amount" inputmode="decimal" placeholder="0.00" required bind:value={amount} aria-label="Amount" class="{field} text-right tabular-nums" />
		<input name="date" type="date" required bind:value={date} aria-label="Date" class={field} />
		<select name="categoryId" required bind:value={categoryId} class="{field} sm:col-span-2" aria-label="Category">
			<option value="" disabled>Choose a category</option>
			{#each addOpts as o}<option value={o.id}>{o.label}</option>{/each}
		</select>
		<input name="payee" placeholder="Payee" maxlength="80" bind:value={payee} aria-label="Payee" class={field} />
		<input name="note" placeholder="Note" maxlength="200" bind:value={note} aria-label="Note" class={field} />
	</div>
	<button class="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg">Add transaction</button>
</form>

<form method="GET" class="mt-4 flex flex-wrap items-center gap-2">
	<input name="q" value={data.filters.q} placeholder="Search payee or note" class="{field} min-w-0 flex-1" aria-label="Search" />
	<select name="cat" class={field} aria-label="Filter by category">
		<option value="">All categories</option>
		{#each allOpts as o}<option value={o.id} selected={o.id === data.filters.cat}>{o.label}</option>{/each}
	</select>
	<select name="type" class={field} aria-label="Filter by type">
		<option value="">All types</option>
		{#each TYPES as [v, l]}<option value={v} selected={v === data.filters.type}>{l}</option>{/each}
		<option value="savings_withdrawal" selected={data.filters.type === 'savings_withdrawal'}>Withdrawal</option>
	</select>
	<input name="month" type="month" value={data.filters.month} class={field} aria-label="Filter by month" />
	<button class={btn}>Filter</button>
	{#if data.filters.q || data.filters.cat || data.filters.type || data.filters.month}<a href="/transactions" class="text-sm text-accent">Clear</a>{/if}
</form>

<section class="mt-4 rounded-2xl border border-border bg-surface px-4">
	<div class="flex items-baseline justify-between border-b border-border py-3 text-sm">
		<span class="text-muted">{data.txns.length}{data.truncated ? '+' : ''} shown</span>
		<span>Net activity <strong class="tabular-nums">{fmt(data.net)}</strong></span>
	</div>
	{#each data.txns as t (t.id)}
		<details class="border-t border-border first:border-t-0">
			<summary class="flex cursor-pointer items-center justify-between gap-3 py-3">
				<span class="min-w-0">
					<span class="block truncate">{t.payee || t.note || catLabel.get(t.categoryId)}</span>
					<span class="block truncate text-xs text-muted">
						{t.date} · {catLabel.get(t.categoryId)}
						{#if t.recurringRuleId}<span class="ml-1 rounded-full bg-bg px-2 py-0.5">Recurring</span>{/if}
						{#if t.type !== 'expense'}<span class="ml-1 rounded-full bg-accent/15 px-2 py-0.5 text-accent">{t.type === 'deposit' ? 'Deposit' : t.type === 'refund' ? 'Refund' : 'Withdrawal'}</span>{/if}
					</span>
				</span>
				<span class="tabular-nums {signed(t) > 0 ? 'text-ok' : ''}">{fmt(signed(t))}</span>
			</summary>
			<div class="mb-3 space-y-2 rounded-xl bg-bg p-3">
				{#if t.type === 'savings_withdrawal'}
					<p class="text-sm text-muted">Savings withdrawals can be deleted here. To change one, delete it and withdraw again from the Savings page.</p>
				{:else}
				<form method="POST" action="?/edit" use:enhance={() => async ({ update }) => update({ reset: false })} class="space-y-2">
					<input type="hidden" name="id" value={t.id} />
					<select name="type" class={field} aria-label="Type">
						{#each TYPES as [v, l]}<option value={v} selected={v === t.type}>{l}</option>{/each}
					</select>
					{@render fields(t, allOpts)}
					<button class={btn}>Save changes</button>
				</form>
				{/if}
				<form method="POST" action="?/delete" use:enhance><input type="hidden" name="id" value={t.id} /><button class="{btn} text-danger">Delete</button></form>
			</div>
		</details>
	{:else}
		<p class="py-6 text-sm text-muted">No transactions match. Add one above.</p>
	{/each}
	{#if data.truncated}<p class="border-t border-border py-3 text-sm text-muted">Showing the latest {data.txns.length}. Use the filters to narrow down.</p>{/if}
</section>
