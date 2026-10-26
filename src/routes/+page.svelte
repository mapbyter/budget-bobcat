<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	// "This month" is decided by the device's own calendar, so it matches the person using the app.
	onMount(() => {
		const d = new Date();
		goto(`/budget/${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, { replaceState: true });
	});
</script>

<p class="mt-8 text-muted">Opening this month's budget…</p>
