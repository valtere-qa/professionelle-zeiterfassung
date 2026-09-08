const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { resolve, basename } = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const publicDir = resolve(__dirname, '../public');
const html = readFileSync(resolve(publicDir, 'index.html'), 'utf8');
const STORE = 'professionelle-zeiterfassung.v2';
const NOTES = 'professionelle-zeiterfassung.notes.v1';
const routes = {
  overview: 'Übersicht', entries: 'Einträge', week: 'Woche', stats: 'Auswertung',
  calendar: 'Kalender', notes: 'Notizen', categories: 'Kategorien',
  favorites: 'Favoriten', settings: 'Einstellungen', help: 'Hilfe'
};

// Execute the actual delivered HTML and all its scripts. Network and scrolling
// are recorded, never sent to a real account. jsdom does not perform layout.
async function app(t, hash = '', seed = {}) {
  const errors = [], requests = [], scrolls = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(html, {
    url: 'https://routing-test.invalid/' + hash,
    runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: console
  });
  const { window } = dom;
  t.after(() => {
    window.close();
    assert.deepEqual(errors, [], 'No uncaught app errors during initialization or navigation');
  });
  window.fetch = async (url, options = {}) => {
    requests.push({ url, method: options.method || 'GET' });
    return { ok: false, json: async () => ({ error: 'Not authenticated (test)' }) };
  };
  window.scrollTo = options => scrolls.push({ type: 'window', ...options });
  window.HTMLElement.prototype.scrollIntoView = function(options) {
    scrolls.push({ type: 'element', id: this.id, ...options });
  };
  window.matchMedia = () => ({ matches: false });
  for (const [key, value] of Object.entries(seed)) window.localStorage.setItem(key, JSON.stringify(value));
  for (const script of window.document.querySelectorAll('script')) {
    const code = script.src
      ? readFileSync(resolve(publicDir, basename(new URL(script.src).pathname)), 'utf8')
      : script.textContent;
    window.eval(code);
  }
  await new Promise(done => window.addEventListener('load', done, { once: true }));
  await tick();
  const $ = selector => window.document.querySelector(selector);
  return { window, $, scrolls, requests, click: view => $(`.nav [data-view="${view}"] i`).click() };
}

const tick = () => new Promise(done => setTimeout(done, 15));
function assertView(a, view) {
  const { window, $ } = a;
  assert.equal(window.location.hash, '#' + view);
  assert.equal(window.document.title, 'Professionelle Zeiterfassung · ' + routes[view]);
  assert.equal($('.nav .active')?.dataset.view, view);
  assert.equal(window.document.querySelectorAll('.nav [aria-current="page"]').length, 1);
  assert.equal($('#dynamic').hidden, view === 'overview');
  assert.equal(Boolean($('.work').closest('[hidden]')), view !== 'overview',
    'The dashboard must not remain above the selected page');
  if (view !== 'overview') {
    assert.ok($('#dynamic').textContent.trim().length, 'Selected page is rendered');
    assert.equal($('#dynamic').getAttribute('aria-label'), routes[view]);
  }
}

test('Every sidebar route replaces the dashboard synchronously', async t => {
  const a = await app(t);
  for (const view of [...Object.keys(routes).slice(1), 'overview']) {
    a.click(view);
    assertView(a, view); // No timeout, refresh or second click allowed.
  }
  assert.equal(a.requests.filter(r => r.method !== 'GET').length, 0);
});

for (const view of Object.keys(routes)) {
  test('Deep link opens ' + view + ' directly', async t => assertView(await app(t, '#' + view), view));
}

test('Empty, unknown and mixed-case hashes are canonicalized without adding history entries', async t => {
  for (const hash of ['', '#not-a-route', '#CALENDAR']) {
    const a = await app(t, hash);
    assertView(a, hash === '#CALENDAR' ? 'calendar' : 'overview');
    assert.equal(a.window.history.length, 1);
  }
});

test('Repeated clicks keep the current note draft and do not add history or scrolling', async t => {
  const a = await app(t, '#notes', { [NOTES]: [{ id: 'n1', title: 'Testnotiz', content: 'Inhalt', color: 'blau', section: 'Arbeit', tasks: [] }] });
  const editor = a.$('#activeNoteTitle');
  editor.value = 'Noch nicht gespeicherter Entwurf';
  const count = a.window.history.length, scrollCount = a.scrolls.length;
  a.click('notes');
  assert.equal(a.$('#activeNoteTitle'), editor);
  assert.equal(editor.value, 'Noch nicht gespeicherter Entwurf');
  assert.equal(a.window.history.length, count);
  assert.equal(a.scrolls.length, scrollCount);
});

test('Back and forward restore the selected page exactly once', async t => {
  const a = await app(t, '#overview');
  a.click('calendar');
  a.click('notes');
  const travel = method => new Promise((done, reject) => {
    const timeout = setTimeout(() => reject(new Error('No popstate received')), 1000);
    a.window.addEventListener('popstate', () => { clearTimeout(timeout); done(); }, { once: true });
    a.window.history[method]();
  });
  await travel('back');
  await tick();
  assertView(a, 'calendar');
  const currentPanel = a.$('#dynamic').firstElementChild;
  a.window.dispatchEvent(new a.window.HashChangeEvent('hashchange'));
  assert.equal(a.$('#dynamic').firstElementChild, currentPanel, 'Duplicate history events must not rebuild the page');
  await travel('forward');
  await tick();
  assertView(a, 'notes');
});

test('Manually changing the hash displays the new route', async t => {
  const a = await app(t, '#overview');
  a.window.location.hash = '#settings';
  await tick();
  assertView(a, 'settings');
});

test('Time capture action opens the overview before focusing its form', async t => {
  const a = await app(t, '#calendar');
  a.$('#focus').click();
  assertView(a, 'overview');
  assert.equal(a.window.document.activeElement.id, 'description');
  assert.equal(a.scrolls.at(-1)?.id, 'capture');
});

test('Navigation starts the page at the top without smooth scrolling', async t => {
  const a = await app(t, '#overview');
  a.click('settings');
  assert.equal(a.scrolls.at(-1)?.top, 0);
  assert.equal(a.scrolls.at(-1)?.behavior, 'instant');
  assert.equal(a.scrolls.some(s => s.type === 'element'), false, 'No legacy scroll to a panel beneath the dashboard');
  assert.ok(a.$('#dynamic').contains(a.window.document.activeElement), 'Focus is in the selected page');
});

test('Storage refresh updates the current page without reverting its route', async t => {
  const a = await app(t, '#entries');
  a.window.localStorage.setItem(STORE, JSON.stringify({ entries: [{ date: '2026-09-07', minutes: 30, category: 'Testing', project: 'Intern', description: 'Neue Buchung' }] }));
  a.window.ZeiterfassungRefresh();
  assertView(a, 'entries');
  assert.match(a.$('#stableRows').textContent, /Neue Buchung/);
  await tick();
  assertView(a, 'entries');
});

test('Pending refresh cannot reopen the previous route after a fast click', async t => {
  const a = await app(t, '#entries');
  a.window.localStorage.setItem(STORE, JSON.stringify({ entries: [] }));
  a.click('calendar');
  const content = a.$('#dynamic').firstElementChild;
  await tick();
  assertView(a, 'calendar');
  assert.equal(a.$('#dynamic').firstElementChild, content);
});

test('Work framework switches between day and week without changing the page route', async t => {
  const a = await app(t, '#overview');
  const toggles = a.window.document.querySelectorAll('.work-head .seg button');
  toggles[1].click();
  assert.equal(a.$('.work').classList.contains('week-mode'), true);
  assert.equal(toggles[1].getAttribute('aria-pressed'), 'true');
  assertView(a, 'overview');
  toggles[0].click();
  assert.equal(a.$('.work').classList.contains('week-mode'), false);
});

test('Hidden overview and route panels cannot be re-enabled by display CSS', async t => {
  const a = await app(t, '#calendar');
  assert.equal(a.window.getComputedStyle(a.$('#overviewView')).display, 'none');
  a.click('overview');
  assert.equal(a.window.getComputedStyle(a.$('#dynamic')).display, 'none');
});

test('Routing preserves saved time, calendar and note data', async t => {
  const data = { [STORE]: { entries: [], daily: '8h 00' }, [NOTES]: [{ id: 'n1', title: 'Unverändert', content: 'Inhalt', tasks: [] }] };
  const a = await app(t, '#overview', data);
  for (const view of Object.keys(routes)) a.click(view);
  for (const [key, value] of Object.entries(data)) assert.deepEqual(JSON.parse(a.window.localStorage.getItem(key)), value);
});

test('All ten mobile routes have a scrollable navigation rule instead of being hidden', async t => {
  const a = await app(t, '#overview');
  const mobileRules = Array.from(a.window.document.styleSheets).flatMap(sheet =>
    Array.from(sheet.cssRules).filter(rule => rule.conditionText === '(max-width:780px)')
      .flatMap(rule => Array.from(rule.cssRules)));
  const navRule = mobileRules.filter(rule => rule.selectorText === '.nav').at(-1);
  const buttonsRule = mobileRules.filter(rule => rule.selectorText?.includes('.nav button:nth-child(n+6)')).at(-1);
  assert.equal(navRule.style.display, 'flex');
  assert.equal(navRule.style.getPropertyValue('overflow-x'), 'auto');
  assert.equal(buttonsRule.style.display, 'grid');
  assert.equal(a.window.document.querySelectorAll('.nav [data-view]').length, 10);
});

test('Mobile route selection reveals the active button inside the nav, not by scrolling the page sideways', async t => {
  const a = await app(t, '#overview');
  const nav = a.$('.nav'), help = a.$('[data-view="help"]');
  // Geometry is a fixture: this tests the scrolling calculation, not rendering.
  Object.defineProperties(nav, { scrollWidth: { value: 800 }, clientWidth: { value: 360 }, offsetLeft: { value: 10 } });
  Object.defineProperties(help, { offsetLeft: { value: 750 }, offsetWidth: { value: 76 } });
  a.click('help');
  assert.ok(nav.scrollLeft > 0);
  assert.equal(a.scrolls.at(-1)?.left, 0);
  assertView(a, 'help');
});

test('Switching away and back preserves the time capture draft', async t => {
  const a = await app(t, '#overview');
  const input = a.$('#description');
  input.value = 'Noch nicht gebuchte Tätigkeit';
  a.click('calendar');
  a.click('overview');
  assert.equal(a.$('#description'), input);
  assert.equal(input.value, 'Noch nicht gebuchte Tätigkeit');
});

test('Route refresh does not create navigation events or history entries', async t => {
  const a = await app(t, '#calendar');
  const length = a.window.history.length;
  const scrolls = a.scrolls.length;
  a.window.ZeiterfassungRefresh();
  assertView(a, 'calendar');
  assert.equal(a.window.history.length, length);
  assert.equal(a.scrolls.length, scrolls);
});

test('Calendar reminder controls show the personal per-entry label and remain usable', async t => {
  const a = await app(t, '#calendar');
  a.$('#stableEmptyNew').click();
  const label = a.$('.stable-reminder-label');
  const number = a.$('#scRemNum');
  const unit = a.$('#scRemUnit');
  assert.equal(label.textContent.trim(), 'Erinnerung vorher (persönlich pro Eintrag)');
  assert.equal(label.htmlFor, 'scRemNum');
  assert.equal(number.type, 'number');
  assert.equal(unit.getAttribute('aria-label'), 'Einheit der Erinnerung');
  assert.deepEqual(Array.from(unit.options).map(option => option.textContent), ['Minute(n)', 'Stunde(n)', 'Tag(e)', 'Woche(n)']);
  const stable = readFileSync(resolve(publicDir, 'stable-ui.js'), 'utf8');
  assert.match(stable, /\.stable-dialog \.field>label\{display:block/);
  assert.match(stable, /\.stable-reminder\{grid-template-columns:140px minmax\(0,1fr\);gap:12px/);
});

test('Calendar uses compact desktop dimensions while keeping the grid readable', async t => {
  const a = await app(t, '#calendar');
  const stable = readFileSync(resolve(publicDir, 'stable-ui.js'), 'utf8');
  assert.match(stable, /\.stable-month,\.stable-agenda\{padding:16px;min-height:460px\}/);
  assert.match(stable, /\.stable-day\{min-height:58px;padding:9px\}/);
  assert.match(stable, /\.stable-empty-cal\{padding:78px 16px\}/);
  assert.equal(a.$('[aria-label="Kalender"]').hidden, false);
});

test('Calendar layout matches the compact reference with a notification block and wider agenda', async t => {
  const a = await app(t, '#calendar');
  assert.equal(a.$('.stable-cal-notice').textContent.includes('Browser- & Smartphone-Benachrichtigungen aktiv'), true);
  const stable = readFileSync(resolve(publicDir, 'stable-ui.js'), 'utf8');
  assert.match(stable, /\.stable-cal-layout\{grid-template-columns:minmax\(0,\.92fr\) minmax\(0,1\.08fr\)\}/);
  assert.match(stable, /\.stable-day\{min-height:76px;padding:10px\}/);
});

test('Overview presents the compact professional dashboard with a decoded user name', async t => {
  const a = await app(t, '#overview');
  assert.equal(a.$('#overviewView').hidden, false);
  assert.equal(a.$('.metrics').querySelectorAll('.metric').length, 5);
  assert.equal(a.$('.work').hidden, false);
  assert.equal(a.$('.quality').hidden, false);
  assert.equal(a.$('.top h1').textContent.includes('Valtère'), true);
  assert.equal(a.$('.top h1').textContent.includes('%C3%A8'), false);
  assert.equal(a.$('#timer').textContent.includes('Timer starten'), true);
  assert.equal(a.$('#csv').textContent.includes('CSV'), true);
  assert.equal(a.$('#pdf').textContent.includes('PDF'), true);
  const stable = readFileSync(resolve(publicDir, 'stable-ui.js'), 'utf8');
  assert.match(stable, /#overviewView>\.work\{|\.metrics\{gap:10px;margin:0 0 20px/);
});

test('Calendar day click opens entries for the selected day', async t => {
  const a = await app(t, '#calendar', {
    [STORE]: { entries: [
      { date: '2026-09-08', minutes: 90, category: 'Organisation', project: 'Intern', description: 'Ausgewählter Tag' },
      { date: '2026-09-07', minutes: 30, category: 'Meeting', project: 'Intern', description: 'Anderer Tag' }
    ] }
  });
  a.$('[data-date="2026-09-08"]').click();
  assertView(a, 'entries');
  assert.match(a.$('#dynamic').textContent, /Ausgewählter Tag/);
  assert.doesNotMatch(a.$('#dynamic').textContent, /Anderer Tag/);
  assert.match(a.$('#dynamic').textContent, /Tagesbuchungen/);
});

test('Notes page follows the OneNote reference structure when empty', async t => {
  const a = await app(t, '#notes');
  assert.equal(a.$('.stable-notes-hero .eyebrow').textContent, 'Mini OneNote');
  assert.match(a.$('.stable-notes-hero h2').textContent, /Notizbücher/);
  assert.equal(a.$('#stableOneNoteExport').textContent.includes('OneNote exportieren'), true);
  assert.equal(a.$('.stable-note-reference-tab').textContent, 'Alle Notizen');
  assert.ok(a.$('.stable-note-reference-search'));
  assert.ok(a.$('.stable-note-reference-category'));
  assert.ok(a.$('.stable-note-reference-theme'));
  assert.ok(a.$('.stable-notes-reference-empty'));
  assert.match(a.$('#dynamic').textContent, /Noch keine Notiz ausgewählt/);
});

test('Stats page renders the professional analytics dashboard', async t => {
  const a = await app(t, '#stats', {
    [STORE]: { entries: [
      { date: '2026-09-08', minutes: 90, category: 'Organisation', project: 'Intern' },
      { date: '2026-09-07', minutes: 30, category: 'Meeting', project: 'Intern' }
    ], weekly: '42h 00' }
  });
  assert.equal(a.$('.stats-hero h2').textContent, 'Arbeitszeit im Überblick');
  assert.equal(a.$('.stats-metrics').querySelectorAll('article').length, 7);
  assert.ok(a.$('.stats-week-chart'));
  assert.equal(a.$('.stats-chart').querySelectorAll('.stats-bar-col').length, 7);
  assert.ok(a.$('.stats-category'));
  assert.ok(a.$('.stats-donut'));
  assert.equal(a.$('#statsPdf').textContent.includes('PDF-Bericht'), true);
});

test('Week page renders the 3D weekly work overview with linked day cards', async t => {
  const a = await app(t, '#week', {
    [STORE]: { entries: [
      { date: '2026-09-08', minutes: 90, category: 'Organisation', project: 'Intern' },
      { date: '2026-09-07', minutes: 30, category: 'Meeting', project: 'Intern' }
    ], daily: '8h 00', weekly: '42h 00' }
  });
  assert.ok(a.$('.week-framework'));
  assert.equal(a.$('.week-day-grid').querySelectorAll('.week-day-card').length, 7);
  assert.equal(a.$('.week-day-card.is-active')?.dataset.weekDate, '2026-09-08');
  assert.match(a.$('.week-total').textContent, /42h 00/);
  assert.match(a.$('.week-bottom').textContent, /Wochensaldo/);
  const stable = readFileSync(resolve(publicDir, 'stable-ui.js'), 'utf8');
  assert.match(stable, /\.week-day-card\{appearance:none/);
  assert.match(stable, /box-shadow:0 7px 0 #dce7f7/);
});

test('The complete app exposes the contemporary 3D surface system', async t => {
  const a = await app(t, '#overview');
  const css = readFileSync(resolve(publicDir, 'index.html'), 'utf8');
  assert.match(css, /--shadow-3d:/);
  assert.match(css, /\.btn\.primary\{background:linear-gradient\(145deg/);
  assert.match(css, /\.metric:hover\{transform:translateY\(-3px\)/);
  assert.match(css, /\.work,\.quality,\.capture,\.entries,\.calendar,\.weekly\{overflow:hidden;box-shadow:var\(--shadow-3d\)/);
  assert.equal(a.$('.nav [data-view="overview"]').classList.contains('active'), true);
});

test('Apple-inspired SVG icons replace static and dynamic symbols throughout the app', async t => {
  const a = await app(t, '#overview');
  const index = readFileSync(resolve(publicDir, 'index.html'), 'utf8');
  const icons = readFileSync(resolve(publicDir, 'apple-icons.js'), 'utf8');
  assert.match(index, /apple-icons\.js\?v=20260908-1/);
  assert.match(icons, /class="apple-icon"/);
  assert.ok(a.window.document.querySelectorAll('.nav .apple-icon').length >= 10);
  assert.equal(a.window.document.querySelectorAll('.nav i').length, 10);
  assert.ok([...a.window.document.querySelectorAll('.nav i')].every(node => node.querySelector('.apple-icon')));
  a.click('calendar');
  await tick();
  assert.ok(a.$('#dynamic .apple-icon'), 'calendar controls use the shared icon system');
  a.click('notes');
  await tick();
  assert.ok(a.$('#dynamic .apple-icon'), 'notes controls use the shared icon system');
  a.$('.profile').click();
  await tick();
  assert.ok(a.$('.auth-menu .apple-icon'), 'authentication menu uses the shared icon system');
});

test('Entry edit and delete actions use the matching controls and validate required fields', async t => {
  const a = await app(t, '#entries', {
    [STORE]: { entries: [{ date: '2026-09-08', category: 'Testing', project: 'Intern', description: 'Prüfung', minutes: 30 }] }
  });
  const edit = a.$('.stable-entry [data-edit]');
  assert.ok(edit, 'an edit action is rendered for the entry');
  edit.click();
  assert.ok(a.$('.stable-dialog'));
  assert.ok(a.$('#seCategory'));
  a.$('#seCategory').value = '';
  a.$('.stable-save').click();
  assert.equal(a.$('.stable-form-error').hidden, false);
  assert.equal(a.window.document.activeElement, a.$('#seCategory'));
  a.$('.stable-x').click();
  a.window.confirm = () => true;
  const remove = a.$('.stable-entry [data-delete]');
  assert.ok(remove, 'a delete action is rendered for the entry');
  remove.click();
  assert.ok(a.$('.stable-dialog'), 'delete opens a confirmation form');
  assert.equal(a.$('.stable-dialog').textContent.includes('Dieser Vorgang kann nicht rückgängig gemacht werden.'), true);
  a.$('.stable-save').click();
  assert.equal(JSON.parse(a.window.localStorage.getItem(STORE)).entries.length, 0);
});

test('Add actions open styled forms and persist named items without native prompts', async t => {
  const a = await app(t, '#favorites');
  a.$('#stableAdd').click();
  assert.ok(a.$('.stable-dialog'));
  assert.equal(a.$('#stableNamedValue').getAttribute('autocomplete'), 'off');
  a.$('.stable-save').click();
  assert.equal(a.$('.stable-form-error').hidden, false);
  assert.equal(a.window.document.activeElement, a.$('#stableNamedValue'));
  a.$('#stableNamedValue').value = 'Mein Favorit';
  a.$('.stable-save').click();
  assert.match(a.$('#dynamic').textContent, /Mein Favorit/);

  a.click('overview');
  a.$('.plus[data-add="category"]').click();
  assert.ok(a.$('.stable-dialog'));
  a.$('#stableNamedValue').value = 'Neue Kategorie';
  a.$('.stable-save').click();
  assert.ok([...a.$('#category').options].some(option => option.value === 'Neue Kategorie'));
});

test('Adding an entry shows a red required-field error and focuses the missing field', async t => {
  const a = await app(t, '#overview');
  a.$('#category').innerHTML = '';
  a.$('#addEntry').click();
  assert.ok(a.$('#category').classList.contains('field-invalid'));
  assert.equal(a.$('.field-error').textContent, 'Kategorie ist ein Pflichtfeld.');
  assert.equal(a.window.document.activeElement, a.$('#category'));
});

test('Day completion uses a styled confirmation dialog and updates immediately', async t => {
  const a = await app(t, '#overview', { [STORE]: { entries: [{ date: '2026-09-08', minutes: 30, category: 'Testing', project: 'Intern' }] } });
  const close = a.$('#closeDay');
  assert.equal(close.disabled, false);
  close.click();
  assert.ok(a.$('.stable-dialog'));
  assert.match(a.$('.stable-dialog').textContent, /Arbeitstag abschließen/);
  a.$('.stable-save').click();
  assert.match(a.$('#qualityTitle').textContent, /Tag abgeschlossen/);
  assert.equal(JSON.parse(a.window.localStorage.getItem(STORE)).closedDays[0], '2026-09-08');
});

test('Profile submenu shows only valid authentication actions when signed out', async t => {
  const a = await app(t, '#overview');
  a.$('.profile').click();
  await tick();
  assert.equal(a.$('#authLogin').hidden, false);
  assert.equal(a.$('#authRegister').hidden, false);
  assert.equal(a.$('#authBackup').hidden, false);
  assert.equal(a.$('#authRestore').hidden, false);
  assert.equal(a.$('#authLogout').hidden, false);
  assert.equal(a.$('#authLogout').disabled, true);
  assert.equal(a.$('#backupBtn'), null);
  a.$('.profile').click();
  assert.equal(a.$('.auth-menu'), null);
  a.$('.profile').click();
  await tick();
  a.$('#authRegister').click();
  assert.ok(a.$('.auth-overlay'));
  assert.ok(a.$('#authEmail'));
  assert.ok(a.$('#authPassword'));
});

test('Logout closes the profile menu and opens the login form immediately', async t => {
  const a = await app(t, '#overview');
  a.window.localStorage.setItem('professionelle-zeiterfassung.session', 'test-session');
  a.$('.profile').click();
  await tick();
  await a.window.AuthUI.logout();
  assert.equal(a.$('.auth-menu'), null);
  assert.ok(a.$('.auth-overlay'));
  assert.ok(a.$('#authEmail'));
  assert.ok(a.$('#authPassword'));
  assert.equal(a.window.document.documentElement.classList.contains('auth-startup-locked'), true);
  assert.equal(a.$('.shell').classList.contains('auth-locked'), true);
  assert.equal(a.window.localStorage.getItem('professionelle-zeiterfassung.session'), null);
  assert.equal(a.window.localStorage.getItem('professionelle-zeiterfassung.logged-out'), '1');
});

test('A URL reload after logout opens the login form instead of the previous profile', async t => {
  const a = await app(t, '#overview', {
    ['professionelle-zeiterfassung.logged-out']: '1'
  });
  assert.ok(a.$('.auth-overlay'));
  assert.ok(a.$('#authEmail'));
  assert.ok(a.$('#authPassword'));
  assert.equal(a.$('.shell').classList.contains('auth-locked'), true);
});

test('Overview mini-calendar day click opens that day in entries', async t => {
  const a = await app(t, '#overview', {
    [STORE]: { entries: [
      { date: '2026-08-31', minutes: 60, category: 'Testing', project: 'Intern', description: 'Kalendertag' },
      { date: '2026-09-08', minutes: 30, category: 'Meeting', project: 'Intern', description: 'Heute' }
    ] }
  });
  const day = [...a.window.document.querySelectorAll('#days button:not(.muted)')]
    .find(button => button.textContent.trim() === '8');
  assert.ok(day, 'Calendar day button exists');
  day.click();
  await tick();
  assertView(a, 'entries');
  assert.match(a.$('#dynamic').textContent, /Heute/);
  assert.doesNotMatch(a.$('#dynamic').textContent, /Kalendertag/);
});
