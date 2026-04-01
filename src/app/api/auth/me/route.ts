import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles_with_location")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return Response.json({ error: "Profile not found" }, { status: 404 });
    }

    return Response.json({
      id: profile.id,
      email: user.email,
      display_name: profile.display_name,
      zip_code: profile.zip_code,
      role: profile.role,
      status: profile.status,
      bio: profile.bio,
      radius: profile.radius,
      city: profile.city,
      state_code: profile.state_code,
      created_at: profile.created_at,
    });
  } catch (error) {
    console.error("GET /api/auth/me error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
