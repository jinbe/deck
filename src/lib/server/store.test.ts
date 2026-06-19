import { describe, it, expect, vi, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { DeckSession } from '$lib/types';

// Point the data dir at a throwaway tmpdir before importing the store, so the
// module's config side effects (mkdir, token) and every read/write land there.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-store-test-'));
process.env.DECK_DATA = dataDir;

const {
	listStoredSessions,
	getStoredSession,
	saveSession,
	updateSession,
	removeSession,
	setSessionsMutatedHook
} = await import('./store');

afterAll(() => fs.rmSync(dataDir, { recursive: true, force: true }));

function shell(id: string): DeckSession {
	return {
		id,
		kind: 'shell',
		title: id,
		cwd: '/tmp',
		createdAt: 1,
		lastActiveAt: 1,
		status: 'idle',
		managed: true
	};
}

const sessionReads = (spy: ReturnType<typeof vi.spyOn>) =>
	spy.mock.calls.filter((c: unknown[]) => String(c[0]).endsWith('sessions.json')).length;

describe('store session cache', () => {
	it('reflects writes through getStoredSession', () => {
		saveSession(shell('a1'));
		expect(getStoredSession('a1')).toMatchObject({ id: 'a1', title: 'a1' });

		updateSession('a1', { title: 'renamed' });
		expect(getStoredSession('a1')?.title).toBe('renamed');

		removeSession('a1');
		expect(getStoredSession('a1')).toBeUndefined();
	});

	it('reads the file once across repeated calls and re-reads after a write', () => {
		const spy = vi.spyOn(fs, 'readFileSync');
		try {
			saveSession(shell('c1')); // a write invalidates the cache
			const base = sessionReads(spy);

			listStoredSessions();
			listStoredSessions();
			getStoredSession('c1');
			expect(sessionReads(spy) - base).toBe(1); // only the first call hits disk

			removeSession('c1'); // invalidate again
			listStoredSessions();
			expect(sessionReads(spy) - base).toBe(2); // exactly one more disk read
		} finally {
			spy.mockRestore();
		}
	});

	it('notifies the mutation hook on every write', () => {
		const hook = vi.fn();
		setSessionsMutatedHook(hook);
		try {
			saveSession(shell('h1'));
			updateSession('h1', { title: 'x' });
			removeSession('h1');
			expect(hook).toHaveBeenCalledTimes(3);
		} finally {
			setSessionsMutatedHook(() => {});
		}
	});
});
