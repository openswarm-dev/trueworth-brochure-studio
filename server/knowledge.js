// Everything the writer is allowed to say about True Worth AI. Sourced from the
// published brochures and trueworth.ai. Keep this the single source of truth:
// brochures must never invent prices, case studies, people or claims beyond it.

export const COMPANY = {
  name: "True Worth AI",
  legal: "True Worth AI Ltd · Reg. 16906869 · Ground Floor Rear Barn, The Brookdale Centre, Knutsford, Cheshire WA16 0SR",
  phone: "0161 399 1465",
  website: "trueworth.ai",
  bookingUrl: process.env.TWAI_BOOKING_URL || "https://calendly.com/trueworthsam/true-worth-ai-discovery-call",
  policyUrl: "https://trueworth.ai/ai-policy-creator/",
  whatsapp: "https://wa.me/447867504639",
  // No public address on the site, so the "Email us" button only shows when set.
  email: process.env.TWAI_CONTACT_EMAIL || "",
  tagline: "Think big, start small, move fast.",
  strap: "Governed AI · delivered in 30 days",
};

export const SERVICES = {
  policy: {
    key: "policy",
    name: "AI Policy Creator",
    price: "Free",
    priceLabel: "FREE",
    summary: "Create your own AI usage policy in minutes, free. The simplest first step to using AI safely, at trueworth.ai/ai-policy-creator.",
  },
  roadmap: {
    key: "roadmap",
    name: "AI Roadmap",
    price: "£1,500",
    priceLabel: "£1,500 · CREDITED IN FULL",
    summary: "A fixed-price, two-week review run by an experienced operator. Finds where the business is losing time and money, ranks which AI ideas are worth doing, and delivers a costed 90-day plan. Deliverables: ~12-page board-ready report, 5–8 ranked opportunities, top 3 quick wins, honest advice, readiness score (data, tools, skills, controls), 90-day plan, 1-hour findings presentation. The £1,500 is credited in full against any work commissioned from the plan.",
    lead: "john",
  },
  workshop: {
    key: "workshop",
    name: "AI Workshop",
    price: "From £1,500",
    priceLabel: "FROM £1,500",
    summary: "A facilitated half-day (£1,500) or full-day (£2,500) session for the leadership team, led by Rufus Curnow. Builds a shared AI language, maps and ranks use cases, runs a readiness check, and ends with a recommended next step, usually an AI Roadmap. Includes a pre-workshop intake and a written summary pack.",
    lead: "rufus",
  },
  project: {
    key: "project",
    name: "30-Day AI Project",
    price: "From £5,000",
    priceLabel: "FROM £5,000",
    summary: "A fixed-price 30-day project to build and launch one high-value AI process: safe to use, connected to existing tools, and actually used by the team. Week 1 plan, week 2 build & connect, week 3 make it safe & solid, week 4 go live & hand over. A real result in 30 days and payback within 90. From £5,000 + VAT, scoped per project.",
    lead: "john",
  },
  support: {
    key: "support",
    name: "Monthly support",
    price: "Ongoing",
    priceLabel: "ONGOING",
    summary: "We keep it running and build the next opportunity. Scale on proof, not hype.",
  },
  collective: {
    key: "collective",
    name: "The True Worth Collective",
    price: "Fractional day rate or full-time contractor",
    priceLabel: "ON DEMAND",
    summary: "A curated network of 150+ fractional AI experts (engineers, architects, fractional CTOs/CIOs, domain SMEs). True Worth AI scopes, manages and stays accountable.",
  },
};

export const TEAM = {
  john: {
    key: "john",
    name: "John Welsh",
    role: "Delivery lead",
    bio: "Co-founder and delivery lead. A former CIO with 20 years delivering process improvement and re-engineering, and the last 5 years delivering RPA and AI automation projects. He builds and ships your AI workflow himself.",
    photo: "team-john-welsh.png",
  },
  rufus: {
    key: "rufus",
    name: "Rufus Curnow",
    role: "Workshop facilitator",
    bio: "Years of hands-on AI experience, more than 50 workshops delivered, and a keynote speaker at AI events.",
    photo: "team-rufus-curnow.png",
  },
  sam: {
    key: "sam",
    name: "Sam Mikkelsen",
    role: "Head of customer success",
    bio: "Co-founder of True Worth AI, with 30 years' experience helping companies build tech teams and deliver projects.",
    photo: "team-sam-mikkelsen.png",
  },
};

export const CASE_STUDIES = {
  fca_lender: {
    key: "fca_lender",
    sector: "FINANCIAL SERVICES · FCA",
    headline: "8 hrs down to under 3",
    body: "AI customer-service agent for an FCA-regulated lender. Response time cut from 8 hours to under 3.",
  },
  saas_pilot: {
    key: "saas_pilot",
    sector: "SAAS",
    headline: "8-week pilot to 12-month deal",
    body: "AI agents saving a SaaS product team hours every day, now expanding across engineering.",
  },
  qa_effort: {
    key: "qa_effort",
    sector: "FINANCIAL SERVICES",
    headline: "Half the manual QA effort",
    body: "AI-assisted test generation and code review across the delivery pipeline.",
  },
  requirements: {
    key: "requirements",
    sector: "SOFTWARE",
    headline: "Faster requirements capture",
    body: "AI business-analysis agent automating requirements capture and workflow.",
  },
};

export const TESTIMONIALS = {
  digital_dra: {
    key: "digital_dra",
    quote: "Our partnership with True Worth AI has allowed our customer support team to scale, saving them hours of time every day, without losing compassion or control.",
    name: "Tom Hill, Operations Director",
    org: "The Digital DRA, Halifax",
  },
  mojo_cx: {
    key: "mojo_cx",
    quote: "Within 8 weeks we had an AI solution saving our product team hours every day. We're now engaging them on a twelve-month project to build more agents for our development teams.",
    name: "Jimmy Hosang, CEO",
    org: "Mojo CX, Manchester",
  },
};

export const KNOWLEDGE_BASE = `
# True Worth AI — facts you may use (do not invent anything beyond this)

## Positioning
- True Worth AI helps ambitious scale-ups and SMEs (typically 25–250 people, often tech-led or private-equity backed) turn everyday AI use into measurable results, safely.
- Core promise: one high-value workflow at a time, live in 30 days, ROI in 90 days. Data protected, people in control.
- "Not hype, and not a science project. Practical, governed AI delivered by experienced operators, with a clear return you can measure."
- Why True Worth AI: Governed by design · Operator-led (people who have run businesses, not theorists) · Measurable ROI · Start small, scale on proof.
- Human-led: we amplify your people, we don't replace them. Manchester-based, 40+ years across software, automation and transformation. We stay after go-live.
- The reality many prospects face: pressure to "do something with AI" without seeing payback; staff pasting company data into ChatGPT with no rules or visibility; trialled tools where nothing stuck; GDPR and EU AI Act make ungoverned AI a growing risk.
- John Welsh quote: "Doing nothing isn't neutral. Ungoverned AI is already creating data-leakage and compliance exposure in most businesses, quite possibly yours."

## Services and prices (use these exact prices)
${Object.values(SERVICES).map((s) => `- ${s.name} [key: ${s.key}] — ${s.price}. ${s.summary}`).join("\n")}

## How we deliver
- Conductor: our orchestration layer for building AI agents and workflows that are governed by design. Data stays in the client's environment, every action is logged and auditable, model-agnostic so no vendor lock-in. Guardrails, permissions and a full audit trail baked in. Runs on the client's cloud, connects via existing APIs.
- The True Worth Collective: 150+ fractional AI experts. Capability without headcount; the right skills, not just available ones; one accountable partner.

## People (only these people exist)
${Object.values(TEAM).map((t) => `- ${t.name} [key: ${t.key}] — ${t.role}. ${t.bio}`).join("\n")}

## Proof (only these case studies and testimonials exist; never fabricate others)
${Object.values(CASE_STUDIES).map((c) => `- [key: ${c.key}] ${c.sector}: ${c.headline}. ${c.body}`).join("\n")}
${Object.values(TESTIMONIALS).map((t) => `- [key: ${t.key}] "${t.quote}" — ${t.name}, ${t.org}`).join("\n")}
- Trusted by: Mojo CX, The Digital DRA, McQueens Dairies, Sosandar.

## Voice
- British English. Plain, confident, practical, jargon-free. Short sentences. No hype words ("revolutionise", "unlock", "game-changing", "cutting-edge", "leverage", "synergy").
- Lead with the client's world, not ours. Specific beats generic. Honest about what is an estimate.
- Brand sign-off: "Think big, start small, move fast."
`.trim();
