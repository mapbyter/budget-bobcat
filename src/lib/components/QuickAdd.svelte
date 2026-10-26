<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let dlg: HTMLDialogElement;
	let amountEl: HTMLInputElement;
	let options = $state<{ id: string; label: string }[]>([]);
	let loaded = $state(false);
	let type = $state('expense');
	let amount = $state(''), categoryId = $state(''), date = $state(''), payee = $state(''), note = $state('');
	let error = $state(''), toast = $state(''), busy = $state(false);

	const TYPES = [['expense', 'Expense'], ['deposit', 'Deposit'], ['refund', 'Refund']] as const;
	const field = 'rounded-md border border-border bg-bg px-2 py-2 text-base sm:text-sm';

	async function openSheet() {
		error = '';
		const d = new Date();
		date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
		let savedCat = '';
		try {
			type = localStorage.getItem('qa-type') || 'expense';
			savedCat = localStorage.getItem('qa-cat') || '';
		} catch {}
		dlg.showModal();
		amountEl?.focus();
		try {
			const r = await fetch('/api/categories');
			if (r.ok) options = (await r.json()).options;
		} catch {}
		loaded = true;
		categoryId = options.some((o) => o.id === savedCat) ? savedCat : '';
	}

	function backdropClose(e: MouseEvent) {
		if (e.target === dlg) dlg.close();
	}
</script>

<button type="button" onclick={openSheet} aria-label="Add transaction"
	class="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg md:right-8 md:bottom-8">
	<svg viewBox="0 0 24 24" class="h-7 w-7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
</button>

<div role="status" aria-live="polite" class="pointer-events-none fixed inset-x-0 bottom-[calc(9rem+env(safe-area-inset-bottom,0px))] z-40 flex justify-center md:bottom-28">
	{#if toast}<span class="rounded-lg bg-fg px-4 py-2 text-sm text-bg shadow-lg">{toast}</span>{/if}
</div>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog bind:this={dlg} onclick={backdropClose} aria-label="Add transaction"
	class="mx-auto mt-auto mb-0 w-full max-w-none rounded-t-2xl border border-border bg-surface p-0 text-fg backdrop:bg-black/50 md:my-auto md:max-w-md md:rounded-2xl">
	<div class="p-4" style="padding-bottom: calc(1rem + env(safe-area-inset-bottom, 0px))">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-lg font-semibold">Add transaction</h2>
			<button type="button" onclick={() => dlg.close()} class="rounded-md px-2 py-1 text-sm text-muted hover:text-fg" aria-label="Close">✕</button>
		</div>
		<form method="POST" action="/transactions?/add" class="space-y-3"
			use:enhance={() => {
				busy = true;
				error = '';
				return async ({ result }) => {
					busy = false;
					if (result.type === 'success') {
						try { localStorage.setItem('qa-type', type); localStorage.setItem('qa-cat', categoryId); } catch {}
						amount = ''; payee = ''; note = '';
						dlg.close();
						toast = 'Transaction added';
						setTimeout(() => (toast = ''), 2500);
						await invalidateAll();
					} else error = result.type === 'failure' ? String(result.data?.error ?? 'Could not save.') : 'Could not save. Check your connection.';
				};
			}}>
			<div class="inline-flex rounded-lg border border-border p-0.5" role="radiogroup" aria-label="Transaction type">
				{#each TYPES as [v, l]}
					<label class="cursor-pointer">
						<input type="radio" name="type" value={v} bind:group={type} class="peer sr-only" />
						<span class="block rounded-md px-3 py-1.5 text-sm text-muted peer-checked:bg-accent peer-checked:text-accent-fg">{l}</span>
					</label>
				{/each}
			</div>
			{#if type === 'deposit'}<p class="text-xs text-muted">Adds money straight into the category. It isn't income and doesn't change Left to assign.</p>{/if}
			<input bind:this={amountEl} name="amount" inputmode="decimal" placeholder="0.00" required bind:value={amount} aria-label="Amount" autocomplete="off" class="{field} w-full text-right text-2xl tabular-nums" />
			<select name="categoryId" required bind:value={categoryId} aria-label="Category" class="{field} w-full">
				<option value="" disabled>{loaded && options.length === 0 ? 'No categories yet' : 'Choose a category'}</option>
				{#each options as o}<option value={o.id}>{o.label}</option>{/each}
			</select>
			<div class="grid grid-cols-2 gap-2">
				<input name="date" type="date" required bind:value={date} aria-label="Date" class={field} />
				<input name="payee" placeholder="Payee" maxlength="80" bind:value={payee} aria-label="Payee" class={field} />
			</div>
			<input name="note" placeholder="Note (optional)" maxlength="200" bind:value={note} aria-label="Note" class="{field} w-full" />
			{#if error}<p class="text-sm text-danger" role="alert">{error}</p>{/if}
			{#if loaded && options.length === 0}<p class="text-sm text-muted"><a class="text-accent underline" href="/categories" onclick={() => dlg.close()}>Set up categories</a> first.</p>{/if}
			<button disabled={busy} class="w-full rounded-lg bg-accent px-4 py-2.5 font-medium text-accent-fg disabled:opacity-60">{busy ? 'Saving…' : 'Add transaction'}</button>
		</form>
	</div>
</dialog>
