import { createClient } from "@/lib/supabase/server";
import { SignUpSchema } from "@/lib/validators";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = SignUpSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, password, displayName, zipCode, bio } = parsed.data;

    const supabase = await createClient();

    // Verify zip code exists
    const { data: zip } = await supabase
      .from("zip_codes")
      .select("zip")
      .eq("zip", zipCode)
      .single();

    if (!zip) {
      return Response.json({ error: "Zip code not found" }, { status: 404 });
    }

    // Sign up via Supabase Auth — the trigger creates the profile row
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          zip_code: zipCode,
        },
      },
    });

    if (error) {
      if (error.message.includes("already registered")) {
        return Response.json({ error: "Email already registered" }, { status: 409 });
      }
      return Response.json({ error: error.message }, { status: 400 });
    }

    // Update bio if provided (trigger only sets display_name and zip_code)
    if (bio && data.user) {
      await supabase
        .from("profiles")
        .update({ bio })
        .eq("id", data.user.id);
    }

    return Response.json(
      { message: "Account created. Check your email to confirm." },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/auth/signup error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
