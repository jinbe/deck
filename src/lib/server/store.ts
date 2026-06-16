import type { DeckSession, Project } from '$lib/types';
import { readJson, writeJson } from './config';

const SESSIONS_FILE = 'sessions.json';
const PROJECTS_FILE = 'projects.json';

export function listStoredSessions(): DeckSession[] {
	return readJson<DeckSession[]>(SESSIONS_FILE, []);
}

export function getStoredSession(id: string): DeckSession | undefined {
	return listStoredSessions().find((s) => s.id === id);
}

export function saveSession(session: DeckSession) {
	const sessions = listStoredSessions().filter((s) => s.id !== session.id);
	sessions.push(session);
	writeJson(SESSIONS_FILE, sessions);
}

export function updateSession(id: string, patch: Partial<DeckSession>): DeckSession | undefined {
	const sessions = listStoredSessions();
	const session = sessions.find((s) => s.id === id);
	if (!session) return undefined;
	Object.assign(session, patch);
	writeJson(SESSIONS_FILE, sessions);
	return session;
}

export function removeSession(id: string) {
	writeJson(
		SESSIONS_FILE,
		listStoredSessions().filter((s) => s.id !== id)
	);
}

export function listProjects(): Project[] {
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
	writeJson(
		PROJECTS_FILE,
		listProjects().filter((p) => p.path !== path)
	);
}
