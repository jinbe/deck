import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listBranches, isGitRepo } from '$lib/server/git';

export const GET: RequestHandler = async ({ url }) => {
	const repo = url.searchParams.get('repo');
	if (!repo) error(400, 'repo required');
	if (!(await isGitRepo(repo))) return json([]);
	return json(await listBranches(repo));
};
