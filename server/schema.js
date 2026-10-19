// JSON Schema for the brochure the writer produces (sent in the prompt and
// validated in ai.js; too large for providers' strict grammar mode).
// Structured outputs needs every object closed and every key required, so the
// helpers below enforce that; array lengths are steered by the prompt and
// clamped in normalise().
import { CASE_STUDIES, TESTIMONIALS, TEAM } from "./knowledge.js";

const str = (description) => ({ type: "string", description });
const bool = (description) => ({ type: "boolean", description });
const enm = (values, description) => ({ type: "string", enum: values, description });
const arr = (items, description) => ({ type: "array", items, description });
const obj = (properties, description) => ({
  type: "object",
  description,
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const MARKUP = "Inline markup allowed: **bold** and [[accent]] (pink highlight, use sparingly, max 1–2 per field).";

export const SERVICE_KEYS = ["roadmap", "workshop", "project", "collective"];
export const ILLUSTRATIONS = ["rocket", "megaphone", "lamp", "monitor", "book", "clock"];

export const BROCHURE_SCHEMA = obj({
  profile: obj({
    company_name: str("Official/trading name of the prospect."),
    one_liner: str("What the company does, in one plain sentence."),
    sector: str("Short sector label, e.g. 'Specialist insurance broker'."),
    size_estimate: str("Headcount/revenue estimate with the basis, e.g. '~120 staff (LinkedIn)'. Say 'Unknown' if not found."),
    headquarters: str("City, country or 'Unknown'."),
    key_people: arr(obj({ name: str("Person"), role: str("Role") }), "Leadership found in research (0–6)."),
    signals: arr(obj({ type: enm(["growth", "news", "hiring", "product", "tech", "social", "risk", "ai"], "Signal type"), detail: str("What was found and why it matters, one sentence.") }), "Notable buying signals from research (4–10)."),
    ai_maturity: enm(["No visible AI use", "Exploring", "Early adoption", "Active adoption", "Advanced"], "Best estimate of their current AI maturity."),
    ai_maturity_reason: str("One sentence of evidence for the maturity estimate."),
    talking_points: arr(str("A conversation opener for the sales call."), "3–5 talking points for the TWAI salesperson (internal, not printed)."),
  }, "Internal research profile shown in the app, not printed."),
  brochure: obj({
    illustration: enm(ILLUSTRATIONS, "Cover illustration that best fits the story: rocket=growth/launch, megaphone=customer/marketing/comms, lamp=ideas/strategy/planning, monitor=tech/operations, book=knowledge/compliance/process, clock=time savings/efficiency."),
    cover: obj({
      eyebrow: str("Short uppercase-style kicker, e.g. 'AI PARTNERSHIP PROPOSAL'. Max 5 words."),
      headline_lead: str("First part of the cover headline (white). Together with headline_accent max ~9 words. Should name or clearly address the company."),
      headline_accent: str("Second part of the headline, shown in pink."),
      intro: str(`2–3 sentences, max 45 words, written to the prospect about their business and what AI could do for it. ${MARKUP}`),
      stats: arr(obj({ label: str("Uppercase label, 1–3 words"), value: str("Big value, 1–3 words"), sub: str("Optional small line under the value, or empty string"), accent: bool("Render value in pink (use on exactly one stat)") }), "Exactly 3 cover stats tailored to them, e.g. FIRST RESULT / 30 days, RECOMMENDED START / AI Roadmap, BUILT FOR / their team."),
    }),
    snapshot: obj({
      title: str("Page title, e.g. 'Where {Company} is today'. Max 7 words."),
      intro: str(`2–4 sentences showing we understand their business, using specific researched facts. ${MARKUP}`),
      callout: str(`One sentence pulled out as a callout box: the key tension or opportunity. ${MARKUP}`),
      dark_label: str("Label for the dark panel, e.g. 'WHY NOW'."),
      dark_text: str(`2–3 sentences on why AI matters for them right now (their growth, market, regulation, competitors). ${MARKUP}`),
      insights: arr(obj({ title: str("Short insight title, max 6 words"), body: str("1–2 sentences, specific to them, citing what we saw (news, hiring, product, socials).") }), "Exactly 4 insights from the research."),
    }),
    opportunities: obj({
      title: str("Page title, e.g. 'Where AI can pay back for {Company}'."),
      intro: str("1–2 sentences framing the opportunities."),
      items: arr(obj({
        area: str("Business area in caps, e.g. 'CUSTOMER SERVICE'"),
        title: str("Opportunity title, max 7 words"),
        body: str("1–2 sentences: the workflow today and what an AI agent/workflow would do."),
        impact: str("Plausible, hedged impact, e.g. 'Est. 10–15 hrs/week saved'. Never claim certainty."),
        effort: enm(["Quick win", "Medium", "Strategic"], "Relative effort"),
      }), "Exactly 6 AI opportunities specific to them, ordered by value vs effort."),
      highlight_title: str("Title for the dark highlight box about the single best first opportunity."),
      highlight_body: str(`1–2 sentences on why that should be the first 30-day build. ${MARKUP}`),
    }),
    path: obj({
      title: str("Page title, e.g. 'Your path with True Worth AI'."),
      intro: str("1–2 sentences."),
      recommended_service: enm(SERVICE_KEYS, "The entry service to recommend."),
      recommended_reason: str("1–2 sentences on why this is the right starting point for them."),
      steps: arr(obj({ label: str("Uppercase step label, e.g. 'WEEKS 1–2 · AI ROADMAP'"), title: str("Step title, max 5 words"), body: str("1–2 sentences tailored to them.") }), "Exactly 4 steps from first engagement to ongoing support, using real TWAI services."),
    }),
    proof: obj({
      title: str("Page title, e.g. 'Proof from businesses like yours'."),
      intro: str("1 sentence connecting our results to their situation."),
      case_studies: arr(enm(Object.keys(CASE_STUDIES), "Case study key"), "Exactly 2 most relevant case-study keys."),
      testimonial: enm(Object.keys(TESTIMONIALS), "Most relevant testimonial key."),
    }),
    close: obj({
      lead: enm(Object.keys(TEAM), "Which TWAI person fronts the next step: rufus if workshop recommended, otherwise john."),
      lead_note: str("1 sentence on what this person will do for them specifically."),
      eyebrow: str("e.g. 'THE NEXT STEP'"),
      headline_lead: str("Closing headline part 1 (white), max ~6 words."),
      headline_accent: str("Closing headline part 2 (pink), max ~4 words."),
      body: str(`2–3 sentences inviting a discovery call, specific to them. ${MARKUP}`),
    }),
  }),
});

const clampArr = (a, n) => (Array.isArray(a) ? a.slice(0, n) : []);

// Defensive clean-up of the model output so the renderer never breaks.
export function normalise(data) {
  const b = data.brochure;
  b.cover.stats = clampArr(b.cover.stats, 3);
  b.snapshot.insights = clampArr(b.snapshot.insights, 4);
  b.opportunities.items = clampArr(b.opportunities.items, 6);
  b.path.steps = clampArr(b.path.steps, 4);
  b.proof.case_studies = [...new Set(clampArr(b.proof.case_studies, 2))].filter((k) => CASE_STUDIES[k]);
  if (b.proof.case_studies.length < 2) {
    for (const k of Object.keys(CASE_STUDIES)) if (b.proof.case_studies.length < 2 && !b.proof.case_studies.includes(k)) b.proof.case_studies.push(k);
  }
  if (!TESTIMONIALS[b.proof.testimonial]) b.proof.testimonial = Object.keys(TESTIMONIALS)[0];
  if (!TEAM[b.close.lead]) b.close.lead = b.path.recommended_service === "workshop" ? "rufus" : "john";
  if (!ILLUSTRATIONS.includes(b.illustration)) b.illustration = "rocket";
  return data;
}
