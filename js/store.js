/* ============================================================
 * store.js — data layer for the Classroom Library
 * ------------------------------------------------------------
 * Everything is stored in localStorage so the site works with
 * pure vanilla JS, no server needed. Data is per-browser, which
 * is perfect for a classroom demo. (See README.md for how to
 * swap this for a real backend later.)
 * ============================================================ */

const Store = (function () {
 const KEY = "classroomLibraryState_v1";

 /* ------------------------- Types & Loan Policy ------------------------- */
 // Base loan length (days) for each type of book.
 const TYPE_POLICY = {
 novel: { label: "Novel / Chapter Book", baseDays: 14 },
 graphic: { label: "Graphic Novel", baseDays: 10 },
 nonfiction: { label: "Non-Fiction", baseDays: 21 },
 textbook: { label: "Textbook", baseDays: 28 },
 reference: { label: "Reference", baseDays: 5 },
 };

 // "Dynamic popularity" can shorten the loan for hot books.
 const POPULARITY = {
 hot: { label: " Hot pick", factor: 0.75, minDays: 5 },
 rising: { label: " Rising star", factor: 0.9, minDays: 5 },
 steady: { label: "Classic favorite", factor: 1.0, minDays: 5 },
 };

 // Condition affects replacement price.
 const CONDITION_FACTOR = {
 new: { label: "New", factor: 1.0 },
 good: { label: "Good", factor: 0.85 },
 fair: { label: "Fair", factor: 0.7 },
 worn: { label: "Worn", factor: 0.55 },
 };

 const GENRES = [
 "Fantasy", "Sci-Fi", "Mystery", "Adventure", "Realistic Fiction",
 "Historical", "Graphic Novel", "Sports", "Non-Fiction", "Biography",
 "Reference", "Textbook",
 ];

 /* ------------------------------ Seed data ------------------------------ */
 const seedBooks = () => [
 b("The Giver", "Lois Lowry", "Sci-Fi", "novel", "9780544340688", 3, 9.99, "good", 14, 40, 4.5, 8),
 b("Holes", "Louis Sachar", "Adventure", "novel", "9780440414803", 4, 8.99, "fair", 22, 55, 4.3, 10),
 b("Wonder", "R.J. Palacio", "Realistic Fiction", "novel", "9780375869020", 2, 9.99, "new", 18, 35, 4.8, 12),
 b("Percy Jackson and the Olympians", "Rick Riordan", "Fantasy", "novel", "9780786838653", 5, 9.99, "good", 26, 60, 4.7, 15),
 b("The Hunger Games", "Suzanne Collins", "Sci-Fi", "novel", "9780439023481", 4, 9.99, "good", 20, 50),
 b("Out of My Mind", "Sharon M. Draper", "Realistic Fiction", "novel", "9781416971719", 2, 8.99, "good", 8, 20),
 b("Roll of Thunder, Hear My Cry", "Mildred D. Taylor", "Historical", "novel", "9780140384512", 2, 8.99, "fair", 6, 15),
 b("The Outsiders", "S.E. Hinton", "Historical", "novel", "9780140385724", 3, 8.99, "good", 11, 30),
 b("Amulet: The Stonekeeper", "Kazu Kibuishi", "Graphic Novel", "graphic", "9780439846813", 4, 12.99, "good", 24, 48),
 b("Smile", "Raina Telgemeier", "Graphic Novel", "graphic", "9780545132060", 4, 10.99, "good", 21, 52, 4.6, 9),
 b("Ghost", "Jason Reynolds", "Sports", "novel", "9781481450164", 3, 10.99, "new", 16, 33, 4.4, 6),
 b("The Boy Who Harnessed the Wind", "William Kamkwamba", "Biography", "nonfiction", "9780803735118", 2, 18.99, "good", 7, 18, 4.5, 5),
 b("Hidden Figures", "Margot Lee Shetterly", "Non-Fiction", "nonfiction", "9780062662378", 3, 16.99, "good", 9, 22, 4.6, 7),
 b("A Wrinkle in Time", "Madeleine L'Engle", "Sci-Fi", "novel", "9780312367541", 3, 9.99, "fair", 12, 28, 4.1, 6),
 b("The Maze Runner", "James Dashner", "Sci-Fi", "novel", "9780385737944", 2, 9.99, "good", 13, 26, 4.2, 8),
 b("Counting by 7s", "Holly Goldberg Sloan", "Realistic Fiction", "novel", "9780142422861", 2, 8.99, "new", 5, 12, 4.7, 4),
 b("Science Encyclopedia", "Dorling Kindersley", "Reference", "reference", "9780756645699", 1, 29.99, "good", 2, 5),
 b("Geometry Textbook", "Pearson", "Textbook", "textbook", "9780133662397", 8, 89.99, "worn", 3, 9),
 ];

 // Helper to build a book object.
 function b(title, author, genre, type, isbn, totalCopies, basePrice,
 condition, checkoutCount, popularityDays, rating = 0, ratingCount = 0) {
 return {
 id: uid(),
 title, author, genre, type, isbn,
 totalCopies, basePrice, condition,
 addedOn: Date.now(),
 desc: "",
 // Popularity signals: how many times it was checked out and how recent.
 checkoutCount,
 recentCheckouts: popularityDays, // "momentum" within the last 30 days
 // Reader reviews / ratings (dynamic).
 ratingSum: rating * ratingCount,
 ratingCount,
 };
 }

 const seedUsers = () => [
 u("admin", "Mrs. Alvarez (Librarian)", "admin123", "admin", "Staff", "Staff"),
 u("alex", "Alex Rivera", "read123", "student", "7th Grade", "7A"),
 u("mia", "Mia Chen", "read123", "student", "8th Grade", "8A"),
 u("jamal", "Jamal Brooks", "read123", "student", "7th Grade", "7B"),
 u("sophia", "Sophia Nguyen", "read123", "student", "8th Grade", "8B"),
 u("liam", "Liam Patel", "read123", "student", "7th Grade", "7A"),
 u("noah", "Noah Kim", "read123", "student", "7th Grade", "7A"),
 u("ava", "Ava Jones", "read123", "student", "7th Grade", "7B"),
 u("grace", "Grace Lee", "read123", "student", "7th Grade", "7B"),
 u("ethan", "Ethan Torres", "read123", "student", "8th Grade", "8A"),
 u("zoe", "Zoe Martin", "read123", "student", "8th Grade", "8A"),
 u("david", "David Okafor", "read123", "student", "8th Grade", "8B"),
 u("ella", "Ella Brooks", "read123", "student", "8th Grade", "8B"),
 u("kiosk", "Demo Student", "kiosk", "student", "Demo", "7A"),
 ];

 function u(username, name, password, role, grade, klass) {
 return { id: uid(), username, name, password, role, grade, class: klass || "" };
 }

 // Seed a handful of real-sounding reviews so the review section is alive.
 const seedReviews = (books, users) => {
 const byTitle = t => books.find(x => x.title === t);
 const byUser = un => users.find(x => x.username === un);
 const rev = (book, user, rating, text) =>
 ({ id: uid(), bookId: book.id, userId: user.id, rating, text, date: Date.now() - Math.random() * 6 * 86400000 });
 return [
 rev(byTitle("The Giver"), byUser("sophia"), 5, "The ending made me think about it for days. So good!"),
 rev(byTitle("The Giver"), byUser("liam"), 4, "A little slow at first but the plot twist is worth it."),
 rev(byTitle("Wonder"), byUser("mia"), 5, "Auggie is the best. This book teaches you to be kind."),
 rev(byTitle("Wonder"), byUser("jamal"), 5, "Everyone should read this. I couldn't put it down."),
 rev(byTitle("Smile"), byUser("alex"), 5, "I laughed and cried. The drawings are awesome."),
 rev(byTitle("Ghost"), byUser("jamal"), 4, "Running + real life problems = a great story."),
 rev(byTitle("Percy Jackson and the Olympians"), byUser("sophia"), 5, "Action, humor, Greek gods... what more do you want?"),
 rev(byTitle("Holes"), byUser("liam"), 4, "Weird in the best way. Everything connects at the end!"),
 ];
 };

 let _seq = 1;
 function uid() { return "id_" + (_seq++); }

 /* --------------------------- State helpers ---------------------------- */
  const emptyState = () => ({
    version: 1,
    books: [],
    users: [],
    loans: [], // { id, bookId, userId, checkoutDate, dueDate, returned, returnDate, status }
    holds: [], // { id, bookId, userId, placedDate }
    reviews: [], // { id, bookId, userId, rating(1-5), text, date }
    requests: [], // { id, userId, title, author, isbn, note, date, status }
    charges: [], // { id, bookId, userId, amount, reason, date, paid, loanId }
    announcements: [], // { id, text, date }
    kioskLog: [], // { id, time, action, studentName, bookTitle }
    settings: { // adjustable by admin
      maxLoansPerStudent: 4,
      maxHoldsPerStudent: 3,
      overdueGraceDays: 2,
      popularityWindowDays: 30,
      hideDemoAccounts: false, // #1: hide demo chips on the sign-in screen
      featuredBookId: "",      // #11: book of the week
      kioskEnabled: true,      // #3: allow the kiosk to check out
    },
  });

  /* ---- Shared backend transport (with localStorage fallback) ---- */
  // Primary: the Node server keeps one shared state file so every device sees
  // the same data. Fallback: localStorage (works if opened without the server,
  // e.g. via file://). The in-memory cache keeps the sync API fast after load.
  let _cache = null;
  let _mode = null; // "server" | "local"

  // Load initial state. Uses a synchronous request once at startup so the
  // existing sync API (getState) keeps working unchanged.
  function loadFromServer() {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", "/api/state", false); // sync on purpose, one small payload
      xhr.send(null);
      if (xhr.status === 200) return JSON.parse(xhr.responseText);
    } catch (e) { /* not on server / offline */ }
    return null;
  }

  function load() {
    if (_cache) return _cache;
    const fromServer = loadFromServer();
    if (fromServer) {
      _mode = "server";
      _cache = fromServer;
      return _cache;
    }
    // localStorage fallback
    _mode = "local";
    try {
      const raw = localStorage.getItem(KEY);
      _cache = raw ? JSON.parse(raw) : null;
    } catch (e) { _cache = null; }
    return _cache;
  }

  function seedIfEmpty() {
    let st = load();
    if (!st) {
      st = emptyState();
      st.books = seedBooks();
      st.users = seedUsers();
      st.reviews = seedReviews(st.books, st.users);
      st.announcements = seedAnnouncements();
      flagInitialSecurity(st);
      save(st);
      return;
    }
    if (!st.books || !st.books.length) {
      st.books = seedBooks();
      st.users = st.users && st.users.length ? st.users : seedUsers();
      st.reviews = st.reviews && st.reviews.length ? st.reviews : seedReviews(st.books, st.users);
      st.announcements = st.announcements && st.announcements.length ? st.announcements : seedAnnouncements();
      flagInitialSecurity(st);
      save(st);
    }
  }

  // #1: the admin account starts flagged so they're forced to change the
  // default password on first sign-in.
  function flagInitialSecurity(st) {
    const admin = st.users.find(u => u.role === "admin");
    if (admin && admin.passwordChangeRequired === undefined) admin.passwordChangeRequired = true;
    const k = st.users.find(u => u.username === "kiosk");
    if (k && k.hideFromLogin === undefined) k.hideFromLogin = true;
  }

  const seedAnnouncements = () => [
    { id: uid(), text: "New graphic novels just arrived — check out Amulet!", date: Date.now() },
    { id: uid(), text: "Return books on time to keep them available for friends.", date: Date.now() },
    { id: uid(), text: "Book club meets every Friday after school. All welcome!", date: Date.now() },
  ];

  function getAnnouncements(st) {
    return (st.announcements || []).slice().sort((a, b) => b.date - a.date);
  }

  function addAnnouncement(text, st) {
    st.announcements = st.announcements || [];
    st.announcements.push({ id: uid(), text: (text || "").trim(), date: Date.now() });
    save(st);
  }

  function updateAnnouncement(id, text, st) {
    const a = st.announcements.find(x => x.id === id);
    if (a) { a.text = (text || "").trim(); a.date = Date.now(); save(st); }
  }

  function deleteAnnouncement(id, st) {
    st.announcements = (st.announcements || []).filter(x => x.id !== id);
    save(st);
  }

  function save(st) {
    _cache = st;
    if (_mode === "server") {
      // Push to the shared backend (fire-and-forget, non-blocking).
      try {
        fetch("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(st),
        }).catch(() => {});
      } catch (e) { /* ignore */ }
    }
    // Mirror to localStorage so a refresh/offline always has a copy.
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
  }

  function getState() {
    seedIfEmpty();
    return _cache || load();
  }

 /* ---------------------------- Date helpers ---------------------------- */
 const DAY_MS = 86400000;
 function addDays(ms, days) { return ms + days * DAY_MS; }
 function todayMs() { return Date.now(); }
 function startOfDay(ms) { const d = new Date(ms); d.setHours(0,0,0,0); return d.getTime(); }
 function daysBetween(fromMs, toMs) {
 return Math.round((startOfDay(toMs) - startOfDay(fromMs)) / DAY_MS);
 }

 function fmtDate(ms) {
 return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
 }

 /* ------------------------- Popularity logic --------------------------- */
 // Average reader rating (0 if none).
 function avgRating(book) {
 if (!book ||!book.ratingCount) return 0;
 return book.ratingSum / book.ratingCount;
 }

 // Returns a popularity score influenced by total + recent checkouts + ratings.
 function popularityScore(book) {
 if (!book) return 0;
 return (book.checkoutCount || 0) + (book.recentCheckouts || 0) * 2 + avgRating(book) * 1.2;
 }

 // Rank a book against all books to pick hot / rising / steady.
 function popularityTier(book, allBooks) {
 const score = popularityScore(book);
 const scores = allBooks.map(popularityScore);
 const max = Math.max(...scores, 1);
 const pct = score / max;
 if (pct >= 0.75) return "hot";
 if (pct >= 0.45) return "rising";
 return "steady";
 }

 function popularityInfo(book, allBooks) {
 const tier = popularityTier(book, allBooks);
 return { tier, label: POPULARITY[tier].label, factor: POPULARITY[tier].factor };
 }

 /* ----------------------- Loan duration (due date) --------------------- */
 function loanDurationDays(book, allBooks) {
 const base = TYPE_POLICY[book.type].baseDays;
 const { factor } = popularityInfo(book, allBooks);
 const days = Math.round(base * factor);
 const min = POPULARITY[popularityTier(book, allBooks)].minDays;
 return Math.max(days, min, 1);
 }

 function computeDueDate(book, allBooks, fromMs) {
 fromMs = fromMs || Date.now();
 return addDays(fromMs, loanDurationDays(book, allBooks));
 }

 /* ---------------------- Dynamic replacement price --------------------- */
 function replacementPrice(book) {
 const base = book.basePrice || 10;
 const cf = CONDITION_FACTOR[book.condition]?.factor || 1;
 const popBoost = 1 + Math.min(popularityScore(book) / 100, 0.5); // popular => pricier to replace
 const raw = base * cf * popBoost;
 // Round to the nearest cent.
 return Math.max(1, Math.round(raw * 100) / 100);
 }

 /* ----------------------------- Availability --------------------------- */
 // Physical copies on the shelf right now (checked-out copies subtracted).
 function availableCopies(bookId, st) {
 const book = st.books.find(x => x.id === bookId);
 if (!book) return 0;
 const out = st.loans.filter(l => l.bookId === bookId &&!l.returned).length;
 return Math.max(0, book.totalCopies - out);
 }

 function copiesOut(bookId, st) {
 return st.loans.filter(l => l.bookId === bookId &&!l.returned).length;
 }

 // Is there a waiting list (holds) for this book?
 function hasHoldQueue(bookId, st) {
 return st.holds.filter(h => h.bookId === bookId).length > 0;
 }

 // Can this user check out a copy right now? If a book has a wait list, only
 // the student at the front of the line may claim the next returned copy.
 function canCheckout(bookId, userId, st) {
 if (availableCopies(bookId, st) <= 0) return false;
 if (!hasHoldQueue(bookId, st)) return true;
 const line = st.holds.filter(h => h.bookId === bookId).sort((a, b) => a.placedDate - b.placedDate);
 return line.length > 0 && line[0].userId === userId;
 }

 /* -------------------------------- Loans ------------------------------- */
 function activeLoansForUser(userId, st) {
 return st.loans.filter(l => l.userId === userId &&!l.returned);
 }

 function createLoan(bookId, userId, st) {
 const user = st.users.find(u => u.id === userId);
 if (!user) return { ok: false, msg: "Please sign in first." };
 const setting = st.settings.maxLoansPerStudent;
 if (user.role === "student" && activeLoansForUser(userId, st).length >= setting) {
 return { ok: false, msg: `You can only have ${setting} books out at a time. Please return one first.` };
 }
 if (!canCheckout(bookId, userId, st)) {
 if (availableCopies(bookId, st) <= 0) {
 return { ok: false, msg: "No copies available right now. Place a hold to get in line." };
 }
 return { ok: false, msg: "This copy is reserved for the next student in line. Place a hold to join the waitlist." };
 }
 const book = st.books.find(x => x.id === bookId);
 // Remove any hold this user has on the book.
 st.holds = st.holds.filter(h =>!(h.bookId === bookId && h.userId === userId));
 const now = Date.now();
 const due = computeDueDate(book, st.books, now);
 const loan = {
 id: uid(),
 bookId, userId,
 checkoutDate: now,
 dueDate: due,
 returned: false,
 returnDate: null,
 renewals: 0,
 };
 st.loans.push(loan);
 book.checkoutCount = (book.checkoutCount || 0) + 1;
 book.recentCheckouts = (book.recentCheckouts || 0) + 1;
 save(st);
 return { ok: true, loan };
 }

 function returnLoan(loanId, st) {
 const loan = st.loans.find(l => l.id === loanId);
 if (!loan || loan.returned) return { ok: false, msg: "This loan is already returned." };
 loan.returned = true;
 loan.returnDate = Date.now();
 save(st);
 // Place next hold in line if people are waiting.
 const next = st.holds.filter(h => h.bookId === loan.bookId).sort((a, b) => a.placedDate - b.placedDate)[0];
 return { ok: true, nextHold: next };
 }

 function renewLoan(loanId, st) {
 const loan = st.loans.find(l => l.id === loanId);
 if (!loan || loan.returned) return { ok: false, msg: "Cannot renew." };
 const book = st.books.find(x => x.id === loanId ? true: x.id === loan.bookId);
 const b = st.books.find(x => x.id === loan.bookId);
 const waiters = st.holds.filter(h => h.bookId === loan.bookId).length;
 if (waiters > 0) return { ok: false, msg: "Another student is waiting for this book, so it can't be renewed." };
 if (loan.renewals >= 1) return { ok: false, msg: "You can only renew a book once." };
 const due = addDays(loan.dueDate, TYPE_POLICY[b.type].baseDays / 2);
 loan.dueDate = due;
 loan.renewals += 1;
 save(st);
 return { ok: true, dueDate: due };
 }

 /* -------------------------------- Holds ------------------------------- */
 function createHold(bookId, userId, st) {
 if (availableCopies(bookId, st) > 0) {
 return { ok: false, msg: "Copies are available — just check it out now!" };
 }
 const already = st.holds.find(h => h.bookId === bookId && h.userId === userId);
 if (already) return { ok: false, msg: "You already have a hold on this book." };
 const user = st.users.find(u => u.id === userId);
 if (user.role === "student" && st.holds.filter(h => h.userId === userId).length >= st.settings.maxHoldsPerStudent) {
 return { ok: false, msg: `You can only hold ${st.settings.maxHoldsPerStudent} books at once.` };
 }
 st.holds.push({ id: uid(), bookId, userId, placedDate: Date.now() });
 save(st);
 return { ok: true };
 }

 function removeHold(holdId, st) {
 st.holds = st.holds.filter(h => h.id!== holdId);
 save(st);
 }

 function holdPosition(holdId, st) {
 const h = st.holds.find(x => x.id === holdId);
 if (!h) return null;
 const waiters = st.holds.filter(x => x.bookId === h.bookId).sort((a,b)=>a.placedDate-b.placedDate);
 return waiters.findIndex(x => x.id === holdId) + 1;
 }

 /* ------------------------------ Overdue ------------------------------- */
 function isOverdue(loan, st) {
 if (loan.returned) return false;
 const grace = st.settings.overdueGraceDays || 0;
 return Date.now() > addDays(loan.dueDate, grace * DAY_MS);
 }

 function daysLate(loan) {
 if (loan.returned || Date.now() <= loan.dueDate) return 0;
 return daysBetween(loan.dueDate, Date.now());
 }

  /* ------------------------------ Auth ---------------------------------- */
  const SESS_KEY = "classroomLibrarySession";

  // Update the signed-in user's profile (e.g. display name).
  function updateProfile(fields) {
    const me = currentUser();
    if (!me) return { ok: false, msg: "Not signed in." };
    const st = getState();
    const target = st.users.find(u => u.id === me.id);
    if (!target) return { ok: false, msg: "Account not found." };
    if (fields && typeof fields.name === "string") target.name = fields.name.trim() || target.name;
    save(st);
    // refresh cached/session user
    _me = Object.assign({}, target, { hasPassword: !!target.pw || !!target.password });
    setSession(_me);
    return { ok: true, user: _me };
  }

  function session() {
    const raw = sessionStorage.getItem(SESS_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  function setSession(user) {
    // Store the (redacted) user object so pages work without another round-trip.
    sessionStorage.setItem(SESS_KEY, JSON.stringify(user));
  }
  function clearSession() {
    sessionStorage.removeItem(SESS_KEY);
    _me = null;
    if (_mode === "server") {
      try { fetch("/api/logout", { method: "POST" }).catch(() => {}); } catch (e) {}
    }
  }

  let _me = null;

  function authenticate(username, password) {
    if (_mode === "server") {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/login", false);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.send(JSON.stringify({ username, password }));
        if (xhr.status === 200) {
          const user = JSON.parse(xhr.responseText);
          _me = user;
          setSession(user);
          return user;
        }
      } catch (e) { /* fall through to local if network fails */ }
      return null;
    }
    // local mode (offline fallback)
    const st = getState();
    const user = st.users.find(u => (u.username || "").toLowerCase() === (username || "").toLowerCase());
    if (!user || user.password !== password) return null;
    _me = user;
    setSession(user);
    return user;
  }

  // Kiosk auto-login (server mode): server issues a session for the kiosk
  // account so the no-login kiosk can save checkouts.
  function kioskLogin() {
    if (_mode !== "server") return null;
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/kiosk-login", false);
      xhr.send(null);
      if (xhr.status === 200) {
        const user = JSON.parse(xhr.responseText);
        _me = user;
        setSession(user);
        return user;
      }
    } catch (e) {}
    return null;
  }

  // Change password (server mode uses the hashed endpoint). Does NOT require
  // the current password — the user is already signed in.
  function changePassword(newPassword) {
    if (_mode === "server") {
      try {
        const me = currentUser();
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/change-password", false);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.send(JSON.stringify({ username: me ? me.username : "", newPassword }));
        if (xhr.status === 200) {
          _me = JSON.parse(xhr.responseText);
          setSession(_me);
          return { ok: true, user: _me };
        }
        const err = JSON.parse(xhr.responseText);
        return { ok: false, msg: err.error || "Couldn't change password." };
      } catch (e) { return { ok: false, msg: "Couldn't reach the server." }; }
    }
    // local mode
    const me = currentUser();
    if (!me) return { ok: false, msg: "Not signed in." };
    const st = getState();
    const target = st.users.find(u => u.id === me.id);
    target.password = newPassword;
    target.passwordChangeRequired = false;
    save(st);
    setSession(target);
    _me = target;
    return { ok: true, user: target };
  }

  function currentUser() {
    if (_me) return _me;
    if (_mode === "server") {
      // Re-validate from the server's session cookie if we have a cached user.
      const s = session();
      if (!s || !s.id) return null;
      try {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", "/api/me", false);
        xhr.send(null);
        if (xhr.status === 200) { _me = JSON.parse(xhr.responseText); return _me; }
      } catch (e) {}
      return s; // fall back to cached (offline)
    }
    const s = session();
    if (!s) return null;
    return getState().users.find(u => u.id === s.id) || null;
  }

  function refreshSession() {
    _me = null;
    return currentUser();
  }

 /* ------------------------------- Reviews ------------------------------ */
 function reviewsFor(bookId, st) {
 return (st.reviews || []).filter(r => r.bookId === bookId).sort((a, b) => b.date - a.date);
 }

 function reviewCount(bookId, st) {
 return reviewsFor(bookId, st).length;
 }

 // Upsert: one review per student per book (newer review replaces the old one).
 function addReview(bookId, userId, rating, text, st) {
 if (!bookId ||!userId) return { ok: false, msg: "Please sign in to review." };
 rating = Math.max(1, Math.min(5, Math.round(Number(rating) || 0)));
 const book = st.books.find(x => x.id === bookId);
 if (!book) return { ok: false, msg: "Book not found." };
 const existing = st.reviews.find(r => r.bookId === bookId && r.userId === userId);
 if (existing) {
 // remove old contribution from the running total
 book.ratingSum -= existing.rating;
 existing.rating = rating;
 existing.text = (text || "").trim();
 existing.date = Date.now();
 book.ratingSum += rating;
 } else {
 st.reviews.push({ id: uid(), bookId, userId, rating, text: (text || "").trim(), date: Date.now() });
 book.ratingSum = (book.ratingSum || 0) + rating;
 book.ratingCount = (book.ratingCount || 0) + 1;
 }
 save(st);
 return { ok: true };
 }

 // Render a star row for a given average (0..5). Uses only the universal
 // text glyphs ★ (U+2605) and ☆ (U+2606) so it renders on every machine.
 function starHTML(avg, size) {
 const a = Math.max(0, Math.min(5, avg || 0));
 const fullStars = Math.round(a); // e.g. 4.3 -> 4, 4.6 -> 5
 let out = "";
 for (let i = 1; i <= 5; i++) out += i <= fullStars ? "★" : "☆";
 const s = size ? ` style="font-size:${size}"` : "";
 return `<span class="stars" title="${a.toFixed(1)} out of 5"${s}>${out}</span>`;
 }

  /* --------------------------- Reset / export --------------------------- */
  function resetAll() {
    _cache = null; _mode = null;
    try { localStorage.removeItem(KEY); } catch (e) {}
    if (typeof fetch !== "undefined") {
      try { fetch("/api/reset", { method: "POST" }).catch(() => {}); } catch (e) {}
    }
    seedIfEmpty();
  }

  /* ------------------------- Book requests (#3) ------------------------- */
  function addRequest(userId, title, author, isbn, note) {
    const st = getState();
    st.requests = st.requests || [];
    st.requests.push({
      id: uid(), userId, title: title.trim(), author: (author || "").trim(),
      isbn: (isbn || "").trim(), note: (note || "").trim(),
      date: Date.now(), status: "pending",
    });
    save(st);
    return st.requests[st.requests.length - 1];
  }

  function removeRequest(reqId, st) {
    st.requests = (st.requests || []).filter(r => r.id !== reqId);
    save(st);
  }

  /* ---------------------- Lost/damaged charges (#6) --------------------- */
  // Create a replacement charge for a student on a given book.
  function addCharge(bookId, userId, reason, st) {
    const book = st.books.find(x => x.id === bookId);
    if (!book) return { ok: false, msg: "Book not found." };
    const amount = replacementPrice(book);
    st.charges = st.charges || [];
    st.charges.push({
      id: uid(), bookId, userId, amount,
      reason: reason || "Lost / damaged",
      date: Date.now(), paid: false,
    });
    save(st);
    return { ok: true, charge: st.charges[st.charges.length - 1] };
  }

  function markChargePaid(chargeId, st) {
    const c = st.charges.find(x => x.id === chargeId);
    if (!c) return { ok: false };
    c.paid = true;
    save(st);
    return { ok: true };
  }

  function chargesForUser(userId, st) {
    return (st.charges || []).filter(c => c.userId === userId).sort((a, b) => b.date - a.date);
  }

  /* -------------------------- Kiosk helpers ---------------------------- */
  const CLASSES = ["7A", "7B", "8A", "8B"];
  function studentsByClass(st) {
    const map = {};
    CLASSES.forEach(c => map[c] = []);
    (st.users || []).forEach(u => {
      if (u.role !== "student") return;
      const k = u.class && CLASSES.includes(u.class) ? u.class : "7A";
      map[k].push(u);
    });
    Object.keys(map).forEach(c => map[c].sort((a, b) => a.name.localeCompare(b.name)));
    return map;
  }

 /* ------------------------------ Public API ---------------------------- */
 return {
 getState, save, seedIfEmpty, resetAll, uid,
 TYPE_POLICY, POPULARITY, CONDITION_FACTOR, GENRES,
 todayMs, addDays, daysBetween, fmtDate, DAY_MS,
 popularityScore, popularityTier, popularityInfo, avgRating,
 loanDurationDays, computeDueDate, replacementPrice,
 reviewsFor, reviewCount, addReview, starHTML,
 availableCopies, copiesOut, hasHoldQueue, canCheckout,
 createLoan, returnLoan, renewLoan,
 createHold, removeHold, holdPosition,
 activeLoansForUser, isOverdue, daysLate,
    authenticate, currentUser, session, setSession, clearSession,
    addRequest, removeRequest,
    addCharge, markChargePaid, chargesForUser,
    getAnnouncements, addAnnouncement, updateAnnouncement, deleteAnnouncement,
    CLASSES, studentsByClass,
    kioskLogin, changePassword, updateProfile,
  };
})();

// Browser global + optional CommonJS export (used by automated tests).
if (typeof window!== "undefined") window.Store = Store;
if (typeof module!== "undefined") module.exports = Store;
