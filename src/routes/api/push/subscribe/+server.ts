import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { addSub } from '$lib/server/push';

export const POST: RequestHandler = async ({ request }) => {
	const sub = await request.json();
	if (!sub || typeof sub.endpoint !== 'string' || !sub.keys) error(400, 'invalid subscription');
	addSub(sub);
	return json({ ok: true });
};
