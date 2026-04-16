// Cleanup: delete all 211-derived MD resources so re-seed starts fresh
import path from "path";
import { config } from "dotenv";
config({ path: path.resolve(process.cwd(), ".env.local") });
import { createClient } from "@supabase/supabase-js";

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Delete all zip_specific MD resources (these came from 211 scraping)
  const { data: zip211, error: e1 } = await sb
    .from("resources")
    .delete()
    .eq("state_code", "MD")
    .eq("scope", "zip_specific")
    .select("id");

  // Also clean up any remaining 211-permalink county-scoped resources
  const { data: county211, error: e2 } = await sb
    .from("resources")
    .delete()
    .eq("state_code", "MD")
    .eq("scope", "county")
    .like("url", "https://search.211md.org/%")
    .select("id");

  if (e1) console.error("Error deleting zip_specific:", e1.message);
  if (e2) console.error("Error deleting county 211:", e2.message);

  console.log(`Deleted ${zip211?.length ?? 0} zip_specific + ${county211?.length ?? 0} county 211 resources.`);
}

main();
