import { describe, it, expect } from 'vitest';
import { scopeToOrigin } from './index';
import type { GithubSource } from '$lib/types';

const src = (id: string, owner: string, repo: string): GithubSource => ({
	id,
	type: 'github',
	owner,
	repo
});

describe('scopeToOrigin', () => {
	const web = src('a', 'acme', 'web');
	const api = src('b', 'acme', 'api');

	it('keeps only the source matching origin, case-insensitively', () => {
		expect(scopeToOrigin([web, api], 'ACME/Web')).toEqual([web]);
	});

	it('drops every source when none matches origin', () => {
		expect(scopeToOrigin([web, api], 'other/repo')).toEqual([]);
	});

	it('keeps all sources when origin is unresolved', () => {
		expect(scopeToOrigin([web, api], null)).toEqual([web, api]);
	});
});
