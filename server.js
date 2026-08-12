#!/usr/bin/env node
/* ============================================================
 * server.js — Classroom Library server
 * ------------------------------------------------------------
 * - Serves the static site.
 * - Hosts the shared data store (library-data.json).
 * - Server-side auth: passwords hashed at rest, httpOnly session
 *   cookies, passwords never sent to the browser. (#2)
 *
 *   node server.js            # serve on 0.0.0.0:8080
 *
 * API:
 *   GET  /api/state             -> shared state (passwords redacted)
 *   POST /api/state             -> save state (requires session once seeded)
 *   POST /api/login             -> {username,password} -> sets session cookie
 *   POST /api/logout            -> clears session
 *   GET  /api/me                -> current user (or 401)
 *   POST /api/change-password   -> change current user's password
 *   POST /api/kiosk-login       -> server-side session for the kiosk account
 *   POST /api/reset             -> reset all data
 *   GET  /api/overdue           -> overdue summary
 *   POST /api/remind            -> log reminders
 * ============================================================ */
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");

const ROOT = __dirname;
const PORT = process.env.PORT || process.env.CLASSROOM_PORT || 8080;
const HOST = "0.0.0.0";
const DATA_FILE = path.join(ROOT, "library-data.json");
const COOKIE = "classroom_session";
const SESSION_TTL = 1000 * 60 * 60 * 6;        // auto sign-out after 6h of inactivity
const SESSION_ABS_MAX = 1000 * 60 * 60 * 24 * 7; // hard cap (7 days)

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

/* ----------------------------- persistence ----------------------------- */
let state = null;
let savePending = false;
const sessions = new Map(); // token -> { userId, expires }

function defaultState() {
  return {
    version: 1, books: [], users: [], loans: [], holds: [], reviews: [],
    requests: [], charges: [], announcements: [], kioskLog: [],
    readingLog: [], clubs: [], clubPosts: [],
    settings: {
      maxLoansPerStudent: 4, maxHoldsPerStudent: 3, overdueGraceDays: 2,
      popularityWindowDays: 30, hideDemoAccounts: false, featuredBookId: "",
      kioskEnabled: true,
    },
  };
}

function loadData() {
  try { state = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch (e) { state = defaultState(); }
  migrate();
}

// Convert any stored plaintext passwords to encrypted/hashed (from earlier versions),
// and assign the kiosk account its own role.
function migrate() {
  let changed = false;
  (state.users || []).forEach(u => {
    // kiosk gets its own role
    if (u.username === "kiosk" && u.role !== "kiosk") { u.role = "kiosk"; changed = true; }
    const viewable = VIEWABLE_ROLES.includes(u.role);
    if (viewable && u.password && typeof u.password === "string" && !u.password.iv) {
      // plaintext student/kiosk password -> encrypt it
      u.password = encryptPassword(u.password); changed = true;
    } else if (viewable && u.pw && !u.password) {
      // a previously-hashed viewable account: nothing to decrypt; leave as-is
    } else if (!viewable && u.password && !u.pw) {
      u.pw = hashPassword(u.password); delete u.password; changed = true;
    }
    if (u.pw === undefined && u.password === undefined && u.passwordChangeRequired === undefined) u.passwordChangeRequired = false;
  });
  state.settings = Object.assign(defaultState().settings, state.settings || {});
  if (state.kioskLog === undefined) state.kioskLog = [];
  if (state.settings.room === undefined) state.settings.room = "204";
  if (changed) persist();
}

function persist() {
  if (savePending) return;
  savePending = true;
  setTimeout(() => { savePending = false; try { fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2)); } catch (e) { console.error("write failed:", e.message); } }, 200);
}

/* ------------------------------ passwords ------------------------------ */
// Secret key used to encrypt viewable passwords (students, kiosk). Kept in a
// file so decryption works across restarts. Admin passwords are scrypt-hashed
// (one-way) and are never recoverable.
const SECRET_FILE = path.join(ROOT, "library-secret.key");
let SECRET = "";
function loadSecret() {
  try { SECRET = fs.readFileSync(SECRET_FILE, "utf8").trim(); } catch (e) {}
  if (SECRET.length < 16) {
    SECRET = crypto.randomBytes(32).toString("hex");
    try { fs.writeFileSync(SECRET_FILE, SECRET, { mode: 0o600 }); } catch (e) {}
  }
}
loadSecret();

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(pw), salt, 64).toString("hex");
  return { salt, hash };
}
// Encrypt a password so it can be decrypted on request (AES-256-GCM).
function encryptPassword(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(SECRET, "hex").slice(0, 32), iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString("base64"), tag: tag.toString("base64"), data: enc.toString("base64") };
}
function decryptPassword(enc) {
  try {
    const iv = Buffer.from(enc.iv, "base64");
    const tag = Buffer.from(enc.tag, "base64");
    const data = Buffer.from(enc.data, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(SECRET, "hex").slice(0, 32), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch (e) { return ""; }
}

// Roles whose passwords the teacher (admin) is allowed to view on request.
const VIEWABLE_ROLES = ["student", "kiosk"];

function verifyPassword(pw, user) {
  if (!user) return false;
  // Students/kiosk store an encrypted password; decrypt and compare.
  if (VIEWABLE_ROLES.includes(user.role) && user.password) {
    return decryptPassword(user.password) === String(pw);
  }
  // Admin (and other staff) passwords are scrypt-hashed.
  if (user.pw) {
    const { salt, hash } = user.pw;
    try {
      const test = crypto.scryptSync(String(pw), salt, 64).toString("hex");
      const a = Buffer.from(hash, "hex"), b = Buffer.from(test, "hex");
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch (e) { return false; }
  }
  return false;
}

// Redact a user for the client.
//  - Students/kiosk: password is NOT sent in state; only hasPassword flag.
//    It is decrypted on request via POST /api/password (admin only).
//  - Admin:          password hidden entirely (hashed `pw`).
function redact(u) {
  const out = Object.assign({}, u);
  if (VIEWABLE_ROLES.includes(u.role)) {
    delete out.pw;
    delete out.password;
    out.hasPassword = !!u.password;
  } else {
    out.hasPassword = !!u.pw;
    delete out.pw;
    delete out.password;
  }
  return out;
}
function redactState() {
  return Object.assign({}, state, { users: state.users.map(redact) });
}

// Store a new password for a user, role-aware:
//  - students & kiosk -> encrypted `password` (teacher can view on request)
//  - admin             -> hashed `pw` (never exposed)
function storePassword(u, plaintext) {
  if (VIEWABLE_ROLES.includes(u.role)) {
    u.password = encryptPassword(plaintext);
    delete u.pw;
  } else {
    u.pw = hashPassword(plaintext);
    delete u.password;
  }
}

/* ------------------------------ sessions ------------------------------- */
function cookieFromReq(req) {
  const raw = req.headers.cookie || "";
  const m = raw.split(";").map(s => s.trim()).find(s => s.startsWith(COOKIE + "="));
  return m ? m.slice(COOKIE.length + 1) : null;
}
function sessionUser(req) {
  const token = cookieFromReq(req);
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  const user = state.users.find(u => u.id === s.userId);
  // Absolute expiry.
  if (s.expires < Date.now()) { sessions.delete(token); return null; }
  // 6-hour inactivity timeout — but never for the kiosk account.
  if (user && user.role !== "kiosk") {
    const now = Date.now();
    if (now - (s.lastActive || now) > SESSION_TTL) { sessions.delete(token); return null; }
    s.lastActive = now; // sliding
  }
  return user || null;
}
function newSession(userId, res) {
  const token = crypto.randomBytes(24).toString("hex");
  const user = state.users.find(u => u.id === userId);
  // Kiosk sessions don't time out; everyone else gets the inactivity cap.
  const maxAge = (user && user.role === "kiosk") ? SESSION_ABS_MAX : SESSION_TTL;
  sessions.set(token, { userId, lastActive: Date.now(), expires: Date.now() + SESSION_ABS_MAX });
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(maxAge / 1000)}`);
}
function clearSession(req, res) {
  const token = cookieFromReq(req);
  if (token) sessions.delete(token);
  res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

/* ------------------------------- helpers ------------------------------- */
function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff" });
  res.end(JSON.stringify(obj));
}
function readBody(req, cb) {
  let data = "";
  req.on("data", c => { data += c; if (data.length > 30 * 1024 * 1024) req.destroy(); });
  req.on("end", () => cb(data));
  req.on("error", () => cb(""));
}

/* --------------------------- merge on save ----------------------------- */
function mergeState(incoming) {
  const merged = Object.assign(defaultState(), state || {}, incoming);
  merged.users = (merged.users || []).map(u => {
    const prev = (state && state.users || []).find(x => x.id === u.id);
    const viewable = VIEWABLE_ROLES.includes(u.role);
    if (viewable) {
      // Students/kiosk: preserve the stored encrypted password if none is
      // provided; encrypt any plaintext that arrives.
      if (!u.password && prev && prev.password) u.password = prev.password;
      else if (u.password && typeof u.password === "string" && !u.password.iv) u.password = encryptPassword(u.password);
      if (u.pw) delete u.pw;
    } else {
      // Admin: keep the existing hash unless a plaintext password is provided.
      if (!u.pw && !u.password && prev && prev.pw) u.pw = prev.pw;
      if (u.password) { u.pw = hashPassword(u.password); delete u.password; }
    }
    return u;
  });
  return merged;
}
function isSeeded() {
  return !!(state && ((state.books && state.books.length) || (state.users && state.users.length)));
}

/* ------------------------- overdue / reminders ------------------------- */
function overdueSummary() {
  if (!state) return [];
  const now = Date.now(), DAY = 86400000;
  const grace = (state.settings && state.settings.overdueGraceDays) || 0;
  const byUser = {};
  state.loans.forEach(l => {
    if (l.returned) return;
    const due = l.dueDate + grace * DAY;
    if (now <= due) return;
    const daysLate = Math.floor((now - due) / DAY) + 1;
    const book = state.books.find(b => b.id === l.bookId);
    const user = state.users.find(u => u.id === l.userId);
    if (!book || !user) return;
    (byUser[user.id] = byUser[user.id] || { user: user.name, username: user.username, items: [] }).items.push({ title: book.title, dueDate: l.dueDate, daysLate });
  });
  return Object.values(byUser);
}
function logReminders() {
  const list = overdueSummary();
  if (!list.length) return;
  const lines = list.map(g => `${g.user} (${g.username}): ` + g.items.map(i => `${i.title} (${i.daysLate}d late, due ${new Date(i.dueDate).toDateString()})`).join("; "));
  try { fs.appendFileSync(path.join(ROOT, "reminder-log.txt"), "\n[" + new Date().toISOString() + "] Overdue reminder:\n" + lines.join("\n")); } catch (e) {}
}

/* ------------------------------ HTTP server ---------------------------- */
const server = http.createServer((req, res) => {
  let url;
  try { url = new URL(req.url, `http://${req.headers.host}`); } catch (e) { res.writeHead(400); res.end("Bad request"); return; }
  const urlPath = decodeURIComponent(url.pathname);
  const method = req.method;

  if (urlPath === "/api/login" && method === "POST") {
    return readBody(req, body => {
      let b; try { b = JSON.parse(body); } catch (e) { return json(res, 400, { ok: false, error: "bad json" }); }
      const user = state.users.find(u => (u.username || "").toLowerCase() === String(b.username || "").toLowerCase());
      if (!user || !verifyPassword(b.password, user)) return json(res, 401, { ok: false, error: "Invalid username or password." });
      newSession(user.id, res);
      return json(res, 200, redact(user));
    });
  }
  if (urlPath === "/api/logout" && method === "POST") { clearSession(req, res); return json(res, 200, { ok: true }); }
  if (urlPath === "/api/me") {
    const u = sessionUser(req);
    return u ? json(res, 200, redact(u)) : json(res, 401, { ok: false });
  }
  // Admin-only: reveal a student/kiosk password on request (decrypt it).
  if (urlPath === "/api/password" && method === "POST") {
    const admin = sessionUser(req);
    if (!admin || admin.role !== "admin") return json(res, 403, { ok: false, error: "Admin only." });
    return readBody(req, body => {
      let b; try { b = JSON.parse(body); } catch (e) { return json(res, 400, { ok: false }); }
      const u = state.users.find(x => x.id === b.userId);
      if (!u) return json(res, 404, { ok: false, error: "User not found." });
      if (!VIEWABLE_ROLES.includes(u.role)) return json(res, 403, { ok: false, error: "Not a viewable account." });
      return json(res, 200, { ok: true, username: u.username, password: decryptPassword(u.password) });
    });
  }
  if (urlPath === "/api/kiosk-login" && method === "POST") {
    const k = state.users.find(u => u.username === "kiosk");
    if (!k) return json(res, 404, { ok: false, error: "kiosk account not found" });
    newSession(k.id, res);
    return json(res, 200, redact(k));
  }
  if (urlPath === "/api/change-password" && method === "POST") {
    return readBody(req, body => {
      let b; try { b = JSON.parse(body); } catch (e) { return json(res, 400, { ok: false }); }
      // Identify the user: prefer the session, else fall back to the username
      // sent in the body.
      const sessUser = sessionUser(req);
      const target = sessUser || state.users.find(u =>
        (u.username || "").toLowerCase() === String(b.username || "").toLowerCase());
      if (!target) return json(res, 401, { ok: false, error: "Not signed in." });
      if (!b.newPassword || String(b.newPassword).length < 4) return json(res, 400, { ok: false, error: "New password must be at least 4 characters." });
      storePassword(target, b.newPassword);
      target.passwordChangeRequired = false;
      if (!sessUser) newSession(target.id, res); // ensure they're signed in after a successful change
      persist();
      return json(res, 200, redact(target));
    });
  }

  if (urlPath === "/api/state" && method === "GET") return json(res, 200, redactState());

  if (urlPath === "/api/state" && method === "POST") {
    const seeded = isSeeded();
    if (seeded && !sessionUser(req)) return json(res, 403, { ok: false, error: "Sign in required to save." });
    return readBody(req, body => {
      try {
        const incoming = JSON.parse(body);
        state = mergeState(incoming);
        persist();
        return json(res, 200, { ok: true });
      } catch (e) { return json(res, 400, { ok: false, error: "Invalid JSON" }); }
    });
  }

  if (urlPath === "/api/reset" && method === "POST") {
    state = defaultState();
    persist();
    try { fs.unlinkSync(DATA_FILE); } catch (e) {}
    return json(res, 200, { ok: true });
  }
  if (urlPath === "/api/overdue" && method === "GET") return json(res, 200, { list: overdueSummary() });
  if (urlPath === "/api/remind" && method === "POST") { logReminders(); return json(res, 200, { ok: true }); }

  /* ----------------------------- static ----------------------------- */
  let file = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  let full = path.normalize(path.join(ROOT, file));
  if (!full.startsWith(ROOT)) { res.writeHead(403); res.end("Forbidden"); return; }
  fs.stat(full, (err, stat) => {
    if (!err && stat.isDirectory()) full = path.join(full, "index.html");
    fs.readFile(full, (err2, data) => {
      if (err2) { res.writeHead(404); res.end("Not found"); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(full).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff" });
      res.end(data);
    });
  });
});

loadData();
server.listen(PORT, HOST, () => {
  const lan = lanIP();
  console.log("Classroom Library server running:");
  console.log(`   On this machine:   http://localhost:${PORT}`);
  console.log(`   On your network:   http://${lan || "<this-computer's-LAN-IP>"}:${PORT}`);
  console.log(`   Data file:         ${DATA_FILE}`);
  console.log("   Server-side auth: passwords hashed, httpOnly session cookies");
  console.log("");
  console.log("   First-launch check (DuckDNS / hosting):");
  if (!lan) {
    console.log("     - Could not auto-detect a LAN IP.");
  } else {
    console.log(`     - LAN IP detected: ${lan}`);
    console.log("     - To reach it from another device on your home Wi-Fi:");
    console.log(`         http://${lan}:${PORT}`);
  }
  console.log("     - The moment someone opens the site, this server will print");
  console.log("       the hostname they used (e.g. your DuckDNS address) below.");
});

/* ----------------------- first-launch / hostname ----------------------- */
function lanIP() {
  try {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === "IPv4" && !net.internal) return net.address;
      }
    }
  } catch (e) {}
  return null;
}

let reported = false;
// On the first incoming request, print which hostname reached the server so you
// can confirm your DuckDNS address is routing here correctly.
server.on("request", (req) => {
  if (reported) return;
  reported = true;
  const host = req.headers.host || "(unknown)";
  const isDuck = /duckdns\.org$/i.test(host);
  console.log("");
  console.log("   Site was just opened using hostname: " + host);
  if (isDuck) {
    console.log("   - That's your DuckDNS address! If this page loaded over");
    console.log("     https://" + host + ", camera scanning will work at school.");
  } else if (/^localhost|127\./.test(host)) {
    console.log("   - Opened locally (localhost).");
  } else {
    console.log("   - This is a " + host + " host — set up DuckDNS + Caddy (see HOSTING.md)");
    console.log("     if you want a public https:// address for school.");
  }
});
