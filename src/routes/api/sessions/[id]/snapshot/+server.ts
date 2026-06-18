import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSession } from '$lib/server/sessions';
import { stableSnapshot } from '$lib/server/tmux';

export const GET: RequestHandler = async ({ params, url }) => {
	const session = await getSession(params.id);
	if (!session) error(404, 'session not found');
	if (session.kind !== 'shell' || !session.tmuxName) error(400, 'not a shell session');
	if (session.status === 'dead') return json({ text: '(session is dead)', dead: true });

	const lines = Number(url.searchParams.get('lines') ?? 500);
	try {
		const { text, cleared } = await stableSnapshot(session.tmuxName, Math.min(lines, 5000));
		return json({ text, cleared, dead: false });
	} catch {
		return json({ text: '(session is dead)', dead: true });
	}
};
