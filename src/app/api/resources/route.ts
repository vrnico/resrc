import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ZipQuerySchema } from "@/lib/validators";
import type { ResourcesResponse, CategoryCount, ResourceResult } from "@/types/index";
import type { ResourceScope } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl;
    const parsed = ZipQuerySchema.safeParse({
      zip: url.searchParams.get("zip"),
      category: url.searchParams.get("category") || undefined,
      page: url.searchParams.get("page") || undefined,
      limit: url.searchParams.get("limit") || undefined,
    });

    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { zip, category, page, limit } = parsed.data;
    const supabase = await createClient();

    // Look up zip code
    const { data: zipRecord } = await supabase
      .from("zip_codes")
      .select("*")
      .eq("zip", zip)
      .single();

    if (!zipRecord) {
      return Response.json({ error: "Zip code not found" }, { status: 404 });
    }

    const { city, county, state_code } = zipRecord;
    const offset = (page - 1) * limit;

    // Use RPC function for reliable scope-based resource lookup
    const { data: resources, error: rpcError } = await supabase.rpc(
      "get_resources_for_location",
      {
        p_zip: zip,
        p_city: city,
        p_county: county,
        p_state_code: state_code,
        p_category_slug: category ?? null,
        p_limit: limit,
        p_offset: offset,
      }
    );

    if (rpcError) {
      console.error("RPC error:", rpcError);
      return Response.json({ error: "Failed to fetch resources" }, { status: 500 });
    }

    // Get total count
    const { data: totalCount } = await supabase.rpc(
      "count_resources_for_location",
      {
        p_zip: zip,
        p_city: city,
        p_county: county,
        p_state_code: state_code,
        p_category_slug: category ?? null,
      }
    );

    const total = totalCount ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    // Build category counts (all matching, no category filter)
    const { data: allForCounts } = await supabase.rpc(
      "get_resources_for_location",
      {
        p_zip: zip,
        p_city: city,
        p_county: county,
        p_state_code: state_code,
        p_category_slug: null,
        p_limit: 10000,
        p_offset: 0,
      }
    );

    const countMap = new Map<string, CategoryCount>();
    for (const r of allForCounts ?? []) {
      const key = r.cat_slug;
      const existing = countMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        countMap.set(key, { slug: r.cat_slug, name: r.cat_name, icon: r.cat_icon, count: 1 });
      }
    }
    const categories: CategoryCount[] = Array.from(countMap.values()).sort((a, b) =>
      a.slug.localeCompare(b.slug)
    );

    // Get current user's votes
    const { data: { user } } = await supabase.auth.getUser();
    const userVotes = new Map<string, number>();
    if (user && resources?.length) {
      const resourceIds = resources.map((r: any) => r.id);
      const { data: votes } = await supabase
        .from("resource_votes")
        .select("resource_id, vote")
        .eq("user_id", user.id)
        .in("resource_id", resourceIds);

      for (const v of votes ?? []) {
        userVotes.set(v.resource_id, v.vote);
      }
    }

    const results: ResourceResult[] = (resources ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      category: { slug: r.cat_slug, name: r.cat_name, icon: r.cat_icon },
      subcategory: r.subcategory,
      scope: r.scope as ResourceScope,
      url: r.url,
      phone: r.phone,
      address: r.address,
      eligibility_summary: r.eligibility_summary,
      income_limit_notes: r.income_limit_notes,
      hours: r.hours,
      languages: r.languages,
      net_score: r.net_score,
      verified_at: r.verified_at,
      user_vote: (userVotes.get(r.id) as 1 | -1) ?? null,
    }));

    const response: ResourcesResponse = {
      location: { zip, city, county, state: state_code },
      results,
      total,
      page,
      totalPages,
      categories,
    };

    return Response.json(response);
  } catch (error) {
    console.error("GET /api/resources error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
