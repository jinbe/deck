import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStoredSession, updateSession } from '$lib/server/store';

// Dismiss the captured PR chip. Capture is forward-only, so the next GitHub PR
// link an agent prints repopulates it; the one-time backfill won't bring the
// dismissed link back because its scan marker (prBackfilled) is already set.
export const DELETE: RequestHandler = async ({ params }) => {
	if (!getStoredSession(params.id)) error(404, 'session not found');
	updateSession(params.id, { pr: undefined });
	return json({ ok: true });
};
