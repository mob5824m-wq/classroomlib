/* ============================================================
 * a11y.js — Accessibility & display settings (#15)
 *   - Dark mode toggle
 *   - Larger text toggle
 *   - Dyslexia-friendly font toggle
 * Settings persist in localStorage and apply to every page.
 * ============================================================ */
(function () {
  const KEY = "classroomLibraryA11y";

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function save(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }

  function apply() {
    const s = load();
    const root = document.documentElement;
    const body = document.body;

    // Class/attribute hooks (used by the stylesheet).
    if (s.dark) root.setAttribute("data-theme", "dark");
    else root.removeAttribute("data-theme");
    root.classList.toggle("large-text", !!s.large);
    root.classList.toggle("dyslexia", !!s.dyslexia);

    // Guaranteed inline fallbacks so the settings ALWAYS visibly apply even
    // if the stylesheet is cached/stale or a rule gets overridden.
    const rootStyle = root.style;
    const bodyStyle = body.style;
    if (s.dark) {
      bodyStyle.setProperty("background", "#10161a", "important");
      bodyStyle.setProperty("color", "#e6eef1", "important");
      rootStyle.setProperty("--bg", "#10161a", "important");
      rootStyle.setProperty("--card", "#182229", "important");
      rootStyle.setProperty("--line", "#2b3a44", "important");
      rootStyle.setProperty("--ink", "#e6eef1", "important");
      rootStyle.setProperty("--ink-soft", "#a7b8c2", "important");
    } else {
      bodyStyle.removeProperty("background");
      bodyStyle.removeProperty("color");
      ["--bg", "--card", "--line", "--ink", "--ink-soft"].forEach(p => rootStyle.removeProperty(p));
    }
    if (s.large) rootStyle.setProperty("font-size", "18px", "important");
    else rootStyle.removeProperty("font-size");
    if (s.dyslexia) bodyStyle.setProperty("font-family", "Verdana, 'Trebuchet MS', Arial, sans-serif", "important");
    else bodyStyle.removeProperty("font-family");

    return s;
  }

  function buildPopover(s) {
    const pop = document.createElement("div");
    pop.className = "card a11y-pop";
    pop.id = "a11y-pop";
    pop.innerHTML = `
      <strong style="font-size:.95rem">Display</strong>
      <div class="a11y-row"><label for="a11y-dark">Dark mode</label>
        <label class="switch"><input type="checkbox" id="a11y-dark" ${s.dark ? "checked" : ""}><span class="slider"></span></label></div>
      <div class="a11y-row"><label for="a11y-large">Larger text</label>
        <label class="switch"><input type="checkbox" id="a11y-large" ${s.large ? "checked" : ""}><span class="slider"></span></label></div>
      <div class="a11y-row"><label for="a11y-dyslexia">Dyslexia-friendly font</label>
        <label class="switch"><input type="checkbox" id="a11y-dyslexia" ${s.dyslexia ? "checked" : ""}><span class="slider"></span></label></div>`;
    return pop;
  }

  function init() {
    const s = apply();
    const bar = document.querySelector(".topbar-inner");
    if (!bar) return;

    const btn = document.createElement("button");
    btn.className = "btn btn-ghost btn-sm a11y-btn";
    btn.textContent = "Aa";
    btn.title = "Display settings";
    btn.setAttribute("aria-label", "Display settings");
    bar.appendChild(btn);

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      let pop = document.getElementById("a11y-pop");
      if (pop) { pop.remove(); return; }
      pop = buildPopover(load());
      document.body.appendChild(pop);
      pop.querySelector("#a11y-dark").addEventListener("change", (ev) => {
        const st = load(); st.dark = ev.target.checked; save(st); apply();
      });
      pop.querySelector("#a11y-large").addEventListener("change", (ev) => {
        const st = load(); st.large = ev.target.checked; save(st); apply();
      });
      pop.querySelector("#a11y-dyslexia").addEventListener("change", (ev) => {
        const st = load(); st.dyslexia = ev.target.checked; save(st); apply();
      });
    });
    document.addEventListener("click", (e) => {
      const pop = document.getElementById("a11y-pop");
      if (pop && !pop.contains(e.target) && !btn.contains(e.target)) pop.remove();
    });
  }

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
