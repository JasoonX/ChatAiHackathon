# AI Workflow Log

## Overview

This project was built using agentic AI development: structured prompts to
coding agents, iterative review, and selective hand-editing.

To keep this document credible, claims are split into two buckets:

- **Verified from repo**: backed by git history, current files, tests, or logs
- **Approximate / recollected**: useful context, but not provable from the repo alone

## Verified From Repo

### Build Window

Based on git history:

- first project commit: `2026-04-18 13:25 +0300`
- latest project commit: `2026-04-19 15:03 +0300`
- wall-clock span between first and last commit: about **25.6 hours**
- active commit-window estimate, excluding the overnight gap: about **16.1 hours**

### Repo-Backed Stats

- Total commits: **42**
- Lines of application code (`src/**/*.ts(x)`): **15,956**
- Lines of test code (`src` + `tests` test files): **1,401**

### Repo-Backed Tooling / Architecture Facts

- Next.js 15 App Router with a custom server in `server.ts`
- Docker Compose-based full stack
- better-auth with database-backed sessions
- Drizzle ORM with PostgreSQL
- Socket.io for real-time messaging
- Prosody-based XMPP setup with federation between `a.chat.local` and `b.chat.local`
- Jabber dashboard at `/chat/admin/jabber`
- Load test report present in
  [`scripts/xmpp-load-test-report.json`](../scripts/xmpp-load-test-report.json)

### Repo-Backed Test Coverage

The repo contains tests for:

- permissions:
  [`src/lib/permissions.test.ts`](../src/lib/permissions.test.ts)
- auth integration:
  [`src/lib/auth.int.test.ts`](../src/lib/auth.int.test.ts)
- socket auth middleware:
  [`src/server/socket-auth.int.test.ts`](../src/server/socket-auth.int.test.ts)
- room deletion integration:
  [`src/server/room-deletion.int.test.ts`](../src/server/room-deletion.int.test.ts)
- additional integration coverage in:
  [`src/app/api/users/me/route.int.test.ts`](../src/app/api/users/me/route.int.test.ts) and
  [`src/db/schema/users.int.test.ts`](../src/db/schema/users.int.test.ts)

Playwright is present in the toolchain, but there are currently **no
implemented E2E spec files** under `tests/e2e`.

### Repo-Backed Delivery Timeline

From the commit history, the broad sequence is supported:

#### April 18

- scaffolding
- test harness
- spec / task docs
- schema
- design system integration
- permissions
- auth
- TanStack Query
- public rooms
- real-time messaging
- private rooms and invitations
- attachments
- moderation / bans
- unread state
- session management
- account / room deletion cleanup

#### April 19

- presence and messaging polish
- password reset flow
- title / auth-flow cleanup
- XMPP level 1 verification
- bidirectional bridge + federation verification
- load-test report
- Jabber sidebar access
- docs cleanup

## Approximate / Recollected

### Tools Used

| Tool               | Model      | Role                                                                                                                                    | Approximate share |
| ------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| OpenAI Codex       | GPT-5.x    | Primary coding agent for scaffolding, schema design, API routes, business logic, Socket.io handlers, XMPP work, and most implementation | ~60%              |
| Claude Code        | Sonnet 4.6 | UI components, design token integration, polish, alternate debugging passes, and some parallel feature work                             | ~35%              |
| Claude (claude.ai) | Opus 4.6   | Planning, spec analysis, architecture discussion, and requirement triage                                                                | ~5%               |
| Claude Design      | —          | Initial design system reference generation                                                                                              | Pre-hackathon     |

These percentages are estimates, not something the repo can verify.

### Working Patterns

The following patterns were used, but the exact proportions and timing are
recollections rather than repo-proven facts:

- spec-driven development with `SPEC.md` as the authoritative product/technical triage
- `AGENTS.md` as an execution constraint layer
- [`docs/demo.md`](./demo.md) as the must-ship demo anchor
- selective parallel work across backend and UI when file ownership was clear
- use of fresh sessions/context resets when task domains shifted

### TDD / Verification Approach

The repo proves the tests exist. What it does **not** prove is the exact
red-green sequence or how strictly it was followed in every case.

So the most defensible version is:

- permissions and auth were treated as high-risk paths and received focused test coverage
- CRUD-heavy UI and route work was more often implemented and then verified

### Approximate Session Stats

- Total agent sessions: **~25-30**
- Estimated prompts: **~150-200**
- Context clears / restarts: **~10-15**
- Percentage agent-written: **100%**

These are recollections, not repo-derived metrics.

## What Worked

The following are qualitative conclusions, not hard measurements:

- spec-first prompting reduced ambiguity and made agent output more usable
- strong agent guardrails in `AGENTS.md` prevented many common failure modes
- parallel work was effective when file ownership was clear
- focused tests on permissions and auth helped stabilize the foundation
- agent pushback was useful when it prevented weak schema/design decisions
- agents were particularly effective for debugging integration issues once the symptoms were clear

## What Didn’t Work

These issues are consistent with the final codebase and commit history, but the
time costs are no longer stated as hard facts:

- Socket.io room subscription timing caused real-time delivery issues after HTTP-side membership changes
- TanStack Query cache shape mismatches caused message rendering/update issues
- better-auth integration details required library-specific debugging
- Prosody operational issues required pragmatic Docker- and config-level fixes:
  healthchecks, volume ownership, MUC room locking, and federation DNS aliases
- context management and review remained the real bottleneck even when code generation was fast

## Key Insight

The most defensible high-level takeaway is:

The bottleneck in agentic development was not raw code generation. It was
verification, review, and context management.

The agents could produce code quickly, but the quality of the result depended on:

- clear constraints
- authoritative specs
- small verifiable increments
- disciplined handoff notes
- refusing to let context drift too far from the actual task
