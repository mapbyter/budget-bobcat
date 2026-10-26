<h1 class="mt-2 text-2xl font-semibold tracking-tight">More</h1>
<ul class="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
	{#each [['/categories', 'Categories'], ['/recurring', 'Recurring'], ['/settings', 'Settings']] as [href, label]}
		<li class="border-t border-border first:border-t-0"><a {href} class="block px-4 py-3">{label}</a></li>
	{/each}
</ul>
<form method="POST" action="/logout" class="mt-4"><button class="rounded-lg border border-border px-4 py-2 text-sm">Sign out</button></form>
