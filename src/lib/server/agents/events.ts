import type { DeckEvent } from './types';

// Builders for the normalised (Claude-shaped) events the chat view consumes.
// `stream_event`s are live-only (streaming display); the rest are persisted.

export function streamStart(): DeckEvent {
	return { type: 'stream_event', event: { type: 'message_start' } };
}

export function textDelta(text: string): DeckEvent {
	return {
		type: 'stream_event',
		event: { type: 'content_block_delta', delta: { type: 'text_delta', text } }
	};
}

export function assistantBlocks(content: unknown[]): DeckEvent {
	return { type: 'assistant', message: { role: 'assistant', content } };
}

export function assistantText(text: string): DeckEvent {
	return assistantBlocks([{ type: 'text', text }]);
}

export function toolUseBlock(id: string, name: string, input: unknown) {
	return { type: 'tool_use', id, name, input: input ?? {} };
}

export function toolResultEvent(toolUseId: string, content: unknown, isError = false): DeckEvent {
	return {
		type: 'user',
		message: {
			role: 'user',
			content: [{ type: 'tool_result', tool_use_id: toolUseId, content, is_error: isError }]
		}
	};
}

export function resultEvent(opts: {
	subtype?: string;
	durationMs?: number;
	cost?: number;
	numTurns?: number;
} = {}): DeckEvent {
	return {
		type: 'result',
		subtype: opts.subtype ?? 'success',
		duration_ms: opts.durationMs,
		total_cost_usd: opts.cost,
		num_turns: opts.numTurns
	};
}

export function deckError(text: string): DeckEvent {
	return { type: 'deck.error', text, ts: Date.now() };
}
