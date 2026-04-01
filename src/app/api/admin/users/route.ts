import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { UpdateProfileRoleSchema, UpdateProfileStatusSchema } from "@/lib/validators";

// GET all users (admin only)
export async function GET(request: NextRequest) {
  try {
    await requireRole("admin");
    const supabase = await createClient();

    const url = request.nextUrl;
    const role = url.searchParams.get("role") || undefined;
    const status = url.searchParams.get("status") || undefined;

    let query = supabase
      .from("profiles_with_location")
      .select("*")
      .order("created_at", { ascending: false });

    if (role) query = query.eq("role", role);
    if (status) query = query.eq("status", status);

    const { data: users } = await query;

    return Response.json({ users: users ?? [] });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("GET /api/admin/users error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH — update user role or status
export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireRole("admin");
    const supabase = await createClient();
    const body = await request.json();

    // Determine if this is a role update or status update
    const roleResult = UpdateProfileRoleSchema.safeParse(body);
    const statusResult = UpdateProfileStatusSchema.safeParse(body);

    if (roleResult.success) {
      const { userId, role } = roleResult.data;

      const { data: updated, error } = await supabase
        .from("profiles")
        .update({ role })
        .eq("id", userId)
        .select("id, display_name, role, status")
        .single();

      if (error) {
        return Response.json({ error: "Failed to update role" }, { status: 500 });
      }
      return Response.json(updated);
    }

    if (statusResult.success) {
      const { userId, status } = statusResult.data;

      const { data: updated, error } = await supabase
        .from("profiles")
        .update({ status })
        .eq("id", userId)
        .select("id, display_name, role, status")
        .single();

      if (error) {
        return Response.json({ error: "Failed to update status" }, { status: 500 });
      }
      return Response.json(updated);
    }

    return Response.json({ error: "Invalid request body" }, { status: 400 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("PATCH /api/admin/users error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
