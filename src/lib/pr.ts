// Pure GitHub PR-link detection, shared by the server-side capture hook
// (appendEvent) and the one-time backfill scan. Node-free and unit-tested per
// the repo convention so the regex logic stays verifiable in isolation.
import type { PrState } from './types';

export interface PrMatch {
	url: string;
	// owner/repo, e.g. "acme/web".
	repo: string;
	number: number;
}

// github.com pull URLs only for v1: https://github.com/<owner>/<repo>/pull/<n>.
// owner/repo use GitHub's name charset ([A-Za-z0-9._-]); the number is bounded
// (1-9 digits, with a no-more-digits lookahead) so it stays a safe integer and a
// garbage run of digits is rejected rather than truncated. The number stops at
// the first non-digit, so a fragment/suffix (#discussion_r..., /files) or a
// closing quote in serialized JSON is naturally excluded. GitLab MRs, Bitbucket,
// and self-hosted/enterprise hosts are out of scope (host is pinned to
// github.com, so github.example.com and www.github.com don't match).
const PR_URL = /https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d{1,9})(?!\d)/g;

// The last GitHub PR URL in `text`, or null. Last-wins: an agent may print
// several links across a session (a push hint, then the opened PR), and the most
// recently seen one is the session's current PR.
export function lastPrLink(text: string): PrMatch | null {
	let last: PrMatch | null = null;
	for (const m of text.matchAll(PR_URL)) {
		last = { url: m[0], repo: `${m[1]}/${m[2]}`, number: Number(m[3]) };
	}
	return last;
}

// gh reports terminal states (MERGED/CLOSED) and OPEN; draft is a separate flag
// that only qualifies an open PR. Anything else (an unexpected state string)
// maps to null so the caller leaves the chip neutral rather than guessing.
const PR_STATES: Record<string, PrState> = { MERGED: 'merged', CLOSED: 'closed', OPEN: 'open' };

// Map `gh pr view --json state,isDraft` onto the chip's state.
export function mapPrState(state: string, isDraft: boolean): PrState | null {
	const base = PR_STATES[state] ?? null;
	if (base === 'open' && isDraft) return 'draft';
	return base;
}

// Standard GitHub state colours, applied literally (not theme tokens) so the
// chip reads the same open/merged/closed/draft as GitHub itself.
export const PR_STATE_COLOR: Record<PrState, string> = {
	open: '#1f883d',
	merged: '#8250df',
	closed: '#cf222e',
	draft: '#6e7781'
};
