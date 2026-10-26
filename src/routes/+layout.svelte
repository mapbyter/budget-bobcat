<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import QuickAdd from '$lib/components/QuickAdd.svelte';
	let { data, children } = $props();

	// New budgets start on UTC; adopt this device's timezone once so "today" is right for recurring items.
	onMount(() => {
		const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
		if (data.user?.timezone === 'UTC' && tz && tz !== 'UTC')
			fetch('/api/timezone', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ timezone: tz }) });
	});

	const ICONS: Record<string, string> = {
		budget: 'M3 7h18v12H3z M3 7l2-3h14l2 3 M16 13h2',
		transactions: 'M4 6h16 M4 12h16 M4 18h10',
		savings: 'M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2h0V5z M2 9v1c0 1.1.9 2 2 2h1 M16 11h.01',
		reports: 'M5 20V10 M12 20V4 M19 20v-7',
		more: 'M5 12h.01 M12 12h.01 M19 12h.01',
		categories: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
		recurring: 'M17 2l4 4-4 4 M3 11V9a3 3 0 0 1 3-3h15 M7 22l-4-4 4-4 M21 13v2a3 3 0 0 1-3 3H3',
		settings: 'M4 6h10 M18 6h2 M4 12h4 M12 12h8 M4 18h12'
	};
	const main = [['/', 'Budget', 'budget'], ['/transactions', 'Transactions', 'transactions'], ['/savings', 'Savings', 'savings'], ['/reports', 'Reports', 'reports']] as const;
	const extra = [['/categories', 'Categories', 'categories'], ['/recurring', 'Recurring', 'recurring'], ['/settings', 'Settings', 'settings']] as const;
	const path = $derived(page.url.pathname);
	const active = (href: string) => (href === '/' ? path === '/' || path.startsWith('/budget') : path.startsWith(href));
	const moreActive = $derived(path === '/more' || extra.some(([h]) => path.startsWith(h)));
</script>

{#snippet ico(name: string)}
	<svg viewBox="0 0 24 24" class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={ICONS[name]} /></svg>
{/snippet}

<svelte:head><title>Budget Bobcat</title></svelte:head>

{#if data.user}
	<div class="mx-auto flex max-w-6xl">
		<aside class="sticky top-0 hidden h-screen w-56 shrink-0 flex-col gap-1 border-r border-border p-4 md:flex">
			<a href="/" class="mb-4 flex items-center gap-2 px-2 text-lg font-semibold tracking-tight"><img src="/favicon.svg" alt="" class="h-7 w-7 rounded-md" />Budget Bobcat</a>
			{#each [...main, ...extra] as [href, label, icon]}
				<a {href} aria-current={active(href) ? 'page' : undefined}
					class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm {active(href) ? 'bg-accent/15 font-medium text-accent' : 'text-muted hover:bg-surface hover:text-fg'}">
					{@render ico(icon)}{label}
				</a>
			{/each}
			<div class="mt-auto flex flex-col gap-2">
				<ThemeToggle />
				<form method="POST" action="/logout"><button class="w-full rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-fg">Sign out</button></form>
			</div>
		</aside>

		<div class="min-w-0 flex-1">
			<header class="flex items-center justify-between px-4 py-3 md:hidden">
				<a href="/" class="flex items-center gap-2 text-lg font-semibold tracking-tight"><img src="/favicon.svg" alt="" class="h-7 w-7 rounded-md" />Budget Bobcat</a>
				<ThemeToggle />
			</header>
			<main class="mx-auto max-w-4xl px-4 pb-28 md:pb-16 md:pt-4">{@render children()}</main>
		</div>
	</div>

	<QuickAdd />

	<nav class="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface md:hidden" style="padding-bottom: env(safe-area-inset-bottom, 0px)" aria-label="Main">
		<div class="grid grid-cols-5">
			{#each main as [href, label, icon]}
				<a {href} aria-current={active(href) ? 'page' : undefined} class="flex flex-col items-center gap-0.5 py-2 text-[11px] {active(href) ? 'text-accent' : 'text-muted'}">{@render ico(icon)}{label}</a>
			{/each}
			<a href="/more" class="flex flex-col items-center gap-0.5 py-2 text-[11px] {moreActive ? 'text-accent' : 'text-muted'}">{@render ico('more')}More</a>
		</div>
	</nav>
{:else}
	<header class="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
		<a href="/" class="flex items-center gap-2 text-lg font-semibold tracking-tight"><img src="/favicon.svg" alt="" class="h-7 w-7 rounded-md" />Budget Bobcat</a>
		<ThemeToggle />
	</header>
	<main class="mx-auto max-w-5xl px-4 pb-16">{@render children()}</main>
{/if}
