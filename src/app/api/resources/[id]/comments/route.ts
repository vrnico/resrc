import { createClient } from "@/lib/supabase/server";
import { CommentCreateSchema, CommentQuerySchema } from "@/lib/validators";
import type { NextRequest } from "next/server";

// GET comments for a resource (flat list — client builds the tree)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: resourceId } = await params;
    const url = request.nextUrl;
    const parsed = CommentQuerySchema.safeParse({
      page: url.searchParams.get("page") || undefined,
      limit: url.searchParams.get("limit") || undefined,
    });

    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { page, limit } = parsed.data;
    const supabase = await createClient();

    const offset = (page - 1) * limit;
    const { data: comments, count } = await supabase
      .from("comments_with_author")
      .select("*", { count: "exact" })
      .eq("resource_id", resourceId)
      .eq("status", "visible")
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return Response.json({
      comments: comments ?? [],
      total,
      page,
      totalPages,
    });
  } catch (error) {
    console.error("GET /api/resources/[id]/comments error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST a new comment
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: resourceId } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = CommentCreateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { body: commentBody, parentId } = parsed.data;

    // Verify resource exists
    const { data: resource } = await supabase
      .from("resources")
      .select("id")
      .eq("id", resourceId)
      .single();

    if (!resource) {
      return Response.json({ error: "Resource not found" }, { status: 404 });
    }

    // If replying, verify parent exists and get depth
    if (parentId) {
      const { data: parent } = await supabase
        .from("resource_comments")
        .select("id, depth")
        .eq("id", parentId)
        .eq("resource_id", resourceId)
        .single();

      if (!parent) {
        return Response.json({ error: "Parent comment not found" }, { status: 404 });
      }

      if (parent.depth >= 5) {
        return Response.json({ error: "Maximum reply depth reached" }, { status: 400 });
      }
    }

    const { data: comment, error } = await supabase
      .from("resource_comments")
      .insert({
        resource_id: resourceId,
        user_id: user.id,
        parent_id: parentId ?? null,
        body: commentBody,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Comment insert error:", error);
      return Response.json({ error: "Failed to create comment" }, { status: 500 });
    }

    // Fetch with author info
    const { data: fullComment } = await supabase
      .from("comments_with_author")
      .select("*")
      .eq("id", comment.id)
      .single();

    return Response.json(fullComment, { status: 201 });
  } catch (error) {
    console.error("POST /api/resources/[id]/comments error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
