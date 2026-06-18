<script lang="ts">
	import type { Issue, IssueSourceType, Project } from '$lib/types';
	import { RefreshCw, TriangleAlert, ChevronRight } from '@lucide/svelte';

	let { project, onpick }: { project: Project; onpick: (issue: Issue) => void } = $props();

	type SourceError = { sourceId: string; message: string };

	const BADGE: Record<IssueSourceType, { label: string; cls: string }> = {
		github: { label: 'GH', cls: 'badge-neutral' },
		linear: { label: 'LIN', cls: 'badge-primary' },
		clickup: { label: 'CU', cls: 'badge-secondary' }
	};

	let issues = $state<Issue[]>([]);
	let errors = $state<SourceError[]>([]);
	let loading = $state(false);
	let loadError = $state('');
	let filter = $state<'all' | IssueSourceType>('all');
	let expanded = $state<string | null>(null);

	// Only offer chips for source types this project actually has.
	const presentTypes = $derived([...new Set((project.sources ?? []).map((s) => s.type))]);
	const visible = $derived(filter === 'all' ? issues : issues.filter((i) => i.sourceType === filter));

	async function load(refresh = false) {
		loading = true;
		loadError = '';
		try {
			const res = await fetch(
				`/api/issues?project=${encodeURIComponent(project.path)}${refresh ? '&refresh=1' : ''}`
			);
			if (!res.ok) {
				loadError = (await res.json()).message ?? 'failed to load issues';
				return;
			}
			const data = await res.json();
			issues = data.issues ?? [];
			errors = data.errors ?? [];
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'failed to load issues';
		} finally {
			loading = false;
		}
	}

	// Reload whenever the bound project changes.
	$effect(() => {
		project.path;
		load();
	});

	function key(i: Issue) {
		return `${i.sourceId}:${i.id}`;
	}
</script>

<div class="rounded-box border border-base-300 bg-base-200/40 p-2">
	<div class="mb-2 flex items-center gap-1">
		<div class="join">
			{#each ['all', ...presentTypes] as f (f)}
				<button
					class="btn join-item btn-xs {filter === f ? 'btn-active' : ''}"
					onclick={() => (filter = f as 'all' | IssueSourceType)}
				>
					{f === 'all' ? 'All' : BADGE[f as IssueSourceType].label}
				</button>
			{/each}
		</div>
		<div class="flex-1"></div>
		<button class="btn btn-ghost btn-xs" onclick={() => load(true)} disabled={loading} aria-label="Refresh">
			<RefreshCw size={13} class={loading ? 'animate-spin' : ''} />
		</button>
	</div>

	{#if loadError}
		<div class="alert alert-error py-1 text-xs">{loadError}</div>
	{/if}
	{#each errors as e (e.sourceId)}
		<div class="alert alert-warning mb-1 py-1 text-xs">source error: {e.message}</div>
	{/each}

	<div class="max-h-64 overflow-y-auto">
		{#if loading && !issues.length}
			<p class="p-4 text-center text-sm opacity-60">Loading…</p>
		{:else if !visible.length}
			<p class="p-4 text-center text-sm opacity-60">No issues.</p>
		{:else}
			{#each visible as issue (key(issue))}
				<div class="border-b border-base-300 last:border-0">
					<div class="flex items-center gap-2 py-1.5">
						<button class="flex min-w-0 flex-1 items-center gap-2 text-left" onclick={() => onpick(issue)}>
							<span class="badge badge-sm {BADGE[issue.sourceType].cls} shrink-0">
								{BADGE[issue.sourceType].label}
							</span>
							<span class="shrink-0 font-mono text-xs opacity-70">{issue.id}</span>
							<span class="min-w-0 flex-1 truncate text-sm">{issue.title}</span>
						</button>
						{#if issue.blockers.length}
							<button
								class="btn btn-ghost btn-xs gap-1 text-warning"
								onclick={() => (expanded = expanded === key(issue) ? null : key(issue))}
								aria-label="Show blockers"
							>
								<TriangleAlert size={13} />
								<ChevronRight size={12} class={expanded === key(issue) ? 'rotate-90' : ''} />
							</button>
						{/if}
					</div>
					{#if issue.blockers.length && expanded === key(issue)}
						<div class="pb-1.5 pl-10 text-xs opacity-70">
							<div class="mb-0.5 font-medium">Blocked by:</div>
							{#each issue.blockers as b (b.id)}
								<div class="truncate"><span class="font-mono">{b.id}</span> {b.title}</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</div>
