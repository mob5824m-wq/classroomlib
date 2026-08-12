/* mylibrary.js — the student dashboard. */
(function () {
 const S = Store;

 function render() {
 const user = S.currentUser();
 const loggedOut = $("#logged-out");
 const dash = $("#dashboard");
 $("#who").textContent = user
 ? `Hi ${user.name.split(" ")[0]}! Here's everything you've got from the library.`: "Sign in to see the books you've checked out.";

 if (!user) {
 loggedOut.hidden = false;
 dash.hidden = true;
 return;
 }
 loggedOut.hidden = true;
 dash.hidden = false;

 const st = S.getState();
 const loans = S.activeLoansForUser(user.id, st);
 const holds = st.holds.filter(h => h.userId === user.id);

 // Display name editor
 const nameInput = $("#myname-input");
 const nameMsg = $("#myname-msg");
 if (nameInput) {
   nameInput.value = user.name;
   nameMsg.textContent = "";
 }
 const nameForm = $("#myname-form");
 if (nameForm) {
   nameForm.onsubmit = (e) => {
     e.preventDefault();
     const val = nameInput ? nameInput.value.trim() : "";
     if (!val) { nameMsg.textContent = "Please enter a name."; return; }
     const res = S.updateProfile({ name: val });
     if (res.ok) {
       $("#who").textContent = `Hi ${res.user.name.split(" ")[0]}! Here's everything you've got from the library.`;
       if (typeof window.onAuthChange === "function") window.onAuthChange(res.user);
       // render() clears the message, so set it after the refresh
       $("#myname-msg").textContent = "Name updated.";
     } else {
       nameMsg.textContent = res.msg;
     }
   };
 }

 // Stats
 $("#m-count").textContent = loans.length;
 const soonest = loans.map(l => l.dueDate).sort((a, b) => a - b)[0];
 $("#m-due").textContent = loans.length ? S.fmtDate(soonest): "—";
 $("#m-overdue").textContent = loans.filter(l => S.isOverdue(l, st)).length;
 $("#m-holds").textContent = holds.length;

 // Loans table
 const loansBox = $("#my-loans");
 if (!loans.length) {
 loansBox.innerHTML = `<div class="empty"><div class="big"></div><p>You don't have any books out right now. Go find your next read!</p><a class="btn btn-outline" href="catalog.html">Browse the catalog →</a></div>`;
 } else {
 loansBox.innerHTML = `
 <div class="table-wrap">
 <table>
 <thead><tr><th>Book</th><th>Due date</th><th>Status</th><th>Actions</th></tr></thead>
 <tbody>${loans.map(loanRow).join("")}</tbody>
 </table>
 </div>`;
 }

 // Holds
 const holdsBox = $("#my-holds");
 if (!holds.length) {
 holdsBox.innerHTML = `<div class="empty"><div class="big"></div><p>No holds right now. When a book you want is out, place a hold to get in line.</p></div>`;
 } else {
 holdsBox.innerHTML = `
 <div class="table-wrap">
 <table>
 <thead><tr><th>Book</th><th>Your spot in line</th><th>Actions</th></tr></thead>
 <tbody>${holds.map(h => {
 const book = st.books.find(b => b.id === h.bookId);
 const pos = S.holdPosition(h.id, st);
 return `<tr>
 <td><strong>${esc(book.title)}</strong><div class="muted small">${esc(book.author)}</div></td>
 <td><span class="badge badge-hold">#${pos} in line</span></td>
 <td><button class="btn btn-danger-ghost btn-sm" data-remove-hold="${h.id}">Cancel hold</button></td>
 </tr>`;
 }).join("")}</tbody>
 </table>
 </div>`;
 }

 // Charges (feature #6)
 const charges = S.chargesForUser(user.id, st);
 const cb = $("#charges-box");
 const totalUnpaid = charges.filter(c =>!c.paid).reduce((n, c) => n + c.amount, 0);
 cb.hidden =!charges.length;
 $("#my-charges").innerHTML = charges.length
 ? `<div class="table-wrap"><table>
 <thead><tr><th>Book</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
 <tbody>${charges.map(c => {
 const book = st.books.find(b => b.id === c.bookId);
 return `<tr><td><strong>${esc(book ? book.title: "Unknown")}</strong><div class="muted small">${esc(c.reason)}</div></td>
 <td>${money(c.amount)}</td><td>${c.paid ? `<span class="badge badge-avail">Paid</span>`: `<span class="badge badge-overdue">Unpaid</span>`}</td>
 <td>${S.fmtDate(c.date)}</td></tr>`;
 }).join("")}</tbody></table></div>
 <p class="small muted">${totalUnpaid > 0 ? `Unpaid total: ${money(totalUnpaid)} — see your librarian to resolve.`: ""}</p>`
 : "";

 // Return box (only relevant if they have loans)
 $("#return-box").hidden =!loans.length;
 $("#return-list").innerHTML = loans.map(l => {
 const book = st.books.find(b => b.id === l.bookId);
 return `<div class="card" style="display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:10px">
 <div style="display:flex;gap:12px;align-items:center">
 ${bookCover(book, "sm")}
 <div><strong>${esc(book.title)}</strong><div class="muted small">${esc(book.author)}</div></div>
 </div>
 <button class="btn btn-primary" data-return="${l.id}">Return now</button>
 </div>`;
 }).join("");

 // Reading log
 renderReading(user, st);
 // Book clubs
 renderClubs(user, st);

 // Bind actions
 $$("[data-return]").forEach(b => b.addEventListener("click", () => doReturn(b.dataset.return)));
 $$("[data-remove-hold]").forEach(b => b.addEventListener("click", () => doRemoveHold(b.dataset.removeHold)));
 $$("[data-renew]").forEach(b => b.addEventListener("click", () => doRenew(b.dataset.renew)));
 }

 /* --------------------------- Reading log --------------------------- */
 function renderReading(user, st) {
   const summary = S.readingSummary(user.id, st);
   $("#rl-minutes").textContent = summary.totalMinutes;
   $("#rl-pages").textContent = summary.totalPages;
   $("#rl-entries").textContent = summary.entries;
   $("#rl-streak").textContent = summary.streak;

   const sel = $("#reading-book");
   if (sel) {
     sel.innerHTML = `<option value="">General / no book</option>` + st.books.map(b => `<option value="${b.id}">${esc(b.title)}</option>`).join("");
   }
   const form = $("#reading-form");
   if (form) {
     form.onsubmit = (e) => {
       e.preventDefault();
       const minutes = $("#reading-minutes").value;
       const pages = $("#reading-pages").value;
       if ((!minutes || Number(minutes) <= 0) && (!pages || Number(pages) <= 0)) {
         toast("Enter minutes or pages first.", "error");
         return;
       }
       const bookId = sel ? sel.value : "";
       const res = S.logReading(user.id, bookId, minutes || 0, pages || 0, S.getState());
       if (res.ok) {
         $("#reading-minutes").value = ""; $("#reading-pages").value = "";
         toast("Reading logged!");
         render();
       } else toast(res.msg, "error");
     };
   }

   const history = S.readingForUser(user.id, st).slice(0, 10);
   const histBox = $("#reading-history");
   if (history.length) {
     histBox.innerHTML = `<div class="table-wrap"><table>
       <thead><tr><th>Date</th><th>Book</th><th>Minutes</th><th>Pages</th></tr></thead>
       <tbody>${history.map(r => {
         const b = st.books.find(x => x.id === r.bookId);
         return `<tr><td>${S.fmtDate(r.date)}</td><td>${b ? esc(b.title) : "General"}</td><td>${r.minutes || "—"}</td><td>${r.pages || "—"}</td></tr>`;
       }).join("")}</tbody></table></div>`;
   } else {
     histBox.innerHTML = `<p class="muted small">No reading logged yet.</p>`;
   }
 }

 /* --------------------------- Book clubs --------------------------- */
 function renderClubs(user, st) {
   const box = $("#clubs-list");
   const all = (st.clubs || []).slice().sort((a, b) => b.created - a.created);
   const createBtn = $("#create-club-btn");
   if (createBtn) createBtn.onclick = () => createClub(user);
   if (!all.length) { box.innerHTML = `<p class="muted small">No clubs yet.</p>`; return; }
   box.innerHTML = all.map(c => {
     const mine = c.members.includes(user.id);
     const book = c.bookId ? st.books.find(b => b.id === c.bookId) : null;
     return `<div class="card" style="margin-bottom:10px">
       <div class="card-head">
         <h3 style="margin:0">${esc(c.name)} <span class="badge" style="background:#eef1f3;color:var(--ink-soft)">${c.members.length} member${c.members.length === 1 ? "" : "s"}</span></h3>
         ${mine ? `<button class="btn btn-danger-ghost btn-sm" data-leave-club="${c.id}">Leave</button>` : `<button class="btn btn-primary btn-sm" data-join-club="${c.id}">Join</button>`}
       </div>
       ${c.description ? `<p class="muted small">${esc(c.description)}</p>` : ""}
       <p class="small">${book ? `Reading: <strong>${esc(book.title)}</strong>` : "No book assigned yet."}</p>
       ${mine ? `<button class="btn btn-soft btn-sm" data-open-club="${c.id}">Open discussion</button>` : ""}
     </div>`;
   }).join("");

   box.querySelectorAll("[data-join-club]").forEach(b => b.addEventListener("click", () => {
     S.joinClub(b.dataset.joinClub, user.id, S.getState()); toast("Joined the club!"); render();
   }));
   box.querySelectorAll("[data-leave-club]").forEach(b => b.addEventListener("click", () => {
     S.leaveClub(b.dataset.leaveClub, user.id, S.getState()); toast("Left the club."); render();
   }));
   box.querySelectorAll("[data-open-club]").forEach(b => b.addEventListener("click", () => openClub(b.dataset.openClub, user)));
 }

 function createClub(user) {
   const body = $("#clubs-list");
   body.innerHTML = `
     <div class="card">
       <button class="btn btn-ghost btn-sm" id="club-cancel" style="color:var(--ink-soft);border-color:var(--line)">Cancel</button>
       <form id="club-create-form" style="margin-top:10px">
         <label>Club name <input id="club-name" required placeholder="e.g. Fantasy Readers"></label>
         <label>Description <textarea id="club-desc" rows="2" placeholder="What will your club read and discuss?"></textarea></label>
         <button class="btn btn-primary" type="submit">Create club</button>
       </form>
     </div>`;
   $("#club-cancel").addEventListener("click", render);
   $("#club-create-form").addEventListener("submit", (e) => {
     e.preventDefault();
     const res = S.createClub($("#club-name").value, $("#club-desc").value, user.id, S.getState());
     if (res.ok) { toast("Club created!"); render(); }
     else toast(res.msg, "error");
   });
 }

 function openClub(clubId, user) {
   const st = S.getState();
   const club = st.clubs.find(c => c.id === clubId);
   if (!club) return;
   let modal = document.getElementById("club-modal");
   if (!modal) { modal = document.createElement("div"); modal.id = "club-modal"; modal.className = "modal"; document.body.appendChild(modal); }
   const posts = S.clubPosts(clubId, st);
   const isAdmin = user.role === "admin" || club.adminId === user.id;
   modal.innerHTML = `
     <div class="modal-card wide" id="club-modal-body">
       <button class="modal-x" data-x>&times;</button>
       <h2>${esc(club.name)}</h2>
       ${club.description ? `<p class="muted small">${esc(club.description)}</p>` : ""}
       ${club.bookId ? `<p class="small">Reading: <strong>${esc((st.books.find(b => b.id === club.bookId) || {}).title || "?")}</strong></p>` : ""}
       ${isAdmin ? `<div class="filters" style="margin:10px 0">
         <select id="club-book" style="flex:1"><option value="">No book</option>${st.books.map(b => `<option value="${b.id}" ${club.bookId === b.id ? "selected" : ""}>${esc(b.title)}</option>`).join("")}</select>
         <button class="btn btn-soft btn-sm" id="club-set-book">Set book</button>
         <button class="btn btn-danger-ghost btn-sm" id="club-delete">Delete club</button>
       </div>` : ""}
       <h3 style="margin:12px 0 6px">Discussion</h3>
       <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px">${posts.map(p => {
         const u = st.users.find(x => x.id === p.userId);
         return `<div class="review"><div class="small"><strong>${esc(u ? u.name.split(" ")[0] : "Reader")}</strong> <span class="muted" style="font-weight:400">· ${timeAgo(p.date)}</span></div><div>${esc(p.text)}</div></div>`;
       }).join("") || `<p class="muted small">No posts yet. Start the discussion!</p>`}</div>
       <form id="club-post-form" style="display:flex;gap:8px">
         <input id="club-post-text" placeholder="Share a thought…" style="flex:1">
         <button class="btn btn-primary" type="submit">Post</button>
       </form>
     </div>`;
   modal.classList.add("open");
   modal.querySelector("[data-x]").addEventListener("click", () => modal.classList.remove("open"));
   modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("open"); });
   const setBook = modal.querySelector("#club-set-book");
   if (setBook) setBook.addEventListener("click", () => {
     S.updateClub(clubId, { bookId: modal.querySelector("#club-book").value }, S.getState());
     toast("Club book updated."); openClub(clubId, user);
   });
   const del = modal.querySelector("#club-delete");
   if (del) del.addEventListener("click", () => {
     if (confirm("Delete this club and its discussion?")) { S.deleteClub(clubId, S.getState()); modal.classList.remove("open"); toast("Club deleted."); render(); }
   });
   modal.querySelector("#club-post-form").addEventListener("submit", (e) => {
     e.preventDefault();
     const res = S.addClubPost(clubId, user.id, modal.querySelector("#club-post-text").value, S.getState());
     if (res.ok) openClub(clubId, user); else toast(res.msg, "error");
   });
 }

 function loanRow(l) {
 const st = S.getState();
 const book = st.books.find(b => b.id === l.bookId);
 const overdue = S.isOverdue(l, st);
 const late = S.daysLate(l);
 let status;
 if (overdue) status = `<span class="badge badge-overdue">Overdue ${late} day${late === 1 ? "": "s"}</span>`;
 else if (l.dueDate < Date.now()) status = `<span class="badge badge-warn">Due today</span>`;
 else status = `<span class="badge badge-avail">${Math.max(0, S.daysBetween(Date.now(), l.dueDate))} days left</span>`;

 return `<tr>
 <td><strong>${esc(book.title)}</strong><div class="muted small">${esc(book.author)}</div></td>
 <td>${S.fmtDate(l.dueDate)}</td>
 <td>${status}</td>
 <td>
 <div class="row-actions">
 <button class="btn btn-soft btn-sm" data-renew="${l.id}" ${l.renewals >= 1 ? "disabled title='Already renewed once'": ""}>Renew</button>
 <button class="btn btn-primary btn-sm" data-return="${l.id}">Return</button>
 </div>
 </td>
 </tr>`;
 }

 function doReturn(loanId) {
 const st = S.getState();
 const res = S.returnLoan(loanId, st);
 if (res.ok) {
 toast("Thanks for returning your book! ", "success");
 // Notify the next person in line.
 if (res.nextHold) {
 const holder = st.users.find(u => u.id === res.nextHold.userId);
 const book = st.books.find(b => b.id === res.nextHold.bookId);
 if (holder && book) toast(`${holder.name.split(" ")[0]}, "${book.title}" is now ready for you! `, "success");
 }
 } else toast(res.msg, "error");
 render();
 }

 function doRenew(loanId) {
 const st = S.getState();
 const res = S.renewLoan(loanId, st);
 if (res.ok) toast(`Renewed! New due date: ${S.fmtDate(res.dueDate)} `, "success");
 else toast(res.msg, "error");
 render();
 }

 function doRemoveHold(holdId) {
 const st = S.getState();
 S.removeHold(holdId, st);
 toast("Hold cancelled.", "success");
 render();
 }

 function init() {
 render();
 window.onAuthChange = render;
 }

 if (document.readyState!== "loading") init(); else document.addEventListener("DOMContentLoaded", init);
})();
