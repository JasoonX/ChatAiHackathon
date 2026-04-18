# chat-app

Starter scaffold for a hackathon real-time chat app. The stack is fixed: Next.js 15 App Router, TypeScript, Tailwind, shadcn/ui, Drizzle ORM, PostgreSQL 16, better-auth, Socket.io, Docker, and pnpm.

## Local development

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL with `docker compose up db -d`.
3. Install dependencies with `pnpm install`.
4. Push the schema with `pnpm db:push`.
5. Start the app with `pnpm dev`.

## Docker Compose

1. Copy `.env.example` to `.env`.
2. Run `docker compose up --build`.
3. Open `http://localhost:3000`.

## Stack summary

- Next.js 15 App Router with a custom `server.ts`
- Socket.io attached to the same HTTP server
- Drizzle ORM with PostgreSQL 16
- better-auth wired for email and password auth
- Tailwind CSS + shadcn/ui starter components
- Local `./uploads` volume mounted into Docker
