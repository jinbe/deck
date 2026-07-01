import { describe, it, expect } from 'vitest';
import { pickSessionIcon } from './session-icon';
import { PR_STATE_COLOR } from './pr';
import type { SessionIssue, SessionPR } from './types';

function pr(over: Partial<SessionPR> = {}): SessionPR {
	return { url: 'https://github.com/acme/web/pull/7', repo: 'acme/web', number: 7, seenAt: 0, ...over };
}

function issue(id: string): SessionIssue {
	return { source: 'github', id, url: `https://example.test/${id}` };
}

describe('pickSessionIcon', () => {
	it('open PR: pull-request icon in the open colour', () => {
		const icon = pickSessionIcon({ pr: pr({ state: 'open' }) });
		expect(icon.kind).toBe('pull-request');
		expect(icon.color).toBe(PR_STATE_COLOR.open);
		expect(icon.title).toBe('PR #7 open');
	});

	it('merged PR: merge icon in the merged colour', () => {
		const icon = pickSessionIcon({ pr: pr({ state: 'merged' }) });
		expect(icon.kind).toBe('merge');
		expect(icon.color).toBe(PR_STATE_COLOR.merged);
	});

	it('closed and draft PRs keep the pull-request icon and their colours', () => {
		expect(pickSessionIcon({ pr: pr({ state: 'closed' }) })).toMatchObject({
			kind: 'pull-request',
			color: PR_STATE_COLOR.closed
		});
		expect(pickSessionIcon({ pr: pr({ state: 'draft' }) })).toMatchObject({
			kind: 'pull-request',
			color: PR_STATE_COLOR.draft
		});
	});

	it('captured-but-unsynced PR: pull-request icon, neutral tint, number-only tooltip', () => {
		const icon = pickSessionIcon({ pr: pr() });
		expect(icon.kind).toBe('pull-request');
		expect(icon.color).toBeUndefined();
		expect(icon.title).toBe('PR #7');
	});

	it('issue but no PR: ticket icon, neutral tint, "issue <id>" tooltip', () => {
		const icon = pickSessionIcon({ issues: [issue('acme/web#42')] });
		expect(icon.kind).toBe('issue');
		expect(icon.color).toBeUndefined();
		expect(icon.title).toBe('issue acme/web#42');
	});

	it('reads the legacy single `issue` field', () => {
		expect(pickSessionIcon({ issue: issue('LIN-9') })).toMatchObject({
			kind: 'issue',
			title: 'issue LIN-9'
		});
	});

	it('multiple issues list every id in the tooltip', () => {
		const icon = pickSessionIcon({ issues: [issue('X-1'), issue('X-2')] });
		expect(icon.kind).toBe('issue');
		expect(icon.title).toBe('issues X-1, X-2');
	});

	it('PR wins over issue when both are present', () => {
		const icon = pickSessionIcon({ pr: pr({ state: 'open' }), issues: [issue('X-1')] });
		expect(icon.kind).toBe('pull-request');
	});

	it('plain worktree: branch icon, no colour, no tooltip', () => {
		const icon = pickSessionIcon({});
		expect(icon).toEqual({ kind: 'branch' });
	});
});
