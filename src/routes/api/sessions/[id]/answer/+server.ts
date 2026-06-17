import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSession } from '$lib/server/sessions';
import { resolveAsk } from '$lib/server/ask';
import { recordAnswer } from '$lib/server/claude';

// Answer a blocking `ask` (mcp__deck__ask). Records the picked options on the
// transcript (for display/persistence) and resolves the pending tool call so the
// turn continues.
export const POST: RequestHandler = async ({ params, request }) => {
	const session = await getSession(params.id);
	if (!session || session.kind !== 'claude') error(404, 'session not found');

	const body = await request.json();
	const text = String(body.text ?? '').trim();
	if (!text) error(400, 'empty answer');

	if (typeof body.toolUseId === 'string' && Array.isArray(body.answers)) {
		recordAnswer(session.id, body.toolUseId, body.answers);
	}
	const ok = resolveAsk(session.id, text);
	return json({ ok });
};
