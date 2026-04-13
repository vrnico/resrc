import path from "path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: path.resolve(process.cwd(), ".env.local") });

const BATCH_SIZE = 20;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes("--dry-run"),
    brokenOnly: args.includes("--broken-only"),
  };
}

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type LinkStatus = "ok" | "broken" | "redirect" | "unknown";

interface CheckResult {
  id: string;
  url: string;
  status: LinkStatus;
  finalUrl?: string;
  error?: string;
}

async function checkUrl(id: string, url: string): Promise<CheckResult> {
  let finalUrl = url;
  let redirectCount = 0;

  async function attempt(method: "HEAD" | "GET", target: string): Promise<Response> {
    return fetch(target, {
      method,
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": "resrc-linkchecker/1.0" },
    });
  }

  try {
    let res = await attempt("HEAD", url);

    // Follow redirects manually up to MAX_REDIRECTS
    while (
      (res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308) &&
      redirectCount < MAX_REDIRECTS
    ) {
      const location = res.headers.get("location");
      if (!location) break;
      finalUrl = location.startsWith("http") ? location : new URL(location, finalUrl).href;
      redirectCount++;
      res = await attempt("HEAD", finalUrl);
    }

    // Fall back to GET if HEAD returns 405 Method Not Allowed
    if (res.status === 405) {
      res = await attempt("GET", finalUrl);
    }

    if (res.status >= 200 && res.status < 400) {
      // Check if the hostname changed (meaningful redirect)
      const originalHost = new URL(url).hostname;
      const finalHost = new URL(finalUrl).hostname;
      if (originalHost !== finalHost) {
        return { id, url, status: "redirect", finalUrl };
      }
      return { id, url, status: "ok" };
    }

    return { id, url, status: "broken", error: `HTTP ${res.status}` };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { id, url, status: "broken", error: message };
  }
}

async function processBatch(items: Array<{ id: string; url: string }>): Promise<CheckResult[]> {
  return Promise.all(items.map((item) => checkUrl(item.id, item.url)));
}

async function main() {
  const { dryRun, brokenOnly } = parseArgs();
  const supabase = createAdminClient();

  console.log(`\nresrc link validator${dryRun ? " [DRY RUN]" : ""}${brokenOnly ? " [broken-only]" : ""}`);
  console.log("=".repeat(40));

  // Fetch resources to check
  let query = supabase
    .from("resources")
    .select("id, url, link_status")
    .in("link_status", brokenOnly ? ["broken"] : ["ok", "broken", "unknown"]);

  const { data: resources, error } = await query;
  if (error) throw new Error(`Failed to fetch resources: ${error.message}`);
  if (!resources || resources.length === 0) {
    console.log("No resources to check.");
    return;
  }

  console.log(`Checking ${resources.length} URLs in batches of ${BATCH_SIZE}...`);

  let totalOk = 0;
  let totalBroken = 0;
  let totalRedirect = 0;
  let totalUnchanged = 0;

  for (let i = 0; i < resources.length; i += BATCH_SIZE) {
    const batch = resources.slice(i, i + BATCH_SIZE);
    const results = await processBatch(batch);

    for (const result of results) {
      const current = resources.find((r) => r.id === result.id);
      const currentStatus = current?.link_status ?? "unknown";

      if (result.status === "ok") {
        totalOk++;
        if (currentStatus !== "ok") {
          if (dryRun) {
            console.log(`  [dry-run] ${currentStatus} → ok  ${result.url}`);
          } else {
            await supabase.from("resources").update({ link_status: "ok" }).eq("id", result.id);
          }
        } else {
          totalUnchanged++;
        }
      } else if (result.status === "broken") {
        totalBroken++;
        console.log(`  BROKEN: ${result.url}${result.error ? ` (${result.error})` : ""}`);
        if (!dryRun && currentStatus !== "broken") {
          await supabase.from("resources").update({ link_status: "broken" }).eq("id", result.id);
        }
      } else if (result.status === "redirect") {
        totalRedirect++;
        // Redirects resolve successfully — mark ok in DB, log for manual URL update
        console.log(`  REDIRECT (review): ${result.url}\n    → ${result.finalUrl}`);
        if (!dryRun && currentStatus !== "ok") {
          await supabase.from("resources").update({ link_status: "ok" }).eq("id", result.id);
        }
      }
    }

    const progress = Math.min(i + BATCH_SIZE, resources.length);
    process.stdout.write(`\r  Progress: ${progress}/${resources.length}`);
  }

  console.log("\n\n" + "=".repeat(40));
  console.log(`Done${dryRun ? " [DRY RUN — no DB changes]" : ""}`);
  console.log(
    `ok=${totalOk}  broken=${totalBroken}  redirect=${totalRedirect}  unchanged=${totalUnchanged}`
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
