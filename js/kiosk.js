/* ============================================================
 * kiosk.js — self-service classroom checkout / check-in.
 *
 * The kiosk offers exactly two actions: Check Out and Check In.
 * No sign-in is needed. Check Out scans a book and then asks which
 * student is taking it (a roster picker), recording the loan to that
 * student; Check In scans a book and returns whichever copy is
 * currently checked out.
 * ============================================================ */
(function () {
  const S = Store;

  /* ----------------------- mode switching ----------------------- */
  function showOptions() {
    document.getElementById("kiosk-options").hidden = false;
    document.getElementById("mode-checkout").hidden = true;
    document.getElementById("mode-checkin").hidden = true;
    clearResults();
  }

  function showMode(mode) {
    document.getElementById("kiosk-options").hidden = true;
    document.getElementById("mode-checkout").hidden = mode !== "checkout";
    document.getElementById("mode-checkin").hidden = mode !== "checkin";
    clearResults();
    if (mode === "checkout") document.getElementById("kiosk-barcode").focus();
    else document.getElementById("kiosk-checkin-barcode").focus();
  }

  function bindMode() {
    document.getElementById("kiosk-options").querySelectorAll(".kiosk-option").forEach(btn => {
      btn.addEventListener("click", () => showMode(btn.dataset.mode));
    });
    document.querySelectorAll("[data-back]").forEach(btn => btn.addEventListener("click", showOptions));
  }

  /* ------------------------- check out ------------------------- */
  function doCheckout(barcode) {
    const result = document.getElementById("kiosk-result");
    const st0 = S.getState();
    if (st0.settings && st0.settings.kioskEnabled === false) {
      result.innerHTML = `<div class="callout" style="background:var(--red-soft);border-color:var(--red)"><span>!</span><div><strong>The checkout kiosk is currently turned off.</strong> See your librarian.</div></div>`;
      return;
    }
    const book = lookup(barcode);
    if (!book) {
      result.innerHTML = `<div class="callout" style="background:var(--red-soft);border-color:var(--red)"><span>!</span><div><strong>No book found for that barcode.</strong> Try again or ask your librarian.</div></div>`;
      return;
    }
    // Ask who is checking out the book (roster picker), so the loan is
    // recorded to the real student instead of the generic kiosk account.
    window.pickStudent({
      title: "Who is checking out?",
      sub: `Scan complete. Which student is taking "${book.title}"?`
    }).then(student => {
      if (!student) return; // cancelled — leave the kiosk on the scan step
      const st = S.getState();
      const res = S.createLoan(book.id, student.id, st);
      if (res.ok) {
        result.innerHTML = `
          <div class="callout" style="background:var(--green-soft);border-color:var(--green)">
            <span>OK</span>
            <div>
              <strong>Checked out to ${esc(student.name)}!</strong><br>
              "${esc(book.title)}" is checked out.<br>
              Due back: <strong>${S.fmtDate(res.loan.dueDate)}</strong>.
            </div>
          </div>`;
        document.getElementById("kiosk-barcode").value = "";
        logKiosk("checkout", student.name, book.title);
      } else {
        result.innerHTML = `<div class="callout" style="background:var(--amber-soft);border-color:var(--amber)"><span>!</span><div>${esc(res.msg)}</div></div>`;
      }
    });
  }

  /* ------------------------- check in ------------------------- */
  function doCheckin(barcode) {
    const result = document.getElementById("kiosk-checkin-result");
    const book = lookup(barcode);
    if (!book) {
      result.innerHTML = `<div class="callout" style="background:var(--red-soft);border-color:var(--red)"><span>!</span><div><strong>No book found for that barcode.</strong> Check the number and try again.</div></div>`;
      return;
    }
    const st = S.getState();
    const active = st.loans.find(l => l.bookId === book.id && !l.returned);
    if (!active) {
      result.innerHTML = `<div class="callout" style="background:var(--amber-soft);border-color:var(--amber)"><span>!</span><div><strong>"${esc(book.title)}" is not currently checked out.</strong> It may already be on the shelf.</div></div>`;
      return;
    }
    const res = S.returnLoan(active.id, st);
    if (res.ok) {
      result.innerHTML = `
        <div class="callout" style="background:var(--green-soft);border-color:var(--green)">
          <span>OK</span>
          <div>
            <strong>Checked in!</strong><br>
            "${esc(book.title)}" is back on the shelf.<br>
            It's available again.
          </div>
        </div>`;
      document.getElementById("kiosk-checkin-barcode").value = "";
      logKiosk("checkin", "kiosk", book.title);
    } else {
      result.innerHTML = `<div class="callout" style="background:var(--amber-soft);border-color:var(--amber)"><span>!</span><div>${esc(res.msg)}</div></div>`;
    }
  }

  /* ------------------------ kiosk logging ----------------------- */
  function logKiosk(action, studentName, bookTitle) {
    const st = S.getState();
    st.kioskLog = st.kioskLog || [];
    st.kioskLog.push({ id: S.uid(), time: Date.now(), action, studentName, bookTitle });
    S.save(st);
  }

  /* ------------------------ barcode lookup ---------------------- */
  function lookup(code) {
    const digits = Scanner.normalize(code);
    if (!digits) return null;
    const st = S.getState();
    return st.books.find(b => String(b.isbn || "").replace(/[^0-9]/g, "").slice(0, 13) === digits) || null;
  }

  /* ------------------------- scanner wiring --------------------- */
  async function openScanner(onCode) {
    const code = await Scanner.open();
    if (code) onCode(code);
  }

  function clearResults() {
    const r = document.getElementById("kiosk-result");
    const ci = document.getElementById("kiosk-checkin-result");
    if (r) r.innerHTML = "";
    if (ci) ci.innerHTML = "";
  }

  /* ---------------------------- init --------------------------- */
  function init() {
    S.kioskLogin(); // establish a server session for the kiosk account
    bindMode();
    showOptions();
    document.getElementById("kiosk-scan-btn").addEventListener("click", () => openScanner(doCheckout));
    document.getElementById("kiosk-checkin-scan").addEventListener("click", () => openScanner(doCheckin));
    document.getElementById("kiosk-manual").addEventListener("submit", e => { e.preventDefault(); doCheckout(document.getElementById("kiosk-barcode").value); });
    document.getElementById("kiosk-checkin-manual").addEventListener("submit", e => { e.preventDefault(); doCheckin(document.getElementById("kiosk-checkin-barcode").value); });
  }

  if (document.readyState !== "loading") init(); else document.addEventListener("DOMContentLoaded", init);
})();
