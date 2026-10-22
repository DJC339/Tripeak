// Hosted verification for a deployed Tripeak site. Run against every URL that
// serves a deploy: production, branch/deploy previews and deploy-specific
// permalinks (https://<deploy-id>--<site>.netlify.app).
//
//   npm run verify:deploy -- https://<site>.netlify.app https://<deploy-id>--<site>.netlify.app
//   npm run verify:deploy -- --production https://www.example.ca
//   npm run verify:deploy -- --rate-limit https://<deploy-preview-url>
//
// It never creates a stored submission: every POST it sends is invalid or targets
// a non-registered form name. Things it cannot observe (e.g. whether Netlify stored
// a bypass attempt) are printed as MANUAL steps to check in the Netlify UI.
// --rate-limit sends ~20 invalid POSTs and will rate-limit your IP on that site for
// up to 3 minutes.
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const production = args.includes("--production");
const testRateLimit = args.includes("--rate-limit");
const urls = args.filter((a) => !a.startsWith("--")).map((u) => u.replace(/\/+$/, ""));
if (!urls.length) {
  console.error("Usage: npm run verify:deploy -- [--production] [--rate-limit] <url> [<url>...]");
  process.exit(2);
}

const expectedCsp = readFileSync("netlify.toml", "utf8").match(/Content-Security-Policy = "([^"]+)"/)[1];
let failures = 0;
const pass = (msg) => console.log(`  PASS    ${msg}`);
const fail = (msg) => (failures++, console.log(`  FAIL    ${msg}`));
const manual = (msg) => console.log(`  MANUAL  ${msg}`);
const check = (ok, msg, detail = "") => (ok ? pass(msg) : fail(`${msg}${detail ? ` (${detail})` : ""}`));

const get = (url) => fetch(url, { redirect: "manual" });
const postForm = (url, fields, headers = {}) =>
  fetch(url, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers },
    body: new URLSearchParams(fields).toString(),
  });

for (const base of urls) {
  console.log(`\n${base}`);
  const origin = new URL(base).origin;

  // Monitoring endpoint.
  const health = await get(`${base}/health/`);
  const healthText = await health.text();
  check(health.status === 200 && /<body>Tripeak OK<\/body>/.test(healthText), "/health/ returns 200 with 'Tripeak OK'", `status ${health.status}`);
  check(health.headers.get("cache-control") === "no-store", "/health/ Cache-Control: no-store", health.headers.get("cache-control"));
  check(/\bnoindex\b/.test(health.headers.get("x-robots-tag") || ""), "/health/ X-Robots-Tag noindex", health.headers.get("x-robots-tag"));

  // Hidden form definition must not be readable on any URL variant.
  for (const path of ["/__forms.html", "/__forms", "/__forms.html?x=1", "/__FORMS.HTML", "/__forms.html/"]) {
    const res = await get(`${base}${path}`);
    const text = await res.text();
    check(res.status === 404 && !/data-netlify/.test(text), `${path} is not readable`, `status ${res.status}`);
  }

  // Security headers on a normal page.
  const home = await get(`${base}/`);
  await home.text();
  check(home.headers.get("content-security-policy") === expectedCsp, "CSP matches netlify.toml");
  check(/max-age=\d+/.test(home.headers.get("strict-transport-security") || ""), "HSTS present");
  check(home.headers.get("x-content-type-options") === "nosniff", "X-Content-Type-Options: nosniff");
  check(home.headers.get("x-frame-options") === "DENY", "X-Frame-Options: DENY");

  // Indexing per context.
  const robots = await (await get(`${base}/robots.txt`)).text();
  if (production) {
    check(/Allow: \//.test(robots), "robots.txt allows crawling (production)");
    check(!/noindex/.test(home.headers.get("x-robots-tag") || ""), "homepage has no X-Robots-Tag noindex (production)");
  } else {
    check(/Disallow: \//.test(robots), "robots.txt disallows crawling (non-production)");
    check(/noindex/.test(home.headers.get("x-robots-tag") || ""), "X-Robots-Tag noindex on homepage (non-production)");
  }

  // Contact function: blank / whitespace / spoofed submissions are rejected server-side.
  for (const [label, fields] of [
    ["empty body", {}],
    ["blank fields", { name: "", email: "", message: "" }],
    ["whitespace fields", { name: "   ", email: "verify@example.org", message: "      " }],
  ]) {
    const res = await postForm(`${base}/api/contact`, fields, { Origin: origin });
    check(res.status === 303 && res.headers.get("location") === "/form-error/", `/api/contact rejects ${label}`, `status ${res.status} → ${res.headers.get("location")}`);
  }
  const getFn = await get(`${base}/api/contact`);
  check(getFn.status === 404 || getFn.status === 405, "/api/contact rejects GET", `status ${getFn.status}`);

  // Direct-to-Netlify-Forms bypass attempts with public/guessable form names.
  // Status codes are informative only; whether anything was STORED must be checked in the UI.
  for (const name of ["contact", "Contact"]) {
    const res = await postForm(`${base}/`, { "form-name": name, name: "", email: "", message: "" });
    console.log(`  INFO    direct POST form-name=${name} to / → HTTP ${res.status}`);
  }
  manual("In Netlify → Forms: confirm no new (blank) submissions appeared, and that no form named 'contact' (or any other public name) is registered. Delete any stale public forms.");

  if (testRateLimit) {
    const statuses = [];
    const started = Date.now();
    while (Date.now() - started < 25000 && !statuses.includes(429)) {
      const res = await postForm(`${base}/api/contact`, {}, { Origin: origin });
      statuses.push(res.status);
      if (statuses.length > 5) await new Promise((r) => setTimeout(r, 1500));
    }
    check(statuses.includes(429), "rate limit returns 429 after repeated POSTs to /api/contact", `statuses ${statuses.join(",")}`);
  } else {
    manual("Rate limit not tested (re-run with --rate-limit; blocks your IP on this site for up to 3 minutes). Also check the deploy log's post-processing stage lists the /api/contact rule.");
  }
}

manual("Send one real submission from the site; confirm it appears in Forms, /thanks/ is shown, and the notification email arrives.");
console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll automated checks passed (see MANUAL items).");
process.exit(failures ? 1 : 0);
