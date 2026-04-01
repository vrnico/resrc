import { createClient } from "@/lib/supabase/server";
import { FLAG_THRESHOLD } from "@/lib/constants";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: post } = await supabase
      .from("community_posts")
      .select("id, flags, status")
      .eq("id", id)
      .single();

    if (!post) {
      return Response.json({ error: "Post not found" }, { status: 404 });
    }

    const newFlags = post.flags + 1;
    const newStatus = newFlags >= FLAG_THRESHOLD ? "flagged" : post.status;

    const { data: updated } = await supabase
      .from("community_posts")
      .update({ flags: newFlags, status: newStatus })
      .eq("id", id)
      .select("flags, status")
      .single();

    return Response.json({ flags: updated?.flags, status: updated?.status });
  } catch (error) {
    console.error("POST /api/feed/[id]/flag error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
