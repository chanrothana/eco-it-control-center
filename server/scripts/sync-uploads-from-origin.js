#!/usr/bin/env node

const fs = require("fs/promises");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..", "..");
const serverRoot = path.resolve(projectRoot, "server");
const dbJsonPath = path.resolve(serverRoot, "db.json");
const uploadsRoot = path.resolve(serverRoot, "uploads");

function toText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUploadPath(value) {
  const raw = toText(value);
  if (!raw) return "";
  if (raw.startsWith("/uploads/")) return raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const parsed = new URL(raw);
      if (parsed.pathname.startsWith("/uploads/")) return parsed.pathname;
    } catch {
      return "";
    }
  }
  return "";
}

function collectUploadPaths(input, found = new Set()) {
  if (typeof input === "string") {
    const normalized = normalizeUploadPath(input);
    if (normalized) found.add(normalized);
    return found;
  }
  if (Array.isArray(input)) {
    for (const item of input) collectUploadPaths(item, found);
    return found;
  }
  if (input && typeof input === "object") {
    for (const value of Object.values(input)) collectUploadPaths(value, found);
  }
  return found;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const originArg = toText(process.argv[2] || process.env.ORIGIN_BASE_URL);
  const origin = originArg.replace(/\/+$/, "");

  if (!origin) {
    console.error("Usage: node server/scripts/sync-uploads-from-origin.js https://your-live-site");
    process.exit(1);
  }

  const dbRaw = await fs.readFile(dbJsonPath, "utf8");
  const db = JSON.parse(dbRaw);
  const uploadPaths = Array.from(collectUploadPaths(db)).sort();

  if (!uploadPaths.length) {
    console.log("No /uploads/ references found in server/db.json");
    return;
  }

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  console.log(`Found ${uploadPaths.length} upload references in db.json`);

  for (const uploadPath of uploadPaths) {
    const relativePath = uploadPath.replace(/^\/uploads\//, "");
    const targetPath = path.resolve(uploadsRoot, relativePath);
    const safeRoot = path.resolve(uploadsRoot) + path.sep;

    if (!targetPath.startsWith(safeRoot)) {
      console.warn(`Skipping unsafe path: ${uploadPath}`);
      failed += 1;
      continue;
    }

    if (await fileExists(targetPath)) {
      skipped += 1;
      continue;
    }

    const sourceUrl = `${origin}${uploadPath}`;

    try {
      const res = await fetch(sourceUrl);
      if (!res.ok) {
        console.warn(`Failed ${res.status} ${sourceUrl}`);
        failed += 1;
        continue;
      }

      const bytes = Buffer.from(await res.arrayBuffer());
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, bytes);
      downloaded += 1;
      console.log(`Downloaded ${uploadPath}`);
    } catch (err) {
      console.warn(`Error downloading ${sourceUrl}: ${err instanceof Error ? err.message : String(err)}`);
      failed += 1;
    }
  }

  console.log("");
  console.log(`Done. Downloaded: ${downloaded}, skipped existing: ${skipped}, failed: ${failed}`);
  if (failed > 0) process.exitCode = 2;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});