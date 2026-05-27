# SpeakUp

Zero-cost, peer-to-peer English speaking practice platform with WebRTC video calling, matchmaking, and full auth.

## Architecture

```
speakup/
  apps/
    web/          ← Next.js 14 (Vercel)
    server/       ← Express + Socket.IO + PeerJS (Render)
  packages/
    types/        ← Shared TypeScript types (@speakup/types)
    config/       ← Shared constants (@speakup/config)
    tsconfig/     ← Shared TS config (@speakup/tsconfig)
```

## Quick Start

```bash
# Install
npm install

# Start both server and web
npm run dev

# Or start individually
npm run dev:server
npm run dev:web
```

## Prerequisites

- Node.js 20+
- Supabase project (free tier) — for auth, DB, storage
- PeerJS server (public broker is free, or self-host)

## Environment Variables

### `apps/server/.env`

```
DATABASE_URL=postgres://...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=service_role_key
CORS_ORIGIN=http://localhost:3000
PORT=4000
```

### `apps/web/.env.local`

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon_key
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

## Database

Tables must be created manually via Supabase SQL Editor (PgBouncer blocks DDL):

```
apps/server/prisma/init.sql
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all apps in parallel |
| `npm run build` | Build all apps |
| `npm run test` | Run all tests |
| `npm run typecheck` | TypeScript check all apps |
| `npm run lint` | Lint all apps |

## Tech Stack

| Component | Choice | Cost |
|-----------|--------|------|
| Frontend | Next.js 14 | $0 (Vercel Hobby) |
| Backend | Express + Socket.IO | $0 (Render Free) |
| WebRTC | PeerJS + Google STUN | $0 |
| Database | Supabase PostgreSQL | $0 (Free tier) |
| Auth | Supabase Auth | $0 (Free tier) |
| State | Zustand | $0 |
| Queues | In-memory Map | $0 |

## Deployment

Web → Vercel (connect GitHub repo, env vars via dashboard)
Server → Render (Docker or Node, env vars via dashboard)
