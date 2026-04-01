@AGENTS.md

# Resrc Project

## Quick Start
```bash
npm install
npm run dev
```

Database: Run `supabase/migration.sql` in the Supabase SQL Editor to set up tables.
Seed data: Run `supabase/seed-zip-codes.ts` to populate zip codes and resources.

## Key Architecture Decisions
- **Supabase** (Postgres + Auth + RLS) — replaces Prisma/SQLite
- **Next.js 16** App Router — `params` and `searchParams` are `Promise` types, must be awaited
- **Supabase Auth** for all user authentication (email/password, sessions via cookies)
- **Row Level Security** enforced at the database level for all tables
- **User roles**: `user`, `moderator` (formerly ambassador), `social_worker`, `admin`
- Seed data lives in `prisma/seed/` as JSON files (legacy location, still valid)

## Supabase Client Usage
```typescript
// Browser (client components)
import { createClient } from "@/lib/supabase/client";

// Server (API routes, server components)
import { createClient } from "@/lib/supabase/server";

// Admin (bypasses RLS — server only)
import { createAdminClient } from "@/lib/supabase/admin";
```

## Auth Helpers
```typescript
import { getUser, getUserProfile, requireUser, requireRole } from "@/lib/auth";

// In API routes:
const user = await requireUser();  // throws 401 if not authenticated
const profile = await requireRole("moderator", "admin");  // throws 403 if wrong role
```

## API Route Pattern (Next.js 16)
```typescript
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  // ...
  return Response.json({ data });
}

// Dynamic routes:
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
}
```

## Page Pattern (Next.js 16)
```typescript
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { zip } = await searchParams;
}
```

## Database Schema (Supabase)
Key tables: `profiles`, `resources`, `resource_votes`, `resource_comments`, `community_posts`, `post_votes`, `events`, `reports`, `zip_codes`, `categories`

Views: `profiles_with_location`, `comments_with_author`, `events_with_author`, `posts_with_author`

## API Routes
- `POST /api/auth/signup` — register with email, password, display name, zip
- `POST /api/auth/signin` — login
- `POST /api/auth/signout` — logout
- `GET /api/auth/me` — current user profile
- `GET /api/resources?zip=...` — resources by zip with vote info
- `POST /api/resources/[id]/vote` — upvote/downvote resource
- `GET/POST /api/resources/[id]/comments` — nested comment threads
- `GET/POST /api/feed?zip=...` — community posts
- `POST /api/feed/[id]/vote` — upvote/downvote post
- `POST /api/feed/[id]/flag` — flag post
- `GET/POST /api/events?zip=...` — regional events (approval required)
- `POST /api/reports` — anonymous or authenticated reports
- `GET/PATCH /api/admin/users` — manage user roles/status (admin only)
- `GET/PATCH /api/admin/moderation` — moderate posts and events
