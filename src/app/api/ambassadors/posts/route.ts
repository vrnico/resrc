import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { AmbassadorPostSchema } from "@/lib/validators";
import { getAmbassadorFromRequest } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const ambassador = await getAmbassadorFromRequest(request);
    if (!ambassador) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = AmbassadorPostSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { zip, title, body: postBody, category, expiresInDays } = parsed.data;

    // Verify zip exists
    const zipRecord = await prisma.zipCode.findUnique({ where: { zip } });
    if (!zipRecord) {
      return Response.json({ error: "Zip code not found" }, { status: 404 });
    }

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const post = await prisma.communityPost.create({
      data: {
        zipCode: zip,
        title,
        body: postBody,
        category,
        postType: "ambassador",
        ambassadorId: ambassador.id,
        status: "visible",
        expiresAt,
      },
      select: {
        id: true,
        title: true,
        body: true,
        category: true,
        postType: true,
        upvotes: true,
        isPinned: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    return Response.json(
      {
        ...post,
        createdAt: post.createdAt.toISOString(),
        expiresAt: post.expiresAt?.toISOString() ?? null,
        ambassador: {
          id: ambassador.id,
          displayName: ambassador.displayName,
          bio: ambassador.bio,
          role: ambassador.role,
          verifiedAt: ambassador.verifiedAt?.toISOString() ?? null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/ambassadors/posts error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const ambassador = await getAmbassadorFromRequest(request);
    if (!ambassador) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const posts = await prisma.communityPost.findMany({
      where: { ambassadorId: ambassador.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        body: true,
        category: true,
        postType: true,
        upvotes: true,
        flags: true,
        status: true,
        isPinned: true,
        createdAt: true,
        expiresAt: true,
        zip: { select: { zip: true, city: true, stateCode: true } },
      },
    });

    return Response.json({
      posts: posts.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        expiresAt: p.expiresAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    console.error("GET /api/ambassadors/posts error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
