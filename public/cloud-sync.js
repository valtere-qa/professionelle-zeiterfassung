(() => {
  const PREFIX = "professionelle-zeiterfassung.";
  const EXCLUDED = new Set([PREFIX + "session", PREFIX + "logged-out", PREFIX + "cloud-sync", PREFIX + "device-id", PREFIX + "device-label"]);
  const PUSH_DELAY = 250;
  const POLL_INTERVAL = 5000;
  const api = () => window.ZeiterfassungAPI;
  const deviceId = () => {
    const key = PREFIX + "device-id";
    let value = localStorage.getItem(key);
    if (!value) { value = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`; localStorage.setItem(key, value); }
    return value;
  };
  const deviceLabel = () => {
    const key = PREFIX + "device-label";
    let value = localStorage.getItem(key);
    if (!value) {
      const ua = navigator.userAgent || "";
      value = /SM-A55/i.test(ua) ? "Samsung A55" : /Android/i.test(ua) ? "Android-Gerät" : /iPhone|iPad/i.test(ua) ? "Apple-Gerät" : navigator.platform || "Browser";
      localStorage.setItem(key, value);
    }
    return value;
  };
  const device = () => ({ id: deviceId(), label: deviceLabel() });
  const syncable = key => typeof key === "string" && key.startsWith(PREFIX) && !EXCLUDED.has(key);
  const json = value => { try { return JSON.parse(value); } catch { return null; } };
  const snapshot = () => {
    const result = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (syncable(key)) result[key] = localStorage.getItem(key) || "";
    }
    return result;
  };
  const hasUserData = state => {
    const main = json(state[PREFIX + "v2"]);
    if (main && (main.entries?.length || main.categories?.length || main.projects?.length || main.favorites?.length || main.absences?.length || main.closedDays?.length || main.notes || main.weekdayTargets)) return true;
    return ["calendar.v1", "notes.v1", "reminders.v1", "reminders"].some(key => {
      const value = json(state[PREFIX + key]);
      return Array.isArray(value) ? value.length > 0 : value && Object.keys(value).length > 0;
    });
  };
  const mergeArray = (remote, local) => {
    const values = [...(Array.isArray(remote) ? remote : []), ...(Array.isArray(local) ? local : [])];
    const seen = new Set();
    return values.filter(value => {
      const key = value && typeof value === "object" ? value.id || (value.name ? "name:" + value.name : value.label ? "label:" + value.label : JSON.stringify(value)) : String(value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const mergeLegacy = (remote, local) => {
    const merged = { ...remote, ...local };
    const mainKey = PREFIX + "v2", remoteMain = json(remote[mainKey]), localMain = json(local[mainKey]);
    if (remoteMain && localMain && typeof remoteMain === "object" && typeof localMain === "object") {
      const main = { ...remoteMain, ...localMain };
      ["entries", "categories", "projects", "favorites", "absences", "closedDays"].forEach(key => {
        if (remoteMain[key] || localMain[key]) main[key] = mergeArray(remoteMain[key], localMain[key]);
      });
      merged[mainKey] = JSON.stringify(main);
    }
    ["calendar.v1", "notes.v1"].forEach(key => {
      const fullKey = PREFIX + key, r = json(remote[fullKey]), l = json(local[fullKey]);
      if (r || l) merged[fullKey] = JSON.stringify(mergeArray(r, l));
    });
    return merged;
  };
  let applying = false, hydrated = false, pulling = false, pushing = false, syncing = false;
  let timer = 0, version = 0, queued = false, localRevision = 0;
  const status = (state, detail = {}) => window.dispatchEvent(new CustomEvent("zeiterfassung-sync-status", { detail: { state, version, ...detail } }));
  const apply = state => {
    applying = true;
    try {
      const current = snapshot();
      Object.keys(current).filter(key => !(key in state)).forEach(key => localStorage.removeItem(key));
      Object.entries(state || {}).forEach(([key, value]) => {
        if (syncable(key)) localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
      });
    } finally { applying = false; }
    window.dispatchEvent(new CustomEvent("zeiterfassung-cloud-hydrated"));
  };
  const schedulePush = (immediate = false) => {
    queued = true;
    clearTimeout(timer);
    if (!hydrated || applying || !api()?.hasSession?.()) return;
    timer = setTimeout(() => { timer = 0; push(); }, immediate ? 0 : PUSH_DELAY);
  };
  const push = async () => {
    if (pushing || !hydrated || !api()?.hasSession?.()) return false;
    pushing = true;
    const revisionAtStart = localRevision, payload = snapshot();
    status("syncing");
    try {
      const result = await api().saveState(payload, version, device());
      version = Number(result.version || version);
      if (localRevision === revisionAtStart) queued = false;
      else schedulePush();
      status("saved", { updatedAt: result.updated_at || null });
      return true;
    } catch (error) {
      if (error.status === 409 && error.data?.state) {
        const latest = mergeLegacy(error.data.state, snapshot());
        apply(latest);
        version = Number(error.data.version || version);
        queued = JSON.stringify(latest) !== JSON.stringify(error.data.state);
        status("conflict-resolved", { updatedAt: error.data.updated_at || null });
      } else {
        queued = true;
        status("retry", { message: error.message });
      }
      return false;
    } finally {
      pushing = false;
      if (queued) schedulePush();
    }
  };
  const pull = async () => {
    if (pulling || !api()?.hasSession?.()) return false;
    pulling = true;
    const revisionAtStart = localRevision, wasHydrated = hydrated;
    status("syncing");
    try {
      const remote = await api().getState(), local = snapshot(), changedDuringRequest = localRevision !== revisionAtStart, previousVersion = version;
      if (remote.exists) {
        version = Number(remote.version || 0);
        const changedOnOtherDevice = wasHydrated && version > previousVersion && remote.updated_by_device && remote.updated_by_device !== device().id;
        if (changedDuringRequest && wasHydrated) {
          queued = true;
        } else if (changedDuringRequest) {
          apply(mergeLegacy(remote.state || {}, local));
          queued = true;
        } else if (!wasHydrated && hasUserData(local)) {
          const merged = mergeLegacy(remote.state || {}, local);
          apply(merged);
          queued = JSON.stringify(merged) !== JSON.stringify(remote.state || {});
        } else {
          apply(remote.state || {});
          queued = false;
        }
        if (changedOnOtherDevice) notifyRemoteChange(remote.updated_by_label || "einem anderen Gerät", remote.updated_at);
      } else if (hasUserData(local)) {
        const initial = mergeLegacy(remote.state || {}, local);
        apply(initial);
        const saved = await api().saveState(snapshot(), 0, device());
        version = Number(saved.version || 1);
        queued = false;
      } else {
        apply(remote.state || {});
        version = 0;
        queued = false;
      }
      hydrated = true;
      if (queued) schedulePush();
      status("ready", { updatedAt: remote.updated_at || null });
      return true;
    } catch (error) {
      status("retry", { message: error.message });
      console.warn("Profildaten konnten nicht synchronisiert werden.", error);
      return false;
    } finally { pulling = false; }
  };
  const notifyRemoteChange = (label, updatedAt) => {
    const detail = { label, updatedAt: updatedAt || null };
    window.dispatchEvent(new CustomEvent("zeiterfassung-remote-change", { detail }));
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        const notification = new Notification("Profildaten aktualisiert", { body: `Daten wurden auf ${label} angepasst. Jetzt aktualisieren?`, tag: "zeiterfassung-remote-change" });
        notification.onclick = () => { window.focus(); sync(); notification.close(); };
      } catch { /* Browser blockiert lokale Benachrichtigungen. */ }
    }
  };
  const requestNotifications = async () => {
    if (typeof Notification === "undefined") return "unsupported";
    try { return await Notification.requestPermission(); } catch { return "denied"; }
  };
  const sync = async () => {
    if (syncing || !api()?.hasSession?.()) return false;
    syncing = true;
    try {
      if (!hydrated) return await pull();
      if (queued) await push();
      return await pull();
    } finally { syncing = false; }
  };
  if (!Storage.prototype.__zeiterfassungCloudPatched) {
    const originalSetItem = Storage.prototype.setItem, originalRemoveItem = Storage.prototype.removeItem;
    Storage.prototype.setItem = function(key, value) {
      originalSetItem.call(this, key, value);
      if (this === localStorage && syncable(key) && !applying) { localRevision += 1; schedulePush(); }
      window.dispatchEvent(new CustomEvent("zeiterfassung-storage-changed", { detail: key }));
    };
    Storage.prototype.removeItem = function(key) {
      originalRemoveItem.call(this, key);
      if (this === localStorage && syncable(key) && !applying) { localRevision += 1; schedulePush(); }
      window.dispatchEvent(new CustomEvent("zeiterfassung-storage-changed", { detail: key }));
    };
    Storage.prototype.__zeiterfassungCloudPatched = true;
    Storage.prototype.__zeiterfassungPatched = true;
  }
  window.addEventListener("zeiterfassung-auth-changed", () => { clearTimeout(timer); hydrated = false; version = 0; queued = false; localRevision += 1; sync(); });
  window.addEventListener("storage", event => { if (syncable(event.key)) sync(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) sync(); });
  window.addEventListener("focus", () => sync());
  window.addEventListener("pageshow", () => sync());
  window.addEventListener("online", () => sync());
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => sync()); else sync();
  setInterval(() => { if (api()?.hasSession?.() && !document.hidden) sync(); }, POLL_INTERVAL);
  window.ZeiterfassungCloudSync = { pull, push, sync, requestNotifications, device: device() };
})();
