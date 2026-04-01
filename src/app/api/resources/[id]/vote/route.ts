import { createClient } from "@/lib/supabase/server";
import { ResourceVoteSchema } from "@/lib/validators";

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
    const parsed = ResourceVoteSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { vote } = parsed.data;

    // Upsert the vote (insert or update)
    const { error } = await supabase
      .from("resource_votes")
      .upsert(
        { user_id: user.id, resource_id: id, vote },
        { onConflict: "user_id,resource_id" }
      );

    if (error) {
      console.error("Vote upsert error:", error);
      return Response.json({ error: "Failed to vote" }, { status: 500 });
    }

    // Return updated score
    const { data: resource } = await supabase
      .from("resources")
      .select("net_score")
      .eq("id", id)
      .single();

    return Response.json({ net_score: resource?.net_score ?? 0, user_vote: vote });
  } catch (error) {
    console.error("POST /api/resources/[id]/vote error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE to remove a vote
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
      .from("resource_votes")
      .delete()
      .eq("user_id", user.id)
      .eq("resource_id", id);

    const { data: resource } = await supabase
      .from("resources")
      .select("net_score")
      .eq("id", id)
      .single();

    return Response.json({ net_score: resource?.net_score ?? 0, user_vote: null });
  } catch (error) {
    console.error("DELETE /api/resources/[id]/vote error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
