/* ============================================================
 * app.js — shared UI helpers, nav, login modal, notifications
 * Loaded on every page.
 * ============================================================ */
(function () {
 const S = Store;

 /* ----------------------------- helpers ----------------------------- */
 window.$ = (sel, root) => (root || document).querySelector(sel);
 window.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

 function esc(str) {
 return String(str == null ? "": str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
 }
 window.esc = esc;

 // Display prices in Canadian dollars. Stored base prices are in USD, so
 // convert here so every money() call shows CAD. Adjust CAD_RATE as needed.
 const CAD_RATE = 1.37; // 1 USD ≈ 1.37 CAD
 function money(n) {
 const cad = (Number(n) || 0) * CAD_RATE;
 return "$" + cad.toFixed(2) + " CAD";
 }
 window.money = money;

 function timeAgo(ms) {
 const diff = Date.now() - ms;
 const min = 60000, hr = 3600000, day = 86400000;
 if (diff < min) return "just now";
 if (diff < hr) return Math.floor(diff / min) + " min ago";
 if (diff < day) return Math.floor(diff / hr) + " hr ago";
 return Math.floor(diff / day) + " days ago";
 }
 window.timeAgo = timeAgo;

 /* --------------------------- toast ------------------------------- */
 function toast(msg, type) {
 type = type || "info";
 let box = $("#toast-box");
 if (!box) {
 box = document.createElement("div");
 box.id = "toast-box";
 document.body.appendChild(box);
 }
 const el = document.createElement("div");
 el.className = "toast toast-" + type;
 el.innerHTML = esc(msg);
 box.appendChild(el);
 setTimeout(() => {
 el.classList.add("toast-hide");
 setTimeout(() => el.remove(), 300);
 }, 3200);
 }
 window.toast = toast;

 /* --------------------------- login modal ------------------------- */
 function openLogin() {
 let modal = $("#login-modal");
 if (!modal) modal = buildLoginModal();
 modal.classList.add("open");
 $("#login-username").focus();
 }
 window.openLogin = openLogin;

 function closeLogin() {
 const modal = $("#login-modal");
 if (modal) modal.classList.remove("open");
 }
 window.closeLogin = closeLogin;

  function buildLoginModal() {
    const modal = document.createElement("div");
    modal.id = "login-modal";
    modal.className = "modal";
    const set = Store.getState().settings || {};
    const hideDemo = !set.demoMode || set.hideDemoAccounts;
    modal.innerHTML = `
      <div class="modal-card login-card">
        <button class="modal-x" data-close>&times;</button>
        <h2>Welcome back!</h2>
        <p class="muted">Sign in to check out books, place holds, and manage your account.</p>
        <form id="login-form">
          <label>Username
            <input id="login-username" type="text" autocomplete="username" placeholder="e.g. alex">
          </label>
          <label>Password
            <input id="login-password" type="password" autocomplete="current-password" placeholder="••••••••">
          </label>
          <p id="login-error" class="form-error" hidden></p>
          <button class="btn btn-primary btn-block" type="submit">Sign in</button>
        </form>
        ${hideDemo ? "" : `
        <div class="demo-accounts">
          <p class="muted small">Demo accounts:</p>
          <button class="chip" data-fill="alex">Student: alex / read123</button>
          <button class="chip" data-fill="admin">Admin: admin / admin123</button>
          <button class="chip" data-fill="kiosk">Kiosk: kiosk / kiosk</button>
        </div>`}
      </div>`;
    document.body.appendChild(modal);

 modal.querySelector("[data-close]").addEventListener("click", closeLogin);
 modal.addEventListener("click", (e) => { if (e.target === modal) closeLogin(); });

    $("#login-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const u = $("#login-username").value.trim();
      const p = $("#login-password").value;
      const user = S.authenticate(u, p);
      if (!user) {
        const err = $("#login-error");
        err.hidden = false;
        err.textContent = "That username and password don't match. Try again!";
        return;
      }
      closeLogin();
      // #1: force a password change for flagged accounts (e.g. default admin).
      if (user.passwordChangeRequired) {
        toast("Please set a new password before continuing.", "info");
        openChangePassword(user);
        return;
      }
      onSignedIn(user);
    });

    // #2: kiosk demo — quick-fill the login fields for the kiosk account.
    const kioskFill = modal.querySelector("[data-fill='kiosk']");
    if (kioskFill) kioskFill.addEventListener("click", () => {
      $("#login-username").value = "kiosk";
      $("#login-password").value = "kiosk";
    });

    $$(".chip", modal).forEach((c) => {
      c.addEventListener("click", () => {
        $("#login-username").value = c.dataset.fill;
        const pwMap = { admin: "admin123", kiosk: "kiosk" };
        $("#login-password").value = pwMap[c.dataset.fill] || "read123";
      });
    });
    return modal;
  }

  // Shared post-login steps.
  function onSignedIn(user) {
    toast(`You're signed in as ${user.name} `, "success");
    renderUserNav();
    if (typeof window.onAuthChange === "function") window.onAuthChange(user);
    // Friendly confirmation: if the student has overdue books, mention them.
    if (user.role === "student") {
      try {
        const st = S.getState();
        const overdue = st.loans.filter(l => l.userId === user.id && !l.returned && S.isOverdue(l, st));
        if (overdue.length) {
          const first = st.books.find(b => b.id === overdue[0].bookId);
          setTimeout(() => {
            toast(`Heads up — you have ${overdue.length} overdue book${overdue.length === 1 ? "" : "s"}${first ? " (" + first.title + ")" : ""}. Please return it soon!`, "info");
          }, 800);
        }
      } catch (e) {}
    }
  }

  // #1: force a password change for accounts flagged (default admin).
  function openChangePassword(user) {
    let modal = document.getElementById("change-pw-modal");
    if (!modal) modal = buildChangePasswordModal();
    modal.classList.add("open");
    modal.querySelector("#cp-new").value = "";
    modal.querySelector("#cp-new2").value = "";
    modal.querySelector("#cp-msg").hidden = true;
    modal.dataset.userId = user.id;
    modal.querySelector("#cp-new").focus();
  }
  window.openChangePassword = openChangePassword;

  function buildChangePasswordModal() {
    const modal = document.createElement("div");
    modal.id = "change-pw-modal";
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-card">
        <h2>Update your password</h2>
        <p class="muted small">For security, please set a new password. You'll use it to sign in from now on.</p>
        <form id="change-pw-form">
          <label>New password
            <input id="cp-new" type="password" autocomplete="new-password">
          </label>
          <label>Confirm new password
            <input id="cp-new2" type="password" autocomplete="new-password">
          </label>
          <p id="cp-msg" class="form-error" hidden></p>
          <button class="btn btn-primary btn-block" type="submit">Save new password</button>
        </form>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => { if (e.target === modal) return; });
    modal.querySelector("#change-pw-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const nw = modal.querySelector("#cp-new").value;
      const nw2 = modal.querySelector("#cp-new2").value;
      const msg = modal.querySelector("#cp-msg");
      if (!nw || nw.length < 4) { msg.hidden = false; msg.textContent = "New password must be at least 4 characters."; return; }
      if (nw !== nw2) { msg.hidden = false; msg.textContent = "New passwords don't match."; return; }
      const res = Store.changePassword(nw);
      if (!res.ok) { msg.hidden = false; msg.textContent = res.msg; return; }
      modal.classList.remove("open");
      toast("Password updated. You're signed in.", "success");
      renderUserNav();
      if (typeof window.onAuthChange === "function") window.onAuthChange(res.user);
    });
    return modal;
  }

 function logout() {
 S.clearSession();
 toast("You've been signed out. See you soon! ");
 renderUserNav();
 if (typeof window.onAuthChange === "function") window.onAuthChange(null);
 }
 window.logout = logout;

 /* ------------------------- top bar / nav -------------------------- */
 function renderUserNav() {
 const user = S.currentUser();
 const right = $("#user-area");
 if (!right) return;
 const kioskBtn = `<a class="btn btn-ghost btn-sm" href="kiosk.html">Kiosk</a>`;
 if (!user) {
 right.innerHTML = `
 <button class="btn btn-ghost btn-sm" onclick="openLogin()">Sign in</button>
 ${kioskBtn}`;
 return;
 }
 const isAdmin = user.role === "admin";
 right.innerHTML = `
 <span class="user-chip" title="${esc(user.name)}">
 <span class="user-avatar">${esc((user.name || "?").trim().charAt(0).toUpperCase())}</span>
 <span class="user-name">${esc(user.name.split(" ")[0])}</span>
 ${isAdmin ? '<span class="badge badge-admin">Admin</span>': ""}</span>
 <a class="btn btn-ghost btn-sm" href="my-library.html">My Library</a>
 ${isAdmin ? '<a class="btn btn-primary btn-sm" href="admin.html">Admin</a>': ""}
 ${kioskBtn}
 <button class="btn btn-ghost btn-sm" onclick="logout()">Log out</button>`;
 }

 function excerpt(str, n) {
 const s = String(str == null ? "": str).trim();
 if (!s) return "";
 if (s.length <= n) return s;
 return s.slice(0, n).replace(/\s+\S*$/, "") + "…";
 }
 window.excerpt = excerpt;

 /* --------------------------- availability ------------------------- */
 function availBadge(bookId) {
 const st = S.getState();
 const avail = S.availableCopies(bookId, st);
 const waiting = S.hasHoldQueue(bookId, st);
 if (avail > 0 &&!waiting) return `<span class="badge badge-avail">${avail} available</span>`;
 if (avail > 0 && waiting) return `<span class="badge badge-hold">Reserved · next in line</span>`;
 return `<span class="badge badge-out">Checked out</span>`;
 }
 window.availBadge = availBadge;

 // A real book cover (from Open Library) with a clean, text-only fallback.
 // No emoji glyphs are used, so it renders correctly even on machines with
 // no emoji font. The real cover image (if it loads) sits on top and hides
 // the text; if it fails or there's no network, the text cover shows.
 function bookCover(book, size) {
 size = size || "";
 const colors = { novel: "#0f7a7a", graphic: "#b5476b", nonfiction: "#1d7a4f", textbook: "#2f6fd0", reference: "#7a54b8" };
 const bg = colors[book.type] || "#0f7a7a";
 const initial = esc((book.title || "?").trim().charAt(0).toUpperCase());
 const typeLabel = esc(Store.TYPE_POLICY[book.type] ? Store.TYPE_POLICY[book.type].label.split(" ")[0]: book.type);
 let img = "";
 if (window.Covers) {
 const src = Covers.coverUrl(book.isbn);
 if (src) img = `<img class="cover-img" src="${src}" alt="" loading="lazy" onerror="this.remove()">`;
 }
 return `
 <div class="cover ${size}" style="background:${bg}">
 ${img}
 <div class="cover-initial">${initial}</div>
 <div class="cover-type">${typeLabel}</div>
 <div class="cover-title">${esc(book.title)}</div>
 <div class="cover-author">${esc(book.author)}</div>
 </div>`;
 }
  window.bookCover = bookCover;

  /* Safe wrappers so inline onclick buttons never throw if a script is still
     loading or got cached stale. They give a friendly hint instead. */
  window.tryScan = function () {
    if (window.ScanActions) return ScanActions.run();
    toast("The scanner isn't loaded yet. Try a hard refresh (Ctrl+Shift+R).", "error");
  };
  window.tryRequest = function () {
    if (window.RequestActions) return RequestActions.open();
    toast("The request form isn't loaded yet. Try a hard refresh (Ctrl+Shift+R).", "error");
  };

 // Replace "Room 204" in the page with the configured room number.
 function applyRoom() {
   const room = (Store.getState().settings && Store.getState().settings.room) || "204";
   document.body.querySelectorAll("*").forEach(el => {
     const nodes = el.childNodes;
     nodes.forEach(n => {
       if (n.nodeType === 3 && /Room\s*204/i.test(n.textContent)) {
         n.textContent = n.textContent.replace(/Room\s*204/gi, "Room " + room);
       }
     });
   });
 }
 window.applyRoom = applyRoom;

 /* ------------------------------- init ----------------------------- */
 // Periodically check for the 6h inactivity timeout so a page left open idle
 // signs the user out on its own (kiosk is exempt). Uses a non-touching check
 // so the poll itself does NOT reset the inactivity clock.
 function startInactivityCheck() {
   setInterval(() => {
     // Use raw session (non-touching) so the poll doesn't reset the clock.
     if (S.session() && S.sessionExpired()) {
       S.clearSession();
       toast("Signed out after inactivity.", "info");
       renderUserNav();
       if (typeof window.onAuthChange === "function") window.onAuthChange(null);
     }
   }, 30000); // every 30s
 }

 document.addEventListener("DOMContentLoaded", () => {
 S.seedIfEmpty();
 renderUserNav();
 applyRoom();
 startInactivityCheck();
 // #12: PWA — register service worker for offline + installability.
 if ("serviceWorker" in navigator) {
   try { navigator.serviceWorker.register("sw.js").catch(() => {}); } catch (e) {}
 }
 // Set active nav link.
 const here = location.pathname.split("/").pop() || "index.html";
 $$(".nav a[data-page]").forEach((a) => {
 if (a.dataset.page === here) a.classList.add("active");
 });

 // Floating "Scan barcode" button on pages that opt in (catalog, admin).
 if ($("#scan-mode") && window.ScanActions) {
 const fab = document.createElement("button");
 fab.id = "scan-fab";
 fab.className = "btn scan-fab";
 fab.title = "Scan a barcode";
 fab.innerHTML = " <span>Scan</span>";
 fab.addEventListener("click", () => ScanActions.run());
 document.body.appendChild(fab);
 }
 });
})();
