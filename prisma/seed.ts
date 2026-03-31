import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

interface CategorySeed {
  slug: string;
  name: string;
  icon: string;
  description: string;
  sortOrder: number;
}

interface ProgramSeed {
  name: string;
  description: string;
  categorySlug: string;
  scope: string;
  url: string;
  phone: string | null;
  eligibilitySummary: string | null;
  incomeLimitNotes: string | null;
  stateCode: string | null;
}

function parseCsv(content: string): string[][] {
  const lines = content.trim().split("\n");
  return lines.map((line) => line.split(",").map((cell) => cell.trim()));
}

async function seedCategories() {
  console.log("Seeding categories...");
  const raw = readFileSync(join(__dirname, "seed/categories.json"), "utf-8");
  const categories: CategorySeed[] = JSON.parse(raw);

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        icon: cat.icon,
        description: cat.description,
        sortOrder: cat.sortOrder,
      },
      create: cat,
    });
  }
  const count = await prisma.category.count();
  console.log(`  ✓ ${count} categories seeded`);
}

async function seedNationalPrograms() {
  console.log("Seeding national programs...");
  const raw = readFileSync(
    join(__dirname, "seed/national-programs.json"),
    "utf-8"
  );
  const programs: ProgramSeed[] = JSON.parse(raw);

  // Build a slug-to-id map for categories
  const categories = await prisma.category.findMany();
  const slugToId = new Map(categories.map((c) => [c.slug, c.id]));

  let created = 0;
  for (const prog of programs) {
    const categoryId = slugToId.get(prog.categorySlug);
    if (!categoryId) {
      console.warn(`  ⚠ Unknown category slug: ${prog.categorySlug} for ${prog.name}`);
      continue;
    }

    // Check if resource with same name + scope already exists to avoid duplicates
    const existing = await prisma.resource.findFirst({
      where: { name: prog.name, scope: prog.scope },
    });
    if (existing) {
      continue;
    }

    await prisma.resource.create({
      data: {
        name: prog.name,
        description: prog.description,
        categoryId,
        scope: prog.scope,
        url: prog.url,
        phone: prog.phone,
        eligibilitySummary: prog.eligibilitySummary,
        incomeLimitNotes: prog.incomeLimitNotes,
        stateCode: prog.stateCode,
        verifiedAt: new Date(),
        verifiedBy: "seed",
      },
    });
    created++;
  }
  const total = await prisma.resource.count();
  console.log(`  ✓ ${created} new programs created (${total} total resources)`);
}

async function seedZipCodes() {
  console.log("Seeding zip codes...");

  // Read the geo-data CSV (has state, zip, county, city)
  const geoRaw = readFileSync(
    join(__dirname, "seed/zip-codes/us_zipcodes.csv"),
    "utf-8"
  );
  const geoLines = parseCsv(geoRaw);
  // Header: state_fips,state,state_abbr,zipcode,county,city
  const geoHeader = geoLines[0];
  const geoData = geoLines.slice(1);

  // Build a map from the geo data: zip -> {city, stateCode, county}
  const geoMap = new Map<
    string,
    { city: string; stateCode: string; county: string }
  >();
  for (const row of geoData) {
    const zip = row[3];
    if (!zip || zip.length < 5) continue;
    const paddedZip = zip.padStart(5, "0");
    geoMap.set(paddedZip, {
      city: row[5] || "Unknown",
      stateCode: row[2] || "XX",
      county: row[4] || "Unknown",
    });
  }

  // Read the coordinates CSV
  const coordRaw = readFileSync(
    join(__dirname, "seed/zip-codes/zip_coords.csv"),
    "utf-8"
  );
  const coordLines = parseCsv(coordRaw);
  // Header: ZIP,LAT,LNG
  const coordData = coordLines.slice(1);

  const coordMap = new Map<string, { lat: number; lng: number }>();
  for (const row of coordData) {
    const zip = row[0]?.padStart(5, "0");
    const lat = parseFloat(row[1]);
    const lng = parseFloat(row[2]);
    if (zip && !isNaN(lat) && !isNaN(lng)) {
      coordMap.set(zip, { lat, lng });
    }
  }

  // Check if we already have zip codes
  const existingCount = await prisma.zipCode.count();
  if (existingCount > 1000) {
    console.log(
      `  ⏩ Skipping — ${existingCount} zip codes already in database`
    );
    return;
  }

  // Merge and insert in batches using raw SQL for speed
  const allZips: Array<{
    zip: string;
    city: string;
    stateCode: string;
    county: string;
    latitude: number;
    longitude: number;
  }> = [];

  for (const [zip, geo] of geoMap) {
    const coords = coordMap.get(zip);
    allZips.push({
      zip,
      city: geo.city,
      stateCode: geo.stateCode,
      county: geo.county,
      latitude: coords?.lat ?? 0,
      longitude: coords?.lng ?? 0,
    });
  }

  // Also add any zips that are in coords but not in geo (some territories)
  for (const [zip, coords] of coordMap) {
    if (!geoMap.has(zip)) {
      allZips.push({
        zip,
        city: "Unknown",
        stateCode: "XX",
        county: "Unknown",
        latitude: coords.lat,
        longitude: coords.lng,
      });
    }
  }

  console.log(`  Inserting ${allZips.length} zip codes in batches...`);

  // Batch insert using Prisma createMany equivalent via raw SQL
  // SQLite doesn't support createMany with skipDuplicates, so use raw INSERT OR IGNORE
  const BATCH_SIZE = 500;
  for (let i = 0; i < allZips.length; i += BATCH_SIZE) {
    const batch = allZips.slice(i, i + BATCH_SIZE);
    const values = batch
      .map(
        (z) =>
          `('${z.zip}', '${z.city.replace(/'/g, "''")}', '${z.stateCode}', '${z.county.replace(/'/g, "''")}', ${z.latitude}, ${z.longitude})`
      )
      .join(",\n");

    await prisma.$executeRawUnsafe(
      `INSERT OR IGNORE INTO ZipCode (zip, city, stateCode, county, latitude, longitude) VALUES ${values}`
    );

    if ((i / BATCH_SIZE) % 10 === 0) {
      console.log(
        `  ... ${Math.min(i + BATCH_SIZE, allZips.length)}/${allZips.length}`
      );
    }
  }

  const finalCount = await prisma.zipCode.count();
  console.log(`  ✓ ${finalCount} zip codes in database`);
}

async function seedStatePrograms() {
  console.log("Seeding state programs...");
  const statesDir = join(__dirname, "seed/states");

  let files: string[];
  try {
    const { readdirSync } = await import("fs");
    files = readdirSync(statesDir).filter((f) => f.endsWith(".json"));
  } catch {
    console.log("  ⏩ No state files found yet — skipping");
    return;
  }

  if (files.length === 0) {
    console.log("  ⏩ No state JSON files found — skipping");
    return;
  }

  const categories = await prisma.category.findMany();
  const slugToId = new Map(categories.map((c) => [c.slug, c.id]));
  let totalCreated = 0;

  for (const file of files) {
    const raw = readFileSync(join(statesDir, file), "utf-8");
    const programs: ProgramSeed[] = JSON.parse(raw);
    let created = 0;

    for (const prog of programs) {
      const categoryId = slugToId.get(prog.categorySlug);
      if (!categoryId) {
        console.warn(
          `  ⚠ Unknown category slug: ${prog.categorySlug} for ${prog.name}`
        );
        continue;
      }

      const existing = await prisma.resource.findFirst({
        where: { name: prog.name, scope: prog.scope, stateCode: prog.stateCode },
      });
      if (existing) continue;

      await prisma.resource.create({
        data: {
          name: prog.name,
          description: prog.description,
          categoryId,
          scope: prog.scope,
          url: prog.url,
          phone: prog.phone,
          eligibilitySummary: prog.eligibilitySummary,
          incomeLimitNotes: prog.incomeLimitNotes,
          stateCode: prog.stateCode,
          verifiedAt: new Date(),
          verifiedBy: "seed",
        },
      });
      created++;
    }

    const stateCode = file.replace(".json", "");
    console.log(`  ✓ ${stateCode}: ${created} programs`);
    totalCreated += created;
  }

  const total = await prisma.resource.count();
  console.log(
    `  ✓ ${totalCreated} state programs created (${total} total resources)`
  );
}

async function main() {
  console.log("🌱 Starting Resrc database seed...\n");

  await seedCategories();
  await seedNationalPrograms();
  await seedZipCodes();
  await seedStatePrograms();

  console.log("\n✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
