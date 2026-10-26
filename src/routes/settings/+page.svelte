<script lang="ts">
	import { enhance } from '$app/forms';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	let { data, form } = $props();
	const field = 'mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm';
	const btn = 'rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg';
	const card = 'mt-4 rounded-2xl border border-border bg-surface p-4';
	const browserTz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : '';
</script>

<svelte:head><title>Settings · Budget Bobcat</title></svelte:head>
<h1 class="mt-2 text-2xl font-semibold tracking-tight">Settings</h1>

<section class={card}>
	<h2 class="font-semibold">Appearance</h2>
	<p class="mb-3 text-sm text-muted">Follows your device by default. Tap to switch between system, light and dark.</p>
	<ThemeToggle />
</section>

<section class={card}>
	<h2 class="font-semibold">Currency and timezone</h2>
	<form method="POST" action="?/general" use:enhance={() => async ({ update }) => update({ reset: false })} class="mt-3 space-y-3">
		<label class="block text-sm">Currency symbol<input name="currency" value={data.currency} maxlength="3" required class="{field} w-24" /></label>
		<label class="block text-sm">Timezone<input name="timezone" value={data.timezone} required class={field} />
			{#if browserTz && browserTz !== data.timezone}<span class="text-xs text-muted">This device is on {browserTz}.</span>{/if}
		</label>
		{#if form?.section === 'general' && form.error}<p class="text-sm text-danger" role="alert">{form.error}</p>{/if}
		{#if form?.section === 'general' && form.saved}<p class="text-sm text-ok">Saved.</p>{/if}
		<button class={btn}>Save</button>
	</form>
</section>

<section class={card}>
	<h2 class="font-semibold">Account</h2>
	<p class="text-sm text-muted">Signed in as {data.email}</p>
	<form method="POST" action="?/password" use:enhance class="mt-3 space-y-3">
		<label class="block text-sm">Current password<input name="current" type="password" autocomplete="current-password" required class={field} /></label>
		<label class="block text-sm">New password (10+ characters)<input name="next" type="password" autocomplete="new-password" minlength="10" required class={field} /></label>
		<label class="block text-sm">Confirm new password<input name="confirm" type="password" autocomplete="new-password" required class={field} /></label>
		{#if form?.section === 'password' && form.error}<p class="text-sm text-danger" role="alert">{form.error}</p>{/if}
		{#if form?.section === 'password' && form.saved}<p class="text-sm text-ok">Password changed. Other devices were signed out.</p>{/if}
		<button class={btn}>Change password</button>
	</form>
</section>

<section class={card}>
	<h2 class="font-semibold">Export your data</h2>
	<p class="mb-3 text-sm text-muted">JSON has everything (categories, assignments, income, transactions, recurring rules). CSV has transactions only.</p>
	<div class="flex flex-wrap gap-2">
		<a class="rounded-lg border border-border px-4 py-2 text-sm hover:bg-bg" href="/settings/export?format=json" download>Download JSON</a>
		<a class="rounded-lg border border-border px-4 py-2 text-sm hover:bg-bg" href="/settings/export?format=csv" download>Download CSV</a>
	</div>
</section>
