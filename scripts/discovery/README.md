# Resource Discovery: Claude Web Search Pipeline

Discovers hyperlocal food and housing resources by running parallel Claude subagents — each with web search access — across every zip code in a state. Results land in the `resources` and `resource_zip_codes` tables.

## Why This Approach

211 Maryland's search API returns the same statewide results regardless of location (confirmed: Baltimore 21201 and Waldorf 20601 return identical results). The iCarol API that powers it requires credentials. findhelp.org blocks scraping.

Claude's web search, by contrast, **is** location-sensitive. Searching "food pantry 21629" surfaces genuinely Denton-area results that no county-level query would find.

---

## Pipeline Overview

```
zip_codes table
      ↓
get-md-zips.ts          → data/md-zips.json        (fetch all zips for state)
                         → data/md-batches.json      (split into ~15-zip batches)
      ↓
Agent tool (parallel)   → data/output/batch-NNN.json (one file per agent)
      ↓
upsert-claude-search.ts → resources + resource_zip_codes tables
```

---

## Step-by-Step: Running for a New State

### 1. Fetch zip codes for the state

Edit `scripts/get-md-zips.ts`, change `"MD"` to your state code, then run:

```bash
npx tsx scripts/get-md-zips.ts
```

This writes `scripts/discovery/data/<state>-zips.json`.

### 2. Build the batch file

Batches of ~14–15 zips work well for a single agent run. In a new script or manually in Node:

```typescript
import zips from "./data/md-zips.json";

const BATCH_SIZE = 15;
const batches = [];
for (let i = 0; i < zips.length; i += BATCH_SIZE) {
  batches.push(zips.slice(i, i + BATCH_SIZE));
}
require("fs").writeFileSync(
  "scripts/discovery/data/md-batches.json",
  JSON.stringify(batches, null, 2)
);
```

### 3. Launch parallel agents

In a Claude Code session, read `data/md-batches.json` and spawn one Agent per batch. Each agent receives a prompt like the one below. Launch all agents in a **single message** (parallel tool calls) for maximum throughput.

**Agent prompt template:**

```
You are a resource discovery agent. Search the web for food pantries, food banks, emergency 
shelters, and housing assistance organizations serving each of these Maryland zip codes:

[21629, 21632, 21636, 21639, 21640, 21641] — Caroline County
[21613, 21627, 21631, 21634, 21643] — Dorchester County
...

For EACH zip code, search for:
- "food pantry [zip]"
- "food bank [zip]"  
- "emergency shelter [zip]"
- "housing assistance [zip]"

For each resource you find, record:
- name: organization name
- description: what they do (1–2 sentences)
- address: full street address if available
- phone: phone number if available
- url: organization's website (not Google Maps, not Facebook unless no website exists)
- categorySlug: one of: food, housing, healthcare, transportation, employment, utilities, legal, crisis, community
- zipCode: the 5-digit zip code the resource serves (use address zip if known, otherwise the search zip)

Only include real, verifiable organizations. Skip national chains (Walmart, CVS). 
Skip government benefit portals (benefits.gov, myMDThink). Include local nonprofits, 
churches, community centers, rescue missions.

Write your results as a JSON array to:
  scripts/discovery/data/output/batch-NNN.json

Valid JSON only, no trailing commas, no markdown.
```

### 4. Monitor progress

As agents complete, their output files appear in `scripts/discovery/data/output/`. Check progress:

```bash
ls scripts/discovery/data/output/ | wc -l   # files written so far
```

### 5. Upsert into the database

Once all agents have finished (all batch files present):

```bash
# Preview what would be inserted (no DB writes):
npx tsx scripts/discovery/upsert-claude-search.ts --dry-run

# Run the actual upsert:
npx tsx scripts/discovery/upsert-claude-search.ts
```

---

## Re-running / Refreshing Data

To wipe and re-import all zip_specific resources for MD:

```bash
npx tsx scripts/cleanup-211-md.ts
```

Then delete old output files and re-run agents from step 3.

---

## Output Format

Each `batch-NNN.json` file is a flat JSON array:

```json
[
  {
    "name": "Westminster Rescue Mission",
    "description": "Provides food pantry and emergency shelter services to Carroll County residents.",
    "address": "18 Distillery Dr, Westminster, MD 21157",
    "phone": "410-848-2222",
    "url": "https://www.westminsterrescuemission.org/",
    "categorySlug": "food",
    "zipCode": "21157"
  }
]
```

Valid `categorySlug` values: `food`, `housing`, `healthcare`, `transportation`, `employment`, `utilities`, `legal`, `crisis`, `community`

---

## Validation Rules (enforced by upsert script)

A resource is skipped if:
- `name` or `url` is missing/empty
- `categorySlug` is not one of the valid values above
- `zipCode` is not a 5-digit string that maps to an MD county in the `zip_codes` table

Deduplication is by **normalized URL** (origin + pathname, trailing slash stripped). Two records for the same website become one.

---

## MD Run Stats (April 2026)

- 466 MD zip codes → 32 batches of ~15 zips
- 32 agents launched in parallel
- 697 raw results → 76 skipped (invalid zip, bad category, missing fields) → **445 unique resources inserted**
- Runtime: ~5 minutes (all agents in parallel)
- Categories: mostly `food` and `housing`

---

## Files

| File | Purpose |
|------|---------|
| `scripts/get-md-zips.ts` | Fetch zips from DB, write `data/md-zips.json` |
| `scripts/discovery/data/md-zips.json` | All 466 MD zip codes with county/city |
| `scripts/discovery/data/md-batches.json` | 32 batches, ~15 zips each |
| `scripts/discovery/data/output/batch-NNN.json` | Agent output (one per batch) |
| `scripts/discovery/upsert-claude-search.ts` | Validates and upserts output files to DB |
| `scripts/cleanup-211-md.ts` | Deletes all zip_specific MD resources (for re-seed) |
