import { createClient } from "@/lib/supabase/server";
import { PostVoteSchema } from "@/lib/validators";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = PostVoteSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { vote } = parsed.data;

    const { error } = await supabase
      .from("post_votes")
      .upsert(
        { user_id: user.id, post_id: id, vote },
        { onConflict: "user_id,post_id" }
      );

    if (error) {
      console.error("Post vote upsert error:", error);
      return Response.json({ error: "Failed to vote" }, { status: 500 });
    }

    const { data: post } = await supabase
      .from("community_posts")
      .select("upvotes, downvotes")
      .eq("id", id)
      .single();

    return Response.json({
      upvotes: post?.upvotes ?? 0,
      downvotes: post?.downvotes ?? 0,
      user_vote: vote,
    });
  } catch (error) {
    console.error("POST /api/feed/[id]/vote error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    await supabase
      .from("post_votes")
      .delete()
      .eq("user_id", user.id)
      .eq("post_id", id);

    const { data: post } = await supabase
      .from("community_posts")
      .select("upvotes, downvotes")
      .eq("id", id)
      .single();

    return Response.json({
      upvotes: post?.upvotes ?? 0,
      downvotes: post?.downvotes ?? 0,
      user_vote: null,
    });
  } catch (error) {
    console.error("DELETE /api/feed/[id]/vote error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
