/* home.js — populates the home page stats and featured picks. */
document.addEventListener("DOMContentLoaded", () => {
 const S = Store;
 const st = S.getState();

 const totalCopies = st.books.reduce((n, b) => n + b.totalCopies, 0);
 const avail = st.books.reduce((n, b) => n + S.availableCopies(b.id, st), 0);
 const hotCount = st.books.filter(b => S.popularityTier(b, st.books) === "hot").length;
 const students = st.users.filter(u => u.role === "student").length;

 $("#stat-books").textContent = totalCopies;
 $("#stat-avail").textContent = avail;
 $("#stat-hot").textContent = hotCount;
 $("#stat-students").textContent = students;

 // Featured: top by popularity, take 3.
 const featured = [...st.books]
 .sort((a, b) => S.popularityScore(b) - S.popularityScore(a))
 .slice(0, 3);

   const box = $("#featured");
   box.innerHTML = featured.map(b => {
   const pop = S.popularityInfo(b, st.books);
   return `
   <div class="book-card" style="margin-bottom:14px">
   <div class="body" style="flex-direction:row;gap:12px">
   ${bookCover(b, "sm")}
   <div style="flex:1;min-width:0">
   <h3>${esc(b.title)}</h3>
   <div class="author">${esc(b.author)}</div>
   <div class="meta" style="margin-top:6px">
   <span class="badge badge-${pop.tier}">${pop.label}</span>
   ${b.lexile ? `<span class="badge" style="background:var(--blue-soft);color:var(--blue)">${esc(b.lexile)}</span>` : ""}
   ${availBadge(b.id)}
   </div>
   <a class="btn btn-soft btn-sm" style="margin-top:8px" href="catalog.html">View in catalog</a>
   </div>
   </div>
   </div>`;
   }).join("");

   // Top rated (feature #4)
   const topRated = st.books
   .filter(b => b.ratingCount > 0)
   .sort((a, b) => (S.avgRating(b) * (1 + Math.min(b.ratingCount, 10) / 20)) - (S.avgRating(a) * (1 + Math.min(a.ratingCount, 10) / 20)))
   .slice(0, 6);
   $("#top-rated").innerHTML = topRated.length
   ? topRated.map(b => {
     const pop = S.popularityInfo(b, st.books);
     return `<div class="book-card"><div class="body">
       ${bookCover(b, "sm")}
       <h3>${esc(b.title)}</h3>
       <div class="author">${esc(b.author)}</div>
       <div class="meta"><span class="stars">${S.starHTML(S.avgRating(b))}</span>
       <span class="small muted">${b.ratingCount} rating${b.ratingCount === 1 ? "": "s"}</span></div>
       <div class="meta">${availBadge(b.id)}</div>
     </div></div>`;
   }).join("")
   : `<p class="muted">No ratings yet — check back after a few reviews!</p>`;

   // Recent reviews (feature #4)
   const recent = (st.reviews || []).slice().sort((a, b) => b.date - a.date).slice(0, 6);
   $("#recent-reviews").innerHTML = recent.length
   ? recent.map(r => {
     const book = st.books.find(x => x.id === r.bookId);
     const u = st.users.find(x => x.id === r.userId);
     return `<div class="review">
       <div class="small">${S.starHTML(r.rating)} <strong>${esc(u ? u.name.split(" ")[0]: "Reader")}</strong>
       <span class="muted" style="font-weight:400">· ${timeAgo(r.date)}</span></div>
       <div><a href="catalog.html" class="muted small">${esc(book ? book.title: "a book")}</a></div>
       ${r.text ? `<div class="muted small">"${esc(r.text)}"</div>`: ""}
     </div>`;
   }).join("")
   : `<p class="muted">No reviews yet — read a book and share what you thought!</p>`;

   // Book of the week (#11)
   const fid = st.settings && st.settings.featuredBookId;
   const wrap = $("#book-of-week-wrap");
   if (fid && wrap) {
     const fb = st.books.find(b => b.id === fid);
     if (fb) {
       const pop = S.popularityInfo(fb, st.books);
       wrap.style.display = "";
       $("#book-of-week").innerHTML = `
         <div style="display:flex;gap:18px;flex-wrap:wrap;align-items:center">
           <div style="min-width:130px;flex:0 0 150px">${bookCover(fb)}</div>
           <div style="flex:1;min-width:240px">
             <h3 style="margin-bottom:.2em">${esc(fb.title)}</h3>
             <div class="muted" style="margin-bottom:8px">by ${esc(fb.author)}</div>
             <div class="meta" style="margin-bottom:8px">
               ${S.starHTML(S.avgRating(fb))}
               <span class="small muted">${fb.ratingCount || 0} rating${fb.ratingCount === 1 ? "" : "s"}</span>
               <span class="badge badge-${pop.tier}">${pop.label}</span>
               ${fb.lexile ? `<span class="badge" style="background:var(--blue-soft);color:var(--blue)">${esc(fb.lexile)}</span>` : ""}
               ${availBadge(fb.id)}
             </div>
             ${fb.desc ? `<p class="muted small">${esc(excerpt(fb.desc, 220))}</p>` : ""}
             <a class="btn btn-amber" href="catalog.html">Find it in the catalog</a>
           </div>
         </div>`;
     }
   }

   // Announcements (admin-editable)
   const anns = S.getAnnouncements(st);
   $("#announcements-list").innerHTML = anns.length
   ? `<ul style="margin:0;padding-left:20px">${anns.map(a => `<li style="margin-bottom:8px">${esc(a.text)}</li>`).join("")}</ul>`
   : `<p class="muted">No announcements right now.</p>`;
 });
