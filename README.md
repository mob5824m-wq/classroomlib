# Room 204 Classroom Library

A friendly, fully-functional **Classroom Library website** for Grade 7–8 students, built with **HTML, CSS, and vanilla JavaScript** (no frameworks, no build step). It runs on a small Node server that keeps one **shared** library (books, loans, holds, reviews, requests, charges) so every device sees the same data.

---

## Setup (three ways)

You only need **Node.js** installed on the computer that runs the library. Everything else is included in this folder — no build step, no database to install.

### A. Try it locally (quickest)

```bash
node server.js
```

Open **http://localhost:8080** and sign in with a demo account:

| Role | Username | Password |
|------|----------|----------|
| Librarian (Admin) | `admin` | `admin123` |
| Student | `alex` | `read123` |
| Student | `mia` | `read123` |
| Student | `jamal` | `read123` |

> **Data is stored in a shared `library-data.json` file** the server keeps, so it
> survives restarts and is the same on every device that connects to the server.
> Passwords are hashed and sessions use secure httpOnly cookies.

### B. Host it at home so it's usable at school (DuckDNS)

1. **Pick a DuckDNS hostname** — at https://www.duckdns.org create one, e.g.
   `myroomlibrary.duckdns.org`, and save your **token**.
2. **Auto-update DuckDNS** so it always points at your home IP (DuckDNS
   updater on Windows, a cron line on Linux/Raspberry Pi, or your router's
   DDNS setting). Full commands are in [HOSTING.md](HOSTING.md).
3. **Reserve a static LAN IP** for the computer in your router (e.g. `192.168.1.50`).
4. **Open a port**: forward external `443` → that computer → `8443`.
5. **Run Caddy for free HTTPS** (required for camera barcode scanning from
   school). Rename `Caddyfile.example` → `Caddyfile`, put in your DuckDNS
   hostname, then `caddy run`.
6. **Start the app**: `node server.js` (listens on `0.0.0.0:8080`).
7. **Test** on your phone's mobile data (not home Wi-Fi):
   `https://myroomlibrary.duckdns.org`.

> The first time the site is opened, `node server.js` prints the hostname it
> was reached at, so you can confirm your DuckDNS address is routing correctly.

### C. Public without port-forwarding (Cloudflare Tunnel)

If your ISP uses carrier-grade NAT (can't open ports), use a free Cloudflare
Tunnel instead — no port-forwarding, automatic HTTPS. See [HOSTING.md](HOSTING.md).

---

## 1. Site map

```
Our Classroom Library
├── Home (index.html) — welcome, stats, featured picks, announcements
├── Catalog (catalog.html) — browse, search, filter, check out, place holds
├── How to Check Out (how-to-check-out.html) — 3-step guide + FAQ + loan rules
├── My Library (my-library.html) — student's checked-out books, due dates, holds, returns
├── Checkout Kiosk (kiosk.html) — no-login checkout / check-in for the classroom
└── Admin (admin.html) — librarian console: manage books, students, loans, policy, pricing
```

### Checkout Kiosk (no account needed)

**Check Out** tab: pick your class (7A / 7B / 8A / 8B) → tap your name → scan or type
the book's barcode. Done — no sign-in required.

**Check In** tab: scan or type the book's barcode to return it (works even if no
one is signed in).

Each student has a **Class** (7A/7B/8A/8B) so the kiosk roster only shows their
classmates. The admin sets a student's class in **Admin → Students** (via the
Class dropdown in **Add/Edit**, or `Name | Class` in **Bulk add**).

Every page shares a sticky top nav and is fully **responsive** (desktop → tablet → phone).

---

## 2. Five features that make it kid-friendly

1. **Big, clear, one-tap actions.** Buttons say exactly what they do ("Check out", "Place hold", "Return") and never hide behind menu trails.
2. **Friendly status everywhere.** Every book card instantly shows **"2 available"**, **"Checked out"**, or **"Reserved"** in a color-coded badge — no guesswork.
3. **Explanatory micro-copy.** Little helpers like *"Borrow: 14 days"* and *" Hot pick"* teach students *why* a rule exists instead of confusing them.
4. **Forgiving + encouraging tone.** Overdue notices are gentle reminders, and confirmations celebrate ("It's yours until Aug 24! ").
5. **Students run it themselves.** Checking out, returning, renewing, and placing holds are all self-service — no librarian required for routine tasks.

---

## 3. Welcome / Home page copy

> **Welcome to your Classroom Library! **
>
> Your adventure starts here. Browse our shelves, find a story you'll love, and check out books to take home. Every book is a doorway to somewhere new — what will you discover today?

The home page also shows live stats (books on our shelves, available now, hot picks, readers in class), **Mrs. Alvarez's Picks**, a mini "How it works" summary, and announcements.

---

## 4. 3-step "How to Check Out" guide

1. ** Sign in** — Tap *Sign in* up in the corner and use the class username and password your librarian gave you. It only takes a second!
2. ** Pick a book** — Head to the *Catalog* and search for something you like. If it shows "available", tap **Check out** — it's yours!
3. **⏰ Read & return** — Enjoy your book, and bring it back **before its due date**. You'll see your due date in *My Library*.

The full guide page adds a loan-length table, "hot books = shorter loans" explanation, and an FAQ.

---

## Everything you asked for (features 5–15)

**5. Check out & check in** — Students check out in the Catalog (one tap) and return from *My Library* or the Admin console. Returns are logged and instantly free up copies.

**6. See what's available vs. checked out** — Every book card has a live availability badge; the Catalog has an "Availability" filter (Any / Available now / Checked out).

**7. An account for each student** — Individual student accounts (name, username, password, grade). Students see only *their* books and holds in *My Library*.

**8. Responsive layout** — Pure HTML/CSS/vanilla JS, mobile-first, fluid grids, works on phones, tablets, and desktops.

**9. Barcode creator** — Every book gets a real, scannable **EAN-13 barcode** drawn on a `<canvas>` (in `js/barcode.js`), with a **Download PNG** button — great for printing shelf labels.

**10. Catalog** — All books in a card grid with covers, authors, genres, popularity, and per-book detail view.

**11. Search bar with filters** — Live search by title/author, plus filters for **genre, type, availability**, and **sorting** (title / most popular / newest).

**12. Admin account** — `admin` can manage **all books** (add/edit/delete), **all students** (add/edit/delete/reset passwords), **all loans & overdue items**, and the **hold queue**.

**13. Time limit by book type + dynamic popularity** — Loan length is set per book type (novel 14d, graphic 10d, non-fiction 21d, textbook 28d, reference 5d) **and shortened for hot books** based on live popularity. Admins can tune the base days and the max-loans / holds / grace settings.

**14. Place books on hold** — When all copies are out, students join a fair queue. The front of the line gets first claim on the next returned copy, and *My Library* shows each student's position in line.

**15. Dynamic replacement price** — Every book shows a replacement value if lost or damaged, computed from **base price × condition multiplier × popularity boost**. Admins can adjust condition multipliers and each book's base price/condition.

## New in this build

**Scan barcodes to check out & check in.** Hit the ** Scan** button (floating bottom-right on the Catalog and Admin pages) to open the scanner. Three input paths work:
- **Camera** — uses the browser's Barcode Detection API (Chrome/Edge over `https`/`localhost`) to read the barcode live.
- **Type it** — just type or paste the barcode number.
- **Physical USB scanner** — plug one in, click the input box, and scan; it types the digits + Enter for you.

After a scan you can check out (to yourself as a student, or to *any* student as admin), return a copy, or place a hold. Scanning works with 13-digit EAN-13 barcodes, and it also accepts ISBN-10 and hyphenated forms.

**Admin: pull up loan & hold details by scanning.** Scan any book as the admin and you'll see a full breakdown — active loans (who has it, when due, one-click return), the hold queue (position + remove), and the book's replacement value. The same panel is also reachable from the Books table via the button (in case you don't have a scanner handy).

**Dynamic reviews, ratings & descriptions.** Students can rate books 1–5 stars and leave a review (one per student, editable) from the Catalog detail view. Every card and detail view shows live star ratings, and ratings feed into the popularity score. Real book descriptions are **pulled automatically from Open Library** in the background (once per session) — no manual work needed. Admins can also re-fetch or manually edit a description per book, or "auto-fill all" at once.

**Automatically pulled book covers.** Book covers load live from **Open Library** (`covers.openlibrary.org`) by ISBN — no manual uploads. If a cover isn't available (or you're offline), it falls back to a clean **text-only cover** (a large initial letter + type label) — no emoji, so it renders on any machine.

**Easy student account creation.** In Admin → **Students** you can:
- **+ Add student** — type a name and the username is auto-suggested (first name + last initial) with a generated password.
- ** Bulk add** — paste a list of names (one per line, optionally `Name | Grade`) and it creates every account instantly, showing a printable table of usernames & passwords to hand out.


**Shared backend — all devices see the same data.** The site now runs on a real
server (`node server.js`) that keeps one shared library stored in
`library-data.json`. Books, loans, holds, reviews, requests and charges are the
same on every computer/tablet, and the data survives restarts. Data still
mirrors to each browser's `localStorage` as a fallback (so opening `index.html`
directly still works offline). *(Known trade-off: saves are last-write-wins, so
if two people edit at the exact same moment the later save wins — fine for a
classroom.)*

**Book requests / wish list.** Students tap **Request a book** in the Catalog to
suggest a title. The admin sees these in the **Requests** tab and can **Add to
catalog** (opens the book form pre-filled) or **Decline** them.

**Teacher reports — overdue reminders.** In the **Reminders** tab the admin sees
every overdue book grouped by student, with a suggested reminder message. A
**Send reminders** button logs them to `reminder-log.txt` on the server. To
actually email/text students automatically, plug a provider into `server.js`.

**Lost / damaged book ledger.** The admin can **Charge for loss** from the Loans
table or a book's scan view — it charges the student the book's replacement
price. Charges appear in the **Charges** tab (mark paid) and students see their
own charges in **My Library**.

**Reviews feed on the homepage.** The home page now shows **Top rated** books
and **Recent reviews**, encouraging students to rate and read.

**Genre shelf view.** In the Catalog, switch between **Grid** and **Shelves**
views. Shelves group books by genre under colorful shelf headers, like a real
library.

**Dark mode & accessibility.** Tap the **Aa** button in the top bar for a popover
with three toggles that persist across visits: **Dark mode**, **Larger text**,
and a **Dyslexia-friendly font**.

---

## Admin console quick tour


- **Overview** — totals, overdue list, most-popular books.
- **Books** — add / edit / delete books, adjust copies, price, condition, and print barcodes.
- **Students** — manage accounts and passwords (details below).
- **Loans & Overdue** — see every active loan, mark returns, view return history.
- **Holds** — manage the hold queue.
- **Requests** — approve/decline student book requests.
- **Charges** — track lost/damaged book replacement charges and mark them paid.
- **Reminders** — overdue books grouped by student, with suggested messages.
- **Announcements** — add / edit / delete the notices shown on the home page.
- **Loan Policy** — tune base loan days per type, max books/student, max holds, overdue grace.
- **Pricing** — tune condition multipliers (drives replacement price).
- **Display** — dark mode / larger text toggles for the admin's own browser.
- **Danger zone** — reset all demo data to the starting point.

### How to manage students (add / edit / view)

Everything lives in the **Students** tab of the Admin Dashboard (the tab labeled
"Students" in the row of buttons near the top of the admin page).

1. **Sign in as admin** — `admin` / `admin123` — and open **Admin** from the top bar.
2. **View** — the Students tab lists every account in a table: name, username,
   grade, role, and how many books each student currently has checked out.
3. **Add one student** — click **+ Add student**. Type the full name and the
   username auto-fills (first name + last initial); a password is generated for
   you (you can change it). Pick the grade, then **Add student**.
4. **Add many at once** — click **Bulk add**. Paste one name per line
   (optionally `Name | Grade`), set a default password, and it creates every
   account instantly, showing a printable table of usernames & passwords.
5. **Edit** — click **Edit** on a student's row to change their name, grade, role,
   or password (leave the password blank to keep the current one).
6. **Delete** — click **Delete** on a student's row (this also removes their loans
   and holds).

Students log in with their username/password on any page via **Sign in**.

---

## Project structure

```
classroomlib/
├── index.html Home
├── catalog.html Catalog (search, filters, checkout, holds, barcodes)
├── how-to-check-out.html 3-step guide + FAQ
├── my-library.html Student dashboard
├── admin.html Admin console
├── css/style.css All styles (responsive)
├── js/
│ ├── store.js Data layer + all business rules (loans, holds, popularity, pricing, reviews)
│ ├── barcode.js EAN-13 barcode generator (canvas) + PNG download
│ ├── covers.js Auto-pulls book covers & descriptions from Open Library
│ ├── scanner.js Barcode scanner (camera + typed / physical-scanner input)
│ ├── scan.js Scan workflow: check out / return / hold + admin loan & hold details
│ ├── app.js Shared nav, login modal, toasts, availability badges
│ ├── catalog.js Catalog page logic
│ ├── mylibrary.js Student dashboard logic
│ ├── admin.js Admin console logic
│ └── home.js Home page logic
├── HOSTING.md Home hosting + dynamic DNS + HTTPS guide
└── README.md You are here
```

---

## Going beyond the built-in backend

The app already ships with a **Node backend** (`server.js`) that keeps a shared
JSON data file, hashes passwords, and uses httpOnly session cookies — enough for
a classroom. If you ever outgrow it (many simultaneous writers, or need to run
on a hosted platform), `js/store.js` is the single seam: re-implement its public
API (`getState`, `save`, `createLoan`, `returnLoan`, `createHold`, `renewLoan`,
`authenticate`, `currentUser`, …) to call a real database/API instead, and every
page keeps working unchanged.

---

*Built for our Grade 7–8 readers. Read on, dream big! *
