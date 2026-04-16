/**
 * Weekly resource health-checker.
 *
 * Crawls every resource URL in the database and tracks consecutive failures.
 *
 * Thresholds:
 *   >= 5  consecutive failures → link_status = 'potentially_closed'
 *   >= 10 consecutive failures → resource deleted from the database
 *
 * On a successful fetch: consecutive_failures resets to 0, link_status → 'ok'.
 *
 * Usage:
 *   npx tsx scripts/health-check.ts
 *   npx tsx scripts/health-check.ts --dry-run   # log what would change, no writes
 *   npx tsx scripts/health-check.ts --concurrency 20
 *
 * Prerequisites:
 *   Run supabase/add-health-check.sql in the Supabase SQL Editor first.
 */

import path from "path";
import { config } from "dotenv";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";

// ── Config ────────────────────────────────────────────────────────────────────

const FAILURES_BEFORE_FLAG   = 5;
const FAILURES_BEFORE_DELETE = 10;
const REQUEST_TIMEOUT_MS     = 10_000;
const DEFAULT_CONCURRENCY    = 15;
const USER_AGENT             = "resrc-healthcheck/1.0 (+https://github.com/InfiniteInsight/resrc)";

// ── Args ──────────────────────────────────────────────────────────────────────

const args        = process.argv.slice(2);
const DRY_RUN     = args.includes("--dry-run");
const concurrency = (() => {
  const idx = args.indexOf("--concurrency");
  return idx !== -1 ? parseInt(args[idx + 1], 10) : DEFAULT_CONCURRENCY;
})();

// ── Supabase ──────────────────────────────────────────────────────────────────

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

// ── Types ─────────────────────────────────────────────────────────────────────

interface Resource {
  id: string;
  name: string;
  url: string;
  link_status: string;
  consecutive_failures: number;
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function isReachable(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    // Try HEAD first (faster, less bandwidth)
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
    });
    if (res.status < 500) return true;

    // Some servers reject HEAD — fall back to GET
    const res2 = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, "Range": "bytes=0-0" },
      redirect: "follow",
    });
    return res2.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// ── Concurrency pool ──────────────────────────────────────────────────────────

async function withConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<void>,
): Promise<void> {
  let i = 0;

  async function worker(): Promise<void> {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) console.log("[dry-run] No changes will be written.\n");

  // Load all resources with a URL
  const { data: resources, error } = await supabase
    .from("resources")
    .select("id, name, url, link_status, consecutive_failures")
    .not("url", "is", null)
    .neq("url", "")
    .order("last_checked_at", { ascending: true, nullsFirst: true });

  if (error) {
    console.error("Failed to load resources:", error.message);
    process.exit(1);
  }

  const total = resources.length;
  console.log(`Checking ${total} resources (concurrency=${concurrency})…\n`);

  const stats = { ok: 0, flagged: 0, deleted: 0, unchanged: 0 };
  const now = new Date().toISOString();

  await withConcurrency(resources, concurrency, async (resource, idx) => {
    const reachable = await isReachable(resource.url);
    const newFailures = reachable ? 0 : resource.consecutive_failures + 1;

    const prefix = `[${idx + 1}/${total}] ${resource.name}`;

    if (reachable) {
      stats.ok++;
      console.log(`  ✓ ${prefix}`);
      if (!DRY_RUN) {
        await supabase
          .from("resources")
          .update({ link_status: "ok", consecutive_failures: 0, last_checked_at: now })
          .eq("id", resource.id);
      }
      return;
    }

    // Failure path
    if (newFailures >= FAILURES_BEFORE_DELETE) {
      stats.deleted++;
      console.log(`  ✗ ${prefix} — ${newFailures} failures, DELETING`);
      if (!DRY_RUN) {
        await supabase.from("resources").delete().eq("id", resource.id);
      }
      return;
    }

    if (newFailures >= FAILURES_BEFORE_FLAG) {
      stats.flagged++;
      console.log(`  ✗ ${prefix} — ${newFailures} failures, flagging as potentially_closed`);
      if (!DRY_RUN) {
        await supabase
          .from("resources")
          .update({ link_status: "potentially_closed", consecutive_failures: newFailures, last_checked_at: now })
          .eq("id", resource.id);
      }
      return;
    }

    // Under threshold — increment counter but don't change status yet
    stats.unchanged++;
    console.log(`  ✗ ${prefix} — ${newFailures} failure(s) (threshold: ${FAILURES_BEFORE_FLAG})`);
    if (!DRY_RUN) {
      await supabase
        .from("resources")
        .update({ consecutive_failures: newFailures, last_checked_at: now })
        .eq("id", resource.id);
    }
  });

  console.log(`
Done.
  ✓ reachable:           ${stats.ok}
  ~ under threshold:     ${stats.unchanged}
  ⚑ potentially_closed:  ${stats.flagged}
  ✗ deleted:             ${stats.deleted}
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
