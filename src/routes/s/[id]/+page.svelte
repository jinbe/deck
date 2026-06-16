<script lang="ts">
	import type { PageProps } from './$types';
	import ClaudeView from '$lib/components/ClaudeView.svelte';
	import ShellView from '$lib/components/ShellView.svelte';
	import { shortPath } from '$lib/time';
	import { ArrowLeft, Bot, Terminal } from '@lucide/svelte';

	let { data }: PageProps = $props();
	const session = $derived(data.session);
</script>

<svelte:head>
	<title>{session.title} · deck</title>
</svelte:head>

<div class="flex h-[calc(100dvh-7rem)] flex-col">
	<div class="mb-2 flex items-center gap-2">
		<a href="/" class="btn btn-ghost btn-sm shrink-0" aria-label="Back">
			<ArrowLeft size={16} />
		</a>
		{#if session.kind === 'claude'}
			<Bot size={16} class="shrink-0 opacity-70" />
		{:else}
			<Terminal size={16} class="shrink-0 opacity-70" />
		{/if}
		<div class="flex min-w-0 flex-1 items-baseline gap-2">
			<span class="truncate font-medium">{session.title}</span>
			<span class="hidden truncate text-xs opacity-60 sm:inline">{shortPath(session.cwd)}</span>
		</div>
		{#if session.kind === 'claude' && session.permissionMode === 'bypassPermissions'}
			<span class="badge badge-outline badge-sm shrink-0">yolo</span>
		{/if}
	</div>

	{#if session.kind === 'claude'}
		<ClaudeView {session} />
	{:else}
		<ShellView {session} />
	{/if}
</div>
