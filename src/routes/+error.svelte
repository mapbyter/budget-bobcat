<script lang="ts">
	import { page } from '$app/state';
</script>

<section class="mx-auto mt-16 max-w-sm text-center">
	<h1 class="text-2xl font-semibold">{page.status === 404 ? 'Page not found' : 'Something went wrong'}</h1>
	<p class="mt-2 text-muted">{page.status === 404 ? "That page doesn't exist." : 'Please try again in a moment.'}</p>
	<a href="/" class="mt-6 inline-block rounded-lg bg-accent px-4 py-2 font-medium text-accent-fg">Back to budget</a>
</section>
