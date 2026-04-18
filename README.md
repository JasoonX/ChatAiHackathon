# Chatty

Real-time chat app for the hackathon submission. It supports public rooms, private rooms with invitations, direct messages, friend requests, presence, file uploads, unread indicators, active sessions, and room moderation.

## Run With Docker

```bash
docker compose up --build
```

Open `http://localhost:3000`.

`docker compose up` works without a local `.env` file. If you want to override defaults, copy `.env.example` to `.env` and edit it.

What happens on startup:
- PostgreSQL 16 starts
- Drizzle schema is pushed automatically
- demo seed data is inserted automatically
- the Next.js + Socket.io app starts on port `3000`

If you need to reseed manually:

```bash
cp .env.example .env
docker compose run --rm seed sh -c "pnpm db:push && pnpm db:seed --force"
```

## Default Seed Users

- `alice@test.com` / `alice123`
- `bob@test.com` / `bob123`
- `carol@test.com` / `carol123`

The seed also creates:
- public rooms including `#general`
- a private `#engineering` room
- existing messages and file attachments
- `alice ↔ bob` friendship with DM history
- a pending friend request from `carol` to `alice`

## Local Development

```bash
cp .env.example .env
docker compose up db -d
pnpm install
pnpm db:push
pnpm db:seed
pnpm dev
```

## Tech Stack

- Next.js 15 App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Socket.io on a custom Next.js server
- Drizzle ORM + `postgres`
- PostgreSQL 16
- better-auth
- pnpm
- Node 20

## Architecture

- REST API routes handle auth, rooms, friends, moderation, uploads, unread tracking, and other CRUD-style operations.
- Socket.io handles live messaging, presence, invitations, friend notifications, moderation broadcasts, and session revocation.
- PostgreSQL stores auth, rooms, memberships, messages, attachments, friendships, bans, and unread state.
- Local disk storage under `./uploads` stores uploaded files and is mounted into Docker.

## Notes

- `docker compose up` is the intended judge flow.
- The `seed` service is part of Compose and runs automatically before the app service starts.
- The project workflow log is in [AI_WORKFLOW.md](./AI_WORKFLOW.md).
