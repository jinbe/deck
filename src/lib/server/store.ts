import type { DeckSession, IssueSource, Project, SessionStatus } from '$lib/types';
import { readJson, writeJson } from './config';
import { invalidateIssues } from './issues/cache';
import { DEMO, demoProjects } from './demo';

const SESSIONS_FILE = 'sessions.json';
const PROJECTS_FILE = 'projects.json';
const SECRETS_FILE = 'secrets.json';

// sessions.json is the hot store: setStatus fires on every message_start and
// turn boundary. Keep the authoritative copy in memory (loaded once, surviving
// HMR via globalThis like the event bus and proc maps) so reads are O(1) and
// every write is a single keyed update flushed by one writer, with no per-event
// read-modify-write of the whole array and no lost-update race between
// concurrently streaming sessions. Writes replace the entry (never mutate in
// place) so an already-returned snapshot stays stable.
const g = globalThis as { __deckSessions?: Map<string, DeckSession> };
function sessionMap(): Map<string, DeckSession> {
	return (g.__deckSessions ??= new Map(
		readJson<DeckSession[]>(SESSIONS_FILE, []).map((s) => [s.id, s])
	));
}

function flushSessions() {
	writeJson(SESSIONS_FILE, [...sessionMap().values()]);
}

export function listStoredSessions(): DeckSession[] {
	return [...sessionMap().values()];
}

// Returns the live cached record, not a copy. Never mutate it in place; route
// changes through updateSession/setSessionStatus so the write is flushed and the
// no-mutate invariant that keeps prior snapshots stable holds.
export function getStoredSession(id: string): DeckSession | undefined {
	return sessionMap().get(id);
}

export function saveSession(session: DeckSession) {
	sessionMap().set(session.id, session);
	flushSessions();
}

export function updateSession(id: string, patch: Partial<DeckSession>): DeckSession | undefined {
	const session = sessionMap().get(id);
	if (!session) return undefined;
	const updated = { ...session, ...patch };
	sessionMap().set(id, updated);
	flushSessions();
	return updated;
}

export function removeSession(id: string) {
	if (sessionMap().delete(id)) flushSessions();
}

// Volatile run status. The list/SSE read path derives running/idle live from
// the process map (see sessions.ts), so a persisted `running` is never trusted
// across a read, which makes the per-message_start disk write pure churn. Keep
// the in-memory record current (so a sibling session's flush still snapshots the
// latest value) but only hit disk for the terminal idle/error states, which
// clear a prior error and advance lastActiveAt.
export function setSessionStatus(id: string, status: SessionStatus, lastActiveAt: number) {
	const session = sessionMap().get(id);
	if (!session) return;
	sessionMap().set(id, { ...session, status, lastActiveAt });
	if (status !== 'running') flushSessions();
}

export function listProjects(): Project[] {
	if (DEMO) return demoProjects();
	return readJson<Project[]>(PROJECTS_FILE, []);
}

export function addProject(project: Project) {
	const projects = listProjects().filter((p) => p.path !== project.path);
	projects.push(project);
	projects.sort((a, b) => a.name.localeCompare(b.name));
	writeJson(PROJECTS_FILE, projects);
}

// Merge a patch into an existing project (preserves other fields).
export function updateProject(path: string, patch: Partial<Project>): Project | undefined {
	const projects = listProjects();
	const project = projects.find((p) => p.path === path);
	if (!project) return undefined;
	Object.assign(project, patch);
	writeJson(PROJECTS_FILE, projects);
	return project;
}

export function removeProject(path: string) {
	const project = listProjects().find((p) => p.path === path);
	// Persist the removal first; only then drop the sources' secrets, so a failed
	// write can't strand a still-listed project with its keys already gone.
	writeJson(
		PROJECTS_FILE,
		listProjects().filter((p) => p.path !== path)
	);
	for (const s of project?.sources ?? []) deleteSecret(s.id);
	invalidateIssues(path);
}

// --- Issue sources (stored on the project, secrets kept separately) ---

export function addSource(projectPath: string, source: IssueSource): Project | undefined {
	const projects = listProjects();
	const project = projects.find((p) => p.path === projectPath);
	if (!project) return undefined;
	project.sources = [...(project.sources ?? []), source];
	writeJson(PROJECTS_FILE, projects);
	invalidateIssues(projectPath);
	return project;
}

export function removeSource(projectPath: string, sourceId: string): Project | undefined {
	const projects = listProjects();
	const project = projects.find((p) => p.path === projectPath);
	if (!project) return undefined;
	project.sources = (project.sources ?? []).filter((s) => s.id !== sourceId);
	writeJson(PROJECTS_FILE, projects);
	deleteSecret(sourceId);
	invalidateIssues(projectPath);
	return project;
}

// --- Secrets (~/.deck/secrets.json, keyed by source id) ---
// Linear/ClickUp API keys live here, never in projects.json, mirroring the way
// `token` / `vapid.json` sit apart from the project + session stores.

type SecretsFile = Record<string, { apiKey: string }>;

export function readSecret(sourceId: string): string | undefined {
	return readJson<SecretsFile>(SECRETS_FILE, {})[sourceId]?.apiKey;
}

export function setSecret(sourceId: string, apiKey: string) {
	const secrets = readJson<SecretsFile>(SECRETS_FILE, {});
	secrets[sourceId] = { apiKey };
	// 0o600 — API keys must not be world/group readable (cf. the auth token).
	writeJson(SECRETS_FILE, secrets, 0o600);
}

function deleteSecret(sourceId: string) {
	const secrets = readJson<SecretsFile>(SECRETS_FILE, {});
	if (!(sourceId in secrets)) return;
	delete secrets[sourceId];
	writeJson(SECRETS_FILE, secrets, 0o600);
}
