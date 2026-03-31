import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

function isAdmin(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  return authHeader.slice(7) === process.env.ADMIN_PASSWORD;
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl;
  const status = url.searchParams.get("status") || "flagged";

  const posts = await prisma.communityPost.findMany({
    where: {
      OR: [
        { status },
        { flags: { gte: 3 } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      zip: { select: { city: true, stateCode: true } },
      ambassador: {
        select: { id: true, displayName: true, role: true },
      },
    },
  });

  return Response.json({
    posts: posts.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      expiresAt: p.expiresAt?.toISOString() ?? null,
    })),
  });
}

export async function PATCH(request: NextRequest) {
  if (!isAdmin(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, action } = body;

    if (!id || !action) {
      return Response.json({ error: "Post ID and action required" }, { status: 400 });
    }

    let updateData: Record<string, unknown> = {};
    switch (action) {
      case "approve":
        updateData = { status: "visible", flags: 0 };
        break;
      case "remove":
        updateData = { status: "removed" };
        break;
      case "pin":
        updateData = { isPinned: true };
        break;
      case "unpin":
        updateData = { isPinned: false };
        break;
      default:
        return Response.json({ error: "Invalid action" }, { status: 400 });
    }

    const updated = await prisma.communityPost.update({
      where: { id },
      data: updateData,
      select: { id: true, status: true, isPinned: true },
    });

    return Response.json(updated);
  } catch (error) {
    console.error("PATCH /api/admin/moderation error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
