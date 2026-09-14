(() => {
  const PREFIX = "professionelle-zeiterfassung.";
  const SNAPSHOT_MARKER = PREFIX + "sync-complete.v1";
  const EXCLUDED = new Set([PREFIX + "session", PREFIX + "logged-out", PREFIX + "cloud-sync", PREFIX + "device-id", PREFIX + "device-label"]);
  const PUSH_DELAY = 250;
  const POLL_INTERVAL = 5000;
  const RETRY_DELAYS = [1000, 3000, 8000, 15000];
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
  const newId = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const withStableId = value => {
    if (!value || typeof value !== "object" || Array.isArray(value) || value.id) return value;
    return { ...value, id: newId() };
  };
  const normalizeArrays = value => {
    if (Array.isArray(value)) return value.map(item => withStableId(normalizeArrays(item)));
    if (value && typeof value === "object") {
      const copy = { ...value };
      Object.keys(copy).forEach(key => { if (copy[key] && typeof copy[key] === "object") copy[key] = normalizeArrays(copy[key]); });
      return copy;
    }
    return value;
  };
  const normalizeSerialized = raw => {
    const parsed = json(raw);
    if (parsed === null) return raw;
    return JSON.stringify(normalizeArrays(parsed));
  };
  // Device-local notification bookkeeping must never enter the cloud snapshot.
  const NOTICE_KEY = "zeiterfassung-last-remote-notice.v1";
  const canonical = value => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
    return value;
  };
  const stateContent = state => JSON.stringify(canonical(Object.fromEntries(
    Object.entries(state || {}).filter(([key]) => syncable(key) && key !== SNAPSHOT_MARKER)
      .map(([key, value]) => [key, typeof value === "string" ? json(value) ?? value : value])
  )));
  let lastRemoteContent = null;
  const snapshot = () => {
    const result = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!syncable(key)) continue;
      const raw = localStorage.getItem(key) || "";
      const normalized = normalizeSerialized(raw);
      if (normalized !== raw) localStorage.setItem(key, normalized);
      result[key] = normalized;
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
    const values = [...(Array.isArray(remote) ? remote : []), ...(Array.isArray(local) ? local : [])].map(withStableId);
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
  // Rebase only local changes onto the last acknowledged server snapshot.
  // Missing IDs in a locally edited list are intentional deletions.
  const sameValue = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
  const rebaseValue = (base, local, remote) => {
    if (sameValue(base, local)) return remote;
    if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote)) {
      const key = value => value && typeof value === "object" ? value.id : typeof value + ":" + String(value);
      if ([...base, ...local, ...remote].some(value => key(value) == null)) return local;
      const b = new Map(base.map(value => [key(value), value]));
      const l = new Map(local.map(value => [key(value), value]));
      const result = new Map(remote.map(value => [key(value), value]));
      for (const id of b.keys()) if (!l.has(id)) result.delete(id);
      for (const [id, value] of l) {
        if (!b.has(id) || !sameValue(b.get(id), value)) result.set(id, value);
      }
      return [...result.values()];
    }
    if (base && local && remote && !Array.isArray(base) && !Array.isArray(local) && !Array.isArray(remote) &&
        typeof base === "object" && typeof local === "object" && typeof remote === "object") {
      const result = { ...remote };
      for (const key of new Set([...Object.keys(base), ...Object.keys(local)])) {
        if (!(key in local)) delete result[key];
        else if (!sameValue(base[key], local[key])) result[key] = rebaseValue(base[key], local[key], remote[key]);
      }
      return result;
    }
    return local;
  };
  const rebaseState = (base, local, remote) => {
    const decode = state => Object.fromEntries(Object.entries(state || {}).map(([key, value]) => [key, json(value) ?? value]));
    const result = rebaseValue(decode(base), decode(local), decode(remote));
    return Object.fromEntries(Object.entries(result).map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)]));
  };
  let acknowledgedState = null;
  let applying = false, hydrated = false, pulling = false, pushing = false, syncing = false;
  let timer = 0, retryTimer = 0, retryAttempt = 0, version = 0, queued = false, localRevision = 0;
  const status = (state, detail = {}) => window.dispatchEvent(new CustomEvent("zeiterfassung-sync-status", { detail: { state, version, ...detail } }));
  const scheduleRetry = () => {
    if (retryTimer || !api()?.hasSession?.() || document.hidden) return;
    const delay = RETRY_DELAYS[Math.min(retryAttempt, RETRY_DELAYS.length - 1)];
    retryAttempt = Math.min(retryAttempt + 1, RETRY_DELAYS.length - 1);
    retryTimer = setTimeout(async () => {
      retryTimer = 0;
      const success = await sync();
      if (!success) scheduleRetry();
    }, delay);
  };
  const clearRetry = () => { retryAttempt = 0; clearTimeout(retryTimer); retryTimer = 0; };
  const apply = state => {
    applying = true;
    try {
      const current = snapshot();
      if (state?.[SNAPSHOT_MARKER] === "1") Object.keys(current).filter(key => !(key in state)).forEach(key => localStorage.removeItem(key));
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
    if (pushing || pulling || !hydrated || !api()?.hasSession?.()) return false;
    pushing = true;
    const revisionAtStart = localRevision, payload = { ...snapshot(), [SNAPSHOT_MARKER]: "1" };
    status("syncing");
    try {
      const result = await api().saveState(payload, version, device());
      version = Number(result.version || version);
      lastRemoteContent = stateContent(payload);
      acknowledgedState = payload;
      if (localRevision === revisionAtStart) queued = false;
      else schedulePush();
      clearRetry();
      status("saved", { updatedAt: result.updated_at || null });
      return true;
    } catch (error) {
      if (error.status === 409 && error.data?.state) {
        const latest = acknowledgedState ? rebaseState(acknowledgedState, snapshot(), error.data.state) : mergeLegacy(error.data.state, snapshot());
        acknowledgedState = error.data.state;
        apply(latest);
        version = Number(error.data.version || version);
        queued = JSON.stringify(latest) !== JSON.stringify(error.data.state);
        status("conflict-resolved", { updatedAt: error.data.updated_at || null });
        if (queued) schedulePush();
      } else {
        queued = true;
        status("retry", { message: error.message });
        scheduleRetry();
      }
      return false;
    } finally {
      pushing = false;
      if (queued && localRevision !== revisionAtStart) schedulePush();
    }
  };
  const pull = async () => {
    if (pulling || pushing || (hydrated && queued) || !api()?.hasSession?.()) return false;
    pulling = true;
    const revisionAtStart = localRevision, wasHydrated = hydrated;
    status("syncing");
    try {
      const remote = await api().getState(), local = snapshot(), changedDuringRequest = localRevision !== revisionAtStart, previousVersion = version;
      if (remote.exists) {
        version = Number(remote.version || 0);
        const remoteContent = stateContent(remote.state);
        const changedOnOtherDevice = wasHydrated && version > previousVersion && remote.updated_by_device && remote.updated_by_device !== device().id && lastRemoteContent !== remoteContent;
        lastRemoteContent = remoteContent;
        const remoteState = remote.state || {};
        if (queued || changedDuringRequest) {
          const merged = acknowledgedState ? rebaseState(acknowledgedState, local, remoteState) : mergeLegacy(remoteState, local);
          apply(merged);
          queued = stateContent(merged) !== stateContent(remoteState);
        } else if (!wasHydrated && remoteState[SNAPSHOT_MARKER] !== "1" && hasUserData(local)) {
          const merged = mergeLegacy(remoteState, local);
          apply(merged);
          queued = stateContent(merged) !== stateContent(remoteState);
        } else {
          apply({ ...remoteState, [SNAPSHOT_MARKER]: "1" });
          queued = false;
        }
        acknowledgedState = remoteState;
        if (changedOnOtherDevice) await notifyRemoteChange(remote.updated_by_label || "einem anderen Gerät", remote.updated_at, remoteContent);
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
        if (hasUserData(remote.state || {})) {
          const canonical = await api().saveState(snapshot(), 0, device());
          version = Number(canonical.version || 1);
        }
      }
      hydrated = true;
      if (queued) schedulePush();
      clearRetry();
      status("ready", { updatedAt: remote.updated_at || null });
      return true;
    } catch (error) {
      status("retry", { message: error.message });
      scheduleRetry();
      console.warn("Profildaten konnten nicht synchronisiert werden.", error);
      return false;
    } finally { pulling = false; if (queued && hydrated) schedulePush(); }
  };
  const notifyRemoteChange = async (label, updatedAt, content) => {
    // Hash content so the local marker contains no profile data.
    const bytes = new TextEncoder().encode(content);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    const showOnce = () => {
      if (localStorage.getItem(NOTICE_KEY) === fingerprint) return;
      localStorage.setItem(NOTICE_KEY, fingerprint);
      showRemoteNotice(label, updatedAt);
    };
    if (navigator.locks?.request) await navigator.locks.request(NOTICE_KEY, showOnce);
    else showOnce();
  };
  const showRemoteNotice = (label, updatedAt) => {
    const detail = { label, updatedAt: updatedAt || null };
    window.dispatchEvent(new CustomEvent("zeiterfassung-remote-change", { detail }));
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        const notification = new Notification("Profildaten aktualisiert", { body: `Daten wurden auf ${label} angepasst. Jetzt aktualisieren?`, tag: "zeiterfassung-remote-change", renotify: false });
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
      if (this.getItem(key) === String(value)) return;
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
  window.addEventListener("zeiterfassung-auth-changed", () => { clearTimeout(timer); hydrated = false; version = 0; queued = false; acknowledgedState = null; lastRemoteContent = null; localStorage.removeItem(NOTICE_KEY); localRevision += 1; sync(); });
  window.addEventListener("storage", event => { if (syncable(event.key)) sync(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) sync(); });
  window.addEventListener("focus", () => sync());
  window.addEventListener("pageshow", () => sync());
  window.addEventListener("online", () => sync());
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => sync()); else sync();
  setInterval(() => { if (api()?.hasSession?.() && !document.hidden) sync(); }, POLL_INTERVAL);
  window.ZeiterfassungCloudSync = { pull, push, sync, requestNotifications, device: device() };
})();
