const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extra } });
}

function cors(request, response) {
  const origin = request.headers.get("Origin");
  const allowed = origin && (origin.endsWith(".pages.dev") || origin.includes("chatgpt.site") || origin.includes("localhost")) ? origin : "*";
  const headers = new Headers(response.headers);
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

async function auth(request, env) {
  const url = new URL(request.url), data = await body(request);
  if (url.pathname === "/api/auth/register" && request.method === "POST") {
    if (!data.email || !data.password || !data.name) return json({ error: "Name, E-Mail und Passwort sind erforderlich." }, 400);
    if (String(data.password).length < 8) return json({ error: "Das Passwort muss mindestens 8 Zeichen enthalten." }, 400);
    const email = String(data.email).toLowerCase();
    if (await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first()) return json({ error: "Diese E-Mail-Adresse ist bereits registriert." }, 409);
    const userId = id(), rawToken = token(), timestamp = now();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO users (id,email,password_hash,name,created_at) VALUES (?,?,?,?,?)").bind(userId, email, await hash(data.password), data.name, timestamp),
      env.DB.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)").bind(id(), userId, await hash(rawToken), new Date(Date.now() + 30 * 864e5).toISOString(), timestamp)
    ]);
    return json({ user: publicUser(await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(userId).first()), token: rawToken }, 201);
  }
  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    const user = await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(String(data.email || "").toLowerCase()).first();
    if (!user || user.password_hash !== await hash(data.password || "")) return json({ error: "E-Mail oder Passwort ist falsch." }, 401);
    const rawToken = token();
    await env.DB.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)").bind(id(), user.id, await hash(rawToken), new Date(Date.now() + 30 * 864e5).toISOString(), now()).run();
    return json({ user: publicUser(user), token: rawToken });
  }
  if (url.pathname === "/api/auth/me" && request.method === "GET") return json({ user: publicUser(await currentUser(request, env)) });
  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    const header = request.headers.get("Authorization") || "";
    if (header.startsWith("Bearer ")) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await hash(header.slice(7))).run();
    return json({ ok: true });
  }
  return null;
}

async function appApi(request, env, user) {
  if (!user) return json({ error: "Anmeldung erforderlich." }, 401);
  const url = new URL(request.url), path = url.pathname, data = await body(request);
  if (path === "/api/bootstrap" && request.method === "GET") {
    const [entries, categories, projects, favorites, settings] = await Promise.all([
      env.DB.prepare("SELECT * FROM entries WHERE user_id=? ORDER BY entry_date DESC, start_time DESC LIMIT 500").bind(user.id).all(),
      env.DB.prepare("SELECT * FROM categories WHERE user_id=? ORDER BY name").bind(user.id).all(),
      env.DB.prepare("SELECT * FROM projects WHERE user_id=? ORDER BY name").bind(user.id).all(),
      env.DB.prepare("SELECT * FROM favorites WHERE user_id=? ORDER BY label").bind(user.id).all(),
      env.DB.prepare("SELECT key,value FROM settings WHERE user_id=?").bind(user.id).all()
    ]);
    return json({ user: publicUser(user), entries: entries.results, categories: categories.results, projects: projects.results, favorites: favorites.results, settings: Object.fromEntries(settings.results.map(x => [x.key, x.value])) });
  }
  const match = path.match(/^\/api\/(entries|categories|projects|favorites)(?:\/([^/]+))?$/);
  if (match) {
    const resource = match[1], resourceId = match[2], table = resource;
    if (request.method === "GET") return json((await env.DB.prepare(`SELECT * FROM ${table} WHERE user_id=? ORDER BY created_at DESC`).bind(user.id).all()).results);
    if (request.method === "POST") {
      if (resource === "entries" && (!data.entry_date || !data.duration_minutes || !data.category_id || !data.project_id)) return json({ error: "Datum, Dauer, Kategorie und Projekt sind Pflichtfelder." }, 400);
      const newId = id(), timestamp = now();
      const columns = resource === "entries" ? ["id","user_id","entry_date","start_time","end_time","duration_minutes","break_minutes","category_id","project_id","description","jira_reference","notes","created_at","updated_at"] : resource === "categories" ? ["id","user_id","name","color","created_at","updated_at"] : resource === "projects" ? ["id","user_id","name","status","budget_minutes","created_at","updated_at"] : ["id","user_id","label","category_id","project_id","duration_minutes","created_at","updated_at"];
      const values = resource === "entries" ? [newId,user.id,data.entry_date,data.start_time||null,data.end_time||null,Number(data.duration_minutes),Number(data.break_minutes||0),data.category_id,data.project_id,data.description||null,data.jira_reference||null,data.notes||null,timestamp,timestamp] : resource === "categories" ? [newId,user.id,data.name,data.color||"#1769e8",timestamp,timestamp] : resource === "projects" ? [newId,user.id,data.name,data.status||"active",Number(data.budget_minutes||0),timestamp,timestamp] : [newId,user.id,data.label,data.category_id||null,data.project_id||null,Number(data.duration_minutes||0),timestamp,timestamp];
      await env.DB.prepare(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`).bind(...values).run();
      return json(await env.DB.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(newId).first(), 201);
    }
    if ((request.method === "PATCH" || request.method === "DELETE") && resourceId) {
      if (!await env.DB.prepare(`SELECT id FROM ${table} WHERE id=? AND user_id=?`).bind(resourceId,user.id).first()) return json({ error: "Eintrag nicht gefunden." }, 404);
      if (request.method === "DELETE") { await env.DB.prepare(`DELETE FROM ${table} WHERE id=? AND user_id=?`).bind(resourceId,user.id).run(); return json({ ok:true }); }
      const allowed = resource === "entries" ? ["entry_date","start_time","end_time","duration_minutes","break_minutes","category_id","project_id","description","jira_reference","notes"] : resource === "categories" ? ["name","color"] : resource === "projects" ? ["name","status","budget_minutes"] : ["label","category_id","project_id","duration_minutes"];
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
      response = await auth(request, env);
      if (!response) {
        const url = new URL(request.url);
        if (url.pathname.startsWith("/api/")) response = await appApi(request, env, await currentUser(request, env));
        else if (env.ASSETS) response = await env.ASSETS.fetch(request);
        else response = new Response("Professionelle Zeiterfassung", { headers: { "content-type": "text/plain; charset=utf-8" } });
      }
    } catch (error) { console.error(error); response = json({ error: "Interner Serverfehler." }, 500); }
    return cors(request, response);
  }
};
