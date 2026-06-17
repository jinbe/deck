import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { registerAsk, type AskQuestion } from './ask';

// Deck hosts a tiny Streamable-HTTP MCP server on localhost and points each
// spawned `claude` at /mcp/<sessionId>. It exposes one tool, `ask`, that mirrors
// the built-in AskUserQuestion but *blocks* until the user answers in the deck
// UI — which the headless `-p` CLI can't do for the native tool. The deck
// session id is taken from the URL path and bound into each tool handler.

const ASK_INPUT = {
	questions: z
		.array(
			z.object({
				question: z.string().describe('The question to ask the user'),
				header: z.string().optional().describe('Short label for the question (<= 12 chars)'),
				multiSelect: z.boolean().optional().describe('Allow selecting more than one option'),
				options: z
					.array(
						z.object({
							label: z.string(),
							description: z.string().optional()
						})
					)
					.describe('Choices to offer; the user can also type their own answer')
			})
		)
		.describe('One or more questions to put to the user')
};

function buildServer(deckId: string): McpServer {
	const server = new McpServer({ name: 'deck', version: '1.0.0' });
	server.registerTool(
		'ask',
		{
			title: 'Ask the user',
			description:
				'Ask the user one or more multiple-choice questions and block until they answer in the deck UI. Use this whenever you would otherwise use AskUserQuestion (which is disabled in this environment).',
			inputSchema: ASK_INPUT
		},
		async (args, extra) => {
			const text = await registerAsk(deckId, args.questions as AskQuestion[], extra.signal);
			return { content: [{ type: 'text' as const, text }] };
		}
	);
	return server;
}

const transports = new Map<string, StreamableHTTPServerTransport>();

function deckIdFromUrl(url: string | undefined): string | null {
	const m = (url ?? '').match(/^\/mcp\/([^/?]+)/);
	return m ? decodeURIComponent(m[1]) : null;
}

async function readBody(req: http.IncomingMessage): Promise<unknown> {
	const chunks: Buffer[] = [];
	for await (const c of req) chunks.push(c as Buffer);
	if (!chunks.length) return undefined;
	try {
		return JSON.parse(Buffer.concat(chunks).toString('utf8'));
	} catch {
		return undefined;
	}
}

interface McpState {
	port: number;
	ready: Promise<number>;
}

const g = globalThis as { __deckMcp?: McpState };

function startServer(): McpState {
	const state: McpState = { port: 0, ready: Promise.resolve(0) };

	const httpServer = http.createServer(async (req, res) => {
		const deckId = deckIdFromUrl(req.url);
		if (!deckId) {
			res.writeHead(404).end();
			return;
		}
		try {
			const sid = req.headers['mcp-session-id'] as string | undefined;
			const body = req.method === 'POST' ? await readBody(req) : undefined;
			let transport = sid ? transports.get(sid) : undefined;

			if (!transport) {
				if (req.method !== 'POST' || !isInitializeRequest(body)) {
					res
						.writeHead(400, { 'content-type': 'application/json' })
						.end(
							JSON.stringify({
								jsonrpc: '2.0',
								error: { code: -32000, message: 'No valid MCP session' },
								id: null
							})
						);
					return;
				}
				const created: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
					sessionIdGenerator: () => randomUUID(),
					onsessioninitialized: (id: string) => {
						transports.set(id, created);
					}
				});
				created.onclose = () => {
					if (created.sessionId) transports.delete(created.sessionId);
				};
				await buildServer(deckId).connect(created);
				transport = created;
			}
			await transport!.handleRequest(req, res, body);
		} catch {
			if (!res.headersSent) res.writeHead(500).end();
			else res.end();
		}
	});

	state.ready = new Promise<number>((resolve) => {
		httpServer.listen(0, '127.0.0.1', () => {
			const addr = httpServer.address();
			state.port = typeof addr === 'object' && addr ? addr.port : 0;
			resolve(state.port);
		});
	});
	httpServer.unref();
	return state;
}

// Start (once) the localhost MCP server and resolve when it's listening.
export function ensureMcp(): Promise<number> {
	if (!g.__deckMcp) g.__deckMcp = startServer();
	return g.__deckMcp.ready;
}

export function mcpUrl(deckId: string): string {
	const port = g.__deckMcp?.port ?? 0;
	return `http://127.0.0.1:${port}/mcp/${encodeURIComponent(deckId)}`;
}
