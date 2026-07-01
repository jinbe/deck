import { describe, it, expect } from 'vitest';
import { agentEnv } from './env';

describe('agentEnv', () => {
	it('stamps the deck session id', () => {
		expect(agentEnv('c_abc123').DECK_SESSION_ID).toBe('c_abc123');
	});

	it('inherits the parent environment', () => {
		const prev = process.env.DECK_TEST_MARKER;
		process.env.DECK_TEST_MARKER = 'present';
		try {
			expect(agentEnv('p_1').DECK_TEST_MARKER).toBe('present');
		} finally {
			if (prev === undefined) delete process.env.DECK_TEST_MARKER;
			else process.env.DECK_TEST_MARKER = prev;
		}
	});

	it('does not mutate process.env', () => {
		const before = process.env.DECK_SESSION_ID;
		agentEnv('x_1');
		expect(process.env.DECK_SESSION_ID).toBe(before);
	});
});
