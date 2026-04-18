# Agent guidelines for chat-app

## Project
Real-time chat app for hackathon submission. Must run via `docker compose up`.
See SPEC.md for requirements triage. See DEMO.md for demo flow. 
Update progress.md as tasks complete.

## Stack (FROZEN — do not change)
- Next.js 15 App Router, TypeScript, Tailwind, shadcn/ui
- Drizzle ORM (schema in src/db/schema/*.ts) + Postgres 16
- better-auth for sessions/auth (email + password only)
- Socket.io via custom server (server.ts)
- Local Docker volume (./uploads) for file uploads

## Commands
- `pnpm dev` — start dev server (custom server, includes socket.io)
- `pnpm db:push` — sync Drizzle schema to DB (development only)
- `pnpm db:studio` — open Drizzle Studio
- `pnpm typecheck` — tsc --noEmit
- `pnpm lint` — ESLint
- `pnpm test` — Playwright
- `docker compose up` — full stack (what judges will run)

## Rules
- Never add dependencies without asking. Stack is frozen.
- Never modify tests to make them pass. Fix the code.
- Never add auth providers beyond email + password.
- Never touch Jabber / XMPP / federation. Skip that section entirely.
- Use `$inferSelect` / `$inferInsert` for Drizzle types, not `InferModel`.
- For Drizzle reads with relations, use `db.query.*`. Don't mix with 
  `select()` in the same function.
- Commit after every passing test. Small commits > big commits.
- If a task isn't working after 2 attempts, stop and ask.
- Server-only code in src/server/ or src/lib/. Never import from there 
  in client components.

## Conventions
- kebab-case files, PascalCase components
- Drizzle schema split by domain in src/db/schema/*.ts
- Every feature ships with at least one Playwright smoke test (happy path)
- Use `sonner` for toasts (via shadcn)
- Use zod for all input validation (API routes, server actions, forms)

## Never-do list
- No raw SQL except via Drizzle's sql`` template
- No localStorage for auth state — cookies only
- No client env vars for secrets (only NEXT_PUBLIC_* intentionally public)
- No force-pushing to main
- No modifying server.ts to remove the custom server — we need it for socket.io
