import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { transcriptsDir } from './config';
import { getStoredSession, updateSession } from './store';

const procs = new Map<string, ChildProcess>();

// Survives HMR in dev so SSE subscribers and runners share one bus.
const g = globalThis as { __deckBus?: EventEmitter };
export const bus = (g.__deckBus ??= new EventEmitter());
bus.setMaxListeners(100);

export function transcriptPath(id: string) {
	return path.join(transcriptsDir, `${id.replace(/[^a-zA-Z0-9_-]/g, '_')}.jsonl`);
}

export function isTurnRunning(id: string) {
	return procs.has(id);
}

export function readTranscript(id: string): unknown[] {
	try {
		return fs
			.readFileSync(transcriptPath(id), 'utf8')
			.split('\n')
			.filter(Boolean)
			.map((line) => JSON.parse(line));
	} catch {
		return [];
	}
}

function appendEvent(id: string, event: Record<string, unknown>) {
	fs.appendFileSync(transcriptPath(id), JSON.stringify(event) + '\n');
	bus.emit(`event:${id}`, event);
}

export function startTurn(id: string, prompt: string) {
	const session = getStoredSession(id);
	if (!session || session.kind !== 'claude') throw new Error('not a claude session');
	if (procs.has(id)) throw new Error('a turn is already running');

	const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose'];
	if (session.claudeSessionId) args.push('--resume', session.claudeSessionId);
	if (session.model) args.push('--model', session.model);
	if (session.permissionMode === 'bypassPermissions') {
		args.push('--dangerously-skip-permissions');
	} else {
		args.push('--permission-mode', session.permissionMode ?? 'acceptEdits');
	}

	const child = spawn('claude', args, {
		cwd: session.cwd,
		env: process.env,
		stdio: ['ignore', 'pipe', 'pipe']
	});
	procs.set(id, child);

	appendEvent(id, { type: 'deck.user', text: prompt, ts: Date.now() });
	updateSession(id, { status: 'running', lastActiveAt: Date.now() });
	bus.emit(`status:${id}`, 'running');

	let buf = '';
	child.stdout!.on('data', (chunk: Buffer) => {
		buf += chunk.toString();
		let nl;
		while ((nl = buf.indexOf('\n')) >= 0) {
			const line = buf.slice(0, nl).trim();
			buf = buf.slice(nl + 1);
			if (!line) continue;
			try {
				handleEvent(id, JSON.parse(line));
			} catch {
				// non-JSON noise on stdout, ignore
			}
		}
	});

	let stderrTail = '';
	child.stderr!.on('data', (chunk: Buffer) => {
		stderrTail = (stderrTail + chunk.toString()).slice(-4000);
	});

	child.on('exit', (code) => {
		procs.delete(id);
		const status = code === 0 ? 'idle' : 'error';
		if (code !== 0) {
			appendEvent(id, {
				type: 'deck.error',
				text: stderrTail.trim() || `claude exited with code ${code}`,
				ts: Date.now()
			});
		}
		updateSession(id, { status, lastActiveAt: Date.now() });
		bus.emit(`status:${id}`, status);
	});
}

function handleEvent(id: string, event: Record<string, unknown>) {
	if (event.type === 'system') {
		if (event.subtype === 'init' && typeof event.session_id === 'string') {
			updateSession(id, { claudeSessionId: event.session_id });
			// full init event embeds the entire tool/skill/plugin inventory
			appendEvent(id, {
				type: 'system',
				subtype: 'init',
				session_id: event.session_id,
				model: event.model,
				cwd: event.cwd,
				permissionMode: event.permissionMode
			});
			return;
		}
		// hook chatter is high-volume noise in the transcript
		if (typeof event.subtype === 'string' && event.subtype.startsWith('hook')) return;
	}
	appendEvent(id, event);
}

export function stopTurn(id: string) {
	procs.get(id)?.kill('SIGTERM');
}
