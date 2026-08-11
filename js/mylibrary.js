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

 // Bind actions
 $$("[data-return]").forEach(b => b.addEventListener("click", () => doReturn(b.dataset.return)));
 $$("[data-remove-hold]").forEach(b => b.addEventListener("click", () => doRemoveHold(b.dataset.removeHold)));
 $$("[data-renew]").forEach(b => b.addEventListener("click", () => doRenew(b.dataset.renew)));
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
