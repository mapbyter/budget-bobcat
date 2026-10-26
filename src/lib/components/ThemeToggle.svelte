<script lang="ts">
	import { onMount } from 'svelte';
	type Mode = 'system' | 'light' | 'dark';
	let mode = $state<Mode>('system');

	function apply() {
		const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
		document.documentElement.dataset.theme = dark ? 'dark' : 'light';
		document.getElementById('theme-color')?.setAttribute('content', dark ? '#0f1513' : '#f4f6f4');
	}
	function cycle() {
		mode = mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system';
		try { localStorage.setItem('theme', mode); } catch {}
		apply();
	}
	onMount(() => {
		try { mode = (localStorage.getItem('theme') as Mode) || 'system'; } catch {}
		apply();
		const mq = matchMedia('(prefers-color-scheme: dark)');
		mq.addEventListener('change', apply);
		return () => mq.removeEventListener('change', apply);
	});
</script>

<button type="button" onclick={cycle} class="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-fg" aria-label="Change theme, currently {mode}">
	Theme: {mode}
</button>
