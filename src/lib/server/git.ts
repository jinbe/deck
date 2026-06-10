import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

const exec = promisify(execFile);

async function git(repo: string, ...args: string[]): Promise<string> {
	const { stdout } = await exec('git', ['-C', repo, ...args]);
	return stdout;
}

export async function isGitRepo(dir: string): Promise<boolean> {
	try {
		await git(dir, 'rev-parse', '--git-dir');
		return true;
	} catch {
		return false;
	}
}

export async function listBranches(repo: string): Promise<string[]> {
	const out = await git(repo, 'branch', '-a', '--format', '%(refname:short)');
	const branches = out
		.trim()
		.split('\n')
		.filter(Boolean)
		.map((b) => b.replace(/^origin\//, ''))
		.filter((b) => b !== 'HEAD' && !b.includes(' '));
	return [...new Set(branches)];
}

// Worktrees land next to the repo: <repo>-worktrees/<branch>
export async function createWorktree(
	repo: string,
	branch: string,
	opts: { newBranch?: boolean; base?: string } = {}
): Promise<string> {
	const safe = branch.replace(/[^a-zA-Z0-9._/-]/g, '-').replace(/\//g, '-');
	const dir = path.join(path.dirname(repo), `${path.basename(repo)}-worktrees`, safe);
	if (fs.existsSync(dir)) return dir;
	fs.mkdirSync(path.dirname(dir), { recursive: true });
	const args = ['worktree', 'add'];
	if (opts.newBranch) {
		args.push('-b', branch, dir);
		if (opts.base) args.push(opts.base);
	} else {
		args.push(dir, branch);
	}
	await git(repo, ...args);
	return dir;
}
