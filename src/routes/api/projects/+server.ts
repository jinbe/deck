import { json, error } from '@sveltejs/kit';
import fs from 'node:fs';
import path from 'node:path';
import type { RequestHandler } from './$types';
import { listProjects, addProject, removeProject } from '$lib/server/store';

export const GET: RequestHandler = async () => {
	return json(listProjects());
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const dir = String(body.path ?? '').replace(/\/+$/, '');
	if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
		error(400, 'path is not a directory');
	}
	const project = { name: String(body.name ?? '').trim() || path.basename(dir), path: dir };
	addProject(project);
	return json(project, { status: 201 });
};

export const DELETE: RequestHandler = async ({ url }) => {
	const dir = url.searchParams.get('path');
	if (!dir) error(400, 'path required');
	removeProject(dir);
	return json({ ok: true });
};
