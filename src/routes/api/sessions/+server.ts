import { json, error } from '@sveltejs/kit';
import fs from 'node:fs';
import type { RequestHandler } from './$types';
import { isAgentKind, type SessionKind } from '$lib/types';
import { listSessions, createSession } from '$lib/server/sessions';
import { createWorktree, isGitRepo } from '$lib/server/git';
import { agentSend } from '$lib/server/agents/dispatch';
import { listProjects, updateProject } from '$lib/server/store';
import { expandTilde } from '$lib/server/fsutil';

const KINDS: SessionKind[] = ['claude', 'pi', 'codex', 'shell'];

export const GET: RequestHandler = async () => {
	return json(await listSessions());
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { kind, title, model, provider, permissionMode, command, prompt } = body;
	let cwd: string = expandTilde(String(body.cwd ?? ''));

	if (!cwd || !fs.existsSync(cwd)) error(400, 'cwd does not exist');
	if (!KINDS.includes(kind)) error(400, 'invalid kind');

	let worktree: { repo: string; branch: string; createdBranch: boolean } | undefined;
	if (body.worktree?.branch) {
		if (!(await isGitRepo(cwd))) error(400, 'worktree requested but cwd is not a git repo');
		const repo = cwd;
		cwd = await createWorktree(repo, body.worktree.branch, {
			newBranch: body.worktree.newBranch,
			base: body.worktree.base || undefined
		});
		worktree = { repo, branch: body.worktree.branch, createdBranch: !!body.worktree.newBranch };
		// remember the chosen base branch on the project for next time
		if (body.worktree.newBranch && listProjects().some((p) => p.path === repo)) {
			updateProject(repo, { lastBase: body.worktree.base || undefined });
		}
	}

	const session = await createSession({
		kind,
		title: title || body.worktree?.branch,
		cwd,
		model,
		provider,
		permissionMode,
		command,
		worktree
	});

	if (isAgentKind(kind) && typeof prompt === 'string' && prompt.trim()) {
		const resolved = prompt
			.replaceAll('[title]', session.title)
			.replaceAll('[branch]', body.worktree?.branch ?? '')
			.replaceAll('[cwd]', cwd);
		agentSend(session, resolved.trim());
	}

	return json(session, { status: 201 });
};
