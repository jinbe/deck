import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { DeckSession } from '$lib/types';

export const ssr = false;

export const load: PageLoad = async ({ params, fetch }) => {
	const res = await fetch(`/api/sessions/${encodeURIComponent(params.id)}`);
	if (!res.ok) error(res.status, 'session not found');
	const session: DeckSession = await res.json();
	return { session };
};
