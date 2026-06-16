import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSession } from '$lib/server/sessions';
import { sendMessage, interrupt, type ImageInput } from '$lib/server/claude';
import { sendKeys, sendRawKey } from '$lib/server/tmux';
import { updateSession } from '$lib/server/store';

const IMAGE_TYPE = /^image\/(png|jpe?g|gif|webp)$/;

function parseImages(raw: unknown): ImageInput[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.filter(
			(i): i is ImageInput =>
				!!i &&
				typeof i.media_type === 'string' &&
				IMAGE_TYPE.test(i.media_type) &&
				typeof i.data === 'string' &&
				i.data.length < 12_000_000
		)
		.slice(0, 8);
}

export const POST: RequestHandler = async ({ params, request }) => {
	const session = await getSession(params.id);
	if (!session) error(404, 'session not found');

	const body = await request.json();

	if (body.action === 'interrupt' || body.action === 'stop') {
		if (session.kind === 'claude') interrupt(session.id);
		return json({ ok: true });
	}

	const text: string = body.text ?? '';

	if (session.kind === 'claude') {
		const images = parseImages(body.images);
		if (!text.trim() && images.length === 0) error(400, 'empty prompt');
		// no running guard: a message sent mid-turn is queued and runs next
		sendMessage(session.id, text, images.length ? images : undefined);
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
