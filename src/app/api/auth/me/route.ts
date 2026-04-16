import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const PatchMeSchema = z.object({
  radius: z.number().int().min(1).max(200).optional(),
  bio: z.string().max(500).optional(),
  display_name: z.string().min(2).max(50).optional(),
});

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

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = PatchMeSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.radius !== undefined) updates.radius = parsed.data.radius;
    if (parsed.data.bio !== undefined) updates.bio = parsed.data.bio;
    if (parsed.data.display_name !== undefined) updates.display_name = parsed.data.display_name;

    if (Object.keys(updates).length === 0) {
      return Response.json({ message: "No changes" });
    }

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ message: "Updated" });
  } catch (error) {
    console.error("PATCH /api/auth/me error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
