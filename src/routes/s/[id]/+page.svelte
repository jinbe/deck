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

<div class="flex h-[calc(100vh-7.5rem)] flex-col">
	<div class="mb-2 flex items-center gap-2">
		<a href="/" class="btn btn-ghost btn-sm" aria-label="Back">
			<ArrowLeft size={16} />
		</a>
		{#if session.kind === 'claude'}
			<Bot size={16} class="opacity-70" />
		{:else}
			<Terminal size={16} class="opacity-70" />
		{/if}
		<span class="font-medium">{session.title}</span>
		<span class="text-xs opacity-60">{shortPath(session.cwd)}</span>
		{#if session.kind === 'claude' && session.permissionMode === 'bypassPermissions'}
			<span class="badge badge-outline badge-sm">yolo</span>
		{/if}
	</div>

	{#if session.kind === 'claude'}
		<ClaudeView {session} />
	{:else}
		<ShellView {session} />
	{/if}
</div>
