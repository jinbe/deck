<script lang="ts">
	import './layout.css';
	import { LayoutGrid, Sun, Moon, BookOpen } from '@lucide/svelte';

	let { children } = $props();

	let theme = $state('light');

	$effect(() => {
		theme = document.documentElement.dataset.theme || 'light';
	});

	function setTheme(next: string) {
		theme = next;
		document.documentElement.dataset.theme = next;
		localStorage.setItem('deck-theme', next);
	}

	const themes = [
		{ id: 'light', label: 'Light', icon: Sun },
		{ id: 'dark', label: 'Dark', icon: Moon },
		{ id: 'eink', label: 'E-ink', icon: BookOpen }
	];
</script>

<svelte:head>
	<title>deck</title>
</svelte:head>

<div class="flex min-h-screen flex-col bg-base-200">
	<header class="navbar min-h-12 border-b border-base-300 bg-base-100 px-3 sm:px-4">
		<div class="flex-1">
			<a href="/" class="flex items-center gap-2 text-lg font-semibold">
				<LayoutGrid size={20} />
				deck
			</a>
		</div>
		<div class="join">
			{#each themes as t (t.id)}
				<button
					class="btn join-item btn-sm {theme === t.id ? 'btn-active' : 'btn-ghost'}"
					onclick={() => setTheme(t.id)}
					title={t.label}
					aria-label={t.label}
				>
					<t.icon size={16} />
					<span class="hidden sm:inline">{t.label}</span>
				</button>
			{/each}
		</div>
	</header>

	<main class="mx-auto w-full max-w-5xl flex-1 p-3 sm:p-4">
		{@render children()}
	</main>
</div>
