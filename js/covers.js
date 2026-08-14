/* ============================================================
 * covers.js — automatically pull book covers & descriptions
 * ------------------------------------------------------------
 * Uses the free Open Library API (no key required).
 * cover : https://covers.openlibrary.org/b/isbn/{isbn}-M.jpg
 * details: https://openlibrary.org/isbn/{isbn}.json
 * All network calls fail gracefully — if offline or the book
 * isn't in Open Library, we keep our text-based cover.
 * ============================================================ */
const Covers = (function () {
 const S = window.Store;

 function cleanIsbn(isbn) {
 return String(isbn || "").replace(/[^0-9]/g, "").slice(0, 13);
 }

 // Cover image URL for an ISBN. Returns '' if invalid.
 function coverUrl(isbn) {
 const c = cleanIsbn(isbn);
 return c ? `https://covers.openlibrary.org/b/isbn/${c}-M.jpg` : "";
 }

 // Larger cover for the detail modal.
 function coverUrlLarge(isbn) {
 const c = cleanIsbn(isbn);
 return c ? `https://covers.openlibrary.org/b/isbn/${c}-L.jpg` : "";
 }

 /**
 * Enrich a book from Open Library: fill in a missing description
 * (and, if available, author + genre). Returns the Open Library
 * record if found, else null. Does NOT touch localStorage.
 */
 async function fetchDetails(isbn) {
 const c = cleanIsbn(isbn);
 if (!c) return null;
 try {
 const res = await fetch(`https://openlibrary.org/isbn/${c}.json`);
 if (!res.ok) return null;
 return await res.json();
 } catch (e) {
 return null;
 }
 }

 /**
 * Fill a book's missing description from Open Library and persist.
 * Returns true if a description was added.
 */
 async function enrichDescription(book) {
 if (book.desc && book.desc.trim()) return false;
 const rec = await fetchDetails(book.isbn);
 if (!rec) return false;
 let d = null;
 if (typeof rec.description === "string") d = rec.description;
 else if (rec.description && rec.description.value) d = rec.description.value;
 if (d && d.trim()) {
 const st = S.getState();
 const b = st.books.find(x => x.id === book.id);
 if (b) { b.desc = d.trim(); S.save(st); return true; }
 }
 return false;
 }

 let enriching = false;
 const sleep = (ms) => new Promise(r => setTimeout(r, ms));

 /**
 * Automatically pull descriptions for any books that don't have one yet.
 * Runs in the background (once per browser session) so students always see
 * real descriptions without anyone having to click anything. Books already
 * saved with a description are skipped, so this is a one-time fetch per book.
 */
 async function autoEnrichAll() {
 if (enriching) return;
 // Only run once per browser session to avoid re-fetching on every page view.
 try {
 if (sessionStorage.getItem("classroomLibEnriched")) return;
 sessionStorage.setItem("classroomLibEnriched", "1");
 } catch (e) { /* ignore */ }

 enriching = true;
 const st = S.getState();
 const missing = st.books.filter(b => !(b.desc && b.desc.trim()));
 let filled = 0;
 for (const book of missing) {
 try {
 if (await enrichDescription(book)) filled++;
 await sleep(200); // be polite to the API
 } catch (e) { /* keep going */ }
 }
 enriching = false;
 if (filled > 0) {
 const msg = `Loaded ${filled} book description${filled === 1 ? "" : "s"} from Open Library.`;
 try { if (typeof window.toast === "function") window.toast(msg, "success"); } catch (e) { /* ignore */ }
 }
 }

  // Our stored prices are in USD (displayed as CAD). Google Books returns a
  // retail price that may be in CAD/USD — convert to USD for storage.
  const USD_PER_CAD = 1 / 1.37;

  async function fetchPriceByISBN(isbn) {
    const c = cleanIsbn(isbn);
    if (!c) return null;
    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${c}&country=CA`);
      if (!res.ok) return null;
      const data = await res.json();
      const item = data && data.items && data.items[0];
      if (!item) return null;
      const list = item.volumeInfo && item.volumeInfo.listPrice;
      const sale = item.saleInfo && item.saleInfo.listPrice;
      const price = list || sale;
      if (!price || price.amount == null) return null;
      let usd = Number(price.amount);
      if (price.currencyCode === "CAD") usd = usd * USD_PER_CAD;
      else if (price.currencyCode !== "USD") return null; // unsupported currency
      return { usd, currencyCode: price.currencyCode, amount: Number(price.amount) };
    } catch (e) { return null; }
  }

  // Best-effort reading-level lookup by ISBN. There's no free, reliable Lexile
  // API, so we return a guess based on Google Books audience/category metadata
  // when available, and null otherwise (the teacher can set it manually).
  async function fetchLexileByISBN(isbn) {
    const c = cleanIsbn(isbn);
    if (!c) return null;
    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${c}`);
      if (!res.ok) return null;
      const data = await res.json();
      const item = data && data.items && data.items[0];
      if (!item) return null;
      const vi = item.volumeInfo || {};
      const audience = (vi.audience || "").toLowerCase();
      const cats = (vi.categories || []).join(" ").toLowerCase();
      // Heuristic: audience/targetAge -> a broad reading band.
      if (audience.includes("children") || audience.includes("juvenile") || /age.*(9|10|11|12)/.test(audience)) return "Middle grades";
      if (audience.includes("young adult") || /age.*(13|14|15)/.test(audience)) return "Young adult";
      if (cats.includes("juvenile")) return "Middle grades";
      return null;
    } catch (e) { return null; }
  }

  return { coverUrl, coverUrlLarge, fetchDetails, enrichDescription, autoEnrichAll, cleanIsbn, fetchPriceByISBN, fetchLexileByISBN };
})();

// Browser global
if (typeof window !== "undefined") window.Covers = Covers;
if (typeof module !== "undefined") module.exports = Covers;
