// Prints a brochure to PDF with the locally installed Edge or Chrome (no
// bundled Chromium download needed).
import fs from "node:fs";
import puppeteer from "puppeteer-core";
import { pdfCredentials } from "./auth.js";

// In a Linux container Chrome runs as root without a sandbox and with a small /dev/shm.
const ARGS = ["--no-first-run", "--disable-extensions", ...(process.platform === "linux" ? ["--no-sandbox", "--disable-dev-shm-usage"] : [])];

// Chrome first: headless Edge on Windows often exits immediately when a normal
// Edge window is already open.
const CANDIDATES = [
  process.env.BROWSER_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

const installed = () => CANDIDATES.filter((p) => fs.existsSync(p));
export const browserPath = () => installed()[0];

async function launch() {
  const paths = installed();
  if (!paths.length) throw new Error("No Chrome/Edge found for PDF export. Set BROWSER_PATH in .env, or use Print → Save as PDF.");
  let lastErr;
  for (const executablePath of paths) {
    try {
      return await puppeteer.launch({ executablePath, headless: true, pipe: true, args: ARGS });
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`Could not start a browser for PDF export (${lastErr.message.split("\n")[0]})`);
}

export async function toPdf(url) {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    const creds = pdfCredentials();
    if (creds) await page.authenticate(creds); // the brochure page sits behind the app login
    await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 });
    await page.setViewport({ width: 794, height: 1123 });
    await page.evaluate(async () => {
      await document.fonts.ready;
      window.fitPages?.();
    });
    return await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
  } finally {
    await browser.close();
  }
}
