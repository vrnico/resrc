import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: resource, error } = await supabase
      .from("resources")
      .select("*, categories(slug, name, icon)")
      .eq("id", id)
      .single();

    if (error || !resource) {
      return Response.json({ error: "Resource not found" }, { status: 404 });
    }

    // Get current user's vote
    const { data: { user } } = await supabase.auth.getUser();
    let userVote: number | null = null;
    if (user) {
      const { data: vote } = await supabase
        .from("resource_votes")
        .select("vote")
        .eq("user_id", user.id)
        .eq("resource_id", id)
        .single();
      userVote = vote?.vote ?? null;
    }

    return Response.json({
      ...resource,
      category: resource.categories,
      user_vote: userVote,
    });
  } catch (error) {
    console.error("GET /api/resources/[id] error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
