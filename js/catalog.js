/* catalog.js — search, filter, sort, checkout/hold, barcode viewer. */
(function () {
 const S = Store;
 let state = S.getState();

 const el = {
 q: $("#q"), genre: $("#f-genre"), type: $("#f-type"),
   avail: $("#f-avail"), sort: $("#f-sort"), results: $("#results"),
   count: $("#result-count"), clear: $("#clear-filters"),
   };
   let viewMode = "grid"; // "grid" | "shelf" (#11)

 /* ------------------------- populate filters ------------------------- */
 function fillSelects() {
 S.GENRES.forEach(g => {
 const o = document.createElement("option");
 o.value = g; o.textContent = g;
 el.genre.appendChild(o);
 });
 Object.entries(S.TYPE_POLICY).forEach(([k, v]) => {
 const o = document.createElement("option");
 o.value = k; o.textContent = v.label;
 el.type.appendChild(o);
 });
 }

 /* ----------------------------- rendering ---------------------------- */
 function cardFor(book) {
 const pop = S.popularityInfo(book, state.books);
 const due = S.loanDurationDays(book, state.books);
 const user = S.currentUser();
 const loggedIn =!!user;
 const noCopies = S.availableCopies(book.id, state) <= 0;
 const can = loggedIn && S.canCheckout(book.id, user.id, state);

 let action = "";
 if (!loggedIn) {
 action = noCopies
 ? `<button class="btn btn-amber btn-sm" onclick="openLogin()">Sign in to hold</button>`: `<button class="btn btn-primary btn-sm" onclick="openLogin()">Sign in to borrow</button>`;
 } else if (can) {
 action = `<button class="btn btn-primary btn-sm" data-checkout="${book.id}">Check out</button>`;
 } else {
 action = `<button class="btn btn-amber btn-sm" data-hold="${book.id}">Place hold</button>`;
 }

 return `
 <article class="book-card">
 ${bookCover(book)}
 <div class="body">
 <h3 title="${esc(book.title)}">${esc(book.title)}</h3>
 <div class="author">${esc(book.author)}</div>
 <div class="meta">
 <span class="stars">${S.starHTML(S.avgRating(book))}</span>
 <span class="small muted">${book.ratingCount || 0} rating${book.ratingCount === 1 ? "": "s"}</span>
 </div>
 <div class="meta">
 <span class="badge" style="background:var(--teal-soft);color:var(--teal-dark)">${esc(S.TYPE_POLICY[book.type].label)}</span>
 <span class="badge badge-${pop.tier}">${pop.label}</span>
 </div>
 <div class="meta">
 ${availBadge(book.id)}
 <span class="badge" style="background:#eef1f3;color:var(--ink-soft)">Borrow: ${due} days</span>
 </div>
 ${book.desc ? `<p class="desc">${esc(excerpt(book.desc, 130))}</p>`: ""}
 <div class="actions">
 ${action}
 <button class="btn btn-soft btn-sm" data-barcode="${book.id}" title="View barcode"> Barcode</button>
 <button class="btn btn-outline btn-sm" data-detail="${book.id}">Details</button>
 </div>
 </div>
 </article>`;
 }

 function render() {
 const q = el.q.value.trim().toLowerCase();
 const g = el.genre.value, t = el.type.value, a = el.avail.value;
 let list = state.books.slice();

 if (q) list = list.filter(b =>
 b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q));
 if (g) list = list.filter(b => b.genre === g);
 if (t) list = list.filter(b => b.type === t);
 if (a === "avail") list = list.filter(b => S.availableCopies(b.id, state) > 0);
 if (a === "out") list = list.filter(b => S.availableCopies(b.id, state) <= 0);

 switch (el.sort.value) {
 case "title": list.sort((a, b) => a.title.localeCompare(b.title)); break;
 case "popular": list.sort((a, b) => S.popularityScore(b) - S.popularityScore(a)); break;
 case "newest": list.sort((a, b) => b.addedOn - a.addedOn); break;
 }

   el.count.textContent = `${list.length} book${list.length === 1 ? "": "s"}`;
   if (!list.length) {
   el.results.innerHTML = `<div class="empty"><div class="big"></div><h3>No books found</h3><p>Try a different search or clear your filters.</p></div>`;
   return;
   }
   // Shelf view groups books by genre; grid view is the flat card grid (#11).
   if (viewMode === "shelf") el.results.innerHTML = renderShelves(list);
   else el.results.innerHTML = list.map(cardFor).join("");
   }

   function renderShelves(list) {
   // Group by genre, keep a stable order.
   const order = ["Fantasy","Sci-Fi","Mystery","Adventure","Realistic Fiction","Historical","Graphic Novel","Sports","Non-Fiction","Biography","Reference","Textbook"];
   const groups = {};
   list.forEach(b => { (groups[b.genre] = groups[b.genre] || []).push(b); });
   const keys = Object.keys(groups).sort((a, b) => (order.indexOf(a) - order.indexOf(b)) || a.localeCompare(b));
   return keys.map(genre => {
   const shelfColor = ["#0f7a7a","#2f6fd0","#b5476b","#1d7a4f","#7a54b8","#c06b22","#0a5d70","#2e9e5b","#8a4a9e","#3a7ca5","#a16508","#0f8a8a"][Math.max(0, order.indexOf(genre)) % 12];
   return `
   <div class="shelf" style="margin-bottom:24px">
   <div class="shelf-head" style="background:${shelfColor}">
   <span class="shelf-name">${esc(genre)}</span>
   <span class="shelf-count">${groups[genre].length} book${groups[genre].length === 1 ? "": "s"}</span>
   </div>
   <div class="shelf-row">
   ${groups[genre].map(cardFor).join("")}
   </div>
   </div>`;
   }).join("");
   }

 /* --------------------------- book detail ---------------------------- */
 function detailModal(book) {
 const pop = S.popularityInfo(book, state.books);
 const repl = S.replacementPrice(book);
 const user = S.currentUser();
 const loggedIn =!!user;
 const avail = S.availableCopies(book.id, state);
 const noCopies = avail <= 0;
 const can = loggedIn && S.canCheckout(book.id, user.id, state);

 let borrowBtn = "";
 if (!loggedIn) {
 borrowBtn = noCopies
 ? `<button class="btn btn-amber" onclick="openLogin()">Sign in to hold</button>`: `<button class="btn btn-primary" onclick="openLogin()">Sign in to check out</button>`;
 } else if (can) {
 borrowBtn = `<button class="btn btn-primary" data-checkout="${book.id}"> Check this out</button>`;
 } else {
 borrowBtn = `<button class="btn btn-amber" data-hold="${book.id}"> Place a hold</button>`;
 }

 const reviews = S.reviewsFor(book.id, state).slice(0, 6);
 // "Readers also liked" (#9): students who borrowed this book also borrowed…
 const recs = recommendFor(book, state);
 const recHTML = recs.length
   ? `<hr style="border:none;border-top:1px solid var(--line);margin:18px 0">
      <h3>Readers also liked</h3>
      <div class="book-grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">${recs.map(r => `
        <div class="book-card"><div class="body">${bookCover(r, "sm")}
          <h3 style="font-size:.9rem">${esc(r.title)}</h3>
          <div class="author small">${esc(r.author)}</div>
          <div class="meta">${availBadge(r.id)}</div>
          <button class="btn btn-outline btn-sm" data-detail="${r.id}">Details</button>
        </div></div>`).join("")}</div>`
   : "";
 const reviewItems = reviews.map(r => {
 const u = state.users.find(x => x.id === r.userId);
 return `<div class="review">
 <div class="small">${S.starHTML(r.rating)} <strong>${esc(u ? u.name.split(" ")[0]: "Reader")}</strong>
 <span class="muted" style="font-weight:400">· ${timeAgo(r.date)}</span></div>
 ${r.text ? `<div class="muted small">${esc(r.text)}</div>`: ""}
 </div>`;
 }).join("");

 const reviewForm = loggedIn
 ? `<div class="review-form">
 <h4 style="margin:14px 0 6px"> Rate this book</h4>
 <div class="star-input" id="star-input" data-book="${book.id}">
 ${[1,2,3,4,5].map(n => `<button type="button" data-star="${n}" class="star-btn">☆</button>`).join("")}
 </div>
 <textarea id="review-text" rows="2" placeholder="What did you think? (optional)"></textarea>
 <button class="btn btn-primary btn-sm" id="submit-review">Post review</button>
 </div>`: `<p class="muted small" style="margin-top:14px"><a href="#" onclick="openLogin();return false;">Sign in</a> to rate and review this book.</p>`;

 const adminFill = user && user.role === "admin"
 ? `<button class="btn btn-soft btn-sm" data-autofill="${book.id}" title="Fetch a description from Open Library"> Auto-fill description</button>`: "";

 $("#detail-body").innerHTML = `
 <button class="modal-x" data-close-detail>&times;</button>
 <div style="display:flex;gap:18px;flex-wrap:wrap">
 <div style="min-width:150px;flex:0 0 180px">${bookCover(book)}</div>
 <div style="flex:1;min-width:240px">
 <h2>${esc(book.title)}</h2>
 <div class="author" style="margin-bottom:8px">by ${esc(book.author)}</div>
 <div class="meta" style="margin-bottom:10px">
 <span class="stars" style="font-size:1.2rem">${S.starHTML(S.avgRating(book))}</span>
 <span class="muted small">${S.avgRating(book) ? S.avgRating(book).toFixed(1): "No ratings yet"} · ${book.ratingCount || 0} rating${book.ratingCount === 1 ? "": "s"}</span>
 </div>
 <div class="meta" style="margin-bottom:10px">
 <span class="badge" style="background:var(--teal-soft);color:var(--teal-dark)">${esc(book.genre)}</span>
 <span class="badge" style="background:#eef1f3;color:var(--ink-soft)">${esc(S.TYPE_POLICY[book.type].label)}</span>
 <span class="badge badge-${pop.tier}">${pop.label}</span>
 ${availBadge(book.id)}
 </div>
 <p class="muted" style="font-style:italic">${esc(book.desc || "A great read chosen for our classroom shelves!")}</p>
 ${adminFill}
 <table style="width:100%;font-size:.9rem">
 <tr><td>Copies in library</td><td><strong>${book.totalCopies}</strong> (${avail} available)</td></tr>
 <tr><td>Loan length</td><td><strong>${S.loanDurationDays(book, state.books)} days</strong> (${esc(pop.label)})</td></tr>
 <tr><td>Replacement value</td><td><strong>${money(repl)}</strong> (if lost or damaged)</td></tr>
 <tr><td>ISBN</td><td>${esc(book.isbn)}</td></tr>
 </table>
 <div class="barcode-actions" style="justify-content:flex-start;margin-top:16px">
 ${borrowBtn}
 <button class="btn btn-soft" data-barcode="${book.id}"> View barcode</button>
 </div>
 </div>
 </div>
 ${recHTML}
 <hr style="border:none;border-top:1px solid var(--line);margin:18px 0">
 <h3> Reviews & ratings (${book.ratingCount || 0})</h3>
 <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:8px">${reviewItems || `<p class="muted small">No reviews yet — be the first to share your thoughts!</p>`}</div>
 ${reviewForm}`;

 openModal($("#detail-modal"));
 $("#detail-modal").querySelector("[data-close-detail]").addEventListener("click", () => closeModal($("#detail-modal")));
 $("#detail-modal").addEventListener("click", (e) => { if (e.target === $("#detail-modal")) closeModal($("#detail-modal")); });
 bindActionButtons($("#detail-body"));
 bindReview($("#detail-body"), book.id);

 const fillBtn = $("#detail-body").querySelector("[data-autofill]");
 if (fillBtn) fillBtn.addEventListener("click", async () => {
 const ok = await Covers.enrichDescription(book);
 toast(ok ? "Description pulled from Open Library ": "Couldn't find a description online.", ok ? "success": "error");
 state = S.getState();
 detailModal(state.books.find(b => b.id === book.id));
 });
 }

 // "Readers also liked" (#9): recommend books co-borrowed by the same students.
 function recommendFor(book, st) {
   const borrowers = new Set(st.loans.filter(l => l.bookId === book.id).map(l => l.userId));
   if (!borrowers.size) return [];
   const counts = {};
   st.loans.forEach(l => {
     if (l.bookId !== book.id && borrowers.has(l.userId)) counts[l.bookId] = (counts[l.bookId] || 0) + 1;
   });
   return Object.entries(counts)
     .sort((a, b) => b[1] - a[1])
     .slice(0, 3)
     .map(([id]) => st.books.find(b => b.id === id))
     .filter(Boolean);
 }

 /* ----------------------------- reviews ------------------------------ */
 function bindReview(root, bookId) {
 let selected = 0;
 const box = root.querySelector("#star-input");
 if (!box) return;
 const stars = box.querySelectorAll(".star-btn");
 stars.forEach(s => s.addEventListener("click", () => {
 selected = +s.dataset.star;
 stars.forEach(x => {
 x.textContent = +x.dataset.star <= selected ? "★": "☆";
 });
 }));
 root.querySelector("#submit-review").addEventListener("click", () => {
 const user = S.currentUser();
 if (!user) { openLogin(); return; }
 if (!selected) { toast("Pick a star rating first! ", "error"); return; }
 const text = root.querySelector("#review-text").value.trim();
 const st = S.getState();
 const res = S.addReview(bookId, user.id, selected, text, st);
 toast(res.ok ? "Thanks for the review! ": res.msg, res.ok ? "success": "error");
 state = S.getState();
 detailModal(state.books.find(b => b.id === bookId));
 });
 }

 /* --------------------------- action handling ------------------------ */
 // Event delegation on the results grid: buttons are re-created on every
 // render (search/filter), so we bind ONE persistent listener and dispatch
 // by data-* attributes. This keeps barcode/details/checkout/hold working
 // after any re-render.
 function bindResultsDelegation() {
 const results = $("#results");
 if (!results || results.dataset.delegated) return;
 results.dataset.delegated = "1";
 results.addEventListener("click", (e) => {
 const btn = e.target.closest("[data-checkout],[data-hold],[data-barcode],[data-detail]");
 if (!btn) return;
 e.preventDefault();
 if (btn.dataset.checkout) doCheckout(btn.dataset.checkout);
 else if (btn.dataset.hold) doHold(btn.dataset.hold);
 else if (btn.dataset.barcode) barcodeModal(btn.dataset.barcode);
 else if (btn.dataset.detail) {
 const book = state.books.find(x => x.id === btn.dataset.detail);
 if (book) detailModal(book);
 }
 });
 }

 // Direct binding used inside the (freshly recreated) detail modal content.
 function bindActionButtons(root) {
 root = root || document;
 $$("[data-checkout]", root).forEach(btn => btn.addEventListener("click", () => doCheckout(btn.dataset.checkout)));
 $$("[data-hold]", root).forEach(btn => btn.addEventListener("click", () => doHold(btn.dataset.hold)));
 $$("[data-barcode]", root).forEach(btn => btn.addEventListener("click", () => barcodeModal(btn.dataset.barcode)));
 $$("[data-detail]", root).forEach(btn => btn.addEventListener("click", () => {
 const book = state.books.find(x => x.id === btn.dataset.detail);
 if (book) detailModal(book);
 }));
 }

 function doCheckout(bookId) {
 const user = S.currentUser();
 if (!user) { openLogin(); return; }
 const st = S.getState();
 const res = S.createLoan(bookId, user.id, st);
 if (res.ok) {
 toast(`Nice! "${st.books.find(b => b.id === bookId).title}" is yours until ${S.fmtDate(res.loan.dueDate)} `, "success");
 } else {
 toast(res.msg, "error");
 }
 state = S.getState();
 render();
 }

 function doHold(bookId) {
 const user = S.currentUser();
 if (!user) { openLogin(); return; }
 const st = S.getState();
 const res = S.createHold(bookId, user.id, st);
 if (res.ok) {
 toast("Hold placed! We'll let you know when it's ready. ", "success");
 } else {
 toast(res.msg, "error");
 }
 state = S.getState();
 render();
 }

 function barcodeModal(bookId) {
 const book = state.books.find(x => x.id === bookId);
 if (!book) return;
 const m = document.createElement("div");
 m.className = "modal open";
 m.innerHTML = `
 <div class="modal-card barcode-card">
 <button class="modal-x" data-close>&times;</button>
 <h2>${esc(book.title)}</h2>
 <p class="muted small">Scan this at the check-out desk.</p>
 <canvas id="bc-canvas"></canvas>
 <div class="barcode-actions">
 <button class="btn btn-primary btn-sm" data-dl> Download</button>
 <button class="btn btn-outline btn-sm" data-close>Close</button>
 </div>
 </div>`;
 document.body.appendChild(m);
 const canvas = $("#bc-canvas", m);
 Barcode.draw(canvas, book.isbn, { scale: 2, height: 70 });
 m.querySelector("[data-dl]").addEventListener("click", () => Barcode.download(book.isbn, book.title));
 m.querySelectorAll("[data-close]").forEach(x => x.addEventListener("click", () => m.remove()));
 m.addEventListener("click", (e) => { if (e.target === m) m.remove(); });
 }

 /* ------------------------------ modal ------------------------------- */
 function openModal(m) { m.classList.add("open"); }
 function closeModal(m) { m.classList.remove("open"); }

 /* -------------------------------- init ------------------------------ */
 function init() {
 fillSelects();
 render();
 bindResultsDelegation();
 el.q.addEventListener("input", render);
 [el.genre, el.type, el.avail, el.sort].forEach(x => x.addEventListener("change", render));
   el.clear.addEventListener("click", () => {
   el.q.value = ""; el.genre.value = ""; el.type.value = ""; el.avail.value = ""; el.sort.value = "title";
   render();
   });
   // View toggle (#11)
   const vt = $("#view-toggle");
   if (vt) {
   vt.querySelectorAll(".seg-btn").forEach(btn => btn.addEventListener("click", () => {
   viewMode = btn.dataset.view;
   vt.querySelectorAll(".seg-btn").forEach(x => x.classList.toggle("active", x === btn));
   render();
   }));
   }
 $("#detail-modal").addEventListener("click", (e) => { if (e.target === $("#detail-modal")) closeModal($("#detail-modal")); });
 window.onAuthChange = () => { state = S.getState(); render(); };
 // Pull real descriptions from Open Library for any books missing one,
 // then refresh the grid so the new descriptions appear on the cards.
 if (window.Covers && typeof Covers.autoEnrichAll === "function") {
 Covers.autoEnrichAll().then(() => { state = S.getState(); render(); });
 }
 }

 if (document.readyState!== "loading") init(); else document.addEventListener("DOMContentLoaded", init);
})();
