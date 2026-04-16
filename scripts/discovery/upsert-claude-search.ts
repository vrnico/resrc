/**
 * Reads all batch output JSON files and upserts them into the database
 * as zip_specific resources.
 *
 * Usage:
 *   npx tsx scripts/discovery/upsert-claude-search.ts --state MD [--dry-run]
 *   npx tsx scripts/discovery/upsert-claude-search.ts --state MD,VA,DC [--dry-run]
 *
 * Reads from: scripts/discovery/data/output/{STATE}/batch-*.json
 */
import path from "path";
import { config } from "dotenv";
config({ path: path.resolve(process.cwd(), ".env.local") });

import fs from "fs";
import { createClient } from "@supabase/supabase-js";

interface RawResource {
  name: string;
  description: string;
  address: string | null;
  phone: string | null;
  url: string;
  categorySlug: string;
  zipCode: string;
}

const VALID_CATEGORIES = new Set(["food", "housing", "healthcare", "transportation", "employment", "utilities", "legal", "crisis", "community"]);

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname.replace(/\/$/, "");
  } catch {
    return url.trim().toLowerCase();
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const stateIdx = args.indexOf("--state");
  if (stateIdx === -1 || !args[stateIdx + 1]) {
    console.error("Usage: npx tsx scripts/discovery/upsert-claude-search.ts --state <CODE>[,CODE,...] [--dry-run]");
    process.exit(1);
  }
  return {
    states: args[stateIdx + 1].split(",").map((s) => s.trim().toUpperCase()).filter(Boolean),
    dryRun: args.includes("--dry-run"),
  };
}

function readOutputFiles(stateOutputDir: string, seedFile: string): { raw: RawResource[]; fileErrors: number } {
  const sources: string[] = [];

  // Prefer committed seed file if present
  if (fs.existsSync(seedFile)) sources.push(seedFile);

  // Also read raw agent output files (may overlap with seed — dedup handles it)
  if (fs.existsSync(stateOutputDir)) {
    const batchFiles = fs.readdirSync(stateOutputDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => path.join(stateOutputDir, f));
    sources.push(...batchFiles);
  }

  if (sources.length === 0) {
    console.warn(`  No seed file or output dir found — nothing to import`);
    return { raw: [], fileErrors: 0 };
  }

  console.log(`  Found ${sources.length} source file(s)`);
  const raw: RawResource[] = [];
  let fileErrors = 0;

  for (const file of sources) {
    try {
      const content = fs.readFileSync(file, "utf-8").trim();
      if (!content || content === "[]") continue;
      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed)) { console.warn(`  Skipping ${file}: not an array`); fileErrors++; continue; }
      raw.push(...parsed);
    } catch (e) {
      console.warn(`  Error reading ${file}: ${e}`);
      fileErrors++;
    }
  }

  return { raw, fileErrors };
}

async function upsertForState(
  sb: ReturnType<typeof createClient>,
  state: string,
  catMap: Map<string, string>,
  baseOutputDir: string,
  dryRun: boolean
): Promise<{ inserted: number; updated: number; errors: number; skipped: number }> {
  const stateOutputDir = path.join(baseOutputDir, state);
  const seedFile = path.join(path.dirname(baseOutputDir), "seeds", `${state}.json`);
  const { raw: allRaw, fileErrors } = readOutputFiles(stateOutputDir, seedFile);
  console.log(`  Raw resources: ${allRaw.length} (${fileErrors} file errors)`);

  // Load zip→county map for this state only
  const { data: zipData } = await sb.from("zip_codes").select("zip, county").eq("state_code", state);
  const zipCountyMap = new Map((zipData ?? []).map((r) => [r.zip, r.county]));

  // Validate and deduplicate by normalized URL
  const seen = new Map<string, RawResource & { county: string; stateCode: string }>();
  let skipped = 0;

  for (const r of allRaw) {
    if (!r.name?.trim() || !r.url?.trim()) { skipped++; continue; }
    if (!r.categorySlug || !VALID_CATEGORIES.has(r.categorySlug)) { skipped++; continue; }
    if (!r.zipCode || !/^\d{5}$/.test(r.zipCode)) { skipped++; continue; }

    const county = zipCountyMap.get(r.zipCode);
    if (!county) { skipped++; continue; } // zip doesn't belong to this state

    // If address contains a zip, prefer that for county lookup
    const addrZipMatch = r.address?.match(/\b(\d{5})\b/);
    const effectiveZip = (addrZipMatch && zipCountyMap.has(addrZipMatch[1]))
      ? addrZipMatch[1]
      : r.zipCode;
    const effectiveCounty = zipCountyMap.get(effectiveZip) ?? county;

    const key = normalizeUrl(r.url);
    if (!seen.has(key)) {
      seen.set(key, { ...r, zipCode: effectiveZip, county: effectiveCounty, stateCode: state });
    }
  }

  console.log(`  After validation + dedup: ${seen.size} unique (${skipped} skipped)`);

  if (dryRun) {
    for (const [, r] of seen) {
      console.log(`    [${r.categorySlug}] ${r.name} — ${r.zipCode} ${r.county}`);
    }
    return { inserted: seen.size, updated: 0, errors: 0, skipped };
  }

  // Fetch existing resources by normalized URL
  const urls = [...seen.keys()];
  const CHUNK = 100;
  const existingByUrl = new Map<string, string>();
  for (let i = 0; i < urls.length; i += CHUNK) {
    const { data } = await sb.from("resources").select("id, url").in("url", urls.slice(i, i + CHUNK));
    for (const r of data ?? []) existingByUrl.set(normalizeUrl(r.url), r.id);
  }

  let inserted = 0, updated = 0, errors = 0;

  for (const [normalUrl, r] of seen) {
    const catId = catMap.get(r.categorySlug);
    if (!catId) { console.warn(`  Unknown category: ${r.categorySlug}`); errors++; continue; }

    const existingId = existingByUrl.get(normalUrl);

    if (existingId) {
      const { error } = await sb.from("resources").update({
        name: r.name,
        description: r.description,
        phone: r.phone ?? null,
        address: r.address ?? null,
        scope: "zip_specific",
        county: r.county,
        state_code: state,
      }).eq("id", existingId);

      if (error) { console.warn(`  UPDATE failed ${r.url}: ${error.message}`); errors++; continue; }
      updated++;

      await sb.from("resource_zip_codes").upsert(
        [{ resource_id: existingId, zip_code: r.zipCode }],
        { onConflict: "resource_id,zip_code" }
      );
    } else {
      const { data: ins, error } = await sb.from("resources").insert({
        name: r.name,
        description: r.description,
        category_id: catId,
        scope: "zip_specific",
        url: r.url,
        phone: r.phone ?? null,
        address: r.address ?? null,
        state_code: state,
        county: r.county,
        link_status: "ok",
      }).select("id").single();

      if (error) { console.warn(`  INSERT failed ${r.url}: ${error.message}`); errors++; continue; }
      inserted++;

      if (ins) {
        await sb.from("resource_zip_codes").upsert(
          [{ resource_id: ins.id, zip_code: r.zipCode }],
          { onConflict: "resource_id,zip_code" }
        );
      }
    }
  }

  return { inserted, updated, errors, skipped };
}

async function main() {
  const { states, dryRun } = parseArgs();
  const baseOutputDir = path.resolve("scripts/discovery/data/output");

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Load categories once (shared across states)
  const { data: cats } = await sb.from("categories").select("id, slug");
  const catMap = new Map((cats ?? []).map((c) => [c.slug, c.id]));

  let totalInserted = 0, totalUpdated = 0, totalErrors = 0;

  for (const state of states) {
    console.log(`\n[${state}]${dryRun ? " [dry-run]" : ""}`);
    const result = await upsertForState(sb, state, catMap, baseOutputDir, dryRun);
    console.log(`  inserted=${result.inserted} updated=${result.updated} errors=${result.errors} skipped=${result.skipped}`);
    totalInserted += result.inserted;
    totalUpdated += result.updated;
    totalErrors += result.errors;
  }

  if (states.length > 1) {
    console.log(`\nTotal: inserted=${totalInserted} updated=${totalUpdated} errors=${totalErrors}`);
  }
}

main().catch(console.error);
