<script lang="ts">
	let { data, form } = $props();
</script>

<section class="mx-auto mt-10 max-w-sm rounded-2xl border border-border bg-surface p-6">
	<h1 class="text-xl font-semibold">Create your account</h1>
	{#if data.open}
		<form method="POST" class="mt-5 space-y-4">
			<label class="block text-sm">Email
				<input name="email" type="email" autocomplete="email" required value={form?.email ?? ''} class="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2" />
			</label>
			<label class="block text-sm">Password (10+ characters)
				<input name="password" type="password" autocomplete="new-password" minlength="10" required class="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2" />
			</label>
			{#if form?.error}<p class="text-sm text-danger" role="alert">{form.error}</p>{/if}
			<button class="w-full rounded-lg bg-accent px-4 py-2 font-medium text-accent-fg">Create account</button>
		</form>
	{:else}
		<p class="mt-3 text-muted">Registration is closed. Ask the owner to set ALLOW_REGISTRATION=true.</p>
	{/if}
	<p class="mt-4 text-sm text-muted">Already have an account? <a class="text-accent underline" href="/login">Sign in</a></p>
</section>
