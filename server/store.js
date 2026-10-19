// Brochures are stored as one JSON file each in data/brochures.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const DIR = path.resolve(process.env.DATA_DIR || "data/brochures");
await fs.mkdir(DIR, { recursive: true });

const file = (id) => {
  if (!/^[a-z0-9-]+$/.test(id)) throw Object.assign(new Error("Bad id"), { status: 400 });
  return path.join(DIR, `${id}.json`);
};

export const newId = (name) =>
  `${String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "brochure"}-${crypto.randomBytes(3).toString("hex")}`;

export async function get(id) {
  try {
    return JSON.parse(await fs.readFile(file(id), "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}

export async function save(rec) {
  rec.updatedAt = new Date().toISOString();
  const tmp = `${file(rec.id)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(rec, null, 2));
  await fs.rename(tmp, file(rec.id));
  return rec;
}

export async function list() {
  const names = (await fs.readdir(DIR)).filter((f) => f.endsWith(".json"));
  const recs = await Promise.all(names.map((f) => fs.readFile(path.join(DIR, f), "utf8").then(JSON.parse).catch(() => null)));
  return recs
    .filter(Boolean)
    .map(({ id, input, status, error, createdAt, updatedAt, data }) => ({
      id, status, error, createdAt, updatedAt,
      companyName: data?.profile?.company_name || input.companyName,
      website: input.website,
      contactName: input.contactName,
      sector: data?.profile?.sector,
      service: data?.brochure?.path?.recommended_service,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function remove(id) {
  await fs.rm(file(id), { force: true });
}
