import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listBranches } from '$lib/server/git';
import { resolveRepoParam } from '../repo';

export const GET: RequestHandler = async ({ url }) => {
	const dir = await resolveRepoParam(url.searchParams.get('repo'));
	if (!dir) return json([]);
	return json(await listBranches(dir));
};
