#!/usr/bin/env node

const DEFAULT_BASE_URL = "https://eco-it-control-center.onrender.com";
const DEFAULT_PREFIX = "ECO2-FFE-AC-";

function parseArgs(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    campus: "",
    prefix: DEFAULT_PREFIX,
    apply: false,
    token: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i] || "");
    if (arg === "--apply") {
      options.apply = true;
      continue;
    }
    if (arg === "--base-url") {
      options.baseUrl = String(argv[i + 1] || "").trim() || options.baseUrl;
      i += 1;
      continue;
    }
    if (arg === "--campus") {
      options.campus = String(argv[i + 1] || "").trim() || options.campus;
      i += 1;
      continue;
    }
    if (arg === "--prefix") {
      options.prefix = String(argv[i + 1] || "").trim() || options.prefix;
      i += 1;
      continue;
    }
    if (arg === "--token") {
      options.token = String(argv[i + 1] || "").trim();
      i += 1;
      continue;
    }
  }

  return options;
}

function padSeq(seq) {
  return String(seq).padStart(3, "0");
}

function expectedAssetId(prefix, seq) {
  return `${prefix}${padSeq(seq)}`;
}

function suffixNumber(assetId) {
  const match = String(assetId || "").trim().match(/(\d{3})$/);
  return match ? Number(match[1]) : Number.NaN;
}

async function requestJson(url, init = {}) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof data?.error === "string" && data.error ? data.error : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

function summarizeRow(row, prefix) {
  return {
    id: Number(row.id),
    seq: Number(row.seq || 0),
    currentAssetId: String(row.assetId || "").trim(),
    expectedAssetId: expectedAssetId(prefix, Number(row.seq || 0)),
    campus: String(row.campus || "").trim(),
    location: String(row.location || "").trim(),
    serialNumber: String(row.serialNumber || "").trim(),
    created: String(row.created || "").trim(),
  };
}

function printTable(title, rows) {
  console.log(`\n${title}`);
  if (!rows.length) {
    console.log("  (none)");
    return;
  }
  for (const row of rows) {
    console.log(
      `  seq ${padSeq(row.seq)} | id ${row.id} | ${row.currentAssetId} -> ${row.expectedAssetId} | ${row.campus} | ${row.location} | ${row.serialNumber}`
    );
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.token) {
    throw new Error("Missing --token");
  }

  const params = new URLSearchParams({
    detail: "summary",
    category: "FACILITY",
    q: options.prefix,
  });
  if (options.campus) params.set("campus", options.campus);
  const listUrl = `${options.baseUrl.replace(/\/+$/, "")}/api/assets?${params.toString()}`;
  const listData = await requestJson(listUrl, {
    headers: {
      Authorization: `Bearer ${options.token}`,
    },
  });

  const assets = Array.isArray(listData.assets) ? listData.assets : [];
  const rows = assets
    .filter((row) => String(row.type || "").trim().toUpperCase() === "AC")
    .filter((row) => String(row.assetId || "").trim().startsWith(options.prefix))
    .map((row) => summarizeRow(row, options.prefix))
    .sort((a, b) => a.seq - b.seq);

  const mismatches = rows.filter((row) => suffixNumber(row.currentAssetId) !== row.seq);
  printTable("Detected C2.2 AC Rows", rows);
  printTable("Mismatched Rows", mismatches);

  if (!mismatches.length) {
    console.log("\nNo mismatched AC asset IDs found.");
    return;
  }

  const expectedToRow = new Map(rows.map((row) => [row.expectedAssetId, row]));
  const mismatchIds = new Set(mismatches.map((row) => row.id));
  const blockingConflicts = [];
  for (const row of mismatches) {
    const occupant = rows.find((candidate) => candidate.currentAssetId === row.expectedAssetId);
    if (!occupant) continue;
    if (occupant.id === row.id) continue;
    if (!mismatchIds.has(occupant.id)) {
      blockingConflicts.push({
        targetAssetId: row.expectedAssetId,
        currentRow: row,
        occupant,
      });
    }
  }

  if (blockingConflicts.length) {
    console.error("\nBlocking conflicts detected:");
    for (const conflict of blockingConflicts) {
      console.error(
        `  target ${conflict.targetAssetId} for row ${conflict.currentRow.id} is occupied by row ${conflict.occupant.id}`
      );
    }
    process.exitCode = 1;
    return;
  }

  if (!options.apply) {
    console.log("\nDry run only. Re-run with --apply to patch production.");
    return;
  }

  const patchOrder = [...mismatches].sort((a, b) => b.seq - a.seq);
  console.log("\nApplying renames in descending sequence order...");
  for (const row of patchOrder) {
    const patchUrl = `${options.baseUrl.replace(/\/+$/, "")}/api/assets/${row.id}`;
    const body = {
      assetId: row.expectedAssetId,
      name: row.expectedAssetId,
    };
    await requestJson(patchUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${options.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    console.log(`  updated row ${row.id}: ${row.currentAssetId} -> ${row.expectedAssetId}`);
  }

  const verifyData = await requestJson(listUrl, {
    headers: {
      Authorization: `Bearer ${options.token}`,
    },
  });
  const verifyRows = (Array.isArray(verifyData.assets) ? verifyData.assets : [])
    .filter((row) => String(row.type || "").trim().toUpperCase() === "AC")
    .filter((row) => String(row.assetId || "").trim().startsWith(options.prefix))
    .map((row) => summarizeRow(row, options.prefix))
    .sort((a, b) => a.seq - b.seq);
  const remaining = verifyRows.filter((row) => suffixNumber(row.currentAssetId) !== row.seq);
  printTable("Verification Rows", verifyRows);
  if (remaining.length) {
    console.error("\nSome mismatches remain after apply.");
    process.exitCode = 1;
    return;
  }

  console.log("\nProduction AC asset sequence is now aligned with seq numbers.");
}

main().catch((err) => {
  console.error(String(err instanceof Error ? err.message : err));
  process.exitCode = 1;
});
