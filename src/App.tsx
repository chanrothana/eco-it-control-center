import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  assignedTo?: string;
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
type PendingStatusChange = {
  assetId: number;
  fromStatus: string;
  toStatus: string;
  reason: string;
  verifiedBy: string;
};
type ReportType =
  | "asset_master"
  | "asset_by_location"
  | "overdue"
  | "transfer"
  | "maintenance_completion"
  | "verification_summary"
  | "qr_labels";

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
  type: "IN" | "OUT";
  qty: number;
  by?: string;
  note?: string;
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
type AuthUser = {
  id: number;
  username: string;
  displayName: string;
  role: "Admin" | "Viewer";
  campuses?: string[];
  modules?: NavModule[];
};
type AuthAccount = {
  id: number;
  username: string;
  displayName: string;
  role: "Admin" | "Viewer";
  campuses: string[];
  modules: NavModule[];
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
};
const LOCATION_FALLBACK_KEY = "it_locations_fallback_v1";
const ASSET_FALLBACK_KEY = "it_assets_fallback_v1";
const USER_FALLBACK_KEY = "it_users_fallback_v1";
const CAMPUS_NAME_FALLBACK_KEY = "it_campus_names_fallback_v1";
const ITEM_NAME_FALLBACK_KEY = "it_item_names_fallback_v1";
const ITEM_TYPE_FALLBACK_KEY = "it_item_types_fallback_v1";
const AUTH_TOKEN_KEY = "it_auth_token_v1";
const AUTH_USER_KEY = "it_auth_user_v1";
const AUTH_PERMISSION_FALLBACK_KEY = "it_auth_permissions_fallback_v1";
const AUTH_ACCOUNTS_FALLBACK_KEY = "it_auth_accounts_fallback_v1";
const AUDIT_FALLBACK_KEY = "it_audit_fallback_v1";
const INVENTORY_ITEM_FALLBACK_KEY = "it_inventory_items_v1";
const INVENTORY_TXN_FALLBACK_KEY = "it_inventory_txns_v1";
const API_BASE_OVERRIDE_KEY = "it_api_base_url_v1";
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
const LOCAL_ADMIN_TOKEN = "local-admin-token";
const LOCAL_VIEWER_TOKEN = "local-viewer-token";
const ENV_API_BASE_URL = String(process.env.REACT_APP_API_BASE_URL || "").trim().replace(/\/+$/, "");
const DEFAULT_CLOUD_API_BASE = "https://eco-it-control-center.onrender.com";
let runtimeAuthToken = "";

function getAutoApiBaseForHost() {
  if (typeof window === "undefined") return "";
  const host = String(window.location.hostname || "").toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") {
    return DEFAULT_CLOUD_API_BASE;
  }
  return "";
}
const LOCAL_AUTH_ACCOUNTS: AuthAccount[] = [
  { id: 1, username: "admin", displayName: "Eco Admin", role: "Admin", campuses: ["ALL"], modules: [...ALL_NAV_MODULES] },
  { id: 2, username: "viewer", displayName: "Eco Viewer", role: "Viewer", campuses: ["Chaktomuk Campus (C2.2)"], modules: [...DEFAULT_VIEWER_MODULES] },
];

const CAMPUS_LIST = [
  "Samdach Pan Campus",
  "Chaktomuk Campus",
  "Chaktomuk Campus (C2.2)",
  "Boeung Snor Campus",
  "Veng Sreng Campus",
];
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

const CATEGORY_OPTIONS = [
  { value: "IT", en: "IT", km: "IT" },
  { value: "SAFETY", en: "Safety", km: "សុវត្ថិភាព" },
  { value: "FACILITY", en: "Facility", km: "បរិក្ខារ" },
];

const ASSET_STATUS_OPTIONS = [
  { value: "Active", en: "Active", km: "កំពុងប្រើ" },
  { value: "Maintenance", en: "Maintenance", km: "កំពុងជួសជុល" },
  { value: "Retired", en: "Retired", km: "ឈប់ប្រើ" },
];
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
    { itemEn: "Table", itemKm: "តុ", code: "TBL" },
    { itemEn: "Chair", itemKm: "កៅអី", code: "CHR" },
  ],
};

const USER_REQUIRED_TYPES = ["PC", "TAB", "SPK"];
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
type SetPackChildType = "MON" | "MON2" | "KBD" | "MSE";
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
  };
}

function defaultSetPackDraft(): Record<SetPackChildType, SetPackChildDraft> {
  return {
    MON: defaultSetPackChildDraft(),
    MON2: { ...defaultSetPackChildDraft(), enabled: false },
    KBD: defaultSetPackChildDraft(),
    MSE: defaultSetPackChildDraft(),
  };
}

function setPackAssetType(type: SetPackChildType): "MON" | "KBD" | "MSE" {
  if (type === "MON2") return "MON";
  return type;
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
    linkToDesktopSet: "Link to existing desktop set",
    selectDesktopUnit: "Select Desktop Unit",
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
    userRequired: "User is required for Computer, iPad/Tablet, and Speaker.",
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
    permissionHelp: "Set role and campus access for login users. Viewer can only see assigned campus.",
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
    linkToDesktopSet: "ភ្ជាប់ទៅក្រុម Desktop ដែលមានស្រាប់",
    selectDesktopUnit: "ជ្រើស Desktop Unit",
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
    userRequired: "ត្រូវបញ្ចូលអ្នកប្រើសម្រាប់ Computer, iPad/Tablet និង Speaker។",
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
  },
};

function normalizeArray<T>(input: unknown): T[] {
  if (!Array.isArray(input)) return [];
  return input as T[];
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
    if (autoApiBase) candidates.push(`${autoApiBase}${url}`);
    if (typeof window !== "undefined") {
      const host = String(window.location.hostname || "").toLowerCase();
      if (host && host !== "localhost" && host !== "127.0.0.1") {
        candidates.push(url);
      }
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
    throw new Error(
      lastResponse.data.error ||
        (lastResponse.res.status === 404
          ? "API route not found. Please restart backend server."
          : `Request failed (${lastResponse.res.status})`)
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

function trySetLocalStorage(key: string, value: string) {
  const allowInServerOnlyMode = new Set<string>([
    AUTH_TOKEN_KEY,
    AUTH_USER_KEY,
    API_BASE_OVERRIDE_KEY,
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
  if (SERVER_ONLY_STORAGE) return;
  trySetLocalStorage(USER_FALLBACK_KEY, JSON.stringify(list));
}

function writeStringMap(key: string, map: Record<string, string>) {
  if (SERVER_ONLY_STORAGE) return;
  trySetLocalStorage(key, JSON.stringify(map));
}

function writeItemTypeFallback(map: Record<string, Array<{ itemEn: string; itemKm: string; code: string }>>) {
  if (SERVER_ONLY_STORAGE) return;
  trySetLocalStorage(ITEM_TYPE_FALLBACK_KEY, JSON.stringify(map));
}

function normalizeModulesByRole(role: "Admin" | "Viewer", modules?: unknown): NavModule[] {
  const allowed = new Set(ALL_NAV_MODULES);
  const list = Array.isArray(modules) ? modules.filter((x): x is NavModule => typeof x === "string" && allowed.has(x as NavModule)) : [];
  if (list.length) return Array.from(new Set(list));
  return role === "Admin" ? [...ALL_NAV_MODULES] : [...DEFAULT_VIEWER_MODULES];
}

function readAuthPermissionFallback(): Record<string, { role: "Admin" | "Viewer"; campuses: string[]; modules: NavModule[] }> {
  if (SERVER_ONLY_STORAGE) return {};
  try {
    const raw = localStorage.getItem(AUTH_PERMISSION_FALLBACK_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, { role: "Admin" | "Viewer"; campuses: string[]; modules: NavModule[] }> = {};
    for (const [username, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object") continue;
      const v = value as { role?: string; campuses?: string[]; modules?: unknown };
      const role = v.role === "Admin" ? "Admin" : "Viewer";
      const campuses = Array.isArray(v.campuses) && v.campuses.length ? v.campuses : ["ALL"];
      const modules = normalizeModulesByRole(role, v.modules);
      out[username] = { role, campuses, modules };
    }
    return out;
  } catch {
    return {};
  }
}

function writeAuthPermissionFallback(map: Record<string, { role: "Admin" | "Viewer"; campuses: string[]; modules: NavModule[] }>) {
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
          role: row.role === "Admin" ? "Admin" : "Viewer",
          campuses: Array.isArray(row.campuses) && row.campuses.length ? row.campuses : ["ALL"],
          modules: normalizeModulesByRole(row.role === "Admin" ? "Admin" : "Viewer", row.modules),
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
  if (SERVER_ONLY_STORAGE) return;
  trySetLocalStorage(INVENTORY_ITEM_FALLBACK_KEY, JSON.stringify(rows));
}

function writeInventoryTxnFallback(rows: InventoryTxn[]) {
  if (SERVER_ONLY_STORAGE) return;
  trySetLocalStorage(INVENTORY_TXN_FALLBACK_KEY, JSON.stringify(rows.slice(0, 5000)));
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
function calcNextInventorySeq(
  list: InventoryItem[],
  campus: string,
  category: "SUPPLY" | "CLEAN_TOOL" | "MAINT_TOOL"
) {
  const campusCode = CAMPUS_CODE[campus] || "CX";
  const catCode = inventoryCategoryCode(category);
  let maxSeq = 0;
  for (const item of list) {
    if (item.campus !== campus || item.category !== category) continue;
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
  const campusCode = CAMPUS_CODE[campus] || "CX";
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

function shiftYmd(ymd: string, days: number) {
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  d.setDate(d.getDate() + days);
  return toYmd(d);
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
  searchText: string
) {
  let out = [...list];
  if (campusFilter !== "ALL") out = out.filter((a) => a.campus === campusFilter);
  if (categoryFilter !== "ALL") out = out.filter((a) => a.category === categoryFilter);
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
    } else if (nextHistory.length && prevHistory.length) {
      const prevById = new Map<number, MaintenanceEntry>(prevHistory.map((h) => [h.id, h]));
      next.maintenanceHistory = nextHistory.map((h) => {
        const old = prevById.get(h.id);
        if (!old) return h;
        return {
          ...old,
          ...h,
          photo: h.photo || old.photo || "",
        };
      });
    }

    const prevVerification = Array.isArray(prev.verificationHistory) ? prev.verificationHistory : [];
    const hasIncomingVerificationHistory = Object.prototype.hasOwnProperty.call(a, "verificationHistory");
    const nextVerification = Array.isArray(a.verificationHistory) ? a.verificationHistory : [];
    if (!hasIncomingVerificationHistory && prevVerification.length) {
      next.verificationHistory = prevVerification;
    } else if (nextVerification.length && prevVerification.length) {
      const prevById = new Map<number, VerificationEntry>(prevVerification.map((h) => [h.id, h]));
      next.verificationHistory = nextVerification.map((h) => {
        const old = prevById.get(h.id);
        if (!old) return h;
        return {
          ...old,
          ...h,
          photo: h.photo || old.photo || "",
        };
      });
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
  return {
    ...asset,
    photos: normalizedPhotos,
    photo: normalizeUrl(normalizedPhotos[0] || ""),
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
    const q = search.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) =>
      `${a.assetId} ${a.name} ${a.location} ${a.campus} ${a.category} ${a.type}`.toLowerCase().includes(q)
    );
  }, [assets, search]);

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
        onClick={() => setOpen((v) => !v)}
        onBlur={() => {
          window.setTimeout(() => {
            if (!wrapRef.current) return;
            const active = document.activeElement;
            if (!active || !wrapRef.current.contains(active)) {
              setOpen(false);
            }
          }, 0);
        }}
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
            placeholder="Search asset..."
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

  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem("ui_lang");
    return saved === "km" ? "km" : "en";
  });
  const t = TEXT[lang];
  const [authLoading, setAuthLoading] = useState(true);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [apiBaseInput, setApiBaseInput] = useState(
    () =>
      SERVER_ONLY_STORAGE
        ? String(ENV_API_BASE_URL || getAutoApiBaseForHost())
        : String(localStorage.getItem(API_BASE_OVERRIDE_KEY) || ENV_API_BASE_URL || getAutoApiBaseForHost())
  );
  const isAdmin = authUser?.role === "Admin";

  const [tab, setTab] = useState<NavModule>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
  const allowedNavModules = useMemo(() => {
    const modules = authUser?.modules?.length ? authUser.modules : ALL_NAV_MODULES;
    return new Set<NavModule>(modules);
  }, [authUser?.modules]);
  const navMenuItems = useMemo(
    () => navItems.filter((item) => allowedNavModules.has(item.id)),
    [navItems, allowedNavModules]
  );
  const activeNavLabel = useMemo(
    () => navMenuItems.find((item) => item.id === tab)?.label || t.dashboard,
    [navMenuItems, tab, t.dashboard]
  );
  const handleNavChange = useCallback((nextTab: NavModule) => {
    setTab(nextTab);
  }, []);
  const [dashboardView, setDashboardView] = useState<"overview" | "schedule" | "activity">("overview");
  const [assetsView, setAssetsView] = useState<"register" | "list">("register");
  const [campusFilter, setCampusFilter] = useState("ALL");
  const [assetCampusFilter, setAssetCampusFilter] = useState("ALL");
  const [assetCategoryFilter, setAssetCategoryFilter] = useState("ALL");
  const [maintenanceCategoryFilter, setMaintenanceCategoryFilter] = useState("ALL");
  const [maintenanceTypeFilter, setMaintenanceTypeFilter] = useState("ALL");
  const [maintenanceDateFrom, setMaintenanceDateFrom] = useState("");
  const [maintenanceDateTo, setMaintenanceDateTo] = useState("");
  const [verificationCategoryFilter, setVerificationCategoryFilter] = useState("ALL");
  const [verificationResultFilter, setVerificationResultFilter] = useState("ALL");
  const [verificationDateFrom, setVerificationDateFrom] = useState("");
  const [verificationDateTo, setVerificationDateTo] = useState("");
  const [scheduleView, setScheduleView] = useState<"bulk" | "single" | "calendar">("bulk");
  const [setupView, setSetupView] = useState<"campus" | "users" | "permissions" | "backup" | "items" | "locations">("campus");
  const [inventoryView, setInventoryView] = useState<"items" | "stock" | "balance">("items");
  const [transferView, setTransferView] = useState<"record" | "history">("history");
  const [maintenanceView, setMaintenanceView] = useState<"record" | "history">("history");
  const [verificationView, setVerificationView] = useState<"record" | "history">("record");
  const [maintenanceSort, setMaintenanceSort] = useState<{
    key: MaintenanceSortKey;
    direction: "asc" | "desc";
  }>({
    key: "date",
    direction: "desc",
  });
  const [reportType, setReportType] = useState<ReportType>("asset_master");
  const [reportMonth, setReportMonth] = useState(() => toYmd(new Date()).slice(0, 7));
  const [reportPeriodMode, setReportPeriodMode] = useState<"month" | "term">("month");
  const [reportYear, setReportYear] = useState(String(new Date().getFullYear()));
  const [reportTerm, setReportTerm] = useState<"Term 1" | "Term 2" | "Term 3">("Term 1");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!navMenuItems.some((item) => item.id === tab)) {
      setTab(navMenuItems[0]?.id || "dashboard");
    }
  }, [navMenuItems, tab]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [tab]);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryTxns, setInventoryTxns] = useState<InventoryTxn[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [locations, setLocations] = useState<LocationEntry[]>([]);
  const [users, setUsers] = useState<StaffUser[]>([]);
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
  });
  const setPackPhotoInputRefs = useRef<Record<SetPackChildType, HTMLInputElement | null>>({
    MON: null,
    MON2: null,
    KBD: null,
    MSE: null,
  });
  const [setPackDetailOpen, setSetPackDetailOpen] = useState<Record<SetPackChildType, boolean>>({
    MON: false,
    MON2: false,
    KBD: false,
    MSE: false,
  });
  const [editSetPackEnabled, setEditSetPackEnabled] = useState<Record<SetPackChildType, boolean>>({
    MON: false,
    MON2: false,
    KBD: false,
    MSE: false,
  });
  const [editCreateSetPack, setEditCreateSetPack] = useState(false);
  const [assetFileKey, setAssetFileKey] = useState(0);
  const createPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [assetDetailId, setAssetDetailId] = useState<number | null>(null);
  const [pendingQrAssetId, setPendingQrAssetId] = useState(() => {
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
  const [editingAssetId, setEditingAssetId] = useState<number | null>(null);
  const [editAssetFileKey, setEditAssetFileKey] = useState(0);
  const [assetEditForm, setAssetEditForm] = useState({
    location: "",
    pcType: "",
    setCode: "",
    parentAssetId: "",
    useExistingSet: false,
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
    reason: "",
    by: "",
    note: "",
  });
  const [showTransferAssetPicker, setShowTransferAssetPicker] = useState(false);

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
  const [authPermissionDraft, setAuthPermissionDraft] = useState<
    Record<number, { role: "Admin" | "Viewer"; campus: string; modules: NavModule[] }>
  >({});
  const [authCreateForm, setAuthCreateForm] = useState({
    staffId: "",
    username: "",
    password: "",
    displayName: "",
    role: "Viewer" as "Admin" | "Viewer",
    campus: CAMPUS_LIST[0],
    modules: [...DEFAULT_VIEWER_MODULES] as NavModule[],
  });
  const [scheduleAlertModal, setScheduleAlertModal] = useState<null | "overdue" | "upcoming" | "scheduled" | "selected">(null);
  const [overviewModal, setOverviewModal] = useState<null | "total" | "it" | "safety" | "tickets">(null);
  const [scheduleForm, setScheduleForm] = useState({
    assetId: "",
    date: "",
    note: "",
    repeatMode: "NONE" as "NONE" | "MONTHLY_WEEKDAY",
    repeatWeekOfMonth: 1,
    repeatWeekday: 6,
  });
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
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => toYmd(new Date()));
  const [inventoryCampusFilter, setInventoryCampusFilter] = useState("ALL");
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState("ALL");
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryItemForm, setInventoryItemForm] = useState({
    campus: CAMPUS_LIST[0],
    category: "SUPPLY" as "SUPPLY" | "CLEAN_TOOL" | "MAINT_TOOL",
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
    type: "IN" as "IN" | "OUT",
    qty: "",
    by: "",
    note: "",
  });
  const [editingInventoryTxnId, setEditingInventoryTxnId] = useState<number | null>(null);
  const [inventoryTxnEditForm, setInventoryTxnEditForm] = useState({
    itemId: "",
    date: toYmd(new Date()),
    type: "IN" as "IN" | "OUT",
    qty: "",
    by: "",
    note: "",
  });

  useEffect(() => {
    trySetLocalStorage("ui_lang", lang);
  }, [lang]);

  useEffect(() => {
    if (authUser) {
      trySetLocalStorage(AUTH_USER_KEY, JSON.stringify(authUser));
    } else {
      localStorage.removeItem(AUTH_USER_KEY);
    }
  }, [authUser]);

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
      if (!SERVER_ONLY_STORAGE && token === LOCAL_ADMIN_TOKEN) {
        const perm = readAuthPermissionFallback().admin || {
          role: "Admin" as const,
          campuses: ["ALL"],
          modules: [...ALL_NAV_MODULES],
        };
        if (mounted) {
          setAuthUser({
            id: 1,
            username: "admin",
            displayName: "Eco Admin",
            role: perm.role,
            campuses: perm.campuses,
            modules: perm.modules,
          });
          setAuthLoading(false);
        }
        return;
      }
      if (!SERVER_ONLY_STORAGE && token === LOCAL_VIEWER_TOKEN) {
        const perm = readAuthPermissionFallback().viewer || {
          role: "Viewer" as const,
          campuses: ["Chaktomuk Campus (C2.2)"],
          modules: [...DEFAULT_VIEWER_MODULES],
        };
        if (mounted) {
          setAuthUser({
            id: 2,
            username: "viewer",
            displayName: "Eco Viewer",
            role: perm.role,
            campuses: perm.campuses,
            modules: perm.modules,
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
    if (authUser.role === "Admin") return CAMPUS_LIST;
    const campuses = Array.isArray(authUser.campuses) ? authUser.campuses : [];
    if (!campuses.length || campuses.includes("ALL")) return CAMPUS_LIST;
    return CAMPUS_LIST.filter((c) => campuses.includes(c));
  }, [authUser]);

  useEffect(() => {
    if (!authUser || authUser.role === "Admin") return;
    if (campusFilter === "ALL") {
      if (allowedCampuses.length) setCampusFilter(allowedCampuses[0]);
      return;
    }
    if (!allowedCampuses.includes(campusFilter)) {
      setCampusFilter(allowedCampuses[0] || "ALL");
    }
  }, [authUser, campusFilter, allowedCampuses]);

  useEffect(() => {
    if (!authUser || authUser.role === "Admin") return;
    if (assetCampusFilter === "ALL") return;
    if (!allowedCampuses.includes(assetCampusFilter)) {
      setAssetCampusFilter("ALL");
    }
  }, [authUser, assetCampusFilter, allowedCampuses]);

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
    (campus: string) => campusNames[campus] || campus,
    [campusNames]
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

  const campusLocations = useMemo(
    () => sortLocationEntriesByName(locations.filter((l) => l.campus === assetForm.campus)),
    [locations, assetForm.campus]
  );
  const desktopSetParentsForCreate = useMemo(
    () =>
      assets
        .filter(
          (a) =>
            a.category === "IT" &&
            a.type === DESKTOP_PARENT_TYPE &&
            a.campus === assetForm.campus
        )
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
    return {
      MON: `${campusCode}-${categoryCode("IT")}-MON-${pad4(baseMon)}`,
      MON2: `${campusCode}-${categoryCode("IT")}-MON-${pad4(baseMon + 1)}`,
      KBD: `${campusCode}-${categoryCode("IT")}-KBD-${pad4(baseKbd)}`,
      MSE: `${campusCode}-${categoryCode("IT")}-MSE-${pad4(baseMse)}`,
    };
  }, [assets, assetForm.campus]);
  const desktopSetParentsForEdit = useMemo(() => {
    const editing = assets.find((a) => a.id === editingAssetId);
    if (!editing) return [] as Asset[];
    return assets
      .filter(
        (a) =>
          a.id !== editing.id &&
          a.category === "IT" &&
          a.type === DESKTOP_PARENT_TYPE &&
          a.campus === editing.campus
      )
      .sort((a, b) => a.assetId.localeCompare(b.assetId));
  }, [assets, editingAssetId]);
  const inventoryLocations = useMemo(
    () => sortLocationEntriesByName(locations.filter((l) => l.campus === inventoryItemForm.campus)),
    [locations, inventoryItemForm.campus]
  );
  const inventoryItemLabel = useCallback((item: InventoryItem) => {
    return `${item.itemCode} - ${item.itemName} • ${campusLabel(item.campus)}`;
  }, [campusLabel]);
  const autoInventoryItemCode = useMemo(
    () => buildInventoryItemCode(inventoryItems, inventoryItemForm.campus, inventoryItemForm.category),
    [inventoryItems, inventoryItemForm.campus, inventoryItemForm.category]
  );
  const inventoryBalanceRows = useMemo(() => {
    const byItem = new Map<number, { in: number; out: number }>();
    for (const tx of inventoryTxns) {
      const current = byItem.get(tx.itemId) || { in: 0, out: 0 };
      if (tx.type === "IN") current.in += tx.qty;
      else current.out += tx.qty;
      byItem.set(tx.itemId, current);
    }
    let rows = inventoryItems.map((item) => {
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
    if (inventoryCampusFilter !== "ALL") rows = rows.filter((r) => r.campus === inventoryCampusFilter);
    if (inventoryCategoryFilter !== "ALL") rows = rows.filter((r) => r.category === inventoryCategoryFilter);
    const q = inventorySearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) =>
        `${r.itemCode} ${r.itemName} ${r.location} ${r.vendor || ""}`.toLowerCase().includes(q)
      );
    }
    return rows.sort((a, b) => a.itemCode.localeCompare(b.itemCode));
  }, [inventoryItems, inventoryTxns, inventoryCampusFilter, inventoryCategoryFilter, inventorySearch]);
  const inventoryLowStockRows = useMemo(
    () => inventoryBalanceRows.filter((r) => r.lowStock),
    [inventoryBalanceRows]
  );
  const inventoryTxnsRows = useMemo(() => {
    return [...inventoryTxns]
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
      .filter((row) => {
        if (inventoryCampusFilter !== "ALL" && row.campus !== inventoryCampusFilter) return false;
        if (inventoryCategoryFilter === "ALL") return true;
        const item = inventoryItems.find((i) => i.id === row.itemId);
        return item?.category === inventoryCategoryFilter;
      })
      .filter((row) => {
        const q = inventorySearch.trim().toLowerCase();
        if (!q) return true;
        return `${row.itemCode} ${row.itemName} ${row.by || ""} ${row.note || ""}`.toLowerCase().includes(q);
      });
  }, [inventoryTxns, inventoryItems, inventoryCampusFilter, inventoryCategoryFilter, inventorySearch]);

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
      if (!prev.useExistingSet && (prev.setCode || prev.parentAssetId)) {
        return { ...prev, setCode: "", parentAssetId: "" };
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
    });
    setSetPackFileKey((prev) => ({
      MON: prev.MON + 1,
      MON2: prev.MON2 + 1,
      KBD: prev.KBD + 1,
      MSE: prev.MSE + 1,
    }));
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
    ],
    [t.includeMonitor, t.includeKeyboard, t.includeMouse]
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
    if (!isAdmin && assetsView === "register") {
      setAssetsView("list");
    }
  }, [isAdmin, assetsView]);

  const effectiveAssetCampusFilter =
    assetCampusFilter !== "ALL" ? assetCampusFilter : campusFilter;

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
      } catch {
        // Keep local settings if /api/settings is unavailable.
      }

      const locationRes = await requestJson<{ locations: LocationEntry[] }>("/api/locations");
      const locationList = normalizeArray<LocationEntry>(locationRes.locations);

      const serverAssets = normalizeArray<Asset>(assetRes.assets).map(normalizeAssetForUi);
      // Server-first sync: when API is reachable, use server data as single source of truth.
      writeAssetFallback(serverAssets);
      const effectiveAssets = filterAssets(
        serverAssets,
        effectiveAssetCampusFilter,
        assetCategoryFilter,
        search
      );
      setAssets(effectiveAssets);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot load data");
    } finally {
      setLoading(false);
    }
  }, [campusFilter, effectiveAssetCampusFilter, assetCategoryFilter, search]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (tab === "setup" && isAdmin) {
      void loadAuthAccounts();
      void loadAuditLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isAdmin]);

  async function createAsset() {
    if (!requireAdminAction()) return;
    const isDesktopAsset = assetForm.category === "IT" && assetForm.type.toUpperCase() === DESKTOP_PARENT_TYPE;
    const createPack = isDesktopAsset && assetForm.createSetPack;
    const packItems = (Object.entries(setPackDraft) as Array<[SetPackChildType, SetPackChildDraft]>)
      .filter(([, draft]) => draft.enabled);
    const createSetCode = isDesktopAsset
      ? suggestedDesktopSetCode
      : (assetForm.useExistingSet ? assetForm.setCode.trim() : "");
    const createParentAssetId = isDesktopAsset
      ? ""
      : (assetForm.useExistingSet ? assetForm.parentAssetId.trim().toUpperCase() : "");
    if (!assetForm.location) {
      alert(t.locationRequired);
      return;
    }
    if (isDesktopAsset && !assetForm.pcType.trim()) {
      alert(t.pcTypeRequired);
      return;
    }
    if (!isDesktopAsset && assetForm.useExistingSet && !createParentAssetId) {
      alert(t.selectDesktopUnit);
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
        }),
      });

      if (createPack && created.asset?.assetId) {
        for (const [typeCode, draft] of packItems) {
          const assetType = setPackAssetType(typeCode);
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
              photo: draft.photo || "",
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
      });
      setSetPackFileKey((prev) => ({
        MON: prev.MON + 1,
        MON2: prev.MON2 + 1,
        KBD: prev.KBD + 1,
        MSE: prev.MSE + 1,
      }));
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
          assignedTo: assetForm.assignedTo,
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
              statusHistory: [
                {
                  id: Date.now(),
                  date: new Date().toISOString(),
                  fromStatus: "New",
                  toStatus: draft.status || assetForm.status,
                  reason: "Asset created from set pack",
                },
              ],
              photo: draft.photo || "",
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
        });
        setSetPackFileKey((prev) => ({
          MON: prev.MON + 1,
          MON2: prev.MON2 + 1,
          KBD: prev.KBD + 1,
          MSE: prev.MSE + 1,
        }));
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

  function createOrUpdateUser() {
    if (!requireAdminAction()) return;
    const fullName = userForm.fullName.trim();
    const position = userForm.position.trim();
    const email = userForm.email.trim();
    if (!fullName || !position || !email) return;

    const emailTaken = users.some(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.id !== editingUserId
    );
    if (emailTaken) {
      setError("User email already exists.");
      return;
    }

    setError("");
    if (editingUserId !== null) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUserId ? { ...u, fullName, position, email } : u
        )
      );
      setEditingUserId(null);
    } else {
      setUsers((prev) => [{ id: Date.now(), fullName, position, email }, ...prev]);
    }
    setUserForm({ fullName: "", position: "", email: "" });
  }

  async function loadAuthAccounts() {
    if (!isAdmin) return;
    try {
      const res = await requestJson<{ users: AuthAccount[] }>("/api/auth/users");
      const serverRows = Array.isArray(res.users) ? res.users : [];
      const permissionMap = readAuthPermissionFallback();
      const localRows = readAuthAccountsFallback().map((u) => {
        const saved = permissionMap[u.username];
        return saved ? { ...u, role: saved.role, campuses: saved.campuses, modules: saved.modules } : u;
      });
      const rows = mergeAuthAccounts(serverRows, localRows);
      writeAuthAccountsFallback(rows);
      setAuthAccounts(rows);
      setAuthPermissionDraft(
        Object.fromEntries(
          rows.map((u) => [
            u.id,
              {
                role: u.role === "Admin" ? "Admin" : "Viewer",
                campus:
                  (Array.isArray(u.campuses) && u.campuses[0]) ||
                "ALL",
                modules: Array.isArray(u.modules) && u.modules.length ? u.modules : normalizeModulesByRole(u.role, []),
              },
            ])
          )
      );
      setError("");
    } catch (err) {
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
          return saved ? { ...u, role: saved.role, campuses: saved.campuses, modules: saved.modules } : u;
        });
        writeAuthAccountsFallback(rows);
        setAuthAccounts(rows);
        setAuthPermissionDraft(
          Object.fromEntries(
            rows.map((u) => [
              u.id,
              {
                role: u.role,
                campus: (Array.isArray(u.campuses) && u.campuses[0]) || "ALL",
                modules: Array.isArray(u.modules) && u.modules.length ? u.modules : normalizeModulesByRole(u.role, []),
              },
            ])
          )
        );
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

  async function saveAuthPermission(userId: number) {
    if (!requireAdminAction()) return;
    const draft = authPermissionDraft[userId];
    if (!draft) return;
    const target = authAccounts.find((u) => u.id === userId);
    if (!target) return;
    const campuses = draft.role === "Admin" || draft.campus === "ALL" ? ["ALL"] : [draft.campus];
    const modules: NavModule[] = draft.role === "Admin"
      ? [...ALL_NAV_MODULES]
      : (draft.modules.length ? draft.modules : (["dashboard"] as NavModule[]));
    const nextMap = {
      ...readAuthPermissionFallback(),
      [target.username]: { role: draft.role, campuses, modules },
    };
    const nextRows = authAccounts.map((u) => (u.id === userId ? { ...u, role: draft.role, campuses, modules } : u));
    writeAuthPermissionFallback(nextMap);
    writeAuthAccountsFallback(nextRows);
    setAuthAccounts(nextRows);
    if (authUser && authUser.id === userId) {
      setAuthUser({ ...authUser, role: draft.role, campuses, modules });
    }
    try {
      await requestJson<{ user: AuthAccount }>(`/api/auth/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role: draft.role, campuses, modules }),
      });
      await loadAuthAccounts();
      setSetupMessage("Saved account permission.");
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      if (
        isApiUnavailableError(err) ||
        isMissingRouteError(err) ||
        msg.includes("unauthorized") ||
        msg.includes("admin role required") ||
        msg.includes("request failed (401)") ||
        msg.includes("request failed (403)")
      ) {
        setError("");
        setSetupMessage("Saved account permission.");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to save account permission");
    }
  }

  async function createAuthAccount() {
    if (!requireAdminAction()) return;
    const username = authCreateForm.username.trim();
    const password = authCreateForm.password.trim();
    const displayName = authCreateForm.displayName.trim();
    if (!username || !password || !displayName) {
      setError("Username, password, and display name are required.");
      return;
    }
    if (authAccounts.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
      setError("Username already exists.");
      return;
    }

    const campuses =
      authCreateForm.role === "Admin" || authCreateForm.campus === "ALL"
        ? ["ALL"]
        : [authCreateForm.campus];
    const modules: NavModule[] = authCreateForm.role === "Admin"
      ? [...ALL_NAV_MODULES]
      : (authCreateForm.modules.length ? authCreateForm.modules : (["dashboard"] as NavModule[]));

    setBusy(true);
    setError("");
    try {
      const res = await requestJson<{ user: AuthAccount }>("/api/auth/users", {
        method: "POST",
        body: JSON.stringify({
          username,
          password,
          displayName,
          role: authCreateForm.role,
          campuses,
          modules,
        }),
      });
      const created: AuthAccount = res.user?.username
        ? {
            id: Number(res.user.id) || Date.now(),
            username: res.user.username,
            displayName: res.user.displayName || displayName,
            role: res.user.role === "Admin" ? "Admin" : authCreateForm.role,
            campuses: Array.isArray(res.user.campuses) && res.user.campuses.length ? res.user.campuses : campuses,
            modules: Array.isArray(res.user.modules) && res.user.modules.length ? res.user.modules : modules,
          }
        : {
            id: Date.now(),
            username,
            displayName,
            role: authCreateForm.role,
            campuses,
            modules,
          };
      const merged = mergeAuthAccounts([created], readAuthAccountsFallback());
      writeAuthAccountsFallback(merged);
      writeAuthPermissionFallback({
        ...readAuthPermissionFallback(),
        [created.username]: { role: created.role, campuses: created.campuses, modules: created.modules },
      });
      setAuthAccounts(merged);
      await loadAuthAccounts();
      setAuthCreateForm({
        staffId: "",
        username: "",
        password: "",
        displayName: "",
        role: "Viewer",
        campus: CAMPUS_LIST[0],
        modules: [...DEFAULT_VIEWER_MODULES],
      });
      setSetupMessage("Login account created.");
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      if (
        isApiUnavailableError(err) ||
        isMissingRouteError(err) ||
        msg.includes("unauthorized") ||
        msg.includes("admin role required") ||
        msg.includes("request failed (401)") ||
        msg.includes("request failed (403)")
      ) {
        const nextAccount: AuthAccount = {
          id: Date.now(),
          username,
          displayName,
          role: authCreateForm.role,
          campuses,
          modules,
        };
        const nextRows = [nextAccount, ...readAuthAccountsFallback()];
        writeAuthAccountsFallback(nextRows);
        const nextMap = {
          ...readAuthPermissionFallback(),
          [username]: { role: authCreateForm.role, campuses, modules },
        };
        writeAuthPermissionFallback(nextMap);
        setAuthAccounts(nextRows);
        setAuthPermissionDraft((prev) => ({
          ...prev,
          [nextAccount.id]: {
            role: nextAccount.role,
            campus: nextAccount.campuses[0] || "ALL",
            modules: nextAccount.modules,
          },
        }));
        setAuthCreateForm({
          staffId: "",
          username: "",
          password: "",
          displayName: "",
          role: "Viewer",
          campus: CAMPUS_LIST[0],
          modules: [...DEFAULT_VIEWER_MODULES],
        });
        setError("");
        setSetupMessage("Login account created.");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to create login account");
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

  function deleteUser(id: number) {
    if (!requireAdminAction()) return;
    setUsers((prev) => prev.filter((u) => u.id !== id));
    if (editingUserId === id) {
      setEditingUserId(null);
      setUserForm({ fullName: "", position: "", email: "" });
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

  function createInventoryItem() {
    if (!requireAdminAction()) return;
    const itemCode = (inventoryItemForm.itemCode.trim().toUpperCase() || autoInventoryItemCode);
    const itemName = inventoryItemForm.itemName.trim();
    const location = inventoryItemForm.location.trim();
    const unit = inventoryItemForm.unit.trim() || "pcs";
    if (!itemCode || !itemName || !location) {
      setError("Item code, item name, and location are required.");
      return;
    }
    if (inventoryItems.some((i) => i.itemCode === itemCode && i.campus === inventoryItemForm.campus)) {
      setError("Item code already exists in this campus.");
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
    setInventoryItems((prev) => [row, ...prev]);
    appendUiAudit("CREATE", "inventory_item", row.itemCode, `${row.campus} | ${row.itemName}`);
    setInventoryCodeManual(false);
    setInventoryItemForm((f) => ({
      ...f,
      itemCode: "",
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

  function createInventoryTxn() {
    if (!requireAdminAction()) return;
    const itemId = Number(inventoryTxnForm.itemId);
    const qty = Math.max(0, Number(inventoryTxnForm.qty || 0));
    if (!itemId || !inventoryTxnForm.date || qty <= 0) {
      setError("Please select item, date, and quantity.");
      return;
    }
    const item = inventoryItems.find((i) => i.id === itemId);
    if (!item) {
      setError("Item not found.");
      return;
    }
    const inQty = inventoryTxns.filter((x) => x.itemId === itemId && x.type === "IN").reduce((a, b) => a + b.qty, 0);
    const outQty = inventoryTxns.filter((x) => x.itemId === itemId && x.type === "OUT").reduce((a, b) => a + b.qty, 0);
    const currentStock = Number(item.openingQty || 0) + inQty - outQty;
    if (inventoryTxnForm.type === "OUT" && qty > currentStock) {
      setError(`Not enough stock. Current: ${currentStock}`);
      return;
    }
    const tx: InventoryTxn = {
      id: Date.now(),
      itemId: item.id,
      campus: item.campus,
      itemCode: item.itemCode,
      itemName: item.itemName,
      date: inventoryTxnForm.date,
      type: inventoryTxnForm.type,
      qty,
      by: inventoryTxnForm.by.trim(),
      note: inventoryTxnForm.note.trim(),
    };
    setInventoryTxns((prev) => [tx, ...prev]);
    appendUiAudit("CREATE", "inventory_txn", `${item.itemCode}-${tx.id}`, `${tx.type} ${tx.qty} ${item.unit}`);
    setInventoryTxnForm({
      itemId: "",
      date: toYmd(new Date()),
      type: "IN",
      qty: "",
      by: "",
      note: "",
    });
    setError("");
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

    const item = inventoryItems.find((i) => i.id === itemId);
    if (!item) {
      setError("Item not found.");
      return;
    }

    const currentRow = inventoryTxns.find((x) => x.id === editingInventoryTxnId);
    if (!currentRow) {
      setError("Transaction not found.");
      return;
    }

    const rowsWithoutCurrent = inventoryTxns.filter((x) => x.id !== editingInventoryTxnId);
    const inQty = rowsWithoutCurrent.filter((x) => x.itemId === itemId && x.type === "IN").reduce((a, b) => a + b.qty, 0);
    const outQty = rowsWithoutCurrent.filter((x) => x.itemId === itemId && x.type === "OUT").reduce((a, b) => a + b.qty, 0);
    const currentStock = Number(item.openingQty || 0) + inQty - outQty;
    if (inventoryTxnEditForm.type === "OUT" && qty > currentStock) {
      setError(`Not enough stock. Current: ${currentStock}`);
      return;
    }

    setInventoryTxns((prev) =>
      prev.map((x) =>
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
            }
          : x
      )
    );
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

    const item = inventoryItems.find((i) => i.id === row.itemId);
    if (!item) {
      setError("Item not found.");
      return;
    }

    if (row.type === "IN") {
      const rowsWithoutCurrent = inventoryTxns.filter((x) => x.id !== row.id);
      const inQty = rowsWithoutCurrent.filter((x) => x.itemId === row.itemId && x.type === "IN").reduce((a, b) => a + b.qty, 0);
      const outQty = rowsWithoutCurrent.filter((x) => x.itemId === row.itemId && x.type === "OUT").reduce((a, b) => a + b.qty, 0);
      const currentStock = Number(item.openingQty || 0) + inQty - outQty;
      if (currentStock < 0) {
        setError("Cannot delete this Stock In record because it would make stock negative.");
        return;
      }
    }

    setInventoryTxns((prev) => prev.filter((x) => x.id !== row.id));
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
        filterAssets(nextLocal, effectiveAssetCampusFilter, assetCategoryFilter, search)
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
    const isDesktopAsset = asset.category === "IT" && asset.type === DESKTOP_PARENT_TYPE;
    const photos = normalizeAssetPhotos(asset);
    setAssetEditForm({
      location: asset.location || "",
      pcType: asset.category === "IT" && asset.type === DESKTOP_PARENT_TYPE
        ? asset.pcType || PC_TYPE_OPTIONS[0].value
        : "",
      setCode: asset.setCode || "",
      parentAssetId: asset.parentAssetId || "",
      useExistingSet: !isDesktopAsset && !!asset.parentAssetId,
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
        setAssets(filterAssets(nextLocal, effectiveAssetCampusFilter, assetCategoryFilter, search));
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
    const needsUser =
      !!editingAsset &&
      USER_REQUIRED_TYPES.includes(editingAsset.type) &&
      !isSharedLocation(assetEditForm.location);
    if (needsUser && !assetEditForm.assignedTo.trim()) {
      alert(t.userRequired);
      return;
    }
    if (!editingIsDesktop && assetEditForm.useExistingSet && !assetEditForm.parentAssetId.trim()) {
      alert(t.selectDesktopUnit);
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
        : (assetEditForm.useExistingSet ? assetEditForm.setCode.trim() : ""),
      parentAssetId: editingIsDesktop
        ? ""
        : (assetEditForm.useExistingSet ? assetEditForm.parentAssetId.trim().toUpperCase() : ""),
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
        const normalizedPhotos = normalizeAssetPhotos(payload);
        return { ...a, ...payload, photo: normalizedPhotos[0] || "", photos: normalizedPhotos, statusHistory };
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
      setAssets(filterAssets(nextLocal, effectiveAssetCampusFilter, assetCategoryFilter, search));
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
    if (!scheduleForm.assetId) return;
    if (scheduleForm.repeatMode === "NONE" && !scheduleForm.date) return;
    const assetId = Number(scheduleForm.assetId);
    if (!assetId) return;

    const payload = {
      nextMaintenanceDate: scheduleForm.repeatMode === "NONE" ? scheduleForm.date : "",
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
      let nextLocal = readAssetFallback().map((asset) =>
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
      setAssets(filterAssets(nextLocal, effectiveAssetCampusFilter, assetCategoryFilter, search));
      setStats(buildStatsFromAssets(nextLocal, campusFilter));
      appendUiAudit("SCHEDULE_UPDATE", "asset", String(assetId), payload.nextMaintenanceDate || "repeat schedule");
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
  }

  async function clearScheduleForAsset(assetId: number) {
    if (!requireAdminAction()) return;
    if (!window.confirm("Delete schedule for this asset?")) return;

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
      const nextLocal = readAssetFallback().map((asset) =>
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
      setAssets(filterAssets(nextLocal, effectiveAssetCampusFilter, assetCategoryFilter, search));
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

  async function saveBulkMaintenanceSchedule() {
    if (!requireAdminAction()) return;
    if (bulkScheduleForm.repeatMode === "NONE" && !bulkScheduleForm.date) return;

    const matched = assets.filter((asset) => {
      const campusOk = bulkScheduleForm.campus === "ALL" || asset.campus === bulkScheduleForm.campus;
      return campusOk && asset.category === bulkScheduleForm.category && asset.type === bulkScheduleForm.type;
    });
    if (!matched.length) {
      setSetupMessage("No assets matched this campus + item type.");
      return;
    }

    const payload = {
      nextMaintenanceDate: bulkScheduleForm.repeatMode === "NONE" ? bulkScheduleForm.date : "",
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
      const nextLocal = readAssetFallback().map((asset) =>
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
      setAssets(filterAssets(nextLocal, effectiveAssetCampusFilter, assetCategoryFilter, search));
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
    const shouldAutoRetire =
      entry.completion === "Done" && entry.type.trim().toLowerCase() === "replacement";
    const shouldApplyRetireStatus =
      shouldAutoRetire && (sourceAsset?.status || "Active") !== "Retired";
    const retireReason = `Auto retired after replacement maintenance on ${entry.date}`;

    setBusy(true);
    setError("");
    try {
      const nextLocal = readAssetFallback().map((asset) => {
        if (asset.id !== assetId) return asset;

        let nextMaintenanceDate = asset.nextMaintenanceDate || "";
        if (entry.completion === "Done") {
          if (asset.repeatMode === "MONTHLY_WEEKDAY") {
            nextMaintenanceDate = resolveNextScheduleDate(asset, shiftYmd(entry.date, 1));
          } else if (!nextMaintenanceDate || nextMaintenanceDate <= entry.date) {
            nextMaintenanceDate = "";
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
      setAssets(filterAssets(nextLocal, effectiveAssetCampusFilter, assetCategoryFilter, search));
      setStats(buildStatsFromAssets(nextLocal, campusFilter));
      appendUiAudit("MAINTENANCE_CREATE", "asset", String(assetId), `${entry.type} | ${entry.completion || "-"}`);
      if (shouldApplyRetireStatus) {
        appendUiAudit("UPDATE_STATUS", "asset", String(assetId), "Retired (auto from replacement)");
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
      setAssets(filterAssets(nextLocal, effectiveAssetCampusFilter, assetCategoryFilter, search));
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
      setAssets(filterAssets(nextLocal, effectiveAssetCampusFilter, assetCategoryFilter, search));
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
      setAssets(filterAssets(nextLocal, effectiveAssetCampusFilter, assetCategoryFilter, search));
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

    setBusy(true);
    setError("");
    try {
      const nextLocal = readAssetFallback().map((asset) => {
        if (asset.id !== assetId) return asset;
        return {
          ...asset,
          campus: transferEntry.toCampus,
          location: transferEntry.toLocation,
          transferHistory: [transferEntry, ...(asset.transferHistory || [])],
        };
      });

      try {
        await requestJson<{ asset: Asset }>(`/api/assets/${assetId}`, {
          method: "PATCH",
          body: JSON.stringify({
            campus: transferEntry.toCampus,
            location: transferEntry.toLocation,
            transferHistory: [transferEntry, ...(current.transferHistory || [])],
          }),
        });
      } catch (err) {
        if (!isApiUnavailableError(err) && !isMissingRouteError(err)) throw err;
      }

      writeAssetFallback(nextLocal);
      setAssets(filterAssets(nextLocal, effectiveAssetCampusFilter, assetCategoryFilter, search));
      setStats(buildStatsFromAssets(nextLocal, campusFilter));
      appendUiAudit("TRANSFER", "asset", String(assetId), `${transferEntry.fromCampus} -> ${transferEntry.toCampus}`);
      setTransferForm((f) => ({
        ...f,
        date: "",
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
      reason: "",
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
        return { ...asset, maintenanceHistory: nextHistory };
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
      setAssets(filterAssets(nextLocal, effectiveAssetCampusFilter, assetCategoryFilter, search));
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

  async function deleteMaintenanceEntry(entryId: number) {
    if (!requireAdminAction()) return;
    if (!maintenanceDetailAssetId) return;
    if (!window.confirm("Delete this maintenance record?")) return;

    setBusy(true);
    setError("");
    try {
      const nextLocal = readAssetFallback().map((asset) => {
        if (asset.id !== maintenanceDetailAssetId) return asset;
        return {
          ...asset,
          maintenanceHistory: (asset.maintenanceHistory || []).filter(
            (h) => Number(h.id) !== Number(entryId)
          ),
        };
      });

      try {
        await requestJson<{ ok: boolean }>(`/api/assets/${maintenanceDetailAssetId}/history/${entryId}`, {
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
      setAssets(filterAssets(nextLocal, effectiveAssetCampusFilter, assetCategoryFilter, search));
      setStats(buildStatsFromAssets(nextLocal, campusFilter));
      appendUiAudit("MAINTENANCE_DELETE", "maintenance_record", String(entryId), "Deleted");
      if (Number(maintenanceEditingEntryId) === Number(entryId)) {
        cancelMaintenanceEntryEdit();
      }
      setMaintenanceDetailAssetId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete maintenance record");
    } finally {
      setBusy(false);
    }
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
      setAssets(filterAssets(nextLocal, effectiveAssetCampusFilter, assetCategoryFilter, search));
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
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert(t.photoLimit);
      return;
    }
    try {
      const photo = await optimizeUploadPhoto(file);
      setSetPackDraft((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          photo,
        },
      }));
    } catch {
      alert(t.photoProcessError);
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
    if (keyboard) map.KBD = keyboard;
    if (mouse) map.MSE = mouse;
    return map;
  }, [assets, editingAsset]);

  useEffect(() => {
    if (!editingAsset) {
      setEditCreateSetPack(false);
      setEditSetPackEnabled({ MON: false, MON2: false, KBD: false, MSE: false });
      return;
    }
    const isDesktopParent = editingAsset.category === "IT" && editingAsset.type === DESKTOP_PARENT_TYPE;
    if (!isDesktopParent) {
      setEditCreateSetPack(false);
      setEditSetPackEnabled({ MON: false, MON2: false, KBD: false, MSE: false });
      return;
    }
    const hasAnyChild =
      Boolean(editingSetPackChildren.MON) ||
      Boolean(editingSetPackChildren.MON2) ||
      Boolean(editingSetPackChildren.KBD) ||
      Boolean(editingSetPackChildren.MSE);
    setEditCreateSetPack(hasAnyChild);
    setEditSetPackEnabled({
      MON: Boolean(editingSetPackChildren.MON),
      MON2: Boolean(editingSetPackChildren.MON2),
      KBD: Boolean(editingSetPackChildren.KBD),
      MSE: Boolean(editingSetPackChildren.MSE),
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
    return type === "replacement" && completion === "done";
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
  const verificationAssets = useMemo(() => {
    const today = toYmd(new Date());
    const filtered = campusFilter === "ALL" ? assets : assets.filter((a) => a.campus === campusFilter);
    return filtered
      .filter((a) => a.nextVerificationDate)
      .map((a) => ({
        ...a,
        verificationStatus:
          (a.nextVerificationDate || "") < today
            ? "Overdue"
            : (a.nextVerificationDate || "") <= shiftYmd(today, 30)
              ? "Due Soon"
              : "Scheduled",
      }))
      .sort((a, b) => (a.nextVerificationDate || "").localeCompare(b.nextVerificationDate || ""));
  }, [assets, campusFilter]);
  const overdueVerificationAssets = useMemo(
    () => verificationAssets.filter((a) => a.verificationStatus === "Overdue"),
    [verificationAssets]
  );
  const dueSoonVerificationAssets = useMemo(
    () => verificationAssets.filter((a) => a.verificationStatus === "Due Soon"),
    [verificationAssets]
  );
  const recentTransfers = useMemo(() => {
    const rows: Array<{ assetId: string; assetPhoto: string; entry: TransferEntry }> = [];
    for (const asset of assets) {
      for (const entry of asset.transferHistory || []) {
        rows.push({ assetId: asset.assetId, assetPhoto: asset.photo || "", entry });
      }
    }
    return rows
      .sort((a, b) => b.entry.date.localeCompare(a.entry.date))
      .slice(0, 6);
  }, [assets]);
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
  const scheduleAssets = useMemo(() => {
    const today = toYmd(new Date());
    const merged = mergeAssets(assets, readAssetFallback());
    const filtered = campusFilter === "ALL" ? merged : merged.filter((a) => a.campus === campusFilter);
    return filtered
      .map((a) => ({ ...a, nextMaintenanceDate: resolveNextScheduleDate(a, today) }))
      .filter((a) => a.nextMaintenanceDate)
      .sort((a, b) => (a.nextMaintenanceDate || "").localeCompare(b.nextMaintenanceDate || ""));
  }, [assets, campusFilter]);
  const nextScheduleRows = useMemo(() => {
    return [...scheduleAssets]
      .sort((a, b) => (a.nextMaintenanceDate || "").localeCompare(b.nextMaintenanceDate || ""))
      .slice(0, 6);
  }, [scheduleAssets]);
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
          if (!map.has(key)) map.set(key, []);
          map.get(key)?.push({ ...asset, nextMaintenanceDate: key });
        }
        continue;
      }
      const key = asset.nextMaintenanceDate || "";
      if (!key || key < startYmd || key > endYmd) continue;
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
  const calendarGridDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const startDate = new Date(year, month, 1 - startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      return {
        ymd: toYmd(d),
        day: d.getDate(),
        inMonth: d.getMonth() === month,
        hasItems: (scheduleByDate.get(toYmd(d)) || []).length > 0,
      };
    });
  }, [calendarMonth, scheduleByDate]);
  const selectedDateItems = useMemo(
    () => scheduleByDate.get(selectedCalendarDate) || [],
    [scheduleByDate, selectedCalendarDate]
  );
  const scheduleAlertItems = useMemo(() => {
    if (scheduleAlertModal === "overdue") {
      return { title: "Overdue Scheduled Assets", items: overdueScheduleAssets };
    }
    if (scheduleAlertModal === "upcoming") {
      return { title: "Scheduled Assets - Next 7 Days", items: upcomingScheduleAssets };
    }
    if (scheduleAlertModal === "scheduled") {
      return { title: "All Scheduled Assets", items: scheduleAssets };
    }
    if (scheduleAlertModal === "selected") {
      return { title: `Selected Date Assets - ${selectedCalendarDate}`, items: selectedDateItems };
    }
    return { title: "", items: [] as Asset[] };
  }, [
    scheduleAlertModal,
    overdueScheduleAssets,
    upcomingScheduleAssets,
    scheduleAssets,
    selectedDateItems,
    selectedCalendarDate,
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

  useEffect(() => {
    if (scheduleForm.assetId) return;
    if (scheduleAssets.length) {
      setScheduleForm((f) => ({ ...f, assetId: String(scheduleAssets[0].id) }));
    }
  }, [scheduleAssets, scheduleForm.assetId]);

  useEffect(() => {
    if (maintenanceRecordForm.assetId) return;
    if (assets.length) {
      setMaintenanceRecordForm((f) => ({ ...f, assetId: String(assets[0].id) }));
    }
  }, [assets, maintenanceRecordForm.assetId]);

  useEffect(() => {
    if (verificationRecordForm.assetId) return;
    if (assets.length) {
      setVerificationRecordForm((f) => ({ ...f, assetId: String(assets[0].id) }));
    }
  }, [assets, verificationRecordForm.assetId]);

  useEffect(() => {
    if (transferForm.assetId) return;
    if (assets.length) {
      const first = assets[0];
      setTransferForm((f) => ({
        ...f,
        assetId: String(first.id),
        toCampus: first.campus,
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
      by: string;
      reason: string;
      note: string;
    }> = [];
    for (const asset of sourceAssets) {
      for (const entry of asset.transferHistory || []) {
        rows.push({
          rowId: `${asset.id}-${entry.id}`,
          assetId: asset.assetId,
          date: entry.date || "",
          fromCampus: entry.fromCampus || "",
          fromLocation: entry.fromLocation || "",
          toCampus: entry.toCampus || "",
          toLocation: entry.toLocation || "",
          by: entry.by || "",
          reason: entry.reason || "",
          note: entry.note || "",
        });
      }
    }
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [assets]);

  const maintenanceCompletionRows = useMemo(() => {
    return allMaintenanceRows.filter((row) => row.date?.startsWith(reportMonth));
  }, [allMaintenanceRows, reportMonth]);

  const maintenanceCompletionSummary = useMemo(() => {
    const done = maintenanceCompletionRows.filter((r) => r.completion === "Done").length;
    const notYet = maintenanceCompletionRows.filter((r) => r.completion !== "Done").length;
    return { done, notYet, total: maintenanceCompletionRows.length };
  }, [maintenanceCompletionRows]);
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
          itemName: assetItemName(asset.category, asset.type, asset.pcType || ""),
          itemDescription: toItemDescription(asset),
          location: asset.location || "-",
          purchaseDate: asset.purchaseDate || "-",
          lastServiceDate: toLastServiceDate(asset),
          assignedTo: asset.assignedTo || "-",
          status: asset.status || "-",
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
  }, [assets, assetItemName, campusLabel]);

  const qrLabelRows = useMemo(
    () =>
      assetMasterSetRows.map((row) => ({
        assetDbId: row.assetDbId,
        assetId: row.assetId,
        itemName: row.itemName,
        campus: row.campus,
        location: row.location,
        status: row.status,
      })),
    [assetMasterSetRows]
  );

  const qrScanBase = useMemo(() => {
    const manual = String(apiBaseInput || "").trim().replace(/\/+$/, "");
    if (manual) return manual;
    if (typeof window === "undefined") return DEFAULT_CLOUD_API_BASE;
    const host = String(window.location.hostname || "").toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") {
      return DEFAULT_CLOUD_API_BASE;
    }
    return String(window.location.origin || DEFAULT_CLOUD_API_BASE).replace(/\/+$/, "");
  }, [apiBaseInput]);

  const buildAssetQrUrl = useCallback((assetId: string) => {
    const id = String(assetId || "").trim();
    if (!id) return "";
    return `${qrScanBase}/?assetId=${encodeURIComponent(id)}`;
  }, [qrScanBase]);

  useEffect(() => {
    if (reportType !== "qr_labels") return;
    const missing = qrLabelRows.filter((row) => !qrCodeMap[row.assetId]);
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
  }, [reportType, qrLabelRows, qrCodeMap, buildAssetQrUrl]);

  useEffect(() => {
    if (!pendingQrAssetId || !authUser || !assets.length) return;
    const found = assets.find(
      (a) => String(a.assetId || "").trim().toUpperCase() === pendingQrAssetId
    );
    if (found) {
      setTab("assets");
      setAssetsView("list");
      setAssetDetailId(found.id);
    } else {
      setError(`QR asset not found: ${pendingQrAssetId}`);
    }
    setPendingQrAssetId("");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("assetId") || url.searchParams.has("asset")) {
        url.searchParams.delete("assetId");
        url.searchParams.delete("asset");
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      }
    }
  }, [pendingQrAssetId, authUser, assets]);

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
      title = "Asset Master Register Report";
      columns = ["Photo", "Asset ID", "Set Code", "Linked To (Main Asset)", "Item Name", "Category", "Item Description", "Location", "Purchase Date", "Last Service", "Assigned To", "Status"];
      rows = assetMasterSetRows.map((row) => [
        toPrintablePhotoUrl(row.photo || ""),
        row.assetId,
        row.setCode,
        row.linkedTo,
        row.itemName,
        row.category,
        row.itemDescription,
        row.location || "-",
        formatDate(row.purchaseDate || "-"),
        formatDate(row.lastServiceDate || "-"),
        row.assignedTo,
        row.status,
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
        a.status || "-",
        a.scheduleNote || "-",
      ]);
    } else if (reportType === "transfer") {
      title = "Asset Transfer Log Report";
      columns = ["Date", "Asset ID", "From Campus", "From Location", "To Campus", "To Location", "By", "Reason"];
      rows = allTransferRows.map((r) => [
        r.date ? formatDate(r.date) : "-",
        r.assetId,
        campusLabel(r.fromCampus),
        r.fromLocation || "-",
        campusLabel(r.toCampus),
        r.toLocation || "-",
        r.by || "-",
        r.reason || "-",
      ]);
    } else if (reportType === "maintenance_completion") {
      title = `Maintenance Completion Report (${reportMonth})`;
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
      columns = ["QR", "Asset ID", "Item Name", "Campus", "Location", "Status", "Scan Link"];
      const missingRows = qrLabelRows.filter((row) => !qrCodeMap[row.assetId]);
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
          setQrCodeMap((prev) => {
            const next = { ...prev };
            for (const [assetId, dataUrl] of generated) next[assetId] = dataUrl;
            return next;
          });
        }
      }
      rows = qrLabelRows.map((row) => [
        qrCodeMap[row.assetId] || "",
        row.assetId,
        row.itemName,
        campusLabel(row.campus),
        row.location || "-",
        row.status || "-",
        buildAssetQrUrl(row.assetId),
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
        : reportType === "asset_master"
        ? `<p><strong>Total Assets:</strong> ${assetMasterSetRows.length}</p>`
        : reportType === "qr_labels"
        ? `<p><strong>Total QR Labels:</strong> ${qrLabelRows.length}</p>`
        : "";

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
          @media print { body { margin: 8mm; } }
        </style>
      </head>
      <body>
        <h1>Eco International School</h1>
        <h2>${escapeHtml(title)}</h2>
        <p class="meta">Generated: ${escapeHtml(generatedAt)} | Campus Filter: ${escapeHtml(filterLabel)}</p>
        ${summaryHtml}
        <table>
          <thead><tr>${columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>
          <tbody>${tableHtml}</tbody>
        </table>
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
      setLoginForm({ username: "", password: "" });
      await loadData();
    } catch (err) {
      // Local fallback login is disabled in server-only mode.
      if (!SERVER_ONLY_STORAGE && (isApiUnavailableError(err) || isMissingRouteError(err))) {
        const username = loginForm.username.trim().toLowerCase();
        const password = loginForm.password;
        if (username === "admin" && password === "EcoAdmin@2026!") {
          runtimeAuthToken = LOCAL_ADMIN_TOKEN;
          trySetLocalStorage(AUTH_TOKEN_KEY, LOCAL_ADMIN_TOKEN);
          const adminUser: AuthUser = { id: 1, username: "admin", displayName: "Eco Admin", role: "Admin", campuses: ["ALL"] };
          trySetLocalStorage(AUTH_USER_KEY, JSON.stringify(adminUser));
          setAuthUser(adminUser);
          setLoginForm({ username: "", password: "" });
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
          setLoginForm({ username: "", password: "" });
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

  function saveApiServerUrl() {
    const next = apiBaseInput.trim().replace(/\/+$/, "");
    if (SERVER_ONLY_STORAGE) {
      setApiBaseInput(ENV_API_BASE_URL || getAutoApiBaseForHost() || "");
      setError("");
      return;
    }
    if (next) {
      trySetLocalStorage(API_BASE_OVERRIDE_KEY, next);
      setApiBaseInput(next);
      setError("");
      return;
    }
    localStorage.removeItem(API_BASE_OVERRIDE_KEY);
    setApiBaseInput(ENV_API_BASE_URL || getAutoApiBaseForHost() || "");
    setError("");
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
      <main className="app-shell">
        <div className="bg-orb bg-orb-a" aria-hidden="true" />
        <div className="bg-orb bg-orb-b" aria-hidden="true" />
        <section className="app-card login-page">
          <section className="panel login-panel">
            <div className="login-top">
              <p className="eyebrow">{t.school}</p>
              <h1>{t.title}</h1>
              <p className="subhead">{t.pleaseLogin}</p>
            </div>
            <label className="field">
              <span>{t.language}</span>
              <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="input">
                <option value="en">{t.english}</option>
                <option value="km">{t.khmer}</option>
              </select>
            </label>
            {error ? <p className="alert alert-error">{error}</p> : null}
            <h2>{t.login}</h2>
            <div className="form-grid login-grid">
              <label className="field field-wide">
                <span>{t.apiServerUrl}</span>
                <input
                  className="input"
                  placeholder="http://192.168.1.50:4000"
                  value={apiBaseInput}
                  onChange={(e) => setApiBaseInput(e.target.value)}
                />
              </label>
              <label className="field">
                <span>{t.username}</span>
                <input
                  className="input"
                  value={loginForm.username}
                  autoComplete="username"
                  onChange={(e) => setLoginForm((f) => ({ ...f, username: e.target.value }))}
                />
              </label>
              <label className="field">
                <span>{t.password}</span>
                <div className="password-row">
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    className="input"
                    value={loginForm.password}
                    autoComplete="current-password"
                    onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleLogin();
                    }}
                  />
                  <button
                    type="button"
                    className="tab"
                    onClick={() => setShowLoginPassword((v) => !v)}
                  >
                    {showLoginPassword ? t.hide : t.show}
                  </button>
                </div>
              </label>
            </div>
            <div className="asset-actions">
              <div className="tiny">
                Admin: admin / EcoAdmin@2026! | Viewer: viewer / EcoViewer@2026!
                <br />
                Leave API URL blank to use default cloud server. For LAN testing, set your Mac IP (port 4000).
              </div>
              <div className="row-actions">
                <button className="tab" type="button" onClick={saveApiServerUrl}>{t.saveApiUrl}</button>
                <button className="btn-primary" disabled={busy} onClick={handleLogin}>{t.login}</button>
              </div>
            </div>
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
            <p className="eyebrow">{t.school}</p>
            <h1>{t.title}</h1>
            <p className="subhead">{t.subhead}</p>
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
                  {authUser.role === "Admin" ? <option value="ALL">{t.allCampuses}</option> : null}
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
            {navMenuItems.map((item) => (
              <button
                key={item.id}
                className={`main-nav-btn ${tab === item.id ? "main-nav-btn-active" : ""}`}
                onClick={() => handleNavChange(item.id)}
              >
                {item.label}
              </button>
            ))}
          </aside>

          <section className="workspace-main">
            <div className="mobile-nav-hud">
              <p className="mobile-nav-hint">{t.phoneHint}</p>
              <label className="field mobile-nav-field">
                <span>{t.menu}</span>
                <select
                  className="input mobile-nav-select"
                  value={tab}
                  onChange={(e) => handleNavChange(e.target.value as NavModule)}
                >
                  {navMenuItems.map((item) => (
                    <option key={`mobile-nav-${item.id}`} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className={`mobile-settings-toggle ${mobileMenuOpen ? "mobile-settings-toggle-active" : ""}`}
                type="button"
                onClick={() => setMobileMenuOpen((open) => !open)}
                aria-expanded={mobileMenuOpen}
              >
                <span>{activeNavLabel}</span>
                <span>{mobileMenuOpen ? t.close : t.options}</span>
              </button>
              {mobileMenuOpen ? (
                <div className="mobile-settings-panel">
                  <label className="field">
                    <span>{t.view}</span>
                    <select value={campusFilter} onChange={(e) => setCampusFilter(e.target.value)} className="input">
                      {authUser.role === "Admin" ? <option value="ALL">{t.allCampuses}</option> : null}
                      {allowedCampuses.map((campus) => (
                        <option key={`mobile-campus-${campus}`} value={campus}>{campusLabel(campus)}</option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>{t.language}</span>
                    <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="input">
                      <option value="en">{t.english}</option>
                      <option value="km">{t.khmer}</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>{t.account}</span>
                    <div className="detail-value">{authUser.displayName} ({authUser.role})</div>
                  </label>
                  <button className="tab" type="button" onClick={handleLogout}>{t.logout}</button>
                </div>
              ) : null}
            </div>
            {error ? <p className="alert alert-error">{error}</p> : null}
            {!isAdmin ? <p className="alert">{t.viewerMode}</p> : null}
            {loading ? <p className="alert">{t.loading}</p> : null}

        {tab === "dashboard" && (
          <section className="panel dashboard-panel">
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
                  <button className="tab" onClick={() => setTab("inventory")}>Inventory</button>
                  <button className="tab" onClick={() => setTab("schedule")}>{t.openSchedule}</button>
                  <button className="tab" onClick={() => setTab("maintenance")}>{t.recordMaintenance}</button>
                </div>
              </div>
            </div>

            <div className="stats-grid dashboard-stats">
              <article className="stat-card stat-card-total">
                <div className="stat-label">{t.totalAssets}</div>
                <button className="stat-value stat-link" onClick={() => setOverviewModal("total")}>
                  {stats.totalAssets}
                </button>
              </article>
              <article className="stat-card stat-card-it">
                <div className="stat-label">{t.itAssets}</div>
                <button className="stat-value stat-link" onClick={() => setOverviewModal("it")}>
                  {stats.itAssets}
                </button>
              </article>
              <article className="stat-card stat-card-safety">
                <div className="stat-label">{t.safetyAssets}</div>
                <button className="stat-value stat-link" onClick={() => setOverviewModal("safety")}>
                  {stats.safetyAssets}
                </button>
              </article>
              <article className="stat-card stat-card-ticket">
                <div className="stat-label">{t.openWorkOrders}</div>
                <button className="stat-value stat-link" onClick={() => setOverviewModal("tickets")}>
                  {stats.openTickets}
                </button>
              </article>
            </div>

            <div className="dashboard-subtabs">
              <button className={`tab ${dashboardView === "overview" ? "tab-active" : ""}`} onClick={() => setDashboardView("overview")}>Overview</button>
              <button className={`tab ${dashboardView === "schedule" ? "tab-active" : ""}`} onClick={() => setDashboardView("schedule")}>Schedule</button>
              <button className={`tab ${dashboardView === "activity" ? "tab-active" : ""}`} onClick={() => setDashboardView("activity")}>Activity</button>
            </div>

            {dashboardView === "overview" && (
              <div className="dashboard-clean-grid">
                <article className="panel dashboard-widget dashboard-focus-panel">
                  <div className="dashboard-widget-head">
                    <h3 className="section-title">Maintenance Focus</h3>
                  </div>
                  <div className="dashboard-mini-grid">
                    <article className="stat-card mini danger">
                      <div className="stat-label">Overdue</div>
                      <button className="stat-value stat-link" onClick={() => setScheduleAlertModal("overdue")}>
                        {overdueScheduleAssets.length}
                      </button>
                    </article>
                    <article className="stat-card mini">
                      <div className="stat-label">Due Next 7 Days</div>
                      <button className="stat-value stat-link" onClick={() => setScheduleAlertModal("upcoming")}>
                        {upcomingScheduleAssets.length}
                      </button>
                    </article>
                    <article className="stat-card mini">
                      <div className="stat-label">Scheduled</div>
                      <button className="stat-value stat-link" onClick={() => setScheduleAlertModal("scheduled")}>
                        {scheduleAssets.length}
                      </button>
                    </article>
                    <article className="stat-card mini">
                      <div className="stat-label">Verification Due</div>
                      <button className="stat-value stat-link" onClick={() => setTab("verification")}>
                        {dueSoonVerificationAssets.length + overdueVerificationAssets.length}
                      </button>
                    </article>
                  </div>
                  <div className="dashboard-focus-actions">
                    <button className="tab" onClick={() => setTab("schedule")}>Go to Schedule</button>
                    <button className="tab" onClick={() => setTab("maintenance")}>Record Maintenance</button>
                    <button className="tab" onClick={() => setTab("verification")}>Record Verification</button>
                  </div>
                </article>

                <article className="panel dashboard-widget">
                  <div className="dashboard-widget-head">
                    <h3 className="section-title">Campus Summary</h3>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>{t.campus}</th>
                          <th>{t.assets}</th>
                          <th>{t.openTickets}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.byCampus.length ? (
                          stats.byCampus.map((row) => (
                            <tr key={row.campus}>
                              <td>{campusLabel(row.campus)}</td>
                              <td>{row.assets}</td>
                              <td>{row.openTickets}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3}>{t.noDataYet}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </article>
              </div>
            )}

            {dashboardView === "schedule" && (
              <article className="panel dashboard-widget" style={{ marginTop: 12 }}>
                <div className="dashboard-widget-head">
                  <h3 className="section-title">{t.nextScheduledAssets}</h3>
                  <p className="tiny">Click asset ID to open maintenance form</p>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{t.date}</th>
                        <th>{t.assetId}</th>
                        <th>{t.photo}</th>
                        <th>{t.campus}</th>
                        <th>{t.location}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nextScheduleRows.length ? (
                        nextScheduleRows.map((asset) => (
                          <tr key={`next-schedule-${asset.id}`}>
                            <td>{formatDate(asset.nextMaintenanceDate || "-")}</td>
                            <td>
                              <button
                                className="tab"
                                onClick={() => {
                                  setTab("maintenance");
                                  setMaintenanceView("record");
                                  setMaintenanceRecordForm((f) => ({
                                    ...f,
                                    assetId: String(asset.id),
                                    date: toYmd(new Date()),
                                  }));
                                }}
                              >
                                <strong>{asset.assetId}</strong>
                              </button>
                            </td>
                            <td>{renderAssetPhoto(asset.photo || "", asset.assetId)}</td>
                            <td>{campusLabel(asset.campus)}</td>
                            <td>{asset.location || "-"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5}>No scheduled assets yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            )}

            {dashboardView === "activity" && (
              <article className="panel dashboard-widget" style={{ marginTop: 12 }}>
                <div className="dashboard-widget-head">
                  <h3 className="section-title">Recent Transfers</h3>
                  <p className="tiny">Latest moved assets</p>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{t.photo}</th>
                        <th>{t.assetId}</th>
                        <th>{t.date}</th>
                        <th>{t.fromCampus}</th>
                        <th>{t.fromLocation}</th>
                        <th>{t.toCampus}</th>
                        <th>{t.toLocation}</th>
                        <th>{t.by}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentTransfers.length ? (
                        recentTransfers.map((row) => (
                          <tr key={`transfer-${row.assetId}-${row.entry.id}`}>
                            <td>{renderAssetPhoto(row.assetPhoto, row.assetId)}</td>
                            <td><strong>{row.assetId}</strong></td>
                            <td>{formatDate(row.entry.date)}</td>
                            <td>{campusLabel(row.entry.fromCampus)}</td>
                            <td>{row.entry.fromLocation || "-"}</td>
                            <td>{campusLabel(row.entry.toCampus)}</td>
                            <td>{row.entry.toLocation || "-"}</td>
                            <td>{row.entry.by || "-"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8}>{t.noTransfersYet}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            )}

          </section>
        )}

        {tab === "assets" && (
          <>
            <div className="tabs">
              {isAdmin ? (
                <button
                  className={`tab ${assetsView === "register" ? "tab-active" : ""}`}
                  onClick={() => setAssetsView("register")}
                >
                  {t.registerAsset}
                </button>
              ) : null}
              <button
                className={`tab ${assetsView === "list" ? "tab-active" : ""}`}
                onClick={() => setAssetsView("list")}
              >
                {t.assetRegistry}
              </button>
            </div>

            {assetsView === "register" && (
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
                                        value={setPackDraft[item.type].model}
                                        onChange={(e) =>
                                          setSetPackDraft((prev) => ({
                                            ...prev,
                                            [item.type]: {
                                              ...prev[item.type],
                                              model: e.target.value,
                                            },
                                          }))
                                        }
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
                                        onChange={(e) => onSetPackPhotoFile(item.type, e)}
                                      />
                                      <div className="photo-preview-wrap">
                                        {setPackDraft[item.type].photo ? (
                                          <img
                                            src={setPackDraft[item.type].photo}
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
                                            disabled={!setPackDraft[item.type].photo}
                                            onClick={() => {
                                              setSetPackDraft((prev) => ({
                                                ...prev,
                                                [item.type]: {
                                                  ...prev[item.type],
                                                  photo: "",
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
                  ) : (
                    <>
                      <label className="field field-wide">
                        <span>{t.linkToDesktopSet}</span>
                        <input
                          type="checkbox"
                          checked={assetForm.useExistingSet}
                          onChange={(e) =>
                            setAssetForm((f) => ({
                              ...f,
                              useExistingSet: e.target.checked,
                              setCode: e.target.checked ? f.setCode : "",
                              parentAssetId: e.target.checked ? f.parentAssetId : "",
                            }))
                          }
                        />
                      </label>
                      {assetForm.useExistingSet ? (
                        <label className="field field-wide">
                          <span>{t.selectDesktopUnit}</span>
                          <select
                            className="input"
                            value={assetForm.parentAssetId}
                            onChange={(e) => {
                              const parent = desktopSetParentsForCreate.find((a) => a.assetId === e.target.value);
                              setAssetForm((f) => ({
                                ...f,
                                parentAssetId: e.target.value,
                                setCode: parent?.setCode || "",
                              }));
                            }}
                          >
                            <option value="">-</option>
                            {desktopSetParentsForCreate.map((asset) => (
                              <option key={`desktop-parent-${asset.id}`} value={asset.assetId}>
                                {asset.assetId} - {asset.location} ({asset.setCode || "-"})
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                    </>
                  )}
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
                    <input className="input" value={assetForm.model} onChange={(e) => setAssetForm((f) => ({ ...f, model: e.target.value }))} />
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

            {assetsView === "list" && (
              <section className="panel">
                <div className="panel-row">
                  <h2>{t.assetRegistry}</h2>
                  <div className="panel-filters">
                    <select className="input" value={assetCampusFilter} onChange={(e) => setAssetCampusFilter(e.target.value)}>
                      <option value="ALL">{t.allCampuses}</option>
                      {allowedCampuses.map((campus) => (
                        <option key={campus} value={campus}>{campusLabel(campus)}</option>
                      ))}
                    </select>
                    <select className="input" value={assetCategoryFilter} onChange={(e) => setAssetCategoryFilter(e.target.value)}>
                      <option value="ALL">{t.allCategories}</option>
                      {CATEGORY_OPTIONS.map((category) => (
                        <option key={category.value} value={category.value}>{lang === "km" ? category.km : category.en}</option>
                      ))}
                    </select>
                    <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.searchAsset} />
                  </div>
                </div>

                <div className="table-wrap">
                  <table className="table-compact">
                    <thead>
                      <tr>
                        <th>{t.assetId}</th>
                        <th>{t.campus}</th>
                        <th>{t.category}</th>
                        <th>{t.photo}</th>
                        <th>{t.name}</th>
                        <th>{t.location}</th>
                        <th>{t.actions}</th>
                        <th>{t.status}</th>
                        <th>{t.history}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assets.length ? (
                        assets.map((asset) => (
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
                            <td>
                              <button
                                className="tab"
                                onClick={() => {
                                  setHistoryAssetId(asset.id);
                                }}
                              >
                                History
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={9}>{t.noAssets}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {assetsView === "list" && detailAsset && (
              <div className="modal-backdrop" onClick={() => setAssetDetailId(null)}>
                <section className="panel modal-panel" onClick={(e) => e.stopPropagation()}>
                  <div className="panel-row">
                    <h2>Asset Detail - {detailAsset.assetId}</h2>
                    <button className="tab" onClick={() => setAssetDetailId(null)}>Close</button>
                  </div>
                  <div className="form-grid">
                    <div className="field"><span>{t.campus}</span><div className="detail-value">{campusLabel(detailAsset.campus)}</div></div>
                    <div className="field"><span>{t.category}</span><div className="detail-value">{detailAsset.category}</div></div>
                    <div className="field"><span>{t.typeCode}</span><div className="detail-value">{detailAsset.type}</div></div>
                    {detailAsset.category === "IT" && detailAsset.type === DESKTOP_PARENT_TYPE ? (
                      <div className="field"><span>{t.pcType}</span><div className="detail-value">{detailAsset.pcType || "-"}</div></div>
                    ) : null}
                    <div className="field"><span>{t.status}</span><div className="detail-value">{detailAsset.status}</div></div>
                    <div className="field"><span>{t.name}</span><div className="detail-value">{assetItemName(detailAsset.category, detailAsset.type, detailAsset.pcType || "")}</div></div>
                    <div className="field"><span>{t.location}</span><div className="detail-value">{detailAsset.location || "-"}</div></div>
                    <div className="field"><span>{t.setCode}</span><div className="detail-value">{detailAsset.setCode || "-"}</div></div>
                    <div className="field"><span>{t.parentAssetId}</span><div className="detail-value">{detailAsset.parentAssetId || "-"}</div></div>
                    <div className="field"><span>{t.user}</span><div className="detail-value">{detailAsset.assignedTo || "-"}</div></div>
                    <div className="field"><span>Brand</span><div className="detail-value">{detailAsset.brand || "-"}</div></div>
                    <div className="field"><span>Model</span><div className="detail-value">{detailAsset.model || "-"}</div></div>
                    <div className="field"><span>Serial Number</span><div className="detail-value">{detailAsset.serialNumber || "-"}</div></div>
                    <div className="field"><span>Purchase Date</span><div className="detail-value">{formatDate(detailAsset.purchaseDate || "-")}</div></div>
                    <div className="field"><span>Warranty Until</span><div className="detail-value">{formatDate(detailAsset.warrantyUntil || "-")}</div></div>
                    <div className="field"><span>Vendor</span><div className="detail-value">{detailAsset.vendor || "-"}</div></div>
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
                          <th>Reason</th>
                          <th>By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailTransferEntries.length ? (
                          detailTransferEntries.map((h) => (
                            <tr key={`detail-transfer-${h.id}`}>
                              <td>{formatDate(h.date)}</td>
                              <td>{campusLabel(h.fromCampus)}</td>
                              <td>{h.fromLocation || "-"}</td>
                              <td>{campusLabel(h.toCampus)}</td>
                              <td>{h.toLocation || "-"}</td>
                              <td>{h.reason || "-"}</td>
                              <td>{h.by || "-"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7}>No transfer history yet.</td>
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
                              <td>{h.fromStatus}</td>
                              <td>{h.toStatus}</td>
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
                    ) : (
                      <>
                        <label className="field field-wide">
                          <span>{t.linkToDesktopSet}</span>
                          <input
                            type="checkbox"
                            checked={assetEditForm.useExistingSet}
                            onChange={(e) =>
                              setAssetEditForm((f) => ({
                                ...f,
                                useExistingSet: e.target.checked,
                                setCode: e.target.checked ? f.setCode : "",
                                parentAssetId: e.target.checked ? f.parentAssetId : "",
                              }))
                            }
                          />
                        </label>
                        {assetEditForm.useExistingSet ? (
                          <label className="field field-wide">
                            <span>{t.selectDesktopUnit}</span>
                            <select
                              className="input"
                              value={assetEditForm.parentAssetId}
                              onChange={(e) => {
                                const parent = desktopSetParentsForEdit.find((a) => a.assetId === e.target.value);
                                setAssetEditForm((f) => ({
                                  ...f,
                                  parentAssetId: e.target.value,
                                  setCode: parent?.setCode || "",
                                }));
                              }}
                            >
                              <option value="">-</option>
                              {desktopSetParentsForEdit.map((asset) => (
                                <option key={`desktop-parent-edit-${asset.id}`} value={asset.assetId}>
                                  {asset.assetId} - {asset.location} ({asset.setCode || "-"})
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                      </>
                    )}
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
                                            ? `${t.assetId}: ${child.assetId} | ${t.status}: ${child.status || "-"}`
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
              <div className="table-wrap">
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
                <h2>Inventory Control</h2>
                <div className="panel-filters">
                  <select className="input" value={inventoryCampusFilter} onChange={(e) => setInventoryCampusFilter(e.target.value)}>
                    <option value="ALL">All Campuses</option>
                    {CAMPUS_LIST.map((campus) => (
                      <option key={`inv-campus-${campus}`} value={campus}>{campusLabel(campus)}</option>
                    ))}
                  </select>
                  <select className="input" value={inventoryCategoryFilter} onChange={(e) => setInventoryCategoryFilter(e.target.value)}>
                    <option value="ALL">All Categories</option>
                    {INVENTORY_CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <input
                    className="input"
                    placeholder="Search item code, name..."
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="tabs">
                <button className={`tab ${inventoryView === "items" ? "tab-active" : ""}`} onClick={() => setInventoryView("items")}>Item Setup</button>
                <button className={`tab ${inventoryView === "stock" ? "tab-active" : ""}`} onClick={() => setInventoryView("stock")}>Stock In/Out</button>
                <button className={`tab ${inventoryView === "balance" ? "tab-active" : ""}`} onClick={() => setInventoryView("balance")}>Balance & Alerts</button>
              </div>
            </section>

            {inventoryView === "items" && (
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
                    <small className="tiny">Auto format: Campus-Category-0001 (example: C2.2-CS-0001)</small>
                  </label>
                  <label className="field">
                    <span>Item Name</span>
                    <input className="input" value={inventoryItemForm.itemName} onChange={(e) => setInventoryItemForm((f) => ({ ...f, itemName: e.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Unit</span>
                    <input className="input" value={inventoryItemForm.unit} onChange={(e) => setInventoryItemForm((f) => ({ ...f, unit: e.target.value }))} />
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
                  <button className="btn-primary" disabled={!isAdmin} onClick={createInventoryItem}>Add Inventory Item</button>
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
                            <td>{campusLabel(row.campus)}</td>
                            <td>{row.location}</td>
                            <td>{row.unit}</td>
                            <td>{row.openingQty}</td>
                            <td>{row.minStock}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={9}>No inventory items yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {inventoryView === "stock" && (
              <section className="panel">
                <h2>Stock In / Out</h2>
                <div className="form-grid">
                  <label className="field field-wide">
                    <span>Item</span>
                    <select className="input" value={inventoryTxnForm.itemId} onChange={(e) => setInventoryTxnForm((f) => ({ ...f, itemId: e.target.value }))}>
                      <option value="">Select item</option>
                      {inventoryItems
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
                    <select className="input" value={inventoryTxnForm.type} onChange={(e) => setInventoryTxnForm((f) => ({ ...f, type: e.target.value as "IN" | "OUT" }))}>
                      <option value="IN">Stock In</option>
                      <option value="OUT">Stock Out</option>
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
                </div>
                <div className="asset-actions">
                  <div className="tiny">Track every in/out movement to keep accurate monthly stock report.</div>
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
                                    {inventoryItems
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
                                  {inventoryItems.find((i) => String(i.id) === inventoryTxnEditForm.itemId)?.itemName || "-"}
                                </td>
                                <td>
                                  {campusLabel(inventoryItems.find((i) => String(i.id) === inventoryTxnEditForm.itemId)?.campus || row.campus)}
                                </td>
                                <td>
                                  <select
                                    className="table-input"
                                    value={inventoryTxnEditForm.type}
                                    onChange={(e) => setInventoryTxnEditForm((f) => ({ ...f, type: e.target.value as "IN" | "OUT" }))}
                                  >
                                    <option value="IN">Stock In</option>
                                    <option value="OUT">Stock Out</option>
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
                                <td>{campusLabel(row.campus)}</td>
                                <td>{row.type === "IN" ? "Stock In" : "Stock Out"}</td>
                                <td>{row.qty}</td>
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
                          <td colSpan={9}>No transactions yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {inventoryView === "balance" && (
              <section className="panel">
                <h2>Stock Balance & Low Stock Alerts</h2>
                <div className="stats-grid" style={{ marginBottom: 12 }}>
                  <article className="stat-card">
                    <div className="stat-label">Total Inventory Items</div>
                    <div className="stat-value">{inventoryBalanceRows.length}</div>
                  </article>
                  <article className="stat-card stat-card-overdue">
                    <div className="stat-label">Low Stock Alerts</div>
                    <div className="stat-value">{inventoryLowStockRows.length}</div>
                  </article>
                </div>
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
                      {inventoryBalanceRows.length ? (
                        inventoryBalanceRows.map((row) => (
                          <tr key={`inv-balance-row-${row.id}`}>
                            <td><strong>{row.itemCode}</strong></td>
                            <td>{renderAssetPhoto(row.photo || "", row.itemCode)}</td>
                            <td>{row.itemName}</td>
                            <td>{row.category}</td>
                            <td>{campusLabel(row.campus)}</td>
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
                          <td colSpan={12}>No stock balance data.</td>
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
              <button
                className={`tab ${scheduleView === "calendar" ? "tab-active" : ""}`}
                onClick={() => setScheduleView("calendar")}
              >
                Calendar View
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
                  <option value="MONTHLY_WEEKDAY">Every month by week + weekday</option>
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
              <label className="field">
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
                  <option value="MONTHLY_WEEKDAY">Every month by week + weekday</option>
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
                  !scheduleForm.assetId ||
                  !isAdmin ||
                  (scheduleForm.repeatMode === "NONE" && !scheduleForm.date)
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
            <div className="panel">
              <div className="panel-row">
                <button
                  className="tab"
                  onClick={() =>
                    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                  }
                >
                  Prev
                </button>
                <strong>
                  {calendarMonth.toLocaleString(undefined, {
                    month: "long",
                    year: "numeric",
                  })}
                </strong>
                <button
                  className="tab"
                  onClick={() =>
                    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                  }
                >
                  Next
                </button>
              </div>
              <div className="calendar-grid">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="calendar-day calendar-head">{d}</div>
                ))}
                {calendarGridDays.map((d) => (
                  <button
                    key={d.ymd}
                    className={`calendar-day ${d.inMonth ? "" : "calendar-out"} ${d.hasItems ? "calendar-has" : ""} ${selectedCalendarDate === d.ymd ? "calendar-selected" : ""}`}
                    onClick={() => setSelectedCalendarDate(d.ymd)}
                  >
                    <span>{d.day}</span>
                    {d.hasItems ? <small>{(scheduleByDate.get(d.ymd) || []).length}</small> : null}
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
                          <td><strong>{asset.assetId}</strong></td>
                          <td>{renderAssetPhoto(asset.photo || "", asset.assetId)}</td>
                          <td>{campusLabel(asset.campus)}</td>
                          <td>{asset.status}</td>
                          <td>{asset.scheduleNote || "-"}</td>
                          <td>
                            <div className="row-actions">
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
                <span>Asset</span>
                {showTransferAssetPicker || !transferAsset ? (
                  <AssetPicker
                    value={transferForm.assetId}
                    assets={assets}
                    getLabel={(asset) => `${asset.assetId} - ${assetItemName(asset.category, asset.type, asset.pcType || "")} • ${campusLabel(asset.campus)}`}
                    onChange={(assetId) => {
                      const asset = assets.find((a) => String(a.id) === assetId);
                      setTransferForm((f) => ({
                        ...f,
                        assetId,
                        toCampus: asset?.campus || f.toCampus,
                        toLocation: asset?.location || "",
                      }));
                      setShowTransferAssetPicker(false);
                    }}
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
              <div className="tiny">Transfer updates campus/location and saves transfer history.</div>
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
                        <td>{row.by || "-"}</td>
                        <td>{row.reason || "-"}</td>
                        <td>{row.note || "-"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9}>No transfer history yet.</td>
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
              <button
                className={`tab ${maintenanceView === "history" ? "tab-active" : ""}`}
                onClick={() => setMaintenanceView("history")}
              >
                History View
              </button>
              <button
                className={`tab ${maintenanceView === "record" ? "tab-active" : ""}`}
                onClick={() => setMaintenanceView("record")}
              >
                Record History
              </button>
            </div>

            {maintenanceView === "record" && (
            <>
            <h3 className="section-title">Record Maintenance Result</h3>
            <div className="form-grid">
              <label className="field">
                <span>Asset</span>
                <AssetPicker
                  value={maintenanceRecordForm.assetId}
                  assets={assets}
                  getLabel={(asset) => `${asset.assetId} - ${assetItemName(asset.category, asset.type, asset.pcType || "")} • ${campusLabel(asset.campus)}`}
                  onChange={(assetId) => setMaintenanceRecordForm((f) => ({ ...f, assetId }))}
                />
              </label>
              <label className="field">
                <span>Date</span>
                <input
                  type="date"
                  className="input"
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
                    <option key={`record-type-${opt}`} value={opt}>{opt}</option>
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
                      <option key={opt.value} value={opt.value}>
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
              <div className="tiny">
                Track maintenance as Already Done or Not Yet Done and add condition comments.
              </div>
              <button
                className="btn-primary"
                disabled={busy || !isAdmin || !maintenanceRecordForm.assetId || !maintenanceRecordForm.date || !maintenanceRecordForm.note.trim()}
                onClick={addMaintenanceRecordFromTab}
              >
                Add Maintenance Record
              </button>
            </div>
            </>
            )}

            {maintenanceView === "history" && (
            <>
            <div className="panel-row">
              <h2>{t.maintenanceHistory}</h2>
              <div className="panel-filters">
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
                        <td>{row.status}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={15}>No maintenance records yet.</td>
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
              <button
                className={`tab ${verificationView === "record" ? "tab-active" : ""}`}
                onClick={() => setVerificationView("record")}
              >
                {t.recordVerification}
              </button>
              <button
                className={`tab ${verificationView === "history" ? "tab-active" : ""}`}
                onClick={() => setVerificationView("history")}
              >
                {t.verificationHistory}
              </button>
            </div>

            {verificationView === "record" && (
              <>
                <h3 className="section-title">{t.recordVerification}</h3>
                <div className="form-grid">
                  <label className="field">
                    <span>{t.asset}</span>
                    <AssetPicker
                      value={verificationRecordForm.assetId}
                      assets={assets}
                      getLabel={(asset) => `${asset.assetId} - ${assetItemName(asset.category, asset.type, asset.pcType || "")} • ${campusLabel(asset.campus)}`}
                      onChange={(assetId) => setVerificationRecordForm((f) => ({ ...f, assetId }))}
                    />
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

            {verificationView === "history" && (
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
            <div className="panel-row">
              <h2>Reports</h2>
              <div className="panel-filters">
                <select
                  className="input"
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as ReportType)}
                >
                  <option value="asset_master">Asset Master Register</option>
                  <option value="asset_by_location">Asset by Campus and Location</option>
                  <option value="overdue">Overdue Maintenance</option>
                  <option value="transfer">Asset Transfer Log</option>
                  <option value="maintenance_completion">Maintenance Completion</option>
                  <option value="verification_summary">Verification Summary</option>
                  <option value="qr_labels">Asset ID + QR Labels</option>
                </select>
                {reportType === "maintenance_completion" || (reportType === "verification_summary" && reportPeriodMode === "month") ? (
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
                <button className="btn-primary report-print-btn" onClick={printCurrentReport}>Print Report</button>
              </div>
            </div>

            {reportType === "asset_master" && (
              <div className="panel-note">
                <strong>Asset register view:</strong> one row per asset with quick item/service information.
              </div>
            )}
            {reportType === "qr_labels" && (
              <div className="panel-note">
                <strong>QR label view:</strong> scan QR to open this asset detail page directly.
              </div>
            )}
            {reportType === "asset_master" && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t.photo}</th>
                      <th>{t.assetId}</th>
                      <th>{t.setCode}</th>
                      <th>Linked To (Main Asset)</th>
                      <th>Item Name</th>
                      <th>{t.category}</th>
                      <th>Item Description</th>
                      <th>{t.location}</th>
                      <th>Purchase Date</th>
                      <th>Last Service</th>
                      <th>Assigned To</th>
                      <th>{t.status}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assetMasterSetRows.length ? (
                      assetMasterSetRows.map((row) => (
                        <tr key={`report-asset-master-${row.key}`}>
                          <td>{renderAssetPhoto(row.photo || "", row.assetId)}</td>
                          <td><strong>{row.assetId}</strong></td>
                          <td>{row.setCode || "-"}</td>
                          <td>{row.linkedTo || "-"}</td>
                          <td>{row.itemName}</td>
                          <td>{row.category}</td>
                          <td className="report-item-description" title={row.itemDescription || "-"}>
                            {row.itemDescription || "-"}
                          </td>
                          <td>{row.location || "-"}</td>
                          <td>{formatDate(row.purchaseDate || "-")}</td>
                          <td>
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
                          <td>{row.assignedTo || "-"}</td>
                          <td>{row.status || "-"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={12}>No assets found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {reportType === "overdue" && (
              <div className="table-wrap">
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
                          <td>{a.status || "-"}</td>
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
              <div className="table-wrap">
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
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>{t.assetId}</th>
                      <th>From Campus</th>
                      <th>From Location</th>
                      <th>To Campus</th>
                      <th>To Location</th>
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
                          <td>{r.by || "-"}</td>
                          <td>{r.reason || "-"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8}>No transfer history.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {reportType === "qr_labels" && (
              <div className="qr-label-grid">
                {qrLabelRows.length ? (
                  qrLabelRows.map((row) => (
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
                        <div>Status: {row.status || "-"}</div>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="panel-note">No assets available for QR labels.</div>
                )}
              </div>
            )}

            {reportType === "maintenance_completion" && (
              <>
                <div className="stats-grid">
                  <article className="stat-card">
                    <div className="stat-label">Total Records ({reportMonth})</div>
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
                <div className="table-wrap" style={{ marginTop: 12 }}>
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
                          <td colSpan={9}>No maintenance records in selected month.</td>
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
                <div className="table-wrap" style={{ marginTop: 12 }}>
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
            <div className="row-actions">
              <button className={`tab ${setupView === "campus" ? "tab-active" : ""}`} onClick={() => setSetupView("campus")}>
                {t.campusNameSetup}
              </button>
              <button className={`tab ${setupView === "users" ? "tab-active" : ""}`} onClick={() => setSetupView("users")}>
                {t.userSetup}
              </button>
              <button className={`tab ${setupView === "permissions" ? "tab-active" : ""}`} onClick={() => setSetupView("permissions")}>
                {t.accountPermissionSetup}
              </button>
              <button className={`tab ${setupView === "backup" ? "tab-active" : ""}`} onClick={() => setSetupView("backup")}>
                Backup & Audit
              </button>
              <button className={`tab ${setupView === "items" ? "tab-active" : ""}`} onClick={() => setSetupView("items")}>
                {t.itemNameSetup}
              </button>
              <button className={`tab ${setupView === "locations" ? "tab-active" : ""}`} onClick={() => setSetupView("locations")}>
                {t.locationSetup}
              </button>
            </div>
          </section>

          {setupView === "campus" && (
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

          {setupView === "users" && (
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
                <span>{t.email}</span>
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

          {setupView === "permissions" && (
          <section className="panel">
            <h2>{t.accountPermissionSetup}</h2>
            <p className="tiny">{t.permissionHelp}</p>
            <div className="form-grid" style={{ marginTop: 12 }}>
              <label className="field">
                <span>{t.selectStaffOptional}</span>
                <select
                  className="input"
                  value={authCreateForm.staffId}
                  disabled={!isAdmin}
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
                    setAuthCreateForm((f) => ({
                      ...f,
                      role: e.target.value as "Admin" | "Viewer",
                      campus: e.target.value === "Admin" ? "ALL" : f.campus === "ALL" ? CAMPUS_LIST[0] : f.campus,
                    }))
                  }
                >
                  <option value="Admin">Admin</option>
                  <option value="Viewer">Viewer</option>
                </select>
              </label>
              <label className="field">
                <span>{t.accessCampus}</span>
                <select
                  className="input"
                  value={authCreateForm.campus}
                  disabled={!isAdmin || authCreateForm.role === "Admin"}
                  onChange={(e) => setAuthCreateForm((f) => ({ ...f, campus: e.target.value }))}
                >
                  <option value="ALL">{t.allCampuses}</option>
                  {CAMPUS_LIST.map((campus) => (
                    <option key={`new-auth-campus-${campus}`} value={campus}>{campusLabel(campus)}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="asset-actions">
              <div className="tiny">{t.addLoginAccount}</div>
              <button className="btn-primary" disabled={!isAdmin || busy} onClick={createAuthAccount}>
                {t.addLoginAccount}
              </button>
            </div>
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>{t.usernameLabel}</th>
                    <th>{t.displayName}</th>
                    <th>{t.role}</th>
                    <th>{t.accessCampus}</th>
                    <th>{t.save}</th>
                  </tr>
                </thead>
                <tbody>
                  {authAccounts.length ? (
                    authAccounts.map((u) => {
                      const draft = authPermissionDraft[u.id] || {
                        role: u.role,
                        campus: (u.campuses && u.campuses[0]) || "ALL",
                        modules: Array.isArray(u.modules) && u.modules.length ? u.modules : normalizeModulesByRole(u.role, []),
                      };
                      return (
                        <tr key={`auth-perm-${u.id}`}>
                          <td><strong>{u.username}</strong></td>
                          <td>{u.displayName}</td>
                          <td>
                            <select
                              className="input"
                              value={draft.role}
                              disabled={!isAdmin}
                              onChange={(e) =>
                                setAuthPermissionDraft((prev) => ({
                                  ...prev,
                                  [u.id]: {
                                    role: e.target.value as "Admin" | "Viewer",
                                    campus: e.target.value === "Admin" ? "ALL" : draft.campus === "ALL" ? CAMPUS_LIST[0] : draft.campus,
                                    modules:
                                      e.target.value === "Admin"
                                        ? [...ALL_NAV_MODULES]
                                        : (draft.modules.length ? draft.modules : [...DEFAULT_VIEWER_MODULES]),
                                  },
                                }))
                              }
                            >
                              <option value="Admin">Admin</option>
                              <option value="Viewer">Viewer</option>
                            </select>
                          </td>
                          <td>
                            <select
                              className="input"
                              value={draft.campus}
                              disabled={!isAdmin || draft.role === "Admin"}
                              onChange={(e) =>
                                setAuthPermissionDraft((prev) => ({
                                  ...prev,
                                  [u.id]: { ...draft, campus: e.target.value },
                                }))
                              }
                            >
                              <option value="ALL">{t.allCampuses}</option>
                              {CAMPUS_LIST.map((campus) => (
                                <option key={campus} value={campus}>{campusLabel(campus)}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <button className="btn-primary" disabled={!isAdmin} onClick={() => saveAuthPermission(u.id)}>
                              Save
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5}>{t.noLoginUsersFound}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          )}

          {setupView === "backup" && (
          <section className="panel">
            <h2>Backup & Audit</h2>
            <div className="asset-actions">
              <div className="tiny">Backup database to file, restore when needed, and track user actions.</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn-primary" disabled={!isAdmin || busy} onClick={createServerBackup}>
                  Create Server Backup
                </button>
                <button className="tab" disabled={!isAdmin || busy} onClick={exportBackupFile}>
                  Download Backup
                </button>
                <label className="tab" style={{ cursor: isAdmin ? "pointer" : "not-allowed", opacity: isAdmin ? 1 : 0.6 }}>
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
                  className="btn-danger"
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

          {setupView === "items" && (
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
                    <th>{t.itemName}</th>
                  </tr>
                </thead>
                <tbody>
                  {itemSetupRows.map((row) => (
                    <tr key={row.key}>
                      <td>{row.category}</td>
                      <td><strong>{row.code}</strong></td>
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

          {setupView === "locations" && (
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
          </>
        )}
          </section>
        </section>

        {scheduleAlertModal && (
          <div className="modal-backdrop" onClick={() => setScheduleAlertModal(null)}>
            <section className="panel modal-panel" onClick={(e) => e.stopPropagation()}>
              <div className="panel-row">
                <h2>{scheduleAlertItems.title}</h2>
                <button className="tab" onClick={() => setScheduleAlertModal(null)}>{t.close}</button>
              </div>
              <div className="table-wrap">
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
                                setTab("maintenance");
                                setMaintenanceView("record");
                                setMaintenanceRecordForm((f) => ({
                                  ...f,
                                  assetId: String(asset.id),
                                  date: toYmd(new Date()),
                                }));
                              }}
                            >
                              <strong>{asset.assetId}</strong>
                            </button>
                          </td>
                          <td>{renderAssetPhoto(asset.photo || "", asset.assetId)}</td>
                          <td>{campusLabel(asset.campus)}</td>
                          <td>{asset.status}</td>
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
              <div className="table-wrap">
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
                            <td>{asset.status || "-"}</td>
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
                  <input className="input" value={pendingStatusChange.fromStatus} readOnly />
                </div>
                <div className="field">
                  <span>To</span>
                  <input className="input" value={pendingStatusChange.toStatus} readOnly />
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
                  {pendingStatusChange.fromStatus} {"->"} {pendingStatusChange.toStatus}
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

        <p className={`footnote ${error ? "footnote-error" : ""}`}>
          {error ? `${t.systemError}: ${error}` : t.dataStored}
        </p>
      </section>
    </main>
  );
}
