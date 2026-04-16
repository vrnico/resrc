# resrc

A community resource directory that helps people find local social services by zip code — food banks, shelters, healthcare clinics, and more.

## What it does

- Search resources by zip code with proximity ranking
- Browse by category: food, housing, healthcare, community
- Vote on and comment on resources
- Submit new resources for moderator review
- Community feed for local posts and events
- Role-based moderation (user, social_worker, moderator, admin)

## Tech stack

- **Next.js 16** — App Router, server components, API routes
- **Supabase** — Postgres, Auth, Row Level Security
- **Prisma** — schema and seed tooling
- **Zod** — request validation
- **SWR** — client-side data fetching
- **Lucide React** — icons

## Quick start

```bash
npm install
npm run dev
```

Database setup: run `supabase/migration.sql` in the Supabase SQL Editor, then seed zip codes and resources:

```bash
npx ts-node supabase/seed-zip-codes.ts
```

Environment variables required (copy `.env.example` to `.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## API routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/signup` | Register |
| POST | `/api/auth/signin` | Login |
| POST | `/api/auth/signout` | Logout |
| GET | `/api/auth/me` | Current user profile |
| GET | `/api/resources?zip=` | Resources near a zip code |
| POST | `/api/resources/[id]/vote` | Upvote or downvote |
| GET/POST | `/api/resources/[id]/comments` | Nested comment threads |
| GET/POST | `/api/feed?zip=` | Community posts |
| POST | `/api/feed/[id]/vote` | Vote on a post |
| POST | `/api/feed/[id]/flag` | Flag a post |
| GET/POST | `/api/events?zip=` | Regional events |
| POST | `/api/reports` | Submit a report |
| GET/PATCH | `/api/admin/users` | Manage users (admin) |
| GET/PATCH | `/api/admin/moderation` | Moderate content (admin) |

## Resource data

Seed data lives in `scripts/discovery/data/seeds/` — one JSON file per state. Currently covers 30+ states with 7,000+ resources, sourced via a discovery pipeline that searches by zip code batch.

See [`scripts/discovery/README.md`](scripts/discovery/README.md) for full pipeline documentation, including how to run discovery for new states and upsert resources into the database.
