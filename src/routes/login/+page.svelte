<script lang="ts">
	let { form } = $props();
</script>

<section class="mx-auto mt-10 max-w-sm rounded-2xl border border-border bg-surface p-6">
	<h1 class="text-xl font-semibold">Sign in</h1>
	<form method="POST" class="mt-5 space-y-4">
		<label class="block text-sm">Email
			<input name="email" type="email" autocomplete="email" required value={form?.email ?? ''} class="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2" />
		</label>
		<label class="block text-sm">Password
			<input name="password" type="password" autocomplete="current-password" required class="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2" />
		</label>
		{#if form?.error}<p class="text-sm text-danger" role="alert">{form.error}</p>{/if}
		<button class="w-full rounded-lg bg-accent px-4 py-2 font-medium text-accent-fg">Sign in</button>
	</form>
	<p class="mt-4 text-sm text-muted">No account yet? <a class="text-accent underline" href="/register">Create one</a></p>
</section>
