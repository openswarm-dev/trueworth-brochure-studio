// Renders brochure JSON into a print-ready, six-page A4 HTML document that
// mirrors the existing True Worth AI brochures (dark cover with torn edge,
// white content pages, dark closing page).
import { COMPANY, SERVICES, TEAM, CASE_STUDIES, TESTIMONIALS } from "./knowledge.js";

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// **bold** and [[accent]] → HTML, after escaping.
export const md = (s = "") =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[\[(.+?)\]\]/g, '<span class="accent">$1</span>');

// Fact-check flags for the edit view, keyed by JSON path; set per render.
let flags = {};

// Editable text node. `path` is the JSON path inside the record.
const t = (tag, path, value, cls = "", rich = true) => {
  const f = flags[path];
  const flag = f ? ` data-flag="${f.status}" title="${esc(f.notes.join("\n"))}"` : "";
  return `<${tag}${cls ? ` class="${cls}"` : ""} data-edit="${path}"${rich ? ' data-rich="1"' : ""}${flag}>${rich ? md(value) : esc(value)}</${tag}>`;
};

// Worst fact-check status per field: unsupported beats partly; verified isn't flagged.
function flagMap(factcheck) {
  const out = {};
  for (const c of factcheck?.claims || []) {
    if (!c.path || c.status === "verified") continue;
    const cur = (out[c.path] ??= { status: c.status, notes: [] });
    if (c.status === "unsupported") cur.status = "unsupported";
    cur.notes.push(`${c.status === "unsupported" ? "Unsupported" : "Partly supported"}: ${c.claim} (${c.reason})`);
  }
  return out;
}

const ILLUSTRATION_FILES = {
  rocket: "ill-rocket.png",
  megaphone: "ill-megaphone.png",
  lamp: "ill-lamp.png",
  monitor: "ill-monitor.png",
  book: "ill-book.png",
  clock: "ill-clock.png",
};
const asset = (f) => `/assets/brand/${f}`;

const header = (label) => `
  <header class="pg-head">
    <img class="logo-dark" src="${asset("logo-hires.png")}" alt="True Worth AI">
    <span class="pg-label">${esc(label)}</span>
  </header>`;

const footer = (n, doodle) => `
  ${doodle ? `<img class="doodle" src="${asset(ILLUSTRATION_FILES[doodle])}" alt="">` : ""}
  <div class="pg-num">${String(n).padStart(2, "0")}</div>`;

function cover(b, rec) {
  const c = b.cover;
  const lead = TEAM[b.close.lead];
  const prepared = [rec.input.contactName, rec.input.contactRole].filter(Boolean).join(", ");
  return `
  <section class="page cover dark">
    <div class="glow tr"></div>
    <div class="bars"><i></i><i class="p"></i><i></i><i class="p"></i><i></i></div>
    <img class="logo-cover" src="${asset("logo-hires.png")}" alt="True Worth AI">
    <div class="cover-copy">
      ${t("div", "brochure.cover.eyebrow", c.eyebrow, "eyebrow", false)}
      <h1>${t("span", "brochure.cover.headline_lead", c.headline_lead, "", false)} ${t("span", "brochure.cover.headline_accent", c.headline_accent, "accent", false)}</h1>
      ${t("p", "brochure.cover.intro", c.intro, "lede")}
    </div>
    <img class="cover-ill sticker" src="${asset(ILLUSTRATION_FILES[b.illustration])}" alt="">
    <div class="cover-bottom">
      <img class="torn" src="${asset("torn-edge.png")}" alt="">
      <div class="prepared">
        <span class="k">PREPARED FOR</span>
        <span class="v">${esc(prepared ? `${prepared} · ` : "")}<strong>${esc(rec.profile?.company_name || rec.input.companyName)}</strong></span>
      </div>
      <div class="stats">
        ${c.stats
          .map(
            (s, i) => `<div class="stat">
            ${t("div", `brochure.cover.stats.${i}.label`, s.label, "k", false)}
            ${t("div", `brochure.cover.stats.${i}.value`, s.value, `v${s.accent ? " accent" : ""}`, false)}
            ${s.sub ? t("div", `brochure.cover.stats.${i}.sub`, s.sub, "sub", false) : ""}
          </div>`,
          )
          .join("")}
        ${lead ? `<img class="cover-photo" src="${asset(lead.photo)}" alt="${esc(lead.name)}">` : ""}
      </div>
    </div>
  </section>`;
}

function snapshot(b, company) {
  const s = b.snapshot;
  return `
  <section class="page">
    <div class="flow">
    ${header(`PREPARED FOR ${company.toUpperCase()}`)}
    <div class="dash"></div>
    ${t("h2", "brochure.snapshot.title", s.title, "", false)}
    ${t("p", "brochure.snapshot.intro", s.intro, "intro")}
    ${t("div", "brochure.snapshot.callout", s.callout, "callout")}
    <div class="dark-box">
      <div class="glow"></div>
      ${t("div", "brochure.snapshot.dark_label", s.dark_label, "eyebrow", false)}
      ${t("p", "brochure.snapshot.dark_text", s.dark_text)}
    </div>
    <h3>What we noticed</h3>
    <div class="grid2">
      ${s.insights
        .map(
          (x, i) => `<div class="card outline">
          <div class="num">${String(i + 1).padStart(2, "0")}</div>
          ${t("h4", `brochure.snapshot.insights.${i}.title`, x.title, "", false)}
          ${t("p", `brochure.snapshot.insights.${i}.body`, x.body)}
        </div>`,
        )
        .join("")}
    </div>
    </div>
    ${footer(1, "monitor")}
  </section>`;
}

function opportunities(b) {
  const o = b.opportunities;
  return `
  <section class="page">
    <div class="flow">
    ${header("YOUR AI OPPORTUNITIES")}
    <div class="dash"></div>
    ${t("h2", "brochure.opportunities.title", o.title, "", false)}
    ${t("p", "brochure.opportunities.intro", o.intro, "intro")}
    <div class="grid2 tight">
      ${o.items
        .map(
          (x, i) => `<div class="card filled">
          ${t("div", `brochure.opportunities.items.${i}.area`, x.area, "eyebrow sm", false)}
          ${t("h4", `brochure.opportunities.items.${i}.title`, x.title, "", false)}
          ${t("p", `brochure.opportunities.items.${i}.body`, x.body)}
          <div class="chips">
            ${t("span", `brochure.opportunities.items.${i}.impact`, x.impact, "chip", false)}
            <span class="chip ${x.effort === "Quick win" ? "pink" : "ghost"}">${esc(x.effort)}</span>
          </div>
        </div>`,
        )
        .join("")}
    </div>
    <div class="dark-strip">
      <div class="badge">1</div>
      <div>
        ${t("h4", "brochure.opportunities.highlight_title", o.highlight_title, "", false)}
        ${t("p", "brochure.opportunities.highlight_body", o.highlight_body)}
      </div>
    </div>
    </div>
    ${footer(2, "lamp")}
  </section>`;
}

function path(b) {
  const p = b.path;
  const svc = SERVICES[p.recommended_service] || SERVICES.roadmap;
  const priceNote = {
    roadmap: "Fixed scope · two-week turnaround · credited in full against any work you go on to commission.",
    workshop: "Half day £1,500 · full day £2,500 · includes pre-workshop intake and a summary pack.",
    project: "+ VAT, scoped per project. A fixed price agreed up front, no open-ended billing.",
    collective: "Fractional day rate or full-time contractor, with True Worth AI accountable throughout.",
  }[svc.key];
  return `
  <section class="page">
    <div class="flow">
    ${header("YOUR PATH WITH TRUE WORTH AI")}
    <div class="dash"></div>
    ${t("h2", "brochure.path.title", p.title, "", false)}
    ${t("p", "brochure.path.intro", p.intro, "intro")}
    <div class="steps">
      ${p.steps
        .map(
          (s, i) => `<div class="step">
          <div class="badge">${i + 1}</div>
          <div>
            ${t("div", `brochure.path.steps.${i}.label`, s.label, "eyebrow sm", false)}
            ${t("h4", `brochure.path.steps.${i}.title`, s.title, "", false)}
            ${t("p", `brochure.path.steps.${i}.body`, s.body)}
          </div>
        </div>`,
        )
        .join("")}
    </div>
    <h3>Where we recommend you start</h3>
    <div class="grid2 invest">
      <div class="price-card">
        <div class="glow br"></div>
        <div class="eyebrow">${esc(svc.name.toUpperCase())}</div>
        <div class="price">${esc(svc.price)}</div>
        <p>${esc(priceNote)}</p>
      </div>
      <div class="card soft">
        <div class="eyebrow">WHY START HERE</div>
        ${t("p", "brochure.path.recommended_reason", p.recommended_reason, "strong-copy")}
      </div>
    </div>
    </div>
    ${footer(3, "clock")}
  </section>`;
}

function proof(b) {
  const p = b.proof;
  const quote = TESTIMONIALS[p.testimonial];
  return `
  <section class="page">
    <div class="flow">
    ${header("PROOF & HOW WE DELIVER")}
    <div class="dash"></div>
    ${t("h2", "brochure.proof.title", p.title, "", false)}
    ${t("p", "brochure.proof.intro", p.intro, "intro")}
    <div class="grid2 tight">
      ${p.case_studies
        .map((k) => CASE_STUDIES[k])
        .map(
          (c) => `<div class="card outline">
          <div class="eyebrow sm">${esc(c.sector)}</div>
          <h4 class="big">${esc(c.headline)}</h4>
          <p>${esc(c.body)}</p>
        </div>`,
        )
        .join("")}
    </div>
    <blockquote class="callout quote">“${esc(quote.quote)}”<cite>${esc(quote.name)}<br>${esc(quote.org)}</cite></blockquote>
    <div class="trusted">
      <span class="k">TRUSTED BY</span>
      <div class="logos">
        ${["client-mojocx.png", "client-digitaldra.png", "client-mcqueens.png", "client-sosandar.png"].map((f) => `<img src="${asset(f)}" alt="">`).join("")}
      </div>
    </div>
    <div class="dark-box compact">
      <div class="glow"></div>
      <div class="eyebrow">THE PLATFORM · CONDUCTOR</div>
      <p>Conductor is our orchestration layer for building AI agents and workflows that are <strong>governed by design</strong>. Your data stays in your environment, every action is logged and auditable, and we stay model-agnostic, so you are never locked into one vendor.</p>
    </div>
    <div class="grid2 tight">
      <div class="card outline mini"><div class="mdash"></div><h4>The True Worth Collective</h4><p>150+ fractional AI experts we know and trust, brought in when your project needs specialist skill.</p></div>
      <div class="card outline mini"><div class="mdash"></div><h4>One accountable partner</h4><p>Senior capability without headcount. True Worth AI scopes, leads and owns delivery.</p></div>
    </div>
    </div>
    ${footer(4, "book")}
  </section>`;
}

function close(b, rec) {
  const c = b.close;
  const lead = TEAM[c.lead] || TEAM.john;
  const company = rec.profile?.company_name || rec.input.companyName;
  return `
  <section class="page dark close">
    <div class="glow tr big"></div>
    <div class="glow bl"></div>
    <div class="lead-card">
      <img src="${asset(lead.photo)}" alt="${esc(lead.name)}">
      <div>
        <div class="eyebrow">YOUR ${esc(lead.role.toUpperCase())}</div>
        <h4>${esc(lead.name)}</h4>
        <p>${esc(lead.bio)}</p>
        ${t("p", "brochure.close.lead_note", c.lead_note, "lead-note")}
      </div>
    </div>
    ${t("div", "brochure.close.eyebrow", c.eyebrow, "eyebrow", false)}
    <h2 class="close-h">${t("span", "brochure.close.headline_lead", c.headline_lead, "", false)} ${t("span", "brochure.close.headline_accent", c.headline_accent, "accent", false)}</h2>
    ${t("p", "brochure.close.body", c.body, "lede")}
    <div class="ctas">
      <a class="btn pink" href="${esc(COMPANY.bookingUrl)}">Book a discovery call</a>
      <a class="btn ghost" href="${esc(COMPANY.policyUrl)}">Create your free AI policy</a>
      ${COMPANY.email ? `<a class="btn ghost" href="mailto:${esc(COMPANY.email)}">Email us</a>` : ""}
    </div>
    <p class="call">Prefer to talk? Call <strong>${esc(COMPANY.phone)}</strong></p>
    <p class="sign">Think big, start small, <span class="accent">move fast</span>.</p>
    <footer class="close-foot">
      <img src="${asset("logo-hires.png")}" alt="True Worth AI">
      <div>
        <div>Prepared for ${esc(company)} · ${esc(new Date(rec.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }))} · ${esc(COMPANY.website)}</div>
        <div class="legal">${esc(COMPANY.legal)}</div>
      </div>
    </footer>
  </section>`;
}

export function renderBrochure(rec, { edit = false, print = false } = {}) {
  const b = rec.data.brochure;
  const company = rec.data.profile?.company_name || rec.input.companyName;
  const r = { ...rec, profile: rec.data.profile };
  flags = edit ? flagMap(rec.factcheck) : {};
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(company)} × True Worth AI</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/brochure.css?v=3">
<script src="/brochure-fit.js?v=2" defer></script>
</head>
<body class="${print ? "print" : "screen"}${edit ? " editing" : ""}">
${cover(b, r)}
${snapshot(b, company)}
${opportunities(b)}
${path(b)}
${proof(b)}
${close(b, r)}
${edit ? '<script src="/brochure-edit.js"></script>' : ""}
</body>
</html>`;
}
