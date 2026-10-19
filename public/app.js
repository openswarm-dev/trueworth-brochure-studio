// Brochure Studio front end: a tiny router with three views
//   /        → brochure library
//   /new     → research brief form
//   /b/:id   → live progress, then the brochure workspace
const $app = document.getElementById("app");
let config = { services: [], team: [] };
let cleanup = () => {};

const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const STATUS = { queued: "Queued", researching: "Researching", writing: "Writing", checking: "Fact-checking", ready: "Ready", error: "Failed" };
const SERVICE_NAMES = { roadmap: "AI Roadmap", workshop: "AI Workshop", project: "30-Day AI Project", collective: "The Collective" };

async function api(path, opts = {}) {
  const res = await fetch(`/api${path}`, { headers: { "Content-Type": "application/json" }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

function toast(msg, isErr = false) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = `toast${isErr ? " err" : ""}`;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.hidden = true), 3500);
}

function statusPill(status) {
  const cls = status === "ready" ? "ok" : status === "error" ? "err" : "busy";
  return `<span class="pill ${cls}">${STATUS[status] || status}</span>`;
}

// ---- router ----------------------------------------------------------------
function go(path) {
  history.pushState({}, "", path);
  route();
}
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-link]");
  if (a && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    go(a.getAttribute("href"));
  }
});
window.addEventListener("popstate", route);

function route() {
  cleanup();
  cleanup = () => {};
  window.scrollTo(0, 0);
  const p = location.pathname;
  if (p === "/new") return viewNew();
  const m = p.match(/^\/b\/([a-z0-9-]+)$/);
  if (m) return viewBrochure(m[1]);
  return viewList();
}

// ---- library -----------------------------------------------------------------
async function viewList() {
  document.title = "Brochure Studio · True Worth AI";
  $app.innerHTML = `
    <section class="hero">
      <div class="inner">
        <div class="copy">
          <div class="eyebrow">Sales enablement · Brochure Studio</div>
          <h1>Every prospect gets a brochure written about them.</h1>
          <p>Drop in a company. We research their website, socials and news, find where AI pays back for them, and design a True Worth AI partnership brochure in our brand, ready to send.</p>
          <div class="actions">
            <a href="/new" class="btn pink" data-link>Create a brochure</a>
            <a href="https://trueworth.ai/" class="btn ghost-light" target="_blank" rel="noopener">View trueworth.ai</a>
          </div>
        </div>
        <img class="ill" src="/assets/brand/ill-megaphone.png" alt="">
      </div>
    </section>
    <section class="wrap">
      <div class="section-head"><h2>Your brochures</h2><span class="muted" id="count"></span></div>
      <div id="list" class="cards"><p class="muted">Loading…</p></div>
    </section>`;
  const list = await api("/brochures").catch((e) => (toast(e.message, true), []));
  const $list = document.getElementById("list");
  document.getElementById("count").textContent = list.length ? `${list.length} brochure${list.length > 1 ? "s" : ""}` : "";
  if (!list.length) {
    $list.outerHTML = `<div class="empty"><img src="/assets/brand/ill-rocket.png" alt=""><h3>No brochures yet</h3><p>Create your first one. It takes a few minutes while the AI researches the company.</p><a href="/new" class="btn pink" data-link>Create a brochure</a></div>`;
    return;
  }
  $list.innerHTML = list
    .map(
      (b) => `<a class="bcard" href="/b/${b.id}" data-link>
        <h3>${esc(b.companyName)}</h3>
        <div class="site">${esc(b.website.replace(/^https?:\/\//, ""))}${b.contactName ? ` · for ${esc(b.contactName)}` : ""}</div>
        ${b.sector ? `<div class="muted" style="font-size:14px">${esc(b.sector)}</div>` : ""}
        <div class="meta">${statusPill(b.status)}${b.service ? `<span class="pill pink">${esc(SERVICE_NAMES[b.service] || b.service)}</span>` : ""}<span class="pill">${fmtDate(b.createdAt)}</span></div>
      </a>`,
    )
    .join("");
  // Keep in-flight cards fresh.
  if (list.some((b) => !["ready", "error"].includes(b.status))) {
    const t = setTimeout(() => location.pathname === "/" && route(), 5000);
    cleanup = () => clearTimeout(t);
  }
}

// ---- new brochure --------------------------------------------------------------
// Step 1: paste a website and Fetch. We read the site for its name and linked
// profiles, then search the web for any it doesn't link to. The team ticks the
// links they've verified. Step 2: optional context, then create.
const PLATFORM_ICONS = { linkedin: "in", facebook: "f", instagram: "◎", x: "𝕏", youtube: "▶", tiktok: "♪", trustpilot: "★", glassdoor: "G", companieshouse: "CH", crunchbase: "cb", github: "gh", pinterest: "P", threads: "@", google: "G", other: "🔗" };

async function viewNew() {
  document.title = "New brochure · Brochure Studio";
  const platforms = await api("/platforms").catch(() => ({}));
  let profiles = []; // { platform, url, source, confidence?, note?, keep }
  let fetched = null;
  let searching = false;

  $app.innerHTML = `
    <section class="hero slim"><div class="inner"><div class="copy">
      <div class="eyebrow">New brochure</div>
      <h1>Paste their website. We'll find the rest.</h1>
      <p>We read their site and search the web for their LinkedIn, socials and review pages. Check the links, then create the brochure.</p>
    </div></div></section>
    <section class="wrap">
      <form class="fetch-bar" id="fetch-form" autocomplete="off">
        <input id="url" placeholder="https://theirwebsite.co.uk" autofocus>
        <button class="btn pink" id="fetch-btn" type="submit">Fetch</button>
      </form>
      <div id="found" hidden></div>
    </section>`;

  const $found = document.getElementById("found");
  const $url = document.getElementById("url");

  const platformLabel = (k) => platforms[k] || k;
  const sourceChip = (p) =>
    p.source === "website"
      ? '<span class="pill ok">Linked from their website</span>'
      : p.source === "manual"
        ? '<span class="pill">Added by you</span>'
        : `<span class="pill ${p.confidence === "high" ? "pink" : ""}">Found by search · ${esc(p.confidence || "low")} confidence</span>`;

  function renderProfiles() {
    const list = document.getElementById("profiles");
    if (!list) return;
    const kept = profiles.filter((p) => p.keep).length;
    list.innerHTML =
      (profiles.length
        ? profiles
            .map(
              (p, i) => `<div class="prow${p.keep ? "" : " off"}">
          <label class="tick"><input type="checkbox" data-i="${i}" ${p.keep ? "checked" : ""}><span></span></label>
          <span class="picon">${PLATFORM_ICONS[p.platform] || "🔗"}</span>
          <div class="pmain">
            <div class="ptop"><strong>${esc(platformLabel(p.platform))}</strong>${sourceChip(p)}</div>
            <a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.url)} ↗</a>
            ${p.note ? `<div class="pnote">${esc(p.note)}</div>` : ""}
          </div>
          <button type="button" class="btn sm danger" data-rm="${i}" title="Remove">✕</button>
        </div>`,
            )
            .join("")
        : '<p class="muted" style="padding:14px 0">No profiles found yet.</p>') +
      (searching ? '<div class="searching"><span class="pill busy">Searching the web for more profiles…</span></div>' : "");
    document.getElementById("kept").textContent = `${kept} of ${profiles.length} selected`;
    list.querySelectorAll("input[data-i]").forEach((c) => (c.onchange = () => ((profiles[c.dataset.i].keep = c.checked), renderProfiles())));
    list.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => (profiles.splice(Number(b.dataset.rm), 1), renderProfiles())));
  }

  function addProfiles(list) {
    const have = new Set(profiles.map((p) => p.url.toLowerCase()));
    for (const p of list) {
      if (have.has(p.url.toLowerCase())) continue;
      have.add(p.url.toLowerCase());
      profiles.push({ ...p, keep: p.source === "website" || p.source === "manual" || p.confidence === "high" });
    }
    const order = Object.keys(platforms);
    profiles.sort((a, b) => order.indexOf(a.platform) - order.indexOf(b.platform));
  }

  function renderFound() {
    $found.hidden = false;
    $found.innerHTML = `
      <div class="form-grid">
        <div class="panel">
          <div class="co-head">
            ${fetched.image ? `<img src="${esc(fetched.image)}" alt="" onerror="this.remove()">` : ""}
            <div>
              <div class="eyebrow">Company</div>
              <input class="co-name" id="companyName" value="${esc(fetched.companyName)}" aria-label="Company name">
              <a class="muted" href="${esc(fetched.website)}" target="_blank" rel="noopener">${esc(fetched.website)} ↗</a>
              ${fetched.description ? `<p class="co-desc">${esc(fetched.description)}</p>` : ""}
              <div id="name-hint"></div>
            </div>
          </div>
          <div class="section-head" style="margin:24px 0 6px"><h3>Profiles we found</h3><span class="muted" id="kept"></span></div>
          <p class="sub">Open each link to check it's really them. Only ticked links are used in the research.</p>
          <div id="profiles"></div>
          <form class="add-row" id="add-form">
            <input id="add-url" placeholder="Add a link we missed, e.g. linkedin.com/company/…">
            <button class="btn outline sm" type="submit">Add</button>
          </form>
        </div>
        <form class="panel" id="f" autocomplete="off">
          <h3>Anything else? <span class="muted" style="font-weight:500;font-size:14px">Optional</span></h3>
          <p class="sub">Helps personalise the brochure.</p>
          <div class="row2">
            <div class="field"><label>Contact name</label><input name="contactName" placeholder="Who will receive it"></div>
            <div class="field"><label>Their role</label><input name="contactRole" placeholder="e.g. Operations Director"></div>
          </div>
          <div class="field"><label>What we already know</label><textarea name="notes" placeholder="Meeting notes, pain points they mentioned, tools they use, how we met…"></textarea></div>
          <div class="field"><label>Lead with</label>
            <select name="service"><option value="auto">Let the research decide (recommended)</option>${config.services.map((s) => `<option value="${s.key}">${esc(s.name)} · ${esc(s.price)}</option>`).join("")}</select>
          </div>
          <button class="btn pink" type="submit" ${config.hasApiKey ? "" : "disabled"}>Research &amp; create brochure</button>
          <p class="note">Research takes 2–6 minutes and runs in the background.</p>
        </form>
      </div>`;
    renderProfiles();

    document.getElementById("add-form").onsubmit = (e) => {
      e.preventDefault();
      const input = document.getElementById("add-url");
      let url = input.value.trim();
      if (!url) return;
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      try {
        const host = new URL(url).hostname.replace(/^www\./, "");
        const platform = Object.keys(platforms).find((k) => k !== "other" && host.includes(k === "x" ? "x.com" : k === "companieshouse" ? "company-information" : k)) || (host.includes("twitter") ? "x" : "other");
        addProfiles([{ platform, url, source: "manual" }]);
        input.value = "";
        renderProfiles();
      } catch {
        toast("That doesn't look like a link.", true);
      }
    };

    document.getElementById("f").onsubmit = async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const btn = f.querySelector("button[type=submit]");
      const companyName = document.getElementById("companyName").value.trim();
      if (!companyName) return toast("Add the company name.", true);
      btn.disabled = true;
      btn.textContent = "Starting…";
      try {
        const body = {
          ...Object.fromEntries(new FormData(f)),
          companyName,
          website: fetched.website,
          profiles: profiles.filter((p) => p.keep).map(({ platform, url }) => ({ platform, url })),
        };
        const { id } = await api("/brochures", { method: "POST", body });
        go(`/b/${id}`);
      } catch (err) {
        toast(err.message, true);
        btn.disabled = false;
        btn.textContent = "Research & create brochure";
      }
    };
  }

  document.getElementById("fetch-form").onsubmit = async (e) => {
    e.preventDefault();
    const url = $url.value.trim();
    if (!url) return $url.focus();
    const btn = document.getElementById("fetch-btn");
    btn.disabled = true;
    btn.textContent = "Reading website…";
    profiles = [];
    $found.hidden = true;
    try {
      fetched = await api("/discover", { method: "POST", body: { url } });
      addProfiles(fetched.profiles);
      $url.value = fetched.website;
      searching = config.hasApiKey;
      renderFound();
    } catch (err) {
      toast(err.message, true);
      return;
    } finally {
      btn.disabled = false;
      btn.textContent = "Fetch";
    }
    if (!searching) return;
    const forSite = fetched.website;
    try {
      const r = await api("/discover/search", { method: "POST", body: { website: fetched.website, companyName: fetched.companyName, known: profiles.map((p) => p.url) } });
      if (fetched.website !== forSite) return; // a newer Fetch replaced this one
      addProfiles(r.profiles);
      const hint = document.getElementById("name-hint");
      if (hint && r.companyName && r.companyName.toLowerCase() !== fetched.companyName.toLowerCase() && r.companyName.length < 80) {
        hint.innerHTML = `<button type="button" class="link-btn">Search suggests: <strong>${esc(r.companyName)}</strong> · use this</button>`;
        hint.querySelector("button").onclick = () => ((document.getElementById("companyName").value = r.companyName), (hint.innerHTML = ""));
      }
    } catch (err) {
      toast(err.message, true);
    } finally {
      if (fetched.website === forSite) {
        searching = false;
        renderProfiles();
      }
    }
  };
}

// ---- brochure: progress + workspace --------------------------------------------
async function viewBrochure(id) {
  let rec;
  try {
    rec = await api(`/brochures/${id}`);
  } catch (err) {
    $app.innerHTML = `<section class="wrap"><div class="empty"><h3>Brochure not found</h3><p>${esc(err.message)}</p><a class="btn pink" href="/" data-link>Back to brochures</a></div></section>`;
    return;
  }
  document.title = `${rec.data?.profile?.company_name || rec.input.companyName} · Brochure Studio`;
  if (rec.status === "ready" && rec.data) return workspace(rec);
  if (rec.status === "error" && rec.data) return workspace(rec);
  progress(rec);
}

function logLine(e) {
  const time = new Date(e.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return `<div class="l"><span class="t">${time}</span><span class="${e.kind}">${esc(e.message)}</span></div>`;
}

function progress(rec) {
  const name = rec.input.companyName;
  $app.innerHTML = `
    <section class="hero slim"><div class="inner"><div class="copy">
      <div class="eyebrow">Building brochure</div>
      <h1>${esc(name)}</h1>
      <p>${esc(rec.input.website)}</p>
    </div></div></section>
    <section class="wrap progress">
      <div class="stages">
        <div class="stage" data-s="researching"><span class="dot">1</span>Researching</div>
        <div class="stage" data-s="writing"><span class="dot">2</span>Writing</div>
        <div class="stage" data-s="checking"><span class="dot">3</span>Fact-checking</div>
        <div class="stage" data-s="ready"><span class="dot">4</span>Ready</div>
      </div>
      <div class="console" id="console"></div>
      <p class="note" id="note">Research usually takes 2–6 minutes. You can leave this page; it keeps running.</p>
      <div id="err-actions" style="margin-top:16px;display:none;gap:10px">
        <button class="btn pink" id="retry">Try again</button>
        <a class="btn outline" href="/" data-link>Back to brochures</a>
      </div>
    </section>`;
  const $c = document.getElementById("console");
  const order = ["queued", "researching", "writing", "checking", "ready"];
  const paint = (status, error) => {
    if (status === "error") {
      const note = document.getElementById("note");
      note.textContent = error || "Something went wrong.";
      note.style.color = "#b3123d";
    }
    document.querySelectorAll(".stage").forEach((el) => {
      const i = order.indexOf(el.dataset.s), cur = order.indexOf(status);
      el.className = `stage${status === "error" ? "" : i === cur ? " active" : i < cur ? " done" : ""}`;
    });
    document.getElementById("err-actions").style.display = status === "error" ? "flex" : "none";
  };
  const append = (e) => {
    const stick = $c.scrollTop + $c.clientHeight >= $c.scrollHeight - 30;
    $c.insertAdjacentHTML("beforeend", logLine(e));
    if (stick) $c.scrollTop = $c.scrollHeight;
  };

  const es = new EventSource(`/api/brochures/${rec.id}/events`);
  es.onmessage = (m) => {
    const ev = JSON.parse(m.data);
    if (ev.type === "snapshot") {
      $c.innerHTML = ev.log.map(logLine).join("");
      $c.scrollTop = $c.scrollHeight;
      paint(ev.status, ev.error);
    } else if (ev.type === "log") append(ev.entry);
    else if (ev.type === "status") {
      paint(ev.status, ev.error);
      if (ev.status === "ready") setTimeout(() => route(), 600);
    }
  };
  document.getElementById("retry").onclick = async () => {
    try {
      await api(`/brochures/${rec.id}/regenerate`, { method: "POST", body: { mode: "full" } });
    } catch (err) {
      toast(err.message, true);
    }
  };
  cleanup = () => es.close();
}

function renderMarkdown(src = "") {
  const inline = (s) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/(^|[\s(])(https?:\/\/[^\s)<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
  const out = [];
  let list = false;
  for (const line of src.split(/\r?\n/)) {
    const h = line.match(/^(#{1,4})\s+(.*)/);
    const li = line.match(/^\s*[-*]\s+(.*)/);
    if (!li && list) (out.push("</ul>"), (list = false));
    if (h) out.push(`<h3>${inline(h[2])}</h3>`);
    else if (li) (list || (out.push("<ul>"), (list = true)), out.push(`<li>${inline(li[1])}</li>`));
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push("</ul>");
  return out.join("");
}

function workspace(rec) {
  const p = rec.data.profile;
  const company = p.company_name || rec.input.companyName;
  let editing = false;
  const unsupportedCount = () => rec.factcheck?.counts?.unsupported || 0;
  let tab = unsupportedCount() ? "factcheck" : "revise";

  $app.innerHTML = `
    <div class="ws">
      <div class="ws-main">
        <div class="ws-bar">
          <h2>${esc(company)} <small>${esc(rec.input.website.replace(/^https?:\/\//, ""))}</small></h2>
          <button class="btn outline sm" id="edit">Edit text</button>
          <div class="menu">
            <button class="btn outline sm" id="regen">Regenerate ▾</button>
            <div class="menu-pop" id="regen-pop" hidden>
              <button data-mode="rewrite">Rewrite copy<small>Fresh brochure from the saved research</small></button>
              <button data-mode="full">Research again<small>New web research, then a new brochure</small></button>
            </div>
          </div>
          <a class="btn outline sm" href="/brochure/${rec.id}" target="_blank" rel="noopener">Open full size ↗</a>
          <button class="btn pink sm" id="pdf">Download PDF</button>
          <button class="btn danger sm" id="del" title="Delete brochure">Delete</button>
        </div>
        <div class="edit-hint" id="edit-hint" hidden>Click any outlined text to edit. Select words and press <kbd>Ctrl</kbd>+<kbd>B</kbd> for bold or <kbd>Ctrl</kbd>+<kbd>K</kbd> for pink. Then <strong>Save changes</strong>.</div>
        <div class="frame-wrap" id="fw">
          <iframe id="frame" title="Brochure preview"></iframe>
        </div>
      </div>
      <aside class="ws-side">
        <div class="tabs">
          <button data-tab="revise">Revise</button>
          <button data-tab="factcheck">Fact check<span class="tab-badge" id="fc-badge"></span></button>
          <button data-tab="research">Research</button>
          <button data-tab="dossier">Dossier</button>
          <button data-tab="sources">Sources (${rec.research?.sources?.length || 0})</button>
        </div>
        <div class="tab-body" id="tab"></div>
      </aside>
    </div>`;

  const frame = document.getElementById("frame");
  const fw = document.getElementById("fw");
  const PAGE_W = 860;
  const fit = () => {
    const s = Math.min(1.25, fw.clientWidth / PAGE_W);
    frame.style.width = `${PAGE_W}px`;
    frame.style.height = `${fw.clientHeight / s}px`;
    frame.style.transform = `scale(${s})`;
  };
  const load = () => (frame.src = `/brochure/${rec.id}?t=${Date.now()}${editing ? "&edit=1" : ""}`);
  load();
  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(fw);

  // Edit mode
  const $edit = document.getElementById("edit");
  let dirty = false;
  const onMsg = async (e) => {
    if (e.source !== frame.contentWindow) return;
    if (e.data?.type === "brochure-dirty") dirty = true;
    if (e.data?.type === "brochure-edits") {
      try {
        await api(`/brochures/${rec.id}`, { method: "PUT", body: { edits: e.data.edits } });
        rec = await api(`/brochures/${rec.id}`);
        dirty = false;
        editing = false;
        $edit.textContent = "Edit text";
        $edit.className = "btn outline sm";
        document.getElementById("edit-hint").hidden = true;
        load();
        paintBadge();
        if (tab === "factcheck") showTab("factcheck");
        toast("Changes saved");
      } catch (err) {
        toast(err.message, true);
      }
    }
  };
  window.addEventListener("message", onMsg);
  $edit.onclick = () => {
    if (!editing) {
      editing = true;
      $edit.textContent = "Save changes";
      $edit.className = "btn dark sm";
      document.getElementById("edit-hint").hidden = false;
      load();
    } else if (!dirty) {
      editing = false;
      $edit.textContent = "Edit text";
      $edit.className = "btn outline sm";
      document.getElementById("edit-hint").hidden = true;
      load();
    } else frame.contentWindow.postMessage({ type: "collect-edits" }, "*");
  };

  // Fact check → jump to a field in the edit view
  let pendingFocus = null;
  frame.addEventListener("load", () => {
    if (pendingFocus && editing) frame.contentWindow.postMessage({ type: "focus-path", path: pendingFocus }, "*");
    pendingFocus = null;
  });
  const focusPath = (path) => {
    if (editing) return frame.contentWindow.postMessage({ type: "focus-path", path }, "*");
    pendingFocus = path;
    $edit.click();
  };

  // Waits for the server to finish a background job on this brochure.
  const waitUntilIdle = () =>
    new Promise((resolve) => {
      const es = new EventSource(`/api/brochures/${rec.id}/events`);
      es.onmessage = (m) => {
        const ev = JSON.parse(m.data);
        if (ev.type === "status" && (ev.status === "ready" || ev.status === "error")) {
          es.close();
          resolve();
        }
      };
      const prev = cleanup;
      cleanup = () => (prev(), es.close());
    });

  const paintBadge = () => {
    const n = unsupportedCount();
    const b = document.getElementById("fc-badge");
    b.textContent = n ? String(n) : "";
    b.hidden = !n;
  };
  paintBadge();

  // PDF
  document.getElementById("pdf").onclick = async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = "Preparing PDF…";
    try {
      const res = await fetch(`/api/brochures/${rec.id}/pdf`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "PDF export failed");
      const blob = await res.blob();
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${company} x True Worth AI.pdf` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (err) {
      toast(`${err.message}. Opening print view instead.`, true);
      window.open(`/brochure/${rec.id}?print=1`, "_blank");
    } finally {
      btn.disabled = false;
      btn.textContent = "Download PDF";
    }
  };

  // Regenerate
  const pop = document.getElementById("regen-pop");
  document.getElementById("regen").onclick = () => (pop.hidden = !pop.hidden);
  pop.querySelectorAll("button").forEach(
    (b) =>
      (b.onclick = async () => {
        pop.hidden = true;
        if (!confirm(b.dataset.mode === "full" ? "Run new research and replace this brochure?" : "Rewrite the brochure copy? Manual edits will be replaced.")) return;
        try {
          await api(`/brochures/${rec.id}/regenerate`, { method: "POST", body: { mode: b.dataset.mode } });
          route();
        } catch (err) {
          toast(err.message, true);
        }
      }),
  );

  document.getElementById("del").onclick = async () => {
    if (!confirm(`Delete the ${company} brochure? This can't be undone.`)) return;
    try {
      await api(`/brochures/${rec.id}`, { method: "DELETE" });
      go("/");
    } catch (err) {
      toast(err.message, true);
    }
  };

  // Side tabs
  const $tab = document.getElementById("tab");
  const tabs = {
    revise: () => `
      <div class="revise">
        <div class="side-h" style="margin-top:0">Ask the AI to revise</div>
        <p class="muted" style="font-size:14px;margin-bottom:10px">Describe the change; the AI rewrites the brochure using the same research.</p>
        <textarea id="rev" placeholder="e.g. Lead with the Workshop instead, and focus the opportunities on their customer service team."></textarea>
        <div class="chips-row">
          ${["Make it more concise", "Focus on customer service", "More about compliance and data safety", "Lead with the 30-Day AI Project", "Warmer, more personal tone"].map((c) => `<button type="button">${c}</button>`).join("")}
        </div>
        <button class="btn pink" id="rev-go">Revise brochure</button>
        <div id="rev-status" class="note"></div>
        ${rec.error ? `<p class="note" style="color:#b3123d">Last run: ${esc(rec.error)}</p>` : ""}
      </div>`,
    research: () => `
      <dl class="kv">
        <dt>Company</dt><dd><strong>${esc(company)}</strong></dd>
        <dt>What</dt><dd>${esc(p.one_liner)}</dd>
        <dt>Sector</dt><dd>${esc(p.sector)}</dd>
        <dt>Size</dt><dd>${esc(p.size_estimate)}</dd>
        <dt>HQ</dt><dd>${esc(p.headquarters)}</dd>
        <dt>AI maturity</dt><dd><span class="pill pink">${esc(p.ai_maturity)}</span><div class="muted" style="font-size:13px;margin-top:4px">${esc(p.ai_maturity_reason)}</div></dd>
      </dl>
      ${p.key_people?.length ? `<div class="side-h">Key people</div>${p.key_people.map((k) => `<div class="signal"><strong>${esc(k.name)}</strong><span class="muted">${esc(k.role)}</span></div>`).join("")}` : ""}
      <div class="side-h">Talking points for the call</div>
      <ul class="tp">${(p.talking_points || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <div class="side-h">Signals</div>
      ${(p.signals || []).map((s) => `<div class="signal"><span class="pill">${esc(s.type)}</span><span>${esc(s.detail)}</span></div>`).join("")}`,
    factcheck: () => factcheckHtml(),
    dossier: () => `<div class="dossier">${renderMarkdown(rec.research?.dossier || "No dossier saved.")}</div>`,
    sources: () =>
      `<div class="sources">${(rec.research?.sources || []).map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}<small>${esc(s.url)}</small></a>`).join("") || '<p class="muted">No sources recorded.</p>'}</div>`,
  };
  const showTab = (name) => {
    tab = name;
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === name));
    $tab.innerHTML = tabs[name]();
    if (name === "revise") wireRevise();
    if (name === "factcheck") wireFactcheck();
  };

  function factcheckHtml() {
    const fc = rec.factcheck;
    const intro = `<div class="side-h" style="margin-top:0">Fact check</div>
      <p class="muted" style="font-size:14px;margin-bottom:12px">Every claim about ${esc(company)} is checked against the live source pages. Fix anything red or amber before you send it.</p>`;
    const runBtn = (label, primary = false) => `<button class="btn ${primary ? "pink" : "outline"} sm" id="fc-run">${label}</button>`;
    if (!fc) return `${intro}<p class="muted" style="margin-bottom:12px">This brochure hasn't been fact-checked yet.</p>${runBtn("Run fact check", true)}`;
    if (fc.error) return `${intro}<p class="note" style="color:#b3123d;margin-bottom:12px">The last fact check failed: ${esc(fc.error)}</p>${runBtn("Try again", true)}`;
    const LABEL = { unsupported: "Unsupported", partly: "Partly supported", verified: "Verified" };
    const CLS = { unsupported: "err", partly: "warn", verified: "ok" };
    const item = (c) => `<div class="fc-item fc-${c.status}">
        <div class="fc-top"><span class="pill ${CLS[c.status]}">${LABEL[c.status]}</span>${c.path ? `<button class="link-btn fc-show" data-path="${esc(c.path)}">Show in brochure</button>` : ""}</div>
        <div class="fc-claim">${esc(c.claim)}</div>
        <div class="fc-reason">${esc(c.reason)}</div>
        ${c.snippet ? `<div class="fc-from">${c.snippetFrom === "dossier" ? "Only in the AI research notes, not on the page:" : "On the source page:"}</div><blockquote class="fc-snippet${c.snippetFrom === "dossier" ? " dossier" : ""}">${esc(c.snippet)}</blockquote>` : ""}
        ${c.sourceUrl ? `<a class="fc-src" href="${esc(c.sourceUrl)}" target="_blank" rel="noopener">${esc(c.sourceUrl)} ↗</a>` : '<span class="fc-src muted">No source found</span>'}
      </div>`;
    const groups = ["unsupported", "partly", "verified"]
      .map((st) => {
        const list = fc.claims.filter((c) => c.status === st);
        if (!list.length) return "";
        return st === "verified"
          ? `<details class="fc-group"><summary>${list.length} verified claim${list.length > 1 ? "s" : ""}</summary>${list.map(item).join("")}</details>`
          : list.map(item).join("");
      })
      .join("");
    const failed = (fc.pages || []).filter((p) => !p.ok);
    const when = new Date(fc.checkedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
    return `${intro}
      ${rec.factcheckStale ? `<div class="fc-stale">The brochure has been edited since this check. ${runBtn("Re-run fact check", true)}</div>` : ""}
      <div class="fc-counts">
        <span class="pill err">${fc.counts.unsupported} unsupported</span>
        <span class="pill warn">${fc.counts.partly} partly</span>
        <span class="pill ok">${fc.counts.verified} verified</span>
      </div>
      <p class="muted" style="font-size:12px;margin:8px 0 14px">Checked ${when} · ${fc.claims.length} claims · ${(fc.pages || []).length - failed.length} pages read · $${(fc.cost || 0).toFixed(3)}</p>
      ${fc.claims.length ? groups : '<p class="muted">No factual claims about the prospect were found.</p>'}
      ${failed.length ? `<details class="fc-group"><summary>${failed.length} source page${failed.length > 1 ? "s" : ""} couldn't be read</summary>${failed.map((p) => `<div class="fc-item"><a class="fc-src" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.url)}</a><div class="fc-reason">${esc(p.error || "")}</div></div>`).join("")}</details>` : ""}
      ${rec.factcheckStale ? "" : `<div style="margin-top:16px">${runBtn("Re-run fact check")}</div>`}`;
  }

  function wireFactcheck() {
    $tab.querySelectorAll(".fc-show").forEach((b) => (b.onclick = () => focusPath(b.dataset.path)));
    const run = document.getElementById("fc-run");
    if (!run) return;
    run.onclick = async () => {
      if (editing && dirty) return toast("Save your text changes first.", true);
      run.disabled = true;
      run.textContent = "Checking…";
      fw.insertAdjacentHTML("beforeend", '<div class="overlay" id="ov"><div class="box"><div class="eyebrow">Fact-checking</div><p style="margin-top:8px">Checking every claim against the source pages…</p></div></div>');
      try {
        await api(`/brochures/${rec.id}/factcheck`, { method: "POST" });
        await waitUntilIdle();
        rec = await api(`/brochures/${rec.id}`);
        const n = unsupportedCount();
        toast(n ? `${n} unsupported claim${n > 1 ? "s" : ""} to fix` : "Fact check complete");
        load();
      } catch (err) {
        toast(err.message, true);
      } finally {
        document.getElementById("ov")?.remove();
        paintBadge();
        showTab("factcheck");
      }
    };
  }
  document.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));

  function wireRevise() {
    const ta = document.getElementById("rev");
    $tab.querySelectorAll(".chips-row button").forEach((b) => (b.onclick = () => (ta.value = ta.value ? `${ta.value.trim()} ${b.textContent}.` : `${b.textContent}.`)));
    document.getElementById("rev-go").onclick = async (e) => {
      const instructions = ta.value.trim();
      if (!instructions) return ta.focus();
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = "Revising…";
      document.getElementById("rev-status").textContent = "The AI is rewriting the brochure. This takes a minute or two.";
      fw.insertAdjacentHTML("beforeend", '<div class="overlay" id="ov"><div class="box"><div class="eyebrow">Revising</div><p style="margin-top:8px">Rewriting the brochure with your changes…</p></div></div>');
      try {
        await api(`/brochures/${rec.id}/revise`, { method: "POST", body: { instructions } });
        const es = new EventSource(`/api/brochures/${rec.id}/events`);
        es.onmessage = async (m) => {
          const ev = JSON.parse(m.data);
          if (ev.type === "status" && (ev.status === "ready" || ev.status === "error")) {
            es.close();
            rec = await api(`/brochures/${rec.id}`);
            document.getElementById("ov")?.remove();
            if (rec.error) toast(rec.error, true);
            else toast("Brochure revised");
            load();
            paintBadge();
            showTab(unsupportedCount() ? "factcheck" : "revise");
          }
        };
        const prev = cleanup;
        cleanup = () => (prev(), es.close());
      } catch (err) {
        document.getElementById("ov")?.remove();
        toast(err.message, true);
        btn.disabled = false;
        btn.textContent = "Revise brochure";
      }
    };
  }
  showTab(tab);

  cleanup = () => {
    ro.disconnect();
    window.removeEventListener("message", onMsg);
  };
}

// ---- boot ------------------------------------------------------------------------
(async () => {
  try {
    config = await api("/config");
  } catch {}
  if (!config.hasApiKey) {
    const b = document.getElementById("banner");
    b.hidden = false;
    b.innerHTML = "Add your OpenRouter API key to <code>.env</code> as <code>OPENROUTER_API_KEY=…</code> and restart the app to start generating brochures.";
  }
  route();
})();
