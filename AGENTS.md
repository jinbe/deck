# AGENTS.md

Guidance for AI agents working in this repo. For the human-facing version, see
[CONTRIBUTING.md](CONTRIBUTING.md).

deck is a single-user, single-machine tool (SvelteKit + Svelte 5) for driving
Claude Code sessions and tmux terminals from one browser app. **This repository
is public.**

## Public repo: never reference specific clients

Because this repo is public, never put the name of a specific client, customer,
tenant, employer's project, private repository, or any real local path into
anything committed here: source, comments, tests, fixtures, demo data, commit
messages, branch names, PR text, GitHub issues, or screenshots.

Use neutral placeholders instead: `acme`, `example`, `apps/web`, `frontend/app`,
`/path/to/project`, `~/code/deck`, ports like `3000`. Real project paths and
client names live only in the user's local `~/.deck/` data, which is not part of
this repo. Keep it that way. Screenshots must use the curated demo sessions, not
real work. If you spot a real client name anywhere in the tree or history, stop
and flag it.

(The "deck" name and the project's own brand mark and palette are intentional.)

## Commands

```sh
pnpm install
pnpm dev                                      # vite dev server
pnpm test                                     # vitest
pnpm check                                    # svelte-check: types + Svelte diagnostics
pnpm audit                                    # fallow: dead code, complexity, duplication
pnpm build && PORT=4818 node build/index.js   # production build
```

Run `pnpm check` and `pnpm test` before claiming a change is done. A husky
pre-commit hook runs `fallow audit` and blocks only newly introduced findings.

## Conventions

- Tabs. No em dashes. Comments only where the *why* isn't obvious.
- No emoji in UI. Icons come from `@lucide/svelte` (a shared library), never
  inline `<svg>`; import once and reuse.
- Svelte 5 runes (`$state`, `$props`, `$derived`, `$effect`).
- Keep pure logic in a node-free `*-core.ts` with unit tests (e.g.
  `devservers-core.ts`); put tmux / fs / child_process orchestration in the
  sibling `*.ts` (e.g. `devservers.ts`). Tests sit next to code as `*.test.ts`.
- Confine all fs/git operations to registered projects and their worktrees (see
  `src/lib/server/confine.ts`). Never read or write outside them.
- One logical change per PR; branch off `main`.
