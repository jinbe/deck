<script lang="ts">
	import type { DeckSession } from '$lib/types';
	import { relativeTime, shortPath } from '$lib/time';
	import NewSessionModal from '$lib/components/NewSessionModal.svelte';
	import { Bot, Terminal, Plus, Trash2, RefreshCw } from '@lucide/svelte';

	let sessions = $state<DeckSession[]>([]);
	let filter = $state<'all' | 'claude' | 'shell'>('all');
	let modalOpen = $state(false);
	let loaded = $state(false);

	async function refresh() {
		const res = await fetch('/api/sessions');
		if (res.ok) sessions = await res.json();
		loaded = true;
	}

	$effect(() => {
		refresh();
		const interval = setInterval(refresh, 5000);
		return () => clearInterval(interval);
	});

	const visible = $derived(filter === 'all' ? sessions : sessions.filter((s) => s.kind === filter));

	async function remove(session: DeckSession, e: Event) {
		e.preventDefault();
		e.stopPropagation();
		if (!confirm(`Kill and remove "${session.title}"?`)) return;
		await fetch(`/api/sessions/${encodeURIComponent(session.id)}`, { method: 'DELETE' });
		refresh();
	}

	function statusClass(s: DeckSession) {
		if (s.status === 'running') return 'badge-warning';
		if (s.status === 'error') return 'badge-error';
		if (s.status === 'dead') return 'badge-ghost';
		return 'badge-success';
	}
</script>

<div class="mb-4 flex items-center gap-2">
	<div class="join">
		{#each ['all', 'claude', 'shell'] as const as f (f)}
			<button
				class="btn join-item btn-sm {filter === f ? 'btn-active' : ''}"
				onclick={() => (filter = f)}
			>
				{f}
			</button>
		{/each}
	</div>
	<div class="flex-1"></div>
	<button class="btn btn-ghost btn-sm" onclick={refresh} aria-label="Refresh">
		<RefreshCw size={16} />
	</button>
	<button class="btn btn-sm btn-primary" onclick={() => (modalOpen = true)}>
		<Plus size={16} /> New
	</button>
</div>

{#if !loaded}
	<p class="p-8 text-center opacity-60">Loading sessions...</p>
{:else if visible.length === 0}
	<div class="rounded-box border border-base-300 bg-base-100 p-10 text-center opacity-70">
		No sessions yet. Create one to get started.
	</div>
{:else}
	<ul class="space-y-2">
		{#each visible as s (s.id)}
			<li>
				<a
					href={`/s/${encodeURIComponent(s.id)}`}
					class="flex items-center gap-3 rounded-box border border-base-300 bg-base-100 px-4 py-3 hover:border-base-content/30"
				>
					{#if s.kind === 'claude'}
						<Bot size={18} class="shrink-0 opacity-70" />
					{:else}
						<Terminal size={18} class="shrink-0 opacity-70" />
					{/if}
					<div class="min-w-0 flex-1">
						<div class="truncate font-medium">{s.title}</div>
						<div class="truncate text-xs opacity-60">{shortPath(s.cwd)}</div>
					</div>
					{#if s.kind === 'shell' && s.attached}
						<span class="badge badge-outline badge-sm">attached</span>
					{/if}
					{#if s.managed === false}
						<span class="badge badge-ghost badge-sm">adhoc</span>
					{/if}
					<span class="badge badge-sm {statusClass(s)}">{s.status}</span>
					<span class="w-10 text-right text-xs tabular-nums opacity-60">
						{relativeTime(s.lastActiveAt)}
					</span>
					<button
						class="btn btn-ghost btn-xs"
						onclick={(e) => remove(s, e)}
						aria-label="Remove session"
					>
						<Trash2 size={14} />
					</button>
				</a>
			</li>
		{/each}
	</ul>
{/if}

<NewSessionModal bind:open={modalOpen} />
