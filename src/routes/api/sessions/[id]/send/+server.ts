import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSession } from '$lib/server/sessions';
import { startTurn, stopTurn, isTurnRunning } from '$lib/server/claude';
import { sendKeys, sendRawKey } from '$lib/server/tmux';
import { updateSession } from '$lib/server/store';

export const POST: RequestHandler = async ({ params, request }) => {
	const session = await getSession(params.id);
	if (!session) error(404, 'session not found');

	const body = await request.json();

	if (body.action === 'stop') {
		if (session.kind === 'claude') stopTurn(session.id);
		return json({ ok: true });
	}

	const text: string = body.text ?? '';

	if (session.kind === 'claude') {
		if (!text.trim()) error(400, 'empty prompt');
		if (isTurnRunning(session.id)) error(409, 'a turn is already running');
		startTurn(session.id, text);
		return json({ ok: true, status: 'running' });
	}

	if (!session.tmuxName) error(400, 'session has no tmux target');
	if (typeof body.key === 'string' && /^[A-Za-z0-9-]+$/.test(body.key)) {
		await sendRawKey(session.tmuxName, body.key);
	} else {
		await sendKeys(session.tmuxName, text, body.submit !== false);
	}
	if (session.managed) updateSession(session.id, { lastActiveAt: Date.now() });
	return json({ ok: true });
};
