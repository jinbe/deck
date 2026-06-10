export type SessionKind = 'claude' | 'shell';
export type SessionStatus = 'running' | 'idle' | 'error' | 'dead';

export interface DeckSession {
	id: string;
	kind: SessionKind;
	title: string;
	cwd: string;
	createdAt: number;
	lastActiveAt: number;
	status: SessionStatus;
	// claude
	claudeSessionId?: string;
	model?: string;
	permissionMode?: 'acceptEdits' | 'bypassPermissions' | 'default' | 'plan';
	// shell
	tmuxName?: string;
	managed?: boolean;
	attached?: boolean;
}

export interface Project {
	name: string;
	path: string;
	template?: string;
}
