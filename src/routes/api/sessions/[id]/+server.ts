import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSession, deleteSession } from '$lib/server/sessions';

export const GET: RequestHandler = async ({ params }) => {
	const session = await getSession(params.id);
	if (!session) error(404, 'session not found');
	return json(session);
};

export const DELETE: RequestHandler = async ({ params }) => {
	await deleteSession(params.id);
	return json({ ok: true });
};
