import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStoredSession, updateSession } from '$lib/server/store';
import { refreshPrState } from '$lib/server/pr';

// Fetch the captured PR's live GitHub state once, persist it on `session.pr`, and
// return it. The header calls this on open and again only when the captured URL
// changes (no polling). A failed fetch returns `state: null` and leaves the chip
// at its last-known colour.
export const GET: RequestHandler = async ({ params }) => {
	if (!getStoredSession(params.id)) error(404, 'session not found');
	const state = await refreshPrState(params.id);
	return json({ state });
};

// Dismiss the captured PR chip. Capture is forward-only, so the next GitHub PR
// link an agent prints repopulates it; the one-time backfill won't bring the
// dismissed link back because its scan marker (prBackfilled) is already set.
export const DELETE: RequestHandler = async ({ params }) => {
	if (!getStoredSession(params.id)) error(404, 'session not found');
	updateSession(params.id, { pr: undefined });
	return json({ ok: true });
};
