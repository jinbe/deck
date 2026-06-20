import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listProjects } from './store';

// Confinement for request-supplied filesystem/git paths. The auth token (or the
// tailnet under DECK_NO_AUTH) is not a fine-grained boundary, so endpoints that
// reach fs/git sinks must keep their target within the registered project set
// rather than anywhere the server user can read.

// Canonical, symlink-free absolute form, or null if the path doesn't resolve.
// Symlinks are followed so a link inside an allowed root can't point out of it,
// and a path that doesn't exist is treated as out of bounds.
function canonical(p: string): string | null {
	try {
		return fs.realpathSync(p);
	} catch {
		return null;
	}
}

// True if `child` is `root` itself or nested beneath it (both canonical).
function within(child: string, root: string): boolean {
	if (child === root) return true;
	return child.startsWith(root.endsWith(path.sep) ? root : root + path.sep);
}

function withinAny(child: string, roots: string[]): boolean {
	return roots.some((root) => {
		const r = canonical(root);
		return r !== null && within(child, r);
	});
}

// Each registered project plus the sibling `<repo>-worktrees` dir where deck's
// worktrees land (see createWorktree). These are the only roots git operations
// may target.
function projectRoots(): string[] {
	const roots: string[] = [];
	for (const p of listProjects()) {
		roots.push(p.path);
		roots.push(path.join(path.dirname(p.path), `${path.basename(p.path)}-worktrees`));
	}
	return roots;
}

// Is `dir` a registered project or one of its worktrees? Confines the `repo`
// target of the git endpoints to the registered project set.
export function isWithinProjects(dir: string): boolean {
	const real = canonical(dir);
	return real !== null && withinAny(real, projectRoots());
}

// Is `dir` somewhere the path picker may enumerate? The picker also needs $HOME,
// since a new project's directory is chosen before it is registered.
export function isPickerAllowed(dir: string): boolean {
	const real = canonical(dir);
	return real !== null && withinAny(real, [os.homedir(), ...projectRoots()]);
}
