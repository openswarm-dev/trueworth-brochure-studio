# True Worth AI · Brochure Studio

Turns a company name and website into a custom, on-brand True Worth AI partnership brochure. All AI calls go through **OpenRouter**.

1. **Research**: the model searches and reads the web with OpenRouter's `openrouter:web_search` and `openrouter:web_fetch` server tools. It covers the prospect's website, LinkedIn and socials, news, hiring, reviews and tech signals, then writes a sourced dossier.
2. **Write**: the model maps their workflows to AI opportunities and the right TWAI service, using only the facts in `server/knowledge.js` (real prices, people, case studies). The output is brochure JSON, which the app checks against a schema and sends back to the model to fix if anything is wrong.
3. **Design**: the copy is laid out as a six-page A4 brochure that matches the existing TWAI brochures. The pages are: cover, where they are today, AI opportunities, your path and investment, proof and how we deliver, and next step.
4. **Fact check**: a fast model lists every claim the brochure makes about the prospect, and the app fetches the cited source pages itself. Each claim is marked Verified, Partly supported or Unsupported. Quotes must match the source word for word, and a claim backed only by the AI's research notes is never marked Verified. Results appear in the **Fact check** tab; unsupported claims are outlined in red in the edit view. It costs about $0.01 per brochure (`OPENROUTER_FAST_MODEL`, default `anthropic/claude-haiku-5.5`). It re-runs after every revision, and the tab offers a re-run after manual edits.
5. **Review**: edit any line inline, ask the AI for revisions, check the research and sources, then download the PDF.

## Run it

```bash
npm install
```

Add your OpenRouter key to `.env`:

```
OPENROUTER_API_KEY=sk-or-...
```

```bash
npm start
```

Open http://localhost:4580. A fictional sample brochure, "Northwind Freight (sample)", is included so you can see the design. Delete it from the app when you no longer need it.

## Models

The default for both steps is `anthropic/claude-opus-5.5`. To change it, set `OPENROUTER_MODEL` in `.env`; this model writes the brochure. Set `OPENROUTER_RESEARCH_MODEL` too if you want a different model for research.

The research model must support tool calling. On openrouter.ai/models, filter by "tools".

## Notes

- **Cost and time:** research is capped at 24 searches or page reads, and long pages are trimmed to keep it affordable. A test run cost about $1 for research and took about 3 minutes. The job log shows what each brochure actually cost.
- **PDF export** uses your installed Chrome or Edge. If it fails, the app opens a print view instead; use Print → Save as PDF there.
- **Facts about True Worth AI** live in `server/knowledge.js`. Update prices, team, case studies or contact details there; the next brochure will use them.
- **Optional settings** are listed in `.env.example`.
- Brochures are saved as JSON in `data/brochures/`.
- Run locally, the app only listens on this computer (127.0.0.1) and has no login. When hosted, it requires `APP_PASSWORD`; see below.
- Brand images were extracted from the TWAI brochure PDFs using `scripts/extract-pdf-images.mjs`.

## Deploying to Render

The repo includes a `Dockerfile` (Node and Chromium for PDF export) and a `render.yaml` Blueprint. The Blueprint sets up a Starter web service in Frankfurt, with a 1 GB disk at `/var/data` for saved brochures.

1. In Render: **New → Blueprint**, then pick this GitHub repo.
2. When asked, paste your `OPENROUTER_API_KEY`.
3. Render generates `APP_PASSWORD`. To find it, open **Environment** in the service. You sign in with the username `trueworth` and that password.

Every push to `main` redeploys automatically. When hosted, the app refuses to start unless `APP_PASSWORD` is set, so it can never be public without a login.
