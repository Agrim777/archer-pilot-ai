/**
 * RSA Archer GRC Platform — RESTful API Client
 *
 * Built from official Archer documentation:
 * https://help.archerirm.cloud/api_2025_04/content/api/restfulapi/
 * https://help.archerirm.cloud/platform_2026_06/en-us/content/platform/toc_section_intros/setup_maint.htm
 *
 * ── KEY FACTS FROM OFFICIAL DOCS ────────────────────────────────────────────
 * Base path (Archer 6.5+): /platformapi/core/  (NOT /api/core/)
 * Auth header:             Authorization: Archer session-id="<token>"
 * Login response:          { "SessionToken": "..." }   ← top-level, no wrapper
 * Logout:                  POST /platformapi/core/security/logout  { "Value": "token" }
 * GET-style reads:         POST with X-Http-Method-Override: GET
 *
 * ── PACKAGE AUTOMATION API ─────────────────────────────────────────────────
 * NOTE: The Package API uses the OLD /api/core/ base path (not /platformapi/core/)
 * Source: https://help.archerirm.cloud/platform_2025_04/en-us/content/api/restfulapi/segmentsresources/pkg_automation_api.htm
 *
 * POST /api/core/package/              → create a new package record (by app GUID)
 * POST /api/core/package/generate/{id} → generate the package ZIP on the server
 * POST /api/core/package/install       → install a package into this instance
 *
 * ── OFFICIAL FIELD TYPE IDs ─────────────────────────────────────────────────
 *  1  Text              9  Cross-Reference      21 First Published
 *  2  Numeric          11  Attachment           22 Last Updated Field
 *  3  Date             12  Image                23 Related Records
 *  4  Values List      14  CAST Score Card      24 Sub-Form
 *  6  TrackingID       16  Matrix               25 History Log
 *  7  External Links   19  IP Address           27 Multi-Ref Display
 *  8  Users/Groups     20  Record Status        30 Voting
 *
 * ── WHAT THE REST API SUPPORTS ──────────────────────────────────────────────
 * ✅ Login / Logout
 * ✅ Get Archer version (GET /platformapi/core/system/applicationinfo/version)
 * ✅ Read applications, levels, field definitions (GET via POST override)
 * ✅ Create / Update / Delete CONTENT RECORDS (data rows in existing apps)
 * ✅ Perform workflow actions on existing records
 * ✅ Package automation (create/generate/install packages via /api/core/package/)
 * ⚠️  Creating app structure (new apps, levels, field defs, value lists) via
 *    POST /platformapi/core/system/application|level|fielddefinition|valueslist —
 *    attempted here; requires Application Builder admin rights. The official docs
 *    only document GET on these endpoints; creation is via UI/Package Import.
 *    We attempt them and fall back gracefully with actionable error messages.
 * ❌ Workflow stage creation — no REST endpoint; use Archer Workflow Manager UI
 * ❌ Record permissions — set in Application Builder → Access Roles
 * ❌ Notification rules — set in Application Builder → Notifications
 */

export type StepCallback = (
  stepName: string,
  message: string,
  status?: "ok" | "warn"
) => Promise<void>;

// ── Field type map (official Archer 2025 docs) ────────────────────────────
const FIELD_TYPE_MAP: Record<string, number> = {
  "Text": 1,
  "Numeric": 2,
  "Number": 2,
  "Date": 3,
  "Values List": 4,
  "TrackingID": 6,
  "External Links": 7,
  "Users/Groups List": 8,
  "Cross-Reference": 9,
  "Attachment": 11,
  "Image": 12,
  "Matrix": 16,
  "IP Address": 19,
  "Record Status": 20,
  "Related Records": 23,
  "Sub-Form": 24,
  // AI-generated type names mapped to closest Archer type
  "Checkbox": 4,       // use Values List: Yes / No
  "URL": 7,            // closest is External Links
  "Calculated": 23,    // map to Related Records as proxy
  "User": 8,
};

function archerFieldType(typeStr: string): number {
  return FIELD_TYPE_MAP[typeStr] ?? 1; // default Text
}

/**
 * Normalize a user-entered Archer URL down to the instance base URL that the
 * REST API expects (protocol + host [+ instance path segment], no trailing
 * slash, no UI page paths).
 *
 * Users often copy a URL straight from their browser, e.g.:
 *   http://45.129.87.206/Archer/apps/ArcherApp/Home.aspx
 * The API base is everything up to (and including) the instance segment:
 *   http://45.129.87.206/Archer
 * We strip any `/apps/...`, `/platformapi/...`, `/api/...`, or `.aspx` page
 * paths that got pasted in along with the instance URL.
 */
export function normalizeArcherBaseUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return rawUrl.trim().replace(/\/+$/, "");
  }

  // Cut the path at the first segment that is clearly not part of the
  // instance base (UI app routes, API roots, or a .aspx/.html page).
  const cutPatterns = [/^apps$/i, /^platformapi$/i, /^api$/i];
  const segments = url.pathname.split("/").filter(Boolean);
  const keep: string[] = [];
  for (const seg of segments) {
    if (cutPatterns.some((p) => p.test(seg)) || /\.(aspx|html?)$/i.test(seg)) {
      break;
    }
    keep.push(seg);
  }

  const path = keep.length ? `/${keep.join("/")}` : "";
  return `${url.protocol}//${url.host}${path}`;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────

function authHeader(token: string) {
  return `Archer session-id="${token}"`;
}

const COMMON_ACCEPT = "application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

async function archerRequest(
  baseUrl: string,
  path: string,
  method: "POST" | "DELETE",
  body?: unknown,
  token?: string,
  overrideMethod?: "GET"
): Promise<any> {
  const headers: Record<string, string> = {
    "Accept": COMMON_ACCEPT,
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = authHeader(token);
  if (overrideMethod) headers["X-Http-Method-Override"] = overrideMethod;

  const url = `${baseUrl}/platformapi/core/${path}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* some endpoints return null or plain text */ }

  // Archer returns IsSuccessful:false with validation messages on errors
  if (data && data.IsSuccessful === false) {
    const msgs = (data.ValidationMessages ?? [])
      .map((m: any) => m.MessageKey || m.Message || JSON.stringify(m))
      .join("; ");
    throw new Error(`Archer: ${msgs || "Unknown error"} (HTTP ${res.status})`);
  }

  if (!res.ok && res.status >= 400) {
    throw new Error(`Archer HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  return data;
}

/** GET-style read using POST + X-Http-Method-Override */
async function archerGet(baseUrl: string, path: string, token: string): Promise<any> {
  return archerRequest(baseUrl, path, "POST", undefined, token, "GET");
}

/** Write (create/update) using plain POST */
async function archerPost(baseUrl: string, path: string, body: unknown, token: string): Promise<any> {
  return archerRequest(baseUrl, path, "POST", body, token);
}

// ── Package API helper (uses OLD /api/core/ base path, NOT /platformapi/) ──
//    Source: Archer 2025 Platform docs — Package Automation API

async function archerPackageRequest(
  baseUrl: string,
  path: string,
  body?: unknown,
  token?: string
): Promise<any> {
  const headers: Record<string, string> = {
    "Accept": COMMON_ACCEPT,
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = authHeader(token);

  const url = `${baseUrl}/api/core/${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* some responses are empty */ }

  if (data && data.IsSuccessful === false) {
    const msgs = (data.ValidationMessages ?? [])
      .map((m: any) => m.MessageKey || m.Message || JSON.stringify(m))
      .join("; ");
    throw new Error(`Archer Package API: ${msgs || "Unknown error"} (HTTP ${res.status})`);
  }

  if (!res.ok && res.status >= 400) {
    throw new Error(`Archer Package API HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  return data;
}

// ── Authentication ────────────────────────────────────────────────────────

export async function archerLogin(
  baseUrl: string,
  username: string,
  password: string,
  instanceName: string
): Promise<string> {
  // Official request body per docs
  const data = await archerRequest(baseUrl, "security/login", "POST", {
    InstanceName: instanceName || "Default",
    Username: username,
    UserDomain: "",
    Password: password,
  });

  // Official response: { "SessionToken": "..." }  (top-level, no RequestedObject wrapper)
  const token = data?.SessionToken ?? data?.RequestedObject?.SessionToken;
  if (!token) {
    throw new Error(
      "Login succeeded but no session token returned. Check username, password and instance name."
    );
  }
  return token;
}

export async function archerLogout(baseUrl: string, token: string): Promise<void> {
  // Official logout: POST with body { "Value": "<token>" }
  try {
    await archerRequest(baseUrl, "security/logout", "POST", { Value: token }, token);
  } catch {
    // Best-effort — don't fail the overall deployment if logout errors
  }
}

// ── Version / connection health ───────────────────────────────────────────

/**
 * Returns the Archer instance version string.
 * Uses the officially documented endpoint:
 *   GET /platformapi/core/system/applicationinfo/version
 * Source: Archer API Reference 2025 — Metadata Application
 */
export async function getArcherVersion(
  baseUrl: string,
  token: string
): Promise<string> {
  try {
    const data = await archerGet(baseUrl, "system/applicationinfo/version", token);
    // Response may be a plain string or { RequestedObject: "..." } or { Value: "..." }
    if (typeof data === "string") return data;
    return (
      data?.RequestedObject ??
      data?.Value ??
      data?.Version ??
      "unknown"
    );
  } catch {
    return "unknown";
  }
}

// ── Package automation (officially documented /api/core/package/ endpoints) ──
//    Source: https://help.archerirm.cloud/platform_2025_04/en-us/content/api/restfulapi/segmentsresources/pkg_automation_api.htm

export interface PackageObject {
  Guid: string;
  Type: "Application" | "SubForm" | "GlobalReport" | "Questionnaire";
}

/**
 * Create a new package record in Archer from existing application GUIDs.
 * Returns the new package ID.
 */
export async function createPackage(
  baseUrl: string,
  token: string,
  name: string,
  description: string,
  packageObjects: PackageObject[]
): Promise<number> {
  const data = await archerPackageRequest(baseUrl, "package", {
    Name: name,
    Description: description,
    PreparedBy: "ArcherPilot AI",
    PackageObjects: packageObjects,
  }, token);
  return data?.RequestedObject?.Id ?? data?.Id ?? 0;
}

/**
 * Generate (zip) a package by its ID.
 * Must be called after createPackage; the package is then available for download.
 */
export async function generatePackage(
  baseUrl: string,
  token: string,
  packageId: number
): Promise<void> {
  await archerPackageRequest(baseUrl, `package/generate/${packageId}`, undefined, token);
}

/**
 * Install a package into the Archer instance.
 * installOptions: array of { Guid, Name, Type, TranslationOption, InstallMethod, InstallOption }
 * InstallMethod: 1=Create New, 2=Replace existing
 * InstallOption: 1=Install, 2=Skip
 */
export async function installPackage(
  baseUrl: string,
  token: string,
  packageId: number,
  installOptions: Array<{
    Guid: string;
    Name: string;
    Type: string;
    TranslationOption?: number;
    InstallMethod?: number;
    InstallOption?: number;
  }>
): Promise<void> {
  await archerPackageRequest(baseUrl, "package/install", {
    PackageId: packageId,
    InactivateUnusedFields: false,
    PrefixInactivatedFields: null,
    InstallOptions: installOptions.map((o) => ({
      Guid: o.Guid,
      Name: o.Name,
      Type: o.Type,
      TranslationOption: o.TranslationOption ?? 1,
      InstallMethod: o.InstallMethod ?? 2,
      InstallOption: o.InstallOption ?? 1,
    })),
  }, token);
}

// ── Read existing applications (for reference / conflict check) ───────────

export async function listApplications(
  baseUrl: string,
  token: string
): Promise<Array<{ Id: number; Name: string; Guid: string }>> {
  try {
    const data = await archerGet(baseUrl, "system/application", token);
    return data?.RequestedObject ?? data ?? [];
  } catch {
    return [];
  }
}

export async function getApplicationById(
  baseUrl: string,
  token: string,
  appId: number
): Promise<any> {
  return archerGet(baseUrl, `system/application/${appId}`, token);
}

// ── Read existing levels / field definitions ──────────────────────────────

export async function getLevelsByApplication(
  baseUrl: string,
  token: string,
  applicationId: number
): Promise<any[]> {
  try {
    const data = await archerGet(baseUrl, `system/level/module/${applicationId}`, token);
    return data?.RequestedObject ?? data ?? [];
  } catch {
    return [];
  }
}

export async function getFieldsByApplication(
  baseUrl: string,
  token: string,
  applicationId: number
): Promise<any[]> {
  try {
    const data = await archerGet(
      baseUrl,
      `system/fielddefinition/application/${applicationId}`,
      token
    );
    return data?.RequestedObject ?? data ?? [];
  } catch {
    return [];
  }
}

export async function getValuesList(
  baseUrl: string,
  token: string
): Promise<any[]> {
  try {
    const data = await archerGet(baseUrl, "system/valueslistvalue", token);
    return data?.RequestedObject ?? data ?? [];
  } catch {
    return [];
  }
}

// ── Create content RECORDS within an existing application ─────────────────
//    (This is what the Archer REST API primarily supports for writes)

export interface FieldValue {
  fieldId: number;
  value: any;
  type: number;
}

/**
 * Create a content record in an existing Archer application.
 * fieldValues maps fieldId → value formatted per field type.
 */
export async function createContentRecord(
  baseUrl: string,
  token: string,
  levelId: number,
  fieldValues: FieldValue[]
): Promise<number> {
  // Build the content request per Archer REST API format
  const FieldContents: Record<string, any> = {};
  for (const fv of fieldValues) {
    FieldContents[fv.fieldId] = buildFieldContent(fv);
  }

  const data = await archerPost(baseUrl, "content", {
    Content: {
      LevelId: levelId,
      FieldContents,
    },
  }, token);

  return data?.RequestedObject?.Id ?? data?.Id ?? 0;
}

function buildFieldContent(fv: FieldValue): any {
  switch (fv.type) {
    case 1: // Text
      return { Type: 1, Value: String(fv.value ?? "") };
    case 2: // Numeric
      return { Type: 2, Value: fv.value };
    case 3: // Date
      return { Type: 3, Value: fv.value };
    case 4: // Values List
      return {
        Type: 4,
        Value: Array.isArray(fv.value)
          ? fv.value.map((id: number) => ({ ValuesListValueId: id }))
          : [{ ValuesListValueId: fv.value }],
      };
    case 8: // Users/Groups List
      return { Type: 8, Value: { UsersGroups: [{ Id: fv.value, IsGroup: false }] } };
    case 9: // Cross-Reference
      return { Type: 9, Value: [{ ContentId: fv.value }] };
    default:
      return { Type: fv.type, Value: fv.value };
  }
}

// ── Workflow actions on existing records ──────────────────────────────────

export async function getWorkflowActions(
  baseUrl: string,
  token: string,
  contentId: number
): Promise<any[]> {
  const data = await archerGet(
    baseUrl,
    `workflow/records/${contentId}/actions`,
    token
  );
  return data?.RequestedObject ?? data ?? [];
}

export async function performWorkflowAction(
  baseUrl: string,
  token: string,
  contentId: number,
  workflowNodeId: string,
  completionCode: number
): Promise<void> {
  await archerPost(baseUrl, "system/WorkflowAction", {
    ContentId: contentId,
    CompletionCode: completionCode,
    WorkflowNodeId: workflowNodeId,
  }, token);
}

// ── Application structure creation (admin endpoints — may not be in all instances) ──

/**
 * Attempt to create a new Archer application.
 * NOTE: The public Archer REST API documents GET operations for /system/application.
 * Creation may require admin access or may not be available via REST in all versions.
 * Errors are surfaced with context so the user knows what failed.
 */
async function tryCreateApplication(
  baseUrl: string,
  token: string,
  name: string
): Promise<number | null> {
  try {
    const alias = name.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 50);
    const data = await archerPost(baseUrl, "system/application", {
      Application: {
        Name: name,
        Alias: alias,
        Status: 1,        // 1 = Active
        Type: 2,          // 2 = Standard Application
        IsGlobal: false,
      },
    }, token);
    return data?.RequestedObject?.Id ?? data?.Id ?? null;
  } catch (err: any) {
    throw new Error(
      `Could not create application "${name}". ` +
      `This may require Application Builder admin rights in Archer. ` +
      `Original error: ${err.message}`
    );
  }
}

async function tryCreateLevel(
  baseUrl: string,
  token: string,
  applicationId: number,
  name: string
): Promise<number | null> {
  try {
    const data = await archerPost(baseUrl, "system/level", {
      Level: {
        Name: name,
        ApplicationId: applicationId,
      },
    }, token);
    return data?.RequestedObject?.Id ?? data?.Id ?? null;
  } catch (err: any) {
    throw new Error(
      `Could not create module/level "${name}": ${err.message}`
    );
  }
}

async function tryCreateValuesList(
  baseUrl: string,
  token: string,
  name: string
): Promise<number | null> {
  try {
    const data = await archerPost(baseUrl, "system/valueslist", {
      ValuesList: { Name: name },
    }, token);
    return data?.RequestedObject?.Id ?? data?.Id ?? null;
  } catch (err: any) {
    throw new Error(`Could not create values list "${name}": ${err.message}`);
  }
}

async function tryAddValuesListValue(
  baseUrl: string,
  token: string,
  valuesListId: number,
  valueName: string,
  isDefault: boolean
): Promise<number> {
  try {
    const data = await archerPost(baseUrl, "system/valueslistvalue", {
      ValuesListValue: {
        Name: valueName,
        ValuesListId: valuesListId,
        IsDefault: isDefault,
        Enabled: true,
      },
    }, token);
    return data?.RequestedObject?.Id ?? data?.Id ?? 0;
  } catch {
    return 0; // non-fatal
  }
}

async function tryCreateField(
  baseUrl: string,
  token: string,
  levelId: number,
  field: { name: string; type: string; required: boolean; valuesListId?: number }
): Promise<number | null> {
  try {
    const fType = archerFieldType(field.type);
    const body: any = {
      FieldDefinition: {
        Name: field.name,
        FieldType: fType,
        LevelId: levelId,
        IsRequired: field.required,
        IsReadOnly: false,
        IsPrivate: false,
      },
    };
    if (fType === 4 && field.valuesListId) {
      body.FieldDefinition.RelatedValuesListId = field.valuesListId;
      body.FieldDefinition.AllowOtherValue = false;
    }
    const data = await archerPost(baseUrl, "system/fielddefinition", body, token);
    return data?.RequestedObject?.Id ?? data?.Id ?? null;
  } catch (err: any) {
    throw new Error(`Could not create field "${field.name}": ${err.message}`);
  }
}

// ── Main deployment orchestrator ──────────────────────────────────────────

export interface DeploymentResult {
  applicationId: number | null;
  levelIds: number[];
  valuesListIds: Record<string, number>;
  fieldIds: number[];
  warnings: string[];
}

export async function deployToArcher(
  baseUrl: string,
  username: string,
  password: string,
  instanceName: string,
  content: any,
  onStep: StepCallback
): Promise<DeploymentResult> {
  const warnings: string[] = [];
  let token = "";

  // ── STEP 1: Login ────────────────────────────────────────────────────────
  await onStep("Login", `Connecting to ${baseUrl}…`);
  token = await archerLogin(baseUrl, username, password, instanceName);
  await onStep("Login", `Authenticated as ${username}`, "ok");

  const appName =
    content.applicationStructure?.name ||
    content.modules?.[0]?.name ||
    "ArcherPilot Application";

  // ── STEP 2: Version Check ────────────────────────────────────────────────
  await onStep("Version Check", "Checking Archer version…");
  const version = await getArcherVersion(baseUrl, token);
  await onStep("Version Check", `Archer version: ${version}`, "ok");

  // ── STEP 3: Create Application ───────────────────────────────────────────
  let applicationId: number | null = null;
  await onStep("Creating Application", `Creating application: ${appName}`);
  try {
    applicationId = await tryCreateApplication(baseUrl, token, appName);
    await onStep("Creating Application", `Application created (ID: ${applicationId})`, "ok");
  } catch (err: any) {
    warnings.push(err.message);
    await onStep("Creating Application", err.message, "warn");
  }

  // ── STEP 4: Create Modules (Levels) ──────────────────────────────────────
  const levelIds: number[] = [];
  const levelIdByModule: Record<string, number> = {};
  await onStep("Creating Modules", `Creating ${content.modules?.length ?? 0} module(s)…`);

  if (applicationId) {
    for (const mod of content.modules ?? []) {
      try {
        const lid = await tryCreateLevel(baseUrl, token, applicationId, mod.name);
        if (lid) {
          levelIds.push(lid);
          levelIdByModule[mod.name] = lid;
        }
      } catch (err: any) {
        warnings.push(`Module "${mod.name}": ${err.message}`);
      }
    }
    // Fallback default level if no modules defined
    if (levelIds.length === 0) {
      try {
        const lid = await tryCreateLevel(baseUrl, token, applicationId, appName);
        if (lid) {
          levelIds.push(lid);
          levelIdByModule["__default__"] = lid;
        }
      } catch (err: any) {
        warnings.push(`Default level: ${err.message}`);
      }
    }
  }
  await onStep("Creating Modules", `${levelIds.length} module(s) created`, levelIds.length > 0 ? "ok" : "warn");

  // ── STEP 4: Value Lists ───────────────────────────────────────────────────
  const valuesListIds: Record<string, number> = {};
  await onStep("Creating Value Lists", `Creating ${content.valueLists?.length ?? 0} value list(s)…`);

  for (const vl of content.valueLists ?? []) {
    try {
      const lid = await tryCreateValuesList(baseUrl, token, vl.name);
      if (lid) {
        valuesListIds[vl.name] = lid;
        for (let i = 0; i < (vl.values ?? []).length; i++) {
          await tryAddValuesListValue(baseUrl, token, lid, vl.values[i], i === 0);
        }
      }
    } catch (err: any) {
      warnings.push(`Values list "${vl.name}": ${err.message}`);
    }
  }

  // Create implicit Yes/No list for Checkbox fields
  const hasCheckbox = (content.fields ?? []).some((f: any) => f.type === "Checkbox");
  let yesNoListId = 0;
  if (hasCheckbox) {
    try {
      const lid = await tryCreateValuesList(baseUrl, token, "Yes / No");
      if (lid) {
        yesNoListId = lid;
        valuesListIds["Yes / No"] = lid;
        await tryAddValuesListValue(baseUrl, token, lid, "Yes", false);
        await tryAddValuesListValue(baseUrl, token, lid, "No", true);
      }
    } catch { /* non-fatal */ }
  }
  await onStep(
    "Creating Value Lists",
    `${Object.keys(valuesListIds).length} value list(s) created`,
    Object.keys(valuesListIds).length > 0 ? "ok" : "warn"
  );

  // ── STEP 5: Fields ────────────────────────────────────────────────────────
  const fieldIds: number[] = [];
  await onStep("Creating Fields", `Creating ${content.fields?.length ?? 0} field(s)…`);

  for (const field of content.fields ?? []) {
    const levelId =
      (field.module && levelIdByModule[field.module]) || levelIds[0];
    if (!levelId) {
      warnings.push(`Field "${field.name}" skipped — no level available`);
      continue;
    }

    // Resolve values list for Values List / Checkbox fields
    let valuesListId: number | undefined;
    if (field.type === "Checkbox") {
      valuesListId = yesNoListId || undefined;
    } else if (field.type === "Values List") {
      // Try to match by name
      const match = Object.entries(valuesListIds).find(([k]) =>
        k.toLowerCase().includes(field.name.toLowerCase()) ||
        field.name.toLowerCase().includes(k.toLowerCase())
      );
      if (match) {
        valuesListId = match[1];
      } else {
        // Create a dedicated mini-list
        try {
          const lid = await tryCreateValuesList(baseUrl, token, `${field.name} Values`);
          if (lid) {
            valuesListId = lid;
            valuesListIds[`${field.name} Values`] = lid;
            await tryAddValuesListValue(baseUrl, token, lid, "Option 1", true);
            await tryAddValuesListValue(baseUrl, token, lid, "Option 2", false);
          }
        } catch { /* non-fatal */ }
      }
    }

    try {
      const fid = await tryCreateField(baseUrl, token, levelId, {
        name: field.name,
        type: field.type,
        required: !!field.required,
        valuesListId,
      });
      if (fid) fieldIds.push(fid);
    } catch (err: any) {
      warnings.push(`Field "${field.name}": ${err.message}`);
    }
  }
  await onStep("Creating Fields", `${fieldIds.length} field(s) created`, fieldIds.length > 0 ? "ok" : "warn");

  // ── STEP 6: Cross References ──────────────────────────────────────────────
  await onStep("Creating Cross References", "Cross-references require target apps to already exist in Archer");
  if ((content.crossReferences ?? []).length > 0) {
    warnings.push(
      `${content.crossReferences.length} cross-reference(s) defined but not auto-created — ` +
      `target applications must exist first. Configure them manually in Application Builder.`
    );
    await onStep("Creating Cross References", "Skipped — configure manually after all target apps exist", "warn");
  } else {
    await onStep("Creating Cross References", "None defined", "ok");
  }

  // ── STEP 7: Workflow ──────────────────────────────────────────────────────
  await onStep("Creating Workflow", "Applying workflow configuration…");
  if (content.workflow?.stages?.length) {
    const stageList = content.workflow.stages.map((s: any) => s.name).join(" → ");
    warnings.push(
      `Workflow (${stageList}) must be configured in Archer's Workflow Manager UI. ` +
      `The REST API does not support programmatic workflow stage creation.`
    );
    await onStep(
      "Creating Workflow",
      `${content.workflow.stages.length} stage(s) planned — set up in Archer Workflow Manager`,
      "warn"
    );
  } else {
    await onStep("Creating Workflow", "No workflow stages defined", "ok");
  }

  // ── STEP 8: Record Permissions ────────────────────────────────────────────
  await onStep("Creating Record Permissions", "Permissions require Archer group IDs — must be set manually");
  if ((content.recordPermissions ?? []).length > 0) {
    const groupList = content.recordPermissions.map((p: any) => p.group).join(", ");
    warnings.push(
      `Record permissions for groups (${groupList}) must be set manually in Application Builder → Access Roles.`
    );
    await onStep("Creating Record Permissions", "Configure in Application Builder → Access Roles", "warn");
  } else {
    await onStep("Creating Record Permissions", "None defined", "ok");
  }

  // ── STEP 9: Notifications ─────────────────────────────────────────────────
  await onStep("Creating Notifications", "Notification rules are configured inside Archer Application Builder");
  const allNotifs = [
    ...(content.notifications ?? []),
    ...(content.workflow?.notifications ?? []),
  ];
  if (allNotifs.length > 0) {
    warnings.push(
      `${allNotifs.length} notification(s) defined — configure in Application Builder → Notifications. ` +
      `The REST API does not expose a notification creation endpoint.`
    );
    await onStep("Creating Notifications", `${allNotifs.length} notification(s) — add manually in Archer`, "warn");
  } else {
    await onStep("Creating Notifications", "None defined", "ok");
  }

  // ── STEP 10: Finalize ────────────────────────────────────────────────────
  await archerLogout(baseUrl, token);
  await onStep(
    "Finalizing Deployment",
    applicationId
      ? `Done. Application ID: ${applicationId}. Open Archer Application Builder to verify.`
      : `Deployment attempted. Check Archer Application Builder — some steps may need manual completion.`,
    "ok"
  );

  return { applicationId, levelIds, valuesListIds, fieldIds, warnings };
}
