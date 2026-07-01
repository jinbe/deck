// Picks the sidebar worktree icon for a session. The icon *shape* says what the
// session is attached to (a PR, an issue, or a plain worktree); the *colour*
// keeps saying PR state, reusing PR_STATE_COLOR. Kept node-free and Svelte-free
// (returns a kind the sidebar maps to a lucide component) so the pick logic is
// unit-testable in isolation, per the repo convention.
import { PR_STATE_COLOR } from './pr';
import type { DeckSession } from './types';

// Which lucide icon the sidebar renders. 'merge' matches GitHub's own merged-PR
// iconography; 'pull-request' covers open/closed/draft and captured-but-unsynced.
export type SessionIconKind = 'pull-request' | 'merge' | 'issue' | 'branch';

export interface SessionIcon {
	kind: SessionIconKind;
	// GitHub state colour when a synced PR is attached; undefined stays neutral
	// (the sidebar dims neutral icons), so state still reads through colour.
	color?: string;
	// Hover tooltip, so the icon is self-explanatory. Undefined for a plain
	// worktree, matching the icon's prior tooltip-less behaviour.
	title?: string;
}

// PR wins over issue when both exist: the PR is the later lifecycle stage. A
// captured PR with no synced state yet still reads as a PR, just neutral-tinted.
export function pickSessionIcon(s: Pick<DeckSession, 'pr' | 'issue' | 'issues'>): SessionIcon {
	const pr = s.pr;
	if (pr) {
		const color = pr.state ? PR_STATE_COLOR[pr.state] : undefined;
		const title = pr.state ? `PR #${pr.number} ${pr.state}` : `PR #${pr.number}`;
		return { kind: pr.state === 'merged' ? 'merge' : 'pull-request', color, title };
	}
	const issues = s.issues ?? (s.issue ? [s.issue] : []);
	if (issues.length > 0) {
		const title =
			issues.length > 1 ? `issues ${issues.map((i) => i.id).join(', ')}` : `issue ${issues[0].id}`;
		return { kind: 'issue', title };
	}
	return { kind: 'branch' };
}
