const API_BASE = window.TIME_TRACKING_API_BASE || "";
const SESSION_KEY = "professionelle-zeiterfassung.session";

function sessionToken() { return localStorage.getItem(SESSION_KEY) || ""; }
async function apiRequest(path, options = {}) {
  const headers = { "content-type": "application/json", ...(options.headers || {}) };
  const token = sessionToken();
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Die Anfrage konnte nicht ausgeführt werden.");
  return data;
}

window.ZeiterfassungAPI = {
  async register(name, email, password) { const data = await apiRequest("/api/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) }); localStorage.setItem(SESSION_KEY, data.token); return data; },
  async login(email, password) { const data = await apiRequest("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); localStorage.setItem(SESSION_KEY, data.token); return data; },
  async logout() { await apiRequest("/api/auth/logout", { method: "POST" }).catch(() => {}); localStorage.removeItem(SESSION_KEY); },
  me() { return apiRequest("/api/auth/me"); },
  bootstrap() { return apiRequest("/api/bootstrap"); },
  list(resource) { return apiRequest(`/api/${resource}`); },
  create(resource, payload) { return apiRequest(`/api/${resource}`, { method: "POST", body: JSON.stringify(payload) }); },
  update(resource, resourceId, payload) { return apiRequest(`/api/${resource}/${resourceId}`, { method: "PATCH", body: JSON.stringify(payload) }); },
  remove(resource, resourceId) { return apiRequest(`/api/${resource}/${resourceId}`, { method: "DELETE" }); },
  saveSetting(key, value) { return apiRequest(`/api/settings/${encodeURIComponent(key)}`, { method: "PUT", body: JSON.stringify({ value }) }); },
  enterpriseBootstrap() { return apiRequest("/api/enterprise/bootstrap"); },
  enterpriseUpdate(path, payload) { return apiRequest(`/api/enterprise/${path}`, { method: "PUT", body: JSON.stringify(payload) }); },
  enterpriseCreate(path, payload) { return apiRequest(`/api/enterprise/${path}`, { method: "POST", body: JSON.stringify(payload) }); },
  enterpriseUpdateResource(path, payload) { return apiRequest(`/api/enterprise/${path}`, { method: "PATCH", body: JSON.stringify(payload) }); },
  hasSession() { return Boolean(sessionToken()); }
};

document.dispatchEvent(new CustomEvent("zeiterfassung-api-ready"));
