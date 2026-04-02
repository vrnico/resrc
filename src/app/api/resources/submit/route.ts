import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const SubmitResourceSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().min(10).max(2000),
  categoryId: z.number().int().min(1),
  scope: z.enum(["national", "state", "county", "city", "zip_specific"]),
  url: z.string().url(),
  phone: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  eligibilitySummary: z.string().max(1000).optional(),
  stateCode: z.string().length(2).optional(),
  county: z.string().max(100).optional(),
  zipCode: z.string().regex(/^\d{5}$/).optional(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = SubmitResourceSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const { data: resource, error } = await supabase
      .from("resources")
      .insert({
        name: data.name,
        description: data.description,
        category_id: data.categoryId,
        scope: data.scope,
        url: data.url,
        phone: data.phone || null,
        address: data.address || null,
        eligibility_summary: data.eligibilitySummary || null,
        state_code: data.stateCode || null,
        county: data.county || null,
        status: "pending",
        submitted_by: user.id,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Resource submit error:", error);
      return Response.json({ error: "Failed to submit resource" }, { status: 500 });
    }

    return Response.json({ id: resource.id, message: "Resource submitted for review" }, { status: 201 });
  } catch (error) {
    console.error("POST /api/resources/submit error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
