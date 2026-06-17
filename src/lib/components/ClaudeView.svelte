<script lang="ts">
	import type { DeckSession } from '$lib/types';
	import Linked from './Linked.svelte';
	import ToolCall from './ToolCall.svelte';
	import AskQuestion from './AskQuestion.svelte';
	import { Send, Square, ChevronDown, ArrowDown, Paperclip, X } from '@lucide/svelte';

	let { session }: { session: DeckSession } = $props();

	type AnyEvent = Record<string, any>;

	let events = $state<AnyEvent[]>([]);
	let status = $state<string>(session.status);
	let liveText = $state('');
	let input = $state('');
	let scroller: HTMLDivElement | undefined = $state();
	let fileInput: HTMLInputElement | undefined = $state();
	let atBottom = $state(true);
	let dragging = $state(false);

	type Attachment = { media_type: string; data: string; url: string };
	let attachments = $state<Attachment[]>([]);

	// Pair tool_result blocks back to their originating tool_use by id.
	const resultsById = $derived.by(() => {
		const m = new Map<string, AnyEvent>();
		for (const ev of events) {
			if (ev.type !== 'user') continue;
			const content = ev.message?.content;
			if (!Array.isArray(content)) continue;
			for (const b of content) {
				if (b.type === 'tool_result' && b.tool_use_id) m.set(b.tool_use_id, b);
			}
		}
		return m;
	});

	// Questions go through deck's blocking MCP `ask` tool. The pick is posted to
	// /answer, which resolves the still-open tool call (continuing the same turn)
	// and records a deck.answer marker so the chosen options persist on reload.
	const answeredQuestions = $derived.by(() => {
		const m = new Map<string, { header: string; labels: string[] }[]>();
		for (const ev of events) {
			if ((ev.type === 'deck.answer' || ev.type === 'deck.user') && ev.answersFor)
				m.set(ev.answersFor, ev.answers ?? []);
		}
		return m;
	});

	function isAskTool(block: AnyEvent): boolean {
		return block.name === 'mcp__deck__ask' || block.name === 'AskUserQuestion';
	}

	async function answerQuestion(
		id: string,
		text: string,
		answers: { header: string; labels: string[] }[]
	) {
		atBottom = true;
		await fetch(`/api/sessions/${encodeURIComponent(session.id)}/answer`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ text, toolUseId: id, answers })
		});
	}

	$effect(() => {
		const source = new EventSource(`/api/sessions/${encodeURIComponent(session.id)}/events`);
		source.addEventListener('transcript', (e) => {
			const ev = JSON.parse(e.data);
			if (ev.type === 'stream_event') {
				handleStream(ev);
				return;
			}
			if (ev.type === 'assistant') liveText = '';
			events = [...events, ev];
			maybeScroll();
		});
		source.addEventListener('status', (e) => {
			status = JSON.parse(e.data);
			if (status !== 'running') liveText = '';
		});
		return () => source.close();
	});

	function handleStream(ev: AnyEvent) {
		const t = ev.event?.type;
		if (t === 'message_start') {
			liveText = '';
		} else if (t === 'content_block_delta' && ev.event.delta?.type === 'text_delta') {
			liveText += ev.event.delta.text;
			maybeScroll();
		}
	}

	function onScroll() {
		if (!scroller) return;
		atBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 120;
	}

	function maybeScroll() {
		if (atBottom) queueMicrotask(() => scroller?.scrollTo({ top: scroller.scrollHeight }));
	}

	function forceScroll() {
		scroller?.scrollTo({ top: scroller.scrollHeight });
		atBottom = true;
	}

	function toBase64(buf: ArrayBuffer): string {
		let bin = '';
		const bytes = new Uint8Array(buf);
		const chunk = 0x8000;
		for (let i = 0; i < bytes.length; i += chunk) {
			bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
		}
		return btoa(bin);
	}

	async function addFile(file: File) {
		if (!file.type.startsWith('image/')) return;
		const data = toBase64(await file.arrayBuffer());
		attachments = [...attachments, { media_type: file.type, data, url: `data:${file.type};base64,${data}` }];
	}

	function onPaste(e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items) return;
		for (const it of items) {
			if (it.kind === 'file' && it.type.startsWith('image/')) {
				const f = it.getAsFile();
				if (f) addFile(f);
			}
		}
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		const files = e.dataTransfer?.files;
		if (files) for (const f of files) addFile(f);
	}

	function onPick(e: Event) {
		const files = (e.target as HTMLInputElement).files;
		if (files) for (const f of files) addFile(f);
		(e.target as HTMLInputElement).value = '';
	}

	function removeAttachment(i: number) {
		attachments = attachments.filter((_, k) => k !== i);
	}

	const canSend = $derived(!!input.trim() || attachments.length > 0);

	async function send() {
		if (!canSend) return;
		const text = input.trim();
		const images = attachments.map((a) => ({ media_type: a.media_type, data: a.data }));
		input = '';
		attachments = [];
		atBottom = true;
		await fetch(`/api/sessions/${encodeURIComponent(session.id)}/send`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ text, images: images.length ? images : undefined })
		});
	}

	async function interrupt() {
		await fetch(`/api/sessions/${encodeURIComponent(session.id)}/send`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ action: 'interrupt' })
		});
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			send();
		}
	}

	function contentBlocks(event: AnyEvent): AnyEvent[] {
		const content = event.message?.content;
		return Array.isArray(content) ? content : [];
	}

	function fmtCost(event: AnyEvent): string {
		const parts: string[] = [];
		if (typeof event.duration_ms === 'number') parts.push(`${(event.duration_ms / 1000).toFixed(1)}s`);
		if (typeof event.num_turns === 'number') parts.push(`${event.num_turns} turns`);
		if (typeof event.total_cost_usd === 'number') parts.push(`$${event.total_cost_usd.toFixed(4)}`);
		if (event.subtype && event.subtype !== 'success') parts.push(event.subtype);
		return parts.join(' · ');
	}
</script>

<div
	class="relative flex h-full min-h-0 flex-col"
	role="group"
	ondragover={(e) => {
		e.preventDefault();
		dragging = true;
	}}
	ondragleave={() => (dragging = false)}
	ondrop={onDrop}
>
	<div
		bind:this={scroller}
		onscroll={onScroll}
		class="min-h-0 flex-1 space-y-3 overflow-y-auto px-1 py-3"
	>
		{#each events as event, i (i)}
			{#if event.type === 'deck.user'}
				<div class="chat chat-end">
					<div class="chat-bubble chat-bubble-primary max-w-[85%] break-words whitespace-pre-wrap">
						{#if event.images?.length}
							<div class="mb-2 flex flex-wrap gap-2">
								{#each event.images as img, k (k)}
									<img
										src={`data:${img.media_type};base64,${img.data}`}
										alt="attachment"
										class="max-h-40 rounded-box border border-base-300"
									/>
								{/each}
							</div>
						{/if}
						{#if event.text}<Linked text={event.text} />{/if}
					</div>
				</div>
			{:else if event.type === 'deck.error'}
				<div class="alert alert-error py-2 text-sm break-words whitespace-pre-wrap">{event.text}</div>
			{:else if event.type === 'assistant'}
				{#each contentBlocks(event) as block, j (j)}
					{#if block.type === 'text' && block.text?.trim()}
						<div class="chat chat-start">
							<div class="chat-bubble max-w-[85%] break-words whitespace-pre-wrap bg-base-100 text-base-content">
								<Linked text={block.text} />
							</div>
						</div>
					{:else if block.type === 'thinking' && block.thinking?.trim()}
						<details class="px-2 text-xs opacity-50">
							<summary class="cursor-pointer select-none">
								<ChevronDown size={12} class="inline" /> thinking
							</summary>
							<pre class="break-words whitespace-pre-wrap pt-1">{block.thinking}</pre>
						</details>
					{:else if block.type === 'tool_use' && isAskTool(block)}
						<AskQuestion
							{block}
							answered={answeredQuestions.has(block.id)}
							answer={answeredQuestions.get(block.id)}
							onanswer={(text, answers) => answerQuestion(block.id, text, answers)}
						/>
					{:else if block.type === 'tool_use'}
						<ToolCall {block} result={resultsById.get(block.id)} />
					{/if}
				{/each}
			{:else if event.type === 'result'}
				<div class="px-2 text-center text-xs opacity-50">{fmtCost(event)}</div>
			{/if}
		{/each}

		{#if liveText.trim()}
			<div class="chat chat-start">
				<div class="chat-bubble max-w-[85%] break-words whitespace-pre-wrap bg-base-100 text-base-content">
					<Linked text={liveText} />
				</div>
			</div>
		{:else if status === 'running'}
			<div class="px-2 text-sm opacity-60">working...</div>
		{/if}
	</div>

	{#if dragging}
		<div class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-box border-2 border-dashed border-primary bg-base-100/70 text-sm font-medium">
			Drop images to attach
		</div>
	{/if}

	{#if !atBottom}
		<button
			class="btn btn-circle btn-sm absolute bottom-28 left-1/2 -translate-x-1/2 shadow"
			onclick={forceScroll}
			aria-label="Jump to latest"
		>
			<ArrowDown size={16} />
		</button>
	{/if}

	<div class="border-t border-base-300 bg-base-100 p-2 sm:p-3">
		{#if attachments.length}
			<div class="mb-2 flex flex-wrap gap-2">
				{#each attachments as a, i (i)}
					<div class="relative">
						<img src={a.url} alt="attachment" class="h-16 w-16 rounded-box border border-base-300 object-cover" />
						<button
							class="btn btn-circle btn-xs absolute -top-2 -right-2"
							onclick={() => removeAttachment(i)}
							aria-label="Remove attachment"
						>
							<X size={12} />
						</button>
					</div>
				{/each}
			</div>
		{/if}
		<div class="flex items-end gap-1.5 sm:gap-2">
			<input
				bind:this={fileInput}
				type="file"
				accept="image/*"
				multiple
				class="hidden"
				onchange={onPick}
			/>
			<button
				class="btn btn-ghost btn-square"
				onclick={() => fileInput?.click()}
				aria-label="Attach image"
				title="Attach image"
			>
				<Paperclip size={16} />
			</button>
			<textarea
				class="textarea min-h-12 flex-1"
				rows="2"
				placeholder={status === 'running'
					? 'queue a follow-up (ctrl/cmd+enter)'
					: 'message (ctrl/cmd+enter, paste images)'}
				bind:value={input}
				onkeydown={onKeydown}
				onpaste={onPaste}
			></textarea>
			{#if status === 'running'}
				<button class="btn btn-error" onclick={interrupt} aria-label="Interrupt">
					<Square size={16} /> <span class="hidden sm:inline">Interrupt</span>
				</button>
			{/if}
			<button class="btn btn-primary" onclick={send} disabled={!canSend} aria-label="Send">
				<Send size={16} /> <span class="hidden sm:inline">Send</span>
			</button>
		</div>
	</div>
</div>
