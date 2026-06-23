// Live PR-state lookup for a session's captured PR, via the `gh` CLI (the same
// no-shell execFile pattern as server/issues/github.ts). Best-effort: any
// failure (offline, PR not found, gh not authed) leaves the last-known state on
// the chip and returns null, so nothing loud surfaces. No polling: the endpoint
// calls this once on open and again only when the captured URL changes.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mapPrState } from '$lib/pr';
import type { PrState, SessionPR } from '$lib/types';
import { getStoredSession, updateSession } from './store';

const exec = promisify(execFile);

// Cap the gh call so a hung CLI (auth prompt, dead network) can't wedge the
// request, mirroring the issues helper.
const GH_TIMEOUT_MS = 15_000;

interface GhPrView {
	state: string;
	isDraft: boolean;
}

async function fetchPrState(pr: SessionPR): Promise<PrState | null> {
	const { stdout } = await exec(
		'gh',
		['pr', 'view', String(pr.number), '-R', pr.repo, '--json', 'state,isDraft'],
		{ timeout: GH_TIMEOUT_MS }
	);
	const view = JSON.parse(stdout) as GhPrView;
	return mapPrState(view.state, view.isDraft);
}

// Re-read before persisting: a dismiss or a newer captured link may have landed
// during the gh call, so only write back if the stored PR is still the one we
// fetched.
function persistPrState(id: string, pr: SessionPR, state: PrState) {
	const current = getStoredSession(id)?.pr;
	if (!current || current.url !== pr.url) return;
	updateSession(id, { pr: { ...current, state, checkedAt: Date.now() } });
}

export async function refreshPrState(id: string): Promise<PrState | null> {
	const pr = getStoredSession(id)?.pr;
	if (!pr) return null;
	const state = await fetchPrState(pr).catch(() => null);
	if (state) persistPrState(id, pr, state);
	return state;
}
