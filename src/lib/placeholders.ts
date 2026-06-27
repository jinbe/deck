import type { DeckSession } from '$lib/types';

// Values a [token] expands to in a first-prompt template or a quick message.
// Built from the live session (see contextFromSession); every field is optional
// and a missing one expands to an empty string.
export interface PlaceholderContext {
	title?: string;
	branch?: string;
	base?: string;
	cwd?: string;
	issueId?: string;
	issueUrl?: string;
	prUrl?: string;
}

// Substitute the supported [tokens] in `text`, then trim. [branch] is a
// back-compat alias for [branch-name]. A token with no value resolves to ''
// (e.g. no PR captured -> [pr_url] is blank). Shared by the new-session
// first-prompt path and quick messages so the token set lives in one place.
export function expandPlaceholders(text: string, ctx: PlaceholderContext): string {
	return text
		.replaceAll('[title]', ctx.title ?? '')
		.replaceAll('[branch-name]', ctx.branch ?? '')
		.replaceAll('[base-branch]', ctx.base ?? '')
		.replaceAll('[branch]', ctx.branch ?? '')
		.replaceAll('[cwd]', ctx.cwd ?? '')
		.replaceAll('[issue_id]', ctx.issueId ?? '')
		.replaceAll('[issue_url]', ctx.issueUrl ?? '')
		.replaceAll('[pr_url]', ctx.prUrl ?? '')
		.trim();
}

// Build the expansion context from a live session: title, worktree branch/base,
// cwd, the issue it was launched from, and the most recently captured PR url.
export function contextFromSession(session: DeckSession): PlaceholderContext {
	return {
		title: session.title,
		branch: session.worktree?.branch,
		base: session.worktree?.base,
		cwd: session.cwd,
		issueId: session.issue?.id,
		issueUrl: session.issue?.url,
		prUrl: session.pr?.url
	};
}
