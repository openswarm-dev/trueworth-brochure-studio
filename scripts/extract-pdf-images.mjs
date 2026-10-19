// One-off helper: pulls embedded images (illustrations, team photos) out of the
// existing TWAI brochures so the generated brochures can reuse them.
// Usage: node scripts/extract-pdf-images.mjs <pdf...> --out <dir>
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const outDir = outIdx >= 0 ? args[outIdx + 1] : "extracted";
const files = args.filter((a, i) => a !== "--out" && i !== outIdx + 1);
fs.mkdirSync(outDir, { recursive: true });

function toRgba(img) {
  const { width, height, data, kind } = img;
  const out = Buffer.alloc(width * height * 4);
  if (kind === 3) return Buffer.from(data);
  if (kind === 2) {
    for (let i = 0, j = 0; i < width * height; i++) {
      out[j++] = data[i * 3]; out[j++] = data[i * 3 + 1]; out[j++] = data[i * 3 + 2]; out[j++] = 255;
    }
    return out;
  }
  // kind 1: 1 bit per pixel greyscale
  const rowBytes = (width + 7) >> 3;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const bit = (data[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
    const v = bit ? 255 : 0; const o = (y * width + x) * 4;
    out[o] = out[o + 1] = out[o + 2] = v; out[o + 3] = 255;
  }
  return out;
}

const seen = new Set();
for (const file of files) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), verbosity: 0 }).promise;
  const base = path.basename(file, ".pdf").replace(/\W+/g, "_");
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const ops = await page.getOperatorList();
    let n = 0;
    for (let i = 0; i < ops.fnArray.length; i++) {
      if (ops.fnArray[i] !== pdfjs.OPS.paintImageXObject) continue;
      const name = ops.argsArray[i][0];
      const img = await new Promise((res) => {
        const store = name.startsWith("g_") ? page.commonObjs : page.objs;
        store.get(name, res);
      });
      if (!img || !img.data || img.width < 60) continue;
      const key = `${img.width}x${img.height}:${img.data.length}:${img.data[Math.floor(img.data.length / 2)]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const png = new PNG({ width: img.width, height: img.height });
      png.data = toRgba(img);
      const out = path.join(outDir, `${base}_p${p}_${n++}_${img.width}x${img.height}.png`);
      fs.writeFileSync(out, PNG.sync.write(png));
      console.log(out);
    }
  }
}
