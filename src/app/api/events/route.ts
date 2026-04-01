import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EventCreateSchema, EventQuerySchema } from "@/lib/validators";
import type { EventsResponse, CalendarEvent } from "@/types/index";
import type { EventCategory, EventStatus, EventRecurrence } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl;
    const parsed = EventQuerySchema.safeParse({
      zip: url.searchParams.get("zip"),
      category: url.searchParams.get("category") || undefined,
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
      page: url.searchParams.get("page") || undefined,
      limit: url.searchParams.get("limit") || undefined,
    });

    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { zip, category, from, to, page, limit } = parsed.data;
    const supabase = await createClient();

    // Get the zip's location info for regional matching
    const { data: zipRecord } = await supabase
      .from("zip_codes")
      .select("*")
      .eq("zip", zip)
      .single();

    if (!zipRecord) {
      return Response.json({ error: "Zip code not found" }, { status: 404 });
    }

    // Get approved events in this zip's county/city area
    let query = supabase
      .from("events_with_author")
      .select("*", { count: "exact" })
      .eq("status", "approved")
      .or(`zip_code.eq.${zip},and(event_state.eq.${zipRecord.state_code},event_county.eq.${zipRecord.county})`);

    if (category) {
      query = query.eq("category", category);
    }
    if (from) {
      query = query.gte("event_date", from);
    }
    if (to) {
      query = query.lte("event_date", to);
    }

    const offset = (page - 1) * limit;
    const { data: events, count } = await query
      .order("event_date", { ascending: true })
      .range(offset, offset + limit - 1);

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const response: EventsResponse = {
      events: (events ?? []).map((e): CalendarEvent => ({
        id: e.id,
        user_id: e.user_id,
        zip_code: e.zip_code,
        title: e.title,
        description: e.description,
        location: e.location,
        category: e.category as EventCategory,
        event_date: e.event_date,
        end_date: e.end_date,
        recurrence: e.recurrence as EventRecurrence | null,
        status: e.status as EventStatus,
        author_name: e.author_name,
        event_city: e.event_city,
        event_state: e.event_state,
        event_county: e.event_county,
        approved_at: e.approved_at,
        created_at: e.created_at,
      })),
      total,
      page,
      totalPages,
    };

    return Response.json(response);
  } catch (error) {
    console.error("GET /api/events error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = EventCreateSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { zipCode, title, description, location, category, eventDate, endDate, recurrence } = parsed.data;

    // Verify zip exists
    const { data: zipRecord } = await supabase
      .from("zip_codes")
      .select("zip")
      .eq("zip", zipCode)
      .single();

    if (!zipRecord) {
      return Response.json({ error: "Zip code not found" }, { status: 404 });
    }

    const { data: event, error } = await supabase
      .from("events")
      .insert({
        user_id: user.id,
        zip_code: zipCode,
        title,
        description,
        location: location ?? null,
        category,
        event_date: eventDate,
        end_date: endDate ?? null,
        recurrence: recurrence ?? null,
        status: "pending",  // requires moderator approval
      })
      .select("*")
      .single();

    if (error) {
      console.error("Event insert error:", error);
      return Response.json({ error: "Failed to create event" }, { status: 500 });
    }

    return Response.json(
      { ...event, message: "Event submitted for approval." },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/events error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
