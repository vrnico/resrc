import { createClient } from "@/lib/supabase/server";
import { SignInSchema } from "@/lib/validators";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = SignInSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Fetch profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*, zip_codes(city, state_code)")
      .eq("id", data.user.id)
      .single();

    if (profile?.status === "suspended") {
      await supabase.auth.signOut();
      return Response.json({ error: "Your account has been suspended" }, { status: 403 });
    }

    return Response.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        display_name: profile?.display_name,
        role: profile?.role,
        zip_code: profile?.zip_code,
        city: profile?.zip_codes?.city,
        state_code: profile?.zip_codes?.state_code,
      },
    });
  } catch (error) {
    console.error("POST /api/auth/signin error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
