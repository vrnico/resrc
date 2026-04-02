import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

// GET flagged posts and pending events
export async function GET(request: NextRequest) {
  try {
    await requireRole("moderator", "social_worker", "admin");
    const supabase = await createClient();

    const url = request.nextUrl;
    const type = url.searchParams.get("type") || "posts"; // "posts" or "events"

    if (type === "resources") {
      const { data: resources } = await supabase
        .from("resources")
        .select("*, categories(slug, name, icon), profiles(display_name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      return Response.json({ resources: resources ?? [] });
    }

    if (type === "events") {
      const status = url.searchParams.get("status") || "pending";
      const { data: events } = await supabase
        .from("events_with_author")
        .select("*")
        .eq("status", status)
        .order("created_at", { ascending: false });

      return Response.json({ events: events ?? [] });
    }

    // Default: flagged posts
    const status = url.searchParams.get("status") || "flagged";
    const { data: posts } = await supabase
      .from("posts_with_author")
      .select("*")
      .or(`status.eq.${status},flags.gte.3`)
      .order("created_at", { ascending: false });

    return Response.json({ posts: posts ?? [] });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("GET /api/admin/moderation error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH — moderate posts or events
export async function PATCH(request: NextRequest) {
  try {
    const profile = await requireRole("moderator", "social_worker", "admin");
    const supabase = await createClient();
    const body = await request.json();
    const { id, type, action } = body;

    if (!id || !action) {
      return Response.json({ error: "ID and action required" }, { status: 400 });
    }

    // Moderate a resource submission
    if (type === "resource") {
      if (!["approve", "reject"].includes(action)) {
        return Response.json({ error: "Invalid action for resource" }, { status: 400 });
      }

      const updateData: Record<string, unknown> = {
        status: action === "approve" ? "approved" : "rejected",
      };
      if (action === "approve") {
        updateData.verified_at = new Date().toISOString();
        updateData.verified_by = profile.display_name;
      }

      const { data: updated, error } = await supabase
        .from("resources")
        .update(updateData)
        .eq("id", id)
        .select("id, status")
        .single();

      if (error) {
        return Response.json({ error: "Failed to moderate resource" }, { status: 500 });
      }
      return Response.json(updated);
    }

    // Moderate an event
    if (type === "event") {
      if (!["approve", "reject"].includes(action)) {
        return Response.json({ error: "Invalid action for event" }, { status: 400 });
      }

      const updateData: Record<string, unknown> = {
        status: action === "approve" ? "approved" : "rejected",
      };
      if (action === "approve") {
        updateData.approved_by = profile.id;
        updateData.approved_at = new Date().toISOString();
      }

      const { data: updated, error } = await supabase
        .from("events")
        .update(updateData)
        .eq("id", id)
        .select("id, status, approved_at")
        .single();

      if (error) {
        return Response.json({ error: "Failed to moderate event" }, { status: 500 });
      }
      return Response.json(updated);
    }

    // Default: moderate a post
    let updateData: Record<string, unknown> = {};
    switch (action) {
      case "approve":
        updateData = { status: "visible", flags: 0 };
        break;
      case "remove":
        updateData = { status: "removed" };
        break;
      case "pin":
        updateData = { is_pinned: true };
        break;
      case "unpin":
        updateData = { is_pinned: false };
        break;
      default:
        return Response.json({ error: "Invalid action" }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from("community_posts")
      .update(updateData)
      .eq("id", id)
      .select("id, status, is_pinned")
      .single();

    if (error) {
      return Response.json({ error: "Failed to moderate post" }, { status: 500 });
    }
    return Response.json(updated);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("PATCH /api/admin/moderation error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
