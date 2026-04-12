/**
 * Upload GeoJSON under data/{cws,wsa,other,electric}-boundaries/by-state to Cloudflare R2.
 * Object keys mirror paths under data/ without the "data/" prefix, matching BOUNDARIES_BASE_URL fetches.
 *
 * Required env (repo root .env / .env.local, or shell):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 *
 * Usage:
 *   npm run upload:boundaries-r2
 *   npm run upload:boundaries-r2 -- --dry-run
 */
import { createReadStream } from "fs";
import { readdir, stat } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// Node does not load .env automatically (unlike `next dev`).
dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(root, ".env.local"), override: true });

const SEGMENTS = [
  "cws-boundaries/by-state",
  "wsa-boundaries/by-state",
  "other-boundaries/by-state",
  "electric-boundaries/by-state",
];

const CONTENT_TYPE = "application/geo+json";

function requiredEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`Missing env ${name}`);
    process.exit(1);
  }
  return v;
}

async function collectFiles() {
  const files = [];
  for (const seg of SEGMENTS) {
    const dir = path.join(root, "data", seg);
    let names;
    try {
      names = await readdir(dir);
    } catch (e) {
      console.warn(`Skip ${seg}: ${e.message}`);
      continue;
    }
    for (const name of names) {
      if (!name.endsWith(".geojson")) continue;
      const abs = path.join(dir, name);
      const st = await stat(abs);
      if (!st.isFile()) continue;
      const key = `${seg}/${name}`;
      files.push({ abs, key });
    }
  }
  return files;
}

async function pool(items, concurrency, fn) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const accountId = requiredEnv("R2_ACCOUNT_ID");
  const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");
  const bucket = requiredEnv("R2_BUCKET");

  const files = await collectFiles();
  if (files.length === 0) {
    console.error("No .geojson files found under data/*-boundaries/by-state");
    process.exit(1);
  }

  console.log(`${dryRun ? "[dry-run] " : ""}Uploading ${files.length} objects to bucket ${bucket}`);

  if (dryRun) {
    for (const { key, abs } of files.slice(0, 10)) {
      console.log(`  would put ${key} <= ${abs}`);
    }
    if (files.length > 10) console.log(`  ... and ${files.length - 10} more`);
    return;
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  let ok = 0;
  let fail = 0;

  await pool(files, 6, async ({ abs, key }) => {
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: createReadStream(abs),
          ContentType: CONTENT_TYPE,
        })
      );
      ok++;
      if (ok % 20 === 0) process.stdout.write(`\r${ok}/${files.length}`);
    } catch (e) {
      fail++;
      console.error(`\nFailed ${key}:`, e.message);
    }
  });

  console.log(`\nDone. Uploaded ${ok}, failed ${fail}`);
  if (fail) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
