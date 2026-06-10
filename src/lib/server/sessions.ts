import { customAlphabet } from 'nanoid';
import type { DeckSession } from '$lib/types';
import { listStoredSessions, getStoredSession, saveSession, removeSession } from './store';
import { listTmuxSessions, createTmuxSession, killTmuxSession, hasTmuxSession } from './tmux';
import { isTurnRunning, stopTurn } from './claude';

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);

export function newId(kind: 'claude' | 'shell') {
	return `${kind === 'claude' ? 'c' : 's'}_${nanoid()}`;
}

export function tmuxNameFor(id: string) {
	return `deck-${id.replace(/^s_/, '')}`;
}

// Flat, recency-sorted view across claude sessions and every live tmux session
// (managed or not), so adhoc terminals show up without registration.
export async function listSessions(): Promise<DeckSession[]> {
	const stored = listStoredSessions();
	const tmuxSessions = await listTmuxSessions();
	const result: DeckSession[] = [];

	for (const s of stored) {
		if (s.kind === 'claude') {
			result.push({ ...s, status: isTurnRunning(s.id) ? 'running' : s.status });
		} else {
			const live = tmuxSessions.find((t) => t.name === s.tmuxName);
			result.push({
				...s,
				status: live ? 'idle' : 'dead',
				attached: live?.attached ?? false,
				lastActiveAt: live?.activity ?? s.lastActiveAt
			});
		}
	}

	const managedNames = new Set(stored.map((s) => s.tmuxName).filter(Boolean));
	for (const t of tmuxSessions) {
		if (managedNames.has(t.name)) continue;
		result.push({
			id: `t_${t.name}`,
			kind: 'shell',
			title: t.name,
			cwd: t.cwd,
			createdAt: t.created,
			lastActiveAt: t.activity,
			status: 'idle',
			tmuxName: t.name,
			managed: false,
			attached: t.attached
		});
	}

	return result.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
}

export async function getSession(id: string): Promise<DeckSession | undefined> {
	if (id.startsWith('t_')) {
		return (await listSessions()).find((s) => s.id === id);
	}
	const stored = getStoredSession(id);
	if (!stored) return undefined;
	if (stored.kind === 'claude') {
		return { ...stored, status: isTurnRunning(id) ? 'running' : stored.status };
	}
	const alive = stored.tmuxName ? await hasTmuxSession(stored.tmuxName) : false;
	return { ...stored, status: alive ? 'idle' : 'dead' };
}

export async function createSession(input: {
	kind: 'claude' | 'shell';
	title?: string;
	cwd: string;
	model?: string;
	permissionMode?: DeckSession['permissionMode'];
	command?: string;
}): Promise<DeckSession> {
	const id = newId(input.kind);
	const now = Date.now();
	const title = input.title?.trim() || input.cwd.split('/').pop() || id;

	const session: DeckSession = {
		id,
		kind: input.kind,
		title,
		cwd: input.cwd,
		createdAt: now,
		lastActiveAt: now,
		status: 'idle',
		managed: true
	};

	if (input.kind === 'claude') {
		session.model = input.model || undefined;
		session.permissionMode = input.permissionMode ?? 'acceptEdits';
	} else {
		session.tmuxName = tmuxNameFor(id);
		await createTmuxSession(session.tmuxName, input.cwd, input.command);
	}

	saveSession(session);
	return session;
}

export async function deleteSession(id: string): Promise<void> {
	if (id.startsWith('t_')) {
		await killTmuxSession(id.slice(2));
		return;
	}
	const stored = getStoredSession(id);
	if (stored?.kind === 'claude') {
		stopTurn(id);
	} else if (stored?.tmuxName && (await hasTmuxSession(stored.tmuxName))) {
		await killTmuxSession(stored.tmuxName);
	}
	removeSession(id);
}

export function tmuxTarget(session: DeckSession): string | undefined {
	if (session.kind !== 'shell') return undefined;
	return session.tmuxName;
}
