import "dotenv/config";
import path from "node:path";
import { EventEmitter } from "node:events";
import express from "express";
import * as store from "./store.js";
import { research, write, revise } from "./ai.js";
import { renderBrochure } from "./render.js";
import { toPdf, browserPath } from "./pdf.js";
import { COMPANY, SERVICES, TEAM } from "./knowledge.js";
import { scrapeWebsite, searchProfiles, PLATFORMS } from "./discover.js";
import { factCheck, brochureHash } from "./factcheck.js";
import { requireLogin, assertSafeToServe } from "./auth.js";

const PORT = Number(process.env.PORT || 4580);
// Local-only by default. Hosted (HOST=0.0.0.0) it requires APP_PASSWORD, see auth.js.
const HOST = process.env.HOST || "127.0.0.1";

const app = express();
app.get("/healthz", (_req, res) => res.send("ok"));
app.use(requireLogin);
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.resolve("public")));

// ---- live progress -------------------------------------------------------
const bus = new EventEmitter();
bus.setMaxListeners(100);
const running = new Set();

function logger(rec) {
  return (kind, message) => {
    const entry = { at: new Date().toISOString(), kind, message };
    rec.log.push(entry);
    bus.emit(rec.id, { type: "log", entry });
  };
}

async function setStatus(rec, status, extra = {}) {
  Object.assign(rec, { status }, extra);
  await store.save(rec);
  bus.emit(rec.id, { type: "status", status, error: rec.error });
}

// A failed fact check never blocks the brochure; it just logs why.
async function runFactCheck(rec, log) {
  await setStatus(rec, "checking");
  try {
    rec.factcheck = await factCheck(rec, log);
  } catch (err) {
    console.error(err);
    log("error", `Fact check failed: ${err.message}`);
    rec.factcheck = { error: err.message, checkedAt: new Date().toISOString(), claims: [] };
  }
}

async function runPipeline(rec, { skipResearch = false } = {}) {
  running.add(rec.id);
  const log = logger(rec);
  try {
    if (!skipResearch) {
      await setStatus(rec, "researching", { error: null });
      log("info", `Researching ${rec.input.companyName} (${rec.input.website})`);
      const r = await research(rec.input, log);
      rec.research = { dossier: r.dossier, sources: r.sources };
      log("done", `Research complete · ${r.sources.length} sources`);
      await store.save(rec);
    }
    await setStatus(rec, "writing", { error: null });
    rec.data = await write(rec.input, rec.research.dossier, log);
    await runFactCheck(rec, log);
    log("done", "Brochure ready");
    await setStatus(rec, "ready");
  } catch (err) {
    console.error(err);
    log("error", err.message);
    await setStatus(rec, "error", { error: err.message });
  } finally {
    running.delete(rec.id);
  }
}

const clean = (v, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function normaliseUrl(u) {
  const s = clean(u, 500);
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

// ---- API -----------------------------------------------------------------
const api = express.Router();

api.get("/config", (_req, res) =>
  res.json({
    hasApiKey: Boolean(process.env.OPENROUTER_API_KEY),
    pdf: Boolean(browserPath()),
    services: Object.values(SERVICES).filter((s) => ["roadmap", "workshop", "project", "collective"].includes(s.key)).map(({ key, name, price }) => ({ key, name, price })),
    team: Object.values(TEAM).map(({ key, name, role }) => ({ key, name, role })),
    company: { phone: COMPANY.phone, bookingUrl: COMPANY.bookingUrl },
  }),
);

api.get("/brochures", async (_req, res) => res.json(await store.list()));

// Fetch step: read the website for its name and linked profiles (fast, free).
api.post("/discover", async (req, res) => {
  const url = clean(req.body?.url, 500);
  if (!url) return res.status(400).json({ error: "Paste the company's website address." });
  try {
    res.json(await scrapeWebsite(url));
  } catch (err) {
    res.status(422).json({ error: err.name === "TimeoutError" ? "The website took too long to respond." : err.message });
  }
});

// Then search the web for profiles the website doesn't link to.
api.post("/discover/search", async (req, res) => {
  if (!process.env.OPENROUTER_API_KEY) return res.status(400).json({ error: "OPENROUTER_API_KEY is not set." });
  const website = normaliseUrl(req.body?.website);
  if (!website) return res.status(400).json({ error: "Missing website." });
  try {
    res.json(
      await searchProfiles({
        website,
        companyName: clean(req.body?.companyName, 200) || new URL(website).hostname,
        known: (Array.isArray(req.body?.known) ? req.body.known : []).slice(0, 25).map((u) => clean(u, 300)),
      }),
    );
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: `Web search failed: ${err.message}` });
  }
});

api.get("/platforms", (_req, res) => res.json(PLATFORMS));

api.post("/brochures", async (req, res) => {
  const b = req.body || {};
  const input = {
    companyName: clean(b.companyName, 200),
    website: normaliseUrl(b.website),
    // Profiles the team ticked on the Fetch step.
    profiles: (Array.isArray(b.profiles) ? b.profiles : [])
      .slice(0, 25)
      .map((p) => ({ platform: PLATFORMS[p?.platform] ? p.platform : "other", url: normaliseUrl(p?.url) }))
      .filter((p) => /^https?:\/\/[^\s]+$/.test(p.url)),
    contactName: clean(b.contactName, 120),
    contactRole: clean(b.contactRole, 120),
    notes: clean(b.notes, 4000),
    service: SERVICES[b.service] ? b.service : "auto",
    preparedBy: clean(b.preparedBy, 120),
  };
  if (!input.companyName || !input.website) return res.status(400).json({ error: "Company name and website are required." });
  if (!process.env.OPENROUTER_API_KEY) return res.status(400).json({ error: "OPENROUTER_API_KEY is not set. Add it to the .env file and restart." });

  const rec = { id: store.newId(input.companyName), input, status: "queued", createdAt: new Date().toISOString(), log: [], research: null, data: null, error: null };
  await store.save(rec);
  runPipeline(rec);
  res.status(201).json({ id: rec.id });
});

api.get("/brochures/:id", async (req, res) => {
  const rec = await store.get(req.params.id);
  if (!rec) return res.status(404).json({ error: "Not found" });
  res.json({
    ...rec,
    running: running.has(rec.id),
    // True when the copy was edited after the last fact check.
    factcheckStale: Boolean(rec.factcheck?.brochureHash && rec.data && rec.factcheck.brochureHash !== brochureHash(rec.data.brochure)),
  });
});

api.get("/brochures/:id/events", async (req, res) => {
  const rec = await store.get(req.params.id);
  if (!rec) return res.status(404).end();
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.flushHeaders();
  const send = (ev) => res.write(`data: ${JSON.stringify(ev)}\n\n`);
  send({ type: "snapshot", status: rec.status, log: rec.log, error: rec.error });
  const ping = setInterval(() => res.write(": ping\n\n"), 20_000);
  bus.on(rec.id, send);
  req.on("close", () => {
    clearInterval(ping);
    bus.off(rec.id, send);
  });
});

// Save inline edits: { edits: { "brochure.cover.intro": "text", ... } }
api.put("/brochures/:id", async (req, res) => {
  const rec = await store.get(req.params.id);
  if (!rec?.data) return res.status(404).json({ error: "Not found" });
  const edits = req.body?.edits || {};
  for (const [p, value] of Object.entries(edits)) {
    const keys = p.split(".");
    if (!["brochure", "profile"].includes(keys[0]) || keys.some((k) => k === "__proto__" || k === "constructor" || k === "prototype")) continue;
    let o = rec.data;
    for (const k of keys.slice(0, -1)) o = o?.[k];
    const last = keys.at(-1);
    if (o && typeof o === "object" && typeof o[last] === "string") o[last] = clean(value, 4000);
  }
  await store.save(rec);
  res.json({ ok: true });
});

api.post("/brochures/:id/revise", async (req, res) => {
  const rec = await store.get(req.params.id);
  if (!rec?.data || !rec.research) return res.status(404).json({ error: "Not found" });
  if (running.has(rec.id)) return res.status(409).json({ error: "Already generating." });
  const instructions = clean(req.body?.instructions, 4000);
  if (!instructions) return res.status(400).json({ error: "Describe what to change." });
  running.add(rec.id);
  const log = logger(rec);
  res.status(202).json({ ok: true });
  try {
    await setStatus(rec, "writing", { error: null });
    log("info", `Revising: ${instructions}`);
    rec.data = await revise(rec.input, rec.research.dossier, rec.data, instructions, log);
    await runFactCheck(rec, log);
    log("done", "Revision ready");
    await setStatus(rec, "ready");
  } catch (err) {
    console.error(err);
    log("error", err.message);
    await setStatus(rec, rec.data ? "ready" : "error", { error: err.message });
  } finally {
    running.delete(rec.id);
  }
});

// Re-run the fact check on the current copy (e.g. after manual edits).
api.post("/brochures/:id/factcheck", async (req, res) => {
  const rec = await store.get(req.params.id);
  if (!rec?.data) return res.status(404).json({ error: "Not found" });
  if (running.has(rec.id)) return res.status(409).json({ error: "Already working on this brochure." });
  if (!process.env.OPENROUTER_API_KEY) return res.status(400).json({ error: "OPENROUTER_API_KEY is not set." });
  running.add(rec.id);
  res.status(202).json({ ok: true });
  try {
    await runFactCheck(rec, logger(rec));
  } finally {
    await setStatus(rec, "ready");
    running.delete(rec.id);
  }
});

// Re-run: full research again, or just rewrite from the saved dossier.
api.post("/brochures/:id/regenerate", async (req, res) => {
  const rec = await store.get(req.params.id);
  if (!rec) return res.status(404).json({ error: "Not found" });
  if (running.has(rec.id)) return res.status(409).json({ error: "Already generating." });
  const skipResearch = req.body?.mode === "rewrite" && Boolean(rec.research?.dossier);
  runPipeline(rec, { skipResearch });
  res.status(202).json({ ok: true });
});

api.delete("/brochures/:id", async (req, res) => {
  if (running.has(req.params.id)) return res.status(409).json({ error: "Still generating." });
  await store.remove(req.params.id);
  res.json({ ok: true });
});

api.get("/brochures/:id/pdf", async (req, res, next) => {
  try {
    const rec = await store.get(req.params.id);
    if (!rec?.data) return res.status(404).json({ error: "Not found" });
    const pdf = await toPdf(`http://127.0.0.1:${PORT}/brochure/${rec.id}?print=1`);
    const name = `${(rec.data.profile?.company_name || rec.input.companyName).replace(/[^\w\- ]+/g, "")} x True Worth AI.pdf`;
    res.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}"` });
    res.end(pdf);
  } catch (err) {
    next(err);
  }
});

app.use("/api", api);

app.get("/brochure/:id", async (req, res) => {
  const rec = await store.get(req.params.id);
  if (!rec?.data) return res.status(404).send("Brochure not ready.");
  res.type("html").send(renderBrochure(rec, { edit: req.query.edit === "1", print: req.query.print === "1" }));
});

app.get(["/new", "/b/:id"], (_req, res) => res.sendFile(path.resolve("public/index.html")));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Something went wrong" });
});

// Jobs live in memory, so anything mid-flight when the server stopped can't resume.
for (const { id, status } of await store.list()) {
  if (["queued", "researching", "writing", "checking"].includes(status)) {
    const rec = await store.get(id);
    rec.status = rec.data ? "ready" : "error";
    rec.error = "Interrupted because the app was restarted. Use Try again / Regenerate.";
    await store.save(rec);
  }
}

assertSafeToServe(HOST);
app.listen(PORT, HOST, () => {
  console.log(`True Worth AI · Brochure Studio running at http://localhost:${PORT}`);
  if (!process.env.OPENROUTER_API_KEY) console.warn("⚠ OPENROUTER_API_KEY is not set – add it to .env to generate brochures.");
});
