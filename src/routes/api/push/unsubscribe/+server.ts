import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { removeSub } from '$lib/server/push';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	if (typeof body.endpoint !== 'string') error(400, 'endpoint required');
	removeSub(body.endpoint);
	return json({ ok: true });
};
