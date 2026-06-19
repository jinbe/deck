import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { DeckSession } from '$lib/types';

// Point the data dir at a throwaway tmp dir before config.ts captures it, then
// import the store dynamically so the module under test reads/writes there.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-store-'));
process.env.DECK_DATA = dataDir;
const sessionsFile = path.join(dataDir, 'sessions.json');

type Store = typeof import('./store');
let store: Store;

beforeAll(async () => {
	store = await import('./store');
});

function readFile(): DeckSession[] {
	return JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
}

function session(id: string): DeckSession {
	return { id, kind: 'claude', title: id, cwd: '/tmp', createdAt: 1, lastActiveAt: 1, status: 'idle' };
}

beforeEach(() => {
	// Fresh authoritative map + empty file so each test starts from nothing.
	delete (globalThis as { __deckSessions?: unknown }).__deckSessions;
	fs.rmSync(sessionsFile, { force: true });
});

describe('session store', () => {
	it('serves reads from memory after a save', () => {
		store.saveSession(session('a'));
		expect(store.getStoredSession('a')?.id).toBe('a');
		expect(store.listStoredSessions().map((s) => s.id)).toEqual(['a']);
		expect(readFile().map((s) => s.id)).toEqual(['a']);
	});

	it('updateSession is a keyed merge that preserves other fields and persists', () => {
		store.saveSession(session('a'));
		store.updateSession('a', { claudeSessionId: 'resume-1' });
		expect(store.getStoredSession('a')?.claudeSessionId).toBe('resume-1');
		expect(store.getStoredSession('a')?.title).toBe('a');
		expect(readFile()[0].claudeSessionId).toBe('resume-1');
	});

	it('does not touch disk on a running flip (it is derived live on read)', () => {
		store.saveSession(session('a'));
		const before = fs.readFileSync(sessionsFile, 'utf8');
		store.setSessionStatus('a', 'running', 999);
		expect(store.getStoredSession('a')?.status).toBe('running');
		expect(store.getStoredSession('a')?.lastActiveAt).toBe(999);
		// In-memory record advanced, but the file is untouched by the hot path.
		expect(fs.readFileSync(sessionsFile, 'utf8')).toBe(before);
	});

	it('persists terminal idle/error states', () => {
		store.saveSession(session('a'));
		store.setSessionStatus('a', 'running', 2);
		store.setSessionStatus('a', 'idle', 3);
		expect(readFile()[0].status).toBe('idle');
		store.setSessionStatus('a', 'error', 4);
		expect(readFile()[0].status).toBe('error');
		expect(readFile()[0].lastActiveAt).toBe(4);
	});

	it('a status flip on one session does not clobber another (no lost update)', () => {
		store.saveSession(session('a'));
		store.saveSession(session('b'));
		store.updateSession('a', { claudeSessionId: 'resume-a' });
		store.setSessionStatus('b', 'error', 5);
		const onDisk = readFile();
		expect(onDisk.find((s) => s.id === 'a')?.claudeSessionId).toBe('resume-a');
		expect(onDisk.find((s) => s.id === 'b')?.status).toBe('error');
	});

	it('removeSession drops the record and persists', () => {
		store.saveSession(session('a'));
		store.saveSession(session('b'));
		store.removeSession('a');
		expect(store.getStoredSession('a')).toBeUndefined();
		expect(readFile().map((s) => s.id)).toEqual(['b']);
	});
});
