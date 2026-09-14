const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extra } });
}

function cors(request, response) {
  const origin = request.headers.get("Origin");
  const allowed = origin && (origin.endsWith(".pages.dev") || origin.includes("chatgpt.site") || origin.includes("localhost")) ? origin : "*";
  const headers = new Headers(response.headers);
  if (new URL(request.url).pathname.startsWith("/api/")) headers.set("cache-control", "no-store, no-cache, must-revalidate");
  headers.set("access-control-allow-origin", allowed);
  headers.set("access-control-allow-headers", "content-type, authorization");
  headers.set("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");
  headers.set("access-control-allow-credentials", "true");
  return new Response(response.body, { status: response.status, headers });
}

function id() { return crypto.randomUUID(); }
function now() { return new Date().toISOString(); }
function hash(value) { return crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)).then(b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("")); }
function token() { return `${id()}${id().replaceAll("-", "")}`; }
async function body(request) { try { return await request.json(); } catch { return {}; } }

let schemaReady;
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function ensureSchema(env) {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    if (!env.DB) throw new Error("D1-Binding DB fehlt.");
    await env.DB.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, name TEXT NOT NULL, daily_target_minutes INTEGER NOT NULL DEFAULT 480, weekly_target_minutes INTEGER NOT NULL DEFAULT 2400, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#1769e8', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(user_id,name));
    CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', budget_minutes INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(user_id,name));
    CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, entry_date TEXT NOT NULL, start_time TEXT, end_time TEXT, duration_minutes INTEGER NOT NULL, break_minutes INTEGER NOT NULL DEFAULT 0, category_id TEXT NOT NULL REFERENCES categories(id), project_id TEXT NOT NULL REFERENCES projects(id), description TEXT, jira_reference TEXT, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS favorites (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, label TEXT NOT NULL, category_id TEXT REFERENCES categories(id) ON DELETE SET NULL, project_id TEXT REFERENCES projects(id) ON DELETE SET NULL, duration_minutes INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, key TEXT NOT NULL, value TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(user_id,key));
    CREATE TABLE IF NOT EXISTS calendar_events (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, event_type TEXT NOT NULL DEFAULT 'Termin', title TEXT NOT NULL, event_date TEXT NOT NULL, all_day INTEGER NOT NULL DEFAULT 0, start_time TEXT, end_time TEXT, place TEXT, reminder_minutes INTEGER NOT NULL DEFAULT 0, note TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, content TEXT NOT NULL, checklist_json TEXT NOT NULL DEFAULT '[]', color TEXT NOT NULL DEFAULT 'blau', section TEXT NOT NULL DEFAULT 'Arbeit', archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS user_states (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, payload_json TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL, updated_by_device TEXT, updated_by_label TEXT);
    CREATE TABLE IF NOT EXISTS absences (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, absence_type TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS closed_days (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, closed_date TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(user_id, closed_date));
    CREATE TABLE IF NOT EXISTS admin_invites (id TEXT PRIMARY KEY, created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, organization_id TEXT, email TEXT, code_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_calendar_user_date ON calendar_events(user_id,event_date);
    CREATE INDEX IF NOT EXISTS idx_notes_user_updated ON notes(user_id,updated_at);
    CREATE INDEX IF NOT EXISTS idx_entries_user_date ON entries(user_id,entry_date);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_admin_invites_hash ON admin_invites(code_hash);
    CREATE INDEX IF NOT EXISTS idx_absences_user_date ON absences(user_id,start_date,end_date);
    CREATE INDEX IF NOT EXISTS idx_closed_days_user_date ON closed_days(user_id,closed_date);
    `);
    try { await env.DB.exec("ALTER TABLE notes ADD COLUMN section TEXT NOT NULL DEFAULT 'Arbeit'"); } catch {}
    try { await env.DB.exec("ALTER TABLE admin_invites ADD COLUMN organization_id TEXT"); } catch {}
    try { await env.DB.exec("ALTER TABLE user_states ADD COLUMN updated_by_device TEXT"); } catch {}
    try { await env.DB.exec("ALTER TABLE user_states ADD COLUMN updated_by_label TEXT"); } catch {}
    await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT NOT NULL UNIQUE, timezone TEXT NOT NULL DEFAULT 'Europe/Zurich', locale TEXT NOT NULL DEFAULT 'de-CH', week_start INTEGER NOT NULL DEFAULT 1, owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS organization_members (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, user_id TEXT REFERENCES users(id) ON DELETE SET NULL, display_name TEXT NOT NULL, email TEXT, employee_number TEXT, role TEXT NOT NULL DEFAULT 'employee', status TEXT NOT NULL DEFAULT 'active', department_id TEXT, manager_member_id TEXT, location TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(organization_id, email), UNIQUE(organization_id, employee_number));
    CREATE TABLE IF NOT EXISTS departments (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, name TEXT NOT NULL, cost_center TEXT, parent_id TEXT REFERENCES departments(id) ON DELETE SET NULL, manager_member_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(organization_id, name));
    CREATE TABLE IF NOT EXISTS work_policies (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, name TEXT NOT NULL, max_weekly_minutes INTEGER NOT NULL DEFAULT 2700, min_daily_rest_minutes INTEGER NOT NULL DEFAULT 660, break_after_minutes INTEGER NOT NULL DEFAULT 420, break_minutes INTEGER NOT NULL DEFAULT 30, overtime_alert_minutes INTEGER NOT NULL DEFAULT 120, effective_from TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(organization_id, name));
    CREATE TABLE IF NOT EXISTS time_periods (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, period_key TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', submitted_by TEXT REFERENCES users(id) ON DELETE SET NULL, approved_by TEXT REFERENCES users(id) ON DELETE SET NULL, submitted_at TEXT, approved_at TEXT, locked_at TEXT, reopened_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(organization_id, period_key));
    CREATE TABLE IF NOT EXISTS time_approvals (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, period_id TEXT NOT NULL REFERENCES time_periods(id) ON DELETE CASCADE, member_id TEXT NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE, status TEXT NOT NULL DEFAULT 'pending', approver_user_id TEXT REFERENCES users(id) ON DELETE SET NULL, comment TEXT, decided_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(period_id, member_id));
    CREATE TABLE IF NOT EXISTS planned_shifts (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, member_id TEXT NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE, shift_date TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, break_minutes INTEGER NOT NULL DEFAULT 30, work_location TEXT NOT NULL DEFAULT 'Büro', status TEXT NOT NULL DEFAULT 'planned', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS enterprise_integrations (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, integration_type TEXT NOT NULL, display_name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'planned', config_json TEXT NOT NULL DEFAULT '{}', last_sync_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(organization_id, integration_type));
    CREATE TABLE IF NOT EXISTS payroll_exports (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, period_key TEXT NOT NULL, format TEXT NOT NULL DEFAULT 'csv', status TEXT NOT NULL DEFAULT 'prepared', row_count INTEGER NOT NULL DEFAULT 0, created_by TEXT REFERENCES users(id) ON DELETE SET NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS leave_balances (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, member_id TEXT NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE, year INTEGER NOT NULL, leave_type TEXT NOT NULL DEFAULT 'Ferien', allocated_minutes INTEGER NOT NULL DEFAULT 0, used_minutes INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, UNIQUE(member_id, year, leave_type));
    CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, before_json TEXT, after_json TEXT, request_id TEXT, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_org_members_org_status ON organization_members(organization_id, status);
    CREATE INDEX IF NOT EXISTS idx_departments_org ON departments(organization_id);
    CREATE INDEX IF NOT EXISTS idx_periods_org_status ON time_periods(organization_id, status, period_key);
    CREATE INDEX IF NOT EXISTS idx_approvals_org_status ON time_approvals(organization_id, status);
    CREATE INDEX IF NOT EXISTS idx_shifts_org_date ON planned_shifts(organization_id, shift_date);
    CREATE INDEX IF NOT EXISTS idx_integrations_org_status ON enterprise_integrations(organization_id, status);
    CREATE INDEX IF NOT EXISTS idx_payroll_exports_org_period ON payroll_exports(organization_id, period_key, created_at);
    CREATE INDEX IF NOT EXISTS idx_leave_balances_member_year ON leave_balances(member_id, year);
    CREATE INDEX IF NOT EXISTS idx_audit_org_created ON audit_events(organization_id, created_at);
    `);
  })();
  try { return await schemaReady; }
  catch (error) { schemaReady = null; throw error; }
}

async function ensureSchemaWithRetry(env) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await ensureSchema(env);
    } catch (error) {
      lastError = error;
      if (!/(?:locked|busy|SQLITE_BUSY)/i.test(String(error?.message || error)) || attempt === 3) throw error;
      await wait(200 * (attempt + 1));
    }
  }
  throw lastError;
}

async function currentUser(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const tokenHash = await hash(auth.slice(7));
  return env.DB.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`).bind(tokenHash, now()).first();
}

function publicUser(user) {
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name, daily_target_minutes: user.daily_target_minutes, weekly_target_minutes: user.weekly_target_minutes };
}

async function authUser(env, user) {
  if (!user) return null;
  const context = await enterpriseContext(env, user);
  return { ...publicUser(user), role: context.member.role, is_admin: enterpriseAdminRoles.has(context.member.role) };
}

async function auth(request, env) {
  const url = new URL(request.url), data = await body(request);
  if (url.pathname === "/api/auth/register" && request.method === "POST") {
    if (!data.email || !data.password || !data.name) return json({ error: "Name, E-Mail und Passwort sind erforderlich." }, 400);
    if (String(data.password).length < 8) return json({ error: "Das Passwort muss mindestens 8 Zeichen enthalten." }, 400);
    const email = String(data.email).toLowerCase();
    if (await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first()) return json({ error: "Diese E-Mail-Adresse ist bereits registriert." }, 409);
    const userCount = Number((await env.DB.prepare("SELECT COUNT(*) AS count FROM users").first())?.count || 0);
    const inviteCode = String(data.invite_code || "").trim();
    let invite = null;
    if (userCount > 0) {
      if (!inviteCode) return json({ error: "Die Registrierung ist geschützt. Bitte verwende einen Einladungscode deines Administrators." }, 403);
      invite = await env.DB.prepare("SELECT * FROM admin_invites WHERE code_hash=? AND used_at IS NULL AND expires_at>? ").bind(await hash(inviteCode), now()).first();
      if (!invite) return json({ error: "Der Einladungscode ist ungültig, abgelaufen oder wurde bereits verwendet." }, 403);
      if (invite.email && invite.email.toLowerCase() !== email) return json({ error: "Der Einladungscode ist für eine andere E-Mail-Adresse bestimmt." }, 403);
    }
    const userId = id(), rawToken = token(), timestamp = now(), userStatements = [
      env.DB.prepare("INSERT INTO users (id,email,password_hash,name,created_at) VALUES (?,?,?,?,?)").bind(userId, email, await hash(data.password), data.name, timestamp),
      env.DB.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)").bind(id(), userId, await hash(rawToken), new Date(Date.now() + 30 * 864e5).toISOString(), timestamp)
    ];
    if (invite) {
      userStatements.push(env.DB.prepare("UPDATE admin_invites SET used_at=? WHERE id=? AND used_at IS NULL").bind(timestamp, invite.id));
      if (invite.organization_id) userStatements.push(env.DB.prepare("INSERT INTO organization_members (id,organization_id,user_id,display_name,email,role,status,location,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(id(), invite.organization_id, userId, data.name, email, "employee", "active", "Schweiz", timestamp, timestamp));
    }
    await env.DB.batch(userStatements);
    const created = await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(userId).first();
    return json({ user: await authUser(env, created), token: rawToken }, 201);
  }
  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    const user = await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(String(data.email || "").toLowerCase()).first();
    if (!user || user.password_hash !== await hash(data.password || "")) return json({ error: "E-Mail oder Passwort ist falsch." }, 401);
    const rawToken = token();
    await env.DB.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)").bind(id(), user.id, await hash(rawToken), new Date(Date.now() + 30 * 864e5).toISOString(), now()).run();
    return json({ user: await authUser(env, user), token: rawToken });
  }
  if (url.pathname === "/api/auth/me" && request.method === "GET") return json({ user: await authUser(env, await currentUser(request, env)) });
  if (url.pathname === "/api/auth/invites" && request.method === "POST") {
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Anmeldung erforderlich." }, 401);
    const context = await enterpriseContext(env, user);
    if (!enterpriseAdminRoles.has(context.member.role)) return json({ error: "Nur Owner, Admin oder HR dürfen Benutzer einladen." }, 403);
    const email = String(data.email || "").trim().toLowerCase() || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Bitte eine gültige E-Mail-Adresse eingeben." }, 400);
    const code = `ZTF-${token().slice(0, 8).toUpperCase()}`, timestamp = now(), expires = new Date(Date.now() + 7 * 864e5).toISOString();
    await env.DB.prepare("INSERT INTO admin_invites (id,created_by,organization_id,email,code_hash,expires_at,created_at) VALUES (?,?,?,?,?,?,?)").bind(id(), user.id, context.organizationId, email, await hash(code), expires, timestamp).run();
    return json({ invite_code: code, email, expires_at: expires });
  }
  if (url.pathname === "/api/auth/users" && request.method === "GET") {
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Anmeldung erforderlich." }, 401);
    const context = await enterpriseContext(env, user);
    if (!enterpriseAdminRoles.has(context.member.role)) return json({ error: "Nur Owner, Admin oder HR dürfen Benutzer verwalten." }, 403);
    const users = await env.DB.prepare("SELECT id,email,name,created_at FROM users ORDER BY name,email").all();
    return json(users.results);
  }
  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    const header = request.headers.get("Authorization") || "";
    if (header.startsWith("Bearer ")) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await hash(header.slice(7))).run();
    return json({ ok: true });
  }
  return null;
}

const enterpriseAdminRoles = new Set(["owner", "admin", "hr"]);
const enterpriseApproverRoles = new Set(["owner", "admin", "hr", "manager"]);
const enterpriseRoles = ["owner", "admin", "hr", "manager", "auditor", "employee"];
const syncStatePrefix = "professionelle-zeiterfassung.";

async function legacyState(env, user) {
  const [entries, categories, projects, favorites, settings, calendarEvents, notes, absences, closedDays] = await Promise.all([
    env.DB.prepare("SELECT * FROM entries WHERE user_id=? ORDER BY entry_date DESC, start_time DESC LIMIT 500").bind(user.id).all(),
    env.DB.prepare("SELECT * FROM categories WHERE user_id=? ORDER BY name").bind(user.id).all(),
    env.DB.prepare("SELECT * FROM projects WHERE user_id=? ORDER BY name").bind(user.id).all(),
    env.DB.prepare("SELECT * FROM favorites WHERE user_id=? ORDER BY label").bind(user.id).all(),
    env.DB.prepare("SELECT key,value FROM settings WHERE user_id=?").bind(user.id).all(),
    env.DB.prepare("SELECT * FROM calendar_events WHERE user_id=? ORDER BY event_date,start_time").bind(user.id).all(),
    env.DB.prepare("SELECT * FROM notes WHERE user_id=? ORDER BY updated_at DESC").bind(user.id).all(),
    env.DB.prepare("SELECT * FROM absences WHERE user_id=? ORDER BY start_date").bind(user.id).all(),
    env.DB.prepare("SELECT closed_date FROM closed_days WHERE user_id=? ORDER BY closed_date").bind(user.id).all()
  ]);
  const categoryNames = Object.fromEntries(categories.results.map(item => [item.id, item.name]));
  const projectNames = Object.fromEntries(projects.results.map(item => [item.id, item.name]));
  return {
    [syncStatePrefix + "v2"]: JSON.stringify({
      entries: entries.results.map(item => ({ id: item.id, date: item.entry_date, time: item.start_time || "", endTime: item.end_time || "", minutes: item.duration_minutes, breakMinutes: item.break_minutes, category: categoryNames[item.category_id] || "", project: projectNames[item.project_id] || "", description: item.description || "", jira_reference: item.jira_reference || "", notes: item.notes || "" })),
      categories: categories.results.map(item => item.name),
      projects: projects.results.map(item => item.name),
      favorites: favorites.results.map(item => ({ label: item.label, category: categoryNames[item.category_id] || "", project: projectNames[item.project_id] || "", duration_minutes: item.duration_minutes || 0 })),
      daily: settings.results.find(item => item.key === "daily")?.value || "8h 00",
      weekly: settings.results.find(item => item.key === "weekly")?.value || "40h 00",
      breakHours: settings.results.find(item => item.key === "breakHours")?.value || ".5",
      absences: absences.results.map(item => ({ id: item.id, type: item.absence_type, start: item.start_date, end: item.end_date, note: item.note || "" })),
      closedDays: closedDays.results.map(item => item.closed_date)
    }),
    [syncStatePrefix + "calendar.v1"]: JSON.stringify(calendarEvents.results.map(item => ({ id: item.id, title: item.title, type: item.event_type, date: item.event_date, allDay: Boolean(item.all_day), start: item.start_time || "", end: item.end_time || "", place: item.place || "", reminder: Number(item.reminder_minutes || 0), note: item.note || "" }))),
    [syncStatePrefix + "notes.v1"]: JSON.stringify(notes.results.map(item => ({ id: item.id, title: item.title, content: item.content, color: item.color, section: item.section || "Arbeit", tasks: stateJson({ checklist: item.checklist_json }, "checklist", []), created: item.created_at })))
  };
}

const stateJson = (state, key, fallback) => {
  try {
    const value = JSON.parse(state[key] || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
};
const stateName = value => {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (!value || typeof value !== "object") return "";
  return stateName(value.name ?? value.label ?? value.title ?? value.display_name ?? value.value);
};
const uniqueNames = values => [...new Set((Array.isArray(values) ? values : []).map(stateName).filter(Boolean))];

const defaultCategoryNames = new Set(["Testing", "Meeting", "Entwicklung", "Dokumentation", "Organisation", "Weiterbildung"]);
const defaultProjectNames = new Set(["UKA Connect", "Intern", "Privat"]);
const mainStateKey = syncStatePrefix + "v2";
const detailStateKeys = ["calendar.v1", "notes.v1", "reminders.v1", "reminders"];
const snapshotMarkerKey = syncStatePrefix + "sync-complete.v1";

const stateArrayItem = value => {
  if (value && typeof value === "object" && !Array.isArray(value) && !value.id) return { ...value, id: id() };
  return value;
};
const stateArrayKey = value => {
  if (value && typeof value === "object") return value.id || (value.name ? "name:" + value.name : value.label ? "label:" + value.label : JSON.stringify(value));
  return String(value);
};
const mergeStateArray = (current, next) => {
  const values = [...(Array.isArray(next) ? next : []), ...(Array.isArray(current) ? current : [])].map(stateArrayItem), seen = new Set();
  return values.filter(value => {
    const key = stateArrayKey(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const mainHasMeaningfulData = main => {
  if (!main || typeof main !== "object") return false;
  if (["entries", "favorites", "absences", "closedDays"].some(key => Array.isArray(main[key]) && main[key].length > 0)) return true;
  if (uniqueNames(main.categories).some(name => !defaultCategoryNames.has(name))) return true;
  if (uniqueNames(main.projects).some(name => !defaultProjectNames.has(name))) return true;
  return Boolean((main.weekdayTargets && typeof main.weekdayTargets === "object" && Object.keys(main.weekdayTargets).length) || main.daily || main.weekly || main.breakHours);
};

const stateHasMeaningfulData = state => {
  if (!state || typeof state !== "object") return false;
  if (mainHasMeaningfulData(stateJson(state, mainStateKey, null))) return true;
  return detailStateKeys.some(key => {
    const value = stateJson(state, syncStatePrefix + key, null);
    return Array.isArray(value) ? value.length > 0 : Boolean(value && typeof value === "object" && Object.keys(value).length);
  });
};

// The central profile snapshot is authoritative, but an empty/partial device
// payload must never destroy a previously persisted profile. This protects the
// data when a browser cache is cleared while the first cloud pull is still in
// flight or when an older client sends only one local-storage key.
function mergeStatePayload(existing, incoming, options = {}) {
  const current = existing && typeof existing === "object" && !Array.isArray(existing) ? existing : {};
  const next = incoming && typeof incoming === "object" && !Array.isArray(incoming) ? incoming : {};
  const protectEmpty = options.protectEmpty !== false;
  if (!Object.keys(next).length) return current;
  if (protectEmpty && !stateHasMeaningfulData(next) && stateHasMeaningfulData(current)) return current;

  const isCompleteSnapshot = next[snapshotMarkerKey] === "1";
  const merged = isCompleteSnapshot && !protectEmpty ? { ...next } : { ...current, ...next };
  const currentMain = stateJson(current, mainStateKey, null), nextMain = stateJson(next, mainStateKey, null);
  if (nextMain && typeof nextMain === "object") {
    const main = { ...(currentMain && typeof currentMain === "object" ? currentMain : {}), ...nextMain };
    ["entries", "favorites", "absences", "closedDays"].forEach(key => {
      if (protectEmpty && Array.isArray(nextMain[key]) && Array.isArray(currentMain?.[key])) main[key] = mergeStateArray(currentMain[key], nextMain[key]);
    });
    if (protectEmpty && Array.isArray(nextMain.categories) && Array.isArray(currentMain?.categories)) main.categories = mergeStateArray(currentMain.categories, nextMain.categories);
    if (protectEmpty && Array.isArray(nextMain.projects) && Array.isArray(currentMain?.projects)) main.projects = mergeStateArray(currentMain.projects, nextMain.projects);
    if (nextMain.weekdayTargets && typeof nextMain.weekdayTargets === "object" && currentMain?.weekdayTargets && typeof currentMain.weekdayTargets === "object") {
      main.weekdayTargets = { ...currentMain.weekdayTargets, ...nextMain.weekdayTargets };
    }
    merged[mainStateKey] = JSON.stringify(main);
  }
  detailStateKeys.forEach(key => {
    const fullKey = syncStatePrefix + key, currentValue = stateJson(current, fullKey, null), nextValue = stateJson(next, fullKey, null);
    if (protectEmpty && Array.isArray(nextValue) && Array.isArray(currentValue)) merged[fullKey] = JSON.stringify(mergeStateArray(currentValue, nextValue));
  });
  return merged;
}

function structuredStateStatements(env, user, state, timestamp) {
  const main = stateJson(state, syncStatePrefix + "v2", {});
  const calendar = stateJson(state, syncStatePrefix + "calendar.v1", []);
  const notes = stateJson(state, syncStatePrefix + "notes.v1", []);
  const categories = uniqueNames(main.categories);
  const projects = uniqueNames(main.projects);
  const entries = Array.isArray(main.entries) ? main.entries : [];
  entries.forEach(entry => {
    const category = stateName(entry?.category);
    const project = stateName(entry?.project);
    if (category) categories.push(category);
    if (project) projects.push(project);
  });
  const categoryNames = [...new Set(categories)].length ? [...new Set(categories)] : ["Organisation"];
  const projectNames = [...new Set(projects)].length ? [...new Set(projects)] : ["Intern"];
  const categoryIds = new Map(categoryNames.map(name => [name, id()]));
  const projectIds = new Map(projectNames.map(name => [name, id()]));
  const statements = [
    env.DB.prepare("DELETE FROM entries WHERE user_id=?").bind(user.id),
    env.DB.prepare("DELETE FROM favorites WHERE user_id=?").bind(user.id),
    env.DB.prepare("DELETE FROM calendar_events WHERE user_id=?").bind(user.id),
    env.DB.prepare("DELETE FROM notes WHERE user_id=?").bind(user.id),
    env.DB.prepare("DELETE FROM absences WHERE user_id=?").bind(user.id),
    env.DB.prepare("DELETE FROM closed_days WHERE user_id=?").bind(user.id),
    env.DB.prepare("DELETE FROM settings WHERE user_id=?").bind(user.id),
    env.DB.prepare("DELETE FROM categories WHERE user_id=?").bind(user.id),
    env.DB.prepare("DELETE FROM projects WHERE user_id=?").bind(user.id),
    ...categoryNames.map(name => env.DB.prepare("INSERT INTO categories (id,user_id,name,color,created_at,updated_at) VALUES (?,?,?,?,?,?)").bind(categoryIds.get(name), user.id, name, "#1769e8", timestamp, timestamp)),
    ...projectNames.map(name => {
      const source = (Array.isArray(main.projects) ? main.projects : []).find(item => stateName(item) === name);
      return env.DB.prepare("INSERT INTO projects (id,user_id,name,status,budget_minutes,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").bind(projectIds.get(name), user.id, name, source?.status === "archived" ? "archived" : "active", Math.max(0, Number(source?.budget_hours || 0) * 60), timestamp, timestamp);
    }),
    ...entries.map(entry => {
      const category = stateName(entry?.category) || "Organisation", project = stateName(entry?.project) || "Intern";
      const entryDate = /^\d{4}-\d{2}-\d{2}$/.test(String(entry?.date || "")) ? String(entry.date) : timestamp.slice(0, 10);
      return env.DB.prepare("INSERT INTO entries (id,user_id,entry_date,start_time,end_time,duration_minutes,break_minutes,category_id,project_id,description,jira_reference,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(entry?.id || id(), user.id, entryDate, entry?.time || entry?.start || null, entry?.endTime || entry?.end || null, Math.max(0, Number(entry?.minutes || 0)), Math.max(0, Number(entry?.breakMinutes || 0)), categoryIds.get(category) || categoryIds.get("Organisation"), projectIds.get(project) || projectIds.get("Intern"), entry?.description || null, entry?.jira_reference || entry?.jiraReference || null, entry?.notes || null, timestamp, timestamp);
    }),
    ...(Array.isArray(main.favorites) ? main.favorites : []).map(item => env.DB.prepare("INSERT INTO favorites (id,user_id,label,category_id,project_id,duration_minutes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(id(), user.id, stateName(item?.label || item) || "Favorit", categoryIds.get(stateName(item?.category)) || null, projectIds.get(stateName(item?.project)) || null, Math.max(0, Number(item?.duration_minutes || item?.minutes || 0)), timestamp, timestamp)),
    ...(Array.isArray(calendar) ? calendar : []).map(item => env.DB.prepare("INSERT INTO calendar_events (id,user_id,event_type,title,event_date,all_day,start_time,end_time,place,reminder_minutes,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(item?.id || id(), user.id, item?.type || item?.event_type || "Termin", item?.title || "Kalendereintrag", item?.date || timestamp.slice(0, 10), item?.allDay || item?.all_day ? 1 : 0, item?.start || item?.start_time || null, item?.end || item?.end_time || null, item?.place || null, Math.max(0, Number(item?.reminder || item?.reminder_minutes || 0)), item?.note || null, timestamp, timestamp)),
    ...(Array.isArray(notes) ? notes : []).map(item => env.DB.prepare("INSERT INTO notes (id,user_id,title,content,checklist_json,color,section,archived,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(item?.id || id(), user.id, item?.title || "Ohne Titel", item?.content || "", JSON.stringify(Array.isArray(item?.tasks) ? item.tasks : []), item?.color || "blau", item?.section || "Arbeit", item?.archived ? 1 : 0, item?.created || timestamp, timestamp)),
    ...(Array.isArray(main.absences) ? main.absences : []).map(item => env.DB.prepare("INSERT INTO absences (id,user_id,absence_type,start_date,end_date,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(item?.id || id(), user.id, item?.type || "Abwesenheit", item?.start || timestamp.slice(0, 10), item?.end || item?.start || timestamp.slice(0, 10), item?.note || null, timestamp, timestamp)),
    ...(Array.isArray(main.closedDays) ? main.closedDays : []).map(date => env.DB.prepare("INSERT INTO closed_days (user_id,closed_date,created_at) VALUES (?,?,?)").bind(user.id, date, timestamp)),
    ...["daily", "weekly", "breakHours", "weekdayTargets"].filter(key => main[key] !== undefined).map(key => env.DB.prepare("INSERT INTO settings (user_id,key,value,updated_at) VALUES (?,?,?,?)").bind(user.id, key, typeof main[key] === "string" ? main[key] : JSON.stringify(main[key]), timestamp))
  ];
  return statements;
}

async function enterpriseContext(env, user) {
  let member = await env.DB.prepare(`SELECT m.*, o.name AS organization_name, o.code AS organization_code, o.timezone, o.locale, o.week_start
    FROM organization_members m JOIN organizations o ON o.id=m.organization_id
    WHERE m.user_id=? AND m.status='active' ORDER BY m.created_at LIMIT 1`).bind(user.id).first();
  if (!member) {
    const timestamp = now(), organizationId = id(), memberId = id(), departmentId = id(), policyId = id(), periodId = id();
    const periodKey = timestamp.slice(0, 7), code = `PERSONAL-${String(user.id).slice(0, 8).toUpperCase()}`;
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO organizations (id,name,code,timezone,locale,week_start,owner_user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`).bind(organizationId, `${user.name || "Persönlicher"} Organisation`, code, "Europe/Zurich", "de-CH", 1, user.id, timestamp, timestamp),
      env.DB.prepare(`INSERT INTO departments (id,organization_id,name,cost_center,created_at,updated_at) VALUES (?,?,?,?,?,?)`).bind(departmentId, organizationId, "Allgemeine Organisation", "1000", timestamp, timestamp),
      env.DB.prepare(`INSERT INTO organization_members (id,organization_id,user_id,display_name,email,employee_number,role,status,department_id,location,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(memberId, organizationId, user.id, user.name || "Persönlicher Benutzer", user.email, "EMP-0001", "owner", "active", departmentId, "Schweiz", timestamp, timestamp),
      env.DB.prepare(`INSERT INTO work_policies (id,organization_id,name,max_weekly_minutes,min_daily_rest_minutes,break_after_minutes,break_minutes,overtime_alert_minutes,effective_from,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(policyId, organizationId, "Standard Schweiz", 2700, 660, 420, 30, 120, periodKey + "-01", timestamp, timestamp),
      env.DB.prepare(`INSERT INTO time_periods (id,organization_id,period_key,status,created_at,updated_at) VALUES (?,?,?,?,?,?)`).bind(periodId, organizationId, periodKey, "open", timestamp, timestamp),
      ...[["sso", "Microsoft Entra ID / SSO"], ["payroll", "HR- und Payroll-Schnittstelle"], ["calendar", "Outlook / Teams Kalender"], ["project", "Projekt- und Kostenrechnung"]].map(([type, label]) => env.DB.prepare(`INSERT INTO enterprise_integrations (id,organization_id,integration_type,display_name,status,config_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`).bind(id(), organizationId, type, label, "planned", "{}", timestamp, timestamp)),
      env.DB.prepare(`INSERT INTO leave_balances (id,organization_id,member_id,year,leave_type,allocated_minutes,used_minutes,updated_at) VALUES (?,?,?,?,?,?,?,?)`).bind(id(), organizationId, memberId, Number(periodKey.slice(0, 4)), "Ferien", 28 * 480, 0, timestamp)
    ]);
    member = await env.DB.prepare(`SELECT m.*, o.name AS organization_name, o.code AS organization_code, o.timezone, o.locale, o.week_start
      FROM organization_members m JOIN organizations o ON o.id=m.organization_id WHERE m.id=?`).bind(memberId).first();
  }
  return { organizationId: member.organization_id, member };
}

async function enterpriseAudit(env, context, user, action, entityType, entityId, before, after, request) {
  await env.DB.prepare(`INSERT INTO audit_events (id,organization_id,actor_user_id,action,entity_type,entity_id,before_json,after_json,request_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(
    id(), context.organizationId, user.id, action, entityType, entityId || null, before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after), request.headers.get("cf-ray") || null, now()
  ).run();
}

const enterpriseForbidden = message => json({ error: message || "Keine Berechtigung für diese Organisation." }, 403);

async function enterpriseApi(request, env, user) {
  if (!user) return json({ error: "Anmeldung erforderlich." }, 401);
  const url = new URL(request.url), path = url.pathname, data = await body(request), context = await enterpriseContext(env, user), orgId = context.organizationId, role = context.member.role;
  const canAdmin = enterpriseAdminRoles.has(role), canApprove = enterpriseApproverRoles.has(role);
  if (path === "/api/enterprise/bootstrap" && request.method === "GET") {
    const [organization, members, departments, policies, periods, approvals, shifts, integrations, leaveBalances, audit] = await Promise.all([
      env.DB.prepare("SELECT * FROM organizations WHERE id=?").bind(orgId).first(),
      env.DB.prepare("SELECT m.*, d.name AS department_name FROM organization_members m LEFT JOIN departments d ON d.id=m.department_id WHERE m.organization_id=? ORDER BY m.status, m.display_name").bind(orgId).all(),
      env.DB.prepare("SELECT * FROM departments WHERE organization_id=? ORDER BY name").bind(orgId).all(),
      env.DB.prepare("SELECT * FROM work_policies WHERE organization_id=? ORDER BY effective_from DESC").bind(orgId).all(),
      env.DB.prepare("SELECT * FROM time_periods WHERE organization_id=? ORDER BY period_key DESC LIMIT 24").bind(orgId).all(),
      env.DB.prepare("SELECT a.*, m.display_name, p.period_key FROM time_approvals a JOIN organization_members m ON m.id=a.member_id JOIN time_periods p ON p.id=a.period_id WHERE a.organization_id=? ORDER BY a.updated_at DESC LIMIT 100").bind(orgId).all(),
      env.DB.prepare("SELECT s.*, m.display_name FROM planned_shifts s JOIN organization_members m ON m.id=s.member_id WHERE s.organization_id=? ORDER BY s.shift_date,s.start_time LIMIT 100").bind(orgId).all(),
      env.DB.prepare("SELECT id,integration_type,display_name,status,last_sync_at,created_at,updated_at FROM enterprise_integrations WHERE organization_id=? ORDER BY display_name").bind(orgId).all(),
      env.DB.prepare("SELECT l.*, m.display_name FROM leave_balances l JOIN organization_members m ON m.id=l.member_id WHERE l.organization_id=? ORDER BY l.year DESC,m.display_name").bind(orgId).all(),
      env.DB.prepare("SELECT a.id,a.action,a.entity_type,a.entity_id,a.after_json,a.created_at,u.name AS actor_name FROM audit_events a LEFT JOIN users u ON u.id=a.actor_user_id WHERE a.organization_id=? ORDER BY a.created_at DESC LIMIT 50").bind(orgId).all()
    ]);
    return json({ organization, membership: context.member, members: members.results, departments: departments.results, policies: policies.results, periods: periods.results, approvals: approvals.results, shifts: shifts.results, integrations: integrations.results, leave_balances: leaveBalances.results, audit: audit.results });
  }
  if (path === "/api/enterprise/organization" && request.method === "PUT") {
    if (!canAdmin) return enterpriseForbidden();
    const before = await env.DB.prepare("SELECT * FROM organizations WHERE id=?").bind(orgId).first();
    const allowed = { name: String(data.name || before.name).trim(), code: String(data.code || before.code).trim().toUpperCase(), timezone: String(data.timezone || before.timezone), locale: String(data.locale || before.locale), week_start: Number(data.week_start ?? before.week_start) };
    if (!allowed.name || !allowed.code) return json({ error: "Name und Organisationscode sind erforderlich." }, 400);
    await env.DB.prepare("UPDATE organizations SET name=?,code=?,timezone=?,locale=?,week_start=?,updated_at=? WHERE id=?").bind(allowed.name, allowed.code, allowed.timezone, allowed.locale, allowed.week_start, now(), orgId).run();
    const after = await env.DB.prepare("SELECT * FROM organizations WHERE id=?").bind(orgId).first(); await enterpriseAudit(env, context, user, "organization.updated", "organization", orgId, before, after, request); return json(after);
  }
  if (path === "/api/enterprise/members" && request.method === "POST") {
    if (!canAdmin) return enterpriseForbidden();
    if (!String(data.display_name || "").trim()) return json({ error: "Der Name ist erforderlich." }, 400);
    const timestamp = now(), memberId = id(), existingUser = data.email ? await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(String(data.email).toLowerCase()).first() : null;
    await env.DB.prepare("INSERT INTO organization_members (id,organization_id,user_id,display_name,email,employee_number,role,status,department_id,manager_member_id,location,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(memberId, orgId, existingUser?.id || null, String(data.display_name).trim(), data.email ? String(data.email).toLowerCase() : null, data.employee_number || null, enterpriseRoles.includes(data.role) ? data.role : "employee", data.status === "inactive" ? "inactive" : "active", data.department_id || null, data.manager_member_id || null, data.location || "Schweiz", timestamp, timestamp).run();
    const created = await env.DB.prepare("SELECT * FROM organization_members WHERE id=?").bind(memberId).first(); await enterpriseAudit(env, context, user, "member.created", "member", memberId, null, created, request); return json(created, 201);
  }
  const memberMatch = path.match(/^\/api\/enterprise\/members\/([^/]+)$/);
  if (memberMatch && request.method === "PATCH") {
    if (!canAdmin) return enterpriseForbidden(); const memberId = memberMatch[1], before = await env.DB.prepare("SELECT * FROM organization_members WHERE id=? AND organization_id=?").bind(memberId, orgId).first(); if (!before) return json({ error: "Mitarbeitende Person nicht gefunden." }, 404);
    const fields = ["display_name", "email", "employee_number", "role", "status", "department_id", "manager_member_id", "location"], updates = fields.filter(key => data[key] !== undefined); if (!updates.length) return json({ error: "Keine Änderungen." }, 400); if (data.role && !enterpriseRoles.includes(data.role)) return json({ error: "Ungültige Rolle." }, 400);
    await env.DB.prepare(`UPDATE organization_members SET ${updates.map(key => `${key}=?`).join(",")},updated_at=? WHERE id=? AND organization_id=?`).bind(...updates.map(key => data[key]), now(), memberId, orgId).run(); const after = await env.DB.prepare("SELECT * FROM organization_members WHERE id=?").bind(memberId).first(); await enterpriseAudit(env, context, user, "member.updated", "member", memberId, before, after, request); return json(after);
  }
  if (path === "/api/enterprise/policy" && request.method === "PUT") {
    if (!canAdmin) return enterpriseForbidden(); const before = await env.DB.prepare("SELECT * FROM work_policies WHERE organization_id=? ORDER BY effective_from DESC LIMIT 1").bind(orgId).first(), timestamp = now(), values = [Math.max(0, Number(data.max_weekly_minutes ?? before?.max_weekly_minutes ?? 2700)), Math.max(0, Number(data.min_daily_rest_minutes ?? before?.min_daily_rest_minutes ?? 660)), Math.max(0, Number(data.break_after_minutes ?? before?.break_after_minutes ?? 420)), Math.max(0, Number(data.break_minutes ?? before?.break_minutes ?? 30)), Math.max(0, Number(data.overtime_alert_minutes ?? before?.overtime_alert_minutes ?? 120))];
    if (before) await env.DB.prepare("UPDATE work_policies SET max_weekly_minutes=?,min_daily_rest_minutes=?,break_after_minutes=?,break_minutes=?,overtime_alert_minutes=?,updated_at=? WHERE id=? AND organization_id=?").bind(...values, timestamp, before.id, orgId).run(); else await env.DB.prepare("INSERT INTO work_policies (id,organization_id,name,max_weekly_minutes,min_daily_rest_minutes,break_after_minutes,break_minutes,overtime_alert_minutes,effective_from,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(id(), orgId, "Standard Schweiz", ...values, timestamp.slice(0, 10), timestamp, timestamp).run();
    const after = await env.DB.prepare("SELECT * FROM work_policies WHERE organization_id=? ORDER BY effective_from DESC LIMIT 1").bind(orgId).first(); await enterpriseAudit(env, context, user, "policy.updated", "work_policy", after.id, before, after, request); return json(after);
  }
  const periodMatch = path.match(/^\/api\/enterprise\/periods\/([^/]+)\/(submit|approve|lock|reopen)$/);
  if (periodMatch && request.method === "POST") {
    const periodKey = decodeURIComponent(periodMatch[1]), transition = periodMatch[2]; if ((transition === "approve" || transition === "lock" || transition === "reopen") ? !canApprove : false) return enterpriseForbidden(); if (transition === "lock" && !canAdmin) return enterpriseForbidden();
    let period = await env.DB.prepare("SELECT * FROM time_periods WHERE organization_id=? AND period_key=?").bind(orgId, periodKey).first(); if (!period) { const timestamp=now(); await env.DB.prepare("INSERT INTO time_periods (id,organization_id,period_key,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").bind(id(),orgId,periodKey,"open",timestamp,timestamp).run(); period=await env.DB.prepare("SELECT * FROM time_periods WHERE organization_id=? AND period_key=?").bind(orgId,periodKey).first(); }
    const before = { ...period }, timestamp = now(), next = { submit: "submitted", approve: "approved", lock: "locked", reopen: "open" }[transition]; if (transition === "submit" && !["open"].includes(period.status)) return json({ error: "Nur offene Perioden können eingereicht werden." }, 409); if (transition === "approve" && period.status !== "submitted") return json({ error: "Die Periode muss zuerst eingereicht werden." }, 409); if (transition === "lock" && period.status !== "approved") return json({ error: "Nur freigegebene Perioden können gesperrt werden." }, 409);
    const columns = transition === "submit" ? "status=?,submitted_by=?,submitted_at=?" : transition === "approve" ? "status=?,approved_by=?,approved_at=?" : transition === "lock" ? "status=?,locked_at=?" : "status=?,reopened_at=?"; const args = transition === "submit" ? [next,user.id,timestamp] : transition === "approve" ? [next,user.id,timestamp] : [next,timestamp]; await env.DB.prepare(`UPDATE time_periods SET ${columns},updated_at=? WHERE id=? AND organization_id=?`).bind(...args,timestamp,period.id,orgId).run(); period=await env.DB.prepare("SELECT * FROM time_periods WHERE id=?").bind(period.id).first(); await enterpriseAudit(env, context, user, `period.${transition}`, "time_period", period.id, before, period, request); return json(period);
  }
  const approvalMatch = path.match(/^\/api\/enterprise\/approvals\/([^/]+)\/decision$/);
  if (approvalMatch && request.method === "POST") {
    if (!canApprove) return enterpriseForbidden(); const approvalId=approvalMatch[1], before=await env.DB.prepare("SELECT * FROM time_approvals WHERE id=? AND organization_id=?").bind(approvalId,orgId).first(); if(!before)return json({error:"Freigabe nicht gefunden."},404); const status=["approved","rejected","pending"].includes(data.status)?data.status:"pending", timestamp=now(); await env.DB.prepare("UPDATE time_approvals SET status=?,approver_user_id=?,comment=?,decided_at=?,updated_at=? WHERE id=? AND organization_id=?").bind(status,user.id,String(data.comment||""),status==="pending"?null:timestamp,timestamp,approvalId,orgId).run(); const after=await env.DB.prepare("SELECT * FROM time_approvals WHERE id=?").bind(approvalId).first(); await enterpriseAudit(env,context,user,`approval.${status}`,"time_approval",approvalId,before,after,request); return json(after);
  }
  if (path === "/api/enterprise/shifts" && request.method === "POST") {
    if (!canAdmin && !canApprove) return enterpriseForbidden(); if (!data.member_id || !data.shift_date || !data.start_time || !data.end_time) return json({ error: "Mitarbeitende Person, Datum, Beginn und Ende sind erforderlich." }, 400); const shiftId=id(),timestamp=now(); await env.DB.prepare("INSERT INTO planned_shifts (id,organization_id,member_id,shift_date,start_time,end_time,break_minutes,work_location,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(shiftId,orgId,data.member_id,data.shift_date,data.start_time,data.end_time,Math.max(0,Number(data.break_minutes||0)),data.work_location||"Büro",data.status||"planned",timestamp,timestamp).run(); const created=await env.DB.prepare("SELECT * FROM planned_shifts WHERE id=?").bind(shiftId).first(); await enterpriseAudit(env,context,user,"shift.created","planned_shift",shiftId,null,created,request); return json(created,201);
  }
  const integrationMatch = path.match(/^\/api\/enterprise\/integrations\/([^/]+)\/(connect|disconnect)$/);
  if (integrationMatch && request.method === "POST") {
    if (!canAdmin) return enterpriseForbidden(); const integrationType=decodeURIComponent(integrationMatch[1]), status=integrationMatch[2]==="connect"?"connected":"planned", before=await env.DB.prepare("SELECT * FROM enterprise_integrations WHERE organization_id=? AND integration_type=?").bind(orgId,integrationType).first(), timestamp=now(); if(before) await env.DB.prepare("UPDATE enterprise_integrations SET status=?,last_sync_at=?,updated_at=? WHERE id=? AND organization_id=?").bind(status,status==="connected"?timestamp:null,timestamp,before.id,orgId); else await env.DB.prepare("INSERT INTO enterprise_integrations (id,organization_id,integration_type,display_name,status,config_json,last_sync_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(id(),orgId,integrationType,String(data.display_name||integrationType),status,"{}",status==="connected"?timestamp:null,timestamp,timestamp).run(); const after=await env.DB.prepare("SELECT id,integration_type,display_name,status,last_sync_at,updated_at FROM enterprise_integrations WHERE organization_id=? AND integration_type=?").bind(orgId,integrationType).first(); await enterpriseAudit(env,context,user,`integration.${integrationMatch[2]}`,"integration",after.id,before,after,request); return json(after);
  }
  if (path === "/api/enterprise/payroll-export" && request.method === "POST") {
    if (!canAdmin && !canApprove) return enterpriseForbidden(); const periodKey=String(data.period_key||now().slice(0,7)), count=await env.DB.prepare("SELECT COUNT(*) AS count FROM entries WHERE user_id=? AND entry_date LIKE ?").bind(user.id,periodKey+"%").first(), timestamp=now(), exportId=id(); await env.DB.prepare("INSERT INTO payroll_exports (id,organization_id,period_key,format,status,row_count,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(exportId,orgId,periodKey,String(data.format||"csv"),"prepared",Number(count?.count||0),user.id,timestamp).run(); const result=await env.DB.prepare("SELECT * FROM payroll_exports WHERE id=?").bind(exportId).first(); await enterpriseAudit(env,context,user,"payroll.export-prepared","payroll_export",exportId,null,result,request); return json(result,201);
  }
  if (path === "/api/enterprise/audit" && request.method === "GET") {
    if (!canAdmin && role !== "auditor") return enterpriseForbidden(); const limit=Math.min(200,Math.max(1,Number(url.searchParams.get("limit")||50))), result=await env.DB.prepare("SELECT a.id,a.action,a.entity_type,a.entity_id,a.before_json,a.after_json,a.created_at,u.name AS actor_name FROM audit_events a LEFT JOIN users u ON u.id=a.actor_user_id WHERE a.organization_id=? ORDER BY a.created_at DESC LIMIT ?").bind(orgId,limit).all(); return json(result.results);
  }
  return json({ error: "Enterprise-Ressource nicht gefunden." }, 404);
}

async function appApi(request, env, user) {
  if (!user) return json({ error: "Anmeldung erforderlich." }, 401);
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/enterprise/")) return enterpriseApi(request, env, user);
  const path = url.pathname, data = await body(request);
  if (path === "/api/state" && request.method === "GET") {
    const row = await env.DB.prepare("SELECT payload_json,version,updated_at,updated_by_device,updated_by_label FROM user_states WHERE user_id=?").bind(user.id).first();
    if (row) {
      try {
        const stored = JSON.parse(row.payload_json), fallback = await legacyState(env, user), merged = mergeStatePayload(fallback, stored);
        return json({ state: merged, version: Number(row.version || 1), updated_at: row.updated_at, updated_by_device: row.updated_by_device || null, updated_by_label: row.updated_by_label || null, exists: true });
      }
      catch { return json({ state: {}, version: Number(row.version || 1), updated_at: row.updated_at, updated_by_device: row.updated_by_device || null, updated_by_label: row.updated_by_label || null, exists: true }); }
    }
    return json({ state: await legacyState(env, user), version: 0, updated_at: null, exists: false });
  }
  if (path === "/api/state" && request.method === "PUT") {
    if (!data.state || typeof data.state !== "object" || Array.isArray(data.state)) return json({ error: "Ungültiger Profilzustand." }, 400);
    const incomingState = Object.fromEntries(Object.entries(data.state).filter(([key, value]) => key.startsWith(syncStatePrefix) && key !== syncStatePrefix + "session" && key !== syncStatePrefix + "logged-out" && typeof value === "string" && value.length <= 600000));
    const existingRow = await env.DB.prepare("SELECT payload_json,version FROM user_states WHERE user_id=?").bind(user.id).first();
    let existingState = {};
    try { existingState = existingRow?.payload_json ? JSON.parse(existingRow.payload_json) : {}; } catch { existingState = {}; }
    if (!existingRow) existingState = await legacyState(env, user);
    const current = existingRow;
    const expected = Number(data.version || 0), currentVersion = Number(current?.version || 0);
    if (current && expected && expected !== currentVersion) {
      const latest = await env.DB.prepare("SELECT payload_json,version,updated_at FROM user_states WHERE user_id=?").bind(user.id).first();
      return json({ error: "Der Profilzustand wurde auf einem anderen Gerät geändert.", conflict: true, state: JSON.parse(latest.payload_json), version: Number(latest.version), updated_at: latest.updated_at }, 409);
    }
    const protectStaleEmpty = Boolean((current && currentVersion > 0 && expected !== currentVersion) || (!current && stateHasMeaningfulData(existingState) && !stateHasMeaningfulData(incomingState)));
    const state = mergeStatePayload(existingState, incomingState, { protectEmpty: protectStaleEmpty });
    const serialized = JSON.stringify(state);
    if (serialized.length > 1900000) return json({ error: "Der synchronisierte Profilzustand ist zu gross." }, 413);
    const nextVersion = currentVersion + 1, timestamp = now(), device = data.device && typeof data.device === "object" ? data.device : {};
    const deviceId = String(device.id || "").slice(0, 120) || null, deviceLabel = String(device.label || "").slice(0, 80) || null;
    await env.DB.prepare("INSERT INTO user_states (user_id,payload_json,version,updated_at,updated_by_device,updated_by_label) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET payload_json=excluded.payload_json,version=excluded.version,updated_at=excluded.updated_at,updated_by_device=excluded.updated_by_device,updated_by_label=excluded.updated_by_label").bind(user.id, serialized, nextVersion, timestamp, deviceId, deviceLabel).run();
    try {
      const detailStatements = structuredStateStatements(env, user, state, timestamp);
      for (let offset = 0; offset < detailStatements.length; offset += 80) await env.DB.batch(detailStatements.slice(offset, offset + 80));
    } catch (error) {
      console.error("Strukturierte Profildaten konnten nicht aktualisiert werden.", error);
    }
    return json({ ok: true, version: nextVersion, updated_at: timestamp });
  }
  if (path === "/api/bootstrap" && request.method === "GET") {
    const [entries, categories, projects, favorites, settings, calendarEvents, notes] = await Promise.all([
      env.DB.prepare("SELECT * FROM entries WHERE user_id=? ORDER BY entry_date DESC, start_time DESC LIMIT 500").bind(user.id).all(),
      env.DB.prepare("SELECT * FROM categories WHERE user_id=? ORDER BY name").bind(user.id).all(),
      env.DB.prepare("SELECT * FROM projects WHERE user_id=? ORDER BY name").bind(user.id).all(),
      env.DB.prepare("SELECT * FROM favorites WHERE user_id=? ORDER BY label").bind(user.id).all(),
      env.DB.prepare("SELECT key,value FROM settings WHERE user_id=?").bind(user.id).all(),
      env.DB.prepare("SELECT * FROM calendar_events WHERE user_id=? ORDER BY event_date,start_time").bind(user.id).all(),
      env.DB.prepare("SELECT * FROM notes WHERE user_id=? ORDER BY updated_at DESC").bind(user.id).all()
    ]);
    return json({ user: publicUser(user), entries: entries.results, categories: categories.results, projects: projects.results, favorites: favorites.results, calendar_events: calendarEvents.results, notes: notes.results, settings: Object.fromEntries(settings.results.map(x => [x.key, x.value])) });
  }
  const match = path.match(/^\/api\/(entries|categories|projects|favorites|calendar|notes)(?:\/([^/]+))?$/);
  if (match) {
    const resource = match[1], resourceId = match[2], table = resource === "calendar" ? "calendar_events" : resource;
    if (request.method === "GET") return json((await env.DB.prepare(`SELECT * FROM ${table} WHERE user_id=? ORDER BY created_at DESC`).bind(user.id).all()).results);
    if (request.method === "POST") {
      if (resource === "entries" && (!data.entry_date || !data.duration_minutes || !data.category_id || !data.project_id)) return json({ error: "Datum, Dauer, Kategorie und Projekt sind Pflichtfelder." }, 400);
      const newId = id(), timestamp = now();
      const columns = resource === "entries" ? ["id","user_id","entry_date","start_time","end_time","duration_minutes","break_minutes","category_id","project_id","description","jira_reference","notes","created_at","updated_at"] : resource === "categories" ? ["id","user_id","name","color","created_at","updated_at"] : resource === "projects" ? ["id","user_id","name","status","budget_minutes","created_at","updated_at"] : resource === "favorites" ? ["id","user_id","label","category_id","project_id","duration_minutes","created_at","updated_at"] : resource === "calendar" ? ["id","user_id","event_type","title","event_date","all_day","start_time","end_time","place","reminder_minutes","note","created_at","updated_at"] : ["id","user_id","title","content","checklist_json","color","section","archived","created_at","updated_at"];
      const values = resource === "entries" ? [newId,user.id,data.entry_date,data.start_time||null,data.end_time||null,Number(data.duration_minutes),Number(data.break_minutes||0),data.category_id,data.project_id,data.description||null,data.jira_reference||null,data.notes||null,timestamp,timestamp] : resource === "categories" ? [newId,user.id,data.name,data.color||"#1769e8",timestamp,timestamp] : resource === "projects" ? [newId,user.id,data.name,data.status||"active",Number(data.budget_minutes||0),timestamp,timestamp] : resource === "favorites" ? [newId,user.id,data.label,data.category_id||null,data.project_id||null,Number(data.duration_minutes||0),timestamp,timestamp] : resource === "calendar" ? [newId,user.id,data.event_type||"Termin",data.title,data.event_date||now().slice(0,10),data.all_day?1:0,data.start_time||null,data.end_time||null,data.place||null,Number(data.reminder_minutes||0),data.note||null,timestamp,timestamp] : [newId,user.id,data.title,data.content,data.checklist_json||"[]",data.color||"blau",data.section||"Arbeit",data.archived?1:0,timestamp,timestamp];
      await env.DB.prepare(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`).bind(...values).run();
      return json(await env.DB.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(newId).first(), 201);
    }
    if ((request.method === "PATCH" || request.method === "DELETE") && resourceId) {
      if (!await env.DB.prepare(`SELECT id FROM ${table} WHERE id=? AND user_id=?`).bind(resourceId,user.id).first()) return json({ error: "Eintrag nicht gefunden." }, 404);
      if (request.method === "DELETE") { await env.DB.prepare(`DELETE FROM ${table} WHERE id=? AND user_id=?`).bind(resourceId,user.id).run(); return json({ ok:true }); }
      const allowed = resource === "entries" ? ["entry_date","start_time","end_time","duration_minutes","break_minutes","category_id","project_id","description","jira_reference","notes"] : resource === "categories" ? ["name","color"] : resource === "projects" ? ["name","status","budget_minutes"] : resource === "favorites" ? ["label","category_id","project_id","duration_minutes"] : resource === "calendar" ? ["event_type","title","event_date","all_day","start_time","end_time","place","reminder_minutes","note"] : ["title","content","checklist_json","color","section","archived"];
      const updates = allowed.filter(k => data[k] !== undefined); if (!updates.length) return json({ error:"Keine Änderungen." },400);
      await env.DB.prepare(`UPDATE ${table} SET ${updates.map(k => `${k}=?`).join(",")},updated_at=? WHERE id=? AND user_id=?`).bind(...updates.map(k=>data[k]),now(),resourceId,user.id).run();
      return json(await env.DB.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(resourceId).first());
    }
  }
  const setting = path.match(/^\/api\/settings\/([^/]+)$/);
  if (setting && request.method === "PUT") {
    await env.DB.prepare("INSERT INTO settings (user_id,key,value,updated_at) VALUES (?,?,?,?) ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(user.id,setting[1],String(data.value ?? ""),now()).run();
    return json({ key: setting[1], value: String(data.value ?? "") });
  }
  return json({ error: "Nicht gefunden." }, 404);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return cors(request, new Response(null, { status: 204 }));
    let response;
    try {
      const url = new URL(request.url);
      // Statische App-Dateien müssen auch dann laden, wenn D1 kurzfristig
      // nicht erreichbar ist. Nur API-Anfragen benötigen das Datenbankschema.
      if (!url.pathname.startsWith("/api/") && env.ASSETS) {
        return cors(request, await env.ASSETS.fetch(request));
      }
      await ensureSchemaWithRetry(env);
      response = await auth(request, env);
      if (!response) {
        if (url.pathname.startsWith("/api/")) response = await appApi(request, env, await currentUser(request, env));
        else if (env.ASSETS) response = await env.ASSETS.fetch(request);
        else response = new Response("Professionelle Zeiterfassung", { headers: { "content-type": "text/plain; charset=utf-8" } });
      }
    } catch (error) { console.error(error); response = json({ error: "Interner Serverfehler." }, 500); }
    return cors(request, response);
  }
};