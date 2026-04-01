import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FeedQuerySchema, FeedPostSchema } from "@/lib/validators";
import type { FeedResponse, FeedPost } from "@/types/index";
import type { PostCategory } from "@/lib/constants";

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
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { zip, page, limit } = parsed.data;
    const supabase = await createClient();

    const offset = (page - 1) * limit;

    // Get posts with author info
    const { data: posts, count } = await supabase
      .from("posts_with_author")
      .select("*", { count: "exact" })
      .eq("zip_code", zip)
      .eq("status", "visible")
      .or("expires_at.is.null,expires_at.gt.now()")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    // Get current user's votes on these posts
    const { data: { user } } = await supabase.auth.getUser();
    const userVotes = new Map<string, number>();
    if (user && posts?.length) {
      const postIds = posts.map((p) => p.id);
      const { data: votes } = await supabase
        .from("post_votes")
        .select("post_id, vote")
        .eq("user_id", user.id)
        .in("post_id", postIds);

      for (const v of votes ?? []) {
        userVotes.set(v.post_id, v.vote);
      }
    }

    const response: FeedResponse = {
      posts: (posts ?? []).map((p): FeedPost => ({
        id: p.id,
        title: p.title,
        body: p.body,
        category: p.category as PostCategory,
        upvotes: p.upvotes,
        downvotes: p.downvotes,
        flags: p.flags,
        is_pinned: p.is_pinned,
        user_id: p.user_id,
        author_name: p.author_name,
        author_city: p.author_city,
        author_state: p.author_state,
        created_at: p.created_at,
        expires_at: p.expires_at,
        user_vote: (userVotes.get(p.id) as 1 | -1) ?? null,
      })),
      total,
      page,
      totalPages,
    };

    return Response.json(response);
  } catch (error) {
    console.error("GET /api/feed error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = FeedPostSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { zip, title, body: postBody, category } = parsed.data;

    // Verify zip exists
    const { data: zipRecord } = await supabase
      .from("zip_codes")
      .select("zip")
      .eq("zip", zip)
      .single();

    if (!zipRecord) {
      return Response.json({ error: "Zip code not found" }, { status: 404 });
    }

    const { data: post, error } = await supabase
      .from("community_posts")
      .insert({
        zip_code: zip,
        user_id: user.id,
        body: postBody,
        title: title ?? null,
        category,
        status: "visible",
      })
      .select("*")
      .single();

    if (error) {
      console.error("Feed post insert error:", error);
      return Response.json({ error: "Failed to create post" }, { status: 500 });
    }

    // Fetch with author info
    const { data: fullPost } = await supabase
      .from("posts_with_author")
      .select("*")
      .eq("id", post.id)
      .single();

    return Response.json(fullPost, { status: 201 });
  } catch (error) {
    console.error("POST /api/feed error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
