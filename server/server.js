const http = require("http");
const https = require("https");
const fsSync = require("fs");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");
const { URL } = require("url");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

function loadServerEnvFile() {
  const candidates = [
    path.join(__dirname, "..", ".env"),
    path.join(__dirname, ".env"),
  ];
  for (const filePath of candidates) {
    if (!fsSync.existsSync(filePath)) continue;
    try {
      const raw = fsSync.readFileSync(filePath, "utf8");
      const lines = raw.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = String(line || "").trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex <= 0) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        if (!key || process.env[key] !== undefined) continue;
        let value = trimmed.slice(eqIndex + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
      break;
    } catch (err) {
      console.warn(`Could not load env file ${filePath}:`, err instanceof Error ? err.message : err);
    }
  }
}

loadServerEnvFile();

let DatabaseSync;
try {
  ({ DatabaseSync } = require("node:sqlite"));
} catch {
  DatabaseSync = null;
}

let Tesseract;
try {
  Tesseract = require("tesseract.js");
} catch {
  Tesseract = null;
}

function readPackageVersion() {
  try {
    const pkgPath = path.join(__dirname, "..", "package.json");
    const raw = fsSync.readFileSync(pkgPath, "utf8");
    const parsed = JSON.parse(raw);
    const version = String(parsed.version || "").trim();
    return version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const PACKAGE_VERSION = readPackageVersion();
const DEPLOY_COMMIT = String(
  process.env.RENDER_GIT_COMMIT ||
  process.env.GITHUB_SHA ||
  process.env.COMMIT_SHA ||
  process.env.SOURCE_VERSION ||
  ""
).trim();
const SHORT_DEPLOY_COMMIT = DEPLOY_COMMIT ? DEPLOY_COMMIT.slice(0, 7) : "";
const APP_BUILD_VERSION = SHORT_DEPLOY_COMMIT
  ? `v${PACKAGE_VERSION}-${SHORT_DEPLOY_COMMIT}`
  : `v${PACKAGE_VERSION}`;

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
const UTILITY_INVOICE_OCR_SCRIPT = path.join(__dirname, "scripts", "utility_invoice_ocr.swift");
const DB_MIRROR_PATH = process.env.DB_MIRROR_PATH ? resolveStoragePath(process.env.DB_MIRROR_PATH, "db-mirror.json") : "";
const BACKUP_MIRROR_DIR = process.env.BACKUP_MIRROR_DIR ? resolveStoragePath(process.env.BACKUP_MIRROR_DIR, "backup-mirror") : "";
const BACKUP_COMPRESS = String(process.env.BACKUP_COMPRESS || "true").toLowerCase() !== "false";
const AUTO_BACKUP_ENABLED = String(process.env.AUTO_BACKUP_ENABLED || "true").toLowerCase() !== "false";
const AUTO_BACKUP_INTERVAL_HOURS = Math.max(1, Number(process.env.AUTO_BACKUP_INTERVAL_HOURS || 24));
const AUTO_BACKUP_INTERVAL_MS = AUTO_BACKUP_INTERVAL_HOURS * 60 * 60 * 1000;
const AUTO_BACKUP_RETENTION_DAYS = Math.max(1, Number(process.env.AUTO_BACKUP_RETENTION_DAYS || 30));
const AUTO_BACKUP_RETENTION_MS = AUTO_BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const MAINTENANCE_ALERT_SWEEP_INTERVAL_MINUTES = Math.max(
  15,
  Number(process.env.MAINTENANCE_ALERT_SWEEP_INTERVAL_MINUTES || 60)
);
const MAINTENANCE_ALERT_SWEEP_INTERVAL_MS = MAINTENANCE_ALERT_SWEEP_INTERVAL_MINUTES * 60 * 1000;
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
const PRINTER_LOGIN_CAMPUS1_USERNAME = String(process.env.PRINTER_LOGIN_CAMPUS1_USERNAME || "").trim();
const PRINTER_LOGIN_CAMPUS1_PASSWORD = String(process.env.PRINTER_LOGIN_CAMPUS1_PASSWORD || "").trim();
const PRINTER_LOGIN_CAMPUS21_USERNAME = String(process.env.PRINTER_LOGIN_CAMPUS21_USERNAME || "").trim();
const PRINTER_LOGIN_CAMPUS21_PASSWORD = String(process.env.PRINTER_LOGIN_CAMPUS21_PASSWORD || "").trim();
const PRINTER_LOGIN_CAMPUS22_USERNAME = String(process.env.PRINTER_LOGIN_CAMPUS22_USERNAME || "").trim();
const PRINTER_LOGIN_CAMPUS22_PASSWORD = String(process.env.PRINTER_LOGIN_CAMPUS22_PASSWORD || "").trim();
const PRINTER_LOGIN_CAMPUS3_USERNAME = String(process.env.PRINTER_LOGIN_CAMPUS3_USERNAME || "").trim();
const PRINTER_LOGIN_CAMPUS3_PASSWORD = String(process.env.PRINTER_LOGIN_CAMPUS3_PASSWORD || "").trim();
const TELEGRAM_BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
const TELEGRAM_MAINTENANCE_BOT_TOKEN = String(
  process.env.TELEGRAM_MAINTENANCE_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || ""
).trim();
const TELEGRAM_CHAT_ID = String(process.env.TELEGRAM_CHAT_ID || "").trim();
const TELEGRAM_MAINTENANCE_CHAT_ID = String(process.env.TELEGRAM_MAINTENANCE_CHAT_ID || "").trim();
const TELEGRAM_DISCOVER_CHAT_IDS =
  String(process.env.TELEGRAM_DISCOVER_CHAT_IDS || "true").toLowerCase() !== "false";
const TELEGRAM_CHAT_IDS = Array.from(
  new Set(
    [
      TELEGRAM_CHAT_ID,
      ...String(process.env.TELEGRAM_CHAT_IDS || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ].filter(Boolean)
  )
);
const TELEGRAM_MAINTENANCE_CHAT_IDS = Array.from(
  new Set(
    [
      TELEGRAM_MAINTENANCE_CHAT_ID,
      ...String(process.env.TELEGRAM_MAINTENANCE_CHAT_IDS || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ].filter(Boolean)
  )
);
let telegramLastSendReport = {
  at: "",
  ok: false,
  successCount: 0,
  targetCount: 0,
  targets: [],
  errors: [],
};
let telegramMaintenanceLastSendReport = {
  at: "",
  ok: false,
  successCount: 0,
  targetCount: 0,
  targets: [],
  errors: [],
};
let telegramLastDiscoveredChats = [];
let telegramMaintenanceLastDiscoveredChats = [];
let maintenanceAlertSweepTimer = null;
let maintenanceAlertSweepRunning = false;
const PUBLIC_APP_URL = String(
  process.env.PUBLIC_APP_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  ""
).trim().replace(/\/+$/, "");
const BUILD_DIR = path.join(__dirname, "..", "build");
const INDEX_FILE = path.join(BUILD_DIR, "index.html");
const CAMPUS_MAP = {
  C1: "Samdach Pan Campus",
  "C2.1": "Chaktomuk Campus",
  "C2.2": "Chaktomuk Campus (C2.2)",
  C3: "Boeung Snor Campus",
  C4: "Veng Sreng Campus",
};
const CAMPUS_KHMER_MAP = {
  "Samdach Pan Campus": "សាខាសម្ដេចប៉ាន",
  "Chaktomuk Campus": "សាខាចតុមុខ",
  "Chaktomuk Campus (C2.2)": "សាខាចតុមុខ (C2.2)",
  "Boeung Snor Campus": "សាខាបឹងស្នោរ",
  "Veng Sreng Campus": "សាខាវេងស្រេង",
};
const CAMPUS_NAMES = Object.values(CAMPUS_MAP);
const TYPE_CODES = {
  IT: [
    "PC",
    "LAP",
    "TAB",
    "MON",
    "KBD",
    "MSE",
    "DCM",
    "BAT",
    "CHB",
    "MCD",
    "BAG",
    "SLP",
    "PBG",
    "ADP",
    "RMT",
    "HDC",
    "UWF",
    "WBC",
    "TV",
    "SPK",
    "PRN",
    "SW",
    "AP",
    "CAM",
    "FGP",
  ],
  SAFETY: ["FE", "SD", "EL", "FB", "FCP"],
  FACILITY: ["AC", "WDP", "WTK", "FPN", "RPN", "TBL", "CHR", "PNO"],
  FURNITURE: ["TBL", "CHR", "DSK", "CAB", "NBD"],
};
const TYPE_LABELS = {
  PC: "Computer",
  LAP: "Laptop",
  TAB: "iPad / Tablet",
  MON: "Monitor",
  KBD: "Keyboard",
  MSE: "Mouse",
  DCM: "Digital Camera",
  BAT: "Camera Battery",
  CHB: "Battery Charger",
  MCD: "Memory Card",
  BAG: "Camera Bag",
  SLP: "Slide Projector",
  PBG: "Projector Bag",
  ADP: "Power Adapter",
  RMT: "Remote Control",
  HDC: "HDMI Cable",
  UWF: "USB WiFi Adapter",
  WBC: "Webcam",
  TV: "TV",
  SPK: "Speaker",
  PRN: "Printer",
  SW: "Switch",
  AP: "Access Point",
  CAM: "CCTV Camera",
  FGP: "Finger Print",
  FE: "Fire Extinguisher",
  SD: "Smoke Detector",
  EL: "Emergency Light",
  FB: "Fire Bell",
  FCP: "Fire Control Panel",
  AC: "Air Conditioner",
  WDP: "Water Dispenser",
  WTK: "Walkie Talkie",
  FPN: "Front Panel",
  RPN: "Rear Panel",
  TBL: "Table",
  CHR: "Chair",
  DSK: "Deskset",
  CAB: "Cabinet",
  PNO: "Piano",
};
const CATEGORY_CODE = {
  IT: "COM",
  SAFETY: "EE",
  FACILITY: "FFE",
  FURNITURE: "FFE",
};
const SHARED_LOCATION_KEYWORDS = [
  "admin office",
  "teacher office",
  "it stock",
  "itc room",
  "computer lab",
  "compuer lab",
  "compuer lap",
  "stock room",
  "storage room",
  "store room",
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
if (TELEGRAM_ALERT_ENABLED && (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_IDS.length)) {
  console.warn("[ALERT] Telegram enabled but TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID(S) is missing.");
}
if (TELEGRAM_ALERT_ENABLED && !TELEGRAM_MAINTENANCE_BOT_TOKEN) {
  console.warn("[ALERT] Maintenance Telegram bot token is missing. Maintenance reminders will fall back to the default bot token.");
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

function getDevBootstrapPasswordForUsername(username) {
  if (IS_PROD) return "";
  const normalized = toText(username).toLowerCase();
  if (normalized === "admin") return DEFAULT_ADMIN_PASSWORD;
  if (normalized === "viewer") return DEFAULT_VIEWER_PASSWORD;
  return "";
}

function shouldAllowDevBootstrapLogin(user, password) {
  if (IS_PROD || !user || typeof user !== "object") return false;
  const bootstrapPassword = getDevBootstrapPasswordForUsername(user.username);
  if (!bootstrapPassword) return false;
  return toText(password) === bootstrapPassword;
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
    } else {
      try {
        const raw = fsSync.readFileSync(DB_PATH, "utf8");
        const normalized = normalizeImportedDb(JSON.parse(raw));
        fsSync.writeFileSync(DB_PATH, JSON.stringify(normalized, null, 2), "utf8");
      } catch {
        const initial = normalizeImportedDb({});
        fsSync.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), "utf8");
      }
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

  // Persist normalized/migrated data shape (including Asset ID format migration).
  replaceSqliteDataSync(sqliteCurrent);

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

async function sendStaticFile(req, res, filePath, cacheableOverride = null) {
  const raw = await fs.readFile(filePath);
  const isCacheableAsset =
    typeof cacheableOverride === "boolean"
      ? cacheableOverride
      : filePath.includes(`${path.sep}static${path.sep}`);
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
    return sendStaticFile(req, res, uploadResolved, true);
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
    await writeJsonAtomic(DB_PATH, normalized);
    await mirrorDbSnapshot(normalized);
    return;
  }
  replaceSqliteDataSync(normalized);
  try {
    await writeJsonAtomic(DB_PATH, normalized);
    await mirrorDbSnapshot(normalized);
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
  await ensureOptionalBackupMirrorDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = `backup-${stamp}.json`;
  const filePath = path.join(BACKUPS_DIR, name);
  const normalizedDb = normalizeImportedDb(db);
  const jsonText = JSON.stringify(normalizedDb, null, 2);
  const jsonBuffer = Buffer.from(jsonText, "utf8");
  await writeBufferAtomic(filePath, jsonBuffer);
  if (BACKUP_COMPRESS) {
    const gzBuffer = zlib.gzipSync(jsonBuffer, { level: 9 });
    await writeBufferAtomic(`${filePath}.gz`, gzBuffer);
    if (BACKUP_MIRROR_DIR) {
      await writeBufferAtomic(path.join(BACKUP_MIRROR_DIR, `${name}.gz`), gzBuffer);
    }
  }
  if (BACKUP_MIRROR_DIR) {
    await writeBufferAtomic(path.join(BACKUP_MIRROR_DIR, name), jsonBuffer);
  }
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
      if (!entry.name.startsWith("backup-")) return;
      if (!entry.name.endsWith(".json") && !entry.name.endsWith(".json.gz")) return;
      const fullPath = path.join(BACKUPS_DIR, entry.name);
      const stat = await fs.stat(fullPath).catch(() => null);
      if (!stat) return;
      if (now - stat.mtimeMs > AUTO_BACKUP_RETENTION_MS) {
        await fs.rm(fullPath, { force: true });
      }
    })
  );
  if (!BACKUP_MIRROR_DIR) return;
  const mirrorEntries = await fs.readdir(BACKUP_MIRROR_DIR, { withFileTypes: true }).catch(() => []);
  await Promise.all(
    mirrorEntries.map(async (entry) => {
      if (!entry.isFile()) return;
      if (!entry.name.startsWith("backup-")) return;
      if (!entry.name.endsWith(".json") && !entry.name.endsWith(".json.gz")) return;
      const fullPath = path.join(BACKUP_MIRROR_DIR, entry.name);
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

function isPathInside(parentPath, childPath) {
  const parent = path.resolve(parentPath);
  const child = path.resolve(childPath);
  return child === parent || child.startsWith(parent + path.sep);
}

async function writeBufferAtomic(filePath, content) {
  const dirPath = path.dirname(filePath);
  await fs.mkdir(dirPath, { recursive: true });
  const tempPath = path.join(
    dirPath,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString("hex")}.tmp`
  );
  await fs.writeFile(tempPath, content);
  await fs.rename(tempPath, filePath);
}

async function writeJsonAtomic(filePath, value) {
  await writeBufferAtomic(filePath, JSON.stringify(value, null, 2));
}

async function mirrorDbSnapshot(normalizedDb) {
  if (!DB_MIRROR_PATH) return;
  try {
    await writeJsonAtomic(DB_MIRROR_PATH, normalizedDb);
  } catch (err) {
    console.warn("Could not write DB mirror:", err instanceof Error ? err.message : err);
  }
}

async function ensureOptionalBackupMirrorDir() {
  if (!BACKUP_MIRROR_DIR) return;
  await fs.mkdir(BACKUP_MIRROR_DIR, { recursive: true });
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
      itemGroup: toUpper(row.itemGroup) || "GENERAL",
      compatibleAssetTypes: Array.isArray(row.compatibleAssetTypes)
        ? row.compatibleAssetTypes.map((value) => toUpper(value)).filter(Boolean)
        : [],
      compatibleModels: Array.isArray(row.compatibleModels)
        ? row.compatibleModels.map((value) => toText(value)).filter(Boolean)
        : [],
      defaultUnitCost: Number(row.defaultUnitCost || 0),
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
      approvalStatus: toUpper(row.approvalStatus),
      approvalRequestedBy: toText(row.approvalRequestedBy),
      approvalRequestedUser: toText(row.approvalRequestedUser),
      approvalRequestedAt: toText(row.approvalRequestedAt),
      approvalDecisionBy: toText(row.approvalDecisionBy),
      approvalDecisionAt: toText(row.approvalDecisionAt),
      approvalDecisionNote: toText(row.approvalDecisionNote),
      txnSource: toUpper(row.txnSource) || "GENERAL",
      referenceAssetId: toText(row.referenceAssetId),
      referenceAssetDbId: Number(row.referenceAssetDbId) || 0,
      supplier: toText(row.supplier),
      invoiceNo: toText(row.invoiceNo),
      unitCost: Number(row.unitCost || 0),
      totalCost: Number(row.totalCost || 0),
      telegramMessageRefs: normalizeTelegramMessageRefs(row.telegramMessageRefs),
    }));
}

function normalizeTickets(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      id: Number(row.id) || Date.now(),
      ticketNo: toText(row.ticketNo),
      campus: toText(row.campus),
      category: toText(row.category),
      assetId: toText(row.assetId),
      assetDbId: Number(row.assetDbId) || 0,
      assetName: toText(row.assetName),
      assetLocation: toText(row.assetLocation),
      title: toText(row.title),
      description: toText(row.description),
      requestedBy: toText(row.requestedBy),
      requesterContact: toText(row.requesterContact),
      priority: toText(row.priority) || "Normal",
      status: toText(row.status) || "Open",
      assignedTo: toText(row.assignedTo),
      photo: toText(row.photo),
      created: toText(row.created) || new Date().toISOString(),
      updatedAt: toText(row.updatedAt) || toText(row.created) || new Date().toISOString(),
      completedAt: toText(row.completedAt),
      completedBy: toText(row.completedBy),
      maintenanceEntryId: Number(row.maintenanceEntryId) || 0,
      maintenanceAssetId: Number(row.maintenanceAssetId) || 0,
      maintenanceSummary: toText(row.maintenanceSummary),
      requestSource: toText(row.requestSource) || "manual",
      telegramMessageRefs: normalizeTelegramMessageRefs(row.telegramMessageRefs),
    }));
}

function normalizeInventoryApprovalRoutingMap(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out = {};
  for (const [rawRequester, rawApprovers] of Object.entries(input)) {
    const requester = toText(rawRequester).toLowerCase();
    if (!requester) continue;
    const campus =
      rawApprovers && typeof rawApprovers === "object" && !Array.isArray(rawApprovers)
        ? normalizeCampusInput(toText(rawApprovers.campus))
        : "";
    const approvers =
      rawApprovers && typeof rawApprovers === "object" && !Array.isArray(rawApprovers)
        ? (Array.isArray(rawApprovers.approvers) ? rawApprovers.approvers : [])
        : Array.isArray(rawApprovers)
          ? rawApprovers
          : rawApprovers && typeof rawApprovers === "string"
            ? [rawApprovers]
            : [];
    const normalizedApprovers = Array.from(
      new Set(
        approvers
          .map((value) => toText(value).toLowerCase())
          .filter(Boolean)
      )
    );
    out[requester] = {
      campus,
      approvers: normalizedApprovers,
    };
  }
  return out;
}

function normalizeTelegramChatIds(input) {
  const raw = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(",")
      : [];
  return Array.from(
    new Set(
      raw
        .map((value) => toText(value).trim())
        .filter(Boolean)
    )
  );
}

const INVENTORY_CATEGORY_SET = new Set(["SUPPLY", "CLEAN_TOOL", "MAINT_TOOL"]);
const INVENTORY_TXN_TYPE_SET = new Set(["IN", "OUT", "SET", "BORROW_OUT", "BORROW_IN", "BORROW_CONSUME"]);

function normalizeInventoryCategory(value) {
  const raw = toUpper(value);
  if (!raw) return "";
  return INVENTORY_CATEGORY_SET.has(raw) ? raw : "";
}

function normalizeInventoryTxnType(value) {
  const raw = toUpper(value);
  if (!raw) return "";
  return INVENTORY_TXN_TYPE_SET.has(raw) ? raw : "";
}

function isPrinterAsset(asset) {
  return toUpper(asset && asset.type) === "PRN";
}

function isTonerInventoryItem(item) {
  return toUpper(item && item.itemGroup) === "TONER";
}

function isInventoryTxnInType(type) {
  return type === "IN" || type === "BORROW_IN";
}

function isInventoryTxnOutType(type) {
  return type === "OUT" || type === "BORROW_OUT" || type === "BORROW_CONSUME";
}
function isInventoryTxnSetType(type) {
  return type === "SET";
}

function isInventoryUsageOutType(type) {
  return type === "OUT" || type === "BORROW_CONSUME";
}

function inventoryCampusGroupCode(campusName) {
  const campus = normalizeCampusInput(campusName);
  const code = campusCode(campus);
  if (code === "C2.1" || code === "C2.2") return "C2";
  return code || "CX";
}

function getSettingsObject(db) {
  if (!db.settings || typeof db.settings !== "object") db.settings = {};
  return db.settings;
}

function getInventoryState(db) {
  const settings = getSettingsObject(db);
  const items = normalizeInventoryItems(settings.inventoryItems);
  const txns = normalizeInventoryTxns(settings.inventoryTxns);
  return { settings, items, txns };
}

function setInventoryState(db, settings, items, txns) {
  db.settings = {
    ...settings,
    inventoryItems: normalizeInventoryItems(items),
    inventoryTxns: normalizeInventoryTxns(txns),
  };
}

function calcInventoryCurrentStock(item, txns, excludeTxnId = 0) {
  const opening = Math.max(0, Number(item && item.openingQty) || 0);
  const rows = (Array.isArray(txns) ? txns : [])
    .filter((row) => Number(row && row.itemId) === Number(item && item.id))
    .filter((row) => !(excludeTxnId && Number(row && row.id) === Number(excludeTxnId)))
    .slice()
    .sort((a, b) => {
      const aDate = toText(a && a.date);
      const bDate = toText(b && b.date);
      if (aDate !== bDate) return aDate < bDate ? -1 : 1;
      return (Number(a && a.id) || 0) - (Number(b && b.id) || 0);
    });
  let stock = opening;
  for (const row of rows) {
    const type = normalizeInventoryTxnType(row && row.type);
    const approvalStatus = toUpper(row && row.approvalStatus);
    if (isInventoryTxnOutType(type) && (approvalStatus === "PENDING" || approvalStatus === "REJECTED")) {
      continue;
    }
    const qty = Math.max(0, Number(row && row.qty) || 0);
    if (isInventoryTxnSetType(type)) {
      stock = qty;
      continue;
    }
    if (isInventoryTxnInType(type)) stock += qty;
    if (isInventoryTxnOutType(type)) stock -= qty;
  }
  return stock;
}

const INVENTORY_OUT_DUPLICATE_WINDOW_MS = 15 * 1000;

function isDuplicateInventoryOutTxn(existingRow, incomingRow, nowMs = Date.now()) {
  const existingId = Number(existingRow && existingRow.id) || 0;
  if (!existingId) return false;
  if (Math.abs(nowMs - existingId) > INVENTORY_OUT_DUPLICATE_WINDOW_MS) return false;
  return (
    Number(existingRow && existingRow.itemId) === Number(incomingRow && incomingRow.itemId) &&
    toText(existingRow && existingRow.date) === toText(incomingRow && incomingRow.date) &&
    normalizeInventoryTxnType(existingRow && existingRow.type) === normalizeInventoryTxnType(incomingRow && incomingRow.type) &&
    Math.max(0, Number(existingRow && existingRow.qty) || 0) === Math.max(0, Number(incomingRow && incomingRow.qty) || 0) &&
    toText(existingRow && existingRow.by).trim().toLowerCase() === toText(incomingRow && incomingRow.by).trim().toLowerCase() &&
    toText(existingRow && existingRow.note).trim() === toText(incomingRow && incomingRow.note).trim() &&
    toText(existingRow && existingRow.photo).trim() === toText(incomingRow && incomingRow.photo).trim()
  );
}

function normalizeVaultAccounts(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      id: Number(row.id) || Date.now() + Math.floor(Math.random() * 1000),
      systemName: toText(row.systemName),
      model: toText(row.model),
      host: toText(row.host),
      loginUrl: toText(row.loginUrl),
      accountName: toText(row.accountName),
      username: toText(row.username),
      password: toText(row.password),
      owner: toText(row.owner),
      role: toText(row.role),
      status: toText(row.status) || "Active",
      reviewDate: toText(row.reviewDate),
      lastUpdated: toText(row.lastUpdated),
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

function normalizePoolCleaningSchedules(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      id: Number(row.id) || Date.now() + Math.floor(Math.random() * 1000),
      pool: toText(row.pool) || "Main Pool",
      date: toText(row.date),
      shift: toText(row.shift),
      task: toText(row.task),
      assignedTo: toText(row.assignedTo),
      status: toUpper(row.status) === "DONE" ? "Done" : "Pending",
      note: toText(row.note),
      created: toText(row.created) || new Date().toISOString(),
    }));
}

function normalizePoolEquipmentChecks(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      id: Number(row.id) || Date.now() + Math.floor(Math.random() * 1000),
      pool: toText(row.pool) || "Main Pool",
      date: toText(row.date),
      category: toText(row.category) || "Cleaning",
      item: toText(row.item),
      condition: toText(row.condition) || "Good",
      qty: Number(row.qty || 0) || 0,
      unit: toText(row.unit),
      note: toText(row.note),
      created: toText(row.created) || new Date().toISOString(),
    }));
}

function normalizePoolChemicalRecords(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      id: Number(row.id) || Date.now() + Math.floor(Math.random() * 1000),
      pool: toText(row.pool) || "Main Pool",
      datetime: toText(row.datetime),
      chlorineFree: Number(row.chlorineFree || 0) || 0,
      chlorineTotal: Number(row.chlorineTotal || 0) || 0,
      ph: Number(row.ph || 0) || 0,
      alkalinity: Number(row.alkalinity || 0) || 0,
      calciumHardness: Number(row.calciumHardness || 0) || 0,
      cyanuricAcid: Number(row.cyanuricAcid || 0) || 0,
      temperature: Number(row.temperature || 0) || 0,
      operator: toText(row.operator),
      note: toText(row.note),
      created: toText(row.created) || new Date().toISOString(),
    }));
}

function normalizePoolOperationRecords(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      id: Number(row.id) || Date.now() + Math.floor(Math.random() * 1000),
      pool: toText(row.pool) || "Main Pool",
      datetime: toText(row.datetime),
      pumpStatus: toUpper(row.pumpStatus) === "OFF" ? "Off" : "On",
      timerMode: toText(row.timerMode),
      filterPressure: Number(row.filterPressure || 0) || 0,
      backwashDone: Boolean(row.backwashDone),
      operator: toText(row.operator),
      note: toText(row.note),
      created: toText(row.created) || new Date().toISOString(),
    }));
}

function normalizePoolComplaints(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      id: Number(row.id) || Date.now() + Math.floor(Math.random() * 1000),
      pool: toText(row.pool) || "Main Pool",
      date: toText(row.date),
      teacher: toText(row.teacher),
      entryType: toUpper(row.entryType) === "COMMENT" ? "Comment" : "Complaint",
      condition: toText(row.condition),
      severity: toText(row.severity) || "Medium",
      status: toText(row.status) || "Open",
      photo: toText(row.photo),
      note: toText(row.note),
      created: toText(row.created) || new Date().toISOString(),
    }));
}

function normalizeUtilityMeters(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      id: Number(row.id) || Date.now() + Math.floor(Math.random() * 1000),
      meterType: toUpper(row.meterType) === "WATER" ? "Water" : "Electricity",
      meterCode: toText(row.meterCode),
      meterName: toText(row.meterName),
      campus: normalizeCampusInput(row.campus) || CAMPUS_LIST[0],
      building: toText(row.building),
      location: toText(row.location),
      provider: toText(row.provider),
      serialNumber: toText(row.serialNumber),
      unit: toText(row.unit) || (toUpper(row.meterType) === "WATER" ? "m3" : "kWh"),
      installedDate: toText(row.installedDate),
      openingReading: Math.max(0, Number(row.openingReading) || 0),
      status: toUpper(row.status) === "INACTIVE" ? "Inactive" : "Active",
      photo: toText(row.photo),
      notes: toText(row.notes),
      created: toText(row.created) || new Date().toISOString(),
    }))
    .filter((row) => row.meterCode && row.meterName);
}

function normalizeUtilityReadings(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const legacyMeterType = toUpper(row.meterType) === "WATER" ? "Water" : "Electricity";
      const utilityType =
        toUpper(row.utilityType) === "PPWS"
          ? "PPWS"
          : toUpper(row.utilityType) === "EDC"
            ? "EDC"
            : legacyMeterType === "Water"
              ? "PPWS"
              : "EDC";
      const previousReading = Math.max(0, Number(row.previousReading) || 0);
      const currentReading = Math.max(previousReading, Number(row.currentReading) || 0);
      const invoiceDate = toText(row.invoiceDate) || toText(row.readingDate) || toText(row.billingMonth);
      const billingMonth = toText(row.billingMonth) || (invoiceDate ? invoiceDate.slice(0, 7) : "");
      const unit = toText(row.unit) || (utilityType === "PPWS" ? "m3" : "kWh");
      return {
        id: Number(row.id) || Date.now() + Math.floor(Math.random() * 1000),
        utilityType,
        campus: normalizeCampusInput(row.campus) || CAMPUS_LIST[0],
        building: toText(row.building),
        location: toText(row.location),
        unit,
        invoiceDate,
        billingMonth,
        usage: Math.max(0, Number(row.usage) || currentReading - previousReading),
        amount: Math.max(0, Number(row.amount) || 0),
        invoiceNumber: toText(row.invoiceNumber),
        providerName:
          toText(row.providerName) ||
          toText(row.provider) ||
          (utilityType === "PPWS" ? "Phnom Penh Water Supply Authority" : "Electricite du Cambodge"),
        photo: toText(row.photo),
        note: toText(row.note),
        created: toText(row.created) || new Date().toISOString(),
        meterId: Number(row.meterId) || 0,
        meterCode: toText(row.meterCode),
        meterName: toText(row.meterName),
        meterType: legacyMeterType,
        readingDate: toText(row.readingDate),
        previousReading,
        currentReading,
        readerName: toText(row.readerName),
      };
    })
    .filter((row) => row.campus && row.billingMonth && row.invoiceDate);
}

function normalizeRentalPrinters(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      id: Number(row.id) || Date.now() + Math.floor(Math.random() * 1000),
      vendor: toText(row.vendor) || "LA",
      machineCode: toUpper(row.machineCode),
      machineName: toText(row.machineName),
      model: toText(row.model),
      serialNumber: toText(row.serialNumber),
      ipAddress: toText(row.ipAddress),
      photo: toText(row.photo),
      campus: normalizeCampusInput(row.campus) || CAMPUS_LIST[0],
      location: toText(row.location),
      monoRate: Math.max(0, Number(row.monoRate) || 0),
      colorRate: Math.max(0, Number(row.colorRate) || 0),
      openingMono: Math.max(0, Number(row.openingMono) || 0),
      openingColor: Math.max(0, Number(row.openingColor) || 0),
      contractStart: toText(row.contractStart),
      contractEnd: toText(row.contractEnd),
      status: toUpper(row.status) === "INACTIVE" ? "Inactive" : "Active",
      fixingHistory: toText(row.fixingHistory),
      note: toText(row.note),
      created: toText(row.created) || new Date().toISOString(),
    }))
    .filter((row) => row.machineCode && row.machineName);
}

function normalizeRentalPrinterCounters(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const previousMono = Math.max(0, Number(row.previousMono) || 0);
      const currentMono = Math.max(previousMono, Number(row.currentMono) || 0);
      const previousColor = Math.max(0, Number(row.previousColor) || 0);
      const currentColor = Math.max(previousColor, Number(row.currentColor) || 0);
      return {
        id: Number(row.id) || Date.now() + Math.floor(Math.random() * 1000),
        rentalPrinterId: Number(row.rentalPrinterId) || 0,
        vendor: toText(row.vendor) || "LA",
        machineCode: toUpper(row.machineCode),
        machineName: toText(row.machineName),
        model: toText(row.model),
        campus: normalizeCampusInput(row.campus) || CAMPUS_LIST[0],
        location: toText(row.location),
        billingMonth: toText(row.billingMonth),
        readingDate: toText(row.readingDate),
        previousMono,
        currentMono,
        monoUsage: Math.max(0, Number(row.monoUsage) || currentMono - previousMono),
        previousColor,
        currentColor,
        colorUsage: Math.max(0, Number(row.colorUsage) || currentColor - previousColor),
        monoRate: Math.max(0, Number(row.monoRate) || 0),
        colorRate: Math.max(0, Number(row.colorRate) || 0),
        amount: Math.max(0, Number(row.amount) || 0),
        submittedBy: toText(row.submittedBy),
        photo: toText(row.photo),
        note: toText(row.note),
        created: toText(row.created) || new Date().toISOString(),
      };
    })
    .filter((row) => row.rentalPrinterId && row.machineCode && row.billingMonth);
}

function assetCategoryCode(category) {
  const normalized = normalizeCategoryInput(category);
  if (normalized === "IT") return "COM";
  if (normalized === "SAFETY") return "EE";
  if (normalized === "FACILITY") return "FFE";
  return "OTA";
}

function assetIdCampusCodeFromCampus(campusName) {
  const normalizedCampus = normalizeCampusInput(campusName);
  const code = toUpper(campusCode(normalizedCampus));
  const majorMatch = code.match(/^C(\d+)(?:\.\d+)?$/);
  if (majorMatch) return `ECO${majorMatch[1]}`;
  return "ECOX";
}

function buildAssetIdValue(campus, category, type, seq) {
  const campusPart = assetIdCampusCodeFromCampus(campus);
  const categoryPart = assetCategoryCode(category);
  const typePart = toUpper(type) || "UNK";
  const seqPart = pad(seq, 3);
  return `${campusPart}-${categoryPart}-${typePart}-${seqPart}`;
}

function parseAssetSeqFromId(assetId) {
  const match = toText(assetId).match(/-(\d{1,6})$/);
  return Number((match && match[1]) || 0);
}
function convertLegacyAssetIdToCurrent(rawAssetId) {
  const raw = toUpper(rawAssetId);
  const match = raw.match(/^C(\d+)(?:\.\d+)?-(IT|SF|FC|COM|EE|FFE|OTA)-([A-Z0-9]+)-(\d{1,6})$/);
  if (!match) return "";
  const campusMajor = Number(match[1] || 0);
  if (!campusMajor) return "";
  const legacyCategory = match[2];
  const type = match[3];
  const seq = Number(match[4] || 0);
  const categoryCode =
    legacyCategory === "IT"
      ? "COM"
      : legacyCategory === "SF"
        ? "EE"
        : legacyCategory === "FC"
          ? "FFE"
          : legacyCategory;
  return `ECO${campusMajor}-${categoryCode}-${type}-${pad(seq, 3)}`;
}

function legacyAssetCategoryCode(category) {
  const normalized = normalizeCategoryInput(category);
  if (normalized === "SAFETY") return "SF";
  if (normalized === "FACILITY") return "FC";
  return "IT";
}

function migrateAssetIdsAndLinkedReferences(assetsInput, ticketsInput, notificationsInput) {
  const assets = Array.isArray(assetsInput)
    ? assetsInput
        .filter((asset) => asset && typeof asset === "object")
        .map((asset) => ({ ...asset }))
    : [];
  const tickets = Array.isArray(ticketsInput)
    ? ticketsInput
        .filter((ticket) => ticket && typeof ticket === "object")
        .map((ticket) => ({ ...ticket }))
    : [];
  const notifications = Array.isArray(notificationsInput)
    ? notificationsInput
        .filter((row) => row && typeof row === "object")
        .map((row) => ({ ...row }))
    : [];

  const groups = new Map();
  for (const asset of assets) {
    const groupKey = `${assetIdCampusCodeFromCampus(asset.campus)}::${assetCategoryCode(asset.category)}::${toUpper(asset.type)}`;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(asset);
  }

  const oldToNew = new Map();
  for (const rows of groups.values()) {
    rows.sort((a, b) => {
      const aSeq = Math.max(Number(a.seq) || 0, parseAssetSeqFromId(a.assetId));
      const bSeq = Math.max(Number(b.seq) || 0, parseAssetSeqFromId(b.assetId));
      if (aSeq !== bSeq) return aSeq - bSeq;
      const aCreated = Date.parse(toText(a.created) || "") || 0;
      const bCreated = Date.parse(toText(b.created) || "") || 0;
      if (aCreated !== bCreated) return aCreated - bCreated;
      const aId = Number(a.id) || 0;
      const bId = Number(b.id) || 0;
      if (aId !== bId) return aId - bId;
      return toText(a.assetId).localeCompare(toText(b.assetId));
    });

    for (let i = 0; i < rows.length; i += 1) {
      const asset = rows[i];
      const nextSeq = i + 1;
      const nextAssetId = buildAssetIdValue(asset.campus, asset.category, asset.type, nextSeq);
      const oldAssetId = toText(asset.assetId);
      const oldSeq = Math.max(Number(asset.seq) || 0, parseAssetSeqFromId(oldAssetId) || 0, 1);
      const legacyAlias = `${campusCode(asset.campus)}-${legacyAssetCategoryCode(asset.category)}-${toUpper(asset.type)}-${pad(oldSeq, 4)}`;
      const aliases = [oldAssetId, legacyAlias];
      for (const alias of aliases) {
        if (!alias || alias === nextAssetId) continue;
        oldToNew.set(toUpper(alias), nextAssetId);
      }
      asset.seq = nextSeq;
      asset.assetId = nextAssetId;
    }
  }

  const knownAssetIds = new Set(assets.map((asset) => toUpper(asset.assetId)).filter(Boolean));

  for (const asset of assets) {
    const parent = toUpper(asset.parentAssetId);
    if (parent && oldToNew.has(parent)) {
      asset.parentAssetId = oldToNew.get(parent);
      continue;
    }
    if (parent) {
      const converted = convertLegacyAssetIdToCurrent(parent);
      if (converted && knownAssetIds.has(toUpper(converted))) {
        asset.parentAssetId = converted;
      }
    }
  }
  for (const ticket of tickets) {
    const assetId = toUpper(ticket.assetId);
    if (assetId && oldToNew.has(assetId)) {
      ticket.assetId = oldToNew.get(assetId);
      continue;
    }
    if (assetId) {
      const converted = convertLegacyAssetIdToCurrent(assetId);
      if (converted && knownAssetIds.has(toUpper(converted))) {
        ticket.assetId = converted;
      }
    }
  }
  for (const row of notifications) {
    const assetId = toUpper(row.assetId);
    if (assetId && oldToNew.has(assetId)) {
      row.assetId = oldToNew.get(assetId);
      continue;
    }
    if (assetId) {
      const converted = convertLegacyAssetIdToCurrent(assetId);
      if (converted && knownAssetIds.has(toUpper(converted))) {
        row.assetId = converted;
      }
    }
  }

  return { assets, tickets, notifications };
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
  const inventoryApprovalRouting = normalizeInventoryApprovalRoutingMap(settings.inventoryApprovalRouting);
  const telegramChatIds = normalizeTelegramChatIds(settings.telegramChatIds);
  const telegramMaintenanceChatIds = normalizeTelegramChatIds(settings.telegramMaintenanceChatIds);
  const inventoryItems = normalizeInventoryItems(settings.inventoryItems);
  const inventoryTxns = normalizeInventoryTxns(settings.inventoryTxns);
  const rentalPrinters = normalizeRentalPrinters(settings.rentalPrinters);
  const rentalPrinterCounters = normalizeRentalPrinterCounters(settings.rentalPrinterCounters);
  const vaultAccounts = normalizeVaultAccounts(settings.vaultAccounts);
  const vaultCredentials = normalizeVaultCredentials(settings.vaultCredentials);
  const vaultDesignLinks = normalizeVaultDesignLinks(settings.vaultDesignLinks);
  const vaultNetworkDocs = normalizeVaultNetworkDocs(settings.vaultNetworkDocs);
  const vaultCctvRecords = normalizeVaultCctvRecords(settings.vaultCctvRecords);
  const poolCleaningSchedules = normalizePoolCleaningSchedules(settings.poolCleaningSchedules);
  const poolEquipmentChecks = normalizePoolEquipmentChecks(settings.poolEquipmentChecks);
  const poolChemicalRecords = normalizePoolChemicalRecords(settings.poolChemicalRecords);
  const poolOperationRecords = normalizePoolOperationRecords(settings.poolOperationRecords);
  const poolComplaints = normalizePoolComplaints(settings.poolComplaints);
  const utilityMeters = normalizeUtilityMeters(settings.utilityMeters);
  const utilityReadings = normalizeUtilityReadings(settings.utilityReadings);
  const normalizedAssetsRaw = Array.isArray(parsed.assets)
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
  const migrated = migrateAssetIdsAndLinkedReferences(
    normalizedAssetsRaw,
    normalizeTickets(parsed.tickets),
    normalizeNotificationEntries(parsed.notifications)
  );
  return {
    assets: migrated.assets,
    tickets: normalizeTickets(migrated.tickets),
    locations: Array.isArray(parsed.locations) ? parsed.locations : [],
    users: Array.isArray(parsed.users) ? parsed.users : DEFAULT_USERS,
    auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
    authSessions: Array.isArray(parsed.authSessions) ? parsed.authSessions : [],
    notifications: migrated.notifications,
    settings: {
      campusNames,
      staffUsers,
      calendarEvents,
      maintenanceReminderOffsets,
      inventoryApprovalRouting,
      telegramChatIds,
      telegramMaintenanceChatIds,
      inventoryItems,
      inventoryTxns,
      rentalPrinters,
      rentalPrinterCounters,
      poolCleaningSchedules,
      poolEquipmentChecks,
      poolChemicalRecords,
      poolOperationRecords,
      poolComplaints,
      utilityMeters,
      utilityReadings,
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

function normalizeLooseDateToYmd(text) {
  const raw = toText(text).trim();
  if (!raw) return "";
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`;
  }
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${String(dmy[2]).padStart(2, "0")}-${String(dmy[1]).padStart(2, "0")}`;
  }
  return "";
}

function hasCompletedMaintenanceOnDateServer(asset, ymd) {
  const target = toText(ymd).trim();
  if (!target) return false;
  const history = Array.isArray(asset && asset.maintenanceHistory) ? asset.maintenanceHistory : [];
  const doneDates = history
    .map((entry) => {
      const completion = toText(entry && entry.completion).trim().toLowerCase();
      if (completion === "not yet") return "";
      return normalizeLooseDateToYmd(toText(entry && entry.date));
    })
    .filter(Boolean);
  if (!doneDates.length) return false;
  if (doneDates.some((entryDate) => entryDate === target)) return true;
  if (toUpper(asset && asset.repeatMode) === "NONE" && doneDates.some((entryDate) => entryDate >= target)) {
    return true;
  }
  return history.some((entry) => {
    const entryDate = normalizeLooseDateToYmd(toText(entry && entry.date));
    if (entryDate !== target) return false;
    const completion = toText(entry && entry.completion).trim().toLowerCase();
    if (!completion) return true;
    return completion !== "not yet";
  });
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
              .map((value) => toText(value).toLowerCase())
              .filter(Boolean)
          )
        )
      : [];
    const closedBy = Array.isArray(row.closedBy)
      ? Array.from(
          new Set(
            row.closedBy
              .map((value) => toText(value).toLowerCase())
              .filter(Boolean)
          )
        )
      : [];
    const targetUsernames = Array.isArray(row.targetUsernames)
      ? Array.from(
          new Set(
            row.targetUsernames
              .map((value) => toText(value).toLowerCase())
              .filter(Boolean)
          )
        )
      : [];
    const legacyTargetUsername = toText(row.targetUsername).toLowerCase();
    if (legacyTargetUsername && !targetUsernames.includes(legacyTargetUsername)) {
      targetUsernames.push(legacyTargetUsername);
    }
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
      closedBy,
      targetUsernames,
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
  const doneDate = toText(entry && entry.date) || toYmdUtc(new Date());
  const key = `maintenance-done:${Number(asset && asset.id) || 0}:${doneDate}`;
  return upsertNotification(db, {
    id: Date.now() + Math.floor(Math.random() * 1000),
    key,
    kind: "maintenance_done",
    title: `Maintenance done: ${toText(asset && asset.assetId) || "Unknown Asset"}`,
    message: `${toText(asset && asset.name) || "Asset"} was marked done on ${doneDate}.`,
    assetId: toText(asset && asset.assetId),
    assetDbId: Number(asset && asset.id) || 0,
    campus: toText(asset && asset.campus),
    scheduleDate: toText(asset && asset.nextMaintenanceDate),
    createdAt: new Date().toISOString(),
    readBy: [],
    closedBy: [],
    generatedBy: "maintenance-done",
  });
}

function markNotificationReadByUser(notification, username) {
  const user = toText(username).toLowerCase();
  if (!user) return false;
  const readBy = Array.isArray(notification.readBy) ? notification.readBy : [];
  if (readBy.includes(user)) return false;
  notification.readBy = [...readBy, user];
  return true;
}

function markNotificationClosedByUser(notification, username) {
  const user = toText(username).toLowerCase();
  if (!user) return false;
  const closedBy = Array.isArray(notification.closedBy) ? notification.closedBy : [];
  if (closedBy.includes(user)) return false;
  notification.closedBy = [...closedBy, user];
  return true;
}

function notificationVisibleToUser(notification, user) {
  const kind = toText(notification && notification.kind);
  const username = toText(user && user.username).toLowerCase();
  const closedBy = Array.isArray(notification && notification.closedBy)
    ? notification.closedBy.map((value) => toText(value).toLowerCase()).filter(Boolean)
    : [];
  if (username && closedBy.includes(username)) return false;
  const targetUsernames = Array.isArray(notification && notification.targetUsernames)
    ? notification.targetUsernames.map((value) => toText(value).toLowerCase()).filter(Boolean)
    : [];
  if (kind === "inventory_out_approval") {
    if (targetUsernames.length && username) return targetUsernames.includes(username);
    const campus = toText(notification && notification.campus);
    return isAdminRole(user && user.role) && (!campus || userCanAccessCampus(user, campus));
  }
  if (kind === "inventory_out_decision") {
    if (targetUsernames.length && username) return targetUsernames.includes(username);
    return false;
  }
  const campus = toText(notification && notification.campus);
  if (!campus) return true;
  return userCanAccessCampus(user, campus);
}

function resolveInventoryApprovalApprovers(db, requesterUsername, campusName) {
  const requester = toText(requesterUsername).toLowerCase();
  const requestCampus = toText(campusName);
  const settings = db && db.settings && typeof db.settings === "object" ? db.settings : {};
  const routing = normalizeInventoryApprovalRoutingMap(settings.inventoryApprovalRouting);
  const users = Array.isArray(db && db.users) ? db.users.map((row) => sanitizeUser(row)) : [];
  const routeEntry = routing[requester] || { campus: "", approvers: [] };
  const campus = toText(routeEntry.campus) || requestCampus;
  const eligibleAdmins = users.filter((row) => isAdminRole(row.role) && (!campus || userCanAccessCampus(row, campus)));
  const eligibleAdminSet = new Set(
    eligibleAdmins
      .map((row) => toText(row.username).toLowerCase())
      .filter(Boolean)
  );
  const mappedTargets = (Array.isArray(routeEntry.approvers) ? routeEntry.approvers : []).filter((username) => eligibleAdminSet.has(username));
  const targets = (mappedTargets.length ? mappedTargets : Array.from(eligibleAdminSet)).filter(
    (username) => username && username !== requester
  );
  return Array.from(new Set(targets));
}

function parseInventoryApprovalTxnIdFromNotificationKey(key) {
  const match = toText(key).match(/^inventory-out-approval:(\d+)$/);
  return match ? Number(match[1]) || 0 : 0;
}

function backfillInventoryApprovalNotificationTargets(db) {
  if (!db || typeof db !== "object") return false;
  db.notifications = normalizeNotificationEntries(db.notifications);
  const { txns } = getInventoryState(db);
  let changed = false;
  for (const row of db.notifications) {
    if (toText(row.kind) !== "inventory_out_approval") continue;
    const existingTargets = Array.isArray(row.targetUsernames) ? row.targetUsernames.filter(Boolean) : [];
    if (existingTargets.length) continue;
    const txnId = parseInventoryApprovalTxnIdFromNotificationKey(row.key);
    if (!txnId) continue;
    const tx = txns.find((item) => Number(item.id) === txnId);
    if (!tx) continue;
    const targets = resolveInventoryApprovalApprovers(db, toText(tx.approvalRequestedUser), toText(tx.campus));
    row.targetUsernames = targets;
    changed = true;
  }
  return changed;
}

function projectNotificationForUser(notification, user) {
  const username = toText(user && user.username).toLowerCase();
  const readBy = Array.isArray(notification.readBy)
    ? notification.readBy.map((value) => toText(value).toLowerCase()).filter(Boolean)
    : [];
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

function sendTelegramRequestWithToken(botToken, method, payload) {
  return new Promise((resolve) => {
    const token = toText(botToken).trim();
    if (!token) {
      resolve({
        ok: false,
        statusCode: 0,
        body: "missing telegram bot token",
      });
      return;
    }
    const bodyText = JSON.stringify(payload || {});
    const req = https.request(
      {
        hostname: "api.telegram.org",
        path: `/bot${encodeURIComponent(token)}/${method}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(bodyText),
        },
        timeout: 5000,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += String(chunk || "");
        });
        res.on("end", () =>
          resolve({
            ok: Boolean(res.statusCode >= 200 && res.statusCode < 300),
            statusCode: Number(res.statusCode || 0),
            body: String(body || ""),
          })
        );
      }
    );
    req.on("error", (err) =>
      resolve({
        ok: false,
        statusCode: 0,
        body: err instanceof Error ? err.message : String(err || ""),
      })
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({
        ok: false,
        statusCode: 0,
        body: "request timeout",
      });
    });
    req.write(bodyText);
    req.end();
  });
}

function sendTelegramRequest(method, payload) {
  return sendTelegramRequestWithToken(TELEGRAM_BOT_TOKEN, method, payload);
}

function sendTelegramMessageToChat(chatId, text, photoUrl = "", botToken = TELEGRAM_BOT_TOKEN) {
  return new Promise((resolve) => {
    if (!toText(chatId) || !toText(text)) return resolve({ ok: false, chatId: toText(chatId), statusCode: 0, body: "" });
    const method = toText(photoUrl) ? "sendPhoto" : "sendMessage";
    const payload = toText(photoUrl)
      ? {
          chat_id: toText(chatId),
          photo: toText(photoUrl),
          caption: toText(text).slice(0, 1024),
        }
      : {
          chat_id: toText(chatId),
          text: toText(text),
          disable_web_page_preview: true,
        };
    sendTelegramRequestWithToken(botToken, method, payload).then((result) => {
      let messageId = 0;
      try {
        const parsed = JSON.parse(toText(result && result.body));
        messageId = Number(parsed && parsed.result && parsed.result.message_id) || 0;
      } catch {
        messageId = 0;
      }
      resolve({
        ok: Boolean(result && result.ok),
        chatId: toText(chatId),
        messageId,
        statusCode: Number(result && result.statusCode) || 0,
        body: toText(result && result.body),
      });
    });
  });
}

function deleteTelegramMessageFromChat(chatId, messageId, botToken = TELEGRAM_BOT_TOKEN) {
  return new Promise((resolve) => {
    const normalizedChatId = toText(chatId);
    const normalizedMessageId = Number(messageId) || 0;
    if (!normalizedChatId || !normalizedMessageId) {
      resolve({ ok: false, chatId: normalizedChatId, messageId: normalizedMessageId, statusCode: 0, body: "" });
      return;
    }
    sendTelegramRequestWithToken(botToken, "deleteMessage", {
      chat_id: normalizedChatId,
      message_id: normalizedMessageId,
    }).then((result) => {
      resolve({
        ok: Boolean(result && result.ok),
        chatId: normalizedChatId,
        messageId: normalizedMessageId,
        statusCode: Number(result && result.statusCode) || 0,
        body: toText(result && result.body),
      });
    });
  });
}

function resolveTelegramConfiguredChatIds(db, overrideChatIds = [], kind = "default") {
  const settings =
    db && db.settings && typeof db.settings === "object" && !Array.isArray(db.settings)
      ? db.settings
      : {};
  const primarySettingsTargets = normalizeTelegramChatIds(
    kind === "maintenance" ? settings.telegramMaintenanceChatIds : settings.telegramChatIds
  );
  const fallbackSettingsTargets =
    kind === "maintenance" && !primarySettingsTargets.length
      ? normalizeTelegramChatIds(settings.telegramChatIds)
      : [];
  const explicitTargets = normalizeTelegramChatIds(overrideChatIds);
  const primaryEnvTargets = kind === "maintenance" ? TELEGRAM_MAINTENANCE_CHAT_IDS : TELEGRAM_CHAT_IDS;
  const fallbackEnvTargets =
    kind === "maintenance" && !primaryEnvTargets.length
      ? TELEGRAM_CHAT_IDS
      : [];
  return Array.from(
    new Set([
      ...explicitTargets,
      ...primaryEnvTargets,
      ...fallbackEnvTargets,
      ...primarySettingsTargets,
      ...fallbackSettingsTargets,
    ])
  );
}

function shouldRetryTelegramResult(result) {
  if (!result || result.ok) return false;
  const code = Number(result.statusCode || 0);
  if (code === 0 || code === 429) return true;
  return code >= 500;
}

function waitMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

async function sendTelegramMessageToChatWithRetry(chatId, text, photoUrl = "", attempts = 3, botToken = TELEGRAM_BOT_TOKEN) {
  let last = { ok: false, chatId: toText(chatId), statusCode: 0, body: "" };
  for (let i = 0; i < attempts; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    last = await sendTelegramMessageToChat(chatId, text, photoUrl, botToken);
    if (last.ok) return last;
    if (!shouldRetryTelegramResult(last) || i === attempts - 1) return last;
    // eslint-disable-next-line no-await-in-loop
    await waitMs(300 * (i + 1));
  }
  return last;
}

async function sendTelegramMessage(text, options = {}) {
  if (!TELEGRAM_ALERT_ENABLED || !TELEGRAM_BOT_TOKEN || !toText(text)) {
    telegramLastSendReport = {
      at: new Date().toISOString(),
      ok: false,
      successCount: 0,
      targetCount: 0,
      targets: [],
      errors: ["telegram disabled, token missing, or empty text"],
    };
    return false;
  }
  const db = options && typeof options === "object" ? options.db : null;
  const photoUrl =
    options && typeof options === "object" && Object.prototype.hasOwnProperty.call(options, "photoUrl")
      ? toText(options.photoUrl)
      : "";
  const explicitChatIds =
    options && typeof options === "object" && Object.prototype.hasOwnProperty.call(options, "chatIds")
      ? options.chatIds
      : [];
  const includeResults =
    options && typeof options === "object" && Object.prototype.hasOwnProperty.call(options, "includeResults")
      ? Boolean(options.includeResults)
      : false;
  const configuredTargets = resolveTelegramConfiguredChatIds(db, explicitChatIds);
  const discoveredChats = TELEGRAM_DISCOVER_CHAT_IDS ? await discoverTelegramChatIds() : [];
  telegramLastDiscoveredChats = discoveredChats;
  const discoveredTargets = discoveredChats.map((row) => toText(row.id)).filter(Boolean);
  const targets = Array.from(new Set([...configuredTargets, ...discoveredTargets]));
  if (!targets.length) return false;
  const results = [];
  for (const chatId of targets) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await sendTelegramMessageToChatWithRetry(chatId, text, photoUrl));
  }
  let successCount = results.filter((row) => row.ok).length;
  if (!successCount && TELEGRAM_DISCOVER_CHAT_IDS) {
    const retryTargets = Array.from(
      new Set(
        [
          ...targets,
          ...(await discoverTelegramChatIds()),
        ]
          .map((row) => toText(row).trim())
          .filter(Boolean)
      )
    );
    for (const chatId of retryTargets) {
      if (results.some((row) => row.ok && row.chatId === chatId)) continue;
      // eslint-disable-next-line no-await-in-loop
      results.push(await sendTelegramMessageToChatWithRetry(chatId, text, photoUrl, 2));
    }
    successCount = results.filter((row) => row.ok).length;
  }
  telegramLastSendReport = {
    at: new Date().toISOString(),
    ok: successCount > 0,
    successCount,
    targetCount: targets.length,
    targets,
    errors: results
      .filter((row) => !row.ok)
      .map((row) => `chat ${row.chatId}: ${row.statusCode || 0} ${toText(row.body).slice(0, 160)}`),
  };
  if (!successCount) {
    console.warn(
      "[ALERT] Telegram send failed for all targets:",
      results.map((row) => ({ chatId: row.chatId, statusCode: row.statusCode, body: row.body.slice(0, 160) }))
    );
  }
  if (includeResults) {
    return {
      ok: successCount > 0,
      results,
    };
  }
  return successCount > 0;
}

async function sendTelegramMaintenanceMessage(text, options = {}) {
  if (!TELEGRAM_ALERT_ENABLED || !TELEGRAM_MAINTENANCE_BOT_TOKEN || !toText(text)) {
    telegramMaintenanceLastSendReport = {
      at: new Date().toISOString(),
      ok: false,
      successCount: 0,
      targetCount: 0,
      targets: [],
      errors: ["maintenance telegram disabled, token missing, or empty text"],
    };
    return false;
  }
  const db = options && typeof options === "object" ? options.db : null;
  const photoUrl =
    options && typeof options === "object" && Object.prototype.hasOwnProperty.call(options, "photoUrl")
      ? toText(options.photoUrl)
      : "";
  const explicitChatIds =
    options && typeof options === "object" && Object.prototype.hasOwnProperty.call(options, "chatIds")
      ? options.chatIds
      : [];
  const includeResults =
    options && typeof options === "object" && Object.prototype.hasOwnProperty.call(options, "includeResults")
      ? Boolean(options.includeResults)
      : false;
  const configuredTargets = resolveTelegramConfiguredChatIds(db, explicitChatIds, "maintenance");
  const targets = Array.from(new Set(configuredTargets));
  if (!targets.length) return false;
  const results = [];
  for (const chatId of targets) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await sendTelegramMessageToChatWithRetry(chatId, text, photoUrl, 3, TELEGRAM_MAINTENANCE_BOT_TOKEN));
  }
  const successCount = results.filter((row) => row.ok).length;
  telegramMaintenanceLastSendReport = {
    at: new Date().toISOString(),
    ok: successCount > 0,
    successCount,
    targetCount: targets.length,
    targets,
    errors: results
      .filter((row) => !row.ok)
      .map((row) => `chat ${row.chatId}: ${row.statusCode || 0} ${toText(row.body).slice(0, 160)}`),
  };
  if (!successCount) {
    console.warn(
      "[MAINTENANCE ALERT] Telegram send failed for all targets:",
      results.map((row) => ({ chatId: row.chatId, statusCode: row.statusCode, body: row.body.slice(0, 160) }))
    );
  }
  if (includeResults) {
    return {
      ok: successCount > 0,
      results,
    };
  }
  return successCount > 0;
}

function formatTicketRequestSourceLabel(value) {
  const key = toText(value).toLowerCase();
  if (key === "qr_scan" || key === "qr_asset") return "QR Scan";
  if (key === "manual") return "Manual";
  return toText(value) || "Manual";
}

async function sendTelegramWorkOrderCreatedAlert(ticket, db = null) {
  if (!ticket || typeof ticket !== "object") return false;
  const lines = [
    "ECO Maintenance Alert",
    "New maintenance / repair request",
    `Ticket: ${toText(ticket.ticketNo) || "-"}`,
    `Campus: ${formatTelegramCampusKhmer(ticket.campus)}`,
    `Category: ${toText(ticket.category) || "-"}`,
    `Title: ${toText(ticket.title) || "-"}`,
    `Requested By: ${toText(ticket.requestedBy) || "-"}`,
    `Priority: ${toText(ticket.priority) || "Normal"}`,
    `Source: ${formatTicketRequestSourceLabel(ticket.requestSource)}`,
    `Status: ${toText(ticket.status) || "Open"}`,
  ];
  if (toText(ticket.assetId)) {
    lines.push(`Asset ID: ${toText(ticket.assetId)}`);
  }
  if (toText(ticket.assetLocation)) {
    lines.push(`Location: ${toText(ticket.assetLocation)}`);
  }
  if (toText(ticket.requesterContact)) {
    lines.push(`Contact: ${toText(ticket.requesterContact)}`);
  }
  if (toText(ticket.description)) {
    lines.push(`Description: ${toText(ticket.description)}`);
  }
  const report = await sendTelegramMaintenanceMessage(lines.join("\n"), {
    db,
    photoUrl: resolveTelegramPhotoUrl(toText(ticket.photo)),
    includeResults: true,
  });
  return {
    ok: Boolean(report && report.ok),
    messageRefs: normalizeTelegramMessageRefs(report && report.results),
  };
}

function resolveTelegramPhotoUrl(photoPath) {
  const raw = toText(photoPath);
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!raw.startsWith("/uploads/")) return "";
  if (!PUBLIC_APP_URL) return "";
  return `${PUBLIC_APP_URL}${raw}`;
}

function resolveInventoryItemPhotoForTelegram(db, txn) {
  const txnPhotoUrl = resolveTelegramPhotoUrl(toText(txn && txn.photo));
  const settings =
    db && db.settings && typeof db.settings === "object" && !Array.isArray(db.settings)
      ? db.settings
      : {};
  const items = normalizeInventoryItems(settings.inventoryItems);
  const item = items.find((row) => Number(row.id) === Number(txn && txn.itemId));
  const itemPhotoUrl = resolveTelegramPhotoUrl(toText(item && item.photo));
  return txnPhotoUrl || itemPhotoUrl || "";
}

function formatTelegramCampusKhmer(campus) {
  const label = toText(campus);
  return CAMPUS_KHMER_MAP[label] || label || "-";
}

function formatInventoryOutTelegramStatus(status) {
  const normalized = toUpper(status);
  if (normalized === "APPROVED") return "អាចដកចេញបាន";
  return toText(status) || "-";
}

function normalizeTelegramMessageRefs(refs) {
  if (!Array.isArray(refs)) return [];
  return refs
    .map((row) => ({
      chatId: toText(row && row.chatId),
      messageId: Number(row && row.messageId) || 0,
    }))
    .filter((row) => row.chatId && row.messageId);
}

async function deleteTelegramMessagesByRefs(refs) {
  const targets = normalizeTelegramMessageRefs(refs);
  if (!targets.length) return { ok: true, successCount: 0, results: [] };
  const results = [];
  for (const row of targets) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await deleteTelegramMessageFromChat(row.chatId, row.messageId));
  }
  return {
    ok: results.every((row) => row.ok),
    successCount: results.filter((row) => row.ok).length,
    results,
  };
}

function discoverTelegramChatIds(botToken = TELEGRAM_BOT_TOKEN) {
  return new Promise((resolve) => {
    const token = toText(botToken).trim();
    if (!token) return resolve([]);
    const req = https.request(
      {
        hostname: "api.telegram.org",
        path: `/bot${encodeURIComponent(token)}/getUpdates?limit=100`,
        method: "GET",
        timeout: 5000,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += String(chunk || "");
        });
        res.on("end", () => {
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            resolve([]);
            return;
          }
          try {
            const parsed = JSON.parse(body);
            const rows = Array.isArray(parsed && parsed.result) ? parsed.result : [];
            const chats = Array.from(
              new Map(
                rows
                  .map((row) => {
                    const message = row && typeof row === "object" ? (row.message || row.edited_message || row.channel_post) : null;
                    const chat = message && typeof message === "object" ? message.chat : null;
                    const id = chat && typeof chat === "object" ? toText(chat.id) : "";
                    if (!id) return null;
                    return [
                      id,
                      {
                        id,
                        type: toText(chat.type),
                        title: toText(chat.title) || toText(chat.username) || toText(chat.first_name),
                        username: toText(chat.username),
                      },
                    ];
                  })
                  .filter(Boolean)
              ).values()
            );
            resolve(chats);
          } catch {
            resolve([]);
          }
        });
      }
    );
    req.on("error", () => resolve([]));
    req.on("timeout", () => {
      req.destroy();
      resolve([]);
    });
    req.end();
  });
}

async function sendTelegramMaintenanceBatch(rows, db = null) {
  if (!Array.isArray(rows) || !rows.length) return false;
  const lines = rows.slice(0, 8).map((row, idx) => {
    const dateText = toText(row.scheduleDate) || "-";
    const assetId = toText(row.assetId) || "Unknown";
    const campus = toText(row.campus) || "-";
    const location = toText(row.location) || "-";
    const title = toText(row.title) || "Maintenance Alert";
    const note = toText(row.scheduleNote || row.message || "").trim();
    const alertLabel = toText(row.alertLabel || "").trim();
    const suffix = note ? `\nNote: ${note}` : "";
    return `${idx + 1}. ${title}${alertLabel ? ` (${alertLabel})` : ""}\nAsset: ${assetId} | Campus: ${campus} | Location: ${location} | Date: ${dateText}${suffix}`;
  });
  const extra = rows.length > 8 ? `\n+${rows.length - 8} more alert(s)` : "";
  const text = `Eco IT Maintenance Alerts\n${lines.join("\n\n")}${extra}`;
  return sendTelegramMaintenanceMessage(text, { db });
}

function normalizeMaintenanceTelegramDailyLog(settings) {
  const input = settings && typeof settings === "object" && settings.maintenanceTelegramDailyLog && typeof settings.maintenanceTelegramDailyLog === "object"
    ? settings.maintenanceTelegramDailyLog
    : {};
  const output = {};
  for (const [key, value] of Object.entries(input)) {
    const normalizedKey = toText(key).trim();
    const normalizedValue = normalizeLooseDateToYmd(value);
    if (!normalizedKey || !normalizedValue) continue;
    output[normalizedKey] = normalizedValue;
  }
  return output;
}

function buildMaintenanceTelegramReminderRows(db) {
  const settings =
    db && db.settings && typeof db.settings === "object" && !Array.isArray(db.settings)
      ? db.settings
      : {};
  const todayYmd = new Date().toISOString().slice(0, 10);
  const dailyLog = normalizeMaintenanceTelegramDailyLog(settings);
  const reminderRows = [];
  let changed = false;
  for (const [key, value] of Object.entries(dailyLog)) {
    const sentDate = normalizeLooseDateToYmd(value);
    if (!sentDate || sentDate < todayYmd) {
      delete dailyLog[key];
      changed = true;
    }
  }
  const assets = Array.isArray(db && db.assets) ? db.assets : [];
  for (const asset of assets) {
    const scheduleDate = normalizeLooseDateToYmd(asset && asset.nextMaintenanceDate);
    const assetIdNum = Number(asset && asset.id) || 0;
    if (!scheduleDate || !assetIdNum) continue;
    const days = daysUntilYmd(scheduleDate);
    if (days === null || days > 7) continue;
    if (hasCompletedMaintenanceOnDateServer(asset, scheduleDate)) continue;
    const dedupeKey = `${assetIdNum}:${scheduleDate}:${todayYmd}`;
    if (dailyLog[dedupeKey] === todayYmd) continue;
    let alertLabel = "";
    let title = "";
    if (days === 7) {
      alertLabel = "7 days before";
      title = `Maintenance due in 7 days: ${toText(asset.assetId) || "Unknown Asset"}`;
    } else if (days > 0) {
      alertLabel = `${days} day${days === 1 ? "" : "s"} before`;
      title = `Maintenance follow-up: ${toText(asset.assetId) || "Unknown Asset"}`;
    } else if (days === 0) {
      alertLabel = "Due today";
      title = `Maintenance due today: ${toText(asset.assetId) || "Unknown Asset"}`;
    } else {
      alertLabel = `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
      title = `Maintenance overdue: ${toText(asset.assetId) || "Unknown Asset"}`;
    }
    reminderRows.push({
      key: dedupeKey,
      assetDbId: assetIdNum,
      assetId: toText(asset && asset.assetId),
      name: toText(asset && asset.name),
      campus: toText(asset && asset.campus),
      location: toText(asset && asset.location),
      scheduleDate,
      scheduleNote: toText(asset && asset.scheduleNote),
      title,
      alertLabel,
    });
  }
  settings.maintenanceTelegramDailyLog = dailyLog;
  if (db && db.settings && typeof db.settings === "object" && !Array.isArray(db.settings)) {
    db.settings.maintenanceTelegramDailyLog = dailyLog;
  } else if (db) {
    db.settings = { maintenanceTelegramDailyLog: dailyLog };
  }
  return { rows: reminderRows, changed };
}

async function maybeRunMaintenanceAlertSweep() {
  if (maintenanceAlertSweepRunning) return;
  maintenanceAlertSweepRunning = true;
  try {
    const db = await readDb();
    const createdNotifications = [];
    const changed = ensureMaintenanceScheduleNotifications(db, createdNotifications);
    const reminderResult = buildMaintenanceTelegramReminderRows(db);
    if (changed || reminderResult.changed) {
      await writeDb(db);
    }
    if (reminderResult.rows.length) {
      const sent = await sendTelegramMaintenanceBatch(reminderResult.rows, db);
      if (sent) {
        const todayYmd = new Date().toISOString().slice(0, 10);
        const settings =
          db && db.settings && typeof db.settings === "object" && !Array.isArray(db.settings)
            ? db.settings
            : {};
        const dailyLog = normalizeMaintenanceTelegramDailyLog(settings);
        reminderResult.rows.forEach((row) => {
          dailyLog[toText(row.key)] = todayYmd;
        });
        db.settings = { ...(db.settings || {}), maintenanceTelegramDailyLog: dailyLog };
        await writeDb(db);
      }
    }
  } catch (err) {
    console.warn(
      "Maintenance alert sweep failed:",
      err instanceof Error ? err.message : err
    );
  } finally {
    maintenanceAlertSweepRunning = false;
  }
}

async function sendTelegramInventoryOutApprovalAlert(txn, approverTargets = [], db = null) {
  if (!txn || typeof txn !== "object") return false;
  if (toUpper(txn.approvalStatus) !== "PENDING") return false;
  const itemCode = toText(txn.itemCode) || "-";
  const itemName = toText(txn.itemName) || "Item";
  const qty = Number(txn.qty || 0);
  const campus = toText(txn.campus) || "-";
  const date = toText(txn.date) || "-";
  const requestedBy =
    toText(txn.approvalRequestedBy) || toText(txn.by) || toText(txn.approvalRequestedUser) || "staff";
  const reason = toText(txn.note);
  const approvers = Array.isArray(approverTargets)
    ? approverTargets.map((row) => toText(row).toLowerCase()).filter(Boolean)
    : [];
  const lines = [
    "ជូនដំណឹង ECO IT - ស្តុក",
    "សំណើរចេញស្តុក កំពុងរង់ចាំអនុម័ត",
    `មុខទំនិញ: ${itemCode} - ${itemName}`,
    `បរិមាណ: ${qty} | សាខា: ${campus}`,
    `កាលបរិច្ឆេទ: ${date}`,
    `ស្នើដោយ: ${requestedBy}`,
  ];
  if (approvers.length) {
    lines.push(`អ្នកអនុម័ត: ${approvers.join(", ")}`);
  }
  if (reason) {
    lines.push(`មូលហេតុ: ${reason}`);
  }
  const report = await sendTelegramMessage(lines.join("\n"), {
    db,
    photoUrl: resolveInventoryItemPhotoForTelegram(db, txn),
    includeResults: true,
  });
  return {
    ok: Boolean(report && report.ok),
    messageRefs: normalizeTelegramMessageRefs(report && report.results),
  };
}

async function sendTelegramInventoryOutRecordedAlert(txn, db = null) {
  if (!txn || typeof txn !== "object") return false;
  if (normalizeInventoryTxnType(txn.type) !== "OUT") return false;
  const itemCode = toText(txn.itemCode) || "-";
  const itemName = toText(txn.itemName) || "Item";
  const qty = Number(txn.qty || 0);
  const campus = formatTelegramCampusKhmer(txn.campus);
  const date = toText(txn.date) || "-";
  const recordedBy = toText(txn.by) || toText(txn.approvalRequestedBy) || "staff";
  const status = formatInventoryOutTelegramStatus(txn.approvalStatus || "APPROVED");
  const reason = toText(txn.note);
  const settings =
    db && db.settings && typeof db.settings === "object" && !Array.isArray(db.settings)
      ? db.settings
      : {};
  const items = normalizeInventoryItems(settings.inventoryItems);
  const txns = normalizeInventoryTxns(settings.inventoryTxns);
  const item = items.find((row) => Number(row.id) === Number(txn.itemId));
  const remainingStock = item ? calcInventoryCurrentStock(item, txns) : null;
  const stockUnit = toText(item && item.unit) || "";
  const lines = [
    "ជូនដំណឹង ECO IT - ស្តុក",
    "ចេញសម្ភារៈ (Item Out)",
    `មុខទំនិញ: ${itemCode} - ${itemName}`,
    `បរិមាណ: ${qty} | សាខា: ${campus}`,
    `កាលបរិច្ឆេទ: ${date}`,
    `កត់ត្រាដោយ: ${recordedBy}`,
    `ស្ថានភាព: ${status}`,
  ];
  if (remainingStock !== null) {
    lines.push(`ស្តុកនៅសល់: ${remainingStock}${stockUnit ? ` ${stockUnit}` : ""}`);
  }
  if (reason) {
    lines.push(`មូលហេតុ: ${reason}`);
  }
  const report = await sendTelegramMessage(lines.join("\n"), {
    db,
    photoUrl: resolveInventoryItemPhotoForTelegram(db, txn),
    includeResults: true,
  });
  return {
    ok: Boolean(report && report.ok),
    messageRefs: normalizeTelegramMessageRefs(report && report.results),
  };
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

function getClientIp(req) {
  const forwarded = toText(req.headers["x-forwarded-for"]);
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  return toText(req.socket && req.socket.remoteAddress) || "";
}

function getRequestUserAgent(req) {
  return toText(req.headers["user-agent"]);
}

function createAuthSessionEntry(user, req, token = "") {
  const safeUser = sanitizeUser(user);
  const now = new Date().toISOString();
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    token: toText(token),
    user: safeUser,
    username: toText(safeUser.username),
    displayName: toText(safeUser.displayName) || toText(safeUser.username),
    role: toText(safeUser.role),
    ipAddress: getClientIp(req),
    userAgent: getRequestUserAgent(req),
    loginAt: now,
    lastSeenAt: now,
    logoutAt: "",
    status: "active",
  };
}

function sanitizeAuthSessionEntry(entry) {
  const source = entry && typeof entry === "object" ? entry : {};
  const safeUser = sanitizeUser(source.user || source);
  return {
    id: Number(source.id) || Date.now() + Math.floor(Math.random() * 1000),
    token: toText(source.token),
    user: safeUser,
    username: toText(source.username) || toText(safeUser.username),
    displayName: toText(source.displayName) || toText(safeUser.displayName) || toText(safeUser.username),
    role: toText(source.role) || toText(safeUser.role),
    ipAddress: toText(source.ipAddress),
    userAgent: toText(source.userAgent),
    loginAt: toText(source.loginAt),
    lastSeenAt: toText(source.lastSeenAt) || toText(source.loginAt),
    logoutAt: toText(source.logoutAt),
    status: toText(source.status) || "active",
  };
}

function touchSessionActivity(token) {
  const key = toText(token);
  if (!key) return null;
  const session = sessions.get(key);
  if (!session) return null;
  session.lastSeenAt = new Date().toISOString();
  sessions.set(key, session);
  return session;
}

function markSessionLoggedOut(token) {
  const key = toText(token);
  if (!key) return null;
  const session = sessions.get(key);
  if (!session) return null;
  const now = new Date().toISOString();
  session.lastSeenAt = now;
  session.logoutAt = now;
  session.status = "logged_out";
  sessions.delete(key);
  return session;
}

function upsertAuthSessionHistory(db, entry) {
  const session = sanitizeAuthSessionEntry(entry);
  db.authSessions = Array.isArray(db.authSessions) ? db.authSessions : [];
  const idx = db.authSessions.findIndex(
    (row) => Number(row && row.id) === session.id || (session.token && toText(row && row.token) === session.token)
  );
  if (idx >= 0) {
    db.authSessions[idx] = { ...db.authSessions[idx], ...session };
  } else {
    db.authSessions.unshift(session);
  }
  db.authSessions = db.authSessions
    .map((row) => sanitizeAuthSessionEntry(row))
    .sort((a, b) => Date.parse(b.loginAt || "") - Date.parse(a.loginAt || ""))
    .slice(0, 3000);
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
    case "application/pdf":
      return "pdf";
    case "text/plain":
      return "txt";
    case "text/csv":
      return "csv";
    case "application/msword":
      return "doc";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return "docx";
    case "application/vnd.ms-excel":
      return "xls";
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return "xlsx";
    default:
      return "bin";
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

function sanitizeUploadFileName(name, fallback = "attachment") {
  const raw = toText(name)
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return raw || fallback;
}

async function saveDataUrlFile(dataUrl, group = "files", preferredName = "") {
  const raw = toText(dataUrl);
  const m = raw.match(/^data:([a-zA-Z0-9.+/-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return "";
  const mime = m[1].toLowerCase();
  const base64 = m[2];
  const ext = extFromMime(mime);
  const folder = toText(group).replace(/[^a-z0-9_-]/gi, "").toLowerCase() || "files";
  await ensureUploadsDir();
  const folderPath = path.join(UPLOADS_DIR, folder);
  await fs.mkdir(folderPath, { recursive: true });
  const safePreferred = sanitizeUploadFileName(preferredName || "", "attachment");
  const preferredExt = path.extname(safePreferred).replace(/^\./, "").toLowerCase();
  const baseName = path.basename(safePreferred, preferredExt ? `.${preferredExt}` : "").replace(/[^a-z0-9._-]/gi, "-") || "attachment";
  const fileName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}-${baseName}.${preferredExt || ext}`;
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
  const seenRaw = new Set();
  if (!Array.isArray(photos)) return out;
  for (const item of photos) {
    const rawItem = toText(item);
    if (!rawItem || seenRaw.has(rawItem)) continue;
    seenRaw.add(rawItem);
    const normalized = await normalizePhotoValue(item, group);
    if (!normalized) continue;
    if (!out.includes(normalized)) out.push(normalized);
    if (out.length >= maxCount) break;
  }
  return out;
}

async function normalizeMaintenanceMediaPayload(body) {
  const rawPhoto = body ? body.photo : "";
  const rawPhotos = Array.isArray(body?.photos) ? body.photos : [];
  const rawBeforePhotos = Array.isArray(body?.beforePhotos) ? body.beforePhotos : [];
  const rawAfterPhotos = Array.isArray(body?.afterPhotos) ? body.afterPhotos : [];
  const beforePhotos = await normalizePhotoList(rawBeforePhotos, "maintenance", 5);
  const afterPhotos = await normalizePhotoList(
    [...rawAfterPhotos, ...rawPhotos, ...(toText(rawPhoto) ? [rawPhoto] : [])],
    "maintenance",
    5
  );
  return {
    beforePhotos: beforePhotos.slice(0, 5),
    afterPhotos: afterPhotos.slice(0, 5),
    photo: afterPhotos[0] || "",
    photos: afterPhotos.slice(0, 5),
  };
}

const MAINTENANCE_WORKFLOW_TEMPLATES = new Set(["general", "computer", "aircon", "ipad"]);
const MAINTENANCE_WORKFLOW_PRIORITIES = new Set(["Low", "Normal", "High", "Urgent"]);

function normalizeMaintenanceWorkflowPayload(input) {
  const source = input && typeof input === "object" ? input : {};
  const template = toText(source.template).toLowerCase();
  const priority = toText(source.priority);
  const checklist = Array.isArray(source.checklist)
    ? Array.from(new Set(source.checklist.map((item) => toText(item)).filter(Boolean)))
    : [];
  return {
    template: MAINTENANCE_WORKFLOW_TEMPLATES.has(template) ? template : "general",
    requesterName: toText(source.requesterName),
    priority: MAINTENANCE_WORKFLOW_PRIORITIES.has(priority) ? priority : "Normal",
    issueSummary: toText(source.issueSummary),
    startedAt: toText(source.startedAt),
    completedAt: toText(source.completedAt),
    downtimeHours: toText(source.downtimeHours),
    safetyCheck: Boolean(source.safetyCheck),
    userIssueConfirmed: Boolean(source.userIssueConfirmed),
    rootCause: toText(source.rootCause),
    workPerformed: toText(source.workPerformed),
    partsUsed: toText(source.partsUsed),
    toolsUsed: toText(source.toolsUsed),
    testResult: toText(source.testResult),
    followUp: toText(source.followUp),
    userConfirmation: toText(source.userConfirmation),
    checklist,
  };
}

const uploadContentHashCache = new Map();

async function getUploadContentHash(uploadUrl) {
  const raw = toText(uploadUrl);
  if (!raw || !raw.startsWith("/uploads/")) return "";
  if (uploadContentHashCache.has(raw)) return uploadContentHashCache.get(raw);
  const uploadRelative = raw.replace(/^\/uploads\//, "");
  const safeRelative = path
    .normalize(uploadRelative)
    .replace(/^(\.\.(\/|\\|$))+/, "");
  const uploadPath = path.resolve(path.join(UPLOADS_DIR, safeRelative));
  const uploadRoot = path.resolve(UPLOADS_DIR) + path.sep;
  if (!uploadPath.startsWith(uploadRoot) || !(await fileExists(uploadPath))) {
    uploadContentHashCache.set(raw, "");
    return "";
  }
  const buffer = await fs.readFile(uploadPath);
  const hash = crypto.createHash("sha1").update(buffer).digest("hex");
  uploadContentHashCache.set(raw, hash);
  return hash;
}

async function dedupeMaintenancePhotoListByContent(photos, maxCount = 5) {
  const out = [];
  const seen = new Set();
  const list = Array.isArray(photos) ? photos : [];
  for (const item of list) {
    const normalized = toText(item);
    if (!normalized) continue;
    const contentHash = await getUploadContentHash(normalized);
    const key = contentHash || normalized;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
    if (out.length >= maxCount) break;
  }
  return out;
}

async function normalizeStoredMaintenanceEntryMedia(entry) {
  const source = entry && typeof entry === "object" ? entry : {};
  const beforeBase = Array.isArray(source.beforePhotos) ? source.beforePhotos : [];
  const afterBase = [
    ...(Array.isArray(source.afterPhotos) ? source.afterPhotos : []),
    ...(Array.isArray(source.photos) ? source.photos : []),
    ...(toText(source.photo) ? [source.photo] : []),
  ];
  const beforePhotos = await dedupeMaintenancePhotoListByContent(beforeBase, 5);
  const afterPhotos = await dedupeMaintenancePhotoListByContent(afterBase, 5);
  return {
    ...source,
    photo: afterPhotos[0] || "",
    photos: afterPhotos,
    beforePhotos,
    afterPhotos,
  };
}

async function normalizeAssetsForResponse(assets) {
  if (!Array.isArray(assets)) return [];
  const out = [];
  for (const asset of assets) {
    const source = asset && typeof asset === "object" ? asset : {};
    const maintenanceHistory = Array.isArray(source.maintenanceHistory)
      ? await Promise.all(source.maintenanceHistory.map((entry) => normalizeStoredMaintenanceEntryMedia(entry)))
      : [];
    out.push({
      ...source,
      maintenanceHistory,
    });
  }
  return out;
}

function fileNameFromUploadUrl(raw, fallback = "attachment") {
  const text = toText(raw);
  if (!text) return fallback;
  try {
    const parsed = new URL(text, "http://local");
    const base = path.basename(parsed.pathname || "");
    return base || fallback;
  } catch {
    const base = path.basename(text);
    return base || fallback;
  }
}

async function normalizeAttachmentValue(input, group = "maintenance_reports") {
  if (!input) return { url: "", name: "", mimeType: "" };
  const source = input && typeof input === "object" ? input : { url: input };
  const raw = toText(source.url || source.file || source.reportFile || input);
  const name = sanitizeUploadFileName(source.name || source.fileName || "", "attachment");
  const mimeType = toText(source.mimeType || source.type);
  if (!raw) return { url: "", name: "", mimeType: "" };
  if (raw.startsWith("/uploads/")) {
    return { url: raw, name: name || fileNameFromUploadUrl(raw), mimeType };
  }
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const parsed = new URL(raw);
      if (parsed.pathname.startsWith("/uploads/")) {
        return { url: parsed.pathname, name: name || fileNameFromUploadUrl(parsed.pathname), mimeType };
      }
    } catch {
      // Keep legacy value as-is if URL parsing fails.
    }
  }
  if (raw.startsWith("data:")) {
    const saved = await saveDataUrlFile(raw, group, name);
    const dataMime = raw.match(/^data:([a-zA-Z0-9.+/-]+);base64,/)?.[1] || mimeType;
    return {
      url: saved || "",
      name: name || fileNameFromUploadUrl(saved),
      mimeType: toText(dataMime),
    };
  }
  return { url: raw, name: name || fileNameFromUploadUrl(raw), mimeType };
}

function extractDataUrlBuffer(dataUrl) {
  const raw = toText(dataUrl);
  const m = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  return {
    mime: m[1].toLowerCase(),
    buffer: Buffer.from(m[2], "base64"),
  };
}

async function writeTempImageFromDataUrl(dataUrl, prefix = "utility-invoice") {
  const parsed = extractDataUrlBuffer(dataUrl);
  if (!parsed) return null;
  const ext = extFromMime(parsed.mime);
  const tempPath = path.join(
    os.tmpdir(),
    `${prefix}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`
  );
  await fs.writeFile(tempPath, parsed.buffer);
  return tempPath;
}

async function readInvoiceImagePath(photoInput) {
  const raw = toText(photoInput);
  if (!raw) return { path: "", temporary: false };
  if (raw.startsWith("data:image/")) {
    const tempPath = await writeTempImageFromDataUrl(raw);
    return { path: tempPath || "", temporary: Boolean(tempPath) };
  }
  if (raw.startsWith("/uploads/")) {
    const uploadRelative = raw.replace(/^\/uploads\//, "");
    const safeRelative = path
      .normalize(uploadRelative)
      .replace(/^(\.\.(\/|\\|$))+/, "");
    const uploadPath = path.resolve(path.join(UPLOADS_DIR, safeRelative));
    const uploadRoot = path.resolve(UPLOADS_DIR) + path.sep;
    if (uploadPath.startsWith(uploadRoot) && (await fileExists(uploadPath))) {
      return { path: uploadPath, temporary: false };
    }
  }
  return { path: "", temporary: false };
}

function firstNonEmptyMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = toText(match && match[1]);
    if (value) return value;
  }
  return "";
}

function parseMoneyValue(raw) {
  const normalized = toText(raw).replace(/[, ]/g, "");
  if (!normalized) return "";
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? String(numeric) : "";
}

function parseDateValue(raw) {
  const text = toText(raw);
  if (!text) return "";
  const compact = text
    .replace(/[|\\]/g, "/")
    .replace(/\s*([/-])\s*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  const direct = compact.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (direct) {
    const [, year, month, day] = direct;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const dmy = compact.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) {
    const [, day, month, year] = dmy;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const dmyShort = compact.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2})/);
  if (dmyShort) {
    const [, day, month, yearShort] = dmyShort;
    const year = Number(yearShort) >= 70 ? `19${yearShort}` : `20${yearShort}`;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const words = compact.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/i
  );
  if (words) {
    const monthIndex = [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
    ].indexOf(words[1].toLowerCase());
    if (monthIndex >= 0) {
      return `${words[3]}-${String(monthIndex + 1).padStart(2, "0")}-${String(words[2]).padStart(2, "0")}`;
    }
  }
  return "";
}

function parseBillingMonth(raw, fallbackDate = "") {
  const date = parseDateValue(raw) || toText(fallbackDate);
  if (date) return date.slice(0, 7);
  const words = toText(raw).match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i
  );
  if (words) {
    const monthIndex = [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
    ].indexOf(words[1].toLowerCase());
    if (monthIndex >= 0) {
      return `${words[2]}-${String(monthIndex + 1).padStart(2, "0")}`;
    }
  }
  return "";
}

function shiftBillingMonth(month, delta) {
  const value = toText(month);
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) return "";
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return "";
  const shifted = new Date(Date.UTC(year, monthIndex + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function parsePpwsInvoiceFields(text) {
  const normalizedText = toText(text);
  const lines = normalizedText
    .split(/\r?\n/)
    .map((line) => toText(line))
    .filter(Boolean);
  const flat = lines.join(" ");

  const invoiceNumber = firstNonEmptyMatch(flat, [
    /\b(PPWSA?\d{8,})\b/i,
    /\b(PPWNSA?\d{8,})\b/i,
  ]).replace(/^PPWNS/i, "PPWS");

  const periodMatch = flat.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/);
  const invoiceDateRaw = firstNonEmptyMatch(flat, [
    /(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2})/,
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
    /(\d{1,2}\/\d{1,2}\/\d{2})/,
  ]);
  const invoiceDate = parseDateValue(invoiceDateRaw);
  const periodBillingMonth = periodMatch ? parseBillingMonth(periodMatch[2], invoiceDate) : "";
  const billingMonth = periodBillingMonth || shiftBillingMonth(parseBillingMonth("", invoiceDate), -1);

  const m3Matches = Array.from(flat.matchAll(/(\d+(?:\.\d+)?)\s*M3\b/gi))
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0);
  const usage = m3Matches.length ? String(Math.max(...m3Matches)) : "";

  const tailLines = lines.slice(-12);
  const amountCandidates = tailLines
    .flatMap((line) => Array.from(line.matchAll(/(\d{1,3}(?:,\d{3})+(?:\.\d+)?)/g)).map((match) => match[1]))
    .map((raw) => raw.replace(/\s+/g, ""))
    .filter(Boolean);
  const amountCounts = new Map();
  for (const candidate of amountCandidates) {
    amountCounts.set(candidate, (amountCounts.get(candidate) || 0) + 1);
  }
  let amount = "";
  let bestCount = 0;
  for (const [candidate, count] of amountCounts.entries()) {
    if (count > bestCount) {
      bestCount = count;
      amount = candidate;
    }
  }
  if (!amount) {
    const fallbackAmount = flat.match(/(\d{1,3}(?:,\d{3})+(?:\.\d+)?)/);
    amount = toText(fallbackAmount && fallbackAmount[1]);
  }

  return {
    invoiceNumber,
    invoiceDate,
    billingMonth,
    usage: parseMoneyValue(usage),
    amount: parseMoneyValue(amount),
  };
}

function parseEdcInvoiceFields(text) {
  const normalizedText = toText(text);
  const lines = normalizedText
    .split(/\r?\n/)
    .map((line) => toText(line))
    .filter(Boolean);
  const flat = lines.join(" ");
  const compact = flat.replace(/\s+/g, " ").trim();
  const laterHalfIndex = Math.max(0, Math.floor(lines.length * 0.55));
  const tailStartIndex = Math.max(0, lines.length - 18);
  const usageLinePatterns = [
    /ថាមពល/i,
    /ប្រើប្រាស់/i,
    /\busage\b/i,
    /\bconsumption\b/i,
    /\bconsommation\b/i,
    /\benergy\b/i,
    /\benergie\b/i,
    /\bkwh\b/i,
    /\bkw\.?h?\b/i,
  ];
  const amountLinePatterns = [
    /ទឹកប្រាក់/i,
    /ត្រូវទូ/i,
    /\bamount\b/i,
    /\bamount\s*due\b/i,
    /\btotal\s*due\b/i,
    /\bpayable\b/i,
    /\ba\s*payer\b/i,
    /\briel\b/i,
  ];
  const moneyPattern = /(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d{5,}(?:\.\d+)?)/g;
  const matchesAnyPattern = (value, patterns) => patterns.some((pattern) => pattern.test(value));
  const getLineContext = (index) => [lines[index - 1] || "", lines[index] || "", lines[index + 1] || ""].join(" ");
  const topInvoiceLine = lines.slice(0, 4).join(" ");
  const normalizeInvoiceDigits = (value) => {
    const cleaned = toText(value).replace(/[^A-Z0-9]/gi, "");
    return /\d{7,12}/.test(cleaned) ? cleaned : "";
  };

  const invoiceNumberRaw =
    firstNonEmptyMatch(compact, [
      /\bINV\s*\/\s*([A-Z0-9]{5,})\b/i,
      /\bINV\s*\/?\s*((?:[A-Z0-9]{2,}[\s\/-]*){2,6})\b/i,
      /\bIN[VY]\s*\/?\s*([A-Z0-9]{5,})\b/i,
      /\bIN[VY]\s*\/?\s*((?:[A-Z0-9]{2,}[\s\/-]*){2,6})\b/i,
      /\b1N[VY]\s*\/?\s*([A-Z0-9]{5,})\b/i,
      /\b1N[VY]\s*\/?\s*((?:[A-Z0-9]{2,}[\s\/-]*){2,6})\b/i,
      /\bINV\s*[#:.-]?\s*([A-Z0-9]{5,})\b/i,
    ]) ||
    firstNonEmptyMatch(lines.slice(0, 3).join(" "), [
      /\bINV[^A-Z0-9]{0,4}(\d{7,10})\b/i,
      /\bINV[^A-Z0-9]{0,4}((?:\d{2,4}[\/\s-]*){2,4})\b/i,
      /\bIN[VY][^A-Z0-9]{0,4}(\d{7,10})\b/i,
      /\bIN[VY][^A-Z0-9]{0,4}((?:\d{2,4}[\/\s-]*){2,4})\b/i,
      /\b1N[VY][^A-Z0-9]{0,4}(\d{7,10})\b/i,
      /\b1N[VY][^A-Z0-9]{0,4}((?:\d{2,4}[\/\s-]*){2,4})\b/i,
    ]) ||
    firstNonEmptyMatch(lines.slice(0, 8).join(" "), [
      /\bINV\s*\/\s*([A-Z0-9]{5,})\b/i,
      /\bINV\s*\/?\s*((?:[A-Z0-9]{2,}[\s\/-]*){2,6})\b/i,
      /\bIN[VY]\s*\/?\s*([A-Z0-9]{5,})\b/i,
      /\bIN[VY]\s*\/?\s*((?:[A-Z0-9]{2,}[\s\/-]*){2,6})\b/i,
      /\b1N[VY]\s*\/?\s*([A-Z0-9]{5,})\b/i,
      /\b1N[VY]\s*\/?\s*((?:[A-Z0-9]{2,}[\s\/-]*){2,6})\b/i,
      /\bINV\s*[#:.-]?\s*([A-Z0-9]{5,})\b/i,
    ]) ||
    (() => {
      const hasInvoicePrefix = /\b(?:inv|iny|1nv|1ny)\b/i.test(topInvoiceLine);
      if (!hasInvoicePrefix) return "";
      const digits = firstNonEmptyMatch(topInvoiceLine, [
        /\b(?:inv|iny|1nv|1ny)[^0-9]{0,6}(\d{7,10})\b/i,
        /\b(?:inv|iny|1nv|1ny)[^0-9]{0,6}((?:\d{2,4}[\/\s-]*){2,4})\b/i,
        /\b(\d{7,10})\b/,
      ]);
      return digits;
    })();
  const invoiceNumberDigits = normalizeInvoiceDigits(invoiceNumberRaw);
  const invoiceNumber = invoiceNumberDigits ? `INV/${invoiceNumberDigits}` : "";
  const invoiceDigits = invoiceNumber.replace(/\D/g, "");

  const dateMatches = lines.flatMap((line, index) =>
    Array.from(line.matchAll(/(\d{1,2}\s*[\/-]\s*\d{1,2}\s*[\/-]\s*\d{2,4})/g))
      .map((match) => ({
        raw: match[1],
        parsed: parseDateValue(match[1]),
        index,
      }))
      .filter((entry) => entry.parsed)
  );
  const repeatedTailDateScores = new Map();
  for (const entry of dateMatches) {
    if (entry.index < laterHalfIndex) continue;
    const current = repeatedTailDateScores.get(entry.parsed) || { count: 0, index: -1 };
    repeatedTailDateScores.set(entry.parsed, {
      count: current.count + 1,
      index: Math.max(current.index, entry.index),
    });
  }
  let invoiceDate = "";
  const repeatedTailDates = Array.from(repeatedTailDateScores.entries())
    .filter(([, meta]) => meta.count >= 2)
    .sort((a, b) => b[1].count - a[1].count || b[1].index - a[1].index);
  if (repeatedTailDates.length) {
    invoiceDate = repeatedTailDates[0][0];
  }
  if (!invoiceDate) {
    const tailDate = [...dateMatches].reverse().find((entry) => entry.index >= laterHalfIndex);
    invoiceDate = tailDate ? tailDate.parsed : "";
  }
  if (!invoiceDate) {
    invoiceDate = dateMatches.length ? dateMatches[dateMatches.length - 1].parsed : "";
  }

  const periodMatch = flat.match(
    /(\d{1,2}\s*[\/-]\s*\d{1,2}\s*[\/-]\s*\d{2,4})\s*(?:to|-|~|–)\s*(\d{1,2}\s*[\/-]\s*\d{1,2}\s*[\/-]\s*\d{2,4})/i
  );
  const periodBillingMonth = periodMatch ? parseBillingMonth(periodMatch[2], invoiceDate) : "";
  const invoiceMonth = parseBillingMonth("", invoiceDate);
  const billingMonth = periodBillingMonth || shiftBillingMonth(invoiceMonth, -1);

  let usage = "";
  const preciseKwhCandidates = lines.flatMap((line, index) =>
    Array.from(line.matchAll(/\b(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*kwh\b/gi))
      .map((match) => ({
        raw: match[1],
        value: Number(match[1].replace(/,/g, "")),
        index,
      }))
      .filter((entry) => Number.isFinite(entry.value) && entry.value > 0)
  );
  const strongLabeledUsageCandidates = lines
    .flatMap((line, index) => {
      const context = getLineContext(index);
      if (!matchesAnyPattern(context, usageLinePatterns)) return [];
      return Array.from(context.matchAll(/\b(\d{1,3}(?:,\d{3})+|\d{3,4}(?:\.\d+)?)\b/g)).map((match) => {
        const raw = match[1];
        const value = Number(raw.replace(/,/g, ""));
        let score = 0;
        if (!Number.isFinite(value) || value <= 0) return null;
        if (value >= 500 && value <= 10000) score += 8;
        else if (value >= 100 && value < 500) score += 2;
        else score -= 8;
        if (raw.includes(",")) score += 4;
        if (!raw.includes(".") && value >= 500) score += 3;
        if (index >= laterHalfIndex) score += 3;
        if (index >= tailStartIndex) score += 2;
        if (matchesAnyPattern(line, usageLinePatterns)) score += 5;
        if (matchesAnyPattern(context, usageLinePatterns)) score += 4;
        if (/\./.test(raw) && value < 500 && index < laterHalfIndex) score -= 12;
        if (/\b(?:amount|riel|payable|invoice|inv|total|tax|vat|id|rd)\b/i.test(context)) score -= 6;
        if (invoiceDigits && raw.replace(/\D/g, "") === invoiceDigits) score -= 10;
        if (/\d{1,2}\s*[/-]\s*\d{1,2}\s*[/-]\s*\d{2,4}/.test(context)) score -= 4;
        return {
          raw,
          value,
          index,
          score,
        };
      });
    })
    .filter(Boolean);
  if (strongLabeledUsageCandidates.length) {
    strongLabeledUsageCandidates.sort((a, b) => b.score - a.score || b.index - a.index || b.value - a.value);
    if (strongLabeledUsageCandidates[0].score >= 10) {
      usage = String(strongLabeledUsageCandidates[0].value);
    }
  }
  const commaUsageCandidates = lines
    .flatMap((line, index) => {
      const context = getLineContext(index);
      return Array.from(line.matchAll(/\b(\d{1,3}(?:,\d{3})+)\b/g)).map((match) => {
        const raw = match[1];
        const value = Number(raw.replace(/,/g, ""));
        let score = 0;
        if (!Number.isFinite(value) || value < 500 || value > 10000) return null;
        score += 8;
        if (index >= laterHalfIndex) score += 4;
        if (index >= tailStartIndex) score += 3;
        if (matchesAnyPattern(line, usageLinePatterns)) score += 6;
        if (matchesAnyPattern(context, usageLinePatterns)) score += 5;
        if (!/\./.test(raw)) score += 2;
        if (/\b(?:amount|riel|payable|invoice|inv|total|tax|vat)\b/i.test(context)) score -= 6;
        if (/\b(?:id|location|rd|code|barcode|account)\b/i.test(context)) score -= 8;
        if (/\d{1,2}\s*[/-]\s*\d{1,2}\s*[/-]\s*\d{2,4}/.test(context)) score -= 4;
        if (invoiceDigits && raw.replace(/\D/g, "") === invoiceDigits) score -= 10;
        return {
          raw,
          value,
          index,
          score,
        };
      });
    })
    .filter(Boolean);
  if (!usage && commaUsageCandidates.length) {
    commaUsageCandidates.sort((a, b) => b.score - a.score || b.index - a.index || b.value - a.value);
    if (commaUsageCandidates[0].score >= 8) {
      usage = String(commaUsageCandidates[0].value);
    }
  }
  const smallDecimalKwhCandidates = preciseKwhCandidates.filter(
    (entry) => /\./.test(entry.raw) && entry.value >= 1 && entry.value <= 500 && entry.index >= laterHalfIndex
  );
  if (!usage && smallDecimalKwhCandidates.length) {
    smallDecimalKwhCandidates.sort((a, b) => b.index - a.index || a.value - b.value);
    usage = String(smallDecimalKwhCandidates[0].value);
  }
  const labeledUsageCandidates = lines
    .flatMap((line, index) =>
      Array.from(line.matchAll(/(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*kwh\b/gi)).map((match) => {
        const value = Number(match[1].replace(/,/g, ""));
        const context = getLineContext(index);
        let score = 0;
        if (!Number.isFinite(value) || value <= 0) return null;
        if (value >= 20 && value <= 5000) score += 5;
        else score -= 6;
        if (/\./.test(match[1]) && value <= 500) score += 2;
        if (index >= laterHalfIndex) score += 4;
        if (index >= tailStartIndex) score += 3;
        if (matchesAnyPattern(line, usageLinePatterns)) score += 5;
        if (matchesAnyPattern(context, usageLinePatterns)) score += 3;
        if (/\./.test(match[1]) && value < 500 && index < laterHalfIndex) score -= 10;
        if (/\d{1,2}\s*[/-]\s*\d{1,2}\s*[/-]\s*\d{2,4}/.test(line) && !/kwh/i.test(line)) score -= 2;
        return {
          raw: match[1],
          value,
          index,
          score,
        };
      })
    )
    .filter(Boolean);
  if (!usage && labeledUsageCandidates.length) {
    labeledUsageCandidates.sort((a, b) => b.score - a.score || b.index - a.index || a.value - b.value);
    if (labeledUsageCandidates[0].score >= 6) {
      usage = String(labeledUsageCandidates[0].value);
    }
  }
  if (!usage) {
    const kwhCandidates = preciseKwhCandidates;
    const likelyUsageCandidates = kwhCandidates.filter(
      (entry) => entry.index >= laterHalfIndex && entry.value >= 20 && entry.value <= 5000
    );
    if (likelyUsageCandidates.length) {
      likelyUsageCandidates.sort((a, b) => b.index - a.index || a.value - b.value);
      usage = String(likelyUsageCandidates[0].value);
    }
  }
  if (!usage) {
    const numericUsageCandidates = lines
      .flatMap((line, index) => {
        const context = getLineContext(index);
        if (!matchesAnyPattern(context, usageLinePatterns)) return [];
        return Array.from(context.matchAll(/\b(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\b/g)).map((match) => {
          const value = Number(match[1].replace(/,/g, ""));
          let score = 0;
          if (!Number.isFinite(value) || value <= 0) return null;
          if (value >= 10 && value <= 5000) score += 5;
          else score -= 6;
          if (index >= laterHalfIndex) score += 3;
          if (index >= tailStartIndex) score += 2;
          if (matchesAnyPattern(line, usageLinePatterns)) score += 4;
          if (/\b(?:amount|riel|payable|invoice|inv)\b/i.test(context)) score -= 4;
          return {
            value,
            index,
            score,
          };
        });
      })
      .filter(Boolean);
    if (numericUsageCandidates.length) {
      numericUsageCandidates.sort((a, b) => b.score - a.score || b.index - a.index || a.value - b.value);
      if (numericUsageCandidates[0].score >= 5) {
        usage = String(numericUsageCandidates[0].value);
      }
    }
  }
  if (!usage) {
    const broadUsageCandidates = lines
      .flatMap((line, index) => {
        const context = getLineContext(index);
        return Array.from(line.matchAll(/\b(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d{2,4}(?:\.\d+)?)\b/g)).map((match) => {
          const raw = match[1];
          const value = Number(raw.replace(/,/g, ""));
          let score = 0;
          if (!Number.isFinite(value) || value < 30 || value > 5000) return null;
          if (value >= 1000 && value <= 4000) score += 7;
          else if (value >= 100 && value <= 2500) score += 4;
          else score += 1;
          if (index >= laterHalfIndex) score += 3;
          if (index >= tailStartIndex) score += 2;
          if (raw.includes(",")) score += 5;
          if (!raw.includes(".") && value >= 500) score += 2;
          if (matchesAnyPattern(line, usageLinePatterns)) score += 5;
          if (matchesAnyPattern(context, usageLinePatterns)) score += 3;
          if (/\b(?:amount|riel|payable|invoice|inv|total|tax|vat)\b/i.test(context)) score -= 5;
          if (/\b(?:id|location|rd|code|barcode|account)\b/i.test(context)) score -= 8;
          if (/\d{1,2}\s*[/-]\s*\d{1,2}\s*[/-]\s*\d{2,4}/.test(line)) score -= 6;
          if (/\b20\d{2}\b/.test(raw)) score -= 4;
          if (invoiceNumber && raw.replace(/\D/g, "").length >= 6) score -= 6;
          return {
            raw,
            value,
            index,
            score,
          };
        });
      })
      .filter(Boolean);
    if (broadUsageCandidates.length) {
      const mergedUsageCandidates = new Map();
      for (const candidate of broadUsageCandidates) {
        const current = mergedUsageCandidates.get(candidate.raw) || {
          score: Number.NEGATIVE_INFINITY,
          index: -1,
          value: candidate.value,
          count: 0,
        };
        mergedUsageCandidates.set(candidate.raw, {
          score: Math.max(current.score, candidate.score),
          index: Math.max(current.index, candidate.index),
          value: candidate.value,
          count: current.count + 1,
        });
      }
      const rankedUsageCandidates = Array.from(mergedUsageCandidates.entries()).sort(
        (a, b) =>
          b[1].score - a[1].score || b[1].count - a[1].count || b[1].index - a[1].index || a[1].value - b[1].value
      );
      if (rankedUsageCandidates.length && rankedUsageCandidates[0][1].score >= 6) {
        usage = String(rankedUsageCandidates[0][1].value);
      }
    }
  }

  let amount = "";
  const labeledAmountCandidates = lines
    .flatMap((line, index) => {
      const context = getLineContext(index);
      return Array.from(line.matchAll(moneyPattern)).map((match) => {
        const raw = match[1].replace(/\s+/g, "");
        const value = Number(raw.replace(/,/g, ""));
        let score = 0;
        if (!Number.isFinite(value) || value < 10000) return null;
        if (index >= laterHalfIndex) score += 3;
        if (index >= tailStartIndex) score += 5;
        if (matchesAnyPattern(line, amountLinePatterns)) score += 7;
        if (matchesAnyPattern(context, amountLinePatterns)) score += 5;
        if (value >= 100000) score += 2;
        if (value > 50000000) score -= 3;
        if (!raw.includes(",") && value >= 1000000) score -= 4;
        if (invoiceDigits && raw.replace(/\D/g, "") === invoiceDigits) score -= 8;
        if (/\bid\b/i.test(context) || /\brd\b/i.test(context)) score -= 4;
        return {
          raw,
          value,
          index,
          score,
        };
      });
    })
    .filter(Boolean);
  if (labeledAmountCandidates.length) {
    const mergedAmountCandidates = new Map();
    for (const candidate of labeledAmountCandidates) {
      const current = mergedAmountCandidates.get(candidate.raw) || {
        score: Number.NEGATIVE_INFINITY,
        index: -1,
        value: candidate.value,
        count: 0,
      };
      mergedAmountCandidates.set(candidate.raw, {
        score: Math.max(current.score, candidate.score),
        index: Math.max(current.index, candidate.index),
        value: candidate.value,
        count: current.count + 1,
      });
    }
    const rankedAmounts = Array.from(mergedAmountCandidates.entries()).sort(
      (a, b) =>
        b[1].score - a[1].score || b[1].count - a[1].count || b[1].index - a[1].index || b[1].value - a[1].value
    );
    if (rankedAmounts.length && rankedAmounts[0][1].score >= 8) {
      amount = rankedAmounts[0][0];
    }
  }
  if (!amount) {
    const tailLines = lines.slice(-14);
    const tailAmountCandidates = tailLines
      .flatMap((line, index) =>
        Array.from(line.matchAll(/(\d{1,3}(?:,\d{3})+(?:\.\d+)?)/g)).map((match) => ({
          raw: match[1].replace(/\s+/g, ""),
          index,
        }))
      )
      .map((entry) => ({
        ...entry,
        value: Number(entry.raw.replace(/,/g, "")),
      }))
      .filter((entry) =>
        Number.isFinite(entry.value) &&
        entry.value >= 1000 &&
        entry.raw.includes(",") &&
        (!invoiceDigits || entry.raw.replace(/\D/g, "") !== invoiceDigits)
      );
    const amountCounts = new Map();
    for (const candidate of tailAmountCandidates) {
      const current = amountCounts.get(candidate.raw) || { count: 0, index: -1, value: candidate.value };
      amountCounts.set(candidate.raw, {
        count: current.count + 1,
        index: Math.max(current.index, candidate.index),
        value: candidate.value,
      });
    }
    const rankedTailAmounts = Array.from(amountCounts.entries()).sort(
      (a, b) => b[1].count - a[1].count || b[1].index - a[1].index || b[1].value - a[1].value
    );
    if (rankedTailAmounts.length) {
      amount = rankedTailAmounts[0][0];
    }
  }
  if (!amount) {
    const currencyCandidates = Array.from(flat.matchAll(/(\d{1,3}(?:,\d{3})+(?:\.\d+)?)/g))
      .map((match) => match[1].replace(/\s+/g, ""))
      .filter(Boolean)
      .map((raw, index) => ({
        raw,
        index,
        value: Number(raw.replace(/,/g, "")),
      }))
      .filter((entry) =>
        Number.isFinite(entry.value) &&
        entry.value >= 1000 &&
        entry.raw.includes(",") &&
        (!invoiceDigits || entry.raw.replace(/\D/g, "") !== invoiceDigits)
      );
    if (currencyCandidates.length) {
      currencyCandidates.sort((a, b) => b.index - a.index || b.value - a.value);
      amount = currencyCandidates[0].raw;
    }
  }

  return {
    invoiceNumber,
    invoiceDate,
    billingMonth,
    usage: parseMoneyValue(usage),
    amount: parseMoneyValue(amount),
  };
}

function detectCampusFromUtilityInvoiceText(text) {
  const normalizedText = toText(text);
  if (!normalizedText) return "";
  const flat = normalizedText.replace(/\s+/g, " ").trim();
  const normalizedFlat = flat
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  const hasStreet242 = /\bstreet\s*242\b/i.test(normalizedFlat);
  const hasDaunPenh = /\bdaun\s*penh\b/i.test(normalizedFlat) || /\bdoun\s*penh\b/i.test(normalizedFlat);
  const hasC22AddressMarker =
    /\b(?:#\s*)?63\s*(?:32p)?\b/i.test(normalizedFlat) ||
    /\b(?:#\s*)?65\s*(?:63p)?\b/i.test(normalizedFlat) ||
    /\beo\s*[-/]?\s*63\b/i.test(normalizedFlat) ||
    /\beo\s*[-/]?\s*65\b/i.test(normalizedFlat) ||
    /\b32p\b/i.test(normalizedFlat) ||
    /\b63p\b/i.test(normalizedFlat);
  if (hasStreet242 && hasDaunPenh && hasC22AddressMarker) {
    return "Chaktomuk Campus (C2.2)";
  }

  const hasChbarAmpovLike =
    /\bchbar\s*amp(?:a?u?v|ou?v|ul)\b/i.test(normalizedFlat) ||
    /\bchba?r\s*amp(?:a?u?v|ou?v|ul)\b/i.test(normalizedFlat);
  const hasPhlavLumLike =
    /\bphla?u?v?\s*lum\b/i.test(normalizedFlat) ||
    /\bphlu?v\s*lum\b/i.test(normalizedFlat);
  const hasUnPhollaName =
    /\bun\s*pholla\b/i.test(normalizedFlat) ||
    /\bun\s*phola\b/i.test(normalizedFlat);
  const hasC3LocationCode =
    /\bp1421[-/.]?\s*2\s*001b\b/i.test(normalizedFlat) ||
    /\bp14[-/.]?\s*2\s*001b\b/i.test(normalizedFlat) ||
    /\bp14z?[-/.]?\s*001b\b/i.test(normalizedFlat);
  if (
    hasUnPhollaName ||
    (hasChbarAmpovLike && hasPhlavLumLike) ||
    (hasChbarAmpovLike && hasC3LocationCode)
  ) {
    return "Boeung Snor Campus";
  }

  const campusMatchers = [
    {
      campus: "Chaktomuk Campus",
      patterns: [
        /\bc2\.?1\b/i,
        /\bchaktomuk\b/i,
        /\bdaun\s*penh\b/i,
        /\bdoun\s*penh\b/i,
        /\beo\s*[-/]?\s*71\b/i,
        /\bstreet\s*242\b/i,
        /\bpich\s*kong\s*kunthea\b/i,
      ],
      minScore: 2,
    },
    {
      campus: "Chaktomuk Campus (C2.2)",
      patterns: [
        /\bc2\.?2\b/i,
        /\bcampus\s*2\.?2\b/i,
        /\bchaktomuk\s*campus\s*\(?c?2\.?2\)?\b/i,
      ],
      minScore: 1,
    },
    {
      campus: "Samdach Pan Campus",
      patterns: [
        /\bc1\b/i,
        /\bsamdach\s*pan\b/i,
        /\bsamdech\s*pan\b/i,
      ],
      minScore: 1,
    },
    {
      campus: "Boeung Snor Campus",
      patterns: [
        /\bc3\b/i,
        /\bboeung\s*snor\b/i,
        /\bbeung\s*snor\b/i,
        /\bun\s*pholla\b/i,
        /\bun\s*phola\b/i,
        /\bchbar\s*amp(?:a?u?v|ou?v|ul)\b/i,
        /\bchba?r\s*amp(?:a?u?v|ou?v|ul)\b/i,
        /\bphla?u?v?\s*lum\b/i,
        /\bphlu?v\s*lum\b/i,
        /\bp1421[-/.]?\s*2\s*001b\b/i,
        /\bp14[-/.]?\s*2\s*001b\b/i,
        /\bp14z?[-/.]?\s*001b\b/i,
      ],
      minScore: 1,
    },
    {
      campus: "Veng Sreng Campus",
      patterns: [
        /\bc4\b/i,
        /\bveng\s*sreng\b/i,
      ],
      minScore: 1,
    },
  ];

  let bestCampus = "";
  let bestScore = 0;
  for (const matcher of campusMatchers) {
    const score = matcher.patterns.reduce(
      (sum, pattern) => sum + (pattern.test(normalizedFlat) ? 1 : 0),
      0
    );
    if (score >= matcher.minScore && score > bestScore) {
      bestScore = score;
      bestCampus = matcher.campus;
    }
  }
  return bestCampus;
}

function detectUtilityInvoiceLocationDetail(text, campus = "") {
  const normalizedText = toText(text);
  if (!normalizedText) return "";
  const flat = normalizedText
    .replace(/\s+/g, " ")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (campus === "Chaktomuk Campus (C2.2)") {
    if (
      /\b(?:#\s*)?63\b/i.test(flat) ||
      /\beo\s*[-/]?\s*63\b/i.test(flat) ||
      /\b32p\b/i.test(flat)
    ) {
      return "#63 (32P)";
    }
    if (
      /\b(?:#\s*)?65\b/i.test(flat) ||
      /\beo\s*[-/]?\s*65\b/i.test(flat) ||
      /\b63p\b/i.test(flat)
    ) {
      return "#65 (63P)";
    }
  }

  return "";
}

function parseUtilityInvoiceFromOcrText(utilityType, text) {
  const normalizedText = toText(text);
  const flat = normalizedText.replace(/\s+/g, " ").trim();
  const utility = toUpper(utilityType) === "PPWS" ? "PPWS" : "EDC";
  const detectedCampus = detectCampusFromUtilityInvoiceText(normalizedText);
  const detectedLocation = detectUtilityInvoiceLocationDetail(normalizedText, detectedCampus);
  if (utility === "PPWS") {
    const ppws = parsePpwsInvoiceFields(normalizedText);
    const warnings = [];
    if (!ppws.usage) warnings.push("Usage could not be detected from the PPWS invoice image.");
    if (!ppws.amount) warnings.push("Amount could not be detected from the PPWS invoice image.");
    if (!ppws.invoiceDate) warnings.push("Invoice date could not be detected from the PPWS invoice image.");
    return {
      utilityType: utility,
      providerName: "Phnom Penh Water Supply Authority",
      usage: ppws.usage,
      amount: ppws.amount,
      invoiceNumber: ppws.invoiceNumber,
      invoiceDate: ppws.invoiceDate,
      billingMonth: ppws.billingMonth,
      campus: detectedCampus,
      location: detectedLocation,
      rawText: normalizedText,
      warnings,
    };
  }
  const edc = parseEdcInvoiceFields(normalizedText);
  const warnings = [];
  if (!edc.usage) warnings.push("Usage could not be detected from the EDC invoice image.");
  if (!edc.amount) warnings.push("Amount could not be detected from the EDC invoice image.");
  if (!edc.invoiceDate) warnings.push("Invoice date could not be detected from the EDC invoice image.");
  return {
    utilityType: utility,
    providerName: "Electricite du Cambodge",
    usage: edc.usage,
    amount: edc.amount,
    invoiceNumber: edc.invoiceNumber,
    invoiceDate: edc.invoiceDate,
    billingMonth: edc.billingMonth,
    campus: detectedCampus,
    location: detectedLocation,
    rawText: normalizedText,
    warnings,
  };
}

function parsePrinterCounterFromOcrText(text, lineInput = []) {
  const normalizedText = toText(text);
  const lines = (Array.isArray(lineInput) && lineInput.length ? lineInput : normalizedText.split(/\r?\n/))
    .map((line) => toText(line).replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const flat = lines.join(" ");
  const warnings = [];
  const printerTypeCodes = new Set(["101", "102", "106", "109"]);
  const lowerFlat = flat.toLowerCase();

  function normalizeCounterOcrLine(line) {
    return toText(line)
      .replace(/\s+/g, " ")
      .replace(/[|]/g, "1")
      .replace(/tota[!i1l]/gi, "total")
      .replace(/tota\b/gi, "total")
      .replace(/\btofal\b/gi, "total")
      .replace(/\b10z\b/gi, "102")
      .replace(/\b1o2\b/gi, "102")
      .replace(/\bl02\b/gi, "102")
      .replace(/\b2o\b/gi, "20")
      .trim();
  }

  const normalizedLines = lines.map((line) => normalizeCounterOcrLine(line));

  function extractCounterValue(line) {
    const source = String(line || "");
    const values = [
      ...(source.match(/\d(?:[\d,\s]{2,}\d)/g) || []).map((value) => value.replace(/[,\s]/g, "").trim()),
      ...(source.match(/\d[\d,]*/g) || []).map((value) => value.replace(/,/g, "").trim()),
    ];
    const normalized = values
      .filter(Boolean)
      .filter((value) => !printerTypeCodes.has(value))
      .filter((value) => value.length >= 4);
    return normalized.length ? normalized[normalized.length - 1] : "";
  }

  const total2Patterns = [
    /(?:^|\b)102\s*[:.\-]?\s*total\s*2\b[^0-9]{0,30}(\d[\d,]{3,})/i,
    /\btotal\s*2\b[^0-9]{0,30}(\d[\d,]{3,})/i,
  ];
  let currentMono = "";
  for (const pattern of total2Patterns) {
    const match = flat.match(pattern);
    if (match && match[1]) {
      currentMono = match[1].replace(/,/g, "");
      break;
    }
  }

  if (!currentMono) {
    const targetLinePattern = /\b102\b.*\btotal\s*2\b|\btotal\s*2\b.*\b102\b|\b102\b|\btotal\s*2\b/i;
    const otherTypePattern = /\b(?:101|106|109)\b.*\btotal\b/i;

    for (let i = 0; i < normalizedLines.length; i += 1) {
      const line = normalizedLines[i];
      if (!targetLinePattern.test(line)) continue;

      const sameLineValue = extractCounterValue(line);
      if (sameLineValue) {
        currentMono = sameLineValue;
        break;
      }

      for (let offset = 1; offset <= 3; offset += 1) {
        const nearby = normalizedLines[i + offset] || "";
        if (!nearby) continue;
        if (otherTypePattern.test(nearby)) break;
        const nearbyValue = extractCounterValue(nearby);
        if (nearbyValue) {
          currentMono = nearbyValue;
          break;
        }
      }
      if (currentMono) break;
    }
  }

  if (!currentMono) {
    for (let i = 0; i < normalizedLines.length - 1; i += 1) {
      const joined = `${normalizedLines[i]} ${normalizedLines[i + 1]}`.trim();
      if (!/\b102\b.*\btotal\s*2\b|\btotal\s*2\b.*\b102\b|\btotal\s*2\b/i.test(joined)) continue;
      const joinedValue = extractCounterValue(joined);
      if (joinedValue) {
        currentMono = joinedValue;
        break;
      }
    }
  }

  if (!currentMono) {
    const possibleValues = normalizedLines
      .flatMap((line, index) => {
        const value = extractCounterValue(line);
        if (!value) return [];
        return [{ value, index, line }];
      })
      .filter((entry) => Number(entry.value) > 999);

    const total2Indexes = normalizedLines
      .map((line, index) => (/\b102\b.*\btotal\s*2\b|\btotal\s*2\b.*\b102\b|\btotal\s*2\b/i.test(line) ? index : -1))
      .filter((index) => index >= 0);

    for (const targetIndex of total2Indexes) {
      const nearest = possibleValues.find((entry) => Math.abs(entry.index - targetIndex) <= 2);
      if (nearest) {
        currentMono = nearest.value;
        break;
      }
    }
  }

  if (
    !currentMono &&
    (
      lowerFlat.includes("it and facility control center") ||
      lowerFlat.includes("read counter image") ||
      lowerFlat.includes("save monthly counter") ||
      lowerFlat.includes("rental printer")
    )
  ) {
    warnings.push("Uploaded image looks like the IT Control Center screen, not the Canon Check Counter page. Please upload the printer counter screenshot itself.");
  }

  if (!currentMono) {
    warnings.push("Total 2 could not be detected from the printer screenshot.");
  }

  return {
    currentMono: currentMono ? String(Number(currentMono)) : "",
    rawText: normalizedText,
    warnings,
  };
}

function stripHtmlToText(html) {
  return toText(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePrinterCounterFromHtml(html) {
  const rawHtml = toText(html);
  const text = stripHtmlToText(rawHtml);
  const warnings = [];

  const total2Patterns = [
    /(?:^|\b)102\s*[:.\-]?\s*total\s*2\b[^0-9]{0,30}(\d{2,})/i,
    /\btotal\s*2\b[^0-9]{0,30}(\d{2,})/i,
  ];
  let currentMono = "";
  for (const pattern of total2Patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      currentMono = match[1];
      break;
    }
  }

  if (!currentMono) {
    warnings.push("Total 2 could not be detected from the printer page.");
  }
  if (/login user|login|log out/i.test(text) && !/check counter/i.test(text)) {
    warnings.push("Printer page may require login before the counter can be read.");
  }

  const updatedMatch = text.match(/last updated\s*[:\-]?\s*([0-9/: ]+(?:AM|PM)?)/i);

  return {
    currentMono: currentMono ? String(Number(currentMono)) : "",
    updatedAt: updatedMatch ? updatedMatch[1].trim() : "",
    rawText: text,
    warnings,
  };
}

function decodeHtmlEntities(text) {
  return toText(text)
    .replace(/&#13;/gi, "\n")
    .replace(/&#10;/gi, "\n")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function parseInputFields(html) {
  const out = {};
  const source = toText(html);
  const regex = /<input\b([^>]+)>/gi;
  let match;
  while ((match = regex.exec(source))) {
    const attrs = match[1];
    const nameMatch = attrs.match(/\bname\s*=\s*"([^"]+)"/i) || attrs.match(/\bname\s*=\s*'([^']+)'/i);
    if (!nameMatch || !nameMatch[1]) continue;
    const valueMatch = attrs.match(/\bvalue\s*=\s*"([\s\S]*?)"/i) || attrs.match(/\bvalue\s*=\s*'([\s\S]*?)'/i);
    out[nameMatch[1]] = decodeHtmlEntities(valueMatch && valueMatch[1] ? valueMatch[1] : "");
  }
  return out;
}

function getCookieHeader(cookieJar) {
  if (!cookieJar || !(cookieJar instanceof Map) || !cookieJar.size) return "";
  return Array.from(cookieJar.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

function storeResponseCookies(cookieJar, setCookieHeader) {
  if (!cookieJar || !(cookieJar instanceof Map)) return;
  const cookieRows = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : (setCookieHeader ? [setCookieHeader] : []);
  for (const row of cookieRows) {
    const firstPart = String(row || "").split(";")[0];
    const eqIndex = firstPart.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = firstPart.slice(0, eqIndex).trim();
    const value = firstPart.slice(eqIndex + 1).trim();
    if (!key) continue;
    cookieJar.set(key, value);
  }
}

async function requestTextUrl(rawUrl, options = {}) {
  const {
    method = "GET",
    headers = {},
    body = "",
    cookieJar = null,
    redirectCount = 0,
    referer = "",
  } = options;
  const parsed = new URL(rawUrl);
  const transport = parsed.protocol === "https:" ? https : http;
  const requestHeaders = {
    "User-Agent": "ECO-IT-Control-Center/1.0",
    Accept: "text/html,application/xhtml+xml",
    ...headers,
  };
  const cookieHeader = getCookieHeader(cookieJar);
  if (cookieHeader && !requestHeaders.Cookie) requestHeaders.Cookie = cookieHeader;
  if (referer && !requestHeaders.Referer) requestHeaders.Referer = referer;

  return new Promise((resolve, reject) => {
    const req = transport.request(
      parsed,
      {
        method,
        timeout: 8000,
        headers: requestHeaders,
      },
      (res) => {
        storeResponseCookies(cookieJar, res.headers["set-cookie"]);
        const status = Number(res.statusCode || 0);
        if ([301, 302, 303, 307, 308].includes(status) && res.headers.location && redirectCount < 5) {
          const nextUrl = new URL(res.headers.location, parsed).toString();
          res.resume();
          requestTextUrl(nextUrl, {
            method: status === 303 ? "GET" : method,
            headers,
            body: status === 303 ? "" : body,
            cookieJar,
            redirectCount: redirectCount + 1,
            referer: rawUrl,
          }).then(resolve).catch(reject);
          return;
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => resolve({
          status,
          url: rawUrl,
          body: Buffer.concat(chunks).toString("utf8"),
          headers: res.headers,
        }));
      }
    );
    req.on("timeout", () => req.destroy(new Error("Printer page request timed out.")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function resolvePrinterCredentialProfile(context) {
  const campus = toText(context && context.campus);
  if (campus === "Samdach Pan Campus" || campus === "C1") {
    return {
      username: PRINTER_LOGIN_CAMPUS1_USERNAME,
      password: PRINTER_LOGIN_CAMPUS1_PASSWORD,
      loginType: "rsa",
    };
  }
  if (campus === "Chaktomuk Campus" || campus === "C2" || campus === "C2.1") {
    return {
      username: PRINTER_LOGIN_CAMPUS21_USERNAME,
      password: PRINTER_LOGIN_CAMPUS21_PASSWORD,
      loginType: "rsa",
    };
  }
  if (campus === "Chaktomuk Campus (C2.2)" || campus === "C2.2") {
    return {
      username: PRINTER_LOGIN_CAMPUS22_USERNAME,
      password: PRINTER_LOGIN_CAMPUS22_PASSWORD,
      loginType: "rsa",
    };
  }
  if (campus === "Boeung Snor Campus" || campus === "C3") {
    return {
      username: PRINTER_LOGIN_CAMPUS3_USERNAME,
      password: PRINTER_LOGIN_CAMPUS3_PASSWORD,
      loginType: "dept",
    };
  }
  return { username: "", password: "", loginType: "" };
}

function encryptCanonLoginPassword(password, challenge, publicKeyPem) {
  const normalizedKey = toText(publicKeyPem).replace(/\r\n/g, "\n").trim();
  if (!normalizedKey || !challenge) return "";
  return crypto.publicEncrypt(
    {
      key: normalizedKey,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(`${password}${challenge}`, "utf8")
  ).toString("base64");
}

async function loginPrinterSession(baseUrl, context, cookieJar) {
  const credentials = resolvePrinterCredentialProfile(context);
  if (!credentials.username || !credentials.password) return null;
  const targetUrl = new URL("/rps/dcounter.cgi", baseUrl).toString();
  const loginPage = await requestTextUrl(targetUrl, { cookieJar });
  const loginHtml = toText(loginPage.body);
  const fields = parseInputFields(loginHtml);

  if (/name\s*=\s*"deptid"/i.test(loginHtml) || /DepartmentID Authentication/i.test(loginHtml) || credentials.loginType === "dept") {
    const body = new URLSearchParams({
      uri: fields.uri || "/rps/dcounter.cgi",
      user_type_generic: "",
      deptid: credentials.username,
      password: credentials.password,
    }).toString();
    await requestTextUrl(new URL("/login", baseUrl).toString(), {
      method: "POST",
      cookieJar,
      body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
      },
      referer: targetUrl,
    });
    await requestTextUrl(new URL("/", baseUrl).toString(), { cookieJar, referer: targetUrl });
    return { loginType: "dept" };
  }

  if (/name\s*=\s*"USERNAME"/i.test(loginHtml) || /User Authentication/i.test(loginHtml) || credentials.loginType === "rsa") {
    const encryptedPassword = encryptCanonLoginPassword(
      credentials.password,
      fields.CHALLENGE || "",
      fields.PK || ""
    );
    const body = new URLSearchParams({
      CHALLENGE: fields.CHALLENGE || "",
      URI: fields.URI || "/rps/dcounter.cgi",
      policy: fields.policy || "",
      DOMAIN: fields.DOMAIN || "",
      admin: fields.admin || "",
      GUEST: "",
      PASSWORD: encryptedPassword,
      USERNAME: credentials.username,
    }).toString();
    await requestTextUrl(new URL("/login", baseUrl).toString(), {
      method: "POST",
      cookieJar,
      body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
      },
      referer: targetUrl,
    });
    await requestTextUrl(new URL("/", baseUrl).toString(), { cookieJar, referer: targetUrl });
    return { loginType: "rsa" };
  }

  return null;
}

async function tryReadCounterPage(baseUrl, cookieJar) {
  const directCandidates = [
    new URL("/rps/dcounter.cgi", baseUrl).toString(),
    new URL(`/rps/dcounter.cgi?CorePGTAG=14&Dummy=${Date.now()}`, baseUrl).toString(),
  ];
  let sysmonitorUrl = "";
  try {
    const sysmonitorRes = await requestTextUrl(new URL("/sysmonitor", baseUrl).toString(), { cookieJar });
    sysmonitorUrl = toText(sysmonitorRes.url);
    const cgiMatch = toText(sysmonitorRes.body).match(/cgi_str\s*:\s*"\.\/dcounter\.cgi\?CorePGTAG=14"/i);
    if (cgiMatch) {
      directCandidates.unshift(new URL(`/rps/dcounter.cgi?CorePGTAG=14&Dummy=${Date.now()}`, baseUrl).toString());
    }
  } catch {
    // Ignore. We'll still try direct URLs.
  }

  let lastParsed = null;
  for (const candidateUrl of Array.from(new Set(directCandidates))) {
    const response = await requestTextUrl(candidateUrl, {
      cookieJar,
      referer: sysmonitorUrl || new URL("/", baseUrl).toString(),
    });
    const parsed = parsePrinterCounterFromHtml(response.body);
    if (parsed.currentMono) {
      return { ...parsed, sourceUrl: candidateUrl };
    }
    lastParsed = { ...parsed, sourceUrl: candidateUrl };
  }
  return lastParsed;
}

async function fetchPrinterCounterFromIp(rawIpAddress, context = {}) {
  const normalized = String(rawIpAddress || "").trim();
  if (!normalized) {
    throw new Error("Printer IP / Web Address is required.");
  }
  const baseUrl = /^https?:\/\//i.test(normalized) ? normalized : `http://${normalized}`;
  const parsedBase = new URL(baseUrl);
  const cookieJar = new Map();
  const directRead = await tryReadCounterPage(parsedBase, cookieJar).catch(() => null);
  if (directRead && directRead.currentMono) {
    return directRead;
  }

  let loginAttempted = false;
  try {
    const loginResult = await loginPrinterSession(parsedBase, context, cookieJar);
    loginAttempted = Boolean(loginResult);
  } catch {
    loginAttempted = true;
  }

  const authenticatedRead = await tryReadCounterPage(parsedBase, cookieJar).catch(() => null);
  if (authenticatedRead && authenticatedRead.currentMono) {
    return authenticatedRead;
  }

  const warnings = Array.isArray(authenticatedRead && authenticatedRead.warnings)
    ? authenticatedRead.warnings.slice()
    : [];
  if (loginAttempted) {
    warnings.push("Stored printer login was tried, but Canon still did not return 102 : Total 2.");
  } else {
    warnings.push("No stored printer login is configured for this campus.");
  }
  throw new Error(
    warnings.filter(Boolean).join(" ") || "Could not read printer counter from IP."
  );
}

async function runUtilityInvoiceOcr(imagePath) {
  const canUseSwiftOcr =
    process.platform === "darwin" &&
    (await fileExists(UTILITY_INVOICE_OCR_SCRIPT));
  if (canUseSwiftOcr) {
    const { stdout, stderr } = await execFileAsync("swift", [UTILITY_INVOICE_OCR_SCRIPT, imagePath], {
      maxBuffer: 10 * 1024 * 1024,
    });
    if (stderr && stderr.trim()) {
      console.warn("[utility-ocr]", stderr.trim());
    }
    const parsed = JSON.parse(stdout || "{}");
    return {
      text: toText(parsed.text),
      lines: Array.isArray(parsed.lines) ? parsed.lines.map((line) => toText(line)).filter(Boolean) : [],
    };
  }

  if (!Tesseract || typeof Tesseract.recognize !== "function") {
    throw new Error("Invoice OCR helper is not available on this server.");
  }

  const result = await Tesseract.recognize(imagePath, "eng");
  const data = result && result.data && typeof result.data === "object" ? result.data : {};
  return {
    text: toText(data.text),
    lines: Array.isArray(data.lines)
      ? data.lines.map((line) => toText(line && typeof line === "object" ? line.text : line)).filter(Boolean)
      : toText(data.text).split(/\r?\n/).map((line) => toText(line)).filter(Boolean),
  };
}

async function runPrinterCounterOcr(imagePath) {
  const canUseSwiftOcr =
    process.platform === "darwin" &&
    (await fileExists(UTILITY_INVOICE_OCR_SCRIPT));
  if (canUseSwiftOcr) {
    const { stdout, stderr } = await execFileAsync("swift", [UTILITY_INVOICE_OCR_SCRIPT, imagePath], {
      maxBuffer: 10 * 1024 * 1024,
    });
    if (stderr && stderr.trim()) {
      console.warn("[printer-counter-ocr]", stderr.trim());
    }
    const parsed = JSON.parse(stdout || "{}");
    return {
      text: toText(parsed.text),
      lines: Array.isArray(parsed.lines) ? parsed.lines.map((line) => toText(line)).filter(Boolean) : [],
    };
  }

  if (!Tesseract || typeof Tesseract.recognize !== "function") {
    throw new Error("Printer counter OCR helper is not available on this server.");
  }

  const result = await Tesseract.recognize(imagePath, "eng");
  const data = result && result.data && typeof result.data === "object" ? result.data : {};
  return {
    text: toText(data.text),
    lines: Array.isArray(data.lines)
      ? data.lines.map((line) => toText(line && typeof line === "object" ? line.text : line)).filter(Boolean)
      : [],
  };
}

async function normalizeHistoryEntries(entries, group = "maintenance") {
  if (!Array.isArray(entries)) return [];
  const out = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const photo = await normalizePhotoValue(entry.photo, group);
    const photos = await normalizePhotoList(entry.photos, group, 5);
    const beforePhotos = await normalizePhotoList(entry.beforePhotos, group, 5);
    const afterPhotos = await normalizePhotoList([...(Array.isArray(entry.afterPhotos) ? entry.afterPhotos : []), ...photos, ...(photo ? [photo] : [])], group, 5);
    const reportFile = await normalizeAttachmentValue(entry.reportFile || {
      url: entry.reportFile,
      name: entry.reportFileName,
      mimeType: entry.reportFileType,
    }, "maintenance_reports");
    out.push({
      ...entry,
      photo: afterPhotos[0] || photo,
      photos: afterPhotos.slice(0, 5),
      beforePhotos: beforePhotos.slice(0, 5),
      afterPhotos: afterPhotos.slice(0, 5),
      reportFile: reportFile.url,
      reportFileName: reportFile.name,
      reportFileType: reportFile.mimeType,
      workflow: normalizeMaintenanceWorkflowPayload(entry.workflow),
    });
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
  if (raw === "IT" || raw === "SAFETY" || raw === "FACILITY" || raw === "FURNITURE") return raw;
  if (raw === "FC" || raw === "FACILITIES" || raw === "FACITY") return "FACILITY";
  if (raw === "FUR" || raw === "FURN") return "FURNITURE";
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
function assetIdCampusCode(name) {
  const code = toUpper(campusCode(name));
  if (/^C\d+(\.\d+)?$/.test(code)) {
    const major = Number((code.match(/^C(\d+)/) || [])[1] || 0);
    if (major > 0) return `ECO${major}`;
  }
  return "ECOX";
}

function normalizeSerialKey(value) {
  return toUpper(value);
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
  const repeatCycleStep = Number(body.repeatCycleStep || 0);
  const photo = toText(body.photo);
  const photos = Array.isArray(body.photos) ? body.photos : [];
  const status = toText(body.status) || "Active";
  const tonerModel = toText(body.tonerModel);
  const tonerItemId = Number(body.tonerItemId || 0);
  const tonerMinStock = Math.max(0, Number(body.tonerMinStock || 0));
  const tonerExpectedYield = Math.max(0, Number(body.tonerExpectedYield || 0));
  const tonerLastChangedAt = toText(body.tonerLastChangedAt);
  const tonerLastPageCount = Math.max(0, Number(body.tonerLastPageCount || 0));
  const tonerNotes = toText(body.tonerNotes);
  const statusIsActive = status.toLowerCase() === "active";
  const requiresUser =
    ["PC", "LAP", "TAB", "MON", "SPK", "DCM", "WTK"].includes(type) && statusIsActive;
  const sharedLocation = SHARED_LOCATION_KEYWORDS.some((k) =>
    location.toLowerCase().includes(k)
  );

  if (!campus) return "Campus is required";
  if (!category) return "Category is required";
  if (!TYPE_CODES[category]) return "Category must be IT, SAFETY, FACILITY, or FURNITURE";
  if (!type) return "Type code is required";
  if (!TYPE_CODES[category].includes(type)) {
    return `Type code '${type}' is not allowed for ${category}`;
  }
  if (requiresUser && !sharedLocation && !assignedTo) {
    return `User is required for type ${type}`;
  }
  if (!["NONE", "MONTHLY_WEEKDAY", "EVERY_6_MONTHS", "EVERY_12_MONTHS", "WDP_FILTER_CYCLE"].includes(repeatMode)) {
    return "repeatMode must be NONE, MONTHLY_WEEKDAY, EVERY_6_MONTHS, EVERY_12_MONTHS, or WDP_FILTER_CYCLE";
  }
  if (repeatMode === "MONTHLY_WEEKDAY") {
    if (!(repeatWeekOfMonth >= 1 && repeatWeekOfMonth <= 5)) {
      return "repeatWeekOfMonth must be between 1 and 5";
    }
    if (!(repeatWeekday >= 0 && repeatWeekday <= 6)) {
      return "repeatWeekday must be between 0 and 6";
    }
  }
  if (repeatMode === "WDP_FILTER_CYCLE") {
    if (type !== "WDP") {
      return "WDP filter cycle can only be used for Water Dispenser assets";
    }
    if (!(repeatCycleStep === 1 || repeatCycleStep === 2)) {
      return "repeatCycleStep must be 1 or 2 for WDP filter cycle";
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
    repeatCycleStep,
    photo,
    photos,
    status,
    tonerModel,
    tonerItemId,
    tonerMinStock,
    tonerExpectedYield,
    tonerLastChangedAt,
    tonerLastPageCount,
    tonerNotes,
  };
}

async function validateLocation(body) {
  const campus = normalizeCampusInput(body.campus);
  const name = toText(body.name);
  const isClassroom = Boolean(body.isClassroom);
  const studentCapacity = Math.max(0, Number(body.studentCapacity || 0));
  const currentStudents = Math.max(0, Number(body.currentStudents || 0));
  const tableSeatsPerTable = Math.max(1, Number(body.tableSeatsPerTable || 2));
  const notes = toText(body.notes);
  const photo = await normalizePhotoValue(body.photo, "locations");

  if (!campus) return "Campus is required";
  if (!name) return "Location name is required";

  return { campus, name, isClassroom, studentCapacity, currentStudents, tableSeatsPerTable, notes, photo };
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

function isNonWorkingCalendarEventType(type) {
  return type === "public" || type === "break";
}

function isSundayDateYmd(value) {
  const date = toText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  return new Date(`${date}T00:00:00`).getDay() === 0;
}

function hasNonWorkingHolidayOnDate(settings, date) {
  const ymd = toText(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const events = normalizeCalendarEvents(settings && settings.calendarEvents);
  return events.some((row) => row.date === ymd && isNonWorkingCalendarEventType(row.type));
}

function requiresInventoryOutApproval(user, settings, date, type) {
  if (type !== "OUT") return false;
  if (!user || !canRecordMaintenance(user) || isAdminRole(user.role)) return false;
  return isSundayDateYmd(date) || hasNonWorkingHolidayOnDate(settings, date);
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

function normalizeFurnitureModels(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  const seen = new Set();
  for (let i = 0; i < input.length; i += 1) {
    const row = input[i];
    if (!row || typeof row !== "object") continue;
    const type = toUpper(row.type);
    const model = toText(row.model);
    const photo = toText(row.photo);
    if (!type || !model) continue;
    const key = `${type}::${model.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const parsedId = Number(row.id);
    const id = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : Date.now() + i;
    out.push({
      id,
      type,
      model,
      photo,
      created: toText(row.created) || new Date().toISOString(),
    });
  }
  return out.sort((a, b) => a.type.localeCompare(b.type) || a.model.localeCompare(b.model));
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
  const assetDbId = Number(body.assetDbId) || 0;
  const assetName = toText(body.assetName);
  const assetLocation = toText(body.assetLocation);
  const title = toText(body.title);
  const description = toText(body.description);
  const requestedBy = toText(body.requestedBy);
  const requesterContact = toText(body.requesterContact);
  const priority = toText(body.priority) || "Normal";
  const status = toText(body.status) || "Open";
  const assignedTo = toText(body.assignedTo);
  const requestSource = toText(body.requestSource) || "manual";

  if (!campus) return "Campus is required";
  if (!category) return "Category is required";
  if (!title) return "Ticket title is required";
  if (!requestedBy) return "Requester is required";

  return {
    campus,
    category,
    assetId,
    assetDbId,
    assetName,
    assetLocation,
    title,
    description,
    requestedBy,
    requesterContact,
    priority,
    status,
    assignedTo,
    requestSource,
  };
}

function normalizeCompletion(value) {
  const text = toText(value);
  if (!text) return "Not Yet";
  if (text === "Done" || text === "Not Yet") return text;
  return "Not Yet";
}

function syncAssetStatusFromMaintenance(asset) {
  if (!asset || typeof asset !== "object") return false;
  // Replacement of a part should not automatically retire/defective the whole asset.
  return false;
}

function cascadeChildAssetAssignment(db, parentAsset, nextAssignedTo, options = {}) {
  const assets = Array.isArray(db && db.assets) ? db.assets : [];
  const parentAssetId = toText(parentAsset && parentAsset.assetId);
  if (!parentAssetId) return 0;
  const toUser = toText(nextAssignedTo);
  const changedBy = toText(options.changedBy);
  const actionDate = toText(options.date) || new Date().toISOString();
  const note = toText(options.note) || "Assignment synced from parent asset";
  let changedCount = 0;
  let idSeed = Date.now();

  for (let i = 0; i < assets.length; i += 1) {
    const row = assets[i];
    if (!row || typeof row !== "object") continue;
    if (toText(row.parentAssetId) !== parentAssetId) continue;
    const fromUser = toText(row.assignedTo);
    if (fromUser === toUser) continue;
    const custodyEntry = {
      id: idSeed += 1,
      date: actionDate,
      action: toUser ? "ASSIGN" : "UNASSIGN",
      fromCampus: toText(row.campus),
      fromLocation: toText(row.location),
      toCampus: toText(row.campus),
      toLocation: toText(row.location),
      fromUser,
      toUser,
      responsibilityAck: false,
      by: changedBy,
      note,
    };
    const currentHistory = Array.isArray(row.custodyHistory) ? row.custodyHistory : [];
    assets[i] = {
      ...row,
      assignedTo: toUser,
      custodyStatus: toUser ? "ASSIGNED" : "IN_STOCK",
      custodyHistory: [custodyEntry, ...currentHistory],
    };
    changedCount += 1;
  }

  return changedCount;
}

function findParentAssetByAssetId(db, parentAssetId) {
  const targetId = toText(parentAssetId);
  if (!targetId) return null;
  const assets = Array.isArray(db && db.assets) ? db.assets : [];
  return assets.find((row) => toText(row && row.assetId) === targetId) || null;
}

function syncAssignedToFromParentAsset(db, assetLike) {
  if (!assetLike || typeof assetLike !== "object") {
    return { assignedTo: "", custodyStatus: "IN_STOCK", parent: null };
  }
  const parent = findParentAssetByAssetId(db, assetLike.parentAssetId);
  if (!parent) {
    const assignedTo = toText(assetLike.assignedTo);
    return {
      assignedTo,
      custodyStatus: normalizeCustodyStatus(assetLike.custodyStatus || (assignedTo ? "ASSIGNED" : "IN_STOCK")),
      parent: null,
    };
  }
  const assignedTo = toText(parent.assignedTo);
  return {
    assignedTo,
    custodyStatus: normalizeCustodyStatus(assignedTo ? "ASSIGNED" : "IN_STOCK"),
    parent,
  };
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
  const session = touchSessionActivity(token);
  return session ? sanitizeUser(session.user) : null;
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

function requireSuperAdmin(req, res) {
  const user = getAuthUser(req);
  if (!user) {
    sendJson(res, 401, { error: "Unauthorized" });
    return null;
  }
  if (toText(user.role) !== "Super Admin") {
    sendJson(res, 403, { error: "Super Admin role required" });
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
    .map(([token, session]) => sanitizeAuthSessionEntry({ ...session, token: toText(token) }))
    .filter((row) => row.token && row.user && row.user.id && row.status === "active");
}

async function persistSessionsToDb() {
  const db = await readDb();
  const activeRows = sessionRowsFromMap();
  db.authSessions = Array.isArray(db.authSessions) ? db.authSessions.map((row) => sanitizeAuthSessionEntry(row)) : [];
  const activeTokens = new Set(activeRows.map((row) => row.token).filter(Boolean));
  db.authSessions = db.authSessions.map((row) => {
    if (!row.token || !activeTokens.has(row.token) || row.status !== "active") return row;
    const active = activeRows.find((item) => item.token === row.token);
    return active ? { ...row, ...active } : row;
  });
  for (const row of activeRows) {
    upsertAuthSessionHistory(db, row);
  }
  await writeDb(db);
}

async function restoreSessionsFromDb() {
  const db = await readDb();
  const rows = Array.isArray(db.authSessions) ? db.authSessions : [];
  sessions.clear();
  for (const row of rows) {
    const session = sanitizeAuthSessionEntry(row);
    if (!session.token || !session.user || !session.user.id || session.status !== "active") continue;
    sessions.set(session.token, session);
  }
}

function nextAssetSeq(assets, campus, category, type) {
  const campusGroup = assetIdCampusCode(campus);
  const normalizedType = toUpper(type);
  const same = assets.filter(
    (a) =>
      assetIdCampusCode(a.campus) === campusGroup &&
      toText(a.category) === toText(category) &&
      toUpper(a.type) === normalizedType
  );
  if (!same.length) return 1;
  const maxSeq = Math.max(
    ...same.map((a) => {
      const seq = Number(a.seq) || 0;
      const idMatch = toText(a.assetId).match(/-(\d{1,6})$/);
      const idSeq = Number((idMatch && idMatch[1]) || 0);
      return Math.max(seq, idSeq);
    })
  );
  return maxSeq + 1;
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
  const openTickets = campusTickets.filter((t) => !["Done", "Cancelled", "Resolved"].includes(toText(t.status))).length;

  const byCampus = CAMPUS_NAMES
    .map((name) => {
      const assets = db.assets.filter((a) => a.campus === name).length;
      const tickets = db.tickets.filter(
        (t) => t.campus === name && !["Done", "Cancelled", "Resolved"].includes(toText(t.status))
      ).length;
      return { campus: name, assets, openTickets: tickets };
    })
    .filter((row) => row.assets || row.openTickets);

  return { totalAssets, itAssets, safetyAssets, openTickets, byCampus };
}

function toPublicAssetComponentView(asset) {
  const source = asset && typeof asset === "object" ? asset : {};
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
    notes: toText(source.notes),
    status: toText(source.status) || "Active",
    photo: toText(source.photo),
    photos: Array.isArray(source.photos) ? source.photos.map((p) => toText(p)).filter(Boolean) : [],
  };
}

function toPublicAssetView(asset, allAssets = []) {
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
        tonerItemId: Number(entry?.tonerItemId || 0),
        tonerItemCode: toText(entry?.tonerItemCode),
        tonerItemName: toText(entry?.tonerItemName),
        tonerQty: Number(entry?.tonerQty || 0),
        tonerModel: toText(entry?.tonerModel),
        oldTonerStatus: toText(entry?.oldTonerStatus),
        pageCounter: Number(entry?.pageCounter || 0),
        photo: toText(entry?.photo),
        photos: Array.isArray(entry?.photos) ? entry.photos.map((p) => toText(p)).filter(Boolean) : [],
        beforePhotos: Array.isArray(entry?.beforePhotos) ? entry.beforePhotos.map((p) => toText(p)).filter(Boolean) : [],
        afterPhotos: Array.isArray(entry?.afterPhotos) ? entry.afterPhotos.map((p) => toText(p)).filter(Boolean) : [],
        reportFile: toText(entry?.reportFile),
        reportFileName: toText(entry?.reportFileName),
        reportFileType: toText(entry?.reportFileType),
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
        quantity: Math.max(0, Number(entry?.quantity || 0)),
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
  const components = Array.isArray(allAssets)
    ? allAssets
        .filter((row) => toText(row?.parentAssetId) === toText(source.assetId) && toText(row?.assetId) !== toText(source.assetId))
        .sort((a, b) =>
          (Number(a?.seq) || 0) - (Number(b?.seq) || 0) ||
          toText(a?.assetId).localeCompare(toText(b?.assetId))
        )
        .map((row) => toPublicAssetComponentView(row))
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
    tonerModel: toText(source.tonerModel),
    tonerItemId: Number(source.tonerItemId || 0),
    tonerMinStock: Number(source.tonerMinStock || 0),
    tonerExpectedYield: Number(source.tonerExpectedYield || 0),
    tonerLastChangedAt: toText(source.tonerLastChangedAt),
    tonerLastPageCount: Number(source.tonerLastPageCount || 0),
    tonerNotes: toText(source.tonerNotes),
    photo: toText(source.photo),
    photos: Array.isArray(source.photos) ? source.photos.map((p) => toText(p)).filter(Boolean) : [],
    maintenanceHistory,
    transferHistory,
    statusHistory,
    custodyHistory,
    components,
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
      sendJson(res, 200, {
        ok: true,
        version: APP_BUILD_VERSION,
        packageVersion: PACKAGE_VERSION,
        commit: SHORT_DEPLOY_COMMIT || "",
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/alerts/telegram/status") {
      const user = getAuthUser(req);
      if (!user) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }
      const discoveredTargets = TELEGRAM_DISCOVER_CHAT_IDS ? await discoverTelegramChatIds() : [];
      const maintenanceDiscoveredTargets =
        TELEGRAM_DISCOVER_CHAT_IDS && TELEGRAM_MAINTENANCE_BOT_TOKEN
          ? await discoverTelegramChatIds(TELEGRAM_MAINTENANCE_BOT_TOKEN)
          : [];
      telegramLastDiscoveredChats = discoveredTargets;
      telegramMaintenanceLastDiscoveredChats = maintenanceDiscoveredTargets;
      const db = await readDb();
      sendJson(res, 200, {
        ok: true,
        enabled: TELEGRAM_ALERT_ENABLED,
        hasBotToken: Boolean(TELEGRAM_BOT_TOKEN),
        hasMaintenanceBotToken: Boolean(TELEGRAM_MAINTENANCE_BOT_TOKEN),
        configuredTargets: resolveTelegramConfiguredChatIds(db),
        maintenanceConfiguredTargets: resolveTelegramConfiguredChatIds(db, [], "maintenance"),
        discoverEnabled: TELEGRAM_DISCOVER_CHAT_IDS,
        discoveredTargets,
        maintenanceDiscoveredTargets,
        lastSend: telegramLastSendReport,
        maintenanceLastSend: telegramMaintenanceLastSendReport,
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/alerts/telegram/test") {
      const user = getAuthUser(req);
      if (!user) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }
      if (!(isAdminRole(user.role) || canRecordMaintenance(user))) {
        sendJson(res, 403, { error: "Maintenance record permission required" });
        return;
      }
      const body = await parseBody(req);
      const kind = toText(body && body.kind).toLowerCase() === "maintenance" ? "maintenance" : "normal";
      const text =
        toText(body && body.text) ||
        `${
          kind === "maintenance" ? "ECO Maintenance Telegram test" : "ECO IT Telegram test"
        }\nTime: ${new Date().toISOString()}\nBy: ${toText(user.displayName) || toText(user.username) || "staff"}`;
      const db = await readDb();
      const ok =
        kind === "maintenance"
          ? await sendTelegramMaintenanceMessage(text, { db })
          : await sendTelegramMessage(text, { db });
      sendJson(res, 200, {
        ok,
        enabled: TELEGRAM_ALERT_ENABLED,
        kind,
        chatTargets: resolveTelegramConfiguredChatIds(db, [], kind === "maintenance" ? "maintenance" : "default"),
      });
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
      sendJson(res, 200, { asset: toPublicAssetView(found, assets) });
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

    if (req.method === "GET" && url.pathname === "/api/auth/sessions") {
      if (!requireAdmin(req, res)) return;
      const db = await readDb();
      const rows = Array.isArray(db.authSessions) ? db.authSessions : [];
      const merged = new Map();
      for (const row of rows) {
        const session = sanitizeAuthSessionEntry(row);
        const key = session.token || String(session.id);
        merged.set(key, session);
      }
      for (const [token, session] of sessions.entries()) {
        const normalized = sanitizeAuthSessionEntry({ ...session, token });
        merged.set(token, normalized);
      }
      const authSessions = Array.from(merged.values())
        .sort((a, b) => {
          const bTime = Date.parse(b.lastSeenAt || b.loginAt || "") || 0;
          const aTime = Date.parse(a.lastSeenAt || a.loginAt || "") || 0;
          return bTime - aTime;
        })
        .slice(0, 300)
        .map((row) => ({
          id: row.id,
          username: row.username,
          displayName: row.displayName,
          role: row.role,
          ipAddress: row.ipAddress,
          userAgent: row.userAgent,
          loginAt: row.loginAt,
          lastSeenAt: row.lastSeenAt,
          logoutAt: row.logoutAt,
          status: row.status,
          user: row.user,
        }));
      sendJson(res, 200, { authSessions });
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
          inventoryApprovalRouting: normalizeInventoryApprovalRoutingMap(settings.inventoryApprovalRouting),
          telegramChatIds: normalizeTelegramChatIds(settings.telegramChatIds),
          telegramMaintenanceChatIds: normalizeTelegramChatIds(settings.telegramMaintenanceChatIds),
          staffUsers: normalizeStaffUsers(settings.staffUsers),
          calendarEvents: normalizeCalendarEvents(settings.calendarEvents),
          inventoryItems: normalizeInventoryItems(settings.inventoryItems),
          inventoryTxns: normalizeInventoryTxns(settings.inventoryTxns),
          rentalPrinters: normalizeRentalPrinters(settings.rentalPrinters),
          rentalPrinterCounters: normalizeRentalPrinterCounters(settings.rentalPrinterCounters),
          poolCleaningSchedules: normalizePoolCleaningSchedules(settings.poolCleaningSchedules),
          poolEquipmentChecks: normalizePoolEquipmentChecks(settings.poolEquipmentChecks),
          poolChemicalRecords: normalizePoolChemicalRecords(settings.poolChemicalRecords),
          poolOperationRecords: normalizePoolOperationRecords(settings.poolOperationRecords),
          poolComplaints: normalizePoolComplaints(settings.poolComplaints),
          utilityMeters: normalizeUtilityMeters(settings.utilityMeters),
          utilityReadings: normalizeUtilityReadings(settings.utilityReadings),
          furnitureModels: normalizeFurnitureModels(settings.furnitureModels),
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
      const nextInventoryApprovalRouting =
        incoming && Object.prototype.hasOwnProperty.call(incoming, "inventoryApprovalRouting")
          ? normalizeInventoryApprovalRoutingMap(incoming.inventoryApprovalRouting)
          : normalizeInventoryApprovalRoutingMap(current.inventoryApprovalRouting);
      const nextTelegramChatIds =
        incoming && Object.prototype.hasOwnProperty.call(incoming, "telegramChatIds")
          ? normalizeTelegramChatIds(incoming.telegramChatIds)
          : normalizeTelegramChatIds(current.telegramChatIds);
      const nextTelegramMaintenanceChatIds =
        incoming && Object.prototype.hasOwnProperty.call(incoming, "telegramMaintenanceChatIds")
          ? normalizeTelegramChatIds(incoming.telegramMaintenanceChatIds)
          : normalizeTelegramChatIds(current.telegramMaintenanceChatIds);
      const nextInventoryItems =
        incoming && Object.prototype.hasOwnProperty.call(incoming, "inventoryItems")
          ? normalizeInventoryItems(incoming.inventoryItems)
          : normalizeInventoryItems(current.inventoryItems);
      const nextInventoryTxns =
        incoming && Object.prototype.hasOwnProperty.call(incoming, "inventoryTxns")
          ? normalizeInventoryTxns(incoming.inventoryTxns)
          : normalizeInventoryTxns(current.inventoryTxns);
      const nextRentalPrinters =
        incoming && Object.prototype.hasOwnProperty.call(incoming, "rentalPrinters")
          ? normalizeRentalPrinters(incoming.rentalPrinters)
          : normalizeRentalPrinters(current.rentalPrinters);
      const nextRentalPrinterCounters =
        incoming && Object.prototype.hasOwnProperty.call(incoming, "rentalPrinterCounters")
          ? normalizeRentalPrinterCounters(incoming.rentalPrinterCounters)
          : normalizeRentalPrinterCounters(current.rentalPrinterCounters);
      const nextPoolCleaningSchedules =
        incoming && Object.prototype.hasOwnProperty.call(incoming, "poolCleaningSchedules")
          ? normalizePoolCleaningSchedules(incoming.poolCleaningSchedules)
          : normalizePoolCleaningSchedules(current.poolCleaningSchedules);
      const nextPoolEquipmentChecks =
        incoming && Object.prototype.hasOwnProperty.call(incoming, "poolEquipmentChecks")
          ? normalizePoolEquipmentChecks(incoming.poolEquipmentChecks)
          : normalizePoolEquipmentChecks(current.poolEquipmentChecks);
      const nextPoolChemicalRecords =
        incoming && Object.prototype.hasOwnProperty.call(incoming, "poolChemicalRecords")
          ? normalizePoolChemicalRecords(incoming.poolChemicalRecords)
          : normalizePoolChemicalRecords(current.poolChemicalRecords);
      const nextPoolOperationRecords =
        incoming && Object.prototype.hasOwnProperty.call(incoming, "poolOperationRecords")
          ? normalizePoolOperationRecords(incoming.poolOperationRecords)
          : normalizePoolOperationRecords(current.poolOperationRecords);
      const nextPoolComplaints =
        incoming && Object.prototype.hasOwnProperty.call(incoming, "poolComplaints")
          ? normalizePoolComplaints(incoming.poolComplaints)
          : normalizePoolComplaints(current.poolComplaints);
      const nextUtilityMeters =
        incoming && Object.prototype.hasOwnProperty.call(incoming, "utilityMeters")
          ? normalizeUtilityMeters(incoming.utilityMeters)
          : normalizeUtilityMeters(current.utilityMeters);
      const nextUtilityReadings =
        incoming && Object.prototype.hasOwnProperty.call(incoming, "utilityReadings")
          ? normalizeUtilityReadings(incoming.utilityReadings)
          : normalizeUtilityReadings(current.utilityReadings);
      const nextFurnitureModels =
        incoming && Object.prototype.hasOwnProperty.call(incoming, "furnitureModels")
          ? normalizeFurnitureModels(incoming.furnitureModels)
          : normalizeFurnitureModels(current.furnitureModels);
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
        inventoryApprovalRouting: nextInventoryApprovalRouting,
        telegramChatIds: nextTelegramChatIds,
        telegramMaintenanceChatIds: nextTelegramMaintenanceChatIds,
        inventoryItems: nextInventoryItems,
        inventoryTxns: nextInventoryTxns,
        rentalPrinters: nextRentalPrinters,
        rentalPrinterCounters: nextRentalPrinterCounters,
        poolCleaningSchedules: nextPoolCleaningSchedules,
        poolEquipmentChecks: nextPoolEquipmentChecks,
        poolChemicalRecords: nextPoolChemicalRecords,
        poolOperationRecords: nextPoolOperationRecords,
        poolComplaints: nextPoolComplaints,
        utilityMeters: nextUtilityMeters,
        utilityReadings: nextUtilityReadings,
        furnitureModels: nextFurnitureModels,
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

    if (req.method === "POST" && url.pathname === "/api/utilities/invoice-autofill") {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const body = await parseBody(req);
      const utilityType = toUpper(body.utilityType) === "PPWS" ? "PPWS" : "EDC";
      const { path: imagePath, temporary } = await readInvoiceImagePath(body.photo || body.dataUrl);
      if (!imagePath) {
        sendJson(res, 400, { error: "Invoice image is required for auto fill." });
        return;
      }
      try {
        const ocr = await runUtilityInvoiceOcr(imagePath);
        const extracted = parseUtilityInvoiceFromOcrText(utilityType, ocr.text);
        const db = await readDb();
        appendAuditLog(
          db,
          admin,
          "UTILITY_INVOICE_AUTOFILL",
          "utility_invoice",
          utilityType,
          `warnings=${extracted.warnings.length}`
        );
        await writeDb(db);
        sendJson(res, 200, {
          ok: true,
          extracted,
        });
      } catch (err) {
        sendJson(res, 503, {
          error:
            err instanceof Error
              ? err.message
              : "Invoice OCR could not process this file.",
        });
      } finally {
        if (temporary) {
          try {
            await fs.unlink(imagePath);
          } catch {
            // Ignore temp cleanup failures.
          }
        }
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/printers/counter-autofill") {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const body = await parseBody(req);
      const { path: imagePath, temporary } = await readInvoiceImagePath(body.photo || body.dataUrl);
      if (!imagePath) {
        sendJson(res, 400, { error: "Printer screenshot is required for auto fill." });
        return;
      }
      try {
        const ocr = await runPrinterCounterOcr(imagePath);
        const extracted = parsePrinterCounterFromOcrText(ocr.text, ocr.lines);
        const db = await readDb();
        appendAuditLog(
          db,
          admin,
          "PRINTER_COUNTER_AUTOFILL",
          "rental_printer_counter",
          String(body.machineCode || "printer"),
          `warnings=${extracted.warnings.length}`
        );
        await writeDb(db);
        sendJson(res, 200, {
          ok: true,
          extracted,
        });
      } catch (err) {
        sendJson(res, 503, {
          error:
            err instanceof Error
              ? err.message
              : "Printer counter OCR could not process this file.",
        });
      } finally {
        if (temporary) {
          try {
            await fs.unlink(imagePath);
          } catch {
            // Ignore temp cleanup failures.
          }
        }
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/printers/counter-from-ip") {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const body = await parseBody(req);
      try {
        const db = await readDb();
        const rentalPrinters = Array.isArray(db.rentalPrinters) ? db.rentalPrinters : [];
        const matchingPrinter = rentalPrinters.find(
          (row) => toText(row.machineCode) === toText(body.machineCode)
        ) || null;
        const extracted = await fetchPrinterCounterFromIp(body.ipAddress || body.url || "", {
          campus: body.campus || (matchingPrinter ? matchingPrinter.campus : ""),
          machineCode: body.machineCode || (matchingPrinter ? matchingPrinter.machineCode : ""),
        });
        appendAuditLog(
          db,
          admin,
          "PRINTER_COUNTER_IP_READ",
          "rental_printer_counter",
          String(body.machineCode || "printer"),
          `warnings=${Array.isArray(extracted.warnings) ? extracted.warnings.length : 0}`
        );
        await writeDb(db);
        sendJson(res, 200, { ok: true, extracted });
      } catch (err) {
        sendJson(res, 503, {
          error:
            err instanceof Error
              ? err.message
              : "Printer counter could not be read from the printer IP.",
        });
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/login") {
      const body = await parseBody(req);
      const username = toText(body.username);
      const password = toText(body.password);
      const clientIp = getClientIp(req);
      if (!username || !password) {
        sendJson(res, 400, { error: "Username and password are required" });
        return;
      }
      const db = await readDb();
      const users = Array.isArray(db.users) ? db.users : [];
      const user = users.find((u) => toText(u.username).toLowerCase() === username.toLowerCase());
      if (!user) {
        appendAuditLog(db, null, "LOGIN_FAILED", "auth_session", username || "unknown", `ip=${clientIp} | user not found`);
        await writeDb(db);
        sendJson(res, 401, { error: "Invalid username or password" });
        return;
      }
      const passwordMatches = verifyPassword(user.password, password);
      const devBootstrapLogin = !passwordMatches && shouldAllowDevBootstrapLogin(user, password);
      if (!passwordMatches && !devBootstrapLogin) {
        appendAuditLog(db, sanitizeUser(user), "LOGIN_FAILED", "auth_session", username || "unknown", `ip=${clientIp} | invalid password`);
        await writeDb(db);
        sendJson(res, 401, { error: "Invalid username or password" });
        return;
      }
      if (!isHashedPassword(user.password) || devBootstrapLogin) {
        user.password = hashPassword(password);
        db.users = users;
      }
      const token = crypto.randomBytes(24).toString("hex");
      const safeUser = sanitizeUser(user);
      const sessionEntry = createAuthSessionEntry(safeUser, req, token);
      sessions.set(token, sessionEntry);
      upsertAuthSessionHistory(db, sessionEntry);
      appendAuditLog(db, safeUser, "LOGIN_SUCCESS", "auth_session", String(sessionEntry.id), `ip=${sessionEntry.ipAddress}`);
      await writeDb(db);
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
        const endedSession = markSessionLoggedOut(token);
        if (endedSession) {
          const db = await readDb();
          upsertAuthSessionHistory(db, endedSession);
          appendAuditLog(
            db,
            endedSession.user,
            "LOGOUT",
            "auth_session",
            String(endedSession.id),
            `ip=${endedSession.ipAddress}`
          );
          await writeDb(db);
        }
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
      const backfilled = backfillInventoryApprovalNotificationTargets(db);
      if (generated || backfilled) {
        await writeDb(db);
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

    const notificationCloseMatch = url.pathname.match(/^\/api\/notifications\/(\d+)\/close$/);
    if (req.method === "PATCH" && notificationCloseMatch) {
      const user = getAuthUser(req);
      if (!user) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }
      const id = Number(notificationCloseMatch[1]);
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
      const changed =
        markNotificationClosedByUser(row, user.username) ||
        markNotificationReadByUser(row, user.username);
      if (changed) await writeDb(db);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/inventory/items") {
      const user = getAuthUser(req);
      if (!user) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }
      const campus = normalizeCampusInput(url.searchParams.get("campus"));
      const q = toText(url.searchParams.get("q")).toLowerCase();
      const db = await readDb();
      const { items } = getInventoryState(db);
      let rows = filterByCampusPermission(items, user, (row) => toText(row.campus));
      if (campus) {
        if (!userCanAccessCampus(user, campus)) {
          sendJson(res, 200, { items: [] });
          return;
        }
        rows = rows.filter((row) => toText(row.campus) === campus);
      }
      if (q) {
        rows = rows.filter((row) => {
          const hay = `${toText(row.itemCode)} ${toText(row.itemName)} ${toText(row.location)} ${toText(row.vendor)}`.toLowerCase();
          return hay.includes(q);
        });
      }
      sendJson(res, 200, { items: rows });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/inventory/txns") {
      const user = getAuthUser(req);
      if (!user) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }
      const campus = normalizeCampusInput(url.searchParams.get("campus"));
      const itemId = Number(url.searchParams.get("itemId") || 0);
      const db = await readDb();
      const { txns } = getInventoryState(db);
      let rows = filterByCampusPermission(txns, user, (row) => toText(row.campus));
      if (campus) {
        if (!userCanAccessCampus(user, campus)) {
          sendJson(res, 200, { txns: [] });
          return;
        }
        rows = rows.filter((row) => toText(row.campus) === campus);
      }
      if (itemId) rows = rows.filter((row) => Number(row.itemId) === itemId);
      sendJson(res, 200, { txns: rows });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/inventory/items") {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const body = await parseBody(req);
      const campus = normalizeCampusInput(body.campus);
      const category = normalizeInventoryCategory(body.category);
      const itemCode = toUpper(body.itemCode);
      const itemName = toText(body.itemName);
      const unit = toText(body.unit);
      const location = toText(body.location);
      const openingQty = Math.max(0, Number(body.openingQty || 0));
      const minStock = Math.max(0, Number(body.minStock || 0));
      const vendor = toText(body.vendor);
      const notes = toText(body.notes);
      if (!campus || !category || !itemCode || !itemName || !unit || !location) {
        sendJson(res, 400, { error: "campus, category, itemCode, itemName, unit, location are required" });
        return;
      }
      if (!userCanAccessCampus(admin, campus)) {
        sendJson(res, 403, { error: "Campus access denied" });
        return;
      }
      if (!Number.isFinite(openingQty) || !Number.isFinite(minStock)) {
        sendJson(res, 400, { error: "openingQty and minStock must be numbers" });
        return;
      }

      const db = await readDb();
      const { settings, items, txns } = getInventoryState(db);
      const codeExists = items.some(
        (row) =>
          toUpper(row.itemCode) === itemCode &&
          inventoryCampusGroupCode(row.campus) === inventoryCampusGroupCode(campus)
      );
      if (codeExists) {
        sendJson(res, 409, { error: "Item code already exists in this campus group" });
        return;
      }
      const photo = await normalizePhotoValue(body.photo, "inventory");
      const itemGroup = toUpper(body.itemGroup) || "GENERAL";
      const compatibleAssetTypes = Array.isArray(body.compatibleAssetTypes)
        ? body.compatibleAssetTypes.map((value) => toUpper(value)).filter(Boolean)
        : [];
      const compatibleModels = Array.isArray(body.compatibleModels)
        ? body.compatibleModels.map((value) => toText(value)).filter(Boolean)
        : [];
      const defaultUnitCost = Math.max(0, Number(body.defaultUnitCost || 0));
      const item = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        campus,
        category,
        itemCode,
        itemName,
        unit,
        openingQty,
        minStock,
        location,
        vendor,
        notes,
        itemGroup,
        compatibleAssetTypes,
        compatibleModels,
        defaultUnitCost,
        photo,
        created: new Date().toISOString(),
      };
      const nextItems = [item, ...items];
      setInventoryState(db, settings, nextItems, txns);
      appendAuditLog(db, admin, "CREATE", "inventory_item", itemCode, `${campus} | ${itemName}`);
      await writeDb(db);
      sendJson(res, 201, { item });
      return;
    }

    const inventoryItemMatch = url.pathname.match(/^\/api\/inventory\/items\/(\d+)$/);
    if (req.method === "PATCH" && inventoryItemMatch) {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const itemId = Number(inventoryItemMatch[1]);
      if (!itemId) {
        sendJson(res, 400, { error: "Invalid ID" });
        return;
      }
      const body = await parseBody(req);
      const db = await readDb();
      const { settings, items, txns } = getInventoryState(db);
      const idx = items.findIndex((row) => Number(row.id) === itemId);
      if (idx === -1) {
        sendJson(res, 404, { error: "Item not found" });
        return;
      }
      const current = items[idx];
      const campus = normalizeCampusInput(body.campus || current.campus);
      const category = normalizeInventoryCategory(body.category || current.category);
      const itemCode = toUpper(body.itemCode || current.itemCode);
      const itemName = toText(body.itemName || current.itemName);
      const unit = toText(body.unit || current.unit);
      const location = toText(body.location || current.location);
      const openingQty = Math.max(0, Number(body.openingQty ?? current.openingQty ?? 0));
      const minStock = Math.max(0, Number(body.minStock ?? current.minStock ?? 0));
      const vendor = toText(body.vendor ?? current.vendor);
      const notes = toText(body.notes ?? current.notes);
      const itemGroup = toUpper(body.itemGroup ?? current.itemGroup) || "GENERAL";
      const compatibleAssetTypes = Array.isArray(body.compatibleAssetTypes)
        ? body.compatibleAssetTypes.map((value) => toUpper(value)).filter(Boolean)
        : Array.isArray(current.compatibleAssetTypes)
          ? current.compatibleAssetTypes.map((value) => toUpper(value)).filter(Boolean)
          : [];
      const compatibleModels = Array.isArray(body.compatibleModels)
        ? body.compatibleModels.map((value) => toText(value)).filter(Boolean)
        : Array.isArray(current.compatibleModels)
          ? current.compatibleModels.map((value) => toText(value)).filter(Boolean)
          : [];
      const defaultUnitCost = Math.max(0, Number(body.defaultUnitCost ?? current.defaultUnitCost ?? 0));
      if (!campus || !category || !itemCode || !itemName || !unit || !location) {
        sendJson(res, 400, { error: "campus, category, itemCode, itemName, unit, location are required" });
        return;
      }
      if (!userCanAccessCampus(admin, campus)) {
        sendJson(res, 403, { error: "Campus access denied" });
        return;
      }
      if (
        Object.prototype.hasOwnProperty.call(body, "openingQty") &&
        Number(openingQty) !== Math.max(0, Number(current.openingQty || 0)) &&
        toText(admin.role) !== "Super Admin"
      ) {
        sendJson(res, 403, { error: "Only Super Admin can change opening quantity on existing items" });
        return;
      }
      const duplicateCode = items.some(
        (row) =>
          Number(row.id) !== itemId &&
          toUpper(row.itemCode) === itemCode &&
          inventoryCampusGroupCode(row.campus) === inventoryCampusGroupCode(campus)
      );
      if (duplicateCode) {
        sendJson(res, 409, { error: "Item code already exists in this campus group" });
        return;
      }
      const nextPhoto = Object.prototype.hasOwnProperty.call(body, "photo")
        ? await normalizePhotoValue(body.photo, "inventory")
        : toText(current.photo);
      const updated = {
        ...current,
        campus,
        category,
        itemCode,
        itemName,
        unit,
        openingQty,
        minStock,
        location,
        vendor,
        notes,
        itemGroup,
        compatibleAssetTypes,
        compatibleModels,
        defaultUnitCost,
        photo: nextPhoto,
      };
      const nextItems = items.slice();
      nextItems[idx] = updated;
      setInventoryState(db, settings, nextItems, txns);
      appendAuditLog(db, admin, "UPDATE", "inventory_item", updated.itemCode, `${updated.campus} | ${updated.itemName}`);
      await writeDb(db);
      sendJson(res, 200, { item: updated });
      return;
    }

    if (req.method === "DELETE" && inventoryItemMatch) {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const itemId = Number(inventoryItemMatch[1]);
      if (!itemId) {
        sendJson(res, 400, { error: "Invalid ID" });
        return;
      }
      const db = await readDb();
      const { settings, items, txns } = getInventoryState(db);
      const current = items.find((row) => Number(row.id) === itemId);
      if (!current) {
        sendJson(res, 404, { error: "Item not found" });
        return;
      }
      if (txns.some((row) => Number(row.itemId) === itemId)) {
        sendJson(res, 400, { error: "Cannot delete item with transaction history" });
        return;
      }
      const nextItems = items.filter((row) => Number(row.id) !== itemId);
      setInventoryState(db, settings, nextItems, txns);
      appendAuditLog(db, admin, "DELETE", "inventory_item", toText(current.itemCode), `${toText(current.campus)} | ${toText(current.itemName)}`);
      await writeDb(db);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/inventory/txns") {
      const user = getAuthUser(req);
      if (!user) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }
      if (!(isAdminRole(user.role) || canRecordMaintenance(user))) {
        sendJson(res, 403, { error: "Inventory record permission required" });
        return;
      }
      const body = await parseBody(req);
      const itemId = Number(body.itemId || 0);
      const date = toText(body.date);
      const type = normalizeInventoryTxnType(body.type);
      const qtyRaw = Number(body.qty || 0);
      const qty = Math.max(0, Math.round(qtyRaw));
      if (!itemId || !date || !type || !Number.isFinite(qtyRaw) || (type !== "SET" && qty <= 0)) {
        sendJson(res, 400, { error: "itemId, date, type, qty are required" });
        return;
      }
      if (type === "SET" && toText(user.role) !== "Super Admin") {
        sendJson(res, 403, { error: "Only Super Admin can use Set Current Stock" });
        return;
      }

      const db = await readDb();
      const { settings, items, txns } = getInventoryState(db);
      const item = items.find((row) => Number(row.id) === itemId);
      if (!item) {
        sendJson(res, 404, { error: "Item not found" });
        return;
      }
      if (!userCanAccessCampus(user, toText(item.campus))) {
        sendJson(res, 403, { error: "Campus access denied" });
        return;
      }

      const fromCampus = toText(body.fromCampus);
      const toCampus = toText(body.toCampus);
      const expectedReturnDate = toText(body.expectedReturnDate);
      const requestedBy = toText(body.requestedBy);
      const approvedBy = toText(body.approvedBy);
      const receivedBy = toText(body.receivedBy);
      const requiresApproval = requiresInventoryOutApproval(user, settings, date, type);
      const approvalStatus = type === "OUT" ? (requiresApproval ? "PENDING" : "APPROVED") : "";
      const approvalRequestedBy = toText(body.approvalRequestedBy) || toText(user.displayName) || toText(user.username);
      const approvalRequestedAt = toText(body.approvalRequestedAt) || new Date().toISOString();
      const approvalDecisionBy = toText(body.approvalDecisionBy);
      const approvalDecisionAt = toText(body.approvalDecisionAt);
      const approvalDecisionNote = toText(body.approvalDecisionNote);
      const txnSource = toUpper(body.txnSource) || "GENERAL";
      const referenceAssetId = toText(body.referenceAssetId);
      const referenceAssetDbId = Number(body.referenceAssetDbId || 0);
      const supplier = toText(body.supplier);
      const invoiceNo = toText(body.invoiceNo);
      const unitCost = Math.max(0, Number(body.unitCost || 0));
      const totalCost = Math.max(0, Number(body.totalCost || (unitCost * qty)));

      if ((type === "BORROW_OUT" || type === "BORROW_CONSUME") && (!toCampus || !requestedBy || !approvedBy)) {
        sendJson(res, 400, { error: "Borrow Out/Consume requires toCampus, requestedBy, approvedBy" });
        return;
      }
      if (type === "BORROW_IN" && (!fromCampus || !receivedBy)) {
        sendJson(res, 400, { error: "Borrow Return requires fromCampus and receivedBy" });
        return;
      }

      const currentStock = calcInventoryCurrentStock(item, txns);
      if (isInventoryTxnOutType(type) && qty > currentStock) {
        sendJson(res, 400, { error: `Not enough stock. Current: ${currentStock}` });
        return;
      }
      if (type === "IN" && toText(user.role) !== "Super Admin") {
        const txMonth = String(date).slice(0, 7);
        const hasMonthlyRefill = txns.some(
          (row) =>
            Number(row.itemId) === Number(item.id) &&
            normalizeInventoryTxnType(row.type) === "IN" &&
            String(toText(row.date)).slice(0, 7) === txMonth
        );
        if (hasMonthlyRefill) {
          sendJson(res, 400, { error: "Monthly refill already recorded for this item. Use Borrow Return (In) for cross-campus stock." });
          return;
        }
      }

      const photo = await normalizePhotoValue(body.photo, "inventory");
      const duplicateTxnPayload = {
        itemId: item.id,
        date,
        type,
        qty,
        by: toText(body.by),
        note: toText(body.note),
        photo,
      };
      if (type === "OUT") {
        const duplicateTxn = txns.find((row) => isDuplicateInventoryOutTxn(row, duplicateTxnPayload));
        if (duplicateTxn) {
          sendJson(res, 200, {
            txn: duplicateTxn,
            telegramAlertSent: Array.isArray(duplicateTxn.telegramMessageRefs) && duplicateTxn.telegramMessageRefs.length > 0,
            duplicateSuppressed: true,
          });
          return;
        }
      }
      const txn = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        itemId: item.id,
        campus: toText(item.campus),
        itemCode: toText(item.itemCode),
        itemName: toText(item.itemName),
        date,
        type,
        qty,
        by: toText(body.by),
        note: toText(body.note),
        fromCampus: type === "BORROW_IN" ? fromCampus : toText(item.campus),
        toCampus: type === "BORROW_OUT" || type === "BORROW_CONSUME" ? toCampus : toText(item.campus),
        expectedReturnDate: type === "BORROW_OUT" ? expectedReturnDate : "",
        requestedBy,
        approvedBy,
        receivedBy,
        photo,
        borrowStatus:
          type === "BORROW_OUT"
            ? "BORROW_OPEN"
            : type === "BORROW_IN"
              ? "CLOSED"
              : type === "BORROW_CONSUME"
                ? "CONSUMED"
                : "",
        approvalStatus,
        approvalRequestedBy: approvalStatus === "PENDING" ? approvalRequestedBy : "",
        approvalRequestedUser: approvalStatus === "PENDING" ? toText(user.username) : "",
        approvalRequestedAt: approvalStatus === "PENDING" ? approvalRequestedAt : "",
        approvalDecisionBy: approvalStatus === "APPROVED" ? (approvalDecisionBy || toText(user.displayName) || toText(user.username)) : "",
        approvalDecisionAt: approvalStatus === "APPROVED" ? (approvalDecisionAt || new Date().toISOString()) : "",
        approvalDecisionNote: approvalStatus === "APPROVED" ? approvalDecisionNote : "",
        txnSource,
        referenceAssetId,
        referenceAssetDbId,
        supplier,
        invoiceNo,
        unitCost,
        totalCost,
        telegramMessageRefs: [],
      };
      let approverTargets = [];
      if (approvalStatus === "PENDING") {
        approverTargets = resolveInventoryApprovalApprovers(db, txn.approvalRequestedUser, txn.campus);
        const requesterTarget = toText(txn.approvalRequestedUser).toLowerCase();
        const notifyTargets = Array.from(
          new Set(
            [...approverTargets, requesterTarget].filter(Boolean)
          )
        );
        upsertNotification(db, {
          id: Date.now() + Math.floor(Math.random() * 1000),
          key: `inventory-out-approval:${txn.id}`,
          kind: "inventory_out_approval",
          title: `Approval required: Stock OUT ${txn.itemCode}`,
          message: `${txn.itemName} (${txn.qty}) at ${txn.campus} on ${txn.date}. Requested by ${txn.approvalRequestedBy || txn.by || "staff"}.`,
          assetId: txn.itemCode,
          assetDbId: Number(txn.itemId) || 0,
          campus: txn.campus,
          scheduleDate: txn.date,
          createdAt: new Date().toISOString(),
          readBy: [],
          targetUsernames: notifyTargets,
          generatedBy: "inventory-out-approval",
        });
      }
      const nextTxns = [txn, ...txns];
      setInventoryState(db, settings, items, nextTxns);
      appendAuditLog(db, user, "CREATE", "inventory_txn", `${txn.itemCode}-${txn.id}`, `${type} ${qty} ${item.unit}`);
      await writeDb(db);
      let telegramAlertSent = false;
      if (normalizeInventoryTxnType(txn.type) === "OUT") {
        let telegramReport = null;
        if (approvalStatus === "PENDING") {
          telegramReport = await sendTelegramInventoryOutApprovalAlert(txn, approverTargets, db);
        } else {
          telegramReport = await sendTelegramInventoryOutRecordedAlert(txn, db);
        }
        telegramAlertSent = Boolean(telegramReport && telegramReport.ok);
        if (telegramAlertSent) {
          txn.telegramMessageRefs = normalizeTelegramMessageRefs(telegramReport && telegramReport.messageRefs);
          nextTxns[0] = txn;
          setInventoryState(db, settings, items, nextTxns);
          await writeDb(db);
        }
      }
      sendJson(res, 201, { txn, telegramAlertSent, duplicateSuppressed: false });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/toner/purchases") {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const body = await parseBody(req);
      const itemId = Number(body.itemId || 0);
      const qty = Math.max(0, Math.round(Number(body.qty || 0)));
      const date = toText(body.date);
      const by = toText(body.by) || toText(admin.displayName) || toText(admin.username);
      const supplier = toText(body.supplier);
      const invoiceNo = toText(body.invoiceNo);
      const note = toText(body.note);
      const unitCost = Math.max(0, Number(body.unitCost || 0));
      if (!itemId || !date || qty <= 0) {
        sendJson(res, 400, { error: "itemId, date, qty are required" });
        return;
      }

      const db = await readDb();
      const { settings, items, txns } = getInventoryState(db);
      const item = items.find((row) => Number(row.id) === itemId);
      if (!item) {
        sendJson(res, 404, { error: "Item not found" });
        return;
      }
      if (!isTonerInventoryItem(item)) {
        sendJson(res, 400, { error: "Selected inventory item is not marked as toner" });
        return;
      }
      if (!userCanAccessCampus(admin, toText(item.campus))) {
        sendJson(res, 403, { error: "Campus access denied" });
        return;
      }

      const txn = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        itemId: item.id,
        campus: toText(item.campus),
        itemCode: toText(item.itemCode),
        itemName: toText(item.itemName),
        date,
        type: "IN",
        qty,
        by,
        note,
        fromCampus: "",
        toCampus: toText(item.campus),
        expectedReturnDate: "",
        requestedBy: "",
        approvedBy: "",
        receivedBy: "",
        photo: "",
        borrowStatus: "",
        approvalStatus: "APPROVED",
        approvalRequestedBy: "",
        approvalRequestedUser: "",
        approvalRequestedAt: "",
        approvalDecisionBy: by,
        approvalDecisionAt: new Date().toISOString(),
        approvalDecisionNote: "",
        txnSource: "TONER_PURCHASE",
        referenceAssetId: "",
        referenceAssetDbId: 0,
        supplier,
        invoiceNo,
        unitCost,
        totalCost: Math.max(0, Number(body.totalCost || unitCost * qty)),
        telegramMessageRefs: [],
      };

      const nextTxns = [txn, ...txns];
      setInventoryState(db, settings, items, nextTxns);
      appendAuditLog(db, admin, "CREATE", "toner_purchase", `${txn.itemCode}-${txn.id}`, `${qty} @ ${unitCost}`);
      await writeDb(db);
      sendJson(res, 201, { txn });
      return;
    }

    const tonerChangeMatch = url.pathname.match(/^\/api\/assets\/(\d+)\/toner-change$/);
    if (req.method === "POST" && tonerChangeMatch) {
      const user = getAuthUser(req);
      if (!user) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }
      if (!canRecordMaintenance(user)) {
        sendJson(res, 403, { error: "Maintenance record permission required" });
        return;
      }
      const assetDbId = Number(tonerChangeMatch[1]);
      const body = await parseBody(req);
      const date = toText(body.date);
      const itemId = Number(body.itemId || 0);
      const qty = Math.max(1, Math.round(Number(body.qty || 1)));
      const note = toText(body.note);
      const by = toText(body.by) || toText(user.displayName) || toText(user.username);
      const cost = toText(body.cost);
      const condition = toText(body.condition);
      const oldTonerStatus = toText(body.oldTonerStatus);
      const pageCounter = Math.max(0, Number(body.pageCounter || 0));
      const photo = await normalizePhotoValue(body.photo, "maintenance");
      if (!assetDbId || !itemId || !date || !note) {
        sendJson(res, 400, { error: "date, itemId, note are required" });
        return;
      }

      const db = await readDb();
      const assetIdx = db.assets.findIndex((row) => Number(row.id) === assetDbId);
      if (assetIdx === -1) {
        sendJson(res, 404, { error: "Asset not found" });
        return;
      }
      const asset = db.assets[assetIdx];
      if (!isPrinterAsset(asset)) {
        sendJson(res, 400, { error: "Toner change is only available for printer assets" });
        return;
      }
      if (!userCanAccessCampus(user, toText(asset.campus))) {
        sendJson(res, 403, { error: "Campus access denied" });
        return;
      }

      const { settings, items, txns } = getInventoryState(db);
      const item = items.find((row) => Number(row.id) === itemId);
      if (!item) {
        sendJson(res, 404, { error: "Inventory item not found" });
        return;
      }
      if (!isTonerInventoryItem(item)) {
        sendJson(res, 400, { error: "Selected item is not marked as toner" });
        return;
      }
      const currentStock = calcInventoryCurrentStock(item, txns);
      if (qty > currentStock) {
        sendJson(res, 400, { error: `Not enough toner stock. Current: ${currentStock}` });
        return;
      }
      if (Number(asset.tonerItemId || 0) && Number(asset.tonerItemId || 0) !== Number(item.id)) {
        sendJson(res, 400, { error: "Selected toner does not match this printer configuration" });
        return;
      }

      const entry = {
        id: Date.now(),
        date,
        type: "Toner Replacement",
        note,
        completion: "Done",
        condition,
        cost,
        by,
        tonerItemId: item.id,
        tonerItemCode: toText(item.itemCode),
        tonerItemName: toText(item.itemName),
        tonerQty: qty,
        tonerModel: toText(asset.tonerModel) || toText(item.itemName),
        oldTonerStatus,
        pageCounter,
        photo,
        photos: photo ? [photo] : [],
        beforePhotos: [],
        afterPhotos: photo ? [photo] : [],
        ticketId: 0,
        ticketNo: "",
        requestSource: "qr_asset",
        requestedBy: "",
        requestTitle: "Toner replacement",
      };
      const txn = {
        id: Date.now() + Math.floor(Math.random() * 1000) + 1,
        itemId: item.id,
        campus: toText(item.campus),
        itemCode: toText(item.itemCode),
        itemName: toText(item.itemName),
        date,
        type: "OUT",
        qty,
        by,
        note: note || `Toner used for ${toText(asset.assetId)}`,
        fromCampus: toText(item.campus),
        toCampus: toText(item.campus),
        expectedReturnDate: "",
        requestedBy: "",
        approvedBy: "",
        receivedBy: "",
        photo: "",
        borrowStatus: "",
        approvalStatus: "APPROVED",
        approvalRequestedBy: "",
        approvalRequestedUser: "",
        approvalRequestedAt: "",
        approvalDecisionBy: by,
        approvalDecisionAt: new Date().toISOString(),
        approvalDecisionNote: "",
        txnSource: "TONER_CHANGE",
        referenceAssetId: toText(asset.assetId),
        referenceAssetDbId: Number(asset.id) || 0,
        supplier: "",
        invoiceNo: "",
        unitCost: Math.max(0, Number(item.defaultUnitCost || 0)),
        totalCost: Math.max(0, qty * Number(item.defaultUnitCost || 0)),
        telegramMessageRefs: [],
      };

      db.assets[assetIdx] = {
        ...asset,
        tonerModel: toText(asset.tonerModel) || toText(item.itemName),
        tonerItemId: item.id,
        tonerLastChangedAt: date,
        tonerLastPageCount: pageCounter,
        maintenanceHistory: Array.isArray(asset.maintenanceHistory)
          ? [entry, ...asset.maintenanceHistory]
          : [entry],
      };
      setInventoryState(db, settings, items, [txn, ...txns]);
      appendAuditLog(db, user, "CREATE", "toner_change", `${toText(asset.assetId)}#${entry.id}`, `${toText(item.itemCode)} x${qty}`);
      ensureMaintenanceScheduleNotifications(db);
      await writeDb(db);
      sendJson(res, 201, { asset: db.assets[assetIdx], entry, txn });
      return;
    }

    const inventoryTxnApprovalMatch = url.pathname.match(/^\/api\/inventory\/txns\/(\d+)\/approval$/);
    if (req.method === "PATCH" && inventoryTxnApprovalMatch) {
      const approver = getAuthUser(req);
      if (!approver) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }
      if (!isAdminRole(approver.role)) {
        sendJson(res, 403, { error: "Manager approval required" });
        return;
      }
      const txnId = Number(inventoryTxnApprovalMatch[1]);
      if (!txnId) {
        sendJson(res, 400, { error: "Invalid ID" });
        return;
      }
      const body = await parseBody(req);
      const status = toUpper(body.status);
      if (status !== "APPROVED" && status !== "REJECTED") {
        sendJson(res, 400, { error: "status must be APPROVED or REJECTED" });
        return;
      }
      const decisionNote = toText(body.note);
      if (status === "REJECTED" && !decisionNote) {
        sendJson(res, 400, { error: "Rejection reason is required" });
        return;
      }
      const db = await readDb();
      const { settings, items, txns } = getInventoryState(db);
      const txIdx = txns.findIndex((row) => Number(row.id) === txnId);
      if (txIdx === -1) {
        sendJson(res, 404, { error: "Transaction not found" });
        return;
      }
      const current = txns[txIdx];
      if (normalizeInventoryTxnType(current.type) !== "OUT") {
        sendJson(res, 400, { error: "Approval is only available for Stock OUT requests" });
        return;
      }
      if (toUpper(current.approvalStatus) !== "PENDING") {
        sendJson(res, 400, { error: "Only pending requests can be updated" });
        return;
      }
      const item = items.find((row) => Number(row.id) === Number(current.itemId));
      if (!item) {
        sendJson(res, 404, { error: "Item not found" });
        return;
      }
      if (!userCanAccessCampus(approver, toText(item.campus))) {
        sendJson(res, 403, { error: "Campus access denied" });
        return;
      }
      const approverUsername = toText(approver.username).toLowerCase();
      const allowedApproverTargets = resolveInventoryApprovalApprovers(
        db,
        toText(current.approvalRequestedUser),
        toText(current.campus) || toText(item.campus)
      );
      if (!approverUsername || !allowedApproverTargets.includes(approverUsername)) {
        sendJson(res, 403, { error: "Only assigned approver manager can update this request" });
        return;
      }
      if (status === "APPROVED") {
        const currentStock = calcInventoryCurrentStock(item, txns);
        const qty = Math.max(0, Number(current.qty || 0));
        if (qty > currentStock) {
          sendJson(res, 400, { error: `Not enough stock at approval time. Current: ${currentStock}` });
          return;
        }
      }
      const updated = {
        ...current,
        approvalStatus: status,
        approvalDecisionBy: toText(approver.displayName) || toText(approver.username),
        approvalDecisionAt: new Date().toISOString(),
        approvalDecisionNote: decisionNote,
      };
      const nextTxns = txns.slice();
      nextTxns[txIdx] = updated;
      const requesterUser = toText(current.approvalRequestedUser).toLowerCase();
      if (requesterUser) {
        const isApproved = status === "APPROVED";
        const requesterTitle = isApproved
          ? `Stock OUT approved: ${toText(updated.itemCode) || "Item"}`
          : `Stock OUT rejected: ${toText(updated.itemCode) || "Item"}`;
        const requesterMessage = isApproved
          ? `${toText(updated.itemName) || "Item"} (${Number(updated.qty) || 0}) was approved by ${toText(updated.approvalDecisionBy) || "manager"}.`
          : `${toText(updated.itemName) || "Item"} (${Number(updated.qty) || 0}) was rejected by ${toText(updated.approvalDecisionBy) || "manager"}${decisionNote ? `: ${decisionNote}` : "."}`;
        upsertNotification(db, {
          id: Date.now() + Math.floor(Math.random() * 1000),
          key: `inventory-out-decision:${Number(updated.id) || 0}`,
          kind: "inventory_out_decision",
          title: requesterTitle,
          message: requesterMessage,
          assetId: toText(updated.itemCode),
          assetDbId: Number(updated.itemId) || 0,
          campus: toText(updated.campus),
          scheduleDate: toText(updated.date),
          createdAt: new Date().toISOString(),
          readBy: [],
          targetUsernames: [requesterUser],
          generatedBy: "inventory-out-approval-decision",
        });
      }
      setInventoryState(db, settings, items, nextTxns);
      appendAuditLog(
        db,
        approver,
        "UPDATE",
        "inventory_txn_approval",
        `${updated.itemCode}-${updated.id}`,
        `${status}${decisionNote ? ` | ${decisionNote}` : ""}`
      );
      await writeDb(db);
      sendJson(res, 200, { txn: updated });
      return;
    }

    const inventoryTxnMatch = url.pathname.match(/^\/api\/inventory\/txns\/(\d+)$/);
    if (req.method === "PATCH" && inventoryTxnMatch) {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const txnId = Number(inventoryTxnMatch[1]);
      if (!txnId) {
        sendJson(res, 400, { error: "Invalid ID" });
        return;
      }
      const body = await parseBody(req);
      const db = await readDb();
      const { settings, items, txns } = getInventoryState(db);
      const txIdx = txns.findIndex((row) => Number(row.id) === txnId);
      if (txIdx === -1) {
        sendJson(res, 404, { error: "Transaction not found" });
        return;
      }
      const current = txns[txIdx];
      const itemId = Number(body.itemId || current.itemId || 0);
      const item = items.find((row) => Number(row.id) === itemId);
      if (!item) {
        sendJson(res, 404, { error: "Item not found" });
        return;
      }
      if (!userCanAccessCampus(admin, toText(item.campus))) {
        sendJson(res, 403, { error: "Campus access denied" });
        return;
      }
      const date = toText(body.date || current.date);
      const type = normalizeInventoryTxnType(body.type || current.type);
      const qtyRaw = Number(body.qty ?? current.qty ?? 0);
      const qty = Math.max(0, Math.round(qtyRaw));
      if (!date || !type || !Number.isFinite(qtyRaw) || (type !== "SET" && qty <= 0)) {
        sendJson(res, 400, { error: "date, type, qty are required" });
        return;
      }
      if ((type === "SET" || normalizeInventoryTxnType(current.type) === "SET") && toText(admin.role) !== "Super Admin") {
        sendJson(res, 403, { error: "Only Super Admin can edit Set Current Stock transactions" });
        return;
      }

      const fromCampus = toText(body.fromCampus ?? current.fromCampus);
      const toCampus = toText(body.toCampus ?? current.toCampus);
      const expectedReturnDate = toText(body.expectedReturnDate ?? current.expectedReturnDate);
      const requestedBy = toText(body.requestedBy ?? current.requestedBy);
      const approvedBy = toText(body.approvedBy ?? current.approvedBy);
      const receivedBy = toText(body.receivedBy ?? current.receivedBy);
      const txnSource = toUpper(body.txnSource ?? current.txnSource) || "GENERAL";
      const referenceAssetId = toText(body.referenceAssetId ?? current.referenceAssetId);
      const referenceAssetDbId = Number(body.referenceAssetDbId ?? current.referenceAssetDbId ?? 0);
      const supplier = toText(body.supplier ?? current.supplier);
      const invoiceNo = toText(body.invoiceNo ?? current.invoiceNo);
      const unitCost = Math.max(0, Number(body.unitCost ?? current.unitCost ?? 0));
      const totalCost = Math.max(0, Number(body.totalCost ?? current.totalCost ?? (unitCost * qty)));
      if ((type === "BORROW_OUT" || type === "BORROW_CONSUME") && (!toCampus || !requestedBy || !approvedBy)) {
        sendJson(res, 400, { error: "Borrow Out/Consume requires toCampus, requestedBy, approvedBy" });
        return;
      }
      if (type === "BORROW_IN" && (!fromCampus || !receivedBy)) {
        sendJson(res, 400, { error: "Borrow Return requires fromCampus and receivedBy" });
        return;
      }
      const stockWithoutCurrent = calcInventoryCurrentStock(item, txns, txnId);
      if (isInventoryTxnOutType(type) && qty > stockWithoutCurrent) {
        sendJson(res, 400, { error: `Not enough stock. Current: ${stockWithoutCurrent}` });
        return;
      }
      if (type === "IN" && toText(admin.role) !== "Super Admin") {
        const txMonth = String(date).slice(0, 7);
        const hasMonthlyRefill = txns.some(
          (row) =>
            Number(row.id) !== Number(txnId) &&
            Number(row.itemId) === Number(item.id) &&
            normalizeInventoryTxnType(row.type) === "IN" &&
            String(toText(row.date)).slice(0, 7) === txMonth
        );
        if (hasMonthlyRefill) {
          sendJson(res, 400, { error: "Monthly refill already recorded for this item. Use Borrow Return (In) for cross-campus stock." });
          return;
        }
      }
      const nextPhoto = Object.prototype.hasOwnProperty.call(body, "photo")
        ? await normalizePhotoValue(body.photo, "inventory")
        : toText(current.photo);
      const updated = {
        ...current,
        itemId: item.id,
        campus: toText(item.campus),
        itemCode: toText(item.itemCode),
        itemName: toText(item.itemName),
        date,
        type,
        qty,
        by: toText(body.by ?? current.by),
        note: toText(body.note ?? current.note),
        fromCampus: type === "BORROW_IN" ? fromCampus : toText(item.campus),
        toCampus: type === "BORROW_OUT" || type === "BORROW_CONSUME" ? toCampus : toText(item.campus),
        expectedReturnDate: type === "BORROW_OUT" ? expectedReturnDate : "",
        requestedBy,
        approvedBy,
        receivedBy,
        txnSource,
        referenceAssetId,
        referenceAssetDbId,
        supplier,
        invoiceNo,
        unitCost,
        totalCost,
        photo: nextPhoto,
        borrowStatus:
          type === "BORROW_OUT"
            ? (toText(current.borrowStatus) || "BORROW_OPEN")
            : type === "BORROW_IN"
              ? "CLOSED"
              : type === "BORROW_CONSUME"
                ? "CONSUMED"
                : "",
      };
      const nextTxns = txns.slice();
      nextTxns[txIdx] = updated;
      setInventoryState(db, settings, items, nextTxns);
      appendAuditLog(db, admin, "UPDATE", "inventory_txn", `${updated.itemCode}-${updated.id}`, `${updated.type} ${updated.qty}`);
      await writeDb(db);
      sendJson(res, 200, { txn: updated });
      return;
    }

    if (req.method === "DELETE" && inventoryTxnMatch) {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const txnId = Number(inventoryTxnMatch[1]);
      if (!txnId) {
        sendJson(res, 400, { error: "Invalid ID" });
        return;
      }
      const db = await readDb();
      const { settings, items, txns } = getInventoryState(db);
      const current = txns.find((row) => Number(row.id) === txnId);
      if (!current) {
        sendJson(res, 404, { error: "Transaction not found" });
        return;
      }
      const item = items.find((row) => Number(row.id) === Number(current.itemId));
      if (!item) {
        sendJson(res, 404, { error: "Item not found" });
        return;
      }
      if (normalizeInventoryTxnType(current.type) === "SET" && toText(admin.role) !== "Super Admin") {
        sendJson(res, 403, { error: "Only Super Admin can delete Set Current Stock transactions" });
        return;
      }
      const stockWithoutCurrent = calcInventoryCurrentStock(item, txns, txnId);
      if (stockWithoutCurrent < 0) {
        sendJson(res, 400, { error: "Cannot delete this transaction because it would make stock negative" });
        return;
      }
      const telegramDeleteReport = await deleteTelegramMessagesByRefs(current.telegramMessageRefs);
      const nextTxns = txns.filter((row) => Number(row.id) !== txnId);
      setInventoryState(db, settings, items, nextTxns);
      appendAuditLog(db, admin, "DELETE", "inventory_txn", `${toText(current.itemCode)}-${txnId}`, `${toText(current.type)} ${Number(current.qty) || 0}`);
      await writeDb(db);
      sendJson(res, 200, {
        ok: true,
        telegramDeleted: telegramDeleteReport.ok,
        telegramDeleteCount: telegramDeleteReport.successCount,
      });
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
      sendJson(res, 200, { assets: await normalizeAssetsForResponse(assets) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/assets") {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const body = await parseBody(req);
      const db = await readDb();
      const parentAssignment = syncAssignedToFromParentAsset(db, body);
      const bodyWithParentAssignment =
        parentAssignment.parent && !toText(body.assignedTo)
          ? {
              ...body,
              assignedTo: parentAssignment.assignedTo,
              custodyStatus: parentAssignment.custodyStatus,
            }
          : body;
      const cleaned = validateAsset(bodyWithParentAssignment);
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
      const serialKey = normalizeSerialKey(cleaned.serialNumber);
      if (serialKey) {
        const duplicateSerial = (Array.isArray(db.assets) ? db.assets : []).find(
          (row) => normalizeSerialKey(row && row.serialNumber) === serialKey
        );
        if (duplicateSerial) {
          sendJson(res, 409, {
            error: `Serial number already exists (${toText(duplicateSerial.assetId) || "existing asset"})`,
          });
          return;
        }
      }
      const seq = nextAssetSeq(db.assets, cleaned.campus, cleaned.category, cleaned.type);
      const assetId = `${assetIdCampusCode(cleaned.campus)}-${CATEGORY_CODE[cleaned.category] || "OTA"}-${cleaned.type}-${pad(seq, 3)}`;
      const finalAssignedTo = parentAssignment.parent
        ? parentAssignment.assignedTo
        : toText(cleaned.assignedTo);
      const custodyStatus = parentAssignment.custodyStatus;
      const finalCustodyHistory =
        initialCustodyHistory.length || !finalAssignedTo
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
                toUser: finalAssignedTo,
                responsibilityAck: false,
                by: "",
                note: parentAssignment.parent ? `Initial assignment synced from parent asset ${toText(parentAssignment.parent.assetId)}` : "Initial assignment",
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
        assignedTo: finalAssignedTo,
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
      const cleaned = await validateLocation(body);
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
        isClassroom: cleaned.isClassroom,
        studentCapacity: cleaned.studentCapacity,
        currentStudents: cleaned.currentStudents,
        tableSeatsPerTable: cleaned.tableSeatsPerTable,
        notes: cleaned.notes,
        photo: cleaned.photo,
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
      const cleaned = await validateLocation(body);
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
      db.locations[idx].isClassroom = cleaned.isClassroom;
      db.locations[idx].studentCapacity = cleaned.studentCapacity;
      db.locations[idx].currentStudents = cleaned.currentStudents;
      db.locations[idx].tableSeatsPerTable = cleaned.tableSeatsPerTable;
      db.locations[idx].notes = cleaned.notes;
      db.locations[idx].photo = cleaned.photo;
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
      const hasNextPhotos = Array.isArray(body.photos);
      const hasNextBeforePhotos = Array.isArray(body.beforePhotos);
      const hasNextAfterPhotos = Array.isArray(body.afterPhotos);
      const nextMedia = await normalizeMaintenanceMediaPayload(body);
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
      const hasNextWorkflow = Object.prototype.hasOwnProperty.call(body, "workflow");
      const nextWorkflow = hasNextWorkflow
        ? normalizeMaintenanceWorkflowPayload(body.workflow)
        : normalizeMaintenanceWorkflowPayload(current.workflow);
      const nextCompletion = normalizeCompletion(body.completion);
      const nextCondition = toText(body.condition);
      const hasNextReportFile = Object.prototype.hasOwnProperty.call(body, "reportFile");
      const nextReportFile = hasNextReportFile
        ? await normalizeAttachmentValue(body.reportFile || {
            url: body.reportFile,
            name: body.reportFileName,
            mimeType: body.reportFileType,
          }, "maintenance_reports")
        : {
            url: toText(current.reportFile),
            name: toText(current.reportFileName),
            mimeType: toText(current.reportFileType),
          };
      const currentPhotos = Array.isArray(current.photos)
        ? current.photos.map((p) => toText(p)).filter(Boolean)
        : (toText(current.photo) ? [toText(current.photo)] : []);
      const currentBeforePhotos = Array.isArray(current.beforePhotos)
        ? current.beforePhotos.map((p) => toText(p)).filter(Boolean)
        : [];
      const currentAfterPhotos = Array.isArray(current.afterPhotos)
        ? current.afterPhotos.map((p) => toText(p)).filter(Boolean)
        : currentPhotos;
      const hasPhotoOverride = Object.prototype.hasOwnProperty.call(body, "photo") && toText(body.photo);
      let resolvedBeforePhotos = hasNextBeforePhotos ? nextMedia.beforePhotos : [...currentBeforePhotos];
      let resolvedAfterPhotos =
        hasNextAfterPhotos || hasNextPhotos || hasPhotoOverride ? nextMedia.afterPhotos : [...currentAfterPhotos];
      resolvedBeforePhotos = resolvedBeforePhotos.slice(0, 5);
      resolvedAfterPhotos = resolvedAfterPhotos.slice(0, 5);
      const updated = {
        ...current,
        date: nextDate || toText(current.date),
        type: nextType || toText(current.type),
        completion: nextCompletion || normalizeCompletion(current.completion),
        condition: nextCondition,
        note: nextNote || toText(current.note),
        cost: nextCost,
        by: nextBy,
        photo: resolvedAfterPhotos[0] || toText(current.photo),
        photos: resolvedAfterPhotos,
        beforePhotos: resolvedBeforePhotos,
        afterPhotos: resolvedAfterPhotos,
        reportFile: nextReportFile.url,
        reportFileName: nextReportFile.name,
        reportFileType: nextReportFile.mimeType,
        workflow: nextWorkflow,
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

    const statusHistoryDeleteMatch = url.pathname.match(/^\/api\/assets\/(\d+)\/status-history\/(\d+)$/);
    if (req.method === "DELETE" && statusHistoryDeleteMatch) {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const assetId = Number(statusHistoryDeleteMatch[1]);
      const entryId = Number(statusHistoryDeleteMatch[2]);
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

      const history = Array.isArray(db.assets[idx].statusHistory)
        ? db.assets[idx].statusHistory
        : [];
      const before = history.length;
      const deletedEntry = history.find((entry) => Number(entry?.id) === entryId) || null;
      db.assets[idx].statusHistory = history.filter((entry) => Number(entry?.id) !== entryId);
      if (db.assets[idx].statusHistory.length === before) {
        sendJson(res, 404, { error: "Status history record not found" });
        return;
      }

      appendAuditLog(
        db,
        admin,
        "DELETE",
        "status_history",
        `${db.assets[idx].assetId || assetId}#${entryId}`,
        deletedEntry
          ? `${toText(deletedEntry.fromStatus)} -> ${toText(deletedEntry.toStatus)} | ${toText(deletedEntry.reason)}`
          : "Status history deleted"
      );
      await writeDb(db);
      sendJson(res, 200, { asset: db.assets[idx], ok: true });
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
      const serialKey = normalizeSerialKey(cleaned.serialNumber);
      if (serialKey) {
        const duplicateSerial = (Array.isArray(db.assets) ? db.assets : []).find(
          (row) =>
            Number(row && row.id) !== id &&
            normalizeSerialKey(row && row.serialNumber) === serialKey
        );
        if (duplicateSerial) {
          sendJson(res, 409, {
            error: `Serial number already exists (${toText(duplicateSerial.assetId) || "existing asset"})`,
          });
          return;
        }
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
      const parentAssignment = syncAssignedToFromParentAsset(db, cleaned);
      const previousAssignedTo = toText(current.assignedTo);
      const incomingAssignedTo = parentAssignment.assignedTo;
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
            note: parentAssignment.parent
              ? `Assignment synced from parent asset ${toText(parentAssignment.parent.assetId)}`
              : "Assignment changed from asset edit",
          },
          ...finalCustodyHistory,
        ];
      }
      const nextCustodyStatus = parentAssignment.custodyStatus;
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
        assignedTo: incomingAssignedTo,
        photo: mainPhoto,
        photos: nextPhotos,
        maintenanceHistory: nextHistory,
        transferHistory: nextTransferHistory,
        statusHistory: nextStatusHistory,
        custodyHistory: finalCustodyHistory,
        custodyStatus: nextCustodyStatus,
        name: current.assetId,
      };
      const cascadedChildren = assignmentChanged
        ? cascadeChildAssetAssignment(db, db.assets[idx], incomingAssignedTo, {
            changedBy: statusChangeBy || toText(admin.displayName) || toText(admin.username),
            date: new Date().toISOString(),
            note: `Assignment synced from parent asset ${toText(db.assets[idx].assetId)}`,
          })
        : 0;
      appendAuditLog(
        db,
        admin,
        "UPDATE",
        "asset",
        db.assets[idx].assetId || String(id),
        `${db.assets[idx].campus} | ${db.assets[idx].location}${photoChanged ? " | photo updated" : ""}${cascadedChildren ? ` | child assignment synced: ${cascadedChildren}` : ""}`
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
      const media = await normalizeMaintenanceMediaPayload(body);
      const workflow = normalizeMaintenanceWorkflowPayload(body.workflow);
      const reportFile = await normalizeAttachmentValue(body.reportFile || {
        url: body.reportFile,
        name: body.reportFileName,
        mimeType: body.reportFileType,
      }, "maintenance_reports");
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
        photo: media.photo,
        photos: media.photos,
        beforePhotos: media.beforePhotos,
        afterPhotos: media.afterPhotos,
        reportFile: reportFile.url,
        reportFileName: reportFile.name,
        reportFileType: reportFile.mimeType,
        workflow,
        ticketId: 0,
        ticketNo: "",
        requestSource: "manual",
        requestedBy: "",
        requestTitle: "",
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
      const photo = await normalizePhotoValue(body.photo, "maintenance");
      const ticket = {
        id: Date.now(),
        ticketNo: nextTicketCode(db.tickets, cleaned.campus),
        created: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        photo,
        telegramMessageRefs: [],
        ...cleaned,
      };

      db.tickets.unshift(ticket);
      appendAuditLog(db, admin, "CREATE", "ticket", ticket.ticketNo, `${ticket.campus} | ${ticket.title}`);
      await writeDb(db);
      try {
        const telegramReport = await sendTelegramWorkOrderCreatedAlert(ticket, db);
        if (telegramReport && telegramReport.ok) {
          ticket.telegramMessageRefs = normalizeTelegramMessageRefs(telegramReport.messageRefs);
          db.tickets[0] = ticket;
          await writeDb(db);
        }
      } catch (err) {
        console.warn("[MAINTENANCE ALERT] Failed to send work-order alert:", err instanceof Error ? err.message : err);
      }
      sendJson(res, 201, { ticket });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/public/tickets") {
      const body = await parseBody(req);
      const db = await readDb();
      const assets = Array.isArray(db.assets) ? db.assets : [];
      const assetId = toText(body.assetId);
      const asset = assetId ? selectBestAssetByAssetId(assets, assetId) : null;
      if (!asset) {
        sendJson(res, 404, { error: "Asset not found" });
        return;
      }
      const cleaned = validateTicket({
        ...body,
        campus: toText(body.campus) || toText(asset.campus),
        category: toText(body.category) || toText(asset.category),
        assetId: toText(asset.assetId),
        assetDbId: Number(asset.id) || 0,
        assetName: toText(asset.name) || toText(asset.assetId),
        assetLocation: toText(asset.location),
        title: toText(body.title) || `Repair request for ${toText(asset.assetId)}`,
        requestSource: "qr_scan",
        status: "Open",
      });
      if (typeof cleaned === "string") {
        sendJson(res, 400, { error: cleaned });
        return;
      }
      const photo = await normalizePhotoValue(body.photo, "maintenance");
      const ticket = {
        id: Date.now(),
        ticketNo: nextTicketCode(db.tickets, cleaned.campus),
        created: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        photo,
        telegramMessageRefs: [],
        ...cleaned,
      };
      db.tickets.unshift(ticket);
      appendAuditLog(db, null, "CREATE", "ticket", ticket.ticketNo, `${ticket.campus} | ${ticket.title} | QR request`);
      await writeDb(db);
      try {
        const telegramReport = await sendTelegramWorkOrderCreatedAlert(ticket, db);
        if (telegramReport && telegramReport.ok) {
          ticket.telegramMessageRefs = normalizeTelegramMessageRefs(telegramReport.messageRefs);
          db.tickets[0] = ticket;
          await writeDb(db);
        }
      } catch (err) {
        console.warn("[MAINTENANCE ALERT] Failed to send QR work-order alert:", err instanceof Error ? err.message : err);
      }
      sendJson(res, 201, { ticket });
      return;
    }

    if (req.method === "PATCH" && /^\/api\/tickets\/\d+$/.test(url.pathname)) {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const id = Number(url.pathname.replace("/api/tickets/", ""));
      if (!id) {
        sendJson(res, 400, { error: "Invalid ID" });
        return;
      }
      const body = await parseBody(req);
      const db = await readDb();
      const idx = db.tickets.findIndex((t) => Number(t.id) === id);
      if (idx === -1) {
        sendJson(res, 404, { error: "Ticket not found" });
        return;
      }
      const current = normalizeTickets([db.tickets[idx]])[0];
      const nextAssetId = toText(body.assetId ?? current.assetId).toUpperCase();
      const linkedAsset = nextAssetId ? selectBestAssetByAssetId(Array.isArray(db.assets) ? db.assets : [], nextAssetId) : null;
      const photo =
        body.photo === undefined
          ? current.photo
          : await normalizePhotoValue(body.photo, "maintenance");
      const next = {
        ...current,
        campus: normalizeCampusInput(body.campus) || current.campus,
        category: normalizeCategoryInput(body.category) || current.category,
        assetId: nextAssetId,
        assetDbId: linkedAsset ? Number(linkedAsset.id) || 0 : 0,
        assetName: linkedAsset ? toText(linkedAsset.name) || toText(linkedAsset.assetId) : "",
        assetLocation: linkedAsset ? toText(linkedAsset.location) : "",
        title: toText(body.title ?? current.title),
        description: toText(body.description ?? current.description),
        requestedBy: toText(body.requestedBy ?? current.requestedBy),
        requesterContact: toText(body.requesterContact ?? current.requesterContact),
        priority: toText(body.priority ?? current.priority) || current.priority,
        status: toText(body.status ?? current.status) || current.status,
        assignedTo: toText(body.assignedTo ?? current.assignedTo),
        photo,
        updatedAt: new Date().toISOString(),
      };
      db.tickets[idx] = next;
      appendAuditLog(db, admin, "UPDATE", "ticket", next.ticketNo || String(id), `${next.status} | ${next.assignedTo || "-"}`);
      await writeDb(db);
      sendJson(res, 200, { ticket: next });
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
      db.tickets[idx].updatedAt = new Date().toISOString();
      appendAuditLog(db, admin, "UPDATE_STATUS", "ticket", db.tickets[idx].ticketNo || String(id), status);
      await writeDb(db);
      sendJson(res, 200, { ticket: db.tickets[idx] });
      return;
    }

    if (req.method === "DELETE" && /^\/api\/tickets\/\d+$/.test(url.pathname)) {
      const superAdmin = requireSuperAdmin(req, res);
      if (!superAdmin) return;
      const id = Number(url.pathname.replace("/api/tickets/", ""));
      if (!id) {
        sendJson(res, 400, { error: "Invalid ID" });
        return;
      }
      const db = await readDb();
      const idx = db.tickets.findIndex((t) => Number(t.id) === id);
      if (idx === -1) {
        sendJson(res, 404, { error: "Ticket not found" });
        return;
      }
      const current = normalizeTickets([db.tickets[idx]])[0];
      db.tickets.splice(idx, 1);
      appendAuditLog(
        db,
        superAdmin,
        "DELETE",
        "ticket",
        current.ticketNo || String(id),
        `${current.campus} | ${current.title}`
      );
      await writeDb(db);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && url.pathname.startsWith("/api/tickets/") && url.pathname.endsWith("/complete-maintenance")) {
      const user = getAuthUser(req);
      if (!user) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }
      if (!canRecordMaintenance(user)) {
        sendJson(res, 403, { error: "Maintenance record permission required" });
        return;
      }
      const id = Number(url.pathname.replace("/api/tickets/", "").replace("/complete-maintenance", ""));
      if (!id) {
        sendJson(res, 400, { error: "Invalid ID" });
        return;
      }
      const body = await parseBody(req);
      const date = toText(body.date);
      const type = toText(body.type);
      const note = toText(body.note);
      const cost = toText(body.cost);
      const by = toText(body.by) || toText(user.displayName) || toText(user.username);
      const condition = toText(body.condition);
      const completion = normalizeCompletion(body.completion);
      const status = toText(body.ticketStatus) || "Done";
      const media = await normalizeMaintenanceMediaPayload(body);
      const reportFile = await normalizeAttachmentValue(body.reportFile || {
        url: body.reportFile,
        name: body.reportFileName,
        mimeType: body.reportFileType,
      }, "maintenance_reports");
      if (!date || !type || !note) {
        sendJson(res, 400, { error: "date, type, note are required" });
        return;
      }
      const db = await readDb();
      const ticketIdx = db.tickets.findIndex((t) => Number(t.id) === id);
      if (ticketIdx === -1) {
        sendJson(res, 404, { error: "Ticket not found" });
        return;
      }
      const ticket = normalizeTickets([db.tickets[ticketIdx]])[0];
      if (!ticket.assetDbId) {
        sendJson(res, 400, { error: "This work order is not linked to an asset" });
        return;
      }
      const assetIdx = db.assets.findIndex((a) => Number(a.id) === Number(ticket.assetDbId));
      if (assetIdx === -1) {
        sendJson(res, 404, { error: "Asset not found" });
        return;
      }
      if (!userCanAccessCampus(user, toText(db.assets[assetIdx].campus))) {
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
        photo: media.photo,
        photos: media.photos,
        beforePhotos: media.beforePhotos,
        afterPhotos: media.afterPhotos,
        reportFile: reportFile.url,
        reportFileName: reportFile.name,
        reportFileType: reportFile.mimeType,
      };
      db.assets[assetIdx].maintenanceHistory = Array.isArray(db.assets[assetIdx].maintenanceHistory)
        ? [entry, ...db.assets[assetIdx].maintenanceHistory]
        : [entry];
      if (syncAssetStatusFromMaintenance(db.assets[assetIdx])) {
        appendAuditLog(
          db,
          user,
          "UPDATE_STATUS",
          "asset",
          db.assets[assetIdx].assetId || String(ticket.assetDbId),
          "Defective (auto from replacement)"
        );
      }
      db.tickets[ticketIdx] = {
        ...ticket,
        status,
        completedAt: new Date().toISOString(),
        completedBy: by,
        maintenanceEntryId: entry.id,
        maintenanceAssetId: Number(db.assets[assetIdx].id) || 0,
        maintenanceSummary: `${entry.type} | ${entry.completion || "Not Yet"}`,
        updatedAt: new Date().toISOString(),
      };
      appendAuditLog(
        db,
        user,
        "COMPLETE_WORK_ORDER",
        "ticket",
        ticket.ticketNo || String(id),
        `${db.tickets[ticketIdx].status} | ${db.assets[assetIdx].assetId || ticket.assetId}`
      );
      appendAuditLog(
        db,
        user,
        "CREATE",
        "maintenance_record",
        `${db.assets[assetIdx].assetId || ticket.assetId}#${entry.id}`,
        `${entry.type} | ${entry.completion || "Not Yet"}`
      );
      addMaintenanceDoneNotification(db, db.assets[assetIdx], entry);
      ensureMaintenanceScheduleNotifications(db);
      const ticketTelegramRefs = normalizeTelegramMessageRefs(ticket.telegramMessageRefs);
      if (ticketTelegramRefs.length && toText(status).toLowerCase() === "done") {
        const telegramDeleteReport = await deleteTelegramMessagesByRefs(ticketTelegramRefs);
        if (telegramDeleteReport.ok) {
          db.tickets[ticketIdx].telegramMessageRefs = [];
        } else {
          console.warn(
            "[MAINTENANCE ALERT] Failed to delete work-order Telegram message(s):",
            telegramDeleteReport.results
          );
        }
      }
      await writeDb(db);
      sendJson(res, 200, { ticket: db.tickets[ticketIdx], asset: db.assets[assetIdx], entry });
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

  await maybeRunMaintenanceAlertSweep();
  maintenanceAlertSweepTimer = setInterval(() => {
    void maybeRunMaintenanceAlertSweep();
  }, MAINTENANCE_ALERT_SWEEP_INTERVAL_MS);

  server.listen(PORT, HOST, () => {
    const bindHost = HOST === "0.0.0.0" ? "localhost" : HOST;
    const appRoot = path.join(__dirname, "..");
    const usingRepoStorage =
      isPathInside(appRoot, DB_PATH) ||
      isPathInside(appRoot, SQLITE_PATH) ||
      isPathInside(appRoot, UPLOADS_DIR) ||
      isPathInside(appRoot, BACKUPS_DIR);
    console.log(`API running at http://${bindHost}:${PORT}`);
    console.log(`Storage paths: DATA_ROOT=${DATA_ROOT} SQLITE_PATH=${SQLITE_PATH} DB_PATH=${DB_PATH}`);
    console.log(`Uploads=${UPLOADS_DIR} Backups=${BACKUPS_DIR}`);
    if (DB_MIRROR_PATH) {
      console.log(`DB mirror=${DB_MIRROR_PATH}`);
    }
    if (BACKUP_MIRROR_DIR) {
      console.log(`Backup mirror=${BACKUP_MIRROR_DIR} (${BACKUP_COMPRESS ? "json + gzip" : "json"})`);
    }
    if (AUTO_BACKUP_ENABLED) {
      console.log(
        `Auto backup enabled: every ${AUTO_BACKUP_INTERVAL_HOURS}h, retention ${AUTO_BACKUP_RETENTION_DAYS} days`
      );
    } else {
      console.log("Auto backup disabled");
    }
    console.log(
      `Maintenance Telegram alert sweep: every ${MAINTENANCE_ALERT_SWEEP_INTERVAL_MINUTES} minute(s)`
    );
    if (usingRepoStorage) {
      console.warn("[STORAGE] Active data paths are still inside the app directory.");
      console.warn("[STORAGE] Safer production setup: set DATA_ROOT to a persistent disk and BACKUP_MIRROR_DIR to a second location.");
    }
    if (IS_PROD && !BACKUP_MIRROR_DIR) {
      console.warn("[STORAGE] BACKUP_MIRROR_DIR is not configured. Backups currently exist only in the primary storage path.");
    }
  });
}

void startServer();
