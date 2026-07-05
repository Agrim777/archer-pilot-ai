/**
 * RSA Archer GRC Platform REST API client (v6.x)
 *
 * Archer REST API base path: <instanceUrl>/api/
 * Auth header after login: Authorization: Archer session-id="<token>"
 *
 * Objects we create in order:
 *   1. Login → session token
 *   2. Application
 *   3. Levels (modules) per application
 *   4. Values Lists + Values (must exist before Values List fields)
 *   5. Field Definitions (per level, referencing value list IDs)
 *   6. Notifications
 *   7. Record Permissions (requires Archer Group IDs)
 */

export type StepCallback = (stepName: string, message: string, status?: "ok" | "warn") => Promise<void>;

/** Map AI-generated type strings → Archer FieldType integers */
const FIELD_TYPE_MAP: Record<string, number> = {
  "Text": 1,
  "Numeric": 2,
  "Number": 2,
  "Date": 3,
  "Values List": 4,
  "Related Records": 8,
  "Cross-Reference": 8,
  "User/Groups List": 9,
  "Attachment": 11,
  "Image": 12,
  "IP Address": 19,
  "URL": 22,
  "Calculated": 23,
  "Checkbox": 4,    // Archer has no native checkbox — use Values List: Yes / No
  "Matrix": 37,
};

function archerType(typeStr: string): number {
  return FIELD_TYPE_MAP[typeStr] ?? 1; // default to Text
}

function authHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": `Archer session-id="${token}"`,
  };
}

async function archerPost(baseUrl: string, path: string, body: unknown, token?: string): Promise<any> {
  const headers: Record<string, string> = { "Content-Type": "application/json", "Accept": "application/json" };
  if (token) headers["Authorization"] = `Archer session-id="${token}"`;

  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { throw new Error(`Archer returned non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`); }

  if (!res.ok || data?.IsSuccessful === false) {
    const msgs = data?.ValidationMessages?.map((m: any) => m.MessageKey || m.Message).join("; ") || text.slice(0, 300);
    throw new Error(`Archer API error (HTTP ${res.status}): ${msgs}`);
  }
  return data;
}

async function archerGet(baseUrl: string, path: string, token: string): Promise<any> {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: authHeaders(token),
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { throw new Error(`Archer returned non-JSON (HTTP ${res.status})`); }
  return data;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function archerLogin(baseUrl: string, username: string, password: string, instanceName: string): Promise<string> {
  const data = await archerPost(baseUrl, "/api/core/security/login", {
    InstanceName: instanceName || "Default",
    Username: username,
    UserDomain: "",
    Password: password,
  });
  const token = data?.RequestedObject?.SessionToken;
  if (!token) throw new Error("No session token returned from Archer login");
  return token;
}

export async function archerLogout(baseUrl: string, token: string): Promise<void> {
  try {
    await fetch(`${baseUrl}/api/core/security/logout`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
  } catch { /* best-effort */ }
}

// ─── Application ─────────────────────────────────────────────────────────────

export async function createApplication(baseUrl: string, token: string, name: string, type = 2): Promise<number> {
  // type 2 = Standard Application; 1 = Questionnaire; 3 = Findings
  const alias = name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 30);
  const data = await archerPost(baseUrl, "/api/core/system/application", {
    Application: {
      Name: name,
      Alias: alias || "App",
      Status: 1,
      Type: type,
      IsGlobal: false,
    },
  }, token);
  const id = data?.RequestedObject?.Id;
  if (!id) throw new Error("No application ID returned");
  return id;
}

// ─── Levels (modules) ────────────────────────────────────────────────────────

export async function createLevel(baseUrl: string, token: string, applicationId: number, name: string): Promise<number> {
  const data = await archerPost(baseUrl, "/api/core/system/level", {
    Level: {
      Name: name,
      ApplicationId: applicationId,
    },
  }, token);
  const id = data?.RequestedObject?.Id;
  if (!id) throw new Error(`No level ID returned for module "${name}"`);
  return id;
}

// ─── Values Lists ─────────────────────────────────────────────────────────────

export async function createValuesList(baseUrl: string, token: string, name: string): Promise<number> {
  const data = await archerPost(baseUrl, "/api/core/system/valueslist", {
    ValuesList: { Name: name },
  }, token);
  const id = data?.RequestedObject?.Id;
  if (!id) throw new Error(`No values list ID returned for "${name}"`);
  return id;
}

export async function addValuesListValue(
  baseUrl: string,
  token: string,
  valuesListId: number,
  valueName: string,
  isDefault = false
): Promise<number> {
  const data = await archerPost(baseUrl, "/api/core/system/valueslistvalue", {
    ValuesListValue: {
      Name: valueName,
      ValuesListId: valuesListId,
      IsDefault: isDefault,
      Enabled: true,
    },
  }, token);
  return data?.RequestedObject?.Id ?? 0;
}

// ─── Fields ──────────────────────────────────────────────────────────────────

export interface FieldSpec {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  valuesListId?: number;   // for Values List fields
  relatedAppId?: number;   // for Cross-Reference fields
}

export async function createField(
  baseUrl: string,
  token: string,
  levelId: number,
  spec: FieldSpec
): Promise<number> {
  const archerFieldType = archerType(spec.type);

  const fieldBody: any = {
    Name: spec.name,
    FieldType: archerFieldType,
    LevelId: levelId,
    IsRequired: spec.required,
    IsReadOnly: false,
    IsPrivate: false,
  };

  // Values List field: attach the list
  if (archerFieldType === 4 && spec.valuesListId) {
    fieldBody.RelatedValuesListId = spec.valuesListId;
    fieldBody.AllowOtherValue = false;
  }

  // Cross-Reference: attach related application
  if (archerFieldType === 8 && spec.relatedAppId) {
    fieldBody.RelatedApplicationId = spec.relatedAppId;
  }

  const data = await archerPost(baseUrl, "/api/core/system/fielddefinition", {
    FieldDefinition: fieldBody,
  }, token);

  return data?.RequestedObject?.Id ?? 0;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function createNotification(
  baseUrl: string,
  token: string,
  applicationId: number,
  name: string,
  subject: string
): Promise<number> {
  // Basic notification — trigger and recipients must be set in UI for complex rules
  const data = await archerPost(baseUrl, "/api/core/system/notification", {
    Notification: {
      Name: name,
      Subject: subject,
      ApplicationId: applicationId,
      Status: 1,
      Body: `Automated notification: ${name}`,
    },
  }, token);
  return data?.RequestedObject?.Id ?? 0;
}

// ─── Groups (for record permissions) ─────────────────────────────────────────

export async function getGroups(baseUrl: string, token: string): Promise<Array<{ id: number; name: string }>> {
  try {
    const data = await archerGet(baseUrl, "/api/core/system/group", token);
    return (data?.RequestedObject ?? []).map((g: any) => ({ id: g.Id, name: g.Name }));
  } catch {
    return [];
  }
}

export async function setRecordPermission(
  baseUrl: string,
  token: string,
  levelId: number,
  groupId: number,
  rights: { read: boolean; create: boolean; update: boolean; delete: boolean }
): Promise<void> {
  // Archer record permissions: 1=Read, 3=Read+Create, 7=Read+Create+Update, 15=Full
  let permissionType = 0;
  if (rights.read) permissionType |= 1;
  if (rights.create) permissionType |= 2;
  if (rights.update) permissionType |= 4;
  if (rights.delete) permissionType |= 8;

  await archerPost(baseUrl, "/api/core/system/accessrole", {
    AccessRole: {
      LevelId: levelId,
      GroupId: groupId,
      AccessRoleType: permissionType,
    },
  }, token);
}

// ─── Full deployment orchestrator ─────────────────────────────────────────────

export interface DeploymentResult {
  applicationId: number;
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

  // 1. LOGIN
  await onStep("Login", "Authenticating with Archer instance...");
  token = await archerLogin(baseUrl, username, password, instanceName);
  await onStep("Login", `Authenticated as ${username}`, "ok");

  const appName =
    content.applicationStructure?.name ||
    content.modules?.[0]?.name ||
    "ArcherPilot Application";

  // 2. CREATE APPLICATION
  await onStep("Creating Application", `Creating application: ${appName}`);
  const applicationId = await createApplication(baseUrl, token, appName);
  await onStep("Creating Application", `Application created (ID: ${applicationId})`, "ok");

  // 3. CREATE MODULES (Levels)
  await onStep("Creating Modules", `Creating ${content.modules?.length ?? 0} module(s)...`);
  const levelIds: number[] = [];
  const levelIdByModule: Record<string, number> = {};

  for (const mod of content.modules ?? []) {
    try {
      const levelId = await createLevel(baseUrl, token, applicationId, mod.name);
      levelIds.push(levelId);
      levelIdByModule[mod.name] = levelId;
    } catch (err: any) {
      warnings.push(`Module "${mod.name}": ${err.message}`);
    }
  }
  // Fallback — if no modules defined, create a default level
  if (levelIds.length === 0) {
    const levelId = await createLevel(baseUrl, token, applicationId, appName);
    levelIds.push(levelId);
    levelIdByModule["__default__"] = levelId;
  }
  await onStep("Creating Modules", `${levelIds.length} module(s) created`, "ok");

  // 4. VALUE LISTS
  await onStep("Creating Value Lists", `Creating ${content.valueLists?.length ?? 0} value list(s)...`);
  const valuesListIds: Record<string, number> = {};

  for (const vl of content.valueLists ?? []) {
    try {
      const listId = await createValuesList(baseUrl, token, vl.name);
      valuesListIds[vl.name] = listId;
      for (let i = 0; i < (vl.values ?? []).length; i++) {
        await addValuesListValue(baseUrl, token, listId, vl.values[i], i === 0);
      }
      // Checkbox fallback: create Yes/No list
    } catch (err: any) {
      warnings.push(`Value list "${vl.name}": ${err.message}`);
    }
  }

  // Create implicit Yes/No list for Checkbox fields
  const hasCheckbox = (content.fields ?? []).some((f: any) => f.type === "Checkbox");
  let yesNoListId = 0;
  if (hasCheckbox) {
    try {
      yesNoListId = await createValuesList(baseUrl, token, "Yes / No");
      valuesListIds["Yes / No"] = yesNoListId;
      await addValuesListValue(baseUrl, token, yesNoListId, "Yes", false);
      await addValuesListValue(baseUrl, token, yesNoListId, "No", true);
    } catch { /* non-fatal */ }
  }

  await onStep("Creating Value Lists", `${Object.keys(valuesListIds).length} value list(s) created`, "ok");

  // 5. FIELDS
  await onStep("Creating Fields", `Creating ${content.fields?.length ?? 0} field(s)...`);
  const fieldIds: number[] = [];

  for (const field of content.fields ?? []) {
    // Resolve which level this field belongs to
    const levelId =
      (field.module && levelIdByModule[field.module]) ||
      levelIds[0];

    if (!levelId) {
      warnings.push(`Field "${field.name}": no level found for module "${field.module}"`);
      continue;
    }

    // For Values List fields, resolve the list ID
    let valuesListId: number | undefined;
    if (field.type === "Values List" || field.type === "Checkbox") {
      if (field.type === "Checkbox") {
        valuesListId = yesNoListId || undefined;
      } else {
        // Try to match by field name or description
        const match = Object.entries(valuesListIds).find(([k]) =>
          k.toLowerCase().includes(field.name.toLowerCase()) ||
          field.name.toLowerCase().includes(k.toLowerCase())
        );
        valuesListId = match?.[1];
        if (!valuesListId) {
          // Create a dedicated mini-list for this field
          try {
            const miniId = await createValuesList(baseUrl, token, `${field.name} Values`);
            valuesListId = miniId;
            valuesListIds[`${field.name} Values`] = miniId;
            await addValuesListValue(baseUrl, token, miniId, "Option 1", true);
            await addValuesListValue(baseUrl, token, miniId, "Option 2", false);
          } catch { /* non-fatal */ }
        }
      }
    }

    try {
      const fid = await createField(baseUrl, token, levelId, {
        name: field.name,
        type: field.type,
        required: !!field.required,
        description: field.description,
        valuesListId,
      });
      if (fid) fieldIds.push(fid);
    } catch (err: any) {
      warnings.push(`Field "${field.name}": ${err.message}`);
    }
  }

  await onStep("Creating Fields", `${fieldIds.length} field(s) created`, "ok");

  // 6. CROSS REFERENCES
  await onStep("Creating Cross References", `Setting up ${content.crossReferences?.length ?? 0} cross-reference(s)...`);
  // Cross-references reference other application IDs — skipping for now since we only have one app
  if ((content.crossReferences?.length ?? 0) === 0) {
    await onStep("Creating Cross References", "None defined — skipped", "ok");
  } else {
    warnings.push("Cross-references require target applications to exist first. Configure them manually in Archer after this deployment.");
    await onStep("Creating Cross References", "Skipped (target apps must exist first — see warnings)", "warn");
  }

  // 7. WORKFLOW
  await onStep("Creating Workflow", "Configuring workflow stages...");
  if (!content.workflow?.stages?.length) {
    await onStep("Creating Workflow", "No workflow defined — skipped", "ok");
  } else {
    // Archer workflow requires creating workflow nodes via the UI wizard or complex API sequences.
    // For now we record the intent and advise the user.
    const stageNames = content.workflow.stages.map((s: any) => s.name).join(" → ");
    warnings.push(`Workflow stages (${stageNames}) must be configured in Archer's Workflow Manager UI. The stage plan is saved in your project.`);
    await onStep("Creating Workflow", `${content.workflow.stages.length} stage(s) planned — configure in Workflow Manager`, "warn");
  }

  // 8. RECORD PERMISSIONS
  await onStep("Creating Record Permissions", "Applying record permissions...");
  const groups = await getGroups(baseUrl, token);

  let permissionsApplied = 0;
  for (const perm of content.recordPermissions ?? []) {
    const group = groups.find(g =>
      g.name.toLowerCase().includes(perm.group.toLowerCase()) ||
      perm.group.toLowerCase().includes(g.name.toLowerCase())
    );
    if (!group) {
      warnings.push(`Permission group "${perm.group}" not found in Archer. Create the group and apply permissions manually.`);
      continue;
    }
    for (const levelId of levelIds) {
      try {
        await setRecordPermission(baseUrl, token, levelId, group.id, {
          read: !!perm.read,
          create: !!perm.create,
          update: !!perm.update,
          delete: !!perm.delete,
        });
        permissionsApplied++;
      } catch (err: any) {
        warnings.push(`Permission for "${perm.group}": ${err.message}`);
      }
    }
  }
  await onStep("Creating Record Permissions", permissionsApplied > 0 ? `${permissionsApplied} permission(s) applied` : "Permissions require manual setup — see warnings", permissionsApplied > 0 ? "ok" : "warn");

  // 9. NOTIFICATIONS
  await onStep("Creating Notifications", `Creating ${content.notifications?.length ?? 0} notification(s)...`);
  let notifCount = 0;
  for (const notif of content.notifications ?? []) {
    try {
      await createNotification(baseUrl, token, applicationId, notif.name || "Notification", notif.subject || notif.name || "Notification");
      notifCount++;
    } catch (err: any) {
      warnings.push(`Notification "${notif.name}": ${err.message}`);
    }
  }
  // Also handle workflow notifications
  for (const notif of content.workflow?.notifications ?? []) {
    try {
      const name = typeof notif === "string" ? notif : notif.name || "Workflow Notification";
      await createNotification(baseUrl, token, applicationId, name, name);
      notifCount++;
    } catch (err: any) {
      warnings.push(`Workflow notification: ${err.message}`);
    }
  }
  await onStep("Creating Notifications", notifCount > 0 ? `${notifCount} notification(s) created` : "None or skipped", "ok");

  // 10. LOGOUT
  await archerLogout(baseUrl, token);
  await onStep("Finalizing Deployment", `Deployment complete. Application ID: ${applicationId}. Open Archer to review.`, "ok");

  return { applicationId, levelIds, valuesListIds, fieldIds, warnings };
}
