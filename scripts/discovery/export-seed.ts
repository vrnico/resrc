/**
 * Exports zip_specific resources from the database into committed seed files.
 * Run this after a discovery + upsert run to capture the clean, validated data.
 *
 * Usage:
 *   npx tsx scripts/discovery/export-seed.ts --state MD
 *   npx tsx scripts/discovery/export-seed.ts --state MD,VA,DC
 *
 * Outputs:
 *   scripts/discovery/data/seeds/{STATE}.json
 *
 * The seed files are committed to git and consumed by upsert-claude-search.ts,
 * so a fresh environment can restore the data without re-running discovery agents.
 */
import path from "path";
import { config } from "dotenv";
config({ path: path.resolve(process.cwd(), ".env.local") });

import fs from "fs";
import { createClient } from "@supabase/supabase-js";

function parseArgs() {
  const args = process.argv.slice(2);
  const stateIdx = args.indexOf("--state");
  if (stateIdx === -1 || !args[stateIdx + 1]) {
    console.error("Usage: npx tsx scripts/discovery/export-seed.ts --state <CODE>[,CODE,...]");
    process.exit(1);
  }
  return {
    states: args[stateIdx + 1].split(",").map((s) => s.trim().toUpperCase()).filter(Boolean),
  };
}

async function exportState(
  sb: ReturnType<typeof createClient>,
  state: string,
  seedsDir: string
) {
  console.log(`\n[${state}] Exporting...`);

  // Fetch all zip_specific resources for this state with their category slug and zip codes
  const { data: resources, error } = await sb
    .from("resources")
    .select(`
      id,
      name,
      description,
      address,
      phone,
      url,
      county,
      categories ( slug )
    `)
    .eq("state_code", state)
    .eq("scope", "zip_specific")
    .eq("link_status", "ok")
    .order("county")
    .order("name");

  if (error) throw new Error(`Query failed: ${error.message}`);
  if (!resources || resources.length === 0) {
    console.log(`  No zip_specific resources found for ${state}`);
    return 0;
  }

  // Fetch zip codes for all resources
  const ids = resources.map((r) => r.id);
  const CHUNK = 100;
  const zipsByResource = new Map<string, string[]>();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data: zips } = await sb
      .from("resource_zip_codes")
      .select("resource_id, zip_code")
      .in("resource_id", ids.slice(i, i + CHUNK));
    for (const row of zips ?? []) {
      const existing = zipsByResource.get(row.resource_id) ?? [];
      existing.push(row.zip_code);
      zipsByResource.set(row.resource_id, existing);
    }
  }

  // Shape into the same format upsert-claude-search.ts expects
  const seed = resources.map((r) => {
    const zips = zipsByResource.get(r.id) ?? [];
    return {
      name: r.name,
      description: r.description ?? "",
      address: r.address ?? null,
      phone: r.phone ?? null,
      url: r.url,
      categorySlug: (r.categories as { slug: string } | null)?.slug ?? "community",
      // Primary zip: first zip associated with the resource
      zipCode: zips[0] ?? "",
      // Extra zips beyond the primary (informational — upsert only uses zipCode)
      ...(zips.length > 1 ? { additionalZipCodes: zips.slice(1) } : {}),
    };
  }).filter((r) => r.zipCode); // drop any without a zip

  const outFile = path.join(seedsDir, `${state}.json`);
  fs.writeFileSync(outFile, JSON.stringify(seed, null, 2));
  console.log(`  Exported ${seed.length} resources → ${outFile}`);
  return seed.length;
}

async function main() {
  const { states } = parseArgs();

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const seedsDir = path.resolve("scripts/discovery/data/seeds");
  fs.mkdirSync(seedsDir, { recursive: true });

  let total = 0;
  for (const state of states) {
    total += await exportState(sb, state, seedsDir);
  }

  if (states.length > 1) {
    console.log(`\nTotal exported: ${total} resources across ${states.length} states`);
  }

  console.log(`\nNext: git add scripts/discovery/data/seeds/ && git commit`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
