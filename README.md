# Chatty

A full-featured real-time web chat application built for the DataArt Agentic
Development Hackathon.

## Quick Start

```bash
docker compose up
```

The app will be available at `http://localhost:3000`.

`docker compose up` works without a local `.env` file. If you want to override
defaults, copy `.env.example` to `.env` and edit it.

## Seed Data

The first run automatically seeds the database with demo data.

| User  | Email            | Password |
| ----- | ---------------- | -------- |
| alice | alice@test.com   | alice123 |
| bob   | bob@test.com     | bob123   |
| carol | carol@test.com   | carol123 |
| dave  | dave@test.com    | dave123  |

Pre-created rooms:
- `#general` public room with seeded history and image attachments
- `#engineering` private room
- `#random` public room

The seed also includes:
- existing DM history between alice and bob
- 50 contact users for larger-list testing
- unread state, invitations, friend requests, and moderation data

To reseed from scratch:

```bash
docker compose run --rm seed sh -c "pnpm db:push && pnpm db:seed --force"
```

## Features

**Core chat**
- User registration and authentication with email + password
- Public and private chat rooms
- Personal direct messaging between friends
- Real-time messaging via Socket.io
- Message replies, editing, and deletion
- File and image attachments with access control
- Infinite-scroll message history

**Social**
- Friend requests and contact list
- User-to-user ban that freezes DM history and blocks new contact
- Online / AFK / offline presence with multi-tab support
- Unread indicators for rooms and direct messages

**Moderation**
- Room owner and admin roles
- Member removal and room bans
- Ban list management with attribution
- Room deletion with cascade cleanup for messages and files

**Account management**
- Active sessions list with browser/IP details
- Remote session revocation
- Password change
- Password reset demo flow
- Account deletion with cascade cleanup

**XMPP / Jabber**
- Two Prosody 0.12 servers in Docker (`a.chat.local`, `b.chat.local`)
- Bidirectional bridge between XMPP MUC rooms and the web app
- Federation between both Prosody servers over S2S
- Admin dashboard at `/chat/admin/jabber`
- Load test report for 100 bots in
  [`scripts/xmpp-load-test-report.json`](./scripts/xmpp-load-test-report.json)

## Tech Stack

| Layer | Technology |
| ----- | ---------- |
| Framework | Next.js 15 App Router, TypeScript |
| UI | Tailwind CSS, shadcn/ui, boring-avatars |
| Database | PostgreSQL 16, Drizzle ORM |
| Auth | better-auth with database-backed sessions |
| Real-time | Socket.io on a custom Next.js server |
| Data fetching | TanStack Query |
| XMPP | Prosody 0.12, `@xmpp/client` |
| Containers | Docker Compose |

## Architecture

- REST API routes handle CRUD-style operations: auth, rooms, friends,
  moderation, uploads, unread tracking, and session management.
- Socket.io handles real-time pushes only: messages, presence heartbeats,
  invitations, notifications, and moderation/session events.
- PostgreSQL stores users, sessions, rooms, memberships, messages,
  attachments, friendships, bans, and unread state.
- Uploaded files are stored on local disk under `./uploads` and served only
  through access-controlled API routes.
- XMPP bridge traffic flows through Prosody MUC rooms and federated S2S links
  between the two local Prosody servers.

## Project Structure

```text
.
├── docker-compose.yml
├── Dockerfile
├── server.ts
├── SPEC.md
├── AGENTS.md
├── docs/
│   ├── README.md
│   ├── ai-workflow.md
│   ├── demo.md
│   ├── design.md
│   ├── original-task.md
│   ├── progress.md
│   └── plans/
├── prosody/
├── scripts/
├── src/
│   ├── app/
│   ├── components/
│   ├── db/
│   ├── hooks/
│   ├── lib/
│   └── server/
└── tests/
```

## Documentation

- [`SPEC.md`](./SPEC.md): authoritative requirements triage and technical decisions
- [`docs/original-task.md`](./docs/original-task.md): original hackathon task
- [`docs/demo.md`](./docs/demo.md): demo path
- [`docs/design.md`](./docs/design.md): design conventions
- [`docs/ai-workflow.md`](./docs/ai-workflow.md): AI workflow log
- [`docs/progress.md`](./docs/progress.md): progress log and accepted tradeoffs

## Testing

```bash
pnpm test
pnpm test:int
pnpm test:e2e
```

## XMPP Testing

```bash
# Register load-test bots
bash scripts/xmpp-register-bots.sh

# Single XMPP connectivity test
pnpm tsx scripts/xmpp-test.ts

# Federation/load test
pnpm tsx scripts/xmpp-load-test.ts
```

## Notes

- The intended judge flow is `docker compose up`.
- The custom server in `server.ts` is required for Socket.io.
- The app is designed to run with zero external runtime dependencies.
