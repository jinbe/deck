import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { DeckSession } from '$lib/types';
import { getSession } from '$lib/server/sessions';
import { isGitRepo, worktreeDiff, worktreeDiffMeta } from '$lib/server/git';

// Diff the session's worktree against its base branch, off the session's *stored*
// cwd (never a request-supplied path), so this can't reach outside the directory
// the session already runs in. `metaOnly` returns just the summary for the badge.
async function diffResponse(session: DeckSession, metaOnly: boolean) {
	const cwd = session.cwd;
	const base = session.worktree?.base;
	if (!(await isGitRepo(cwd))) return { git: false };
	if (metaOnly) return { git: true, meta: await worktreeDiffMeta(cwd, base) };
	return { git: true, ...(await worktreeDiff(cwd, base)) };
}

// The Changes tab. Auth is enforced globally by hooks.server.ts.
export const GET: RequestHandler = async ({ params, url }) => {
	const session = await getSession(params.id);
	if (!session) error(404, 'session not found');
	return json(await diffResponse(session, url.searchParams.get('meta') === '1'));
};
