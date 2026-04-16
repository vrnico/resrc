/**
 * Fetches zip codes from the database and builds batch files for the Claude
 * agent discovery pipeline.
 *
 * Usage:
 *   npx tsx scripts/discovery/prep-batches.ts --state MD          # one state
 *   npx tsx scripts/discovery/prep-batches.ts --state VA,DC,MD    # multiple
 *   npx tsx scripts/discovery/prep-batches.ts                     # all states in DB
 *   npx tsx scripts/discovery/prep-batches.ts --batch-size 20     # custom batch size
 *
 * Outputs per state:
 *   scripts/discovery/data/{STATE}-zips.json     — all zip codes with county/city
 *   scripts/discovery/data/{STATE}-batches.json  — zips split into batches
 *   scripts/discovery/data/output/{STATE}/       — output dir (created, empty)
 *
 * Prints a launch-ready prompt to paste into a Claude Code session.
 */
import path from "path";
import { config } from "dotenv";
config({ path: path.resolve(process.cwd(), ".env.local") });

import fs from "fs";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

interface ZipRow {
  zip: string;
  county: string;
  city: string;
}

interface PrepResult {
  state: string;
  zipCount: number;
  batchCount: number;
  countyCount: number;
  batchesFile: string;
  outputDir: string;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const stateIdx = args.indexOf("--state");
  const batchIdx = args.indexOf("--batch-size");

  const stateArg = stateIdx !== -1 ? args[stateIdx + 1] : null;
  const states = stateArg
    ? stateArg.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : null; // null = all states

  return {
    states,
    batchSize: batchIdx !== -1 ? parseInt(args[batchIdx + 1], 10) : 15,
  };
}

async function getAllStates(sb: SupabaseClient): Promise<string[]> {
  const { data, error } = await sb
    .from("zip_codes")
    .select("state_code")
    .order("state_code");
  if (error) throw new Error(`Failed to fetch states: ${error.message}`);
  const unique = [...new Set((data ?? []).map((r) => r.state_code as string))];
  return unique;
}

async function prepState(
  sb: SupabaseClient,
  state: string,
  batchSize: number
): Promise<PrepResult> {
  const { data, error } = await sb
    .from("zip_codes")
    .select("zip, county, city")
    .eq("state_code", state)
    .order("zip");

  if (error) throw new Error(`[${state}] Supabase error: ${error.message}`);
  if (!data || data.length === 0) throw new Error(`[${state}] No zip codes found`);

  // Filter out non-deliverable placeholder zips (e.g. "215HH", "207HH")
  const zips: ZipRow[] = data.filter((z) => /^\d{5}$/.test(z.zip));

  // Sort by county then zip for geographically coherent batches
  const sorted = [...zips].sort(
    (a, b) => a.county.localeCompare(b.county) || a.zip.localeCompare(b.zip)
  );

  const batches: ZipRow[][] = [];
  for (let i = 0; i < sorted.length; i += batchSize) {
    batches.push(sorted.slice(i, i + batchSize));
  }

  const counties = new Set(zips.map((z) => z.county));

  // Write files
  const dataDir = path.resolve("scripts/discovery/data");
  const outputDir = path.join(dataDir, "output", state);
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const zipsFile = path.join(dataDir, `${state.toLowerCase()}-zips.json`);
  const batchesFile = path.join(dataDir, `${state.toLowerCase()}-batches.json`);

  fs.writeFileSync(zipsFile, JSON.stringify(zips, null, 2));
  fs.writeFileSync(batchesFile, JSON.stringify(batches, null, 2));

  return {
    state,
    zipCount: zips.length,
    batchCount: batches.length,
    countyCount: counties.size,
    batchesFile,
    outputDir,
  };
}

function printStateDetails(result: PrepResult, batchSize: number, batchesFile: string) {
  const state = result.state;
  const batches: ZipRow[][] = JSON.parse(fs.readFileSync(batchesFile, "utf-8"));

  // County breakdown
  const countyCounts = new Map<string, number>();
  for (const batch of batches) {
    for (const z of batch) {
      countyCounts.set(z.county, (countyCounts.get(z.county) ?? 0) + 1);
    }
  }
  const counties = [...countyCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  console.log(`\nCounty breakdown (${counties.length} counties):`);
  for (const [county, count] of counties) {
    console.log(`  ${county.padEnd(24)} ${count} zips`);
  }

  console.log(`\nBatch preview (first 3 of ${batches.length}):`);
  for (let i = 0; i < Math.min(3, batches.length); i++) {
    const b = batches[i];
    const countyList = [...new Set(b.map((z) => z.county))].join(", ");
    const zipList = b.map((z) => z.zip).join(", ");
    console.log(`  Batch ${String(i + 1).padStart(3, "0")}: [${zipList}] — ${countyList}`);
  }
  if (batches.length > 3) console.log(`  ... and ${batches.length - 3} more`);

  printLaunchInstructions(state, batches.length, result.outputDir);
}

function printLaunchInstructions(state: string, batchCount: number, outputDir: string) {
  const relOutput = path.relative(process.cwd(), outputDir);
  console.log(`\n${"=".repeat(50)}`);
  console.log(`LAUNCH INSTRUCTIONS — ${state} (${batchCount} batches)`);
  console.log(`${"=".repeat(50)}`);
  console.log(`
Read scripts/discovery/data/${state.toLowerCase()}-batches.json, then launch one Agent
per batch (all in a single message). Each agent should:

1. Search the web for food pantries, food banks, emergency shelters, and housing
   assistance organizations serving the zip codes in its batch.

2. For EACH zip, search:
   - "food pantry [zip]"
   - "food bank [zip]"
   - "emergency shelter [zip]"
   - "housing assistance [zip]"

3. For each resource found, record:
   - name, description (1-2 sentences), address, phone, url
   - categorySlug: food | housing | healthcare | transportation |
                   employment | utilities | legal | crisis | community
   - zipCode: the 5-digit zip the resource serves

4. Skip: national chains (Walmart, Costco), government benefit portals
   (benefits.gov, myMDThink), out-of-state results.
   Include: local nonprofits, churches, community orgs, rescue missions.

5. Write results as a JSON array to:
   ${relOutput}/batch-NNN.json
   (NNN = zero-padded batch number, e.g. 001, 002, ...)

Output format:
[
  {
    "name": "...",
    "description": "...",
    "address": "...",
    "phone": "...",
    "url": "https://...",
    "categorySlug": "food",
    "zipCode": "NNNNN"
  }
]

Total batches: ${batchCount}
When all agents finish, run:
  npx tsx scripts/discovery/upsert-claude-search.ts --state ${state} --dry-run
`);
}

async function main() {
  const { states: requestedStates, batchSize } = parseArgs();

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Resolve state list
  let states: string[];
  if (requestedStates) {
    states = requestedStates;
  } else {
    console.log("No --state given. Fetching all states from database...");
    states = await getAllStates(sb);
    console.log(`Found ${states.length} states: ${states.join(", ")}`);
  }

  const results: PrepResult[] = [];
  const errors: string[] = [];

  for (const state of states) {
    process.stdout.write(`Prepping ${state}... `);
    try {
      const result = await prepState(sb, state, batchSize);
      results.push(result);
      console.log(`${result.zipCount} zips → ${result.batchCount} batches (${result.countyCount} counties)`);
    } catch (err) {
      console.log(`ERROR`);
      errors.push(String(err));
    }
  }

  // Print detailed output
  if (results.length === 1) {
    // Single state: print full county breakdown + launch instructions
    const r = results[0];
    console.log(`\n${"=".repeat(50)}`);
    console.log(`${r.state} — ${r.zipCount} zip codes → ${r.batchCount} batches of ≤${batchSize}`);
    console.log(`${"=".repeat(50)}`);
    printStateDetails(r, batchSize, r.batchesFile);
  } else {
    // Multiple states: print summary table, then launch instructions per state
    console.log(`\n${"=".repeat(50)}`);
    console.log(`SUMMARY — ${results.length} states prepped`);
    console.log(`${"=".repeat(50)}`);
    console.log(`${"State".padEnd(8)} ${"Zips".padStart(6)} ${"Batches".padStart(8)} ${"Counties".padStart(10)}`);
    console.log(`${"─".repeat(36)}`);

    let totalZips = 0;
    let totalBatches = 0;
    for (const r of results) {
      console.log(
        `${r.state.padEnd(8)} ${String(r.zipCount).padStart(6)} ${String(r.batchCount).padStart(8)} ${String(r.countyCount).padStart(10)}`
      );
      totalZips += r.zipCount;
      totalBatches += r.batchCount;
    }
    console.log(`${"─".repeat(36)}`);
    console.log(`${"TOTAL".padEnd(8)} ${String(totalZips).padStart(6)} ${String(totalBatches).padStart(8)}`);

    console.log(`\nFiles written to: scripts/discovery/data/`);
    console.log(`Output dirs:      scripts/discovery/data/output/{STATE}/`);

    // Launch instructions per state
    for (const r of results) {
      printLaunchInstructions(r.state, r.batchCount, r.outputDir);
    }
  }

  if (errors.length > 0) {
    console.log(`\nErrors (${errors.length}):`);
    for (const e of errors) console.error(`  ${e}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
