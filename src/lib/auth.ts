import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/constants";

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthProfile {
  id: string;
  display_name: string;
  zip_code: string;
  role: UserRole;
  status: string;
  bio: string | null;
  radius: number;
}

// Get the authenticated user from the current request (server-side)
export async function getUser(): Promise<AuthUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email! };
}

// Get the authenticated user's profile
export async function getUserProfile(): Promise<AuthProfile | null> {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status === "suspended") return null;
  return profile as AuthProfile;
}

// Require authentication — returns user or throws Response
export async function requireUser(): Promise<AuthUser> {
  const user = await getUser();
  if (!user) {
    throw Response.json({ error: "Not authenticated" }, { status: 401 });
  }
  return user;
}

// Require a specific role or higher
export async function requireRole(...roles: UserRole[]): Promise<AuthProfile> {
  const profile = await getUserProfile();
  if (!profile) {
    throw Response.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!roles.includes(profile.role)) {
    throw Response.json({ error: "Insufficient permissions" }, { status: 403 });
  }
  return profile;
}

// Admin client operations (bypasses RLS)
export async function adminUpdateProfile(userId: string, data: Partial<AuthProfile>) {
  const admin = createAdminClient();
  return admin.from("profiles").update(data).eq("id", userId);
}
