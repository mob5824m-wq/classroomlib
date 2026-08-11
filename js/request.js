/* ============================================================
 * request.js — students can request books to be added (#3).
 * The request goes to the admin, who can approve it straight
 * into the catalog or decline it.
 * ============================================================ */
const RequestActions = (function () {
  const S = window.Store;

  function buildModal() {
    let m = document.getElementById("request-modal");
    if (!m) {
      m = document.createElement("div");
      m.id = "request-modal";
      m.className = "modal";
      document.body.appendChild(m);
    }
    const user = S.currentUser();
    m.innerHTML = `
      <div class="modal-card" id="request-modal-body">
        <button class="modal-x" data-x>&times;</button>
        <h2>Request a book</h2>
        <p class="muted small">Can't find something you want to read? Tell us and we'll try to add it to the library.</p>
        <form id="request-form">
          <label>Title *<input name="title" required placeholder="Book title"></label>
          <label>Author <input name="author" placeholder="Who wrote it?"></label>
          <label>ISBN <input name="isbn" placeholder="13-digit ISBN (optional)"></label>
          <label>Why do you want it? <textarea name="note" rows="3" placeholder="A sentence or two…"></textarea></label>
          <p id="request-msg" class="form-error" hidden></p>
          <button class="btn btn-primary btn-block" type="submit">Send request</button>
        </form>
      </div>`;
    return m;
  }

  function open() {
    const user = S.currentUser();
    if (!user) { openLogin(); return; }
    const m = buildModal();
    m.classList.add("open");
    const body = m.querySelector("#request-modal-body");
    body.querySelector("[data-x]").addEventListener("click", () => close(m));
    m.addEventListener("click", (e) => { if (e.target === m) close(m); });
    body.querySelector("#request-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      if (!data.title.trim()) return;
      S.addRequest(user.id, data.title, data.author, data.isbn, data.note);
      close(m);
      toast("Request sent! Your librarian will take a look. Thanks!");
    });
  }

  function close(m) { m.classList.remove("open"); }

  return { open };
})();

if (typeof window !== "undefined") window.RequestActions = RequestActions;
if (typeof module !== "undefined") module.exports = RequestActions;
