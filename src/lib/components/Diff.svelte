<script lang="ts">
	import type { DiffLine } from '$lib/diff';

	let { lines, max = 600 }: { lines: DiffLine[]; max?: number } = $props();

	const shown = $derived(lines.length > max ? lines.slice(0, max) : lines);
	const hidden = $derived(lines.length - shown.length);

	const sign: Record<DiffLine['type'], string> = {
		add: '+',
		del: '-',
		ctx: ' ',
		hunk: ' ',
		meta: ' '
	};

	function rowClass(t: DiffLine['type']): string {
		if (t === 'add') return 'bg-success/10 text-success';
		if (t === 'del') return 'bg-error/10 text-error';
		if (t === 'hunk') return 'bg-base-200 text-info';
		if (t === 'meta') return 'opacity-50';
		return 'text-base-content/80';
	}
</script>

<div class="diff-block overflow-hidden rounded-box border border-base-300 bg-base-100 font-mono text-xs leading-relaxed">
	{#each shown as ln, i (i)}
		<div class="flex {rowClass(ln.type)}">
			<span class="w-4 shrink-0 select-none text-center opacity-70">{sign[ln.type]}</span>
			<span class="flex-1 whitespace-pre-wrap break-all py-px pr-2">{ln.text || ' '}</span>
		</div>
	{/each}
	{#if hidden > 0}
		<div class="px-2 py-1 text-center opacity-50">+{hidden} more lines</div>
	{/if}
</div>
