@AGENTS.md

# Resrc Project

## Quick Start
```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

## Key Architecture Decisions
- **Prisma 7** with libSQL adapter — import PrismaClient from `@/generated/prisma/client` (not `@prisma/client`)
- **Next.js 16** App Router — `params` and `searchParams` are `Promise` types, must be awaited
- **SQLite** for dev, PostgreSQL for prod
- **No user auth** — only admin auth needed
- Seed data lives in `prisma/seed/` as JSON files

## File Ownership (Parallel Development)
When working as a lane agent, ONLY modify files in your assigned lane.
See ROADMAP.md for the full file ownership matrix.

## Prisma Client Usage
```typescript
import { prisma } from "@/lib/db";
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
