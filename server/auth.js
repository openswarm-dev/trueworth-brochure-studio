// Password protection for hosted deployments (HTTP Basic auth). The app spends
// OpenRouter credit on every run, so it must never be public without a login.
// Locally (no APP_PASSWORD) it stays open because it only listens on 127.0.0.1.
import crypto from "node:crypto";

export const AUTH_USER = process.env.APP_USERNAME || "trueworth";
const PASSWORD = process.env.APP_PASSWORD || "";

const same = (a, b) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

export function assertSafeToServe(host) {
  const local = ["127.0.0.1", "localhost", "::1"].includes(host);
  if (!local && !PASSWORD) {
    console.error("Refusing to start: set APP_PASSWORD before serving on a public address.");
    process.exit(1);
  }
}

export function requireLogin(req, res, next) {
  if (!PASSWORD || req.path === "/healthz") return next();
  const [scheme, encoded] = (req.headers.authorization || "").split(" ");
  if (scheme === "Basic" && encoded) {
    const [user, ...rest] = Buffer.from(encoded, "base64").toString().split(":");
    if (same(user, AUTH_USER) && same(rest.join(":"), PASSWORD)) return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="True Worth AI Brochure Studio", charset="UTF-8"');
  res.status(401).send("Login required.");
}

// Credentials for the headless browser that prints PDFs from this server.
export const pdfCredentials = () => (PASSWORD ? { username: AUTH_USER, password: PASSWORD } : null);
