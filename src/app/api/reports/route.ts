import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ReportSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ReportSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { zip, category, body: reportBody, severity, locationDetails, contactInfo } = parsed.data;
    const supabase = await createClient();

    // Verify zip exists
    const { data: zipRecord } = await supabase
      .from("zip_codes")
      .select("zip")
      .eq("zip", zip)
      .single();

    if (!zipRecord) {
      return Response.json({ error: "Zip code not found" }, { status: 404 });
    }

    // Optionally attach user if authenticated
    const { data: { user } } = await supabase.auth.getUser();

    const { data: report, error } = await supabase
      .from("reports")
      .insert({
        zip_code: zip,
        user_id: user?.id ?? null,
        category,
        body: reportBody,
        severity,
        location_details: locationDetails ?? null,
        contact_encrypted: contactInfo ?? null,
        status: "new",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Report insert error:", error);
      return Response.json({ error: "Failed to submit report" }, { status: 500 });
    }

    return Response.json(
      { id: report.id, message: "Report submitted successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/reports error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
