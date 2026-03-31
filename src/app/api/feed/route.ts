import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { FeedQuerySchema, FeedPostSchema } from "@/lib/validators";
import type { FeedResponse, FeedPost } from "@/types/index";
import type { PostCategory, PostType, AmbassadorRole } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl;
    const parsed = FeedQuerySchema.safeParse({
      zip: url.searchParams.get("zip"),
      page: url.searchParams.get("page") || undefined,
      limit: url.searchParams.get("limit") || undefined,
    });

    if (!parsed.success) {
      return Response.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { zip, page, limit } = parsed.data;

    const where = {
      AND: [
        { zipCode: zip },
        { status: "visible" },
        {
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
      ],
    };

    const [total, ambassadorCount] = await Promise.all([
      prisma.communityPost.count({ where }),
      prisma.ambassador.count({ where: { zipCode: zip, status: "approved" } }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const posts = await prisma.communityPost.findMany({
      where,
      orderBy: [
        { isPinned: "desc" },
        { createdAt: "desc" },
      ],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        body: true,
        category: true,
        postType: true,
        upvotes: true,
        flags: true,
        isPinned: true,
        createdAt: true,
        expiresAt: true,
        ambassador: {
          select: {
            id: true,
            displayName: true,
            bio: true,
            role: true,
            verifiedAt: true,
          },
        },
      },
    });

    const response: FeedResponse = {
      posts: posts.map((p): FeedPost => ({
        id: p.id,
        title: p.title,
        body: p.body,
        category: p.category as PostCategory,
        postType: p.postType as PostType,
        upvotes: p.upvotes,
        flags: p.flags,
        isPinned: p.isPinned,
        createdAt: p.createdAt.toISOString(),
        expiresAt: p.expiresAt?.toISOString() ?? null,
        ambassador: p.ambassador
          ? {
              id: p.ambassador.id,
              displayName: p.ambassador.displayName,
              bio: p.ambassador.bio,
              role: p.ambassador.role as AmbassadorRole,
              verifiedAt: p.ambassador.verifiedAt?.toISOString() ?? null,
            }
          : null,
      })),
      total,
      page,
      totalPages,
      ambassadorCount,
    };

    return Response.json(response);
  } catch (error) {
    console.error("GET /api/feed error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = FeedPostSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { zip, body: postBody, category } = parsed.data;

    // Verify the zip code exists
    const zipRecord = await prisma.zipCode.findUnique({ where: { zip } });
    if (!zipRecord) {
      return Response.json(
        { error: "Zip code not found" },
        { status: 404 }
      );
    }

    const post = await prisma.communityPost.create({
      data: {
        zipCode: zip,
        body: postBody,
        category,
        postType: "community",
        status: "visible",
      },
      select: {
        id: true,
        title: true,
        body: true,
        category: true,
        postType: true,
        upvotes: true,
        flags: true,
        isPinned: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    return Response.json(
      {
        ...post,
        createdAt: post.createdAt.toISOString(),
        expiresAt: null,
        ambassador: null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/feed error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
