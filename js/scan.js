/* ============================================================
 * scan.js — what happens after a barcode is scanned.
 * - find the book
 * - students: check out / return / hold
 * - admins: check out to any student, return a copy, and
 * see full loan & hold details for the book
 * ============================================================ */
const ScanActions = (function () {
 const S = window.Store;

 // EAN-13 check digit for a 12-digit body (self-contained, no Barcode dep).
 function eanCheck(body) {
 if (!/^\d{12}$/.test(body)) return null;
 let sum = 0;
 for (let i = 0; i < 12; i++) sum += parseInt(body[i], 10) * (i % 2 === 0 ? 1: 3);
 return (10 - (sum % 10)) % 10;
 }

 // Convert a 10-digit ISBN-10 to its 13-digit ISBN-13 (EAN-13) form.
 function isbn10to13(isbn10) {
 if (!/^\d{10}$/.test(isbn10)) return null;
 const body = "978" + isbn10.slice(0, 9);
 const check = eanCheck(body);
 if (check == null) return null;
 return body + String(check);
 }

 function lookupBook(code) {
 const digits = Scanner.normalize(code);
 if (!digits) return null;
 // Candidate EAN-13 forms to try (handles ISBN-10 typed codes, code 39
 // prefixes, etc.).
 const candidates = new Set([digits]);
 if (digits.length === 13) candidates.add(digits.slice(0, 12)); // drop a stray check digit
 if (digits.length === 12) candidates.add(digits); // raw 12-digit EAN body
 if (digits.length === 10) {
 const c = isbn10to13(digits);
 if (c) candidates.add(c);
 }
 // A leading digit can indicate bookland/prefix — also try without first digit.
 if (digits.length === 14) candidates.add(digits.slice(1));
 if (digits.length === 15) candidates.add(digits.slice(1, 14));

 const st = S.getState();
 return st.books.find(b => {
 const bib = String(b.isbn || "").replace(/[^0-9]/g, "");
 if (candidates.has(bib.slice(0, 13))) return true;
 if (bib.length === 10) {
 const conv = isbn10to13(bib);
 if (conv && candidates.has(conv)) return true;
 }
 return false;
 }) || null;
 }

 async function run() {
 const code = await Scanner.open();
 if (!code) return;
 const book = lookupBook(code);
 if (!book) {
 toast(`No book found for barcode "${code}". Try again or check the number.`, "error");
 return;
 }
 showResult(book.id);
 }

 function showResult(bookId) {
 const m = document.createElement("div");
 m.className = "modal open";
 m.id = "scan-result-modal";
 m.innerHTML = `<div class="modal-card wide" id="scan-result-body"></div>`;
 document.body.appendChild(m);
 m.addEventListener("click", e => { if (e.target === m) m.remove(); });
 renderResult(m, bookId);
 }

 function renderResult(m, bookId) {
 const st = S.getState();
 const book = st.books.find(b => b.id === bookId);
 if (!book) { m.remove(); return; }
 const user = S.currentUser();
 const isAdmin = user && user.role === "admin";
 const body = m.querySelector("#scan-result-body");

 const reviews = S.reviewsFor(book.id, st).slice(0, 2);
 const reviewHTML = reviews.length
 ? reviews.map(r => {
 const u = st.users.find(x => x.id === r.userId);
 return `<div class="review"><div class="small">${S.starHTML(r.rating)} <strong>${esc(u ? u.name.split(" ")[0]: "Reader")}</strong></div><div class="muted small">${esc(r.text)}</div></div>`;
 }).join(""): `<p class="muted small">No reviews yet — be the first!</p>`;

 let actionsHTML = "";
 if (isAdmin) {
 actionsHTML = adminActions(st, book);
 } else if (user) {
 actionsHTML = studentActions(st, book, user);
 } else {
 actionsHTML = `<button class="btn btn-primary btn-block" data-checkout="${book.id}">Check out</button>`;
 }

 body.innerHTML = `
 <button class="modal-x" data-close>&times;</button>
 <div style="display:flex;gap:18px;flex-wrap:wrap">
 <div style="min-width:130px;flex:0 0 150px">${bookCover(book)}</div>
 <div style="flex:1;min-width:260px">
 <h2 style="margin-top:0">${esc(book.title)}</h2>
 <div class="author muted" style="margin-bottom:8px">by ${esc(book.author)}</div>
 <div class="meta" style="margin-bottom:10px">
 <span class="stars">${S.starHTML(S.avgRating(book))}</span>
 <span class="small muted">${book.ratingCount || 0} rating${book.ratingCount === 1 ? "": "s"}</span>
 </div>
 <div class="meta" style="margin-bottom:10px">
 ${availBadge(book.id)}
 <span class="badge" style="background:#eef1f3;color:var(--ink-soft)">${book.totalCopies} copy${book.totalCopies === 1 ? "": "s"}</span>
 </div>
 <div id="scan-actions" style="display:flex;flex-direction:column;gap:8px;margin-top:10px">${actionsHTML}</div>
 </div>
 </div>
 <hr style="border:none;border-top:1px solid var(--line);margin:18px 0">
 <h3> Recent reviews</h3>
 <div style="display:flex;flex-direction:column;gap:8px">${reviewHTML}</div>
 ${isAdmin ? adminDetails(st, book): ""}
 `;

 body.querySelector("[data-close]").addEventListener("click", () => m.remove());
 bindActions(m, book.id, renderResult);
 }

 /* -------------------------- student actions -------------------------- */
 function studentActions(st, book, user) {
 const avail = S.availableCopies(book.id, st);
 const can = S.canCheckout(book.id, user.id, st);
 const mine = S.activeLoansForUser(user.id, st).find(l => l.bookId === book.id);
 const myHold = st.holds.find(h => h.bookId === book.id && h.userId === user.id);
 let out = "";

 if (mine) {
 out += `<button class="btn btn-primary" data-return="${mine.id}"> Return my copy (due ${S.fmtDate(mine.dueDate)})</button>`;
 } else if (can) {
 out += `<button class="btn btn-primary" data-checkout="${book.id}"> Check out to me</button>`;
 } else if (myHold) {
 const pos = S.holdPosition(myHold.id, st);
 out += `<div class="callout"><span></span><div><strong>You're #${pos} in line!</strong> We'll hold it for you when it's back.</div></div>`;
 out += `<button class="btn btn-danger-ghost" data-cancel-hold="${myHold.id}">Cancel my hold</button>`;
 } else if (avail <= 0 ||!can) {
 out += `<button class="btn btn-amber" data-hold="${book.id}"> Place a hold</button>`;
 }
 return out;
 }

 /* --------------------------- admin actions -------------------------- */
 function adminActions(st, book) {
 const students = st.users.filter(u => u.role === "student");
 const active = st.loans.filter(l => l.bookId === book.id &&!l.returned);
 const studentOpts = students.map(u =>
 `<option value="${u.id}" ${active.some(l => l.userId === u.id) ? "disabled title='Already has a copy'": ""}>${esc(u.name)}</option>`).join("");

 return `
 <div class="card" style="padding:12px">
 <strong style="font-size:.9rem"> Check out to a student</strong>
 <div class="filters" style="margin:8px 0 0">
 <select id="scan-student" style="flex:1">${studentOpts}</select>
 <button class="btn btn-primary btn-sm" data-checkout="${book.id}">Check out</button>
 </div>
 <div class="filters" style="margin-top:8px;align-items:center">
   <select id="scan-return-loan" style="flex:1">
    ${active.length ? active.map(l => {
    const u = st.users.find(x => x.id === l.userId);
    return `<option value="${l.id}">${esc(u ? u.name: "?")} · due ${S.fmtDate(l.dueDate)}</option>`;
    }).join(""): `<option value="">No active loans</option>`}
   </select>
   <button class="btn btn-soft btn-sm" data-return-select ${active.length ? "": "disabled"}>Return</button>
   </div>
   <div class="filters" style="margin-top:8px">
   <span class="small muted" style="flex:1;align-self:center">Lost or damaged? Charge the selected student the replacement value (${money(S.replacementPrice(book))}).</span>
   <button class="btn btn-danger-ghost btn-sm" data-charge-scan="${book.id}">Charge for loss</button>
   </div>
   </div>`;
 }

 function adminDetails(st, book) {
 const active = st.loans.filter(l => l.bookId === book.id &&!l.returned);
 const holds = st.holds.filter(h => h.bookId === book.id).sort((a, b) => a.placedDate - b.placedDate);
 const loanRows = active.map(l => {
 const u = st.users.find(x => x.id === l.userId);
 const overdue = S.isOverdue(l, st);
 return `<tr><td>${esc(u ? u.name: "?")}</td><td>${S.fmtDate(l.checkoutDate)}</td><td>${S.fmtDate(l.dueDate)}</td>
 <td>${overdue ? `<span class="badge badge-overdue">Overdue ${S.daysLate(l)}d</span>`: `<span class="badge badge-avail">Active</span>`}</td>
 <td><button class="btn btn-primary btn-sm" data-return="${l.id}">Return</button></td></tr>`;
 }).join("");
 const holdRows = holds.map((h, i) => {
 const u = st.users.find(x => x.id === h.userId);
 return `<tr><td>${esc(u ? u.name: "?")}</td><td>${S.fmtDate(h.placedDate)}</td>
 <td><span class="badge badge-hold">#${i + 1}</span></td>
 <td><button class="btn btn-danger-ghost btn-sm" data-cancel-hold="${h.id}">Remove</button></td></tr>`;
 }).join("");
 return `
 <hr style="border:none;border-top:1px solid var(--line);margin:18px 0">
 <h3> Loan & hold details</h3>
 <h4 class="muted" style="margin-bottom:6px">Active loans (${active.length})</h4>
 <div class="table-wrap"><table><thead><tr><th>Student</th><th>Checked out</th><th>Due</th><th>Status</th><th></th></tr></thead>
 <tbody>${loanRows || `<tr><td colspan="5" class="muted">No active loans.</td></tr>`}</tbody></table></div>
 <h4 class="muted" style="margin:14px 0 6px">Hold queue (${holds.length})</h4>
 <div class="table-wrap"><table><thead><tr><th>Student</th><th>Placed</th><th>Position</th><th></th></tr></thead>
 <tbody>${holdRows || `<tr><td colspan="4" class="muted">No holds on this book.</td></tr>`}</tbody></table></div>
 <div class="callout" style="margin-top:14px"><span></span><div><strong>Replacement value:</strong> ${money(S.replacementPrice(book))} if this book is lost or damaged.</div></div>`;
 }

 /* ------------------------------ binding ------------------------------ */
 function bindActions(m, bookId, reRender) {
 const body = m.querySelector("#scan-result-body");

 body.querySelectorAll("[data-checkout]").forEach(btn => btn.addEventListener("click", () => {
 const st = S.getState();
 const user = S.currentUser();
 let userId = user ? user.id: null;
 // Admin picking a student
 const sel = body.querySelector("#scan-student");
 if (user && user.role === "admin" && sel) userId = sel.value;
 if (!userId) {
   // Not signed in: let them either sign in or be picked from the roster.
   window.offerCheckoutIdentity({ rosterSub: "Select the student taking this book." }).then(res => {
     if (!res) return;
     if (res.method === "login") { openLogin(); return; }
     const r = S.createLoan(bookId, res.user.id, st);
     toast(r.ok ? `Checked out! Due ${S.fmtDate(r.loan.dueDate)} ` : r.msg, r.ok ? "success" : "error");
     reRender(m, bookId);
   });
   return;
 }
 const res = S.createLoan(bookId, userId, st);
 if (res.ok) toast(`Checked out! Due ${S.fmtDate(res.loan.dueDate)} `, "success");
 else toast(res.msg, "error");
 reRender(m, bookId);
 }));

 body.querySelectorAll("[data-return]").forEach(btn => btn.addEventListener("click", () => {
 const st = S.getState();
 const res = S.returnLoan(btn.dataset.return, st);
 toast(res.ok ? "Returned ": res.msg, res.ok ? "success": "error");
 reRender(m, bookId);
 }));

 const retSel = body.querySelector("[data-return-select]");
 if (retSel) retSel.addEventListener("click", () => {
 const sel = body.querySelector("#scan-return-loan");
 if (!sel.value) return;
 const st = S.getState();
 S.returnLoan(sel.value, st);
 toast("Returned ", "success");
 reRender(m, bookId);
 });

 body.querySelectorAll("[data-hold]").forEach(btn => btn.addEventListener("click", () => {
 const user = S.currentUser();
 if (!user) { openLogin(); return; }
 const st = S.getState();
 const res = S.createHold(bookId, user.id, st);
 toast(res.ok ? "Hold placed ": res.msg, res.ok ? "success": "error");
 reRender(m, bookId);
 }));

 body.querySelectorAll("[data-cancel-hold]").forEach(btn => btn.addEventListener("click", () => {
 const st = S.getState();
 S.removeHold(btn.dataset.cancelHold, st);
 toast("Hold removed.", "success");
 reRender(m, bookId);
 }));

 body.querySelectorAll("[data-charge-scan]").forEach(btn => btn.addEventListener("click", () => {
 const st = S.getState();
 const sel = body.querySelector("#scan-student");
 const userId = sel ? sel.value: null;
 if (!userId) { toast("Pick a student to charge.", "error"); return; }
 const res = S.addCharge(btn.dataset.chargeScan, userId, "Lost / damaged book", st);
 toast(res.ok ? `Charged ${money(res.charge.amount)} for the lost/damaged book.`: res.msg, res.ok ? "success": "error");
 reRender(m, bookId);
 }));
 }

 return { run, lookupBook, showResult };
})();

if (typeof window!== "undefined") window.ScanActions = ScanActions;
if (typeof module!== "undefined") module.exports = ScanActions;
