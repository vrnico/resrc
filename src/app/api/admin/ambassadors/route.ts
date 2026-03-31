import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

// Simple admin auth check (uses ADMIN_PASSWORD env var)
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
  const status = url.searchParams.get("status") || undefined;

  const ambassadors = await prisma.ambassador.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      displayName: true,
      email: true,
      bio: true,
      zipCode: true,
      radius: true,
      status: true,
      role: true,
      verifiedAt: true,
      createdAt: true,
      _count: { select: { posts: true } },
    },
  });

  return Response.json({
    ambassadors: ambassadors.map((a) => ({
      ...a,
      postCount: a._count.posts,
      _count: undefined,
      verifiedAt: a.verifiedAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}

export async function PATCH(request: NextRequest) {
  if (!isAdmin(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, status, role } = body;

    if (!id) {
      return Response.json({ error: "Ambassador ID required" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (role) updateData.role = role;
    if (status === "approved") updateData.verifiedAt = new Date();

    const updated = await prisma.ambassador.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        displayName: true,
        status: true,
        role: true,
        verifiedAt: true,
      },
    });

    return Response.json({
      ...updated,
      verifiedAt: updated.verifiedAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("PATCH /api/admin/ambassadors error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
