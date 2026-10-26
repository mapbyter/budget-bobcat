<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatMoney } from '$lib/money';
	import { categoryOptions } from '$lib/tree';
	import { SIGN, type TxType } from '$lib/budget-math';
	let { data, form } = $props();

	const fmt = (c: number) => formatMoney(c, data.currency);
	const label = $derived(new Map(categoryOptions(data.groups, data.cats, true).map((o) => [o.id, o.label])));
	const total = $derived(data.cats.reduce((s, c) => s + data.totals[c.id].available, 0));

	function history(id: string) {
		const rows = [
			...data.allocs.filter((a) => a.categoryId === id && a.amountCents > 0).map((a) => ({ key: `a${a.month}`, date: a.month, what: 'Assigned in budget', cents: a.amountCents })),
			...data.txns.filter((t) => t.categoryId === id).map((t) => ({
				key: t.id, date: t.date,
				what: t.type === 'deposit' ? 'Added directly' : t.type === 'savings_withdrawal' ? 'Withdrawal' : 'Refund',
				cents: SIGN[t.type as TxType] * t.amountCents
			}))
		];
		return rows.sort((x, y) => (x.date < y.date ? 1 : -1)).slice(0, 20);
	}

	const field = 'rounded-md border border-border bg-bg px-2 py-1.5 text-sm';
	const btn = 'rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg';
	const keep = () => async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => update({ reset: true });
</script>

<svelte:head><title>Savings · Budget Bobcat</title></svelte:head>
<h1 class="mt-4 text-2xl font-semibold tracking-tight">Savings</h1>
<p class="mt-1 max-w-prose text-sm text-muted">Money assigned to a savings category leaves your spendable budget and builds up here. Balances are as of {data.month}.</p>

{#if form?.error}<p class="mt-3 text-sm text-danger" role="alert">{form.error}</p>{/if}

{#if data.cats.length === 0}
	<p class="mt-6 rounded-2xl border border-border bg-surface p-6 text-sm text-muted">No savings categories yet. Add one on the <a class="text-accent underline" href="/categories">Categories</a> page by choosing "Savings category".</p>
{:else}
	<div class="mt-4 rounded-2xl border border-border bg-surface p-4">
		<div class="text-sm text-muted">Total saved</div>
		<div class="text-3xl font-semibold tabular-nums">{fmt(total)}</div>
	</div>

	{#each data.cats as c (c.id)}
		{@const t = data.totals[c.id]}
		{@const pct = c.goalCents ? Math.max(0, Math.min(100, Math.round((t.available / c.goalCents) * 100))) : 0}
		<section class="mt-4 rounded-2xl border border-border bg-surface p-4">
			<div class="flex flex-wrap items-baseline justify-between gap-2">
				<h2 class="font-semibold">{label.get(c.id)}</h2>
				<span class="text-xl font-semibold tabular-nums">{fmt(t.available)}</span>
			</div>
			{#if c.goalCents}
				<div class="mt-3 h-2 overflow-hidden rounded-full bg-bg" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100" aria-label="Progress toward goal">
					<div class="h-full rounded-full bg-accent" style="width: {pct}%"></div>
				</div>
				<p class="mt-1 text-sm text-muted">
					{pct}% of {fmt(c.goalCents)}{t.available < c.goalCents ? ` · ${fmt(c.goalCents - t.available)} to go` : ' · goal reached'}
				</p>
			{/if}
			<p class="mt-2 text-sm text-muted">This month: {fmt(t.assigned + t.activity)} added</p>

			<div class="mt-3 space-y-2">
				<details class="rounded-xl bg-bg p-3">
					<summary class="cursor-pointer text-sm font-medium">Add money</summary>
					<form method="POST" action="?/deposit" use:enhance={keep} class="mt-3 space-y-2">
						<input type="hidden" name="categoryId" value={c.id} />
						<p class="text-xs text-muted">Adds money straight to this goal. It isn't income and doesn't change Left to assign.</p>
						<div class="flex flex-wrap gap-2">
							<input name="amount" inputmode="decimal" placeholder="0.00" required aria-label="Amount" class="{field} w-28 text-right tabular-nums" />
							<input name="date" type="date" required value={data.today} aria-label="Date" class={field} />
							<input name="note" placeholder="Note (e.g. sold bike)" maxlength="200" aria-label="Note" class="{field} min-w-0 flex-1" />
						</div>
						<button class={btn}>Add to {c.name}</button>
					</form>
				</details>

				<details class="rounded-xl bg-bg p-3">
					<summary class="cursor-pointer text-sm font-medium">Withdraw</summary>
					<form method="POST" action="?/withdraw" use:enhance={keep} class="mt-3 space-y-2">
						<input type="hidden" name="categoryId" value={c.id} />
						<div class="flex flex-wrap gap-2">
							<input name="amount" inputmode="decimal" placeholder="0.00" required aria-label="Amount" class="{field} w-28 text-right tabular-nums" />
							<input name="date" type="date" required value={data.today} aria-label="Date" class={field} />
							<input name="note" placeholder="Note" maxlength="200" aria-label="Note" class="{field} min-w-0 flex-1" />
						</div>
						<label class="flex items-start gap-2 text-sm">
							<input type="checkbox" name="addBack" checked class="mt-1" />
							<span>Add to that month's income so I can assign it to envelopes. Uncheck if the money is leaving the budget (for example, spent outside it).</span>
						</label>
						<button class={btn}>Withdraw from {c.name}</button>
					</form>
				</details>

				<details class="rounded-xl bg-bg p-3">
					<summary class="cursor-pointer text-sm font-medium">Goal</summary>
					<form method="POST" action="?/setGoal" use:enhance class="mt-3 flex flex-wrap items-center gap-2">
						<input type="hidden" name="categoryId" value={c.id} />
						<input name="goal" inputmode="decimal" placeholder="No goal" value={c.goalCents ? (c.goalCents / 100).toFixed(2) : ''} aria-label="Goal amount" class="{field} w-32 text-right tabular-nums" />
						<button class={btn}>Save goal</button>
					</form>
				</details>

				<details class="rounded-xl bg-bg p-3">
					<summary class="cursor-pointer text-sm font-medium">History</summary>
					<ul class="mt-2 text-sm">
						{#each history(c.id) as h (h.key)}
							<li class="flex justify-between gap-3 border-t border-border py-1.5 first:border-t-0">
								<span>{h.what} <span class="text-muted">{h.date}</span></span>
								<span class="tabular-nums {h.cents < 0 ? '' : 'text-ok'}">{fmt(h.cents)}</span>
							</li>
						{:else}
							<li class="py-1.5 text-muted">Nothing yet.</li>
						{/each}
					</ul>
				</details>
			</div>
		</section>
	{/each}
{/if}
