# Agent guidelines for chat-app

## Project

Real-time chat app for hackathon submission. Must run via `docker compose up`
with zero external dependencies (Mars rule — imagine deploying to Mars orbit
with no Earth connection).

## Reference documents

- SPEC.md: authoritative triage and technical decisions. Follow this.
- docs/original-task.md: original hackathon task for reference.
  If SPEC.md and original-task.md conflict, SPEC.md wins.
- docs/demo.md: the demo flow. Every feature on this path is must-ship.
- docs/design.md: design language and component conventions.
- docs/ai-workflow.md: log of tools and orchestration patterns used.
- docs/progress.md: current status. Update after every task completion.

## Stack (FROZEN — do not change)

- Next.js 15 App Router, TypeScript, Tailwind, shadcn/ui
- Drizzle ORM (schema in src/db/schema/\*.ts) + Postgres 16
- better-auth for sessions/auth (email + password only)
- Socket.io via custom server (server.ts)
- TanStack Query for all client-server data fetching
- Local Docker volume (./uploads) for file uploads

## Commands

- `pnpm dev` — start dev server (custom server, includes Socket.io)
- `pnpm db:push` — sync Drizzle schema to DB (development only)
- `pnpm db:studio` — open Drizzle Studio
- `pnpm typecheck` — tsc --noEmit
- `pnpm lint` — ESLint
- `pnpm test` — Vitest unit tests
- `pnpm test:int` — Vitest integration tests (requires Docker)
- `pnpm test:e2e` — Playwright end-to-end tests
- `pnpm test:all` — all tests
- `docker compose up` — full stack (what judges will run)

## Architecture pattern

- REST (Next.js API routes) for all CRUD: auth, rooms, members, message
  history, file upload/download, admin actions
- Socket.io for real-time pushes only: new message broadcast, presence
  heartbeat, typing indicator, notification events, room join/leave events
- Never implement CRUD operations over Socket.io
- Never rely on client-sent "inactive" signals for presence — use
  server-side heartbeat timeout

## Data fetching

- TanStack Query is the single source of truth for all server state
- GET → useQuery, mutations → useMutation
- Socket.io events update TanStack Query cache directly via
  queryClient.setQueryData — never maintain parallel React state
- High-frequency events (message:new, message:updated, message:deleted,
  presence:update): use setQueryData to patch the cache in-place
- Low-frequency events (room:member-joined, room:deleted,
  invitation:received, friend:accepted): use invalidateQueries
  to trigger a clean refetch
- All query hooks in src/hooks/ (useRooms.ts, useMessages.ts, etc.)
- No raw fetch() in components
- No useQuery for socket-only data (typing indicators) — those use
  local useState since they're ephemeral and not worth caching

## Message cache updates

- Messages use useInfiniteQuery with cursor pagination
- Cache structure is { pages: [{ messages: [], nextCursor }] }
- Socket "message:new": append to the LAST page's messages array
- Socket "message:updated" / "message:deleted": map across ALL pages
  to find and replace the message by ID
- Never replace the entire cache — always preserve the pages structure
- Never use invalidateQueries for new messages (causes full refetch)

## Presence implementation

- Activity detection: multi-signal (mousemove, mousedown, keydown, scroll,
  touchstart, pointerdown, focus), NOT mousemove-only
- Client emits max one "heartbeat" event per 2-3s via debounce.
  Never emit per-event.
- Server derives presence per-user from per-socket heartbeat timestamps:
  any socket <60s → online; all sockets stale >60s → afk;
  no sockets → offline
- Do not implement BroadcastChannel or cross-tab communication
- Tab hibernation handled by Socket.io ping/pong timeout (~25s).
  No special code needed.

## Auth

- Database-backed sessions only. NO JWT for sessions.
- Session revocation must take effect immediately (delete row +
  disconnect socket). Not TTL-based.
- Sessions table stores IP + user-agent for active sessions UI.
- Invitations and friend requests: in-app only, by username. No email.

## Conventions

- kebab-case files, PascalCase components
- Server code in src/server/ or src/lib/. Never import from there
  in client components.
- Drizzle schema split by domain in src/db/schema/\*.ts
- Use `$inferSelect` / `$inferInsert` for Drizzle types, not `InferModel`
- For Drizzle reads with relations, use `db.query.*`. Don't mix with
  `select()` in the same function.
- Use `sonner` for toasts (via shadcn)
- Use zod for all input validation (API routes, server actions, forms)

## UI work

- Design tokens live in src/app/globals.css (CSS variables) and are wired
  through tailwind.config.ts. All shadcn components inherit them.
- Use the `gpt-taste` skill for frontend/UI work in this repo when the task
  involves layout, styling, visual polish, interaction design, or page
  composition. Treat it as the default frontend taste/aesthetic guidance layer,
  but still preserve existing product patterns where the current app already
  establishes them.
- Read docs/design.md before building any UI component.
- Match pixel references in design/screens/ for major screens.
- Do NOT copy components from design/claude-design-export.html directly.
  Rebuild using shadcn + Tailwind, matching the visual style.
- No external runtime dependencies. No CDN fonts. No external APIs.
  All assets must be bundled.

## Testing

### When to write tests first (strict TDD)

- All pure functions in src/lib/permissions.ts (access control)
- All auth flows: register, login, logout, session revocation, password change
- Ban enforcement: room ban, user-to-user ban, admin removal
- Access control on files and message history after membership changes

### When to write tests after (test-after, same commit)

- UI components (Playwright, not Vitest)
- Socket.io handlers (integration tests with testcontainers)
- Server actions / API routes for normal CRUD

### When to skip tests

- Styling, layout, visual polish
- One-off scripts, seeds, README
- TypeScript-only checks that tsc already catches

### When a test fails

Default assumption: the test is correct and the code is wrong. Fix the code.

A test may be wrong in specific cases:

- It encodes a requirement that has since changed (update SPEC.md first,
  then update the test, then update the code — in that order)
- It has a bug in setup, assertion, or test data (unrelated to the feature
  under test)
- It's testing the wrong thing (measuring implementation detail instead
  of behavior)

If you believe a test is wrong, you must:

1. STOP. Do not modify the test silently.
2. Explain: which test, what you think is wrong, why, and what you
   propose to change.
3. Wait for my approval before editing the test.

Never disable, skip, or delete a test to get green. Never loosen an
assertion to accommodate a bug. If you catch yourself thinking "this
test is being too strict", that is the signal to stop and ask.

### File naming

- Unit: src/\*_/_.test.ts (runs on every save)
- Integration: src/\*_/_.int.test.ts (requires Docker)
- E2E: tests/e2e/\*.spec.ts (Playwright)

## Commit discipline

- Default: commit after each passing test or working feature. Exception:
  batch closely related changes into one commit when they make no sense
  separately — state the grouping rationale in the commit message.
- Reference requirement IDs in commit messages (e.g., R2.4.8, R2.5.3).
- Small commits > big commits. Always.

## Dependencies

- Default: no new dependencies. If you believe one is needed, stop and
  propose it with: what it solves, why existing tools don't, bundle size
  impact. Wait for approval.

## Hard rules (no exceptions)

- Never modify server.ts to remove the custom server — Socket.io needs it
- No external runtime dependencies. No CDN fonts. No external APIs.
- Database-backed sessions only (no JWT)
- No force-pushing to main
- No client-side env vars for secrets (only NEXT*PUBLIC*\* for intentionally
  public values)
- No raw SQL except via Drizzle's sql`` template
- No localStorage for auth state — cookies only

## Escalation

Stop and ask me when:

- You believe a test is wrong (see Testing section)
- You want to add a dependency (see Dependencies section)
- You want to modify SPEC.md or the frozen stack
- A task has failed 2+ attempts at the same approach
- You're about to make a change >100 lines in a file you haven't touched
  in this session
- You find a bug in existing code that isn't in your current task
- You're uncertain whether a requirement is must-ship or should-ship

Escalate by: pausing execution, explaining the situation in <=5 sentences,
and waiting for guidance. Do not proceed silently.
