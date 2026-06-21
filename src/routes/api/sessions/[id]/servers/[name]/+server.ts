import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { startServer, stopServer, restartServer } from '$lib/server/devservers';

// Start / stop / restart one configured dev server. The action targets the
// session's *own* worktree (resolved server-side from the stored session), never
// a request-supplied path.
const ACTIONS = { start: startServer, stop: stopServer, restart: restartServer } as const;

// Own-property lookup only, so an inherited key (toString, constructor, ...) from
// untrusted input can't slip past the guard into an unexpected call path.
function actionFor(name: unknown) {
	if (typeof name !== 'string') return undefined;
	if (!Object.hasOwn(ACTIONS, name)) return undefined;
	return ACTIONS[name as keyof typeof ACTIONS];
}

export const POST: RequestHandler = async ({ params, request }) => {
	const body = await request.json().catch(() => ({}));
	const action = actionFor(body.action);
	if (!action) error(400, 'invalid action');
	try {
		return json(await action(params.id, params.name));
	} catch (e) {
		error(400, e instanceof Error ? e.message : 'failed to run action');
	}
};
