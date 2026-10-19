// Fact check, run after the brochure is written:
//   1. A fast model lists every factual claim about the prospect in the
//      brochure, with the dossier passage and source URL behind it.
//   2. We fetch those source pages (plus the prospect's homepage) ourselves.
//      Quotes are checked word for word in code.
//   3. The fast model rates each claim against the live page excerpts.
// The dossier is AI-written, so a claim backed only by the dossier is never
// rated higher than "partly supported".
import crypto from "node:crypto";
import { chat, parseJson } from "./ai.js";
import { fetchPage } from "./discover.js";

const FAST_MODEL = () => process.env.OPENROUTER_FAST_MODEL || "anthropic/claude-haiku-5.5";
const MAX_CLAIMS = 30;
const MAX_PAGES = 20;

// Brochure fields that are settings, not copy.
const SKIP_KEYS = new Set(["illustration", "recommended_service", "case_studies", "testimonial", "lead", "effort", "accent"]);

const plain = (s) => s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\[\[(.+?)\]\]/g, "$1");

const strictObj = (properties) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const CLAIMS_SCHEMA = strictObj({
  claims: { type: "array", items: strictObj({ path: { type: "string" }, claim: { type: "string" }, quote: { type: "string" }, dossier_snippet: { type: "string" }, source_url: { type: "string" } }) },
});
const VERIFY_SCHEMA = strictObj({
  results: { type: "array", items: strictObj({ id: { type: "integer" }, status: { type: "string", enum: ["verified", "partly", "unsupported"] }, snippet: { type: "string" }, reason: { type: "string" } }) },
});

// Fast-model call with structured JSON output (small schemas compile fine,
// and without them the model can trail off into whitespace mid-JSON).
async function fastJson(messages, name, schema, effort = "low") {
  let cost = 0;
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await chat({
      model: FAST_MODEL(),
      max_tokens: 16000,
      reasoning: { effort },
      messages,
      response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
      provider: { require_parameters: true },
    });
    cost += r.usage?.cost || 0;
    try {
      if (r.finish === "length") throw new Error("output was cut off");
      return { data: parseJson(r.content), cost };
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`Fact-check model returned unusable output (${lastErr.message}).`);
}

export const brochureHash = (brochure) => crypto.createHash("sha1").update(JSON.stringify(brochure)).digest("hex").slice(0, 12);

// [{ path: "brochure.cover.intro", text }] for every printed text field.
function fields(brochure) {
  const out = [];
  const walk = (v, path) => {
    if (typeof v === "string") out.push({ path, text: plain(v) });
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}.${i}`));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (!SKIP_KEYS.has(k)) walk(x, `${path}.${k}`);
  };
  walk(brochure, "brochure");
  // The path, proof and closing pages are about True Worth AI and the next step, not the prospect.
  return out.filter((f) => f.text.trim() && !/^brochure\.(path|proof|close)\./.test(f.path));
}

// Safety net in case a claim about True Worth AI slips through extraction.
const OURS = /\b(true worth|conductor|ai roadmap|30-day ai project|ai workshop|policy creator|the collective|150\+|john welsh|rufus|sam mikkelsen)\b/i;

// Normalise for word-for-word comparison: case, curly quotes, dashes, spacing.
const norm = (s = "") =>
  s
    .toLowerCase()
    .replace(/[‘’‛`´]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();

function htmlToText(html) {
  return html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&(apos|#0?39);/g, "'")
    .replace(/&(rsquo|lsquo);/g, "’")
    .replace(/&(rdquo|ldquo);/g, "”")
    .replace(/&(ndash|mdash);/g, "-")
    .replace(/&pound;/g, "£")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

const STOP = new Set("the a an and or of to in on for with is are was were be by at as from that this it its their your our we you they has have had not but which who".split(" "));

// The passages of `text` that best match the claim: every occurrence of the
// claim's words is a candidate window, scored by how many distinct claim
// words it contains (rare words and numbers count more); best windows win.
function excerpts(text, claim, max = 2000) {
  const low = norm(text);
  const words = [...new Set(norm(claim).match(/[a-z0-9£$%][a-z0-9£$%+'.,-]*/g) || [])]
    .map((w) => w.replace(/[.,']+$/, "").replace(/'s$/, ""))
    .filter((w) => (w.length > 3 || /\d/.test(w)) && !STOP.has(w));
  const freq = Object.fromEntries(words.map((w) => [w, low.split(w).length - 1]));
  const weight = (w) => (/\d/.test(w) ? 3 : 1) / Math.sqrt(Math.max(1, freq[w]));
  const W = 420;
  const cands = [];
  for (const w of words) {
    let i = low.indexOf(w);
    let n = 0;
    while (i >= 0 && n++ < 40) {
      const s = Math.max(0, i - 170), win = low.slice(s, s + W);
      const score = words.reduce((t, x) => t + (win.includes(x) ? weight(x) : 0), 0);
      cands.push({ s, score });
      i = low.indexOf(w, i + w.length);
    }
  }
  cands.sort((a, b) => b.score - a.score);
  const chosen = [];
  for (const c of cands) {
    if (chosen.length * W >= max) break;
    if (chosen.some((x) => Math.abs(x.s - c.s) < W)) continue;
    chosen.push(c);
  }
  return chosen
    .sort((a, b) => a.s - b.s)
    .map((c) => `…${low.slice(c.s, c.s + W)}…`)
    .join(" ")
    .slice(0, max);
}

async function loadPages(urls, log) {
  const pages = new Map();
  await Promise.all(
    urls.map(async (url) => {
      try {
        const p = await fetchPage(url);
        const text = htmlToText(p.html).slice(0, 300_000);
        pages.set(url, { ok: text.length > 200, text, error: text.length > 200 ? null : "Page loaded but had almost no readable text (likely built with JavaScript)." });
      } catch (err) {
        pages.set(url, { ok: false, text: "", error: err.message });
      }
    }),
  );
  const failed = [...pages.values()].filter((p) => !p.ok).length;
  log("info", `Fact check: read ${pages.size - failed} of ${pages.size} source pages`);
  return pages;
}

const EXTRACT_SYSTEM = `You audit a sales brochure written about a prospect company. List every factual claim the brochure makes ABOUT THE PROSPECT: names, people and roles, relationships, numbers, prices, dates, locations, products/services, clients and results, hiring, quotes attributed to them, technology they use, and statements about what they do or say.
Ignore completely: anything about True Worth AI (the brochure's author) — its services (AI Roadmap, Workshop, 30-Day AI Project, Collective, AI Policy Creator), prices, people (John Welsh, Rufus Curnow, Sam Mikkelsen), Conductor, its case studies and what "we" will do. Also ignore: proposed AI opportunities and what they would do; hedged estimates ("est.", "typically", "could"); statements about laws, regulation or the market in general (e.g. "UK GDPR and the new fake-review rules raise the stakes" is NOT a claim about the prospect); who the brochure is addressed to or "built for"; advice, opinions and rhetorical framing.
Make each claim atomic: one fact per claim. Put names, relationships, numbers, prices, dates and places into separate claims (e.g. "Morgan and Danny are cousins" is its own claim, separate from "they spent three years building X"). Use the brochure field path exactly as given.
For each claim, find the dossier passage that supports it (copy it word for word, max 300 characters) and the source URL the dossier cites for it. If the dossier doesn't support it, leave both empty.
"quote" is the exact text the brochure puts in quotation marks and attributes to the prospect, otherwise empty.
Reply with JSON only: {"claims":[{"path":string,"claim":string,"quote":string,"dossier_snippet":string,"source_url":string}]}`;

const VERIFY_SYSTEM = `You fact-check claims about a company against evidence. For each claim you get excerpts from live web pages (the most reliable evidence) and the passage from an AI-written research dossier (less reliable).
Status:
- "verified": a live page excerpt clearly states it.
- "partly": the substance is supported but the wording is stronger or looser than the source, or only the dossier supports it.
- "unsupported": no evidence supports it, the evidence contradicts it, or any specific detail in it (a relationship such as "cousins", a number, a name, a place, a date) appears nowhere in the live excerpts. A specific detail missing from the live pages makes the whole claim unsupported, even if the rest is true and even if the dossier states it.
"snippet": the best matching evidence text, word for word (max 220 characters), or empty. "reason": one short sentence a salesperson can act on.
Reply with JSON only: {"results":[{"id":number,"status":"verified"|"partly"|"unsupported","snippet":string,"reason":string}]}`;

export async function factCheck(rec, log) {
  const brochure = rec.data.brochure;
  const dossier = rec.research?.dossier || "";
  const list = fields(brochure);
  const paths = new Set(list.map((f) => f.path));
  const textByPath = Object.fromEntries(list.map((f) => [f.path, f.text]));
  let cost = 0;

  log("check", "Fact-checking the brochure…");

  // 1. Extract claims.
  const ex = await fastJson(
    [
      { role: "system", content: EXTRACT_SYSTEM },
      {
        role: "user",
        content: `Prospect: ${rec.input.companyName} (${rec.input.website})

<brochure_fields>
${list.map((f) => `${f.path}: ${f.text}`).join("\n")}
</brochure_fields>

<dossier>
${dossier}
</dossier>`,
      },
    ],
    "brochure_claims",
    CLAIMS_SCHEMA,
    "medium",
  );
  cost += ex.cost;
  const raw = ex.data.claims || [];
  const claims = raw
    .filter((c) => c && typeof c.claim === "string" && c.claim.trim() && !OURS.test(c.claim))
    .slice(0, MAX_CLAIMS)
    .map((c, id) => ({
      id,
      path: paths.has(c.path) ? c.path : list.find((f) => c.claim && norm(f.text).includes(norm(c.claim).slice(0, 25)))?.path || null,
      claim: c.claim.trim(),
      quote: typeof c.quote === "string" ? c.quote.trim() : "",
      dossierSnippet: typeof c.dossier_snippet === "string" ? c.dossier_snippet.trim() : "",
      sourceUrl: /^https?:\/\//.test(c.source_url || "") ? c.source_url.trim() : "",
    }));

  // 2. Fetch the cited pages plus the prospect's homepage.
  //    Most-cited pages first, so a long claim list can't crowd out a source.
  const canon = (u) => u.replace(/#.*$/, "").replace(/\/+$/, "");
  const home = canon(rec.input.website);
  for (const c of claims) if (c.sourceUrl) c.sourceUrl = canon(c.sourceUrl);
  const cites = {};
  for (const c of claims) if (c.sourceUrl && c.sourceUrl !== home) cites[c.sourceUrl] = (cites[c.sourceUrl] || 0) + 1;
  const urls = [home, ...Object.keys(cites).sort((a, b) => cites[b] - cites[a])].slice(0, MAX_PAGES);
  const pages = await loadPages(urls, log);
  const homeText = pages.get(home)?.ok ? pages.get(home).text : "";
  const loaded = [...pages.entries()].filter(([, p]) => p.ok);

  for (const c of claims) {
    const src = c.sourceUrl && pages.get(c.sourceUrl);
    // The claim's own source wasn't read (not fetched, or failed to load).
    c.sourceMissing = Boolean(c.sourceUrl && !src?.ok);
    if (c.sourceUrl && !src) c.sourceError = "Not fetched (too many source pages).";
    c.sourceLoaded = Boolean(src?.ok);
    if (src && !src.ok) c.sourceError = src.error;
    // Quotes must appear word for word in a page we actually read.
    if (c.quote) {
      const q = norm(c.quote.replace(/^["'“‘]+|["'”’]+$/g, ""));
      const where = loaded.find(([, p]) => norm(p.text).includes(q));
      c.quoteFound = where ? where[0] : null;
    }
    const ev = [];
    if (src?.ok) ev.push(`[${c.sourceUrl}] ${excerpts(src.text, c.claim)}`);
    if (homeText && c.sourceUrl !== home) ev.push(`[${home}] ${excerpts(homeText, c.claim, 1300)}`);
    c.evidence = ev.filter((e) => e.length > 30).join("\n");
  }

  // 3. Rate each claim against the evidence.
  let results = [];
  if (claims.length) {
    const vr = await fastJson(
      [
        { role: "system", content: VERIFY_SYSTEM },
        {
          role: "user",
          content: claims
            .map(
              (c) => `### Claim ${c.id}: ${c.claim}
Live page excerpts: ${c.evidence || "(none — source page not available)"}
Dossier passage: ${c.dossierSnippet || "(none)"}`,
            )
            .join("\n\n"),
        },
      ],
      "fact_check_results",
      VERIFY_SCHEMA,
      "medium",
    );
    cost += vr.cost;
    results = vr.data.results || [];
  }

  const byId = new Map(results.map((r) => [Number(r.id), r]));
  const RANK = { verified: 2, partly: 1, unsupported: 0 };
  const out = claims.map((c) => {
    const r = byId.get(c.id) || {};
    let status = RANK[r.status] !== undefined ? r.status : "partly";
    let reason = String(r.reason || "").slice(0, 300);
    const live = Boolean(c.evidence);
    if (status === "verified" && !live) {
      status = "partly";
      reason = `Only the research dossier supports this; the source page couldn't be checked${c.sourceError ? ` (${c.sourceError})` : ""}.`;
    }
    // Absence of evidence only counts when we actually read the cited page.
    if (status === "unsupported" && c.sourceMissing && c.dossierSnippet) {
      status = "partly";
      reason = `Couldn't read the cited source page${c.sourceError ? ` (${c.sourceError})` : ""}, so this rests on the research notes only. Open the source to confirm.`;
    }
    if (c.quote) {
      if (c.quoteFound) {
        if (status !== "unsupported") status = "verified";
        reason = `Quote matches word for word on ${c.quoteFound}.`;
      } else {
        status = loaded.length ? (status === "unsupported" ? "unsupported" : "partly") : "partly";
        reason = loaded.length ? `Quoted text doesn't appear word for word on the pages checked. ${reason}`.trim() : "Quoted text couldn't be checked: no source page loaded.";
      }
    }
    return {
      path: c.path,
      field: c.path ? textByPath[c.path] : "",
      claim: c.claim,
      quote: c.quote,
      status,
      reason,
      snippet: String(r.snippet || c.dossierSnippet || "").slice(0, 300),
      // Where the snippet was actually found: a live page, or only the AI-written dossier.
      snippetFrom: (() => {
        const sn = norm(r.snippet || c.dossierSnippet || "").replace(/^[…."'\s]+|[…."'\s]+$/g, "").slice(0, 80);
        if (!sn) return "";
        return norm(c.evidence).includes(sn) ? "page" : "dossier";
      })(),
      sourceUrl: c.quoteFound || c.sourceUrl || (live ? home : ""),
      sourceChecked: live,
    };
  });

  const counts = { verified: 0, partly: 0, unsupported: 0 };
  out.forEach((c) => counts[c.status]++);
  log(
    counts.unsupported ? "error" : "done",
    `Fact check: ${counts.verified} verified · ${counts.partly} partly supported · ${counts.unsupported} unsupported · $${cost.toFixed(3)}`,
  );
  return {
    checkedAt: new Date().toISOString(),
    brochureHash: brochureHash(brochure),
    cost,
    counts,
    pages: [...pages.entries()].map(([url, p]) => ({ url, ok: p.ok, error: p.error })),
    claims: out.sort((a, b) => RANK[a.status] - RANK[b.status]),
  };
}
