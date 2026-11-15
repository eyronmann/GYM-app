'use strict';
/*
  Runs the real app files (data/*.js, cardio.js, app.js) inside Node, with
  stand-ins for the browser: a fake page, fake storage, a fake clock, fake GPS
  and a fake motion sensor.

  No packages, no build step. Run the tests with:   node tests/run.js

  The tests never touch real data: storage here is a plain object in memory,
  so running them cannot change what is saved on a phone or in a browser.

  What this cannot check: layout (390 px, tap targets), real GPS, real sensors,
  battery, or anything else that needs an actual phone.
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = ['data/exercises.js', 'data/routines.js', 'data/foods.js', 'cardio.js', 'app.js'];
const SOURCE = FILES.map((f) => ({ name: f, code: fs.readFileSync(path.join(ROOT, f), 'utf8') }));
const STORAGE_KEY = 'gymlog.v1';

// localStorage or sessionStorage. Set failWrites to make every write throw, like a full phone.
class FakeStorage {
  constructor() { this.map = new Map(); this.failWrites = false; }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { if (this.failWrites) throw new Error('QuotaExceededError'); this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  keys() { return [...this.map.keys()]; }
}

// One element of the fake page. It remembers what the app sets on it and does nothing else.
class El {
  constructor(id) {
    this.id = id; this.value = ''; this.textContent = ''; this.hidden = false; this.open = false;
    this.checked = false; this.scrollTop = 0; this.dataset = {}; this.style = {}; this.attrs = {};
    this.listeners = {}; this.parentElement = null; this.html = '';
    this.classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
  }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  removeEventListener() {}
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return null; }
  matches() { return false; }
  appendChild(child) { if (child) child.parentElement = this; return child; }
  showModal() { this.open = true; }
  close() { this.open = false; (this.listeners.close || []).forEach((f) => f()); }
  focus() {} click() {} remove() {} select() {} scrollIntoView() {}
}

const unescape = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/*
  boot() starts one "window" of the app and returns handles for driving it.
    stored        saved data to start from (an object, or a raw string), or null for a new phone
    local/session share these between two boot() calls to model two windows, or a reload
    now           the fake clock's starting time in ms
*/
function boot({ stored = null, local = new FakeStorage(), session = new FakeStorage(), now = Date.parse('2026-11-15T08:00:00Z') } = {}) {
  if (stored != null) local.map.set(STORAGE_KEY, typeof stored === 'string' ? stored : JSON.stringify(stored));

  const clock = { now };
  class FakeDate extends Date {
    constructor(...args) { if (args.length) super(...args); else super(clock.now); }
    static now() { return clock.now; }
  }

  // The page shell from index.html is always there. Elements inside the main view or the
  // sheet exist only while that view or sheet is drawn, as in a browser: whenever the app
  // sets their innerHTML, every id="..." in it becomes an element (inputs get their value).
  const shell = {};
  ['view', 'title', 'timer', 'toast', 'sheet', 'sheet-body'].forEach((id) => { shell[id] = new El(id); });
  const tabs = new El('tabs');
  const body = new El('body');
  const drawn = { view: {}, 'sheet-body': {} };
  const scan = (html) => {
    const found = {};
    const tag = /<(input|select|textarea|span|div|p|button|g)\b([^>]*)\bid="([^"]+)"([^>]*)>/g;
    let m;
    while ((m = tag.exec(html))) {
      const el = new El(m[3]);
      const attrs = m[2] + m[4];
      const value = /\bvalue="([^"]*)"/.exec(attrs);
      if (m[1] === 'input' && value) el.value = unescape(value[1]);
      if (m[1] === 'select') {
        const rest = html.slice(tag.lastIndex, html.indexOf('</select>', tag.lastIndex));
        const picked = /<option value="([^"]*)" selected/.exec(rest) || /<option value="([^"]*)"/.exec(rest);
        if (picked) el.value = unescape(picked[1]);
      }
      found[m[3]] = el;
    }
    return found;
  };
  ['view', 'sheet-body'].forEach((id) => {
    Object.defineProperty(shell[id], 'innerHTML', {
      get() { return this.html; },
      set(html) { this.html = String(html); drawn[id] = scan(this.html); },
    });
  });
  const byId = (id) => shell[id] || drawn['sheet-body'][id] || drawn.view[id] || null;

  const listeners = { window: {}, document: {} };
  const listen = (who) => (type, fn) => { (listeners[who][type] = listeners[who][type] || []).push(fn); };
  const unlisten = (who) => (type, fn) => { listeners[who][type] = (listeners[who][type] || []).filter((f) => f !== fn); };

  const document = {
    visibilityState: 'visible',
    body,
    addEventListener: listen('document'),
    removeEventListener: unlisten('document'),
    getElementById: byId,
    querySelector: (sel) => (sel === '.tabs' ? tabs : sel.startsWith('#') && !/[\s.[>]/.test(sel.slice(1)) ? byId(sel.slice(1)) : null),
    querySelectorAll: () => [],
    createElement: (t) => new El(t),
  };

  const geo = { watching: false, starts: 0, ok: null, err: null };
  const wake = { held: false, requests: 0, refuse: false };
  const navigator = {
    userAgent: 'node-test',
    onLine: true,
    geolocation: {
      watchPosition(ok, err) { geo.watching = true; geo.starts += 1; geo.ok = ok; geo.err = err; return geo.starts; },
      clearWatch() { geo.watching = false; },
    },
    wakeLock: {
      request() {
        wake.requests += 1;
        if (wake.refuse) return Promise.reject(new Error('NotAllowedError'));
        wake.held = true;
        return Promise.resolve({ addEventListener() {}, release() { wake.held = false; } });
      },
    },
    storage: { persist: () => Promise.resolve(true) },
    vibrate() {},
  };

  const page = { reloads: 0, confirms: [], prompts: [], answer: true, promptAnswer: null };
  const motion = { asks: 0, pending: [] };
  const sandbox = {
    console,
    Date: FakeDate,
    document, navigator,
    localStorage: local, sessionStorage: session,
    location: { protocol: 'http:', reload() { page.reloads += 1; } },
    confirm(msg) { page.confirms.push(String(msg)); return page.answer; },
    prompt(msg) { page.prompts.push(String(msg)); return page.promptAnswer; },
    alert() {},
    // Timers never fire by themselves. Tests move the clock and call what they need.
    setTimeout() { return 0; }, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {},
    addEventListener: listen('window'), removeEventListener: unlisten('window'),
    scrollTo() {},
    DeviceMotionEvent: function DeviceMotionEvent() {},
    FileReader: class { readAsText(file) { this.result = file.body; if (this.onload) this.onload(); } },
    File: class { constructor(parts, name) { this.body = parts.join(''); this.name = name; } },
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  const ctx = vm.createContext(sandbox);
  SOURCE.forEach((f) => vm.runInContext(f.code, ctx, { filename: f.name }));

  const run = (code) => vm.runInContext(code, ctx);
  const fire = (who, type, event = {}) => (listeners[who][type] || []).slice().forEach((f) => f(event));
  let lat = 18.055;
  let lng = 120.565;
  const M_LAT = 1 / 111195;                                        // degrees of latitude per metre
  const M_LNG = 1 / (111195 * Math.cos((18.055 * Math.PI) / 180)); // degrees of longitude per metre here

  return {
    run,
    clock,
    page,
    geo,
    wake,
    local,
    session,
    el: byId,
    fire,
    motion,
    // How many functions are listening for an event on the window, e.g. 'devicemotion'.
    listening: (type) => (listeners.window[type] || []).length,
    // Make this browser ask before giving motion data, as iPhones do. Each request waits
    // in motion.pending until the test answers it: motion.pending[0]('granted').
    askForMotion() {
      sandbox.DeviceMotionEvent.requestPermission = () => { motion.asks += 1; return new Promise((resolve) => motion.pending.push(resolve)); };
    },
    get db() { return run('db'); },
    get sheet() { return run('sheet'); },
    // What is in storage right now, parsed.
    saved: () => JSON.parse(local.getItem(STORAGE_KEY)),
    copies: (reason) => local.keys().filter((k) => k.startsWith(`${STORAGE_KEY}.${reason}.`)),
    // Press a button: the app's own handler for that data-action, with the button's data-* values.
    tap: (action, dataset = {}) => run('actions')[action]({ dataset, setAttribute() {}, getAttribute() { return null; } }, {}),
    advance(ms) { clock.now += ms; },
    // Move `north` and `east` metres, wait `secs`, then deliver one GPS fix of the given accuracy.
    fix({ north = 0, east = 0, secs = 1, acc = 8 } = {}) {
      lat += north * M_LAT; lng += east * M_LNG; clock.now += secs * 1000;
      if (geo.watching && geo.ok) geo.ok({ coords: { latitude: lat, longitude: lng, accuracy: acc } });
    },
    // Move without the phone getting a fix (no signal).
    drift({ north = 0, east = 0, secs = 1 } = {}) { lat += north * M_LAT; lng += east * M_LNG; clock.now += secs * 1000; },
    // One footstrike on the motion sensor: a bump, then back to rest.
    footfall(ms = 350) {
      fire('window', 'devicemotion', { accelerationIncludingGravity: { x: 0, y: 0, z: 15 } });
      clock.now += ms / 2;
      fire('window', 'devicemotion', { accelerationIncludingGravity: { x: 0, y: 0, z: 9.8 } });
      clock.now += ms / 2;
    },
    hide() { document.visibilityState = 'hidden'; fire('document', 'visibilitychange'); },
    show() { document.visibilityState = 'visible'; fire('document', 'visibilitychange'); },
    // Tell this window that another window wrote to storage, as the browser would.
    otherWindowSaved() { fire('window', 'storage', { key: STORAGE_KEY, newValue: local.getItem(STORAGE_KEY) }); },
    // migrate() on a copy of some data. Returns { out, dropped }, or { error } if it was refused.
    migrate(data) {
      sandbox.__in = JSON.stringify(data);
      return JSON.parse(run(`(() => { const r = { dropped: 0 }; try { const out = migrate(JSON.parse(__in), r); return JSON.stringify({ out, dropped: r.dropped }); } catch (e) { return JSON.stringify({ error: e.code || e.message }); } })()`));
    },
  };
}

module.exports = { boot, FakeStorage, STORAGE_KEY };
