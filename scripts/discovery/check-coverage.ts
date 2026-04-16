/**
 * Checks batch coverage for a state: which batches ran, which got 0 results,
 * and which zip codes were never covered.
 *
 * Usage:
 *   npx tsx scripts/discovery/check-coverage.ts --state NY
 *   npx tsx scripts/discovery/check-coverage.ts --state NY,PA,VA
 *   npx tsx scripts/discovery/check-coverage.ts --state NY --zeros   # show zero-result batch details
 *   npx tsx scripts/discovery/check-coverage.ts --state NY --resume  # print resume command for missing/zero batches
 */
import path from "path";
import fs from "fs";

function parseArgs() {
  const args = process.argv.slice(2);
  const stateIdx = args.indexOf("--state");
  if (stateIdx === -1 || !args[stateIdx + 1]) {
    console.error("Usage: npx tsx scripts/discovery/check-coverage.ts --state <CODE>[,CODE,...]");
    process.exit(1);
  }
  return {
    states: args[stateIdx + 1].split(",").map((s) => s.trim().toUpperCase()).filter(Boolean),
    showZeros: args.includes("--zeros"),
    resume: args.includes("--resume"),
  };
}

function checkState(state: string, showZeros: boolean, resume: boolean) {
  const batchesFile = path.resolve(`scripts/discovery/data/${state.toLowerCase()}-batches.json`);
  const outputDir = path.resolve(`scripts/discovery/data/output/${state}`);

  if (!fs.existsSync(batchesFile)) {
    console.log(`[${state}] No batch file found — run prep-batches.ts first`);
    return;
  }

  const batches: Array<Array<{ zip: string; county: string; city: string }>> = JSON.parse(
    fs.readFileSync(batchesFile, "utf-8")
  );

  const total = batches.length;
  const allZips = batches.flat().map((z) => z.zip);

  let notRun: number[] = [];       // batch index (1-based) with no output file
  let zeroBatches: number[] = [];  // ran but got 0 results
  let totalResources = 0;
  let coveredBatches = 0;

  const zeroBatchDetails: Array<{ batch: number; counties: string[]; zips: string[] }> = [];

  for (let i = 0; i < total; i++) {
    const batchNum = i + 1;
    const outFile = path.join(outputDir, `batch-${String(batchNum).padStart(3, "0")}.json`);

    if (!fs.existsSync(outFile)) {
      notRun.push(batchNum);
      continue;
    }

    const size = fs.statSync(outFile).size;
    if (size <= 3) {
      // File exists but is just "[]" — was rate-limited
      notRun.push(batchNum);
      continue;
    }

    try {
      const data = JSON.parse(fs.readFileSync(outFile, "utf-8"));
      if (!Array.isArray(data) || data.length === 0) {
        zeroBatches.push(batchNum);
        if (showZeros) {
          const counties = [...new Set(batches[i].map((z) => z.county))];
          zeroBatchDetails.push({ batch: batchNum, counties, zips: batches[i].map((z) => z.zip) });
        }
      } else {
        totalResources += data.length;
        coveredBatches++;
      }
    } catch {
      notRun.push(batchNum);
    }
  }

  const missingZips = [
    ...notRun.flatMap((b) => batches[b - 1].map((z) => z.zip)),
  ];

  const zeroZips = [
    ...zeroBatches.flatMap((b) => batches[b - 1].map((z) => z.zip)),
  ];

  // Summary
  console.log(`\n[${state}] ${total} batches | ${allZips.length} zip codes`);
  console.log(`  ✓ With results:   ${coveredBatches} batches (${totalResources} resources)`);
  console.log(`  ○ Zero results:   ${zeroBatches.length} batches (${zeroZips.length} zips) — ran but found nothing`);
  console.log(`  ✗ Not run / rate-limited: ${notRun.length} batches (${missingZips.length} zips)`);

  const needsRerun = [...new Set([...notRun, ...zeroBatches])].sort((a, b) => a - b);
  const needsRerunZips = needsRerun.flatMap((b) => batches[b - 1].map((z) => z.zip));

  if (needsRerun.length > 0) {
    // Find contiguous ranges for cleaner output
    const ranges: string[] = [];
    let start = needsRerun[0], end = needsRerun[0];
    for (let i = 1; i < needsRerun.length; i++) {
      if (needsRerun[i] === end + 1) {
        end = needsRerun[i];
      } else {
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        start = end = needsRerun[i];
      }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    console.log(`  Needs rerun:     batches ${ranges.join(", ")}`);
  }

  if (showZeros && zeroBatchDetails.length > 0) {
    console.log(`\n  Zero-result batches:`);
    for (const d of zeroBatchDetails) {
      console.log(`    [${String(d.batch).padStart(3,"0")}] ${d.counties.join(", ")} | ${d.zips.join(" ")}`);
    }
  }

  if (resume && needsRerun.length > 0) {
    // Generate targeted rerun commands — one per contiguous block starting at first gap
    const firstMissing = needsRerun[0];
    console.log(`\n  Resume command:`);
    console.log(`    bash scripts/discovery/run-gemini-batches.sh --state ${state} --start ${firstMissing}`);
    if (zeroBatches.length > 0 && notRun.length === 0) {
      console.log(`\n  Note: all missing batches returned 0 — may need quota reset or different search strategy`);
    }
  }
}

const { states, showZeros, resume } = parseArgs();
for (const state of states) {
  checkState(state, showZeros, resume);
}
