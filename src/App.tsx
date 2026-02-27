import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, Eye, EyeOff, Lightbulb } from "lucide-react";
import QRCode from "qrcode";
import "./App.css";

type Asset = {
  id: number;
  campus: string;
  category: string;
  type: string;
  pcType?: string;
  seq: number;
  assetId: string;
  name: string;
  location: string;
  setCode?: string;
  parentAssetId?: string;
  componentRole?: string;
  componentRequired?: boolean;
  assignedTo?: string;
  custodyStatus?: "IN_STOCK" | "ASSIGNED";
  brand?: string;
  model?: string;
  serialNumber?: string;
  specs?: string;
  purchaseDate?: string;
  warrantyUntil?: string;
  vendor?: string;
  notes?: string;
  nextMaintenanceDate?: string;
  nextVerificationDate?: string;
  verificationFrequency?: "NONE" | "MONTHLY" | "TERMLY";
  scheduleNote?: string;
  repeatMode?: "NONE" | "MONTHLY_WEEKDAY";
  repeatWeekOfMonth?: number;
  repeatWeekday?: number;
  maintenanceHistory?: MaintenanceEntry[];
  verificationHistory?: VerificationEntry[];
  transferHistory?: TransferEntry[];
  custodyHistory?: CustodyEntry[];
  statusHistory?: StatusEntry[];
  photo: string;
  photos?: string[];
  status: string;
  created: string;
};
type MaintenanceEntry = {
  id: number;
  date: string;
  type: string;
  note: string;
  completion?: "Done" | "Not Yet";
  condition?: string;
  cost?: string;
  by?: string;
  photo?: string;
};
type VerificationEntry = {
  id: number;
  date: string;
  result: "Verified" | "Issue Found" | "Missing";
  note: string;
  condition?: string;
  by?: string;
  photo?: string;
};
type TransferEntry = {
  id: number;
  date: string;
  fromCampus: string;
  fromLocation: string;
  toCampus: string;
  toLocation: string;
  reason?: string;
  by?: string;
  note?: string;
};
type StatusEntry = {
  id: number;
  date: string;
  fromStatus: string;
  toStatus: string;
  reason?: string;
  by?: string;
};
type CustodyEntry = {
  id: number;
  date: string;
  action: string;
  fromCampus?: string;
  fromLocation?: string;
  toCampus?: string;
  toLocation?: string;
  fromUser?: string;
  toUser?: string;
  responsibilityAck?: boolean;
  by?: string;
  note?: string;
};
type PendingStatusChange = {
  assetId: number;
  fromStatus: string;
  toStatus: string;
  reason: string;
  verifiedBy: string;
};
type PublicQrAsset = {
  id: number;
  assetId: string;
  campus: string;
  category: string;
  type: string;
  pcType?: string;
  name: string;
  location: string;
  setCode?: string;
  parentAssetId?: string;
  componentRole?: string;
  componentRequired?: boolean;
  assignedTo?: string;
  custodyStatus?: "IN_STOCK" | "ASSIGNED";
  brand?: string;
  model?: string;
  serialNumber?: string;
  specs?: string;
  purchaseDate?: string;
  warrantyUntil?: string;
  vendor?: string;
  notes?: string;
  status: string;
  photo?: string;
  photos?: string[];
  maintenanceHistory?: MaintenanceEntry[];
  transferHistory?: TransferEntry[];
  custodyHistory?: CustodyEntry[];
  statusHistory?: StatusEntry[];
  created?: string;
};
type ReportType =
  | "asset_master"
  | "set_code"
  | "asset_by_location"
  | "overdue"
  | "transfer"
  | "staff_borrowing"
  | "maintenance_completion"
  | "verification_summary"
  | "qr_labels";
type EdAssetTemplate = "ALL" | "computer" | "ipad" | "speaker" | "tv" | "aircon" | "monitor" | "peripheral";

type Ticket = {
  id: number;
  ticketNo: string;
  campus: string;
  category: string;
  assetId: string;
  title: string;
  description: string;
  requestedBy: string;
  priority: string;
  status: string;
  created: string;
};

type LocationEntry = {
  id: number;
  campus: string;
  name: string;
};
type StaffUser = {
  id: number;
  fullName: string;
  position: string;
  email: string;
};
type InventoryItem = {
  id: number;
  campus: string;
  category: "SUPPLY" | "CLEAN_TOOL" | "MAINT_TOOL";
  itemCode: string;
  itemName: string;
  unit: string;
  openingQty: number;
  minStock: number;
  location: string;
  vendor?: string;
  notes?: string;
  photo?: string;
  created: string;
};
type InventoryTxn = {
  id: number;
  itemId: number;
  campus: string;
  itemCode: string;
  itemName: string;
  date: string;
  type: "IN" | "OUT" | "BORROW_OUT" | "BORROW_IN" | "BORROW_CONSUME";
  qty: number;
  by?: string;
  note?: string;
  fromCampus?: string;
  toCampus?: string;
  expectedReturnDate?: string;
  requestedBy?: string;
  approvedBy?: string;
  receivedBy?: string;
  borrowStatus?: "BORROW_OPEN" | "PARTIAL_RETURN" | "CLOSED" | "CONSUMED";
  photo?: string;
};

type DashboardStats = {
  totalAssets: number;
  itAssets: number;
  safetyAssets: number;
  openTickets: number;
  byCampus: Array<{ campus: string; assets: number; openTickets: number }>;
};

type ApiError = { error?: string };
type Lang = "en" | "km";
type AssetSubviewAccess = "both" | "list_only";
type AuthRole = "Super Admin" | "Admin" | "Viewer";
type NavModule =
  | "dashboard"
  | "assets"
  | "inventory"
  | "tickets"
  | "schedule"
  | "transfer"
  | "maintenance"
  | "verification"
  | "reports"
  | "setup";
type MenuAccessKey = string;
type AuthUser = {
  id: number;
  username: string;
  displayName: string;
  role: AuthRole;
  campuses?: string[];
  modules?: NavModule[];
  assetSubviewAccess?: AssetSubviewAccess;
  menuAccess?: MenuAccessKey[];
};
type AuthAccount = {
  id: number;
  username: string;
  displayName: string;
  role: AuthRole;
  campuses: string[];
  modules: NavModule[];
  assetSubviewAccess: AssetSubviewAccess;
  menuAccess: MenuAccessKey[];
};
type AuditLog = {
  id: number;
  date: string;
  action: string;
  entity: string;
  entityId: string;
  summary: string;
  actor?: {
    id?: number;
    username?: string;
    displayName?: string;
    role?: string;
  };
};
type ServerSettings = {
  campusNames?: Record<string, string>;
  staffUsers?: StaffUser[];
  calendarEvents?: CalendarEvent[];
  maintenanceReminderOffsets?: number[];
  inventoryItems?: InventoryItem[];
  inventoryTxns?: InventoryTxn[];
};
type CalendarEventType =
  | "public"
  | "ptc"
  | "term_end"
  | "term_start"
  | "camp"
  | "celebration"
  | "break";
type CalendarEvent = {
  id: number;
  date: string;
  name: string;
  type: CalendarEventType;
};
type MaintenanceNotification = {
  id: number;
  key: string;
  kind: string;
  title: string;
  message: string;
  assetId: string;
  assetDbId: number;
  campus: string;
  scheduleDate?: string;
  createdAt: string;
  readBy?: string[];
  read?: boolean;
};
const LOCATION_FALLBACK_KEY = "it_locations_fallback_v1";
const ASSET_FALLBACK_KEY = "it_assets_fallback_v1";
const USER_FALLBACK_KEY = "it_users_fallback_v1";
const CAMPUS_NAME_FALLBACK_KEY = "it_campus_names_fallback_v1";
const ITEM_NAME_FALLBACK_KEY = "it_item_names_fallback_v1";
const ITEM_TYPE_FALLBACK_KEY = "it_item_types_fallback_v1";
const CALENDAR_EVENT_FALLBACK_KEY = "it_calendar_events_v1";
const AUTH_TOKEN_KEY = "it_auth_token_v1";
const AUTH_USER_KEY = "it_auth_user_v1";
const LOGIN_REMEMBER_KEY = "it_login_remember_v1";
const LOGIN_REMEMBER_USERNAME_KEY = "it_login_remember_username_v1";
const AUTH_PERMISSION_FALLBACK_KEY = "it_auth_permissions_fallback_v1";
const AUTH_ACCOUNTS_FALLBACK_KEY = "it_auth_accounts_fallback_v1";
const AUDIT_FALLBACK_KEY = "it_audit_fallback_v1";
const INVENTORY_ITEM_FALLBACK_KEY = "it_inventory_items_v1";
const INVENTORY_TXN_FALLBACK_KEY = "it_inventory_txns_v1";
const API_BASE_OVERRIDE_KEY = "it_api_base_url_v1";
const APP_VERSION = "v2.3.0";
const DEFAULT_MAINTENANCE_REMINDER_OFFSETS = [7, 6, 5, 4, 3, 2, 1, 0];
const APP_UPDATE_NOTES: Array<{ version: string; date: string; notes: string[] }> = [
  {
    version: "v2.3.0",
    date: "2026-02-25",
    notes: [
      "Added sortable Asset List headers with simple click behavior.",
      "Improved dashboard Quick Count with status summary and detail popups.",
      "Added item icons in Quick Count for faster visual scan.",
    ],
  },
  {
    version: "v2.2.0",
    date: "2026-02-24",
    notes: [
      "Updated phone layout with app-style navigation and cleaner spacing.",
      "Linked maintenance alerts to direct maintenance record flow.",
      "Refined QR report view and smaller print label size.",
    ],
  },
];
const SERVER_ONLY_STORAGE = true;
const DEFAULT_VIEWER_MODULES: NavModule[] = [
  "dashboard",
  "assets",
  "inventory",
  "schedule",
  "transfer",
  "maintenance",
  "verification",
  "reports",
];
const ALL_NAV_MODULES: NavModule[] = [
  "dashboard",
  "assets",
  "inventory",
  "tickets",
  "schedule",
  "transfer",
  "maintenance",
  "verification",
  "reports",
  "setup",
];
type NavSection = "core" | "operations" | "admin";
const NAV_SECTION_MAP: Record<NavModule, NavSection> = {
  dashboard: "core",
  assets: "core",
  inventory: "core",
  tickets: "operations",
  schedule: "operations",
  transfer: "operations",
  maintenance: "operations",
  verification: "operations",
  reports: "operations",
  setup: "admin",
};
const MENU_ACCESS_TREE: Array<{
  module: NavModule;
  labelEn: string;
  labelKm: string;
  children: Array<{ key: MenuAccessKey; labelEn: string; labelKm: string }>;
}> = [
  {
    module: "dashboard",
    labelEn: "Dashboard",
    labelKm: "ផ្ទាំងសង្ខេប",
    children: [
      { key: "dashboard.overview", labelEn: "Overview", labelKm: "ទិដ្ឋភាពទូទៅ" },
      { key: "dashboard.schedule", labelEn: "Schedule Focus", labelKm: "ផែនការកាលវិភាគ" },
      { key: "dashboard.activity", labelEn: "Recent Activity", labelKm: "សកម្មភាពថ្មីៗ" },
    ],
  },
  {
    module: "assets",
    labelEn: "Assets",
    labelKm: "ទ្រព្យសម្បត្តិ",
    children: [
      { key: "assets.register", labelEn: "Register Asset", labelKm: "ចុះឈ្មោះទ្រព្យសម្បត្តិ" },
      { key: "assets.list", labelEn: "Asset List", labelKm: "បញ្ជីទ្រព្យសម្បត្តិ" },
    ],
  },
  {
    module: "inventory",
    labelEn: "Inventory",
    labelKm: "ស្តុក",
    children: [{ key: "inventory.main", labelEn: "Inventory Management", labelKm: "គ្រប់គ្រងស្តុក" }],
  },
  {
    module: "tickets",
    labelEn: "Work Orders",
    labelKm: "ការងារបញ្ជា",
    children: [{ key: "tickets.main", labelEn: "Work Order Queue", labelKm: "បញ្ជីការងារ" }],
  },
  {
    module: "schedule",
    labelEn: "Schedule",
    labelKm: "កាលវិភាគ",
    children: [{ key: "schedule.main", labelEn: "Schedule Calendar", labelKm: "ប្រតិទិនកាលវិភាគ" }],
  },
  {
    module: "transfer",
    labelEn: "Transfer",
    labelKm: "ផ្ទេរ",
    children: [{ key: "transfer.main", labelEn: "Transfer Record", labelKm: "កំណត់ត្រាផ្ទេរ" }],
  },
  {
    module: "maintenance",
    labelEn: "Maintenance",
    labelKm: "ថែទាំ",
    children: [
      { key: "maintenance.record", labelEn: "Record Maintenance", labelKm: "កត់ត្រាថែទាំ" },
      { key: "maintenance.history", labelEn: "Maintenance History", labelKm: "ប្រវត្តិថែទាំ" },
    ],
  },
  {
    module: "verification",
    labelEn: "Verification",
    labelKm: "ត្រួតពិនិត្យ",
    children: [
      { key: "verification.record", labelEn: "Record Verification", labelKm: "កត់ត្រាត្រួតពិនិត្យ" },
      { key: "verification.history", labelEn: "Verification History", labelKm: "ប្រវត្តិត្រួតពិនិត្យ" },
    ],
  },
  {
    module: "reports",
    labelEn: "Reports",
    labelKm: "របាយការណ៍",
    children: [
      { key: "reports.asset_master", labelEn: "Asset Master Register", labelKm: "បញ្ជីទ្រព្យសម្បត្តិ" },
      { key: "reports.set_code", labelEn: "Computer Set Detail", labelKm: "ព័ត៌មានក្រុមឧបករណ៍កុំព្យូទ័រ" },
      { key: "reports.asset_by_location", labelEn: "Asset by Campus and Location", labelKm: "ទ្រព្យសម្បត្តិតាមសាខា និងទីតាំង" },
      { key: "reports.overdue", labelEn: "Overdue Maintenance", labelKm: "ថែទាំលើសកាលកំណត់" },
      { key: "reports.transfer", labelEn: "Asset Transfer Log", labelKm: "ប្រវត្តិផ្ទេរទ្រព្យសម្បត្តិ" },
      { key: "reports.staff_borrowing", labelEn: "Staff Borrowing List", labelKm: "បញ្ជីខ្ចីឧបករណ៍បុគ្គលិក" },
      { key: "reports.maintenance_completion", labelEn: "Maintenance Completion", labelKm: "លទ្ធផលបញ្ចប់ការថែទាំ" },
      { key: "reports.verification_summary", labelEn: "Verification Summary", labelKm: "សង្ខេបលទ្ធផលត្រួតពិនិត្យ" },
      { key: "reports.qr_labels", labelEn: "Asset ID + QR Labels", labelKm: "លេខទ្រព្យ + QR" },
    ],
  },
  {
    module: "setup",
    labelEn: "Setup",
    labelKm: "កំណត់ការគ្រប់គ្រង",
    children: [
      { key: "setup.campus", labelEn: "Campus Name Setup", labelKm: "កំណត់ឈ្មោះសាខា" },
      { key: "setup.users", labelEn: "User Setup", labelKm: "កំណត់អ្នកប្រើ" },
      { key: "setup.permissions", labelEn: "Account Permission Setup", labelKm: "កំណត់សិទ្ធិគណនី" },
      { key: "setup.backup", labelEn: "Backup & Audit", labelKm: "បម្រុងទុក និង Audit" },
      { key: "setup.items", labelEn: "Item Name Setup", labelKm: "កំណត់ឈ្មោះទំនិញ" },
      { key: "setup.locations", labelEn: "Location Setup by Campus", labelKm: "កំណត់ទីតាំងតាមសាខា" },
      { key: "setup.calendar", labelEn: "Calendar Event Setup", labelKm: "កំណត់ព្រឹត្តិការណ៍ប្រតិទិន" },
    ],
  },
];
function normalizeRole(value: unknown): AuthRole {
  const role = String(value || "").trim();
  if (role === "Super Admin") return "Super Admin";
  if (role === "Admin") return "Admin";
  return "Viewer";
}
function isAdminRole(role: AuthRole) {
  return role === "Admin" || role === "Super Admin";
}
function hasGlobalCampusAccess(role: AuthRole, campuses?: unknown) {
  if (role === "Super Admin") return true;
  if (!Array.isArray(campuses)) return false;
  return campuses.map((v) => String(v || "").trim()).includes("ALL");
}
function normalizeRoleCampuses(role: AuthRole, campuses?: unknown) {
  if (role === "Super Admin") return ["ALL"];
  if (Array.isArray(campuses) && campuses.map((v) => String(v || "").trim().toUpperCase()).includes("ALL")) {
    return [...CAMPUS_LIST];
  }
  const selected = Array.isArray(campuses)
    ? Array.from(new Set(campuses.map((v) => String(v || "").trim()).filter((v) => CAMPUS_LIST.includes(v))))
    : [];
  return selected;
}
function defaultMenuAccessFor(role: AuthRole, modules: NavModule[], assetSubviewAccess: AssetSubviewAccess) {
  const allowed = new Set(modules);
  const out = new Set<MenuAccessKey>();
  for (const node of MENU_ACCESS_TREE) {
    if (!allowed.has(node.module)) continue;
    out.add(node.module);
    for (const child of node.children) {
      if (child.key === "assets.register" && (!isAdminRole(role) || assetSubviewAccess === "list_only")) continue;
      out.add(child.key);
    }
  }
  return Array.from(out);
}
function menuChildKeys(module: NavModule) {
  return MENU_ACCESS_TREE.find((node) => node.module === module)?.children.map((child) => child.key) || [];
}
function isModuleFullyChecked(menuAccess: MenuAccessKey[], module: NavModule) {
  const children = menuChildKeys(module);
  if (!children.length) return menuAccess.includes(module);
  return children.every((key) => menuAccess.includes(key));
}
function toggleModuleAccess(menuAccess: MenuAccessKey[], module: NavModule, enabled: boolean) {
  const next = new Set(menuAccess);
  const children = menuChildKeys(module);
  if (enabled) {
    next.add(module);
    children.forEach((key) => next.add(key));
  } else {
    next.delete(module);
    children.forEach((key) => next.delete(key));
  }
  return Array.from(next);
}
function toggleChildAccess(menuAccess: MenuAccessKey[], module: NavModule, childKey: MenuAccessKey, enabled: boolean) {
  const next = new Set(menuAccess);
  if (enabled) next.add(childKey);
  else next.delete(childKey);
  const children = menuChildKeys(module);
  if (children.length && children.every((key) => next.has(key))) next.add(module);
  else next.delete(module);
  return Array.from(next);
}
function countEnabledMenuChildren(menuAccess: MenuAccessKey[]) {
  const enabled = new Set(menuAccess);
  let count = 0;
  for (const node of MENU_ACCESS_TREE) {
    for (const child of node.children) {
      if (enabled.has(child.key)) count += 1;
    }
  }
  return count;
}
const LOCAL_ADMIN_TOKEN = "local-admin-token";
const LOCAL_VIEWER_TOKEN = "local-viewer-token";
const ENV_API_BASE_URL = String(process.env.REACT_APP_API_BASE_URL || "").trim().replace(/\/+$/, "");
const DEFAULT_CLOUD_API_BASE = "https://eco-it-control-center.onrender.com";
const ALLOW_LOCAL_AUTH_BYPASS =
  String(process.env.REACT_APP_ALLOW_LOCAL_AUTH_BYPASS || "false").toLowerCase() === "true" &&
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
let runtimeAuthToken = "";

function getAutoApiBaseForHost() {
  if (typeof window === "undefined") return "";
  const host = String(window.location.hostname || "").toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") {
    // In local UI testing, fall back to cloud API if local API is unavailable.
    return DEFAULT_CLOUD_API_BASE;
  }
  return "";
}
const LOCAL_AUTH_ACCOUNTS: AuthAccount[] = [
  {
    id: 1,
    username: "admin",
    displayName: "Eco Admin",
    role: "Super Admin",
    campuses: ["ALL"],
    modules: [...ALL_NAV_MODULES],
    assetSubviewAccess: "both",
    menuAccess: defaultMenuAccessFor("Super Admin", ALL_NAV_MODULES, "both"),
  },
  {
    id: 2,
    username: "viewer",
    displayName: "Eco Viewer",
    role: "Viewer",
    campuses: ["Chaktomuk Campus (C2.2)"],
    modules: [...DEFAULT_VIEWER_MODULES],
    assetSubviewAccess: "list_only",
    menuAccess: defaultMenuAccessFor("Viewer", DEFAULT_VIEWER_MODULES, "list_only"),
  },
];

const CAMPUS_LIST = [
  "Samdach Pan Campus",
  "Chaktomuk Campus",
  "Chaktomuk Campus (C2.2)",
  "Boeung Snor Campus",
  "Veng Sreng Campus",
];
const CAMPUS_KM_LABEL: Record<string, string> = {
  "Samdach Pan Campus": "សាខាសម្ដេចប៉ាន",
  "Chaktomuk Campus": "សាខាចតុមុខ",
  "Chaktomuk Campus (C2.2)": "សាខាចតុមុខ (C2.2)",
  "Boeung Snor Campus": "សាខាបឹងស្នោរ",
  "Veng Sreng Campus": "សាខាវេងស្រេង",
};
const CAMPUS_CODE: Record<string, string> = {
  "Samdach Pan Campus": "C1",
  "Chaktomuk Campus": "C2.1",
  "Chaktomuk Campus (C2.2)": "C2.2",
  "Boeung Snor Campus": "C3",
  "Veng Sreng Campus": "C4",
};
const CODE_TO_CAMPUS: Record<string, string> = Object.fromEntries(
  Object.entries(CAMPUS_CODE).map(([name, code]) => [code, name])
);
const MAX_ASSET_PHOTOS = 5;
const MAX_SET_PACK_PHOTOS = 3;

const CATEGORY_OPTIONS = [
  { value: "IT", en: "IT", km: "IT" },
  { value: "SAFETY", en: "Safety", km: "សុវត្ថិភាព" },
  { value: "FACILITY", en: "Facility", km: "បរិក្ខារ" },
];

const ASSET_STATUS_OPTIONS = [
  { value: "Active", en: "Active", km: "កំពុងប្រើ" },
  { value: "Maintenance", en: "Maintenance", km: "កំពុងជួសជុល" },
  { value: "Retired", en: "Defective", km: "ខូច" },
];
const CALENDAR_EVENT_TYPE_OPTIONS: Array<{ value: CalendarEventType; label: string }> = [
  { value: "public", label: "Public Holiday" },
  { value: "ptc", label: "PTC" },
  { value: "term_end", label: "Term End" },
  { value: "term_start", label: "Term Start" },
  { value: "camp", label: "Camp" },
  { value: "celebration", label: "Celebration" },
  { value: "break", label: "Break" },
];
function calendarEventTypeLabel(type: CalendarEventType) {
  return CALENDAR_EVENT_TYPE_OPTIONS.find((opt) => opt.value === type)?.label || type;
}
const MAINTENANCE_COMPLETION_OPTIONS = [
  { value: "Done", label: "Already Done" },
  { value: "Not Yet", label: "Not Yet Done" },
];
const MAINTENANCE_TYPE_OPTIONS = [
  "Preventive",
  "Corrective",
  "Repair",
  "Replacement",
  "Inspection",
  "Upgrade",
];
const INVENTORY_CATEGORY_OPTIONS = [
  { value: "SUPPLY", label: "Cleaning Supply" },
  { value: "CLEAN_TOOL", label: "Cleaning Tool" },
  { value: "MAINT_TOOL", label: "Maintenance Tool" },
] as const;
const INVENTORY_TXN_TYPE_OPTIONS = [
  { value: "IN", label: "Stock In" },
  { value: "OUT", label: "Stock Out" },
  { value: "BORROW_OUT", label: "Borrow Out" },
  { value: "BORROW_IN", label: "Borrow Return (In)" },
  { value: "BORROW_CONSUME", label: "Borrow Consume" },
] as const;
const INVENTORY_MASTER_ITEMS = [
  { key: "tissue", category: "SUPPLY", nameEn: "Tissue", spec: "", unit: "pcs", aliases: ["tissue", "paper tissue", "ក្រដាស"] },
  { key: "hand_tissue", category: "SUPPLY", nameEn: "Hand Tissue", spec: "", unit: "pcs", aliases: ["hand tissue", "tissue", "ក្រដាសដៃ"] },
  { key: "toilet_paper", category: "SUPPLY", nameEn: "Toilet Paper", spec: "", unit: "pcs", aliases: ["toilet paper", "paper roll"] },
  { key: "hand_wash_15l", category: "SUPPLY", nameEn: "Washing Hand Shampoo", spec: "1.5L", unit: "pcs", aliases: ["hand wash", "shampoo", "soap"] },
  { key: "alcohol_15l", category: "SUPPLY", nameEn: "Alcohol", spec: "1.5L", unit: "pcs", aliases: ["alcohol", "sanitizer"] },
  { key: "floor_shampoo_15l", category: "SUPPLY", nameEn: "Floor Shampoo", spec: "1.5L", unit: "pcs", aliases: ["floor shampoo", "floor cleaner"] },
  { key: "plastic_pack", category: "SUPPLY", nameEn: "Plastic", spec: "Pack (10 pcs)", unit: "unit", aliases: ["plastic", "plastic bag"] },
  { key: "plastic_glove", category: "SUPPLY", nameEn: "Plastic Glove", spec: "Pack", unit: "unit", aliases: ["glove", "plastic glove"] },
  { key: "mop", category: "CLEAN_TOOL", nameEn: "Mop", spec: "Head + Handle", unit: "set", aliases: ["mop", "ម៉ាប់"] },
  { key: "broom", category: "CLEAN_TOOL", nameEn: "Broom", spec: "Soft", unit: "pcs", aliases: ["broom", "អំបោស"] },
  { key: "vacuum", category: "CLEAN_TOOL", nameEn: "Vacuum Cleaner", spec: "Portable", unit: "unit", aliases: ["vacuum", "ម៉ាស៊ីនបូមធូលី"] },
  { key: "drill", category: "MAINT_TOOL", nameEn: "Electric Drill", spec: "Portable", unit: "unit", aliases: ["drill", "ខួង"] },
  { key: "multimeter", category: "MAINT_TOOL", nameEn: "Multimeter", spec: "Digital", unit: "unit", aliases: ["multimeter", "meter"] },
  { key: "ladder", category: "MAINT_TOOL", nameEn: "Ladder", spec: "Foldable", unit: "pcs", aliases: ["ladder", "ជណ្ដើរ"] },
] as const;
const CLEANING_SUPPLY_KEYWORDS = [
  "tissue",
  "hand tissue",
  "toilet paper",
  "paper",
  "floor shampoo",
  "floor cleaner",
  "soap",
  "hand wash",
  "shampoo",
  "alcohol",
  "plastic",
  "glove",
];
const VERIFICATION_RESULT_OPTIONS: Array<VerificationEntry["result"]> = [
  "Verified",
  "Issue Found",
  "Missing",
];

const TICKET_STATUS_OPTIONS = [
  { value: "Open", en: "Open", km: "បើក" },
  { value: "In Progress", en: "In Progress", km: "កំពុងដំណើរការ" },
  { value: "Resolved", en: "Resolved", km: "បានដោះស្រាយ" },
];

const PRIORITY_OPTIONS = [
  { value: "Low", en: "Low", km: "ទាប" },
  { value: "Normal", en: "Normal", km: "ធម្មតា" },
  { value: "High", en: "High", km: "ខ្ពស់" },
  { value: "Critical", en: "Critical", km: "សំខាន់ខ្លាំង" },
];

const TYPE_OPTIONS: Record<string, Array<{ itemEn: string; itemKm: string; code: string }>> = {
  IT: [
    { itemEn: "Computer", itemKm: "កុំព្យូទ័រ", code: "PC" },
    { itemEn: "Laptop", itemKm: "ឡេបថប", code: "LAP" },
    { itemEn: "iPad / Tablet", itemKm: "អាយផេត / ថេប្លេត", code: "TAB" },
    { itemEn: "Monitor", itemKm: "ម៉ូនីទ័រ", code: "MON" },
    { itemEn: "Keyboard", itemKm: "ក្តារចុច", code: "KBD" },
    { itemEn: "Mouse", itemKm: "កណ្ដុរ", code: "MSE" },
    { itemEn: "Digital Camera", itemKm: "កាមេរ៉ាឌីជីថល", code: "DCM" },
    { itemEn: "Slide Projector", itemKm: "ម៉ាស៊ីនបញ្ចាំងស្លាយ", code: "SLP" },
    { itemEn: "Power Adapter", itemKm: "អាដាប់ទ័រ", code: "ADP" },
    { itemEn: "Remote Control", itemKm: "រីម៉ូត", code: "RMT" },
    { itemEn: "USB WiFi Adapter", itemKm: "USB វ៉ាយហ្វាយ", code: "UWF" },
    { itemEn: "Webcam", itemKm: "កាមេរ៉ាវិប", code: "WBC" },
    { itemEn: "TV", itemKm: "ទូរទស្សន៍", code: "TV" },
    { itemEn: "Speaker", itemKm: "ឧបករណ៍បំពងសំឡេង", code: "SPK" },
    { itemEn: "Printer", itemKm: "ម៉ាស៊ីនបោះពុម្ព", code: "PRN" },
    { itemEn: "Switch", itemKm: "ស្វិច", code: "SW" },
    { itemEn: "Access Point", itemKm: "ឧបករណ៍ចែកសញ្ញា", code: "AP" },
    { itemEn: "CCTV Camera", itemKm: "កាមេរ៉ាសុវត្ថិភាព", code: "CAM" },
  ],
  SAFETY: [
    { itemEn: "Fire Extinguisher", itemKm: "បំពង់ពន្លត់អគ្គិភ័យ", code: "FE" },
    { itemEn: "Smoke Detector", itemKm: "ឧបករណ៍ចាប់ផ្សែង", code: "SD" },
    { itemEn: "Emergency Light", itemKm: "ភ្លើងអាសន្ន", code: "EL" },
    { itemEn: "Fire Bell", itemKm: "កណ្តឹងអគ្គិភ័យ", code: "FB" },
    { itemEn: "Fire Control Panel", itemKm: "ផ្ទាំងបញ្ជាអគ្គិភ័យ", code: "FCP" },
  ],
  FACILITY: [
    { itemEn: "Air Conditioner", itemKm: "ម៉ាស៊ីនត្រជាក់", code: "AC" },
    { itemEn: "Front Panel", itemKm: "ផ្នែកខាងមុខ", code: "FPN" },
    { itemEn: "Rear Panel", itemKm: "ផ្នែកខាងក្រោយ", code: "RPN" },
    { itemEn: "Table", itemKm: "តុ", code: "TBL" },
    { itemEn: "Chair", itemKm: "កៅអី", code: "CHR" },
  ],
};

const USER_REQUIRED_TYPES = ["PC", "TAB", "SPK", "DCM"];
const USB_WIFI_TYPE_CODE = "UWF";
const USB_WIFI_DEFAULT_SPECS = "USB WiFi adapter can be used with desktop computers.";
const SHARED_LOCATION_KEYWORDS = [
  "teacher office",
  "itc room",
  "computer lab",
  "compuer lab",
  "compuer lap",
];
const DESKTOP_PARENT_TYPE = "PC";
const PC_TYPE_OPTIONS = [
  { value: "Desktop", en: "Desktop", km: "កុំព្យូទ័រ Desktop" },
  { value: "AIO", en: "All-in-One (AIO)", km: "All-in-One (AIO)" },
  { value: "Mini PC", en: "Mini PC", km: "Mini PC" },
  { value: "iMac", en: "iMac", km: "iMac" },
  { value: "Mac Mini", en: "Mac Mini", km: "Mac Mini" },
  { value: "Other", en: "Other", km: "ផ្សេងៗ" },
] as const;
type SetPackChildType = "MON" | "MON2" | "KBD" | "MSE" | "UWF" | "WBC";
type SetPackChildDraft = {
  enabled: boolean;
  status: string;
  brand: string;
  model: string;
  serialNumber: string;
  purchaseDate: string;
  warrantyUntil: string;
  vendor: string;
  specs: string;
  notes: string;
  photo: string;
  photos: string[];
};

function defaultSetPackChildDraft(): SetPackChildDraft {
  return {
    enabled: true,
    status: "Active",
    brand: "",
    model: "",
    serialNumber: "",
    purchaseDate: "",
    warrantyUntil: "",
    vendor: "",
    specs: "",
    notes: "",
    photo: "",
    photos: [],
  };
}

function defaultSetPackDraft(): Record<SetPackChildType, SetPackChildDraft> {
  return {
    MON: defaultSetPackChildDraft(),
    MON2: { ...defaultSetPackChildDraft(), enabled: false },
    KBD: defaultSetPackChildDraft(),
    MSE: defaultSetPackChildDraft(),
    UWF: { ...defaultSetPackChildDraft(), enabled: false },
    WBC: { ...defaultSetPackChildDraft(), enabled: false },
  };
}

function setPackAssetType(type: SetPackChildType): "MON" | "KBD" | "MSE" | "UWF" | "WBC" {
  if (type === "MON2") return "MON";
  return type;
}

function canLinkToParentAsset(type: string): boolean {
  return String(type || "").toUpperCase() !== DESKTOP_PARENT_TYPE;
}

const TEXT = {
  en: {
    school: "ECO INTERNATIONAL SCHOOL",
    title: "IT and Safety Control Center",
    subhead: "Centralized operations for assets, maintenance, and campus incidents.",
    view: "View",
    language: "Language",
    menu: "Menu",
    more: "More",
    options: "Options",
    phoneHint: "Choose a module from the menu, then open Options for campus, language, and account settings.",
    english: "English",
    khmer: "Khmer",
    allCampuses: "All Campuses",
    dashboard: "Dashboard",
    assets: "Assets",
    inventory: "Inventory",
    workOrders: "Work Orders",
    maintenanceHistory: "Maintenance History",
    setup: "Setup",
    loading: "Loading data...",
    overview: "Overview",
    totalAssets: "Total Assets",
    itAssets: "IT Assets",
    safetyAssets: "Safety Assets",
    openWorkOrders: "Open Work Orders",
    campusActivity: "Campus Activity",
    campus: "Campus",
    registerAsset: "Register Asset",
    category: "Category",
    typeCode: "Type Code",
    pcType: "PC Type",
    selectPcType: "Select PC Type",
    pcTypeRequired: "Please select PC Type.",
    status: "Status",
    statusChangeConfirm: "Confirm Status Change",
    statusReason: "Reason",
    statusVerifiedBy: "Verified By",
    statusReasonRequired: "Reason is required.",
    statusVerifiedByRequired: "Verified By is required.",
    confirm: "Confirm",
    assetName: "Asset Name",
    setCode: "Set Code",
    parentAssetId: "Parent Asset ID",
    createAsSetPack: "Create as Set Pack",
    setPackItems: "Set Pack Items",
    setPackHint: "Enable each item below, then fill full details for each asset.",
    addDetails: "Add Details",
    hideDetails: "Hide Details",
    includeMonitor: "Include Monitor",
    includeMonitor2: "Include 2nd Monitor",
    includeKeyboard: "Include Keyboard",
    includeMouse: "Include Mouse",
    includeUsbWifi: "Include USB WiFi",
    includeWebcam: "Include Webcam",
    linkToParentAsset: "Link to parent asset",
    selectParentAsset: "Select Parent Asset",
    componentRole: "Component Role",
    componentRequired: "Required Component",
    desktopSetAutoNote: "Desktop Unit set code is auto-generated.",
    location: "Location",
    locationSetup: "Location Setup by Campus",
    locationName: "Location Name",
    addLocation: "Add Location",
    updateLocation: "Update Location",
    cancelEdit: "Cancel Edit",
    edit: "Edit",
    photo: "Photo",
    noPhoto: "No photo",
    createAsset: "Create Asset",
    assetRegistry: "List Asset",
    allCategories: "All Categories",
    searchAsset: "Search ID, name, location",
    assetId: "Asset ID",
    name: "Name",
    created: "Created",
    delete: "Delete",
    noAssets: "No assets found.",
    createWorkOrder: "Create Work Order",
    priority: "Priority",
    relatedAsset: "Related Asset ID (optional)",
    titleLabel: "Title",
    description: "Description",
    requestedBy: "Requested By",
    ticketQueue: "Ticket queue",
    workOrderQueue: "Work Order Queue",
    ticketNo: "Ticket No",
    noWorkOrders: "No work orders found.",
    dataStored: "Data is stored in server SQLite database file server/data.sqlite",
    systemError: "System error",
    noDataYet: "No data yet.",
    openTickets: "Open Tickets",
    asset: "Asset",
    ticketRequired: "Ticket title and requester are required.",
    deleteConfirm: "Delete this asset?",
    deleteLocationConfirm: "Delete this location?",
    photoLimit: "Photo is too large. Please use file under 15MB.",
    user: "User",
    userRequired: "User is required for Computer, iPad/Tablet, Speaker, and Digital Camera.",
    selectLocation: "Select location",
    locationRequired: "Please select location.",
    noLocationsConfigured: "No locations configured for this campus. Please add in Setup tab.",
    noLocationsYet: "No locations yet.",
    pleaseLogin: "Please login to continue.",
    login: "Login",
    apiServerUrl: "API Server URL (phone testing)",
    saveApiUrl: "Save API URL",
    username: "Username",
    password: "Password",
    show: "Show",
    hide: "Hide",
    account: "Account",
    logout: "Logout",
    schedule: "Schedule",
    transfer: "Transfer",
    maintenance: "Maintenance",
    verification: "Verification",
    reports: "Reports",
    viewerMode: "Viewer mode: read-only access.",
    maintenanceScheduleAlerts: "Maintenance Schedule Alerts",
    overdue: "Overdue",
    dueNext7Days: "Due Next 7 Days",
    scheduledAssets: "Scheduled Assets",
    selectedDateItems: "Selected Date Items",
    topCampus: "Top Campus",
    noCampusDataYet: "No campus data yet.",
    quickActions: "Quick Actions",
    openAssetList: "Open Asset List",
    openSchedule: "Open Schedule",
    recordMaintenance: "Record Maintenance",
    verificationAlerts: "Verification Alerts",
    recordVerification: "Record Verification",
    verificationHistory: "Verification History",
    verificationResult: "Verification Result",
    verificationFrequency: "Verification Frequency",
    dueNext30Days: "Due Next 30 Days",
    nextScheduledAssets: "Next Scheduled Assets",
    nextScheduleHint: "Click Asset ID to open maintenance record form.",
    campusPerformance: "Campus Performance",
    recentTransfersHint: "Latest campus movement of assets.",
    recentAssetTransfers: "Recent Asset Transfers",
    date: "Date",
    fromCampus: "From Campus",
    fromLocation: "From Location",
    toCampus: "To Campus",
    toLocation: "To Location",
    by: "By",
    noTransfersYet: "No transfers yet.",
    close: "Close",
    scheduleNote: "Schedule Note",
    noScheduledAssetsFound: "No scheduled assets found.",
    ticketNoLabel: "Ticket No",
    noOpenWorkOrders: "No open work orders.",
    campusNameSetup: "Campus Name Setup",
    campusFixedHelp: "Campus codes are fixed (C1-C4). You can update campus names.",
    campusCode: "Campus Code",
    campusName: "Campus Name",
    updateCampusName: "Update Campus Name",
    save: "Save",
    userSetup: "User Setup",
    staffFullName: "Staff Full Name",
    position: "Position",
    email: "Email",
    manageAssignableUsers: "Manage assignable users for devices.",
    updateUser: "Update User",
    addUser: "Add User",
    noUsersYet: "No users yet.",
    accountPermissionSetup: "Account Permission Setup",
    permissionHelp: "Set role and campus access. Super Admin can manage all campuses; Admin/Viewer are campus-scoped.",
    addLoginAccount: "Add Login Account",
    selectStaffOptional: "Select Staff (optional)",
    usernameLabel: "Username",
    displayName: "Display Name",
    role: "Role",
    accessCampus: "Access Campus",
    noLoginUsersFound: "No login users found.",
    itemNameSetup: "Item Name Setup",
    itemName: "Item Name",
    addNewTypeHelp: "Add new type code and item name.",
    addItemType: "Add Item Type",
    typeCodeExample: "Ex: UPS",
    itemNameExample: "Ex: UPS Battery Backup",
    selectUser: "Select user",
    actions: "Actions",
    history: "History",
    readOnly: "Read-only",
    brand: "Brand",
    model: "Model",
    serialNumber: "Serial Number",
    purchaseDate: "Purchase Date",
    warrantyUntil: "Warranty Until",
    vendor: "Vendor",
    specs: "Specs",
    notes: "Notes",
    alreadyDone: "Already Done",
    notYetDone: "Not Yet Done",
    photoProcessError: "Cannot process photo.",
    maintenanceNotifications: "Maintenance Alerts",
    noMaintenanceNotifications: "No maintenance alerts right now.",
    markAllRead: "Mark All Read",
    markRead: "Mark Read",
    enablePhoneAlerts: "Enable Phone Alerts",
    openMaintenance: "Open Maintenance",
  },
  km: {
    school: "សាលា អេកូ អន្តរជាតិ",
    title: "ប្រព័ន្ធគ្រប់គ្រង IT និងសុវត្ថិភាព",
    subhead: "គ្រប់គ្រងទ្រព្យសម្បត្តិ ការថែទាំ និងបញ្ហាតាមគ្រប់ Campus ជាកណ្តាល។",
    view: "មើល",
    language: "ភាសា",
    menu: "ម៉ឺនុយ",
    more: "បន្ថែម",
    options: "ជម្រើស",
    phoneHint: "ជ្រើសរើសមុខងារពីម៉ឺនុយ ហើយបើក ជម្រើស សម្រាប់ Campus, ភាសា និងគណនី។",
    english: "អង់គ្លេស",
    khmer: "ខ្មែរ",
    allCampuses: "គ្រប់ Campus",
    dashboard: "ផ្ទាំងសង្ខេប",
    assets: "ទ្រព្យសម្បត្តិ",
    inventory: "ស្តុក",
    workOrders: "ការងារជួសជុល",
    maintenanceHistory: "ប្រវត្តិថែទាំ",
    setup: "កំណត់រចនាសម្ព័ន្ធ",
    loading: "កំពុងទាញទិន្នន័យ...",
    overview: "សង្ខេប",
    totalAssets: "ទ្រព្យសម្បត្តិសរុប",
    itAssets: "ទ្រព្យ IT",
    safetyAssets: "ទ្រព្យសុវត្ថិភាព",
    openWorkOrders: "ការងារជួសជុលកំពុងបើក",
    campusActivity: "សកម្មភាពតាម Campus",
    campus: "Campus",
    registerAsset: "ចុះបញ្ជីទ្រព្យសម្បត្តិ",
    category: "ប្រភេទ",
    typeCode: "កូដប្រភេទ",
    pcType: "ប្រភេទកុំព្យូទ័រ",
    selectPcType: "ជ្រើសប្រភេទកុំព្យូទ័រ",
    pcTypeRequired: "សូមជ្រើសប្រភេទកុំព្យូទ័រ។",
    status: "ស្ថានភាព",
    statusChangeConfirm: "បញ្ជាក់ការប្តូរស្ថានភាព",
    statusReason: "មូលហេតុ",
    statusVerifiedBy: "បញ្ជាក់ដោយ",
    statusReasonRequired: "ត្រូវបំពេញមូលហេតុ។",
    statusVerifiedByRequired: "ត្រូវបំពេញអ្នកបញ្ជាក់។",
    confirm: "បញ្ជាក់",
    assetName: "ឈ្មោះទ្រព្យសម្បត្តិ",
    setCode: "លេខក្រុមឧបករណ៍",
    parentAssetId: "លេខសម្គាល់មេ",
    createAsSetPack: "បង្កើតជា Set Pack",
    setPackItems: "ធាតុក្នុង Set Pack",
    setPackHint: "ជ្រើសធាតុខាងក្រោម ហើយបំពេញព័ត៌មានលម្អិតសម្រាប់ទ្រព្យនីមួយៗ។",
    addDetails: "បន្ថែមព័ត៌មានលម្អិត",
    hideDetails: "លាក់ព័ត៌មានលម្អិត",
    includeMonitor: "រួមបញ្ចូល Monitor",
    includeMonitor2: "រួមបញ្ចូល Monitor ទី២",
    includeKeyboard: "រួមបញ្ចូល Keyboard",
    includeMouse: "រួមបញ្ចូល Mouse",
    includeUsbWifi: "រួមបញ្ចូល USB WiFi",
    includeWebcam: "រួមបញ្ចូល Webcam",
    linkToParentAsset: "ភ្ជាប់ទៅ Asset មេ",
    selectParentAsset: "ជ្រើស Asset មេ",
    componentRole: "តួនាទីគ្រឿងបន្ថែម",
    componentRequired: "គ្រឿងបន្ថែមចាំបាច់",
    desktopSetAutoNote: "លេខក្រុម Desktop Unit បង្កើតស្វ័យប្រវត្តិ។",
    location: "ទីតាំង",
    locationSetup: "កំណត់ទីតាំងតាម Campus",
    locationName: "ឈ្មោះទីតាំង",
    addLocation: "បន្ថែមទីតាំង",
    updateLocation: "កែប្រែទីតាំង",
    cancelEdit: "បោះបង់ការកែប្រែ",
    edit: "កែប្រែ",
    photo: "រូបភាព",
    noPhoto: "មិនមានរូប",
    createAsset: "បង្កើតទ្រព្យសម្បត្តិ",
    assetRegistry: "បញ្ជីទ្រព្យសម្បត្តិ",
    allCategories: "គ្រប់ប្រភេទ",
    searchAsset: "ស្វែងរក ID ឈ្មោះ ឬទីតាំង",
    assetId: "លេខសម្គាល់ទ្រព្យ",
    name: "ឈ្មោះ",
    created: "ថ្ងៃបង្កើត",
    delete: "លុប",
    noAssets: "មិនមានទ្រព្យសម្បត្តិ។",
    createWorkOrder: "បង្កើតការងារជួសជុល",
    priority: "អាទិភាព",
    relatedAsset: "លេខសម្គាល់ទ្រព្យពាក់ព័ន្ធ (ជាជម្រើស)",
    titleLabel: "ចំណងជើង",
    description: "ពិពណ៌នា",
    requestedBy: "ស្នើដោយ",
    ticketQueue: "ជួរបញ្ជីការងារ",
    workOrderQueue: "បញ្ជីការងារជួសជុល",
    ticketNo: "លេខការងារ",
    noWorkOrders: "មិនមានការងារជួសជុល។",
    dataStored: "ទិន្នន័យរក្សាទុកក្នុង SQLite server/data.sqlite",
    systemError: "កំហុសប្រព័ន្ធ",
    noDataYet: "មិនទាន់មានទិន្នន័យ។",
    openTickets: "ការងារបើក",
    asset: "ទ្រព្យ",
    ticketRequired: "ត្រូវបញ្ចូលចំណងជើង និងអ្នកស្នើ។",
    deleteConfirm: "តើលុបទ្រព្យនេះមែនទេ?",
    deleteLocationConfirm: "តើលុបទីតាំងនេះមែនទេ?",
    photoLimit: "រូបភាពធំពេក។ សូមប្រើឯកសារតិចជាង 15MB។",
    user: "អ្នកប្រើប្រាស់",
    userRequired: "ត្រូវបញ្ចូលអ្នកប្រើសម្រាប់ Computer, iPad/Tablet, Speaker និង Digital Camera។",
    selectLocation: "ជ្រើសទីតាំង",
    locationRequired: "សូមជ្រើសរើសទីតាំង។",
    noLocationsConfigured: "Campus នេះមិនទាន់កំណត់ទីតាំងទេ។ សូមបន្ថែមនៅផ្ទាំង Setup។",
    noLocationsYet: "មិនទាន់មានទីតាំង។",
    pleaseLogin: "សូមចូលប្រើប្រាស់ដើម្បីបន្ត។",
    login: "ចូលប្រើ",
    apiServerUrl: "URL ម៉ាស៊ីនមេ API (សម្រាប់សាកល្បងទូរស័ព្ទ)",
    saveApiUrl: "រក្សាទុក URL API",
    username: "ឈ្មោះអ្នកប្រើ",
    password: "ពាក្យសម្ងាត់",
    show: "បង្ហាញ",
    hide: "លាក់",
    account: "គណនី",
    logout: "ចាកចេញ",
    schedule: "កាលវិភាគ",
    transfer: "ផ្ទេរ",
    maintenance: "ថែទាំ",
    verification: "ត្រួតពិនិត្យ",
    reports: "របាយការណ៍",
    viewerMode: "របៀបអ្នកមើល: អាចមើលបានតែប៉ុណ្ណោះ។",
    maintenanceScheduleAlerts: "ការជូនដំណឹងកាលវិភាគថែទាំ",
    overdue: "លើសកាលកំណត់",
    dueNext7Days: "ដល់កំណត់ក្នុង 7 ថ្ងៃ",
    scheduledAssets: "ទ្រព្យដែលបានកំណត់កាលវិភាគ",
    selectedDateItems: "ទិន្នន័យតាមកាលបរិច្ឆេទជ្រើស",
    topCampus: "Campus មានទ្រព្យច្រើនជាងគេ",
    noCampusDataYet: "មិនទាន់មានទិន្នន័យ Campus។",
    quickActions: "មុខងាររហ័ស",
    openAssetList: "បើកបញ្ជីទ្រព្យសម្បត្តិ",
    openSchedule: "បើកកាលវិភាគ",
    recordMaintenance: "កត់ត្រាការថែទាំ",
    verificationAlerts: "ការជូនដំណឹងត្រួតពិនិត្យ",
    recordVerification: "កត់ត្រាការត្រួតពិនិត្យ",
    verificationHistory: "ប្រវត្តិត្រួតពិនិត្យ",
    verificationResult: "លទ្ធផលត្រួតពិនិត្យ",
    verificationFrequency: "ប្រេកង់ត្រួតពិនិត្យ",
    dueNext30Days: "ដល់កំណត់ក្នុង 30 ថ្ងៃ",
    nextScheduledAssets: "ទ្រព្យកំណត់ពេលថែទាំបន្ទាប់",
    nextScheduleHint: "ចុចលេខសម្គាល់ទ្រព្យ ដើម្បីទៅកាន់ការកត់ត្រាថែទាំ។",
    campusPerformance: "ស្ថិតិប្រតិបត្តិការតាម Campus",
    recentTransfersHint: "ប្រវត្តិផ្ទេរទ្រព្យចុងក្រោយ។",
    recentAssetTransfers: "ប្រវត្តិផ្ទេរទ្រព្យថ្មីៗ",
    date: "កាលបរិច្ឆេទ",
    fromCampus: "ពី Campus",
    fromLocation: "ពីទីតាំង",
    toCampus: "ទៅ Campus",
    toLocation: "ទៅទីតាំង",
    by: "ដោយ",
    noTransfersYet: "មិនទាន់មានប្រវត្តិផ្ទេរ។",
    close: "បិទ",
    scheduleNote: "កំណត់ចំណាំកាលវិភាគ",
    noScheduledAssetsFound: "មិនមានទ្រព្យតាមកាលវិភាគ។",
    ticketNoLabel: "លេខការងារ",
    noOpenWorkOrders: "មិនមានការងារបើកទេ។",
    campusNameSetup: "កំណត់ឈ្មោះ Campus",
    campusFixedHelp: "កូដ Campus ថេរ (C1-C4)។ អ្នកអាចកែឈ្មោះ Campus បាន។",
    campusCode: "កូដ Campus",
    campusName: "ឈ្មោះ Campus",
    updateCampusName: "រក្សាទុកឈ្មោះ Campus",
    save: "រក្សាទុក",
    userSetup: "កំណត់អ្នកប្រើប្រាស់",
    staffFullName: "ឈ្មោះពេញបុគ្គលិក",
    position: "មុខតំណែង",
    email: "អ៊ីមែល",
    manageAssignableUsers: "គ្រប់គ្រងអ្នកប្រើសម្រាប់ឧបករណ៍ដែលអាចចាត់តាំងបាន។",
    updateUser: "កែប្រែអ្នកប្រើ",
    addUser: "បន្ថែមអ្នកប្រើ",
    noUsersYet: "មិនទាន់មានអ្នកប្រើ។",
    accountPermissionSetup: "កំណត់សិទ្ធិគណនី",
    permissionHelp: "កំណត់តួនាទី និងសិទ្ធិ Campus សម្រាប់អ្នកចូលប្រើ។ Viewer អាចមើលបានតែ Campus ដែលបានកំណត់។",
    addLoginAccount: "បន្ថែមគណនីចូលប្រើ",
    selectStaffOptional: "ជ្រើសបុគ្គលិក (ជាជម្រើស)",
    usernameLabel: "ឈ្មោះអ្នកប្រើ",
    displayName: "ឈ្មោះបង្ហាញ",
    role: "តួនាទី",
    accessCampus: "សិទ្ធិ Campus",
    noLoginUsersFound: "មិនមានគណនីចូលប្រើ។",
    itemNameSetup: "កំណត់ឈ្មោះទំនិញ",
    itemName: "ឈ្មោះទំនិញ",
    addNewTypeHelp: "បន្ថែមកូដប្រភេទ និងឈ្មោះទំនិញថ្មី។",
    addItemType: "បន្ថែមប្រភេទទំនិញ",
    typeCodeExample: "ឧ: UPS",
    itemNameExample: "ឧ: ឧបករណ៍បម្រុងថាមពល UPS",
    selectUser: "ជ្រើសអ្នកប្រើ",
    actions: "សកម្មភាព",
    history: "ប្រវត្តិ",
    readOnly: "មើលបានប៉ុណ្ណោះ",
    brand: "ម៉ាក",
    model: "ម៉ូដែល",
    serialNumber: "លេខស៊េរី",
    purchaseDate: "ថ្ងៃទិញ",
    warrantyUntil: "ធានារហូតដល់",
    vendor: "អ្នកផ្គត់ផ្គង់",
    specs: "លក្ខណៈបច្ចេកទេស",
    notes: "កំណត់ចំណាំ",
    alreadyDone: "បានធ្វើរួច",
    notYetDone: "មិនទាន់ធ្វើ",
    photoProcessError: "មិនអាចដំណើរការរូបភាពបានទេ។",
    maintenanceNotifications: "ជូនដំណឹងថែទាំ",
    noMaintenanceNotifications: "បច្ចុប្បន្នមិនមានជូនដំណឹងថែទាំទេ។",
    markAllRead: "សម្គាល់ថាបានអានទាំងអស់",
    markRead: "សម្គាល់ថាបានអាន",
    enablePhoneAlerts: "បើកការជូនដំណឹងលើទូរស័ព្ទ",
    openMaintenance: "បើកផ្ទាំងថែទាំ",
  },
};

function normalizeArray<T>(input: unknown): T[] {
  if (!Array.isArray(input)) return [];
  return input as T[];
}

function normalizeMaintenanceReminderOffsets(input: unknown): number[] {
  const base = Array.isArray(input) ? input : DEFAULT_MAINTENANCE_REMINDER_OFFSETS;
  const cleaned = Array.from(
    new Set(
      base
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 30)
    )
  ).sort((a, b) => b - a);
  return cleaned.length ? cleaned : [...DEFAULT_MAINTENANCE_REMINDER_OFFSETS];
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDINAL_WORDS = ["first", "second", "third", "fourth", "fifth"];

function monthlyRepeatLabel(weekOfMonth: number, weekday: number) {
  const safeWeek = Math.max(1, Math.min(5, Number(weekOfMonth || 1)));
  const safeWeekday = Math.max(0, Math.min(6, Number(weekday || 0)));
  const dayName = WEEKDAY_NAMES[safeWeekday];
  if (safeWeek >= 5) return `Monthly on the last ${dayName}`;
  const ord = ORDINAL_WORDS[safeWeek - 1] || `${safeWeek}th`;
  return `Monthly on the ${ord} ${dayName}`;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const authToken = localStorage.getItem(AUTH_TOKEN_KEY) || runtimeAuthToken;
  const requestInit: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  };

  async function run(endpoint: string) {
    const res = await fetch(endpoint, requestInit);
    const data = (await res.json().catch(() => ({}))) as T & ApiError;
    return { res, data };
  }

  const apiBaseOverride = SERVER_ONLY_STORAGE
    ? ""
    : String(localStorage.getItem(API_BASE_OVERRIDE_KEY) || "")
        .trim()
        .replace(/\/+$/, "");
  const autoApiBase = getAutoApiBaseForHost().replace(/\/+$/, "");
  const candidates: string[] = url.startsWith("/api/") ? [] : [url];

  if (url.startsWith("/api/")) {
    if (apiBaseOverride) candidates.push(`${apiBaseOverride}${url}`);
    if (ENV_API_BASE_URL) candidates.push(`${ENV_API_BASE_URL}${url}`);
    if (!apiBaseOverride && !ENV_API_BASE_URL) {
      candidates.push(url);
      if (autoApiBase) candidates.push(`${autoApiBase}${url}`);
    }
  }

  const endpoints = Array.from(new Set(candidates));
  let lastResponse: { res: Response; data: T & ApiError } | null = null;

  for (const endpoint of endpoints) {
    const result = await run(endpoint).catch(() => null);
    if (!result) continue;
    if (result.res.ok) return result.data;

    lastResponse = result;
    const canFallback = result.res.status === 404 || result.res.status >= 500;
    if (!canFallback) {
      throw new Error(result.data.error || `Request failed (${result.res.status})`);
    }
  }

  if (lastResponse) {
    const rawError = String(lastResponse.data.error || "").trim();
    const isGenericNotFound =
      lastResponse.res.status === 404 &&
      (!rawError || rawError.toLowerCase() === "not found");
    throw new Error(
      isGenericNotFound
        ? "API route not found. Please restart backend server."
        : (lastResponse.data.error ||
          (lastResponse.res.status === 404
            ? "API route not found. Please restart backend server."
            : `Request failed (${lastResponse.res.status})`))
    );
  }

  throw new Error("Cannot connect to API server. Please run npm start or set API Server URL.");
}

function readLocationFallback(): LocationEntry[] {
  if (SERVER_ONLY_STORAGE) return [];
  try {
    const raw = localStorage.getItem(LOCATION_FALLBACK_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readUserFallback(): StaffUser[] {
  try {
    const raw = localStorage.getItem(USER_FALLBACK_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row) => row && typeof row === "object")
      .map((row, i) => {
        const user = row as Partial<StaffUser>;
        const parsedId = Number(user.id);
        return {
          id: Number.isFinite(parsedId) && parsedId > 0 ? parsedId : Date.now() + i,
          fullName: String(user.fullName || "").trim(),
          position: String(user.position || "").trim(),
          email: String(user.email || "").trim().toLowerCase(),
        } as StaffUser;
      })
      .filter((u) => u.fullName && u.position);
  } catch {
    return [];
  }
}

function trySetLocalStorage(key: string, value: string) {
  const allowInServerOnlyMode = new Set<string>([
    AUTH_TOKEN_KEY,
    AUTH_USER_KEY,
    API_BASE_OVERRIDE_KEY,
    USER_FALLBACK_KEY,
    INVENTORY_ITEM_FALLBACK_KEY,
    INVENTORY_TXN_FALLBACK_KEY,
    "ui_lang",
  ]);
  if (SERVER_ONLY_STORAGE && !allowInServerOnlyMode.has(key)) return true;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`localStorage write failed for ${key}:`, err);
    return false;
  }
}

function writeLocationFallback(list: LocationEntry[]) {
  trySetLocalStorage(LOCATION_FALLBACK_KEY, JSON.stringify(list));
}

function readAssetFallback(): Asset[] {
  if (SERVER_ONLY_STORAGE) return [];
  try {
    const raw = localStorage.getItem(ASSET_FALLBACK_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row) => row && typeof row === "object")
      .map((row) => {
        const asset = row as Asset;
        const photos = normalizeAssetPhotos(asset);
        return {
          ...asset,
          photo: photos[0] || "",
          photos,
        } as Asset;
      });
  } catch {
    return [];
  }
}

function writeAssetFallback(list: Asset[]) {
  if (SERVER_ONLY_STORAGE) return;
  const normalizedList = list.map((asset) => {
    const photos = normalizeAssetPhotos(asset);
    return { ...asset, photo: photos[0] || "", photos };
  });
  const full = JSON.stringify(normalizedList);
  if (trySetLocalStorage(ASSET_FALLBACK_KEY, full)) return;

  // Step 2: keep asset photos, drop only maintenance photos.
  const medium = normalizedList.map((asset) => ({
    ...asset,
    maintenanceHistory: Array.isArray(asset.maintenanceHistory)
      ? asset.maintenanceHistory.map((h) => ({
          ...h,
          photo: "",
        }))
      : [],
    verificationHistory: Array.isArray(asset.verificationHistory)
      ? asset.verificationHistory.map((h) => ({
          ...h,
          photo: "",
        }))
      : [],
  }));
  if (trySetLocalStorage(ASSET_FALLBACK_KEY, JSON.stringify(medium as Asset[]))) return;

  // Step 3: compact fallback with trimmed history and text fields.
  const compact = normalizedList.map((asset) => ({
    ...asset,
    photo: asset.photo || "",
    photos: (asset.photos || []).slice(0, 2),
    specs: "",
    notes: "",
    statusHistory: Array.isArray(asset.statusHistory) ? asset.statusHistory.slice(0, 30) : [],
    transferHistory: Array.isArray(asset.transferHistory) ? asset.transferHistory.slice(0, 30) : [],
    maintenanceHistory: Array.isArray(asset.maintenanceHistory)
      ? asset.maintenanceHistory.slice(0, 80).map((h) => ({
          ...h,
          photo: "",
          note: String(h.note || "").slice(0, 500),
          condition: String(h.condition || "").slice(0, 250),
        }))
      : [],
    verificationHistory: Array.isArray(asset.verificationHistory)
      ? asset.verificationHistory.slice(0, 80).map((h) => ({
          ...h,
          photo: "",
          note: String(h.note || "").slice(0, 500),
          condition: String(h.condition || "").slice(0, 250),
        }))
      : [],
  }));
  if (trySetLocalStorage(ASSET_FALLBACK_KEY, JSON.stringify(compact as Asset[]))) return;
  // Keep existing stored data if quota is still full; do not wipe photos automatically.
  console.warn("Asset fallback storage is full. Existing stored data was kept to avoid photo loss.");
}

function writeUserFallback(list: StaffUser[]) {
  trySetLocalStorage(USER_FALLBACK_KEY, JSON.stringify(list));
}

function readCalendarEventFallback(defaultEvents: CalendarEvent[]) {
  if (SERVER_ONLY_STORAGE) return defaultEvents;
  try {
    const raw = localStorage.getItem(CALENDAR_EVENT_FALLBACK_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return normalizeCalendarEvents(parsed, defaultEvents);
  } catch {
    return defaultEvents;
  }
}

function writeCalendarEventFallback(events: CalendarEvent[]) {
  trySetLocalStorage(CALENDAR_EVENT_FALLBACK_KEY, JSON.stringify(events));
}

function writeStringMap(key: string, map: Record<string, string>) {
  if (SERVER_ONLY_STORAGE) return;
  trySetLocalStorage(key, JSON.stringify(map));
}

function writeItemTypeFallback(map: Record<string, Array<{ itemEn: string; itemKm: string; code: string }>>) {
  if (SERVER_ONLY_STORAGE) return;
  trySetLocalStorage(ITEM_TYPE_FALLBACK_KEY, JSON.stringify(map));
}

function normalizeModulesByRole(role: AuthRole, modules?: unknown): NavModule[] {
  const allowed = new Set(ALL_NAV_MODULES);
  const list = Array.isArray(modules) ? modules.filter((x): x is NavModule => typeof x === "string" && allowed.has(x as NavModule)) : [];
  if (list.length) return Array.from(new Set(list));
  return isAdminRole(role) ? [...ALL_NAV_MODULES] : [...DEFAULT_VIEWER_MODULES];
}

function normalizeAssetSubviewAccess(value: unknown): AssetSubviewAccess {
  return String(value || "").trim().toLowerCase() === "list_only" ? "list_only" : "both";
}
function normalizeMenuAccess(
  role: AuthRole,
  modules: NavModule[],
  assetSubviewAccess: AssetSubviewAccess,
  input?: unknown
) {
  const finalize = (rows: MenuAccessKey[]) => {
    const next = new Set(rows);
    const allowedModules = new Set(modules);
    for (const node of MENU_ACCESS_TREE) {
      if (!allowedModules.has(node.module)) {
        next.delete(node.module);
        node.children.forEach((child) => next.delete(child.key));
      }
    }
    if (!isAdminRole(role) || assetSubviewAccess === "list_only") {
      next.delete("assets.register");
    }
    return Array.from(next);
  };
  if (Array.isArray(input)) {
    const allowed = new Set<MenuAccessKey>();
    const valid = new Set(MENU_ACCESS_TREE.flatMap((node) => [node.module, ...node.children.map((child) => child.key)]));
    for (const raw of input) {
      const key = String(raw || "").trim();
      if (!key || !valid.has(key)) continue;
      allowed.add(key);
    }
    if (allowed.size) return finalize(Array.from(allowed));
  }
  return finalize(defaultMenuAccessFor(role, modules, assetSubviewAccess));
}

function readAuthPermissionFallback(): Record<
  string,
  {
    role: AuthRole;
    campuses: string[];
    modules: NavModule[];
    assetSubviewAccess: AssetSubviewAccess;
    menuAccess: MenuAccessKey[];
  }
> {
  if (SERVER_ONLY_STORAGE) return {};
  try {
    const raw = localStorage.getItem(AUTH_PERMISSION_FALLBACK_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<
      string,
      {
        role: AuthRole;
        campuses: string[];
        modules: NavModule[];
        assetSubviewAccess: AssetSubviewAccess;
        menuAccess: MenuAccessKey[];
      }
    > = {};
    for (const [username, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object") continue;
      const v = value as {
        role?: string;
        campuses?: string[];
        modules?: unknown;
        assetSubviewAccess?: unknown;
        menuAccess?: unknown;
      };
      const role = normalizeRole(v.role);
      const campuses = normalizeRoleCampuses(role, v.campuses);
      const modules = normalizeModulesByRole(role, v.modules);
      const assetSubviewAccess = normalizeAssetSubviewAccess(v.assetSubviewAccess);
      const menuAccess = normalizeMenuAccess(role, modules, assetSubviewAccess, v.menuAccess);
      out[username] = { role, campuses, modules, assetSubviewAccess, menuAccess };
    }
    return out;
  } catch {
    return {};
  }
}

function writeAuthPermissionFallback(
  map: Record<
    string,
    {
      role: AuthRole;
      campuses: string[];
      modules: NavModule[];
      assetSubviewAccess: AssetSubviewAccess;
      menuAccess: MenuAccessKey[];
    }
  >
) {
  if (SERVER_ONLY_STORAGE) return;
  trySetLocalStorage(AUTH_PERMISSION_FALLBACK_KEY, JSON.stringify(map));
}

function readAuthAccountsFallback(): AuthAccount[] {
  if (SERVER_ONLY_STORAGE) return [];
  try {
    const raw = localStorage.getItem(AUTH_ACCOUNTS_FALLBACK_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [...LOCAL_AUTH_ACCOUNTS];
    const rows = parsed
      .filter((v) => v && typeof v === "object")
      .map((v) => {
        const row = v as Partial<AuthAccount>;
        return {
          id: Number(row.id) || Date.now(),
          username: String(row.username || "").trim(),
          displayName: String(row.displayName || row.username || "").trim(),
          role: normalizeRole(row.role),
          campuses: normalizeRoleCampuses(normalizeRole(row.role), row.campuses),
          modules: normalizeModulesByRole(normalizeRole(row.role), row.modules),
          assetSubviewAccess: normalizeAssetSubviewAccess((row as { assetSubviewAccess?: unknown }).assetSubviewAccess),
          menuAccess: normalizeMenuAccess(
            normalizeRole(row.role),
            normalizeModulesByRole(normalizeRole(row.role), row.modules),
            normalizeAssetSubviewAccess((row as { assetSubviewAccess?: unknown }).assetSubviewAccess),
            (row as { menuAccess?: unknown }).menuAccess
          ),
        } as AuthAccount;
      })
      .filter((u) => u.username);
    return rows.length ? rows : [...LOCAL_AUTH_ACCOUNTS];
  } catch {
    return [...LOCAL_AUTH_ACCOUNTS];
  }
}

function writeAuthAccountsFallback(rows: AuthAccount[]) {
  if (SERVER_ONLY_STORAGE) return;
  trySetLocalStorage(AUTH_ACCOUNTS_FALLBACK_KEY, JSON.stringify(rows));
}

function mergeAuthAccounts(serverRows: AuthAccount[], localRows: AuthAccount[]) {
  const byUsername = new Map<string, AuthAccount>();
  for (const row of serverRows) {
    byUsername.set(row.username.toLowerCase(), row);
  }
  for (const row of localRows) {
    const key = row.username.toLowerCase();
    const existing = byUsername.get(key);
    byUsername.set(
      key,
      existing
        ? {
            ...existing,
            role: row.role || existing.role,
            campuses: Array.isArray(row.campuses) && row.campuses.length ? row.campuses : existing.campuses,
            displayName: row.displayName || existing.displayName,
            modules: Array.isArray(row.modules) && row.modules.length ? row.modules : existing.modules,
            assetSubviewAccess: normalizeAssetSubviewAccess(
              (row as { assetSubviewAccess?: unknown }).assetSubviewAccess || existing.assetSubviewAccess
            ),
            menuAccess: normalizeMenuAccess(
              row.role || existing.role,
              Array.isArray(row.modules) && row.modules.length ? row.modules : existing.modules,
              normalizeAssetSubviewAccess((row as { assetSubviewAccess?: unknown }).assetSubviewAccess || existing.assetSubviewAccess),
              (row as { menuAccess?: unknown }).menuAccess || existing.menuAccess
            ),
          }
        : row
    );
  }
  return Array.from(byUsername.values()).sort((a, b) => a.username.localeCompare(b.username));
}

function readAuditFallback(): AuditLog[] {
  if (SERVER_ONLY_STORAGE) return [];
  try {
    const raw = localStorage.getItem(AUDIT_FALLBACK_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAuditFallback(list: AuditLog[]) {
  if (SERVER_ONLY_STORAGE) return;
  trySetLocalStorage(AUDIT_FALLBACK_KEY, JSON.stringify(list.slice(0, 500)));
}

function clearAllFallbackCaches() {
  const keys = [
    LOCATION_FALLBACK_KEY,
    ASSET_FALLBACK_KEY,
    USER_FALLBACK_KEY,
    CAMPUS_NAME_FALLBACK_KEY,
    ITEM_NAME_FALLBACK_KEY,
    ITEM_TYPE_FALLBACK_KEY,
    AUTH_PERMISSION_FALLBACK_KEY,
    AUTH_ACCOUNTS_FALLBACK_KEY,
    AUDIT_FALLBACK_KEY,
    INVENTORY_ITEM_FALLBACK_KEY,
    INVENTORY_TXN_FALLBACK_KEY,
  ];
  for (const key of keys) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore storage errors.
    }
  }
}

function writeInventoryItemFallback(rows: InventoryItem[]) {
  trySetLocalStorage(INVENTORY_ITEM_FALLBACK_KEY, JSON.stringify(rows));
}

function writeInventoryTxnFallback(rows: InventoryTxn[]) {
  trySetLocalStorage(INVENTORY_TXN_FALLBACK_KEY, JSON.stringify(rows.slice(0, 5000)));
}

function readInventoryItemFallback(): InventoryItem[] {
  try {
    const raw = localStorage.getItem(INVENTORY_ITEM_FALLBACK_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as InventoryItem[]) : [];
  } catch {
    return [];
  }
}

function readInventoryTxnFallback(): InventoryTxn[] {
  try {
    const raw = localStorage.getItem(INVENTORY_TXN_FALLBACK_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as InventoryTxn[]) : [];
  } catch {
    return [];
  }
}

function sortLocationEntriesByName(rows: LocationEntry[]) {
  return [...rows].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true })
  );
}

function mergeLocations(primary: LocationEntry[], secondary: LocationEntry[]) {
  const out: LocationEntry[] = [];
  const seen = new Set<string>();

  for (const loc of [...primary, ...secondary]) {
    const key = `${loc.campus.toLowerCase()}::${loc.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(loc);
  }
  return out;
}

function isMissingRouteError(err: unknown) {
  return err instanceof Error && err.message.toLowerCase().includes("route not found");
}

function isApiUnavailableError(err: unknown) {
  if (!(err instanceof Error)) return false;
  const m = err.message.toLowerCase();
  return m.includes("route not found") || m.includes("cannot connect to api server");
}

function isUnauthorizedError(err: unknown) {
  if (!(err instanceof Error)) return false;
  const m = err.message.toLowerCase();
  return m.includes("unauthorized") || m.includes("request failed (401)") || m.includes("request failed (403)");
}

function isHistoryRecordNotFoundError(err: unknown) {
  if (!(err instanceof Error)) return false;
  return err.message.toLowerCase().includes("history record not found");
}

function formatDate(value: string) {
  if (!value || value === "-") return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = date.toLocaleString("en-US", { month: "short" });
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateTime(value: string) {
  if (!value || value === "-") return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const datePart = formatDate(value);
  const timePart = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${datePart} ${timePart}`;
}

function getTermRange(year: number, term: "Term 1" | "Term 2" | "Term 3") {
  if (term === "Term 1") return { from: `${year}-01-01`, to: `${year}-04-30` };
  if (term === "Term 2") return { from: `${year}-05-01`, to: `${year}-08-31` };
  return { from: `${year}-09-01`, to: `${year}-12-31` };
}

function categoryCode(category: string) {
  if (category === "SAFETY") return "SF";
  if (category === "FACILITY") return "FC";
  return "IT";
}
function inventoryCategoryCode(category: "SUPPLY" | "CLEAN_TOOL" | "MAINT_TOOL") {
  if (category === "CLEAN_TOOL") return "CT";
  if (category === "MAINT_TOOL") return "MT";
  return "CS";
}
function inventoryRecordCampusCode(campus: string) {
  if (campus === "Chaktomuk Campus" || campus === "Chaktomuk Campus (C2.2)") return "C2";
  return CAMPUS_CODE[campus] || "CX";
}
function isInventoryTxnIn(type: InventoryTxn["type"]) {
  return type === "IN" || type === "BORROW_IN";
}
function isInventoryTxnOut(type: InventoryTxn["type"]) {
  return type === "OUT" || type === "BORROW_OUT" || type === "BORROW_CONSUME";
}
function isInventoryTxnUsageOut(type: InventoryTxn["type"]) {
  return type === "OUT" || type === "BORROW_CONSUME";
}
function inventoryTxnTypeLabel(type: InventoryTxn["type"]) {
  const row = INVENTORY_TXN_TYPE_OPTIONS.find((option) => option.value === type);
  return row ? row.label : type;
}
function inventoryAliasText(itemName: string) {
  const name = String(itemName || "").toLowerCase();
  const hit = INVENTORY_MASTER_ITEMS.find((item) => name.includes(item.nameEn.toLowerCase()));
  return hit ? hit.aliases.join(" ") : "";
}
function normalizeInventoryCompareText(value: string) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}
function inventoryMasterDisplayName(master: {
  nameEn: string;
  spec: string;
}) {
  return `${master.nameEn}${master.spec ? ` (${master.spec})` : ""}`;
}
function inventoryItemMatchesMaster(
  item: Pick<InventoryItem, "category" | "itemName" | "unit">,
  master: {
    category: "SUPPLY" | "CLEAN_TOOL" | "MAINT_TOOL";
    nameEn: string;
    spec: string;
    unit: string;
  }
) {
  if (item.category !== master.category) return false;
  return (
    normalizeInventoryCompareText(item.itemName) === normalizeInventoryCompareText(inventoryMasterDisplayName(master)) &&
    normalizeInventoryCompareText(item.unit) === normalizeInventoryCompareText(master.unit)
  );
}
function isCleaningSupplyItem(item: Pick<InventoryItem, "category" | "itemName" | "itemCode">) {
  if (item.category !== "SUPPLY") return false;
  const text = `${item.itemName || ""} ${item.itemCode || ""}`.toLowerCase();
  return CLEANING_SUPPLY_KEYWORDS.some((keyword) => text.includes(keyword));
}
function calcNextInventorySeq(
  list: InventoryItem[],
  campus: string,
  category: "SUPPLY" | "CLEAN_TOOL" | "MAINT_TOOL"
) {
  const campusCode = inventoryRecordCampusCode(campus);
  const catCode = inventoryCategoryCode(category);
  let maxSeq = 0;
  for (const item of list) {
    if (inventoryRecordCampusCode(item.campus) !== campusCode || item.category !== category) continue;
    const m = String(item.itemCode || "").toUpperCase().match(new RegExp(`^${campusCode}-${catCode}-(\\d{1,6})$`));
    if (!m) continue;
    const n = Number(m[1] || 0);
    if (n > maxSeq) maxSeq = n;
  }
  return maxSeq + 1;
}
function buildInventoryItemCode(
  list: InventoryItem[],
  campus: string,
  category: "SUPPLY" | "CLEAN_TOOL" | "MAINT_TOOL"
) {
  const campusCode = inventoryRecordCampusCode(campus);
  const catCode = inventoryCategoryCode(category);
  const seq = calcNextInventorySeq(list, campus, category);
  return `${campusCode}-${catCode}-${pad4(seq)}`;
}

function defaultTypeForCategory(category: string) {
  return (TYPE_OPTIONS[category] || TYPE_OPTIONS.IT)[0];
}

function isSharedLocation(location: string) {
  const v = location.trim().toLowerCase();
  return SHARED_LOCATION_KEYWORDS.some((k) => v.includes(k));
}

function pad4(n: number) {
  return String(n).padStart(4, "0");
}

function toYmd(value: Date) {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeYmdInput(raw: string) {
  const text = String(raw || "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  return toYmd(parsed);
}

function shiftYmd(ymd: string, days: number) {
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  d.setDate(d.getDate() + days);
  return toYmd(d);
}

function normalizeLooseDateToYmd(raw: string) {
  const text = String(raw || "").trim();
  if (!text) return "";
  const isoPrefix = text.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s].*)?$/);
  if (isoPrefix) return isoPrefix[1];
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  return toYmd(parsed);
}

function expandHolidayRange(from: string, to: string, name: string) {
  const out: Array<{ date: string; name: string }> = [];
  let cur = normalizeYmdInput(from);
  const end = normalizeYmdInput(to);
  if (!cur || !end || cur > end) return out;
  while (cur <= end) {
    out.push({ date: cur, name });
    cur = shiftYmd(cur, 1);
  }
  return out;
}

const DEFAULT_CALENDAR_EVENTS_BY_YEAR: Record<number, Array<{ date: string; name: string }>> = {
  2026: [
    { date: "2026-01-01", name: "New Year's Day" },
    { date: "2026-01-02", name: "Winter Break" },
    { date: "2026-01-07", name: "Victory Over Genocide Day" },
    { date: "2026-01-12", name: "End of Term 2" },
    { date: "2026-01-13", name: "Start of Term 3" },
    { date: "2026-01-17", name: "PTC for Term 2" },
    { date: "2026-03-08", name: "International Women's Day" },
    { date: "2026-03-21", name: "PTC for Term 3" },
    { date: "2026-03-23", name: "End of Term 3" },
    { date: "2026-03-24", name: "Start of Term 4" },
    { date: "2026-04-10", name: "KNY Celebration" },
    ...expandHolidayRange("2026-04-11", "2026-04-19", "Khmer New Year"),
    { date: "2026-05-01", name: "International Labour Day & Visak Bochea Day" },
    { date: "2026-05-05", name: "Royal Plowing Ceremony" },
    { date: "2026-05-14", name: "King's Birthday" },
    { date: "2026-06-06", name: "PTC for Term 4" },
    { date: "2026-06-12", name: "End of Term 4" },
    { date: "2026-06-13", name: "Year-End Recognition Day" },
    { date: "2026-06-18", name: "King's Mother's Birthday" },
    ...expandHolidayRange("2026-06-22", "2026-06-30", "Summer Camp"),
    ...expandHolidayRange("2026-07-01", "2026-07-24", "Summer Camp"),
    { date: "2026-08-03", name: "Start of Term 1 (2026)" },
    { date: "2026-09-24", name: "Constitutional Day" },
    ...expandHolidayRange("2026-10-10", "2026-10-12", "Pchum Ben Days"),
    { date: "2026-10-13", name: "End of Term 1" },
    { date: "2026-10-14", name: "Start of Term 2" },
    { date: "2026-10-15", name: "Commemoration Day of King's Father" },
    { date: "2026-10-17", name: "PTC for Term 1" },
    { date: "2026-10-29", name: "King Norodom Sihamoni's Coronation" },
    { date: "2026-11-09", name: "Independence Day" },
    ...expandHolidayRange("2026-11-23", "2026-11-25", "Water Festival Days"),
    ...expandHolidayRange("2026-12-24", "2026-12-31", "Winter Break"),
  ],
  2027: [
    { date: "2027-01-01", name: "New Year's Day" },
    { date: "2027-01-07", name: "Victory Over Genocide Day" },
    { date: "2027-01-11", name: "End of Term 2" },
    { date: "2027-01-12", name: "Start of Term 3" },
    { date: "2027-01-16", name: "PTC for Term 2" },
    { date: "2027-03-08", name: "International Women's Day" },
    { date: "2027-03-23", name: "End of Term 3" },
    { date: "2027-03-24", name: "Start of Term 4" },
    { date: "2027-03-27", name: "PTC for Term 3" },
    { date: "2027-04-09", name: "KNY Celebration" },
    ...expandHolidayRange("2027-04-10", "2027-04-18", "Khmer New Year"),
    { date: "2027-05-01", name: "International Labour Day" },
    { date: "2027-05-14", name: "King's Birthday" },
    { date: "2027-05-20", name: "Visak Bochea Day" },
    { date: "2027-05-24", name: "Royal Plowing Ceremony" },
    { date: "2027-06-05", name: "PTC for Term 4" },
    { date: "2027-06-11", name: "End of Term 4" },
    { date: "2027-06-12", name: "Year-End Recognition Day" },
    { date: "2027-06-18", name: "King's Mother's Birthday" },
    ...expandHolidayRange("2027-06-21", "2027-06-30", "Summer Camp"),
    ...expandHolidayRange("2027-07-01", "2027-07-23", "Summer Camp"),
    { date: "2027-08-02", name: "Start of Term 1 (2027)" },
  ],
};

function classifyHolidayEvent(name: string): CalendarEventType {
  const text = String(name || "").toLowerCase();
  if (text.includes("ptc")) return "ptc";
  if (text.includes("end of term")) return "term_end";
  if (text.includes("start of term")) return "term_start";
  if (text.includes("summer camp")) return "camp";
  if (text.includes("kny celebration") || text.includes("recognition")) return "celebration";
  if (text.includes("winter break") || text.includes("khmer new year")) return "break";
  return "public";
}

function buildDefaultCalendarEvents() {
  const out: CalendarEvent[] = [];
  let cursor = 1;
  const years = Object.keys(DEFAULT_CALENDAR_EVENTS_BY_YEAR)
    .map((y) => Number(y))
    .sort((a, b) => a - b);
  for (const year of years) {
    for (const row of DEFAULT_CALENDAR_EVENTS_BY_YEAR[year] || []) {
      if (!row?.date || !row?.name) continue;
      out.push({
        id: cursor,
        date: row.date,
        name: row.name,
        type: classifyHolidayEvent(row.name),
      });
      cursor += 1;
    }
  }
  return out;
}

function normalizeCalendarEventType(value: unknown): CalendarEventType {
  const type = String(value || "").trim().toLowerCase();
  if (["public", "ptc", "term_end", "term_start", "camp", "celebration", "break"].includes(type)) {
    return type as CalendarEventType;
  }
  return "public";
}

function normalizeCalendarEvents(input: unknown, fallback: CalendarEvent[] = []) {
  const rows = Array.isArray(input) ? input : fallback;
  const out: CalendarEvent[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] as Partial<CalendarEvent> | undefined;
    const date = String(row?.date || "").trim();
    const name = String(row?.name || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !name) continue;
    const key = `${date}::${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const parsedId = Number(row?.id);
    out.push({
      id: Number.isFinite(parsedId) && parsedId > 0 ? parsedId : Date.now() + i,
      date,
      name,
      type: normalizeCalendarEventType((row as { type?: unknown })?.type || classifyHolidayEvent(name)),
    });
  }
  return out.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.name.localeCompare(b.name);
  });
}

function nthWeekdayOfMonth(
  year: number,
  monthIndex: number,
  weekday: number,
  weekOfMonth: number
) {
  const first = new Date(year, monthIndex, 1);
  const delta = (weekday - first.getDay() + 7) % 7;
  const day = 1 + delta + (weekOfMonth - 1) * 7;
  const d = new Date(year, monthIndex, day);
  if (d.getMonth() !== monthIndex) return null;
  return d;
}

function resolveNextScheduleDate(asset: Asset, fromYmd: string) {
  if (asset.repeatMode === "MONTHLY_WEEKDAY") {
    const week = Number(asset.repeatWeekOfMonth || 1);
    const weekday = Number(asset.repeatWeekday || 6);
    const fromDate = new Date(`${fromYmd}T00:00:00`);
    for (let i = 0; i < 24; i += 1) {
      const d = nthWeekdayOfMonth(
        fromDate.getFullYear(),
        fromDate.getMonth() + i,
        weekday,
        week
      );
      if (!d) continue;
      const ymd = toYmd(d);
      if (ymd >= fromYmd) return ymd;
    }
    return "";
  }
  return asset.nextMaintenanceDate || "";
}

function hasCompletedMaintenanceOnDate(asset: Asset, ymd: string) {
  const target = String(ymd || "").trim();
  if (!target) return false;
  const history = Array.isArray(asset.maintenanceHistory) ? asset.maintenanceHistory : [];
  const doneDates = history
    .map((entry) => {
      const completion = String(entry?.completion || "").trim().toLowerCase();
      if (completion === "not yet") return "";
      return normalizeLooseDateToYmd(String(entry?.date || ""));
    })
    .filter(Boolean);
  if (!doneDates.length) return false;
  if (doneDates.some((entryDate) => entryDate === target)) return true;
  // One-time schedule should clear once any done record exists on/after scheduled date.
  if (asset.repeatMode !== "MONTHLY_WEEKDAY" && doneDates.some((entryDate) => entryDate >= target)) return true;
  return history.some((entry) => {
    const entryDate = normalizeLooseDateToYmd(String(entry?.date || ""));
    if (entryDate !== target) return false;
    const completion = String(entry?.completion || "").trim().toLowerCase();
    if (!completion) return true;
    return completion !== "not yet";
  });
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function calcNextSeq(list: Asset[], campus: string, category: string, type: string) {
  const same = list.filter(
    (a) => a.campus === campus && a.category === category && a.type === type
  );
  if (!same.length) return 1;
  return Math.max(...same.map((a) => Number(a.seq) || 0)) + 1;
}

function filterAssets(
  list: Asset[],
  campusFilter: string,
  categoryFilter: string,
  nameFilter: string,
  searchText: string
) {
  let out = [...list];
  if (campusFilter !== "ALL") out = out.filter((a) => a.campus === campusFilter);
  if (categoryFilter !== "ALL") out = out.filter((a) => a.category === categoryFilter);
  if (nameFilter !== "ALL") {
    out = out.filter((a) => {
      const pcPart =
        a.category === "IT" && a.type === DESKTOP_PARENT_TYPE
          ? String(a.pcType || "").trim().toUpperCase()
          : "";
      const key = `${a.category}:${a.type}:${pcPart}`;
      return key === nameFilter;
    });
  }
  const q = searchText.trim().toLowerCase();
  if (q) {
    out = out.filter((a) =>
      `${a.assetId} ${a.name} ${a.location} ${a.assignedTo || ""}`.toLowerCase().includes(q)
    );
  }
  return out;
}

function mergeAssets(primary: Asset[], secondary: Asset[]) {
  const merged = new Map<string, Asset>();
  for (const a of [...primary, ...secondary]) {
    const key = `${a.assetId}::${a.id}`;
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, a);
      continue;
    }

    const next: Asset = { ...prev, ...a };
    const mergedPhotos = normalizeAssetPhotos({
      photos: [...(Array.isArray(prev.photos) ? prev.photos : []), ...(Array.isArray(a.photos) ? a.photos : [])],
      photo: a.photo || prev.photo || "",
    });
    next.photos = mergedPhotos;
    next.photo = mergedPhotos[0] || "";
    if (!a.specs && prev.specs) next.specs = prev.specs;
    if (!a.notes && prev.notes) next.notes = prev.notes;
    if (!a.brand && prev.brand) next.brand = prev.brand;
    if (!a.model && prev.model) next.model = prev.model;
    if (!a.serialNumber && prev.serialNumber) next.serialNumber = prev.serialNumber;
    if (!a.purchaseDate && prev.purchaseDate) next.purchaseDate = prev.purchaseDate;
    if (!a.warrantyUntil && prev.warrantyUntil) next.warrantyUntil = prev.warrantyUntil;
    if (!a.vendor && prev.vendor) next.vendor = prev.vendor;

    const prevHistory = Array.isArray(prev.maintenanceHistory) ? prev.maintenanceHistory : [];
    const hasIncomingMaintenanceHistory = Object.prototype.hasOwnProperty.call(a, "maintenanceHistory");
    const nextHistory = Array.isArray(a.maintenanceHistory) ? a.maintenanceHistory : [];
    if (!hasIncomingMaintenanceHistory && prevHistory.length) {
      next.maintenanceHistory = prevHistory;
    } else if (nextHistory.length || prevHistory.length) {
      const prevById = new Map<number, MaintenanceEntry>(prevHistory.map((h) => [h.id, h]));
      const seen = new Set<number>();
      const mergedHistory = nextHistory.map((h) => {
        const old = prevById.get(h.id);
        seen.add(h.id);
        if (!old) return h;
        return {
          ...old,
          ...h,
          photo: h.photo || old.photo || "",
        };
      });
      for (const old of prevHistory) {
        if (seen.has(old.id)) continue;
        mergedHistory.push(old);
      }
      next.maintenanceHistory = mergedHistory;
    }

    const prevVerification = Array.isArray(prev.verificationHistory) ? prev.verificationHistory : [];
    const hasIncomingVerificationHistory = Object.prototype.hasOwnProperty.call(a, "verificationHistory");
    const nextVerification = Array.isArray(a.verificationHistory) ? a.verificationHistory : [];
    if (!hasIncomingVerificationHistory && prevVerification.length) {
      next.verificationHistory = prevVerification;
    } else if (nextVerification.length || prevVerification.length) {
      const prevById = new Map<number, VerificationEntry>(prevVerification.map((h) => [h.id, h]));
      const seen = new Set<number>();
      const mergedVerification = nextVerification.map((h) => {
        const old = prevById.get(h.id);
        seen.add(h.id);
        if (!old) return h;
        return {
          ...old,
          ...h,
          photo: h.photo || old.photo || "",
        };
      });
      for (const old of prevVerification) {
        if (seen.has(old.id)) continue;
        mergedVerification.push(old);
      }
      next.verificationHistory = mergedVerification;
    }

    if (!a.nextVerificationDate && prev.nextVerificationDate) {
      next.nextVerificationDate = prev.nextVerificationDate;
    }
    if (!a.verificationFrequency && prev.verificationFrequency) {
      next.verificationFrequency = prev.verificationFrequency;
    }

    const prevStatus = Array.isArray(prev.statusHistory) ? prev.statusHistory : [];
    const nextStatus = Array.isArray(a.statusHistory) ? a.statusHistory : [];
    const hasIncomingStatusHistory = Object.prototype.hasOwnProperty.call(a, "statusHistory");
    if (!hasIncomingStatusHistory && nextStatus.length < prevStatus.length) next.statusHistory = prevStatus;

    const prevTransfer = Array.isArray(prev.transferHistory) ? prev.transferHistory : [];
    const nextTransfer = Array.isArray(a.transferHistory) ? a.transferHistory : [];
    const hasIncomingTransferHistory = Object.prototype.hasOwnProperty.call(a, "transferHistory");
    if (!hasIncomingTransferHistory && nextTransfer.length < prevTransfer.length) next.transferHistory = prevTransfer;
    const prevCustody = Array.isArray(prev.custodyHistory) ? prev.custodyHistory : [];
    const nextCustody = Array.isArray(a.custodyHistory) ? a.custodyHistory : [];
    const hasIncomingCustodyHistory = Object.prototype.hasOwnProperty.call(a, "custodyHistory");
    if (!hasIncomingCustodyHistory && nextCustody.length < prevCustody.length) next.custodyHistory = prevCustody;
    if (!a.custodyStatus && prev.custodyStatus) next.custodyStatus = prev.custodyStatus;

    merged.set(key, next);
  }
  return Array.from(merged.values());
}

function buildStatsFromAssets(list: Asset[], campusFilter: string): DashboardStats {
  const filtered = campusFilter === "ALL" ? list : list.filter((a) => a.campus === campusFilter);
  const byCampusSource = campusFilter === "ALL" ? list : filtered;
  const byCampusMap = new Map<string, number>();
  for (const a of byCampusSource) {
    byCampusMap.set(a.campus, (byCampusMap.get(a.campus) || 0) + 1);
  }
  return {
    totalAssets: filtered.length,
    itAssets: filtered.filter((a) => a.category === "IT").length,
    safetyAssets: filtered.filter((a) => a.category === "SAFETY").length,
    openTickets: 0,
    byCampus: Array.from(byCampusMap.entries()).map(([campus, assets]) => ({
      campus,
      assets,
      openTickets: 0,
    })),
  };
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Cannot read image file."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

async function compressImageDataUrl(
  dataUrl: string,
  maxWidth = 1280,
  maxHeight = 1280,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
      const targetWidth = Math.max(1, Math.round(img.width * ratio));
      const targetHeight = Math.max(1, Math.round(img.height * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      const compressed = canvas.toDataURL("image/jpeg", quality);
      resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function optimizeUploadPhoto(file: File): Promise<string> {
  const source = await fileToDataUrl(file);
  return compressImageDataUrl(source, 1280, 1280, 0.75);
}

function normalizeAssetPhotos(input: { photo?: string; photos?: string[] }) {
  const out: string[] = [];
  const list = Array.isArray(input.photos) ? input.photos : [];
  for (const item of list) {
    const url = String(item || "").trim();
    if (!url) continue;
    if (!out.includes(url)) out.push(url);
    if (out.length >= MAX_ASSET_PHOTOS) break;
  }
  const single = String(input.photo || "").trim();
  if (single) {
    if (out.includes(single)) {
      out.splice(out.indexOf(single), 1);
    }
    out.unshift(single);
  }
  return out.slice(0, MAX_ASSET_PHOTOS);
}

function normalizeAssetForUi(asset: Asset): Asset {
  const photos = normalizeAssetPhotos(asset);
  const normalizeUrl = (raw: string) => {
    const text = String(raw || "").trim();
    if (!text) return "";
    if (text.startsWith("/uploads/")) return text;
    try {
      const parsed = new URL(text);
      if (parsed.pathname.startsWith("/uploads/")) return parsed.pathname;
    } catch {
      // keep original if not URL
    }
    return text;
  };
  const normalizedPhotos = photos.map(normalizeUrl).filter(Boolean);
  const isReplacementDone = (typeRaw: string, completionRaw: string) => {
    const type = String(typeRaw || "").trim().toLowerCase();
    const completion = String(completionRaw || "").trim().toLowerCase();
    return (type === "replacement" || type === "replacment") && completion === "done";
  };
  const hasReplacementDone = Array.isArray(asset.maintenanceHistory)
    ? asset.maintenanceHistory.some((entry) => isReplacementDone(entry?.type || "", entry?.completion || ""))
    : false;
  const currentStatus = String(asset.status || "Active");
  const shouldAutoRetire = hasReplacementDone && currentStatus !== "Retired";
  const nextStatusHistory = shouldAutoRetire
    ? [
        {
          id: Date.now() + Math.floor(Math.random() * 1000),
          date: new Date().toISOString(),
          fromStatus: currentStatus || "Active",
          toStatus: "Retired",
          reason: "Auto corrected in UI: replacement maintenance is marked Done",
          by: "System",
        },
        ...(Array.isArray(asset.statusHistory) ? asset.statusHistory : []),
      ]
    : asset.statusHistory;
  const custodyHistory = Array.isArray(asset.custodyHistory) ? asset.custodyHistory : [];
  const custodyStatus =
    asset.custodyStatus === "ASSIGNED" || asset.custodyStatus === "IN_STOCK"
      ? asset.custodyStatus
      : (String(asset.assignedTo || "").trim() ? "ASSIGNED" : "IN_STOCK");
  return {
    ...asset,
    componentRole: String(asset.componentRole || "").trim(),
    componentRequired: Boolean(asset.componentRequired),
    photos: normalizedPhotos,
    photo: normalizeUrl(normalizedPhotos[0] || ""),
    status: shouldAutoRetire ? "Retired" : asset.status,
    statusHistory: nextStatusHistory,
    custodyHistory,
    custodyStatus,
  };
}

type AssetPickerProps = {
  value: string;
  assets: Asset[];
  onChange: (assetId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  getLabel: (asset: Asset) => string;
};

function AssetPicker({ value, assets, onChange, placeholder = "Select asset", disabled, getLabel }: AssetPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const prevValueRef = useRef(value);
  const selected = assets.find((a) => String(a.id) === value) || null;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (ev: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(ev.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (prevValueRef.current !== value) {
      prevValueRef.current = value;
      setOpen(false);
      setSearch("");
    }
  }, [value]);

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) => {
      const label = getLabel(a);
      return `${a.assetId} ${label} ${a.name} ${a.location} ${a.campus} ${a.category} ${a.type}`
        .toLowerCase()
        .includes(q);
    });
  }, [assets, deferredSearch, getLabel]);

  const selectAsset = useCallback(
    (assetId: string) => {
      onChange(assetId);
      setOpen(false);
      setSearch("");
    },
    [onChange]
  );

  return (
    <div className={`asset-picker ${disabled ? "asset-picker-disabled" : ""}`} ref={wrapRef}>
      <button
        type="button"
        className="asset-picker-trigger input"
        disabled={disabled}
        onMouseDown={(e) => {
          // Prevent label re-activation from toggling this twice in wrapped form labels.
          e.preventDefault();
        }}
        onClick={() => setOpen(true)}
      >
        {selected ? (
          <span className="asset-picker-selected">
            {selected.photo ? <img src={selected.photo} alt={selected.assetId} className="asset-picker-thumb" /> : <span className="asset-picker-thumb-empty">-</span>}
            <span>{getLabel(selected)}</span>
          </span>
        ) : (
          <span className="asset-picker-placeholder">{placeholder}</span>
        )}
        <span className="asset-picker-caret">▾</span>
      </button>
      {open ? (
        <div className="asset-picker-menu">
          <input
            className="input asset-picker-search"
            placeholder="Search by ID or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="asset-picker-list">
            {filtered.length ? (
              filtered.map((asset) => (
                <button
                  type="button"
                  key={`asset-picker-${asset.id}`}
                  className={`asset-picker-option ${String(asset.id) === value ? "asset-picker-option-active" : ""}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    selectAsset(String(asset.id));
                  }}
                  onClick={() => selectAsset(String(asset.id))}
                >
                  {asset.photo ? <img src={asset.photo} alt={asset.assetId} className="asset-picker-thumb" /> : <span className="asset-picker-thumb-empty">-</span>}
                  <span>{getLabel(asset)}</span>
                </button>
              ))
            ) : (
              <div className="asset-picker-empty">No assets found.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function App() {
  type MaintenanceSortKey =
    | "assetId"
    | "campus"
    | "category"
    | "assetType"
    | "location"
    | "date"
    | "type"
    | "completion"
    | "condition"
    | "note"
    | "cost"
    | "by"
    | "status";
  type AssetListSortKey =
    | "assetId"
    | "campus"
    | "category"
    | "name"
    | "location"
    | "status";
  type AssetMasterSortKey =
    | "photo"
    | "assetId"
    | "linkedTo"
    | "itemName"
    | "category"
    | "campus"
    | "itemDescription"
    | "location"
    | "purchaseDate"
    | "lastServiceDate"
    | "assignedTo"
    | "status";
  type AssetMasterColumnKey = AssetMasterSortKey;

  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem("ui_lang");
    return saved === "km" ? "km" : "en";
  });
  const t = TEXT[lang];
  const [authLoading, setAuthLoading] = useState(true);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loginForm, setLoginForm] = useState(() => {
    const remember = String(localStorage.getItem(LOGIN_REMEMBER_KEY) || "") === "1";
    return {
      username: remember ? String(localStorage.getItem(LOGIN_REMEMBER_USERNAME_KEY) || "") : "",
      password: "",
    };
  });
  const [rememberLogin, setRememberLogin] = useState(
    () => String(localStorage.getItem(LOGIN_REMEMBER_KEY) || "") === "1"
  );
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotPasswordForm, setForgotPasswordForm] = useState({
    username: "",
    email: "",
    code: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [forgotPasswordCode, setForgotPasswordCode] = useState("");
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState("");
  const [apiBaseInput] = useState(
    () =>
      SERVER_ONLY_STORAGE
        ? String(ENV_API_BASE_URL || getAutoApiBaseForHost())
        : String(localStorage.getItem(API_BASE_OVERRIDE_KEY) || ENV_API_BASE_URL || getAutoApiBaseForHost())
  );
  const isAdmin = authUser ? isAdminRole(authUser.role) : false;
  const maintenanceQuickMode = useMemo(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    const mode = String(params.get("mode") || "").toLowerCase();
    return mode === "maintenance" || mode === "staff";
  }, []);
  const maintenanceQuickLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    params.set("mode", "maintenance");
    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  }, []);

  const [tab, setTab] = useState<NavModule>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileNotificationOpen, setMobileNotificationOpen] = useState(false);
  const mobileNavRef = useRef<HTMLDivElement | null>(null);
  const mobileSwipeStartXRef = useRef<number | null>(null);
  const mobileSwipeStartYRef = useRef<number | null>(null);
  const shownBrowserNotificationIdsRef = useRef<Set<number>>(new Set());
  const navItems = useMemo<Array<{ id: NavModule; label: string }>>(
    () => [
      { id: "dashboard", label: t.dashboard },
      { id: "assets", label: t.assets },
      { id: "inventory", label: t.inventory },
      { id: "tickets", label: t.workOrders },
      { id: "schedule", label: t.schedule },
      { id: "transfer", label: t.transfer },
      { id: "maintenance", label: t.maintenance },
      { id: "verification", label: t.verification },
      { id: "reports", label: t.reports },
      ...(isAdmin ? [{ id: "setup" as NavModule, label: t.setup }] : []),
    ],
    [isAdmin, t]
  );
  const navIcon = useCallback((id: NavModule) => {
    switch (id) {
      case "dashboard":
        return "📊";
      case "assets":
        return "🗂";
      case "inventory":
        return "📦";
      case "tickets":
        return "🧾";
      case "schedule":
        return "🗓";
      case "transfer":
        return "🔁";
      case "maintenance":
        return "🛠";
      case "verification":
        return "✅";
      case "reports":
        return "📄";
      case "setup":
        return "⚙";
      default:
        return "•";
    }
  }, []);
  const allowedNavModules = useMemo(() => {
    const modules = authUser?.modules?.length ? authUser.modules : ALL_NAV_MODULES;
    const byRole = new Set<NavModule>(modules);
    const menuAccess = Array.isArray(authUser?.menuAccess) ? authUser?.menuAccess || [] : [];
    if (!menuAccess.length) return byRole;
    const byMenu = new Set<NavModule>();
    for (const module of ALL_NAV_MODULES) {
      if (menuAccess.includes(module) || menuAccess.some((key) => key.startsWith(`${module}.`))) {
        byMenu.add(module);
      }
    }
    return new Set<NavModule>(Array.from(byRole).filter((m) => byMenu.has(m)));
  }, [authUser?.modules, authUser?.menuAccess]);
  const allowedMenuAccess = useMemo(
    () => new Set<MenuAccessKey>(Array.isArray(authUser?.menuAccess) ? authUser?.menuAccess || [] : []),
    [authUser?.menuAccess]
  );
  const canAccessMenu = useCallback(
    (key: MenuAccessKey, module: NavModule) => {
      if (!allowedNavModules.has(module)) return false;
      if (!allowedMenuAccess.size) return true;
      return allowedMenuAccess.has(module) || allowedMenuAccess.has(key);
    },
    [allowedNavModules, allowedMenuAccess]
  );
  const canOpenAssetRegister = Boolean(
    isAdmin &&
      authUser?.assetSubviewAccess !== "list_only" &&
      canAccessMenu("assets.register", "assets")
  );
  const showMaintenanceDashboard = !maintenanceQuickMode && !isAdmin && canAccessMenu("maintenance.record", "maintenance");
  const navMenuItems = useMemo(
    () =>
      navItems.filter((item) => {
        if (!allowedNavModules.has(item.id)) return false;
        if (maintenanceQuickMode) return false;
        return true;
      }),
    [navItems, allowedNavModules, maintenanceQuickMode]
  );
  const navSections = useMemo(() => {
    const labels: Record<NavSection, string> =
      lang === "km"
        ? {
            core: "មុខងារស្នូល",
            operations: "ប្រតិបត្តិការ",
            admin: "គ្រប់គ្រង",
          }
        : {
            core: "Core Modules",
            operations: "Operations",
            admin: "Administration",
          };
    const order: NavSection[] = ["core", "operations", "admin"];
    return order
      .map((section) => ({
        section,
        label: labels[section],
        items: navMenuItems.filter((item) => NAV_SECTION_MAP[item.id] === section),
      }))
      .filter((section) => section.items.length > 0);
  }, [lang, navMenuItems]);
  const handleNavChange = useCallback((nextTab: NavModule) => {
    setTab(nextTab);
  }, []);
  const handlePhoneLogoHome = useCallback(() => {
    setTab("dashboard");
    window.location.reload();
  }, []);
  const [assetsView, setAssetsView] = useState<"register" | "list">("register");
  const [campusFilter, setCampusFilter] = useState("ALL");
  const [assetCampusFilter, setAssetCampusFilter] = useState("ALL");
  const [assetCategoryFilter] = useState("ALL");
  const [assetNameFilter, setAssetNameFilter] = useState("ALL");
  const [assetCampusMultiFilter, setAssetCampusMultiFilter] = useState<string[]>(["ALL"]);
  const [assetCategoryMultiFilter, setAssetCategoryMultiFilter] = useState<string[]>(["ALL"]);
  const [assetNameMultiFilter, setAssetNameMultiFilter] = useState<string[]>(["ALL"]);
  const [assetLocationMultiFilter, setAssetLocationMultiFilter] = useState<string[]>(["ALL"]);
  const [maintenanceCategoryFilter, setMaintenanceCategoryFilter] = useState("ALL");
  const [maintenanceTypeFilter, setMaintenanceTypeFilter] = useState("ALL");
  const [maintenanceDateFrom, setMaintenanceDateFrom] = useState("");
  const [maintenanceDateTo, setMaintenanceDateTo] = useState("");
  const [verificationCategoryFilter, setVerificationCategoryFilter] = useState("ALL");
  const [verificationResultFilter, setVerificationResultFilter] = useState("ALL");
  const [verificationDateFrom, setVerificationDateFrom] = useState("");
  const [verificationDateTo, setVerificationDateTo] = useState("");
  const [scheduleView, setScheduleView] = useState<"bulk" | "single" | "calendar">("calendar");
  const [setupView, setSetupView] = useState<"campus" | "users" | "permissions" | "backup" | "items" | "locations" | "calendar">("campus");
  const [inventoryView, setInventoryView] = useState<"items" | "stock" | "balance" | "daily">("items");
  const [inventoryBalanceMode, setInventoryBalanceMode] = useState<"all" | "low">("all");
  const [transferView, setTransferView] = useState<"record" | "history">("history");
  const [maintenanceView, setMaintenanceView] = useState<"dashboard" | "record" | "history">("dashboard");
  const [verificationView, setVerificationView] = useState<"record" | "history">("record");
  const [maintenanceRecordCategoryFilter, setMaintenanceRecordCategoryFilter] = useState("ALL");
  const [maintenanceRecordItemFilter, setMaintenanceRecordItemFilter] = useState("ALL");
  const [maintenanceRecordLocationFilter, setMaintenanceRecordLocationFilter] = useState("ALL");
  const [maintenanceRecordScheduleJumpMode, setMaintenanceRecordScheduleJumpMode] = useState(false);
  const [verificationRecordCategoryFilter, setVerificationRecordCategoryFilter] = useState("ALL");
  const [verificationRecordItemFilter, setVerificationRecordItemFilter] = useState("ALL");
  const [verificationRecordLocationFilter, setVerificationRecordLocationFilter] = useState("ALL");
  const [maintenanceSort, setMaintenanceSort] = useState<{
    key: MaintenanceSortKey;
    direction: "asc" | "desc";
  }>({
    key: "date",
    direction: "desc",
  });
  const [assetListSort, setAssetListSort] = useState<{
    key: AssetListSortKey;
    direction: "asc" | "desc";
  }>({
    key: "assetId",
    direction: "asc",
  });
  const [reportType, setReportType] = useState<ReportType>("asset_master");
  const [assetMasterCampusFilter, setAssetMasterCampusFilter] = useState<string[]>(["ALL"]);
  const [assetMasterCategoryFilter, setAssetMasterCategoryFilter] = useState<string[]>(["ALL"]);
  const [assetMasterItemFilter, setAssetMasterItemFilter] = useState<string[]>(["ALL"]);
  const [edAssetTemplate, setEdAssetTemplate] = useState<EdAssetTemplate>("ALL");
  const [assetMasterVisibleColumns, setAssetMasterVisibleColumns] = useState<AssetMasterColumnKey[]>([
    "photo",
    "assetId",
    "linkedTo",
    "itemDescription",
    "category",
    "campus",
    "location",
    "purchaseDate",
    "lastServiceDate",
    "status",
  ]);
  const [assetMasterSort, setAssetMasterSort] = useState<{
    key: AssetMasterSortKey;
    direction: "asc" | "desc";
  }>({
    key: "assetId",
    direction: "asc",
  });
  const [qrCampusFilter, setQrCampusFilter] = useState("ALL");
  const [qrLocationFilter, setQrLocationFilter] = useState("ALL");
  const [qrCategoryFilter, setQrCategoryFilter] = useState("ALL");
  const [qrItemFilter, setQrItemFilter] = useState<string[]>(["ALL"]);
  const [quickCountCampusFilter, setQuickCountCampusFilter] = useState<string[]>(["ALL"]);
  const [quickCountCategoryFilter, setQuickCountCategoryFilter] = useState<string[]>(["ALL"]);
  const [quickCountLocationFilter, setQuickCountLocationFilter] = useState<string[]>(["ALL"]);
  const [quickCountStatusFilter, setQuickCountStatusFilter] = useState<string[]>(["ALL"]);
  const [quickCountQuery, setQuickCountQuery] = useState("");
  const [dashboardQuickCountOpen, setDashboardQuickCountOpen] = useState(true);
  const [reportMonth, setReportMonth] = useState(() => toYmd(new Date()).slice(0, 7));
  const [reportDateFrom, setReportDateFrom] = useState(() => `${toYmd(new Date()).slice(0, 7)}-01`);
  const [reportDateTo, setReportDateTo] = useState(() => {
    const now = new Date();
    return toYmd(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  });
  const [reportPeriodMode, setReportPeriodMode] = useState<"month" | "term">("month");
  const [reportYear, setReportYear] = useState(String(new Date().getFullYear()));
  const [reportTerm, setReportTerm] = useState<"Term 1" | "Term 2" | "Term 3">("Term 1");
  const [isPhoneView, setIsPhoneView] = useState(
    () => (typeof window !== "undefined" ? window.innerWidth <= 768 : false)
  );
  const [reportMobileFiltersOpen, setReportMobileFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [inventorySupplyMonth, setInventorySupplyMonth] = useState(() => toYmd(new Date()).slice(0, 7));
  const todayYmd = toYmd(new Date());
  const calendarPrevLabel = isPhoneView ? "<" : "Prev";
  const calendarNextLabel = isPhoneView ? ">" : "Next";

  useEffect(() => {
    if (maintenanceQuickMode) {
      if (tab !== "inventory") setTab("inventory");
      return;
    }
    if (!navMenuItems.some((item) => item.id === tab)) {
      setTab(navMenuItems[0]?.id || "dashboard");
    }
  }, [maintenanceQuickMode, navMenuItems, tab]);

  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileNotificationOpen(false);
  }, [tab]);
  useEffect(() => {
    if (!mobileMenuOpen && !mobileNotificationOpen) return;
    const handleOutsideTap = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (mobileNavRef.current?.contains(target)) return;
      setMobileMenuOpen(false);
      setMobileNotificationOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideTap);
    document.addEventListener("touchstart", handleOutsideTap);
    return () => {
      document.removeEventListener("mousedown", handleOutsideTap);
      document.removeEventListener("touchstart", handleOutsideTap);
    };
  }, [mobileMenuOpen, mobileNotificationOpen]);
  useEffect(() => {
    if (!isPhoneView) return;
    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      mobileSwipeStartXRef.current = touch.clientX;
      mobileSwipeStartYRef.current = touch.clientY;
    };
    const onTouchEnd = (event: TouchEvent) => {
      const startX = mobileSwipeStartXRef.current;
      const startY = mobileSwipeStartYRef.current;
      if (startX === null || startY === null) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      const deltaX = touch.clientX - startX;
      const deltaY = Math.abs(touch.clientY - startY);
      const startedAtLeftEdge = startX <= 28;
      if (!mobileMenuOpen && startedAtLeftEdge && deltaX > 46 && deltaY < 48) {
        setMobileNotificationOpen(false);
        setMobileMenuOpen(true);
      } else if (mobileMenuOpen && deltaX < -42 && deltaY < 48) {
        setMobileMenuOpen(false);
      }
      mobileSwipeStartXRef.current = null;
      mobileSwipeStartYRef.current = null;
    };
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [isPhoneView, mobileMenuOpen]);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryTxns, setInventoryTxns] = useState<InventoryTxn[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [locations, setLocations] = useState<LocationEntry[]>([]);
  const [users, setUsers] = useState<StaffUser[]>(() => readUserFallback());
  const [campusNames, setCampusNames] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const campus of CAMPUS_LIST) out[campus] = campus;
    return out;
  });
  const [customTypeOptions, setCustomTypeOptions] = useState<
    Record<string, Array<{ itemEn: string; itemKm: string; code: string }>>
  >({});
  const [itemNames, setItemNames] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    for (const [category, items] of Object.entries(TYPE_OPTIONS)) {
      for (const item of items) defaults[`${category}:${item.code}`] = item.itemEn;
    }
    return defaults;
  });
  const [stats, setStats] = useState<DashboardStats>({
    totalAssets: 0,
    itAssets: 0,
    safetyAssets: 0,
    openTickets: 0,
    byCampus: [],
  });
  const [maintenanceNotifications, setMaintenanceNotifications] = useState<MaintenanceNotification[]>([]);
  const [maintenanceNotificationUnread, setMaintenanceNotificationUnread] = useState(0);
  const [browserNotificationPermission, setBrowserNotificationPermission] = useState<NotificationPermission>(
    () => (typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default")
  );

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [assetForm, setAssetForm] = useState({
    campus: CAMPUS_LIST[0],
    category: "IT",
    type: "PC",
    pcType: PC_TYPE_OPTIONS[0].value as string,
    location: "",
    setCode: "",
    parentAssetId: "",
    useExistingSet: false,
    componentRole: "",
    componentRequired: false,
    createSetPack: false,
    assignedTo: "",
    brand: "",
    model: "",
    serialNumber: "",
    specs: "",
    purchaseDate: "",
    warrantyUntil: "",
    vendor: "",
    notes: "",
    nextMaintenanceDate: "",
    scheduleNote: "",
    photo: "",
    photos: [] as string[],
    status: "Active",
  });
  const [setPackDraft, setSetPackDraft] = useState<Record<SetPackChildType, SetPackChildDraft>>(
    () => defaultSetPackDraft()
  );
  const [setPackFileKey, setSetPackFileKey] = useState<Record<SetPackChildType, number>>({
    MON: 0,
    MON2: 0,
    KBD: 0,
    MSE: 0,
    UWF: 0,
    WBC: 0,
  });
  const setPackPhotoInputRefs = useRef<Record<SetPackChildType, HTMLInputElement | null>>({
    MON: null,
    MON2: null,
    KBD: null,
    MSE: null,
    UWF: null,
    WBC: null,
  });
  const [setPackDetailOpen, setSetPackDetailOpen] = useState<Record<SetPackChildType, boolean>>({
    MON: false,
    MON2: false,
    KBD: false,
    MSE: false,
    UWF: false,
    WBC: false,
  });
  const [editSetPackEnabled, setEditSetPackEnabled] = useState<Record<SetPackChildType, boolean>>({
    MON: false,
    MON2: false,
    KBD: false,
    MSE: false,
    UWF: false,
    WBC: false,
  });
  const [editCreateSetPack, setEditCreateSetPack] = useState(false);
  const [assetFileKey, setAssetFileKey] = useState(0);
  const createPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [modelTemplateNote, setModelTemplateNote] = useState("");
  const [assetDetailId, setAssetDetailId] = useState<number | null>(null);
  const [pendingQrAssetId] = useState(() => {
    if (typeof window === "undefined") return "";
    return (
      new URLSearchParams(window.location.search).get("assetId") ||
      new URLSearchParams(window.location.search).get("asset") ||
      ""
    )
      .trim()
      .toUpperCase();
  });
  const [qrCodeMap, setQrCodeMap] = useState<Record<string, string>>({});
  const [publicQrAsset, setPublicQrAsset] = useState<PublicQrAsset | null>(null);
  const [publicQrBusy, setPublicQrBusy] = useState(false);
  const [publicQrError, setPublicQrError] = useState("");
  const [publicQrLogin, setPublicQrLogin] = useState({ username: "", password: "" });
  const [publicQrRecordBusy, setPublicQrRecordBusy] = useState(false);
  const [publicQrRecordError, setPublicQrRecordError] = useState("");
  const [publicQrRecordMessage, setPublicQrRecordMessage] = useState("");
  const [publicQrRecordFileKey, setPublicQrRecordFileKey] = useState(0);
  const [publicQrRecordForm, setPublicQrRecordForm] = useState({
    date: toYmd(new Date()),
    type: "Preventive",
    completion: "Done" as "Done" | "Not Yet",
    condition: "",
    note: "",
    cost: "",
    by: "",
    photo: "",
  });
  const [editingAssetId, setEditingAssetId] = useState<number | null>(null);
  const [editAssetFileKey, setEditAssetFileKey] = useState(0);
  const [assetEditForm, setAssetEditForm] = useState({
    location: "",
    pcType: "",
    setCode: "",
    parentAssetId: "",
    useExistingSet: false,
    componentRole: "",
    componentRequired: false,
    assignedTo: "",
    brand: "",
    model: "",
    serialNumber: "",
    specs: "",
    purchaseDate: "",
    warrantyUntil: "",
    vendor: "",
    notes: "",
    photo: "",
    photos: [] as string[],
    status: "Active",
  });
  const editPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [historyAssetId, setHistoryAssetId] = useState<number | null>(null);
  const [quickRecordAssetId, setQuickRecordAssetId] = useState<number | null>(null);
  const [transferQuickAssetId, setTransferQuickAssetId] = useState<number | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<PendingStatusChange | null>(null);
  const [maintenanceRecordFileKey, setMaintenanceRecordFileKey] = useState(0);
  const [maintenanceRecordForm, setMaintenanceRecordForm] = useState({
    assetId: "",
    date: "",
    type: "Preventive",
    completion: "Done" as "Done" | "Not Yet",
    condition: "",
    note: "",
    cost: "",
    by: "",
    photo: "",
  });
  const [verificationRecordForm, setVerificationRecordForm] = useState({
    assetId: "",
    date: toYmd(new Date()),
    result: "Verified" as VerificationEntry["result"],
    condition: "",
    note: "",
    by: "",
    photo: "",
    nextVerificationDate: "",
    verificationFrequency: "NONE" as "NONE" | "MONTHLY" | "TERMLY",
  });
  const [verificationRecordFileKey, setVerificationRecordFileKey] = useState(0);
  const [verificationEditingRowId, setVerificationEditingRowId] = useState<string | null>(null);
  const [verificationEditForm, setVerificationEditForm] = useState({
    date: "",
    result: "Verified" as VerificationEntry["result"],
    condition: "",
    note: "",
    by: "",
    photo: "",
  });
  const [verificationEditFileKey, setVerificationEditFileKey] = useState(0);
  const [maintenanceDetailAssetId, setMaintenanceDetailAssetId] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [maintenanceEditingEntryId, setMaintenanceEditingEntryId] = useState<number | null>(null);
  const [maintenanceEditFileKey, setMaintenanceEditFileKey] = useState(0);
  const [maintenanceEditForm, setMaintenanceEditForm] = useState({
    date: "",
    type: "Preventive",
    completion: "Done" as "Done" | "Not Yet",
    condition: "",
    note: "",
    cost: "",
    by: "",
    photo: "",
  });
  const [transferForm, setTransferForm] = useState({
    assetId: "",
    date: toYmd(new Date()),
    toCampus: CAMPUS_LIST[0],
    toLocation: "",
    toAssignedTo: "",
    responsibilityConfirmed: false,
    returnConfirmed: false,
    reason: "",
    by: "",
    note: "",
  });
  const [showTransferAssetPicker, setShowTransferAssetPicker] = useState(false);
  const [transferFilterCampus, setTransferFilterCampus] = useState("ALL");
  const [transferFilterLocation, setTransferFilterLocation] = useState("ALL");
  const [transferFilterCategory, setTransferFilterCategory] = useState("ALL");
  const [transferFilterName, setTransferFilterName] = useState("ALL");

  const [ticketForm, setTicketForm] = useState({
    campus: CAMPUS_LIST[0],
    category: "IT",
    assetId: "",
    title: "",
    description: "",
    requestedBy: "",
    priority: "Normal",
    status: "Open",
  });

  const [locationCampus, setLocationCampus] = useState(CAMPUS_LIST[0]);
  const [locationName, setLocationName] = useState("");
  const [editingLocationId, setEditingLocationId] = useState<number | null>(null);
  const [campusEditCode, setCampusEditCode] = useState("C1");
  const [campusEditName, setCampusEditName] = useState("Samdach Pan Campus");
  const [campusDraftNames, setCampusDraftNames] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const campus of CAMPUS_LIST) out[campus] = campus;
    return out;
  });
  const [setupMessage, setSetupMessage] = useState("");
  const defaultCalendarEvents = useMemo(() => buildDefaultCalendarEvents(), []);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(() =>
    readCalendarEventFallback(buildDefaultCalendarEvents())
  );
  const [calendarEventForm, setCalendarEventForm] = useState({
    date: "",
    name: "",
    type: "public" as CalendarEventType,
  });
  const [editingCalendarEventId, setEditingCalendarEventId] = useState<number | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [backupImportKey, setBackupImportKey] = useState(0);
  const [userForm, setUserForm] = useState({
    fullName: "",
    position: "",
    email: "",
  });
  const [newItemTypeForm, setNewItemTypeForm] = useState({
    category: "IT",
    code: "",
    name: "",
  });
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [authAccounts, setAuthAccounts] = useState<AuthAccount[]>([]);
  const [authCreateForm, setAuthCreateForm] = useState({
    staffId: "",
    username: "",
    password: "",
    displayName: "",
    role: "Viewer" as AuthRole,
    campuses: [CAMPUS_LIST[0]] as string[],
    modules: [...DEFAULT_VIEWER_MODULES] as NavModule[],
    assetSubviewAccess: "both" as AssetSubviewAccess,
    menuAccess: defaultMenuAccessFor("Viewer", DEFAULT_VIEWER_MODULES, "both"),
  });
  const [editingAuthUserId, setEditingAuthUserId] = useState<number | null>(null);
  const [scheduleAlertModal, setScheduleAlertModal] = useState<null | "overdue" | "upcoming" | "scheduled" | "selected">(null);
  const [scheduleAlertItemFilter, setScheduleAlertItemFilter] = useState("ALL");
  const [maintenanceReminderOffsets, setMaintenanceReminderOffsets] = useState<number[]>(
    () => [...DEFAULT_MAINTENANCE_REMINDER_OFFSETS]
  );
  const [savingMaintenanceReminder, setSavingMaintenanceReminder] = useState(false);
  const [overviewModal, setOverviewModal] = useState<null | "total" | "it" | "safety" | "tickets">(null);
  const [maintenanceDashboardModal, setMaintenanceDashboardModal] = useState<null | "overdue" | "upcoming" | "scheduled" | "done">(null);
  const [latestMaintenanceDetailRowId, setLatestMaintenanceDetailRowId] = useState<string | null>(null);
  const [quickCountModal, setQuickCountModal] = useState<null | { title: string; assets: Asset[] }>(null);
  const [updateNotesOpen, setUpdateNotesOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    assetId: "",
    date: "",
    note: "",
    repeatMode: "NONE" as "NONE" | "MONTHLY_WEEKDAY",
    repeatWeekOfMonth: 1,
    repeatWeekday: 6,
  });
  const [scheduleQuickCreateOpen, setScheduleQuickCreateOpen] = useState(false);
  const [scheduleQuickForm, setScheduleQuickForm] = useState({
    assetId: "",
    date: toYmd(new Date()),
    note: "",
    repeatMode: "NONE" as "NONE" | "MONTHLY_WEEKDAY",
    repeatWeekOfMonth: 1,
    repeatWeekday: 6,
  });
  const [scheduleQuickFilterCampus, setScheduleQuickFilterCampus] = useState("ALL");
  const [scheduleQuickFilterLocation, setScheduleQuickFilterLocation] = useState("ALL");
  const [scheduleQuickFilterCategory, setScheduleQuickFilterCategory] = useState("ALL");
  const [scheduleQuickFilterName, setScheduleQuickFilterName] = useState("ALL");
  const [bulkScheduleForm, setBulkScheduleForm] = useState({
    campus: "ALL",
    category: "SAFETY",
    type: "FE",
    date: "",
    note: "",
    repeatMode: "NONE" as "NONE" | "MONTHLY_WEEKDAY",
    repeatWeekOfMonth: 1,
    repeatWeekday: 6,
  });
  const [scheduleScopeModal, setScheduleScopeModal] = useState<null | {
    action: "edit" | "delete";
    assetId: number;
  }>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => toYmd(new Date()));
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryItemForm, setInventoryItemForm] = useState({
    campus: CAMPUS_LIST[0],
    category: "SUPPLY" as "SUPPLY" | "CLEAN_TOOL" | "MAINT_TOOL",
    masterItemKey: "",
    itemCode: "",
    itemName: "",
    unit: "pcs",
    openingQty: "",
    minStock: "",
    location: "",
    vendor: "",
    notes: "",
    photo: "",
  });
  const [inventoryCodeManual, setInventoryCodeManual] = useState(false);
  const [inventoryItemFileKey, setInventoryItemFileKey] = useState(0);
  const [inventoryTxnForm, setInventoryTxnForm] = useState({
    itemId: "",
    date: toYmd(new Date()),
    type: "IN" as InventoryTxn["type"],
    qty: "",
    by: "",
    note: "",
    fromCampus: "",
    toCampus: "",
    expectedReturnDate: "",
    requestedBy: "",
    approvedBy: "",
    receivedBy: "",
  });
  const [inventoryDailyForm, setInventoryDailyForm] = useState({
    itemId: "",
    date: toYmd(new Date()),
    type: "OUT" as "IN" | "OUT",
    qty: "",
    by: "",
    note: "",
    search: "",
  });
  const [inventoryQuickOutModal, setInventoryQuickOutModal] = useState<null | {
    itemId: string;
    date: string;
    qty: string;
    by: string;
    note: string;
    photo: string;
  }>(null);
  const [inventoryQuickOutFileKey, setInventoryQuickOutFileKey] = useState(0);
  const [inventoryQuickReasonTipsOpen, setInventoryQuickReasonTipsOpen] = useState(false);
  const [quickOutEcoPickerOpen, setQuickOutEcoPickerOpen] = useState(false);
  const [quickOutEcoMonth, setQuickOutEcoMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [quickOutEcoSelectedDate, setQuickOutEcoSelectedDate] = useState(() => toYmd(new Date()));
  const [editingInventoryTxnId, setEditingInventoryTxnId] = useState<number | null>(null);
  const [inventoryTxnEditForm, setInventoryTxnEditForm] = useState({
    itemId: "",
    date: toYmd(new Date()),
    type: "IN" as InventoryTxn["type"],
    qty: "",
    by: "",
    note: "",
  });

  useEffect(() => {
    trySetLocalStorage("ui_lang", lang);
  }, [lang]);

  useEffect(() => {
    if (rememberLogin) {
      trySetLocalStorage(LOGIN_REMEMBER_KEY, "1");
      trySetLocalStorage(LOGIN_REMEMBER_USERNAME_KEY, loginForm.username.trim());
      return;
    }
    localStorage.removeItem(LOGIN_REMEMBER_KEY);
    localStorage.removeItem(LOGIN_REMEMBER_USERNAME_KEY);
  }, [rememberLogin, loginForm.username]);

  useEffect(() => {
    const onResize = () => {
      setIsPhoneView(window.innerWidth <= 768);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!isPhoneView) setReportMobileFiltersOpen(false);
  }, [isPhoneView]);
  useEffect(() => {
    if (!maintenanceQuickMode) return;
    setTab("inventory");
    setInventoryView("daily");
    setInventoryDailyForm((prev) => ({ ...prev, type: "OUT" }));
  }, [maintenanceQuickMode]);

  useEffect(() => {
    if (authUser) {
      trySetLocalStorage(AUTH_USER_KEY, JSON.stringify(authUser));
    } else {
      localStorage.removeItem(AUTH_USER_KEY);
    }
  }, [authUser]);

  useEffect(() => {
    const actor = authUser?.displayName || authUser?.username || "";
    if (!actor) return;
    setInventoryTxnForm((prev) => (prev.by.trim() ? prev : { ...prev, by: actor }));
    setInventoryDailyForm((prev) => (prev.by.trim() ? prev : { ...prev, by: actor }));
  }, [authUser?.displayName, authUser?.username]);

  useEffect(() => {
    if (!SERVER_ONLY_STORAGE) return;
    clearAllFallbackCaches();
  }, []);

  useEffect(() => {
    let mounted = true;
    async function initAuth() {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) {
        if (mounted) setAuthLoading(false);
        return;
      }
      const cachedUserRaw = localStorage.getItem(AUTH_USER_KEY);
      let cachedUser: AuthUser | null = null;
      if (cachedUserRaw) {
        try {
          cachedUser = JSON.parse(cachedUserRaw) as AuthUser;
        } catch {
          cachedUser = null;
        }
      }
      if (mounted && cachedUser) {
        setAuthUser(cachedUser);
      }
      runtimeAuthToken = token;
      if (ALLOW_LOCAL_AUTH_BYPASS && token === LOCAL_ADMIN_TOKEN) {
        const perm = readAuthPermissionFallback().admin || {
          role: "Super Admin" as const,
          campuses: ["ALL"],
          modules: [...ALL_NAV_MODULES],
          assetSubviewAccess: "both" as AssetSubviewAccess,
          menuAccess: defaultMenuAccessFor("Super Admin", ALL_NAV_MODULES, "both"),
        };
        if (mounted) {
          setAuthUser({
            id: 1,
            username: "admin",
            displayName: "Eco Admin",
            role: normalizeRole(perm.role),
            campuses: normalizeRoleCampuses(normalizeRole(perm.role), perm.campuses),
            modules: normalizeModulesByRole(normalizeRole(perm.role), perm.modules),
            assetSubviewAccess: perm.assetSubviewAccess,
            menuAccess: normalizeMenuAccess(
              normalizeRole(perm.role),
              normalizeModulesByRole(normalizeRole(perm.role), perm.modules),
              normalizeAssetSubviewAccess(perm.assetSubviewAccess),
              perm.menuAccess
            ),
          });
          setAuthLoading(false);
        }
        return;
      }
      if (ALLOW_LOCAL_AUTH_BYPASS && token === LOCAL_VIEWER_TOKEN) {
        const perm = readAuthPermissionFallback().viewer || {
          role: "Viewer" as const,
          campuses: ["Chaktomuk Campus (C2.2)"],
          modules: [...DEFAULT_VIEWER_MODULES],
          assetSubviewAccess: "list_only" as AssetSubviewAccess,
          menuAccess: defaultMenuAccessFor("Viewer", DEFAULT_VIEWER_MODULES, "list_only"),
        };
        if (mounted) {
          setAuthUser({
            id: 2,
            username: "viewer",
            displayName: "Eco Viewer",
            role: normalizeRole(perm.role),
            campuses: normalizeRoleCampuses(normalizeRole(perm.role), perm.campuses),
            modules: normalizeModulesByRole(normalizeRole(perm.role), perm.modules),
            assetSubviewAccess: normalizeAssetSubviewAccess(perm.assetSubviewAccess),
            menuAccess: normalizeMenuAccess(
              normalizeRole(perm.role),
              normalizeModulesByRole(normalizeRole(perm.role), perm.modules),
              normalizeAssetSubviewAccess(perm.assetSubviewAccess),
              perm.menuAccess
            ),
          });
          setAuthLoading(false);
        }
        return;
      }
      try {
        const res = await requestJson<{ user: AuthUser }>("/api/auth/me");
        if (res.user) {
          trySetLocalStorage(AUTH_USER_KEY, JSON.stringify(res.user));
        }
        if (mounted) setAuthUser(res.user || null);
      } catch (err) {
        // Only clear auth on real unauthorized response.
        if (isUnauthorizedError(err)) {
          runtimeAuthToken = "";
          localStorage.removeItem(AUTH_TOKEN_KEY);
          localStorage.removeItem(AUTH_USER_KEY);
          if (mounted) setAuthUser(null);
        } else if (mounted && cachedUser) {
          // Keep prior login state on temporary API/network issues.
          setAuthUser(cachedUser);
        }
      } finally {
        if (mounted) setAuthLoading(false);
      }
    }
    void initAuth();
    return () => {
      mounted = false;
    };
  }, []);

  const allowedCampuses = useMemo(() => {
    if (!authUser) return CAMPUS_LIST;
    if (hasGlobalCampusAccess(authUser.role, authUser.campuses)) return CAMPUS_LIST;
    const campuses = Array.isArray(authUser.campuses) ? authUser.campuses : [];
    if (!campuses.length) return CAMPUS_LIST;
    return CAMPUS_LIST.filter((c) => campuses.includes(c));
  }, [authUser]);

  useEffect(() => {
    if (!authUser || hasGlobalCampusAccess(authUser.role, authUser.campuses)) return;
    if (campusFilter === "ALL") {
      if (allowedCampuses.length) setCampusFilter(allowedCampuses[0]);
      return;
    }
    if (!allowedCampuses.includes(campusFilter)) {
      setCampusFilter(allowedCampuses[0] || "ALL");
    }
  }, [authUser, campusFilter, allowedCampuses]);

  useEffect(() => {
    if (!authUser || hasGlobalCampusAccess(authUser.role, authUser.campuses)) return;
    if (assetCampusFilter === "ALL") return;
    if (!allowedCampuses.includes(assetCampusFilter)) {
      setAssetCampusFilter("ALL");
    }
  }, [authUser, assetCampusFilter, allowedCampuses]);

  useEffect(() => {
    if (editingAuthUserId === null) return;
    if (!authAccounts.some((u) => u.id === editingAuthUserId)) {
      resetAuthCreateForm();
    }
  }, [authAccounts, editingAuthUserId]);

  function requireAdminAction() {
    if (isAdmin) return true;
    setError("Admin role required for this action.");
    setSetupMessage("Admin role required for this action.");
    return false;
  }

  useEffect(() => {
    writeUserFallback(users);
  }, [users]);

  useEffect(() => {
    writeStringMap(CAMPUS_NAME_FALLBACK_KEY, campusNames);
  }, [campusNames]);

  useEffect(() => {
    writeStringMap(ITEM_NAME_FALLBACK_KEY, itemNames);
  }, [itemNames]);

  useEffect(() => {
    writeItemTypeFallback(customTypeOptions);
  }, [customTypeOptions]);
  useEffect(() => {
    writeInventoryItemFallback(inventoryItems);
  }, [inventoryItems]);
  useEffect(() => {
    writeInventoryTxnFallback(inventoryTxns);
  }, [inventoryTxns]);

  const allTypeOptions = useMemo(() => {
    const out: Record<string, Array<{ itemEn: string; itemKm: string; code: string }>> = {};
    for (const category of Object.keys(TYPE_OPTIONS)) {
      const base = TYPE_OPTIONS[category] || [];
      const custom = customTypeOptions[category] || [];
      const map = new Map<string, { itemEn: string; itemKm: string; code: string }>();
      for (const item of [...base, ...custom]) {
        const code = String(item.code || "").trim().toUpperCase();
        if (!code) continue;
        map.set(code, { ...item, code });
      }
      out[category] = Array.from(map.values());
    }
    return out;
  }, [customTypeOptions]);

  const currentTypeOptions = useMemo(
    () => allTypeOptions[assetForm.category] || allTypeOptions.IT || TYPE_OPTIONS.IT,
    [assetForm.category, allTypeOptions]
  );

  const campusLabel = useCallback(
    (campus: string) => {
      const base = campusNames[campus] || campus;
      if (lang !== "km") return base;
      return CAMPUS_KM_LABEL[base] || CAMPUS_KM_LABEL[campus] || base;
    },
    [campusNames, lang]
  );
  const inventoryCampusLabel = useCallback(
    (campus: string) => {
      if (campus === "C2" || campus === "C2.1" || campus === "C2.2") return "C2";
      return inventoryRecordCampusCode(campus) === "C2" ? "C2" : campusLabel(campus);
    },
    [campusLabel]
  );
  const assetStatusLabel = useCallback(
    (statusRaw: string) => {
      const status = String(statusRaw || "").trim();
      if (!status) return "-";
      const option = ASSET_STATUS_OPTIONS.find((item) => item.value.toLowerCase() === status.toLowerCase());
      if (!option) return status;
      return lang === "km" ? option.km : option.en;
    },
    [lang]
  );
  const assetItemName = useCallback(
    (category: string, typeCode: string, pcType = "") => {
      const key = `${category}:${typeCode}`;
      const custom = (itemNames[key] || "").trim();
      const normalizedPcType = pcType.trim();
      if (custom) {
        if (category === "IT" && typeCode === DESKTOP_PARENT_TYPE && normalizedPcType) {
          return `${custom} (${normalizedPcType})`;
        }
        return custom;
      }
      const option = (allTypeOptions[category] || allTypeOptions.IT || TYPE_OPTIONS.IT).find(
        (opt) => opt.code === typeCode
      );
      if (!option) return typeCode;
      const base = lang === "km" ? option.itemKm : option.itemEn;
      if (category === "IT" && typeCode === DESKTOP_PARENT_TYPE && normalizedPcType) {
        return `${base} (${normalizedPcType})`;
      }
      return base;
    },
    [itemNames, lang, allTypeOptions]
  );
  const assetNameFilterOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const asset of assets) {
      const pcPart =
        asset.category === "IT" && asset.type === DESKTOP_PARENT_TYPE
          ? String(asset.pcType || "").trim().toUpperCase()
          : "";
      const key = `${asset.category}:${asset.type}:${pcPart}`;
      if (map.has(key)) continue;
      map.set(key, assetItemName(asset.category, asset.type, asset.pcType || ""));
    }
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [assets, assetItemName]);
  const assetCampusFilterOptions = useMemo(
    () => [...allowedCampuses].sort((a, b) => campusLabel(a).localeCompare(campusLabel(b))),
    [allowedCampuses, campusLabel]
  );
  const assetCategoryFilterOptions = useMemo(
    () => CATEGORY_OPTIONS.map((category) => category.value),
    []
  );
  const assetLocationFilterOptions = useMemo(() => {
    return Array.from(
      new Set(
        assets
          .map((asset) => String(asset.location || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [assets]);
  const applyMultiFilterSelection = useCallback(
    (
      prev: string[],
      checked: boolean,
      value: string,
      allOptions: string[]
    ) => {
      if (value === "ALL") {
        return checked ? ["ALL"] : [];
      }
      if (checked) {
        const base = prev.includes("ALL") ? [] : prev.filter((item) => item !== "ALL");
        const next = Array.from(new Set([...base, value]));
        return next.length >= allOptions.length ? ["ALL"] : next;
      }
      if (prev.includes("ALL")) {
        const next = allOptions.filter((item) => item !== value);
        return next;
      }
      const next = prev.filter((item) => item !== value);
      return next;
    },
    []
  );
  const summarizeMultiFilter = useCallback(
    (selected: string[], allLabel: string, resolveLabel?: (value: string) => string) => {
      if (selected.includes("ALL")) return allLabel;
      if (selected.length === 1) return resolveLabel ? resolveLabel(selected[0]) : selected[0];
      return `${selected.length} selected`;
    },
    []
  );
  const resetAssetListFilters = useCallback(() => {
    setAssetCampusMultiFilter(["ALL"]);
    setAssetCategoryMultiFilter(["ALL"]);
    setAssetNameMultiFilter(["ALL"]);
    setAssetLocationMultiFilter(["ALL"]);
    setSearch("");
  }, []);
  const toggleCampusAccess = useCallback((current: string[], campus: string, checked: boolean) => {
    if (checked) return Array.from(new Set([...current, campus]));
    const next = current.filter((value) => value !== campus);
    return next.length ? next : [campus];
  }, []);

  const campusLocations = useMemo(
    () => sortLocationEntriesByName(locations.filter((l) => l.campus === assetForm.campus)),
    [locations, assetForm.campus]
  );
  const parentAssetsForCreate = useMemo(
    () =>
      assets
        .filter((a) => a.campus === assetForm.campus)
        .sort((a, b) => a.assetId.localeCompare(b.assetId)),
    [assets, assetForm.campus]
  );
  const suggestedDesktopSetCode = useMemo(() => {
    const campusCodeValue = CAMPUS_CODE[assetForm.campus] || "CX";
    const prefix = `SET-${campusCodeValue}-`;
    let max = 0;
    for (const asset of assets) {
      if (asset.campus !== assetForm.campus) continue;
      const raw = String(asset.setCode || "");
      if (!raw.startsWith(prefix)) continue;
      const n = Number(raw.slice(prefix.length));
      if (Number.isFinite(n)) max = Math.max(max, n);
    }
    return `${prefix}${String(max + 1).padStart(3, "0")}`;
  }, [assets, assetForm.campus]);
  const suggestedAssetId = useMemo(() => {
    const type = assetForm.type.toUpperCase();
    const seq = calcNextSeq(assets, assetForm.campus, assetForm.category, type);
    return `${CAMPUS_CODE[assetForm.campus] || "CX"}-${categoryCode(assetForm.category)}-${type}-${pad4(seq)}`;
  }, [assets, assetForm.campus, assetForm.category, assetForm.type]);
  const setPackSuggestedAssetId = useMemo<Record<SetPackChildType, string>>(() => {
    const campusCode = CAMPUS_CODE[assetForm.campus] || "CX";
    const baseMon = calcNextSeq(assets, assetForm.campus, "IT", "MON");
    const baseKbd = calcNextSeq(assets, assetForm.campus, "IT", "KBD");
    const baseMse = calcNextSeq(assets, assetForm.campus, "IT", "MSE");
    const baseUwf = calcNextSeq(assets, assetForm.campus, "IT", "UWF");
    const baseWbc = calcNextSeq(assets, assetForm.campus, "IT", "WBC");
    return {
      MON: `${campusCode}-${categoryCode("IT")}-MON-${pad4(baseMon)}`,
      MON2: `${campusCode}-${categoryCode("IT")}-MON-${pad4(baseMon + 1)}`,
      KBD: `${campusCode}-${categoryCode("IT")}-KBD-${pad4(baseKbd)}`,
      MSE: `${campusCode}-${categoryCode("IT")}-MSE-${pad4(baseMse)}`,
      UWF: `${campusCode}-${categoryCode("IT")}-UWF-${pad4(baseUwf)}`,
      WBC: `${campusCode}-${categoryCode("IT")}-WBC-${pad4(baseWbc)}`,
    };
  }, [assets, assetForm.campus]);
  const parentAssetsForEdit = useMemo(() => {
    const editing = assets.find((a) => a.id === editingAssetId);
    if (!editing) return [] as Asset[];
    return assets
      .filter((a) => a.id !== editing.id && a.campus === editing.campus)
      .sort((a, b) => a.assetId.localeCompare(b.assetId));
  }, [assets, editingAssetId]);
  const inventoryLocations = useMemo(
    () => sortLocationEntriesByName(locations.filter((l) => l.campus === inventoryItemForm.campus)),
    [locations, inventoryItemForm.campus]
  );
  const canViewAllInventoryCampuses = useMemo(
    () => !authUser || hasGlobalCampusAccess(authUser.role, authUser.campuses),
    [authUser]
  );
  const inventoryVisibleCampusSet = useMemo(
    () => (canViewAllInventoryCampuses ? null : new Set(allowedCampuses)),
    [canViewAllInventoryCampuses, allowedCampuses]
  );
  const inventoryVisibleItems = useMemo(
    () =>
      inventoryVisibleCampusSet
        ? inventoryItems.filter((item) => inventoryVisibleCampusSet.has(item.campus))
        : inventoryItems,
    [inventoryItems, inventoryVisibleCampusSet]
  );
  const inventoryVisibleItemIds = useMemo(
    () => new Set(inventoryVisibleItems.map((item) => item.id)),
    [inventoryVisibleItems]
  );
  const inventoryVisibleTxns = useMemo(
    () =>
      inventoryVisibleCampusSet
        ? inventoryTxns.filter(
            (tx) => inventoryVisibleCampusSet.has(tx.campus) || inventoryVisibleItemIds.has(Number(tx.itemId || 0))
          )
        : inventoryTxns,
    [inventoryTxns, inventoryVisibleCampusSet, inventoryVisibleItemIds]
  );
  const inventoryItemLabel = useCallback((item: InventoryItem) => {
    return `${item.itemCode} - ${item.itemName} • ${inventoryCampusLabel(item.campus)}`;
  }, [inventoryCampusLabel]);
  const usedInventoryMasterKeysForCampus = useMemo(() => {
    const out = new Set<string>();
    if (inventoryItemForm.category !== "SUPPLY") return out;
    const masters = INVENTORY_MASTER_ITEMS.filter((item) => item.category === inventoryItemForm.category);
    for (const row of inventoryItems) {
      if (row.campus !== inventoryItemForm.campus || row.category !== inventoryItemForm.category) continue;
      for (const master of masters) {
        if (inventoryItemMatchesMaster(row, master)) out.add(master.key);
      }
    }
    return out;
  }, [inventoryItemForm.category, inventoryItemForm.campus, inventoryItems]);
  const inventoryMasterOptions = useMemo(
    () =>
      INVENTORY_MASTER_ITEMS
        .filter((item) => item.category === inventoryItemForm.category)
        .filter((item) => !(inventoryItemForm.category === "SUPPLY" && usedInventoryMasterKeysForCampus.has(item.key))),
    [inventoryItemForm.category, usedInventoryMasterKeysForCampus]
  );
  const inventorySupplyMasterLocked = useMemo(
    () => inventoryItemForm.category === "SUPPLY" && inventoryMasterOptions.length === 0,
    [inventoryItemForm.category, inventoryMasterOptions.length]
  );
  const selectedInventoryMaster = useMemo(
    () => inventoryMasterOptions.find((item) => item.key === inventoryItemForm.masterItemKey) || null,
    [inventoryMasterOptions, inventoryItemForm.masterItemKey]
  );
  const inventoryTxnSelectedItem = useMemo(
    () => inventoryVisibleItems.find((item) => String(item.id) === String(inventoryTxnForm.itemId || "")) || null,
    [inventoryVisibleItems, inventoryTxnForm.itemId]
  );
  const inventoryTxnIsBorrow = useMemo(
    () => inventoryTxnForm.type === "BORROW_OUT" || inventoryTxnForm.type === "BORROW_IN" || inventoryTxnForm.type === "BORROW_CONSUME",
    [inventoryTxnForm.type]
  );
  const autoInventoryItemCode = useMemo(
    () => buildInventoryItemCode(inventoryItems, inventoryItemForm.campus, inventoryItemForm.category),
    [inventoryItems, inventoryItemForm.campus, inventoryItemForm.category]
  );
  const inventoryBalanceRows = useMemo(() => {
    const byItem = new Map<number, { in: number; out: number }>();
    for (const tx of inventoryVisibleTxns) {
      const current = byItem.get(tx.itemId) || { in: 0, out: 0 };
      if (isInventoryTxnIn(tx.type)) current.in += tx.qty;
      if (isInventoryTxnOut(tx.type)) current.out += tx.qty;
      byItem.set(tx.itemId, current);
    }
    let rows = inventoryVisibleItems.map((item) => {
      const total = byItem.get(item.id) || { in: 0, out: 0 };
      const currentStock = Number(item.openingQty || 0) + total.in - total.out;
      return {
        ...item,
        stockIn: total.in,
        stockOut: total.out,
        currentStock,
        lowStock: currentStock <= Number(item.minStock || 0),
      };
    });
    const q = inventorySearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) =>
        `${r.itemCode} ${r.itemName} ${inventoryAliasText(r.itemName)} ${r.location} ${r.vendor || ""}`.toLowerCase().includes(q)
      );
    }
    return rows.sort((a, b) => a.itemCode.localeCompare(b.itemCode));
  }, [inventoryVisibleItems, inventoryVisibleTxns, inventorySearch]);
  const inventoryLowStockRows = useMemo(
    () => inventoryBalanceRows.filter((r) => r.lowStock),
    [inventoryBalanceRows]
  );
  const inventoryBalanceDisplayRows = useMemo(
    () => (inventoryBalanceMode === "low" ? inventoryLowStockRows : inventoryBalanceRows),
    [inventoryBalanceMode, inventoryLowStockRows, inventoryBalanceRows]
  );
  const cleaningSupplyMonthlyOptions = useMemo(() => {
    const validMonths = new Set<string>();
    const supplyItems = new Map<number, InventoryItem>();
    for (const item of inventoryVisibleItems) {
      if (isCleaningSupplyItem(item)) supplyItems.set(item.id, item);
    }
    for (const tx of inventoryVisibleTxns) {
      if (!isInventoryTxnUsageOut(tx.type)) continue;
      if (!supplyItems.has(tx.itemId)) continue;
      const month = String(tx.date || "").slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(month)) validMonths.add(month);
    }
    validMonths.add(toYmd(new Date()).slice(0, 7));
    return Array.from(validMonths).sort((a, b) => b.localeCompare(a));
  }, [inventoryVisibleItems, inventoryVisibleTxns]);
  const cleaningSupplyMonthlyCampusRows = useMemo(() => {
    const month = inventorySupplyMonth;
    const supplyItems = new Map<number, InventoryItem>();
    for (const item of inventoryVisibleItems) {
      if (isCleaningSupplyItem(item)) supplyItems.set(item.id, item);
    }
    const campusTotals = new Map<string, number>();
    for (const tx of inventoryVisibleTxns) {
      if (!isInventoryTxnUsageOut(tx.type)) continue;
      if (!supplyItems.has(tx.itemId)) continue;
      if (String(tx.date || "").slice(0, 7) !== month) continue;
      const groupCampus = inventoryRecordCampusCode(tx.campus) === "C2" ? "C2" : tx.campus;
      const current = campusTotals.get(groupCampus) || 0;
      campusTotals.set(groupCampus, current + Number(tx.qty || 0));
    }
    const rows = Array.from(campusTotals.entries())
      .map(([campus, qty]) => ({ campus, qty }))
      .sort((a, b) => b.qty - a.qty);
    const max = rows.reduce((m, row) => Math.max(m, row.qty), 0);
    return { rows, max: max > 0 ? max : 1 };
  }, [inventorySupplyMonth, inventoryVisibleItems, inventoryVisibleTxns]);
  useEffect(() => {
    if (!cleaningSupplyMonthlyOptions.length) return;
    if (!cleaningSupplyMonthlyOptions.includes(inventorySupplyMonth)) {
      setInventorySupplyMonth(cleaningSupplyMonthlyOptions[0]);
    }
  }, [cleaningSupplyMonthlyOptions, inventorySupplyMonth]);
  const inventoryTxnsRows = useMemo(() => {
    return [...inventoryVisibleTxns]
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
      .filter((row) => {
        const q = inventorySearch.trim().toLowerCase();
        if (!q) return true;
        return `${row.itemCode} ${row.itemName} ${inventoryAliasText(row.itemName)} ${row.by || ""} ${row.note || ""}`.toLowerCase().includes(q);
      });
  }, [inventoryVisibleTxns, inventorySearch]);
  const inventoryStockMap = useMemo(() => {
    const totals = new Map<number, { in: number; out: number }>();
    for (const tx of inventoryVisibleTxns) {
      const cur = totals.get(tx.itemId) || { in: 0, out: 0 };
      if (isInventoryTxnIn(tx.type)) cur.in += tx.qty;
      if (isInventoryTxnOut(tx.type)) cur.out += tx.qty;
      totals.set(tx.itemId, cur);
    }
    const out = new Map<number, number>();
    for (const item of inventoryVisibleItems) {
      const total = totals.get(item.id) || { in: 0, out: 0 };
      out.set(item.id, Number(item.openingQty || 0) + total.in - total.out);
    }
    return out;
  }, [inventoryVisibleItems, inventoryVisibleTxns]);
  const inventoryDailyItemOptions = useMemo(() => {
    const q = String(inventoryDailyForm.search || "").trim().toLowerCase();
    let list = [...inventoryVisibleItems];
    if (q) {
      list = list.filter((item) =>
        `${item.itemCode} ${item.itemName} ${inventoryAliasText(item.itemName)} ${item.location} ${item.vendor || ""}`.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => a.itemCode.localeCompare(b.itemCode));
  }, [inventoryVisibleItems, inventoryDailyForm.search]);
  const inventoryDailyOutGalleryItems = useMemo(
    () => inventoryDailyItemOptions.filter((item) => isCleaningSupplyItem(item)),
    [inventoryDailyItemOptions]
  );
  const inventoryDailySelectedItem = useMemo(
    () => inventoryVisibleItems.find((item) => String(item.id) === String(inventoryDailyForm.itemId || "")) || null,
    [inventoryVisibleItems, inventoryDailyForm.itemId]
  );
  const inventoryQuickOutSelectedItem = useMemo(
    () =>
      inventoryQuickOutModal
        ? inventoryVisibleItems.find((item) => String(item.id) === String(inventoryQuickOutModal.itemId)) || null
        : null,
    [inventoryVisibleItems, inventoryQuickOutModal]
  );
  const inventoryQuickOutReasonSuggestions = useMemo(() => {
    if (!inventoryQuickOutSelectedItem) return [] as string[];
    const set = new Set<string>();
    for (const tx of inventoryVisibleTxns) {
      if (tx.type !== "OUT" || tx.itemId !== inventoryQuickOutSelectedItem.id) continue;
      const note = String(tx.note || "").trim();
      if (!note) continue;
      set.add(note);
      if (set.size >= 6) break;
    }
    return Array.from(set);
  }, [inventoryVisibleTxns, inventoryQuickOutSelectedItem]);
  const holidayLookup = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of calendarEvents) {
      const date = String(event.date || "").trim();
      if (!date) continue;
      if (!map.has(date)) map.set(date, []);
      map.get(date)?.push(event);
    }
    return map;
  }, [calendarEvents]);
  const getHolidayEvent = useCallback((ymd: string): { name: string; type: CalendarEventType | "" } => {
    const date = String(ymd || "").trim();
    if (!date) return { name: "", type: "" };
    const matches = holidayLookup.get(date) || [];
    if (!matches.length) return { name: "", type: "" };
    const names = Array.from(new Set(matches.map((row) => String(row.name || "").trim()).filter(Boolean)));
    const name = names.join(" | ");
    const type = matches[0]?.type || classifyHolidayEvent(names[0] || "");
    return { name, type: normalizeCalendarEventType(type) };
  }, [holidayLookup]);
  const getHolidayName = useCallback((ymd: string) => getHolidayEvent(ymd).name, [getHolidayEvent]);
  const quickOutDateBadge = useMemo(() => {
    if (!inventoryQuickOutModal?.date) return "";
    const ymd = normalizeYmdInput(inventoryQuickOutModal.date);
    if (!ymd) return "";
    const holiday = getHolidayEvent(ymd);
    if (holiday.name) return `Eco Holiday: ${holiday.name}`;
    const day = new Date(`${ymd}T00:00:00`).getDay();
    if (day === 0 || day === 6) return "Weekend";
    return "";
  }, [inventoryQuickOutModal?.date, getHolidayEvent]);
  const quickOutEcoGridDays = useMemo(() => {
    const year = quickOutEcoMonth.getFullYear();
    const month = quickOutEcoMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const endOffset = 6 - lastDay.getDay();
    const totalCells = startOffset + lastDay.getDate() + endOffset;
    const startDate = new Date(year, month, 1 - startOffset);
    return Array.from({ length: totalCells }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const ymd = toYmd(d);
      const holiday = getHolidayEvent(ymd);
      return {
        ymd,
        day: d.getDate(),
        weekday: d.getDay(),
        inMonth: d.getMonth() === month,
        holidayName: holiday.name,
        holidayType: holiday.type,
      };
    });
  }, [quickOutEcoMonth, getHolidayEvent]);
  const inventoryDailyTodayRows = useMemo(() => {
    const date = inventoryDailyForm.date;
    return [...inventoryVisibleTxns]
      .filter((tx) => tx.date === date)
      .sort((a, b) => b.id - a.id)
      .slice(0, 12);
  }, [inventoryVisibleTxns, inventoryDailyForm.date]);
  const inventoryDailyUsageTrend = useMemo(() => {
    const endYmd = normalizeYmdInput(inventoryDailyForm.date) || toYmd(new Date());
    const selectedItemId = Number(inventoryDailyForm.itemId || 0);
    const itemLookup = new Map<number, InventoryItem>();
    for (const item of inventoryVisibleItems) itemLookup.set(item.id, item);
    const rows: Array<{
      ymd: string;
      qty: number;
      isWeekend: boolean;
      holidayName: string;
    }> = [];
    for (let i = 13; i >= 0; i -= 1) {
      const ymd = shiftYmd(endYmd, -i);
      let qty = 0;
      for (const tx of inventoryVisibleTxns) {
        if (tx.date !== ymd) continue;
        if (!isInventoryTxnUsageOut(tx.type)) continue;
        const item = itemLookup.get(tx.itemId);
        if (!item || item.category !== "SUPPLY") continue;
        if (selectedItemId && tx.itemId !== selectedItemId) continue;
        qty += Number(tx.qty || 0);
      }
      const weekday = new Date(`${ymd}T00:00:00`).getDay();
      rows.push({
        ymd,
        qty,
        isWeekend: weekday === 0 || weekday === 6,
        holidayName: getHolidayName(ymd),
      });
    }
    const max = rows.reduce((m, row) => Math.max(m, row.qty), 0);
    return {
      max: max > 0 ? max : 1,
      rows,
    };
  }, [inventoryDailyForm.date, inventoryDailyForm.itemId, inventoryVisibleItems, inventoryVisibleTxns, getHolidayName]);
  const inventoryPurchaseWindow = useMemo(() => {
    const now = new Date();
    const cutoffDay = 27;
    const day = now.getDate();
    const start = day >= cutoffDay
      ? new Date(now.getFullYear(), now.getMonth(), cutoffDay)
      : new Date(now.getFullYear(), now.getMonth() - 1, cutoffDay);
    const end = day >= cutoffDay
      ? new Date(now.getFullYear(), now.getMonth() + 1, cutoffDay - 1)
      : new Date(now.getFullYear(), now.getMonth(), cutoffDay - 1);
    return {
      startYmd: toYmd(start),
      endYmd: toYmd(end),
      label: `${formatDate(toYmd(start))} - ${formatDate(toYmd(end))}`,
    };
  }, []);
  const inventoryPurchaseRows = useMemo(() => {
    const outByItem = new Map<number, number>();
    for (const tx of inventoryVisibleTxns) {
      if (!isInventoryTxnUsageOut(tx.type)) continue;
      if (tx.date < inventoryPurchaseWindow.startYmd || tx.date > inventoryPurchaseWindow.endYmd) continue;
      outByItem.set(tx.itemId, (outByItem.get(tx.itemId) || 0) + tx.qty);
    }
    let list = inventoryVisibleItems.map((item) => {
      const currentStock = inventoryStockMap.get(item.id) || 0;
      const usedQty = outByItem.get(item.id) || 0;
      const min = Number(item.minStock || 0);
      const suggestedQty = Math.max(min * 2 - currentStock, 0);
      return {
        ...item,
        currentStock,
        usedQty,
        suggestedQty,
        lowStock: currentStock <= min,
      };
    });
    list = list.filter((item) => item.usedQty > 0 || item.lowStock || item.suggestedQty > 0);
    return list
      .sort((a, b) => b.suggestedQty - a.suggestedQty || b.usedQty - a.usedQty || a.itemCode.localeCompare(b.itemCode))
      .slice(0, 30);
  }, [inventoryVisibleItems, inventoryVisibleTxns, inventoryPurchaseWindow, inventoryStockMap]);

  const setupLocations = useMemo(
    () => sortLocationEntriesByName(locations.filter((l) => l.campus === locationCampus)),
    [locations, locationCampus]
  );

  const userRequired = useMemo(
    () => USER_REQUIRED_TYPES.includes(assetForm.type) && !isSharedLocation(assetForm.location),
    [assetForm.type, assetForm.location]
  );
  const isPcAssetForCreate = useMemo(
    () => assetForm.category === "IT" && assetForm.type === DESKTOP_PARENT_TYPE,
    [assetForm.category, assetForm.type]
  );
  const isLinkableForCreate = useMemo(
    () => canLinkToParentAsset(assetForm.type),
    [assetForm.type]
  );
  const modelTemplates = useMemo(() => {
    const byModel = new Map<
      string,
      {
        model: string;
        specs: string;
        brand: string;
        vendor: string;
        count: number;
      }
    >();
    for (const asset of assets) {
      const model = String(asset.model || "").trim();
      const specs = String(asset.specs || "").trim();
      if (!model || !specs) continue;
      const key = model.toLowerCase();
      const existing = byModel.get(key);
      if (!existing) {
        byModel.set(key, {
          model,
          specs,
          brand: String(asset.brand || "").trim(),
          vendor: String(asset.vendor || "").trim(),
          count: 1,
        });
      } else {
        existing.count += 1;
      }
    }
    return Array.from(byModel.values()).sort((a, b) => a.model.localeCompare(b.model));
  }, [assets]);
  const applyModelTemplate = useCallback((rawModel: string) => {
    const input = String(rawModel || "").trim();
    if (!input) {
      setModelTemplateNote("");
      return;
    }
    const tpl = modelTemplates.find((m) => m.model.toLowerCase() === input.toLowerCase());
    if (!tpl) {
      setModelTemplateNote("");
      return;
    }
    setAssetForm((prev) => {
      const next = { ...prev };
      if (!String(prev.specs || "").trim()) next.specs = tpl.specs;
      if (!String(prev.brand || "").trim() && tpl.brand) next.brand = tpl.brand;
      if (!String(prev.vendor || "").trim() && tpl.vendor) next.vendor = tpl.vendor;
      return next;
    });
    setModelTemplateNote(`Model template matched: ${tpl.model}. Specs auto-filled`);
  }, [modelTemplates]);
  const applySetPackModelTemplate = useCallback((type: SetPackChildType, rawModel: string) => {
    const input = String(rawModel || "").trim();
    if (!input) return;
    const tpl = modelTemplates.find((m) => m.model.toLowerCase() === input.toLowerCase());
    if (!tpl) return;
    setSetPackDraft((prev) => {
      const draft = prev[type];
      if (!draft) return prev;
      const nextDraft = { ...draft };
      if (!String(draft.specs || "").trim()) nextDraft.specs = tpl.specs;
      if (!String(draft.brand || "").trim() && tpl.brand) nextDraft.brand = tpl.brand;
      if (!String(draft.vendor || "").trim() && tpl.vendor) nextDraft.vendor = tpl.vendor;
      return {
        ...prev,
        [type]: nextDraft,
      };
    });
  }, [modelTemplates]);

  useEffect(() => {
    setAssetForm((prev) => {
      const isDesktop = prev.category === "IT" && prev.type === DESKTOP_PARENT_TYPE;
      if (isDesktop) {
        const next = {
          ...prev,
          setCode: suggestedDesktopSetCode,
          parentAssetId: "",
          useExistingSet: false,
        };
        if (
          next.setCode !== prev.setCode ||
          next.parentAssetId !== prev.parentAssetId ||
          next.useExistingSet !== prev.useExistingSet
        ) {
          return next;
        }
        return prev;
      }
      if (prev.createSetPack) {
        return {
          ...prev,
          createSetPack: false,
        };
      }
      if (!canLinkToParentAsset(prev.type) && (prev.useExistingSet || prev.setCode || prev.parentAssetId || prev.componentRole || prev.componentRequired)) {
        return { ...prev, useExistingSet: false, setCode: "", parentAssetId: "", componentRole: "", componentRequired: false };
      }
      if (!prev.useExistingSet && (prev.setCode || prev.parentAssetId || prev.componentRole || prev.componentRequired)) {
        return { ...prev, setCode: "", parentAssetId: "", componentRole: "", componentRequired: false };
      }
      return prev;
    });
  }, [suggestedDesktopSetCode]);

  useEffect(() => {
    const isDesktop = assetForm.category === "IT" && assetForm.type === DESKTOP_PARENT_TYPE;
    if (isDesktop) return;
    setSetPackDraft(defaultSetPackDraft());
    setSetPackDetailOpen({
      MON: false,
      MON2: false,
      KBD: false,
      MSE: false,
      UWF: false,
      WBC: false,
    });
    setSetPackFileKey((prev) => ({
      MON: prev.MON + 1,
      MON2: prev.MON2 + 1,
      KBD: prev.KBD + 1,
      MSE: prev.MSE + 1,
      UWF: prev.UWF + 1,
      WBC: prev.WBC + 1,
    }));
  }, [assetForm.category, assetForm.type]);

  useEffect(() => {
    setAssetForm((prev) => {
      if (prev.category !== "IT" || prev.type !== USB_WIFI_TYPE_CODE) return prev;
      if (String(prev.specs || "").trim()) return prev;
      return {
        ...prev,
        specs: USB_WIFI_DEFAULT_SPECS,
      };
    });
  }, [assetForm.category, assetForm.type]);

  const itemSetupRows = useMemo(() => {
    const rows: Array<{ category: string; code: string; key: string }> = [];
    for (const [category, items] of Object.entries(allTypeOptions)) {
      for (const item of items) rows.push({ category, code: item.code, key: `${category}:${item.code}` });
    }
    return rows.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.code.localeCompare(b.code);
    });
  }, [allTypeOptions]);
  const setPackChildMeta = useMemo<Array<{ type: SetPackChildType; label: string }>>(
    () => [
      { type: "MON", label: t.includeMonitor },
      { type: "KBD", label: t.includeKeyboard },
      { type: "MSE", label: t.includeMouse },
      { type: "UWF", label: t.includeUsbWifi },
      { type: "WBC", label: t.includeWebcam },
    ],
    [t.includeMonitor, t.includeKeyboard, t.includeMouse, t.includeUsbWifi, t.includeWebcam]
  );

  useEffect(() => {
    const campusKey = CODE_TO_CAMPUS[campusEditCode];
    setCampusEditName(campusNames[campusKey] || campusKey || "");
  }, [campusEditCode, campusNames]);

  useEffect(() => {
    setCampusDraftNames((prev) => {
      const next = { ...prev };
      for (const campus of CAMPUS_LIST) {
        next[campus] = campusNames[campus] || campus;
      }
      return next;
    });
  }, [campusNames]);

  useEffect(() => {
    if (campusFilter !== "ALL") {
      setAssetForm((f) => ({ ...f, campus: campusFilter }));
      setTicketForm((f) => ({ ...f, campus: campusFilter }));
      setLocationCampus(campusFilter);
    }
  }, [campusFilter]);

  useEffect(() => {
    if (!currentTypeOptions.some((opt) => opt.code === assetForm.type)) {
      setAssetForm((f) => ({ ...f, type: currentTypeOptions[0].code }));
    }
  }, [assetForm.type, currentTypeOptions]);
  useEffect(() => {
    if (assetNameFilter === "ALL") return;
    if (!assetNameFilterOptions.some((option) => option.value === assetNameFilter)) {
      setAssetNameFilter("ALL");
    }
  }, [assetNameFilter, assetNameFilterOptions]);
  useEffect(() => {
    setAssetCampusMultiFilter((prev) => {
      if (prev.includes("ALL")) return ["ALL"];
      return prev.filter((item) => assetCampusFilterOptions.includes(item));
    });
  }, [assetCampusFilterOptions]);
  useEffect(() => {
    setAssetCategoryMultiFilter((prev) => {
      if (prev.includes("ALL")) return ["ALL"];
      return prev.filter((item) => assetCategoryFilterOptions.includes(item));
    });
  }, [assetCategoryFilterOptions]);
  useEffect(() => {
    const validNameValues = assetNameFilterOptions.map((option) => option.value);
    setAssetNameMultiFilter((prev) => {
      if (prev.includes("ALL")) return ["ALL"];
      return prev.filter((item) => validNameValues.includes(item));
    });
  }, [assetNameFilterOptions]);
  useEffect(() => {
    setAssetLocationMultiFilter((prev) => {
      if (prev.includes("ALL")) return ["ALL"];
      return prev.filter((item) => assetLocationFilterOptions.includes(item));
    });
  }, [assetLocationFilterOptions]);

  useEffect(() => {
    setAssetForm((prev) => {
      const nextPcType = isPcAssetForCreate ? (prev.pcType || PC_TYPE_OPTIONS[0].value) : "";
      if (nextPcType === prev.pcType) return prev;
      return { ...prev, pcType: nextPcType };
    });
  }, [isPcAssetForCreate]);

  useEffect(() => {
    if (!campusLocations.length) {
      if (assetForm.location) {
        setAssetForm((f) => ({ ...f, location: "" }));
      }
      return;
    }
    if (!campusLocations.some((loc) => loc.name === assetForm.location)) {
      setAssetForm((f) => ({ ...f, location: campusLocations[0].name }));
    }
  }, [campusLocations, assetForm.location]);
  useEffect(() => {
    if (!inventoryLocations.length) return;
    if (!inventoryLocations.some((loc) => loc.name === inventoryItemForm.location)) {
      setInventoryItemForm((f) => ({ ...f, location: inventoryLocations[0].name }));
    }
  }, [inventoryLocations, inventoryItemForm.location]);
  useEffect(() => {
    if (inventoryCodeManual) return;
    setInventoryItemForm((f) => ({ ...f, itemCode: autoInventoryItemCode }));
  }, [autoInventoryItemCode, inventoryCodeManual]);
  useEffect(() => {
    if (!inventoryMasterOptions.length) {
      if (inventoryItemForm.masterItemKey || inventoryItemForm.itemName || inventoryItemForm.unit) {
        setInventoryItemForm((f) => ({ ...f, masterItemKey: "", itemName: "", unit: "" }));
      }
      return;
    }
    const hasSelected = inventoryMasterOptions.some((item) => item.key === inventoryItemForm.masterItemKey);
    if (hasSelected) return;
    const first = inventoryMasterOptions[0];
    setInventoryItemForm((f) => ({
      ...f,
      masterItemKey: first.key,
      itemName: `${first.nameEn}${first.spec ? ` (${first.spec})` : ""}`,
      unit: first.unit,
    }));
  }, [inventoryMasterOptions, inventoryItemForm.masterItemKey, inventoryItemForm.itemName, inventoryItemForm.unit]);
  useEffect(() => {
    if (!selectedInventoryMaster) return;
    setInventoryItemForm((f) => ({
      ...f,
      itemName: `${selectedInventoryMaster.nameEn}${selectedInventoryMaster.spec ? ` (${selectedInventoryMaster.spec})` : ""}`,
      unit: selectedInventoryMaster.unit,
    }));
  }, [selectedInventoryMaster]);

  useEffect(() => {
    if (!canOpenAssetRegister && assetsView === "register") {
      setAssetsView("list");
    }
    if (!canAccessMenu("assets.list", "assets") && canOpenAssetRegister && assetsView === "list") {
      setAssetsView("register");
    }
  }, [canOpenAssetRegister, assetsView, canAccessMenu]);
  useEffect(() => {
    if (tab === "maintenance") {
      const canRecordMaintenanceTab = canAccessMenu("maintenance.record", "maintenance");
      const canHistoryMaintenanceTab = canAccessMenu("maintenance.history", "maintenance");
      const canDashboardMaintenanceTab = canRecordMaintenanceTab || canHistoryMaintenanceTab;
      if (maintenanceView === "dashboard" && !canDashboardMaintenanceTab) {
        setMaintenanceView(canHistoryMaintenanceTab ? "history" : "record");
      }
      if (maintenanceView === "record" && !canRecordMaintenanceTab) {
        setMaintenanceView(canDashboardMaintenanceTab ? "dashboard" : "history");
      }
      if (maintenanceView === "history" && !canHistoryMaintenanceTab) {
        setMaintenanceView(canDashboardMaintenanceTab ? "dashboard" : "record");
      }
    }
  }, [tab, maintenanceView, canAccessMenu]);
  useEffect(() => {
    if (tab !== "maintenance" || maintenanceView !== "record") {
      setMaintenanceRecordScheduleJumpMode(false);
    }
  }, [tab, maintenanceView]);
  useEffect(() => {
    if (tab === "verification") {
      if (verificationView === "record" && !canAccessMenu("verification.record", "verification")) {
        setVerificationView("history");
      }
      if (verificationView === "history" && !canAccessMenu("verification.history", "verification")) {
        setVerificationView("record");
      }
    }
  }, [tab, verificationView, canAccessMenu]);
  useEffect(() => {
    if (tab === "setup" && setupView === "campus" && !canAccessMenu("setup.campus", "setup")) setSetupView("users");
    if (tab === "setup" && setupView === "users" && !canAccessMenu("setup.users", "setup")) setSetupView("permissions");
    if (tab === "setup" && setupView === "permissions" && !canAccessMenu("setup.permissions", "setup")) setSetupView("backup");
    if (tab === "setup" && setupView === "backup" && !canAccessMenu("setup.backup", "setup")) setSetupView("items");
    if (tab === "setup" && setupView === "items" && !canAccessMenu("setup.items", "setup")) setSetupView("locations");
    if (tab === "setup" && setupView === "locations" && !canAccessMenu("setup.locations", "setup")) setSetupView("calendar");
    if (tab === "setup" && setupView === "calendar" && !canAccessMenu("setup.calendar", "setup")) setSetupView("campus");
  }, [tab, setupView, canAccessMenu]);

  const effectiveAssetCampusFilter =
    assetCampusFilter !== "ALL" ? assetCampusFilter : campusFilter;

  const loadStaffUsers = useCallback(async () => {
    try {
      const res = await requestJson<{ users: StaffUser[] }>("/api/staff-users");
      if (!res || !Object.prototype.hasOwnProperty.call(res, "users")) {
        throw new Error("Invalid staff-users API response");
      }
      const rows = normalizeArray<StaffUser>(res.users);
      if (!rows.length) {
        const fallbackUsers = readUserFallback();
        if (fallbackUsers.length) {
          setUsers(fallbackUsers);
          return;
        }
      }
      setUsers(rows);
      writeUserFallback(rows);
    } catch (err) {
      if (
        isApiUnavailableError(err) ||
        isMissingRouteError(err)
      ) {
        const fallbackUsers = readUserFallback();
        if (fallbackUsers.length) setUsers(fallbackUsers);
        return;
      }
      if (isUnauthorizedError(err)) {
        return;
      }
      setError(err instanceof Error ? err.message : "Cannot load users");
    }
  }, []);

  const loadMaintenanceNotifications = useCallback(async () => {
    if (!authUser) return;
    try {
      const res = await requestJson<{ notifications: MaintenanceNotification[]; unread: number }>(
        "/api/notifications?status=all&limit=30"
      );
      const rows = normalizeArray<MaintenanceNotification>(res.notifications).sort(
        (a, b) => Date.parse(String(b.createdAt || "")) - Date.parse(String(a.createdAt || ""))
      );
      setMaintenanceNotifications(rows);
      setMaintenanceNotificationUnread(Number(res.unread) || rows.filter((row) => !row.read).length);

      if (typeof window !== "undefined" && "Notification" in window) {
        setBrowserNotificationPermission(Notification.permission);
        if (Notification.permission === "granted") {
          for (const row of rows) {
            const id = Number(row.id);
            if (!id || row.read || shownBrowserNotificationIdsRef.current.has(id)) continue;
            shownBrowserNotificationIdsRef.current.add(id);
            try {
              new Notification(row.title, { body: row.message, tag: `maintenance-notification-${id}` });
            } catch {
              // Ignore browser notification errors; in-app list still works.
            }
          }
        }
      }
    } catch (err) {
      if (
        isApiUnavailableError(err) ||
        isMissingRouteError(err) ||
        isUnauthorizedError(err)
      ) {
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load notifications");
    }
  }, [authUser]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (campusFilter !== "ALL") params.set("campus", campusFilter);

      const [assetRes, ticketRes, statsRes] = await Promise.all([
        requestJson<{ assets: Asset[] }>(`/api/assets`),
        requestJson<{ tickets: Ticket[] }>(`/api/tickets?${params.toString()}`),
        requestJson<{ stats: DashboardStats }>(`/api/dashboard?${params.toString()}`),
      ]);
      try {
        const settingsRes = await requestJson<{ settings?: ServerSettings }>("/api/settings");
        const fromServer = settingsRes.settings?.campusNames || {};
        if (fromServer && typeof fromServer === "object") {
          const mergedCampusNames: Record<string, string> = {};
          for (const campus of CAMPUS_LIST) {
            mergedCampusNames[campus] = String(fromServer[campus] || campus);
          }
          setCampusNames(mergedCampusNames);
          writeStringMap(CAMPUS_NAME_FALLBACK_KEY, mergedCampusNames);
        }
        const nextCalendarEvents = normalizeCalendarEvents(
          settingsRes.settings?.calendarEvents,
          defaultCalendarEvents
        );
        setCalendarEvents(nextCalendarEvents);
        writeCalendarEventFallback(nextCalendarEvents);
        setMaintenanceReminderOffsets(
          normalizeMaintenanceReminderOffsets(settingsRes.settings?.maintenanceReminderOffsets)
        );
        const serverInventoryItems = normalizeArray<InventoryItem>(settingsRes.settings?.inventoryItems);
        const serverInventoryTxns = normalizeArray<InventoryTxn>(settingsRes.settings?.inventoryTxns);
        const fallbackInventoryItems = readInventoryItemFallback();
        const fallbackInventoryTxns = readInventoryTxnFallback();
        const nextInventoryItems = serverInventoryItems.length ? serverInventoryItems : fallbackInventoryItems;
        const nextInventoryTxns = serverInventoryTxns.length ? serverInventoryTxns : fallbackInventoryTxns;
        setInventoryItems(nextInventoryItems);
        setInventoryTxns(nextInventoryTxns);
      } catch {
        // Keep local settings if /api/settings is unavailable.
        setCalendarEvents(readCalendarEventFallback(defaultCalendarEvents));
        setMaintenanceReminderOffsets([...DEFAULT_MAINTENANCE_REMINDER_OFFSETS]);
        setInventoryItems(readInventoryItemFallback());
        setInventoryTxns(readInventoryTxnFallback());
      }

      const locationRes = await requestJson<{ locations: LocationEntry[] }>("/api/locations");
      const locationList = normalizeArray<LocationEntry>(locationRes.locations);

      const serverAssets = normalizeArray<Asset>(assetRes.assets).map(normalizeAssetForUi);
      // Server-first sync: when API is reachable, use server data as single source of truth.
      writeAssetFallback(serverAssets);
      setAssets(serverAssets);
      setTickets(normalizeArray<Ticket>(ticketRes.tickets));
      setLocations(locationList);
      const serverStats =
        statsRes.stats || {
          totalAssets: 0,
          itAssets: 0,
          safetyAssets: 0,
          openTickets: 0,
          byCampus: [],
        };
      setStats(
        serverStats
      );
      void loadMaintenanceNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot load data");
    } finally {
      setLoading(false);
    }
  }, [
    campusFilter,
    defaultCalendarEvents,
    loadMaintenanceNotifications,
  ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!authUser) return;
    void loadStaffUsers();
  }, [authUser, loadStaffUsers]);

  useEffect(() => {
    if (!authUser) {
      setMaintenanceNotifications([]);
      setMaintenanceNotificationUnread(0);
      shownBrowserNotificationIdsRef.current.clear();
      return;
    }
    void loadMaintenanceNotifications();
    const timer = window.setInterval(() => {
      void loadMaintenanceNotifications();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [authUser, loadMaintenanceNotifications]);

  useEffect(() => {
    if (tab === "setup" && isAdmin) {
      void loadStaffUsers();
      void loadAuthAccounts();
      void loadAuditLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isAdmin]);

  useEffect(() => {
    if (tab !== "setup" || !isAdmin || setupView !== "users") return;
    void loadStaffUsers();
  }, [tab, isAdmin, setupView, loadStaffUsers]);

  async function enablePhoneAlerts() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const permission = await Notification.requestPermission();
      setBrowserNotificationPermission(permission);
    } catch {
      setBrowserNotificationPermission("denied");
    }
  }

  async function markMaintenanceNotificationRead(id: number) {
    if (!id) return;
    try {
      await requestJson<{ ok: boolean }>(`/api/notifications/${id}/read`, {
        method: "PATCH",
      });
      setMaintenanceNotifications((prev) =>
        prev.map((row) => (row.id === id ? { ...row, read: true } : row))
      );
      setMaintenanceNotificationUnread((prev) => Math.max(0, prev - 1));
    } catch (err) {
      if (isUnauthorizedError(err)) return;
      setError(err instanceof Error ? err.message : "Failed to update notification");
    }
  }

  async function markAllMaintenanceNotificationsRead() {
    try {
      await requestJson<{ ok: boolean }>("/api/notifications/read-all", {
        method: "PATCH",
      });
      setMaintenanceNotifications((prev) => prev.map((row) => ({ ...row, read: true })));
      setMaintenanceNotificationUnread(0);
    } catch (err) {
      if (isUnauthorizedError(err)) return;
      setError(err instanceof Error ? err.message : "Failed to update notifications");
    }
  }

  async function createAsset() {
    if (!requireAdminAction()) return;
    const isDesktopAsset = assetForm.category === "IT" && assetForm.type.toUpperCase() === DESKTOP_PARENT_TYPE;
    const createPack = isDesktopAsset && assetForm.createSetPack;
    const packItems = (Object.entries(setPackDraft) as Array<[SetPackChildType, SetPackChildDraft]>)
      .filter(([, draft]) => draft.enabled);
    const createSetCode = isDesktopAsset
      ? suggestedDesktopSetCode
      : (isLinkableForCreate && assetForm.useExistingSet ? assetForm.setCode.trim() : "");
    const createParentAssetId = isDesktopAsset
      ? ""
      : (isLinkableForCreate && assetForm.useExistingSet ? assetForm.parentAssetId.trim().toUpperCase() : "");
    if (!assetForm.location) {
      alert(t.locationRequired);
      return;
    }
    if (isDesktopAsset && !assetForm.pcType.trim()) {
      alert(t.pcTypeRequired);
      return;
    }
    if (isLinkableForCreate && assetForm.useExistingSet && !createParentAssetId) {
      alert(t.selectParentAsset);
      return;
    }
    if (createPack && !packItems.length) {
      alert("Please select at least one item in set pack.");
      return;
    }
    if (userRequired && !assetForm.assignedTo.trim()) {
      alert(t.userRequired);
      return;
    }

    setBusy(true);
    setError("");
    try {
      const created = await requestJson<{ asset: Asset }>("/api/assets", {
        method: "POST",
        body: JSON.stringify({
          ...assetForm,
          photos: normalizeAssetPhotos(assetForm),
          type: assetForm.type.toUpperCase(),
          setCode: createSetCode,
          parentAssetId: createParentAssetId,
          componentRole: assetForm.componentRole.trim(),
          componentRequired: Boolean(assetForm.componentRequired),
          custodyStatus: assetForm.assignedTo ? "ASSIGNED" : "IN_STOCK",
        }),
      });

      if (createPack && created.asset?.assetId) {
        for (const [typeCode, draft] of packItems) {
          const assetType = setPackAssetType(typeCode);
          const packPhotos = normalizeAssetPhotos(draft).slice(0, MAX_SET_PACK_PHOTOS);
          await requestJson<{ asset: Asset }>("/api/assets", {
            method: "POST",
            body: JSON.stringify({
              campus: assetForm.campus,
              category: "IT",
              type: assetType,
              location: assetForm.location,
              setCode: createSetCode,
              parentAssetId: created.asset.assetId,
              assignedTo: "",
              custodyStatus: "IN_STOCK",
              brand: draft.brand,
              model: draft.model,
              serialNumber: draft.serialNumber,
              specs: draft.specs,
              purchaseDate: draft.purchaseDate,
              warrantyUntil: draft.warrantyUntil,
              vendor: draft.vendor,
              notes: draft.notes || `Auto-created from set pack: ${created.asset.assetId}`,
              nextMaintenanceDate: "",
              scheduleNote: "",
              photo: packPhotos[0] || "",
              photos: packPhotos,
              status: draft.status || assetForm.status,
            }),
          });
        }
      }

      setAssetForm((f) => ({
        ...f,
        type: defaultTypeForCategory(f.category).code,
        pcType: f.category === "IT" ? PC_TYPE_OPTIONS[0].value : "",
        setCode: "",
        parentAssetId: "",
        useExistingSet: false,
        componentRole: "",
        componentRequired: false,
        createSetPack: false,
        assignedTo: "",
        brand: "",
        model: "",
        serialNumber: "",
        specs: "",
        purchaseDate: "",
        warrantyUntil: "",
        vendor: "",
        notes: "",
        nextMaintenanceDate: "",
        scheduleNote: "",
        photo: "",
        photos: [],
        status: "Active",
      }));
      setSetPackDraft(defaultSetPackDraft());
      setSetPackDetailOpen({
        MON: false,
        MON2: false,
        KBD: false,
        MSE: false,
        UWF: false,
        WBC: false,
      });
      setSetPackFileKey((prev) => ({
        MON: prev.MON + 1,
        MON2: prev.MON2 + 1,
        KBD: prev.KBD + 1,
        MSE: prev.MSE + 1,
        UWF: prev.UWF + 1,
        WBC: prev.WBC + 1,
      }));
      setModelTemplateNote("");
      setAssetFileKey((k) => k + 1);
      appendUiAudit(
        "CREATE",
        "asset",
        created.asset?.assetId || `${assetForm.campus}-${assetForm.type}`,
        `${assetForm.campus} | ${assetForm.location}`
      );
      await loadData();
      setAssetsView("list");
    } catch (err) {
      if (isApiUnavailableError(err)) {
        const allLocal = readAssetFallback();
        const seq = calcNextSeq(
          allLocal,
          assetForm.campus,
          assetForm.category,
          assetForm.type.toUpperCase()
        );
        const createPhotos = normalizeAssetPhotos(assetForm);
        const newAsset: Asset = {
          id: Date.now(),
          campus: assetForm.campus,
          category: assetForm.category,
          type: assetForm.type.toUpperCase(),
          pcType: isDesktopAsset ? assetForm.pcType.trim() : "",
          seq,
          assetId: `${CAMPUS_CODE[assetForm.campus] || "CX"}-${categoryCode(assetForm.category)}-${assetForm.type.toUpperCase()}-${pad4(seq)}`,
          name: assetItemName(assetForm.category, assetForm.type.toUpperCase()),
          location: assetForm.location,
          setCode: createSetCode,
          parentAssetId: createParentAssetId,
          componentRole: assetForm.componentRole.trim(),
          componentRequired: Boolean(assetForm.componentRequired),
          assignedTo: assetForm.assignedTo,
          custodyStatus: assetForm.assignedTo ? "ASSIGNED" : "IN_STOCK",
          brand: assetForm.brand,
          model: assetForm.model,
          serialNumber: assetForm.serialNumber,
          specs: assetForm.specs,
          purchaseDate: assetForm.purchaseDate,
          warrantyUntil: assetForm.warrantyUntil,
          vendor: assetForm.vendor,
          notes: assetForm.notes,
          nextMaintenanceDate: assetForm.nextMaintenanceDate,
          nextVerificationDate: "",
          verificationFrequency: "NONE",
          scheduleNote: assetForm.scheduleNote,
          repeatMode: "NONE",
          repeatWeekOfMonth: 0,
          repeatWeekday: 0,
          maintenanceHistory: [],
          verificationHistory: [],
          transferHistory: [],
          custodyHistory: assetForm.assignedTo
            ? [
                {
                  id: Date.now() + 1,
                  date: new Date().toISOString(),
                  action: "ASSIGN",
                  fromCampus: assetForm.campus,
                  fromLocation: assetForm.location,
                  toCampus: assetForm.campus,
                  toLocation: assetForm.location,
                  fromUser: "",
                  toUser: assetForm.assignedTo,
                  responsibilityAck: false,
                  by: authUser?.displayName || "",
                  note: "Initial assignment",
                },
              ]
            : [],
          statusHistory: [
            {
              id: Date.now(),
              date: new Date().toISOString(),
              fromStatus: "New",
              toStatus: assetForm.status,
              reason: "Asset created",
            },
          ],
          photo: createPhotos[0] || "",
          photos: createPhotos,
          status: assetForm.status,
          created: new Date().toISOString(),
        };
        let nextLocal = [newAsset, ...allLocal];
        if (createPack) {
          for (const [typeCode, draft] of packItems) {
            const assetType = setPackAssetType(typeCode);
            const childSeq = calcNextSeq(nextLocal, assetForm.campus, "IT", assetType);
            const packPhotos = normalizeAssetPhotos(draft).slice(0, MAX_SET_PACK_PHOTOS);
            const child: Asset = {
              id: Date.now() + Math.floor(Math.random() * 10000),
              campus: assetForm.campus,
              category: "IT",
              type: assetType,
              pcType: "",
              seq: childSeq,
              assetId: `${CAMPUS_CODE[assetForm.campus] || "CX"}-${categoryCode("IT")}-${assetType}-${pad4(childSeq)}`,
              name: assetItemName("IT", assetType),
              location: assetForm.location,
              setCode: createSetCode,
              parentAssetId: newAsset.assetId,
              assignedTo: "",
              custodyStatus: "IN_STOCK",
              brand: draft.brand,
              model: draft.model,
              serialNumber: draft.serialNumber,
              specs: draft.specs,
              purchaseDate: draft.purchaseDate,
              warrantyUntil: draft.warrantyUntil,
              vendor: draft.vendor,
              notes: draft.notes || `Auto-created from set pack: ${newAsset.assetId}`,
              nextMaintenanceDate: "",
              nextVerificationDate: "",
              verificationFrequency: "NONE",
              scheduleNote: "",
              repeatMode: "NONE",
              repeatWeekOfMonth: 0,
              repeatWeekday: 0,
              maintenanceHistory: [],
              verificationHistory: [],
              transferHistory: [],
              custodyHistory: [],
              statusHistory: [
                {
                  id: Date.now(),
                  date: new Date().toISOString(),
                  fromStatus: "New",
                  toStatus: draft.status || assetForm.status,
                  reason: "Asset created from set pack",
                },
              ],
              photo: packPhotos[0] || "",
              photos: packPhotos,
              status: draft.status || assetForm.status,
              created: new Date().toISOString(),
            };
            nextLocal = [child, ...nextLocal];
          }
        }
        writeAssetFallback(nextLocal);
        setAssets(
          effectiveAssetCampusFilter === "ALL"
            ? nextLocal
            : nextLocal.filter((a) => a.campus === effectiveAssetCampusFilter)
        );
        setStats(buildStatsFromAssets(nextLocal, campusFilter));
        setAssetForm((f) => ({
          ...f,
          type: defaultTypeForCategory(f.category).code,
          pcType: f.category === "IT" ? PC_TYPE_OPTIONS[0].value : "",
          setCode: "",
          parentAssetId: "",
          useExistingSet: false,
          componentRole: "",
          componentRequired: false,
          createSetPack: false,
          assignedTo: "",
          brand: "",
          model: "",
          serialNumber: "",
          specs: "",
          purchaseDate: "",
          warrantyUntil: "",
          vendor: "",
          notes: "",
          nextMaintenanceDate: "",
          scheduleNote: "",
          photo: "",
          photos: [],
          status: "Active",
        }));
        setSetPackDraft(defaultSetPackDraft());
        setSetPackDetailOpen({
          MON: false,
          MON2: false,
          KBD: false,
          MSE: false,
          UWF: false,
          WBC: false,
        });
        setSetPackFileKey((prev) => ({
          MON: prev.MON + 1,
          MON2: prev.MON2 + 1,
          KBD: prev.KBD + 1,
          MSE: prev.MSE + 1,
          UWF: prev.UWF + 1,
          WBC: prev.WBC + 1,
        }));
        setModelTemplateNote("");
        setAssetFileKey((k) => k + 1);
        setError("");
        appendUiAudit("CREATE", "asset", newAsset.assetId, `${newAsset.campus} | ${newAsset.location}`);
        setAssetsView("list");
      } else {
        setError(err instanceof Error ? err.message : "Failed to create asset");
      }
    } finally {
      setBusy(false);
    }
  }

  function saveCampusLabel(campus: string, value: string) {
    setCampusNames((prev) => ({
      ...prev,
      [campus]: value.trim() || campus,
    }));
  }

  async function saveCampusNamesToServer(nextMap: Record<string, string>) {
    try {
      await requestJson<{ ok: boolean; settings?: ServerSettings }>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ settings: { campusNames: nextMap } }),
      });
    } catch (err) {
      if (isApiUnavailableError(err) || isMissingRouteError(err)) return;
      throw err;
    }
  }

  async function saveCalendarEventsToServer(nextRows: CalendarEvent[]) {
    try {
      await requestJson<{ ok: boolean; settings?: ServerSettings }>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ settings: { calendarEvents: nextRows } }),
      });
    } catch (err) {
      if (isApiUnavailableError(err) || isMissingRouteError(err)) return;
      throw err;
    }
  }

  async function saveMaintenanceReminderOffsetsToServer(nextOffsets: number[]) {
    try {
      await requestJson<{ ok: boolean; settings?: ServerSettings }>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ settings: { maintenanceReminderOffsets: nextOffsets } }),
      });
    } catch (err) {
      if (isApiUnavailableError(err) || isMissingRouteError(err)) return;
      throw err;
    }
  }

  async function toggleMaintenanceReminderOffset(dayOffset: number) {
    if (!requireAdminAction()) return;
    const current = [...maintenanceReminderOffsets];
    const has = current.includes(dayOffset);
    const next = normalizeMaintenanceReminderOffsets(
      has ? current.filter((d) => d !== dayOffset) : [...current, dayOffset]
    );
    setSavingMaintenanceReminder(true);
    setError("");
    try {
      await saveMaintenanceReminderOffsetsToServer(next);
      setMaintenanceReminderOffsets(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save reminder setting");
    } finally {
      setSavingMaintenanceReminder(false);
    }
  }

  async function createOrUpdateCalendarEvent() {
    if (!requireAdminAction()) return;
    const date = normalizeYmdInput(calendarEventForm.date);
    const name = String(calendarEventForm.name || "").trim();
    if (!date || !name) {
      setError("Calendar event date and name are required.");
      return;
    }
    const normalizedType = normalizeCalendarEventType(calendarEventForm.type);
    const base = editingCalendarEventId === null
      ? calendarEvents
      : calendarEvents.filter((row) => row.id !== editingCalendarEventId);
    const nextRows = normalizeCalendarEvents(
      [
        ...base,
        {
          id: editingCalendarEventId || Date.now(),
          date,
          name,
          type: normalizedType,
        },
      ],
      defaultCalendarEvents
    );
    setBusy(true);
    setError("");
    try {
      await saveCalendarEventsToServer(nextRows);
      setCalendarEvents(nextRows);
      writeCalendarEventFallback(nextRows);
      setCalendarEventForm({ date: "", name: "", type: "public" });
      setEditingCalendarEventId(null);
      setSetupMessage(editingCalendarEventId === null ? "Calendar event added." : "Calendar event updated.");
      appendUiAudit(
        editingCalendarEventId === null ? "CREATE" : "UPDATE",
        "calendar_event",
        `${date}`,
        `${name} | ${normalizedType}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save calendar event");
    } finally {
      setBusy(false);
    }
  }

  function startEditCalendarEvent(row: CalendarEvent) {
    setEditingCalendarEventId(row.id);
    setCalendarEventForm({
      date: row.date,
      name: row.name,
      type: normalizeCalendarEventType(row.type),
    });
  }

  function cancelEditCalendarEvent() {
    setEditingCalendarEventId(null);
    setCalendarEventForm({ date: "", name: "", type: "public" });
  }

  async function deleteCalendarEvent(id: number) {
    if (!requireAdminAction()) return;
    if (!window.confirm("Delete this calendar event?")) return;
    const nextRows = calendarEvents.filter((row) => row.id !== id);
    setBusy(true);
    setError("");
    try {
      await saveCalendarEventsToServer(nextRows);
      setCalendarEvents(nextRows);
      writeCalendarEventFallback(nextRows);
      setSetupMessage("Calendar event deleted.");
      appendUiAudit("DELETE", "calendar_event", String(id), "Calendar event deleted");
      if (editingCalendarEventId === id) {
        cancelEditCalendarEvent();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete calendar event");
    } finally {
      setBusy(false);
    }
  }

  async function createOrUpdateUser() {
    if (!requireAdminAction()) return;
    const fullName = userForm.fullName.trim();
    const position = userForm.position.trim();
    const email = userForm.email.trim().toLowerCase();
    if (!fullName || !position) return;

    const emailTaken = email
      ? users.some((u) => String(u.email || "").toLowerCase() === email && u.id !== editingUserId)
      : false;
    if (emailTaken) {
      setError("User email already exists.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      if (editingUserId !== null) {
        const res = await requestJson<{ user?: StaffUser; users?: StaffUser[] }>(`/api/staff-users/${editingUserId}`, {
          method: "PATCH",
          body: JSON.stringify({ fullName, position, email }),
        });
        const returnedRows = normalizeArray<StaffUser>(res.users);
        if (returnedRows.length) {
          setUsers(returnedRows);
          writeUserFallback(returnedRows);
        } else {
          setUsers((prev) =>
            prev.map((u) =>
              u.id === editingUserId ? { ...u, fullName, position, email } : u
            )
          );
        }
        setEditingUserId(null);
      } else {
        const res = await requestJson<{ user?: StaffUser; users?: StaffUser[] }>("/api/staff-users", {
          method: "POST",
          body: JSON.stringify({ fullName, position, email }),
        });
        const returnedRows = normalizeArray<StaffUser>(res.users);
        if (returnedRows.length) {
          setUsers(returnedRows);
          writeUserFallback(returnedRows);
        } else if (res.user) {
          const created = {
            ...res.user,
            email: String(res.user.email || "").trim().toLowerCase(),
          };
          setUsers((prev) => [created, ...prev.filter((u) => u.id !== created.id)]);
        } else {
          await loadStaffUsers();
        }
      }
      setUserForm({ fullName: "", position: "", email: "" });
    } catch (err) {
      if (isApiUnavailableError(err) || isMissingRouteError(err)) {
        if (editingUserId !== null) {
          setUsers((prev) =>
            prev.map((u) =>
              u.id === editingUserId ? { ...u, fullName, position, email } : u
            )
          );
          setEditingUserId(null);
        } else {
          const localUser: StaffUser = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            fullName,
            position,
            email,
          };
          setUsers((prev) => [localUser, ...prev]);
        }
        setUserForm({ fullName: "", position: "", email: "" });
        setError("");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to save user");
    } finally {
      setBusy(false);
    }
  }

  async function loadAuthAccounts() {
    if (!isAdmin) return;
    try {
      const res = await requestJson<{ users: AuthAccount[] }>("/api/auth/users");
      const serverRows = Array.isArray(res.users) ? res.users : [];
      const permissionMap = readAuthPermissionFallback();
      const localRows = readAuthAccountsFallback().map((u) => {
        const saved = permissionMap[u.username];
        return saved
          ? {
              ...u,
              role: saved.role,
              campuses: saved.campuses,
              modules: saved.modules,
              assetSubviewAccess: saved.assetSubviewAccess,
              menuAccess: saved.menuAccess,
            }
          : u;
      });
      const rows = mergeAuthAccounts(serverRows, localRows);
      writeAuthAccountsFallback(rows);
      setAuthAccounts(rows);
      setError("");
    } catch (err) {
      if (SERVER_ONLY_STORAGE) {
        setAuthAccounts([]);
        setError(err instanceof Error ? err.message : "Cannot load account permissions");
        return;
      }
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      if (
        isApiUnavailableError(err) ||
        isMissingRouteError(err) ||
        msg.includes("unauthorized") ||
        msg.includes("admin role required") ||
        msg.includes("request failed (401)") ||
        msg.includes("request failed (403)")
      ) {
        const permissionMap = readAuthPermissionFallback();
        const rows = readAuthAccountsFallback().map((u) => {
          const saved = permissionMap[u.username];
          return saved
            ? {
                ...u,
                role: saved.role,
                campuses: saved.campuses,
                modules: saved.modules,
                assetSubviewAccess: saved.assetSubviewAccess,
                menuAccess: saved.menuAccess,
              }
            : u;
        });
        writeAuthAccountsFallback(rows);
        setAuthAccounts(rows);
        setError("");
        return;
      }
      setError(err instanceof Error ? err.message : "Cannot load account permissions");
    }
  }

  async function loadAuditLogs() {
    if (!isAdmin) return;
    try {
      const res = await requestJson<{ logs: AuditLog[] }>("/api/audit-logs");
      const serverLogs = Array.isArray(res.logs) ? res.logs : [];
      const localLogs = readAuditFallback();
      const merged = [...serverLogs, ...localLogs]
        .sort((a, b) => Date.parse(b.date || "") - Date.parse(a.date || ""))
        .slice(0, 300);
      setAuditLogs(merged);
      setError("");
    } catch (err) {
      if (isApiUnavailableError(err) || isMissingRouteError(err)) {
        setAuditLogs(readAuditFallback());
        setError("");
        return;
      }
      setError(err instanceof Error ? err.message : "Cannot load audit logs");
    }
  }

  function appendUiAudit(action: string, entity: string, entityId: string, summary: string) {
    const entry: AuditLog = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      date: new Date().toISOString(),
      action,
      entity,
      entityId,
      summary,
      actor: {
        id: authUser?.id,
        username: authUser?.username,
        displayName: authUser?.displayName || authUser?.username,
        role: authUser?.role,
      },
    };
    const next = [entry, ...readAuditFallback()].slice(0, 500);
    writeAuditFallback(next);
    if (isAdmin && tab === "setup") {
      setAuditLogs((prev) => [entry, ...prev].slice(0, 300));
    }
  }

  async function createServerBackup() {
    if (!requireAdminAction()) return;
    setBusy(true);
    setError("");
    setSetupMessage("Creating server backup...");
    try {
      const res = await requestJson<{ ok: boolean; file?: string }>("/api/backup/create", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setSetupMessage(res.file ? `Backup created: ${res.file}` : "Backup created.");
      appendUiAudit("BACKUP_CREATE", "backup", res.file || "server", "Create server backup");
      await loadAuditLogs();
    } catch (err) {
      if (isApiUnavailableError(err) || isMissingRouteError(err)) {
        const payload = {
          exportedAt: new Date().toISOString(),
          assets,
          tickets,
          locations,
          users,
        };
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `eco-it-local-backup-${stamp}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setSetupMessage("Server route not available. Local backup downloaded.");
        appendUiAudit("BACKUP_EXPORT_LOCAL", "backup", "local-file", "Export local backup file");
        await loadAuditLogs();
        return;
      }
      const msg = err instanceof Error ? err.message : "Failed to create backup";
      setError(msg);
      setSetupMessage(`Create backup failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  async function exportBackupFile() {
    if (!requireAdminAction()) return;
    setBusy(true);
    setError("");
    setSetupMessage("Preparing backup download...");
    try {
      const res = await requestJson<{ generatedAt: string; db: unknown }>("/api/backup/export");
      const stamp = (res.generatedAt || new Date().toISOString()).replace(/[:.]/g, "-");
      const blob = new Blob([JSON.stringify(res.db, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `eco-it-backup-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setSetupMessage("Backup file downloaded.");
      await loadAuditLogs();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to export backup";
      setError(msg);
      setSetupMessage(`Download backup failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  async function importBackupFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (!requireAdminAction()) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    setSetupMessage("Restoring backup...");
    try {
      const raw = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error("Selected file is not valid JSON.");
      }
      const hasBackupShape =
        !!parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        (Object.prototype.hasOwnProperty.call(parsed, "assets") ||
          Object.prototype.hasOwnProperty.call(parsed, "tickets") ||
          Object.prototype.hasOwnProperty.call(parsed, "locations") ||
          Object.prototype.hasOwnProperty.call(parsed, "users") ||
          Object.prototype.hasOwnProperty.call(parsed, "auditLogs"));
      if (!hasBackupShape) {
        throw new Error("Selected file is not a valid backup format.");
      }
      await requestJson<{ ok: boolean }>("/api/backup/import", {
        method: "POST",
        body: JSON.stringify({ db: parsed }),
      });
      setSetupMessage("Backup restored successfully.");
      await loadData();
      await loadAuthAccounts();
      await loadAuditLogs();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to import backup";
      setError("");
      setSetupMessage(`Restore backup failed: ${msg}`);
    } finally {
      setBusy(false);
      setBackupImportKey((k) => k + 1);
      if (e.target) e.target.value = "";
    }
  }

  async function syncFromLiveWeb() {
    if (!requireAdminAction()) return;
    const baseInput = window.prompt("Live server URL", DEFAULT_CLOUD_API_BASE);
    const liveBase = String(baseInput || "").trim().replace(/\/+$/, "");
    if (!liveBase) return;

    const username = window.prompt("Live admin username", "admin");
    if (!username || !username.trim()) return;
    const password = window.prompt("Live admin password");
    if (!password || !password.trim()) return;

    setBusy(true);
    setError("");
    setSetupMessage("Syncing from live web...");
    try {
      const loginRes = await fetch(`${liveBase}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });
      const loginData = (await loginRes.json().catch(() => ({}))) as { token?: string; error?: string };
      if (!loginRes.ok || !loginData.token) {
        throw new Error(loginData.error || "Cannot login to live server.");
      }

      const exportRes = await fetch(`${liveBase}/api/backup/export`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${loginData.token}`,
        },
      });
      const exportData = (await exportRes.json().catch(() => ({}))) as { db?: unknown; error?: string };
      if (!exportRes.ok || !exportData.db || typeof exportData.db !== "object") {
        throw new Error(exportData.error || "Cannot export backup from live server.");
      }

      await requestJson<{ ok: boolean }>("/api/backup/import", {
        method: "POST",
        body: JSON.stringify({ db: exportData.db }),
      });

      setSetupMessage("Live sync completed. Local database updated.");
      appendUiAudit("BACKUP_IMPORT_REMOTE", "system", "db", `Synced database from ${liveBase}`);
      await loadData();
      await loadAuthAccounts();
      await loadAuditLogs();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Live sync failed";
      setError("");
      setSetupMessage(`Live sync failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  async function factoryResetSystem() {
    if (!requireAdminAction()) return;
    const confirmed = window.confirm(
      "Factory Reset will delete all assets, records, users, uploads, and backups. Continue?"
    );
    if (!confirmed) return;
    const phrase = window.prompt("Type RESET to confirm full reset:");
    if (String(phrase || "").trim().toUpperCase() !== "RESET") return;

    setBusy(true);
    setError("");
    setSetupMessage("Factory reset in progress...");
    try {
      await requestJson<{ ok: boolean }>("/api/admin/factory-reset", {
        method: "POST",
        body: JSON.stringify({}),
      });

      clearAllFallbackCaches();
      localStorage.removeItem(AUTH_TOKEN_KEY);
      setAssets([]);
      setTickets([]);
      setLocations([]);
      setUsers([]);
      setAuditLogs([]);
      setInventoryItems([]);
      setInventoryTxns([]);
      setSetupMessage("Factory reset completed. Please login again.");
      alert("Factory reset completed. Please login again.");
      window.location.reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Factory reset failed";
      setError(msg);
      setSetupMessage(`Factory reset failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  function resetAuthCreateForm() {
    setAuthCreateForm({
      staffId: "",
      username: "",
      password: "",
      displayName: "",
      role: "Viewer",
      campuses: [CAMPUS_LIST[0]],
      modules: [...DEFAULT_VIEWER_MODULES],
      assetSubviewAccess: "both",
      menuAccess: defaultMenuAccessFor("Viewer", DEFAULT_VIEWER_MODULES, "both"),
    });
    setEditingAuthUserId(null);
  }

  function startEditAuthAccount(user: AuthAccount) {
    const role = normalizeRole(user.role);
    const campuses = normalizeRoleCampuses(role, user.campuses);
    const modules = Array.isArray(user.modules) && user.modules.length ? user.modules : normalizeModulesByRole(role, []);
    const assetSubviewAccess = normalizeAssetSubviewAccess((user as { assetSubviewAccess?: unknown }).assetSubviewAccess);
    const menuAccess = normalizeMenuAccess(
      role,
      modules,
      assetSubviewAccess,
      (user as { menuAccess?: unknown }).menuAccess
    );
    setAuthCreateForm({
      staffId: "",
      username: user.username,
      password: "",
      displayName: user.displayName,
      role,
      campuses,
      modules,
      assetSubviewAccess,
      menuAccess,
    });
    setEditingAuthUserId(user.id);
    setError("");
    setSetupMessage(`Editing account: ${user.username}`);
  }

  async function createAuthAccount() {
    if (!requireAdminAction()) return;
    const username = authCreateForm.username.trim();
    const password = authCreateForm.password.trim();
    const displayName = authCreateForm.displayName.trim();
    const isEditing = editingAuthUserId !== null;
    const editingUser = isEditing ? authAccounts.find((u) => u.id === editingAuthUserId) : null;
    if (!username || !displayName) {
      setError("Username and display name are required.");
      return;
    }
    if (!isEditing && !password) {
      setError("Password is required for new account.");
      return;
    }
    if (
      authAccounts.some(
        (u) => u.username.toLowerCase() === username.toLowerCase() && (!isEditing || u.id !== editingAuthUserId)
      )
    ) {
      setError("Username already exists.");
      return;
    }

    const campuses = normalizeRoleCampuses(authCreateForm.role, authCreateForm.campuses);
    if (authCreateForm.role !== "Super Admin" && !campuses.length) {
      setError("Please select at least one campus.");
      return;
    }
    const modules: NavModule[] = isAdminRole(authCreateForm.role)
      ? [...ALL_NAV_MODULES]
      : (authCreateForm.modules.length ? authCreateForm.modules : (["dashboard"] as NavModule[]));
    const assetSubviewAccess = normalizeAssetSubviewAccess(authCreateForm.assetSubviewAccess);
    const menuAccess = normalizeMenuAccess(authCreateForm.role, modules, assetSubviewAccess, authCreateForm.menuAccess);

    setBusy(true);
    setError("");
    try {
      const endpoint = isEditing && editingAuthUserId ? `/api/auth/users/${editingAuthUserId}` : "/api/auth/users";
      const method = isEditing ? "PATCH" : "POST";
      const res = await requestJson<{ user: AuthAccount }>(endpoint, {
        method,
        body: JSON.stringify({
          username,
          ...(password ? { password } : {}),
          displayName,
          role: authCreateForm.role,
          campuses,
          modules,
          assetSubviewAccess,
          menuAccess,
        }),
      });
      const saved: AuthAccount = res.user?.username
        ? {
            id: Number(res.user.id) || Date.now(),
            username: res.user.username,
            displayName: res.user.displayName || displayName,
            role: normalizeRole(res.user.role),
            campuses: Array.isArray(res.user.campuses) && res.user.campuses.length ? res.user.campuses : campuses,
            modules: Array.isArray(res.user.modules) && res.user.modules.length ? res.user.modules : modules,
            assetSubviewAccess: normalizeAssetSubviewAccess((res.user as { assetSubviewAccess?: unknown }).assetSubviewAccess || assetSubviewAccess),
            menuAccess: normalizeMenuAccess(
              normalizeRole(res.user.role),
              Array.isArray(res.user.modules) && res.user.modules.length ? res.user.modules : modules,
              normalizeAssetSubviewAccess((res.user as { assetSubviewAccess?: unknown }).assetSubviewAccess || assetSubviewAccess),
              (res.user as { menuAccess?: unknown }).menuAccess || menuAccess
            ),
          }
        : {
            id: Date.now(),
            username,
            displayName,
            role: authCreateForm.role,
            campuses,
            modules,
            assetSubviewAccess,
            menuAccess,
          };
      const merged = mergeAuthAccounts([saved], readAuthAccountsFallback());
      writeAuthAccountsFallback(merged);
      const permissionFallback = readAuthPermissionFallback();
      if (isEditing && editingUser && editingUser.username !== saved.username) {
        delete permissionFallback[editingUser.username];
      }
      writeAuthPermissionFallback({
        ...permissionFallback,
        [saved.username]: {
          role: saved.role,
          campuses: saved.campuses,
          modules: saved.modules,
          assetSubviewAccess: saved.assetSubviewAccess,
          menuAccess: saved.menuAccess,
        },
      });
      setAuthAccounts(merged);
      await loadAuthAccounts();
      if (authUser && isEditing && editingAuthUserId === authUser.id) {
        setAuthUser({
          ...authUser,
          username: saved.username,
          displayName: saved.displayName,
          role: saved.role,
          campuses: saved.campuses,
          modules: saved.modules,
          assetSubviewAccess: saved.assetSubviewAccess,
          menuAccess: saved.menuAccess,
        });
      }
      resetAuthCreateForm();
      setSetupMessage(isEditing ? "Login account updated." : "Login account created.");
    } catch (err) {
      if (SERVER_ONLY_STORAGE) {
        setError(err instanceof Error ? err.message : `Failed to ${isEditing ? "update" : "create"} login account`);
        setSetupMessage(`Failed to ${isEditing ? "update" : "create"} login account.`);
        return;
      }
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      if (
        isApiUnavailableError(err) ||
        isMissingRouteError(err) ||
        msg.includes("unauthorized") ||
        msg.includes("admin role required") ||
        msg.includes("request failed (401)") ||
        msg.includes("request failed (403)")
      ) {
        const nextAccount: AuthAccount = isEditing && editingUser ? {
          ...editingUser,
          username,
          displayName,
          role: authCreateForm.role,
          campuses,
          modules,
          assetSubviewAccess,
          menuAccess,
        } : {
          id: Date.now(),
          username,
          displayName,
          role: authCreateForm.role,
          campuses,
          modules,
          assetSubviewAccess,
          menuAccess,
        };
        const fallbackRows = readAuthAccountsFallback();
        const nextRows = isEditing && editingUser
          ? fallbackRows.map((row) => (row.id === editingUser.id ? nextAccount : row))
          : [nextAccount, ...fallbackRows];
        writeAuthAccountsFallback(nextRows);
        const nextMap = readAuthPermissionFallback();
        if (isEditing && editingUser && editingUser.username !== username) {
          delete nextMap[editingUser.username];
        }
        writeAuthPermissionFallback({
          ...nextMap,
          [username]: { role: authCreateForm.role, campuses, modules, assetSubviewAccess, menuAccess },
        });
        setAuthAccounts(nextRows);
        if (authUser && isEditing && editingAuthUserId === authUser.id) {
          setAuthUser({
            ...authUser,
            username,
            displayName,
            role: authCreateForm.role,
            campuses,
            modules,
            assetSubviewAccess,
            menuAccess,
          });
        }
        resetAuthCreateForm();
        setError("");
        setSetupMessage(isEditing ? "Login account updated." : "Login account created.");
        return;
      }
      setError(err instanceof Error ? err.message : `Failed to ${isEditing ? "update" : "create"} login account`);
    } finally {
      setBusy(false);
    }
  }

  async function resetAuthAccountPassword(user: AuthAccount) {
    if (!requireAdminAction()) return;
    const tempPassword = window.prompt(`Set temporary password for ${user.username}:`, "EcoTemp@2026!");
    const password = String(tempPassword || "").trim();
    if (!password) return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      try {
        await requestJson<{ ok?: boolean }>(`/api/auth/users/${user.id}/reset-password`, {
          method: "POST",
          body: JSON.stringify({ password }),
        });
      } catch (err) {
        if (isMissingRouteError(err)) {
          await requestJson<{ user?: AuthAccount }>(`/api/auth/users/${user.id}`, {
            method: "PATCH",
            body: JSON.stringify({ password }),
          });
        } else {
          throw err;
        }
      }
      setSetupMessage(`Password reset for ${user.username}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setBusy(false);
    }
  }

  async function saveCampusNameByCode() {
    if (!requireAdminAction()) return;
    const canonicalCampus = CODE_TO_CAMPUS[campusEditCode];
    if (!canonicalCampus) return;
    const nextMap = {
      ...campusNames,
      [canonicalCampus]: campusEditName.trim() || canonicalCampus,
    };
    saveCampusLabel(canonicalCampus, campusEditName);
    try {
      await saveCampusNamesToServer(nextMap);
      setSetupMessage(`Saved ${campusEditCode} name.`);
    } catch (err) {
      setSetupMessage(`Save failed: ${err instanceof Error ? err.message : "Cannot save campus name"}`);
    }
  }

  async function saveCampusNameByRow(campus: string) {
    if (!requireAdminAction()) return;
    const nextMap = {
      ...campusNames,
      [campus]: (campusDraftNames[campus] || campus).trim() || campus,
    };
    saveCampusLabel(campus, campusDraftNames[campus] || campus);
    try {
      await saveCampusNamesToServer(nextMap);
      setSetupMessage(`Saved ${CAMPUS_CODE[campus] || "CX"} name.`);
    } catch (err) {
      setSetupMessage(`Save failed: ${err instanceof Error ? err.message : "Cannot save campus name"}`);
    }
  }

  function addItemType() {
    if (!requireAdminAction()) return;
    const category = newItemTypeForm.category;
    const code = newItemTypeForm.code.trim().toUpperCase();
    const name = newItemTypeForm.name.trim();
    if (!category || !code || !name) {
      setError("Category, type code, and item name are required.");
      return;
    }
    const exists = (allTypeOptions[category] || []).some((item) => item.code === code);
    if (exists) {
      setError(`Type code ${code} already exists in ${category}.`);
      return;
    }
    setCustomTypeOptions((prev) => ({
      ...prev,
      [category]: [...(prev[category] || []), { itemEn: name, itemKm: name, code }],
    }));
    setItemNames((prev) => ({ ...prev, [`${category}:${code}`]: name }));
    setNewItemTypeForm({ category, code: "", name: "" });
    setSetupMessage(`Added ${category} type ${code}.`);
    setError("");
  }

  function startEditUser(user: StaffUser) {
    setEditingUserId(user.id);
    setUserForm({
      fullName: user.fullName,
      position: user.position,
      email: user.email,
    });
  }

  async function deleteUser(id: number) {
    if (!requireAdminAction()) return;
    setBusy(true);
    setError("");
    try {
      const res = await requestJson<{ ok?: boolean; users?: StaffUser[] }>(`/api/staff-users/${id}`, { method: "DELETE" });
      const returnedRows = normalizeArray<StaffUser>(res.users);
      if (returnedRows.length) {
        setUsers(returnedRows);
        writeUserFallback(returnedRows);
      } else {
        setUsers((prev) => prev.filter((u) => u.id !== id));
      }
      if (editingUserId === id) {
        setEditingUserId(null);
        setUserForm({ fullName: "", position: "", email: "" });
      }
    } catch (err) {
      if (isApiUnavailableError(err) || isMissingRouteError(err)) {
        setUsers((prev) => prev.filter((u) => u.id !== id));
        if (editingUserId === id) {
          setEditingUserId(null);
          setUserForm({ fullName: "", position: "", email: "" });
        }
        setError("");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setBusy(false);
    }
  }

  async function createTicket() {
    if (!requireAdminAction()) return;
    if (!ticketForm.title.trim() || !ticketForm.requestedBy.trim()) {
      alert(t.ticketRequired);
      return;
    }

    setBusy(true);
    setError("");
    try {
      await requestJson<{ ticket: Ticket }>("/api/tickets", {
        method: "POST",
        body: JSON.stringify(ticketForm),
      });

      setTicketForm((f) => ({
        ...f,
        assetId: "",
        title: "",
        description: "",
        requestedBy: "",
        priority: "Normal",
        status: "Open",
      }));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create ticket");
    } finally {
      setBusy(false);
    }
  }

  async function onInventoryPhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert(t.photoLimit);
      return;
    }
    try {
      const photo = await optimizeUploadPhoto(file);
      setInventoryItemForm((f) => ({ ...f, photo }));
    } catch {
      alert(t.photoProcessError);
    }
  }
  const persistInventorySettings = useCallback(
    async (nextItems: InventoryItem[], nextTxns: InventoryTxn[]) => {
      try {
        await requestJson<{ ok: boolean }>("/api/settings", {
          method: "PATCH",
          body: JSON.stringify({
            settings: {
              inventoryItems: nextItems,
              inventoryTxns: nextTxns,
            },
          }),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save inventory settings");
      }
    },
    []
  );

  function createInventoryItem() {
    if (!requireAdminAction()) return;
    const itemCode = (inventoryItemForm.itemCode.trim().toUpperCase() || autoInventoryItemCode);
    const masterItem = INVENTORY_MASTER_ITEMS.find((item) => item.key === inventoryItemForm.masterItemKey);
    const itemName = masterItem
      ? `${masterItem.nameEn}${masterItem.spec ? ` (${masterItem.spec})` : ""}`
      : inventoryItemForm.itemName.trim();
    const location = inventoryItemForm.location.trim();
    const unit = masterItem ? masterItem.unit : (inventoryItemForm.unit.trim() || "pcs");
    if (!masterItem) {
      setError("Please select item master.");
      return;
    }
    if (!itemCode || !itemName || !location) {
      setError("Item code, item master, and location are required.");
      return;
    }
    if (
      masterItem &&
      inventoryItemForm.category === "SUPPLY" &&
      inventoryItems.some(
        (i) => i.campus === inventoryItemForm.campus && inventoryItemMatchesMaster(i, masterItem)
      )
    ) {
      setError("This cleaning supply already exists in this campus.");
      return;
    }
    if (
      inventoryItems.some(
        (i) =>
          i.itemCode === itemCode &&
          inventoryRecordCampusCode(i.campus) === inventoryRecordCampusCode(inventoryItemForm.campus)
      )
    ) {
      setError("Item code already exists in this campus group.");
      return;
    }
    const row: InventoryItem = {
      id: Date.now(),
      campus: inventoryItemForm.campus,
      category: inventoryItemForm.category,
      itemCode,
      itemName,
      unit,
      openingQty: Math.max(0, Number(inventoryItemForm.openingQty || 0)),
      minStock: Math.max(0, Number(inventoryItemForm.minStock || 0)),
      location,
      vendor: inventoryItemForm.vendor.trim(),
      notes: inventoryItemForm.notes.trim(),
      photo: inventoryItemForm.photo || "",
      created: new Date().toISOString(),
    };
    const nextItems = [row, ...inventoryItems];
    setInventoryItems(nextItems);
    void persistInventorySettings(nextItems, inventoryTxns);
    appendUiAudit("CREATE", "inventory_item", row.itemCode, `${row.campus} | ${row.itemName}`);
    setInventoryCodeManual(false);
    setInventoryItemForm((f) => ({
      ...f,
      itemCode: "",
      masterItemKey: "",
      itemName: "",
      openingQty: "",
      minStock: "",
      location: inventoryLocations[0]?.name || "",
      vendor: "",
      notes: "",
      photo: "",
    }));
    setInventoryItemFileKey((k) => k + 1);
    setError("");
  }

  function deleteInventoryItem(row: (typeof inventoryBalanceRows)[number]) {
    if (!requireAdminAction()) return;
    const hasTxnHistory = inventoryTxns.some((tx) => tx.itemId === row.id);
    if (hasTxnHistory) {
      setError("Cannot delete item with transaction history. Delete transactions first.");
      return;
    }
    if (!window.confirm(`Delete item ${row.itemCode} - ${row.itemName}?`)) return;
    const nextItems = inventoryItems.filter((item) => item.id !== row.id);
    setInventoryItems(nextItems);
    void persistInventorySettings(nextItems, inventoryTxns);
    appendUiAudit("DELETE", "inventory_item", row.itemCode, `${row.campus} | ${row.itemName}`);
    setError("");
  }

  function saveInventoryTxnEntry(values: {
    itemId: string;
    date: string;
    type: InventoryTxn["type"];
    qty: string;
    by: string;
    note: string;
    photo?: string;
    requirePhoto?: boolean;
    fromCampus?: string;
    toCampus?: string;
    expectedReturnDate?: string;
    requestedBy?: string;
    approvedBy?: string;
    receivedBy?: string;
  }) {
    const itemId = Number(values.itemId);
    const qty = Math.max(0, Number(values.qty || 0));
    if (!itemId || !values.date || qty <= 0) {
      setError("Please select item, date, and quantity.");
      return false;
    }
    const item = inventoryVisibleItems.find((i) => i.id === itemId);
    if (!item) {
      setError("Item not found.");
      return false;
    }
    const cleanedPhoto = String(values.photo || "").trim();
    if (values.requirePhoto && isInventoryTxnUsageOut(values.type) && !cleanedPhoto) {
      setError("Please take photo for stock-out record.");
      return false;
    }
    const txDate = normalizeYmdInput(values.date);
    const holidayName = txDate ? getHolidayName(txDate) : "";
    const day = txDate ? new Date(`${txDate}T00:00:00`).getDay() : -1;
    const isWeekend = day === 0 || day === 6;
    const needsNonWorkingCheck =
      isInventoryTxnUsageOut(values.type) &&
      item.category === "SUPPLY" &&
      Boolean(txDate) &&
      (isWeekend || Boolean(holidayName));
    if (needsNonWorkingCheck) {
      if (!String(values.note || "").trim()) {
        setError("Weekend/Holiday stock out requires note.");
        return false;
      }
      const dayType = holidayName ? `Holiday (${holidayName})` : "Weekend";
      const ok = window.confirm(`Stock OUT on ${dayType} - ${txDate}. Confirm record?`);
      if (!ok) return false;
    }
    const inQty = inventoryVisibleTxns
      .filter((x) => x.itemId === itemId && isInventoryTxnIn(x.type))
      .reduce((a, b) => a + b.qty, 0);
    const outQty = inventoryVisibleTxns
      .filter((x) => x.itemId === itemId && isInventoryTxnOut(x.type))
      .reduce((a, b) => a + b.qty, 0);
    const currentStock = Number(item.openingQty || 0) + inQty - outQty;
    if (isInventoryTxnOut(values.type) && qty > currentStock) {
      setError(`Not enough stock. Current: ${currentStock}`);
      return false;
    }
    const fromCampus = String(values.fromCampus || "").trim();
    const toCampus = String(values.toCampus || "").trim();
    const expectedReturnDate = String(values.expectedReturnDate || "").trim();
    const requestedBy = String(values.requestedBy || "").trim();
    const approvedBy = String(values.approvedBy || "").trim();
    const receivedBy = String(values.receivedBy || "").trim();
    if (values.type === "BORROW_OUT" || values.type === "BORROW_CONSUME") {
      if (!toCampus || !requestedBy || !approvedBy) {
        setError("Borrow Out/Consume requires destination campus, requested by, and approved by.");
        return false;
      }
      if (toCampus === item.campus) {
        setError("Destination campus must be different from source campus.");
        return false;
      }
    }
    if (values.type === "BORROW_IN") {
      if (!fromCampus || !receivedBy) {
        setError("Borrow Return requires source campus and received by.");
        return false;
      }
      if (fromCampus === item.campus) {
        setError("Source campus must be different from current campus.");
        return false;
      }
    }
    const tx: InventoryTxn = {
      id: Date.now(),
      itemId: item.id,
      campus: item.campus,
      itemCode: item.itemCode,
      itemName: item.itemName,
      date: values.date,
      type: values.type,
      qty,
      by: values.by.trim(),
      note: values.note.trim(),
      fromCampus: values.type === "BORROW_IN" ? fromCampus : item.campus,
      toCampus: values.type === "BORROW_OUT" || values.type === "BORROW_CONSUME" ? toCampus : item.campus,
      expectedReturnDate: values.type === "BORROW_OUT" ? expectedReturnDate : "",
      requestedBy,
      approvedBy,
      receivedBy,
      photo: cleanedPhoto,
      borrowStatus:
        values.type === "BORROW_OUT"
          ? "BORROW_OPEN"
          : values.type === "BORROW_IN"
            ? "CLOSED"
            : values.type === "BORROW_CONSUME"
              ? "CONSUMED"
              : undefined,
    };
    const nextTxns = [tx, ...inventoryTxns];
    setInventoryTxns(nextTxns);
    void persistInventorySettings(inventoryItems, nextTxns);
    appendUiAudit("CREATE", "inventory_txn", `${item.itemCode}-${tx.id}`, `${tx.type} ${tx.qty} ${item.unit}`);
    setError("");
    return true;
  }

  function createInventoryTxn() {
    if (!requireAdminAction()) return;
    const saved = saveInventoryTxnEntry({
      itemId: inventoryTxnForm.itemId,
      date: inventoryTxnForm.date,
      type: inventoryTxnForm.type,
      qty: inventoryTxnForm.qty,
      by: inventoryTxnForm.by,
      note: inventoryTxnForm.note,
      fromCampus: inventoryTxnForm.fromCampus,
      toCampus: inventoryTxnForm.toCampus,
      expectedReturnDate: inventoryTxnForm.expectedReturnDate,
      requestedBy: inventoryTxnForm.requestedBy,
      approvedBy: inventoryTxnForm.approvedBy,
      receivedBy: inventoryTxnForm.receivedBy,
    });
    if (!saved) return;
    setInventoryTxnForm({
      itemId: "",
      date: toYmd(new Date()),
      type: "IN",
      qty: "",
      by: authUser?.displayName || authUser?.username || "",
      note: "",
      fromCampus: "",
      toCampus: "",
      expectedReturnDate: "",
      requestedBy: "",
      approvedBy: "",
      receivedBy: "",
    });
  }

  function createInventoryDailyTxn() {
    const saved = saveInventoryTxnEntry({
      itemId: inventoryDailyForm.itemId,
      date: inventoryDailyForm.date,
      type: inventoryDailyForm.type,
      qty: inventoryDailyForm.qty,
      by: inventoryDailyForm.by,
      note: inventoryDailyForm.note,
    });
    if (!saved) return;
    setInventoryDailyForm((prev) => ({
      ...prev,
      itemId: "",
      qty: "",
      note: "",
      by: authUser?.displayName || authUser?.username || prev.by,
    }));
  }
  function closeInventoryQuickOut() {
    setInventoryQuickOutModal(null);
    setInventoryQuickReasonTipsOpen(false);
    setQuickOutEcoPickerOpen(false);
    setInventoryQuickOutFileKey((k) => k + 1);
  }
  async function copyMaintenanceQuickLink() {
    if (!maintenanceQuickLink) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(maintenanceQuickLink);
        alert("Maintenance quick link copied.");
        return;
      }
    } catch {
      // fallback below
    }
    window.prompt("Copy maintenance quick link", maintenanceQuickLink);
  }
  function openInventoryQuickOut(item: InventoryItem) {
    const recorder = authUser?.displayName || authUser?.username || "";
    const baseDate = normalizeYmdInput(inventoryDailyForm.date || toYmd(new Date())) || toYmd(new Date());
    const base = new Date(`${baseDate}T00:00:00`);
    setInventoryDailyForm((prev) => ({ ...prev, type: "OUT", itemId: String(item.id) }));
    setInventoryQuickOutModal({
      itemId: String(item.id),
      date: baseDate,
      qty: "",
      by: recorder,
      note: "",
      photo: "",
    });
    setQuickOutEcoMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    setQuickOutEcoSelectedDate(baseDate);
    setQuickOutEcoPickerOpen(false);
    setInventoryQuickReasonTipsOpen(false);
    setInventoryQuickOutFileKey((k) => k + 1);
  }
  function openQuickOutEcoPicker() {
    const baseDate = normalizeYmdInput(inventoryQuickOutModal?.date || toYmd(new Date())) || toYmd(new Date());
    const base = new Date(`${baseDate}T00:00:00`);
    setQuickOutEcoMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    setQuickOutEcoSelectedDate(baseDate);
    setQuickOutEcoPickerOpen(true);
  }
  async function onInventoryQuickOutPhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert(t.photoLimit);
      return;
    }
    try {
      const photo = await optimizeUploadPhoto(file);
      setInventoryQuickOutModal((prev) => (prev ? { ...prev, photo } : prev));
    } catch {
      alert(t.photoProcessError);
    }
  }
  function saveInventoryQuickOut() {
    if (!inventoryQuickOutModal) return;
    const recorder = authUser?.displayName || authUser?.username || "";
    const reason = inventoryQuickOutModal.note.trim();
    if (!reason) {
      setError("Please enter reason for stock-out.");
      return;
    }
    const saved = saveInventoryTxnEntry({
      itemId: inventoryQuickOutModal.itemId,
      date: inventoryQuickOutModal.date,
      type: "OUT",
      qty: inventoryQuickOutModal.qty,
      by: recorder,
      note: reason,
      photo: inventoryQuickOutModal.photo,
      requirePhoto: true,
    });
    if (!saved) return;
    setInventoryDailyForm((prev) => ({
      ...prev,
      type: "OUT",
      itemId: inventoryQuickOutModal.itemId,
      date: inventoryQuickOutModal.date,
      by: recorder || prev.by,
      qty: "",
      note: "",
    }));
    closeInventoryQuickOut();
  }

  function exportPurchaseRequestCsv() {
    if (!inventoryPurchaseRows.length) {
      alert(lang === "km" ? "មិនមានទិន្នន័យសម្រាប់ Export" : "No purchase summary rows to export.");
      return;
    }
    const headers = [
      "Item Code",
      "Item Name",
      "Campus",
      "Category",
      "Unit",
      "Used Qty (Period)",
      "Current Stock",
      "Min Stock",
      "Suggested Qty",
      "Period",
    ];
    const escapeCsvCell = (value: string | number) => {
      const text = String(value ?? "");
      if (!/[",\n]/.test(text)) return text;
      return `"${text.replace(/"/g, "\"\"")}"`;
    };
    const lines = [
      headers.join(","),
      ...inventoryPurchaseRows.map((row) =>
        [
          row.itemCode,
          row.itemName,
          inventoryCampusLabel(row.campus),
          row.category,
          row.unit,
          row.usedQty,
          row.currentStock,
          row.minStock,
          row.suggestedQty,
          inventoryPurchaseWindow.label,
        ]
          .map(escapeCsvCell)
          .join(",")
      ),
    ];
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `purchase-request-${inventoryPurchaseWindow.startYmd}-to-${inventoryPurchaseWindow.endYmd}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function printPurchaseRequest() {
    if (!inventoryPurchaseRows.length) {
      alert(lang === "km" ? "មិនមានទិន្នន័យសម្រាប់បោះពុម្ព" : "No purchase summary rows to print.");
      return;
    }
    const title = lang === "km" ? "សំណើទិញសម្ភារៈប្រចាំខែ" : "Monthly Purchase Request";
    const generatedAt = formatDate(new Date().toISOString());
    const rowsHtml = inventoryPurchaseRows
      .map(
        (row) => `<tr>
          <td>${escapeHtml(row.itemCode)}</td>
          <td>${escapeHtml(row.itemName)}</td>
          <td>${escapeHtml(inventoryCampusLabel(row.campus))}</td>
          <td>${escapeHtml(row.category)}</td>
          <td>${escapeHtml(row.unit)}</td>
          <td>${row.usedQty}</td>
          <td>${row.currentStock}</td>
          <td>${row.minStock}</td>
          <td><strong>${row.suggestedQty}</strong></td>
        </tr>`
      )
      .join("");
    const html = `
      <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: "Segoe UI", Arial, sans-serif; margin: 18px; color: #1c2e4f; }
          h1 { margin: 0 0 8px; font-size: 24px; }
          p.meta { margin: 0 0 12px; color: #4e6287; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #c9d8ed; padding: 7px 8px; font-size: 12px; text-align: left; }
          th { background: #edf4ff; text-transform: uppercase; letter-spacing: 0.03em; }
          .summary { margin: 8px 0 0; color: #3f557e; }
          @page { size: A4 landscape; margin: 8mm; }
          @media print { body { margin: 8mm; } }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <p class="meta">Generated: ${escapeHtml(generatedAt)} | Period: ${escapeHtml(inventoryPurchaseWindow.label)}</p>
        <p class="summary"><strong>Total Items:</strong> ${inventoryPurchaseRows.length}</p>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Campus</th>
              <th>Category</th>
              <th>Unit</th>
              <th>Used Qty</th>
              <th>Current</th>
              <th>Min</th>
              <th>Suggested</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body>
      </html>
    `;
    const win = window.open("", "_blank", "width=1200,height=800");
    if (!win) {
      alert(lang === "km" ? "សូមអនុញ្ញាត pop-up សិន" : "Unable to open print window. Please allow pop-ups.");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  function startInventoryTxnEdit(row: InventoryTxn) {
    setEditingInventoryTxnId(row.id);
    setInventoryTxnEditForm({
      itemId: String(row.itemId),
      date: row.date,
      type: row.type,
      qty: String(row.qty),
      by: row.by || "",
      note: row.note || "",
    });
    setError("");
  }

  function cancelInventoryTxnEdit() {
    setEditingInventoryTxnId(null);
    setInventoryTxnEditForm({
      itemId: "",
      date: toYmd(new Date()),
      type: "IN",
      qty: "",
      by: "",
      note: "",
    });
  }

  function updateInventoryTxn() {
    if (!requireAdminAction()) return;
    if (editingInventoryTxnId === null) return;

    const itemId = Number(inventoryTxnEditForm.itemId);
    const qty = Math.max(0, Number(inventoryTxnEditForm.qty || 0));
    if (!itemId || !inventoryTxnEditForm.date || qty <= 0) {
      setError("Please select item, date, and quantity.");
      return;
    }

    const item = inventoryVisibleItems.find((i) => i.id === itemId);
    if (!item) {
      setError("Item not found.");
      return;
    }

    const currentRow = inventoryVisibleTxns.find((x) => x.id === editingInventoryTxnId);
    if (!currentRow) {
      setError("Transaction not found.");
      return;
    }

    const rowsWithoutCurrent = inventoryVisibleTxns.filter((x) => x.id !== editingInventoryTxnId);
    const inQty = rowsWithoutCurrent
      .filter((x) => x.itemId === itemId && isInventoryTxnIn(x.type))
      .reduce((a, b) => a + b.qty, 0);
    const outQty = rowsWithoutCurrent
      .filter((x) => x.itemId === itemId && isInventoryTxnOut(x.type))
      .reduce((a, b) => a + b.qty, 0);
    const currentStock = Number(item.openingQty || 0) + inQty - outQty;
    if (isInventoryTxnOut(inventoryTxnEditForm.type) && qty > currentStock) {
      setError(`Not enough stock. Current: ${currentStock}`);
      return;
    }

    const nextTxns = inventoryTxns.map((x) =>
        x.id === editingInventoryTxnId
          ? {
              ...x,
              itemId: item.id,
              campus: item.campus,
              itemCode: item.itemCode,
              itemName: item.itemName,
              date: inventoryTxnEditForm.date,
              type: inventoryTxnEditForm.type,
              qty,
              by: inventoryTxnEditForm.by.trim(),
              note: inventoryTxnEditForm.note.trim(),
              borrowStatus:
                inventoryTxnEditForm.type === "BORROW_OUT"
                  ? (x.borrowStatus || "BORROW_OPEN")
                  : inventoryTxnEditForm.type === "BORROW_IN"
                    ? "CLOSED"
                    : inventoryTxnEditForm.type === "BORROW_CONSUME"
                      ? "CONSUMED"
                      : undefined,
            }
          : x
      );
    setInventoryTxns(nextTxns);
    void persistInventorySettings(inventoryItems, nextTxns);
    appendUiAudit(
      "UPDATE",
      "inventory_txn",
      `${item.itemCode}-${editingInventoryTxnId}`,
      `${currentRow.type} ${currentRow.qty} -> ${inventoryTxnEditForm.type} ${qty}`
    );
    cancelInventoryTxnEdit();
    setError("");
  }

  function deleteInventoryTxn(row: InventoryTxn) {
    if (!requireAdminAction()) return;
    if (!window.confirm("Delete this transaction?")) return;

    const item = inventoryVisibleItems.find((i) => i.id === row.itemId);
    if (!item) {
      setError("Item not found.");
      return;
    }

    if (isInventoryTxnIn(row.type)) {
      const rowsWithoutCurrent = inventoryTxns.filter((x) => x.id !== row.id);
      const inQty = rowsWithoutCurrent
        .filter((x) => x.itemId === row.itemId && isInventoryTxnIn(x.type))
        .reduce((a, b) => a + b.qty, 0);
      const outQty = rowsWithoutCurrent
        .filter((x) => x.itemId === row.itemId && isInventoryTxnOut(x.type))
        .reduce((a, b) => a + b.qty, 0);
      const currentStock = Number(item.openingQty || 0) + inQty - outQty;
      if (currentStock < 0) {
        setError("Cannot delete this transaction because it would make stock negative.");
        return;
      }
    }

    const nextTxns = inventoryTxns.filter((x) => x.id !== row.id);
    setInventoryTxns(nextTxns);
    void persistInventorySettings(inventoryItems, nextTxns);
    if (editingInventoryTxnId === row.id) {
      cancelInventoryTxnEdit();
    }
    appendUiAudit("DELETE", "inventory_txn", `${row.itemCode}-${row.id}`, `${row.type} ${row.qty}`);
    setError("");
  }

  async function createOrUpdateLocation() {
    if (!requireAdminAction()) return;
    if (!locationName.trim()) {
      alert(`${t.locationName} is required.`);
      return;
    }

    setBusy(true);
    setError("");
    try {
      let nextLocal = readLocationFallback();
      try {
        if (editingLocationId) {
          await requestJson<{ location: LocationEntry }>(`/api/locations/${editingLocationId}`, {
            method: "PATCH",
            body: JSON.stringify({ campus: locationCampus, name: locationName.trim() }),
          });
        } else {
          await requestJson<{ location: LocationEntry }>("/api/locations", {
            method: "POST",
            body: JSON.stringify({ campus: locationCampus, name: locationName.trim() }),
          });
        }
        if (editingLocationId) {
          nextLocal = nextLocal.map((loc) =>
            loc.id === editingLocationId
              ? { ...loc, campus: locationCampus, name: locationName.trim() }
              : loc
          );
        } else {
          nextLocal = [
            { id: Date.now(), campus: locationCampus, name: locationName.trim() },
            ...nextLocal,
          ];
        }
      } catch (err) {
        if (!isMissingRouteError(err)) throw err;
        const current = readLocationFallback();
        if (editingLocationId) {
          nextLocal = current.map((loc) =>
            loc.id === editingLocationId
              ? { ...loc, campus: locationCampus, name: locationName.trim() }
              : loc
          );
        } else {
          nextLocal = [
            { id: Date.now(), campus: locationCampus, name: locationName.trim() },
            ...current,
          ];
        }
      }
      nextLocal = mergeLocations(nextLocal, []);
      writeLocationFallback(nextLocal);
      setLocations(nextLocal);
      appendUiAudit(
        editingLocationId ? "UPDATE" : "CREATE",
        "location",
        editingLocationId ? String(editingLocationId) : String(nextLocal[0]?.id || ""),
        `${locationCampus} | ${locationName.trim()}`
      );

      setLocationName("");
      setEditingLocationId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save location");
    } finally {
      setBusy(false);
    }
  }

  function startEditLocation(location: LocationEntry) {
    setEditingLocationId(location.id);
    setLocationCampus(location.campus);
    setLocationName(location.name);
  }

  function cancelEditLocation() {
    setEditingLocationId(null);
    setLocationName("");
  }

  async function deleteLocation(id: number) {
    if (!requireAdminAction()) return;
    if (!window.confirm(t.deleteLocationConfirm)) return;

    setBusy(true);
    setError("");
    try {
      let nextLocal = readLocationFallback();
      try {
        await requestJson<{ ok: boolean }>(`/api/locations/${id}`, { method: "DELETE" });
        nextLocal = nextLocal.filter((loc) => loc.id !== id);
      } catch (err) {
        if (!isMissingRouteError(err)) throw err;
        nextLocal = nextLocal.filter((loc) => loc.id !== id);
      }
      writeLocationFallback(nextLocal);
      setLocations(nextLocal);
      appendUiAudit("DELETE", "location", String(id), "Location deleted");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete location");
    } finally {
      setBusy(false);
    }
  }

  async function removeAsset(id: number) {
    if (!requireAdminAction()) return;
    if (!window.confirm(t.deleteConfirm)) return;

    setBusy(true);
    setError("");
    try {
      let nextLocal = readAssetFallback();
      try {
        await requestJson<{ ok: boolean }>(`/api/assets/${id}`, { method: "DELETE" });
        nextLocal = nextLocal.filter((a) => a.id !== id);
      } catch (err) {
        if (!isApiUnavailableError(err)) throw err;
        nextLocal = nextLocal.filter((a) => a.id !== id);
      }
      writeAssetFallback(nextLocal);
      setAssets(
        filterAssets(nextLocal, effectiveAssetCampusFilter, assetCategoryFilter, assetNameFilter, search)
      );
      setStats(buildStatsFromAssets(nextLocal, campusFilter));
      appendUiAudit("DELETE", "asset", String(id), "Asset deleted");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete asset");
    } finally {
      setBusy(false);
    }
  }

  function startEditAsset(asset: Asset) {
    setEditingAssetId(asset.id);
    const photos = normalizeAssetPhotos(asset);
    setAssetEditForm({
      location: asset.location || "",
      pcType: asset.category === "IT" && asset.type === DESKTOP_PARENT_TYPE
        ? asset.pcType || PC_TYPE_OPTIONS[0].value
        : "",
      setCode: asset.setCode || "",
      parentAssetId: asset.parentAssetId || "",
      useExistingSet: canLinkToParentAsset(asset.type) && !!asset.parentAssetId,
      componentRole: asset.componentRole || "",
      componentRequired: Boolean(asset.componentRequired),
      assignedTo: asset.assignedTo || "",
      brand: asset.brand || "",
      model: asset.model || "",
      serialNumber: asset.serialNumber || "",
      specs: asset.specs || "",
      purchaseDate: asset.purchaseDate || "",
      warrantyUntil: asset.warrantyUntil || "",
      vendor: asset.vendor || "",
      notes: asset.notes || "",
      photo: photos[0] || "",
      photos,
      status: asset.status || "Active",
    });
    setEditAssetFileKey((k) => k + 1);
  }

  function cancelEditAsset() {
    setEditingAssetId(null);
  }

  async function editOrCreateSetPackChild(type: SetPackChildType) {
    if (!editingAsset) return;
    const existing = editingSetPackChildren[type];
    if (existing) {
      startEditAsset(existing);
      return;
    }
    if (!requireAdminAction()) return;
    if (!(editingAsset.category === "IT" && editingAsset.type === DESKTOP_PARENT_TYPE)) return;

    const payload = {
      campus: editingAsset.campus,
      category: "IT",
      type: setPackAssetType(type),
      location: editingAsset.location,
      setCode: editingAsset.setCode || "",
      parentAssetId: editingAsset.assetId,
      assignedTo: "",
      custodyStatus: "IN_STOCK",
      brand: "",
      model: "",
      serialNumber: "",
      specs: "",
      purchaseDate: "",
      warrantyUntil: "",
      vendor: "",
      notes: `Linked to set ${editingAsset.assetId}`,
      nextMaintenanceDate: "",
      scheduleNote: "",
      photo: "",
      photos: [],
      status: editingAsset.status || "Active",
    };

    setBusy(true);
    setError("");
    try {
      let childAsset: Asset | null = null;
      try {
        const created = await requestJson<{ asset: Asset }>("/api/assets", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        childAsset = created.asset;
      } catch (err) {
        if (!isApiUnavailableError(err) && !isMissingRouteError(err)) throw err;
        const allLocal = readAssetFallback();
        const seq = calcNextSeq(allLocal, payload.campus, payload.category, payload.type);
        childAsset = {
          id: Date.now(),
          campus: payload.campus,
          category: payload.category,
          type: payload.type,
          pcType: "",
          seq,
          assetId: `${CAMPUS_CODE[payload.campus] || "CX"}-${categoryCode(payload.category)}-${payload.type}-${pad4(seq)}`,
          name: assetItemName(payload.category, payload.type),
          location: payload.location,
          setCode: payload.setCode,
          parentAssetId: payload.parentAssetId,
          assignedTo: payload.assignedTo,
          custodyStatus: "IN_STOCK",
          brand: payload.brand,
          model: payload.model,
          serialNumber: payload.serialNumber,
          specs: payload.specs,
          purchaseDate: payload.purchaseDate,
          warrantyUntil: payload.warrantyUntil,
          vendor: payload.vendor,
          notes: payload.notes,
          nextMaintenanceDate: payload.nextMaintenanceDate,
          nextVerificationDate: "",
          verificationFrequency: "NONE",
          scheduleNote: payload.scheduleNote,
          repeatMode: "NONE",
          repeatWeekOfMonth: 0,
          repeatWeekday: 0,
          maintenanceHistory: [],
          verificationHistory: [],
          transferHistory: [],
          custodyHistory: [],
          statusHistory: [
            {
              id: Date.now(),
              date: new Date().toISOString(),
              fromStatus: "New",
              toStatus: payload.status,
              reason: "Asset created from set pack in edit",
            },
          ],
          photo: "",
          photos: [],
          status: payload.status,
          created: new Date().toISOString(),
        };
        const nextLocal = [childAsset, ...allLocal];
        writeAssetFallback(nextLocal);
        setAssets(nextLocal);
        setStats(buildStatsFromAssets(nextLocal, campusFilter));
      }

      if (childAsset) {
        appendUiAudit("CREATE", "asset", childAsset.assetId, `${childAsset.campus} | ${childAsset.location}`);
        startEditAsset(childAsset);
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create set pack child");
    } finally {
      setBusy(false);
    }
  }

  async function onEditAssetPhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (files.some((file) => file.size > 15 * 1024 * 1024)) {
      alert(t.photoLimit);
      e.target.value = "";
      return;
    }
    try {
      const optimized = await Promise.all(files.map((file) => optimizeUploadPhoto(file)));
      setAssetEditForm((f) => {
        const merged = normalizeAssetPhotos({
          photo: f.photo,
          photos: [...(f.photos || []), ...optimized],
        });
        return { ...f, photo: merged[0] || "", photos: merged };
      });
    } catch {
      alert(t.photoProcessError);
    } finally {
      e.target.value = "";
    }
  }

  async function updateAsset() {
    if (!requireAdminAction()) return;
    if (editingAssetId === null) return;
    if (!assetEditForm.location.trim()) {
      alert(t.locationRequired);
      return;
    }

    const editingAsset = assets.find((a) => a.id === editingAssetId);
    const editingIsDesktop =
      !!editingAsset && editingAsset.category === "IT" && editingAsset.type === DESKTOP_PARENT_TYPE;
    const editingIsLinkable =
      !!editingAsset && canLinkToParentAsset(editingAsset.type);
    const needsUser =
      !!editingAsset &&
      USER_REQUIRED_TYPES.includes(editingAsset.type) &&
      !isSharedLocation(assetEditForm.location);
    if (needsUser && !assetEditForm.assignedTo.trim()) {
      alert(t.userRequired);
      return;
    }
    if (editingIsLinkable && assetEditForm.useExistingSet && !assetEditForm.parentAssetId.trim()) {
      alert(t.selectParentAsset);
      return;
    }
    if (editingIsDesktop && !assetEditForm.pcType.trim()) {
      alert(t.pcTypeRequired);
      return;
    }

    const payload = {
      location: assetEditForm.location.trim(),
      pcType: editingIsDesktop ? assetEditForm.pcType.trim() : "",
      setCode: editingIsDesktop
        ? assetEditForm.setCode.trim()
        : (editingIsLinkable && assetEditForm.useExistingSet ? assetEditForm.setCode.trim() : ""),
      parentAssetId: editingIsDesktop
        ? ""
        : (editingIsLinkable && assetEditForm.useExistingSet ? assetEditForm.parentAssetId.trim().toUpperCase() : ""),
      componentRole: assetEditForm.componentRole.trim(),
      componentRequired: Boolean(assetEditForm.componentRequired),
      assignedTo: assetEditForm.assignedTo.trim(),
      brand: assetEditForm.brand.trim(),
      model: assetEditForm.model.trim(),
      serialNumber: assetEditForm.serialNumber.trim(),
      specs: assetEditForm.specs.trim(),
      purchaseDate: assetEditForm.purchaseDate.trim(),
      warrantyUntil: assetEditForm.warrantyUntil.trim(),
      vendor: assetEditForm.vendor.trim(),
      notes: assetEditForm.notes.trim(),
      photo: assetEditForm.photo || "",
      photos: normalizeAssetPhotos(assetEditForm),
      status: assetEditForm.status,
    };

    setBusy(true);
    setError("");
    try {
      let nextLocal = readAssetFallback().map((a) => {
        if (a.id !== editingAssetId) return a;
        const statusChanged = (a.status || "Active") !== payload.status;
        const fromUser = String(a.assignedTo || "").trim();
        const toUser = String(payload.assignedTo || "").trim();
        const assignmentChanged = fromUser !== toUser;
        const statusHistory = statusChanged
          ? [
              {
                id: Date.now(),
                date: new Date().toISOString(),
                fromStatus: a.status || "Active",
                toStatus: payload.status,
                reason: "Updated from asset edit",
              },
              ...(a.statusHistory || []),
            ]
          : a.statusHistory || [];
        const custodyHistory = assignmentChanged
          ? [
              {
                id: Date.now() + 1,
                date: new Date().toISOString(),
                action: toUser ? "ASSIGN" : "UNASSIGN",
                fromCampus: a.campus,
                fromLocation: a.location,
                toCampus: a.campus,
                toLocation: payload.location,
                fromUser,
                toUser,
                responsibilityAck: false,
                by: authUser?.displayName || "",
                note: "Assignment changed from asset edit",
              },
              ...(a.custodyHistory || []),
            ]
          : (a.custodyHistory || []);
        const custodyStatus: Asset["custodyStatus"] = toUser ? "ASSIGNED" : "IN_STOCK";
        const normalizedPhotos = normalizeAssetPhotos(payload);
        return {
          ...a,
          ...payload,
          custodyStatus,
          custodyHistory,
          photo: normalizedPhotos[0] || "",
          photos: normalizedPhotos,
          statusHistory,
        };
      });
      try {
        await requestJson<{ asset: Asset }>(`/api/assets/${editingAssetId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } catch (err) {
        if (!isApiUnavailableError(err) && !isMissingRouteError(err)) throw err;
      }

      writeAssetFallback(nextLocal);
      setAssets(nextLocal);
      setStats(buildStatsFromAssets(nextLocal, campusFilter));
      appendUiAudit("UPDATE", "asset", String(editingAssetId), `location=${payload.location}`);
      setEditingAssetId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update asset");
    } finally {
      setBusy(false);
    }
  }

  async function saveMaintenanceSchedule() {
    if (!requireAdminAction()) return;
    if (!scheduleForm.assetId) {
      setError("Please select an asset first.");
      return;
    }
    const normalizedDate =
      scheduleForm.repeatMode === "NONE" ? normalizeYmdInput(scheduleForm.date) : "";
    if (scheduleForm.repeatMode === "NONE" && !normalizedDate) {
      setError("Please select a valid date (YYYY-MM-DD).");
      return;
    }
    if (scheduleForm.repeatMode === "NONE" && normalizedDate < todayYmd) {
      setError("Cannot set schedule to a past date.");
      return;
    }
    const assetId = Number(scheduleForm.assetId);
    if (!assetId) return;

    const payload = {
      nextMaintenanceDate: normalizedDate,
      scheduleNote: scheduleForm.note.trim(),
      repeatMode: scheduleForm.repeatMode,
      repeatWeekOfMonth:
        scheduleForm.repeatMode === "MONTHLY_WEEKDAY"
          ? Number(scheduleForm.repeatWeekOfMonth)
          : 0,
      repeatWeekday:
        scheduleForm.repeatMode === "MONTHLY_WEEKDAY"
          ? Number(scheduleForm.repeatWeekday)
          : 0,
    };

    setBusy(true);
    setError("");
    try {
      let nextLocal = assets.map((asset) =>
        asset.id === assetId ? { ...asset, ...payload } : asset
      );
      try {
        await requestJson<{ asset: Asset }>(`/api/assets/${assetId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } catch (err) {
        if (!isApiUnavailableError(err)) throw err;
      }
      writeAssetFallback(nextLocal);
      setAssets(nextLocal);
      setStats(buildStatsFromAssets(nextLocal, campusFilter));
      appendUiAudit("SCHEDULE_UPDATE", "asset", String(assetId), payload.nextMaintenanceDate || "repeat schedule");
      const savedAsset = nextLocal.find((asset) => asset.id === assetId);
      setSetupMessage(
        `Schedule saved: ${savedAsset?.assetId || assetId} -> ${
          payload.nextMaintenanceDate || `${scheduleForm.repeatMode} (repeat)`
        }`
      );
      setScheduleForm((f) => ({
        ...f,
        note: "",
        date: "",
      }));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save schedule");
    } finally {
      setBusy(false);
    }
  }

  function openQuickScheduleCreate(ymd: string) {
    setSelectedCalendarDate(ymd);
    if (!isAdmin) return;
    const dateObj = new Date(`${ymd}T00:00:00`);
    const computedWeekOfMonth = Number.isFinite(dateObj.getTime())
      ? Math.max(1, Math.min(5, Math.floor((dateObj.getDate() - 1) / 7) + 1))
      : 1;
    const computedWeekday = Number.isFinite(dateObj.getTime()) ? dateObj.getDay() : 6;
    setScheduleQuickForm({
      assetId: "",
      date: ymd,
      note: "",
      repeatMode: "NONE",
      repeatWeekOfMonth: computedWeekOfMonth,
      repeatWeekday: computedWeekday,
    });
    setScheduleQuickFilterCampus("ALL");
    setScheduleQuickFilterLocation("ALL");
    setScheduleQuickFilterCategory("ALL");
    setScheduleQuickFilterName("ALL");
    setScheduleQuickCreateOpen(true);
  }

  async function saveQuickScheduleFromCalendar() {
    if (!requireAdminAction()) return;
    if (!scheduleQuickForm.assetId) {
      setError("Please select an asset first.");
      return;
    }
    const normalizedDate =
      scheduleQuickForm.repeatMode === "NONE" ? normalizeYmdInput(scheduleQuickForm.date) : "";
    if (scheduleQuickForm.repeatMode === "NONE" && !normalizedDate) {
      setError("Please select a valid date (YYYY-MM-DD).");
      return;
    }
    if (scheduleQuickForm.repeatMode === "NONE" && normalizedDate < todayYmd) {
      setError("Cannot set schedule to a past date.");
      return;
    }
    const assetId = Number(scheduleQuickForm.assetId);
    if (!assetId) return;

    const payload = {
      nextMaintenanceDate: normalizedDate,
      scheduleNote: scheduleQuickForm.note.trim(),
      repeatMode: scheduleQuickForm.repeatMode,
      repeatWeekOfMonth:
        scheduleQuickForm.repeatMode === "MONTHLY_WEEKDAY"
          ? Number(scheduleQuickForm.repeatWeekOfMonth)
          : 0,
      repeatWeekday:
        scheduleQuickForm.repeatMode === "MONTHLY_WEEKDAY"
          ? Number(scheduleQuickForm.repeatWeekday)
          : 0,
    };

    setBusy(true);
    setError("");
    try {
      const nextLocal = assets.map((asset) =>
        asset.id === assetId ? { ...asset, ...payload } : asset
      );
      try {
        await requestJson<{ asset: Asset }>(`/api/assets/${assetId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } catch (err) {
        if (!isApiUnavailableError(err)) throw err;
      }
      writeAssetFallback(nextLocal);
      setAssets(nextLocal);
      setStats(buildStatsFromAssets(nextLocal, campusFilter));
      appendUiAudit(
        "SCHEDULE_UPDATE",
        "asset",
        String(assetId),
        payload.nextMaintenanceDate || `${payload.repeatMode} quick-create`
      );
      setScheduleQuickCreateOpen(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save schedule");
    } finally {
      setBusy(false);
    }
  }

  function editScheduleForAsset(asset: Asset) {
    if (!requireAdminAction()) return;
    setScheduleForm((f) => ({
      ...f,
      assetId: String(asset.id),
      date: asset.nextMaintenanceDate || "",
      note: asset.scheduleNote || "",
      repeatMode: asset.repeatMode || "NONE",
      repeatWeekOfMonth: Number(asset.repeatWeekOfMonth || 1),
      repeatWeekday: Number(asset.repeatWeekday || 6),
    }));
    setScheduleView("single");
  }

  async function clearScheduleForAsset(assetId: number, skipConfirm = false) {
    if (!requireAdminAction()) return;
    if (!skipConfirm && !window.confirm("Delete schedule for this asset?")) return;

    const payload = {
      nextMaintenanceDate: "",
      scheduleNote: "",
      repeatMode: "NONE" as const,
      repeatWeekOfMonth: 0,
      repeatWeekday: 0,
    };

    setBusy(true);
    setError("");
    try {
      const nextLocal = assets.map((asset) =>
        asset.id === assetId ? { ...asset, ...payload } : asset
      );
      try {
        await requestJson<{ asset: Asset }>(`/api/assets/${assetId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } catch (err) {
        if (!isApiUnavailableError(err)) throw err;
      }

      writeAssetFallback(nextLocal);
      setAssets(nextLocal);
      setStats(buildStatsFromAssets(nextLocal, campusFilter));
      appendUiAudit("SCHEDULE_DELETE", "asset", String(assetId), "Schedule removed");
      if (scheduleForm.assetId === String(assetId)) {
        setScheduleForm((f) => ({ ...f, date: "", note: "", repeatMode: "NONE" }));
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete schedule");
    } finally {
      setBusy(false);
    }
  }

  async function clearScheduleForType(category: string, type: string) {
    if (!requireAdminAction()) return;
    if (!window.confirm(`Delete schedules for all ${assetItemName(category, type)} assets?`)) return;
    const targets = assets.filter((asset) => {
      const hasSchedule = Boolean(String(asset.nextMaintenanceDate || "").trim()) || asset.repeatMode === "MONTHLY_WEEKDAY";
      return hasSchedule && asset.category === category && asset.type === type;
    });
    if (!targets.length) {
      setError("No schedules found for this item type.");
      return;
    }
    const payload = {
      nextMaintenanceDate: "",
      scheduleNote: "",
      repeatMode: "NONE" as const,
      repeatWeekOfMonth: 0,
      repeatWeekday: 0,
    };
    setBusy(true);
    setError("");
    try {
      const targetIds = new Set(targets.map((a) => a.id));
      const nextLocal = assets.map((asset) => (targetIds.has(asset.id) ? { ...asset, ...payload } : asset));
      try {
        await Promise.all(
          targets.map((asset) =>
            requestJson<{ asset: Asset }>(`/api/assets/${asset.id}`, {
              method: "PATCH",
              body: JSON.stringify(payload),
            })
          )
        );
      } catch (err) {
        if (!isApiUnavailableError(err)) throw err;
      }
      writeAssetFallback(nextLocal);
      setAssets(nextLocal);
      setStats(buildStatsFromAssets(nextLocal, campusFilter));
      appendUiAudit("SCHEDULE_DELETE", "asset_type", `${category}:${type}`, `Removed schedule from ${targets.length} assets`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete schedules");
    } finally {
      setBusy(false);
    }
  }

  function handleScheduleRowAction(asset: Asset, action: "edit" | "delete") {
    if (!requireAdminAction()) return;
    const groupedCount = scheduleListRows.filter((row) => row.category === asset.category && row.type === asset.type).length;
    if (groupedCount > 1) {
      setScheduleScopeModal({ action, assetId: asset.id });
      return;
    }
    if (action === "edit") editScheduleForAsset(asset);
    else void clearScheduleForAsset(asset.id);
  }

  async function applyScheduleScopeAction(scope: "single" | "all") {
    if (!scheduleScopeModal) return;
    const targetAsset = assets.find((a) => a.id === scheduleScopeModal.assetId);
    if (!targetAsset) {
      setScheduleScopeModal(null);
      return;
    }
    const action = scheduleScopeModal.action;
    setScheduleScopeModal(null);
    if (action === "edit") {
      if (scope === "single") {
        editScheduleForAsset(targetAsset);
        return;
      }
      setBulkScheduleForm((f) => ({
        ...f,
        campus: "ALL",
        category: targetAsset.category,
        type: targetAsset.type,
        date: targetAsset.repeatMode === "NONE" ? (targetAsset.nextMaintenanceDate || "") : "",
        note: targetAsset.scheduleNote || "",
        repeatMode: targetAsset.repeatMode || "NONE",
        repeatWeekOfMonth: Number(targetAsset.repeatWeekOfMonth || 1),
        repeatWeekday: Number(targetAsset.repeatWeekday || 6),
      }));
      setScheduleView("bulk");
      return;
    }
    if (scope === "single") {
      await clearScheduleForAsset(targetAsset.id, true);
      return;
    }
    await clearScheduleForType(targetAsset.category, targetAsset.type);
  }

  async function saveBulkMaintenanceSchedule() {
    if (!requireAdminAction()) return;
    const normalizedDate =
      bulkScheduleForm.repeatMode === "NONE" ? normalizeYmdInput(bulkScheduleForm.date) : "";
    if (bulkScheduleForm.repeatMode === "NONE" && !normalizedDate) {
      setError("Please select a valid date (YYYY-MM-DD).");
      return;
    }
    if (bulkScheduleForm.repeatMode === "NONE" && normalizedDate < todayYmd) {
      setError("Cannot set schedule to a past date.");
      return;
    }

    const matched = assets.filter((asset) => {
      const campusOk = bulkScheduleForm.campus === "ALL" || asset.campus === bulkScheduleForm.campus;
      return campusOk && asset.category === bulkScheduleForm.category && asset.type === bulkScheduleForm.type;
    });
    if (!matched.length) {
      setError("No assets matched this campus + item type.");
      setSetupMessage("No assets matched this campus + item type.");
      return;
    }

    const payload = {
      nextMaintenanceDate: normalizedDate,
      scheduleNote: bulkScheduleForm.note.trim(),
      repeatMode: bulkScheduleForm.repeatMode,
      repeatWeekOfMonth:
        bulkScheduleForm.repeatMode === "MONTHLY_WEEKDAY"
          ? Number(bulkScheduleForm.repeatWeekOfMonth)
          : 0,
      repeatWeekday:
        bulkScheduleForm.repeatMode === "MONTHLY_WEEKDAY"
          ? Number(bulkScheduleForm.repeatWeekday)
          : 0,
    };

    setBusy(true);
    setError("");
    try {
      const matchedIdSet = new Set(matched.map((a) => a.id));
      const nextLocal = assets.map((asset) =>
        matchedIdSet.has(asset.id) ? { ...asset, ...payload } : asset
      );

      try {
        const updateCalls = matched.map((asset) =>
          requestJson<{ asset: Asset }>(`/api/assets/${asset.id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        );
        await Promise.all(updateCalls);
      } catch (err) {
        if (!isApiUnavailableError(err) && !isMissingRouteError(err)) throw err;
      }

      writeAssetFallback(nextLocal);
      setAssets(nextLocal);
      setStats(buildStatsFromAssets(nextLocal, campusFilter));
      setSetupMessage(`Bulk schedule updated for ${matched.length} asset(s).`);
      setBulkScheduleForm((f) => ({
        ...f,
        date: "",
        note: "",
      }));
      appendUiAudit(
        "SCHEDULE_BULK_UPDATE",
        "asset",
        `${bulkScheduleForm.campus} | ${bulkScheduleForm.category}-${bulkScheduleForm.type}`,
        `${matched.length} assets`
      );
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save bulk schedule");
    } finally {
      setBusy(false);
    }
  }

  async function onMaintenanceRecordPhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert(t.photoLimit);
      return;
    }
    try {
      const photo = await optimizeUploadPhoto(file);
      setMaintenanceRecordForm((f) => ({ ...f, photo }));
    } catch {
      alert(t.photoProcessError);
    }
  }

  async function addMaintenanceRecordFromTab(): Promise<boolean> {
    if (!requireAdminAction()) return false;
    const assetId = Number(maintenanceRecordForm.assetId);
    if (!assetId) return false;
    if (
      !maintenanceRecordForm.date ||
      !maintenanceRecordForm.type.trim() ||
      !maintenanceRecordForm.note.trim()
    ) {
      return false;
    }
    if (maintenanceRecordForm.date < todayYmd) {
      setError("Cannot set maintenance date to a past date.");
      return false;
    }

    const entry: MaintenanceEntry = {
      id: Date.now(),
      date: maintenanceRecordForm.date,
      type: maintenanceRecordForm.type.trim(),
      completion: maintenanceRecordForm.completion,
      condition: maintenanceRecordForm.condition.trim(),
      note: maintenanceRecordForm.note.trim(),
      cost: maintenanceRecordForm.cost.trim(),
      by: maintenanceRecordForm.by.trim(),
      photo: maintenanceRecordForm.photo || "",
    };
    const sourceAsset = assets.find((a) => a.id === assetId) || null;
    const maintenanceType = entry.type.trim().toLowerCase();
    const shouldAutoRetire =
      entry.completion === "Done" &&
      (maintenanceType === "replacement" || maintenanceType === "replacment");
    const shouldApplyRetireStatus =
      shouldAutoRetire && (sourceAsset?.status || "Active") !== "Retired";
    const retireReason = `Auto defective after replacement maintenance on ${entry.date}`;

    setBusy(true);
    setError("");
    try {
      const nextLocal = readAssetFallback().map((asset) => {
        if (asset.id !== assetId) return asset;

        let nextMaintenanceDate = asset.nextMaintenanceDate || "";
        let nextRepeatMode = asset.repeatMode || "NONE";
        let nextRepeatWeekOfMonth = Number(asset.repeatWeekOfMonth || 0);
        let nextRepeatWeekday = Number(asset.repeatWeekday || 0);
        if (entry.completion === "Done") {
          if (asset.repeatMode === "MONTHLY_WEEKDAY") {
            const scheduleRef = String(asset.nextMaintenanceDate || "").trim();
            const doneRef = scheduleRef && scheduleRef > entry.date ? scheduleRef : entry.date;
            nextMaintenanceDate = resolveNextScheduleDate(asset, shiftYmd(doneRef, 1));
          } else {
            // For one-time schedules, a Done record always clears the pending schedule.
            nextMaintenanceDate = "";
            nextRepeatMode = "NONE";
            nextRepeatWeekOfMonth = 0;
            nextRepeatWeekday = 0;
          }
        }
        const statusHistory = Array.isArray(asset.statusHistory) ? asset.statusHistory : [];
        const nextStatusHistory =
          shouldApplyRetireStatus && asset.status !== "Retired"
            ? [
                {
                  id: Date.now() + 1,
                  date: new Date().toISOString(),
                  fromStatus: asset.status || "Active",
                  toStatus: "Retired",
                  reason: retireReason,
                },
                ...statusHistory,
              ]
            : statusHistory;

        return {
          ...asset,
          nextMaintenanceDate,
          repeatMode: nextRepeatMode,
          repeatWeekOfMonth: nextRepeatWeekOfMonth,
          repeatWeekday: nextRepeatWeekday,
          status: shouldApplyRetireStatus ? "Retired" : asset.status,
          statusHistory: nextStatusHistory,
          maintenanceHistory: [entry, ...(asset.maintenanceHistory || [])],
        };
      });

      try {
        await requestJson<{ asset: Asset }>(`/api/assets/${assetId}/history`, {
          method: "POST",
          body: JSON.stringify(entry),
        });
        const savedAsset = nextLocal.find((a) => a.id === assetId);
        if (savedAsset) {
          await requestJson<{ asset: Asset }>(`/api/assets/${assetId}`, {
            method: "PATCH",
            body: JSON.stringify({
              nextMaintenanceDate: savedAsset.nextMaintenanceDate || "",
              repeatMode: savedAsset.repeatMode || "NONE",
              repeatWeekOfMonth: Number(savedAsset.repeatWeekOfMonth || 0),
              repeatWeekday: Number(savedAsset.repeatWeekday || 0),
              status: shouldApplyRetireStatus ? "Retired" : savedAsset.status || "Active",
            }),
          });
          if (shouldApplyRetireStatus) {
            try {
              await requestJson<{ asset: Asset }>(`/api/assets/${assetId}/status`, {
                method: "PATCH",
                body: JSON.stringify({
                  status: "Retired",
                  fromStatus: sourceAsset?.status || "Active",
                  reason: retireReason,
                }),
              });
            } catch {
              // Status is already set via /api/assets PATCH above; keep flow successful.
            }
          }
        }
      } catch (err) {
        if (!isApiUnavailableError(err) && !isMissingRouteError(err)) throw err;
      }

      writeAssetFallback(nextLocal);
      setAssets(nextLocal);
      setStats(buildStatsFromAssets(nextLocal, campusFilter));
      appendUiAudit("MAINTENANCE_CREATE", "asset", String(assetId), `${entry.type} | ${entry.completion || "-"}`);
      if (shouldApplyRetireStatus) {
        appendUiAudit("UPDATE_STATUS", "asset", String(assetId), "Defective (auto from replacement)");
      }
      setMaintenanceRecordForm((f) => ({
        ...f,
        date: "",
        type: "Preventive",
        completion: "Done",
        condition: "",
        note: "",
        cost: "",
        by: "",
        photo: "",
      }));
      setMaintenanceRecordFileKey((k) => k + 1);
      setMaintenanceView("history");
      await loadData();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add maintenance record");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onVerificationRecordPhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert(t.photoLimit);
      return;
    }
    try {
      const photo = await optimizeUploadPhoto(file);
      setVerificationRecordForm((f) => ({ ...f, photo }));
    } catch {
      alert(t.photoProcessError);
    }
  }

  async function addVerificationRecord(): Promise<boolean> {
    if (!requireAdminAction()) return false;
    const assetId = Number(verificationRecordForm.assetId);
    if (!assetId || !verificationRecordForm.date) return false;

    const entry: VerificationEntry = {
      id: Date.now(),
      date: verificationRecordForm.date,
      result: verificationRecordForm.result,
      condition: verificationRecordForm.condition.trim(),
      note: verificationRecordForm.note.trim(),
      by: verificationRecordForm.by.trim(),
      photo: verificationRecordForm.photo || "",
    };

    setBusy(true);
    setError("");
    try {
      const nextLocal = readAssetFallback().map((asset) => {
        if (asset.id !== assetId) return asset;
        return {
          ...asset,
          nextVerificationDate: verificationRecordForm.nextVerificationDate || asset.nextVerificationDate || "",
          verificationFrequency: verificationRecordForm.verificationFrequency || asset.verificationFrequency || "NONE",
          verificationHistory: [entry, ...(asset.verificationHistory || [])],
        };
      });

      try {
        await requestJson<{ asset: Asset }>(`/api/assets/${assetId}`, {
          method: "PATCH",
          body: JSON.stringify(
            nextLocal.find((a) => a.id === assetId) || {
              verificationHistory: [entry],
            }
          ),
        });
      } catch (err) {
        if (!isApiUnavailableError(err) && !isMissingRouteError(err)) throw err;
      }

      writeAssetFallback(nextLocal);
      setAssets(nextLocal);
      setStats(buildStatsFromAssets(nextLocal, campusFilter));
      appendUiAudit("VERIFICATION_CREATE", "asset", String(assetId), `${entry.result} | ${entry.note.slice(0, 60)}`);
      setVerificationRecordForm((f) => ({
        ...f,
        date: "",
        result: "Verified",
        condition: "",
        note: "",
        by: "",
        photo: "",
        nextVerificationDate: "",
      }));
      setVerificationRecordFileKey((k) => k + 1);
      await loadData();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add verification record");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function startVerificationRowEdit(rowId: string, row: {
    date: string;
    result: VerificationEntry["result"];
    condition: string;
    note: string;
    by: string;
    photo: string;
  }) {
    setVerificationEditingRowId(rowId);
    setVerificationEditForm({
      date: row.date || "",
      result: row.result || "Verified",
      condition: row.condition || "",
      note: row.note || "",
      by: row.by || "",
      photo: row.photo || "",
    });
    setVerificationEditFileKey((k) => k + 1);
  }

  function cancelVerificationRowEdit() {
    setVerificationEditingRowId(null);
    setVerificationEditForm({
      date: "",
      result: "Verified",
      condition: "",
      note: "",
      by: "",
      photo: "",
    });
  }

  async function onVerificationEditPhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert(t.photoLimit);
      return;
    }
    try {
      const photo = await optimizeUploadPhoto(file);
      setVerificationEditForm((f) => ({ ...f, photo }));
    } catch {
      alert(t.photoProcessError);
    }
  }

  async function updateVerificationEntry(assetDbId: number, entryId: number) {
    if (!requireAdminAction()) return;
    if (!verificationEditForm.date) return;

    const payload: VerificationEntry = {
      id: entryId,
      date: verificationEditForm.date,
      result: verificationEditForm.result,
      condition: verificationEditForm.condition.trim(),
      note: verificationEditForm.note.trim(),
      by: verificationEditForm.by.trim(),
      photo: verificationEditForm.photo || "",
    };

    setBusy(true);
    setError("");
    try {
      const nextLocal = readAssetFallback().map((asset) => {
        if (asset.id !== assetDbId) return asset;
        return {
          ...asset,
          verificationHistory: (asset.verificationHistory || []).map((h) =>
            h.id === entryId ? { ...h, ...payload } : h
          ),
        };
      });

      try {
        await requestJson<{ asset: Asset }>(`/api/assets/${assetDbId}`, {
          method: "PATCH",
          body: JSON.stringify(nextLocal.find((a) => a.id === assetDbId) || {}),
        });
      } catch (err) {
        if (!isApiUnavailableError(err) && !isMissingRouteError(err)) throw err;
      }

      writeAssetFallback(nextLocal);
      setAssets(nextLocal);
      setStats(buildStatsFromAssets(nextLocal, campusFilter));
      appendUiAudit("VERIFICATION_UPDATE", "verification_record", String(entryId), `${payload.result}`);
      cancelVerificationRowEdit();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update verification record");
    } finally {
      setBusy(false);
    }
  }

  async function deleteVerificationEntry(assetDbId: number, entryId: number) {
    if (!requireAdminAction()) return;
    if (!window.confirm("Delete this verification record?")) return;
    setBusy(true);
    setError("");
    try {
      const nextLocal = readAssetFallback().map((asset) => {
        if (asset.id !== assetDbId) return asset;
        return {
          ...asset,
          verificationHistory: (asset.verificationHistory || []).filter((h) => h.id !== entryId),
        };
      });

      try {
        await requestJson<{ asset: Asset }>(`/api/assets/${assetDbId}`, {
          method: "PATCH",
          body: JSON.stringify(nextLocal.find((a) => a.id === assetDbId) || {}),
        });
      } catch (err) {
        if (!isApiUnavailableError(err) && !isMissingRouteError(err)) throw err;
      }

      writeAssetFallback(nextLocal);
      setAssets(nextLocal);
      setStats(buildStatsFromAssets(nextLocal, campusFilter));
      appendUiAudit("VERIFICATION_DELETE", "verification_record", String(entryId), "Deleted");
      if (verificationEditingRowId?.endsWith(`-${entryId}`)) {
        cancelVerificationRowEdit();
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete verification record");
    } finally {
      setBusy(false);
    }
  }

  async function submitAssetTransfer(targetAssetId?: number): Promise<boolean> {
    if (!requireAdminAction()) return false;
    const assetId = targetAssetId ?? Number(transferForm.assetId);
    if (!assetId || !transferForm.toCampus || !transferForm.toLocation.trim()) return false;
    const current = assets.find((a) => a.id === assetId);
    if (!current) return false;
    const fromUser = String(current.assignedTo || "").trim();
    const toUser = String(transferForm.toAssignedTo || "").trim();
    const assignmentChanged = fromUser !== toUser;
    if (toUser && assignmentChanged && !transferForm.responsibilityConfirmed) {
      setError("Please confirm staff responsibility before assigning this asset.");
      return false;
    }
    if (fromUser && assignmentChanged && !transferForm.returnConfirmed) {
      setError("Please confirm previous staff return handover before reassigning.");
      return false;
    }

    const transferEntry: TransferEntry = {
      id: Date.now(),
      date: transferForm.date || toYmd(new Date()),
      fromCampus: current.campus,
      fromLocation: current.location || "-",
      toCampus: transferForm.toCampus,
      toLocation: transferForm.toLocation.trim(),
      reason: transferForm.reason.trim(),
      by: transferForm.by.trim(),
      note: transferForm.note.trim(),
    };
    const custodyEntry: CustodyEntry | null = assignmentChanged
      ? {
          id: Date.now() + 1,
          date: transferEntry.date,
          action: toUser ? "ASSIGN" : "UNASSIGN",
          fromCampus: current.campus,
          fromLocation: current.location || "-",
          toCampus: transferEntry.toCampus,
          toLocation: transferEntry.toLocation,
          fromUser,
          toUser,
          responsibilityAck: Boolean(transferForm.responsibilityConfirmed),
          by: transferEntry.by,
          note: transferEntry.note || transferEntry.reason || "",
        }
      : null;

    setBusy(true);
    setError("");
    try {
      const nextLocal = readAssetFallback().map((asset) => {
        if (asset.id !== assetId) return asset;
        const custodyStatus: Asset["custodyStatus"] = toUser ? "ASSIGNED" : "IN_STOCK";
        return {
          ...asset,
          campus: transferEntry.toCampus,
          location: transferEntry.toLocation,
          assignedTo: toUser,
          custodyStatus,
          transferHistory: [transferEntry, ...(asset.transferHistory || [])],
          custodyHistory: custodyEntry ? [custodyEntry, ...(asset.custodyHistory || [])] : (asset.custodyHistory || []),
        };
      });

      try {
        await requestJson<{ asset: Asset }>(`/api/assets/${assetId}`, {
          method: "PATCH",
          body: JSON.stringify({
            campus: transferEntry.toCampus,
            location: transferEntry.toLocation,
            assignedTo: toUser,
            custodyStatus: toUser ? "ASSIGNED" : "IN_STOCK",
            transferHistory: [transferEntry, ...(current.transferHistory || [])],
            custodyHistory: custodyEntry ? [custodyEntry, ...(current.custodyHistory || [])] : (current.custodyHistory || []),
          }),
        });
      } catch (err) {
        if (!isApiUnavailableError(err) && !isMissingRouteError(err)) throw err;
      }

      writeAssetFallback(nextLocal);
      setAssets(nextLocal);
      setStats(buildStatsFromAssets(nextLocal, campusFilter));
      appendUiAudit("TRANSFER", "asset", String(assetId), `${transferEntry.fromCampus} -> ${transferEntry.toCampus}`);
      setTransferForm((f) => ({
        ...f,
        date: "",
        responsibilityConfirmed: false,
        returnConfirmed: false,
        reason: "",
        by: "",
        note: "",
      }));
      await loadData();
      setTransferView("history");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to transfer asset");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function openTransferFromAsset(asset: Asset) {
    setTransferForm((prev) => ({
      ...prev,
      assetId: String(asset.id),
      date: toYmd(new Date()),
      toCampus: asset.campus,
      toLocation: asset.location || "",
      toAssignedTo: asset.assignedTo || "",
      responsibilityConfirmed: false,
      returnConfirmed: false,
      reason: "",
      by: "",
      note: "",
    }));
    setTransferQuickAssetId(asset.id);
  }

  function startMaintenanceEntryEdit(entry: MaintenanceEntry) {
    setMaintenanceEditingEntryId(entry.id);
    setMaintenanceEditForm({
      date: entry.date || "",
      type: entry.type || "Preventive",
      completion: entry.completion || "Done",
      condition: entry.condition || "",
      note: entry.note || "",
      cost: entry.cost || "",
      by: entry.by || "",
      photo: entry.photo || "",
    });
    setMaintenanceEditFileKey((k) => k + 1);
  }

  function editMaintenanceEntryFromHistoryRow(row: {
    assetDbId: number;
    entryId: number;
    date: string;
    type: string;
    completion: string;
    condition: string;
    note: string;
    cost: string;
    by: string;
    photo: string;
  }) {
    setMaintenanceDetailAssetId(row.assetDbId);
    startMaintenanceEntryEdit({
      id: row.entryId,
      date: row.date,
      type: row.type,
      completion: (row.completion === "Done" ? "Done" : "Not Yet") as "Done" | "Not Yet",
      condition: row.condition,
      note: row.note,
      cost: row.cost,
      by: row.by,
      photo: row.photo,
    });
  }

  function cancelMaintenanceEntryEdit() {
    setMaintenanceEditingEntryId(null);
    setMaintenanceEditForm({
      date: "",
      type: "Preventive",
      completion: "Done",
      condition: "",
      note: "",
      cost: "",
      by: "",
      photo: "",
    });
  }

  async function onMaintenanceEditPhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert(t.photoLimit);
      return;
    }
    try {
      const photo = await optimizeUploadPhoto(file);
      setMaintenanceEditForm((f) => ({ ...f, photo }));
    } catch {
      alert(t.photoProcessError);
    }
  }

  async function updateMaintenanceEntry(entryId: number) {
    if (!requireAdminAction()) return;
    if (!maintenanceDetailAssetId) return;
    if (!maintenanceEditForm.date || !maintenanceEditForm.type.trim() || !maintenanceEditForm.note.trim()) return;
    if (maintenanceEditForm.date < todayYmd) {
      setError("Cannot set maintenance date to a past date.");
      return;
    }

    const payload: MaintenanceEntry = {
      id: entryId,
      date: maintenanceEditForm.date,
      type: maintenanceEditForm.type.trim(),
      completion: maintenanceEditForm.completion,
      condition: maintenanceEditForm.condition.trim(),
      note: maintenanceEditForm.note.trim(),
      cost: maintenanceEditForm.cost.trim(),
      by: maintenanceEditForm.by.trim(),
      photo: maintenanceEditForm.photo || "",
    };

    setBusy(true);
    setError("");
    try {
      const nextLocal = readAssetFallback().map((asset) => {
        if (asset.id !== maintenanceDetailAssetId) return asset;
        const nextHistory = (asset.maintenanceHistory || []).map((h) =>
          Number(h.id) === Number(entryId) ? { ...h, ...payload } : h
        );
        return normalizeAssetForUi({ ...asset, maintenanceHistory: nextHistory });
      });

      try {
        await requestJson<{ asset: Asset }>(`/api/assets/${maintenanceDetailAssetId}/history/${entryId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } catch (err) {
        if (!isApiUnavailableError(err) && !isMissingRouteError(err)) throw err;
      }

      writeAssetFallback(nextLocal);
      setAssets(nextLocal);
      setStats(buildStatsFromAssets(nextLocal, campusFilter));
      appendUiAudit("MAINTENANCE_UPDATE", "maintenance_record", String(entryId), `${payload.type} | ${payload.completion || "-"}`);
      cancelMaintenanceEntryEdit();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update maintenance record");
    } finally {
      setBusy(false);
    }
  }

  async function deleteMaintenanceEntryByAsset(assetDbId: number, entryId: number, closeDetail = false) {
    if (!requireAdminAction()) return;
    if (!assetDbId) return;
    if (!window.confirm("Delete this maintenance record?")) return;

    setBusy(true);
    setError("");
    try {
      const nextLocal = readAssetFallback().map((asset) => {
        if (asset.id !== assetDbId) return asset;
        return normalizeAssetForUi({
          ...asset,
          maintenanceHistory: (asset.maintenanceHistory || []).filter(
            (h) => Number(h.id) !== Number(entryId)
          ),
        });
      });

      try {
        await requestJson<{ ok: boolean }>(`/api/assets/${assetDbId}/history/${entryId}`, {
          method: "DELETE",
        });
      } catch (err) {
        if (
          !isApiUnavailableError(err) &&
          !isMissingRouteError(err) &&
          !isHistoryRecordNotFoundError(err)
        ) {
          throw err;
        }
      }

      writeAssetFallback(nextLocal);
      setAssets(nextLocal);
      setStats(buildStatsFromAssets(nextLocal, campusFilter));
      appendUiAudit("MAINTENANCE_DELETE", "maintenance_record", String(entryId), "Deleted");
      if (Number(maintenanceEditingEntryId) === Number(entryId)) {
        cancelMaintenanceEntryEdit();
      }
      if (closeDetail) setMaintenanceDetailAssetId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete maintenance record");
    } finally {
      setBusy(false);
    }
  }

  async function deleteMaintenanceEntry(entryId: number) {
    if (!maintenanceDetailAssetId) return;
    await deleteMaintenanceEntryByAsset(maintenanceDetailAssetId, entryId, true);
  }


  function openAssetStatusChangeDialog(id: number, status: string) {
    if (!requireAdminAction()) return;
    const current = assets.find((a) => a.id === id);
    if (!current) return;
    const fromStatus = current.status || "Unknown";
    if (fromStatus === status) return;
    setPendingStatusChange({
      assetId: id,
      fromStatus,
      toStatus: status,
      reason: "",
      verifiedBy: authUser?.displayName || authUser?.username || "",
    });
  }

  async function changeAssetStatus(
    id: number,
    status: string,
    reason = "",
    verifiedBy = ""
  ): Promise<boolean> {
    if (!requireAdminAction()) return false;
    setBusy(true);
    setError("");
    try {
      const current = assets.find((a) => a.id === id);
      const nextStatusEntry: StatusEntry = {
        id: Date.now(),
        date: new Date().toISOString(),
        fromStatus: current?.status || "Unknown",
        toStatus: status,
        reason,
        by: verifiedBy,
      };
      try {
        await requestJson<{ asset: Asset }>(`/api/assets/${id}/status`, {
          method: "PATCH",
          body: JSON.stringify({
            status,
            fromStatus: current?.status || "Unknown",
            reason,
            by: verifiedBy,
            statusHistory: [nextStatusEntry, ...((current?.statusHistory) || [])],
          }),
        });
      } catch (err) {
        if (!isApiUnavailableError(err) && !isMissingRouteError(err)) throw err;
      }
      const nextLocal = readAssetFallback().map((asset) =>
          asset.id === id
            ? { ...asset, status, statusHistory: [nextStatusEntry, ...(asset.statusHistory || [])] }
            : asset
        );
      writeAssetFallback(nextLocal);
      setAssets(nextLocal);
      setStats(buildStatsFromAssets(nextLocal, campusFilter));
      appendUiAudit("UPDATE_STATUS", "asset", String(id), status);
      await loadData();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update asset status");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function changeTicketStatus(id: number, status: string) {
    if (!requireAdminAction()) return;
    setBusy(true);
    setError("");
    try {
      await requestJson<{ ticket: Ticket }>(`/api/tickets/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update ticket status");
    } finally {
      setBusy(false);
    }
  }

  async function onPhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (files.some((file) => file.size > 15 * 1024 * 1024)) {
      alert(t.photoLimit);
      e.target.value = "";
      return;
    }
    try {
      const optimized = await Promise.all(files.map((file) => optimizeUploadPhoto(file)));
      setAssetForm((f) => {
        const merged = normalizeAssetPhotos({
          photo: f.photo,
          photos: [...(f.photos || []), ...optimized],
        });
        return { ...f, photo: merged[0] || "", photos: merged };
      });
    } catch {
      alert(t.photoProcessError);
    } finally {
      e.target.value = "";
    }
  }

  async function onSetPackPhotoFile(type: SetPackChildType, e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (files.some((file) => file.size > 15 * 1024 * 1024)) {
      alert(t.photoLimit);
      e.target.value = "";
      return;
    }
    try {
      const optimized = await Promise.all(files.map((file) => optimizeUploadPhoto(file)));
      setSetPackDraft((prev) => {
        const merged = normalizeAssetPhotos({
          photo: prev[type].photo,
          photos: [...(prev[type].photos || []), ...optimized],
        }).slice(0, MAX_SET_PACK_PHOTOS);
        return {
          ...prev,
          [type]: {
            ...prev[type],
            photo: merged[0] || "",
            photos: merged,
          },
        };
      });
    } catch {
      alert(t.photoProcessError);
    } finally {
      e.target.value = "";
    }
  }

  function openQuickRecordModal(asset: Asset) {
    setMaintenanceRecordForm({
      assetId: String(asset.id),
      date: toYmd(new Date()),
      type: "Preventive",
      completion: "Done",
      condition: "",
      note: "",
      cost: "",
      by: "",
      photo: "",
    });
    setMaintenanceRecordFileKey((k) => k + 1);
    setQuickRecordAssetId(asset.id);
  }

  function openMaintenanceRecordFromScheduleAsset(asset: Asset, scheduledDate?: string) {
    const preferredDate = String(scheduledDate || asset.nextMaintenanceDate || "").trim() || toYmd(new Date());
    setTab("maintenance");
    setMaintenanceView("record");
    setMaintenanceRecordScheduleJumpMode(true);
    setMaintenanceRecordForm((f) => ({
      ...f,
      assetId: String(asset.id),
      date: preferredDate,
    }));
  }

  function openMaintenanceFromNotification(row: MaintenanceNotification) {
    const byDbId = assets.find((asset) => Number(asset.id) === Number(row.assetDbId));
    const byAssetId = assets.find(
      (asset) => String(asset.assetId || "").trim().toUpperCase() === String(row.assetId || "").trim().toUpperCase()
    );
    const targetAsset = byDbId || byAssetId || null;
    const preferredDate = String(row.scheduleDate || "").trim();

    setTab("maintenance");
    setMaintenanceView("record");
    setMaintenanceRecordScheduleJumpMode(true);
    setMaintenanceRecordForm((f) => ({
      ...f,
      assetId: targetAsset ? String(targetAsset.id) : "",
      date: preferredDate || f.date || toYmd(new Date()),
    }));
    setMobileNotificationOpen(false);
  }

  const filterLabel = useMemo(
    () => (campusFilter === "ALL" ? t.allCampuses : campusLabel(campusFilter)),
    [campusFilter, t.allCampuses, campusLabel]
  );
  const historyAsset = useMemo(
    () => assets.find((a) => a.id === historyAssetId) || null,
    [assets, historyAssetId]
  );
  const historyAssetEntries = useMemo(() => {
    if (!historyAsset) return [];
    return [...(historyAsset.maintenanceHistory || [])].sort((a, b) => {
      const aTime = Date.parse(a.date || "");
      const bTime = Date.parse(b.date || "");
      if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) return bTime - aTime;
      return String(b.date || "").localeCompare(String(a.date || ""));
    });
  }, [historyAsset]);
  const quickRecordAsset = useMemo(
    () => assets.find((a) => a.id === quickRecordAssetId) || null,
    [assets, quickRecordAssetId]
  );
  const detailAsset = useMemo(
    () => assets.find((a) => a.id === assetDetailId) || null,
    [assets, assetDetailId]
  );
  const sortByNewestDate = useCallback(
    (aDate?: string, bDate?: string) => {
      const aTime = Date.parse(aDate || "");
      const bTime = Date.parse(bDate || "");
      if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) return bTime - aTime;
      return String(bDate || "").localeCompare(String(aDate || ""));
    },
    []
  );
  const detailMaintenanceEntries = useMemo(
    () =>
      detailAsset
        ? [...(detailAsset.maintenanceHistory || [])].sort((a, b) =>
            sortByNewestDate(a.date, b.date)
          )
        : [],
    [detailAsset, sortByNewestDate]
  );
  const detailTransferEntries = useMemo(
    () =>
      detailAsset
        ? [...(detailAsset.transferHistory || [])].sort((a, b) =>
            sortByNewestDate(a.date, b.date)
          )
        : [],
    [detailAsset, sortByNewestDate]
  );
  const detailStatusEntries = useMemo(
    () =>
      detailAsset
        ? [...(detailAsset.statusHistory || [])].sort((a, b) =>
            sortByNewestDate(a.date, b.date)
          )
        : [],
    [detailAsset, sortByNewestDate]
  );
  const detailCustodyEntries = useMemo(
    () =>
      detailAsset
        ? [...(detailAsset.custodyHistory || [])].sort((a, b) =>
            sortByNewestDate(a.date, b.date)
          )
        : [],
    [detailAsset, sortByNewestDate]
  );
  const editingAsset = useMemo(
    () => assets.find((a) => a.id === editingAssetId) || null,
    [assets, editingAssetId]
  );
  const editingSetPackChildren = useMemo<Partial<Record<SetPackChildType, Asset>>>(() => {
    if (!editingAsset) return {};
    const isDesktopParent = editingAsset.category === "IT" && editingAsset.type === DESKTOP_PARENT_TYPE;
    if (!isDesktopParent) return {};
    const map: Partial<Record<SetPackChildType, Asset>> = {};
    const childrenByScope = assets.filter(
      (a) =>
        a.assetId !== editingAsset.assetId &&
        a.campus === editingAsset.campus &&
        (a.parentAssetId === editingAsset.assetId ||
          (editingAsset.setCode && a.setCode === editingAsset.setCode))
    );
    const monitors = childrenByScope
      .filter((a) => a.type === "MON")
      .sort((a, b) => (Number(a.seq) || 0) - (Number(b.seq) || 0) || a.assetId.localeCompare(b.assetId));
    if (monitors[0]) map.MON = monitors[0];
    if (monitors[1]) map.MON2 = monitors[1];
    const keyboard = childrenByScope.find((a) => a.type === "KBD");
    const mouse = childrenByScope.find((a) => a.type === "MSE");
    const usbWifi = childrenByScope.find((a) => a.type === "UWF");
    const webcam = childrenByScope.find((a) => a.type === "WBC");
    if (keyboard) map.KBD = keyboard;
    if (mouse) map.MSE = mouse;
    if (usbWifi) map.UWF = usbWifi;
    if (webcam) map.WBC = webcam;
    return map;
  }, [assets, editingAsset]);

  useEffect(() => {
    if (!editingAsset) {
      setEditCreateSetPack(false);
      setEditSetPackEnabled({ MON: false, MON2: false, KBD: false, MSE: false, UWF: false, WBC: false });
      return;
    }
    const isDesktopParent = editingAsset.category === "IT" && editingAsset.type === DESKTOP_PARENT_TYPE;
    if (!isDesktopParent) {
      setEditCreateSetPack(false);
      setEditSetPackEnabled({ MON: false, MON2: false, KBD: false, MSE: false, UWF: false, WBC: false });
      return;
    }
    const hasAnyChild =
      Boolean(editingSetPackChildren.MON) ||
      Boolean(editingSetPackChildren.MON2) ||
      Boolean(editingSetPackChildren.KBD) ||
      Boolean(editingSetPackChildren.MSE) ||
      Boolean(editingSetPackChildren.UWF) ||
      Boolean(editingSetPackChildren.WBC);
    setEditCreateSetPack(hasAnyChild);
    setEditSetPackEnabled({
      MON: Boolean(editingSetPackChildren.MON),
      MON2: Boolean(editingSetPackChildren.MON2),
      KBD: Boolean(editingSetPackChildren.KBD),
      MSE: Boolean(editingSetPackChildren.MSE),
      UWF: Boolean(editingSetPackChildren.UWF),
      WBC: Boolean(editingSetPackChildren.WBC),
    });
  }, [editingAsset, editingSetPackChildren]);
  const maintenanceDetailAsset = useMemo(
    () => assets.find((a) => a.id === maintenanceDetailAssetId) || null,
    [assets, maintenanceDetailAssetId]
  );
  const maintenanceDetailEntries = useMemo(
    () =>
      maintenanceDetailAsset
        ? [...(maintenanceDetailAsset.maintenanceHistory || [])].sort((a, b) =>
            sortByNewestDate(a.date, b.date)
          )
        : [],
    [maintenanceDetailAsset, sortByNewestDate]
  );
  const assetStatusRowClass = useCallback((statusRaw: string) => {
    const status = String(statusRaw || "").trim().toLowerCase();
    if (status === "retired") return "row-asset-retired";
    if (status === "maintenance") return "row-asset-maintenance";
    return "";
  }, []);
  const isReplacementDone = useCallback((typeRaw: string, completionRaw: string) => {
    const type = String(typeRaw || "").trim().toLowerCase();
    const completion = String(completionRaw || "").trim().toLowerCase();
    return (type === "replacement" || type === "replacment") && completion === "done";
  }, []);
  const isBrokenMaintenance = useCallback((conditionRaw: string, noteRaw: string) => {
    const text = `${conditionRaw || ""} ${noteRaw || ""}`.toLowerCase();
    return [
      "broken",
      "not working",
      "damage",
      "damaged",
      "fault",
      "failed",
      "dead",
    ].some((k) => text.includes(k));
  }, []);
  const maintenanceHistoryRowClass = useCallback(
    (
      typeRaw: string,
      completionRaw: string,
      statusRaw: string,
      conditionRaw = "",
      noteRaw = ""
    ) => {
      if (isReplacementDone(typeRaw, completionRaw)) return "row-maint-replacement";
      if (isBrokenMaintenance(conditionRaw, noteRaw)) return "row-maint-broken";
      const statusClass = assetStatusRowClass(statusRaw);
      if (statusClass === "row-asset-retired") return "row-maint-retired";
      if (statusClass === "row-asset-maintenance") return "row-maint-maintenance";
      return "";
    },
    [assetStatusRowClass, isBrokenMaintenance, isReplacementDone]
  );
  const transferAsset = useMemo(
    () => assets.find((a) => String(a.id) === transferForm.assetId) || null,
    [assets, transferForm.assetId]
  );
  const transferRecordAssets = useMemo(
    () =>
      [...assets].sort((a, b) => {
        const itemA = assetItemName(a.category, a.type, a.pcType || "");
        const itemB = assetItemName(b.category, b.type, b.pcType || "");
        if (itemA !== itemB) return itemA.localeCompare(itemB);
        return a.assetId.localeCompare(b.assetId);
      }),
    [assets, assetItemName]
  );
  const transferFilterCampusOptions = useMemo(
    () => Array.from(new Set(transferRecordAssets.map((a) => a.campus).filter(Boolean))).sort((a, b) => campusLabel(a).localeCompare(campusLabel(b))),
    [transferRecordAssets, campusLabel]
  );
  const transferFilterLocationOptions = useMemo(() => {
    let list = transferRecordAssets;
    if (transferFilterCampus !== "ALL") {
      list = list.filter((a) => a.campus === transferFilterCampus);
    }
    return Array.from(new Set(list.map((a) => String(a.location || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [transferRecordAssets, transferFilterCampus]);
  const transferFilterCategoryOptions = useMemo(() => {
    let list = transferRecordAssets;
    if (transferFilterCampus !== "ALL") {
      list = list.filter((a) => a.campus === transferFilterCampus);
    }
    if (transferFilterLocation !== "ALL") {
      list = list.filter((a) => String(a.location || "").trim() === transferFilterLocation);
    }
    return Array.from(new Set(list.map((a) => a.category).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [transferRecordAssets, transferFilterCampus, transferFilterLocation]);
  const transferFilterNameOptions = useMemo(() => {
    let list = transferRecordAssets;
    if (transferFilterCampus !== "ALL") {
      list = list.filter((a) => a.campus === transferFilterCampus);
    }
    if (transferFilterLocation !== "ALL") {
      list = list.filter((a) => String(a.location || "").trim() === transferFilterLocation);
    }
    if (transferFilterCategory !== "ALL") {
      list = list.filter((a) => a.category === transferFilterCategory);
    }
    return Array.from(new Set(list.map((a) => assetItemName(a.category, a.type, a.pcType || "")).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [transferRecordAssets, transferFilterCampus, transferFilterLocation, transferFilterCategory, assetItemName]);
  const transferFilteredAssets = useMemo(() => {
    let list = transferRecordAssets;
    if (transferFilterCampus !== "ALL") {
      list = list.filter((a) => a.campus === transferFilterCampus);
    }
    if (transferFilterLocation !== "ALL") {
      list = list.filter((a) => String(a.location || "").trim() === transferFilterLocation);
    }
    if (transferFilterCategory !== "ALL") {
      list = list.filter((a) => a.category === transferFilterCategory);
    }
    if (transferFilterName !== "ALL") {
      list = list.filter((a) => assetItemName(a.category, a.type, a.pcType || "") === transferFilterName);
    }
    return list;
  }, [
    transferRecordAssets,
    transferFilterCampus,
    transferFilterLocation,
    transferFilterCategory,
    transferFilterName,
    assetItemName,
  ]);
  const maintenanceRecordAssetPool = useMemo(() => {
    return (campusFilter === "ALL" ? assets : assets.filter((a) => a.campus === campusFilter)).sort((a, b) =>
      a.assetId.localeCompare(b.assetId)
    );
  }, [assets, campusFilter]);
  const maintenanceRecordCategoryOptions = useMemo(() => {
    return Array.from(new Set(maintenanceRecordAssetPool.map((a) => a.category).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [maintenanceRecordAssetPool]);
  const maintenanceRecordItemOptions = useMemo(() => {
    let list = maintenanceRecordAssetPool;
    if (maintenanceRecordCategoryFilter !== "ALL") {
      list = list.filter((a) => a.category === maintenanceRecordCategoryFilter);
    }
    return Array.from(new Set(list.map((a) => assetItemName(a.category, a.type, a.pcType || "")).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [maintenanceRecordAssetPool, maintenanceRecordCategoryFilter, assetItemName]);
  const maintenanceRecordLocationOptions = useMemo(() => {
    let list = maintenanceRecordAssetPool;
    if (maintenanceRecordCategoryFilter !== "ALL") {
      list = list.filter((a) => a.category === maintenanceRecordCategoryFilter);
    }
    if (maintenanceRecordItemFilter !== "ALL") {
      list = list.filter(
        (a) => assetItemName(a.category, a.type, a.pcType || "") === maintenanceRecordItemFilter
      );
    }
    return Array.from(new Set(list.map((a) => String(a.location || "").trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [maintenanceRecordAssetPool, maintenanceRecordCategoryFilter, maintenanceRecordItemFilter, assetItemName]);
  const maintenanceRecordFilteredAssets = useMemo(() => {
    let list = maintenanceRecordAssetPool;
    if (maintenanceRecordCategoryFilter !== "ALL") {
      list = list.filter((a) => a.category === maintenanceRecordCategoryFilter);
    }
    if (maintenanceRecordItemFilter !== "ALL") {
      list = list.filter(
        (a) => assetItemName(a.category, a.type, a.pcType || "") === maintenanceRecordItemFilter
      );
    }
    if (maintenanceRecordLocationFilter !== "ALL") {
      list = list.filter((a) => String(a.location || "").trim() === maintenanceRecordLocationFilter);
    }
    return list;
  }, [
    maintenanceRecordAssetPool,
    maintenanceRecordCategoryFilter,
    maintenanceRecordItemFilter,
    maintenanceRecordLocationFilter,
    assetItemName,
  ]);
  const verificationRecordAssetPool = useMemo(() => {
    return (campusFilter === "ALL" ? assets : assets.filter((a) => a.campus === campusFilter)).sort((a, b) =>
      a.assetId.localeCompare(b.assetId)
    );
  }, [assets, campusFilter]);
  const verificationRecordCategoryOptions = useMemo(() => {
    return Array.from(new Set(verificationRecordAssetPool.map((a) => a.category).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [verificationRecordAssetPool]);
  const verificationRecordItemOptions = useMemo(() => {
    let list = verificationRecordAssetPool;
    if (verificationRecordCategoryFilter !== "ALL") {
      list = list.filter((a) => a.category === verificationRecordCategoryFilter);
    }
    return Array.from(new Set(list.map((a) => assetItemName(a.category, a.type, a.pcType || "")).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [verificationRecordAssetPool, verificationRecordCategoryFilter, assetItemName]);
  const verificationRecordLocationOptions = useMemo(() => {
    let list = verificationRecordAssetPool;
    if (verificationRecordCategoryFilter !== "ALL") {
      list = list.filter((a) => a.category === verificationRecordCategoryFilter);
    }
    if (verificationRecordItemFilter !== "ALL") {
      list = list.filter(
        (a) => assetItemName(a.category, a.type, a.pcType || "") === verificationRecordItemFilter
      );
    }
    return Array.from(new Set(list.map((a) => String(a.location || "").trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [verificationRecordAssetPool, verificationRecordCategoryFilter, verificationRecordItemFilter, assetItemName]);
  const verificationRecordFilteredAssets = useMemo(() => {
    let list = verificationRecordAssetPool;
    if (verificationRecordCategoryFilter !== "ALL") {
      list = list.filter((a) => a.category === verificationRecordCategoryFilter);
    }
    if (verificationRecordItemFilter !== "ALL") {
      list = list.filter(
        (a) => assetItemName(a.category, a.type, a.pcType || "") === verificationRecordItemFilter
      );
    }
    if (verificationRecordLocationFilter !== "ALL") {
      list = list.filter((a) => String(a.location || "").trim() === verificationRecordLocationFilter);
    }
    return list;
  }, [
    verificationRecordAssetPool,
    verificationRecordCategoryFilter,
    verificationRecordItemFilter,
    verificationRecordLocationFilter,
    assetItemName,
  ]);
  const transferQuickAsset = useMemo(
    () => assets.find((a) => a.id === transferQuickAssetId) || null,
    [assets, transferQuickAssetId]
  );
  const transferLocationOptions = useMemo(
    () => sortLocationEntriesByName(locations.filter((l) => l.campus === transferForm.toCampus)),
    [locations, transferForm.toCampus]
  );
  const scheduleSelectAssets = useMemo(() => {
    return [...assets].sort((a, b) => {
      const aName = assetItemName(a.category, a.type, a.pcType || "").toLowerCase();
      const bName = assetItemName(b.category, b.type).toLowerCase();
      if (aName !== bName) return aName.localeCompare(bName);
      return a.assetId.localeCompare(b.assetId);
    });
  }, [assets, assetItemName]);
  const scheduleQuickSelectedAsset = useMemo(
    () => assets.find((a) => String(a.id) === scheduleQuickForm.assetId) || null,
    [assets, scheduleQuickForm.assetId]
  );
  const scheduleQuickFilterCampusOptions = useMemo(
    () => Array.from(new Set(scheduleSelectAssets.map((a) => a.campus).filter(Boolean))).sort((a, b) => campusLabel(a).localeCompare(campusLabel(b))),
    [scheduleSelectAssets, campusLabel]
  );
  const scheduleQuickFilterLocationOptions = useMemo(() => {
    let list = scheduleSelectAssets;
    if (scheduleQuickFilterCampus !== "ALL") {
      list = list.filter((a) => a.campus === scheduleQuickFilterCampus);
    }
    return Array.from(new Set(list.map((a) => String(a.location || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [scheduleSelectAssets, scheduleQuickFilterCampus]);
  const scheduleQuickFilterCategoryOptions = useMemo(() => {
    let list = scheduleSelectAssets;
    if (scheduleQuickFilterCampus !== "ALL") {
      list = list.filter((a) => a.campus === scheduleQuickFilterCampus);
    }
    if (scheduleQuickFilterLocation !== "ALL") {
      list = list.filter((a) => String(a.location || "").trim() === scheduleQuickFilterLocation);
    }
    return Array.from(new Set(list.map((a) => a.category).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [scheduleSelectAssets, scheduleQuickFilterCampus, scheduleQuickFilterLocation]);
  const scheduleQuickFilterNameOptions = useMemo(() => {
    let list = scheduleSelectAssets;
    if (scheduleQuickFilterCampus !== "ALL") {
      list = list.filter((a) => a.campus === scheduleQuickFilterCampus);
    }
    if (scheduleQuickFilterLocation !== "ALL") {
      list = list.filter((a) => String(a.location || "").trim() === scheduleQuickFilterLocation);
    }
    if (scheduleQuickFilterCategory !== "ALL") {
      list = list.filter((a) => a.category === scheduleQuickFilterCategory);
    }
    return Array.from(new Set(list.map((a) => assetItemName(a.category, a.type, a.pcType || "")).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [
    scheduleSelectAssets,
    scheduleQuickFilterCampus,
    scheduleQuickFilterLocation,
    scheduleQuickFilterCategory,
    assetItemName,
  ]);
  const scheduleQuickFilteredAssets = useMemo(() => {
    let list = scheduleSelectAssets;
    if (scheduleQuickFilterCampus !== "ALL") {
      list = list.filter((a) => a.campus === scheduleQuickFilterCampus);
    }
    if (scheduleQuickFilterLocation !== "ALL") {
      list = list.filter((a) => String(a.location || "").trim() === scheduleQuickFilterLocation);
    }
    if (scheduleQuickFilterCategory !== "ALL") {
      list = list.filter((a) => a.category === scheduleQuickFilterCategory);
    }
    if (scheduleQuickFilterName !== "ALL") {
      list = list.filter((a) => assetItemName(a.category, a.type, a.pcType || "") === scheduleQuickFilterName);
    }
    return list;
  }, [
    scheduleSelectAssets,
    scheduleQuickFilterCampus,
    scheduleQuickFilterLocation,
    scheduleQuickFilterCategory,
    scheduleQuickFilterName,
    assetItemName,
  ]);
  const allMaintenanceRows = useMemo(() => {
    const rows: Array<{
      rowId: string;
      assetDbId: number;
      entryId: number;
      assetId: string;
      assetPhoto: string;
      campus: string;
      category: string;
      assetType: string;
      location: string;
      status: string;
      date: string;
      type: string;
      completion: string;
      condition: string;
      note: string;
      cost: string;
      by: string;
      photo: string;
    }> = [];
    for (const asset of assets) {
      for (const entry of asset.maintenanceHistory || []) {
        rows.push({
          rowId: `${asset.id}-${entry.id}`,
          assetDbId: asset.id,
          entryId: entry.id,
          assetId: asset.assetId,
          assetPhoto: asset.photo || "",
          campus: asset.campus,
          category: asset.category,
          assetType: asset.type || "",
          location: asset.location || "-",
          status: asset.status || "Active",
          date: entry.date || "",
          type: entry.type || "",
          completion: entry.completion || "Not Yet",
          condition: entry.condition || "-",
          note: entry.note || "",
          cost: entry.cost || "-",
          by: entry.by || "-",
          photo: entry.photo || "",
        });
      }
    }
    return rows.sort((a, b) => {
      const aTime = Date.parse(a.date);
      const bTime = Date.parse(b.date);
      if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) return bTime - aTime;
      return b.rowId.localeCompare(a.rowId);
    });
  }, [assets]);
  const maintenanceTypeOptions = useMemo(() => {
    let rows = [...allMaintenanceRows];
    if (maintenanceCategoryFilter !== "ALL") {
      rows = rows.filter((r) => r.category === maintenanceCategoryFilter);
    }
    return Array.from(new Set(rows.map((r) => r.type).filter(Boolean))).sort();
  }, [allMaintenanceRows, maintenanceCategoryFilter]);
  const filteredMaintenanceRows = useMemo(() => {
    let rows = [...allMaintenanceRows];
    if (maintenanceCategoryFilter !== "ALL") {
      rows = rows.filter((r) => r.category === maintenanceCategoryFilter);
    }
    if (maintenanceTypeFilter !== "ALL") {
      rows = rows.filter((r) => r.type === maintenanceTypeFilter);
    }
    if (maintenanceDateFrom) {
      rows = rows.filter((r) => r.date && r.date >= maintenanceDateFrom);
    }
    if (maintenanceDateTo) {
      rows = rows.filter((r) => r.date && r.date <= maintenanceDateTo);
    }
    return rows;
  }, [allMaintenanceRows, maintenanceCategoryFilter, maintenanceTypeFilter, maintenanceDateFrom, maintenanceDateTo]);
  const sortedMaintenanceRows = useMemo(() => {
    const rows = [...filteredMaintenanceRows];
    const { key, direction } = maintenanceSort;
    const sign = direction === "asc" ? 1 : -1;

    rows.sort((a, b) => {
      if (key === "date") {
        const aTime = Date.parse(a.date || "");
        const bTime = Date.parse(b.date || "");
        if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) {
          return (aTime - bTime) * sign;
        }
      }

      const aValue = String(a[key] || "").toLowerCase();
      const bValue = String(b[key] || "").toLowerCase();
      if (aValue < bValue) return -1 * sign;
      if (aValue > bValue) return 1 * sign;
      return 0;
    });

    return rows;
  }, [filteredMaintenanceRows, maintenanceSort]);
  const latestMaintenanceRows = useMemo(
    () => allMaintenanceRows.slice(0, 5),
    [allMaintenanceRows]
  );
  const latestMaintenanceDetailRow = useMemo(
    () => latestMaintenanceRows.find((row) => row.rowId === latestMaintenanceDetailRowId) || null,
    [latestMaintenanceRows, latestMaintenanceDetailRowId]
  );
  const maintenanceTypeReportRows = useMemo(() => {
    const map = new Map<string, { type: string; done: number; notYet: number; total: number }>();
    for (const row of allMaintenanceRows) {
      const type = String(row.type || "-");
      if (!map.has(type)) map.set(type, { type, done: 0, notYet: 0, total: 0 });
      const item = map.get(type)!;
      item.total += 1;
      if (String(row.completion || "").trim().toLowerCase() === "done") item.done += 1;
      else item.notYet += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total || a.type.localeCompare(b.type));
  }, [allMaintenanceRows]);
  const maintenanceCompletionByCampusRows = useMemo(() => {
    const map = new Map<string, { campus: string; done: number; notYet: number; total: number }>();
    for (const row of allMaintenanceRows) {
      const campus = String(row.campus || "-");
      if (!map.has(campus)) map.set(campus, { campus, done: 0, notYet: 0, total: 0 });
      const item = map.get(campus)!;
      item.total += 1;
      if (String(row.completion || "").trim().toLowerCase() === "done") item.done += 1;
      else item.notYet += 1;
    }
    return Array.from(map.values())
      .map((row) => ({
        ...row,
        rate: row.total > 0 ? Math.round((row.done / row.total) * 100) : 0,
      }))
      .sort((a, b) => b.rate - a.rate || b.total - a.total || a.campus.localeCompare(b.campus));
  }, [allMaintenanceRows]);
  const allVerificationRows = useMemo(() => {
    const rows: Array<{
      rowId: string;
      assetDbId: number;
      entryId: number;
      assetId: string;
      assetPhoto: string;
      campus: string;
      category: string;
      assetType: string;
      location: string;
      status: string;
      nextVerificationDate: string;
      verificationFrequency: string;
      date: string;
      result: VerificationEntry["result"];
      condition: string;
      note: string;
      by: string;
      photo: string;
    }> = [];
    for (const asset of assets) {
      for (const entry of asset.verificationHistory || []) {
        rows.push({
          rowId: `${asset.id}-${entry.id}`,
          assetDbId: asset.id,
          entryId: entry.id,
          assetId: asset.assetId,
          assetPhoto: asset.photo || "",
          campus: asset.campus,
          category: asset.category,
          assetType: asset.type || "",
          location: asset.location || "-",
          status: asset.status || "Active",
          nextVerificationDate: asset.nextVerificationDate || "",
          verificationFrequency: asset.verificationFrequency || "NONE",
          date: entry.date || "",
          result: entry.result || "Verified",
          condition: entry.condition || "-",
          note: entry.note || "",
          by: entry.by || "-",
          photo: entry.photo || "",
        });
      }
    }
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [assets]);
  const filteredVerificationRows = useMemo(() => {
    let rows = [...allVerificationRows];
    if (verificationCategoryFilter !== "ALL") {
      rows = rows.filter((r) => r.category === verificationCategoryFilter);
    }
    if (verificationResultFilter !== "ALL") {
      rows = rows.filter((r) => r.result === verificationResultFilter);
    }
    if (verificationDateFrom) {
      rows = rows.filter((r) => r.date && r.date >= verificationDateFrom);
    }
    if (verificationDateTo) {
      rows = rows.filter((r) => r.date && r.date <= verificationDateTo);
    }
    return rows;
  }, [
    allVerificationRows,
    verificationCategoryFilter,
    verificationResultFilter,
    verificationDateFrom,
    verificationDateTo,
  ]);
  const assetListRows = useMemo(() => {
    let list = [...assets];
    if (!assetCampusMultiFilter.includes("ALL")) {
      list = list.filter((asset) => assetCampusMultiFilter.includes(asset.campus));
    }
    if (!assetCategoryMultiFilter.includes("ALL")) {
      list = list.filter((asset) => assetCategoryMultiFilter.includes(asset.category));
    }
    if (!assetNameMultiFilter.includes("ALL")) {
      list = list.filter((asset) => {
        const pcPart =
          asset.category === "IT" && asset.type === DESKTOP_PARENT_TYPE
            ? String(asset.pcType || "").trim().toUpperCase()
            : "";
        const key = `${asset.category}:${asset.type}:${pcPart}`;
        return assetNameMultiFilter.includes(key);
      });
    }
    if (!assetLocationMultiFilter.includes("ALL")) {
      list = list.filter((asset) =>
        assetLocationMultiFilter.includes(String(asset.location || "").trim())
      );
    }
    const q = String(search || "").trim().toLowerCase();
    if (q) {
      list = list.filter((asset) => {
        const itemLabel = assetItemName(asset.category, asset.type, asset.pcType || "");
        return `${asset.assetId} ${itemLabel} ${asset.name || ""} ${asset.location || ""} ${campusLabel(asset.campus)} ${asset.category || ""}`
          .toLowerCase()
          .includes(q);
      });
    }
    const { key, direction } = assetListSort;
    const sign = direction === "asc" ? 1 : -1;
    return list.sort((a, b) => {
      const aValue =
        key === "assetId"
          ? String(a.assetId || "")
          : key === "campus"
            ? campusLabel(a.campus)
            : key === "category"
              ? String(a.category || "")
              : key === "name"
                ? assetItemName(a.category, a.type, a.pcType || "")
                : key === "location"
                  ? String(a.location || "")
                  : String(a.status || "");
      const bValue =
        key === "assetId"
          ? String(b.assetId || "")
          : key === "campus"
            ? campusLabel(b.campus)
            : key === "category"
              ? String(b.category || "")
              : key === "name"
                ? assetItemName(b.category, b.type, b.pcType || "")
                : key === "location"
                  ? String(b.location || "")
                  : String(b.status || "");
      const compared = aValue.localeCompare(bValue, undefined, { sensitivity: "base" });
      if (compared !== 0) return compared * sign;
      return String(a.assetId || "").localeCompare(String(b.assetId || ""), undefined, { sensitivity: "base" });
    });
  }, [
    assets,
    assetCampusMultiFilter,
    assetCategoryMultiFilter,
    assetNameMultiFilter,
    assetLocationMultiFilter,
    search,
    assetListSort,
    campusLabel,
    assetItemName,
  ]);
  const topCampusByAssets = useMemo(() => {
    if (!stats.byCampus.length) return null;
    return [...stats.byCampus].sort((a, b) => b.assets - a.assets)[0] || null;
  }, [stats.byCampus]);

  function renderAssetPhoto(photo: string, alt = "asset") {
    if (!photo) return <span className="photo-empty">-</span>;
    return (
      <button
        className="photo-thumb-btn"
        onClick={() => setPreviewImage(photo)}
        title="Open photo"
      >
        <img src={photo} alt={alt} className="table-photo" />
      </button>
    );
  }
  useEffect(() => {
    if (maintenanceTypeFilter === "ALL") return;
    if (!maintenanceTypeOptions.includes(maintenanceTypeFilter)) {
      setMaintenanceTypeFilter("ALL");
    }
  }, [maintenanceTypeFilter, maintenanceTypeOptions]);
  useEffect(() => {
    if (maintenanceRecordItemFilter === "ALL") return;
    if (!maintenanceRecordItemOptions.includes(maintenanceRecordItemFilter)) {
      setMaintenanceRecordItemFilter("ALL");
    }
  }, [maintenanceRecordItemFilter, maintenanceRecordItemOptions]);
  useEffect(() => {
    if (maintenanceRecordLocationFilter === "ALL") return;
    if (!maintenanceRecordLocationOptions.includes(maintenanceRecordLocationFilter)) {
      setMaintenanceRecordLocationFilter("ALL");
    }
  }, [maintenanceRecordLocationFilter, maintenanceRecordLocationOptions]);
  useEffect(() => {
    const hasSelectedAsset = maintenanceRecordFilteredAssets.some(
      (a) => String(a.id) === maintenanceRecordForm.assetId
    );
    if (!maintenanceRecordForm.assetId || hasSelectedAsset) return;
    setMaintenanceRecordForm((f) => ({ ...f, assetId: "" }));
  }, [maintenanceRecordForm.assetId, maintenanceRecordFilteredAssets]);
  useEffect(() => {
    if (verificationRecordItemFilter === "ALL") return;
    if (!verificationRecordItemOptions.includes(verificationRecordItemFilter)) {
      setVerificationRecordItemFilter("ALL");
    }
  }, [verificationRecordItemFilter, verificationRecordItemOptions]);
  useEffect(() => {
    if (verificationRecordLocationFilter === "ALL") return;
    if (!verificationRecordLocationOptions.includes(verificationRecordLocationFilter)) {
      setVerificationRecordLocationFilter("ALL");
    }
  }, [verificationRecordLocationFilter, verificationRecordLocationOptions]);
  useEffect(() => {
    const hasSelectedAsset = verificationRecordFilteredAssets.some(
      (a) => String(a.id) === verificationRecordForm.assetId
    );
    if (!verificationRecordForm.assetId || hasSelectedAsset) return;
    setVerificationRecordForm((f) => ({ ...f, assetId: "" }));
  }, [verificationRecordForm.assetId, verificationRecordFilteredAssets]);
  useEffect(() => {
    if (transferFilterCampus === "ALL") return;
    if (!transferFilterCampusOptions.includes(transferFilterCampus)) {
      setTransferFilterCampus("ALL");
    }
  }, [transferFilterCampus, transferFilterCampusOptions]);
  useEffect(() => {
    if (transferFilterLocation === "ALL") return;
    if (!transferFilterLocationOptions.includes(transferFilterLocation)) {
      setTransferFilterLocation("ALL");
    }
  }, [transferFilterLocation, transferFilterLocationOptions]);
  useEffect(() => {
    if (transferFilterCategory === "ALL") return;
    if (!transferFilterCategoryOptions.includes(transferFilterCategory)) {
      setTransferFilterCategory("ALL");
    }
  }, [transferFilterCategory, transferFilterCategoryOptions]);
  useEffect(() => {
    if (transferFilterName === "ALL") return;
    if (!transferFilterNameOptions.includes(transferFilterName)) {
      setTransferFilterName("ALL");
    }
  }, [transferFilterName, transferFilterNameOptions]);
  useEffect(() => {
    const hasSelectedAsset = transferFilteredAssets.some((a) => String(a.id) === transferForm.assetId);
    if (!transferForm.assetId || hasSelectedAsset) return;
    setTransferForm((f) => ({ ...f, assetId: "" }));
    setShowTransferAssetPicker(true);
  }, [transferForm.assetId, transferFilteredAssets]);
  useEffect(() => {
    if (scheduleQuickFilterCampus === "ALL") return;
    if (!scheduleQuickFilterCampusOptions.includes(scheduleQuickFilterCampus)) {
      setScheduleQuickFilterCampus("ALL");
    }
  }, [scheduleQuickFilterCampus, scheduleQuickFilterCampusOptions]);
  useEffect(() => {
    if (scheduleQuickFilterLocation === "ALL") return;
    if (!scheduleQuickFilterLocationOptions.includes(scheduleQuickFilterLocation)) {
      setScheduleQuickFilterLocation("ALL");
    }
  }, [scheduleQuickFilterLocation, scheduleQuickFilterLocationOptions]);
  useEffect(() => {
    if (scheduleQuickFilterCategory === "ALL") return;
    if (!scheduleQuickFilterCategoryOptions.includes(scheduleQuickFilterCategory)) {
      setScheduleQuickFilterCategory("ALL");
    }
  }, [scheduleQuickFilterCategory, scheduleQuickFilterCategoryOptions]);
  useEffect(() => {
    if (scheduleQuickFilterName === "ALL") return;
    if (!scheduleQuickFilterNameOptions.includes(scheduleQuickFilterName)) {
      setScheduleQuickFilterName("ALL");
    }
  }, [scheduleQuickFilterName, scheduleQuickFilterNameOptions]);
  useEffect(() => {
    const hasSelectedAsset = scheduleQuickFilteredAssets.some((a) => String(a.id) === scheduleQuickForm.assetId);
    if (!scheduleQuickForm.assetId || hasSelectedAsset) return;
    setScheduleQuickForm((f) => ({ ...f, assetId: "" }));
  }, [scheduleQuickForm.assetId, scheduleQuickFilteredAssets]);
  const scheduleAssets = useMemo(() => {
    const today = toYmd(new Date());
    // Prefer current in-memory/server assets, use fallback only to fill missing fields.
    const merged = mergeAssets(readAssetFallback(), assets);
    const filtered = campusFilter === "ALL" ? merged : merged.filter((a) => a.campus === campusFilter);
    return filtered
      .map((a) => {
        const nextMaintenanceDate = resolveNextScheduleDate(a, today);
        return { ...a, nextMaintenanceDate };
      })
      .filter((a) => a.nextMaintenanceDate)
      .sort((a, b) => (a.nextMaintenanceDate || "").localeCompare(b.nextMaintenanceDate || ""));
  }, [assets, campusFilter]);
  const scheduleListRows = useMemo(() => {
    return [...scheduleAssets].sort((a, b) => {
      const aDate = String(a.nextMaintenanceDate || "");
      const bDate = String(b.nextMaintenanceDate || "");
      if (aDate !== bDate) return aDate.localeCompare(bDate);
      const aName = assetItemName(a.category, a.type, a.pcType || "");
      const bName = assetItemName(b.category, b.type, b.pcType || "");
      if (aName !== bName) return aName.localeCompare(bName);
      return a.assetId.localeCompare(b.assetId);
    });
  }, [scheduleAssets, assetItemName]);
  const scheduleByDate = useMemo(() => {
    const gridStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());
    const gridEnd = new Date(gridStart);
    gridEnd.setDate(gridStart.getDate() + 41);
    const startYmd = toYmd(gridStart);
    const endYmd = toYmd(gridEnd);
    const map = new Map<string, Asset[]>();
    for (const asset of scheduleAssets) {
      if (asset.repeatMode === "MONTHLY_WEEKDAY") {
        for (let i = 0; i < 3; i += 1) {
          const monthRef = new Date(gridStart.getFullYear(), gridStart.getMonth() + i, 1);
          const d = nthWeekdayOfMonth(
            monthRef.getFullYear(),
            monthRef.getMonth(),
            Number(asset.repeatWeekday || 6),
            Number(asset.repeatWeekOfMonth || 1)
          );
          if (!d) continue;
          const key = toYmd(d);
          if (key < startYmd || key > endYmd) continue;
          if (hasCompletedMaintenanceOnDate(asset, key)) continue;
          if (!map.has(key)) map.set(key, []);
          map.get(key)?.push({ ...asset, nextMaintenanceDate: key });
        }
        continue;
      }
      const key = asset.nextMaintenanceDate || "";
      if (!key || key < startYmd || key > endYmd) continue;
      if (hasCompletedMaintenanceOnDate(asset, key)) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(asset);
    }
    return map;
  }, [scheduleAssets, calendarMonth]);
  const upcomingScheduleAssets = useMemo(() => {
    const today = toYmd(new Date());
    const in7 = toYmd(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    return scheduleAssets.filter((a) => (a.nextMaintenanceDate || "") >= today && (a.nextMaintenanceDate || "") <= in7);
  }, [scheduleAssets]);
  const overdueScheduleAssets = useMemo(() => {
    const today = toYmd(new Date());
    return scheduleAssets.filter((a) => (a.nextMaintenanceDate || "") < today);
  }, [scheduleAssets]);
  const maintenanceDashboardSummary = useMemo(() => {
    const total = allMaintenanceRows.length;
    const done = allMaintenanceRows.filter((row) => String(row.completion || "").trim().toLowerCase() === "done").length;
    const notYet = total - done;
    return {
      overdue: overdueScheduleAssets.length,
      upcoming: upcomingScheduleAssets.length,
      scheduled: scheduleAssets.length,
      done,
      notYet,
      total,
    };
  }, [allMaintenanceRows, overdueScheduleAssets.length, upcomingScheduleAssets.length, scheduleAssets.length]);
  const maintenanceDoneToday = useMemo(() => {
    const today = toYmd(new Date());
    let count = 0;
    for (const asset of assets) {
      for (const entry of asset.maintenanceHistory || []) {
        const raw = String(entry?.date || "").trim();
        if (!raw) continue;
        const ymd = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : toYmd(new Date(raw));
        if (ymd !== today) continue;
        if (String(entry?.completion || "").toLowerCase() === "done") count += 1;
      }
    }
    return count;
  }, [assets]);
  const maintenanceDueAssets = useMemo(
    () =>
      scheduleAssets.filter((asset) => {
        const dueDate = String(asset.nextMaintenanceDate || "").trim();
        if (!dueDate) return false;
        return !hasCompletedMaintenanceOnDate(asset, dueDate);
      }),
    [scheduleAssets]
  );
  const maintenanceDueByItemRows = useMemo(() => {
    const map = new Map<string, { itemName: string; count: number; assets: Asset[] }>();
    for (const asset of maintenanceDueAssets) {
      const itemName = assetItemName(asset.category, asset.type, asset.pcType || "");
      if (!map.has(itemName)) {
        map.set(itemName, { itemName, count: 0, assets: [] });
      }
      const row = map.get(itemName)!;
      row.count += 1;
      row.assets.push(asset);
    }
    return Array.from(map.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.itemName.localeCompare(b.itemName);
    });
  }, [maintenanceDueAssets, assetItemName]);
  const calendarGridDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const endOffset = 6 - lastDay.getDay();
    const totalCells = startOffset + lastDay.getDate() + endOffset;
    const startDate = new Date(year, month, 1 - startOffset);
    return Array.from({ length: totalCells }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const ymd = toYmd(d);
      const holiday = getHolidayEvent(ymd);
      return {
        ymd,
        day: d.getDate(),
        weekday: d.getDay(),
        inMonth: d.getMonth() === month,
        hasItems: (scheduleByDate.get(ymd) || []).length > 0,
        holidayName: holiday.name,
        holidayType: holiday.type,
      };
    });
  }, [calendarMonth, scheduleByDate, getHolidayEvent]);
  const selectedDateItems = useMemo(
    () => scheduleByDate.get(selectedCalendarDate) || [],
    [scheduleByDate, selectedCalendarDate]
  );
  const scheduleAlertItems = useMemo(() => {
    let title = "";
    let items: Asset[] = [];
    if (scheduleAlertModal === "overdue") {
      title = "Overdue Scheduled Assets";
      items = overdueScheduleAssets;
    } else if (scheduleAlertModal === "upcoming") {
      title = "Scheduled Assets - Next 7 Days";
      items = upcomingScheduleAssets;
    } else if (scheduleAlertModal === "scheduled") {
      title = "All Scheduled Assets";
      items = scheduleAssets;
    } else if (scheduleAlertModal === "selected") {
      title = `Selected Date Assets - ${selectedCalendarDate}`;
      items = selectedDateItems;
    }
    if (scheduleAlertItemFilter !== "ALL") {
      items = items.filter(
        (asset) => assetItemName(asset.category, asset.type, asset.pcType || "") === scheduleAlertItemFilter
      );
      title = `${title} - ${scheduleAlertItemFilter}`;
    }
    return { title, items };
  }, [
    scheduleAlertModal,
    overdueScheduleAssets,
    upcomingScheduleAssets,
    scheduleAssets,
    selectedDateItems,
    selectedCalendarDate,
    scheduleAlertItemFilter,
    assetItemName,
  ]);
  const overviewModalData = useMemo(() => {
    const openTickets = tickets.filter((t) => t.status !== "Resolved");
    if (overviewModal === "total") {
      return {
        title: "Total Assets",
        mode: "assets" as const,
        assets: assets,
        tickets: [] as Ticket[],
      };
    }
    if (overviewModal === "it") {
      return {
        title: "IT Assets",
        mode: "assets" as const,
        assets: assets.filter((a) => a.category === "IT"),
        tickets: [] as Ticket[],
      };
    }
    if (overviewModal === "safety") {
      return {
        title: "Safety Assets",
        mode: "assets" as const,
        assets: assets.filter((a) => a.category === "SAFETY"),
        tickets: [] as Ticket[],
      };
    }
    if (overviewModal === "tickets") {
      return {
        title: "Open Work Orders",
        mode: "tickets" as const,
        assets: [] as Asset[],
        tickets: openTickets,
      };
    }
    return {
      title: "",
      mode: "assets" as const,
      assets: [] as Asset[],
      tickets: [] as Ticket[],
    };
  }, [overviewModal, assets, tickets]);
  const maintenanceDashboardModalData = useMemo(() => {
    if (maintenanceDashboardModal === "overdue") {
      return {
        title: lang === "km" ? "លើសកាលកំណត់" : "Overdue",
        mode: "assets" as const,
        assets: overdueScheduleAssets,
        rows: [] as typeof allMaintenanceRows,
      };
    }
    if (maintenanceDashboardModal === "upcoming") {
      return {
        title: lang === "km" ? "7 ថ្ងៃបន្ទាប់" : "Next 7 Days",
        mode: "assets" as const,
        assets: upcomingScheduleAssets,
        rows: [] as typeof allMaintenanceRows,
      };
    }
    if (maintenanceDashboardModal === "scheduled") {
      return {
        title: lang === "km" ? "កាលវិភាគសរុប" : "Scheduled",
        mode: "assets" as const,
        assets: scheduleAssets,
        rows: [] as typeof allMaintenanceRows,
      };
    }
    if (maintenanceDashboardModal === "done") {
      return {
        title: lang === "km" ? "កំណត់ត្រា Done" : "Done Records",
        mode: "rows" as const,
        assets: [] as Asset[],
        rows: allMaintenanceRows.filter((row) => String(row.completion || "").trim().toLowerCase() === "done"),
      };
    }
    return {
      title: "",
      mode: "assets" as const,
      assets: [] as Asset[],
      rows: [] as typeof allMaintenanceRows,
    };
  }, [
    maintenanceDashboardModal,
    lang,
    overdueScheduleAssets,
    upcomingScheduleAssets,
    scheduleAssets,
    allMaintenanceRows,
  ]);

  function toggleMaintenanceSort(key: MaintenanceSortKey) {
    setMaintenanceSort((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: "asc" };
    });
  }

  function toggleAssetListSort(key: AssetListSortKey) {
    setAssetListSort((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: "asc" };
    });
  }

  useEffect(() => {
    if (scheduleForm.assetId) return;
    if (scheduleAssets.length) {
      setScheduleForm((f) => ({ ...f, assetId: String(scheduleAssets[0].id) }));
    }
  }, [scheduleAssets, scheduleForm.assetId]);

  useEffect(() => {
    if (maintenanceRecordForm.assetId) return;
    if (maintenanceRecordFilteredAssets.length) {
      setMaintenanceRecordForm((f) => ({ ...f, assetId: String(maintenanceRecordFilteredAssets[0].id) }));
    }
  }, [maintenanceRecordFilteredAssets, maintenanceRecordForm.assetId]);

  useEffect(() => {
    if (verificationRecordForm.assetId) return;
    if (verificationRecordFilteredAssets.length) {
      setVerificationRecordForm((f) => ({ ...f, assetId: String(verificationRecordFilteredAssets[0].id) }));
    }
  }, [verificationRecordFilteredAssets, verificationRecordForm.assetId]);

  useEffect(() => {
    if (transferForm.assetId) return;
    if (assets.length) {
      const first = assets[0];
      setTransferForm((f) => ({
        ...f,
        assetId: String(first.id),
        toCampus: first.campus,
        toAssignedTo: first.assignedTo || "",
      }));
    }
  }, [assets, transferForm.assetId]);

  useEffect(() => {
    if (!transferForm.assetId) {
      setShowTransferAssetPicker(true);
    }
  }, [transferForm.assetId]);

  const allTransferRows = useMemo(() => {
    const cachedAssets = readAssetFallback();
    const sourceAssets = cachedAssets.length ? cachedAssets : assets;
    const rows: Array<{
      rowId: string;
      assetId: string;
      date: string;
      fromCampus: string;
      fromLocation: string;
      toCampus: string;
      toLocation: string;
      fromUser: string;
      toUser: string;
      responsibilityAck: string;
      by: string;
      reason: string;
      note: string;
    }> = [];
    for (const asset of sourceAssets) {
      for (const entry of asset.transferHistory || []) {
        const matchedCustody = (asset.custodyHistory || []).find(
          (row) =>
            String(row.date || "").slice(0, 10) === String(entry.date || "").slice(0, 10) &&
            String(row.toCampus || "") === String(entry.toCampus || "") &&
            String(row.toLocation || "") === String(entry.toLocation || "")
        );
        rows.push({
          rowId: `${asset.id}-${entry.id}`,
          assetId: asset.assetId,
          date: entry.date || "",
          fromCampus: entry.fromCampus || "",
          fromLocation: entry.fromLocation || "",
          toCampus: entry.toCampus || "",
          toLocation: entry.toLocation || "",
          fromUser: matchedCustody?.fromUser || "",
          toUser: matchedCustody?.toUser || "",
          responsibilityAck: matchedCustody?.responsibilityAck ? "Yes" : "No",
          by: entry.by || "",
          reason: entry.reason || "",
          note: entry.note || "",
        });
      }
    }
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [assets]);
  const staffBorrowingRows = useMemo(() => {
    return assets
      .filter((asset) => String(asset.assignedTo || "").trim())
      .map((asset) => {
        const latestCustody = [...(asset.custodyHistory || [])].sort((a, b) =>
          String(b.date || "").localeCompare(String(a.date || ""))
        )[0];
        return {
          assetDbId: asset.id,
          assetId: asset.assetId,
          assetPhoto: asset.photo || "",
          itemName: assetItemName(asset.category, asset.type, asset.pcType || ""),
          campus: asset.campus,
          location: asset.location || "-",
          assignedTo: String(asset.assignedTo || "").trim(),
          sinceDate: latestCustody?.date || asset.created || "",
          lastAction: latestCustody?.action || "ASSIGN",
          responsibilityAck: latestCustody?.responsibilityAck ? "Yes" : "No",
          note: latestCustody?.note || "",
        };
      })
      .sort((a, b) => a.assignedTo.localeCompare(b.assignedTo) || a.assetId.localeCompare(b.assetId));
  }, [assets, assetItemName]);

  const maintenanceCompletionRows = useMemo(() => {
    return allMaintenanceRows.filter((row) => {
      if (!row.date) return false;
      if (reportDateFrom && row.date < reportDateFrom) return false;
      if (reportDateTo && row.date > reportDateTo) return false;
      return true;
    });
  }, [allMaintenanceRows, reportDateFrom, reportDateTo]);

  const maintenanceCompletionSummary = useMemo(() => {
    const done = maintenanceCompletionRows.filter((r) => r.completion === "Done").length;
    const notYet = maintenanceCompletionRows.filter((r) => r.completion !== "Done").length;
    return { done, notYet, total: maintenanceCompletionRows.length };
  }, [maintenanceCompletionRows]);
  const maintenanceCompletionRangeLabel = useMemo(() => {
    const from = reportDateFrom || "-";
    const to = reportDateTo || "-";
    return `${from} to ${to}`;
  }, [reportDateFrom, reportDateTo]);
  const verificationSummaryRows = useMemo(() => {
    const year = Number(reportYear) || new Date().getFullYear();
    const range =
      reportPeriodMode === "month"
        ? { from: `${reportMonth}-01`, to: `${reportMonth}-31` }
        : getTermRange(year, reportTerm);
    return allVerificationRows.filter((row) => row.date && row.date >= range.from && row.date <= range.to);
  }, [allVerificationRows, reportMonth, reportPeriodMode, reportTerm, reportYear]);
  const verificationSummary = useMemo(() => {
    const verified = verificationSummaryRows.filter((r) => r.result === "Verified").length;
    const issue = verificationSummaryRows.filter((r) => r.result === "Issue Found").length;
    const missing = verificationSummaryRows.filter((r) => r.result === "Missing").length;
    return { verified, issue, missing, total: verificationSummaryRows.length };
  }, [verificationSummaryRows]);
  const locationAssetSummaryRows = useMemo(() => {
    const grouped = new Map<
      string,
      {
        campus: string;
        location: string;
        total: number;
        it: number;
        safety: number;
        items: Record<string, number>;
      }
    >();

    for (const asset of assets) {
      const campus = asset.campus || "-";
      const location = asset.location || "Unassigned";
      const key = `${campus}||${location}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          campus,
          location,
          total: 0,
          it: 0,
          safety: 0,
          items: {},
        });
      }
      const row = grouped.get(key)!;
      row.total += 1;
      if (asset.category === "IT") row.it += 1;
      if (asset.category === "SAFETY") row.safety += 1;
      const itemName = assetItemName(asset.category, asset.type, asset.pcType || "");
      row.items[itemName] = (row.items[itemName] || 0) + 1;
    }

    return Array.from(grouped.values())
      .map((row) => {
        const itemSummary = Object.entries(row.items)
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .map(([name, count]) => `${name} (${count})`)
          .join(", ");
        return { ...row, itemSummary };
      })
      .sort(
        (a, b) =>
          campusLabel(a.campus).localeCompare(campusLabel(b.campus)) ||
          a.location.localeCompare(b.location)
      );
  }, [assets, assetItemName, campusLabel]);
  const assetMasterSetRows = useMemo(() => {
    const toItemDescription = (asset: Asset) => {
      const chunks = [
        asset.specs || "",
        [asset.brand || "", asset.model || ""].filter(Boolean).join(" "),
        asset.serialNumber ? `SN: ${asset.serialNumber}` : "",
      ]
        .map((x) => String(x || "").trim())
        .filter(Boolean);
      return chunks.join(" | ") || "-";
    };
    const toLastServiceDate = (asset: Asset) => {
      const history = Array.isArray(asset.maintenanceHistory) ? asset.maintenanceHistory : [];
      if (!history.length) return "-";
      const latest = [...history].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0];
      return latest?.date || "-";
    };
    const assetsById = new Map<string, Asset>();
    for (const asset of assets) assetsById.set(asset.assetId, asset);
    const setMainByCode = new Map<string, string>();
    const groupedBySet = new Map<string, Asset[]>();
    for (const asset of assets) {
      const code = String(asset.setCode || "").trim();
      if (!code) continue;
      const list = groupedBySet.get(code) || [];
      list.push(asset);
      groupedBySet.set(code, list);
    }
    for (const [setCode, list] of Array.from(groupedBySet.entries())) {
      const main =
        list.find((a) => a.category === "IT" && a.type === DESKTOP_PARENT_TYPE) ||
        list.find((a) => !a.parentAssetId) ||
        list[0];
      if (main?.assetId) setMainByCode.set(setCode, main.assetId);
    }
    return [...assets]
      .map((asset) => {
        const setCode = String(asset.setCode || "").trim() || "-";
        const parentAssetId = String(asset.parentAssetId || "").trim();
        let linkedTo = "-";
        if (parentAssetId && assetsById.has(parentAssetId)) {
          linkedTo = parentAssetId;
        } else if (parentAssetId) {
          linkedTo = parentAssetId;
        } else if (setCode !== "-") {
          linkedTo = setMainByCode.get(setCode) || "-";
        }
        return {
          key: `asset-${asset.id}`,
          assetDbId: asset.id,
          assetId: asset.assetId,
          setCode,
          linkedTo,
          category: asset.category || "-",
          type: asset.type || "",
          pcType: asset.pcType || "",
          itemName: assetItemName(asset.category, asset.type, asset.pcType || ""),
          itemDescription: toItemDescription(asset),
          serialNumber: String(asset.serialNumber || "").trim(),
          location: asset.location || "-",
          purchaseDate: asset.purchaseDate || "-",
          lastServiceDate: toLastServiceDate(asset),
          assignedTo: asset.assignedTo || "-",
          status: assetStatusLabel(asset.status || "-"),
          photo: asset.photo || "",
          campus: asset.campus || "-",
        };
      })
      .sort(
        (a, b) =>
          campusLabel(a.campus).localeCompare(campusLabel(b.campus)) ||
          a.location.localeCompare(b.location) ||
          a.assetId.localeCompare(b.assetId)
      );
  }, [assets, assetItemName, campusLabel, assetStatusLabel]);

  const setCodeReportRows = useMemo(() => {
    const groupedBySet = new Map<string, Asset[]>();
    for (const asset of assets) {
      const setCode = String(asset.setCode || "").trim();
      if (!setCode) continue;
      const list = groupedBySet.get(setCode) || [];
      list.push(asset);
      groupedBySet.set(setCode, list);
    }
    return Array.from(groupedBySet.entries())
      .map(([setCode, list]) => {
        const sorted = [...list].sort((a, b) => String(a.assetId || "").localeCompare(String(b.assetId || "")));
        const main =
          sorted.find((a) => a.category === "IT" && a.type === DESKTOP_PARENT_TYPE) ||
          sorted.find((a) => !String(a.parentAssetId || "").trim()) ||
          sorted[0];
        const mainAssetId = String(main?.assetId || "-");
        const mainItem = main ? assetItemName(main.category, main.type, main.pcType || "") : "-";
        const mainPhoto = String(main?.photo || "");
        const campus = String(main?.campus || sorted[0]?.campus || "-");
        const connectedItems = sorted
          .filter((asset) => String(asset.assetId || "") !== mainAssetId)
          .map((asset) => ({
            assetId: String(asset.assetId || "-"),
            itemName: assetItemName(asset.category, asset.type, asset.pcType || ""),
            photo: String(asset.photo || ""),
          }));
        return {
          key: `set-code-${setCode}`,
          setCode,
          mainAssetId,
          mainItem,
          mainPhoto,
          campus,
          totalItems: sorted.length,
          connectedItems,
        };
      })
      .sort((a, b) => a.setCode.localeCompare(b.setCode));
  }, [assets, assetItemName]);

  const qrLabelRows = useMemo(
    () =>
      assetMasterSetRows.map((row) => ({
        assetDbId: row.assetDbId,
        assetId: row.assetId,
        itemName: row.itemName,
        campus: row.campus,
        category: row.category,
        location: row.location,
        status: row.status,
        serialNumber: row.serialNumber,
      })),
    [assetMasterSetRows]
  );

  const assetMasterItemFilterOptions = useMemo(() => {
    const options = Array.from(new Set(assetMasterSetRows.map((row) => row.itemName).filter(Boolean)));
    return options.sort((a, b) => a.localeCompare(b));
  }, [assetMasterSetRows]);

  const assetMasterCampusFilterOptions = useMemo(() => {
    const options = Array.from(new Set(assetMasterSetRows.map((row) => row.campus).filter(Boolean)));
    return options.sort((a, b) => campusLabel(a).localeCompare(campusLabel(b)));
  }, [assetMasterSetRows, campusLabel]);

  const assetMasterCategoryFilterOptions = useMemo(() => {
    const options = Array.from(new Set(assetMasterSetRows.map((row) => row.category).filter(Boolean)));
    return options.sort((a, b) => a.localeCompare(b));
  }, [assetMasterSetRows]);

  const filteredAssetMasterRows = useMemo(() => {
    return assetMasterSetRows.filter((row) => {
      if (!assetMasterCampusFilter.includes("ALL") && !assetMasterCampusFilter.includes(row.campus)) return false;
      if (!assetMasterCategoryFilter.includes("ALL") && !assetMasterCategoryFilter.includes(row.category)) return false;
      if (!assetMasterItemFilter.includes("ALL") && !assetMasterItemFilter.includes(row.itemName)) return false;
      return true;
    });
  }, [assetMasterSetRows, assetMasterCampusFilter, assetMasterCategoryFilter, assetMasterItemFilter]);

  const sortedAssetMasterRows = useMemo(() => {
    const direction = assetMasterSort.direction === "asc" ? 1 : -1;
    return [...filteredAssetMasterRows].sort((a, b) => {
      const aVal = String(a[assetMasterSort.key] || "");
      const bVal = String(b[assetMasterSort.key] || "");
      if (assetMasterSort.key === "campus") {
        return campusLabel(aVal).localeCompare(campusLabel(bVal)) * direction;
      }
      return aVal.localeCompare(bVal) * direction;
    });
  }, [filteredAssetMasterRows, assetMasterSort, campusLabel]);

  const toggleAssetMasterSort = useCallback((key: AssetMasterSortKey) => {
    setAssetMasterSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  }, []);

  const assetMasterSortMark = useCallback(
    (key: AssetMasterSortKey) =>
      assetMasterSort.key === key ? (assetMasterSort.direction === "asc" ? " ▲" : " ▼") : "",
    [assetMasterSort]
  );

  const assetMasterColumnDefs = useMemo<
    Array<{ key: AssetMasterColumnKey; label: string; sortable?: boolean }>
  >(
    () => [
      { key: "photo", label: t.photo, sortable: true },
      { key: "assetId", label: t.assetId, sortable: true },
      { key: "linkedTo", label: "Linked To (Main Asset)", sortable: true },
      { key: "itemDescription", label: "Item Description", sortable: true },
      { key: "category", label: t.category, sortable: true },
      { key: "campus", label: t.campus, sortable: true },
      { key: "location", label: t.location, sortable: true },
      { key: "purchaseDate", label: "Purchase Date", sortable: true },
      { key: "lastServiceDate", label: "Last Service", sortable: true },
      { key: "status", label: t.status, sortable: true },
    ],
    [t.photo, t.assetId, t.category, t.campus, t.location, t.status]
  );

  const isAssetMasterColumnVisible = useCallback(
    (key: AssetMasterColumnKey) => assetMasterVisibleColumns.includes(key),
    [assetMasterVisibleColumns]
  );

  const updateSingleSelect = useCallback(
    (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string, checked: boolean) => {
      setter((prev) => {
        if (value === "ALL") return checked ? ["ALL"] : [];
        if (!checked) return prev.filter((item) => item !== value);
        return [value];
      });
    },
    []
  );

  const handleAssetMasterFilterMenuToggle = useCallback(
    (event: React.SyntheticEvent<HTMLDetailsElement>) => {
      const current = event.currentTarget;
      if (!current.open) return;
      const wrapper = current.parentElement;
      if (!wrapper) return;
      const menus = wrapper.querySelectorAll<HTMLDetailsElement>("details.filter-menu");
      menus.forEach((menu) => {
        if (menu !== current) menu.open = false;
      });
    },
    []
  );

  const updateAssetMasterColumnSelection = useCallback((column: AssetMasterColumnKey) => {
    setAssetMasterVisibleColumns((prev) => {
      const exists = prev.includes(column);
      if (exists) {
        if (prev.length <= 1) return prev;
        return prev.filter((item) => item !== column);
      }
      const withColumn = [...prev, column];
      const order = assetMasterColumnDefs.map((d) => d.key);
      return [...withColumn].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    });
  }, [assetMasterColumnDefs]);

  const campusFilterSummary = assetMasterCampusFilter.includes("ALL")
    ? t.allCampuses
    : lang === "km"
      ? `បានជ្រើស ${assetMasterCampusFilter.length} សាខា`
      : `${assetMasterCampusFilter.length} campus selected`;
  const categoryFilterSummary = assetMasterCategoryFilter.includes("ALL")
    ? t.allCategories
    : lang === "km"
      ? `បានជ្រើស ${assetMasterCategoryFilter.length} ប្រភេទ`
      : `${assetMasterCategoryFilter.length} category selected`;
  const itemFilterSummary = assetMasterItemFilter.includes("ALL")
    ? (lang === "km" ? "គ្រប់ឈ្មោះទំនិញ" : "All Item Names")
    : lang === "km"
      ? `បានជ្រើស ${assetMasterItemFilter.length} ឈ្មោះ`
      : `${assetMasterItemFilter.length} item selected`;
  const edTemplateOptions = useMemo<Array<{ value: EdAssetTemplate; label: string }>>(
    () =>
      lang === "km"
        ? [
            { value: "ALL", label: "ED Template: ទាំងអស់" },
            { value: "computer", label: "Computer List" },
            { value: "ipad", label: "iPad List" },
            { value: "speaker", label: "Speaker List" },
            { value: "tv", label: "TV List" },
            { value: "aircon", label: "Air-Con List" },
            { value: "monitor", label: "Monitor List" },
            { value: "peripheral", label: "Computer Peripheral List" },
          ]
        : [
            { value: "ALL", label: "ED Template: All Assets" },
            { value: "computer", label: "Computer List" },
            { value: "ipad", label: "iPad List" },
            { value: "speaker", label: "Speaker List" },
            { value: "tv", label: "TV List" },
            { value: "aircon", label: "Air-Con List" },
            { value: "monitor", label: "Monitor List" },
            { value: "peripheral", label: "Computer Peripheral List" },
          ],
    [lang]
  );
  const selectedEdTemplateLabel = edTemplateOptions.find((option) => option.value === edAssetTemplate)?.label || "ED Template";
  const assetMasterReportRows = useMemo(() => {
    if (edAssetTemplate === "ALL") return sortedAssetMasterRows;
    return sortedAssetMasterRows.filter((row) => {
      const item = String(row.itemName || "").toLowerCase();
      if (edAssetTemplate === "computer") return item.includes("computer");
      if (edAssetTemplate === "ipad") return item.includes("ipad");
      if (edAssetTemplate === "speaker") return item.includes("speaker");
      if (edAssetTemplate === "tv") return item.includes("tv") || item.includes("television");
      if (edAssetTemplate === "aircon") return item.includes("air conditioner") || item.includes("air-con");
      if (edAssetTemplate === "monitor") return item.includes("monitor");
      if (edAssetTemplate === "peripheral") {
        return (
          item.includes("keyboard") ||
          item.includes("mouse") ||
          item.includes("digital camera") ||
          item.includes("slide projector") ||
          item.includes("usb wifi") ||
          item.includes("webcam") ||
          item.includes("web camera")
        );
      }
      return true;
    });
  }, [sortedAssetMasterRows, edAssetTemplate]);
  const columnFilterSummary = lang === "km" ? "ជ្រើសជួរឈរ" : "Select Column";
  const reportTypeOptions = useMemo(
    () =>
      (
        lang === "km"
          ? [
              { value: "asset_master" as ReportType, label: "បញ្ជីទ្រព្យសម្បត្តិ" },
              { value: "set_code" as ReportType, label: "ព័ត៌មានក្រុមឧបករណ៍កុំព្យូទ័រ" },
              { value: "asset_by_location" as ReportType, label: "ទ្រព្យសម្បត្តិតាមសាខា និងទីតាំង" },
              { value: "overdue" as ReportType, label: "ថែទាំលើសកាលកំណត់" },
              { value: "transfer" as ReportType, label: "ប្រវត្តិផ្ទេរទ្រព្យសម្បត្តិ" },
              { value: "staff_borrowing" as ReportType, label: "បញ្ជីខ្ចីឧបករណ៍បុគ្គលិក" },
              { value: "maintenance_completion" as ReportType, label: "លទ្ធផលបញ្ចប់ការថែទាំ" },
              { value: "verification_summary" as ReportType, label: "សង្ខេបលទ្ធផលត្រួតពិនិត្យ" },
              { value: "qr_labels" as ReportType, label: "លេខទ្រព្យ + QR" },
            ]
          : [
              { value: "asset_master" as ReportType, label: "Asset Master Register" },
              { value: "set_code" as ReportType, label: "Computer Set Detail" },
              { value: "asset_by_location" as ReportType, label: "Asset by Campus and Location" },
              { value: "overdue" as ReportType, label: "Overdue Maintenance" },
              { value: "transfer" as ReportType, label: "Asset Transfer Log" },
              { value: "staff_borrowing" as ReportType, label: "Staff Borrowing List" },
              { value: "maintenance_completion" as ReportType, label: "Maintenance Completion" },
              { value: "verification_summary" as ReportType, label: "Verification Summary" },
              { value: "qr_labels" as ReportType, label: "Asset ID + QR Labels" },
            ]
      ).filter((option) => canAccessMenu(`reports.${option.value}`, "reports")),
    [lang, canAccessMenu]
  );
  const selectedReportTypeLabel =
    reportTypeOptions.find((option) => option.value === reportType)?.label ||
    (lang === "km" ? "របាយការណ៍" : "Report");
  const reportTypeGuideText = useMemo(() => {
    const guides: Record<ReportType, string> =
      lang === "km"
        ? {
            asset_master: "បញ្ជីទ្រព្យសម្បត្តិលម្អិត តាមអ្វីដែលបានជ្រើស។",
            set_code: "មើលក្រុមឧបករណ៍ និងសមាសភាគដែលភ្ជាប់ជាមួយគ្នា។",
            asset_by_location: "សង្ខេបចំនួនឧបករណ៍តាមសាខា និងទីតាំង។",
            overdue: "មើលឧបករណ៍ដែលលើសកាលកំណត់ថែទាំ។",
            transfer: "ប្រវត្តិផ្ទេរទ្រព្យសម្បត្តិរវាងសាខា/ទីតាំង។",
            staff_borrowing: "ទ្រព្យដែលកំពុងចាត់តាំងឱ្យបុគ្គលិក និងអ្នកទទួលខុសត្រូវបច្ចុប្បន្ន។",
            maintenance_completion: "តាមដានលទ្ធផលថែទាំក្នុងចន្លោះកាលបរិច្ឆេទ។",
            verification_summary: "សង្ខេបលទ្ធផលត្រួតពិនិត្យតាមខែ ឬត្រីមាស។",
            qr_labels: "បោះពុម្ពស្លាក QR សម្រាប់ទ្រព្យសម្បត្តិ។",
          }
        : {
            asset_master: "Detailed asset list based on selected filters.",
            set_code: "View each computer set with all connected items.",
            asset_by_location: "Summary count by campus and location.",
            overdue: "Show assets that are overdue for maintenance.",
            transfer: "Transfer history between campuses and locations.",
            staff_borrowing: "Assets currently assigned to staff with accountability records.",
            maintenance_completion: "Maintenance completion records in selected date range.",
            verification_summary: "Verification summary by month or term.",
            qr_labels: "Print QR labels for selected assets.",
          };
    return guides[reportType];
  }, [lang, reportType]);
  const hasReportFilters = useMemo(
    () =>
      reportType === "asset_master" ||
      reportType === "maintenance_completion" ||
      reportType === "verification_summary" ||
      reportType === "qr_labels",
    [reportType]
  );
  const resetReportFilters = useCallback(() => {
    if (reportType === "asset_master") {
      setAssetMasterCampusFilter(["ALL"]);
      setAssetMasterCategoryFilter(["ALL"]);
      setAssetMasterItemFilter(["ALL"]);
      setEdAssetTemplate("ALL");
      setAssetMasterVisibleColumns([
        "photo",
        "assetId",
        "linkedTo",
        "itemDescription",
        "category",
        "campus",
        "location",
        "purchaseDate",
        "lastServiceDate",
        "status",
      ]);
      return;
    }
    if (reportType === "maintenance_completion") {
      const today = new Date();
      const ymd = toYmd(today);
      setReportDateFrom(`${ymd.slice(0, 7)}-01`);
      setReportDateTo(ymd);
      return;
    }
    if (reportType === "verification_summary") {
      const today = new Date();
      setReportPeriodMode("month");
      setReportMonth(toYmd(today).slice(0, 7));
      setReportYear(String(today.getFullYear()));
      setReportTerm("Term 1");
      return;
    }
    if (reportType === "qr_labels") {
      setQrCampusFilter("ALL");
      setQrLocationFilter("ALL");
      setQrCategoryFilter("ALL");
      setQrItemFilter(["ALL"]);
    }
  }, [reportType]);

  const qrLocationFilterOptions = useMemo(() => {
    const source =
      qrCampusFilter === "ALL"
        ? qrLabelRows
        : qrLabelRows.filter((row) => row.campus === qrCampusFilter);
    const options = Array.from(new Set(source.map((row) => String(row.location || "").trim()).filter(Boolean)));
    return options.sort((a, b) => a.localeCompare(b));
  }, [qrLabelRows, qrCampusFilter]);
  const qrRowsByCampusLocation = useMemo(() => {
    return qrLabelRows.filter((row) => {
      if (qrCampusFilter !== "ALL" && row.campus !== qrCampusFilter) return false;
      if (qrLocationFilter !== "ALL" && String(row.location || "").trim() !== qrLocationFilter) return false;
      return true;
    });
  }, [qrLabelRows, qrCampusFilter, qrLocationFilter]);
  const qrCategoryFilterOptions = useMemo(() => {
    const options = Array.from(new Set(qrRowsByCampusLocation.map((row) => row.category).filter(Boolean)));
    const order = ["IT", "SAFETY", "FACILITY"];
    return options.sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [qrRowsByCampusLocation]);
  const qrRowsByCampusLocationCategory = useMemo(() => {
    return qrRowsByCampusLocation.filter((row) => (qrCategoryFilter === "ALL" ? true : row.category === qrCategoryFilter));
  }, [qrRowsByCampusLocation, qrCategoryFilter]);
  const qrItemFilterOptions = useMemo(() => {
    const options = Array.from(new Set(qrRowsByCampusLocationCategory.map((row) => row.itemName).filter(Boolean)));
    return options.sort((a, b) => a.localeCompare(b));
  }, [qrRowsByCampusLocationCategory]);
  useEffect(() => {
    if (qrLocationFilter === "ALL") return;
    if (!qrLocationFilterOptions.includes(qrLocationFilter)) {
      setQrLocationFilter("ALL");
    }
  }, [qrLocationFilter, qrLocationFilterOptions]);
  useEffect(() => {
    if (qrCategoryFilter === "ALL") return;
    if (!qrCategoryFilterOptions.includes(qrCategoryFilter)) {
      setQrCategoryFilter("ALL");
    }
  }, [qrCategoryFilter, qrCategoryFilterOptions]);
  useEffect(() => {
    setQrItemFilter((prev) => {
      if (prev.includes("ALL")) return prev;
      return prev.filter((item) => qrItemFilterOptions.includes(item));
    });
  }, [qrItemFilterOptions]);
  const quickCountCampusFilterOptions = useMemo(
    () => [...CAMPUS_LIST].sort((a, b) => campusLabel(a).localeCompare(campusLabel(b))),
    [campusLabel]
  );
  const quickCountCategoryFilterOptions = useMemo(
    () => CATEGORY_OPTIONS.map((item) => item.value),
    []
  );
  const quickCountStatusFilterOptions = useMemo(
    () => ASSET_STATUS_OPTIONS.map((item) => item.value),
    []
  );
  const quickCountLocationOptions = useMemo(() => {
    let list = [...assets];
    if (!quickCountCampusFilter.includes("ALL")) {
      list = list.filter((asset) => quickCountCampusFilter.includes(asset.campus));
    }
    if (!quickCountCategoryFilter.includes("ALL")) {
      list = list.filter((asset) => quickCountCategoryFilter.includes(asset.category));
    }
    if (!quickCountStatusFilter.includes("ALL")) {
      list = list.filter(
        (asset) =>
          quickCountStatusFilter.some(
            (status) => String(asset.status || "Active").trim().toLowerCase() === status.toLowerCase()
          )
      );
    }
    return Array.from(new Set(list.map((asset) => String(asset.location || "").trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [assets, quickCountCampusFilter, quickCountCategoryFilter, quickCountStatusFilter]);
  useEffect(() => {
    setQuickCountLocationFilter((prev) => {
      if (prev.includes("ALL")) return prev;
      const next = prev.filter((location) => quickCountLocationOptions.includes(location));
      if (next.length === prev.length && next.every((value, index) => value === prev[index])) {
        return prev;
      }
      return next.length ? next : ["ALL"];
    });
  }, [quickCountLocationFilter, quickCountLocationOptions]);
  const quickCountBaseAssets = useMemo(() => {
    let list = [...assets];
    if (!quickCountCampusFilter.includes("ALL")) {
      list = list.filter((asset) => quickCountCampusFilter.includes(asset.campus));
    }
    if (!quickCountCategoryFilter.includes("ALL")) {
      list = list.filter((asset) => quickCountCategoryFilter.includes(asset.category));
    }
    if (!quickCountLocationFilter.includes("ALL")) {
      list = list.filter((asset) => quickCountLocationFilter.includes(String(asset.location || "").trim()));
    }
    if (!quickCountStatusFilter.includes("ALL")) {
      list = list.filter(
        (asset) =>
          quickCountStatusFilter.some(
            (status) => String(asset.status || "Active").trim().toLowerCase() === status.toLowerCase()
          )
      );
    }
    return list;
  }, [assets, quickCountCampusFilter, quickCountCategoryFilter, quickCountLocationFilter, quickCountStatusFilter]);
  const quickCountRows = useMemo(() => {
    const map = new Map<string, { category: string; itemName: string; count: number }>();
    for (const asset of quickCountBaseAssets) {
      const itemName = assetItemName(asset.category, asset.type, asset.pcType || "");
      if (!itemName) continue;
      const category = String(asset.category || "OTHER");
      const key = `${category}::${itemName}`;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, { category, itemName, count: 1 });
      }
    }
    const categoryOrder = ["IT", "SAFETY"];
    return Array.from(map.values()).sort((a, b) => {
      const aIdx = categoryOrder.indexOf(a.category);
      const bIdx = categoryOrder.indexOf(b.category);
      if (aIdx !== bIdx) {
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return aIdx - bIdx;
      }
      return b.count - a.count || a.itemName.localeCompare(b.itemName);
    });
  }, [quickCountBaseAssets, assetItemName]);
  const quickCountFilteredRows = useMemo(() => {
    const q = String(quickCountQuery || "").trim().toLowerCase();
    if (!q) return quickCountRows;
    return quickCountRows.filter(
      (row) => row.itemName.toLowerCase().includes(q) || row.category.toLowerCase().includes(q)
    );
  }, [quickCountRows, quickCountQuery]);
  const quickCountGroupedRows = useMemo(() => {
    const grouped = new Map<string, typeof quickCountFilteredRows>();
    for (const row of quickCountFilteredRows) {
      const list = grouped.get(row.category) || [];
      list.push(row);
      grouped.set(row.category, list);
    }
    const categoryOrder = ["IT", "SAFETY"];
    return Array.from(grouped.entries())
      .sort((a, b) => {
        const aIdx = categoryOrder.indexOf(a[0]);
        const bIdx = categoryOrder.indexOf(b[0]);
        if (aIdx !== bIdx) {
          if (aIdx === -1) return 1;
          if (bIdx === -1) return -1;
          return aIdx - bIdx;
        }
        return a[0].localeCompare(b[0]);
      })
      .map(([category, rows]) => ({ category, rows: rows.slice(0, 18) }));
  }, [quickCountFilteredRows]);
  const quickCountFilteredTotal = useMemo(
    () => quickCountFilteredRows.reduce((sum, row) => sum + row.count, 0),
    [quickCountFilteredRows]
  );
  const quickCountStatusAssets = useMemo(() => {
    const buckets = {
      active: [] as Asset[],
      retired: [] as Asset[],
      underMaintenance: [] as Asset[],
      broken: [] as Asset[],
    };

    for (const asset of quickCountBaseAssets) {
      const status = String(asset.status || "Active").trim().toLowerCase();
      const history = Array.isArray(asset.maintenanceHistory) ? asset.maintenanceHistory : [];
      const hasOpenMaintenance = history.some(
        (entry) => String(entry?.completion || "").trim().toLowerCase() === "not yet"
      );
      const hasBrokenSignal =
        status.includes("broken") ||
        history.some((entry) =>
          isBrokenMaintenance(String(entry?.condition || ""), String(entry?.note || ""))
        );

      if (status === "retired") buckets.retired.push(asset);
      else if (status === "maintenance" || hasOpenMaintenance) buckets.underMaintenance.push(asset);
      else buckets.active.push(asset);

      if (hasBrokenSignal) buckets.broken.push(asset);
    }

    return buckets;
  }, [quickCountBaseAssets, isBrokenMaintenance]);
  const quickCountStatusSummary = useMemo(
    () => ({
      active: quickCountStatusAssets.active.length,
      retired: quickCountStatusAssets.retired.length,
      underMaintenance: quickCountStatusAssets.underMaintenance.length,
      broken: quickCountStatusAssets.broken.length,
    }),
    [quickCountStatusAssets]
  );
  const openInventoryBalanceView = useCallback(
    (mode: "all" | "low") => {
      setInventoryBalanceMode(mode);
      setTab("inventory");
      setInventoryView("balance");
    },
    []
  );
  function openQuickCountAssetsModal(title: string, rows: Asset[]) {
    const sorted = [...rows].sort((a, b) => String(a.assetId || "").localeCompare(String(b.assetId || "")));
    setQuickCountModal({ title, assets: sorted });
  }
  function itemTypeIcon(category: string, typeCode: string, labelOrName = "") {
    const code = String(typeCode || "").trim().toUpperCase();
    const name = String(labelOrName || "").toLowerCase();
    const isFacility = String(category || "").toUpperCase() === "FACILITY";
    const isSafety = String(category || "").toUpperCase() === "SAFETY";

    if (code === "PC" || name.includes("computer")) {
      if (name.includes("desktop")) return "🖥";
      if (name.includes("aio") || name.includes("all-in-one")) return "🖥";
      if (name.includes("mini pc") || name.includes("mac mini")) return "🖥";
      if (name.includes("imac")) return "🖥";
      return "🖥";
    }
    if (code === "LAP" || name.includes("laptop")) return "💻";
    if (code === "TAB" || name.includes("ipad") || name.includes("tablet")) return "📱";
    if (code === "MON" || name.includes("monitor")) return "🖥";
    if (code === "KBD" || name.includes("keyboard")) return "⌨";
    if (code === "MSE" || name.includes("mouse")) return "🖱";
    if (code === "PRN" || name.includes("printer")) return "🖨";
    if (code === "SW" || name.includes("switch")) return "🔀";
    if (code === "AP" || name.includes("access point") || name.includes("wifi")) return "📶";
    if (code === "CAM" || code === "DCM" || name.includes("camera") || name.includes("cctv")) return "📷";
    if (code === "WBC" || name.includes("webcam")) return "🎥";
    if (code === "SLP" || name.includes("projector")) return "📽";
    if (code === "TV" || name.includes("tv")) return "📺";
    if (code === "SPK" || name.includes("speaker")) return "🔊";
    if (code === "UWF" || name.includes("usb wifi")) return "📡";
    if (code === "RMT" || name.includes("remote")) return "🎛";
    if (code === "ADP" || name.includes("adapter")) return "🔌";

    if (code === "FE" || name.includes("fire extinguisher")) return "🧯";
    if (code === "SD" || name.includes("smoke detector")) return "🚨";
    if (code === "EL" || name.includes("emergency light")) return "💡";
    if (code === "FB" || name.includes("fire bell")) return "🔔";
    if (code === "FCP" || name.includes("control panel")) return "🧰";

    if (code === "AC" || name.includes("air conditioner") || name.includes("air-con")) return "❄";
    if (code === "FPN" || name.includes("front panel")) return "🧩";
    if (code === "RPN" || name.includes("rear panel")) return "🧱";
    if (code === "TBL" || name.includes("table")) return "🪑";
    if (code === "CHR" || name.includes("chair")) return "🪑";

    if (isSafety) return "🛡";
    if (isFacility) return "🏢";
    return "📦";
  }
  function quickCountItemIcon(itemName: string) {
    return itemTypeIcon("", "", itemName);
  }
  function inventorySupplyIcon(itemName: string) {
    const name = String(itemName || "").toLowerCase();
    if (name.includes("hand tissue") || name.includes("tissue") || name.includes("paper")) return "🧻";
    if (name.includes("cleaner") || name.includes("soap") || name.includes("shampoo")) return "🧴";
    if (name.includes("trash bag") || name.includes("bin bag")) return "🗑";
    return "🧽";
  }
  const renderQuickCountPanel = (source: "dashboard" | "reports") => {
    const isDashboard = source === "dashboard";
    const isVisible = isDashboard ? dashboardQuickCountOpen : true;
    return (
      <div className="report-quick-count">
        <div className="report-quick-count-head-row">
          <div className="report-quick-count-head">
            <strong>{lang === "km" ? "ស្វែងរកចំនួនរហ័ស" : "Quick Count"}</strong>
            <div className="report-quick-count-summary tiny">
              {lang === "km"
                ? `មុខទំនិញ: ${quickCountFilteredRows.length} | ចំនួនតាមលទ្ធផលស្វែងរក: ${quickCountFilteredTotal}`
                : `Items: ${quickCountFilteredRows.length} | Matched assets: ${quickCountFilteredTotal}`}
            </div>
            <span className="tiny">
              {lang === "km"
                ? "ជ្រើសតម្រង (សាខា ទីតាំង ប្រភេទ ស្ថានភាព) និងស្វែងរកឈ្មោះទ្រព្យ"
                : "Use filters (campus, location, category, status) and search item name"}
            </span>
          </div>
          {isDashboard ? (
            <button
              type="button"
              className="tab btn-small report-quick-toggle-btn"
              onClick={() => setDashboardQuickCountOpen((open) => !open)}
            >
              {dashboardQuickCountOpen ? (lang === "km" ? "លាក់" : "Hide") : (lang === "km" ? "បង្ហាញ" : "View")}
            </button>
          ) : null}
        </div>
        {isVisible ? (
          <>
            <div className="report-quick-count-controls">
              <details className="filter-menu" onToggle={handleAssetMasterFilterMenuToggle}>
                <summary>{summarizeMultiFilter(quickCountCampusFilter, t.allCampuses, campusLabel)}</summary>
                <div className="filter-menu-list">
                  <label className="filter-menu-item">
                    <input
                      type="checkbox"
                      checked={quickCountCampusFilter.includes("ALL")}
                      onChange={(e) =>
                        setQuickCountCampusFilter((prev) =>
                          applyMultiFilterSelection(
                            prev,
                            e.target.checked,
                            "ALL",
                            quickCountCampusFilterOptions
                          )
                        )
                      }
                    />
                    {t.allCampuses}
                  </label>
                  {quickCountCampusFilterOptions.map((campus) => (
                    <label key={`quick-campus-${campus}`} className="filter-menu-item">
                      <input
                        type="checkbox"
                        checked={quickCountCampusFilter.includes(campus)}
                        onChange={(e) =>
                          setQuickCountCampusFilter((prev) =>
                            applyMultiFilterSelection(
                              prev,
                              e.target.checked,
                              campus,
                              quickCountCampusFilterOptions
                            )
                          )
                        }
                      />
                      {campusLabel(campus)}
                    </label>
                  ))}
                </div>
              </details>
              <details className="filter-menu" onToggle={handleAssetMasterFilterMenuToggle}>
                <summary>{summarizeMultiFilter(quickCountLocationFilter, lang === "km" ? "គ្រប់ទីតាំង" : "All Locations")}</summary>
                <div className="filter-menu-list">
                  <label className="filter-menu-item">
                    <input
                      type="checkbox"
                      checked={quickCountLocationFilter.includes("ALL")}
                      onChange={(e) =>
                        setQuickCountLocationFilter((prev) =>
                          applyMultiFilterSelection(
                            prev,
                            e.target.checked,
                            "ALL",
                            quickCountLocationOptions
                          )
                        )
                      }
                    />
                    {lang === "km" ? "គ្រប់ទីតាំង" : "All Locations"}
                  </label>
                  {quickCountLocationOptions.map((location) => (
                    <label key={`quick-location-${location}`} className="filter-menu-item">
                      <input
                        type="checkbox"
                        checked={quickCountLocationFilter.includes(location)}
                        onChange={(e) =>
                          setQuickCountLocationFilter((prev) =>
                            applyMultiFilterSelection(
                              prev,
                              e.target.checked,
                              location,
                              quickCountLocationOptions
                            )
                          )
                        }
                      />
                      {location}
                    </label>
                  ))}
                </div>
              </details>
              <details className="filter-menu" onToggle={handleAssetMasterFilterMenuToggle}>
                <summary>
                  {summarizeMultiFilter(quickCountCategoryFilter, t.allCategories, (value) => {
                    const row = CATEGORY_OPTIONS.find((item) => item.value === value);
                    return row ? (lang === "km" ? row.km : row.en) : value;
                  })}
                </summary>
                <div className="filter-menu-list">
                  <label className="filter-menu-item">
                    <input
                      type="checkbox"
                      checked={quickCountCategoryFilter.includes("ALL")}
                      onChange={(e) =>
                        setQuickCountCategoryFilter((prev) =>
                          applyMultiFilterSelection(
                            prev,
                            e.target.checked,
                            "ALL",
                            quickCountCategoryFilterOptions
                          )
                        )
                      }
                    />
                    {t.allCategories}
                  </label>
                  {quickCountCategoryFilterOptions.map((category) => (
                    <label key={`quick-category-${category}`} className="filter-menu-item">
                      <input
                        type="checkbox"
                        checked={quickCountCategoryFilter.includes(category)}
                        onChange={(e) =>
                          setQuickCountCategoryFilter((prev) =>
                            applyMultiFilterSelection(
                              prev,
                              e.target.checked,
                              category,
                              quickCountCategoryFilterOptions
                            )
                          )
                        }
                      />
                      {lang === "km"
                        ? CATEGORY_OPTIONS.find((item) => item.value === category)?.km || category
                        : CATEGORY_OPTIONS.find((item) => item.value === category)?.en || category}
                    </label>
                  ))}
                </div>
              </details>
              <details className="filter-menu" onToggle={handleAssetMasterFilterMenuToggle}>
                <summary>
                  {summarizeMultiFilter(
                    quickCountStatusFilter,
                    lang === "km" ? "គ្រប់ស្ថានភាព" : "All Status",
                    (value) => assetStatusLabel(value)
                  )}
                </summary>
                <div className="filter-menu-list">
                  <label className="filter-menu-item">
                    <input
                      type="checkbox"
                      checked={quickCountStatusFilter.includes("ALL")}
                      onChange={(e) =>
                        setQuickCountStatusFilter((prev) =>
                          applyMultiFilterSelection(
                            prev,
                            e.target.checked,
                            "ALL",
                            quickCountStatusFilterOptions
                          )
                        )
                      }
                    />
                    {lang === "km" ? "គ្រប់ស្ថានភាព" : "All Status"}
                  </label>
                  {quickCountStatusFilterOptions.map((status) => (
                    <label key={`quick-status-${status}`} className="filter-menu-item">
                      <input
                        type="checkbox"
                        checked={quickCountStatusFilter.includes(status)}
                        onChange={(e) =>
                          setQuickCountStatusFilter((prev) =>
                            applyMultiFilterSelection(
                              prev,
                              e.target.checked,
                              status,
                              quickCountStatusFilterOptions
                            )
                          )
                        }
                      />
                      {assetStatusLabel(status)}
                    </label>
                  ))}
                </div>
              </details>
              <input
                className="input report-quick-search"
                value={quickCountQuery}
                onChange={(e) => setQuickCountQuery(e.target.value)}
                placeholder={lang === "km" ? "ស្វែងរកឈ្មោះទ្រព្យ (ឧ. Monitor, Air Conditioner)" : "Search item name (e.g. Monitor, Air Conditioner)"}
              />
            </div>
            <div className="report-quick-status-grid">
              <button
                type="button"
                className="report-quick-status-pill report-quick-status-btn report-quick-status-broken"
                onClick={() => openQuickCountAssetsModal(lang === "km" ? "ទ្រព្យខូច" : "Broken Assets", quickCountStatusAssets.broken)}
              >
                <span>{lang === "km" ? "ខូច" : "Broken"}</span>
                <strong>{quickCountStatusSummary.broken}</strong>
              </button>
              <button
                type="button"
                className="report-quick-status-pill report-quick-status-btn report-quick-status-maintenance"
                onClick={() =>
                  openQuickCountAssetsModal(
                    lang === "km" ? "ទ្រព្យកំពុងជួសជុល" : "Under Maintenance Assets",
                    quickCountStatusAssets.underMaintenance
                  )
                }
              >
                <span>{lang === "km" ? "កំពុងជួសជុល" : "Under Maintenance"}</span>
                <strong>{quickCountStatusSummary.underMaintenance}</strong>
              </button>
              <button
                type="button"
                className="report-quick-status-pill report-quick-status-btn report-quick-status-active"
                onClick={() => openQuickCountAssetsModal(lang === "km" ? "ទ្រព្យកំពុងប្រើ" : "Active Assets", quickCountStatusAssets.active)}
              >
                <span>{lang === "km" ? "កំពុងប្រើ" : "Active"}</span>
                <strong>{quickCountStatusSummary.active}</strong>
              </button>
              <button
                type="button"
                className="report-quick-status-pill report-quick-status-btn report-quick-status-retired"
                onClick={() => openQuickCountAssetsModal(lang === "km" ? "ទ្រព្យខូច" : "Defective Assets", quickCountStatusAssets.retired)}
              >
                <span>{lang === "km" ? "ខូច" : "Defective"}</span>
                <strong>{quickCountStatusSummary.retired}</strong>
              </button>
            </div>
            <div className="report-quick-count-groups">
              {quickCountGroupedRows.length ? (
                quickCountGroupedRows.map((group) => (
                  <section key={`quick-count-group-${group.category}`} className="report-quick-category-block">
                    <div className="report-quick-category-title">
                      {lang === "km" ? `ប្រភេទ: ${group.category}` : `${group.category} Items`}
                    </div>
                    <div className="report-quick-count-list">
                      {group.rows.map((row) => (
                        <button
                          key={`quick-count-row-${row.category}-${row.itemName}`}
                          type="button"
                          className="report-quick-count-item report-quick-count-item-btn"
                          onClick={() =>
                            openQuickCountAssetsModal(
                              `${row.itemName} - ${quickCountCampusFilter.includes("ALL") ? t.allCampuses : `${quickCountCampusFilter.length} campuses`}`,
                              quickCountBaseAssets.filter(
                                (asset) =>
                                  asset.category === row.category &&
                                  assetItemName(asset.category, asset.type, asset.pcType || "") === row.itemName
                              )
                            )
                          }
                        >
                          <span className="report-quick-item-label">
                            <span className="report-quick-item-icon" aria-hidden="true">{quickCountItemIcon(row.itemName)}</span>
                            <span>{row.itemName}</span>
                          </span>
                          <strong className="report-quick-count-value">{row.count}</strong>
                        </button>
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <div className="tiny">{lang === "km" ? "មិនមានទិន្នន័យត្រូវគ្នា" : "No matched items"}</div>
              )}
            </div>
          </>
        ) : null}
      </div>
    );
  };
  useEffect(() => {
    if (!reportTypeOptions.length) return;
    if (!reportTypeOptions.some((option) => option.value === reportType)) {
      setReportType(reportTypeOptions[0].value);
    }
  }, [reportTypeOptions, reportType]);
  useEffect(() => {
    setReportMobileFiltersOpen(false);
  }, [reportType, tab]);

  useEffect(() => {
    setAssetMasterCampusFilter((prev) => {
      if (prev.includes("ALL")) return prev;
      return prev.filter((item) => assetMasterCampusFilterOptions.includes(item));
    });
  }, [assetMasterCampusFilterOptions]);

  useEffect(() => {
    setAssetMasterCategoryFilter((prev) => {
      if (prev.includes("ALL")) return prev;
      return prev.filter((item) => assetMasterCategoryFilterOptions.includes(item));
    });
  }, [assetMasterCategoryFilterOptions]);

  useEffect(() => {
    setAssetMasterItemFilter((prev) => {
      if (prev.includes("ALL")) return prev;
      return prev.filter((item) => assetMasterItemFilterOptions.includes(item));
    });
  }, [assetMasterItemFilterOptions]);

  useEffect(() => {
    const closeOpenFilterMenus = () => {
      const openMenus = document.querySelectorAll<HTMLDetailsElement>(".filter-menu[open]");
      openMenus.forEach((menu) => menu.removeAttribute("open"));
    };

    const onDocPointerDown = (ev: MouseEvent | TouchEvent) => {
      const target = ev.target as Node | null;
      if (!target) return;
      const clickedInsideMenu = Boolean(
        (target as Element).closest && (target as Element).closest(".filter-menu")
      );
      if (!clickedInsideMenu) {
        closeOpenFilterMenus();
      }
    };

    const onDocKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        closeOpenFilterMenus();
      }
    };

    document.addEventListener("mousedown", onDocPointerDown);
    document.addEventListener("touchstart", onDocPointerDown, { passive: true });
    document.addEventListener("keydown", onDocKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocPointerDown);
      document.removeEventListener("touchstart", onDocPointerDown);
      document.removeEventListener("keydown", onDocKeyDown);
    };
  }, []);

  const qrFilteredRows = useMemo(() => {
    return qrLabelRows.filter((row) => {
      if (qrCampusFilter !== "ALL" && row.campus !== qrCampusFilter) return false;
      if (qrLocationFilter !== "ALL" && String(row.location || "").trim() !== qrLocationFilter) return false;
      if (qrCategoryFilter !== "ALL" && row.category !== qrCategoryFilter) return false;
      if (!qrItemFilter.includes("ALL") && !qrItemFilter.includes(row.itemName)) return false;
      return true;
    });
  }, [qrLabelRows, qrCampusFilter, qrLocationFilter, qrCategoryFilter, qrItemFilter]);

  const qrScanBase = useMemo(() => {
    if (typeof window === "undefined") return DEFAULT_CLOUD_API_BASE;
    return String(window.location.origin || DEFAULT_CLOUD_API_BASE).replace(/\/+$/, "");
  }, []);

  const buildAssetQrUrl = useCallback((assetId: string) => {
    const id = String(assetId || "").trim();
    if (!id) return "";
    return `${qrScanBase}/?assetId=${encodeURIComponent(id)}`;
  }, [qrScanBase]);

  useEffect(() => {
    if (reportType !== "qr_labels") return;
    const missing = qrFilteredRows.filter((row) => !qrCodeMap[row.assetId]);
    if (!missing.length) return;
    let cancelled = false;
    (async () => {
      const generated: Array<[string, string]> = [];
      for (const row of missing) {
        try {
          const dataUrl = await QRCode.toDataURL(buildAssetQrUrl(row.assetId), {
            width: 220,
            margin: 1,
            errorCorrectionLevel: "M",
          });
          generated.push([row.assetId, dataUrl]);
        } catch {
          // skip invalid value
        }
      }
      if (cancelled || !generated.length) return;
      setQrCodeMap((prev) => {
        const next = { ...prev };
        for (const [assetId, dataUrl] of generated) next[assetId] = dataUrl;
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [reportType, qrFilteredRows, qrCodeMap, buildAssetQrUrl]);

  useEffect(() => {
    if (!pendingQrAssetId) return;
    let cancelled = false;
    setPublicQrBusy(true);
    setPublicQrError("");
    setPublicQrAsset(null);
    setPublicQrRecordError("");
    setPublicQrRecordMessage("");
    (async () => {
      try {
        const ts = Date.now();
        const res = await requestJson<{ asset: PublicQrAsset }>(
          `/api/public/assets/${encodeURIComponent(pendingQrAssetId)}?ts=${ts}`
        );
        if (cancelled) return;
        setPublicQrAsset(res.asset || null);
      } catch (err) {
        if (cancelled) return;
        setPublicQrError(err instanceof Error ? err.message : "Asset not found");
      } finally {
        if (!cancelled) setPublicQrBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingQrAssetId]);

  useEffect(() => {
    setPublicQrRecordForm((prev) => {
      if (prev.by.trim()) return prev;
      if (!authUser?.displayName) return prev;
      return { ...prev, by: authUser.displayName };
    });
  }, [authUser?.displayName]);

  async function printCurrentReport() {
    const generatedAt = formatDate(new Date().toISOString());
    let title = "";
    let columns: string[] = [];
    let rows: string[][] = [];

    const printPhotoBase =
      (apiBaseInput || ENV_API_BASE_URL || getAutoApiBaseForHost() || (typeof window !== "undefined" ? window.location.origin : ""))
        .trim()
        .replace(/\/+$/, "");
    const toPrintablePhotoUrl = (value: string) => {
      const text = String(value || "").trim();
      if (!text) return "";
      if (text.startsWith("data:image")) return text;
      if (/^https?:\/\//i.test(text)) return text;
      if (text.startsWith("/")) {
        if (printPhotoBase) return `${printPhotoBase}${text}`;
        if (typeof window !== "undefined") return `${window.location.origin}${text}`;
      }
      return text;
    };

    if (reportType === "asset_master") {
      title = edAssetTemplate === "ALL" ? "Asset Master Register Report" : `${selectedEdTemplateLabel} Report`;
      const visibleDefs = assetMasterColumnDefs.filter((def) => isAssetMasterColumnVisible(def.key));
      columns = visibleDefs.map((def) => def.label);
      rows = assetMasterReportRows.map((row) =>
        visibleDefs.map((def) => {
          switch (def.key) {
            case "photo":
              return toPrintablePhotoUrl(row.photo || "");
            case "assetId":
              return row.assetId;
            case "linkedTo":
              return row.linkedTo;
            case "itemName":
              return row.itemName;
            case "category":
              return row.category;
            case "campus":
              return campusLabel(row.campus);
            case "itemDescription":
              return row.itemDescription;
            case "location":
              return row.location || "-";
            case "purchaseDate":
              return formatDate(row.purchaseDate || "-");
            case "lastServiceDate":
              return formatDate(row.lastServiceDate || "-");
            case "assignedTo":
              return row.assignedTo;
            case "status":
              return row.status;
            default:
              return "-";
          }
        })
      );
    } else if (reportType === "set_code") {
      title = "Computer Set Detail Report";
      columns = ["Set Code", "Main Set Photo", "Main Set Asset", "Main Item", "Campus", "Total Items", "Connected Items"];
      rows = setCodeReportRows.map((row) => [
        row.setCode,
        toPrintablePhotoUrl(row.mainPhoto || ""),
        row.mainAssetId,
        row.mainItem,
        campusLabel(row.campus),
        String(row.totalItems),
        row.connectedItems.length
          ? `<div>${row.connectedItems
              .map((item) => {
                const photo = toPrintablePhotoUrl(item.photo || "");
                const thumb = photo
                  ? `<img src="${photo}" alt="${escapeHtml(item.assetId)}" style="width:28px;height:28px;object-fit:cover;border-radius:6px;border:1px solid #cfded0;" />`
                  : `<span style="display:inline-grid;place-items:center;width:28px;height:28px;border:1px dashed #cfded0;border-radius:6px;color:#6f7286;font-size:11px;">-</span>`;
                return `<div style="display:flex;align-items:center;gap:8px;margin:4px 0;">${thumb}<span>${escapeHtml(item.assetId)} (${escapeHtml(item.itemName)})</span></div>`;
              })
              .join("")}</div>`
          : "-",
      ]);
    } else if (reportType === "asset_by_location") {
      title = "Asset by Campus and Location Report";
      columns = ["Campus", "Location", "Total Units", "IT Units", "Safety Units", "Item Breakdown"];
      rows = locationAssetSummaryRows.map((r) => [
        campusLabel(r.campus),
        r.location,
        String(r.total),
        String(r.it),
        String(r.safety),
        r.itemSummary || "-",
      ]);
    } else if (reportType === "overdue") {
      title = "Overdue Maintenance Report";
      columns = ["Next Date", "Asset ID", "Campus", "Status", "Schedule Note"];
      rows = overdueScheduleAssets.map((a) => [
        formatDate(a.nextMaintenanceDate || "-"),
        a.assetId,
        campusLabel(a.campus),
        assetStatusLabel(a.status || "-"),
        a.scheduleNote || "-",
      ]);
    } else if (reportType === "transfer") {
      title = "Asset Transfer Log Report";
      columns = ["Date", "Asset ID", "From Campus", "From Location", "To Campus", "To Location", "From Staff", "To Staff", "Ack", "By", "Reason"];
      rows = allTransferRows.map((r) => [
        r.date ? formatDate(r.date) : "-",
        r.assetId,
        campusLabel(r.fromCampus),
        r.fromLocation || "-",
        campusLabel(r.toCampus),
        r.toLocation || "-",
        r.fromUser || "-",
        r.toUser || "-",
        r.responsibilityAck,
        r.by || "-",
        r.reason || "-",
      ]);
    } else if (reportType === "staff_borrowing") {
      title = "Staff Borrowing List Report";
      columns = ["Asset ID", "Photo", "Item", "Campus", "Location", "Assigned To", "Since", "Ack", "Last Action", "Note"];
      rows = staffBorrowingRows.map((r) => [
        r.assetId,
        toPrintablePhotoUrl(r.assetPhoto || ""),
        r.itemName || "-",
        campusLabel(r.campus),
        r.location || "-",
        r.assignedTo || "-",
        formatDate(r.sinceDate || "-"),
        r.responsibilityAck,
        r.lastAction || "-",
        r.note || "-",
      ]);
    } else if (reportType === "maintenance_completion") {
      title = `Maintenance Completion Report (${maintenanceCompletionRangeLabel})`;
      columns = ["Date", "Asset ID", "Asset Photo", "Maintenance Photo", "Campus", "Type", "Work Status", "Condition", "Note"];
      rows = maintenanceCompletionRows.map((r) => [
        formatDate(r.date || "-"),
        r.assetId,
        toPrintablePhotoUrl(r.assetPhoto || ""),
        toPrintablePhotoUrl(r.photo || ""),
        campusLabel(r.campus),
        r.type || "-",
        r.completion || "-",
        r.condition || "-",
        r.note || "-",
      ]);
    } else if (reportType === "verification_summary") {
      const periodLabel =
        reportPeriodMode === "month"
          ? reportMonth
          : `${reportTerm} ${reportYear}`;
      title = `Verification Summary Report (${periodLabel})`;
      columns = ["Date", "Asset ID", "Asset Photo", "Verification Photo", "Campus", "Result", "Condition", "Note", "By"];
      rows = verificationSummaryRows.map((r) => [
        formatDate(r.date || "-"),
        r.assetId,
        toPrintablePhotoUrl(r.assetPhoto || ""),
        toPrintablePhotoUrl(r.photo || ""),
        campusLabel(r.campus),
        r.result || "-",
        r.condition || "-",
        r.note || "-",
        r.by || "-",
      ]);
    } else {
      title = "Asset ID + QR Labels";
      columns = ["QR", "Asset ID"];
      const missingRows = qrFilteredRows.filter((row) => !qrCodeMap[row.assetId]);
      const qrPrintMap: Record<string, string> = { ...qrCodeMap };
      if (missingRows.length) {
        const generated: Array<[string, string]> = [];
        for (const row of missingRows) {
          try {
            const dataUrl = await QRCode.toDataURL(buildAssetQrUrl(row.assetId), {
              width: 220,
              margin: 1,
              errorCorrectionLevel: "M",
            });
            generated.push([row.assetId, dataUrl]);
          } catch {
            // skip invalid value
          }
        }
        if (generated.length) {
          for (const [assetId, dataUrl] of generated) qrPrintMap[assetId] = dataUrl;
          setQrCodeMap((prev) => {
            const next = { ...prev };
            for (const [assetId, dataUrl] of generated) next[assetId] = dataUrl;
            return next;
          });
        }
      }
      rows = qrFilteredRows.map((row) => [
        qrPrintMap[row.assetId] || "",
        row.assetId,
      ]);
    }

    const tableHtml = rows.length
      ? rows
          .map(
            (row) =>
              `<tr>${row
                .map((cell) => {
                  const text = String(cell || "");
                  if (text.startsWith("data:image") || /^https?:\/\//i.test(text)) {
                    return `<td><img src="${text}" alt="photo" style="width:42px;height:42px;object-fit:cover;border-radius:6px;border:1px solid #cfded0;" /></td>`;
                  }
                  if (text.startsWith("<div")) {
                    return `<td>${text}</td>`;
                  }
                  return `<td>${escapeHtml(text || "-")}</td>`;
                })
                .join("")}</tr>`
          )
          .join("")
      : `<tr><td colspan="${columns.length}">No data.</td></tr>`;

    const summaryHtml =
      reportType === "maintenance_completion"
        ? `<p><strong>Total:</strong> ${maintenanceCompletionSummary.total} | <strong>Done:</strong> ${maintenanceCompletionSummary.done} | <strong>Not Yet:</strong> ${maintenanceCompletionSummary.notYet}</p>`
        : reportType === "verification_summary"
        ? `<p><strong>Total:</strong> ${verificationSummary.total} | <strong>Verified:</strong> ${verificationSummary.verified} | <strong>Issue Found:</strong> ${verificationSummary.issue} | <strong>Missing:</strong> ${verificationSummary.missing}</p>`
        : reportType === "asset_by_location"
        ? `<p><strong>Locations:</strong> ${locationAssetSummaryRows.length} | <strong>Total Assets:</strong> ${assets.length}</p>`
        : reportType === "staff_borrowing"
        ? `<p><strong>Borrowed / Assigned Assets:</strong> ${staffBorrowingRows.length}</p>`
        : reportType === "asset_master"
        ? `<p><strong>Total Assets:</strong> ${assetMasterReportRows.length}</p>`
        : reportType === "set_code"
        ? `<p><strong>Total Set Codes:</strong> ${setCodeReportRows.length} | <strong>Total Assets in Sets:</strong> ${setCodeReportRows.reduce((sum, row) => sum + row.totalItems, 0)}</p>`
        : reportType === "qr_labels"
        ? `<p><strong>Total QR Labels:</strong> ${qrFilteredRows.length}</p>`
        : "";

    const reportContentHtml =
      reportType === "qr_labels"
        ? qrFilteredRows.length
          ? `<div class="qr-sticker-grid">${qrFilteredRows
              .map((row) => {
                const qr = String(rows.find((r) => r[1] === row.assetId)?.[0] || "");
                const serial = String(row.serialNumber || "").trim() || "-";
                return `<div class="qr-sticker-wrap">
                  <div class="qr-sticker-sn">SN: ${escapeHtml(serial)}</div>
                  <div class="qr-sticker">
                    <div class="qr-sticker-qr">${qr ? `<img src="${qr}" alt="${escapeHtml(row.assetId)}" />` : ""}</div>
                    <div class="qr-sticker-divider"></div>
                    <div class="qr-sticker-id">${escapeHtml(row.assetId)}</div>
                  </div>
                </div>`;
              })
              .join("")}</div>`
          : `<p>No data.</p>`
        : `<table>
          <thead><tr>${columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>
          <tbody>${tableHtml}</tbody>
        </table>`;

    const html = `
      <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: "Segoe UI", Arial, sans-serif; margin: 20px; color: #1b2d23; }
          h1 { margin: 0 0 8px; font-size: 24px; }
          p.meta { margin: 0 0 12px; color: #41584c; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #cfded0; padding: 8px; font-size: 12px; text-align: left; vertical-align: top; }
          th { background: #eef5ee; text-transform: uppercase; letter-spacing: 0.04em; }
          .qr-sticker-grid { display: grid; grid-template-columns: repeat(5, 116px); column-gap: 10px; row-gap: 10px; margin-top: 10px; width: 100%; justify-content: space-between; }
          .qr-sticker-wrap { width: 116px; display: grid; gap: 2px; justify-items: center; page-break-inside: avoid; break-inside: avoid; }
          .qr-sticker-sn { width: 116px; min-height: 11px; text-align: center; font-size: 7.5px; line-height: 1.1; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #1b2d23; }
          .qr-sticker { width: 116px; box-sizing: border-box; border: 1px solid #cfded0; border-radius: 0; padding: 7px 7px 6px; display: grid; gap: 5px; justify-items: center; page-break-inside: avoid; break-inside: avoid; overflow: hidden; }
          .qr-sticker-qr { width: 84px; height: 84px; box-sizing: border-box; border: 1px solid #e1e8e1; border-radius: 0; display: grid; place-items: center; }
          .qr-sticker-qr img { width: 76px; height: 76px; object-fit: contain; display: block; }
          .qr-sticker-divider { width: 84px; height: 1px; background: #1b2d23; }
          .qr-sticker-id { width: 84px; min-height: 18px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; text-align: center; border: 0; border-radius: 0; padding: 0 4px; font-size: 8.5px; line-height: 1.05; font-weight: 800; letter-spacing: 0.005em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          @page { size: A4 landscape; margin: 8mm; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <h1>Eco International School</h1>
        <h2>${escapeHtml(title)}</h2>
        <p class="meta">Generated: ${escapeHtml(generatedAt)} | Campus Filter: ${escapeHtml(filterLabel)}</p>
        ${summaryHtml}
        ${reportContentHtml}
      </body>
      </html>
    `;

    const win = window.open("", "_blank", "width=1200,height=800");
    if (!win) {
      alert("Unable to open print window. Please allow pop-ups.");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  async function handleLogin() {
    if (!loginForm.username.trim() || !loginForm.password.trim()) {
      setError("Username and password are required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await requestJson<{ token: string; user: AuthUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: loginForm.username.trim(),
          password: loginForm.password,
        }),
      });
      runtimeAuthToken = res.token;
      trySetLocalStorage(AUTH_TOKEN_KEY, res.token);
      trySetLocalStorage(AUTH_USER_KEY, JSON.stringify(res.user));
      setAuthUser(res.user);
      setLoginForm((prev) => ({ username: rememberLogin ? prev.username.trim() : "", password: "" }));
      await loadData();
    } catch (err) {
      // Local fallback login is disabled in server-only mode.
      if (ALLOW_LOCAL_AUTH_BYPASS && (isApiUnavailableError(err) || isMissingRouteError(err))) {
        const username = loginForm.username.trim().toLowerCase();
        const password = loginForm.password;
        if (username === "admin" && password === "EcoAdmin@2026!") {
          runtimeAuthToken = LOCAL_ADMIN_TOKEN;
          trySetLocalStorage(AUTH_TOKEN_KEY, LOCAL_ADMIN_TOKEN);
          const adminUser: AuthUser = { id: 1, username: "admin", displayName: "Eco Admin", role: "Super Admin", campuses: ["ALL"] };
          trySetLocalStorage(AUTH_USER_KEY, JSON.stringify(adminUser));
          setAuthUser(adminUser);
          setLoginForm((prev) => ({ username: rememberLogin ? prev.username.trim() : "", password: "" }));
          setError("");
          await loadData();
        } else if (username === "viewer" && password === "EcoViewer@2026!") {
          runtimeAuthToken = LOCAL_VIEWER_TOKEN;
          trySetLocalStorage(AUTH_TOKEN_KEY, LOCAL_VIEWER_TOKEN);
          const viewerUser: AuthUser = {
            id: 2,
            username: "viewer",
            displayName: "Eco Viewer",
            role: "Viewer",
            campuses: ["Chaktomuk Campus (C2.2)"],
          };
          trySetLocalStorage(AUTH_USER_KEY, JSON.stringify(viewerUser));
          setAuthUser(viewerUser);
          setLoginForm((prev) => ({ username: rememberLogin ? prev.username.trim() : "", password: "" }));
          setError("");
          await loadData();
        } else {
          setError("Invalid username or password.");
        }
      } else {
        setError(err instanceof Error ? err.message : "Login failed");
      }
    } finally {
      setBusy(false);
      setAuthLoading(false);
    }
  }

  async function sendPasswordResetVerification() {
    const username = forgotPasswordForm.username.trim();
    const email = forgotPasswordForm.email.trim();
    if (!username || !email) {
      setError("Username and email are required.");
      return;
    }
    setBusy(true);
    setError("");
    setForgotPasswordMessage("");
    try {
      const res = await requestJson<{ ok?: boolean; message?: string; demoCode?: string }>(
        "/api/auth/password-reset/request",
        {
          method: "POST",
          body: JSON.stringify({ username, email }),
        }
      );
      const demoCode = String(res.demoCode || "");
      setForgotPasswordCode(demoCode);
      setForgotPasswordMessage(
        demoCode
          ? `Verification code sent. (Demo code: ${demoCode})`
          : (res.message || "Verification code sent to your email.")
      );
    } catch (err) {
      if (isApiUnavailableError(err) || isMissingRouteError(err)) {
        const demoCode = String(Math.floor(100000 + Math.random() * 900000));
        setForgotPasswordCode(demoCode);
        setForgotPasswordMessage(`Email service not ready yet. Demo verification code: ${demoCode}`);
        setError("");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to send verification code.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmPasswordReset() {
    const username = forgotPasswordForm.username.trim();
    const email = forgotPasswordForm.email.trim();
    const code = forgotPasswordForm.code.trim();
    const newPassword = forgotPasswordForm.newPassword.trim();
    const confirmPassword = forgotPasswordForm.confirmPassword.trim();
    if (!username || !email || !code || !newPassword) {
      setError("Please complete all reset fields.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Password confirmation does not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (forgotPasswordCode && code !== forgotPasswordCode) {
        setError("Invalid verification code.");
        return;
      }
      await requestJson<{ ok?: boolean }>("/api/auth/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify({ username, email, code, newPassword }),
      });
      setForgotPasswordMessage("Password reset successful. Please login with your new password.");
      setForgotPasswordOpen(false);
      setForgotPasswordForm({ username: "", email: "", code: "", newPassword: "", confirmPassword: "" });
      setForgotPasswordCode("");
    } catch (err) {
      if (isApiUnavailableError(err) || isMissingRouteError(err)) {
        setForgotPasswordMessage("Backend reset API is not ready yet. Please ask Admin to reset from Setup.");
        setError("");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    setError("");
    try {
      await requestJson<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore logout network errors
    } finally {
      runtimeAuthToken = "";
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
      setAuthUser(null);
      setBusy(false);
    }
  }

  async function handlePublicQrLogin() {
    if (!publicQrLogin.username.trim() || !publicQrLogin.password.trim()) {
      setPublicQrRecordError("Username and password are required.");
      return;
    }
    setPublicQrRecordBusy(true);
    setPublicQrRecordError("");
    setPublicQrRecordMessage("");
    try {
      const res = await requestJson<{ token: string; user: AuthUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: publicQrLogin.username.trim(),
          password: publicQrLogin.password,
        }),
      });
      runtimeAuthToken = res.token;
      trySetLocalStorage(AUTH_TOKEN_KEY, res.token);
      trySetLocalStorage(AUTH_USER_KEY, JSON.stringify(res.user));
      setAuthUser(res.user);
      setPublicQrLogin({ username: "", password: "" });
      setPublicQrRecordMessage("Logged in. You can now record maintenance.");
    } catch (err) {
      setPublicQrRecordError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setPublicQrRecordBusy(false);
    }
  }

  async function onPublicQrRecordPhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert(t.photoLimit);
      return;
    }
    try {
      const photo = await optimizeUploadPhoto(file);
      setPublicQrRecordForm((f) => ({ ...f, photo }));
    } catch {
      alert(t.photoProcessError);
    }
  }

  async function addMaintenanceRecordFromPublicQr(asset: PublicQrAsset) {
    if (!asset?.id) {
      setPublicQrRecordError("Asset ID is invalid.");
      return;
    }
    if (!publicQrRecordForm.date || !publicQrRecordForm.type.trim() || !publicQrRecordForm.note.trim()) {
      setPublicQrRecordError("Date, type, and note are required.");
      return;
    }
    if (publicQrRecordForm.date < todayYmd) {
      setPublicQrRecordError("Cannot set maintenance date to a past date.");
      return;
    }
    setPublicQrRecordBusy(true);
    setPublicQrRecordError("");
    setPublicQrRecordMessage("");
    try {
      await requestJson<{ entry: MaintenanceEntry }>(`/api/assets/${asset.id}/history`, {
        method: "POST",
        body: JSON.stringify({
          date: publicQrRecordForm.date,
          type: publicQrRecordForm.type.trim(),
          completion: publicQrRecordForm.completion,
          condition: publicQrRecordForm.condition.trim(),
          note: publicQrRecordForm.note.trim(),
          cost: publicQrRecordForm.cost.trim(),
          by: publicQrRecordForm.by.trim(),
          photo: publicQrRecordForm.photo || "",
        }),
      });
      const ts = Date.now();
      const refreshed = await requestJson<{ asset: PublicQrAsset }>(
        `/api/public/assets/${encodeURIComponent(asset.assetId)}?ts=${ts}`
      );
      setPublicQrAsset(refreshed.asset || null);
      setPublicQrRecordForm({
        date: toYmd(new Date()),
        type: "Preventive",
        completion: "Done",
        condition: "",
        note: "",
        cost: "",
        by: authUser?.displayName || "",
        photo: "",
      });
      setPublicQrRecordFileKey((k) => k + 1);
      setPublicQrRecordMessage("Maintenance record saved.");
    } catch (err) {
      setPublicQrRecordError(err instanceof Error ? err.message : "Failed to save maintenance record");
    } finally {
      setPublicQrRecordBusy(false);
    }
  }

  if (pendingQrAssetId) {
    const asset = publicQrAsset;
    const showPublicQrSetFields = asset?.category === "IT";
    const publicQrCampusAllowed = (authUser ? isAdminRole(authUser.role) : false) || (asset?.campus ? allowedCampuses.includes(asset.campus) : true);
    const publicQrCanRecordMaintenance = Boolean(
      authUser &&
      asset &&
      publicQrCampusAllowed &&
      (isAdminRole(authUser.role) || canAccessMenu("maintenance.record", "maintenance"))
    );
    const photos = Array.isArray(asset?.photos) && asset?.photos?.length
      ? asset.photos
      : asset?.photo
      ? [asset.photo]
      : [];
    const publicMaintenanceHistory = [...(asset?.maintenanceHistory || [])].sort(
      (a, b) => Date.parse(String(b.date || "")) - Date.parse(String(a.date || ""))
    );
    const publicTransferHistory = [...(asset?.transferHistory || [])].sort(
      (a, b) => Date.parse(String(b.date || "")) - Date.parse(String(a.date || ""))
    );
    const publicStatusHistory = [...(asset?.statusHistory || [])].sort(
      (a, b) => Date.parse(String(b.date || "")) - Date.parse(String(a.date || ""))
    );
    return (
      <main className="app-shell public-asset-shell">
        <section className="app-card app-card-public-asset">
          <section className="panel public-asset-panel">
            <h2>Asset Detail</h2>
            {publicQrBusy ? (
              <p className="tiny">Loading asset...</p>
            ) : publicQrError ? (
              <p className="alert">{publicQrError}</p>
            ) : asset ? (
              <>
                <div className="panel public-asset-action-panel">
                  <h3 className="section-title" style={{ marginTop: 0 }}>Maintenance Record</h3>
                  {!authUser ? (
                    <div className="form-grid">
                      <label className="field">
                        <span>{t.username}</span>
                        <input
                          className="input"
                          value={publicQrLogin.username}
                          onChange={(e) => setPublicQrLogin((f) => ({ ...f, username: e.target.value }))}
                          autoComplete="username"
                        />
                      </label>
                      <label className="field">
                        <span>{t.password}</span>
                        <input
                          className="input"
                          type="password"
                          value={publicQrLogin.password}
                          onChange={(e) => setPublicQrLogin((f) => ({ ...f, password: e.target.value }))}
                          autoComplete="current-password"
                        />
                      </label>
                      <div className="field field-wide">
                        <button className="tab" type="button" onClick={handlePublicQrLogin} disabled={publicQrRecordBusy}>
                          {publicQrRecordBusy ? `${t.login}...` : t.login}
                        </button>
                        <div className="tiny" style={{ marginTop: 8 }}>Login required to record maintenance from QR.</div>
                      </div>
                    </div>
                  ) : publicQrCanRecordMaintenance ? (
                    <div className="form-grid">
                      <label className="field">
                        <span>Date</span>
                        <input
                          className="input"
                          type="date"
                          min={todayYmd}
                          value={publicQrRecordForm.date}
                          onChange={(e) => setPublicQrRecordForm((f) => ({ ...f, date: e.target.value }))}
                        />
                      </label>
                      <label className="field">
                        <span>Type</span>
                        <input
                          className="input"
                          value={publicQrRecordForm.type}
                          onChange={(e) => setPublicQrRecordForm((f) => ({ ...f, type: e.target.value }))}
                        />
                      </label>
                      <label className="field">
                        <span>Work Status</span>
                        <select
                          className="input"
                          value={publicQrRecordForm.completion}
                          onChange={(e) =>
                            setPublicQrRecordForm((f) => ({ ...f, completion: e.target.value as "Done" | "Not Yet" }))
                          }
                        >
                          <option value="Done">Done</option>
                          <option value="Not Yet">Not Yet</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>Condition</span>
                        <input
                          className="input"
                          value={publicQrRecordForm.condition}
                          onChange={(e) => setPublicQrRecordForm((f) => ({ ...f, condition: e.target.value }))}
                        />
                      </label>
                      <label className="field field-wide">
                        <span>Note</span>
                        <textarea
                          className="input"
                          rows={3}
                          value={publicQrRecordForm.note}
                          onChange={(e) => setPublicQrRecordForm((f) => ({ ...f, note: e.target.value }))}
                        />
                      </label>
                      <label className="field">
                        <span>Cost</span>
                        <input
                          className="input"
                          value={publicQrRecordForm.cost}
                          onChange={(e) => setPublicQrRecordForm((f) => ({ ...f, cost: e.target.value }))}
                        />
                      </label>
                      <label className="field">
                        <span>By</span>
                        <input
                          className="input"
                          value={publicQrRecordForm.by}
                          onChange={(e) => setPublicQrRecordForm((f) => ({ ...f, by: e.target.value }))}
                        />
                      </label>
                      <label className="field field-wide">
                        <span>{t.photo}</span>
                        <input
                          key={publicQrRecordFileKey}
                          type="file"
                          accept="image/*"
                          onChange={onPublicQrRecordPhotoFile}
                        />
                        {publicQrRecordForm.photo ? (
                          <img src={publicQrRecordForm.photo} alt="maintenance" className="photo-preview" />
                        ) : null}
                      </label>
                      <div className="field field-wide">
                        <button
                          className="tab"
                          type="button"
                          disabled={publicQrRecordBusy || !publicQrRecordForm.date || !publicQrRecordForm.note.trim()}
                          onClick={() => void addMaintenanceRecordFromPublicQr(asset)}
                        >
                          {publicQrRecordBusy ? "Saving..." : "Save Maintenance Record"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="tiny">Your account does not have maintenance record permission for this asset.</p>
                  )}
                  {publicQrRecordError ? <p className="alert alert-error">{publicQrRecordError}</p> : null}
                  {publicQrRecordMessage ? <p className="alert">{publicQrRecordMessage}</p> : null}
                </div>

                <div className="form-grid public-asset-grid">
                  <div className="public-asset-mobile-card">
                    <div className="public-asset-mobile-head">
                      <div className="detail-value"><strong>{asset.assetId || "-"}</strong></div>
                    </div>
                    <div className="public-asset-mobile-body">
                      <div className="public-asset-mobile-text">
                        <div className="public-asset-mobile-name">
                          <strong>{t.name}:</strong> {asset.name || assetItemName(asset.category || "", asset.type || "", asset.pcType || "")}
                        </div>
                        <div className="public-asset-mobile-meta">
                          <div><strong>{t.campus}:</strong> {campusLabel(asset.campus || "-")}</div>
                          <div><strong>{t.category}:</strong> {asset.category || "-"}</div>
                          <div><strong>{t.location}:</strong> {asset.location || "-"}</div>
                          <div><strong>{t.status}:</strong> {assetStatusLabel(asset.status || "-")}</div>
                        </div>
                      </div>
                      <div className="public-asset-mobile-photo">
                        {photos[0] ? (
                          <img src={photos[0]} alt={asset.assetId || "asset"} className="photo-preview" />
                        ) : (
                          <div className="photo-placeholder">{t.noPhoto}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="field public-asset-dup-mobile"><span>{t.assetId}</span><div className="detail-value"><strong>{asset.assetId || "-"}</strong></div></div>
                  <div className="field public-asset-dup-mobile"><span>{t.status}</span><div className="detail-value">{assetStatusLabel(asset.status || "-")}</div></div>
                  <div className="field public-asset-dup-mobile"><span>{t.campus}</span><div className="detail-value">{campusLabel(asset.campus || "-")}</div></div>
                  <div className="field public-asset-dup-mobile"><span>{t.location}</span><div className="detail-value">{asset.location || "-"}</div></div>
                  <div className="field public-asset-dup-mobile"><span>{t.category}</span><div className="detail-value">{asset.category || "-"}</div></div>
                  <div className="field public-asset-dup-mobile"><span>{t.typeCode}</span><div className="detail-value">{asset.type || "-"}</div></div>
                  <div className="field public-asset-dup-mobile"><span>{t.name}</span><div className="detail-value">{assetItemName(asset.category || "", asset.type || "", asset.pcType || "")}</div></div>
                  {showPublicQrSetFields ? (
                    <div className="field"><span>{t.setCode}</span><div className="detail-value">{asset.setCode || "-"}</div></div>
                  ) : null}
                  {showPublicQrSetFields ? (
                    <div className="field"><span>{t.parentAssetId}</span><div className="detail-value">{asset.parentAssetId || "-"}</div></div>
                  ) : null}
                  {asset.category === "IT" ? (
                    <div className="field"><span>{t.user}</span><div className="detail-value">{asset.assignedTo || "-"}</div></div>
                  ) : null}
                  <div className="field"><span>{t.brand}</span><div className="detail-value">{asset.brand || "-"}</div></div>
                  <div className="field"><span>{t.model}</span><div className="detail-value">{asset.model || "-"}</div></div>
                  <div className="field"><span>{t.serialNumber}</span><div className="detail-value">{asset.serialNumber || "-"}</div></div>
                  <div className="field"><span>{t.vendor}</span><div className="detail-value">{asset.vendor || "-"}</div></div>
                  <div className="field"><span>{t.purchaseDate}</span><div className="detail-value">{formatDate(asset.purchaseDate || "-")}</div></div>
                  <div className="field"><span>{t.warrantyUntil}</span><div className="detail-value">{formatDate(asset.warrantyUntil || "-")}</div></div>
                  <div className="field field-wide"><span>{t.specs}</span><div className="detail-value">{asset.specs || "-"}</div></div>
                  <div className="field field-wide"><span>{t.notes}</span><div className="detail-value">{asset.notes || "-"}</div></div>
                  <div className="field field-wide public-asset-dup-mobile">
                    <span>{t.photo}</span>
                    <div className="row-actions public-asset-photo-row">
                      {photos.length ? (
                        photos.slice(0, MAX_ASSET_PHOTOS).map((photo, idx) => (
                          <img
                            key={`public-qr-photo-${asset.assetId}-${idx}`}
                            src={photo}
                            alt={`${asset.assetId} ${idx + 1}`}
                            className="photo-preview"
                          />
                        ))
                      ) : (
                        <div className="photo-placeholder">{t.noPhoto}</div>
                      )}
                    </div>
                  </div>
                  <div className="field field-wide">
                  <span>Maintenance History</span>
                  <div className="table-wrap public-asset-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Work Status</th>
                          <th>Condition</th>
                          <th>Note</th>
                          <th>By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {publicMaintenanceHistory.length ? (
                          publicMaintenanceHistory.map((entry) => (
                            <tr key={`public-maint-${entry.id}`}>
                              <td>{formatDate(entry.date || "-")}</td>
                              <td>{entry.type || "-"}</td>
                              <td>{entry.completion || "-"}</td>
                              <td>{entry.condition || "-"}</td>
                              <td>{entry.note || "-"}</td>
                              <td>{entry.by || "-"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6}>No maintenance history yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                  <div className="field field-wide">
                  <span>Transfer History</span>
                  <div className="table-wrap public-asset-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>From Campus</th>
                          <th>From Location</th>
                          <th>To Campus</th>
                          <th>To Location</th>
                          <th>By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {publicTransferHistory.length ? (
                          publicTransferHistory.map((entry) => (
                            <tr key={`public-transfer-${entry.id}`}>
                              <td>{formatDate(entry.date || "-")}</td>
                              <td>{campusLabel(entry.fromCampus || "-")}</td>
                              <td>{entry.fromLocation || "-"}</td>
                              <td>{campusLabel(entry.toCampus || "-")}</td>
                              <td>{entry.toLocation || "-"}</td>
                              <td>{entry.by || "-"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6}>No transfer history yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                  <div className="field field-wide">
                  <span>Status Timeline</span>
                  <div className="table-wrap public-asset-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>From</th>
                          <th>To</th>
                          <th>Reason</th>
                          <th>By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {publicStatusHistory.length ? (
                          publicStatusHistory.map((entry) => (
                            <tr key={`public-status-${entry.id}`}>
                              <td>{formatDate(entry.date || "-")}</td>
                              <td>{assetStatusLabel(entry.fromStatus || "-")}</td>
                              <td>{assetStatusLabel(entry.toStatus || "-")}</td>
                              <td>{entry.reason || "-"}</td>
                              <td>{entry.by || "-"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5}>No status timeline yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                </div>
              </>
            ) : (
              <p className="tiny">No data.</p>
            )}
          </section>
        </section>
      </main>
    );
  }

  if (authLoading) {
    return (
      <main className="app-shell">
        <div className="bg-orb bg-orb-a" aria-hidden="true" />
        <div className="bg-orb bg-orb-b" aria-hidden="true" />
        <section className="app-card">
          <p className="eyebrow">{t.school}</p>
          <h1>{t.title}</h1>
          <p className="alert">{t.loading}</p>
        </section>
      </main>
    );
  }

  if (!authUser) {
    return (
      <main className="app-shell login-shell-sunset">
        <section className="app-card login-page login-page-sunset">
          <section className="panel login-panel login-panel-sunset">
            <img
              className="login-logo-sunset"
              src="/eco-logo.png"
              alt="ECO International School"
              onError={(e) => {
                const img = e.currentTarget;
                if (!img.dataset.fallback) {
                  img.dataset.fallback = "1";
                  img.src = "/logo192.png";
                  return;
                }
                img.style.display = "none";
              }}
            />
            <p className="login-app-name-sunset">IT and Maintenance Controll</p>
            <h2 className="login-title-sunset">{lang === "km" ? "ចូលប្រើគណនីរបស់អ្នក" : "Login to your account"}</h2>
            <div className="form-grid login-grid login-grid-sunset">
              <label className="field">
                <input
                  className="input login-input-pill"
                  placeholder={lang === "km" ? "ឈ្មោះអ្នកប្រើ ឬ អ៊ីមែល" : "username@email.com"}
                  value={loginForm.username}
                  autoComplete="username"
                  onChange={(e) => setLoginForm((f) => ({ ...f, username: e.target.value }))}
                />
              </label>
              <label className="field">
                <div className="login-password-pill-wrap">
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    className="input login-input-pill"
                    placeholder={lang === "km" ? "ពាក្យសម្ងាត់" : "Password"}
                    value={loginForm.password}
                    autoComplete="current-password"
                    onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleLogin();
                    }}
                  />
                  <button
                    type="button"
                    className="login-password-icon-btn"
                    aria-label={showLoginPassword ? t.hide : t.show}
                    onClick={() => setShowLoginPassword((v) => !v)}
                  >
                    {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
            </div>
            <label className="login-remember-row">
              <span>{lang === "km" ? "ចងចាំខ្ញុំ" : "Remember me"}</span>
              <span className="login-switch">
                <input
                  type="checkbox"
                  checked={rememberLogin}
                  onChange={(e) => setRememberLogin(e.target.checked)}
                />
                <span className="login-switch-slider" />
              </span>
            </label>
            <div className="login-actions login-actions-sunset">
              <button className="btn-primary login-submit-btn login-submit-btn-sunset" disabled={busy} onClick={handleLogin}>
                {busy ? `${t.login}...` : t.login}
              </button>
              <button className="login-forgot-link login-forgot-link-sunset" type="button" onClick={() => setForgotPasswordOpen((v) => !v)}>
                {forgotPasswordOpen ? t.close : (lang === "km" ? "ភ្លេចពាក្យសម្ងាត់?" : "Forgot Password?" )}
              </button>
            </div>
            {forgotPasswordOpen ? (
              <div className="login-reset-box">
                <div className="panel-row">
                  <strong>{lang === "km" ? "កំណត់ពាក្យសម្ងាត់ឡើងវិញ" : "Reset Password by Email"}</strong>
                  <button type="button" className="tab btn-small" onClick={() => setForgotPasswordOpen(false)}>
                    {t.close}
                  </button>
                </div>
                <div className="form-grid login-grid">
                  <label className="field">
                    <span>{t.username}</span>
                    <input
                      className="input"
                      value={forgotPasswordForm.username}
                      onChange={(e) => setForgotPasswordForm((f) => ({ ...f, username: e.target.value }))}
                    />
                  </label>
                  <label className="field">
                    <span>{t.email}</span>
                    <input
                      className="input"
                      type="email"
                      value={forgotPasswordForm.email}
                      onChange={(e) => setForgotPasswordForm((f) => ({ ...f, email: e.target.value }))}
                    />
                  </label>
                  <label className="field">
                    <span>{lang === "km" ? "កូដផ្ទៀងផ្ទាត់" : "Verification Code"}</span>
                    <input
                      className="input"
                      value={forgotPasswordForm.code}
                      onChange={(e) => setForgotPasswordForm((f) => ({ ...f, code: e.target.value }))}
                    />
                  </label>
                  <label className="field">
                    <span>{lang === "km" ? "ពាក្យសម្ងាត់ថ្មី" : "New Password"}</span>
                    <input
                      className="input"
                      type="password"
                      value={forgotPasswordForm.newPassword}
                      onChange={(e) => setForgotPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
                    />
                  </label>
                  <label className="field field-wide">
                    <span>{lang === "km" ? "បញ្ជាក់ពាក្យសម្ងាត់" : "Confirm Password"}</span>
                    <input
                      className="input"
                      type="password"
                      value={forgotPasswordForm.confirmPassword}
                      onChange={(e) => setForgotPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                    />
                  </label>
                </div>
                {forgotPasswordMessage ? <p className="tiny">{forgotPasswordMessage}</p> : null}
                <div className="row-actions">
                  <button className="tab" type="button" disabled={busy} onClick={sendPasswordResetVerification}>
                    {lang === "km" ? "ផ្ញើកូដអ៊ីមែល" : "Send Email Code"}
                  </button>
                  <button className="btn-primary" type="button" disabled={busy} onClick={confirmPasswordReset}>
                    {lang === "km" ? "កំណត់ឡើងវិញ" : "Reset Password"}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="bg-orb bg-orb-a" aria-hidden="true" />
      <div className="bg-orb bg-orb-b" aria-hidden="true" />

      <section className="app-card app-card-layout">
        <header className="topbar">
          <div className="brand-block">
            {isPhoneView ? (
              <button
                type="button"
                className="mobile-brand-logo-btn"
                onClick={handlePhoneLogoHome}
                aria-label="Go to dashboard"
                title="Dashboard"
              >
                <img
                  src="/eco-logo.png"
                  alt="Eco International School"
                  className="mobile-brand-logo"
                  onError={(e) => {
                    const img = e.currentTarget;
                    if (!img.dataset.fallback) {
                      img.dataset.fallback = "1";
                      img.src = "/logo192.png";
                      return;
                    }
                    img.style.display = "none";
                  }}
                />
              </button>
            ) : null}
            {isPhoneView ? null : <p className="eyebrow">{t.school}</p>}
            <h1 className={isPhoneView ? "brand-title-mobile" : ""}>{t.title}</h1>
            {isPhoneView ? null : <p className="subhead">{t.subhead}</p>}
          </div>

          <div className="top-right">
            <img
              className="eco-header-logo"
              src="/eco-logo.png"
              alt="ECO International School"
              onError={(e) => {
                const img = e.currentTarget;
                if (!img.dataset.fallback) {
                  img.dataset.fallback = "1";
                  img.src = "/logo192.png";
                  return;
                }
                img.style.display = "none";
              }}
            />
            <div className="top-controls top-controls-grid">
              <label className="field campus-field">
                <span>{t.view}</span>
                <select value={campusFilter} onChange={(e) => setCampusFilter(e.target.value)} className="input">
                  {isAdmin ? <option value="ALL">{t.allCampuses}</option> : null}
                  {allowedCampuses.map((campus) => (
                    <option key={campus} value={campus}>{campusLabel(campus)}</option>
                  ))}
                </select>
              </label>

              <label className="field campus-field">
                <span>{t.language}</span>
                <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="input">
                  <option value="en">{t.english}</option>
                  <option value="km">{t.khmer}</option>
                </select>
              </label>

              <label className="field campus-field">
                <span>{t.account}</span>
                <div className="detail-value">{authUser.displayName} ({authUser.role})</div>
              </label>
              <button className="tab" onClick={handleLogout}>{t.logout}</button>
            </div>
          </div>
        </header>

        <section className="workspace-shell">
          <aside className="main-nav-rail">
            <div className="main-nav-head">
              <p className="eyebrow">{t.menu}</p>
              <h3>{lang === "km" ? "ការរុករកប្រព័ន្ធ" : "System Navigation"}</h3>
            </div>
            {navSections.map((section) => (
              <section key={section.section} className="main-nav-section">
                <p className="main-nav-section-label">{section.label}</p>
                <div className="main-nav-list">
                  {section.items.map((item) => (
                    <button
                      key={item.id}
                      className={`main-nav-btn ${tab === item.id ? "main-nav-btn-active" : ""}`}
                      onClick={() => handleNavChange(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </aside>

          <section className="workspace-main">
            <div className="mobile-nav-hud" ref={mobileNavRef}>
              {mobileMenuOpen ? (
                <button
                  type="button"
                  className="mobile-side-backdrop"
                  aria-label="Close menu"
                  onClick={() => setMobileMenuOpen(false)}
                />
              ) : null}
              <aside className={`mobile-side-drawer ${mobileMenuOpen ? "mobile-side-drawer-open" : ""}`}>
                <div className="mobile-menu-head">
                  <strong>{t.menu}</strong>
                  <span>{lang === "km" ? "អូសពីឆ្វេងដើម្បីបើក/បិទ" : "Swipe from left to open/close"}</span>
                </div>
                <div className="mobile-menu-sections">
                  {navSections.map((section) => (
                    <section key={`mobile-nav-${section.section}`} className="mobile-menu-section">
                      <p className="mobile-menu-section-label">{section.label}</p>
                      <div className="mobile-menu-grid">
                        {section.items.map((item) => (
                          <button
                            key={`mobile-nav-btn-${item.id}`}
                            type="button"
                            className={`mobile-menu-nav-btn ${tab === item.id ? "mobile-menu-nav-btn-active" : ""}`}
                            onClick={() => {
                              handleNavChange(item.id);
                              setMobileMenuOpen(false);
                            }}
                          >
                            <span className="mobile-menu-nav-icon" aria-hidden="true">{navIcon(item.id)}</span>
                            <span className="mobile-menu-nav-label">{item.label}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>

                <label className="field">
                  <span>{t.view}</span>
                  <select
                    value={campusFilter}
                    onChange={(e) => {
                      setCampusFilter(e.target.value);
                      setMobileMenuOpen(false);
                    }}
                    className="input"
                  >
                    {isAdmin ? <option value="ALL">{t.allCampuses}</option> : null}
                    {allowedCampuses.map((campus) => (
                      <option key={`mobile-campus-${campus}`} value={campus}>{campusLabel(campus)}</option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>{t.language}</span>
                  <select
                    value={lang}
                    onChange={(e) => {
                      setLang(e.target.value as Lang);
                    }}
                    className="input"
                  >
                    <option value="en">{t.english}</option>
                    <option value="km">{t.khmer}</option>
                  </select>
                </label>

                <label className="field">
                  <span>{t.account}</span>
                  <div className="detail-value">{authUser.displayName} ({authUser.role})</div>
                </label>
                <button
                  className="tab"
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                >
                  {t.logout}
                </button>
              </aside>

              <div className="mobile-nav-topline">
                <button
                  className={`mobile-notify-btn ${mobileNotificationOpen ? "mobile-notify-btn-active" : ""}`}
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setMobileNotificationOpen((open) => !open);
                  }}
                  aria-expanded={mobileNotificationOpen}
                  aria-label={t.maintenanceNotifications}
                >
                  <span aria-hidden="true">🔔</span>
                  {maintenanceNotificationUnread > 0 ? (
                    <span className="mobile-notify-badge">
                      {maintenanceNotificationUnread > 99 ? "99+" : maintenanceNotificationUnread}
                    </span>
                  ) : null}
                </button>
              </div>
              {mobileNotificationOpen ? (
                <div className="mobile-notify-panel">
                  <div className="mobile-notify-head">
                    <strong>{t.maintenanceNotifications}</strong>
                    <button
                      type="button"
                      className="tab btn-small"
                      onClick={() => {
                        void markAllMaintenanceNotificationsRead();
                      }}
                    >
                      {t.markAllRead}
                    </button>
                  </div>
                  {browserNotificationPermission !== "granted" ? (
                    <button type="button" className="tab" onClick={enablePhoneAlerts}>
                      {t.enablePhoneAlerts}
                    </button>
                  ) : null}
                  <div className="mobile-notify-list">
                    {maintenanceNotifications.length ? (
                      maintenanceNotifications.map((row) => (
                        <article
                          key={`mobile-notify-${row.id}`}
                          className={`mobile-notify-item ${row.read ? "" : "mobile-notify-item-unread"}`}
                        >
                          <div className="mobile-notify-item-head">
                            <strong>{row.title}</strong>
                            <span className="tiny">{formatDateTime(row.createdAt)}</span>
                          </div>
                          <p className="tiny">{row.message}</p>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="tab btn-small"
                              onClick={() => {
                                if (!row.read) void markMaintenanceNotificationRead(row.id);
                                openMaintenanceFromNotification(row);
                              }}
                            >
                              {t.openMaintenance}
                            </button>
                            {!row.read ? (
                              <button
                                type="button"
                                className="tab btn-small"
                                onClick={() => {
                                  void markMaintenanceNotificationRead(row.id);
                                }}
                              >
                                {t.markRead}
                              </button>
                            ) : null}
                          </div>
                        </article>
                      ))
                    ) : (
                      <p className="tiny">{t.noMaintenanceNotifications}</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            {!isPhoneView ? (
              <div className="mobile-module-panel">
                <label className="field mobile-nav-field">
                  <span>{t.menu}</span>
                  <select
                    className="input mobile-nav-select"
                    value={tab}
                    onChange={(e) => handleNavChange(e.target.value as NavModule)}
                  >
                    {navMenuItems.map((item) => (
                      <option key={`mobile-module-${item.id}`} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
            {error ? <p className="alert alert-error">{error}</p> : null}
            {!isAdmin ? <p className="alert">{t.viewerMode}</p> : null}
            {loading ? <p className="alert">{t.loading}</p> : null}

        {tab === "dashboard" && (
          <section className="panel dashboard-panel">
            {showMaintenanceDashboard ? (
              <>
                {isPhoneView ? (
                  <section className="phone-dashboard-hero">
                    <div className="phone-dashboard-head">
                      <p className="phone-dashboard-kicker">Maintenance Focus</p>
                      <h2 className="phone-dashboard-title">{filterLabel}</h2>
                      <p className="phone-dashboard-campus">Track due tasks and complete maintenance faster.</p>
                    </div>
                    <div className="phone-dashboard-actions">
                      <button className="phone-quick-btn" onClick={() => setTab("maintenance")}>{t.recordMaintenance}</button>
                      <button className="phone-quick-btn" onClick={() => setTab("schedule")}>{t.openSchedule}</button>
                      {allowedNavModules.has("reports") ? (
                        <button className="phone-quick-btn" onClick={() => setTab("reports")}>{t.reports}</button>
                      ) : null}
                      {allowedNavModules.has("assets") ? (
                        <button className="phone-quick-btn" onClick={() => setTab("assets")}>{t.openAssetList}</button>
                      ) : null}
                    </div>
                  </section>
                ) : (
                  <div className="dashboard-hero">
                    <div>
                      <h2>Maintenance Dashboard</h2>
                      <p className="tiny">
                        {filterLabel} | focus on overdue, upcoming, and completed work.
                      </p>
                    </div>
                    <div className="dashboard-actions">
                      <span className="tiny">Quick Access</span>
                      <div className="row-actions">
                        <button className="tab" onClick={() => setTab("maintenance")}>{t.recordMaintenance}</button>
                        <button className="tab" onClick={() => setTab("schedule")}>{t.openSchedule}</button>
                        {allowedNavModules.has("reports") ? (
                          <button className="tab" onClick={() => setTab("reports")}>{t.reports}</button>
                        ) : null}
                        {allowedNavModules.has("assets") ? (
                          <button className="tab" onClick={() => setTab("assets")}>{t.openAssetList}</button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}

                <article className="panel dashboard-widget dashboard-maintenance-item-panel">
                  <div className="dashboard-widget-head">
                    <h3 className="section-title">Maintenance Items</h3>
                    <button
                      type="button"
                      className="tab btn-small"
                      onClick={() => {
                        setScheduleAlertItemFilter("ALL");
                        setScheduleAlertModal("scheduled");
                      }}
                    >
                      View All Assets
                    </button>
                  </div>
                  <div className="maintenance-item-grid">
                    {maintenanceDueByItemRows.length ? (
                      maintenanceDueByItemRows.slice(0, 10).map((row) => (
                        <button
                          key={`maintenance-due-item-${row.itemName}`}
                          type="button"
                          className="maintenance-item-card"
                          onClick={() => {
                            setScheduleAlertItemFilter(row.itemName);
                            setScheduleAlertModal("scheduled");
                          }}
                        >
                          <span className="maintenance-item-card-icon" aria-hidden="true">
                            {quickCountItemIcon(row.itemName)}
                          </span>
                          <span className="maintenance-item-card-name">{row.itemName}</span>
                          <strong className="maintenance-item-card-value">{row.count}</strong>
                        </button>
                      ))
                    ) : (
                      <div className="tiny">No maintenance items to schedule.</div>
                    )}
                  </div>
                </article>

                <div className={`stats-grid dashboard-stats ${isPhoneView ? "dashboard-stats-phone" : ""}`}>
                  <button
                    className="stat-card stat-card-button stat-card-overdue"
                    onClick={() => {
                      setScheduleAlertItemFilter("ALL");
                      setScheduleAlertModal("overdue");
                    }}
                  >
                    <div className="stat-label">Overdue</div>
                    <div className="stat-value">{overdueScheduleAssets.length}</div>
                  </button>
                  <button
                    className="stat-card stat-card-button stat-card-ticket"
                    onClick={() => {
                      setScheduleAlertItemFilter("ALL");
                      setScheduleAlertModal("upcoming");
                    }}
                  >
                    <div className="stat-label">Next 7 Days</div>
                    <div className="stat-value">{upcomingScheduleAssets.length}</div>
                  </button>
                  <button
                    className="stat-card stat-card-button stat-card-it"
                    onClick={() => {
                      setTab("maintenance");
                      setMaintenanceView("history");
                    }}
                  >
                    <div className="stat-label">Completed Today</div>
                    <div className="stat-value">{maintenanceDoneToday}</div>
                  </button>
                  <button
                    className="stat-card stat-card-button stat-card-total"
                    onClick={() => {
                      setScheduleAlertItemFilter("ALL");
                      setScheduleAlertModal("scheduled");
                    }}
                  >
                    <div className="stat-label">All Scheduled</div>
                    <div className="stat-value">{scheduleAssets.length}</div>
                  </button>
                </div>

                <div className="dashboard-clean-grid dashboard-maintenance-calendar-only" style={{ marginTop: 12 }}>
                  <article className="panel dashboard-widget dashboard-calendar-panel">
                    <div className="dashboard-widget-head">
                      <h3 className="section-title">Eco Calendar View</h3>
                      <div className="row-actions calendar-nav-row">
                        <button
                          className="tab btn-small"
                          aria-label="Previous month"
                          title="Previous month"
                          onClick={() =>
                            setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                          }
                        >
                          {calendarPrevLabel}
                        </button>
                        <button
                          className="tab btn-small"
                          aria-label="Next month"
                          title="Next month"
                          onClick={() =>
                            setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                          }
                        >
                          {calendarNextLabel}
                        </button>
                      </div>
                    </div>
                    <p className="tiny dashboard-calendar-month">
                      {calendarMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}
                    </p>
                    <div className="calendar-grid dashboard-calendar-grid">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, idx) => (
                        <div
                          key={`dash-cal-head-${d}`}
                          className={`calendar-day calendar-head ${idx === 0 || idx === 6 ? "calendar-head-weekend" : ""}`}
                        >
                          {d}
                        </div>
                      ))}
                      {calendarGridDays.map((d) => (
                        <button
                          key={`dash-cal-day-${d.ymd}`}
                          className={`calendar-day ${d.inMonth ? "" : "calendar-out"} ${d.hasItems ? "calendar-has" : ""} ${selectedCalendarDate === d.ymd ? "calendar-selected" : ""} ${d.ymd === todayYmd ? "calendar-today" : ""} ${d.weekday === 0 || d.weekday === 6 ? "calendar-weekend" : ""} ${d.holidayName ? "calendar-holiday" : ""} ${d.holidayType ? `calendar-holiday-${d.holidayType}` : ""} ${d.weekday <= 1 ? "calendar-popup-left" : d.weekday >= 5 ? "calendar-popup-right" : ""}`}
                          onClick={() => {
                            setSelectedCalendarDate(d.ymd);
                            if (d.hasItems) {
                              setScheduleAlertItemFilter("ALL");
                              setScheduleAlertModal("selected");
                            }
                          }}
                        >
                          <span>{d.day}</span>
                          {d.hasItems ? <small>{(scheduleByDate.get(d.ymd) || []).length}</small> : null}
                          {d.holidayName ? <div className="calendar-hover-popup">{d.holidayName}</div> : null}
                        </button>
                      ))}
                    </div>
                  </article>
                </div>
              </>
            ) : (
              <>
                {isPhoneView ? (
                  <section className="phone-dashboard-hero">
                    <div className="phone-dashboard-head">
                      <p className="phone-dashboard-kicker">{t.overview}</p>
                      <h2 className="phone-dashboard-title">{filterLabel}</h2>
                      <p className="phone-dashboard-campus">
                        {topCampusByAssets
                          ? `${t.topCampus}: ${campusLabel(topCampusByAssets.campus)} (${topCampusByAssets.assets})`
                          : t.noCampusDataYet}
                      </p>
                    </div>
                    <div className="phone-dashboard-actions">
                      <button className="phone-quick-btn" onClick={() => setTab("assets")}>{t.openAssetList}</button>
                      <button className="phone-quick-btn" onClick={() => setTab("schedule")}>{t.openSchedule}</button>
                      <button className="phone-quick-btn" onClick={() => setTab("maintenance")}>{t.recordMaintenance}</button>
                      <button className="phone-quick-btn" onClick={() => setTab("verification")}>Record Verification</button>
                    </div>
                  </section>
                ) : (
                  <div className="dashboard-hero">
                    <div>
                      <h2>{filterLabel} {t.overview}</h2>
                      <p className="tiny">
                        {topCampusByAssets
                          ? `${t.topCampus}: ${campusLabel(topCampusByAssets.campus)} (${topCampusByAssets.assets} ${t.assets.toLowerCase()})`
                          : t.noCampusDataYet}
                      </p>
                    </div>
                    <div className="dashboard-actions">
                      <span className="tiny">Quick Access</span>
                      <div className="row-actions">
                        <button className="tab" onClick={() => setTab("assets")}>{t.openAssetList}</button>
                        <button className="tab" onClick={() => setTab("schedule")}>{t.openSchedule}</button>
                        <button className="tab" onClick={() => setTab("inventory")}>Inventory</button>
                        <button className="tab" onClick={() => setTab("maintenance")}>{t.recordMaintenance}</button>
                        <button className="tab" onClick={() => setTab("verification")}>{t.recordVerification}</button>
                      </div>
                    </div>
                  </div>
                )}

                <div className={`stats-grid dashboard-stats ${isPhoneView ? "dashboard-stats-phone" : ""}`}>
                  <button className="stat-card stat-card-button stat-card-total" onClick={() => setOverviewModal("total")}>
                    <div className="stat-label">{t.totalAssets}</div>
                    <div className="stat-value">{stats.totalAssets}</div>
                  </button>
                  <button className="stat-card stat-card-button stat-card-it" onClick={() => setOverviewModal("it")}>
                    <div className="stat-label">{t.itAssets}</div>
                    <div className="stat-value">{stats.itAssets}</div>
                  </button>
                  <button className="stat-card stat-card-button stat-card-safety" onClick={() => setOverviewModal("safety")}>
                    <div className="stat-label">{t.safetyAssets}</div>
                    <div className="stat-value">{stats.safetyAssets}</div>
                  </button>
                  <button className="stat-card stat-card-button stat-card-ticket" onClick={() => setOverviewModal("tickets")}>
                    <div className="stat-label">{t.openWorkOrders}</div>
                    <div className="stat-value">{stats.openTickets}</div>
                  </button>
                </div>

                {renderQuickCountPanel("dashboard")}

                <div className="dashboard-clean-grid dashboard-calendar-stock-grid" style={{ marginTop: 12 }}>
                  <article className="panel dashboard-widget dashboard-calendar-panel">
                    <div className="dashboard-widget-head">
                      <h3 className="section-title">Eco Calendar View</h3>
                      <div className="row-actions calendar-nav-row">
                        <button
                          className="tab btn-small"
                          aria-label="Previous month"
                          title="Previous month"
                          onClick={() =>
                            setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                          }
                        >
                          {calendarPrevLabel}
                        </button>
                        <button
                          className="tab btn-small"
                          aria-label="Next month"
                          title="Next month"
                          onClick={() =>
                            setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                          }
                        >
                          {calendarNextLabel}
                        </button>
                      </div>
                    </div>
                    <p className="tiny dashboard-calendar-month">
                      {calendarMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}
                    </p>
                    <div className="calendar-grid dashboard-calendar-grid">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, idx) => (
                        <div
                          key={`dash-cal-head-${d}`}
                          className={`calendar-day calendar-head ${idx === 0 || idx === 6 ? "calendar-head-weekend" : ""}`}
                        >
                          {d}
                        </div>
                      ))}
                      {calendarGridDays.map((d) => (
                        <button
                          key={`dash-cal-day-${d.ymd}`}
                          className={`calendar-day ${d.inMonth ? "" : "calendar-out"} ${d.hasItems ? "calendar-has" : ""} ${selectedCalendarDate === d.ymd ? "calendar-selected" : ""} ${d.ymd === todayYmd ? "calendar-today" : ""} ${d.weekday === 0 || d.weekday === 6 ? "calendar-weekend" : ""} ${d.holidayName ? "calendar-holiday" : ""} ${d.holidayType ? `calendar-holiday-${d.holidayType}` : ""} ${d.weekday <= 1 ? "calendar-popup-left" : d.weekday >= 5 ? "calendar-popup-right" : ""}`}
                          onClick={() => {
                            setSelectedCalendarDate(d.ymd);
                            if (d.hasItems) {
                              setScheduleAlertItemFilter("ALL");
                              setScheduleAlertModal("selected");
                            }
                          }}
                        >
                          <span>{d.day}</span>
                          {d.hasItems ? <small>{(scheduleByDate.get(d.ymd) || []).length}</small> : null}
                          {d.holidayName ? <div className="calendar-hover-popup">{d.holidayName}</div> : null}
                        </button>
                      ))}
                    </div>
                  </article>

                  <article className="panel dashboard-widget">
                    <div className="dashboard-widget-head">
                      <h3 className="section-title">Stock Balance & Low Stock Alerts</h3>
                    </div>
                    <div className="stats-grid dashboard-stock-stats" style={{ marginBottom: 10 }}>
                      <button type="button" className="stat-card stat-card-button" onClick={() => openInventoryBalanceView("all")}>
                        <div className="stat-label">Total Inventory Items</div>
                        <div className="stat-value">{inventoryBalanceRows.length}</div>
                      </button>
                      <button
                        type="button"
                        className="stat-card stat-card-button stat-card-overdue"
                        onClick={() => openInventoryBalanceView("low")}
                      >
                        <div className="stat-label">Low Stock Alerts</div>
                        <div className="stat-value">{inventoryLowStockRows.length}</div>
                      </button>
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Code</th>
                            <th>Name</th>
                            <th>Current</th>
                            <th>Min</th>
                            <th>Alert</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inventoryBalanceRows.length ? (
                            inventoryBalanceRows.slice(0, 10).map((row) => (
                              <tr key={`dash-stock-row-${row.id}`}>
                                <td><strong>{row.itemCode}</strong></td>
                                <td>{row.itemName}</td>
                                <td>{row.currentStock}</td>
                                <td>{row.minStock}</td>
                                <td>{row.lowStock ? "Low" : "OK"}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5}>No stock balance data.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </article>
                </div>
              </>
            )}

          </section>
        )}

        {tab === "assets" && (
          <>
            <div className="tabs">
              {canOpenAssetRegister ? (
                <button
                  className={`tab ${assetsView === "register" ? "tab-active" : ""}`}
                  onClick={() => setAssetsView("register")}
                >
                  {t.registerAsset}
                </button>
              ) : null}
              {canAccessMenu("assets.list", "assets") ? (
                <button
                  className={`tab ${assetsView === "list" ? "tab-active" : ""}`}
                  onClick={() => setAssetsView("list")}
                >
                  {t.assetRegistry}
                </button>
              ) : null}
            </div>

            {assetsView === "register" && canOpenAssetRegister && (
              <section className="panel">
                <h2>{t.registerAsset}</h2>
                <div className="form-grid">
                  <label className="field">
                    <span>{t.campus}</span>
                    <select className="input" value={assetForm.campus} onChange={(e) => setAssetForm((f) => ({ ...f, campus: e.target.value }))}>
                      {CAMPUS_LIST.map((campus) => <option key={campus} value={campus}>{campusLabel(campus)}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span>{t.category}</span>
                    <select
                      className="input"
                      value={assetForm.category}
                      onChange={(e) =>
                        setAssetForm((f) => {
                          const category = e.target.value;
                          const type = defaultTypeForCategory(category);
                          return {
                            ...f,
                            category,
                            type: type.code,
                            pcType: category === "IT" && type.code === DESKTOP_PARENT_TYPE ? PC_TYPE_OPTIONS[0].value : "",
                            assignedTo: "",
                            componentRole: "",
                            componentRequired: false,
                          };
                        })
                      }
                    >
                      {CATEGORY_OPTIONS.map((category) => (
                        <option key={category.value} value={category.value}>{lang === "km" ? category.km : category.en}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>{t.typeCode}</span>
                    <select className="input" value={assetForm.type} onChange={(e) => setAssetForm((f) => ({ ...f, type: e.target.value }))}>
                      {currentTypeOptions.map((opt) => (
                        <option key={opt.code} value={opt.code}>{itemNames[`${assetForm.category}:${opt.code}`] || (lang === "km" ? opt.itemKm : opt.itemEn)} ({opt.code})</option>
                      ))}
                    </select>
                  </label>
                  {isPcAssetForCreate ? (
                    <label className="field">
                      <span>{t.pcType}</span>
                      <select
                        className="input"
                        value={assetForm.pcType}
                        onChange={(e) => setAssetForm((f) => ({ ...f, pcType: e.target.value }))}
                      >
                        {PC_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {lang === "km" ? opt.km : opt.en}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label className="field">
                    <span>{t.status}</span>
                    <select className="input" value={assetForm.status} onChange={(e) => setAssetForm((f) => ({ ...f, status: e.target.value }))}>
                      {ASSET_STATUS_OPTIONS.map((status) => (
                        <option key={status.value} value={status.value}>{lang === "km" ? status.km : status.en}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>{t.assetId}</span>
                    <input
                      className="input"
                      value={suggestedAssetId}
                      readOnly
                    />
                  </label>
                  <label className="field field-wide">
                    <span>{t.location}</span>
                    <select className="input" value={assetForm.location} onChange={(e) => setAssetForm((f) => ({ ...f, location: e.target.value }))}>
                      {campusLocations.length ? null : <option value="">{t.selectLocation}</option>}
                      {campusLocations.map((loc) => (
                        <option key={loc.id} value={loc.name}>{loc.name}</option>
                      ))}
                    </select>
                  </label>
                  {assetForm.category === "IT" && assetForm.type === DESKTOP_PARENT_TYPE ? (
                    <>
                      <label className="field">
                        <span>{t.setCode}</span>
                        <input className="input" value={suggestedDesktopSetCode} readOnly />
                      </label>
                      <div className="field">
                        <span>{t.createAsSetPack}</span>
                        <div className="setpack-toggle-row">
                          <span className="tiny">{t.setPackHint}</span>
                          <label className="switch-toggle">
                            <input
                              type="checkbox"
                              checked={assetForm.createSetPack}
                              onChange={(e) =>
                                setAssetForm((f) => ({
                                  ...f,
                                  createSetPack: e.target.checked,
                                }))
                              }
                            />
                            <span className="switch-slider" />
                          </label>
                        </div>
                      </div>
                      {assetForm.createSetPack ? (
                        <div className="field field-wide">
                          <span>{t.setPackItems}</span>
                          <div className="setpack-include-grid">
                            {setPackChildMeta.map((item) => (
                              <label key={`pack-toggle-${item.type}`} className="tab setpack-include-item">
                                <input
                                  type="checkbox"
                                  checked={setPackDraft[item.type].enabled}
                                  onChange={(e) =>
                                    setSetPackDraft((prev) => {
                                      const checked = e.target.checked;
                                      const next = {
                                        ...prev,
                                        [item.type]: {
                                          ...prev[item.type],
                                          enabled: checked,
                                        },
                                      };
                                      if (item.type === "MON2" && checked) {
                                        next.MON = { ...next.MON, enabled: true };
                                      }
                                      if (item.type === "MON" && !checked) {
                                        next.MON2 = { ...next.MON2, enabled: false };
                                      }
                                      return next;
                                    })
                                  }
                                />{" "}
                                {item.label}
                              </label>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {assetForm.createSetPack
                        ? (
                          <div className="field field-wide">
                            <div className="setpack-card-grid">
                              {setPackChildMeta.map((item) => (
                                setPackDraft[item.type].enabled ? (
                                  <div
                                    key={`pack-fields-${item.type}`}
                                    className={`setpack-item-card${setPackDetailOpen[item.type] ? " setpack-item-card-open" : ""}`}
                                  >
                                    <div className="setpack-item-head">
                                      <div>
                                        <strong>{item.label}</strong>
                                        <div className="tiny">
                                          {t.assetId}: {setPackSuggestedAssetId[item.type]} | {t.assetName}: {assetItemName("IT", setPackAssetType(item.type))}
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        className="tab setpack-detail-btn"
                                        onClick={() =>
                                          setSetPackDetailOpen((prev) => ({
                                            ...prev,
                                            [item.type]: !prev[item.type],
                                          }))
                                        }
                                      >
                                        {setPackDetailOpen[item.type] ? t.hideDetails : t.addDetails}
                                      </button>
                                    </div>
                                    {setPackDetailOpen[item.type] ? (
                                      <div className="form-grid">
                                    <label className="field">
                                      <span>{t.status}</span>
                                      <select
                                        className="input"
                                        value={setPackDraft[item.type].status}
                                        onChange={(e) =>
                                          setSetPackDraft((prev) => ({
                                            ...prev,
                                            [item.type]: {
                                              ...prev[item.type],
                                              status: e.target.value,
                                            },
                                          }))
                                        }
                                      >
                                        {ASSET_STATUS_OPTIONS.map((status) => (
                                          <option key={`${item.type}-status-${status.value}`} value={status.value}>
                                            {lang === "km" ? status.km : status.en}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <label className="field">
                                      <span>{t.brand}</span>
                                      <input
                                        className="input"
                                        value={setPackDraft[item.type].brand}
                                        onChange={(e) =>
                                          setSetPackDraft((prev) => ({
                                            ...prev,
                                            [item.type]: {
                                              ...prev[item.type],
                                              brand: e.target.value,
                                            },
                                          }))
                                        }
                                      />
                                    </label>
                                    <label className="field">
                                      <span>{t.model}</span>
                                      <input
                                        className="input"
                                        list="asset-model-options"
                                        value={setPackDraft[item.type].model}
                                        onChange={(e) => {
                                          const model = e.target.value;
                                          setSetPackDraft((prev) => ({
                                            ...prev,
                                            [item.type]: {
                                              ...prev[item.type],
                                              model,
                                            },
                                          }));
                                        }}
                                        onBlur={(e) => applySetPackModelTemplate(item.type, e.target.value)}
                                      />
                                    </label>
                                    <label className="field">
                                      <span>{t.serialNumber}</span>
                                      <input
                                        className="input"
                                        value={setPackDraft[item.type].serialNumber}
                                        onChange={(e) =>
                                          setSetPackDraft((prev) => ({
                                            ...prev,
                                            [item.type]: {
                                              ...prev[item.type],
                                              serialNumber: e.target.value,
                                            },
                                          }))
                                        }
                                      />
                                    </label>
                                    <label className="field">
                                      <span>{t.purchaseDate}</span>
                                      <input
                                        type="date"
                                        className="input"
                                        value={setPackDraft[item.type].purchaseDate}
                                        onChange={(e) =>
                                          setSetPackDraft((prev) => ({
                                            ...prev,
                                            [item.type]: {
                                              ...prev[item.type],
                                              purchaseDate: e.target.value,
                                            },
                                          }))
                                        }
                                      />
                                    </label>
                                    <label className="field">
                                      <span>{t.warrantyUntil}</span>
                                      <input
                                        type="date"
                                        className="input"
                                        value={setPackDraft[item.type].warrantyUntil}
                                        onChange={(e) =>
                                          setSetPackDraft((prev) => ({
                                            ...prev,
                                            [item.type]: {
                                              ...prev[item.type],
                                              warrantyUntil: e.target.value,
                                            },
                                          }))
                                        }
                                      />
                                    </label>
                                    <label className="field">
                                      <span>{t.vendor}</span>
                                      <input
                                        className="input"
                                        value={setPackDraft[item.type].vendor}
                                        onChange={(e) =>
                                          setSetPackDraft((prev) => ({
                                            ...prev,
                                            [item.type]: {
                                              ...prev[item.type],
                                              vendor: e.target.value,
                                            },
                                          }))
                                        }
                                      />
                                    </label>
                                    <label className="field field-wide">
                                      <span>{t.specs}</span>
                                      <textarea
                                        className="textarea"
                                        value={setPackDraft[item.type].specs}
                                        onChange={(e) =>
                                          setSetPackDraft((prev) => ({
                                            ...prev,
                                            [item.type]: {
                                              ...prev[item.type],
                                              specs: e.target.value,
                                            },
                                          }))
                                        }
                                      />
                                    </label>
                                    <label className="field field-wide">
                                      <span>{t.notes}</span>
                                      <textarea
                                        className="textarea"
                                        value={setPackDraft[item.type].notes}
                                        onChange={(e) =>
                                          setSetPackDraft((prev) => ({
                                            ...prev,
                                            [item.type]: {
                                              ...prev[item.type],
                                              notes: e.target.value,
                                            },
                                          }))
                                        }
                                      />
                                    </label>
                                    <div className="field field-wide">
                                      <span>{t.photo}</span>
                                      <input
                                        key={setPackFileKey[item.type]}
                                        ref={(el) => {
                                          setPackPhotoInputRefs.current[item.type] = el;
                                        }}
                                        className="file-input"
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={(e) => onSetPackPhotoFile(item.type, e)}
                                      />
                                      <div className="photo-preview-wrap">
                                        {normalizeAssetPhotos(setPackDraft[item.type]).length ? (
                                          <img
                                            src={normalizeAssetPhotos(setPackDraft[item.type])[0]}
                                            alt={`${item.label} preview`}
                                            className="photo-preview"
                                          />
                                        ) : (
                                          <div className="photo-placeholder">{t.noPhoto}</div>
                                        )}
                                        <div className="photo-preview-actions">
                                          <button
                                            className="btn-icon-edit"
                                            type="button"
                                            title="Change Photo"
                                            aria-label="Change Photo"
                                            onClick={() => setPackPhotoInputRefs.current[item.type]?.click()}
                                          >
                                            ✎
                                          </button>
                                          <button
                                            className="btn-danger"
                                            type="button"
                                            title="Delete Photo"
                                            aria-label="Delete Photo"
                                            disabled={!normalizeAssetPhotos(setPackDraft[item.type]).length}
                                            onClick={() => {
                                              setSetPackDraft((prev) => ({
                                                ...prev,
                                                [item.type]: {
                                                  ...prev[item.type],
                                                  photo: "",
                                                  photos: [],
                                                },
                                              }));
                                              setSetPackFileKey((prev) => ({
                                                ...prev,
                                                [item.type]: prev[item.type] + 1,
                                              }));
                                            }}
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      </div>
                                      <div className="asset-photo-gallery">
                                        {normalizeAssetPhotos(setPackDraft[item.type]).slice(0, MAX_SET_PACK_PHOTOS).map((url, index) => (
                                          <div key={`setpack-photo-${item.type}-${index}`} className="asset-photo-chip">
                                            <img src={url} alt={`${item.label}-${index + 1}`} className="asset-photo-chip-img" />
                                            <div className="asset-photo-chip-actions">
                                              <button
                                                className={`tab asset-photo-main-btn ${index === 0 ? "tab-active" : ""}`}
                                                type="button"
                                                onClick={() =>
                                                  setSetPackDraft((prev) => {
                                                    const next = [...normalizeAssetPhotos(prev[item.type]).slice(0, MAX_SET_PACK_PHOTOS)];
                                                    const hit = next.indexOf(url);
                                                    if (hit <= 0) return prev;
                                                    next.splice(hit, 1);
                                                    next.unshift(url);
                                                    return {
                                                      ...prev,
                                                      [item.type]: {
                                                        ...prev[item.type],
                                                        photo: next[0] || "",
                                                        photos: next,
                                                      },
                                                    };
                                                  })
                                                }
                                              >
                                                {index === 0 ? "Main" : "Set Main"}
                                              </button>
                                              <button
                                                className="btn-danger"
                                                type="button"
                                                onClick={() =>
                                                  setSetPackDraft((prev) => {
                                                    const next = normalizeAssetPhotos(prev[item.type]).filter((entry) => entry !== url).slice(0, MAX_SET_PACK_PHOTOS);
                                                    return {
                                                      ...prev,
                                                      [item.type]: {
                                                        ...prev[item.type],
                                                        photo: next[0] || "",
                                                        photos: next,
                                                      },
                                                    };
                                                  })
                                                }
                                              >
                                                ✕
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                      </div>
                                    ) : null}
                                  </div>
                                ) : (
                                  <div key={`pack-slot-${item.type}`} className="setpack-item-slot" aria-hidden="true" />
                                )
                              ))}
                            </div>
                          </div>
                        ) : null}
                    </>
                  ) : isLinkableForCreate ? (
                    <>
                      <label className="field field-wide">
                        <span>{t.linkToParentAsset}</span>
                        <div className="setpack-toggle-row">
                          <span className="tiny">{t.linkToParentAsset}</span>
                          <label className="switch-toggle">
                            <input
                              type="checkbox"
                              checked={assetForm.useExistingSet}
                              onChange={(e) =>
                                setAssetForm((f) => ({
                                  ...f,
                                  useExistingSet: e.target.checked,
                                  setCode: e.target.checked ? f.setCode : "",
                                  parentAssetId: e.target.checked ? f.parentAssetId : "",
                                  componentRole: e.target.checked ? f.componentRole : "",
                                  componentRequired: e.target.checked ? f.componentRequired : false,
                                }))
                              }
                            />
                            <span className="switch-slider" />
                          </label>
                        </div>
                      </label>
                      {assetForm.useExistingSet ? (
                        <label className="field field-wide">
                          <span>{t.selectParentAsset}</span>
                          <select
                            className="input"
                            value={assetForm.parentAssetId}
                            onChange={(e) => {
                              const parent = parentAssetsForCreate.find((a) => a.assetId === e.target.value);
                              setAssetForm((f) => ({
                                ...f,
                                parentAssetId: e.target.value,
                                setCode: parent?.setCode || "",
                              }));
                            }}
                          >
                            <option value="">-</option>
                            {parentAssetsForCreate.map((asset) => (
                              <option key={`parent-create-${asset.id}`} value={asset.assetId}>
                                {asset.assetId} - {assetItemName(asset.category, asset.type, asset.pcType || "")} ({asset.location || "-"})
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      {assetForm.useExistingSet ? (
                        <>
                          <label className="field">
                            <span>{t.componentRole}</span>
                            <input
                              className="input"
                              value={assetForm.componentRole}
                              onChange={(e) => setAssetForm((f) => ({ ...f, componentRole: e.target.value }))}
                              placeholder="Adapter / Remote / Front Panel"
                            />
                          </label>
                          <label className="field">
                            <span>{t.componentRequired}</span>
                            <input
                              type="checkbox"
                              checked={assetForm.componentRequired}
                              onChange={(e) => setAssetForm((f) => ({ ...f, componentRequired: e.target.checked }))}
                            />
                          </label>
                        </>
                      ) : null}
                    </>
                  ) : null}
                  {userRequired && (
                    <label className="field field-wide">
                      <span>{t.user}</span>
                      <select className="input" value={assetForm.assignedTo} onChange={(e) => setAssetForm((f) => ({ ...f, assignedTo: e.target.value }))}>
                        <option value="">{t.selectUser}</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.fullName}>{u.fullName} - {u.position}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="field">
                    <span>{t.brand}</span>
                    <input className="input" value={assetForm.brand} onChange={(e) => setAssetForm((f) => ({ ...f, brand: e.target.value }))} />
                  </label>
                  <label className="field">
                    <span>{t.model}</span>
                    <input
                      className="input"
                      list="asset-model-options"
                      value={assetForm.model}
                      onChange={(e) => {
                        const model = e.target.value;
                        setAssetForm((f) => ({ ...f, model }));
                        if (!model.trim()) setModelTemplateNote("");
                      }}
                      onBlur={(e) => applyModelTemplate(e.target.value)}
                    />
                    <datalist id="asset-model-options">
                      {modelTemplates.map((row) => (
                        <option key={`model-template-${row.model.toLowerCase()}`} value={row.model} />
                      ))}
                    </datalist>
                  </label>
                  <label className="field">
                    <span>{t.serialNumber}</span>
                    <input className="input" value={assetForm.serialNumber} onChange={(e) => setAssetForm((f) => ({ ...f, serialNumber: e.target.value }))} />
                  </label>
                  <label className="field">
                    <span>{t.purchaseDate}</span>
                    <input type="date" className="input" value={assetForm.purchaseDate} onChange={(e) => setAssetForm((f) => ({ ...f, purchaseDate: e.target.value }))} />
                  </label>
                  <label className="field">
                    <span>{t.warrantyUntil}</span>
                    <input type="date" className="input" value={assetForm.warrantyUntil} onChange={(e) => setAssetForm((f) => ({ ...f, warrantyUntil: e.target.value }))} />
                  </label>
                  <label className="field">
                    <span>{t.vendor}</span>
                    <input className="input" value={assetForm.vendor} onChange={(e) => setAssetForm((f) => ({ ...f, vendor: e.target.value }))} />
                  </label>
                  <label className="field field-wide">
                    <span>{t.specs}</span>
                    <textarea className="textarea" value={assetForm.specs} onChange={(e) => setAssetForm((f) => ({ ...f, specs: e.target.value }))} />
                  </label>
                  <label className="field field-wide">
                    <span>{t.notes}</span>
                    <textarea className="textarea" value={assetForm.notes} onChange={(e) => setAssetForm((f) => ({ ...f, notes: e.target.value }))} />
                  </label>
                  <label className="field field-wide">
                    <span>{t.photo}</span>
                    <input
                      key={assetFileKey}
                      ref={createPhotoInputRef}
                      className="file-input"
                      type="file"
                      accept="image/*"
                      multiple
                      capture="environment"
                      onChange={onPhotoFile}
                    />
                  </label>
                </div>
                {!campusLocations.length ? <p className="tiny">{t.noLocationsConfigured}</p> : null}
                {modelTemplateNote ? <p className="tiny">{modelTemplateNote}. You can edit it anytime.</p> : null}
                {assetForm.category === "IT" && assetForm.type === DESKTOP_PARENT_TYPE ? (
                  <p className="tiny">{t.desktopSetAutoNote}</p>
                ) : null}
                {userRequired ? <p className="tiny">{t.userRequired}</p> : null}
                <div className="asset-actions">
                  <div className="photo-preview-wrap">
                    {normalizeAssetPhotos(assetForm).length ? (
                      <img src={normalizeAssetPhotos(assetForm)[0]} alt="preview" className="photo-preview" />
                    ) : (
                      <div className="photo-placeholder">{t.noPhoto}</div>
                    )}
                    <div className="photo-preview-actions">
                      <button
                        className="btn-icon-edit"
                        type="button"
                        title="Change Photo"
                        aria-label="Change Photo"
                        disabled={!isAdmin}
                        onClick={() => createPhotoInputRef.current?.click()}
                      >
                        ✎
                      </button>
                      <button
                        className="btn-danger"
                        type="button"
                        title="Delete Photo"
                        aria-label="Delete Photo"
                        disabled={!isAdmin || !normalizeAssetPhotos(assetForm).length}
                        onClick={() => {
                          setAssetForm((f) => ({ ...f, photo: "", photos: [] }));
                          setAssetFileKey((k) => k + 1);
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="asset-photo-gallery">
                    {normalizeAssetPhotos(assetForm).slice(0, MAX_ASSET_PHOTOS).map((url, index) => (
                      <div key={`create-photo-${index}`} className="asset-photo-chip">
                        <img src={url} alt={`asset-${index + 1}`} className="asset-photo-chip-img" />
                        <div className="asset-photo-chip-actions">
                          <button
                            className={`tab asset-photo-main-btn ${index === 0 ? "tab-active" : ""}`}
                            type="button"
                            disabled={!isAdmin}
                            onClick={() =>
                              setAssetForm((f) => {
                                const next = [...normalizeAssetPhotos(f)];
                                const hit = next.indexOf(url);
                                if (hit <= 0) return f;
                                next.splice(hit, 1);
                                next.unshift(url);
                                return { ...f, photo: next[0] || "", photos: next };
                              })
                            }
                          >
                            {index === 0 ? "Main" : "Set Main"}
                          </button>
                          <button
                            className="btn-danger"
                            type="button"
                            disabled={!isAdmin}
                            onClick={() =>
                              setAssetForm((f) => {
                                const next = normalizeAssetPhotos(f).filter((item) => item !== url);
                                return { ...f, photo: next[0] || "", photos: next };
                              })
                            }
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="btn-primary" disabled={busy || !isAdmin} onClick={createAsset}>{t.createAsset}</button>
                </div>
              </section>
            )}

            {assetsView === "list" && canAccessMenu("assets.list", "assets") && (
              <section className="panel">
                <div className="asset-list-toolbar">
                  <h2 className="asset-list-title">{t.assetRegistry}</h2>
                </div>
                <div className="panel-filters asset-list-filters asset-list-filter-row">
                  <details className="filter-menu" onToggle={handleAssetMasterFilterMenuToggle}>
                    <summary>{summarizeMultiFilter(assetCampusMultiFilter, t.allCampuses, campusLabel)}</summary>
                    <div className="filter-menu-list">
                      <label className="filter-menu-item">
                        <input
                          type="checkbox"
                          checked={assetCampusMultiFilter.includes("ALL")}
                          onChange={(e) =>
                            setAssetCampusMultiFilter((prev) =>
                              applyMultiFilterSelection(
                                prev,
                                e.target.checked,
                                "ALL",
                                assetCampusFilterOptions
                              )
                            )
                          }
                        />
                        {t.allCampuses}
                      </label>
                      {assetCampusFilterOptions.map((campus) => (
                        <label key={`asset-campus-filter-${campus}`} className="filter-menu-item">
                          <input
                            type="checkbox"
                            checked={assetCampusMultiFilter.includes(campus)}
                            onChange={(e) =>
                              setAssetCampusMultiFilter((prev) =>
                                applyMultiFilterSelection(
                                  prev,
                                  e.target.checked,
                                  campus,
                                  assetCampusFilterOptions
                                )
                              )
                            }
                          />
                          {campusLabel(campus)}
                        </label>
                      ))}
                    </div>
                  </details>
                  <details className="filter-menu" onToggle={handleAssetMasterFilterMenuToggle}>
                    <summary>{summarizeMultiFilter(assetLocationMultiFilter, "All Locations")}</summary>
                    <div className="filter-menu-list">
                      <label className="filter-menu-item">
                        <input
                          type="checkbox"
                          checked={assetLocationMultiFilter.includes("ALL")}
                          onChange={(e) =>
                            setAssetLocationMultiFilter((prev) =>
                              applyMultiFilterSelection(
                                prev,
                                e.target.checked,
                                "ALL",
                                assetLocationFilterOptions
                              )
                            )
                          }
                        />
                        All Locations
                      </label>
                      {assetLocationFilterOptions.map((location) => (
                        <label key={`asset-location-filter-${location}`} className="filter-menu-item">
                          <input
                            type="checkbox"
                            checked={assetLocationMultiFilter.includes(location)}
                            onChange={(e) =>
                              setAssetLocationMultiFilter((prev) =>
                                applyMultiFilterSelection(
                                  prev,
                                  e.target.checked,
                                  location,
                                  assetLocationFilterOptions
                                )
                              )
                            }
                          />
                          {location}
                        </label>
                      ))}
                    </div>
                  </details>
                  <details className="filter-menu" onToggle={handleAssetMasterFilterMenuToggle}>
                    <summary>
                      {summarizeMultiFilter(assetCategoryMultiFilter, t.allCategories, (value) => {
                        const row = CATEGORY_OPTIONS.find((option) => option.value === value);
                        return row ? (lang === "km" ? row.km : row.en) : value;
                      })}
                    </summary>
                    <div className="filter-menu-list">
                      <label className="filter-menu-item">
                        <input
                          type="checkbox"
                          checked={assetCategoryMultiFilter.includes("ALL")}
                          onChange={(e) =>
                            setAssetCategoryMultiFilter((prev) =>
                              applyMultiFilterSelection(
                                prev,
                                e.target.checked,
                                "ALL",
                                assetCategoryFilterOptions
                              )
                            )
                          }
                        />
                        {t.allCategories}
                      </label>
                      {CATEGORY_OPTIONS.map((category) => (
                        <label key={`asset-category-filter-${category.value}`} className="filter-menu-item">
                          <input
                            type="checkbox"
                            checked={assetCategoryMultiFilter.includes(category.value)}
                            onChange={(e) =>
                              setAssetCategoryMultiFilter((prev) =>
                                applyMultiFilterSelection(
                                  prev,
                                  e.target.checked,
                                  category.value,
                                  assetCategoryFilterOptions
                                )
                              )
                            }
                          />
                          {lang === "km" ? category.km : category.en}
                        </label>
                      ))}
                    </div>
                  </details>
                  <details className="filter-menu" onToggle={handleAssetMasterFilterMenuToggle}>
                    <summary>
                      {summarizeMultiFilter(assetNameMultiFilter, `All ${t.name}s`, (value) => {
                        const row = assetNameFilterOptions.find((option) => option.value === value);
                        return row ? row.label : value;
                      })}
                    </summary>
                    <div className="filter-menu-list">
                      <label className="filter-menu-item">
                        <input
                          type="checkbox"
                          checked={assetNameMultiFilter.includes("ALL")}
                          onChange={(e) =>
                            setAssetNameMultiFilter((prev) =>
                              applyMultiFilterSelection(
                                prev,
                                e.target.checked,
                                "ALL",
                                assetNameFilterOptions.map((option) => option.value)
                              )
                            )
                          }
                        />
                        {`All ${t.name}s`}
                      </label>
                      {assetNameFilterOptions.map((option) => (
                        <label key={`asset-name-filter-${option.value}`} className="filter-menu-item">
                          <input
                            type="checkbox"
                            checked={assetNameMultiFilter.includes(option.value)}
                            onChange={(e) =>
                              setAssetNameMultiFilter((prev) =>
                                applyMultiFilterSelection(
                                  prev,
                                  e.target.checked,
                                  option.value,
                                  assetNameFilterOptions.map((item) => item.value)
                                )
                              )
                            }
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </details>
                  <button type="button" className="tab asset-filter-reset-btn" onClick={resetAssetListFilters}>
                    {lang === "km" ? "កំណត់តម្រងឡើងវិញ" : "Reset Filters"}
                  </button>
                  <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.searchAsset} />
                </div>

                {isPhoneView ? (
                  <div className="asset-mobile-list">
                    {assetListRows.length ? (
                      assetListRows.map((asset) => (
                        <article key={`asset-mobile-${asset.id}`} className={`asset-mobile-card ${assetStatusRowClass(asset.status || "")}`}>
                          <div className="asset-mobile-head">
                            <button className="tab asset-mobile-assetid" onClick={() => setAssetDetailId(asset.id)}>
                              <strong>{asset.assetId}</strong>
                            </button>
                          </div>
                          <div className="asset-mobile-body">
                            <div className="asset-mobile-text">
                              <div className="asset-mobile-name">
                                <strong>{t.name}:</strong> {assetItemName(asset.category, asset.type, asset.pcType || "")}
                              </div>
                              <div className="asset-mobile-meta">
                                <div><strong>{t.campus}:</strong> {campusLabel(asset.campus)}</div>
                                <div><strong>{t.category}:</strong> {asset.category}</div>
                                <div><strong>{t.location}:</strong> {asset.location || "-"}</div>
                              </div>
                            </div>
                            <div className="asset-mobile-photo">{renderAssetPhoto(asset.photo || "", asset.assetId)}</div>
                          </div>
                          <div className="asset-mobile-foot">
                            <div className="asset-mobile-status">
                              {isAdmin ? (
                                <select
                                  className="status-select"
                                  value={asset.status || "Active"}
                                  onChange={(e) => openAssetStatusChangeDialog(asset.id, e.target.value)}
                                >
                                  {ASSET_STATUS_OPTIONS.map((status) => (
                                    <option key={status.value} value={status.value}>
                                      {lang === "km" ? status.km : status.en}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span>{asset.status || "Active"}</span>
                              )}
                            </div>
                            {isAdmin ? (
                              <div className="row-actions">
                                <button
                                  className="btn-icon-transfer"
                                  onClick={() => openTransferFromAsset(asset)}
                                  title="Transfer"
                                  aria-label="Transfer"
                                >
                                  ⇄
                                </button>
                                <button
                                  className="btn-icon-edit"
                                  onClick={() => startEditAsset(asset)}
                                  title="Edit"
                                  aria-label="Edit"
                                >
                                  ✎
                                </button>
                                <button className="btn-danger" onClick={() => removeAsset(asset.id)} title="Delete" aria-label="Delete">✕</button>
                              </div>
                            ) : (
                              <span className="tiny">{t.readOnly}</span>
                            )}
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="panel-note">{t.noAssets}</div>
                    )}
                  </div>
                ) : (
                  <div className="table-wrap asset-list-scroll">
                    <table className="table-compact asset-list-table">
                      <thead>
                        <tr>
                          <th aria-sort={assetListSort.key === "assetId" ? (assetListSort.direction === "asc" ? "ascending" : "descending") : "none"}>
                            <button
                              type="button"
                              className={`th-sort-btn ${assetListSort.key === "assetId" ? "is-active" : ""}`}
                              onClick={() => toggleAssetListSort("assetId")}
                            >
                              {t.assetId}
                            </button>
                          </th>
                          <th aria-sort={assetListSort.key === "campus" ? (assetListSort.direction === "asc" ? "ascending" : "descending") : "none"}>
                            <button
                              type="button"
                              className={`th-sort-btn ${assetListSort.key === "campus" ? "is-active" : ""}`}
                              onClick={() => toggleAssetListSort("campus")}
                            >
                              {t.campus}
                            </button>
                          </th>
                          <th aria-sort={assetListSort.key === "category" ? (assetListSort.direction === "asc" ? "ascending" : "descending") : "none"}>
                            <button
                              type="button"
                              className={`th-sort-btn ${assetListSort.key === "category" ? "is-active" : ""}`}
                              onClick={() => toggleAssetListSort("category")}
                            >
                              {t.category}
                            </button>
                          </th>
                          <th>{t.photo}</th>
                          <th aria-sort={assetListSort.key === "name" ? (assetListSort.direction === "asc" ? "ascending" : "descending") : "none"}>
                            <button
                              type="button"
                              className={`th-sort-btn ${assetListSort.key === "name" ? "is-active" : ""}`}
                              onClick={() => toggleAssetListSort("name")}
                            >
                              {t.name}
                            </button>
                          </th>
                          <th aria-sort={assetListSort.key === "location" ? (assetListSort.direction === "asc" ? "ascending" : "descending") : "none"}>
                            <button
                              type="button"
                              className={`th-sort-btn ${assetListSort.key === "location" ? "is-active" : ""}`}
                              onClick={() => toggleAssetListSort("location")}
                            >
                              {t.location}
                            </button>
                          </th>
                          <th>{t.actions}</th>
                          <th aria-sort={assetListSort.key === "status" ? (assetListSort.direction === "asc" ? "ascending" : "descending") : "none"}>
                            <button
                              type="button"
                              className={`th-sort-btn ${assetListSort.key === "status" ? "is-active" : ""}`}
                              onClick={() => toggleAssetListSort("status")}
                            >
                              {t.status}
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {assetListRows.length ? (
                          assetListRows.map((asset) => (
                            <tr key={asset.id} className={assetStatusRowClass(asset.status || "")}>
                              <td>
                                <button className="tab" onClick={() => setAssetDetailId(asset.id)}>
                                  <strong>{asset.assetId}</strong>
                                </button>
                              </td>
                              <td>{campusLabel(asset.campus)}</td>
                              <td>{asset.category}</td>
                              <td>
                                {renderAssetPhoto(asset.photo || "", asset.assetId)}
                              </td>
                              <td>{assetItemName(asset.category, asset.type, asset.pcType || "")}</td>
                              <td>{asset.location || "-"}</td>
                              <td>
                                {isAdmin ? (
                                  <div className="row-actions">
                                    <button
                                      className="btn-icon-transfer"
                                      onClick={() => openTransferFromAsset(asset)}
                                      title="Transfer"
                                      aria-label="Transfer"
                                    >
                                      ⇄
                                    </button>
                                    <button
                                      className="btn-icon-edit"
                                      onClick={() => startEditAsset(asset)}
                                      title="Edit"
                                      aria-label="Edit"
                                    >
                                      ✎
                                    </button>
                                    <button className="btn-danger" onClick={() => removeAsset(asset.id)} title="Delete" aria-label="Delete">✕</button>
                                  </div>
                                ) : (
                                  <span className="tiny">{t.readOnly}</span>
                                )}
                              </td>
                              <td>
                                {isAdmin ? (
                                  <select className="status-select" value={asset.status || "Active"} onChange={(e) => openAssetStatusChangeDialog(asset.id, e.target.value)}>
                                    {ASSET_STATUS_OPTIONS.map((status) => (
                                      <option key={status.value} value={status.value}>{lang === "km" ? status.km : status.en}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span>{asset.status || "Active"}</span>
                                )}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8}>{t.noAssets}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {assetsView === "list" && detailAsset && (
              <div className="modal-backdrop" onClick={() => setAssetDetailId(null)}>
                <section className="panel modal-panel" onClick={(e) => e.stopPropagation()}>
                  <div className="panel-row">
                    <h2>Asset Detail - {detailAsset.assetId}</h2>
                    <button className="tab" onClick={() => setAssetDetailId(null)}>Close</button>
                  </div>
                  <div className="form-grid asset-detail-grid">
                    <div className="field"><span>{t.campus}</span><div className="detail-value">{campusLabel(detailAsset.campus)}</div></div>
                    <div className="field"><span>{t.category}</span><div className="detail-value">{detailAsset.category}</div></div>
                    <div className="field"><span>{t.typeCode}</span><div className="detail-value">{detailAsset.type}</div></div>
                    {detailAsset.category === "IT" && detailAsset.type === DESKTOP_PARENT_TYPE ? (
                      <div className="field"><span>{t.pcType}</span><div className="detail-value">{detailAsset.pcType || "-"}</div></div>
                    ) : null}
                    <div className="field"><span>{t.status}</span><div className="detail-value">{assetStatusLabel(detailAsset.status)}</div></div>
                    <div className="field"><span>{t.name}</span><div className="detail-value">{assetItemName(detailAsset.category, detailAsset.type, detailAsset.pcType || "")}</div></div>
                    <div className="field"><span>{t.location}</span><div className="detail-value">{detailAsset.location || "-"}</div></div>
                    {detailAsset.category === "IT" ? (
                      <div className="field"><span>{t.setCode}</span><div className="detail-value">{detailAsset.setCode || "-"}</div></div>
                    ) : null}
                    {detailAsset.category === "IT" ? (
                      <div className="field"><span>{t.parentAssetId}</span><div className="detail-value">{detailAsset.parentAssetId || "-"}</div></div>
                    ) : null}
                    {detailAsset.parentAssetId ? (
                      <div className="field"><span>{t.componentRole}</span><div className="detail-value">{detailAsset.componentRole || "-"}</div></div>
                    ) : null}
                    {detailAsset.parentAssetId ? (
                      <div className="field"><span>{t.componentRequired}</span><div className="detail-value">{detailAsset.componentRequired ? "Yes" : "No"}</div></div>
                    ) : null}
                    {detailAsset.category === "IT" ? (
                      <div className="field"><span>{t.user}</span><div className="detail-value">{detailAsset.assignedTo || "-"}</div></div>
                    ) : null}
                    <div className="field"><span>Brand</span><div className="detail-value">{detailAsset.brand || "-"}</div></div>
                    <div className="field"><span>Model</span><div className="detail-value">{detailAsset.model || "-"}</div></div>
                    <div className="field"><span>Serial Number</span><div className="detail-value">{detailAsset.serialNumber || "-"}</div></div>
                    <div className="field"><span>Vendor</span><div className="detail-value">{detailAsset.vendor || "-"}</div></div>
                    <div className="field"><span>Purchase Date</span><div className="detail-value">{formatDate(detailAsset.purchaseDate || "-")}</div></div>
                    <div className="field"><span>Warranty Until</span><div className="detail-value">{formatDate(detailAsset.warrantyUntil || "-")}</div></div>
                    <div className="field field-wide"><span>Specs</span><div className="detail-value">{detailAsset.specs || "-"}</div></div>
                    <div className="field field-wide"><span>Notes</span><div className="detail-value">{detailAsset.notes || "-"}</div></div>
                    <div className="field"><span>Next Maintenance Date</span><div className="detail-value">{formatDate(detailAsset.nextMaintenanceDate || "-")}</div></div>
                    <div className="field"><span>Schedule Note</span><div className="detail-value">{detailAsset.scheduleNote || "-"}</div></div>
                    <div className="field field-wide">
                      <span>{t.photo}</span>
                      <div className="detail-value">
                        {renderAssetPhoto(detailAsset.photo || "", detailAsset.assetId)}
                      </div>
                    </div>
                  </div>

                  <h3 className="section-title">Maintenance History</h3>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Work Status</th>
                          <th>Condition</th>
                          <th>Note</th>
                          <th>{t.photo}</th>
                          <th>Cost</th>
                          <th>By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailMaintenanceEntries.length ? (
                          detailMaintenanceEntries.map((h) => (
                            <tr key={`detail-history-${h.id}`}>
                              <td>{formatDate(h.date)}</td>
                              <td>{h.type}</td>
                              <td>{h.completion || "-"}</td>
                              <td>{h.condition || "-"}</td>
                              <td>{h.note}</td>
                              <td>{renderAssetPhoto(h.photo || "", "maintenance")}</td>
                              <td>{h.cost || "-"}</td>
                              <td>{h.by || "-"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8}>No maintenance records yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <h3 className="section-title">Transfer History</h3>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>From Campus</th>
                          <th>From Location</th>
                          <th>To Campus</th>
                          <th>To Location</th>
                          <th>From Staff</th>
                          <th>To Staff</th>
                          <th>Ack</th>
                          <th>Reason</th>
                          <th>By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailTransferEntries.length ? (
                          detailTransferEntries.map((h) => {
                            const custody = detailCustodyEntries.find(
                              (entry) =>
                                String(entry.date || "").slice(0, 10) === String(h.date || "").slice(0, 10) &&
                                String(entry.toCampus || "") === String(h.toCampus || "") &&
                                String(entry.toLocation || "") === String(h.toLocation || "")
                            );
                            return (
                            <tr key={`detail-transfer-${h.id}`}>
                              <td>{formatDate(h.date)}</td>
                              <td>{campusLabel(h.fromCampus)}</td>
                              <td>{h.fromLocation || "-"}</td>
                              <td>{campusLabel(h.toCampus)}</td>
                              <td>{h.toLocation || "-"}</td>
                              <td>{custody?.fromUser || "-"}</td>
                              <td>{custody?.toUser || "-"}</td>
                              <td>{custody?.responsibilityAck ? "Yes" : "No"}</td>
                              <td>{h.reason || "-"}</td>
                              <td>{h.by || "-"}</td>
                            </tr>
                          );
                          })
                        ) : (
                          <tr>
                            <td colSpan={10}>No transfer history yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <h3 className="section-title">Custody History</h3>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Action</th>
                          <th>From User</th>
                          <th>To User</th>
                          <th>Ack</th>
                          <th>By</th>
                          <th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailCustodyEntries.length ? (
                          detailCustodyEntries.map((h) => (
                            <tr key={`detail-custody-${h.id}`}>
                              <td>{formatDate(h.date)}</td>
                              <td>{h.action || "-"}</td>
                              <td>{h.fromUser || "-"}</td>
                              <td>{h.toUser || "-"}</td>
                              <td>{h.responsibilityAck ? "Yes" : "No"}</td>
                              <td>{h.by || "-"}</td>
                              <td>{h.note || "-"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7}>No custody history yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <h3 className="section-title">Status Timeline</h3>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>From</th>
                          <th>To</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailStatusEntries.length ? (
                          detailStatusEntries.map((h) => (
                            <tr key={`detail-status-${h.id}`}>
                              <td>{formatDate(h.date)}</td>
                              <td>{assetStatusLabel(h.fromStatus)}</td>
                              <td>{assetStatusLabel(h.toStatus)}</td>
                              <td>{h.reason || "-"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4}>No status timeline yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {assetsView === "list" && editingAsset && (
              <div className="modal-backdrop" onClick={cancelEditAsset}>
                <section className="panel modal-panel" onClick={(e) => e.stopPropagation()}>
                  <div className="panel-row">
                    <h2>Edit Asset - {editingAsset.assetId}</h2>
                    <button className="tab" onClick={cancelEditAsset}>Close</button>
                  </div>
                  <div className="form-grid">
                    <div className="field">
                      <span>{t.campus}</span>
                      <div className="detail-value">{campusLabel(editingAsset.campus)}</div>
                    </div>
                    <div className="field">
                      <span>{t.category}</span>
                      <div className="detail-value">{editingAsset.category}</div>
                    </div>
                    <div className="field">
                      <span>{t.typeCode}</span>
                      <div className="detail-value">{editingAsset.type}</div>
                    </div>
                    {editingAsset.category === "IT" && editingAsset.type === DESKTOP_PARENT_TYPE ? (
                      <label className="field">
                        <span>{t.pcType}</span>
                        <select
                          className="input"
                          value={assetEditForm.pcType}
                          onChange={(e) => setAssetEditForm((f) => ({ ...f, pcType: e.target.value }))}
                        >
                          {PC_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {lang === "km" ? opt.km : opt.en}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <label className="field">
                      <span>{t.status}</span>
                      <select
                        className="input"
                        value={assetEditForm.status}
                        onChange={(e) => setAssetEditForm((f) => ({ ...f, status: e.target.value }))}
                      >
                        {ASSET_STATUS_OPTIONS.map((status) => (
                          <option key={status.value} value={status.value}>
                            {lang === "km" ? status.km : status.en}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field field-wide">
                      <span>{t.location}</span>
                      <input
                        className="input"
                        value={assetEditForm.location}
                        onChange={(e) => setAssetEditForm((f) => ({ ...f, location: e.target.value }))}
                      />
                    </label>
                    {editingAsset.category === "IT" && editingAsset.type === DESKTOP_PARENT_TYPE ? (
                      <label className="field field-wide">
                        <span>{t.setCode}</span>
                        <input
                          className="input"
                          value={assetEditForm.setCode}
                          onChange={(e) => setAssetEditForm((f) => ({ ...f, setCode: e.target.value }))}
                          placeholder="SET-C2.2-001"
                        />
                      </label>
                    ) : canLinkToParentAsset(editingAsset.type) ? (
                      <>
                        <label className="field field-wide">
                          <span>{t.linkToParentAsset}</span>
                          <div className="setpack-toggle-row">
                            <span className="tiny">{t.linkToParentAsset}</span>
                            <label className="switch-toggle">
                              <input
                                type="checkbox"
                                checked={assetEditForm.useExistingSet}
                                onChange={(e) =>
                                  setAssetEditForm((f) => ({
                                    ...f,
                                    useExistingSet: e.target.checked,
                                    setCode: e.target.checked ? f.setCode : "",
                                    parentAssetId: e.target.checked ? f.parentAssetId : "",
                                    componentRole: e.target.checked ? f.componentRole : "",
                                    componentRequired: e.target.checked ? f.componentRequired : false,
                                  }))
                                }
                              />
                              <span className="switch-slider" />
                            </label>
                          </div>
                        </label>
                        {assetEditForm.useExistingSet ? (
                          <label className="field field-wide">
                            <span>{t.selectParentAsset}</span>
                            <select
                              className="input"
                              value={assetEditForm.parentAssetId}
                              onChange={(e) => {
                                const parent = parentAssetsForEdit.find((a) => a.assetId === e.target.value);
                                setAssetEditForm((f) => ({
                                  ...f,
                                  parentAssetId: e.target.value,
                                  setCode: parent?.setCode || "",
                                }));
                              }}
                            >
                              <option value="">-</option>
                              {parentAssetsForEdit.map((asset) => (
                                <option key={`parent-edit-${asset.id}`} value={asset.assetId}>
                                  {asset.assetId} - {assetItemName(asset.category, asset.type, asset.pcType || "")} ({asset.location || "-"})
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                        {assetEditForm.useExistingSet ? (
                          <>
                            <label className="field">
                              <span>{t.componentRole}</span>
                              <input
                                className="input"
                                value={assetEditForm.componentRole}
                                onChange={(e) => setAssetEditForm((f) => ({ ...f, componentRole: e.target.value }))}
                                placeholder="Adapter / Remote / Front Panel"
                              />
                            </label>
                            <label className="field">
                              <span>{t.componentRequired}</span>
                              <input
                                type="checkbox"
                                checked={assetEditForm.componentRequired}
                                onChange={(e) => setAssetEditForm((f) => ({ ...f, componentRequired: e.target.checked }))}
                              />
                            </label>
                          </>
                        ) : null}
                      </>
                    ) : null}
                    {editingAsset.category === "IT" && editingAsset.type === DESKTOP_PARENT_TYPE ? (
                      <>
                        <div className="field">
                          <span>{t.createAsSetPack}</span>
                          <div className="setpack-toggle-row">
                            <span className="tiny">{t.setPackHint}</span>
                            <label className="switch-toggle">
                              <input
                                type="checkbox"
                                checked={editCreateSetPack}
                                disabled={!isAdmin || busy}
                                onChange={(e) => setEditCreateSetPack(e.target.checked)}
                              />
                              <span className="switch-slider" />
                            </label>
                          </div>
                        </div>
                        {editCreateSetPack ? (
                          <div className="field field-wide">
                            <span>{t.setPackItems}</span>
                            <div className="setpack-include-grid">
                              {setPackChildMeta.map((item) => (
                                <label key={`edit-setpack-include-${item.type}`} className="tab setpack-include-item">
                                  <input
                                    type="checkbox"
                                    checked={editSetPackEnabled[item.type]}
                                    disabled={!isAdmin || busy}
                                    onChange={(e) =>
                                      setEditSetPackEnabled((prev) => {
                                        const checked = e.target.checked;
                                        const next = {
                                          ...prev,
                                          [item.type]: checked,
                                        };
                                        if (item.type === "MON2" && checked) next.MON = true;
                                        if (item.type === "MON" && !checked) next.MON2 = false;
                                        return next;
                                      })
                                    }
                                    style={{ marginRight: 8 }}
                                  />
                                  {item.label}
                                </label>
                              ))}
                            </div>
                            <div className="setpack-card-grid">
                              {setPackChildMeta.map((item) => {
                                if (!editSetPackEnabled[item.type]) {
                                  return <div key={`edit-setpack-empty-${item.type}`} className="setpack-item-slot" />;
                                }
                                const child = editingSetPackChildren[item.type];
                                return (
                                  <div key={`edit-setpack-${item.type}`} className="setpack-item-card">
                                    <div className="setpack-item-head">
                                      <div>
                                        <strong>{item.label}</strong>
                                        <div className="tiny">
                                          {child
                                            ? `${t.assetId}: ${child.assetId} | ${t.status}: ${assetStatusLabel(child.status || "-")}`
                                            : "Not created yet for this set"}
                                        </div>
                                      </div>
                                      <button
                                        className="setpack-detail-btn"
                                        type="button"
                                        disabled={!isAdmin || busy}
                                        onClick={() => {
                                          void editOrCreateSetPackChild(item.type);
                                        }}
                                      >
                                        {child ? "Edit Details" : "Add + Edit"}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                    <label className="field field-wide">
                      <span>{t.user}</span>
                      <select
                        className="input"
                        value={assetEditForm.assignedTo}
                        onChange={(e) => setAssetEditForm((f) => ({ ...f, assignedTo: e.target.value }))}
                      >
                        <option value="">-</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.fullName}>
                            {u.fullName} - {u.position}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Brand</span>
                      <input className="input" value={assetEditForm.brand} onChange={(e) => setAssetEditForm((f) => ({ ...f, brand: e.target.value }))} />
                    </label>
                    <label className="field">
                      <span>Model</span>
                      <input className="input" value={assetEditForm.model} onChange={(e) => setAssetEditForm((f) => ({ ...f, model: e.target.value }))} />
                    </label>
                    <label className="field">
                      <span>Serial Number</span>
                      <input className="input" value={assetEditForm.serialNumber} onChange={(e) => setAssetEditForm((f) => ({ ...f, serialNumber: e.target.value }))} />
                    </label>
                    <label className="field">
                      <span>Purchase Date</span>
                      <input type="date" className="input" value={assetEditForm.purchaseDate} onChange={(e) => setAssetEditForm((f) => ({ ...f, purchaseDate: e.target.value }))} />
                    </label>
                    <label className="field">
                      <span>Warranty Until</span>
                      <input type="date" className="input" value={assetEditForm.warrantyUntil} onChange={(e) => setAssetEditForm((f) => ({ ...f, warrantyUntil: e.target.value }))} />
                    </label>
                    <label className="field">
                      <span>Vendor</span>
                      <input className="input" value={assetEditForm.vendor} onChange={(e) => setAssetEditForm((f) => ({ ...f, vendor: e.target.value }))} />
                    </label>
                    <label className="field field-wide">
                      <span>Specs</span>
                      <textarea className="textarea" value={assetEditForm.specs} onChange={(e) => setAssetEditForm((f) => ({ ...f, specs: e.target.value }))} />
                    </label>
                    <label className="field field-wide">
                      <span>Notes</span>
                      <textarea className="textarea" value={assetEditForm.notes} onChange={(e) => setAssetEditForm((f) => ({ ...f, notes: e.target.value }))} />
                    </label>
                    <label className="field field-wide">
                      <span>{t.photo}</span>
                      <input
                        key={editAssetFileKey}
                        ref={editPhotoInputRef}
                        className="file-input"
                        type="file"
                        accept="image/*"
                        multiple
                        capture="environment"
                        onChange={onEditAssetPhotoFile}
                      />
                    </label>
                  </div>
                  <div className="asset-actions">
                    <div className="photo-preview-wrap">
                      {normalizeAssetPhotos(assetEditForm).length ? (
                        <img src={normalizeAssetPhotos(assetEditForm)[0]} alt="edit preview" className="photo-preview" />
                      ) : (
                        <div className="photo-placeholder">{t.noPhoto}</div>
                      )}
                      <div className="photo-preview-actions">
                        <button
                          className="btn-icon-edit"
                          type="button"
                          title="Change Photo"
                          aria-label="Change Photo"
                          disabled={!isAdmin}
                          onClick={() => editPhotoInputRef.current?.click()}
                        >
                          ✎
                        </button>
                        <button
                          className="btn-danger"
                          type="button"
                          title="Delete Photo"
                          aria-label="Delete Photo"
                          disabled={!isAdmin || !normalizeAssetPhotos(assetEditForm).length}
                          onClick={() => {
                            setAssetEditForm((f) => ({ ...f, photo: "", photos: [] }));
                            setEditAssetFileKey((k) => k + 1);
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className="asset-photo-gallery">
                      {normalizeAssetPhotos(assetEditForm).slice(0, MAX_ASSET_PHOTOS).map((url, index) => (
                        <div key={`edit-photo-${index}`} className="asset-photo-chip">
                          <img src={url} alt={`asset-edit-${index + 1}`} className="asset-photo-chip-img" />
                          <div className="asset-photo-chip-actions">
                            <button
                              className={`tab asset-photo-main-btn ${index === 0 ? "tab-active" : ""}`}
                              type="button"
                              disabled={!isAdmin}
                              onClick={() =>
                                setAssetEditForm((f) => {
                                  const next = [...normalizeAssetPhotos(f)];
                                  const hit = next.indexOf(url);
                                  if (hit <= 0) return f;
                                  next.splice(hit, 1);
                                  next.unshift(url);
                                  return { ...f, photo: next[0] || "", photos: next };
                                })
                              }
                            >
                              {index === 0 ? "Main" : "Set Main"}
                            </button>
                            <button
                              className="btn-danger"
                              type="button"
                              disabled={!isAdmin}
                              onClick={() =>
                                setAssetEditForm((f) => {
                                  const next = normalizeAssetPhotos(f).filter((item) => item !== url);
                                  return { ...f, photo: next[0] || "", photos: next };
                                })
                              }
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="row-actions">
                      <button className="tab" onClick={cancelEditAsset}>Cancel</button>
                      <button className="btn-primary" disabled={busy || !isAdmin} onClick={updateAsset}>Save Update</button>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {assetsView === "list" && historyAsset && (
              <div className="modal-backdrop" onClick={() => setHistoryAssetId(null)}>
                <section className="panel modal-panel" onClick={(e) => e.stopPropagation()}>
                  <div className="panel-row">
                    <h2>Maintenance History - {historyAsset.assetId}</h2>
                    <div className="row-actions">
                      <button
                        className="btn-primary btn-small"
                        onClick={() => {
                          setHistoryAssetId(null);
                          openQuickRecordModal(historyAsset);
                        }}
                      >
                        Record
                      </button>
                      <button className="tab" onClick={() => setHistoryAssetId(null)}>Close</button>
                    </div>
                  </div>
                  <p className="tiny">Purchase: {formatDate(historyAsset.purchaseDate || "-")} | Warranty: {formatDate(historyAsset.warrantyUntil || "-")}</p>
                  <div className="table-wrap" style={{ marginTop: 12 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Work Status</th>
                          <th>Condition</th>
                          <th>Note</th>
                          <th>{t.photo}</th>
                          <th>Cost</th>
                          <th>By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyAssetEntries.length ? (
                          historyAssetEntries.map((h) => (
                            <tr key={h.id}>
                              <td>{formatDate(h.date)}</td>
                              <td>{h.type}</td>
                              <td>{h.completion || "-"}</td>
                              <td>{h.condition || "-"}</td>
                              <td>{h.note}</td>
                              <td>
                                {renderAssetPhoto(h.photo || "", "maintenance")}
                              </td>
                              <td>{h.cost || "-"}</td>
                              <td>{h.by || "-"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8}>No maintenance records yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {assetsView === "list" && quickRecordAsset && (
              <div className="modal-backdrop" onClick={() => setQuickRecordAssetId(null)}>
                <section className="panel modal-panel" onClick={(e) => e.stopPropagation()}>
                  <div className="panel-row">
                    <h2>Record Maintenance Result - {quickRecordAsset.assetId}</h2>
                    <button className="tab" onClick={() => setQuickRecordAssetId(null)}>Close</button>
                  </div>
                  <div className="form-grid">
                    <label className="field">
                      <span>Asset</span>
                      <input
                        className="input"
                        value={`${quickRecordAsset.assetId} - ${campusLabel(quickRecordAsset.campus)}`}
                        readOnly
                      />
                    </label>
                    <label className="field">
                      <span>Date</span>
                      <input
                        type="date"
                        className="input"
                        min={todayYmd}
                        value={maintenanceRecordForm.date}
                        onChange={(e) => setMaintenanceRecordForm((f) => ({ ...f, date: e.target.value }))}
                      />
                    </label>
                    <label className="field">
                      <span>Type</span>
                      <select
                        className="input"
                        value={maintenanceRecordForm.type}
                        onChange={(e) => setMaintenanceRecordForm((f) => ({ ...f, type: e.target.value }))}
                      >
                        {MAINTENANCE_TYPE_OPTIONS.map((opt) => (
                          <option key={`quick-record-type-${opt}`} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Work Status</span>
                      <select
                        className="input"
                        value={maintenanceRecordForm.completion}
                        onChange={(e) =>
                          setMaintenanceRecordForm((f) => ({
                            ...f,
                            completion: e.target.value as "Done" | "Not Yet",
                          }))
                        }
                      >
                        {MAINTENANCE_COMPLETION_OPTIONS.map((opt) => (
                          <option key={`quick-${opt.value}`} value={opt.value}>
                            {opt.value === "Done" ? t.alreadyDone : t.notYetDone}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field field-wide">
                      <span>Condition Comment</span>
                      <input
                        className="input"
                        value={maintenanceRecordForm.condition}
                        onChange={(e) => setMaintenanceRecordForm((f) => ({ ...f, condition: e.target.value }))}
                        placeholder="Example: Working well, battery low, replace soon..."
                      />
                    </label>
                    <label className="field field-wide">
                      <span>Maintenance Note</span>
                      <textarea
                        className="textarea"
                        value={maintenanceRecordForm.note}
                        onChange={(e) => setMaintenanceRecordForm((f) => ({ ...f, note: e.target.value }))}
                      />
                    </label>
                    <label className="field">
                      <span>Cost</span>
                      <input
                        className="input"
                        value={maintenanceRecordForm.cost}
                        onChange={(e) => setMaintenanceRecordForm((f) => ({ ...f, cost: e.target.value }))}
                      />
                    </label>
                    <label className="field">
                      <span>By</span>
                      <input
                        className="input"
                        value={maintenanceRecordForm.by}
                        onChange={(e) => setMaintenanceRecordForm((f) => ({ ...f, by: e.target.value }))}
                      />
                    </label>
                    <label className="field field-wide">
                      <span>{t.photo}</span>
                      <input
                        key={maintenanceRecordFileKey}
                        className="file-input"
                        type="file"
                        accept="image/*"
                        onChange={onMaintenanceRecordPhotoFile}
                      />
                    </label>
                  </div>
                  <div className="asset-actions">
                    <div className="tiny">Save maintenance directly from List Asset.</div>
                    <button
                      className="btn-primary"
                      disabled={busy || !isAdmin || !maintenanceRecordForm.date || !maintenanceRecordForm.note.trim()}
                      onClick={async () => {
                        const saved = await addMaintenanceRecordFromTab();
                        if (saved) setQuickRecordAssetId(null);
                      }}
                    >
                      Add Maintenance Record
                    </button>
                  </div>
                </section>
              </div>
            )}

            {assetsView === "list" && transferQuickAssetId && transferQuickAsset && (
              <div className="modal-backdrop" onClick={() => { setTransferQuickAssetId(null); }}>
                <section className="panel modal-panel transfer-modal-panel" onClick={(e) => e.stopPropagation()}>
                  <div className="panel-row">
                    <h2>Transfer Asset - {transferQuickAsset.assetId}</h2>
                    <button className="tab" onClick={() => { setTransferQuickAssetId(null); }}>Close</button>
                  </div>
                  <div className="transfer-location-strip">
                    <div className="transfer-location-card">
                      <span>From</span>
                      <strong>{campusLabel(transferQuickAsset.campus)}</strong>
                      <small>{transferQuickAsset.location || "-"}</small>
                    </div>
                    <div className="transfer-location-arrow">→</div>
                    <div className="transfer-location-card">
                      <span>To</span>
                      <strong>{campusLabel(transferForm.toCampus || transferQuickAsset.campus)}</strong>
                      <small>{transferForm.toLocation || "Select location"}</small>
                    </div>
                  </div>
                  <div className="form-grid">
                    <label className="field">
                      <span>Asset</span>
                      <input className="input" value={`${transferQuickAsset.assetId} - ${assetItemName(transferQuickAsset.category, transferQuickAsset.type, transferQuickAsset.pcType || "")}`} readOnly />
                    </label>
                    <label className="field">
                      <span>Transfer Date</span>
                      <input
                        type="date"
                        className="input"
                        value={transferForm.date}
                        onChange={(e) => setTransferForm((f) => ({ ...f, date: e.target.value }))}
                      />
                    </label>
                    <label className="field">
                      <span>From Campus</span>
                      <input className="input" value={campusLabel(transferQuickAsset.campus)} readOnly />
                    </label>
                    <label className="field">
                      <span>From Location</span>
                      <input className="input" value={transferQuickAsset.location || "-"} readOnly />
                    </label>
                    <label className="field">
                      <span>To Campus</span>
                      <select
                        className="input"
                        value={transferForm.toCampus}
                        onChange={(e) => setTransferForm((f) => ({ ...f, toCampus: e.target.value, toLocation: "" }))}
                      >
                        {CAMPUS_LIST.map((campus) => (
                          <option key={`quick-to-campus-${campus}`} value={campus}>{campusLabel(campus)}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>To Location</span>
                      <select
                        className="input"
                        value={transferForm.toLocation}
                        onChange={(e) => setTransferForm((f) => ({ ...f, toLocation: e.target.value }))}
                      >
                        <option value="">Select location</option>
                        {transferLocationOptions.map((loc) => (
                          <option key={`quick-to-location-${loc.id}`} value={loc.name}>{loc.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Reason</span>
                      <input
                        className="input"
                        value={transferForm.reason}
                        onChange={(e) => setTransferForm((f) => ({ ...f, reason: e.target.value }))}
                        placeholder="Example: Room move / Campus reallocation"
                      />
                    </label>
                    <label className="field">
                      <span>{t.by}</span>
                      <input
                        className="input"
                        value={transferForm.by}
                        onChange={(e) => setTransferForm((f) => ({ ...f, by: e.target.value }))}
                      />
                    </label>
                    <label className="field field-wide">
                      <span>Note</span>
                      <textarea
                        className="textarea"
                        value={transferForm.note}
                        onChange={(e) => setTransferForm((f) => ({ ...f, note: e.target.value }))}
                      />
                    </label>
                  </div>
                  <div className="asset-actions">
                    <div className="tiny">Transfer updates campus/location and saves transfer history.</div>
                    <div className="row-actions">
                      <button className="tab" onClick={() => { setTransferQuickAssetId(null); }}>Cancel</button>
                      <button
                        className="btn-primary"
                        disabled={busy || !isAdmin || !transferForm.toCampus || !transferForm.toLocation}
                        onClick={async () => {
                          const saved = await submitAssetTransfer(transferQuickAsset.id);
                          if (saved) {
                            setTransferQuickAssetId(null);
                          }
                        }}
                      >
                        Save Transfer
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </>
        )}

        {tab === "tickets" && (
          <>
            <section className="panel">
              <h2>{t.createWorkOrder}</h2>
              <div className="form-grid">
                <label className="field">
                  <span>{t.campus}</span>
                  <select className="input" value={ticketForm.campus} onChange={(e) => setTicketForm((f) => ({ ...f, campus: e.target.value }))}>
                    {CAMPUS_LIST.map((campus) => <option key={campus} value={campus}>{campusLabel(campus)}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>{t.category}</span>
                  <select className="input" value={ticketForm.category} onChange={(e) => setTicketForm((f) => ({ ...f, category: e.target.value }))}>
                    {CATEGORY_OPTIONS.map((category) => (
                      <option key={category.value} value={category.value}>{lang === "km" ? category.km : category.en}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{t.priority}</span>
                  <select className="input" value={ticketForm.priority} onChange={(e) => setTicketForm((f) => ({ ...f, priority: e.target.value }))}>
                    {PRIORITY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{lang === "km" ? p.km : p.en}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>{t.relatedAsset}</span>
                  <input className="input" value={ticketForm.assetId} onChange={(e) => setTicketForm((f) => ({ ...f, assetId: e.target.value.toUpperCase() }))} placeholder="C1-IT-PC-0001" />
                </label>
                <label className="field field-wide">
                  <span>{t.titleLabel}</span>
                  <input className="input" value={ticketForm.title} onChange={(e) => setTicketForm((f) => ({ ...f, title: e.target.value }))} />
                </label>
                <label className="field field-wide">
                  <span>{t.description}</span>
                  <textarea className="textarea" value={ticketForm.description} onChange={(e) => setTicketForm((f) => ({ ...f, description: e.target.value }))} />
                </label>
                <label className="field field-wide">
                  <span>{t.requestedBy}</span>
                  <input className="input" value={ticketForm.requestedBy} onChange={(e) => setTicketForm((f) => ({ ...f, requestedBy: e.target.value }))} />
                </label>
              </div>
              <div className="asset-actions">
                <div className="photo-placeholder">{t.ticketQueue}: {tickets.length}</div>
                <button className="btn-primary" disabled={busy || !isAdmin} onClick={createTicket}>{t.createWorkOrder}</button>
              </div>
            </section>

            <section className="panel">
              <h2>{t.workOrderQueue}</h2>
              <div className="table-wrap report-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t.ticketNo}</th>
                      <th>{t.campus}</th>
                      <th>{t.category}</th>
                      <th>{t.titleLabel}</th>
                      <th>{t.priority}</th>
                      <th>{t.status}</th>
                      <th>{t.requestedBy}</th>
                      <th>{t.created}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.length ? (
                      tickets.map((ticket) => (
                        <tr key={ticket.id}>
                          <td><strong>{ticket.ticketNo}</strong></td>
                          <td>{campusLabel(ticket.campus)}</td>
                          <td>{ticket.category}</td>
                          <td>
                            {ticket.title}
                            {ticket.assetId ? <div className="tiny">{t.asset}: {ticket.assetId}</div> : null}
                          </td>
                          <td>{(lang === "km" ? PRIORITY_OPTIONS.find((p) => p.value === ticket.priority)?.km : PRIORITY_OPTIONS.find((p) => p.value === ticket.priority)?.en) || ticket.priority}</td>
                          <td>
                            <select className="status-select" disabled={!isAdmin} value={ticket.status || "Open"} onChange={(e) => changeTicketStatus(ticket.id, e.target.value)}>
                              {TICKET_STATUS_OPTIONS.map((status) => (
                                <option key={status.value} value={status.value}>{lang === "km" ? status.km : status.en}</option>
                              ))}
                            </select>
                          </td>
                          <td>{ticket.requestedBy}</td>
                          <td>{formatDate(ticket.created)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8}>{t.noWorkOrders}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {tab === "inventory" && (
          <>
            <section className="panel">
              <div className="panel-row">
                <h2>{maintenanceQuickMode ? "Maintenance Quick Record" : "Inventory Control"}</h2>
                {maintenanceQuickMode ? (
                  <div className="row-actions">
                    <button type="button" className="tab btn-small" onClick={copyMaintenanceQuickLink}>
                      Copy Staff Link
                    </button>
                  </div>
                ) : (
                  <div className="panel-filters">
                    <input
                      className="input"
                      placeholder="Search item code, name..."
                      value={inventorySearch}
                      onChange={(e) => setInventorySearch(e.target.value)}
                    />
                  </div>
                )}
              </div>
              {maintenanceQuickMode ? (
                <p className="tiny">
                  {lang === "km"
                    ? "របៀបសម្រាប់បុគ្គលិកថែទាំ៖ កត់ត្រាចេញស្តុកតាម Gallery ប៉ុណ្ណោះ។"
                    : "Maintenance staff mode: only quick recording flow is shown."}
                </p>
              ) : (
                <div className="tabs">
                  <button className={`tab ${inventoryView === "items" ? "tab-active" : ""}`} onClick={() => setInventoryView("items")}>Item Setup</button>
                  <button className={`tab ${inventoryView === "daily" ? "tab-active" : ""}`} onClick={() => setInventoryView("daily")}>
                    {lang === "km" ? "កត់ត្រាប្រចាំថ្ងៃ" : "Daily IN/OUT"}
                  </button>
                  <button className={`tab ${inventoryView === "stock" ? "tab-active" : ""}`} onClick={() => setInventoryView("stock")}>Stock In/Out</button>
                  <button className={`tab ${inventoryView === "balance" ? "tab-active" : ""}`} onClick={() => setInventoryView("balance")}>Balance & Alerts</button>
                </div>
              )}
            </section>

            {!maintenanceQuickMode && inventoryView === "items" && (
              <section className="panel">
                <h2>Create Inventory Item</h2>
                <div className="form-grid">
                  <label className="field">
                    <span>Campus</span>
                    <select className="input" value={inventoryItemForm.campus} onChange={(e) => setInventoryItemForm((f) => ({ ...f, campus: e.target.value }))}>
                      {CAMPUS_LIST.map((campus) => (
                        <option key={`inv-form-campus-${campus}`} value={campus}>{campusLabel(campus)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Category</span>
                    <select
                      className="input"
                      value={inventoryItemForm.category}
                      onChange={(e) => setInventoryItemForm((f) => ({ ...f, category: e.target.value as "SUPPLY" | "CLEAN_TOOL" | "MAINT_TOOL" }))}
                    >
                      {INVENTORY_CATEGORY_OPTIONS.map((opt) => (
                        <option key={`inv-cat-${opt.value}`} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Item Master</span>
                    <select
                      className="input"
                      value={inventoryItemForm.masterItemKey}
                      onChange={(e) => setInventoryItemForm((f) => ({ ...f, masterItemKey: e.target.value }))}
                    >
                      <option value="">Select item master</option>
                      {inventoryMasterOptions.map((item) => (
                        <option key={`inv-master-${item.key}`} value={item.key}>
                          {item.nameEn}{item.spec ? ` (${item.spec})` : ""} - {item.unit}
                        </option>
                      ))}
                    </select>
                    <small className="tiny">
                      Standardized items only (Khmer/English aliases mapped in master list).
                    </small>
                    {inventorySupplyMasterLocked && (
                      <small className="tiny" style={{ color: "#b03131" }}>
                        All cleaning supplies are already created for this campus.
                      </small>
                    )}
                  </label>
                  <label className="field">
                    <span>Item Code</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        className="input"
                        value={inventoryItemForm.itemCode}
                        onChange={(e) => {
                          setInventoryCodeManual(true);
                          setInventoryItemForm((f) => ({ ...f, itemCode: e.target.value }));
                        }}
                      />
                      <button
                        type="button"
                        className="tab"
                        onClick={() => {
                          setInventoryCodeManual(false);
                          setInventoryItemForm((f) => ({ ...f, itemCode: autoInventoryItemCode }));
                        }}
                      >
                        Auto
                      </button>
                    </div>
                    <small className="tiny">Auto format: Campus-Category-0001 (example: C2-CS-0001)</small>
                  </label>
                  <label className="field">
                    <span>Item Name</span>
                    <input className="input" value={inventoryItemForm.itemName} readOnly />
                  </label>
                  <label className="field">
                    <span>Unit</span>
                    <input className="input" value={inventoryItemForm.unit} readOnly />
                  </label>
                  <label className="field">
                    <span>Location</span>
                    <select className="input" value={inventoryItemForm.location} onChange={(e) => setInventoryItemForm((f) => ({ ...f, location: e.target.value }))}>
                      {inventoryLocations.map((loc) => (
                        <option key={`inv-loc-${loc.id}`} value={loc.name}>{loc.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Opening Qty</span>
                    <input className="input" type="number" min="0" value={inventoryItemForm.openingQty} onChange={(e) => setInventoryItemForm((f) => ({ ...f, openingQty: e.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Min Stock Alert</span>
                    <input className="input" type="number" min="0" value={inventoryItemForm.minStock} onChange={(e) => setInventoryItemForm((f) => ({ ...f, minStock: e.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Vendor</span>
                    <input className="input" value={inventoryItemForm.vendor} onChange={(e) => setInventoryItemForm((f) => ({ ...f, vendor: e.target.value }))} />
                  </label>
                  <label className="field field-wide">
                    <span>Notes</span>
                    <textarea className="textarea" value={inventoryItemForm.notes} onChange={(e) => setInventoryItemForm((f) => ({ ...f, notes: e.target.value }))} />
                  </label>
                  <label className="field field-wide">
                    <span>{t.photo}</span>
                    <input key={`inventory-photo-${inventoryItemFileKey}`} type="file" accept="image/*" className="input" onChange={onInventoryPhotoFile} />
                  </label>
                </div>
                <div className="asset-actions">
                  <div className="tiny">Add consumable supplies and tools for cleaning/maintenance operation.</div>
                  <button className="btn-primary" disabled={!isAdmin || inventorySupplyMasterLocked} onClick={createInventoryItem}>Add Inventory Item</button>
                </div>

                <div className="table-wrap" style={{ marginTop: 12 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>{t.photo}</th>
                        <th>Name</th>
                        <th>Category</th>
                        <th>{t.campus}</th>
                        <th>{t.location}</th>
                        <th>Unit</th>
                        <th>Opening</th>
                        <th>Min</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryBalanceRows.length ? (
                        inventoryBalanceRows.map((row) => (
                          <tr key={`inv-item-row-${row.id}`}>
                            <td><strong>{row.itemCode}</strong></td>
                            <td>{renderAssetPhoto(row.photo || "", row.itemCode)}</td>
                            <td>{row.itemName}</td>
                            <td>{row.category}</td>
                            <td>{inventoryCampusLabel(row.campus)}</td>
                            <td>{row.location}</td>
                            <td>{row.unit}</td>
                            <td>{row.openingQty}</td>
                            <td>{row.minStock}</td>
                            <td>
                              <div className="asset-row-actions">
                                <button
                                  className="btn-danger"
                                  disabled={!isAdmin}
                                  onClick={() => deleteInventoryItem(row)}
                                  title={t.delete}
                                >
                                  X
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={10}>No inventory items yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {!maintenanceQuickMode && inventoryView === "stock" && (
              <section className="panel">
                <h2>Stock In / Out</h2>
                <div className="form-grid">
                  <label className="field field-wide">
                    <span>Item</span>
                    <select className="input" value={inventoryTxnForm.itemId} onChange={(e) => setInventoryTxnForm((f) => ({ ...f, itemId: e.target.value }))}>
                      <option value="">Select item</option>
                      {inventoryVisibleItems
                        .slice()
                        .sort((a, b) => a.itemCode.localeCompare(b.itemCode))
                        .map((item) => (
                          <option key={`inv-tx-item-${item.id}`} value={String(item.id)}>{inventoryItemLabel(item)}</option>
                        ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>{t.date}</span>
                    <input className="input" type="date" value={inventoryTxnForm.date} onChange={(e) => setInventoryTxnForm((f) => ({ ...f, date: e.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Type</span>
                    <select className="input" value={inventoryTxnForm.type} onChange={(e) => setInventoryTxnForm((f) => ({ ...f, type: e.target.value as InventoryTxn["type"] }))}>
                      {INVENTORY_TXN_TYPE_OPTIONS.map((typeOption) => (
                        <option key={`inv-txn-type-${typeOption.value}`} value={typeOption.value}>
                          {typeOption.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Quantity</span>
                    <input className="input" type="number" min="0" value={inventoryTxnForm.qty} onChange={(e) => setInventoryTxnForm((f) => ({ ...f, qty: e.target.value }))} />
                  </label>
                  <label className="field">
                    <span>{t.by}</span>
                    <input className="input" value={inventoryTxnForm.by} onChange={(e) => setInventoryTxnForm((f) => ({ ...f, by: e.target.value }))} />
                  </label>
                  <label className="field field-wide">
                    <span>{t.notes}</span>
                    <input className="input" value={inventoryTxnForm.note} onChange={(e) => setInventoryTxnForm((f) => ({ ...f, note: e.target.value }))} />
                  </label>
                  {inventoryTxnIsBorrow ? (
                    <>
                      {inventoryTxnForm.type === "BORROW_IN" ? (
                        <label className="field">
                          <span>From Campus</span>
                          <select className="input" value={inventoryTxnForm.fromCampus} onChange={(e) => setInventoryTxnForm((f) => ({ ...f, fromCampus: e.target.value }))}>
                            <option value="">Select source campus</option>
                            {CAMPUS_LIST.filter((campus) => campus !== (inventoryTxnSelectedItem?.campus || "")).map((campus) => (
                              <option key={`inv-borrow-from-${campus}`} value={campus}>{campusLabel(campus)}</option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <label className="field">
                          <span>To Campus</span>
                          <select className="input" value={inventoryTxnForm.toCampus} onChange={(e) => setInventoryTxnForm((f) => ({ ...f, toCampus: e.target.value }))}>
                            <option value="">Select destination campus</option>
                            {CAMPUS_LIST.filter((campus) => campus !== (inventoryTxnSelectedItem?.campus || "")).map((campus) => (
                              <option key={`inv-borrow-to-${campus}`} value={campus}>{campusLabel(campus)}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      <label className="field">
                        <span>Requested By</span>
                        <input className="input" value={inventoryTxnForm.requestedBy} onChange={(e) => setInventoryTxnForm((f) => ({ ...f, requestedBy: e.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Approved By</span>
                        <input className="input" value={inventoryTxnForm.approvedBy} onChange={(e) => setInventoryTxnForm((f) => ({ ...f, approvedBy: e.target.value }))} />
                      </label>
                      {inventoryTxnForm.type === "BORROW_IN" ? (
                        <label className="field">
                          <span>Received By</span>
                          <input className="input" value={inventoryTxnForm.receivedBy} onChange={(e) => setInventoryTxnForm((f) => ({ ...f, receivedBy: e.target.value }))} />
                        </label>
                      ) : null}
                      {inventoryTxnForm.type === "BORROW_OUT" ? (
                        <label className="field">
                          <span>Expected Return Date</span>
                          <input className="input" type="date" value={inventoryTxnForm.expectedReturnDate} onChange={(e) => setInventoryTxnForm((f) => ({ ...f, expectedReturnDate: e.target.value }))} />
                        </label>
                      ) : null}
                    </>
                  ) : null}
                </div>
                <div className="asset-actions">
                  <div className="tiny">Track stock in/out and campus borrow flow in one register.</div>
                  <button className="btn-primary" disabled={!isAdmin} onClick={createInventoryTxn}>Save Transaction</button>
                </div>

                <div className="table-wrap" style={{ marginTop: 12 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>{t.date}</th>
                        <th>Item Code</th>
                        <th>Item Name</th>
                        <th>{t.campus}</th>
                        <th>Type</th>
                        <th>Qty</th>
                        <th>Borrow Details</th>
                        <th>{t.by}</th>
                        <th>{t.notes}</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryTxnsRows.length ? (
                        inventoryTxnsRows.map((row) => (
                          <tr key={`inv-tx-row-${row.id}`}>
                            {editingInventoryTxnId === row.id ? (
                              <>
                                <td>
                                  <input
                                    className="table-input"
                                    type="date"
                                    value={inventoryTxnEditForm.date}
                                    onChange={(e) => setInventoryTxnEditForm((f) => ({ ...f, date: e.target.value }))}
                                  />
                                </td>
                                <td>
                                  <select
                                    className="table-input"
                                    value={inventoryTxnEditForm.itemId}
                                    onChange={(e) => setInventoryTxnEditForm((f) => ({ ...f, itemId: e.target.value }))}
                                  >
                                    {inventoryVisibleItems
                                      .slice()
                                      .sort((a, b) => a.itemCode.localeCompare(b.itemCode))
                                      .map((item) => (
                                        <option key={`inv-tx-edit-item-${item.id}`} value={String(item.id)}>
                                          {item.itemCode}
                                        </option>
                                      ))}
                                  </select>
                                </td>
                                <td>
                                  {inventoryVisibleItems.find((i) => String(i.id) === inventoryTxnEditForm.itemId)?.itemName || "-"}
                                </td>
                                <td>
                                  {campusLabel(inventoryVisibleItems.find((i) => String(i.id) === inventoryTxnEditForm.itemId)?.campus || row.campus)}
                                </td>
                                <td>
                                  <select
                                    className="table-input"
                                    value={inventoryTxnEditForm.type}
                                    onChange={(e) => setInventoryTxnEditForm((f) => ({ ...f, type: e.target.value as InventoryTxn["type"] }))}
                                  >
                                    {INVENTORY_TXN_TYPE_OPTIONS.map((typeOption) => (
                                      <option key={`inv-edit-type-${typeOption.value}`} value={typeOption.value}>
                                        {typeOption.label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td>
                                  <input
                                    className="table-input"
                                    type="number"
                                    min="0"
                                    value={inventoryTxnEditForm.qty}
                                    onChange={(e) => setInventoryTxnEditForm((f) => ({ ...f, qty: e.target.value }))}
                                  />
                                </td>
                                <td>{row.borrowStatus || "-"}</td>
                                <td>
                                  <input
                                    className="table-input"
                                    value={inventoryTxnEditForm.by}
                                    onChange={(e) => setInventoryTxnEditForm((f) => ({ ...f, by: e.target.value }))}
                                  />
                                </td>
                                <td>
                                  <input
                                    className="table-input"
                                    value={inventoryTxnEditForm.note}
                                    onChange={(e) => setInventoryTxnEditForm((f) => ({ ...f, note: e.target.value }))}
                                  />
                                </td>
                                <td>
                                  <div className="asset-row-actions">
                                    <button className="btn-primary btn-small" disabled={!isAdmin} onClick={updateInventoryTxn}>
                                      Save
                                    </button>
                                    <button className="tab" onClick={cancelInventoryTxnEdit}>Cancel</button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td>{formatDate(row.date)}</td>
                                <td><strong>{row.itemCode}</strong></td>
                                <td>{row.itemName}</td>
                                <td>{inventoryCampusLabel(row.campus)}</td>
                                <td>{inventoryTxnTypeLabel(row.type)}</td>
                                <td>{row.qty}</td>
                                <td>
                                  {row.type === "BORROW_OUT" || row.type === "BORROW_CONSUME"
                                    ? `${inventoryCampusLabel(row.campus)} → ${inventoryCampusLabel(row.toCampus || "-")} (${row.borrowStatus || "-"})`
                                    : row.type === "BORROW_IN"
                                      ? `${inventoryCampusLabel(row.fromCampus || "-")} → ${inventoryCampusLabel(row.campus)} (${row.borrowStatus || "-"})`
                                      : "-"}
                                </td>
                                <td>{row.by || "-"}</td>
                                <td>{row.note || "-"}</td>
                                <td>
                                  <div className="asset-row-actions">
                                    <button className="btn-icon-edit" disabled={!isAdmin} onClick={() => startInventoryTxnEdit(row)} title="Edit">
                                      ✎
                                    </button>
                                    <button className="btn-danger" disabled={!isAdmin} onClick={() => deleteInventoryTxn(row)} title={t.delete}>
                                      X
                                    </button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={10}>No transactions yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {inventoryView === "daily" && (
              <section className="panel inventory-daily-panel">
                <div className="inventory-daily-head">
                  <h2>{lang === "km" ? "កត់ត្រាស្តុកប្រចាំថ្ងៃ (ងាយស្រួល)" : "Daily Stock Record (Simple)"}</h2>
                  <p className="tiny">
                    {lang === "km"
                      ? "សម្រាប់បុគ្គលិកថែទាំ កត់ត្រា IN / OUT តាមទូរស័ព្ទបានលឿន។"
                      : "Phone-friendly daily IN/OUT for maintenance staff."}
                  </p>
                </div>
                {(maintenanceQuickMode || isPhoneView) && inventoryDailyForm.type === "OUT" ? (
                  <article className="panel inventory-daily-gallery-panel">
                    <div className="panel-row">
                      <h3 className="section-title">{lang === "km" ? "ជ្រើសសម្ភារៈចេញស្តុកលឿន" : "Quick Stock-Out Gallery"}</h3>
                      <span className="tiny">{lang === "km" ? "ចុច Item ដើម្បីកត់ត្រាលឿន" : "Tap item to stock out quickly"}</span>
                    </div>
                    <div className="inventory-daily-gallery-grid">
                      {inventoryDailyOutGalleryItems.length ? (
                        inventoryDailyOutGalleryItems.map((item) => {
                          const currentStock = inventoryStockMap.get(item.id) || 0;
                          return (
                            <button
                              key={`daily-out-gallery-${item.id}`}
                              type="button"
                              className="inventory-daily-gallery-card"
                              onClick={() => openInventoryQuickOut(item)}
                            >
                              <span className="inventory-daily-gallery-icon" aria-hidden="true">
                                {inventorySupplyIcon(item.itemName)}
                              </span>
                              <span className="inventory-daily-gallery-name">{item.itemName}</span>
                              <span className="inventory-daily-gallery-meta">
                                {item.itemCode} | {inventoryCampusLabel(item.campus)} | Stock: {currentStock}
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <div className="tiny">No cleaning supply items found.</div>
                      )}
                    </div>
                  </article>
                ) : null}

                {!(((maintenanceQuickMode || isPhoneView) && inventoryDailyForm.type === "OUT")) ? (
                <div className="inventory-daily-grid">
                  <label className="field field-wide">
                    <span>{lang === "km" ? "ស្វែងរកសម្ភារៈ" : "Search Item"}</span>
                    <input
                      className="input"
                      placeholder={lang === "km" ? "ស្វែងរកកូដ ឬឈ្មោះ..." : "Search code or item name..."}
                      value={inventoryDailyForm.search}
                      onChange={(e) => setInventoryDailyForm((f) => ({ ...f, search: e.target.value }))}
                    />
                  </label>
                  <label className="field field-wide">
                    <span>{lang === "km" ? "ជ្រើសសម្ភារៈ" : "Select Item"}</span>
                    <select
                      className="input"
                      value={inventoryDailyForm.itemId}
                      onChange={(e) => setInventoryDailyForm((f) => ({ ...f, itemId: e.target.value }))}
                    >
                      <option value="">{lang === "km" ? "ជ្រើសសម្ភារៈ" : "Select item"}</option>
                      {inventoryDailyItemOptions.map((item) => (
                        <option key={`daily-inv-item-${item.id}`} value={String(item.id)}>
                          {inventoryItemLabel(item)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>{t.date}</span>
                    <input
                      className="input"
                      type="date"
                      value={inventoryDailyForm.date}
                      onChange={(e) => setInventoryDailyForm((f) => ({ ...f, date: e.target.value }))}
                    />
                  </label>
                  <label className="field">
                    <span>{lang === "km" ? "អ្នកកត់ត្រា" : "Recorded By"}</span>
                    <input
                      className="input"
                      value={inventoryDailyForm.by}
                      onChange={(e) => setInventoryDailyForm((f) => ({ ...f, by: e.target.value }))}
                      placeholder={lang === "km" ? "ឈ្មោះអ្នកកត់ត្រា" : "Staff name"}
                    />
                  </label>

                  <div className="field field-wide">
                    <span>{lang === "km" ? "ប្រភេទចលនា" : "Type"}</span>
                    <div className="inventory-daily-type-switch">
                      <button
                        type="button"
                        className={`tab ${inventoryDailyForm.type === "IN" ? "tab-active" : ""}`}
                        onClick={() => setInventoryDailyForm((f) => ({ ...f, type: "IN" }))}
                      >
                        {lang === "km" ? "ចូលស្តុក (IN)" : "Stock In"}
                      </button>
                      <button
                        type="button"
                        className={`tab ${inventoryDailyForm.type === "OUT" ? "tab-active" : ""}`}
                        onClick={() => setInventoryDailyForm((f) => ({ ...f, type: "OUT" }))}
                      >
                        {lang === "km" ? "ចេញស្តុក (OUT)" : "Stock Out"}
                      </button>
                    </div>
                  </div>

                  <label className="field">
                    <span>{lang === "km" ? "បរិមាណ" : "Quantity"}</span>
                    <input
                      className="input inventory-daily-qty-input"
                      type="number"
                      min="0"
                      value={inventoryDailyForm.qty}
                      onChange={(e) => setInventoryDailyForm((f) => ({ ...f, qty: e.target.value }))}
                    />
                    <div className="inventory-daily-qty-quick">
                      {[1, 5, 10].map((step) => (
                        <button
                          key={`daily-qty-step-${step}`}
                          type="button"
                          className="tab btn-small"
                          onClick={() =>
                            setInventoryDailyForm((f) => ({
                              ...f,
                              qty: String(Math.max(0, Number(f.qty || 0) + step)),
                            }))
                          }
                        >
                          +{step}
                        </button>
                      ))}
                    </div>
                  </label>
                  <label className="field field-wide">
                    <span>{t.notes}</span>
                    <input
                      className="input"
                      value={inventoryDailyForm.note}
                      onChange={(e) => setInventoryDailyForm((f) => ({ ...f, note: e.target.value }))}
                      placeholder={lang === "km" ? "ឧទាហរណ៍៖ ប្រើសម្រាប់ជួសជុលបន្ទប់..." : "Example: used for room maintenance..."}
                    />
                  </label>
                </div>
                ) : null}

                {!(((maintenanceQuickMode || isPhoneView) && inventoryDailyForm.type === "OUT")) && inventoryDailySelectedItem ? (
                  <div className="inventory-daily-stock-note">
                    <strong>{inventoryDailySelectedItem.itemCode}</strong> - {inventoryDailySelectedItem.itemName}
                    {" | "}
                    {lang === "km" ? "ស្តុកបច្ចុប្បន្ន" : "Current Stock"}: <strong>{inventoryStockMap.get(inventoryDailySelectedItem.id) || 0}</strong>
                    {" | "}
                    {lang === "km" ? "ស្តុកអប្បបរមា" : "Min Stock"}: <strong>{inventoryDailySelectedItem.minStock}</strong>
                  </div>
                ) : null}

                {!maintenanceQuickMode ? (
                <article className="panel inventory-usage-panel">
                  <div className="panel-row">
                    <h3 className="section-title">
                      {lang === "km" ? "ក្រាហ្វប្រើប្រាស់ប្រចាំថ្ងៃ (14 ថ្ងៃ)" : "Daily Usage Trend (14 days)"}
                    </h3>
                    <span className="tiny">
                      {inventoryDailySelectedItem
                        ? `${inventoryDailySelectedItem.itemCode} - ${inventoryDailySelectedItem.itemName}`
                        : (lang === "km" ? "Cleaning Supply ទាំងអស់" : "All Cleaning Supplies")}
                    </span>
                  </div>
                  <div className="inventory-usage-chart">
                    {inventoryDailyUsageTrend.rows.map((row) => {
                      const height = Math.max(8, Math.round((row.qty / inventoryDailyUsageTrend.max) * 100));
                      return (
                        <div key={`usage-day-${row.ymd}`} className="inventory-usage-col">
                          <div
                            className={`inventory-usage-bar ${row.holidayName ? "inventory-usage-bar-holiday" : row.isWeekend ? "inventory-usage-bar-weekend" : ""}`}
                            style={{ height: `${height}%` }}
                            title={`${row.ymd} | Used: ${row.qty}${row.holidayName ? ` | ${row.holidayName}` : ""}`}
                          />
                          <div className="inventory-usage-value">{row.qty}</div>
                          <div className={`inventory-usage-date ${row.holidayName ? "inventory-usage-date-holiday" : row.isWeekend ? "inventory-usage-date-weekend" : ""}`}>
                            {row.ymd.slice(5)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="tiny">
                    {lang === "km"
                      ? "OUT នៅថ្ងៃអាទិត្យ/ថ្ងៃឈប់សម្រាក ត្រូវបញ្ចូល Note ហើយបញ្ជាក់ម្តងទៀត។"
                      : "OUT on Sunday/holiday requires note and confirmation."}
                  </div>
                </article>
                ) : null}

                {!(((maintenanceQuickMode || isPhoneView) && inventoryDailyForm.type === "OUT")) ? (
                <div className="asset-actions">
                  <div className="tiny">
                    {lang === "km"
                      ? "ប្រព័ន្ធនឹងកត់ត្រាក្នុងប្រវត្តិ Stock In/Out ដោយស្វ័យប្រវត្តិ។"
                      : "Saved directly into Stock In/Out history."}
                  </div>
                  <button
                    className="btn-primary"
                    disabled={busy || !inventoryDailyForm.itemId || !inventoryDailyForm.qty || !inventoryDailyForm.date}
                    onClick={createInventoryDailyTxn}
                  >
                    {lang === "km" ? "រក្សាទុកប្រតិបត្តិការ" : "Save Daily Record"}
                  </button>
                </div>
                ) : null}

                {!maintenanceQuickMode ? (
                <article className="panel" style={{ marginTop: 12 }}>
                  <div className="panel-row">
                    <h3 className="section-title">{lang === "km" ? "សង្ខេបទិញសម្ភារៈ (ថ្ងៃ 27)" : "Purchase Summary (27th Cutoff)"}</h3>
                    <div className="row-actions">
                      <span className="tiny">{inventoryPurchaseWindow.label}</span>
                      <button type="button" className="tab btn-small" onClick={exportPurchaseRequestCsv}>
                        {lang === "km" ? "ទាញយក CSV" : "Export CSV"}
                      </button>
                      <button type="button" className="btn-primary btn-small" onClick={printPurchaseRequest}>
                        {lang === "km" ? "បោះពុម្ព/PDF" : "Print / PDF"}
                      </button>
                    </div>
                  </div>
                  <div className="tiny" style={{ marginBottom: 8 }}>
                    {lang === "km"
                      ? "ប្រើសម្រាប់រៀបចំសំណើទិញប្រចាំខែ (ពិនិត្យ Used Qty និង Suggested Qty)"
                      : "Use this on the 27th to prepare monthly purchase request."}
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Name</th>
                          <th>{t.campus}</th>
                          <th>{lang === "km" ? "ប្រើក្នុងរយៈពេល" : "Used Qty"}</th>
                          <th>{lang === "km" ? "ស្តុកបច្ចុប្បន្ន" : "Current"}</th>
                          <th>{lang === "km" ? "អប្បបរមា" : "Min"}</th>
                          <th>{lang === "km" ? "ស្នើទិញ" : "Suggested Qty"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventoryPurchaseRows.length ? (
                          inventoryPurchaseRows.map((row) => (
                            <tr key={`purchase-row-${row.id}`}>
                              <td><strong>{row.itemCode}</strong></td>
                              <td>{row.itemName}</td>
                              <td>{inventoryCampusLabel(row.campus)}</td>
                              <td>{row.usedQty}</td>
                              <td>{row.currentStock}</td>
                              <td>{row.minStock}</td>
                              <td><strong>{row.suggestedQty}</strong></td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7}>{lang === "km" ? "មិនមានទិន្នន័យសម្រាប់សំណើទិញ" : "No purchase summary rows."}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </article>
                ) : null}

                {!maintenanceQuickMode ? (
                <article className="panel" style={{ marginTop: 12 }}>
                  <div className="panel-row">
                    <h3 className="section-title">{lang === "km" ? "កំណត់ត្រាប្រចាំថ្ងៃ" : "Today Records"}</h3>
                    <span className="tiny">{formatDate(inventoryDailyForm.date)}</span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>{t.date}</th>
                          <th>Code</th>
                          <th>Name</th>
                          <th>Type</th>
                          <th>Qty</th>
                          <th>{t.by}</th>
                          <th>{t.notes}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventoryDailyTodayRows.length ? (
                          inventoryDailyTodayRows.map((row) => (
                            <tr key={`daily-row-${row.id}`}>
                              <td>{formatDate(row.date)}</td>
                              <td><strong>{row.itemCode}</strong></td>
                              <td>{row.itemName}</td>
                              <td>{inventoryTxnTypeLabel(row.type)}</td>
                              <td>{row.qty}</td>
                              <td>{row.by || "-"}</td>
                              <td>{row.note || "-"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7}>{lang === "km" ? "មិនទាន់មានកំណត់ត្រា" : "No records yet."}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </article>
                ) : null}
              </section>
            )}

            {!maintenanceQuickMode && inventoryView === "balance" && (
              <section className="panel" id="inventory-balance-section">
                <h2>Stock Balance & Low Stock Alerts</h2>
                <div className="stats-grid" style={{ marginBottom: 12 }}>
                  <button
                    type="button"
                    className={`stat-card stat-card-button ${inventoryBalanceMode === "all" ? "stat-card-selected" : ""}`}
                    onClick={() => setInventoryBalanceMode("all")}
                  >
                    <div className="stat-label">Total Inventory Items</div>
                    <div className="stat-value">{inventoryBalanceRows.length}</div>
                  </button>
                  <button
                    type="button"
                    className={`stat-card stat-card-button stat-card-overdue ${inventoryBalanceMode === "low" ? "stat-card-selected" : ""}`}
                    onClick={() => setInventoryBalanceMode("low")}
                  >
                    <div className="stat-label">Low Stock Alerts</div>
                    <div className="stat-value">{inventoryLowStockRows.length}</div>
                  </button>
                </div>
                <article className="panel inventory-supply-compare-panel" style={{ marginBottom: 12 }}>
                  <div className="panel-row inventory-supply-compare-head">
                    <h3 className="section-title">Monthly Cleaning Supplies Stock Out by Campus</h3>
                    <label className="field inventory-supply-month-field">
                      <span>Month</span>
                      <select
                        className="input"
                        value={inventorySupplyMonth}
                        onChange={(e) => setInventorySupplyMonth(e.target.value)}
                      >
                        {cleaningSupplyMonthlyOptions.map((month) => {
                          const label = new Date(`${month}-01T00:00:00`).toLocaleString(undefined, {
                            month: "long",
                            year: "numeric",
                          });
                          return (
                            <option key={`supply-month-${month}`} value={month}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                  </div>
                  {cleaningSupplyMonthlyCampusRows.rows.length ? (
                    <div className="inventory-supply-bars">
                      {cleaningSupplyMonthlyCampusRows.rows.map((row) => {
                        const percent = Math.max(
                          8,
                          Math.round((row.qty / cleaningSupplyMonthlyCampusRows.max) * 100)
                        );
                        return (
                          <div key={`supply-campus-${row.campus}`} className="inventory-supply-bar-row">
                            <div className="inventory-supply-bar-meta">
                              <strong>{inventoryCampusLabel(row.campus)}</strong>
                              <span>{row.qty}</span>
                            </div>
                            <div className="inventory-supply-bar-track">
                              <div className="inventory-supply-bar-fill" style={{ width: `${percent}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="tiny">No cleaning-supply stock-out data for this month.</p>
                  )}
                </article>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>{t.photo}</th>
                        <th>Name</th>
                        <th>Category</th>
                        <th>{t.campus}</th>
                        <th>{t.location}</th>
                        <th>Unit</th>
                        <th>Stock In</th>
                        <th>Stock Out</th>
                        <th>Current</th>
                        <th>Min</th>
                        <th>Alert</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryBalanceDisplayRows.length ? (
                        inventoryBalanceDisplayRows.map((row) => (
                          <tr key={`inv-balance-row-${row.id}`}>
                            <td><strong>{row.itemCode}</strong></td>
                            <td>{renderAssetPhoto(row.photo || "", row.itemCode)}</td>
                            <td>{row.itemName}</td>
                            <td>{row.category}</td>
                            <td>{inventoryCampusLabel(row.campus)}</td>
                            <td>{row.location}</td>
                            <td>{row.unit}</td>
                            <td>{row.stockIn}</td>
                            <td>{row.stockOut}</td>
                            <td><strong>{row.currentStock}</strong></td>
                            <td>{row.minStock}</td>
                            <td>{row.lowStock ? "Low" : "OK"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={12}>
                            {inventoryBalanceMode === "low" ? "No low stock alerts." : "No stock balance data."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}

        {tab === "schedule" && (
          <section className="panel">
            <div className="row-actions" style={{ marginBottom: 12 }}>
              <button
                className={`tab ${scheduleView === "calendar" ? "tab-active" : ""}`}
                onClick={() => setScheduleView("calendar")}
              >
                Eco Calendar View
              </button>
              <button
                className={`tab ${scheduleView === "bulk" ? "tab-active" : ""}`}
                onClick={() => setScheduleView("bulk")}
              >
                Bulk Campus
              </button>
              <button
                className={`tab ${scheduleView === "single" ? "tab-active" : ""}`}
                onClick={() => setScheduleView("single")}
              >
                By Asset
              </button>
            </div>

            {scheduleView === "bulk" && (
              <>
            <h3 className="section-title">Bulk Campus Schedule (Easy)</h3>
            <div className="form-grid">
              <label className="field">
                <span>{t.campus}</span>
                <select
                  className="input"
                  value={bulkScheduleForm.campus}
                  onChange={(e) => setBulkScheduleForm((f) => ({ ...f, campus: e.target.value }))}
                >
                  <option value="ALL">{t.allCampuses}</option>
                  {CAMPUS_LIST.map((campus) => (
                    <option key={`bulk-campus-${campus}`} value={campus}>
                      {campusLabel(campus)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t.category}</span>
                <select
                  className="input"
                  value={bulkScheduleForm.category}
                  onChange={(e) => {
                    const category = e.target.value;
                    const firstType = (allTypeOptions[category] || [])[0]?.code || "";
                    setBulkScheduleForm((f) => ({ ...f, category, type: firstType }));
                  }}
                >
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={`bulk-cat-${cat.value}`} value={cat.value}>
                      {lang === "km" ? cat.km : cat.en}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Item Type</span>
                <select
                  className="input"
                  value={bulkScheduleForm.type}
                  onChange={(e) => setBulkScheduleForm((f) => ({ ...f, type: e.target.value }))}
                >
                  {(allTypeOptions[bulkScheduleForm.category] || []).map((item) => (
                    <option key={`bulk-type-${bulkScheduleForm.category}-${item.code}`} value={item.code}>
                      {assetItemName(bulkScheduleForm.category, item.code)} ({item.code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Next Maintenance Date</span>
                <input
                  type="date"
                  className="input"
                  min={todayYmd}
                  value={bulkScheduleForm.date}
                  onChange={(e) => setBulkScheduleForm((f) => ({ ...f, date: e.target.value }))}
                  disabled={bulkScheduleForm.repeatMode === "MONTHLY_WEEKDAY"}
                />
              </label>
              <label className="field">
                <span>Repeat</span>
                <select
                  className="input"
                  value={bulkScheduleForm.repeatMode}
                  onChange={(e) =>
                    setBulkScheduleForm((f) => ({
                      ...f,
                      repeatMode: e.target.value as "NONE" | "MONTHLY_WEEKDAY",
                    }))
                  }
                >
                  <option value="NONE">No repeat (one date)</option>
                  <option value="MONTHLY_WEEKDAY">
                    {monthlyRepeatLabel(bulkScheduleForm.repeatWeekOfMonth, bulkScheduleForm.repeatWeekday)}
                  </option>
                </select>
              </label>
              <label className="field">
                <span>Week of Month</span>
                <select
                  className="input"
                  value={bulkScheduleForm.repeatWeekOfMonth}
                  onChange={(e) =>
                    setBulkScheduleForm((f) => ({ ...f, repeatWeekOfMonth: Number(e.target.value) }))
                  }
                  disabled={bulkScheduleForm.repeatMode !== "MONTHLY_WEEKDAY"}
                >
                  <option value={1}>Week 1</option>
                  <option value={2}>Week 2</option>
                  <option value={3}>Week 3</option>
                  <option value={4}>Week 4</option>
                  <option value={5}>Week 5</option>
                </select>
              </label>
              <label className="field">
                <span>Weekday</span>
                <select
                  className="input"
                  value={bulkScheduleForm.repeatWeekday}
                  onChange={(e) =>
                    setBulkScheduleForm((f) => ({ ...f, repeatWeekday: Number(e.target.value) }))
                  }
                  disabled={bulkScheduleForm.repeatMode !== "MONTHLY_WEEKDAY"}
                >
                  <option value={0}>Sunday</option>
                  <option value={1}>Monday</option>
                  <option value={2}>Tuesday</option>
                  <option value={3}>Wednesday</option>
                  <option value={4}>Thursday</option>
                  <option value={5}>Friday</option>
                  <option value={6}>Saturday</option>
                </select>
              </label>
              <label className="field field-wide">
                <span>Schedule Note</span>
                <input
                  className="input"
                  value={bulkScheduleForm.note}
                  onChange={(e) => setBulkScheduleForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="Example: FE monthly same-day by campus"
                />
              </label>
            </div>
            <div className="asset-actions">
              <div className="tiny">
                Apply one date/rule to all matched assets in selected campus + item type (example: all FE on same day).
              </div>
              <button
                className="btn-primary"
                disabled={busy || !isAdmin || !bulkScheduleForm.type || (bulkScheduleForm.repeatMode === "NONE" && !bulkScheduleForm.date)}
                onClick={saveBulkMaintenanceSchedule}
              >
                Apply Bulk Schedule
              </button>
            </div>
              </>
            )}

            {scheduleView === "single" && (
              <>
            <h3 className="section-title">Fill Maintenance Schedule</h3>
            <div className="form-grid">
              <label className="field field-wide">
                <span>Asset</span>
                <AssetPicker
                  value={scheduleForm.assetId}
                  assets={scheduleSelectAssets}
                  getLabel={(asset) => `${asset.assetId} - ${assetItemName(asset.category, asset.type, asset.pcType || "")} (${asset.type})`}
                  onChange={(assetId) => {
                    const asset = assets.find((a) => String(a.id) === assetId);
                    setScheduleForm((f) => ({
                      ...f,
                      assetId,
                      date: asset?.nextMaintenanceDate || "",
                      note: asset?.scheduleNote || "",
                      repeatMode: asset?.repeatMode || "NONE",
                      repeatWeekOfMonth: Number(asset?.repeatWeekOfMonth || 1),
                      repeatWeekday: Number(asset?.repeatWeekday || 6),
                    }));
                  }}
                />
              </label>
              <label className="field">
                <span>Next Maintenance Date</span>
                <input
                  type="date"
                  className="input"
                  min={todayYmd}
                  value={scheduleForm.date}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, date: e.target.value }))}
                  disabled={scheduleForm.repeatMode === "MONTHLY_WEEKDAY"}
                />
              </label>
              <label className="field">
                <span>Repeat</span>
                <select
                  className="input"
                  value={scheduleForm.repeatMode}
                  onChange={(e) =>
                    setScheduleForm((f) => ({
                      ...f,
                      repeatMode: e.target.value as "NONE" | "MONTHLY_WEEKDAY",
                    }))
                  }
                >
                  <option value="NONE">No repeat (one date)</option>
                  <option value="MONTHLY_WEEKDAY">
                    {monthlyRepeatLabel(scheduleForm.repeatWeekOfMonth, scheduleForm.repeatWeekday)}
                  </option>
                </select>
              </label>
              <label className="field">
                <span>Week of Month</span>
                <select
                  className="input"
                  value={scheduleForm.repeatWeekOfMonth}
                  onChange={(e) =>
                    setScheduleForm((f) => ({ ...f, repeatWeekOfMonth: Number(e.target.value) }))
                  }
                  disabled={scheduleForm.repeatMode !== "MONTHLY_WEEKDAY"}
                >
                  <option value={1}>Week 1</option>
                  <option value={2}>Week 2</option>
                  <option value={3}>Week 3</option>
                  <option value={4}>Week 4</option>
                  <option value={5}>Week 5</option>
                </select>
              </label>
              <label className="field">
                <span>Weekday</span>
                <select
                  className="input"
                  value={scheduleForm.repeatWeekday}
                  onChange={(e) =>
                    setScheduleForm((f) => ({ ...f, repeatWeekday: Number(e.target.value) }))
                  }
                  disabled={scheduleForm.repeatMode !== "MONTHLY_WEEKDAY"}
                >
                  <option value={0}>Sunday</option>
                  <option value={1}>Monday</option>
                  <option value={2}>Tuesday</option>
                  <option value={3}>Wednesday</option>
                  <option value={4}>Thursday</option>
                  <option value={5}>Friday</option>
                  <option value={6}>Saturday</option>
                </select>
              </label>
              <label className="field field-wide">
                <span>Schedule Note</span>
                <input
                  className="input"
                  value={scheduleForm.note}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="Example: Monthly preventive maintenance"
                />
              </label>
            </div>
            <div className="asset-actions">
              <div className="tiny">
                Use this to plan next maintenance date, or set repeat pattern (example: Week 1 + Saturday).
              </div>
              <button
                className="btn-primary"
                disabled={
                  busy ||
                  !scheduleForm.assetId
                }
                onClick={saveMaintenanceSchedule}
              >
                Save Schedule
              </button>
            </div>
              </>
            )}

            {scheduleView === "calendar" && (
              <>
            <h3 className="section-title">Interactive Maintenance Calendar</h3>
            <p className="tiny">{lang === "km" ? "ចុចថ្ងៃណាមួយ ដើម្បីបង្កើតកាលវិភាគបានភ្លាមៗ។" : "Click any day to create schedule directly."}</p>
            <div className="panel">
              <div className="panel-row calendar-nav-line">
                <button
                  className="tab"
                  aria-label="Previous month"
                  title="Previous month"
                  onClick={() =>
                    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                  }
                >
                  {calendarPrevLabel}
                </button>
                <strong>
                  {calendarMonth.toLocaleString(undefined, {
                    month: "long",
                    year: "numeric",
                  })}
                </strong>
                <button
                  className="tab"
                  aria-label="Next month"
                  title="Next month"
                  onClick={() =>
                    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                  }
                >
                  {calendarNextLabel}
                </button>
              </div>
              <div className="calendar-grid">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, idx) => (
                  <div key={d} className={`calendar-day calendar-head ${idx === 0 || idx === 6 ? "calendar-head-weekend" : ""}`}>{d}</div>
                ))}
                {calendarGridDays.map((d) => (
                  <button
                    key={d.ymd}
                    className={`calendar-day ${d.inMonth ? "" : "calendar-out"} ${d.hasItems ? "calendar-has" : ""} ${selectedCalendarDate === d.ymd ? "calendar-selected" : ""} ${d.ymd === todayYmd ? "calendar-today" : ""} ${d.weekday === 0 || d.weekday === 6 ? "calendar-weekend" : ""} ${d.holidayName ? "calendar-holiday" : ""} ${d.holidayType ? `calendar-holiday-${d.holidayType}` : ""} ${d.weekday <= 1 ? "calendar-popup-left" : d.weekday >= 5 ? "calendar-popup-right" : ""}`}
                    onClick={() => openQuickScheduleCreate(d.ymd)}
                  >
                    <span>{d.day}</span>
                    {d.hasItems ? <small>{(scheduleByDate.get(d.ymd) || []).length}</small> : null}
                    {d.holidayName ? <div className="calendar-hover-popup">{d.holidayName}</div> : null}
                  </button>
                ))}
              </div>
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>{t.assetId}</th>
                      <th>{t.photo}</th>
                      <th>{t.campus}</th>
                      <th>{t.status}</th>
                      <th>Schedule Note</th>
                      <th>{t.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDateItems.length ? (
                      selectedDateItems.map((asset) => (
                        <tr key={`selected-${asset.id}`}>
                          <td>{formatDate(asset.nextMaintenanceDate || "-")}</td>
                          <td>
                            <button
                              className="tab btn-small"
                              disabled={!canAccessMenu("maintenance.record", "maintenance")}
                              onClick={() => openMaintenanceRecordFromScheduleAsset(asset, selectedCalendarDate)}
                            >
                              <strong>{asset.assetId}</strong>
                            </button>
                          </td>
                          <td>{renderAssetPhoto(asset.photo || "", asset.assetId)}</td>
                          <td>{campusLabel(asset.campus)}</td>
                          <td>{assetStatusLabel(asset.status)}</td>
                          <td>{asset.scheduleNote || "-"}</td>
                          <td>
                            <div className="row-actions">
                              <button
                                className="btn-primary btn-small"
                                disabled={!canAccessMenu("maintenance.record", "maintenance")}
                                onClick={() => openMaintenanceRecordFromScheduleAsset(asset, selectedCalendarDate)}
                              >
                                Record
                              </button>
                              <button
                                className="tab btn-small"
                                disabled={!isAdmin}
                                onClick={() => editScheduleForAsset(asset)}
                              >
                                {t.edit}
                              </button>
                              <button
                                className="btn-danger"
                                disabled={!isAdmin || busy}
                                onClick={() => clearScheduleForAsset(asset.id)}
                                title={t.delete}
                              >
                                X
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7}>No schedule on {selectedCalendarDate}.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <h4 className="section-title" style={{ marginTop: 12 }}>
                {lang === "km" ? "បញ្ជីកាលវិភាគទាំងអស់" : "All Scheduled List"}
              </h4>
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table>
                  <thead>
                    <tr>
                      <th>{t.assetId}</th>
                      <th>{t.name}</th>
                      <th>{t.campus}</th>
                      <th>{t.location}</th>
                      <th>{t.date}</th>
                      <th>{lang === "km" ? "របៀប" : "Mode"}</th>
                      <th>{t.scheduleNote}</th>
                      <th>{t.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleListRows.length ? (
                      scheduleListRows.map((asset) => (
                        <tr key={`schedule-list-row-${asset.id}`}>
                          <td><strong>{asset.assetId}</strong></td>
                          <td>{assetItemName(asset.category, asset.type, asset.pcType || "")}</td>
                          <td>{campusLabel(asset.campus)}</td>
                          <td>{asset.location || "-"}</td>
                          <td>{formatDate(asset.nextMaintenanceDate || "-")}</td>
                          <td>
                            {asset.repeatMode === "MONTHLY_WEEKDAY"
                              ? monthlyRepeatLabel(Number(asset.repeatWeekOfMonth || 1), Number(asset.repeatWeekday || 6))
                              : "Does not repeat"}
                          </td>
                          <td>{asset.scheduleNote || "-"}</td>
                          <td>
                            <div className="row-actions">
                              <button
                                className="tab btn-small"
                                disabled={!isAdmin}
                                onClick={() => handleScheduleRowAction(asset, "edit")}
                              >
                                {t.edit}
                              </button>
                              <button
                                className="btn-danger"
                                disabled={!isAdmin || busy}
                                onClick={() => {
                                  void handleScheduleRowAction(asset, "delete");
                                }}
                                title={t.delete}
                              >
                                X
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8}>{lang === "km" ? "មិនមានកាលវិភាគ" : "No schedules found."}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
              </>
            )}
          </section>
        )}

        {tab === "transfer" && (
          <section className="panel">
            <div className="tabs">
              <button
                className={`tab ${transferView === "history" ? "tab-active" : ""}`}
                onClick={() => setTransferView("history")}
              >
                History View
              </button>
              <button
                className={`tab ${transferView === "record" ? "tab-active" : ""}`}
                onClick={() => setTransferView("record")}
              >
                Record Transfer
              </button>
            </div>

            {transferView === "record" && (
              <>
            <h3 className="section-title">Asset Transfer</h3>
            <div className="form-grid">
              <label className="field">
                <span>{t.campus}</span>
                <select
                  className="input"
                  value={transferFilterCampus}
                  onChange={(e) => {
                    setTransferFilterCampus(e.target.value);
                    setTransferFilterLocation("ALL");
                    setTransferFilterCategory("ALL");
                    setTransferFilterName("ALL");
                  }}
                >
                  <option value="ALL">{t.allCampuses}</option>
                  {transferFilterCampusOptions.map((campus) => (
                    <option key={`transfer-filter-campus-${campus}`} value={campus}>
                      {campusLabel(campus)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t.location}</span>
                <select
                  className="input"
                  value={transferFilterLocation}
                  onChange={(e) => {
                    setTransferFilterLocation(e.target.value);
                    setTransferFilterCategory("ALL");
                    setTransferFilterName("ALL");
                  }}
                >
                  <option value="ALL">{lang === "km" ? "ទីតាំងទាំងអស់" : "All Locations"}</option>
                  {transferFilterLocationOptions.map((location) => (
                    <option key={`transfer-filter-location-${location}`} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t.category}</span>
                <select
                  className="input"
                  value={transferFilterCategory}
                  onChange={(e) => {
                    setTransferFilterCategory(e.target.value);
                    setTransferFilterName("ALL");
                  }}
                >
                  <option value="ALL">{t.allCategories}</option>
                  {transferFilterCategoryOptions.map((category) => (
                    <option key={`transfer-filter-category-${category}`} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t.name}</span>
                <select
                  className="input"
                  value={transferFilterName}
                  onChange={(e) => setTransferFilterName(e.target.value)}
                >
                  <option value="ALL">{lang === "km" ? "ឈ្មោះទាំងអស់" : "All Names"}</option>
                  {transferFilterNameOptions.map((name) => (
                    <option key={`transfer-filter-name-${name}`} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Asset</span>
                {showTransferAssetPicker || !transferAsset ? (
                  <AssetPicker
                    value={transferForm.assetId}
                    assets={transferFilteredAssets}
                    getLabel={(asset) => `${asset.assetId} - ${assetItemName(asset.category, asset.type, asset.pcType || "")} • ${campusLabel(asset.campus)}`}
                    onChange={(assetId) => {
                      const asset = transferFilteredAssets.find((a) => String(a.id) === assetId) || assets.find((a) => String(a.id) === assetId);
                      setTransferForm((f) => ({
                        ...f,
                        assetId,
                        toCampus: asset?.campus || f.toCampus,
                        toLocation: asset?.location || "",
                        toAssignedTo: asset?.assignedTo || "",
                        responsibilityConfirmed: false,
                        returnConfirmed: false,
                      }));
                      setShowTransferAssetPicker(false);
                    }}
                    placeholder={lang === "km" ? "ជ្រើស Asset តាមតម្រង" : "Select filtered asset"}
                    disabled={!transferFilteredAssets.length}
                  />
                ) : (
                  <div className="detail-value transfer-selected-value">
                    <span className="asset-picker-selected">
                      {transferAsset.photo ? (
                        <img src={transferAsset.photo} alt={transferAsset.assetId} className="asset-picker-thumb" />
                      ) : (
                        <span className="asset-picker-thumb-empty">-</span>
                      )}
                      <span>
                        {transferAsset.assetId} - {assetItemName(transferAsset.category, transferAsset.type, transferAsset.pcType || "")} •{" "}
                        {campusLabel(transferAsset.campus)}
                      </span>
                    </span>
                    <button type="button" className="tab" onClick={() => setShowTransferAssetPicker(true)}>
                      Change
                    </button>
                  </div>
                )}
                <div className="tiny">
                  {transferFilteredAssets.length
                    ? lang === "km"
                      ? `${transferFilteredAssets.length} assets ត្រូវតាមតម្រងបច្ចុប្បន្ន`
                      : `${transferFilteredAssets.length} assets match current filters`
                    : lang === "km"
                    ? "មិនមាន assets ត្រូវតាមតម្រងបច្ចុប្បន្ន។"
                    : "No assets match current filters."}
                </div>
              </label>
              <label className="field field-wide">
                <span>{lang === "km" ? "រូបភាព Asset ដែលបានជ្រើស" : "Selected Asset Photo"}</span>
                <div className="transfer-preview">
                  <div className="transfer-preview-photo">
                    {transferAsset?.photo ? (
                      <img src={transferAsset.photo} alt={transferAsset.assetId} className="asset-picker-thumb" />
                    ) : (
                      <span className="asset-picker-thumb-empty">-</span>
                    )}
                  </div>
                  <div className="transfer-preview-meta">
                    <strong>
                      {transferAsset
                        ? `${transferAsset.assetId} - ${assetItemName(transferAsset.category, transferAsset.type, transferAsset.pcType || "")}`
                        : "-"}
                    </strong>
                    <span>
                      {transferAsset
                        ? `${CAMPUS_CODE[transferAsset.campus] || "CX"} • ${transferAsset.location || "-"}`
                        : "-"}
                    </span>
                    <span>{transferAsset?.assignedTo || "Unassigned / In Stock"}</span>
                  </div>
                </div>
              </label>
              <label className="field">
                <span>Transfer Date</span>
                <input
                  type="date"
                  className="input"
                  value={transferForm.date}
                  onChange={(e) => setTransferForm((f) => ({ ...f, date: e.target.value }))}
                />
              </label>
              <label className="field">
                <span>From Campus</span>
                <input className="input" value={transferAsset ? campusLabel(transferAsset.campus) : "-"} readOnly />
              </label>
              <label className="field">
                <span>From Location</span>
                <input className="input" value={transferAsset?.location || "-"} readOnly />
              </label>
              <label className="field">
                <span>Current Staff</span>
                <input className="input" value={transferAsset?.assignedTo || "-"} readOnly />
              </label>
              <label className="field">
                <span>To Campus</span>
                <select
                  className="input"
                  value={transferForm.toCampus}
                  onChange={(e) =>
                    setTransferForm((f) => ({
                      ...f,
                      toCampus: e.target.value,
                      toLocation: "",
                    }))
                  }
                >
                  {CAMPUS_LIST.map((campus) => (
                    <option key={`to-campus-${campus}`} value={campus}>
                      {campusLabel(campus)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>To Location</span>
                <select
                  className="input"
                  value={transferForm.toLocation}
                  onChange={(e) => setTransferForm((f) => ({ ...f, toLocation: e.target.value }))}
                >
                  <option value="">Select location</option>
                  {transferLocationOptions.map((loc) => (
                    <option key={`to-location-${loc.id}`} value={loc.name}>{loc.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Assign To Staff</span>
                <select
                  className="input"
                  value={transferForm.toAssignedTo}
                  onChange={(e) =>
                    setTransferForm((f) => ({
                      ...f,
                      toAssignedTo: e.target.value,
                      responsibilityConfirmed: false,
                      returnConfirmed: false,
                    }))
                  }
                >
                  <option value="">Unassigned / In Stock</option>
                  {users.map((u) => (
                    <option key={`transfer-user-${u.id}`} value={u.fullName}>
                      {u.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field check-field">
                <span>Staff responsibility confirm</span>
                <input
                  type="checkbox"
                  checked={transferForm.responsibilityConfirmed}
                  onChange={(e) => setTransferForm((f) => ({ ...f, responsibilityConfirmed: e.target.checked }))}
                />
              </label>
              <label className="field check-field">
                <span>Previous holder returned item</span>
                <input
                  type="checkbox"
                  checked={transferForm.returnConfirmed}
                  onChange={(e) => setTransferForm((f) => ({ ...f, returnConfirmed: e.target.checked }))}
                />
              </label>
              <label className="field">
                <span>Reason</span>
                <input
                  className="input"
                  value={transferForm.reason}
                  onChange={(e) => setTransferForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="Example: Room move / Campus reallocation"
                />
              </label>
              <label className="field">
                <span>By</span>
                <input
                  className="input"
                  value={transferForm.by}
                  onChange={(e) => setTransferForm((f) => ({ ...f, by: e.target.value }))}
                />
              </label>
              <label className="field field-wide">
                <span>Note</span>
                <textarea
                  className="textarea"
                  value={transferForm.note}
                  onChange={(e) => setTransferForm((f) => ({ ...f, note: e.target.value }))}
                />
              </label>
            </div>
            <div className="asset-actions">
              <div className="tiny">Transfer updates campus/location, assignee, transfer history, and custody accountability log.</div>
              <button
                className="btn-primary"
                disabled={busy || !isAdmin || !transferForm.assetId || !transferForm.toCampus || !transferForm.toLocation}
                onClick={() => {
                  void submitAssetTransfer();
                }}
              >
                Save Transfer
              </button>
            </div>
              </>
            )}

            {transferView === "history" && (
              <>
            <h3 className="section-title">Transfer History</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t.date}</th>
                    <th>{t.assetId}</th>
                    <th>From Campus</th>
                    <th>From Location</th>
                    <th>To Campus</th>
                    <th>To Location</th>
                    <th>From Staff</th>
                    <th>To Staff</th>
                    <th>Ack</th>
                    <th>By</th>
                    <th>Reason</th>
                    <th>{t.notes}</th>
                  </tr>
                </thead>
                <tbody>
                  {allTransferRows.length ? (
                    allTransferRows.map((row) => (
                      <tr key={`transfer-history-tab-${row.rowId}`}>
                        <td>{formatDate(row.date || "-")}</td>
                        <td><strong>{row.assetId}</strong></td>
                        <td>{campusLabel(row.fromCampus)}</td>
                        <td>{row.fromLocation || "-"}</td>
                        <td>{campusLabel(row.toCampus)}</td>
                        <td>{row.toLocation || "-"}</td>
                        <td>{row.fromUser || "-"}</td>
                        <td>{row.toUser || "-"}</td>
                        <td>{row.responsibilityAck}</td>
                        <td>{row.by || "-"}</td>
                        <td>{row.reason || "-"}</td>
                        <td>{row.note || "-"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={12}>No transfer history yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
              </>
            )}
          </section>
        )}

        {tab === "maintenance" && (
          <>
          <section className="panel">
            <div className="tabs">
              {(canAccessMenu("maintenance.history", "maintenance") || canAccessMenu("maintenance.record", "maintenance")) ? (
                <button
                  className={`tab ${maintenanceView === "dashboard" ? "tab-active" : ""}`}
                  onClick={() => setMaintenanceView("dashboard")}
                >
                  {lang === "km" ? "ផ្ទាំងថែទាំ" : "Maintenance Dashboard"}
                </button>
              ) : null}
              {canAccessMenu("maintenance.history", "maintenance") ? (
                <button
                  className={`tab ${maintenanceView === "history" ? "tab-active" : ""}`}
                  onClick={() => setMaintenanceView("history")}
                >
                  {lang === "km" ? "មើលប្រវត្តិ" : "History View"}
                </button>
              ) : null}
              {canAccessMenu("maintenance.record", "maintenance") ? (
                <button
                  className={`tab ${maintenanceView === "record" ? "tab-active" : ""}`}
                  onClick={() => {
                    setMaintenanceRecordScheduleJumpMode(false);
                    setMaintenanceView("record");
                  }}
                >
                  {lang === "km" ? "កត់ត្រាថែទាំ" : "Record History"}
                </button>
              ) : null}
            </div>

            {maintenanceView === "dashboard" && (canAccessMenu("maintenance.history", "maintenance") || canAccessMenu("maintenance.record", "maintenance")) && (
            <>
            <h3 className="section-title">{lang === "km" ? "ផ្ទាំងសង្ខេបថែទាំ" : "Maintenance Dashboard"}</h3>
            <div className="stats-grid">
              <button
                type="button"
                className={`stat-card stat-card-button ${maintenanceDashboardModal === "overdue" ? "stat-card-selected" : ""}`}
                onClick={() => setMaintenanceDashboardModal("overdue")}
              >
                <div className="stat-label">{lang === "km" ? "លើសកាលកំណត់" : "Overdue"}</div>
                <div className="stat-value">{maintenanceDashboardSummary.overdue}</div>
              </button>
              <button
                type="button"
                className={`stat-card stat-card-button ${maintenanceDashboardModal === "upcoming" ? "stat-card-selected" : ""}`}
                onClick={() => setMaintenanceDashboardModal("upcoming")}
              >
                <div className="stat-label">{lang === "km" ? "7 ថ្ងៃបន្ទាប់" : "Next 7 Days"}</div>
                <div className="stat-value">{maintenanceDashboardSummary.upcoming}</div>
              </button>
              <button
                type="button"
                className={`stat-card stat-card-button ${maintenanceDashboardModal === "scheduled" ? "stat-card-selected" : ""}`}
                onClick={() => setMaintenanceDashboardModal("scheduled")}
              >
                <div className="stat-label">{lang === "km" ? "កាលវិភាគសរុប" : "Scheduled"}</div>
                <div className="stat-value">{maintenanceDashboardSummary.scheduled}</div>
              </button>
              <button
                type="button"
                className={`stat-card stat-card-button ${maintenanceDashboardModal === "done" ? "stat-card-selected" : ""}`}
                onClick={() => setMaintenanceDashboardModal("done")}
              >
                <div className="stat-label">{lang === "km" ? "កំណត់ត្រា Done" : "Done Records"}</div>
                <div className="stat-value">{maintenanceDashboardSummary.done}</div>
              </button>
            </div>

            <div className="panel" style={{ marginTop: 12 }}>
              <div className="panel-row">
                <h3 className="section-title">Maintenance Calendar</h3>
                <div className="row-actions calendar-nav-row">
                  <button
                    className="tab"
                    aria-label="Previous month"
                    title="Previous month"
                    onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                  >
                    {calendarPrevLabel}
                  </button>
                  <strong>{calendarMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}</strong>
                  <button
                    className="tab"
                    aria-label="Next month"
                    title="Next month"
                    onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                  >
                    {calendarNextLabel}
                  </button>
                </div>
              </div>
              <div className="calendar-grid">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, idx) => (
                  <div key={`maintenance-dashboard-head-${d}`} className={`calendar-day calendar-head ${idx === 0 || idx === 6 ? "calendar-head-weekend" : ""}`}>{d}</div>
                ))}
                {calendarGridDays.map((d) => (
                  <button
                    key={`maintenance-dashboard-day-${d.ymd}`}
                    className={`calendar-day ${d.inMonth ? "" : "calendar-out"} ${d.hasItems ? "calendar-has" : ""} ${selectedCalendarDate === d.ymd ? "calendar-selected" : ""} ${d.ymd === todayYmd ? "calendar-today" : ""} ${d.weekday === 0 || d.weekday === 6 ? "calendar-weekend" : ""} ${d.holidayName ? "calendar-holiday" : ""} ${d.holidayType ? `calendar-holiday-${d.holidayType}` : ""} ${d.weekday <= 1 ? "calendar-popup-left" : d.weekday >= 5 ? "calendar-popup-right" : ""}`}
                    onClick={() => setSelectedCalendarDate(d.ymd)}
                  >
                    <span>{d.day}</span>
                    {d.hasItems ? <small>{(scheduleByDate.get(d.ymd) || []).length}</small> : null}
                    {d.holidayName ? <div className="calendar-hover-popup">{d.holidayName}</div> : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="panel" style={{ marginTop: 12 }}>
              <h3 className="section-title">{lang === "km" ? "កំណត់ត្រាថែទាំចុងក្រោយ (5)" : "Latest Maintenance (Last 5)"}</h3>
              <div className="table-wrap">
                <table className="latest-maint-table">
                  <thead>
                    <tr>
                      <th>{t.date}</th>
                      <th>{lang === "km" ? "Asset" : "Asset"}</th>
                      <th>{lang === "km" ? "Campus Code" : "Campus Code"}</th>
                      <th>{lang === "km" ? "ប្រភេទថែទាំ" : "Maintenance Type"}</th>
                      <th>{lang === "km" ? "ការងារធ្វើ" : "Work Detail"}</th>
                      <th>{lang === "km" ? "ស្ថានភាពការងារ" : "Work Status"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestMaintenanceRows.length ? (
                      latestMaintenanceRows.map((row) => (
                        <tr
                          key={`maintenance-dashboard-latest-${row.rowId}`}
                          className="latest-maint-row"
                          onClick={() => setLatestMaintenanceDetailRowId(row.rowId)}
                        >
                          <td>{formatDate(row.date || "-")}</td>
                          <td className="latest-maint-asset-cell">
                            <strong>{row.assetId}</strong>
                            <div className="tiny">{assetItemName(row.category, row.assetType || "", "")}</div>
                          </td>
                          <td><strong>{CAMPUS_CODE[row.campus] || "CX"}</strong></td>
                          <td>{row.type || "-"}</td>
                          <td title={row.note || row.condition || "-"}>
                            <span className="latest-maint-work">{row.note || row.condition || "-"}</span>
                          </td>
                          <td>{row.completion || "-"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6}>No maintenance records yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel" style={{ marginTop: 12 }}>
              <h3 className="section-title">{lang === "km" ? "របាយការណ៍ថែទាំ" : "Maintenance Report"}</h3>
              <div className="tiny" style={{ marginBottom: 8 }}>
                {lang === "km"
                  ? `សរុប: ${maintenanceDashboardSummary.total} | Done: ${maintenanceDashboardSummary.done} | Not Yet: ${maintenanceDashboardSummary.notYet}`
                  : `Total: ${maintenanceDashboardSummary.total} | Done: ${maintenanceDashboardSummary.done} | Not Yet: ${maintenanceDashboardSummary.notYet}`}
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{lang === "km" ? "ប្រភេទថែទាំ" : "Maintenance Type"}</th>
                      <th>Done</th>
                      <th>Not Yet</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {maintenanceTypeReportRows.length ? (
                      maintenanceTypeReportRows.map((row) => (
                        <tr key={`maintenance-type-report-${row.type}`}>
                          <td>{row.type}</td>
                          <td>{row.done}</td>
                          <td>{row.notYet}</td>
                          <td><strong>{row.total}</strong></td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4}>No maintenance report data.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel" style={{ marginTop: 12 }}>
              <h3 className="section-title">{lang === "km" ? "អត្រាបញ្ចប់តាម Campus" : "Maintenance Completion by Campus"}</h3>
              <div className="maintenance-campus-chart">
                {maintenanceCompletionByCampusRows.length ? (
                  maintenanceCompletionByCampusRows.map((row) => (
                    <div key={`maintenance-campus-chart-${row.campus}`} className="maintenance-campus-row">
                      <div className="maintenance-campus-label">{campusLabel(row.campus)}</div>
                      <div className="maintenance-campus-bar-wrap">
                        <div className="maintenance-campus-bar-fill" style={{ width: `${row.rate}%` }} />
                      </div>
                      <div className="maintenance-campus-value">{row.rate}% ({row.done}/{row.total})</div>
                    </div>
                  ))
                ) : (
                  <div className="tiny">No campus completion data.</div>
                )}
              </div>
            </div>
            </>
            )}

            {maintenanceView === "record" && canAccessMenu("maintenance.record", "maintenance") && (
            <>
            <h3 className="section-title">{lang === "km" ? "កត់ត្រាលទ្ធផលថែទាំ" : "Record Maintenance Result"}</h3>
            <div className="form-grid">
              {!maintenanceRecordScheduleJumpMode ? (
                <>
                  <label className="field">
                    <span>{t.category}</span>
                    <select
                      className="input"
                      value={maintenanceRecordCategoryFilter}
                      onChange={(e) => setMaintenanceRecordCategoryFilter(e.target.value)}
                    >
                      <option value="ALL">{t.allCategories}</option>
                      {maintenanceRecordCategoryOptions.map((category) => (
                        <option key={`maintenance-record-category-${category}`} value={category}>
                          {category === "SAFETY" ? "Safety" : category === "FACILITY" ? "Facility" : category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>{lang === "km" ? "ឈ្មោះទំនិញ" : "Item Name"}</span>
                    <select
                      className="input"
                      value={maintenanceRecordItemFilter}
                      onChange={(e) => setMaintenanceRecordItemFilter(e.target.value)}
                    >
                      <option value="ALL">{lang === "km" ? "ឈ្មោះទំនិញទាំងអស់" : "All Item Names"}</option>
                      {maintenanceRecordItemOptions.map((name) => (
                        <option key={`maintenance-record-item-${name}`} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>{t.location}</span>
                    <select
                      className="input"
                      value={maintenanceRecordLocationFilter}
                      onChange={(e) => setMaintenanceRecordLocationFilter(e.target.value)}
                    >
                      <option value="ALL">{lang === "km" ? "ទីតាំងទាំងអស់" : "All Locations"}</option>
                      {maintenanceRecordLocationOptions.map((location) => (
                        <option key={`maintenance-record-location-${location}`} value={location}>
                          {location}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
              <label className="field">
                <span>{lang === "km" ? "Asset" : "Asset"}</span>
                <AssetPicker
                  value={maintenanceRecordForm.assetId}
                  assets={maintenanceRecordFilteredAssets}
                  getLabel={(asset) => `${asset.assetId} - ${assetItemName(asset.category, asset.type, asset.pcType || "")} • ${campusLabel(asset.campus)}`}
                  onChange={(assetId) => setMaintenanceRecordForm((f) => ({ ...f, assetId }))}
                  placeholder={lang === "km" ? "ជ្រើស Asset ដែលបានចម្រោះ" : "Select filtered asset"}
                  disabled={!maintenanceRecordFilteredAssets.length}
                />
                <div className="tiny">
                  {maintenanceRecordFilteredAssets.length
                    ? lang === "km"
                      ? `${maintenanceRecordFilteredAssets.length} assets ត្រូវតាមតម្រងបច្ចុប្បន្ន`
                      : `${maintenanceRecordFilteredAssets.length} assets match current filters`
                    : lang === "km"
                    ? "មិនមាន assets ត្រូវតាមតម្រងបច្ចុប្បន្ន។"
                    : "No assets match current filters."}
                </div>
              </label>
              <label className="field">
                <span>{t.date}</span>
                <input
                  type="date"
                  className="input"
                  min={todayYmd}
                  value={maintenanceRecordForm.date}
                  onChange={(e) => setMaintenanceRecordForm((f) => ({ ...f, date: e.target.value }))}
                />
              </label>
              <label className="field">
                <span>{lang === "km" ? "ប្រភេទ" : "Type"}</span>
                <select
                  className="input"
                  value={maintenanceRecordForm.type}
                  onChange={(e) => setMaintenanceRecordForm((f) => ({ ...f, type: e.target.value }))}
                >
                  {MAINTENANCE_TYPE_OPTIONS.map((opt) => (
                    <option key={`record-type-${opt}`} value={opt}>{opt}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{lang === "km" ? "ស្ថានភាពការងារ" : "Work Status"}</span>
                <select
                  className="input"
                  value={maintenanceRecordForm.completion}
                  onChange={(e) =>
                    setMaintenanceRecordForm((f) => ({
                      ...f,
                      completion: e.target.value as "Done" | "Not Yet",
                    }))
                  }
                >
                    {MAINTENANCE_COMPLETION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.value === "Done" ? t.alreadyDone : t.notYetDone}
                      </option>
                    ))}
                </select>
              </label>
              <label className="field field-wide">
                <span>{lang === "km" ? "កំណត់ចំណាំលក្ខខណ្ឌ" : "Condition Comment"}</span>
                <input
                  className="input"
                  value={maintenanceRecordForm.condition}
                  onChange={(e) => setMaintenanceRecordForm((f) => ({ ...f, condition: e.target.value }))}
                  placeholder={lang === "km" ? "ឧទាហរណ៍: ដំណើរការល្អ, ថ្មខ្សោយ, ត្រូវប្តូរឆាប់ៗ..." : "Example: Working well, battery low, replace soon..."}
                />
              </label>
              <label className="field field-wide">
                <span>{lang === "km" ? "កំណត់ចំណាំថែទាំ" : "Maintenance Note"}</span>
                <textarea
                  className="textarea"
                  value={maintenanceRecordForm.note}
                  onChange={(e) => setMaintenanceRecordForm((f) => ({ ...f, note: e.target.value }))}
                />
              </label>
              <label className="field">
                <span>{lang === "km" ? "ចំណាយ" : "Cost"}</span>
                <input
                  className="input"
                  value={maintenanceRecordForm.cost}
                  onChange={(e) => setMaintenanceRecordForm((f) => ({ ...f, cost: e.target.value }))}
                />
              </label>
              <label className="field">
                <span>{lang === "km" ? "ដោយ" : "By"}</span>
                <input
                  className="input"
                  value={maintenanceRecordForm.by}
                  onChange={(e) => setMaintenanceRecordForm((f) => ({ ...f, by: e.target.value }))}
                />
              </label>
              <label className="field field-wide">
                <span>{t.photo}</span>
                <input
                  key={maintenanceRecordFileKey}
                  className="file-input"
                  type="file"
                  accept="image/*"
                  onChange={onMaintenanceRecordPhotoFile}
                />
              </label>
            </div>
            <div className="asset-actions">
              <div className="tiny">
                {lang === "km"
                  ? "កត់ត្រាថែទាំជា បានធ្វើរួច ឬ មិនទាន់ធ្វើ ហើយបន្ថែមកំណត់ចំណាំលក្ខខណ្ឌ។"
                  : "Track maintenance as Already Done or Not Yet Done and add condition comments."}
              </div>
              <button
                className="btn-primary"
                disabled={busy || !isAdmin || !maintenanceRecordForm.assetId || !maintenanceRecordForm.date || !maintenanceRecordForm.note.trim()}
                onClick={addMaintenanceRecordFromTab}
              >
                {lang === "km" ? "បន្ថែមកំណត់ត្រាថែទាំ" : "Add Maintenance Record"}
              </button>
            </div>
            </>
            )}

            {maintenanceView === "history" && canAccessMenu("maintenance.history", "maintenance") && (
            <>
            <div className="maintenance-title-row">
              <h2>{t.maintenanceHistory}</h2>
            </div>
            <div className="panel-filters maintenance-filters maintenance-filter-row">
              <select
                className="input"
                value={maintenanceCategoryFilter}
                onChange={(e) => setMaintenanceCategoryFilter(e.target.value)}
              >
                <option value="ALL">{t.allCategories}</option>
                {CATEGORY_OPTIONS.map((category) => (
                  <option key={category.value} value={category.value}>
                    {lang === "km" ? category.km : category.en}
                  </option>
                ))}
              </select>
              <select
                className="input"
                value={maintenanceTypeFilter}
                onChange={(e) => setMaintenanceTypeFilter(e.target.value)}
              >
                <option value="ALL">All Maintenance Types</option>
                {maintenanceTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <input
                className="input"
                type="date"
                value={maintenanceDateFrom}
                onChange={(e) => setMaintenanceDateFrom(e.target.value)}
              />
              <input
                className="input"
                type="date"
                value={maintenanceDateTo}
                onChange={(e) => setMaintenanceDateTo(e.target.value)}
              />
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th><button className="th-sort-btn" onClick={() => toggleMaintenanceSort("assetId")}>{t.assetId} {maintenanceSort.key === "assetId" ? (maintenanceSort.direction === "asc" ? "▲" : "▼") : ""}</button></th>
                    <th>{t.photo}</th>
                    <th><button className="th-sort-btn" onClick={() => toggleMaintenanceSort("campus")}>{t.campus} {maintenanceSort.key === "campus" ? (maintenanceSort.direction === "asc" ? "▲" : "▼") : ""}</button></th>
                    <th><button className="th-sort-btn" onClick={() => toggleMaintenanceSort("category")}>{t.category} {maintenanceSort.key === "category" ? (maintenanceSort.direction === "asc" ? "▲" : "▼") : ""}</button></th>
                    <th><button className="th-sort-btn" onClick={() => toggleMaintenanceSort("assetType")}>{t.typeCode} {maintenanceSort.key === "assetType" ? (maintenanceSort.direction === "asc" ? "▲" : "▼") : ""}</button></th>
                    <th><button className="th-sort-btn" onClick={() => toggleMaintenanceSort("location")}>{t.location} {maintenanceSort.key === "location" ? (maintenanceSort.direction === "asc" ? "▲" : "▼") : ""}</button></th>
                    <th><button className="th-sort-btn" onClick={() => toggleMaintenanceSort("date")}>Date {maintenanceSort.key === "date" ? (maintenanceSort.direction === "asc" ? "▲" : "▼") : ""}</button></th>
                    <th><button className="th-sort-btn" onClick={() => toggleMaintenanceSort("type")}>Type {maintenanceSort.key === "type" ? (maintenanceSort.direction === "asc" ? "▲" : "▼") : ""}</button></th>
                    <th><button className="th-sort-btn" onClick={() => toggleMaintenanceSort("completion")}>Work Status {maintenanceSort.key === "completion" ? (maintenanceSort.direction === "asc" ? "▲" : "▼") : ""}</button></th>
                    <th><button className="th-sort-btn" onClick={() => toggleMaintenanceSort("condition")}>Condition {maintenanceSort.key === "condition" ? (maintenanceSort.direction === "asc" ? "▲" : "▼") : ""}</button></th>
                    <th><button className="th-sort-btn" onClick={() => toggleMaintenanceSort("note")}>Note {maintenanceSort.key === "note" ? (maintenanceSort.direction === "asc" ? "▲" : "▼") : ""}</button></th>
                    <th>{t.photo}</th>
                    <th><button className="th-sort-btn" onClick={() => toggleMaintenanceSort("cost")}>Cost {maintenanceSort.key === "cost" ? (maintenanceSort.direction === "asc" ? "▲" : "▼") : ""}</button></th>
                    <th><button className="th-sort-btn" onClick={() => toggleMaintenanceSort("by")}>By {maintenanceSort.key === "by" ? (maintenanceSort.direction === "asc" ? "▲" : "▼") : ""}</button></th>
                    <th><button className="th-sort-btn" onClick={() => toggleMaintenanceSort("status")}>{t.status} {maintenanceSort.key === "status" ? (maintenanceSort.direction === "asc" ? "▲" : "▼") : ""}</button></th>
                    <th>{t.edit}</th>
                    <th>{t.delete}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMaintenanceRows.length ? (
                    sortedMaintenanceRows.map((row) => (
                      <tr
                        key={row.rowId}
                        className={maintenanceHistoryRowClass(
                          row.type || "",
                          row.completion || "",
                          row.status || "",
                          row.condition || "",
                          row.note || ""
                        )}
                      >
                        <td>
                          <button
                            className="tab"
                            onClick={() => {
                              setMaintenanceDetailAssetId(row.assetDbId);
                              cancelMaintenanceEntryEdit();
                            }}
                          >
                            <strong>{row.assetId}</strong>
                          </button>
                        </td>
                        <td>{renderAssetPhoto(row.assetPhoto || "", row.assetId)}</td>
                        <td>{campusLabel(row.campus)}</td>
                        <td>{row.category}</td>
                        <td>{row.assetType || "-"}</td>
                        <td>{row.location}</td>
                        <td>{formatDate(row.date || "-")}</td>
                        <td>{row.type || "-"}</td>
                        <td>{row.completion || "-"}</td>
                        <td>{row.condition || "-"}</td>
                        <td>{row.note || "-"}</td>
                        <td>{renderAssetPhoto(row.photo || "", "maintenance")}</td>
                        <td>{row.cost || "-"}</td>
                        <td>{row.by || "-"}</td>
                        <td>{assetStatusLabel(row.status)}</td>
                        <td>
                          <button
                            className="tab"
                            disabled={!isAdmin}
                            onClick={() => editMaintenanceEntryFromHistoryRow(row)}
                          >
                            {t.edit}
                          </button>
                        </td>
                        <td>
                          <button
                            className="btn-danger"
                            disabled={busy || !isAdmin}
                            onClick={() => deleteMaintenanceEntryByAsset(row.assetDbId, row.entryId)}
                          >
                            X
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={17}>No maintenance records yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            </>
            )}
          </section>

          {maintenanceDetailAsset && (
            <div className="modal-backdrop" onClick={() => setMaintenanceDetailAssetId(null)}>
              <section className="panel modal-panel" onClick={(e) => e.stopPropagation()}>
                <div className="panel-row">
                  <h2>Maintenance Detail - {maintenanceDetailAsset.assetId}</h2>
                  <button className="tab" onClick={() => setMaintenanceDetailAssetId(null)}>Close</button>
                </div>
                <p className="tiny">
                  {campusLabel(maintenanceDetailAsset.campus)} | {maintenanceDetailAsset.category} | {maintenanceDetailAsset.location || "-"}
                </p>
                <div className="table-wrap" style={{ marginTop: 12 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Work Status</th>
                        <th>Condition</th>
                        <th>Note</th>
                        <th>{t.photo}</th>
                        <th>Cost</th>
                        <th>By</th>
                        <th>{t.edit}</th>
                        <th>{t.delete}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {maintenanceDetailEntries.length ? (
                        maintenanceDetailEntries.map((entry) => (
                          <tr
                            key={`maintenance-detail-${entry.id}`}
                            className={maintenanceHistoryRowClass(
                              entry.type || "",
                              entry.completion || "",
                              maintenanceDetailAsset.status || "",
                              entry.condition || "",
                              entry.note || ""
                            )}
                          >
                            <td>
                              {maintenanceEditingEntryId === entry.id ? (
                                <input
                                  type="date"
                                  className="table-input"
                                  min={todayYmd}
                                  value={maintenanceEditForm.date}
                                  onChange={(e) => setMaintenanceEditForm((f) => ({ ...f, date: e.target.value }))}
                                />
                              ) : (
                                formatDate(entry.date || "-")
                              )}
                            </td>
                            <td>
                              {maintenanceEditingEntryId === entry.id ? (
                                <select
                                  className="table-input"
                                  value={maintenanceEditForm.type}
                                  onChange={(e) => setMaintenanceEditForm((f) => ({ ...f, type: e.target.value }))}
                                >
                                  {MAINTENANCE_TYPE_OPTIONS.map((opt) => (
                                    <option key={`detail-type-${opt}`} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              ) : (
                                entry.type
                              )}
                            </td>
                            <td>
                              {maintenanceEditingEntryId === entry.id ? (
                                <select
                                  className="table-input"
                                  value={maintenanceEditForm.completion}
                                  onChange={(e) =>
                                    setMaintenanceEditForm((f) => ({
                                      ...f,
                                      completion: e.target.value as "Done" | "Not Yet",
                                    }))
                                  }
                                >
                                  {MAINTENANCE_COMPLETION_OPTIONS.map((opt) => (
                                    <option key={`maintenance-edit-${opt.value}`} value={opt.value}>
                                      {opt.value === "Done" ? t.alreadyDone : t.notYetDone}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                entry.completion || "-"
                              )}
                            </td>
                            <td>
                              {maintenanceEditingEntryId === entry.id ? (
                                <input
                                  className="table-input"
                                  value={maintenanceEditForm.condition}
                                  onChange={(e) => setMaintenanceEditForm((f) => ({ ...f, condition: e.target.value }))}
                                />
                              ) : (
                                entry.condition || "-"
                              )}
                            </td>
                            <td>
                              {maintenanceEditingEntryId === entry.id ? (
                                <textarea
                                  className="table-input"
                                  value={maintenanceEditForm.note}
                                  onChange={(e) => setMaintenanceEditForm((f) => ({ ...f, note: e.target.value }))}
                                />
                              ) : (
                                entry.note
                              )}
                            </td>
                            <td>
                              {maintenanceEditingEntryId === entry.id ? (
                                <div className="row-actions">
                                  <input
                                    key={`${maintenanceEditFileKey}-${entry.id}`}
                                    className="file-input"
                                    type="file"
                                    accept="image/*"
                                    onChange={onMaintenanceEditPhotoFile}
                                  />
                                  {maintenanceEditForm.photo ? (
                                    <img src={maintenanceEditForm.photo} alt="maintenance" className="table-photo" />
                                  ) : (
                                    "-"
                                  )}
                                </div>
                              ) : (
                                renderAssetPhoto(entry.photo || "", "maintenance")
                              )}
                            </td>
                            <td>
                              {maintenanceEditingEntryId === entry.id ? (
                                <input
                                  className="table-input"
                                  value={maintenanceEditForm.cost}
                                  onChange={(e) => setMaintenanceEditForm((f) => ({ ...f, cost: e.target.value }))}
                                />
                              ) : (
                                entry.cost || "-"
                              )}
                            </td>
                            <td>
                              {maintenanceEditingEntryId === entry.id ? (
                                <input
                                  className="table-input"
                                  value={maintenanceEditForm.by}
                                  onChange={(e) => setMaintenanceEditForm((f) => ({ ...f, by: e.target.value }))}
                                />
                              ) : (
                                entry.by || "-"
                              )}
                            </td>
                            <td>
                              <div className="row-actions">
                                {maintenanceEditingEntryId === entry.id ? (
                                  <>
                                    <button className="btn-primary btn-small" disabled={busy || !isAdmin} onClick={() => updateMaintenanceEntry(entry.id)}>
                                      Update
                                    </button>
                                    <button className="tab" onClick={cancelMaintenanceEntryEdit}>Cancel</button>
                                  </>
                                ) : (
                                  <button className="tab" disabled={!isAdmin} onClick={() => startMaintenanceEntryEdit(entry)}>{t.edit}</button>
                                )}
                              </div>
                            </td>
                            <td>
                              <button className="btn-danger" disabled={busy || !isAdmin} onClick={() => deleteMaintenanceEntry(entry.id)}>X</button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={10}>No maintenance records yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
          </>
        )}

        {tab === "verification" && (
          <section className="panel">
            <div className="tabs">
              {canAccessMenu("verification.record", "verification") ? (
                <button
                  className={`tab ${verificationView === "record" ? "tab-active" : ""}`}
                  onClick={() => setVerificationView("record")}
                >
                  {t.recordVerification}
                </button>
              ) : null}
              {canAccessMenu("verification.history", "verification") ? (
                <button
                  className={`tab ${verificationView === "history" ? "tab-active" : ""}`}
                  onClick={() => setVerificationView("history")}
                >
                  {t.verificationHistory}
                </button>
              ) : null}
            </div>

            {verificationView === "record" && canAccessMenu("verification.record", "verification") && (
              <>
                <h3 className="section-title">{t.recordVerification}</h3>
                <div className="form-grid">
                  <label className="field">
                    <span>Category</span>
                    <select
                      className="input"
                      value={verificationRecordCategoryFilter}
                      onChange={(e) => setVerificationRecordCategoryFilter(e.target.value)}
                    >
                      <option value="ALL">{t.allCategories}</option>
                      {verificationRecordCategoryOptions.map((category) => (
                        <option key={`verification-record-category-${category}`} value={category}>
                          {category === "SAFETY" ? "Safety" : category === "FACILITY" ? "Facility" : category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Item Name</span>
                    <select
                      className="input"
                      value={verificationRecordItemFilter}
                      onChange={(e) => setVerificationRecordItemFilter(e.target.value)}
                    >
                      <option value="ALL">All Item Names</option>
                      {verificationRecordItemOptions.map((name) => (
                        <option key={`verification-record-item-${name}`} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Location</span>
                    <select
                      className="input"
                      value={verificationRecordLocationFilter}
                      onChange={(e) => setVerificationRecordLocationFilter(e.target.value)}
                    >
                      <option value="ALL">All Locations</option>
                      {verificationRecordLocationOptions.map((location) => (
                        <option key={`verification-record-location-${location}`} value={location}>
                          {location}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field field-wide">
                    <span>{t.asset}</span>
                    <AssetPicker
                      value={verificationRecordForm.assetId}
                      assets={verificationRecordFilteredAssets}
                      getLabel={(asset) => `${asset.assetId} - ${assetItemName(asset.category, asset.type, asset.pcType || "")} • ${campusLabel(asset.campus)}`}
                      onChange={(assetId) => setVerificationRecordForm((f) => ({ ...f, assetId }))}
                      placeholder="Select filtered asset"
                      disabled={!verificationRecordFilteredAssets.length}
                    />
                    <div className="tiny">
                      {verificationRecordFilteredAssets.length
                        ? `${verificationRecordFilteredAssets.length} assets match current filters`
                        : "No assets match current filters."}
                    </div>
                  </label>
                  <label className="field">
                    <span>{t.date}</span>
                    <input
                      type="date"
                      className="input"
                      value={verificationRecordForm.date}
                      onChange={(e) => setVerificationRecordForm((f) => ({ ...f, date: e.target.value }))}
                    />
                  </label>
                  <label className="field">
                    <span>{t.verificationResult}</span>
                    <select
                      className="input"
                      value={verificationRecordForm.result}
                      onChange={(e) =>
                        setVerificationRecordForm((f) => ({
                          ...f,
                          result: e.target.value as VerificationEntry["result"],
                        }))
                      }
                    >
                      {VERIFICATION_RESULT_OPTIONS.map((opt) => (
                        <option key={`verification-result-${opt}`} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>{t.verificationFrequency}</span>
                    <select
                      className="input"
                      value={verificationRecordForm.verificationFrequency}
                      onChange={(e) =>
                        setVerificationRecordForm((f) => ({
                          ...f,
                          verificationFrequency: e.target.value as "NONE" | "MONTHLY" | "TERMLY",
                        }))
                      }
                    >
                      <option value="NONE">No repeat</option>
                      <option value="MONTHLY">Monthly</option>
                      <option value="TERMLY">Termly</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Next Verification Date</span>
                    <input
                      type="date"
                      className="input"
                      value={verificationRecordForm.nextVerificationDate}
                      onChange={(e) =>
                        setVerificationRecordForm((f) => ({ ...f, nextVerificationDate: e.target.value }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>{t.by}</span>
                    <input
                      className="input"
                      value={verificationRecordForm.by}
                      onChange={(e) => setVerificationRecordForm((f) => ({ ...f, by: e.target.value }))}
                    />
                  </label>
                  <label className="field field-wide">
                    <span>Condition</span>
                    <input
                      className="input"
                      value={verificationRecordForm.condition}
                      onChange={(e) => setVerificationRecordForm((f) => ({ ...f, condition: e.target.value }))}
                      placeholder="Example: Working well / minor issue / missing label..."
                    />
                  </label>
                  <label className="field field-wide">
                    <span>{t.notes}</span>
                    <textarea
                      className="textarea"
                      value={verificationRecordForm.note}
                      onChange={(e) => setVerificationRecordForm((f) => ({ ...f, note: e.target.value }))}
                    />
                  </label>
                  <label className="field field-wide">
                    <span>{t.photo}</span>
                    <input
                      key={verificationRecordFileKey}
                      className="file-input"
                      type="file"
                      accept="image/*"
                      onChange={onVerificationRecordPhotoFile}
                    />
                  </label>
                </div>
                <div className="asset-actions">
                  <div className="tiny">Use this to verify asset condition and keep monthly/term records.</div>
                  <button
                    className="btn-primary"
                    disabled={busy || !isAdmin || !verificationRecordForm.assetId || !verificationRecordForm.date || !verificationRecordForm.note.trim()}
                    onClick={addVerificationRecord}
                  >
                    Add Verification Record
                  </button>
                </div>
              </>
            )}

            {verificationView === "history" && canAccessMenu("verification.history", "verification") && (
              <>
                <div className="panel-row">
                  <h2>{t.verificationHistory}</h2>
                  <div className="panel-filters">
                    <select
                      className="input"
                      value={verificationCategoryFilter}
                      onChange={(e) => setVerificationCategoryFilter(e.target.value)}
                    >
                      <option value="ALL">{t.allCategories}</option>
                      {CATEGORY_OPTIONS.map((category) => (
                        <option key={category.value} value={category.value}>
                          {lang === "km" ? category.km : category.en}
                        </option>
                      ))}
                    </select>
                    <select
                      className="input"
                      value={verificationResultFilter}
                      onChange={(e) => setVerificationResultFilter(e.target.value)}
                    >
                      <option value="ALL">All Results</option>
                      {VERIFICATION_RESULT_OPTIONS.map((opt) => (
                        <option key={`verification-filter-${opt}`} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <input
                      className="input"
                      type="date"
                      value={verificationDateFrom}
                      onChange={(e) => setVerificationDateFrom(e.target.value)}
                    />
                    <input
                      className="input"
                      type="date"
                      value={verificationDateTo}
                      onChange={(e) => setVerificationDateTo(e.target.value)}
                    />
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{t.assetId}</th>
                        <th>{t.photo}</th>
                        <th>{t.campus}</th>
                        <th>{t.category}</th>
                        <th>{t.location}</th>
                        <th>{t.date}</th>
                        <th>{t.verificationResult}</th>
                        <th>Condition</th>
                        <th>{t.notes}</th>
                        <th>{t.photo}</th>
                        <th>{t.by}</th>
                        <th>{t.edit}</th>
                        <th>{t.delete}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVerificationRows.length ? (
                        filteredVerificationRows.map((row) => (
                          <tr key={`verification-row-${row.rowId}`}>
                            <td><strong>{row.assetId}</strong></td>
                            <td>{renderAssetPhoto(row.assetPhoto || "", row.assetId)}</td>
                            <td>{campusLabel(row.campus)}</td>
                            <td>{row.category}</td>
                            <td>{row.location}</td>
                            <td>
                              {verificationEditingRowId === row.rowId ? (
                                <input
                                  type="date"
                                  className="table-input"
                                  value={verificationEditForm.date}
                                  onChange={(e) => setVerificationEditForm((f) => ({ ...f, date: e.target.value }))}
                                />
                              ) : (
                                formatDate(row.date || "-")
                              )}
                            </td>
                            <td>
                              {verificationEditingRowId === row.rowId ? (
                                <select
                                  className="table-input"
                                  value={verificationEditForm.result}
                                  onChange={(e) =>
                                    setVerificationEditForm((f) => ({
                                      ...f,
                                      result: e.target.value as VerificationEntry["result"],
                                    }))
                                  }
                                >
                                  {VERIFICATION_RESULT_OPTIONS.map((opt) => (
                                    <option key={`verification-edit-${opt}`} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              ) : (
                                row.result
                              )}
                            </td>
                            <td>
                              {verificationEditingRowId === row.rowId ? (
                                <input
                                  className="table-input"
                                  value={verificationEditForm.condition}
                                  onChange={(e) => setVerificationEditForm((f) => ({ ...f, condition: e.target.value }))}
                                />
                              ) : (
                                row.condition || "-"
                              )}
                            </td>
                            <td>
                              {verificationEditingRowId === row.rowId ? (
                                <textarea
                                  className="table-input"
                                  value={verificationEditForm.note}
                                  onChange={(e) => setVerificationEditForm((f) => ({ ...f, note: e.target.value }))}
                                />
                              ) : (
                                row.note || "-"
                              )}
                            </td>
                            <td>
                              {verificationEditingRowId === row.rowId ? (
                                <div className="row-actions">
                                  <input
                                    key={`${verificationEditFileKey}-${row.rowId}`}
                                    className="file-input"
                                    type="file"
                                    accept="image/*"
                                    onChange={onVerificationEditPhotoFile}
                                  />
                                  {verificationEditForm.photo ? (
                                    <img src={verificationEditForm.photo} alt="verification" className="table-photo" />
                                  ) : (
                                    "-"
                                  )}
                                </div>
                              ) : (
                                renderAssetPhoto(row.photo || "", "verification")
                              )}
                            </td>
                            <td>
                              {verificationEditingRowId === row.rowId ? (
                                <input
                                  className="table-input"
                                  value={verificationEditForm.by}
                                  onChange={(e) => setVerificationEditForm((f) => ({ ...f, by: e.target.value }))}
                                />
                              ) : (
                                row.by || "-"
                              )}
                            </td>
                            <td>
                              <div className="row-actions">
                                {verificationEditingRowId === row.rowId ? (
                                  <>
                                    <button
                                      className="btn-primary btn-small"
                                      disabled={busy || !isAdmin}
                                      onClick={() =>
                                        updateVerificationEntry(
                                          row.assetDbId,
                                          row.entryId
                                        )
                                      }
                                    >
                                      Update
                                    </button>
                                    <button className="tab" onClick={cancelVerificationRowEdit}>Cancel</button>
                                  </>
                                ) : (
                                  <button
                                    className="tab"
                                    disabled={!isAdmin}
                                    onClick={() =>
                                      startVerificationRowEdit(row.rowId, {
                                        date: row.date,
                                        result: row.result,
                                        condition: row.condition,
                                        note: row.note,
                                        by: row.by,
                                        photo: row.photo,
                                      })
                                    }
                                  >
                                    {t.edit}
                                  </button>
                                )}
                              </div>
                            </td>
                            <td>
                              <button
                                className="btn-danger"
                                disabled={busy || !isAdmin}
                                onClick={() => deleteVerificationEntry(row.assetDbId, row.entryId)}
                              >
                                X
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={13}>No verification records yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        )}

        {tab === "reports" && (
          <section className="panel">
            <div className="report-title-row">
              <h2>{t.reports}</h2>
              {isPhoneView || !hasReportFilters ? (
                <button
                  className="btn-primary report-print-btn report-title-print-btn"
                  onClick={() => {
                    setReportMobileFiltersOpen(false);
                    printCurrentReport();
                  }}
                >
                  {lang === "km" ? "បោះពុម្ពរបាយការណ៍" : "Print Report"}
                </button>
              ) : null}
            </div>
            {reportType === "maintenance_completion" && (
              <div className="stats-grid" style={{ marginBottom: 10 }}>
                <article className="stat-card">
                  <div className="stat-label">Total Records ({maintenanceCompletionRangeLabel})</div>
                  <div className="stat-value">{maintenanceCompletionSummary.total}</div>
                </article>
                <article className="stat-card">
                  <div className="stat-label">Done</div>
                  <div className="stat-value">{maintenanceCompletionSummary.done}</div>
                </article>
                <article className="stat-card">
                  <div className="stat-label">Not Yet</div>
                  <div className="stat-value">{maintenanceCompletionSummary.notYet}</div>
                </article>
              </div>
            )}
            <div className="report-builder">
              <div className="report-builder-top">
                <label className="field report-type-field">
                  <span>{lang === "km" ? "ជំហានទី 1៖ ជ្រើសប្រភេទរបាយការណ៍" : "Step 1: Choose Report Type"}</span>
                  <select
                    className="input report-type-input"
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value as ReportType)}
                  >
                    {reportTypeOptions.map((option) => (
                      <option key={`report-type-${option.value}`} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="report-builder-actions">
                  <button
                    type="button"
                    className="tab report-mobile-filter-btn"
                    onClick={() => setReportMobileFiltersOpen((open) => !open)}
                  >
                    {isPhoneView && reportMobileFiltersOpen
                      ? (lang === "km" ? "បិទតម្រង" : "Close Filters")
                      : (lang === "km" ? "តម្រង" : "Filters")}
                  </button>
                  {isPhoneView ? (
                    <button type="button" className="tab" onClick={resetReportFilters}>
                      {lang === "km" ? "កំណត់តម្រងឡើងវិញ" : "Reset Filters"}
                    </button>
                  ) : null}
                </div>
              </div>
              {hasReportFilters ? (
                <>
                  <div className="tiny report-filters-title">
                    {lang === "km" ? "ជំហានទី 2៖ ជ្រើសតម្រង (បើចាំបាច់)" : "Step 2: Set Filters (if needed)"}
                  </div>
                  {isPhoneView && reportMobileFiltersOpen ? (
                    <button
                      type="button"
                      className="report-mobile-filter-overlay"
                      aria-label="Close filters"
                      onClick={() => setReportMobileFiltersOpen(false)}
                    />
                  ) : null}
                  <div
                    className={`report-mobile-filter-sheet ${
                      isPhoneView && reportMobileFiltersOpen ? "report-mobile-filter-sheet-open" : ""
                    }`}
                  >
                    <div className="report-mobile-filter-head">
                      <strong>{lang === "km" ? "តម្រងរបាយការណ៍" : "Report Filters"}</strong>
                      <button type="button" className="tab" onClick={() => setReportMobileFiltersOpen(false)}>
                        {lang === "km" ? "រួចរាល់" : "Done"}
                      </button>
                    </div>
                    <div className="panel-filters report-filters report-filter-row">
              {reportType === "maintenance_completion" ? (
                <>
                  <input
                    className="input"
                    type="date"
                    value={reportDateFrom}
                    onChange={(e) => setReportDateFrom(e.target.value)}
                  />
                  <input
                    className="input"
                    type="date"
                    value={reportDateTo}
                    onChange={(e) => setReportDateTo(e.target.value)}
                  />
                </>
              ) : null}
              {reportType === "verification_summary" && reportPeriodMode === "month" ? (
                <input
                  className="input"
                  type="month"
                  value={reportMonth}
                  onChange={(e) => setReportMonth(e.target.value)}
                />
              ) : null}
              {reportType === "verification_summary" ? (
                <>
                  <select
                    className="input"
                    value={reportPeriodMode}
                    onChange={(e) => setReportPeriodMode(e.target.value as "month" | "term")}
                  >
                    <option value="month">Month</option>
                    <option value="term">Term</option>
                  </select>
                  {reportPeriodMode === "term" ? (
                    <>
                      <input
                        className="input"
                        type="number"
                        min="2020"
                        max="2100"
                        value={reportYear}
                        onChange={(e) => setReportYear(e.target.value)}
                      />
                      <select
                        className="input"
                        value={reportTerm}
                        onChange={(e) => setReportTerm(e.target.value as "Term 1" | "Term 2" | "Term 3")}
                      >
                        <option value="Term 1">Term 1</option>
                        <option value="Term 2">Term 2</option>
                        <option value="Term 3">Term 3</option>
                      </select>
                    </>
                  ) : null}
                </>
              ) : null}
              {reportType === "qr_labels" ? (
                <>
                  <select
                    className="input"
                    value={qrCampusFilter}
                    onChange={(e) => setQrCampusFilter(e.target.value)}
                  >
                    <option value="ALL">{t.allCampuses}</option>
                    {CAMPUS_LIST.map((campus) => (
                      <option key={`qr-campus-${campus}`} value={campus}>
                        {campusLabel(campus)}
                      </option>
                    ))}
                  </select>
                  <select
                    className="input"
                    value={qrLocationFilter}
                    onChange={(e) => setQrLocationFilter(e.target.value)}
                  >
                    <option value="ALL">{lang === "km" ? "គ្រប់ទីតាំង" : "All Locations"}</option>
                    {qrLocationFilterOptions.map((location) => (
                      <option key={`qr-location-${location}`} value={location}>
                        {location}
                      </option>
                    ))}
                  </select>
                  <select
                    className="input"
                    value={qrCategoryFilter}
                    onChange={(e) => setQrCategoryFilter(e.target.value)}
                  >
                    <option value="ALL">{t.allCategories}</option>
                    {qrCategoryFilterOptions.map((category) => (
                      <option key={`qr-category-${category}`} value={category}>
                        {category === "SAFETY"
                          ? (lang === "km" ? "សុវត្ថិភាព" : "Safety")
                          : category === "FACILITY"
                            ? (lang === "km" ? "បរិក្ខារ" : "Facility")
                            : category}
                      </option>
                    ))}
                  </select>
                  <details className="filter-menu">
                    <summary>{summarizeMultiFilter(qrItemFilter, lang === "km" ? "គ្រប់ឈ្មោះទំនិញ" : "All Item Names")}</summary>
                    <div className="filter-menu-list">
                      <label className="filter-menu-item">
                        <input
                          type="checkbox"
                          checked={qrItemFilter.includes("ALL")}
                          onChange={(e) =>
                            setQrItemFilter((prev) =>
                              applyMultiFilterSelection(prev, e.target.checked, "ALL", qrItemFilterOptions)
                            )
                          }
                        />
                        <span>{lang === "km" ? "គ្រប់ឈ្មោះទំនិញ" : "All Item Names"}</span>
                      </label>
                      {qrItemFilterOptions.map((itemName) => (
                        <label key={`qr-item-${itemName}`} className="filter-menu-item">
                          <input
                            type="checkbox"
                            checked={qrItemFilter.includes(itemName)}
                            onChange={(e) =>
                              setQrItemFilter((prev) =>
                                applyMultiFilterSelection(prev, e.target.checked, itemName, qrItemFilterOptions)
                              )
                            }
                          />
                          <span>{itemName}</span>
                        </label>
                      ))}
                    </div>
                  </details>
                </>
              ) : null}
              {reportType === "asset_master" ? (
                <>
                  <select
                    className="input"
                    value={edAssetTemplate}
                    onChange={(e) => setEdAssetTemplate(e.target.value as EdAssetTemplate)}
                  >
                    {edTemplateOptions.map((option) => (
                      <option key={`ed-template-${option.value}`} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <details className="filter-menu" onToggle={handleAssetMasterFilterMenuToggle}>
                    <summary>{campusFilterSummary}</summary>
                    <div className="filter-menu-list">
                      <label className="filter-menu-item">
                        <input
                          type="checkbox"
                          checked={assetMasterCampusFilter.includes("ALL")}
                          onChange={(e) => updateSingleSelect(setAssetMasterCampusFilter, "ALL", e.target.checked)}
                        />
                        <span>{t.allCampuses}</span>
                      </label>
                      {assetMasterCampusFilterOptions.map((campus) => (
                        <label key={`master-campus-${campus}`} className="filter-menu-item">
                          <input
                            type="checkbox"
                            checked={assetMasterCampusFilter.includes(campus)}
                            onChange={(e) => updateSingleSelect(setAssetMasterCampusFilter, campus, e.target.checked)}
                          />
                          <span>{campusLabel(campus)}</span>
                        </label>
                      ))}
                    </div>
                  </details>
                  <details className="filter-menu" onToggle={handleAssetMasterFilterMenuToggle}>
                    <summary>{categoryFilterSummary}</summary>
                    <div className="filter-menu-list">
                      <label className="filter-menu-item">
                        <input
                          type="checkbox"
                          checked={assetMasterCategoryFilter.includes("ALL")}
                          onChange={(e) => updateSingleSelect(setAssetMasterCategoryFilter, "ALL", e.target.checked)}
                        />
                        <span>{t.allCategories}</span>
                      </label>
                      {assetMasterCategoryFilterOptions.map((category) => (
                        <label key={`master-category-${category}`} className="filter-menu-item">
                          <input
                            type="checkbox"
                            checked={assetMasterCategoryFilter.includes(category)}
                            onChange={(e) => updateSingleSelect(setAssetMasterCategoryFilter, category, e.target.checked)}
                          />
                          <span>
                            {category === "SAFETY"
                              ? (lang === "km" ? "សុវត្ថិភាព" : "Safety")
                              : category === "FACILITY"
                                ? (lang === "km" ? "បរិក្ខារ" : "Facility")
                                : category}
                          </span>
                        </label>
                      ))}
                    </div>
                  </details>
                  <details className="filter-menu" onToggle={handleAssetMasterFilterMenuToggle}>
                    <summary>{itemFilterSummary}</summary>
                    <div className="filter-menu-list">
                      <label className="filter-menu-item">
                        <input
                          type="checkbox"
                          checked={assetMasterItemFilter.includes("ALL")}
                          onChange={(e) =>
                            setAssetMasterItemFilter((prev) =>
                              applyMultiFilterSelection(prev, e.target.checked, "ALL", assetMasterItemFilterOptions)
                            )
                          }
                        />
                        <span>{lang === "km" ? "គ្រប់ឈ្មោះទំនិញ" : "All Item Names"}</span>
                      </label>
                      {assetMasterItemFilterOptions.map((itemName) => (
                        <label key={`master-item-${itemName}`} className="filter-menu-item">
                          <input
                            type="checkbox"
                            checked={assetMasterItemFilter.includes(itemName)}
                            onChange={(e) =>
                              setAssetMasterItemFilter((prev) =>
                                applyMultiFilterSelection(prev, e.target.checked, itemName, assetMasterItemFilterOptions)
                              )
                            }
                          />
                          <span>{itemName}</span>
                        </label>
                      ))}
                    </div>
                  </details>
                  <details className="filter-menu filter-menu-columns" onToggle={handleAssetMasterFilterMenuToggle}>
                    <summary>{columnFilterSummary}</summary>
                    <div className="filter-menu-list">
                      {assetMasterColumnDefs.map((column) => (
                        <label key={`master-col-${column.key}`} className="filter-menu-item">
                          <input
                            type="checkbox"
                            checked={isAssetMasterColumnVisible(column.key)}
                            onChange={() => updateAssetMasterColumnSelection(column.key)}
                          />
                          <span>{column.label}</span>
                        </label>
                      ))}
                    </div>
                  </details>
                </>
              ) : null}
                      {!isPhoneView ? (
                        <>
                          <button
                            type="button"
                            className="tab report-filter-reset-btn"
                            onClick={resetReportFilters}
                          >
                            {lang === "km" ? "កំណត់តម្រងឡើងវិញ" : "Reset Filters"}
                          </button>
                          <button
                            type="button"
                            className="btn-primary report-print-btn report-filter-print-btn"
                            onClick={() => {
                              setReportMobileFiltersOpen(false);
                              printCurrentReport();
                            }}
                          >
                            {lang === "km" ? "បោះពុម្ពរបាយការណ៍" : "Print Report"}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : (
                <div className="tiny report-filters-title">
                  {lang === "km"
                    ? "របាយការណ៍នេះមិនចាំបាច់មានតម្រងបន្ថែមទេ។ ជំហានទី 2 អាចរំលង។"
                    : "No extra filters for this report. You can go directly to print."}
                </div>
              )}
              <div className="report-builder-hint">
                <strong>{selectedReportTypeLabel}</strong>
                <span>{reportTypeGuideText}</span>
              </div>
            </div>

            {reportType === "asset_master" && (
              <div className="panel-note">
                <strong>Asset register view:</strong> one row per asset with quick item/service information.
                {edAssetTemplate !== "ALL" ? (
                  <span> Template: <strong>{selectedEdTemplateLabel}</strong></span>
                ) : null}
              </div>
            )}
            {reportType === "set_code" && (
              <div className="panel-note">
                <strong>Computer set view:</strong> one row per set with main asset and connected items (with photos).
              </div>
            )}
            {reportType === "qr_labels" && (
              <div className="panel-note">
                <strong>QR label view:</strong> scan QR to open this asset detail page directly.
              </div>
            )}
            {reportType === "asset_master" && (
              <>
                {isPhoneView ? (
                  <div className="report-mobile-only report-card-list">
                    {assetMasterReportRows.length ? (
                      assetMasterReportRows.map((row) => (
                        <article key={`report-mobile-asset-${row.key}`} className="report-card">
                          <div className="report-card-head">
                            <div>{renderAssetPhoto(row.photo || "", row.assetId)}</div>
                            <div>
                              <strong>{row.assetId}</strong>
                              <div className="tiny">{row.status || "-"}</div>
                            </div>
                          </div>
                          <div className="report-card-meta">
                            <div><strong>{t.campus}:</strong> {campusLabel(row.campus)}</div>
                            <div><strong>{t.category}:</strong> {row.category || "-"}</div>
                            <div><strong>{t.location}:</strong> {row.location || "-"}</div>
                            <div><strong>Linked:</strong> {row.linkedTo || "-"}</div>
                            <div><strong>Item:</strong> {row.itemDescription || "-"}</div>
                            <div><strong>Purchase:</strong> {formatDate(row.purchaseDate || "-")}</div>
                            <div>
                              <strong>Last Service:</strong>{" "}
                              {row.lastServiceDate && row.lastServiceDate !== "-" ? (
                                <button
                                  type="button"
                                  className="report-service-link"
                                  onClick={() => {
                                    setTab("maintenance");
                                    setMaintenanceView("history");
                                    setMaintenanceDetailAssetId(row.assetDbId);
                                  }}
                                >
                                  {formatDate(row.lastServiceDate)}
                                </button>
                              ) : (
                                "-"
                              )}
                            </div>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="panel-note">No assets found.</div>
                    )}
                  </div>
                ) : (
                  <div className="table-wrap report-table-wrap report-desktop-only">
                    <table>
                      <thead>
                        <tr>
                          {assetMasterColumnDefs
                            .filter((column) => isAssetMasterColumnVisible(column.key))
                            .map((column) => (
                              <th key={`report-master-col-${column.key}`}>
                                {column.sortable ? (
                                  <button
                                    type="button"
                                    className="report-sort-link"
                                    onClick={() => toggleAssetMasterSort(column.key)}
                                  >
                                    {column.label}
                                    {assetMasterSortMark(column.key)}
                                  </button>
                                ) : (
                                  column.label
                                )}
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody>
                        {assetMasterReportRows.length ? (
                          assetMasterReportRows.map((row) => (
                            <tr key={`report-asset-master-${row.key}`}>
                              {assetMasterColumnDefs
                                .filter((column) => isAssetMasterColumnVisible(column.key))
                                .map((column) => {
                                  if (column.key === "photo") {
                                    return <td key={`${row.key}-photo`}>{renderAssetPhoto(row.photo || "", row.assetId)}</td>;
                                  }
                                  if (column.key === "assetId") {
                                    return <td key={`${row.key}-assetId`}><strong>{row.assetId}</strong></td>;
                                  }
                                  if (column.key === "linkedTo") {
                                    return <td key={`${row.key}-linkedTo`}>{row.linkedTo || "-"}</td>;
                                  }
                                  if (column.key === "itemName") {
                                    return <td key={`${row.key}-itemName`}>{row.itemName || "-"}</td>;
                                  }
                                  if (column.key === "category") {
                                    return <td key={`${row.key}-category`}>{row.category || "-"}</td>;
                                  }
                                  if (column.key === "campus") {
                                    return <td key={`${row.key}-campus`}>{campusLabel(row.campus)}</td>;
                                  }
                                  if (column.key === "itemDescription") {
                                    return (
                                      <td key={`${row.key}-itemDescription`} className="report-item-description" title={row.itemDescription || "-"}>
                                        {row.itemDescription || "-"}
                                      </td>
                                    );
                                  }
                                  if (column.key === "location") {
                                    return <td key={`${row.key}-location`}>{row.location || "-"}</td>;
                                  }
                                  if (column.key === "purchaseDate") {
                                    return <td key={`${row.key}-purchaseDate`}>{formatDate(row.purchaseDate || "-")}</td>;
                                  }
                                  if (column.key === "lastServiceDate") {
                                    return (
                                      <td key={`${row.key}-lastServiceDate`}>
                                        {row.lastServiceDate && row.lastServiceDate !== "-" ? (
                                          <button
                                            type="button"
                                            className="report-service-link"
                                            onClick={() => {
                                              setTab("maintenance");
                                              setMaintenanceView("history");
                                              setMaintenanceDetailAssetId(row.assetDbId);
                                            }}
                                            title="Open maintenance history"
                                          >
                                            {formatDate(row.lastServiceDate)}
                                          </button>
                                        ) : (
                                          "-"
                                        )}
                                      </td>
                                    );
                                  }
                                  if (column.key === "assignedTo") {
                                    return <td key={`${row.key}-assignedTo`}>{row.assignedTo || "-"}</td>;
                                  }
                                  return <td key={`${row.key}-status`}>{row.status || "-"}</td>;
                                })}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={Math.max(assetMasterVisibleColumns.length, 1)}>No assets found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {reportType === "set_code" && (
              <div className="table-wrap report-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t.setCode}</th>
                      <th>{t.photo}</th>
                      <th>Main Set ({t.assetId})</th>
                      <th>Main Item</th>
                      <th>{t.campus}</th>
                      <th>Total Items</th>
                      <th>Connected Items</th>
                    </tr>
                  </thead>
                  <tbody>
                    {setCodeReportRows.length ? (
                      setCodeReportRows.map((row) => (
                        <tr key={`report-set-code-${row.key}`}>
                          <td><strong>{row.setCode}</strong></td>
                          <td>{renderAssetPhoto(row.mainPhoto || "", row.mainAssetId)}</td>
                          <td>{row.mainAssetId}</td>
                          <td>{row.mainItem}</td>
                          <td>{campusLabel(row.campus)}</td>
                          <td>{row.totalItems}</td>
                          <td>
                            {row.connectedItems.length ? (
                              <div className="set-code-connected-list">
                                {row.connectedItems.map((item) => (
                                  <div key={`${row.key}-${item.assetId}`} className="set-code-connected-item">
                                    {renderAssetPhoto(item.photo || "", item.assetId)}
                                    <span>{item.assetId} ({item.itemName})</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7}>No set code records found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {reportType === "overdue" && (
              <div className="table-wrap report-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Next Date</th>
                      <th>{t.assetId}</th>
                      <th>{t.campus}</th>
                      <th>{t.status}</th>
                      <th>Schedule Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueScheduleAssets.length ? (
                      overdueScheduleAssets.map((a) => (
                        <tr key={`report-overdue-${a.id}`}>
                          <td>{formatDate(a.nextMaintenanceDate || "-")}</td>
                          <td><strong>{a.assetId}</strong></td>
                          <td>{campusLabel(a.campus)}</td>
                          <td>{assetStatusLabel(a.status || "-")}</td>
                          <td>{a.scheduleNote || "-"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5}>No overdue maintenance.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {reportType === "asset_by_location" && (
              <div className="table-wrap report-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t.campus}</th>
                      <th>{t.location}</th>
                      <th>Total Units</th>
                      <th>IT Units</th>
                      <th>Safety Units</th>
                      <th>Item Breakdown</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locationAssetSummaryRows.length ? (
                      locationAssetSummaryRows.map((row) => (
                        <tr key={`report-loc-${row.campus}-${row.location}`}>
                          <td>{campusLabel(row.campus)}</td>
                          <td>{row.location}</td>
                          <td><strong>{row.total}</strong></td>
                          <td>{row.it}</td>
                          <td>{row.safety}</td>
                          <td>{row.itemSummary || "-"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6}>No assets by location yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {reportType === "transfer" && (
              <div className="table-wrap report-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>{t.assetId}</th>
                      <th>From Campus</th>
                      <th>From Location</th>
                      <th>To Campus</th>
                      <th>To Location</th>
                      <th>From Staff</th>
                      <th>To Staff</th>
                      <th>Ack</th>
                      <th>By</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allTransferRows.length ? (
                      allTransferRows.map((r) => (
                        <tr key={`report-transfer-${r.rowId}`}>
                          <td>{r.date ? formatDate(r.date) : "-"}</td>
                          <td><strong>{r.assetId}</strong></td>
                          <td>{campusLabel(r.fromCampus)}</td>
                          <td>{r.fromLocation || "-"}</td>
                          <td>{campusLabel(r.toCampus)}</td>
                          <td>{r.toLocation || "-"}</td>
                          <td>{r.fromUser || "-"}</td>
                          <td>{r.toUser || "-"}</td>
                          <td>{r.responsibilityAck}</td>
                          <td>{r.by || "-"}</td>
                          <td>{r.reason || "-"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={11}>No transfer history.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {reportType === "staff_borrowing" && (
              <div className="table-wrap report-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t.assetId}</th>
                      <th>{t.photo}</th>
                      <th>{t.name}</th>
                      <th>{t.campus}</th>
                      <th>{t.location}</th>
                      <th>Assigned To</th>
                      <th>Since</th>
                      <th>Ack</th>
                      <th>Last Action</th>
                      <th>{t.notes}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffBorrowingRows.length ? (
                      staffBorrowingRows.map((r) => (
                        <tr key={`report-staff-borrow-${r.assetDbId}`}>
                          <td><strong>{r.assetId}</strong></td>
                          <td>{renderAssetPhoto(r.assetPhoto || "", r.assetId)}</td>
                          <td>{r.itemName}</td>
                          <td>{campusLabel(r.campus)}</td>
                          <td>{r.location || "-"}</td>
                          <td>{r.assignedTo || "-"}</td>
                          <td>{formatDate(r.sinceDate || "-")}</td>
                          <td>{r.responsibilityAck}</td>
                          <td>{r.lastAction || "-"}</td>
                          <td>{r.note || "-"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={10}>No staff borrowing records.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {reportType === "qr_labels" && (
              <div className="qr-label-grid">
                {qrFilteredRows.length ? (
                  qrFilteredRows.map((row) => (
                    <article className="qr-label-card" key={`qr-label-${row.assetDbId}`}>
                      <div className="qr-label-image-wrap">
                        {qrCodeMap[row.assetId] ? (
                          <img src={qrCodeMap[row.assetId]} alt={`QR ${row.assetId}`} className="qr-label-image" />
                        ) : (
                          <div className="qr-label-image qr-label-placeholder">Generating QR...</div>
                        )}
                      </div>
                      <div className="qr-label-meta">
                        <div className="qr-label-asset-id">{row.assetId}</div>
                        <div>{row.itemName}</div>
                        <div>{campusLabel(row.campus)} | {row.location || "-"}</div>
                        <div>Status: {assetStatusLabel(row.status || "-")} | SN: {String(row.serialNumber || "").trim() || "-"}</div>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="panel-note">No assets match selected filters.</div>
                )}
              </div>
            )}

            {reportType === "maintenance_completion" && (
              <>
                <div className="table-wrap report-table-wrap" style={{ marginTop: 12 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>{t.assetId}</th>
                        <th>Asset Photo</th>
                        <th>Maintenance Photo</th>
                        <th>{t.campus}</th>
                        <th>Type</th>
                        <th>Work Status</th>
                        <th>Condition</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {maintenanceCompletionRows.length ? (
                        maintenanceCompletionRows.map((r) => (
                          <tr key={`report-completion-${r.rowId}`}>
                            <td>{formatDate(r.date || "-")}</td>
                            <td><strong>{r.assetId}</strong></td>
                            <td>{renderAssetPhoto(r.assetPhoto || "", r.assetId)}</td>
                            <td>{renderAssetPhoto(r.photo || "", "maintenance")}</td>
                            <td>{campusLabel(r.campus)}</td>
                            <td>{r.type || "-"}</td>
                            <td>{r.completion || "-"}</td>
                            <td>{r.condition || "-"}</td>
                            <td>{r.note || "-"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={9}>No maintenance records in selected range.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {reportType === "verification_summary" && (
              <>
                <div className="stats-grid">
                  <article className="stat-card">
                    <div className="stat-label">Total Records</div>
                    <div className="stat-value">{verificationSummary.total}</div>
                  </article>
                  <article className="stat-card">
                    <div className="stat-label">Verified</div>
                    <div className="stat-value">{verificationSummary.verified}</div>
                  </article>
                  <article className="stat-card">
                    <div className="stat-label">Issue Found</div>
                    <div className="stat-value">{verificationSummary.issue}</div>
                  </article>
                  <article className="stat-card">
                    <div className="stat-label">Missing</div>
                    <div className="stat-value">{verificationSummary.missing}</div>
                  </article>
                </div>
                <div className="table-wrap report-table-wrap" style={{ marginTop: 12 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>{t.date}</th>
                        <th>{t.assetId}</th>
                        <th>Asset Photo</th>
                        <th>Verification Photo</th>
                        <th>{t.campus}</th>
                        <th>{t.verificationResult}</th>
                        <th>Condition</th>
                        <th>{t.notes}</th>
                        <th>{t.by}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {verificationSummaryRows.length ? (
                        verificationSummaryRows.map((r) => (
                          <tr key={`report-verify-${r.rowId}`}>
                            <td>{formatDate(r.date || "-")}</td>
                            <td><strong>{r.assetId}</strong></td>
                            <td>{renderAssetPhoto(r.assetPhoto || "", r.assetId)}</td>
                            <td>{renderAssetPhoto(r.photo || "", "verification")}</td>
                            <td>{campusLabel(r.campus)}</td>
                            <td>{r.result || "-"}</td>
                            <td>{r.condition || "-"}</td>
                            <td>{r.note || "-"}</td>
                            <td>{r.by || "-"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={9}>No verification records in selected period.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        )}

        {tab === "setup" && (
          <>
          <section className="panel">
            <div className="row-actions setup-tabs-row">
              {canAccessMenu("setup.campus", "setup") ? (
                <button className={`tab ${setupView === "campus" ? "tab-active" : ""}`} onClick={() => setSetupView("campus")}>
                  {t.campusNameSetup}
                </button>
              ) : null}
              {canAccessMenu("setup.users", "setup") ? (
                <button className={`tab ${setupView === "users" ? "tab-active" : ""}`} onClick={() => setSetupView("users")}>
                  {t.userSetup}
                </button>
              ) : null}
              {canAccessMenu("setup.permissions", "setup") ? (
                <button className={`tab ${setupView === "permissions" ? "tab-active" : ""}`} onClick={() => setSetupView("permissions")}>
                  {t.accountPermissionSetup}
                </button>
              ) : null}
              {canAccessMenu("setup.backup", "setup") ? (
                <button className={`tab ${setupView === "backup" ? "tab-active" : ""}`} onClick={() => setSetupView("backup")}>
                  Backup & Audit
                </button>
              ) : null}
              {canAccessMenu("setup.items", "setup") ? (
                <button className={`tab ${setupView === "items" ? "tab-active" : ""}`} onClick={() => setSetupView("items")}>
                  {t.itemNameSetup}
                </button>
              ) : null}
              {canAccessMenu("setup.locations", "setup") ? (
                <button className={`tab ${setupView === "locations" ? "tab-active" : ""}`} onClick={() => setSetupView("locations")}>
                  {t.locationSetup}
                </button>
              ) : null}
              {canAccessMenu("setup.calendar", "setup") ? (
                <button className={`tab ${setupView === "calendar" ? "tab-active" : ""}`} onClick={() => setSetupView("calendar")}>
                  Calendar Event Setup
                </button>
              ) : null}
            </div>
          </section>

          {setupView === "campus" && canAccessMenu("setup.campus", "setup") && (
          <section className="panel">
            <h2>{t.campusNameSetup}</h2>
            <p className="tiny">{t.campusFixedHelp}</p>
            <div className="form-grid">
              <label className="field">
                <span>{t.campusCode}</span>
                <select
                  className="input"
                  value={campusEditCode}
                  onChange={(e) => setCampusEditCode(e.target.value)}
                >
                  {Object.values(CAMPUS_CODE).map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t.campusName}</span>
                <input
                  className="input"
                  value={campusEditName}
                  onChange={(e) => setCampusEditName(e.target.value)}
                />
              </label>
            </div>
            <div className="asset-actions">
              <div className="tiny">{t.updateCampusName}</div>
                <button className="btn-primary" disabled={!isAdmin} onClick={saveCampusNameByCode}>
                  {t.updateCampusName}
                </button>
            </div>
            {setupMessage ? <p className="tiny">{setupMessage}</p> : null}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t.campusCode}</th>
                    <th>{t.campusName}</th>
                    <th>{t.edit}</th>
                    <th>{t.save}</th>
                  </tr>
                </thead>
                <tbody>
                  {CAMPUS_LIST.map((campus) => (
                    <tr key={campus}>
                      <td><strong>{CAMPUS_CODE[campus] || "CX"}</strong></td>
                      <td>
                        <input
                          className="input"
                          value={campusDraftNames[campus] || ""}
                          onChange={(e) =>
                            setCampusDraftNames((prev) => ({
                              ...prev,
                              [campus]: e.target.value,
                            }))
                          }
                        />
                      </td>
                      <td>
                        <button
                          className="tab"
                          onClick={() => {
                            setCampusEditCode(CAMPUS_CODE[campus] || "C1");
                            setCampusEditName(campusDraftNames[campus] || campus);
                          }}
                        >
                          {t.edit}
                        </button>
                      </td>
                      <td>
                        <button className="btn-primary" disabled={!isAdmin} onClick={() => saveCampusNameByRow(campus)}>
                          Save
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          )}

          {setupView === "users" && canAccessMenu("setup.users", "setup") && (
          <section className="panel">
            <h2>{t.userSetup}</h2>
            <div className="form-grid">
              <label className="field">
                <span>{t.staffFullName}</span>
                <input
                  className="input"
                  value={userForm.fullName}
                  onChange={(e) => setUserForm((f) => ({ ...f, fullName: e.target.value }))}
                />
              </label>
              <label className="field">
                <span>{t.position}</span>
                <input
                  className="input"
                  value={userForm.position}
                  onChange={(e) => setUserForm((f) => ({ ...f, position: e.target.value }))}
                />
              </label>
              <label className="field field-wide">
                <span>{t.email} ({lang === "km" ? "ជាជម្រើស" : "Optional"})</span>
                <input
                  className="input"
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))}
                />
              </label>
            </div>
            <div className="asset-actions">
              <div className="tiny">{t.manageAssignableUsers}</div>
              <div style={{ display: "flex", gap: 8 }}>
                {editingUserId !== null ? (
                  <button className="tab" onClick={() => { setEditingUserId(null); setUserForm({ fullName: "", position: "", email: "" }); }}>{t.cancelEdit}</button>
                ) : null}
                <button className="btn-primary" disabled={busy || !isAdmin} onClick={createOrUpdateUser}>
                  {editingUserId !== null ? t.updateUser : t.addUser}
                </button>
              </div>
            </div>
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>{t.staffFullName}</th>
                    <th>{t.position}</th>
                    <th>{t.email}</th>
                    <th>{t.edit}</th>
                    <th>{t.delete}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length ? (
                    users.map((u) => (
                      <tr key={u.id}>
                        <td>{u.fullName}</td>
                        <td>{u.position}</td>
                        <td>{u.email || "-"}</td>
                        <td><button className="tab" disabled={!isAdmin} onClick={() => startEditUser(u)}>{t.edit}</button></td>
                        <td><button className="btn-danger" disabled={!isAdmin} onClick={() => deleteUser(u.id)}>X</button></td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}>{t.noUsersYet}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          )}

          {setupView === "permissions" && canAccessMenu("setup.permissions", "setup") && (
          <section className="panel">
            <h2>{t.accountPermissionSetup}</h2>
            <p className="tiny">{t.permissionHelp}</p>
            <div className="form-grid" style={{ marginTop: 12 }}>
              <label className="field">
                <span>{t.selectStaffOptional}</span>
                <select
                  className="input"
                  value={authCreateForm.staffId}
                  disabled={!isAdmin || editingAuthUserId !== null}
                  onChange={(e) => {
                    const staffId = e.target.value;
                    const staff = users.find((u) => String(u.id) === staffId);
                    const suggestedUsername = (staff?.fullName || "")
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, ".")
                      .replace(/^\.+|\.+$/g, "");
                    setAuthCreateForm((prev) => ({
                      ...prev,
                      staffId,
                      displayName: staff?.fullName || prev.displayName,
                      username: prev.username || suggestedUsername,
                    }));
                  }}
                >
                  <option value="">-</option>
                  {users.map((u) => (
                    <option key={`staff-auth-${u.id}`} value={u.id}>
                      {u.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t.usernameLabel}</span>
                <input
                  className="input"
                  value={authCreateForm.username}
                  disabled={!isAdmin}
                  onChange={(e) => setAuthCreateForm((f) => ({ ...f, username: e.target.value }))}
                />
              </label>
              <label className="field">
                <span>{t.password}</span>
                <input
                  className="input"
                  type="text"
                  placeholder={editingAuthUserId !== null ? "Leave blank to keep current password" : ""}
                  value={authCreateForm.password}
                  disabled={!isAdmin}
                  onChange={(e) => setAuthCreateForm((f) => ({ ...f, password: e.target.value }))}
                />
              </label>
              <label className="field">
                <span>{t.displayName}</span>
                <input
                  className="input"
                  value={authCreateForm.displayName}
                  disabled={!isAdmin}
                  onChange={(e) => setAuthCreateForm((f) => ({ ...f, displayName: e.target.value }))}
                />
              </label>
              <label className="field">
                <span>{t.role}</span>
                <select
                  className="input"
                  value={authCreateForm.role}
                  disabled={!isAdmin}
                  onChange={(e) =>
                    setAuthCreateForm((f) => {
                      const nextRole = normalizeRole(e.target.value);
                      const nextModules = isAdminRole(nextRole) ? [...ALL_NAV_MODULES] : [...DEFAULT_VIEWER_MODULES];
                      const nextAssetAccess = isAdminRole(nextRole) ? f.assetSubviewAccess : "list_only";
                      const nextCampuses = normalizeRoleCampuses(nextRole, f.campuses);
                      return {
                        ...f,
                        role: nextRole,
                        campuses: nextRole === "Super Admin" ? ["ALL"] : (nextCampuses.length ? nextCampuses : [CAMPUS_LIST[0]]),
                        modules: nextModules,
                        assetSubviewAccess: nextAssetAccess,
                        menuAccess: defaultMenuAccessFor(nextRole, nextModules, nextAssetAccess),
                      };
                    })
                  }
                >
                  <option value="Super Admin">Super Admin</option>
                  <option value="Admin">Admin</option>
                  <option value="Viewer">Viewer</option>
                </select>
              </label>
              <label className="field">
                <span>{t.accessCampus}</span>
                <details className="filter-menu">
                  <summary>
                    {authCreateForm.role === "Super Admin"
                      ? t.allCampuses
                      : authCreateForm.campuses.length === 1
                        ? campusLabel(authCreateForm.campuses[0])
                        : `${authCreateForm.campuses.length} campuses`}
                  </summary>
                  <div className="filter-menu-list" style={{ maxHeight: 220 }}>
                    {CAMPUS_LIST.map((campus) => (
                      <label key={`new-auth-campus-${campus}`} className="filter-menu-item">
                        <input
                          type="checkbox"
                          checked={authCreateForm.role === "Super Admin" || authCreateForm.campuses.includes(campus)}
                          disabled={!isAdmin || authCreateForm.role === "Super Admin"}
                          onChange={(e) =>
                            setAuthCreateForm((f) => ({
                              ...f,
                              campuses: toggleCampusAccess(f.campuses, campus, e.target.checked),
                            }))
                          }
                        />
                        <span>{campusLabel(campus)}</span>
                      </label>
                    ))}
                  </div>
                </details>
              </label>
              <label className="field">
                <span>Assets Tab Access</span>
                <select
                  className="input"
                  value={authCreateForm.assetSubviewAccess}
                  disabled={!isAdmin}
                  onChange={(e) =>
                    setAuthCreateForm((f) => {
                      const nextAssetAccess = normalizeAssetSubviewAccess(e.target.value);
                      return {
                        ...f,
                        assetSubviewAccess: nextAssetAccess,
                        menuAccess: normalizeMenuAccess(f.role, f.modules, nextAssetAccess, f.menuAccess),
                      };
                    })
                  }
                >
                  <option value="both">Register + List</option>
                  <option value="list_only">List Only</option>
                </select>
              </label>
              <label className="field field-wide">
                <span>Menu & Submenu Access</span>
                <div className="permission-access-tools">
                  <span className="tiny">
                    {countEnabledMenuChildren(authCreateForm.menuAccess)} submenu permissions selected
                  </span>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="tab"
                      disabled={!isAdmin}
                      onClick={() =>
                        setAuthCreateForm((f) => ({
                          ...f,
                          menuAccess: defaultMenuAccessFor(f.role, f.modules, f.assetSubviewAccess),
                        }))
                      }
                    >
                      {lang === "km" ? "ជ្រើសតាមតួនាទី" : "Role Default"}
                    </button>
                    <button
                      type="button"
                      className="tab"
                      disabled={!isAdmin}
                      onClick={() =>
                        setAuthCreateForm((f) => ({
                          ...f,
                          menuAccess: normalizeMenuAccess(f.role, f.modules, f.assetSubviewAccess, []),
                        }))
                      }
                    >
                      {lang === "km" ? "ដកទាំងអស់" : "Clear"}
                    </button>
                  </div>
                </div>
                <details className="filter-menu">
                  <summary>{lang === "km" ? "ជ្រើសម៉ឺនុយដែលអាចមើលឃើញ" : "Select visible menus"}</summary>
                  <div className="filter-menu-list" style={{ maxHeight: 360 }}>
                    {MENU_ACCESS_TREE.map((node) => {
                      const moduleChecked = isModuleFullyChecked(authCreateForm.menuAccess, node.module);
                      return (
                        <div key={`create-menu-${node.module}`} style={{ padding: "4px 0 8px" }}>
                          <label className="filter-menu-item" style={{ fontWeight: 700 }}>
                            <input
                              type="checkbox"
                              checked={moduleChecked}
                              onChange={(e) =>
                                setAuthCreateForm((f) => ({
                                  ...f,
                                  menuAccess: normalizeMenuAccess(
                                    f.role,
                                    f.modules,
                                    f.assetSubviewAccess,
                                    toggleModuleAccess(f.menuAccess, node.module, e.target.checked)
                                  ),
                                }))
                              }
                            />
                            <span>{lang === "km" ? node.labelKm : node.labelEn}</span>
                          </label>
                          {node.children.map((child) => (
                            <label key={`create-menu-child-${child.key}`} className="filter-menu-item" style={{ paddingLeft: 24 }}>
                              <input
                                type="checkbox"
                                checked={authCreateForm.menuAccess.includes(child.key)}
                                onChange={(e) =>
                                  setAuthCreateForm((f) => ({
                                    ...f,
                                    menuAccess: normalizeMenuAccess(
                                      f.role,
                                      f.modules,
                                      f.assetSubviewAccess,
                                      toggleChildAccess(f.menuAccess, node.module, child.key, e.target.checked)
                                    ),
                                  }))
                                }
                                disabled={
                                  child.key === "assets.register" &&
                                  (!isAdminRole(authCreateForm.role) || authCreateForm.assetSubviewAccess === "list_only")
                                }
                              />
                              <span>{lang === "km" ? child.labelKm : child.labelEn}</span>
                            </label>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </details>
              </label>
            </div>
            <div className="asset-actions">
              <div className="tiny">
                {editingAuthUserId !== null
                  ? `Editing account ID: ${editingAuthUserId}`
                  : t.addLoginAccount}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {editingAuthUserId !== null ? (
                  <button className="tab" disabled={!isAdmin || busy} onClick={resetAuthCreateForm}>
                    {t.cancelEdit}
                  </button>
                ) : null}
                <button className="btn-primary" disabled={!isAdmin || busy} onClick={createAuthAccount}>
                  {editingAuthUserId !== null ? "Update Account" : t.addLoginAccount}
                </button>
              </div>
            </div>
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table className="permission-user-table">
                <thead>
                  <tr>
                    <th>{t.usernameLabel}</th>
                    <th>{t.displayName}</th>
                    <th>{t.role}</th>
                    <th>{t.accessCampus}</th>
                    <th>Assets Tab Access</th>
                    <th>Menu Access</th>
                    <th>{t.edit}</th>
                    <th>{lang === "km" ? "កំណត់ពាក្យសម្ងាត់ឡើងវិញ" : "Reset Password"}</th>
                  </tr>
                </thead>
                <tbody>
                  {authAccounts.length ? (
                    authAccounts.map((u) => {
                      const rowRole = normalizeRole(u.role);
                      const rowCampuses = normalizeRoleCampuses(rowRole, u.campuses);
                      const rowAssetAccess = normalizeAssetSubviewAccess((u as { assetSubviewAccess?: unknown }).assetSubviewAccess);
                      const rowMenuAccess = normalizeMenuAccess(
                        rowRole,
                        Array.isArray(u.modules) && u.modules.length ? u.modules : normalizeModulesByRole(rowRole, []),
                        rowAssetAccess,
                        (u as { menuAccess?: unknown }).menuAccess
                      );
                      const campusText =
                        rowRole === "Super Admin"
                          ? t.allCampuses
                          : rowCampuses.length
                            ? rowCampuses.map((campus) => CAMPUS_CODE[campus] || campus).join(", ")
                            : "0 campuses";
                      return (
                        <tr key={`auth-perm-${u.id}`}>
                          <td><strong>{u.username}</strong></td>
                          <td>{u.displayName}</td>
                          <td>{rowRole}</td>
                          <td>{campusText}</td>
                          <td>{rowAssetAccess === "list_only" ? "List Only" : "Register + List"}</td>
                          <td>{`Set Menu Access (${countEnabledMenuChildren(rowMenuAccess)})`}</td>
                          <td>
                            <button className="tab" disabled={!isAdmin || busy} onClick={() => startEditAuthAccount(u)}>
                              {t.edit}
                            </button>
                          </td>
                          <td>
                            <button className="tab" disabled={!isAdmin || busy} onClick={() => resetAuthAccountPassword(u)}>
                              {lang === "km" ? "កំណត់ឡើងវិញ" : "Reset"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8}>{t.noLoginUsersFound}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          )}

          {setupView === "backup" && canAccessMenu("setup.backup", "setup") && (
          <section className="panel">
            <h2>Backup & Audit</h2>
            <p className="backup-subline">Backup database to file, restore when needed, and track user actions.</p>
            <div className="asset-actions">
              <div className="backup-action-row">
                <button className="btn-primary backup-action-btn" disabled={!isAdmin || busy} onClick={createServerBackup}>
                  Create Server Backup
                </button>
                <button className="tab backup-action-btn" disabled={!isAdmin || busy} onClick={exportBackupFile}>
                  Download Backup
                </button>
                <button className="tab backup-action-btn" disabled={!isAdmin || busy} onClick={syncFromLiveWeb}>
                  Sync From Live Web
                </button>
                <label className={`tab backup-action-btn ${isAdmin && !busy ? "backup-action-btn-enabled" : "backup-action-btn-disabled"}`}>
                  Restore Backup
                  <input
                    key={backupImportKey}
                    type="file"
                    accept=".json,application/json"
                    disabled={!isAdmin || busy}
                    onChange={importBackupFile}
                    style={{ display: "none" }}
                  />
                </label>
                <button
                  className="btn-danger backup-action-btn backup-action-btn-danger"
                  disabled={!isAdmin || busy}
                  onClick={factoryResetSystem}
                  title="Delete all records and restart from zero"
                >
                  Factory Reset
                </button>
              </div>
            </div>
            {setupMessage ? <p className="tiny" style={{ marginTop: 8 }}>{setupMessage}</p> : null}

            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Entity ID</th>
                    <th>By</th>
                    <th>Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length ? (
                    auditLogs.map((log) => (
                      <tr key={`audit-${log.id}`}>
                        <td>{formatDateTime(log.date || "-")}</td>
                        <td>{log.action || "-"}</td>
                        <td>{log.entity || "-"}</td>
                        <td><strong>{log.entityId || "-"}</strong></td>
                        <td>{log.actor?.displayName || log.actor?.username || "-"}</td>
                        <td>{log.summary || "-"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>No audit logs yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          )}

          {setupView === "items" && canAccessMenu("setup.items", "setup") && (
          <section className="panel">
            <h2>{t.itemNameSetup}</h2>
            <div className="form-grid">
              <label className="field">
                <span>{t.category}</span>
                <select
                  className="input"
                  value={newItemTypeForm.category}
                  disabled={!isAdmin}
                  onChange={(e) =>
                    setNewItemTypeForm((f) => ({ ...f, category: e.target.value }))
                  }
                >
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={`new-item-cat-${cat.value}`} value={cat.value}>
                      {cat.value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t.typeCode}</span>
                <input
                  className="input"
                  placeholder={t.typeCodeExample}
                  value={newItemTypeForm.code}
                  disabled={!isAdmin}
                  onChange={(e) =>
                    setNewItemTypeForm((f) => ({
                      ...f,
                      code: e.target.value.toUpperCase().replace(/\s+/g, ""),
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>{t.itemName}</span>
                <input
                  className="input"
                  placeholder={t.itemNameExample}
                  value={newItemTypeForm.name}
                  disabled={!isAdmin}
                  onChange={(e) =>
                    setNewItemTypeForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </label>
            </div>
            <div className="asset-actions">
              <div className="tiny">{t.addNewTypeHelp}</div>
              <button className="btn-primary" disabled={!isAdmin} onClick={addItemType}>
                {t.addItemType}
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t.category}</th>
                    <th>{t.typeCode}</th>
                    <th>Icon</th>
                    <th>{t.itemName}</th>
                  </tr>
                </thead>
                <tbody>
                  {itemSetupRows.map((row) => (
                    <tr key={row.key}>
                      <td>{row.category}</td>
                      <td><strong>{row.code}</strong></td>
                      <td>
                        <span className="item-setup-icon" aria-hidden="true">
                          {itemTypeIcon(row.category, row.code, itemNames[row.key] || "")}
                        </span>
                      </td>
                      <td>
                        <input
                          className="input"
                          value={itemNames[row.key] || ""}
                          onChange={(e) => setItemNames((prev) => ({ ...prev, [row.key]: e.target.value }))}
                          disabled={!isAdmin}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          )}

          {setupView === "locations" && canAccessMenu("setup.locations", "setup") && (
          <section className="panel">
            <h2>{t.locationSetup}</h2>
            <div className="form-grid">
              <label className="field">
                <span>{t.campus}</span>
                <select className="input" value={locationCampus} onChange={(e) => setLocationCampus(e.target.value)}>
                  {CAMPUS_LIST.map((campus) => (
                    <option key={campus} value={campus}>{campusLabel(campus)}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t.locationName}</span>
                <input className="input" value={locationName} onChange={(e) => setLocationName(e.target.value)} />
              </label>
            </div>
            <div className="asset-actions">
              <div className="tiny">{campusLabel(locationCampus)}</div>
              <div style={{ display: "flex", gap: 8 }}>
                {editingLocationId ? (
                  <button className="tab" onClick={cancelEditLocation}>{t.cancelEdit}</button>
                ) : null}
                <button className="btn-primary" disabled={busy || !isAdmin} onClick={createOrUpdateLocation}>
                  {editingLocationId ? t.updateLocation : t.addLocation}
                </button>
              </div>
            </div>

            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>{t.campus}</th>
                    <th>{t.locationName}</th>
                    <th>{t.edit}</th>
                    <th>{t.delete}</th>
                  </tr>
                </thead>
                <tbody>
                  {setupLocations.length ? (
                    setupLocations.map((loc) => (
                      <tr key={loc.id}>
                        <td>{campusLabel(loc.campus)}</td>
                        <td>{loc.name}</td>
                        <td>
                          <button className="tab" disabled={!isAdmin} onClick={() => startEditLocation(loc)}>{t.edit}</button>
                        </td>
                        <td>
                          <button className="btn-danger" disabled={!isAdmin} onClick={() => deleteLocation(loc.id)}>X</button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4}>{t.noLocationsYet}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          )}

          {setupView === "calendar" && canAccessMenu("setup.calendar", "setup") && (
          <section className="panel">
            <h2>Calendar Event Setup</h2>
            <p className="tiny">Manage holidays and school events from here. Changes apply to all calendar views.</p>
            <div className="form-grid">
              <label className="field">
                <span>{t.date}</span>
                <input
                  type="date"
                  className="input"
                  value={calendarEventForm.date}
                  onChange={(e) => setCalendarEventForm((f) => ({ ...f, date: e.target.value }))}
                />
              </label>
              <label className="field">
                <span>Event Type</span>
                <select
                  className="input"
                  value={calendarEventForm.type}
                  onChange={(e) =>
                    setCalendarEventForm((f) => ({
                      ...f,
                      type: normalizeCalendarEventType(e.target.value),
                    }))
                  }
                >
                  {CALENDAR_EVENT_TYPE_OPTIONS.map((opt) => (
                    <option key={`calendar-type-${opt.value}`} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <div className="calendar-type-legend">
                  {CALENDAR_EVENT_TYPE_OPTIONS.map((opt) => (
                    <span key={`calendar-type-legend-${opt.value}`} className={`calendar-type-badge calendar-type-${opt.value}`}>
                      {opt.label}
                    </span>
                  ))}
                </div>
              </label>
              <label className="field field-wide">
                <span>Event Name</span>
                <input
                  className="input"
                  value={calendarEventForm.name}
                  onChange={(e) => setCalendarEventForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Example: PTC for Term 3"
                />
              </label>
            </div>
            <div className="asset-actions">
              <div className="tiny">Use this for holiday, PTC, term dates, camp, and school events.</div>
              <div style={{ display: "flex", gap: 8 }}>
                {editingCalendarEventId !== null ? (
                  <button className="tab" onClick={cancelEditCalendarEvent}>Cancel</button>
                ) : null}
                <button className="btn-primary" disabled={busy || !isAdmin} onClick={createOrUpdateCalendarEvent}>
                  {editingCalendarEventId === null ? "Add Event" : "Update Event"}
                </button>
              </div>
            </div>
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>{t.date}</th>
                    <th>Type</th>
                    <th>Name</th>
                    <th>{t.edit}</th>
                    <th>{t.delete}</th>
                  </tr>
                </thead>
                <tbody>
                  {calendarEvents.length ? (
                    calendarEvents.map((row) => (
                      <tr key={`calendar-event-${row.id}`}>
                        <td>{formatDate(row.date)}</td>
                        <td>
                          <span className={`calendar-type-badge calendar-type-${normalizeCalendarEventType(row.type)}`}>
                            {calendarEventTypeLabel(normalizeCalendarEventType(row.type))}
                          </span>
                        </td>
                        <td>{row.name}</td>
                        <td>
                          <button className="tab" disabled={!isAdmin} onClick={() => startEditCalendarEvent(row)}>
                            {t.edit}
                          </button>
                        </td>
                        <td>
                          <button className="btn-danger" disabled={!isAdmin} onClick={() => deleteCalendarEvent(row.id)}>X</button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}>No calendar events yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          )}
          </>
        )}
          </section>
        </section>

        {isPhoneView ? (
          null
        ) : null}

        {inventoryQuickOutModal ? (
          <div className="modal-backdrop" onClick={closeInventoryQuickOut}>
            <section className="panel modal-panel inventory-quickout-modal" onClick={(e) => e.stopPropagation()}>
              <div className="panel-row">
                <h2>{lang === "km" ? "កត់ត្រាចេញស្តុកលឿន" : "Quick Stock Out"}</h2>
                <button className="tab" onClick={closeInventoryQuickOut}>{t.close}</button>
              </div>
              {inventoryQuickOutSelectedItem ? (
                <>
                  <div className="inventory-quickout-hero-icon-wrap" aria-hidden="true">
                    <span className="inventory-quickout-hero-icon">
                      {inventorySupplyIcon(inventoryQuickOutSelectedItem.itemName)}
                    </span>
                  </div>
                  {(() => {
                    const currentStock = inventoryStockMap.get(inventoryQuickOutSelectedItem.id) || 0;
                    const isLowStock = currentStock <= Number(inventoryQuickOutSelectedItem.minStock || 0);
                    return (
                      <div className="inventory-daily-stock-note inventory-quickout-stock-note-grid">
                        <div className="inventory-quickout-item-col">
                          <div className="inventory-quickout-item-line">
                            <strong>{inventoryQuickOutSelectedItem.itemCode}</strong> - {inventoryQuickOutSelectedItem.itemName}
                          </div>
                          <div className="inventory-quickout-location-line">
                            <span>{lang === "km" ? "ទីតាំង" : "Location"}:</span> <strong>{inventoryQuickOutSelectedItem.location}</strong>
                          </div>
                        </div>
                        <div className={`inventory-quickout-stock-col ${isLowStock ? "is-low-stock" : ""}`}>
                          <div className="inventory-quickout-stock-label">{lang === "km" ? "ស្តុកបច្ចុប្បន្ន" : "Current Stock"}</div>
                          <div className="inventory-quickout-stock-value">{currentStock}</div>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="form-grid" style={{ marginTop: 10 }}>
                    <label className="field quickout-date-field">
                      <span>{t.date}</span>
                      <div className="quickout-date-input-wrap">
                        <input
                          className="input"
                          type="text"
                          readOnly
                          value={formatDate(inventoryQuickOutModal.date)}
                        />
                        <button
                          type="button"
                          className="quickout-date-icon-btn"
                          onClick={openQuickOutEcoPicker}
                          aria-label="Open Eco Calendar"
                        >
                          <Calendar size={18} />
                        </button>
                      </div>
                      {quickOutDateBadge ? (
                        <small className="tiny inventory-quickout-date-badge">{quickOutDateBadge}</small>
                      ) : null}
                      {quickOutEcoPickerOpen ? (
                        <div className="quickout-eco-inline-panel">
                          <strong className="quickout-eco-title">
                            {quickOutEcoMonth.toLocaleString(undefined, { month: "short", year: "numeric" })}
                          </strong>
                          <div className="calendar-grid quickout-eco-grid">
                            {quickOutEcoGridDays.map((d) => (
                              <button
                                key={`quickout-eco-day-${d.ymd}`}
                                type="button"
                                className={`calendar-day ${d.inMonth ? "" : "calendar-out"} ${quickOutEcoSelectedDate === d.ymd ? "calendar-selected" : ""} ${d.ymd === todayYmd ? "calendar-today" : ""} ${d.weekday === 0 || d.weekday === 6 ? "calendar-weekend" : ""} ${d.holidayName ? "calendar-holiday" : ""} ${d.holidayType ? `calendar-holiday-${d.holidayType}` : ""}`}
                                disabled={!d.inMonth}
                                onClick={() => {
                                  setQuickOutEcoSelectedDate(d.ymd);
                                  setInventoryQuickOutModal((prev) => (prev ? { ...prev, date: d.ymd } : prev));
                                  setQuickOutEcoPickerOpen(false);
                                }}
                              >
                                {d.inMonth ? <span>{d.day}</span> : null}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </label>
                    <label className="field">
                      <span>{lang === "km" ? "បរិមាណចេញ" : "Stock Out Qty"}</span>
                      <input
                        className="input inventory-daily-qty-input"
                        type="number"
                        min="0"
                        value={inventoryQuickOutModal.qty}
                        onChange={(e) => setInventoryQuickOutModal((prev) => (prev ? { ...prev, qty: e.target.value } : prev))}
                      />
                    </label>
                    <label className="field field-wide">
                      <span>{lang === "km" ? "រូបថតចេញស្តុក" : "Stock Out Photo"}</span>
                      <input
                        key={`quickout-photo-${inventoryQuickOutFileKey}`}
                        className="input"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={onInventoryQuickOutPhotoFile}
                      />
                      {inventoryQuickOutModal.photo ? (
                        <img src={inventoryQuickOutModal.photo} alt="stock out proof" className="inventory-quickout-photo-preview" />
                      ) : (
                        <small className="tiny">{lang === "km" ? "ត្រូវភ្ជាប់រូបថតមុនពេល Save" : "Photo is required before saving."}</small>
                      )}
                    </label>
                    <label className="field field-wide">
                      <div className="quickout-note-head">
                        <span>{t.notes}</span>
                        <button
                          type="button"
                          className="tab btn-small quickout-reason-btn"
                          title={lang === "km" ? "ហេតុផលចាស់ៗ" : "Previous reasons"}
                          onClick={() => setInventoryQuickReasonTipsOpen((v) => !v)}
                        >
                          <Lightbulb size={14} />
                          <span>{lang === "km" ? "គន្លឹះ" : "Tips"}</span>
                        </button>
                      </div>
                      <input
                        className="input"
                        value={inventoryQuickOutModal.note}
                        onChange={(e) => setInventoryQuickOutModal((prev) => (prev ? { ...prev, note: e.target.value } : prev))}
                        placeholder={lang === "km" ? "មូលហេតុចេញស្តុក" : "Reason for stock out"}
                      />
                      {inventoryQuickReasonTipsOpen && inventoryQuickOutReasonSuggestions.length ? (
                        <div className="quickout-reason-chips">
                          {inventoryQuickOutReasonSuggestions.map((reason, index) => (
                            <button
                              key={`quickout-reason-${index}`}
                              type="button"
                              className="tab btn-small quickout-reason-chip"
                              onClick={() =>
                                setInventoryQuickOutModal((prev) => (prev ? { ...prev, note: reason } : prev))
                              }
                            >
                              {reason}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </label>
                  </div>
                  <div className="asset-actions">
                    <div className="tiny">
                      {lang === "km"
                        ? "ប្រព័ន្ធកត់ត្រាអ្នកប្រើប្រាស់ចូលដោយស្វ័យប្រវត្តិ។"
                        : "Recorded by current login user automatically."}
                    </div>
                    <button
                      className="btn-primary"
                      onClick={saveInventoryQuickOut}
                      disabled={!inventoryQuickOutModal.itemId || !inventoryQuickOutModal.qty || !inventoryQuickOutModal.date || !inventoryQuickOutModal.photo}
                    >
                      {lang === "km" ? "រក្សាទុក OUT" : "Save Stock Out"}
                    </button>
                  </div>
                </>
              ) : (
                <p className="tiny">Item not found.</p>
              )}
            </section>
          </div>
        ) : null}
        {scheduleScopeModal ? (
          <div className="modal-backdrop" onClick={() => setScheduleScopeModal(null)}>
            <section className="panel modal-panel" onClick={(e) => e.stopPropagation()}>
              <div className="panel-row">
                <h2>{scheduleScopeModal.action === "edit" ? "Edit Recurring Schedule" : "Delete Recurring Schedule"}</h2>
                <button className="tab" onClick={() => setScheduleScopeModal(null)}>{t.close}</button>
              </div>
              {(() => {
                const asset = assets.find((a) => a.id === scheduleScopeModal.assetId);
                if (!asset) return <p className="tiny">Schedule not found.</p>;
                const itemName = assetItemName(asset.category, asset.type, asset.pcType || "");
                return (
                  <>
                    <p className="tiny" style={{ marginBottom: 12 }}>
                      {scheduleScopeModal.action === "edit"
                        ? `This item has multiple schedules (${itemName}). Choose scope like Google Calendar.`
                        : `Delete schedule for ${itemName}. Choose scope like Google Calendar.`}
                    </p>
                    <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                      <button className="tab" onClick={() => void applyScheduleScopeAction("single")}>
                        This schedule only
                      </button>
                      <button className="btn-danger" onClick={() => void applyScheduleScopeAction("all")}>
                        {scheduleScopeModal.action === "edit" ? "All same schedules" : "Delete all same schedules"}
                      </button>
                    </div>
                  </>
                );
              })()}
            </section>
          </div>
        ) : null}

        {scheduleQuickCreateOpen ? (
          <div className="modal-backdrop" onClick={() => setScheduleQuickCreateOpen(false)}>
            <section className="panel modal-panel" onClick={(e) => e.stopPropagation()}>
              <div className="panel-row">
                <h2>{lang === "km" ? "បង្កើតកាលវិភាគលឿន" : "Quick Create Schedule"}</h2>
                <button className="tab" onClick={() => setScheduleQuickCreateOpen(false)}>{t.close}</button>
              </div>
              <div className="form-grid">
                <label className="field">
                  <span>{t.campus}</span>
                  <select
                    className="input"
                    value={scheduleQuickFilterCampus}
                    onChange={(e) => {
                      setScheduleQuickFilterCampus(e.target.value);
                      setScheduleQuickFilterLocation("ALL");
                      setScheduleQuickFilterCategory("ALL");
                      setScheduleQuickFilterName("ALL");
                    }}
                  >
                    <option value="ALL">{t.allCampuses}</option>
                    {scheduleQuickFilterCampusOptions.map((campus) => (
                      <option key={`quick-schedule-campus-${campus}`} value={campus}>
                        {campusLabel(campus)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{t.location}</span>
                  <select
                    className="input"
                    value={scheduleQuickFilterLocation}
                    onChange={(e) => {
                      setScheduleQuickFilterLocation(e.target.value);
                      setScheduleQuickFilterCategory("ALL");
                      setScheduleQuickFilterName("ALL");
                    }}
                  >
                    <option value="ALL">{lang === "km" ? "ទីតាំងទាំងអស់" : "All Locations"}</option>
                    {scheduleQuickFilterLocationOptions.map((location) => (
                      <option key={`quick-schedule-location-${location}`} value={location}>
                        {location}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{t.category}</span>
                  <select
                    className="input"
                    value={scheduleQuickFilterCategory}
                    onChange={(e) => {
                      setScheduleQuickFilterCategory(e.target.value);
                      setScheduleQuickFilterName("ALL");
                    }}
                  >
                    <option value="ALL">{t.allCategories}</option>
                    {scheduleQuickFilterCategoryOptions.map((category) => (
                      <option key={`quick-schedule-category-${category}`} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{t.name}</span>
                  <select
                    className="input"
                    value={scheduleQuickFilterName}
                    onChange={(e) => setScheduleQuickFilterName(e.target.value)}
                  >
                    <option value="ALL">{lang === "km" ? "ឈ្មោះទាំងអស់" : "All Names"}</option>
                    {scheduleQuickFilterNameOptions.map((name) => (
                      <option key={`quick-schedule-name-${name}`} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field field-wide">
                  <span>Asset</span>
                  <AssetPicker
                    value={scheduleQuickForm.assetId}
                    assets={scheduleQuickFilteredAssets}
                    getLabel={(asset) => `${asset.assetId} - ${assetItemName(asset.category, asset.type, asset.pcType || "")} (${asset.type})`}
                    onChange={(assetId) => {
                      const asset = assets.find((a) => String(a.id) === assetId);
                      setScheduleQuickForm((f) => ({
                        ...f,
                        assetId,
                        note: asset?.scheduleNote || f.note,
                      }));
                    }}
                    placeholder={lang === "km" ? "ជ្រើស Asset តាមតម្រង" : "Select filtered asset"}
                    disabled={!scheduleQuickFilteredAssets.length}
                  />
                  <div className="tiny">
                    {scheduleQuickFilteredAssets.length
                      ? lang === "km"
                        ? `${scheduleQuickFilteredAssets.length} assets ត្រូវតាមតម្រងបច្ចុប្បន្ន`
                        : `${scheduleQuickFilteredAssets.length} assets match current filters`
                      : lang === "km"
                      ? "មិនមាន assets ត្រូវតាមតម្រងបច្ចុប្បន្ន។"
                      : "No assets match current filters."}
                  </div>
                </label>
                <label className="field field-wide">
                  <span>{lang === "km" ? "ព័ត៌មាន Asset ដែលបានជ្រើស" : "Selected Asset Details"}</span>
                  <div className="transfer-preview">
                    <div className="transfer-preview-photo">
                      {scheduleQuickSelectedAsset?.photo ? (
                        <img src={scheduleQuickSelectedAsset.photo} alt={scheduleQuickSelectedAsset.assetId} className="asset-picker-thumb" />
                      ) : (
                        <span className="asset-picker-thumb-empty">-</span>
                      )}
                    </div>
                    <div className="transfer-preview-meta">
                      <strong>
                        {scheduleQuickSelectedAsset
                          ? `${scheduleQuickSelectedAsset.assetId} - ${assetItemName(scheduleQuickSelectedAsset.category, scheduleQuickSelectedAsset.type, scheduleQuickSelectedAsset.pcType || "")}`
                          : "-"}
                      </strong>
                      <span>
                        {scheduleQuickSelectedAsset
                          ? `${campusLabel(scheduleQuickSelectedAsset.campus)} • ${scheduleQuickSelectedAsset.location || "-"}`
                          : "-"}
                      </span>
                      <span>
                        {scheduleQuickSelectedAsset
                          ? `${scheduleQuickSelectedAsset.category} • ${scheduleQuickSelectedAsset.type}`
                          : "-"}
                      </span>
                    </div>
                  </div>
                </label>
                <label className="field">
                  <span>Date</span>
                  <input
                    type="date"
                    className="input"
                    min={todayYmd}
                    value={scheduleQuickForm.date}
                    onChange={(e) => setScheduleQuickForm((f) => ({ ...f, date: e.target.value }))}
                    disabled={scheduleQuickForm.repeatMode === "MONTHLY_WEEKDAY"}
                  />
                </label>
                <label className="field">
                  <span>Repeat</span>
                  <select
                    className="input"
                    value={scheduleQuickForm.repeatMode}
                    onChange={(e) =>
                      setScheduleQuickForm((f) => ({
                        ...f,
                        repeatMode: e.target.value as "NONE" | "MONTHLY_WEEKDAY",
                      }))
                    }
                  >
                    <option value="NONE">Does not repeat</option>
                    <option value="MONTHLY_WEEKDAY">
                      {monthlyRepeatLabel(scheduleQuickForm.repeatWeekOfMonth, scheduleQuickForm.repeatWeekday)}
                    </option>
                  </select>
                </label>
                <label className="field">
                  <span>Week of Month</span>
                  <select
                    className="input"
                    value={scheduleQuickForm.repeatWeekOfMonth}
                    onChange={(e) =>
                      setScheduleQuickForm((f) => ({ ...f, repeatWeekOfMonth: Number(e.target.value) }))
                    }
                    disabled={scheduleQuickForm.repeatMode !== "MONTHLY_WEEKDAY"}
                  >
                    <option value={1}>Week 1</option>
                    <option value={2}>Week 2</option>
                    <option value={3}>Week 3</option>
                    <option value={4}>Week 4</option>
                    <option value={5}>Week 5</option>
                  </select>
                </label>
                <label className="field">
                  <span>Weekday</span>
                  <select
                    className="input"
                    value={scheduleQuickForm.repeatWeekday}
                    onChange={(e) =>
                      setScheduleQuickForm((f) => ({ ...f, repeatWeekday: Number(e.target.value) }))
                    }
                    disabled={scheduleQuickForm.repeatMode !== "MONTHLY_WEEKDAY"}
                  >
                    <option value={0}>Sunday</option>
                    <option value={1}>Monday</option>
                    <option value={2}>Tuesday</option>
                    <option value={3}>Wednesday</option>
                    <option value={4}>Thursday</option>
                    <option value={5}>Friday</option>
                    <option value={6}>Saturday</option>
                  </select>
                </label>
                <label className="field field-wide">
                  <span>{t.scheduleNote}</span>
                  <input
                    className="input"
                    value={scheduleQuickForm.note}
                    onChange={(e) => setScheduleQuickForm((f) => ({ ...f, note: e.target.value }))}
                    placeholder="Example: Monthly preventive maintenance"
                  />
                </label>
              </div>
              <div className="asset-actions">
                <div className="tiny">
                  {lang === "km"
                    ? "បង្កើតកាលវិភាគដោយផ្ទាល់ពីថ្ងៃដែលអ្នកបានចុច។"
                    : "Create schedule directly from the clicked day."}
                </div>
                <button className="btn-primary" disabled={busy || !scheduleQuickForm.assetId} onClick={saveQuickScheduleFromCalendar}>
                  Save Schedule
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {scheduleAlertModal && (
          <div className="modal-backdrop" onClick={() => setScheduleAlertModal(null)}>
            <section className="panel modal-panel" onClick={(e) => e.stopPropagation()}>
              <div className="panel-row">
                <h2>{scheduleAlertItems.title}</h2>
                <button className="tab" onClick={() => setScheduleAlertModal(null)}>{t.close}</button>
              </div>
              <div className="table-wrap modal-sticky-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t.date}</th>
                      <th>{t.assetId}</th>
                      <th>{t.photo}</th>
                      <th>{t.campus}</th>
                      <th>{t.status}</th>
                      <th>{t.scheduleNote}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleAlertItems.items.length ? (
                      scheduleAlertItems.items.map((asset) => (
                        <tr key={`schedule-modal-${asset.id}`}>
                          <td>{formatDate(asset.nextMaintenanceDate || "-")}</td>
                          <td>
                            <button
                              className="tab"
                              onClick={() => {
                                setScheduleAlertModal(null);
                                openMaintenanceRecordFromScheduleAsset(asset);
                              }}
                            >
                              <strong>{asset.assetId}</strong>
                            </button>
                          </td>
                          <td>{renderAssetPhoto(asset.photo || "", asset.assetId)}</td>
                          <td>{campusLabel(asset.campus)}</td>
                          <td>{assetStatusLabel(asset.status)}</td>
                          <td>{asset.scheduleNote || "-"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6}>{t.noScheduledAssetsFound}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {overviewModal && (
          <div className="modal-backdrop" onClick={() => setOverviewModal(null)}>
            <section className="panel modal-panel" onClick={(e) => e.stopPropagation()}>
              <div className="panel-row">
                <h2>{overviewModalData.title}</h2>
                <button className="tab" onClick={() => setOverviewModal(null)}>{t.close}</button>
              </div>
              <div className="table-wrap modal-sticky-table-wrap">
                {overviewModalData.mode === "assets" ? (
                  <table>
                    <thead>
                      <tr>
                        <th>{t.assetId}</th>
                        <th>{t.photo}</th>
                        <th>{t.campus}</th>
                        <th>{t.category}</th>
                        <th>{t.name}</th>
                        <th>{t.location}</th>
                        <th>{t.status}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overviewModalData.assets.length ? (
                        overviewModalData.assets.map((asset) => (
                          <tr key={`overview-asset-${overviewModal}-${asset.id}`}>
                            <td><strong>{asset.assetId}</strong></td>
                            <td>{renderAssetPhoto(asset.photo || "", asset.assetId)}</td>
                            <td>{campusLabel(asset.campus)}</td>
                            <td>{asset.category}</td>
                            <td>{assetItemName(asset.category, asset.type, asset.pcType || "")}</td>
                            <td>{asset.location || "-"}</td>
                            <td>{assetStatusLabel(asset.status || "-")}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7}>No assets found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>{t.ticketNoLabel}</th>
                        <th>{t.campus}</th>
                        <th>{t.category}</th>
                        <th>{t.titleLabel}</th>
                        <th>{t.priority}</th>
                        <th>{t.status}</th>
                        <th>{t.requestedBy}</th>
                        <th>{t.created}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overviewModalData.tickets.length ? (
                        overviewModalData.tickets.map((ticket) => (
                          <tr key={`overview-ticket-${ticket.id}`}>
                            <td><strong>{ticket.ticketNo}</strong></td>
                            <td>{campusLabel(ticket.campus)}</td>
                            <td>{ticket.category}</td>
                            <td>{ticket.title}</td>
                            <td>{ticket.priority}</td>
                            <td>{ticket.status}</td>
                            <td>{ticket.requestedBy}</td>
                            <td>{formatDate(ticket.created)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8}>{t.noOpenWorkOrders}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>
        )}

        {maintenanceDashboardModal && (
          <div className="modal-backdrop" onClick={() => setMaintenanceDashboardModal(null)}>
            <section className="panel modal-panel" onClick={(e) => e.stopPropagation()}>
              <div className="panel-row">
                <h2>{maintenanceDashboardModalData.title}</h2>
                <button className="tab" onClick={() => setMaintenanceDashboardModal(null)}>{t.close}</button>
              </div>
              <div className="row-actions" style={{ marginBottom: 10, justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <span className="tiny">
                  {lang === "km" ? "កំណត់ជូនដំណឹងមុនថ្ងៃថែទាំ" : "Reminder before due date"}
                </span>
                <div className="row-actions" style={{ gap: 6, flexWrap: "wrap" }}>
                  {[7, 3, 2, 1, 0].map((offset) => (
                    <button
                      key={`reminder-offset-${offset}`}
                      type="button"
                      className={`tab btn-small ${maintenanceReminderOffsets.includes(offset) ? "tab-active" : ""}`}
                      disabled={!isAdmin || savingMaintenanceReminder}
                      onClick={() => {
                        void toggleMaintenanceReminderOffset(offset);
                      }}
                      title={
                        offset === 0
                          ? (lang === "km" ? "ថ្ងៃដល់កំណត់" : "On due date")
                          : (lang === "km" ? `មុន ${offset} ថ្ងៃ` : `${offset} day(s) before`)
                      }
                    >
                      {offset === 0 ? (lang === "km" ? "ថ្ងៃនេះ" : "Today") : `${offset}d`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="table-wrap modal-sticky-table-wrap">
                {maintenanceDashboardModalData.mode === "assets" ? (
                  <table>
                    <thead>
                      <tr>
                        <th>{t.date}</th>
                        <th>{t.assetId}</th>
                        <th>{t.photo}</th>
                        <th>{t.campus}</th>
                        <th>{t.category}</th>
                        <th>{t.name}</th>
                        <th>{t.location}</th>
                        <th>{t.status}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {maintenanceDashboardModalData.assets.length ? (
                        maintenanceDashboardModalData.assets.map((asset) => (
                          <tr key={`maintenance-dashboard-modal-asset-${maintenanceDashboardModal}-${asset.id}`}>
                            <td>{formatDate(asset.nextMaintenanceDate || "-")}</td>
                            <td>
                              <button
                                className="tab btn-small"
                                disabled={!canAccessMenu("maintenance.record", "maintenance")}
                                onClick={() => {
                                  setMaintenanceDashboardModal(null);
                                  openMaintenanceRecordFromScheduleAsset(asset);
                                }}
                              >
                                <strong>{asset.assetId}</strong>
                              </button>
                            </td>
                            <td>{renderAssetPhoto(asset.photo || "", asset.assetId)}</td>
                            <td>{campusLabel(asset.campus)}</td>
                            <td>{asset.category}</td>
                            <td>{assetItemName(asset.category, asset.type, asset.pcType || "")}</td>
                            <td>{asset.location || "-"}</td>
                            <td>{assetStatusLabel(asset.status || "-")}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8}>{lang === "km" ? "មិនមានទិន្នន័យ" : "No assets found."}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>{t.date}</th>
                        <th>{t.assetId}</th>
                        <th>{t.photo}</th>
                        <th>{t.campus}</th>
                        <th>{t.category}</th>
                        <th>{lang === "km" ? "ប្រភេទថែទាំ" : "Maintenance Type"}</th>
                        <th>{lang === "km" ? "ស្ថានភាពការងារ" : "Work Status"}</th>
                        <th>{t.by}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {maintenanceDashboardModalData.rows.length ? (
                        maintenanceDashboardModalData.rows.map((row) => (
                          <tr key={`maintenance-dashboard-modal-row-${row.rowId}`}>
                            <td>{formatDate(row.date || "-")}</td>
                            <td><strong>{row.assetId}</strong></td>
                            <td>{renderAssetPhoto(row.assetPhoto || "", row.assetId)}</td>
                            <td>{campusLabel(row.campus)}</td>
                            <td>{row.category}</td>
                            <td>{row.type || "-"}</td>
                            <td>{row.completion || "-"}</td>
                            <td>{row.by || "-"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8}>{lang === "km" ? "មិនមានទិន្នន័យ" : "No records found."}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>
        )}

        {latestMaintenanceDetailRow ? (
          <div className="modal-backdrop" onClick={() => setLatestMaintenanceDetailRowId(null)}>
            <section className="panel modal-panel" onClick={(e) => e.stopPropagation()}>
              <div className="panel-row">
                <h2>{lang === "km" ? "ព័ត៌មានថែទាំពេញ" : "Full Maintenance Detail"}</h2>
                <button className="tab" onClick={() => setLatestMaintenanceDetailRowId(null)}>{t.close}</button>
              </div>
              <div className="form-grid">
                <div className="field"><span>{t.assetId}</span><div className="detail-value"><strong>{latestMaintenanceDetailRow.assetId}</strong></div></div>
                <div className="field"><span>{t.date}</span><div className="detail-value">{formatDate(latestMaintenanceDetailRow.date || "-")}</div></div>
                <div className="field"><span>{t.campus}</span><div className="detail-value">{campusLabel(latestMaintenanceDetailRow.campus)} ({CAMPUS_CODE[latestMaintenanceDetailRow.campus] || "CX"})</div></div>
                <div className="field"><span>{t.location}</span><div className="detail-value">{latestMaintenanceDetailRow.location || "-"}</div></div>
                <div className="field"><span>{t.name}</span><div className="detail-value">{assetItemName(latestMaintenanceDetailRow.category, latestMaintenanceDetailRow.assetType || "", "")}</div></div>
                <div className="field"><span>{t.category}</span><div className="detail-value">{latestMaintenanceDetailRow.category}</div></div>
                <div className="field"><span>{lang === "km" ? "ប្រភេទថែទាំ" : "Maintenance Type"}</span><div className="detail-value">{latestMaintenanceDetailRow.type || "-"}</div></div>
                <div className="field"><span>{lang === "km" ? "ស្ថានភាពការងារ" : "Work Status"}</span><div className="detail-value">{latestMaintenanceDetailRow.completion || "-"}</div></div>
                <div className="field"><span>{lang === "km" ? "លក្ខខណ្ឌ" : "Condition"}</span><div className="detail-value">{latestMaintenanceDetailRow.condition || "-"}</div></div>
                <div className="field"><span>{lang === "km" ? "ចំណាយ" : "Cost"}</span><div className="detail-value">{latestMaintenanceDetailRow.cost || "-"}</div></div>
                <div className="field"><span>{t.by}</span><div className="detail-value">{latestMaintenanceDetailRow.by || "-"}</div></div>
                <div className="field field-wide"><span>{t.notes}</span><div className="detail-value latest-maint-detail-note">{latestMaintenanceDetailRow.note || "-"}</div></div>
              </div>
            </section>
          </div>
        ) : null}

        {quickCountModal && (
          <div className="modal-backdrop" onClick={() => setQuickCountModal(null)}>
            <section className="panel modal-panel" onClick={(e) => e.stopPropagation()}>
              <div className="panel-row">
                <h2>{quickCountModal.title}</h2>
                <button className="tab" onClick={() => setQuickCountModal(null)}>{t.close}</button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t.assetId}</th>
                      <th>{t.photo}</th>
                      <th>{t.campus}</th>
                      <th>{t.category}</th>
                      <th>{t.name}</th>
                      <th>{t.location}</th>
                      <th>{t.status}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quickCountModal.assets.length ? (
                      quickCountModal.assets.map((asset) => (
                        <tr key={`quick-count-modal-asset-${asset.id}`}>
                          <td><strong>{asset.assetId}</strong></td>
                          <td>{renderAssetPhoto(asset.photo || "", asset.assetId)}</td>
                          <td>{campusLabel(asset.campus)}</td>
                          <td>{asset.category}</td>
                          <td>{assetItemName(asset.category, asset.type, asset.pcType || "")}</td>
                          <td>{asset.location || "-"}</td>
                          <td>{assetStatusLabel(asset.status || "-")}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7}>{lang === "km" ? "មិនមានទិន្នន័យ" : "No assets found."}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {updateNotesOpen && (
          <div className="modal-backdrop" onClick={() => setUpdateNotesOpen(false)}>
            <section className="panel modal-panel" onClick={(e) => e.stopPropagation()}>
              <div className="panel-row">
                <h2>{lang === "km" ? "កំណត់ត្រាកំណែប្រព័ន្ធ" : "Update Notes"}</h2>
                <button className="tab" onClick={() => setUpdateNotesOpen(false)}>{t.close}</button>
              </div>
              <div className="version-modal-list">
                {APP_UPDATE_NOTES.map((entry) => (
                  <article key={`version-note-${entry.version}`} className="version-modal-item">
                    <div className="version-modal-head">
                      <strong>{entry.version}</strong>
                      <span className="tiny">{entry.date}</span>
                    </div>
                    <ul className="version-modal-notes">
                      {entry.notes.map((note, index) => (
                        <li key={`version-note-line-${entry.version}-${index}`}>{note}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}

        {pendingStatusChange && (
          <div className="modal-backdrop" onClick={() => setPendingStatusChange(null)}>
            <section className="panel modal-panel" onClick={(e) => e.stopPropagation()}>
              <div className="panel-row">
                <h2>{t.statusChangeConfirm}</h2>
                <button className="tab" onClick={() => setPendingStatusChange(null)}>{t.close}</button>
              </div>
              <div className="form-grid">
                <div className="field">
                  <span>From</span>
                  <input className="input" value={assetStatusLabel(pendingStatusChange.fromStatus)} readOnly />
                </div>
                <div className="field">
                  <span>To</span>
                  <input className="input" value={assetStatusLabel(pendingStatusChange.toStatus)} readOnly />
                </div>
                <label className="field field-wide">
                  <span>{t.statusReason}</span>
                  <textarea
                    className="textarea"
                    value={pendingStatusChange.reason}
                    onChange={(e) =>
                      setPendingStatusChange((prev) =>
                        prev ? { ...prev, reason: e.target.value } : prev
                      )
                    }
                  />
                </label>
                <label className="field field-wide">
                  <span>{t.statusVerifiedBy}</span>
                  <input
                    className="input"
                    value={pendingStatusChange.verifiedBy}
                    onChange={(e) =>
                      setPendingStatusChange((prev) =>
                        prev ? { ...prev, verifiedBy: e.target.value } : prev
                      )
                    }
                  />
                </label>
              </div>
              <div className="asset-actions">
                <div className="tiny">
                  {assetStatusLabel(pendingStatusChange.fromStatus)} {"->"} {assetStatusLabel(pendingStatusChange.toStatus)}
                </div>
                <div className="row-actions">
                  <button className="tab" onClick={() => setPendingStatusChange(null)}>{t.cancelEdit}</button>
                  <button
                    className="btn-primary"
                    disabled={busy}
                    onClick={async () => {
                      if (!pendingStatusChange.reason.trim()) {
                        alert(t.statusReasonRequired);
                        return;
                      }
                      if (!pendingStatusChange.verifiedBy.trim()) {
                        alert(t.statusVerifiedByRequired);
                        return;
                      }
                      const ok = await changeAssetStatus(
                        pendingStatusChange.assetId,
                        pendingStatusChange.toStatus,
                        pendingStatusChange.reason.trim(),
                        pendingStatusChange.verifiedBy.trim()
                      );
                      if (ok) setPendingStatusChange(null);
                    }}
                  >
                    {t.confirm}
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {previewImage && (
          <div className="modal-backdrop" onClick={() => setPreviewImage(null)}>
            <section className="panel modal-panel image-preview-panel" onClick={(e) => e.stopPropagation()}>
              <div className="panel-row">
                <h2>{t.photo}</h2>
                <button className="tab" onClick={() => setPreviewImage(null)}>{t.close}</button>
              </div>
              <div className="image-preview-wrap">
                <img src={previewImage} alt="asset preview" className="image-preview" />
              </div>
            </section>
          </div>
        )}

        <div className="footnote-row">
          <p className={`footnote ${error ? "footnote-error" : ""}`}>
            {error ? `${t.systemError}: ${error}` : t.dataStored}
          </p>
          <button
            type="button"
            className="version-badge-btn"
            onClick={() => setUpdateNotesOpen(true)}
            title={lang === "km" ? "មើលកំណត់ត្រាកំណែ" : "View update notes"}
          >
            {APP_VERSION}
          </button>
        </div>
      </section>
    </main>
  );
}
