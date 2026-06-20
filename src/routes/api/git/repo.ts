import { error } from '@sveltejs/kit';
import { isGitRepo } from '$lib/server/git';
import { expandTilde } from '$lib/server/fsutil';
import { isWithinProjects } from '$lib/server/confine';

// Resolve the `repo` query param shared by the git endpoints to a git directory
// confined to the registered project set. Returns null when the target is out
// of bounds or not a repo, so the caller answers with an empty list rather than
// running git against an arbitrary path on the host.
export async function resolveRepoParam(repo: string | null): Promise<string | null> {
	if (!repo) error(400, 'repo required');
	const dir = expandTilde(repo);
	if (!isWithinProjects(dir)) return null;
	if (!(await isGitRepo(dir))) return null;
	return dir;
}
