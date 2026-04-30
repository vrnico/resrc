/**
 * Seed script for Supabase database.
 *
 * Run with: npx tsx supabase/seed-supabase.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 * Uses the service role key to bypass RLS for seeding.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "fs";

// Load env
const envContent = readFileSync(".env.local", "utf-8");
const env: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) env[key.trim()] = rest.join("=").trim();
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey || serviceRoleKey === "REPLACE_WITH_YOUR_SERVICE_ROLE_KEY") {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seedCategories() {
  console.log("Seeding categories...");
  const data = JSON.parse(readFileSync("prisma/seed/categories.json", "utf-8"));

  const categories = data.map((c: any) => ({
    slug: c.slug,
    name: c.name,
    icon: c.icon,
    description: c.description,
    sort_order: c.sortOrder ?? 0,
  }));

  const { error } = await supabase.from("categories").upsert(categories, { onConflict: "slug" });
  if (error) {
    console.error("Category seed error:", error);
  } else {
    console.log(`  Seeded ${categories.length} categories`);
  }
}

async function seedZipCodes() {
  console.log("Seeding zip codes...");

  // CSV format: state_fips,state,state_abbr,zipcode,county,city
  const csv = readFileSync("prisma/seed/zip-codes/us_zipcodes.csv", "utf-8");
  const lines = csv.trim().split("\n").slice(1);

  // Coordinates: ZIP,LAT,LNG
  const coordsCsv = readFileSync("prisma/seed/zip-codes/zip_coords.csv", "utf-8");
  const coordLines = coordsCsv.trim().split("\n").slice(1);
  const coordMap = new Map<string, { lat: number; lng: number }>();
  for (const line of coordLines) {
    const parts = line.split(",");
    const zip = parts[0]?.trim();
    const lat = parseFloat(parts[1]);
    const lng = parseFloat(parts[2]);
    if (zip && !isNaN(lat) && !isNaN(lng)) {
      coordMap.set(zip, { lat, lng });
    }
  }

  const BATCH_SIZE = 500;
  let total = 0;
  let errors = 0;

  for (let i = 0; i < lines.length; i += BATCH_SIZE) {
    const batch = lines.slice(i, i + BATCH_SIZE).map((line) => {
      // state_fips,state,state_abbr,zipcode,county,city
      const parts = line.split(",");
      const zip = parts[3]?.trim();
      const coords = coordMap.get(zip ?? "");
      return {
        zip: zip,
        city: parts[5]?.trim() ?? "",
        state_code: parts[2]?.trim() ?? "",
        county: parts[4]?.trim() ?? "",
        latitude: coords?.lat ?? 0,
        longitude: coords?.lng ?? 0,
        timezone: null,
      };
    }).filter((z) => z.zip && z.zip.length >= 4 && z.zip.length <= 5);

    // Pad 4-digit zips with leading zero
    for (const z of batch) {
      if (z.zip!.length === 4) z.zip = "0" + z.zip;
    }

    const { error } = await supabase.from("zip_codes").upsert(batch, { onConflict: "zip" });
    if (error) {
      errors++;
      if (errors <= 3) console.error(`  Zip batch ${i} error:`, error.message);
    }
    total += batch.length;
    process.stdout.write(`  ${total} zip codes...\r`);
  }
  console.log(`  Seeded ${total} zip codes` + (errors > 0 ? ` (${errors} batch errors)` : ""));
}

async function seedResources() {
  console.log("Seeding resources...");

  // Get category map
  const { data: cats } = await supabase.from("categories").select("id, slug");
  const catMap = new Map((cats ?? []).map((c) => [c.slug, c.id]));

  // National programs — uses categorySlug field
  const national = JSON.parse(readFileSync("prisma/seed/national-programs.json", "utf-8"));
  const resourceBatch = [];

  for (const r of national) {
    const categoryId = catMap.get(r.categorySlug);
    if (!categoryId) {
      console.warn(`  Skipping "${r.name}" — unknown category "${r.categorySlug}"`);
      continue;
    }

    resourceBatch.push({
      name: r.name,
      description: r.description,
      category_id: categoryId,
      subcategory: r.subcategory ?? null,
      scope: r.scope ?? "national",
      url: r.url,
      phone: r.phone ?? null,
      address: r.address ?? null,
      eligibility_summary: r.eligibilitySummary ?? null,
      income_limit_notes: r.incomeLimitNotes ?? null,
      hours: r.hours ?? null,
      languages: r.languages ?? null,
      state_code: r.stateCode ?? null,
      county: r.county ?? null,
    });
  }

  // Insert in batches
  const RES_BATCH_SIZE = 50;
  let count = 0;
  for (let i = 0; i < resourceBatch.length; i += RES_BATCH_SIZE) {
    const batch = resourceBatch.slice(i, i + RES_BATCH_SIZE);
    const { error } = await supabase.from("resources").insert(batch);
    if (error) {
      console.error(`  Resource batch ${i} error:`, error.message);
    }
    count += batch.length;
  }
  console.log(`  Seeded ${count} national programs`);

  // State programs
  const stateDir = "prisma/seed/states";
  try {
    const stateFiles = readdirSync(stateDir).filter((f) => f.endsWith(".json"));
    let stateCount = 0;

    for (const file of stateFiles) {
      const statePrograms = JSON.parse(readFileSync(`${stateDir}/${file}`, "utf-8"));
      const stateBatch = [];

      for (const r of statePrograms) {
        const categoryId = catMap.get(r.categorySlug);
        if (!categoryId) continue;

        stateBatch.push({
          name: r.name,
          description: r.description,
          category_id: categoryId,
          subcategory: r.subcategory ?? null,
          scope: r.scope ?? "state",
          url: r.url,
          phone: r.phone ?? null,
          address: r.address ?? null,
          eligibility_summary: r.eligibilitySummary ?? null,
          income_limit_notes: r.incomeLimitNotes ?? null,
          hours: r.hours ?? null,
          languages: r.languages ?? null,
          state_code: r.stateCode ?? null,
          county: r.county ?? null,
        });
      }

      if (stateBatch.length > 0) {
        const { error } = await supabase.from("resources").insert(stateBatch);
        if (error) {
          console.error(`  ${file} error:`, error.message);
        }
        stateCount += stateBatch.length;
      }
    }
    console.log(`  Seeded ${stateCount} state programs`);
  } catch {
    console.log("  No state programs directory found, skipping");
  }
}

async function seedDiscoveryResources() {
  console.log("Seeding discovery resources...");

  const seedsDir = "scripts/discovery/data/seeds";
  let seedFiles: string[];
  try {
    seedFiles = readdirSync(seedsDir).filter((f) => f.endsWith(".json"));
  } catch {
    console.log("  No discovery seeds directory found, skipping");
    return;
  }

  const { data: cats } = await supabase.from("categories").select("id, slug");
  const catMap = new Map((cats ?? []).map((c) => [c.slug, c.id]));

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const file of seedFiles) {
    const state = file.replace(".json", "").toUpperCase();
    const resources = JSON.parse(readFileSync(`${seedsDir}/${file}`, "utf-8"));

    // Load zip→county map for this state
    const { data: zipData } = await supabase
      .from("zip_codes")
      .select("zip, county")
      .eq("state_code", state);
    const zipCountyMap = new Map((zipData ?? []).map((z) => [z.zip, z.county]));

    // Fetch existing resources by URL to determine insert vs update
    const urls: string[] = resources.map((r: any) => r.url);
    const CHUNK = 100;
    const existingByUrl = new Map<string, string>();
    for (let i = 0; i < urls.length; i += CHUNK) {
      const { data } = await supabase
        .from("resources")
        .select("id, url")
        .in("url", urls.slice(i, i + CHUNK));
      for (const r of data ?? []) existingByUrl.set(r.url, r.id);
    }

    let inserted = 0, updated = 0, skipped = 0;

    for (const r of resources) {
      const catId = catMap.get(r.categorySlug);
      const county = r.county ?? zipCountyMap.get(r.zipCode);
      if (!catId || !r.zipCode || !county) { skipped++; continue; }

      const existingId = existingByUrl.get(r.url);

      if (existingId) {
        await supabase.from("resources").update({
          name: r.name,
          description: r.description,
          phone: r.phone ?? null,
          address: r.address ?? null,
          scope: "zip_specific",
          county,
          state_code: state,
        }).eq("id", existingId);

        await supabase.from("resource_zip_codes").upsert(
          [{ resource_id: existingId, zip_code: r.zipCode }],
          { onConflict: "resource_id,zip_code" }
        );
        updated++;
      } else {
        const { data: ins, error } = await supabase.from("resources").insert({
          name: r.name,
          description: r.description,
          category_id: catId,
          scope: "zip_specific",
          url: r.url,
          phone: r.phone ?? null,
          address: r.address ?? null,
          state_code: state,
          county,
          link_status: "ok",
        }).select("id").single();

        if (error) { skipped++; continue; }
        inserted++;

        if (ins) {
          await supabase.from("resource_zip_codes").upsert(
            [{ resource_id: ins.id, zip_code: r.zipCode }],
            { onConflict: "resource_id,zip_code" }
          );
        }
      }
    }

    console.log(`  ${state}: inserted=${inserted} updated=${updated} skipped=${skipped}`);
    totalInserted += inserted;
    totalUpdated += updated;
    totalSkipped += skipped;
  }

  console.log(`  Total: inserted=${totalInserted} updated=${totalUpdated} skipped=${totalSkipped}`);
}

async function main() {
  console.log("Starting Supabase seed...\n");
  await seedCategories();
  await seedZipCodes();
  await seedResources();
  await seedDiscoveryResources();
  console.log("\nSeed complete!");
}

main().catch(console.error);
