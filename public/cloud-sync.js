(() => {
  const PREFIX = "professionelle-zeiterfassung.";
  const EXCLUDED = new Set([PREFIX + "session", PREFIX + "logged-out", PREFIX + "cloud-sync"]);
  const api = () => window.ZeiterfassungAPI;
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
    if (main && (main.entries?.length || main.absences?.length || main.closedDays?.length || main.notes || main.weekdayTargets)) return true;
    return ["calendar.v1", "notes.v1", "reminders.v1", "reminders"].some(key => {
      const value = json(state[PREFIX + key]);
      return Array.isArray(value) ? value.length > 0 : value && Object.keys(value).length > 0;
    });
  };
  const mergeArray = (remote, local) => {
    const values = [...(Array.isArray(remote) ? remote : []), ...(Array.isArray(local) ? local : [])];
    const seen = new Set();
    return values.filter(value => {
      const key = value && typeof value === "object" ? value.id || JSON.stringify(value) : String(value);
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
  let applying = false, hydrated = false, pulling = false, pushing = false, timer = 0, version = 0, queued = false;
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
  const push = async () => {
    if (pushing || !hydrated || !api()?.hasSession?.()) return false;
    pushing = true;
    try {
      const result = await api().saveState(snapshot(), version);
      version = Number(result.version || version);
      queued = false;
      return true;
    } catch (error) {
      if (error.status === 409 && error.data?.state) {
        apply(error.data.state);
        version = Number(error.data.version || version);
        queued = false;
      } else queued = true;
      return false;
    } finally {
      pushing = false;
      if (queued) schedulePush();
    }
  };
  const schedulePush = () => {
    if (!hydrated || applying || !api()?.hasSession?.()) return;
    queued = true;
    clearTimeout(timer);
    timer = setTimeout(() => { timer = 0; push(); }, 650);
  };
  const pull = async () => {
    if (pulling || !api()?.hasSession?.()) return false;
    pulling = true;
    try {
      const remote = await api().getState(), local = snapshot();
      if (remote.exists) {
        apply(remote.state || {});
        version = Number(remote.version || 0);
      } else if (hasUserData(local)) {
        const initial = mergeLegacy(remote.state || {}, local);
        apply(initial);
        const saved = await api().saveState(initial, 0);
        version = Number(saved.version || 1);
      } else {
        apply(remote.state || {});
        version = 0;
      }
      hydrated = true;
      queued = false;
      return true;
    } catch (error) {
      console.warn("Profildaten konnten nicht synchronisiert werden.", error);
      return false;
    } finally { pulling = false; }
  };
  const sync = async () => {
    if (!api()?.hasSession?.()) return false;
    if (!hydrated) return pull();
    if (queued) await push();
    return pull();
  };
  if (!Storage.prototype.__zeiterfassungCloudPatched) {
    const originalSetItem = Storage.prototype.setItem, originalRemoveItem = Storage.prototype.removeItem;
    Storage.prototype.setItem = function(key, value) {
      originalSetItem.call(this, key, value);
      if (this === localStorage && syncable(key) && !applying) schedulePush();
      window.dispatchEvent(new CustomEvent("zeiterfassung-storage-changed", { detail: key }));
    };
    Storage.prototype.removeItem = function(key) {
      originalRemoveItem.call(this, key);
      if (this === localStorage && syncable(key) && !applying) schedulePush();
      window.dispatchEvent(new CustomEvent("zeiterfassung-storage-changed", { detail: key }));
    };
    Storage.prototype.__zeiterfassungCloudPatched = true;
    Storage.prototype.__zeiterfassungPatched = true;
  }
  window.addEventListener("zeiterfassung-auth-changed", () => { hydrated = false; version = 0; sync(); });
  window.addEventListener("storage", event => { if (syncable(event.key)) schedulePush(); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => sync()); else sync();
  setInterval(() => { if (api()?.hasSession?.()) sync(); }, 30000);
  window.ZeiterfassungCloudSync = { pull, push, sync };
})();
