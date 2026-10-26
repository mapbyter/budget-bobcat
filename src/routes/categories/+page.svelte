<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props();
	let showArchived = $state(false);

	type G = (typeof data.groups)[number];
	type C = (typeof data.cats)[number];
	const subgroups = (pid: string | null) => data.groups.filter((g) => g.parentId === pid);
	const catsIn = (gid: string) => data.cats.filter((c) => c.groupId === gid && (showArchived || !c.archived));

	// indented list of groups for "move to" menus, skipping a group's own subtree
	function groupOptions(excludeId?: string, pid: string | null = null, depth = 0): { id: string; label: string }[] {
		return subgroups(pid).flatMap((g) =>
			g.id === excludeId ? [] : [{ id: g.id, label: '\u2003'.repeat(depth) + g.name }, ...groupOptions(excludeId, g.id, depth + 1)]
		);
	}
	const btn = 'rounded-md border border-border px-2 py-1 text-sm hover:bg-bg';
	const input = 'rounded-md border border-border bg-bg px-2 py-1 text-sm';
</script>

{#snippet act(name: string, fields: Record<string, string>, label: string, cls = btn)}
	<form method="POST" action="?/{name}" use:enhance class="inline">
		{#each Object.entries(fields) as [k, v]}<input type="hidden" name={k} value={v} />{/each}
		<button class={cls}>{label}</button>
	</form>
{/snippet}

{#snippet menu(kind: 'group' | 'category', item: G | C)}
	<details class="relative">
		<summary class="cursor-pointer select-none rounded-md px-2 py-1 text-sm text-muted hover:bg-bg">Edit</summary>
		<div class="mt-2 space-y-2 rounded-xl border border-border bg-bg p-3 sm:absolute sm:right-0 sm:z-10 sm:w-72 sm:bg-surface sm:shadow-lg">
			<div class="flex gap-2">
				{@render act('reorder', { kind, id: item.id, dir: 'up' }, 'Move up')}
				{@render act('reorder', { kind, id: item.id, dir: 'down' }, 'Move down')}
			</div>
			<form method="POST" action="?/rename" use:enhance class="flex gap-2">
				<input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={item.id} />
				<input name="name" value={item.name} maxlength="60" required class="{input} min-w-0 flex-1" aria-label="Name" />
				<button class={btn}>Rename</button>
			</form>
			<form method="POST" action="?/move" use:enhance class="flex gap-2">
				<input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={item.id} />
				<select name="target" class="{input} min-w-0 flex-1" aria-label="Move to">
					{#if kind === 'group'}<option value="">Top level</option>{/if}
					{#each groupOptions(kind === 'group' ? item.id : undefined) as o}<option value={o.id}>{o.label}</option>{/each}
				</select>
				<button class={btn}>Move</button>
			</form>
			{#if kind === 'category'}
				{@const c = item as C}
				<div class="flex flex-wrap gap-2">
					{@render act('setFlag', { id: c.id, field: 'rollover', value: String(!c.rollover) }, c.rollover ? 'Turn off rollover' : 'Turn on rollover')}
					{@render act('setFlag', { id: c.id, field: 'archived', value: String(!c.archived) }, c.archived ? 'Restore' : 'Archive')}
				</div>
			{:else}
				{@render act('deleteGroup', { id: item.id }, 'Delete group', btn + ' text-danger')}
			{/if}
		</div>
	</details>
{/snippet}

{#snippet addForm(parentId: string | null)}
	<form method="POST" action="?/add" use:enhance class="flex flex-wrap gap-2">
		<input type="hidden" name="parentId" value={parentId ?? ''} />
		<input name="name" placeholder={parentId ? 'New name' : 'New top-level group'} maxlength="60" required class="{input} min-w-0 flex-1" aria-label="Name" />
		{#if parentId}
			<select name="kind" class={input} aria-label="What to add">
				<option value="spending">Category</option>
				<option value="savings">Savings category</option>
				<option value="group">Subgroup</option>
			</select>
		{:else}<input type="hidden" name="kind" value="group" />{/if}
		<button class={btn}>Add</button>
	</form>
{/snippet}

{#snippet branch(pid: string | null, depth: number)}
	{#each subgroups(pid) as g (g.id)}
		<li class="border-t border-border first:border-t-0">
			<div class="flex items-center justify-between gap-2 py-3" style="padding-left: {depth * 1.25}rem">
				<h3 class="font-semibold">{g.name}</h3>
				{@render menu('group', g)}
			</div>
			<ul>
				{@render branch(g.id, depth + 1)}
				{#each catsIn(g.id) as c (c.id)}
					<li class="flex items-center justify-between gap-2 border-t border-border py-2 {c.archived ? 'opacity-50' : ''}" style="padding-left: {(depth + 1) * 1.25}rem">
						<span class="min-w-0 truncate">
							{c.name}
							{#if c.type === 'savings'}<span class="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">Savings</span>{/if}
							{#if !c.rollover}<span class="ml-2 text-xs text-muted">No rollover</span>{/if}
							{#if c.archived}<span class="ml-2 text-xs text-muted">Archived</span>{/if}
						</span>
						{@render menu('category', c)}
					</li>
				{/each}
				<li class="border-t border-border py-2" style="padding-left: {(depth + 1) * 1.25}rem">
					<details>
						<summary class="cursor-pointer text-sm text-accent">Add to {g.name}</summary>
						<div class="mt-2">{@render addForm(g.id)}</div>
					</details>
				</li>
			</ul>
		</li>
	{/each}
{/snippet}

<svelte:head><title>Categories · Budget Bobcat</title></svelte:head>

<div class="mt-4 flex flex-wrap items-center justify-between gap-2">
	<h1 class="text-2xl font-semibold tracking-tight">Categories</h1>
	<label class="flex items-center gap-2 text-sm text-muted">
		<input type="checkbox" bind:checked={showArchived} /> Show archived
	</label>
</div>
<p class="mt-1 max-w-prose text-sm text-muted">Groups can hold subgroups and categories, nested as deep as you like. Savings categories move money out of your spendable budget.</p>

{#if form?.error}<p class="mt-3 text-sm text-danger" role="alert">{form.error}</p>{/if}

{#if data.groups.length === 0}
	<div class="mt-6 rounded-2xl border border-border bg-surface p-6">
		<h2 class="font-semibold">Start with a layout</h2>
		<p class="mt-1 text-sm text-muted">Adds Expenses (with an Insurance subgroup) and Savings & investments. Rename or remove anything afterwards.</p>
		<form method="POST" action="?/seed" use:enhance class="mt-4"><button class="rounded-lg bg-accent px-4 py-2 font-medium text-accent-fg">Add starter layout</button></form>
	</div>
{/if}

<ul class="mt-6 rounded-2xl border border-border bg-surface px-4">
	{@render branch(null, 0)}
</ul>

<div class="mt-4 rounded-2xl border border-border bg-surface p-4">{@render addForm(null)}</div>
