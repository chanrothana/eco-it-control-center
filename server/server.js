const http = require("http");
const https = require("https");
const fsSync = require("fs");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

let DatabaseSync;
try {
  ({ DatabaseSync } = require("node:sqlite"));
} catch {
  DatabaseSync = null;
}

const HOST = process.env.API_HOST || process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 4000);
const NODE_ENV = String(process.env.NODE_ENV || "development").toLowerCase();
const IS_PROD = NODE_ENV === "production";
const DATA_ROOT = process.env.DATA_ROOT ? path.resolve(process.env.DATA_ROOT) : __dirname;
function resolveStoragePath(envValue, fallbackName) {
  if (!envValue) return path.join(DATA_ROOT, fallbackName);
  return path.isAbsolute(envValue)
    ? path.resolve(envValue)
    : path.resolve(DATA_ROOT, envValue);
}
const DB_PATH = resolveStoragePath(process.env.DB_PATH, "db.json");
const SQLITE_PATH = resolveStoragePath(process.env.SQLITE_PATH, "data.sqlite");
const UPLOADS_DIR = resolveStoragePath(process.env.UPLOADS_DIR, "uploads");
const BACKUPS_DIR = resolveStoragePath(process.env.BACKUPS_DIR, "backups");
const AUTO_BACKUP_ENABLED = String(process.env.AUTO_BACKUP_ENABLED || "true").toLowerCase() !== "false";
const AUTO_BACKUP_INTERVAL_HOURS = Math.max(1, Number(process.env.AUTO_BACKUP_INTERVAL_HOURS || 24));
const AUTO_BACKUP_INTERVAL_MS = AUTO_BACKUP_INTERVAL_HOURS * 60 * 60 * 1000;
const AUTO_BACKUP_RETENTION_DAYS = Math.max(1, Number(process.env.AUTO_BACKUP_RETENTION_DAYS || 30));
const AUTO_BACKUP_RETENTION_MS = AUTO_BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const ALLOW_DEV_AUTH_BYPASS =
  !IS_PROD &&
  String(process.env.ALLOW_DEV_AUTH_BYPASS || "false").toLowerCase() === "true";
const DEFAULT_ADMIN_PASSWORD = String(
  process.env.BOOTSTRAP_ADMIN_PASSWORD || (!IS_PROD ? "EcoAdmin@2026!" : "")
);
const DEFAULT_VIEWER_PASSWORD = String(
  process.env.BOOTSTRAP_VIEWER_PASSWORD || (!IS_PROD ? "EcoViewer@2026!" : "")
);
const TELEGRAM_ALERT_ENABLED = String(process.env.TELEGRAM_ALERT_ENABLED || "false").toLowerCase() === "true";
const TELEGRAM_BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
const TELEGRAM_CHAT_ID = String(process.env.TELEGRAM_CHAT_ID || "").trim();
const BUILD_DIR = path.join(__dirname, "..", "build");
const INDEX_FILE = path.join(BUILD_DIR, "index.html");
const CAMPUS_MAP = {
  C1: "Samdach Pan Campus",
  "C2.1": "Chaktomuk Campus",
  "C2.2": "Chaktomuk Campus (C2.2)",
  C3: "Boeung Snor Campus",
  C4: "Veng Sreng Campus",
};
const CAMPUS_NAMES = Object.values(CAMPUS_MAP);
const TYPE_CODES = {
  IT: ["PC", "LAP", "TAB", "MON", "KBD", "MSE", "DCM", "SLP", "ADP", "RMT", "UWF", "WBC", "TV", "SPK", "PRN", "SW", "AP", "CAM"],
  SAFETY: ["FE", "SD", "EL", "FB", "FCP"],
  FACILITY: ["AC", "FPN", "RPN", "TBL", "CHR"],
};
const TYPE_LABELS = {
  PC: "Computer",
  LAP: "Laptop",
  TAB: "iPad / Tablet",
  MON: "Monitor",
  KBD: "Keyboard",
  MSE: "Mouse",
  DCM: "Digital Camera",
  SLP: "Slide Projector",
  ADP: "Power Adapter",
  RMT: "Remote Control",
  UWF: "USB WiFi Adapter",
  WBC: "Webcam",
  TV: "TV",
  SPK: "Speaker",
  PRN: "Printer",
  SW: "Switch",
  AP: "Access Point",
  CAM: "CCTV Camera",
  FE: "Fire Extinguisher",
  SD: "Smoke Detector",
  EL: "Emergency Light",
  FB: "Fire Bell",
  FCP: "Fire Control Panel",
  AC: "Air Conditioner",
  FPN: "Front Panel",
  RPN: "Rear Panel",
  TBL: "Table",
  CHR: "Chair",
};
const CATEGORY_CODE = {
  IT: "IT",
  SAFETY: "SF",
  FACILITY: "FC",
};
const SHARED_LOCATION_KEYWORDS = [
  "teacher office",
  "itc room",
  "computer lab",
  "compuer lab",
  "compuer lap",
];
const DEFAULT_USERS = [
  {
    id: 1,
    username: "admin",
    password: DEFAULT_ADMIN_PASSWORD,
    displayName: "Eco Admin",
    role: "Super Admin",
    campuses: ["ALL"],
  },
  {
    id: 2,
    username: "viewer",
    password: DEFAULT_VIEWER_PASSWORD,
    displayName: "Eco Viewer",
    role: "Viewer",
    campuses: ["Chaktomuk Campus (C2.2)"],
  },
];
const sessions = new Map();
const SQLITE_TABLES = ["assets", "tickets", "locations", "users", "audit_logs", "app_settings", "auth_sessions", "notifications"];
const PASSWORD_PREFIX = "scrypt$";

let sqliteDb;
let autoBackupTimer = null;
let autoBackupRunning = false;
const HAS_NATIVE_SQLITE = Boolean(DatabaseSync);

if (IS_PROD && (!DEFAULT_ADMIN_PASSWORD || !DEFAULT_VIEWER_PASSWORD)) {
  console.warn(
    "[SECURITY] BOOTSTRAP_ADMIN_PASSWORD / BOOTSTRAP_VIEWER_PASSWORD not set. Default users may not be usable."
  );
}
if (ALLOW_DEV_AUTH_BYPASS) {
  console.warn("[SECURITY] Dev auth bypass tokens are enabled (ALLOW_DEV_AUTH_BYPASS=true).");
}

function mapDbToSqlRows(db) {
  return {
    assets: Array.isArray(db.assets) ? db.assets : [],
    tickets: Array.isArray(db.tickets) ? db.tickets : [],
    locations: Array.isArray(db.locations) ? db.locations : [],
    users: Array.isArray(db.users) ? db.users : [],
    audit_logs: Array.isArray(db.auditLogs) ? db.auditLogs : [],
    app_settings: [db.settings && typeof db.settings === "object" ? db.settings : {}],
    auth_sessions: Array.isArray(db.authSessions) ? db.authSessions : [],
    notifications: Array.isArray(db.notifications) ? db.notifications : [],
  };
}

function mapSqlRowsToDb(rowsByTable) {
  const settingsRow = Array.isArray(rowsByTable.app_settings) ? rowsByTable.app_settings[0] : {};
  return {
    assets: Array.isArray(rowsByTable.assets) ? rowsByTable.assets : [],
    tickets: Array.isArray(rowsByTable.tickets) ? rowsByTable.tickets : [],
    locations: Array.isArray(rowsByTable.locations) ? rowsByTable.locations : [],
    users: Array.isArray(rowsByTable.users) ? rowsByTable.users : [],
    auditLogs: Array.isArray(rowsByTable.audit_logs) ? rowsByTable.audit_logs : [],
    settings: settingsRow && typeof settingsRow === "object" ? settingsRow : {},
    authSessions: Array.isArray(rowsByTable.auth_sessions) ? rowsByTable.auth_sessions : [],
    notifications: Array.isArray(rowsByTable.notifications) ? rowsByTable.notifications : [],
  };
}

function parseSqlPayload(raw, tableName) {
  try {
    return JSON.parse(raw);
  } catch {
    console.warn(`Skipping invalid JSON row in table ${tableName}`);
    return null;
  }
}

function readLegacyJsonDbSync() {
  try {
    const raw = fsSync.readFileSync(DB_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readLatestBackupDbSync() {
  try {
    if (!fsSync.existsSync(BACKUPS_DIR)) return null;
    const backupFiles = fsSync
      .readdirSync(BACKUPS_DIR)
      .filter((name) => /^backup-.*\.json$/i.test(name))
      .map((name) => {
        const fullPath = path.join(BACKUPS_DIR, name);
        const stat = fsSync.statSync(fullPath);
        return { name, fullPath, mtimeMs: stat.mtimeMs || 0 };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    for (const file of backupFiles) {
      try {
        const raw = fsSync.readFileSync(file.fullPath, "utf8");
        const parsed = JSON.parse(raw);
        return { source: file.name, db: normalizeImportedDb(parsed) };
      } catch {
        // Skip invalid backup file and continue.
      }
    }
    return null;
  } catch {
    return null;
  }
}

function countDbRows(db) {
  const safe = normalizeImportedDb(db);
  return {
    assets: Array.isArray(safe.assets) ? safe.assets.length : 0,
    tickets: Array.isArray(safe.tickets) ? safe.tickets.length : 0,
    locations: Array.isArray(safe.locations) ? safe.locations.length : 0,
    users: Array.isArray(safe.users) ? safe.users.length : 0,
    auditLogs: Array.isArray(safe.auditLogs) ? safe.auditLogs.length : 0,
    authSessions: Array.isArray(safe.authSessions) ? safe.authSessions.length : 0,
    notifications: Array.isArray(safe.notifications) ? safe.notifications.length : 0,
  };
}

function dbScore(db) {
  const counts = countDbRows(db);
  return (
    counts.assets * 1000 +
    counts.tickets * 500 +
    counts.locations * 200 +
    counts.users * 50 +
    counts.auditLogs * 10 +
    counts.authSessions +
    counts.notifications
  );
}

function looksLikeDataLoss(db) {
  const counts = countDbRows(db);
  const looksEmptyCore = counts.assets === 0 && counts.tickets === 0;
  const hasPartialSideData = counts.locations > 0 || counts.users <= DEFAULT_USERS.length;
  return looksEmptyCore && hasPartialSideData;
}

function openSqlite() {
  if (!HAS_NATIVE_SQLITE) {
    throw new Error("SQLite storage unavailable on this Node.js runtime");
  }
  if (sqliteDb) return sqliteDb;
  fsSync.mkdirSync(path.dirname(SQLITE_PATH), { recursive: true });
  sqliteDb = new DatabaseSync(SQLITE_PATH);
  sqliteDb.exec("PRAGMA journal_mode = WAL;");
  sqliteDb.exec("PRAGMA synchronous = NORMAL;");
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      row_id INTEGER PRIMARY KEY AUTOINCREMENT,
      position INTEGER NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tickets (
      row_id INTEGER PRIMARY KEY AUTOINCREMENT,
      position INTEGER NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS locations (
      row_id INTEGER PRIMARY KEY AUTOINCREMENT,
      position INTEGER NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      row_id INTEGER PRIMARY KEY AUTOINCREMENT,
      position INTEGER NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      row_id INTEGER PRIMARY KEY AUTOINCREMENT,
      position INTEGER NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      row_id INTEGER PRIMARY KEY AUTOINCREMENT,
      position INTEGER NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_sessions (
      row_id INTEGER PRIMARY KEY AUTOINCREMENT,
      position INTEGER NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notifications (
      row_id INTEGER PRIMARY KEY AUTOINCREMENT,
      position INTEGER NOT NULL,
      payload TEXT NOT NULL
    );
  `);
  return sqliteDb;
}

function isHashedPassword(value) {
  return toText(value).startsWith(PASSWORD_PREFIX);
}

function hashPassword(password) {
  const plain = toText(password);
  if (!plain) return "";
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(plain, salt, 64).toString("hex");
  return `${PASSWORD_PREFIX}${salt}$${derived}`;
}

function verifyPassword(stored, input) {
  const source = toText(stored);
  const plain = toText(input);
  if (!source || !plain) return false;

  if (!isHashedPassword(source)) {
    return source === plain;
  }

  const parts = source.split("$");
  if (parts.length !== 3) return false;
  const salt = parts[1];
  const digest = parts[2];
  if (!salt || !digest) return false;

  const expected = Buffer.from(digest, "hex");
  const actual = crypto.scryptSync(plain, salt, expected.length);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

function looksLikeBackupPayload(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const obj = input;
  return (
    Object.prototype.hasOwnProperty.call(obj, "assets") ||
    Object.prototype.hasOwnProperty.call(obj, "tickets") ||
    Object.prototype.hasOwnProperty.call(obj, "locations") ||
    Object.prototype.hasOwnProperty.call(obj, "users") ||
    Object.prototype.hasOwnProperty.call(obj, "auditLogs")
  );
}

function replaceSqliteDataSync(dbObject) {
  const db = openSqlite();
  const dbRows = mapDbToSqlRows(dbObject);
  const insertStmt = {};
  const deleteStmt = {};
  for (const table of SQLITE_TABLES) {
    insertStmt[table] = db.prepare(`INSERT INTO ${table} (position, payload) VALUES (?, ?)`);
    deleteStmt[table] = db.prepare(`DELETE FROM ${table}`);
  }

  db.exec("BEGIN IMMEDIATE TRANSACTION");
  try {
    for (const table of SQLITE_TABLES) {
      deleteStmt[table].run();
      const rows = Array.isArray(dbRows[table]) ? dbRows[table] : [];
      for (let i = 0; i < rows.length; i += 1) {
        insertStmt[table].run(i, JSON.stringify(rows[i]));
      }
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

function isSqliteEmptySync() {
  const db = openSqlite();
  const countStmt = {};
  for (const table of SQLITE_TABLES) {
    countStmt[table] = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`);
  }
  return SQLITE_TABLES.every((table) => Number(countStmt[table].get().c || 0) === 0);
}

function readSqliteDbSync() {
  const db = openSqlite();
  const selectStmt = {};
  for (const table of SQLITE_TABLES) {
    selectStmt[table] = db.prepare(`SELECT payload FROM ${table} ORDER BY position ASC, row_id ASC`);
  }
  const rowsByTable = {};
  for (const table of SQLITE_TABLES) {
    const rows = selectStmt[table].all();
    rowsByTable[table] = rows
      .map((row) => parseSqlPayload(row.payload, table))
      .filter((row) => row && typeof row === "object");
  }
  return normalizeImportedDb(mapSqlRowsToDb(rowsByTable));
}

function initStorageSync() {
  if (!HAS_NATIVE_SQLITE) {
    fsSync.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    if (!fsSync.existsSync(DB_PATH)) {
      const initial = normalizeImportedDb({});
      fsSync.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), "utf8");
    }
    return;
  }
  openSqlite();
  let sqliteCurrent = readSqliteDbSync();
  const sqliteRowEmpty = isSqliteEmptySync();
  const sqliteScore = dbScore(sqliteCurrent);
  const candidates = [];

  const legacy = readLegacyJsonDbSync();
  if (legacy) {
    candidates.push({ label: "legacy JSON", db: normalizeImportedDb(legacy) });
  }
  const backup = readLatestBackupDbSync();
  if (backup && backup.db) {
    candidates.push({ label: `backup ${backup.source}`, db: backup.db });
  }

  let best = null;
  for (const candidate of candidates) {
    const score = dbScore(candidate.db);
    if (!best || score > best.score) {
      best = { ...candidate, score };
    }
  }

  const shouldRecover =
    Boolean(best) &&
    best.score > sqliteScore &&
    (sqliteRowEmpty || sqliteScore === 0 || looksLikeDataLoss(sqliteCurrent));

  if (shouldRecover && best) {
    replaceSqliteDataSync(best.db);
    sqliteCurrent = normalizeImportedDb(best.db);
    console.log(`Recovered SQLite data from ${best.label}`);
  }

  // Keep JSON in sync with SQLite as emergency mirror/fallback.
  try {
    fsSync.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fsSync.writeFileSync(DB_PATH, JSON.stringify(sqliteCurrent, null, 2), "utf8");
  } catch (err) {
    console.warn("Could not mirror SQLite to JSON:", err instanceof Error ? err.message : err);
  }
}

function pad(n, size = 3) {
  return String(n).padStart(size, "0");
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(payload));
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    case ".map":
      return "application/json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function sendStaticFile(req, res, filePath) {
  const raw = await fs.readFile(filePath);
  const isCacheableAsset = filePath.includes(`${path.sep}static${path.sep}`);
  res.writeHead(200, {
    "Content-Type": contentTypeFor(filePath),
    "Cache-Control": isCacheableAsset ? "public, max-age=31536000, immutable" : "no-cache",
  });
  if (req.method === "HEAD") {
    res.end();
    return true;
  }
  res.end(raw);
  return true;
}

async function maybeServeFrontend(req, res, pathname) {
  const decodedPath = decodeURIComponent(pathname);

  if (decodedPath.startsWith("/uploads/")) {
    const uploadRelative = decodedPath.replace(/^\/uploads\//, "");
    const safeUploadRelative = path
      .normalize(uploadRelative)
      .replace(/^(\.\.[/\\])+/, "");
    const uploadFile = path.join(UPLOADS_DIR, safeUploadRelative);
    const uploadResolved = path.resolve(uploadFile);
    const uploadRoot = path.resolve(UPLOADS_DIR) + path.sep;
    if (!uploadResolved.startsWith(uploadRoot) || !(await fileExists(uploadResolved))) {
      return false;
    }
    return sendStaticFile(req, res, uploadResolved);
  }

  const normalized = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  const safePath = normalized.startsWith(path.sep) ? normalized.slice(1) : normalized;
  const requestedFile = path.join(BUILD_DIR, safePath);

  if (safePath && (await fileExists(requestedFile))) {
    return sendStaticFile(req, res, requestedFile);
  }

  if (await fileExists(INDEX_FILE)) {
    return sendStaticFile(req, res, INDEX_FILE);
  }
  return false;
}

async function readDb() {
  if (!HAS_NATIVE_SQLITE) {
    try {
      const raw = await fs.readFile(DB_PATH, "utf8");
      const parsed = JSON.parse(raw);
      const normalized = normalizeImportedDb(parsed);
      if (!Array.isArray(normalized.users) || !normalized.users.length) {
        normalized.users = [...DEFAULT_USERS];
      }
      return normalized;
    } catch {
      const fallback = normalizeImportedDb({});
      if (!Array.isArray(fallback.users) || !fallback.users.length) {
        fallback.users = [...DEFAULT_USERS];
      }
      await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
      await fs.writeFile(DB_PATH, JSON.stringify(fallback, null, 2), "utf8");
      return fallback;
    }
  }

  const db = openSqlite();
  const selectStmt = {};
  for (const table of SQLITE_TABLES) {
    selectStmt[table] = db.prepare(`SELECT payload FROM ${table} ORDER BY position ASC, row_id ASC`);
  }

  const rowsByTable = {};
  for (const table of SQLITE_TABLES) {
    const rows = selectStmt[table].all();
    rowsByTable[table] = rows
      .map((row) => parseSqlPayload(row.payload, table))
      .filter((row) => row && typeof row === "object");
  }

  const mapped = normalizeImportedDb(mapSqlRowsToDb(rowsByTable));
  if (!Array.isArray(mapped.users) || !mapped.users.length) {
    mapped.users = [...DEFAULT_USERS];
  }
  return mapped;
}

async function writeDb(db) {
  const normalized = normalizeImportedDb(db);
  if (!Array.isArray(normalized.users) || !normalized.users.length) {
    normalized.users = [...DEFAULT_USERS];
  }
  if (!HAS_NATIVE_SQLITE) {
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    await fs.writeFile(DB_PATH, JSON.stringify(normalized, null, 2), "utf8");
    return;
  }
  replaceSqliteDataSync(normalized);
  try {
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    await fs.writeFile(DB_PATH, JSON.stringify(normalized, null, 2), "utf8");
  } catch (err) {
    console.warn("Could not mirror SQLite to JSON:", err instanceof Error ? err.message : err);
  }
}

async function ensureBackupsDir() {
  await fs.mkdir(BACKUPS_DIR, { recursive: true });
}

async function createBackupSnapshot(requestedByUser = null, summary = "Server backup file created") {
  const db = await readDb();
  await ensureBackupsDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = `backup-${stamp}.json`;
  const filePath = path.join(BACKUPS_DIR, name);
  await fs.writeFile(filePath, JSON.stringify(normalizeImportedDb(db), null, 2));
  appendAuditLog(db, requestedByUser, "BACKUP_CREATE", "backup", name, summary);
  await writeDb(db);
  return name;
}

async function pruneOldBackups() {
  await ensureBackupsDir();
  const entries = await fs.readdir(BACKUPS_DIR, { withFileTypes: true });
  const now = Date.now();
  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isFile()) return;
      if (!entry.name.startsWith("backup-") || !entry.name.endsWith(".json")) return;
      const fullPath = path.join(BACKUPS_DIR, entry.name);
      const stat = await fs.stat(fullPath).catch(() => null);
      if (!stat) return;
      if (now - stat.mtimeMs > AUTO_BACKUP_RETENTION_MS) {
        await fs.rm(fullPath, { force: true });
      }
    })
  );
}

async function maybeRunAutoBackup() {
  if (!AUTO_BACKUP_ENABLED || autoBackupRunning) return;
  autoBackupRunning = true;
  try {
    await createBackupSnapshot(null, "Automatic scheduled backup");
    await pruneOldBackups();
  } catch (err) {
    console.warn("Auto backup failed:", err instanceof Error ? err.message : err);
  } finally {
    autoBackupRunning = false;
  }
}

async function resetDirContents(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    await Promise.all(
      entries.map((entry) =>
        fs.rm(path.join(dirPath, entry.name), { recursive: true, force: true })
      )
    );
  } catch {
    // Directory may not exist yet.
  }
  await fs.mkdir(dirPath, { recursive: true });
}

function normalizeMaintenanceReminderOffsets(input) {
  const base = Array.isArray(input) ? input : [7, 6, 5, 4, 3, 2, 1, 0];
  const cleaned = Array.from(
    new Set(
      base
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 30)
    )
  ).sort((a, b) => b - a);
  return cleaned.length ? cleaned : [7, 6, 5, 4, 3, 2, 1, 0];
}

function normalizeInventoryItems(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      id: Number(row.id) || Date.now(),
      campus: toText(row.campus),
      category: toText(row.category),
      itemCode: toText(row.itemCode),
      itemName: toText(row.itemName),
      unit: toText(row.unit),
      openingQty: Number(row.openingQty || 0),
      minStock: Number(row.minStock || 0),
      location: toText(row.location),
      vendor: toText(row.vendor),
      notes: toText(row.notes),
      photo: toText(row.photo),
      created: toText(row.created) || new Date().toISOString(),
    }));
}

function normalizeInventoryTxns(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      id: Number(row.id) || Date.now(),
      itemId: Number(row.itemId) || 0,
      campus: toText(row.campus),
      itemCode: toText(row.itemCode),
      itemName: toText(row.itemName),
      date: toText(row.date),
      type: toText(row.type),
      qty: Number(row.qty || 0),
      by: toText(row.by),
      note: toText(row.note),
      fromCampus: toText(row.fromCampus),
      toCampus: toText(row.toCampus),
      expectedReturnDate: toText(row.expectedReturnDate),
      requestedBy: toText(row.requestedBy),
      approvedBy: toText(row.approvedBy),
      receivedBy: toText(row.receivedBy),
      borrowStatus: toText(row.borrowStatus),
      photo: toText(row.photo),
    }));
}

function normalizeVaultAccounts(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      id: Number(row.id) || Date.now() + Math.floor(Math.random() * 1000),
      systemName: toText(row.systemName),
      accountName: toText(row.accountName),
      owner: toText(row.owner),
      role: toText(row.role),
      status: toText(row.status) || "Active",
      reviewDate: toText(row.reviewDate),
      note: toText(row.note),
      created: toText(row.created) || new Date().toISOString(),
    }));
}

function normalizeVaultCredentials(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      id: Number(row.id) || Date.now() + Math.floor(Math.random() * 1000),
      systemName: toText(row.systemName),
      loginUrl: toText(row.loginUrl),
      username: toText(row.username),
      password: toText(row.password),
      secretHint: toText(row.secretHint),
      twoFa: toText(row.twoFa),
      recovery: toText(row.recovery),
      lastUpdated: toText(row.lastUpdated),
      note: toText(row.note),
      created: toText(row.created) || new Date().toISOString(),
    }));
}

function normalizeVaultDesignLinks(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      id: Number(row.id) || Date.now() + Math.floor(Math.random() * 1000),
      title: toText(row.title),
      folderUrl: toText(row.folderUrl),
      owner: toText(row.owner),
      note: toText(row.note),
      lastReview: toText(row.lastReview),
      created: toText(row.created) || new Date().toISOString(),
    }));
}

function normalizeVaultNetworkDocs(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      id: Number(row.id) || Date.now() + Math.floor(Math.random() * 1000),
      title: toText(row.title),
      docType: toText(row.docType),
      fileUrl: toText(row.fileUrl),
      version: toText(row.version),
      lastReview: toText(row.lastReview),
      owner: toText(row.owner),
      note: toText(row.note),
      created: toText(row.created) || new Date().toISOString(),
    }));
}

function normalizeVaultCctvRecords(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      id: Number(row.id) || Date.now() + Math.floor(Math.random() * 1000),
      site: toText(row.site),
      nvrName: toText(row.nvrName),
      loginUrl: toText(row.loginUrl),
      username: toText(row.username),
      cameraGroup: toText(row.cameraGroup),
      retentionDays: Number(row.retentionDays || 0),
      lastAngleReview: toText(row.lastAngleReview),
      note: toText(row.note),
      created: toText(row.created) || new Date().toISOString(),
    }));
}

function normalizeImportedDb(input) {
  const parsed = input && typeof input === "object" ? input : {};
  const settings =
    parsed.settings && typeof parsed.settings === "object" && !Array.isArray(parsed.settings)
      ? parsed.settings
      : {};
  const campusNames =
    settings.campusNames && typeof settings.campusNames === "object" && !Array.isArray(settings.campusNames)
      ? settings.campusNames
      : {};
  const staffUsers = normalizeStaffUsers(settings.staffUsers);
  const calendarEvents = normalizeCalendarEvents(settings.calendarEvents);
  const maintenanceReminderOffsets = normalizeMaintenanceReminderOffsets(settings.maintenanceReminderOffsets);
  const inventoryItems = normalizeInventoryItems(settings.inventoryItems);
  const inventoryTxns = normalizeInventoryTxns(settings.inventoryTxns);
  const vaultAccounts = normalizeVaultAccounts(settings.vaultAccounts);
  const vaultCredentials = normalizeVaultCredentials(settings.vaultCredentials);
  const vaultDesignLinks = normalizeVaultDesignLinks(settings.vaultDesignLinks);
  const vaultNetworkDocs = normalizeVaultNetworkDocs(settings.vaultNetworkDocs);
  const vaultCctvRecords = normalizeVaultCctvRecords(settings.vaultCctvRecords);
  const normalizedAssets = Array.isArray(parsed.assets)
    ? parsed.assets.map((asset) => {
        if (!asset || typeof asset !== "object") return asset;
        const cloned = { ...asset };
        cloned.custodyStatus = normalizeCustodyStatus(
          cloned.custodyStatus || (toText(cloned.assignedTo) ? "ASSIGNED" : "IN_STOCK")
        );
        syncAssetStatusFromMaintenance(cloned);
        return cloned;
      })
    : [];
  return {
    assets: normalizedAssets,
    tickets: Array.isArray(parsed.tickets) ? parsed.tickets : [],
    locations: Array.isArray(parsed.locations) ? parsed.locations : [],
    users: Array.isArray(parsed.users) ? parsed.users : DEFAULT_USERS,
    auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
    authSessions: Array.isArray(parsed.authSessions) ? parsed.authSessions : [],
    notifications: normalizeNotificationEntries(parsed.notifications),
    settings: {
      campusNames,
      staffUsers,
      calendarEvents,
      maintenanceReminderOffsets,
      inventoryItems,
      inventoryTxns,
      vaultAccounts,
      vaultCredentials,
      vaultDesignLinks,
      vaultNetworkDocs,
      vaultCctvRecords,
    },
  };
}

const NOTIFICATION_MAX_ROWS = 3000;

function parseYmdToUtcMs(value) {
  const text = toText(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let year = 0;
  let month = 0;
  let day = 0;
  if (match) {
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else {
    const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (!dmy) return NaN;
    day = Number(dmy[1]);
    month = Number(dmy[2]);
    year = Number(dmy[3]);
  }
  if (!year || !month || !day) return NaN;
  return Date.UTC(year, month - 1, day);
}

function toYmdUtc(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysUntilYmd(targetYmd) {
  const targetMs = parseYmdToUtcMs(targetYmd);
  if (!Number.isFinite(targetMs)) return null;
  const todayYmd = toYmdUtc(new Date());
  const todayMs = parseYmdToUtcMs(todayYmd);
  if (!Number.isFinite(todayMs)) return null;
  return Math.round((targetMs - todayMs) / 86400000);
}

function normalizeNotificationEntries(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const row of input) {
    if (!row || typeof row !== "object") continue;
    const createdAt = toText(row.createdAt) || new Date().toISOString();
    const key = toText(row.key);
    const title = toText(row.title);
    const message = toText(row.message);
    if (!key || !title || !message) continue;
    const readBy = Array.isArray(row.readBy)
      ? Array.from(
          new Set(
            row.readBy
              .map((value) => toText(value))
              .filter(Boolean)
          )
        )
      : [];
    out.push({
      id: Number(row.id) || Date.now() + Math.floor(Math.random() * 1000),
      key,
      kind: toText(row.kind) || "maintenance_due",
      title,
      message,
      assetId: toText(row.assetId),
      assetDbId: Number(row.assetDbId) || 0,
      campus: toText(row.campus),
      scheduleDate: toText(row.scheduleDate),
      createdAt,
      readBy,
      generatedBy: toText(row.generatedBy) || "system",
    });
  }
  out.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return out.slice(0, NOTIFICATION_MAX_ROWS);
}

function upsertNotification(db, row) {
  db.notifications = normalizeNotificationEntries(db.notifications);
  const idx = db.notifications.findIndex((n) => n.key === row.key);
  if (idx >= 0) return false;
  db.notifications.unshift(row);
  if (db.notifications.length > NOTIFICATION_MAX_ROWS) {
    db.notifications = db.notifications.slice(0, NOTIFICATION_MAX_ROWS);
  }
  return true;
}

function ensureMaintenanceScheduleNotifications(db, createdNotifications = null) {
  db.notifications = normalizeNotificationEntries(db.notifications);
  const reminderOffsets = normalizeMaintenanceReminderOffsets(
    db && db.settings && typeof db.settings === "object" ? db.settings.maintenanceReminderOffsets : []
  );
  const expectedKeys = new Set();
  let changed = false;
  const assets = Array.isArray(db.assets) ? db.assets : [];
  for (const asset of assets) {
    const scheduleDate = toText(asset && asset.nextMaintenanceDate);
    if (!scheduleDate) continue;
    const days = daysUntilYmd(scheduleDate);
    if (days === null) continue;

    let kind = "";
    if (days < 0) {
      kind = "maintenance_overdue";
    } else if (reminderOffsets.includes(days)) {
      kind = days === 0 ? "maintenance_due_today" : "maintenance_due";
    }
    if (!kind) continue;

    const key = `maintenance-schedule:${Number(asset.id) || 0}:${scheduleDate}:${kind}`;
    expectedKeys.add(key);
    const title =
      kind === "maintenance_overdue"
        ? `Maintenance overdue: ${toText(asset.assetId) || "Unknown Asset"}`
        : kind === "maintenance_due_today"
          ? `Maintenance due today: ${toText(asset.assetId) || "Unknown Asset"}`
          : `Maintenance due soon: ${toText(asset.assetId) || "Unknown Asset"}`;
    const message =
      kind === "maintenance_overdue"
        ? `${toText(asset.name) || "Asset"} at ${toText(asset.location) || "Unknown location"} is overdue since ${scheduleDate}.`
        : kind === "maintenance_due_today"
          ? `${toText(asset.name) || "Asset"} at ${toText(asset.location) || "Unknown location"} is scheduled for today (${scheduleDate}).`
          : `${toText(asset.name) || "Asset"} at ${toText(asset.location) || "Unknown location"} is due in ${days} day(s) on ${scheduleDate}.`;

    const created = upsertNotification(db, {
      id: Date.now() + Math.floor(Math.random() * 1000),
      key,
      kind,
      title,
      message,
      assetId: toText(asset.assetId),
      assetDbId: Number(asset.id) || 0,
      campus: toText(asset.campus),
      scheduleDate,
      createdAt: new Date().toISOString(),
      readBy: [],
      generatedBy: "maintenance-schedule",
    });
    if (created) {
      changed = true;
      if (Array.isArray(createdNotifications)) {
        createdNotifications.push({
          kind,
          title,
          message,
          assetId: toText(asset.assetId),
          campus: toText(asset.campus),
          scheduleDate,
        });
      }
    }
  }

  const before = db.notifications.length;
  db.notifications = db.notifications.filter((row) => {
    if (toText(row.generatedBy) !== "maintenance-schedule") return true;
    return expectedKeys.has(toText(row.key));
  });
  if (db.notifications.length !== before) changed = true;
  return changed;
}

function addMaintenanceDoneNotification(db, asset, entry) {
  const completion = toText(entry && entry.completion);
  if (completion !== "Done") return false;
  const key = `maintenance-done:${Number(asset && asset.id) || 0}:${Number(entry && entry.id) || 0}`;
  return upsertNotification(db, {
    id: Date.now() + Math.floor(Math.random() * 1000),
    key,
    kind: "maintenance_done",
    title: `Maintenance done: ${toText(asset && asset.assetId) || "Unknown Asset"}`,
    message: `${toText(asset && asset.name) || "Asset"} was marked done on ${toText(entry && entry.date) || toYmdUtc(new Date())}.`,
    assetId: toText(asset && asset.assetId),
    assetDbId: Number(asset && asset.id) || 0,
    campus: toText(asset && asset.campus),
    scheduleDate: toText(asset && asset.nextMaintenanceDate),
    createdAt: new Date().toISOString(),
    readBy: [],
    generatedBy: "maintenance-done",
  });
}

function markNotificationReadByUser(notification, username) {
  const user = toText(username);
  if (!user) return false;
  const readBy = Array.isArray(notification.readBy) ? notification.readBy : [];
  if (readBy.includes(user)) return false;
  notification.readBy = [...readBy, user];
  return true;
}

function notificationVisibleToUser(notification, user) {
  const campus = toText(notification && notification.campus);
  if (!campus) return true;
  return userCanAccessCampus(user, campus);
}

function projectNotificationForUser(notification, user) {
  const username = toText(user && user.username);
  const readBy = Array.isArray(notification.readBy) ? notification.readBy : [];
  return {
    ...notification,
    read: Boolean(username && readBy.includes(username)),
  };
}

function purgeNotificationsForAsset(db, assetDbId) {
  const targetId = Number(assetDbId);
  if (!targetId) return false;
  db.notifications = normalizeNotificationEntries(db.notifications);
  const before = db.notifications.length;
  db.notifications = db.notifications.filter((row) => Number(row.assetDbId) !== targetId);
  return db.notifications.length !== before;
}

function sendTelegramMessage(text) {
  return new Promise((resolve) => {
    if (!TELEGRAM_ALERT_ENABLED || !TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID || !toText(text)) {
      resolve(false);
      return;
    }
    const payload = JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: toText(text),
      disable_web_page_preview: true,
    });
    const req = https.request(
      {
        hostname: "api.telegram.org",
        path: `/bot${encodeURIComponent(TELEGRAM_BOT_TOKEN)}/sendMessage`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
        timeout: 5000,
      },
      (res) => {
        res.on("data", () => {});
        res.on("end", () => resolve(res.statusCode >= 200 && res.statusCode < 300));
      }
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.write(payload);
    req.end();
  });
}

async function sendTelegramMaintenanceBatch(rows) {
  if (!Array.isArray(rows) || !rows.length) return false;
  const lines = rows.slice(0, 8).map((row, idx) => {
    const dateText = toText(row.scheduleDate) || "-";
    const assetId = toText(row.assetId) || "Unknown";
    const campus = toText(row.campus) || "-";
    const title = toText(row.title) || "Maintenance Alert";
    return `${idx + 1}. ${title}\nAsset: ${assetId} | Campus: ${campus} | Date: ${dateText}`;
  });
  const extra = rows.length > 8 ? `\n+${rows.length - 8} more alert(s)` : "";
  const text = `Eco IT Maintenance Alerts\n${lines.join("\n\n")}${extra}`;
  return sendTelegramMessage(text);
}

initStorageSync();

function appendAuditLog(db, user, action, entity, entityId, summary = "") {
  const actor = user
    ? {
        id: Number(user.id) || 0,
        username: toText(user.username) || "unknown",
        displayName: toText(user.displayName) || toText(user.username) || "Unknown",
        role: toText(user.role) || "Unknown",
      }
    : {
        id: 0,
        username: "system",
        displayName: "System",
        role: "System",
      };
  const entry = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    date: new Date().toISOString(),
    action: toText(action),
    entity: toText(entity),
    entityId: toText(entityId),
    summary: toText(summary),
    actor,
  };
  db.auditLogs = Array.isArray(db.auditLogs) ? db.auditLogs : [];
  db.auditLogs.unshift(entry);
  if (db.auditLogs.length > 3000) db.auditLogs = db.auditLogs.slice(0, 3000);
}

async function ensureUploadsDir() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

function extFromMime(mime) {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "jpg";
  }
}

async function saveDataUrlPhoto(dataUrl, group = "assets") {
  const raw = toText(dataUrl);
  const m = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return "";
  const mime = m[1].toLowerCase();
  const base64 = m[2];
  const ext = extFromMime(mime);
  const folder = toText(group).replace(/[^a-z0-9_-]/gi, "").toLowerCase() || "assets";
  await ensureUploadsDir();
  const folderPath = path.join(UPLOADS_DIR, folder);
  await fs.mkdir(folderPath, { recursive: true });
  const fileName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  const abs = path.join(folderPath, fileName);
  await fs.writeFile(abs, Buffer.from(base64, "base64"));
  return `/uploads/${folder}/${fileName}`;
}

async function normalizePhotoValue(photo, group = "assets") {
  const raw = toText(photo);
  if (!raw) return "";
  if (raw.startsWith("/uploads/")) return raw;
  // Normalize absolute URLs that point to uploads so they work across environments.
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const parsed = new URL(raw);
      if (parsed.pathname.startsWith("/uploads/")) {
        return parsed.pathname;
      }
    } catch {
      // Keep legacy value as-is if URL parsing fails.
    }
  }
  if (raw.startsWith("data:image/")) {
    const saved = await saveDataUrlPhoto(raw, group);
    return saved || "";
  }
  return raw;
}

async function normalizePhotoList(photos, group = "assets", maxCount = 5) {
  const out = [];
  if (!Array.isArray(photos)) return out;
  for (const item of photos) {
    const normalized = await normalizePhotoValue(item, group);
    if (!normalized) continue;
    if (!out.includes(normalized)) out.push(normalized);
    if (out.length >= maxCount) break;
  }
  return out;
}

async function normalizeHistoryEntries(entries, group = "maintenance") {
  if (!Array.isArray(entries)) return [];
  const out = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const photo = await normalizePhotoValue(entry.photo, group);
    out.push({ ...entry, photo });
  }
  return out;
}

function normalizeTransferEntries(entries) {
  if (!Array.isArray(entries)) return [];
  const out = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const id = Number(entry.id) || Date.now();
    const date = toText(entry.date);
    const fromCampus = normalizeCampusInput(entry.fromCampus);
    const fromLocation = toText(entry.fromLocation);
    const toCampus = normalizeCampusInput(entry.toCampus);
    const toLocation = toText(entry.toLocation);
    if (!date || !toCampus || !toLocation) continue;
    out.push({
      id,
      date,
      fromCampus,
      fromLocation,
      toCampus,
      toLocation,
      reason: toText(entry.reason),
      by: toText(entry.by),
      note: toText(entry.note),
    });
  }
  return out;
}

function normalizeCustodyStatus(value) {
  const raw = toUpper(value);
  if (raw === "ASSIGNED") return "ASSIGNED";
  return "IN_STOCK";
}

function normalizeCustodyEntries(entries) {
  if (!Array.isArray(entries)) return [];
  const out = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const id = Number(entry.id) || Date.now();
    const date = toText(entry.date);
    if (!date) continue;
    const action = toUpper(entry.action) || "ASSIGN";
    out.push({
      id,
      date,
      action,
      fromCampus: normalizeCampusInput(entry.fromCampus),
      fromLocation: toText(entry.fromLocation),
      toCampus: normalizeCampusInput(entry.toCampus),
      toLocation: toText(entry.toLocation),
      fromUser: toText(entry.fromUser),
      toUser: toText(entry.toUser),
      responsibilityAck: Boolean(entry.responsibilityAck),
      by: toText(entry.by),
      note: toText(entry.note),
    });
  }
  return out;
}

function toUpper(value) {
  return String(value || "").trim().toUpperCase();
}

function toText(value) {
  return String(value || "").trim();
}

function normalizeCategoryInput(value) {
  const raw = toUpper(value);
  if (!raw) return "";
  if (raw === "IT" || raw === "SAFETY" || raw === "FACILITY") return raw;
  if (raw === "FC" || raw === "FACILITIES" || raw === "FACITY") return "FACILITY";
  return raw;
}

function normalizeCampusInput(value) {
  const raw = toText(value);
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (CAMPUS_MAP[upper]) return CAMPUS_MAP[upper];
  const found = CAMPUS_NAMES.find((name) => name.toUpperCase() === upper);
  return found || "";
}

function campusCode(name) {
  const hit = Object.entries(CAMPUS_MAP).find(([, full]) => full === name);
  return hit ? hit[0] : "CX";
}

function validateAsset(body) {
  const campus = normalizeCampusInput(body.campus);
  const category = normalizeCategoryInput(body.category);
  const type = toUpper(body.type);
  const pcType = type === "PC" ? (toText(body.pcType) || "Desktop") : "";
  const location = toText(body.location);
  const setCode = toText(body.setCode);
  const parentAssetId = toUpper(body.parentAssetId);
  const componentRole = toText(body.componentRole);
  const componentRequired = Boolean(body.componentRequired);
  const assignedTo = toText(body.assignedTo);
  const custodyStatus = normalizeCustodyStatus(body.custodyStatus || (assignedTo ? "ASSIGNED" : "IN_STOCK"));
  const brand = toText(body.brand);
  const model = toText(body.model);
  const serialNumber = toText(body.serialNumber);
  const specs = toText(body.specs);
  const purchaseDate = toText(body.purchaseDate);
  const warrantyUntil = toText(body.warrantyUntil);
  const vendor = toText(body.vendor);
  const notes = toText(body.notes);
  const nextMaintenanceDate = toText(body.nextMaintenanceDate);
  const scheduleNote = toText(body.scheduleNote);
  const repeatMode = toUpper(body.repeatMode) || "NONE";
  const repeatWeekOfMonth = Number(body.repeatWeekOfMonth || 0);
  const repeatWeekday = Number(body.repeatWeekday || 0);
  const photo = toText(body.photo);
  const photos = Array.isArray(body.photos) ? body.photos : [];
  const status = toText(body.status) || "Active";
  const requiresUser = ["PC", "TAB", "SPK", "DCM"].includes(type);
  const sharedLocation = SHARED_LOCATION_KEYWORDS.some((k) =>
    location.toLowerCase().includes(k)
  );

  if (!campus) return "Campus is required";
  if (!category) return "Category is required";
  if (!TYPE_CODES[category]) return "Category must be IT, SAFETY, or FACILITY";
  if (!type) return "Type code is required";
  if (!TYPE_CODES[category].includes(type)) {
    return `Type code '${type}' is not allowed for ${category}`;
  }
  if (requiresUser && !sharedLocation && !assignedTo) {
    return `User is required for type ${type}`;
  }
  if (!["NONE", "MONTHLY_WEEKDAY"].includes(repeatMode)) {
    return "repeatMode must be NONE or MONTHLY_WEEKDAY";
  }
  if (repeatMode === "MONTHLY_WEEKDAY") {
    if (!(repeatWeekOfMonth >= 1 && repeatWeekOfMonth <= 5)) {
      return "repeatWeekOfMonth must be between 1 and 5";
    }
    if (!(repeatWeekday >= 0 && repeatWeekday <= 6)) {
      return "repeatWeekday must be between 0 and 6";
    }
  }

  return {
    campus,
    category,
    type,
    pcType,
    location,
    setCode,
    parentAssetId,
    componentRole,
    componentRequired,
    assignedTo,
    custodyStatus,
    brand,
    model,
    serialNumber,
    specs,
    purchaseDate,
    warrantyUntil,
    vendor,
    notes,
    nextMaintenanceDate,
    scheduleNote,
    repeatMode,
    repeatWeekOfMonth,
    repeatWeekday,
    photo,
    photos,
    status,
  };
}

function validateLocation(body) {
  const campus = normalizeCampusInput(body.campus);
  const name = toText(body.name);

  if (!campus) return "Campus is required";
  if (!name) return "Location name is required";

  return { campus, name };
}

function normalizeStaffUsers(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  const usedEmails = new Set();
  for (let i = 0; i < input.length; i += 1) {
    const row = input[i];
    if (!row || typeof row !== "object") continue;
    const fullName = toText(row.fullName);
    const position = toText(row.position);
    const email = toText(row.email).toLowerCase();
    if (!fullName || !position) continue;
    if (email) {
      if (usedEmails.has(email)) continue;
      usedEmails.add(email);
    }
    const parsedId = Number(row.id);
    const id = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : Date.now() + i;
    out.push({
      id,
      fullName,
      position,
      email,
    });
  }
  return out;
}

function normalizeCalendarEventType(value) {
  const type = toText(value).toLowerCase();
  if (["public", "ptc", "term_end", "term_start", "camp", "celebration", "break"].includes(type)) {
    return type;
  }
  return "public";
}

function normalizeCalendarEvents(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  const seen = new Set();
  for (let i = 0; i < input.length; i += 1) {
    const row = input[i];
    if (!row || typeof row !== "object") continue;
    const date = toText(row.date);
    const name = toText(row.name);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !name) continue;
    const key = `${date}::${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const parsedId = Number(row.id);
    const id = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : Date.now() + i;
    out.push({
      id,
      date,
      name,
      type: normalizeCalendarEventType(row.type),
    });
  }
  return out.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.name.localeCompare(b.name);
  });
}

function validateStaffUser(body) {
  const fullName = toText(body.fullName);
  const position = toText(body.position);
  const email = toText(body.email).toLowerCase();
  if (!fullName) return "Staff full name is required";
  if (!position) return "Position is required";
  return { fullName, position, email };
}

function validateTicket(body) {
  const campus = normalizeCampusInput(body.campus);
  const category = normalizeCategoryInput(body.category);
  const assetId = toText(body.assetId);
  const title = toText(body.title);
  const description = toText(body.description);
  const requestedBy = toText(body.requestedBy);
  const priority = toText(body.priority) || "Normal";
  const status = toText(body.status) || "Open";

  if (!campus) return "Campus is required";
  if (!category) return "Category is required";
  if (!title) return "Ticket title is required";
  if (!requestedBy) return "Requester is required";

  return {
    campus,
    category,
    assetId,
    title,
    description,
    requestedBy,
    priority,
    status,
  };
}

function normalizeCompletion(value) {
  const text = toText(value);
  if (!text) return "Not Yet";
  if (text === "Done" || text === "Not Yet") return text;
  return "Not Yet";
}

function isReplacementDone(typeValue, completionValue) {
  const type = toText(typeValue).trim().toLowerCase();
  const completion = normalizeCompletion(completionValue);
  if (completion !== "Done") return false;
  return type === "replacement" || type === "replacment";
}

function syncAssetStatusFromMaintenance(asset) {
  if (!asset || typeof asset !== "object") return false;
  const maintenanceHistory = Array.isArray(asset.maintenanceHistory) ? asset.maintenanceHistory : [];
  const latestReplacement = maintenanceHistory.find((entry) =>
    isReplacementDone(entry?.type, entry?.completion)
  );
  if (!latestReplacement) return false;
  const currentStatus = toText(asset.status) || "Active";
  if (currentStatus === "Retired") return false;
  asset.status = "Retired";
  const statusEntry = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    date: new Date().toISOString(),
    fromStatus: currentStatus,
    toStatus: "Retired",
    reason: `Auto defective after replacement maintenance on ${toText(latestReplacement?.date) || "unknown date"}`,
    by: toText(latestReplacement?.by),
  };
  asset.statusHistory = Array.isArray(asset.statusHistory)
    ? [statusEntry, ...asset.statusHistory]
    : [statusEntry];
  return true;
}

function getAuthUser(req) {
  const authHeader = String(req.headers.authorization || "");
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  if (ALLOW_DEV_AUTH_BYPASS && token === "local-admin-token") {
    return sanitizeUser(DEFAULT_USERS[0]);
  }
  if (ALLOW_DEV_AUTH_BYPASS && token === "local-viewer-token") {
    return sanitizeUser(DEFAULT_USERS[1]);
  }
  return sessions.get(token) || null;
}

function requireAdmin(req, res) {
  const user = getAuthUser(req);
  if (!user) {
    sendJson(res, 401, { error: "Unauthorized" });
    return null;
  }
  if (!isAdminRole(user.role)) {
    sendJson(res, 403, { error: "Admin role required" });
    return null;
  }
  return user;
}

function normalizeRole(value) {
  const role = toText(value);
  if (role === "Super Admin") return "Super Admin";
  if (role === "Admin") return "Admin";
  return "Viewer";
}

function isAdminRole(role) {
  return role === "Super Admin" || role === "Admin";
}

function canRecordMaintenance(user) {
  if (!user) return false;
  if (isAdminRole(user.role)) return true;
  const modules = Array.isArray(user.modules) ? user.modules.filter((m) => typeof m === "string") : [];
  if (modules.length && !modules.includes("maintenance")) return false;
  const menuAccess = Array.isArray(user.menuAccess) ? user.menuAccess.filter((m) => typeof m === "string") : [];
  if (menuAccess.length && !menuAccess.includes("maintenance") && !menuAccess.includes("maintenance.record")) {
    return false;
  }
  return true;
}

function normalizeCampusPermissions(input) {
  const raw = Array.isArray(input) ? input : [input];
  const out = [];
  for (const value of raw) {
    const text = toText(value);
    if (!text) continue;
    if (text.toUpperCase() === "ALL") return ["ALL"];
    const campus = normalizeCampusInput(text);
    if (campus && !out.includes(campus)) out.push(campus);
  }
  return out;
}

function userCanAccessCampus(user, campusName) {
  if (!user) return false;
  if (user.role === "Super Admin") return true;
  const campuses = normalizeCampusPermissions(user.campuses);
  if (!campuses.length) return false;
  return campuses.includes(campusName);
}

function filterByCampusPermission(list, user, getter) {
  if (!user) return [];
  if (user.role === "Super Admin") return list;
  const campuses = normalizeCampusPermissions(user.campuses);
  if (!campuses.length) return [];
  return list.filter((row) => campuses.includes(getter(row)));
}

function sanitizeUser(user) {
  const campuses = normalizeCampusPermissions(user.campuses);
  const normalizedRole = normalizeRole(user.role);
  const role = normalizedRole === "Admin" && campuses.includes("ALL") ? "Super Admin" : normalizedRole;
  const modules = Array.isArray(user.modules)
    ? user.modules.filter((m) => typeof m === "string")
    : [];
  const assetSubviewAccess =
    toText(user.assetSubviewAccess).toLowerCase() === "list_only" ? "list_only" : "both";
  const menuAccess = Array.isArray(user.menuAccess)
    ? user.menuAccess.filter((m) => typeof m === "string")
    : [];
  return {
    id: Number(user.id),
    username: toText(user.username),
    displayName: toText(user.displayName) || toText(user.username),
    role,
    campuses: role === "Super Admin" ? ["ALL"] : campuses.filter((campus) => campus !== "ALL"),
    modules,
    assetSubviewAccess,
    menuAccess,
  };
}

function sessionRowsFromMap() {
  return Array.from(sessions.entries())
    .map(([token, user]) => ({
      token: toText(token),
      user: sanitizeUser(user),
    }))
    .filter((row) => row.token && row.user && row.user.id);
}

async function persistSessionsToDb() {
  const db = await readDb();
  db.authSessions = sessionRowsFromMap();
  await writeDb(db);
}

async function restoreSessionsFromDb() {
  const db = await readDb();
  const rows = Array.isArray(db.authSessions) ? db.authSessions : [];
  sessions.clear();
  for (const row of rows) {
    const token = toText(row && row.token);
    const user = sanitizeUser((row && row.user) || {});
    if (!token || !user || !user.id) continue;
    sessions.set(token, user);
  }
}

function nextAssetSeq(assets, campus, category, type) {
  const same = assets.filter(
    (a) => a.campus === campus && a.category === category && a.type === type
  );
  if (!same.length) return 1;
  return Math.max(...same.map((a) => Number(a.seq) || 0)) + 1;
}

function nextTicketCode(tickets, campus) {
  const prefix = `${campusCode(campus)}-TCK-`;
  const nums = tickets
    .filter((t) => typeof t.ticketNo === "string" && t.ticketNo.startsWith(prefix))
    .map((t) => Number(String(t.ticketNo).split("-").pop() || 0))
    .filter((n) => Number.isFinite(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `${prefix}${pad(next, 3)}`;
}

function dashboard(db, campus) {
  const campusAssets = campus
    ? db.assets.filter((a) => a.campus === campus)
    : db.assets;
  const campusTickets = campus
    ? db.tickets.filter((t) => t.campus === campus)
    : db.tickets;

  const totalAssets = campusAssets.length;
  const itAssets = campusAssets.filter((a) => a.category === "IT").length;
  const safetyAssets = campusAssets.filter((a) => a.category === "SAFETY").length;
  const openTickets = campusTickets.filter((t) => t.status !== "Resolved").length;

  const byCampus = CAMPUS_NAMES
    .map((name) => {
      const assets = db.assets.filter((a) => a.campus === name).length;
      const tickets = db.tickets.filter(
        (t) => t.campus === name && t.status !== "Resolved"
      ).length;
      return { campus: name, assets, openTickets: tickets };
    })
    .filter((row) => row.assets || row.openTickets);

  return { totalAssets, itAssets, safetyAssets, openTickets, byCampus };
}

function toPublicAssetView(asset) {
  const source = asset && typeof asset === "object" ? asset : {};
  const maintenanceHistory = Array.isArray(source.maintenanceHistory)
    ? source.maintenanceHistory.map((entry) => ({
        id: Number(entry?.id || 0),
        date: toText(entry?.date),
        type: toText(entry?.type),
        note: toText(entry?.note),
        completion: toText(entry?.completion),
        condition: toText(entry?.condition),
        cost: toText(entry?.cost),
        by: toText(entry?.by),
        photo: toText(entry?.photo),
      }))
    : [];
  const transferHistory = Array.isArray(source.transferHistory)
    ? source.transferHistory.map((entry) => ({
        id: Number(entry?.id || 0),
        date: toText(entry?.date),
        fromCampus: toText(entry?.fromCampus),
        fromLocation: toText(entry?.fromLocation),
        toCampus: toText(entry?.toCampus),
        toLocation: toText(entry?.toLocation),
        reason: toText(entry?.reason),
        by: toText(entry?.by),
        note: toText(entry?.note),
      }))
    : [];
  const statusHistory = Array.isArray(source.statusHistory)
    ? source.statusHistory.map((entry) => ({
        id: Number(entry?.id || 0),
        date: toText(entry?.date),
        fromStatus: toText(entry?.fromStatus),
        toStatus: toText(entry?.toStatus),
        reason: toText(entry?.reason),
        by: toText(entry?.by),
      }))
    : [];
  const custodyHistory = Array.isArray(source.custodyHistory)
    ? source.custodyHistory.map((entry) => ({
        id: Number(entry?.id || 0),
        date: toText(entry?.date),
        action: toText(entry?.action),
        fromCampus: toText(entry?.fromCampus),
        fromLocation: toText(entry?.fromLocation),
        toCampus: toText(entry?.toCampus),
        toLocation: toText(entry?.toLocation),
        fromUser: toText(entry?.fromUser),
        toUser: toText(entry?.toUser),
        responsibilityAck: Boolean(entry?.responsibilityAck),
        by: toText(entry?.by),
        note: toText(entry?.note),
      }))
    : [];
  return {
    id: Number(source.id || 0),
    assetId: toText(source.assetId),
    campus: toText(source.campus),
    category: toText(source.category),
    type: toText(source.type),
    pcType: toText(source.pcType),
    name: toText(source.name),
    location: toText(source.location),
    setCode: toText(source.setCode),
    parentAssetId: toText(source.parentAssetId),
    componentRole: toText(source.componentRole),
    componentRequired: Boolean(source.componentRequired),
    assignedTo: toText(source.assignedTo),
    custodyStatus: normalizeCustodyStatus(source.custodyStatus || (toText(source.assignedTo) ? "ASSIGNED" : "IN_STOCK")),
    brand: toText(source.brand),
    model: toText(source.model),
    serialNumber: toText(source.serialNumber),
    specs: toText(source.specs),
    purchaseDate: toText(source.purchaseDate),
    warrantyUntil: toText(source.warrantyUntil),
    vendor: toText(source.vendor),
    notes: toText(source.notes),
    status: toText(source.status) || "Active",
    photo: toText(source.photo),
    photos: Array.isArray(source.photos) ? source.photos.map((p) => toText(p)).filter(Boolean) : [],
    maintenanceHistory,
    transferHistory,
    statusHistory,
    custodyHistory,
    created: toText(source.created),
  };
}

function toMillis(value) {
  const time = Date.parse(String(value || ""));
  return Number.isFinite(time) ? time : 0;
}

function latestHistoryMillis(asset) {
  const lists = [
    Array.isArray(asset?.maintenanceHistory) ? asset.maintenanceHistory : [],
    Array.isArray(asset?.transferHistory) ? asset.transferHistory : [],
    Array.isArray(asset?.statusHistory) ? asset.statusHistory : [],
    Array.isArray(asset?.custodyHistory) ? asset.custodyHistory : [],
  ];
  let latest = 0;
  for (const list of lists) {
    for (const row of list) {
      const t = toMillis(row?.date);
      if (t > latest) latest = t;
    }
  }
  return latest;
}

function selectBestAssetByAssetId(assets, assetId) {
  const key = toText(assetId).toUpperCase();
  const matched = (Array.isArray(assets) ? assets : []).filter(
    (a) => toText(a?.assetId).toUpperCase() === key
  );
  if (!matched.length) return null;
  if (matched.length === 1) return matched[0];

  const sorted = [...matched].sort((a, b) => {
    const aFresh = Math.max(toMillis(a?.created), latestHistoryMillis(a), Number(a?.id) || 0);
    const bFresh = Math.max(toMillis(b?.created), latestHistoryMillis(b), Number(b?.id) || 0);
    if (aFresh !== bFresh) return bFresh - aFresh;

    const aDepth =
      (Array.isArray(a?.maintenanceHistory) ? a.maintenanceHistory.length : 0) +
      (Array.isArray(a?.transferHistory) ? a.transferHistory.length : 0) +
      (Array.isArray(a?.statusHistory) ? a.statusHistory.length : 0);
    const bDepth =
      (Array.isArray(b?.maintenanceHistory) ? b.maintenanceHistory.length : 0) +
      (Array.isArray(b?.transferHistory) ? b.transferHistory.length : 0) +
      (Array.isArray(b?.statusHistory) ? b.statusHistory.length : 0);
    if (aDepth !== bDepth) return bDepth - aDepth;

    return (Number(b?.id) || 0) - (Number(a?.id) || 0);
  });

  return sorted[0];
}

async function parseBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > 20 * 1024 * 1024) {
      throw new Error("Payload too large");
    }
    chunks.push(chunk);
  }

  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw);
  } catch {
    const err = new Error("Invalid JSON payload");
    err.statusCode = 400;
    throw err;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url || !req.method) {
      sendJson(res, 400, { error: "Bad request" });
      return;
    }

    if (req.method === "OPTIONS") {
      sendJson(res, 204, {});
      return;
    }

    const url = new URL(req.url, `http://${HOST}:${PORT}`);

    if (
      !url.pathname.startsWith("/api/") &&
      (req.method === "GET" || req.method === "HEAD")
    ) {
      const served = await maybeServeFrontend(req, res, url.pathname);
      if (served) return;
    }

    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/public/assets/")) {
      const rawAssetId = decodeURIComponent(url.pathname.replace("/api/public/assets/", ""));
      const assetId = toText(rawAssetId);
      if (!assetId) {
        sendJson(res, 400, { error: "Asset ID is required" });
        return;
      }
      const db = await readDb();
      const assets = Array.isArray(db.assets) ? db.assets : [];
      const found = selectBestAssetByAssetId(assets, assetId);
      if (!found) {
        sendJson(res, 404, { error: "Asset not found" });
        return;
      }
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      sendJson(res, 200, { asset: toPublicAssetView(found) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/backup/export") {
      if (!requireAdmin(req, res)) return;
      const db = await readDb();
      sendJson(res, 200, {
        generatedAt: new Date().toISOString(),
        db: normalizeImportedDb(db),
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/backup/create") {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const name = await createBackupSnapshot(admin, "Server backup file created");
      sendJson(res, 201, { ok: true, file: name });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/backup/import") {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const body = await parseBody(req);
      const payload = body && Object.prototype.hasOwnProperty.call(body, "db") ? body.db : body;
      if (!looksLikeBackupPayload(payload)) {
        sendJson(res, 400, { error: "Invalid backup format. Please select a valid backup JSON file." });
        return;
      }
      const imported = normalizeImportedDb(payload);
      appendAuditLog(imported, admin, "BACKUP_IMPORT", "system", "db", "Database restored from backup");
      await writeDb(imported);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/factory-reset") {
      const admin = requireAdmin(req, res);
      if (!admin) return;

      const freshDb = normalizeImportedDb({});
      freshDb.users = [...DEFAULT_USERS];
      appendAuditLog(
        freshDb,
        admin,
        "FACTORY_RESET",
        "system",
        "all-data",
        "Factory reset completed: records and uploads cleared"
      );

      await writeDb(freshDb);
      await resetDirContents(UPLOADS_DIR);
      await resetDirContents(BACKUPS_DIR);
      sessions.clear();
      await persistSessionsToDb();
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/audit-logs") {
      if (!requireAdmin(req, res)) return;
      const db = await readDb();
      const logs = Array.isArray(db.auditLogs) ? db.auditLogs : [];
      sendJson(res, 200, { logs: logs.slice(0, 300) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/settings") {
      const user = getAuthUser(req);
      if (!user) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }
      const db = await readDb();
      const settings =
        db.settings && typeof db.settings === "object"
          ? db.settings
          : { campusNames: {}, staffUsers: [], calendarEvents: [], inventoryItems: [], inventoryTxns: [] };
      sendJson(res, 200, {
        settings: {
          ...settings,
          staffUsers: normalizeStaffUsers(settings.staffUsers),
          calendarEvents: normalizeCalendarEvents(settings.calendarEvents),
          inventoryItems: normalizeInventoryItems(settings.inventoryItems),
          inventoryTxns: normalizeInventoryTxns(settings.inventoryTxns),
          vaultAccounts: normalizeVaultAccounts(settings.vaultAccounts),
          vaultCredentials: normalizeVaultCredentials(settings.vaultCredentials),
          vaultDesignLinks: normalizeVaultDesignLinks(settings.vaultDesignLinks),
          vaultNetworkDocs: normalizeVaultNetworkDocs(settings.vaultNetworkDocs),
          vaultCctvRecords: normalizeVaultCctvRecords(settings.vaultCctvRecords),
        },
      });
      return;
    }

    if (req.method === "PATCH" && url.pathname === "/api/settings") {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const body = await parseBody(req);
      const db = await readDb();
      const current =
        db.settings && typeof db.settings === "object" ? db.settings : { campusNames: {} };
      const incoming =
        body.settings && typeof body.settings === "object" ? body.settings : body;
      const nextCampusNames =
        incoming &&
        incoming.campusNames &&
        typeof incoming.campusNames === "object" &&
        !Array.isArray(incoming.campusNames)
          ? incoming.campusNames
          : current.campusNames || {};
      const nextStaffUsers =
        incoming && Object.prototype.hasOwnProperty.call(incoming, "staffUsers")
          ? normalizeStaffUsers(incoming.staffUsers)
          : normalizeStaffUsers(current.staffUsers);
      const nextCalendarEvents =
        incoming && Object.prototype.hasOwnProperty.call(incoming, "calendarEvents")
          ? normalizeCalendarEvents(incoming.calendarEvents)
          : normalizeCalendarEvents(current.calendarEvents);
      const nextMaintenanceReminderOffsets =
        incoming && Object.prototype.hasOwnProperty.call(incoming, "maintenanceReminderOffsets")
          ? normalizeMaintenanceReminderOffsets(incoming.maintenanceReminderOffsets)
          : normalizeMaintenanceReminderOffsets(current.maintenanceReminderOffsets);
      const nextInventoryItems =
        incoming && Object.prototype.hasOwnProperty.call(incoming, "inventoryItems")
          ? normalizeInventoryItems(incoming.inventoryItems)
          : normalizeInventoryItems(current.inventoryItems);
      const nextInventoryTxns =
        incoming && Object.prototype.hasOwnProperty.call(incoming, "inventoryTxns")
          ? normalizeInventoryTxns(incoming.inventoryTxns)
          : normalizeInventoryTxns(current.inventoryTxns);
      const nextVaultAccounts =
        incoming && Object.prototype.hasOwnProperty.call(incoming, "vaultAccounts")
          ? normalizeVaultAccounts(incoming.vaultAccounts)
          : normalizeVaultAccounts(current.vaultAccounts);
      const nextVaultCredentials =
        incoming && Object.prototype.hasOwnProperty.call(incoming, "vaultCredentials")
          ? normalizeVaultCredentials(incoming.vaultCredentials)
          : normalizeVaultCredentials(current.vaultCredentials);
      const nextVaultDesignLinks =
        incoming && Object.prototype.hasOwnProperty.call(incoming, "vaultDesignLinks")
          ? normalizeVaultDesignLinks(incoming.vaultDesignLinks)
          : normalizeVaultDesignLinks(current.vaultDesignLinks);
      const nextVaultNetworkDocs =
        incoming && Object.prototype.hasOwnProperty.call(incoming, "vaultNetworkDocs")
          ? normalizeVaultNetworkDocs(incoming.vaultNetworkDocs)
          : normalizeVaultNetworkDocs(current.vaultNetworkDocs);
      const nextVaultCctvRecords =
        incoming && Object.prototype.hasOwnProperty.call(incoming, "vaultCctvRecords")
          ? normalizeVaultCctvRecords(incoming.vaultCctvRecords)
          : normalizeVaultCctvRecords(current.vaultCctvRecords);
      db.settings = {
        ...current,
        campusNames: nextCampusNames,
        staffUsers: nextStaffUsers,
        calendarEvents: nextCalendarEvents,
        maintenanceReminderOffsets: nextMaintenanceReminderOffsets,
        inventoryItems: nextInventoryItems,
        inventoryTxns: nextInventoryTxns,
        vaultAccounts: nextVaultAccounts,
        vaultCredentials: nextVaultCredentials,
        vaultDesignLinks: nextVaultDesignLinks,
        vaultNetworkDocs: nextVaultNetworkDocs,
        vaultCctvRecords: nextVaultCctvRecords,
      };
      appendAuditLog(db, admin, "UPDATE", "settings", "campusNames", "Updated campus name settings");
      await writeDb(db);
      sendJson(res, 200, { ok: true, settings: db.settings });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/staff-users") {
      const user = getAuthUser(req);
      if (!user) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }
      const db = await readDb();
      const settings = db.settings && typeof db.settings === "object" ? db.settings : {};
      const users = normalizeStaffUsers(settings.staffUsers);
      sendJson(res, 200, { users });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/staff-users") {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const body = await parseBody(req);
      const cleaned = validateStaffUser(body);
      if (typeof cleaned === "string") {
        sendJson(res, 400, { error: cleaned });
        return;
      }
      const db = await readDb();
      const settings = db.settings && typeof db.settings === "object" ? db.settings : {};
      const users = normalizeStaffUsers(settings.staffUsers);
      const duplicate = cleaned.email
        ? users.some((u) => String(u.email || "").toLowerCase() === cleaned.email.toLowerCase())
        : false;
      if (duplicate) {
        sendJson(res, 400, { error: "User email already exists." });
        return;
      }
      const user = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        fullName: cleaned.fullName,
        position: cleaned.position,
        email: cleaned.email,
      };
      const nextUsers = [user, ...users];
      db.settings = {
        ...settings,
        staffUsers: nextUsers,
      };
      appendAuditLog(db, admin, "CREATE", "staff_user", String(user.id), `${user.fullName} | ${user.email || "-"}`);
      await writeDb(db);
      sendJson(res, 201, { user, users: nextUsers });
      return;
    }

    if (req.method === "PATCH" && url.pathname.startsWith("/api/staff-users/")) {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const id = Number(url.pathname.replace("/api/staff-users/", ""));
      if (!id) {
        sendJson(res, 400, { error: "Invalid ID" });
        return;
      }
      const body = await parseBody(req);
      const cleaned = validateStaffUser(body);
      if (typeof cleaned === "string") {
        sendJson(res, 400, { error: cleaned });
        return;
      }
      const db = await readDb();
      const settings = db.settings && typeof db.settings === "object" ? db.settings : {};
      const users = normalizeStaffUsers(settings.staffUsers);
      const idx = users.findIndex((u) => u.id === id);
      if (idx === -1) {
        sendJson(res, 404, { error: "User not found" });
        return;
      }
      const duplicate = cleaned.email
        ? users.some(
            (u) => u.id !== id && String(u.email || "").toLowerCase() === cleaned.email.toLowerCase()
          )
        : false;
      if (duplicate) {
        sendJson(res, 400, { error: "User email already exists." });
        return;
      }
      users[idx] = { ...users[idx], ...cleaned };
      db.settings = {
        ...settings,
        staffUsers: users,
      };
      appendAuditLog(db, admin, "UPDATE", "staff_user", String(id), `${users[idx].fullName} | ${users[idx].email || "-"}`);
      await writeDb(db);
      sendJson(res, 200, { user: users[idx], users });
      return;
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/staff-users/")) {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const id = Number(url.pathname.replace("/api/staff-users/", ""));
      if (!id) {
        sendJson(res, 400, { error: "Invalid ID" });
        return;
      }
      const db = await readDb();
      const settings = db.settings && typeof db.settings === "object" ? db.settings : {};
      const users = normalizeStaffUsers(settings.staffUsers);
      const target = users.find((u) => u.id === id);
      const nextUsers = users.filter((u) => u.id !== id);
      if (nextUsers.length === users.length) {
        sendJson(res, 404, { error: "User not found" });
        return;
      }
      db.settings = {
        ...settings,
        staffUsers: nextUsers,
      };
      appendAuditLog(
        db,
        admin,
        "DELETE",
        "staff_user",
        String(id),
        target ? `${target.fullName} | ${target.email}` : ""
      );
      await writeDb(db);
      sendJson(res, 200, { ok: true, users: nextUsers });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/upload-photo") {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const body = await parseBody(req);
      const folder = toText(body.folder) || "assets";
      const photoInput = toText(body.photo || body.dataUrl);
      if (!photoInput.startsWith("data:image/")) {
        sendJson(res, 400, { error: "image dataUrl is required" });
        return;
      }
      const photo = await normalizePhotoValue(photoInput, folder);
      if (!photo) {
        sendJson(res, 400, { error: "Invalid image dataUrl" });
        return;
      }
      const db = await readDb();
      appendAuditLog(
        db,
        admin,
        "UPLOAD_PHOTO",
        "photo",
        photo,
        `folder=${folder}`
      );
      await writeDb(db);
      sendJson(res, 201, { photo });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/login") {
      const body = await parseBody(req);
      const username = toText(body.username);
      const password = toText(body.password);
      if (!username || !password) {
        sendJson(res, 400, { error: "Username and password are required" });
        return;
      }
      const db = await readDb();
      const users = Array.isArray(db.users) ? db.users : [];
      const user = users.find((u) => toText(u.username).toLowerCase() === username.toLowerCase());
      if (!user) {
        sendJson(res, 401, { error: "Invalid username or password" });
        return;
      }
      if (!verifyPassword(user.password, password)) {
        sendJson(res, 401, { error: "Invalid username or password" });
        return;
      }
      if (!isHashedPassword(user.password)) {
        user.password = hashPassword(password);
        db.users = users;
        await writeDb(db);
      }
      const token = crypto.randomBytes(24).toString("hex");
      const safeUser = sanitizeUser(user);
      sessions.set(token, safeUser);
      await persistSessionsToDb();
      sendJson(res, 200, { token, user: safeUser });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/auth/me") {
      const user = getAuthUser(req);
      if (!user) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }
      sendJson(res, 200, { user });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/logout") {
      const authHeader = String(req.headers.authorization || "");
      if (authHeader.startsWith("Bearer ")) {
        const token = authHeader.slice(7).trim();
        sessions.delete(token);
        await persistSessionsToDb();
      }
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/auth/users") {
      if (!requireAdmin(req, res)) return;
      const db = await readDb();
      const users = (Array.isArray(db.users) ? db.users : DEFAULT_USERS).map(sanitizeUser);
      sendJson(res, 200, { users });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/users") {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const body = await parseBody(req);
      const username = toText(body.username).toLowerCase();
      const password = toText(body.password);
      const displayName = toText(body.displayName) || username;
      const role = normalizeRole(body.role);
      const campuses = normalizeCampusPermissions(body.campuses);
      const modules = Array.isArray(body.modules)
        ? body.modules.filter((m) => typeof m === "string")
        : [];
      const assetSubviewAccess =
        toText(body.assetSubviewAccess).toLowerCase() === "list_only" ? "list_only" : "both";
      const menuAccess = Array.isArray(body.menuAccess)
        ? body.menuAccess.filter((m) => typeof m === "string")
        : [];

      if (!username || !password) {
        sendJson(res, 400, { error: "Username and password are required" });
        return;
      }
      if (role !== "Super Admin" && !campuses.length) {
        sendJson(res, 400, { error: "At least one campus is required for this role" });
        return;
      }
      if (role !== "Super Admin" && campuses.includes("ALL")) {
        sendJson(res, 400, { error: "Only Super Admin can use ALL campuses" });
        return;
      }

      const db = await readDb();
      const users = Array.isArray(db.users) ? db.users : DEFAULT_USERS;
      const exists = users.some((u) => toText(u.username).toLowerCase() === username);
      if (exists) {
        sendJson(res, 409, { error: "Username already exists" });
        return;
      }

      const nextId = users.length
        ? Math.max(...users.map((u) => Number(u.id) || 0)) + 1
        : 1;
      const newUser = {
        id: nextId,
        username,
        password: hashPassword(password),
        displayName,
        role,
        campuses: role === "Super Admin" ? ["ALL"] : campuses,
        modules,
        assetSubviewAccess,
        menuAccess,
      };

      users.push(newUser);
      db.users = users;
      appendAuditLog(
        db,
        admin,
        "CREATE",
        "auth_user",
        String(newUser.id),
        `username=${newUser.username}; role=${newUser.role}; campuses=${newUser.campuses.join(",")}; assetAccess=${newUser.assetSubviewAccess}; menuAccess=${newUser.menuAccess.length}`
      );
      await writeDb(db);
      sendJson(res, 201, { user: sanitizeUser(newUser) });
      return;
    }

    if (req.method === "PATCH" && url.pathname.startsWith("/api/auth/users/")) {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const id = Number(url.pathname.replace("/api/auth/users/", ""));
      if (!id) {
        sendJson(res, 400, { error: "Invalid ID" });
        return;
      }
      const body = await parseBody(req);
      const usernameInput = toText(body.username).toLowerCase();
      const displayNameInput = toText(body.displayName);
      const passwordInput = toText(body.password);
      const role = normalizeRole(body.role);
      const campuses = normalizeCampusPermissions(body.campuses);
      const modules = Array.isArray(body.modules)
        ? body.modules.filter((m) => typeof m === "string")
        : [];
      const assetSubviewAccess =
        toText(body.assetSubviewAccess).toLowerCase() === "list_only" ? "list_only" : "both";
      const menuAccess = Array.isArray(body.menuAccess)
        ? body.menuAccess.filter((m) => typeof m === "string")
        : [];
      if (role !== "Super Admin" && !campuses.length) {
        sendJson(res, 400, { error: "At least one campus is required for this role" });
        return;
      }
      if (role !== "Super Admin" && campuses.includes("ALL")) {
        sendJson(res, 400, { error: "Only Super Admin can use ALL campuses" });
        return;
      }

      const db = await readDb();
      const users = Array.isArray(db.users) ? db.users : DEFAULT_USERS;
      const idx = users.findIndex((u) => Number(u.id) === id);
      if (idx === -1) {
        sendJson(res, 404, { error: "User not found" });
        return;
      }
      const username = usernameInput || toText(users[idx].username).toLowerCase();
      if (!username) {
        sendJson(res, 400, { error: "Username is required" });
        return;
      }
      const duplicateUsername = users.some(
        (u, rowIdx) => rowIdx !== idx && toText(u.username).toLowerCase() === username
      );
      if (duplicateUsername) {
        sendJson(res, 409, { error: "Username already exists" });
        return;
      }
      const displayName = displayNameInput || username;

      users[idx].username = username;
      users[idx].displayName = displayName;
      if (passwordInput) {
        users[idx].password = hashPassword(passwordInput);
      }
      users[idx].role = role;
      users[idx].campuses = role === "Super Admin" ? ["ALL"] : campuses;
      users[idx].modules = modules;
      users[idx].assetSubviewAccess = assetSubviewAccess;
      users[idx].menuAccess = menuAccess;
      db.users = users;
      appendAuditLog(
        db,
        admin,
        "UPDATE",
        "auth_user_permission",
        String(id),
        `username=${username}; role=${role}; campuses=${(role === "Super Admin" ? ["ALL"] : campuses).join(",")}; assetAccess=${assetSubviewAccess}; menuAccess=${menuAccess.length}; passwordUpdated=${passwordInput ? "yes" : "no"}`
      );
      await writeDb(db);

      const safeUser = sanitizeUser(users[idx]);
      for (const [token, sessionUser] of sessions.entries()) {
        if (Number(sessionUser.id) === id) {
          sessions.set(token, safeUser);
        }
      }
      await persistSessionsToDb();
      sendJson(res, 200, { user: safeUser });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/dashboard") {
      const user = getAuthUser(req);
      if (!user) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }
      const campus = normalizeCampusInput(url.searchParams.get("campus"));
      const db = await readDb();
      const scopedAssets = filterByCampusPermission(db.assets, user, (a) => a.campus);
      const scopedTickets = filterByCampusPermission(db.tickets, user, (t) => t.campus);
      const scopedDb = { ...db, assets: scopedAssets, tickets: scopedTickets };
      const selectedCampus =
        campus && userCanAccessCampus(user, campus) ? campus : "";
      sendJson(res, 200, { stats: dashboard(scopedDb, selectedCampus || "") });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/notifications") {
      const user = getAuthUser(req);
      if (!user) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }
      const status = toText(url.searchParams.get("status")).toLowerCase() || "all";
      const limitRaw = Number(url.searchParams.get("limit") || 30);
      const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? limitRaw : 30));
      const db = await readDb();
      const createdNotifications = [];
      const generated = ensureMaintenanceScheduleNotifications(db, createdNotifications);
      if (generated) {
        await writeDb(db);
        void sendTelegramMaintenanceBatch(createdNotifications);
      }
      const visible = normalizeNotificationEntries(db.notifications)
        .filter((row) => notificationVisibleToUser(row, user))
        .map((row) => projectNotificationForUser(row, user));
      const filtered =
        status === "unread" ? visible.filter((row) => !row.read) : visible;
      const unread = visible.filter((row) => !row.read).length;
      sendJson(res, 200, { notifications: filtered.slice(0, limit), unread });
      return;
    }

    if (req.method === "PATCH" && url.pathname === "/api/notifications/read-all") {
      const user = getAuthUser(req);
      if (!user) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }
      const db = await readDb();
      db.notifications = normalizeNotificationEntries(db.notifications);
      let changed = false;
      for (const row of db.notifications) {
        if (!notificationVisibleToUser(row, user)) continue;
        if (markNotificationReadByUser(row, user.username)) changed = true;
      }
      if (changed) await writeDb(db);
      sendJson(res, 200, { ok: true });
      return;
    }

    const notificationReadMatch = url.pathname.match(/^\/api\/notifications\/(\d+)\/read$/);
    if (req.method === "PATCH" && notificationReadMatch) {
      const user = getAuthUser(req);
      if (!user) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }
      const id = Number(notificationReadMatch[1]);
      if (!id) {
        sendJson(res, 400, { error: "Invalid ID" });
        return;
      }
      const db = await readDb();
      db.notifications = normalizeNotificationEntries(db.notifications);
      const row = db.notifications.find((item) => Number(item.id) === id);
      if (!row) {
        sendJson(res, 404, { error: "Notification not found" });
        return;
      }
      if (!notificationVisibleToUser(row, user)) {
        sendJson(res, 403, { error: "Campus access denied" });
        return;
      }
      const changed = markNotificationReadByUser(row, user.username);
      if (changed) await writeDb(db);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/assets") {
      const user = getAuthUser(req);
      if (!user) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }
      const campus = normalizeCampusInput(url.searchParams.get("campus"));
      const category = toUpper(url.searchParams.get("category"));
      const search = toText(url.searchParams.get("q")).toLowerCase();

      const db = await readDb();
      let assets = filterByCampusPermission(db.assets, user, (a) => a.campus);
      if (campus && !userCanAccessCampus(user, campus)) {
        sendJson(res, 200, { assets: [] });
        return;
      }
      if (campus) assets = assets.filter((a) => a.campus === campus);
      if (category) assets = assets.filter((a) => a.category === category);
      if (search) {
        assets = assets.filter((a) => {
          const hay = `${a.assetId} ${a.name} ${a.location} ${a.setCode || ""} ${a.parentAssetId || ""}`.toLowerCase();
          return hay.includes(search);
        });
      }
      sendJson(res, 200, { assets });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/assets") {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const body = await parseBody(req);
      const cleaned = validateAsset(body);
      if (typeof cleaned === "string") {
        sendJson(res, 400, { error: cleaned });
        return;
      }

      const assetPhoto = await normalizePhotoValue(cleaned.photo, "assets");
      const normalizedPhotos = await normalizePhotoList(cleaned.photos, "assets", 5);
      if (assetPhoto && !normalizedPhotos.includes(assetPhoto)) {
        normalizedPhotos.unshift(assetPhoto);
      }
      const assetPhotos = normalizedPhotos.slice(0, 5);
      const mainPhoto = assetPhotos[0] || assetPhoto || "";
      const initialHistory = await normalizeHistoryEntries(body.maintenanceHistory, "maintenance");
      const initialTransferHistory = normalizeTransferEntries(body.transferHistory);
      const initialCustodyHistory = normalizeCustodyEntries(body.custodyHistory);
      const db = await readDb();
      const seq = nextAssetSeq(db.assets, cleaned.campus, cleaned.category, cleaned.type);
      const assetId = `${campusCode(cleaned.campus)}-${CATEGORY_CODE[cleaned.category] || cleaned.category}-${cleaned.type}-${pad(seq, 4)}`;
      const custodyStatus = normalizeCustodyStatus(cleaned.custodyStatus || (cleaned.assignedTo ? "ASSIGNED" : "IN_STOCK"));
      const finalCustodyHistory =
        initialCustodyHistory.length || !cleaned.assignedTo
          ? initialCustodyHistory
          : [
              {
                id: Date.now(),
                date: new Date().toISOString(),
                action: "ASSIGN",
                fromCampus: cleaned.campus,
                fromLocation: cleaned.location,
                toCampus: cleaned.campus,
                toLocation: cleaned.location,
                fromUser: "",
                toUser: cleaned.assignedTo,
                responsibilityAck: false,
                by: "",
                note: "Initial assignment",
              },
            ];

      const asset = {
        id: Date.now(),
        seq,
        assetId,
        name: assetId,
        maintenanceHistory: initialHistory,
        transferHistory: initialTransferHistory,
        custodyHistory: finalCustodyHistory,
        created: new Date().toISOString(),
        ...cleaned,
        custodyStatus,
        photo: mainPhoto,
        photos: assetPhotos,
      };

      db.assets.unshift(asset);
      ensureMaintenanceScheduleNotifications(db);
      appendAuditLog(db, admin, "CREATE", "asset", asset.assetId, `${asset.campus} | ${asset.location}`);
      await writeDb(db);
      sendJson(res, 201, { asset });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/locations") {
      const user = getAuthUser(req);
      if (!user) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }
      const campus = normalizeCampusInput(url.searchParams.get("campus"));
      const db = await readDb();
      let locations = filterByCampusPermission(db.locations, user, (l) => l.campus);
      if (campus && !userCanAccessCampus(user, campus)) {
        sendJson(res, 200, { locations: [] });
        return;
      }
      if (campus) locations = locations.filter((l) => l.campus === campus);
      sendJson(res, 200, { locations });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/locations") {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const body = await parseBody(req);
      const cleaned = validateLocation(body);
      if (typeof cleaned === "string") {
        sendJson(res, 400, { error: cleaned });
        return;
      }

      const db = await readDb();
      const duplicate = db.locations.some(
        (l) =>
          l.campus === cleaned.campus &&
          String(l.name).toLowerCase() === cleaned.name.toLowerCase()
      );
      if (duplicate) {
        sendJson(res, 400, { error: "Location already exists for this campus" });
        return;
      }

      const location = {
        id: Date.now(),
        campus: cleaned.campus,
        name: cleaned.name,
      };
      db.locations.unshift(location);
      appendAuditLog(db, admin, "CREATE", "location", String(location.id), `${location.campus} | ${location.name}`);
      await writeDb(db);
      sendJson(res, 201, { location });
      return;
    }

    if (req.method === "PATCH" && url.pathname.startsWith("/api/locations/")) {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const id = Number(url.pathname.replace("/api/locations/", ""));
      if (!id) {
        sendJson(res, 400, { error: "Invalid ID" });
        return;
      }

      const body = await parseBody(req);
      const cleaned = validateLocation(body);
      if (typeof cleaned === "string") {
        sendJson(res, 400, { error: cleaned });
        return;
      }

      const db = await readDb();
      const idx = db.locations.findIndex((l) => l.id === id);
      if (idx === -1) {
        sendJson(res, 404, { error: "Location not found" });
        return;
      }

      db.locations[idx].campus = cleaned.campus;
      db.locations[idx].name = cleaned.name;
      appendAuditLog(db, admin, "UPDATE", "location", String(id), `${cleaned.campus} | ${cleaned.name}`);
      await writeDb(db);
      sendJson(res, 200, { location: db.locations[idx] });
      return;
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/locations/")) {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const id = Number(url.pathname.replace("/api/locations/", ""));
      if (!id) {
        sendJson(res, 400, { error: "Invalid ID" });
        return;
      }

      const db = await readDb();
      const target = db.locations.find((l) => l.id === id);
      const before = db.locations.length;
      db.locations = db.locations.filter((l) => l.id !== id);
      if (db.locations.length === before) {
        sendJson(res, 404, { error: "Location not found" });
        return;
      }
      appendAuditLog(
        db,
        admin,
        "DELETE",
        "location",
        String(id),
        target ? `${target.campus} | ${target.name}` : ""
      );
      await writeDb(db);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "PATCH" && url.pathname.startsWith("/api/assets/") && url.pathname.endsWith("/status")) {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const id = Number(url.pathname.replace("/api/assets/", "").replace("/status", ""));
      if (!id) {
        sendJson(res, 400, { error: "Invalid ID" });
        return;
      }

      const body = await parseBody(req);
      const status = toText(body.status);
      if (!status) {
        sendJson(res, 400, { error: "Status is required" });
        return;
      }

      const db = await readDb();
      const idx = db.assets.findIndex((a) => a.id === id);
      if (idx === -1) {
        sendJson(res, 404, { error: "Asset not found" });
        return;
      }

      const currentStatus = toText(db.assets[idx].status) || "Unknown";
      if (currentStatus === status) {
        sendJson(res, 200, { asset: db.assets[idx] });
        return;
      }
      const reason = toText(body.reason);
      const by = toText(body.by);
      if (!reason) {
        sendJson(res, 400, { error: "Reason is required" });
        return;
      }
      if (!by) {
        sendJson(res, 400, { error: "Verified By is required" });
        return;
      }
      const currentStatusHistory = Array.isArray(db.assets[idx].statusHistory)
        ? db.assets[idx].statusHistory
        : [];
      const statusEntry = {
        id: Date.now(),
        date: new Date().toISOString(),
        fromStatus: currentStatus,
        toStatus: status,
        reason,
        by,
      };

      db.assets[idx].status = status;
      db.assets[idx].statusHistory = [statusEntry, ...currentStatusHistory];
      appendAuditLog(
        db,
        admin,
        "UPDATE_STATUS",
        "asset",
        db.assets[idx].assetId || String(id),
        `${currentStatus} -> ${status} | ${reason} | ${by}`
      );
      await writeDb(db);
      sendJson(res, 200, { asset: db.assets[idx] });
      return;
    }

    const historyPatchMatch = url.pathname.match(/^\/api\/assets\/(\d+)\/history\/(\d+)$/);
    if (req.method === "PATCH" && historyPatchMatch) {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const assetId = Number(historyPatchMatch[1]);
      const entryId = Number(historyPatchMatch[2]);
      if (!assetId || !entryId) {
        sendJson(res, 400, { error: "Invalid ID" });
        return;
      }

      const body = await parseBody(req);
      const nextDate = toText(body.date);
      const nextType = toText(body.type);
      const nextNote = toText(body.note);
      const nextCost = toText(body.cost);
      const nextBy = toText(body.by);
      const nextPhoto = await normalizePhotoValue(body.photo, "maintenance");
      const nextCompletion = normalizeCompletion(body.completion);
      const nextCondition = toText(body.condition);

      const db = await readDb();
      const idx = db.assets.findIndex((a) => a.id === assetId);
      if (idx === -1) {
        sendJson(res, 404, { error: "Asset not found" });
        return;
      }

      const history = Array.isArray(db.assets[idx].maintenanceHistory)
        ? db.assets[idx].maintenanceHistory
        : [];
      const hIdx = history.findIndex((h) => Number(h.id) === entryId);
      if (hIdx === -1) {
        sendJson(res, 404, { error: "History record not found" });
        return;
      }

      const current = history[hIdx] || {};
      const updated = {
        ...current,
        date: nextDate || toText(current.date),
        type: nextType || toText(current.type),
        completion: nextCompletion || normalizeCompletion(current.completion),
        condition: nextCondition,
        note: nextNote || toText(current.note),
        cost: nextCost,
        by: nextBy,
        photo: nextPhoto,
      };
      if (!updated.date || !updated.type || !updated.note) {
        sendJson(res, 400, { error: "date, type, note are required" });
        return;
      }

      history[hIdx] = updated;
      db.assets[idx].maintenanceHistory = history;
      if (syncAssetStatusFromMaintenance(db.assets[idx])) {
        appendAuditLog(
          db,
          admin,
          "UPDATE_STATUS",
          "asset",
          db.assets[idx].assetId || String(assetId),
          "Defective (auto from replacement)"
        );
      }
      appendAuditLog(
        db,
        admin,
        "UPDATE",
        "maintenance_record",
        `${db.assets[idx].assetId || assetId}#${entryId}`,
        `${updated.type} | ${updated.completion || "Not Yet"}`
      );
      if (updated.completion === "Done") {
        addMaintenanceDoneNotification(db, db.assets[idx], updated);
      }
      ensureMaintenanceScheduleNotifications(db);
      await writeDb(db);
      sendJson(res, 200, { asset: db.assets[idx], entry: history[hIdx] });
      return;
    }

    const historyDeleteMatch = url.pathname.match(/^\/api\/assets\/(\d+)\/history\/(\d+)$/);
    if (req.method === "DELETE" && historyDeleteMatch) {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const assetId = Number(historyDeleteMatch[1]);
      const entryId = Number(historyDeleteMatch[2]);
      if (!assetId || !entryId) {
        sendJson(res, 400, { error: "Invalid ID" });
        return;
      }

      const db = await readDb();
      const idx = db.assets.findIndex((a) => a.id === assetId);
      if (idx === -1) {
        sendJson(res, 404, { error: "Asset not found" });
        return;
      }

      const history = Array.isArray(db.assets[idx].maintenanceHistory)
        ? db.assets[idx].maintenanceHistory
        : [];
      const before = history.length;
      db.assets[idx].maintenanceHistory = history.filter((h) => Number(h.id) !== entryId);
      if (db.assets[idx].maintenanceHistory.length === before) {
        sendJson(res, 404, { error: "History record not found" });
        return;
      }
      if (syncAssetStatusFromMaintenance(db.assets[idx])) {
        appendAuditLog(
          db,
          admin,
          "UPDATE_STATUS",
          "asset",
          db.assets[idx].assetId || String(assetId),
          "Defective (auto from replacement)"
        );
      }

      appendAuditLog(
        db,
        admin,
        "DELETE",
        "maintenance_record",
        `${db.assets[idx].assetId || assetId}#${entryId}`,
        "Maintenance record deleted"
      );
      ensureMaintenanceScheduleNotifications(db);
      await writeDb(db);
      sendJson(res, 200, { asset: db.assets[idx], ok: true });
      return;
    }

    if (
      req.method === "PATCH" &&
      url.pathname.startsWith("/api/assets/") &&
      !url.pathname.endsWith("/status") &&
      !url.pathname.endsWith("/history") &&
      !url.pathname.includes("/history/")
    ) {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const id = Number(url.pathname.replace("/api/assets/", ""));
      if (!id) {
        sendJson(res, 400, { error: "Invalid ID" });
        return;
      }

      const db = await readDb();
      const idx = db.assets.findIndex((a) => a.id === id);
      if (idx === -1) {
        sendJson(res, 404, { error: "Asset not found" });
        return;
      }

      const body = await parseBody(req);
      const current = db.assets[idx];
      const cleaned = validateAsset({
        ...current,
        ...body,
      });
      if (typeof cleaned === "string") {
        sendJson(res, 400, { error: cleaned });
        return;
      }

      const nextPhoto = await normalizePhotoValue(cleaned.photo, "assets");
      const normalizedPhotos = await normalizePhotoList(cleaned.photos, "assets", 5);
      if (nextPhoto && !normalizedPhotos.includes(nextPhoto)) {
        normalizedPhotos.unshift(nextPhoto);
      }
      const nextPhotos = normalizedPhotos.slice(0, 5);
      const mainPhoto = nextPhotos[0] || nextPhoto || "";
      const nextHistory =
        body.maintenanceHistory === undefined
          ? current.maintenanceHistory
          : await normalizeHistoryEntries(body.maintenanceHistory, "maintenance");
      const nextTransferHistory =
        body.transferHistory === undefined
          ? current.transferHistory
          : normalizeTransferEntries(body.transferHistory);
      const nextCustodyHistory =
        body.custodyHistory === undefined
          ? current.custodyHistory
          : normalizeCustodyEntries(body.custodyHistory);
      const previousAssignedTo = toText(current.assignedTo);
      const incomingAssignedTo = toText(cleaned.assignedTo);
      const assignmentChanged = previousAssignedTo !== incomingAssignedTo;
      let finalCustodyHistory = Array.isArray(nextCustodyHistory) ? nextCustodyHistory : [];
      if (assignmentChanged && body.custodyHistory === undefined) {
        finalCustodyHistory = [
          {
            id: Date.now(),
            date: new Date().toISOString(),
            action: incomingAssignedTo ? "ASSIGN" : "UNASSIGN",
            fromCampus: toText(current.campus),
            fromLocation: toText(current.location),
            toCampus: toText(cleaned.campus),
            toLocation: toText(cleaned.location),
            fromUser: previousAssignedTo,
            toUser: incomingAssignedTo,
            responsibilityAck: false,
            by: "",
            note: "Assignment changed from asset edit",
          },
          ...finalCustodyHistory,
        ];
      }
      const nextCustodyStatus = normalizeCustodyStatus(
        cleaned.custodyStatus || (incomingAssignedTo ? "ASSIGNED" : "IN_STOCK")
      );
      const currentStatus = toText(current.status) || "Active";
      const nextStatus = toText(cleaned.status) || "Active";
      const statusChanged = currentStatus !== nextStatus;
      const statusChangeReason = toText(body.statusChangeReason || body.reason);
      const statusChangeBy = toText(body.statusChangeBy || body.by);
      if (statusChanged) {
        if (!statusChangeReason) {
          sendJson(res, 400, { error: "Reason is required when changing status" });
          return;
        }
        if (!statusChangeBy) {
          sendJson(res, 400, { error: "Verified By is required when changing status" });
          return;
        }
      }
      const currentStatusHistory = Array.isArray(current.statusHistory) ? current.statusHistory : [];
      const nextStatusHistory = statusChanged
        ? [
            {
              id: Date.now(),
              date: new Date().toISOString(),
              fromStatus: currentStatus,
              toStatus: nextStatus,
              reason: statusChangeReason,
              by: statusChangeBy,
            },
            ...currentStatusHistory,
          ]
        : currentStatusHistory;
      const photoChanged = toText(current.photo) !== toText(mainPhoto);
      db.assets[idx] = {
        ...current,
        ...cleaned,
        photo: mainPhoto,
        photos: nextPhotos,
        maintenanceHistory: nextHistory,
        transferHistory: nextTransferHistory,
        statusHistory: nextStatusHistory,
        custodyHistory: finalCustodyHistory,
        custodyStatus: nextCustodyStatus,
        name: current.assetId,
      };
      appendAuditLog(
        db,
        admin,
        "UPDATE",
        "asset",
        db.assets[idx].assetId || String(id),
        `${db.assets[idx].campus} | ${db.assets[idx].location}${photoChanged ? " | photo updated" : ""}`
      );
      ensureMaintenanceScheduleNotifications(db);
      await writeDb(db);
      sendJson(res, 200, { asset: db.assets[idx] });
      return;
    }

    if (req.method === "POST" && url.pathname.startsWith("/api/assets/") && url.pathname.endsWith("/history")) {
      const user = getAuthUser(req);
      if (!user) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }
      if (!canRecordMaintenance(user)) {
        sendJson(res, 403, { error: "Maintenance record permission required" });
        return;
      }
      const id = Number(url.pathname.replace("/api/assets/", "").replace("/history", ""));
      if (!id) {
        sendJson(res, 400, { error: "Invalid ID" });
        return;
      }

      const body = await parseBody(req);
      const date = toText(body.date);
      const type = toText(body.type);
      const note = toText(body.note);
      const cost = toText(body.cost);
      const by = toText(body.by);
      const photo = await normalizePhotoValue(body.photo, "maintenance");
      const completion = normalizeCompletion(body.completion);
      const condition = toText(body.condition);
      if (!date || !type || !note) {
        sendJson(res, 400, { error: "date, type, note are required" });
        return;
      }

      const db = await readDb();
      const idx = db.assets.findIndex((a) => a.id === id);
      if (idx === -1) {
        sendJson(res, 404, { error: "Asset not found" });
        return;
      }
      if (!userCanAccessCampus(user, toText(db.assets[idx].campus))) {
        sendJson(res, 403, { error: "Campus access denied" });
        return;
      }

      const entry = {
        id: Date.now(),
        date,
        type,
        completion,
        condition,
        note,
        cost,
        by,
        photo,
      };
      db.assets[idx].maintenanceHistory = Array.isArray(db.assets[idx].maintenanceHistory)
        ? [entry, ...db.assets[idx].maintenanceHistory]
        : [entry];
      if (syncAssetStatusFromMaintenance(db.assets[idx])) {
        appendAuditLog(
          db,
          user,
          "UPDATE_STATUS",
          "asset",
          db.assets[idx].assetId || String(id),
          "Defective (auto from replacement)"
        );
      }
      appendAuditLog(
        db,
        user,
        "CREATE",
        "maintenance_record",
        `${db.assets[idx].assetId || id}#${entry.id}`,
        `${entry.type} | ${entry.completion || "Not Yet"}`
      );
      addMaintenanceDoneNotification(db, db.assets[idx], entry);
      ensureMaintenanceScheduleNotifications(db);
      await writeDb(db);
      sendJson(res, 201, { asset: db.assets[idx], entry });
      return;
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/assets/")) {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const id = Number(url.pathname.replace("/api/assets/", ""));
      if (!id) {
        sendJson(res, 400, { error: "Invalid ID" });
        return;
      }

      const db = await readDb();
      const target = db.assets.find((a) => a.id === id);
      const before = db.assets.length;
      db.assets = db.assets.filter((a) => a.id !== id);

      if (db.assets.length === before) {
        sendJson(res, 404, { error: "Asset not found" });
        return;
      }

      appendAuditLog(
        db,
        admin,
        "DELETE",
        "asset",
        target?.assetId || String(id),
        target ? `${target.campus} | ${target.location}` : ""
      );
      purgeNotificationsForAsset(db, id);
      ensureMaintenanceScheduleNotifications(db);
      await writeDb(db);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/tickets") {
      const user = getAuthUser(req);
      if (!user) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }
      const campus = normalizeCampusInput(url.searchParams.get("campus"));
      const status = toText(url.searchParams.get("status"));

      const db = await readDb();
      let tickets = filterByCampusPermission(db.tickets, user, (t) => t.campus);
      if (campus && !userCanAccessCampus(user, campus)) {
        sendJson(res, 200, { tickets: [] });
        return;
      }
      if (campus) tickets = tickets.filter((t) => t.campus === campus);
      if (status) tickets = tickets.filter((t) => t.status === status);
      sendJson(res, 200, { tickets });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/tickets") {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const body = await parseBody(req);
      const cleaned = validateTicket(body);
      if (typeof cleaned === "string") {
        sendJson(res, 400, { error: cleaned });
        return;
      }

      const db = await readDb();
      const ticket = {
        id: Date.now(),
        ticketNo: nextTicketCode(db.tickets, cleaned.campus),
        created: new Date().toISOString(),
        ...cleaned,
      };

      db.tickets.unshift(ticket);
      appendAuditLog(db, admin, "CREATE", "ticket", ticket.ticketNo, `${ticket.campus} | ${ticket.title}`);
      await writeDb(db);
      sendJson(res, 201, { ticket });
      return;
    }

    if (req.method === "PATCH" && url.pathname.startsWith("/api/tickets/") && url.pathname.endsWith("/status")) {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const id = Number(url.pathname.replace("/api/tickets/", "").replace("/status", ""));
      if (!id) {
        sendJson(res, 400, { error: "Invalid ID" });
        return;
      }

      const body = await parseBody(req);
      const status = toText(body.status);
      if (!status) {
        sendJson(res, 400, { error: "Status is required" });
        return;
      }

      const db = await readDb();
      const idx = db.tickets.findIndex((t) => t.id === id);
      if (idx === -1) {
        sendJson(res, 404, { error: "Ticket not found" });
        return;
      }

      db.tickets[idx].status = status;
      appendAuditLog(db, admin, "UPDATE_STATUS", "ticket", db.tickets[idx].ticketNo || String(id), status);
      await writeDb(db);
      sendJson(res, 200, { ticket: db.tickets[idx] });
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (err) {
    if (err && typeof err === "object" && Number(err.statusCode) >= 400) {
      sendJson(res, Number(err.statusCode), {
        error: err.message || "Request error",
      });
      return;
    }
    sendJson(res, 500, {
      error: err instanceof Error ? err.message : "Server error",
    });
  }
});

async function startServer() {
  try {
    await restoreSessionsFromDb();
  } catch (err) {
    console.warn("Could not restore auth sessions from database:", err instanceof Error ? err.message : err);
  }

  if (AUTO_BACKUP_ENABLED) {
    // Run once at startup, then on interval.
    await maybeRunAutoBackup();
    autoBackupTimer = setInterval(() => {
      void maybeRunAutoBackup();
    }, AUTO_BACKUP_INTERVAL_MS);
  }

  server.listen(PORT, HOST, () => {
    const bindHost = HOST === "0.0.0.0" ? "localhost" : HOST;
    console.log(`API running at http://${bindHost}:${PORT}`);
    console.log(`Storage paths: DATA_ROOT=${DATA_ROOT} SQLITE_PATH=${SQLITE_PATH} DB_PATH=${DB_PATH}`);
    console.log(`Uploads=${UPLOADS_DIR} Backups=${BACKUPS_DIR}`);
    if (AUTO_BACKUP_ENABLED) {
      console.log(
        `Auto backup enabled: every ${AUTO_BACKUP_INTERVAL_HOURS}h, retention ${AUTO_BACKUP_RETENTION_DAYS} days`
      );
    } else {
      console.log("Auto backup disabled");
    }
  });
}

void startServer();
