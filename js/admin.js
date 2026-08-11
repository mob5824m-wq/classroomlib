/* admin.js — librarian controls: books, students, loans, holds, policy, pricing. */
(function () {
 const S = Store;

 /* ------------------------------ guard ------------------------------ */
 function isAdmin() {
 const u = S.currentUser();
 return u && u.role === "admin";
 }

 function render() {
 const loggedOut = $("#admin-logged-out");
 const dash = $("#admin-dash");
 if (!isAdmin()) {
 loggedOut.hidden = false;
 dash.hidden = true;
 return;
 }
 loggedOut.hidden = true;
 dash.hidden = false;
 $("#admin-who").textContent = "Signed in as " + S.currentUser().name + ".";
    renderOverview();
    renderAnnouncements();
    renderBooks();
    renderUsers();
    renderLoans();
    renderHolds();
    renderRequests();
    renderCharges();
    renderReminders();
    renderReports();
    renderKiosk();
    renderHomeSettings();
    renderPolicy();
    renderPricing();
    renderAccount();
  }

  /* ----------------------------- account ------------------------------ */
  function renderAccount() {
    const nameInput = $("#account-name");
    if (!nameInput) return;
    const me = S.currentUser();
    nameInput.value = me ? me.name : "";
    $("#account-msg").textContent = "";
    $("#account-form").onsubmit = (e) => {
      e.preventDefault();
      const res = S.updateProfile({ name: nameInput.value });
      if (res.ok) {
        render(); // re-render nav + header (also re-fills the name field)
        $("#account-msg").textContent = "Name updated.";
      } else {
        $("#account-msg").textContent = res.msg;
      }
    };
  }

  /* ----------------------------- reports (#4) -------------------------- */
  function renderReports() {
    const box = $("#reports-holder");
    if (!box) return;
    const st = S.getState();

    const activeLoans = st.loans.filter(l => !l.returned).sort((a, b) => a.dueDate - b.dueDate);
    const overdue = activeLoans.filter(l => S.isOverdue(l, st));
    const popular = [...st.books].sort((a, b) => b.checkoutCount - a.checkoutCount).slice(0, 10);

    // Per-class active loan counts
    const classLoans = {};
    activeLoans.forEach(l => {
      const u = st.users.find(x => x.id === l.userId);
      const k = (u && u.class) || "?";
      classLoans[k] = (classLoans[k] || 0) + 1;
    });

    // Per-student summary
    const perStudent = st.users.filter(u => u.role === "student").map(u => ({
      name: u.name, class: u.class || "", out: S.activeLoansForUser(u.id, st).length,
      total: st.loans.filter(l => l.userId === u.id).length,
      unpaid: (S.chargesForUser(u.id, st).filter(c => !c.paid).reduce((n, c) => n + c.amount, 0)).toFixed(2),
    })).sort((a, b) => (a.class || "").localeCompare(b.class || "") || a.name.localeCompare(b.name));

    const table = (head, rows) => `<div class="table-wrap"><table><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;

    box.innerHTML = `
      <div class="report-block">
        <div class="card-head"><h3>Active loans (who has what)</h3><button class="btn btn-outline btn-sm" data-csv="loans">CSV</button></div>
        ${table("<tr><th>Book</th><th>Student</th><th>Class</th><th>Due</th><th>Status</th></tr>",
          activeLoans.map(l => { const b=st.books.find(x=>x.id===l.bookId); const u=st.users.find(x=>x.id===l.userId);
            return `<tr><td>${esc(b?b.title:"?")}</td><td>${esc(u?u.name:"?")}</td><td>${esc(u?u.class||"":"")}</td><td>${S.fmtDate(l.dueDate)}</td><td>${S.isOverdue(l,st)?`<span class="badge badge-overdue">Overdue</span>`:`<span class="badge badge-avail">Out</span>`}</td></tr>`; }).join("") || `<tr><td colspan="5" class="muted">No active loans.</td></tr>`)}
      </div>
      <div class="report-block" style="margin-top:18px">
        <div class="card-head"><h3>Overdue books</h3><button class="btn btn-outline btn-sm" data-csv="overdue">CSV</button></div>
        ${table("<tr><th>Book</th><th>Student</th><th>Days late</th></tr>",
          overdue.map(l => { const b=st.books.find(x=>x.id===l.bookId); const u=st.users.find(x=>x.id===l.userId);
            return `<tr><td>${esc(b?b.title:"?")}</td><td>${esc(u?u.name:"?")}</td><td>${S.daysLate(l)}</td></tr>`; }).join("") || `<tr><td colspan="3" class="muted">Nothing overdue.</td></tr>`)}
      </div>
      <div class="report-block" style="margin-top:18px">
        <div class="card-head"><h3>Most popular books</h3><button class="btn btn-outline btn-sm" data-csv="popular">CSV</button></div>
        ${table("<tr><th>Title</th><th>Author</th><th>Checkouts</th><th>Rating</th></tr>",
          popular.map(b => `<tr><td>${esc(b.title)}</td><td>${esc(b.author)}</td><td>${b.checkoutCount}</td><td>${b.ratingCount ? S.avgRating(b).toFixed(1) : "—"}</td></tr>`).join(""))}
      </div>
      <div class="report-block" style="margin-top:18px">
        <div class="card-head"><h3>Loans by class</h3><button class="btn btn-outline btn-sm" data-csv="classes">CSV</button></div>
        ${table("<tr><th>Class</th><th>Books out</th></tr>",
          Object.entries(classLoans).sort().map(([k,n]) => `<tr><td>${esc(k)}</td><td>${n}</td></tr>`).join("") || `<tr><td colspan="2" class="muted">No loans.</td></tr>`)}
      </div>
      <div class="report-block" style="margin-top:18px">
        <div class="card-head"><h3>Per-student summary</h3><button class="btn btn-outline btn-sm" data-csv="students">CSV</button></div>
        ${table("<tr><th>Student</th><th>Class</th><th>Out now</th><th>Total checkouts</th><th>Unpaid charges</th></tr>",
          perStudent.map(s => `<tr><td>${esc(s.name)}</td><td>${esc(s.class)}</td><td>${s.out}</td><td>${s.total}</td><td>${money(+s.unpaid)}</td></tr>`).join(""))}
      </div>`;

    box.querySelectorAll("[data-csv]").forEach(btn => btn.addEventListener("click", () => {
      const which = btn.dataset.csv;
      let csv = "";
      if (which === "loans") csv = csvOf(activeLoans.map(l => { const b=st.books.find(x=>x.id===l.bookId); const u=st.users.find(x=>x.id===l.userId); return [b?b.title:"?", u?u.name:"?", u?u.class||"":"", S.fmtDate(l.dueDate), S.isOverdue(l,st)?"Overdue":"Out"]; }), ["Book","Student","Class","Due","Status"]);
      else if (which === "overdue") csv = csvOf(overdue.map(l => { const b=st.books.find(x=>x.id===l.bookId); const u=st.users.find(x=>x.id===l.userId); return [b?b.title:"?", u?u.name:"?", S.daysLate(l)]; }), ["Book","Student","DaysLate"]);
      else if (which === "popular") csv = csvOf(popular.map(b => [b.title, b.author, b.checkoutCount, b.ratingCount ? S.avgRating(b).toFixed(1) : ""]), ["Title","Author","Checkouts","Rating"]);
      else if (which === "classes") csv = csvOf(Object.entries(classLoans).sort(), ["Class","BooksOut"]);
      else if (which === "students") csv = csvOf(perStudent.map(s => [s.name, s.class, s.out, s.total, s.unpaid]), ["Student","Class","OutNow","TotalCheckouts","UnpaidCharges"]);
      downloadCSV(which + "-report.csv", csv);
    }));
    const allBtn = $("#tab-reports [data-export-all-csv]");
    if (allBtn) allBtn.addEventListener("click", () => {
      const all = csvOf(activeLoans.map(l => { const b=st.books.find(x=>x.id===l.bookId); const u=st.users.find(x=>x.id===l.userId); return [b?b.title:"?", u?u.name:"?", S.fmtDate(l.dueDate), S.isOverdue(l,st)?"Overdue":"Out"]; }), ["Book","Student","Due","Status"]);
      downloadCSV("library-report.csv", all);
    });
  }

  function csvOf(rows, headers) {
    const escCell = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    return [headers.map(escCell).join(","), ...rows.map(r => r.map(escCell).join(","))].join("\r\n");
  }
  function downloadCSV(name, text) {
    const blob = new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ------------------------------ kiosk (#3) --------------------------- */
  function renderKiosk() {
    const st = S.getState();
    const on = $("#kiosk-enabled");
    const log = $("#kiosk-log");
    if (!on || !log) return;
    on.checked = st.settings && st.settings.kioskEnabled !== false;
    on.addEventListener("change", () => {
      const st2 = S.getState();
      st2.settings = st2.settings || {}; st2.settings.kioskEnabled = on.checked;
      S.save(st2);
      toast(on.checked ? "Kiosk enabled." : "Kiosk disabled.");
    });
    const entries = (st.kioskLog || []).slice().sort((a, b) => b.time - a.time).slice(0, 50);
    log.innerHTML = entries.length
      ? `<div class="table-wrap"><table><thead><tr><th>When</th><th>Action</th><th>Student</th><th>Book</th></tr></thead><tbody>${entries.map(e => `<tr><td>${S.fmtDate(e.time)} ${new Date(e.time).toLocaleTimeString()}</td><td>${esc(e.action)}</td><td>${esc(e.studentName)}</td><td>${esc(e.bookTitle)}</td></tr>`).join("")}</tbody></table></div>`
      : `<p class="muted">No kiosk activity yet.</p>`;
  }

  /* -------------------------- home settings (#11) ---------------------- */
  function renderHomeSettings() {
    const st = S.getState();
    const sel = $("#featured-book");
    const hide = $("#hide-demo-accounts");
    const demoMode = $("#demo-mode");
    const removeBtn = $("#remove-demo-accounts");
    const demoMsg = $("#demo-msg");
    if (!sel || !hide) return;
    sel.innerHTML = `<option value="">None</option>` + st.books.map(b => `<option value="${b.id}" ${st.settings && st.settings.featuredBookId === b.id ? "selected" : ""}>${esc(b.title)}</option>`).join("");
    hide.checked = !!(st.settings && st.settings.hideDemoAccounts);
    if (demoMode) demoMode.checked = !(st.settings && st.settings.demoMode === false);
    if (removeBtn) removeBtn.addEventListener("click", () => {
      if (!confirm("Remove all demo student accounts (Alex, Mia, Jamal, etc.) and the Kiosk account? Their loans and charges will be removed too.")) return;
      const st2 = S.getState();
      const n = S.removeDemoAccounts(st2);
      if (demoMode) demoMode.checked = false;
      if (demoMsg) demoMsg.textContent = `Removed ${n} demo account${n === 1 ? "" : "s"}.`;
      toast(`Removed ${n} demo account${n === 1 ? "" : "s"}.`);
      render();
    });
    $("#save-home-settings").onclick = () => {
      const st2 = S.getState();
      st2.settings = st2.settings || {};
      st2.settings.featuredBookId = sel.value;
      st2.settings.hideDemoAccounts = hide.checked;
      if (demoMode) st2.settings.demoMode = demoMode.checked;
      S.save(st2);
      toast("Home page settings saved.");
    };
  }

  /* ----------------------------- reminders ---------------------------- */
  function renderReminders() {
    const box = $("#reminders-list");
    if (!box) return;
    box.innerHTML = `<p class="muted">Loading…</p>`;
    const render = (list) => {
      if (!list.length) {
        box.innerHTML = `<div class="empty"><div class="big"></div><p>No overdue books right now.</p></div>`;
        return;
      }
      box.innerHTML = `<div class="table-wrap"><table>
        <thead><tr><th>Student</th><th>Items overdue</th><th>Suggested message</th></tr></thead>
        <tbody>${list.map(g => `<tr>
          <td><strong>${esc(g.user)}</strong><div class="muted small">@${esc(g.username)}</div></td>
          <td>${g.items.map(i => `${esc(i.title)} <span class="badge badge-overdue">${i.daysLate}d</span>`).join("<br>")}</td>
          <td class="small muted" style="max-width:320px">${esc("Hi " + g.user.split(" ")[0] + "! Just a friendly reminder that your library books are due back: " + g.items.map(i => i.title).join(", ") + ". Please return them soon so friends can read them too. Thanks!")}</td>
        </tr>`).join("")}</tbody></table></div>`;
    };
    // Prefer the server's authoritative overdue summary; fall back to local calc.
    if (typeof fetch !== "undefined") {
      fetch("/api/overdue").then(r => r.json()).then(j => render(j.list || [])).catch(() => render(localOverdue()));
    } else {
      render(localOverdue());
    }
  }

  function localOverdue() {
    const st = S.getState();
    const byUser = {};
    st.loans.forEach(l => {
      if (l.returned || !S.isOverdue(l, st)) return;
      const book = st.books.find(b => b.id === l.bookId);
      const u = st.users.find(x => x.id === l.userId);
      if (!book || !u) return;
      (byUser[u.id] = byUser[u.id] || { user: u.name, username: u.username, items: [] }).items.push({ title: book.title, daysLate: S.daysLate(l) });
    });
    return Object.values(byUser);
  }

  function bindReminders() {
    const refresh = $("#tab-reminders [data-refresh-remind]");
    const send = $("#tab-reminders [data-send-remind]");
    if (refresh) refresh.addEventListener("click", renderReminders);
    if (send) send.addEventListener("click", () => {
      if (typeof fetch !== "undefined") {
        fetch("/api/remind", { method: "POST" }).then(() => toast("Reminders logged. Check reminder-log.txt on the server.")).catch(() => toast("Couldn't reach the server for reminders."));
      } else {
        toast("Reminders need the Node server. Run node server.js.");
      }
    });
  }

  /* --------------------------- announcements -------------------------- */
  function renderAnnouncements() {
    const st = S.getState();
    const box = $("#announcements-manage");
    if (!box) return;
    const anns = S.getAnnouncements(st);
    box.innerHTML = anns.length
      ? `<div class="table-wrap"><table>
          <thead><tr><th>Announcement</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody>${anns.map(a => `<tr>
            <td>${esc(a.text)}</td>
            <td class="small muted">${S.fmtDate(a.date)}</td>
            <td><div class="row-actions">
              <button class="btn btn-outline btn-sm" data-edit-ann="${a.id}">Edit</button>
              <button class="btn btn-danger-ghost btn-sm" data-del-ann="${a.id}">Delete</button>
            </div></td>
          </tr>`).join("")}</tbody>
        </table></div>`
      : `<div class="empty"><div class="big"></div><p>No announcements yet. Add one to share news with your class!</p></div>`;

    box.querySelectorAll("[data-edit-ann]").forEach(btn => btn.addEventListener("click", () => announcementForm(btn.dataset.editAnn)));
    box.querySelectorAll("[data-del-ann]").forEach(btn => btn.addEventListener("click", () => {
      const st2 = S.getState();
      S.deleteAnnouncement(btn.dataset.delAnn, st2);
      toast("Announcement deleted.");
      renderAnnouncements();
    }));
    const addBtn = $("#tab-announcements [data-add-announcement]");
    if (addBtn) addBtn.addEventListener("click", () => announcementForm(null));
  }

  function announcementForm(id) {
    const st = S.getState();
    const a = id ? st.announcements.find(x => x.id === id) : null;
    let modal = document.getElementById("announcement-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "announcement-modal";
      modal.className = "modal";
      document.body.appendChild(modal);
    }
    modal.innerHTML = `
      <div class="modal-card" id="announcement-modal-body">
        <button class="modal-x" data-x>&times;</button>
        <h2>${a ? "Edit announcement" : "Add announcement"}</h2>
        <form id="announcement-form">
          <label>Announcement
            <textarea name="text" rows="3" placeholder="What should everyone know?" required>${esc(a ? a.text : "")}</textarea>
          </label>
          <button class="btn btn-primary btn-block" type="submit">${a ? "Save changes" : "Add announcement"}</button>
        </form>
      </div>`;
    modal.classList.add("open");
    const body = modal.querySelector("#announcement-modal-body");
    body.querySelector("[data-x]").addEventListener("click", () => modal.classList.remove("open"));
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("open"); });
    body.querySelector("#announcement-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const text = body.querySelector('[name="text"]').value.trim();
      if (!text) return;
      const st2 = S.getState();
      if (a) S.updateAnnouncement(a.id, text, st2);
      else S.addAnnouncement(text, st2);
      modal.classList.remove("open");
      toast(a ? "Announcement updated." : "Announcement added.");
      renderAnnouncements();
    });
  }

  /* ----------------------------- requests ---------------------------- */
  function renderRequests() {
    const st = S.getState();
    const box = $("#requests-list");
    if (!box) return;
    const reqs = (st.requests || []).slice().sort((a, b) => b.date - a.date);
    if (!reqs.length) {
      box.innerHTML = `<div class="empty"><div class="big"></div><p>No book requests yet.</p></div>`;
      return;
    }
    box.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Title</th><th>Author</th><th>Requested by</th><th>When</th><th>Actions</th></tr></thead>
      <tbody>${reqs.map(r => {
        const u = st.users.find(x => x.id === r.userId);
        const statusBadge = r.status === "approved"
          ? `<span class="badge badge-avail">Approved</span>`
          : r.status === "declined"
            ? `<span class="badge badge-out">Declined</span>`
            : `<span class="badge badge-warn">Pending</span>`;
        return `<tr>
          <td><strong>${esc(r.title)}</strong>${r.isbn ? `<div class="muted small">ISBN ${esc(r.isbn)}</div>` : ""}${r.note ? `<div class="muted small">"${esc(r.note)}"</div>` : ""}</td>
          <td>${esc(r.author || "—")}</td>
          <td>${esc(u ? u.name : "Unknown")}</td>
          <td>${S.fmtDate(r.date)}</td>
          <td>
            <div class="row-actions">
              ${r.status === "pending" ? `
                <button class="btn btn-primary btn-sm" data-approve-req="${r.id}">Add to catalog</button>
                <button class="btn btn-danger-ghost btn-sm" data-decline-req="${r.id}">Decline</button>`
              : `<button class="btn btn-outline btn-sm" data-del-req="${r.id}">Remove</button>`}
            </div>
          </td>
        </tr>`;
      }).join("")}</tbody></table></div>`;

    box.querySelectorAll("[data-approve-req]").forEach(btn => btn.addEventListener("click", () => approveRequest(btn.dataset.approveReq)));
    box.querySelectorAll("[data-decline-req]").forEach(btn => btn.addEventListener("click", () => declineRequest(btn.dataset.declineReq)));
    box.querySelectorAll("[data-del-req]").forEach(btn => btn.addEventListener("click", () => {
      const st2 = S.getState();
      S.removeRequest(btn.dataset.delReq, st2);
      toast("Request removed.");
      renderRequests();
    }));
  }

  function approveRequest(reqId) {
    const st = S.getState();
    const r = st.requests.find(x => x.id === reqId);
    if (!r) return;
    // Open the add-book form pre-filled with the request.
    closeAdminModal($("#user-modal"));
    bookForm(null, { title: r.title, author: r.author, isbn: r.isbn, desc: r.note, _requestId: r.id });
  }

  function declineRequest(reqId) {
    const st = S.getState();
    const r = st.requests.find(x => x.id === reqId);
    if (r) r.status = "declined";
    S.save(st);
    toast("Request declined.");
    renderRequests();
  }

  /* ----------------------------- charges ---------------------------- */
  function renderCharges() {
    const st = S.getState();
    const box = $("#charges-list");
    if (!box) return;
    const charges = (st.charges || []).slice().sort((a, b) => b.date - a.date);
    if (!charges.length) {
      box.innerHTML = `<div class="empty"><div class="big"></div><p>No charges yet. When a book is lost or damaged, charge the student its replacement value here.</p></div>`;
      return;
    }
    box.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Student</th><th>Book</th><th>Amount</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${charges.map(c => {
        const u = st.users.find(x => x.id === c.userId);
        const b = st.books.find(x => x.id === c.bookId);
        const paidBadge = c.paid ? `<span class="badge badge-avail">Paid</span>` : `<span class="badge badge-overdue">Unpaid</span>`;
        return `<tr>
          <td>${esc(u ? u.name : "Unknown")}</td>
          <td>${esc(b ? b.title : "Unknown book")}</td>
          <td><strong>${money(c.amount)}</strong></td>
          <td>${esc(c.reason)}</td>
          <td>${paidBadge}</td>
          <td>${c.paid ? "" : `<button class="btn btn-soft btn-sm" data-pay-charge="${c.id}">Mark paid</button>`}</td>
        </tr>`;
      }).join("")}</tbody></table></div>`;
    box.querySelectorAll("[data-pay-charge]").forEach(btn => btn.addEventListener("click", () => {
      const st2 = S.getState();
      S.markChargePaid(btn.dataset.payCharge, st2);
      toast("Marked as paid.");
      renderCharges();
    }));
  }

 /* ----------------------------- tabs -------------------------------- */
  function bindTabs() {
    $$("#admin-tabs .chip").forEach(chip => chip.addEventListener("click", () => {
      $$(".tab-panel").forEach(p => p.hidden = true);
      $("#tab-" + chip.dataset.tab).hidden = false;
      $$("#admin-tabs .chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
    }));
 $$("[data-goto]").forEach(b => b.addEventListener("click", () => {
 $$(".tab-panel").forEach(p => p.hidden = true);
 $("#tab-" + b.dataset.goto).hidden = false;
 }));
 }

 /* ---------------------------- overview ----------------------------- */
 function renderOverview() {
 const st = S.getState();
 $("#o-books").textContent = st.books.length;
 $("#o-copies").textContent = st.books.reduce((n, b) => n + b.totalCopies, 0);
 $("#o-avail").textContent = st.books.reduce((n, b) => n + S.availableCopies(b.id, st), 0);
 $("#o-out").textContent = st.loans.filter(l =>!l.returned).length;
 $("#o-overdue").textContent = st.loans.filter(l => S.isOverdue(l, st)).length;
 $("#o-students").textContent = st.users.filter(u => u.role === "student").length;
 $("#o-holds").textContent = st.holds.length;

 // Overdue list
 const over = st.loans.filter(l => S.isOverdue(l, st)).sort((a, b) => a.dueDate - b.dueDate);
 const ol = $("#o-overdue-list");
 ol.innerHTML = over.length
 ? `<div class="table-wrap"><table><thead><tr><th>Book</th><th>Student</th><th>Days late</th></tr></thead><tbody>${over.map(l => {
 const b = st.books.find(x => x.id === l.bookId);
 const u = st.users.find(x => x.id === l.userId);
 return `<tr><td>${esc(b.title)}</td><td>${esc(u ? u.name: "?")}</td><td><span class="badge badge-overdue">${S.daysLate(l)}</span></td></tr>`;
 }).join("")}</tbody></table></div>`: `<p class="muted">No overdue books. Nice!</p>`;

 // Popular
 const pop = [...st.books].sort((a, b) => S.popularityScore(b) - S.popularityScore(a)).slice(0, 5);
 $("#o-popular").innerHTML = `<div class="book-grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">${pop.map(b =>
 `<div class="book-card"><div class="body">${bookCover(b, "sm")}<h3>${esc(b.title)}</h3>
 <div class="meta"><span class="badge badge-${S.popularityTier(b, st.books)}">${S.popularityInfo(b, st.books).label}</span>
 <span class="badge" style="background:#eef1f3;color:var(--ink-soft)">${b.checkoutCount} checkouts</span></div></div></div>`).join("")}</div>`;
 }

 /* ------------------------------ books ------------------------------ */
 function renderBooks() {
 const st = S.getState();
 $("#books-tbody").innerHTML = st.books.map(b => `
 <tr>
 <td><strong>${esc(b.title)}</strong><div class="muted small">${esc(b.author)}</div></td>
 <td>${b.totalCopies}</td>
 <td>${S.availableCopies(b.id, st)}</td>
 <td>${esc(S.TYPE_POLICY[b.type].label)}</td>
 <td>${money(b.basePrice)}</td>
 <td>${money(S.replacementPrice(b))}</td>
 <td>
 <div class="row-actions">
 <button class="btn btn-soft btn-sm" data-barcode="${b.id}" title="View barcode"></button>
 <button class="btn btn-soft btn-sm" data-loan-detail="${b.id}" title="View loans &amp; holds"></button>
 <button class="btn btn-outline btn-sm" data-edit-book="${b.id}">Edit</button>
 <button class="btn btn-danger-ghost btn-sm" data-del-book="${b.id}">Delete</button>
 </div>
 </td>
 </tr>`).join("") || `<tr><td colspan="7" class="muted">No books yet.</td></tr>`;

 $$("[data-edit-book]").forEach(x => x.addEventListener("click", () => bookForm(x.dataset.editBook)));
 $$("[data-del-book]").forEach(x => x.addEventListener("click", () => deleteBook(x.dataset.delBook)));
 $$("[data-barcode]").forEach(x => x.addEventListener("click", () => barcodePopup(x.dataset.barcode)));
 $$("[data-loan-detail]").forEach(x => x.addEventListener("click", () => ScanActions.showResult(x.dataset.loanDetail)));
    $$("[data-add-book]").forEach(x => x.addEventListener("click", () => bookForm(null)));
    $$("[data-autofill-all]").forEach(x => x.addEventListener("click", autofillAllDescriptions));
    $$("[data-print-barcodes]").forEach(x => x.addEventListener("click", printBarcodes));
  }

  // #6: printable sheet of every book's barcode + title for labeling.
  function printBarcodes() {
    const st = S.getState();
    let sheet = document.getElementById("barcode-sheet");
    if (!sheet) {
      sheet = document.createElement("div");
      sheet.id = "barcode-sheet";
      sheet.className = "barcode-sheet";
      document.body.appendChild(sheet);
    }
    // Build with real DOM nodes and append the ACTUAL canvas elements (whose
    // pixels hold the barcode). Using c.outerHTML would drop the drawn pixels.
    sheet.innerHTML = "";
    const heading = document.createElement("h2");
    heading.className = "bc-sheet-heading";
    heading.textContent = "Room 204 Library — Barcodes";
    sheet.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "bc-grid";
    st.books.forEach(b => {
      const item = document.createElement("div");
      item.className = "bc-item";
      const title = document.createElement("div");
      title.className = "bc-title";
      title.textContent = b.title;
      const canvas = document.createElement("canvas");
      Barcode.draw(canvas, b.isbn, { scale: 2, height: 60 });
      const isbn = document.createElement("div");
      isbn.className = "bc-isbn";
      isbn.textContent = b.isbn;
      item.appendChild(title);
      item.appendChild(canvas);
      item.appendChild(isbn);
      grid.appendChild(item);
    });
    sheet.appendChild(grid);
    window.print();
  }

 async function autofillAllDescriptions() {
 const st = S.getState();
 const missing = st.books.filter(b =>!(b.desc && b.desc.trim()));
 if (!missing.length) { toast("All books already have descriptions ", "success"); return; }
 toast(`Fetching descriptions for ${missing.length} book${missing.length === 1 ? "": "s"}…`, "info");
 let filled = 0;
 for (const b of missing) {
 if (await Covers.enrichDescription(b)) filled++;
 }
 toast(`Added ${filled} description${filled === 1 ? "": "s"} from Open Library `, "success");
 render();
 }

 function bookForm(id, prefill) {
 const st = S.getState();
 const b = id ? st.books.find(x => x.id === id): null;
 prefill = prefill || {};
 const p = b || prefill;
 const requestId = prefill._requestId;
 const body = $("#book-modal-body");
 body.innerHTML = `
 <button class="modal-x" data-x>&times;</button>
 <h2>${b ? "Edit book": (prefill.title ? "Add requested book": "Add a book")}</h2>
 <form id="book-form">
 <label>Title <input name="title" value="${esc(p.title || "")}" required></label>
 <label>Author <input name="author" value="${esc(p.author || "")}" required></label>
 <label>ISBN (13 digits)
 <div style="display:flex;gap:6px">
 <input name="isbn" value="${esc(p.isbn || "")}" pattern="[0-9]{13}" title="13-digit ISBN" required style="flex:1">
 <button type="button" class="btn btn-soft btn-sm" id="fetch-price" title="Look up the retail price by ISBN">Fetch price</button>
 </div>
 </label>
 <div class="filters" style="align-items:flex-end">
 <div class="field"><label>Genre</label><select name="genre">${S.GENRES.map(g => `<option value="${g}" ${b && b.genre === g ? "selected": ""}>${g}</option>`).join("")}</select></div>
 <div class="field"><label>Type</label><select name="type">${Object.entries(S.TYPE_POLICY).map(([k, v]) => `<option value="${k}" ${b && b.type === k ? "selected": ""}>${v.label}</option>`).join("")}</select></div>
 <div class="field"><label>Condition</label><select name="condition">${Object.entries(S.CONDITION_FACTOR).map(([k, v]) => `<option value="${k}" ${b && b.condition === k ? "selected": ""}>${v.label}</option>`).join("")}</select></div>
 </div>
 <div class="filters" style="align-items:flex-end">
 <div class="field"><label>Total copies</label><input name="copies" type="number" min="1" value="${b ? b.totalCopies: 1}" required></div>
 <div class="field" style="flex:1"><label>Base price (USD, shown in CAD)</label>
 <input name="basePrice" type="number" min="0" step="0.01" value="${b ? b.basePrice: 10}" required>
 <span class="small muted" id="price-status"></span>
 </div>
 <div class="field"><label>Popularity (checkouts)</label><input name="checkoutCount" type="number" min="0" value="${b ? b.checkoutCount: 0}"></div>
 </div>
 <label>Short description <textarea name="desc" rows="2" placeholder="Why readers will love this book…">${esc(b ? b.desc: (p.desc || ""))}</textarea></label>
 <button class="btn btn-primary btn-block" type="submit">${b ? "Save changes": "Add book"}</button>
 </form>`;
 openModal($("#book-modal"));
 body.querySelector("[data-x]").addEventListener("click", () => closeModal($("#book-modal")));
 // Auto-fetch retail price by ISBN (via Google Books) when "Fetch price" is
 // clicked or when a valid ISBN is pasted into the field.
 const fetchBtn = body.querySelector("#fetch-price");
 const isbnInput = body.querySelector('[name="isbn"]');
 const priceInput = body.querySelector('[name="basePrice"]');
 const priceStatus = body.querySelector("#price-status");
 async function doFetchPrice() {
   const isbn = isbnInput.value.replace(/[^0-9]/g, "");
   if (isbn.length !== 13) { priceStatus.textContent = "Enter a valid 13-digit ISBN first."; return; }
   priceStatus.textContent = "Looking up price…";
   const found = await Covers.fetchPriceByISBN(isbn);
   if (found) {
     priceInput.value = found.usd.toFixed(2);
     priceStatus.textContent = `Retail: ${found.currencyCode === "CAD" ? "$" + found.amount.toFixed(2) + " CAD" : "$" + found.amount.toFixed(2)} → stored $${found.usd.toFixed(2)} USD`;
     toast("Price filled in from Google Books.", "success");
   } else {
     priceStatus.textContent = "No price found. Enter it manually.";
   }
 }
 if (fetchBtn) fetchBtn.addEventListener("click", (e) => { e.preventDefault(); doFetchPrice(); });
 if (isbnInput) isbnInput.addEventListener("blur", () => {
   const digits = isbnInput.value.replace(/[^0-9]/g, "");
   if (digits.length === 13 && !priceInput.value) doFetchPrice();
 });
 $("#book-form").addEventListener("submit", e => {
 e.preventDefault();
 const f = e.target;
 const data = Object.fromEntries(new FormData(f).entries());
 if (!b) {
 st.books.push({
 id: S.uid(), title: data.title.trim(), author: data.author.trim(),
 genre: data.genre, type: data.type, isbn: data.isbn,
 totalCopies: +data.copies, basePrice: +data.basePrice,
 condition: data.condition, checkoutCount: +data.checkoutCount,
 recentCheckouts: 0, desc: data.desc.trim(), addedOn: Date.now(),
 });
 if (requestId) { const r = st.requests.find(x => x.id === requestId); if (r) r.status = "approved"; }
 toast("Book added to the library! ", "success");
 } else {
 Object.assign(b, {
 title: data.title.trim(), author: data.author.trim(), genre: data.genre,
 type: data.type, isbn: data.isbn, totalCopies: +data.copies,
 basePrice: +data.basePrice, condition: data.condition,
 checkoutCount: +data.checkoutCount, desc: data.desc.trim(),
 });
 toast("Book updated ", "success");
 }
 S.save(st);
 closeModal($("#book-modal"));
 render();
 });
 }

 function deleteBook(id) {
 const st = S.getState();
 const b = st.books.find(x => x.id === id);
 if (!confirm(`Delete "${b.title}" and remove it from the catalog?`)) return;
 st.books = st.books.filter(x => x.id!== id);
 st.loans = st.loans.filter(l => l.bookId!== id);
 st.holds = st.holds.filter(h => h.bookId!== id);
 S.save(st);
 toast("Book deleted.", "success");
 render();
 }

 /* ------------------------------ users ------------------------------ */
 function renderUsers() {
 const st = S.getState();
 $("#users-tbody").innerHTML = st.users.map(u => {
 const out = S.activeLoansForUser(u.id, st).length;
 const roleBadge = u.role === "admin"
 ? `<span class="badge badge-admin">Admin</span>`: `<span class="badge" style="background:var(--blue-soft);color:var(--blue)">Student</span>`;
 return `<tr>
 <td><strong>${esc(u.name)}</strong></td>
 <td>${esc(u.username)}</td>
 <td>${esc(u.grade || "—")}</td>
 <td>${esc(u.class || "—")}</td>
 <td>${roleBadge}</td>
 <td>${out}</td>
 <td>
 <div class="row-actions">
 <button class="btn btn-outline btn-sm" data-edit-user="${u.id}">Edit</button>
 <button class="btn btn-danger-ghost btn-sm" data-del-user="${u.id}" ${u.role === "admin" ? "disabled": ""}>Delete</button>
 </div>
 </td>
 </tr>`;
 }).join("") || `<tr><td colspan="7" class="muted">No accounts yet.</td></tr>`;

 $$("[data-edit-user]").forEach(x => x.addEventListener("click", () => userForm(x.dataset.editUser)));
 $$("[data-del-user]").forEach(x => x.addEventListener("click", () => deleteUser(x.dataset.delUser)));
 $$("[data-add-user]").forEach(x => x.addEventListener("click", () => userForm(null)));
 $$("[data-bulk-users]").forEach(x => x.addEventListener("click", () => bulkForm()));
 }

 function userForm(id) {
 const st = S.getState();
 const u = id ? st.users.find(x => x.id === id): null;
 const body = $("#user-modal-body");
 body.innerHTML = `
 <button class="modal-x" data-x>&times;</button>
 <h2>${u ? "Edit account": "Add a student"}</h2>
 <form id="user-form">
 <label>Full name <input name="name" value="${esc(u ? u.name: "")}" required ${u ? "": "placeholder='e.g. Ava Jones'"}> </label>
 <label>Username
 <div style="display:flex;gap:6px">
 <input name="username" value="${esc(u ? u.username: "")}" required ${u ? "readonly style='background:#f2f4f5'": ""} style="flex:1">
 ${u ? "": `<button type="button" class="btn btn-soft btn-sm" id="suggest-username" title="Suggest a username"></button>`}
 </div>
 </label>
 <div class="filters" style="align-items:flex-end">
 <div class="field" style="flex:1"><label>Grade</label><input name="grade" value="${esc(u ? u.grade: "")}" placeholder="7th Grade"></div>
 <div class="field"><label>Class</label>
 <select name="class">${S.CLASSES.map(c => `<option value="${c}" ${u && u.class === c ? "selected": ""}>${c}</option>`).join("")}</select>
 </div>
 <div class="field"><label>Role</label>
 <select name="role"><option value="student" ${u && u.role === "student" ? "selected": ""}>Student</option>
 <option value="admin" ${u && u.role === "admin" ? "selected": ""}>Admin</option></select>
 </div>
 </div>
 <label>Password ${u ? "<span class='muted small'>Leave blank to keep current.</span>": "<span class='muted small'>Generated for you, but you can change it.</span>"}
 <div style="display:flex;gap:6px">
 <input name="password" type="text" ${u ? "": "required"} value="${u ? "": genPassword()}" placeholder="${u ? "New password (optional)": ""}" style="flex:1">
 <button type="button" class="btn btn-soft btn-sm" id="gen-password" title="Generate a new password"></button>
 </div>
 </label>
 <button class="btn btn-primary btn-block" type="submit">${u ? "Save changes": "Add student"}</button>
 </form>`;
 if (!u) {
 const suggestBtn = body.querySelector("#suggest-username");
 suggestBtn.addEventListener("click", () => {
 const name = body.querySelector('[name="name"]').value.trim();
 if (!name) { toast("Enter a name first.", "error"); return; }
 body.querySelector('[name="username"]').value = uniqueUsername(S.getState(), name);
 });
 body.querySelector('[name="name"]').addEventListener("input", e => {
 const name = e.target.value.trim();
 if (name) body.querySelector('[name="username"]').value = uniqueUsername(S.getState(), name);
 });
 }
 const genBtn = body.querySelector("#gen-password");
 if (genBtn) genBtn.addEventListener("click", () => {
 body.querySelector('[name="password"]').value = genPassword();
 });
 openModal($("#user-modal"));
 body.querySelector("[data-x]").addEventListener("click", () => closeModal($("#user-modal")));
 $("#user-form").addEventListener("submit", e => {
 e.preventDefault();
 const f = e.target;
 const data = Object.fromEntries(new FormData(f).entries());
 if (!u) {
 if (st.users.find(x => x.username.toLowerCase() === data.username.trim().toLowerCase())) {
 toast("That username is already taken.", "error"); return;
 }
 st.users.push({ id: S.uid(), name: data.name.trim(), username: data.username.trim(),
 password: data.password, role: data.role, grade: data.grade.trim(), class: data.class });
 toast("Student added ", "success");
 } else {
 u.name = data.name.trim(); u.grade = data.grade.trim(); u.role = data.role; u.class = data.class;
 if (data.password) u.password = data.password;
 toast("Account updated ", "success");
 }
 S.save(st);
 closeModal($("#user-modal"));
 render();
 });
 }

 /* ------------------------- username/password helpers ------------------ */
 function slugFromName(name) {
 const base = name.toLowerCase().trim().split(/\s+/);
 return (base[0] || "student") + (base[1] ? base[1][0]: "");
 }
 function uniqueUsername(st, name) {
 let u = slugFromName(name), i = 1, base = u;
 while (st.users.find(x => x.username.toLowerCase() === u.toLowerCase())) {
 u = base + (i++);
 }
 return u;
 }
 function genPassword() {
 const chars = "abcdefghjkmnpqrstuvwxyz23456789";
 let out = "";
 for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
 return out;
 }

 /* ---------------------------- bulk add ------------------------------- */
 function bulkForm() {
 const body = $("#bulk-modal-body");
 body.innerHTML = `
 <button class="modal-x" data-x>&times;</button>
 <h2> Bulk add students</h2>
 <p class="muted small">Add one student per line:</p>
 <ul class="small muted" style="padding-left:18px">
 <li><code>Full Name</code> — default class 7A</li>
 <li><code>Full Name | Class</code> — e.g. <code>Ava Jones | 8B</code></li>
 </ul>
 <textarea id="bulk-text" rows="8" placeholder="Ava Jones&#10;Noah Kim&#10;Grace Lee | 7th Grade"></textarea>
 <div class="filters">
 <div class="field" style="flex:1"><label>Default password</label><input id="bulk-password" value="read123"></div>
 </div>
 <button class="btn btn-primary btn-block" id="bulk-go">Create accounts</button>
 <div id="bulk-result"></div>`;
 openModal($("#bulk-modal"));
 body.querySelector("[data-x]").addEventListener("click", () => closeModal($("#bulk-modal")));
 $("#bulk-go").addEventListener("click", () => {
 const st = S.getState();
 const lines = $("#bulk-text").value.split("\n").map(s => s.trim()).filter(Boolean);
 const defaultPw = $("#bulk-password").value.trim() || "read123";
 const created = [];
 let dupes = 0;
 lines.forEach(line => {
 const parts = line.split("|").map(s => s.trim());
 const name = parts[0];
 const klass = (parts[1] && S.CLASSES.includes(parts[1])) ? parts[1] : "7A";
 if (!name) return;
 const username = uniqueUsername(st, name);
 const password = genPassword();
 st.users.push({ id: S.uid(), name, username, password, role: "student", grade: "", class: klass });
 created.push({ name, username, password, class: klass });
 });
 S.save(st);
 $("#bulk-result").innerHTML = `
 <div class="callout" style="margin-top:12px"><span></span><div><strong>${created.length} account${created.length === 1 ? "": "s"} created!</strong> Share these usernames &amp; passwords with your students:</div></div>
 <div class="table-wrap" style="margin-top:10px">
 <table>
 <thead><tr><th>Name</th><th>Username</th><th>Password</th><th>Class</th></tr></thead>
 <tbody>${created.map(c => `<tr><td>${esc(c.name)}</td><td>${esc(c.username)}</td><td>${esc(c.password)}</td><td>${esc(c.class)}</td></tr>`).join("")}</tbody>
 </table>
 </div>
 <button class="btn btn-soft btn-block" style="margin-top:10px" data-x-2>Done</button>`;
 body.querySelector("[data-x-2]").addEventListener("click", () => { closeModal($("#bulk-modal")); render(); });
 render();
 });
 }

 function deleteUser(id) {
 const st = S.getState();
 const u = st.users.find(x => x.id === id);
 if (u.role === "admin") { toast("You can't delete the admin account.", "error"); return; }
 if (!confirm(`Delete account for "${u.name}"? Their loans and holds will be removed.`)) return;
 st.users = st.users.filter(x => x.id!== id);
 st.loans = st.loans.filter(l => l.userId!== id);
 st.holds = st.holds.filter(h => h.userId!== id);
 S.save(st);
 toast("Account deleted.", "success");
 render();
 }

 /* ------------------------------ loans ------------------------------ */
 function renderLoans() {
 const st = S.getState();
 const active = st.loans.filter(l =>!l.returned).sort((a, b) => a.dueDate - b.dueDate);
 $("#loans-tbody").innerHTML = active.map(l => {
 const b = st.books.find(x => x.id === l.bookId);
 const u = st.users.find(x => x.id === l.userId);
 const overdue = S.isOverdue(l, st);
 const status = overdue
 ? `<span class="badge badge-overdue">Overdue ${S.daysLate(l)}d</span>`: `<span class="badge badge-avail">Due ${S.fmtDate(l.dueDate)}</span>`;
 return `<tr>
 <td><strong>${esc(b ? b.title: "?")}</strong></td>
 <td>${esc(u ? u.name: "?")}</td>
 <td>${S.fmtDate(l.dueDate)}</td>
 <td>${status}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-primary btn-sm" data-return="${l.id}">Mark returned</button>
          <button class="btn btn-danger-ghost btn-sm" data-charge-loss="${l.id}">Charge for loss</button>
        </div>
      </td>
 </tr>`;
 }).join("") || `<tr><td colspan="5" class="muted">No active loans.</td></tr>`;

 const ret = st.loans.filter(l => l.returned).sort((a, b) => b.returnDate - a.returnDate).slice(0, 20);
 $("#returns-tbody").innerHTML = ret.map(l => {
 const b = st.books.find(x => x.id === l.bookId);
 const u = st.users.find(x => x.id === l.userId);
 return `<tr><td><strong>${esc(b ? b.title: "?")}</strong></td><td>${esc(u ? u.name: "?")}</td><td>${S.fmtDate(l.returnDate)}</td></tr>`;
 }).join("") || `<tr><td colspan="3" class="muted">No returns yet.</td></tr>`;

 $$("[data-return]").forEach(x => x.addEventListener("click", () => {
 const st2 = S.getState();
 const res = S.returnLoan(x.dataset.return, st2);
 toast(res.ok ? "Marked as returned ": res.msg, res.ok ? "success": "error");
 render();
 }));
 $$("[data-charge-loss]").forEach(x => x.addEventListener("click", () => {
 const st2 = S.getState();
 const loan = st2.loans.find(l => l.id === x.dataset.chargeLoss);
 if (!loan) return;
 const res = S.addCharge(loan.bookId, loan.userId, "Lost / damaged book", st2);
 toast(res.ok ? `Charged ${money(res.charge.amount)} for the lost/damaged book.`: res.msg, res.ok ? "success": "error");
 render();
 }));
 }

 /* ------------------------------ holds ------------------------------ */
 function renderHolds() {
 const st = S.getState();
 const grouped = {};
 st.holds.forEach(h => { (grouped[h.bookId] = grouped[h.bookId] || []).push(h); });
 const rows = [];
 Object.entries(grouped).forEach(([bookId, hs]) => {
 hs.sort((a, b) => a.placedDate - b.placedDate).forEach((h, i) => {
 const b = st.books.find(x => x.id === bookId);
 const u = st.users.find(x => x.id === h.userId);
 rows.push(`<tr>
 <td><strong>${esc(b ? b.title: "?")}</strong></td>
 <td>${esc(u ? u.name: "?")}</td>
 <td>${S.fmtDate(h.placedDate)}</td>
 <td><span class="badge badge-hold">#${i + 1}</span></td>
 <td><button class="btn btn-danger-ghost btn-sm" data-del-hold="${h.id}">Remove</button></td>
 </tr>`);
 });
 });
 $("#holds-tbody").innerHTML = rows.join("") || `<tr><td colspan="5" class="muted">No holds right now.</td></tr>`;
 $$("[data-del-hold]").forEach(x => x.addEventListener("click", () => {
 const st2 = S.getState();
 S.removeHold(x.dataset.delHold, st2);
 toast("Hold removed.", "success");
 render();
 }));
 }

 /* ----------------------------- policy ------------------------------ */
 function renderPolicy() {
 const st = S.getState();
 $("#policy-type-tbody").innerHTML = Object.entries(S.TYPE_POLICY).map(([k, v]) =>
 `<tr><td>${v.label}</td><td><input type="number" class="policy-days" data-type="${k}" value="${v.baseDays}" min="1" max="60" style="width:90px"></td></tr>`).join("");
 $("#p-maxloans").value = st.settings.maxLoansPerStudent;
 $("#p-maxholds").value = st.settings.maxHoldsPerStudent;
 $("#p-grace").value = st.settings.overdueGraceDays;

 $("#save-policy").onclick = () => {
 const st2 = S.getState();
 $$(".policy-days").forEach(inp => { S.TYPE_POLICY[inp.dataset.type].baseDays = +inp.value; });
 st2.settings.maxLoansPerStudent = +$("#p-maxloans").value;
 st2.settings.maxHoldsPerStudent = +$("#p-maxholds").value;
 st2.settings.overdueGraceDays = +$("#p-grace").value;
 S.save(st2);
 toast("Loan policy saved ", "success");
 render();
 };
 }

 /* ----------------------------- pricing ----------------------------- */
 function renderPricing() {
 const st = S.getState();
 $("#cond-tbody").innerHTML = Object.entries(S.CONDITION_FACTOR).map(([k, v]) =>
 `<tr><td>${v.label}</td><td><input type="number" class="cond-mult" data-cond="${k}" value="${v.factor}" min="0" max="2" step="0.05" style="width:90px"></td></tr>`).join("");
 $("#save-condition").onclick = () => {
 $$(".cond-mult").forEach(inp => { S.CONDITION_FACTOR[inp.dataset.cond].factor = +inp.value; });
 toast("Pricing rules saved ", "success");
 render();
 };
 }

 /* ------------------------------ barcode ---------------------------- */
 function barcodePopup(bookId) {
 const st = S.getState();
 const b = st.books.find(x => x.id === bookId);
 const m = document.createElement("div");
 m.className = "modal open";
 m.innerHTML = `
 <div class="modal-card barcode-card">
 <button class="modal-x" data-x>&times;</button>
 <h2>${esc(b.title)}</h2>
 <canvas id="bc-admin"></canvas>
 <div class="barcode-actions">
 <button class="btn btn-primary btn-sm" data-dl> Download PNG</button>
 <button class="btn btn-outline btn-sm" data-x>Close</button>
 </div>
 </div>`;
 document.body.appendChild(m);
 Barcode.draw($("#bc-admin", m), b.isbn, { scale: 2, height: 70 });
 m.querySelector("[data-dl]").addEventListener("click", () => Barcode.download(b.isbn, b.title));
 m.querySelectorAll("[data-x]").forEach(x => x.addEventListener("click", () => m.remove()));
 m.addEventListener("click", e => { if (e.target === m) m.remove(); });
 }

 /* ------------------------------ modal ------------------------------ */
 function openModal(m) { m.classList.add("open"); }
 function closeModal(m) { m.classList.remove("open"); }
 window.openAdminModal = openModal;
 window.closeAdminModal = closeModal;

 /* ------------------------------ reset ------------------------------ */
 function bindReset() {
 $("#reset-data").addEventListener("click", () => {
 if (!confirm("Reset ALL demo data to the starting point? This cannot be undone.")) return;
 S.resetAll();
 S.clearSession();
 toast("Demo data reset. Please sign in again.", "success");
 setTimeout(() => location.reload(), 900);
 });
 }

 /* ------------------------------- init ------------------------------ */
  function init() {
    bindTabs();
    bindReset();
    bindReminders();
    render();
 window.onAuthChange = render;
 // Pull real descriptions from Open Library for any book missing one.
 if (window.Covers && typeof Covers.autoEnrichAll === "function") {
 Covers.autoEnrichAll().then(render);
 }
 $("#book-modal").addEventListener("click", e => { if (e.target === $("#book-modal")) closeModal($("#book-modal")); });
 $("#user-modal").addEventListener("click", e => { if (e.target === $("#user-modal")) closeModal($("#user-modal")); });
 $("#bulk-modal").addEventListener("click", e => { if (e.target === $("#bulk-modal")) closeModal($("#bulk-modal")); });
 }

 if (document.readyState!== "loading") init(); else document.addEventListener("DOMContentLoaded", init);
})();
