import { describe, it, expect } from 'vitest';
import { lastPrLink } from './pr';

describe('lastPrLink', () => {
	it('detects a github PR url and parses owner/repo/number', () => {
		expect(lastPrLink('opened https://github.com/acme/web/pull/42')).toEqual({
			url: 'https://github.com/acme/web/pull/42',
			repo: 'acme/web',
			number: 42
		});
	});

	it('returns the last match when several are present (last-wins)', () => {
		const text =
			'pushed https://github.com/acme/web/pull/1 then https://github.com/acme/web/pull/2';
		expect(lastPrLink(text)?.number).toBe(2);
	});

	it('handles owners and repos with dots and hyphens', () => {
		expect(lastPrLink('https://github.com/my-org.io/deck-app/pull/7')).toEqual({
			url: 'https://github.com/my-org.io/deck-app/pull/7',
			repo: 'my-org.io/deck-app',
			number: 7
		});
	});

	it('stops the number at a fragment or path suffix', () => {
		expect(lastPrLink('https://github.com/acme/web/pull/9/files#diff-1')?.url).toBe(
			'https://github.com/acme/web/pull/9'
		);
		expect(lastPrLink('https://github.com/acme/web/pull/9/files')?.number).toBe(9);
	});

	it('extracts a url embedded in serialized JSON with a trailing quote', () => {
		const line = JSON.stringify({ type: 'text', text: 'see https://github.com/acme/web/pull/12' });
		expect(lastPrLink(line)).toEqual({
			url: 'https://github.com/acme/web/pull/12',
			repo: 'acme/web',
			number: 12
		});
	});

	it('ignores non-github hosts (gitlab, bitbucket)', () => {
		expect(lastPrLink('https://gitlab.com/acme/web/-/merge_requests/3')).toBeNull();
		expect(lastPrLink('https://bitbucket.org/acme/web/pull-requests/3')).toBeNull();
	});

	it('ignores self-hosted / enterprise and look-alike github hosts', () => {
		expect(lastPrLink('https://github.example.com/acme/web/pull/3')).toBeNull();
		expect(lastPrLink('https://github.com.evil.test/acme/web/pull/3')).toBeNull();
		expect(lastPrLink('https://www.github.com/acme/web/pull/3')).toBeNull();
	});

	it('ignores github issue and non-pull urls', () => {
		expect(lastPrLink('https://github.com/acme/web/issues/42')).toBeNull();
		expect(lastPrLink('https://github.com/acme/web/blob/main/pull/x.ts')).toBeNull();
	});

	it('returns null when there is no PR link', () => {
		expect(lastPrLink('no links here')).toBeNull();
		expect(lastPrLink('')).toBeNull();
	});

	it('rejects an out-of-range run of digits rather than truncating it', () => {
		expect(lastPrLink('https://github.com/acme/web/pull/99999999999999999999')).toBeNull();
	});

	it('is reentrant across calls (regex lastIndex not leaked)', () => {
		const text = 'https://github.com/acme/web/pull/5';
		expect(lastPrLink(text)?.number).toBe(5);
		expect(lastPrLink(text)?.number).toBe(5);
	});
});
