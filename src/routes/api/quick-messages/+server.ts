import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listQuickMessages, saveQuickMessages } from '$lib/server/quickmessages';

export const GET: RequestHandler = async () => json(listQuickMessages());

// Replace the whole list. A schema mismatch is a 400, not a 500.
export const PUT: RequestHandler = async ({ request }) => {
	try {
		return json(saveQuickMessages(await request.json()));
	} catch (e) {
		error(400, e instanceof Error ? e.message : 'invalid quick messages');
	}
};
