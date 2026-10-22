// Builds the site under different deploy contexts and checks indexing,
// canonical URLs, sitemap and secrets/placeholder leakage.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { LIMITS } from "../../netlify/functions/contact.mjs";

const ELEVENTY = path.resolve("node_modules/@11ty/eleventy/cmd.cjs");
const PROD_URL = "https://tripeak.test"; // reserved .test TLD; never published
const FORM_NAME = "test-secret-form-0123456789"; // stands in for the Netlify env var

// Production builds require CONTACT_FORM_NAME; tests supply a fake one unless
// the caller sets it explicitly (including to undefined).
function build(env) {
  const out = mkdtempSync(path.join(tmpdir(), "tripeak-build-"));
  const cleanEnv = { ...process.env };
  delete cleanEnv.CONTEXT;
  delete cleanEnv.SITE_URL;
  delete cleanEnv.CONTACT_FORM_NAME;
  const defaults = env.CONTEXT === "production" && !("CONTACT_FORM_NAME" in env) ? { CONTACT_FORM_NAME: FORM_NAME } : {};
  const finalEnv = { ...cleanEnv, ...defaults, ...env };
  for (const key of Object.keys(finalEnv)) if (finalEnv[key] === undefined) delete finalEnv[key];
  execFileSync(process.execPath, [ELEVENTY, `--output=${out}`, "--quiet"], {
    env: finalEnv,
    stdio: "pipe",
  });
  const read = (file) => readFileSync(path.join(out, file), "utf8");
  return { out, read, has: (file) => existsSync(path.join(out, file)) };
}

test("local/preview builds are not indexable and contain no absolute production URLs", (t) => {
  const site = build({ CONTEXT: "deploy-preview" });
  t.after(() => rmSync(site.out, { recursive: true, force: true }));

  for (const file of ["index.html", "about/index.html", "portfolio/index.html", "services/index.html", "thanks/index.html", "404.html"]) {
    const html = site.read(file);
    assert.match(html, /<meta name="robots" content="noindex, nofollow">/, file);
    assert.doesNotMatch(html, /rel="canonical"/, file);
  }
  assert.equal(site.read("robots.txt"), "User-agent: *\nDisallow: /\n");
  assert.match(site.read("_headers"), /X-Robots-Tag: noindex/);
  assert.equal(site.has("sitemap.xml"), false);
});

test("production build with SITE_URL is indexable with canonical URLs and sitemap", (t) => {
  const site = build({ CONTEXT: "production", SITE_URL: `${PROD_URL}/` });
  t.after(() => rmSync(site.out, { recursive: true, force: true }));

  const home = site.read("index.html");
  assert.doesNotMatch(home, /name="robots"/);
  assert.match(home, new RegExp(`<link rel="canonical" href="${PROD_URL}/">`));
  assert.match(home, /"@type":"Organization"/);

  // Placeholder pages and utility pages: noindex and excluded from the sitemap.
  const notIndexed = ["portfolio", "services", "thanks", "form-error", "form-unconfirmed", "health"];
  for (const name of notIndexed) {
    assert.match(site.read(`${name}/index.html`), /name="robots" content="noindex/, name);
  }
  assert.match(site.read("404.html"), /name="robots" content="noindex/);

  const sitemap = site.read("sitemap.xml");
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs.sort(), [`${PROD_URL}/`, `${PROD_URL}/about/`], "only Home and About are ready for indexing");
  assert.doesNotMatch(site.read("about/index.html"), /name="robots"/);
  assert.match(site.read("about/index.html"), new RegExp(`<link rel="canonical" href="${PROD_URL}/about/">`));

  assert.equal(site.read("robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${PROD_URL}/sitemap.xml\n`);
  assert.equal(site.has("_headers"), false);
});

test("generated output has no inline styles/scripts (CSP) and no placeholder domains", (t) => {
  const site = build({ CONTEXT: "production", SITE_URL: PROD_URL });
  t.after(() => rmSync(site.out, { recursive: true, force: true }));

  const htmlFiles = ["index.html", "about/index.html", "portfolio/index.html", "services/index.html", "thanks/index.html", "404.html"];
  for (const file of htmlFiles) {
    const html = site.read(file);
    assert.doesNotMatch(html, /\sstyle=/, `${file}: inline style attribute`);
    assert.doesNotMatch(html, /<style/, `${file}: inline <style>`);
    for (const [, attrs, body] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
      const isData = /type="application\/ld\+json"/.test(attrs);
      assert.ok(isData || (/\ssrc="\/assets\//.test(attrs) && !body.trim()), `${file}: inline script`);
    }
    assert.doesNotMatch(html, /example\.com|your-cloud-name|lorem ipsum/i, file);
    assert.doesNotMatch(html, /href="#"|href=""/, `${file}: empty link`);
  }

  // Hero image: eager, high priority, with dimensions; CSS/JS are content-hashed.
  const home = site.read("index.html");
  const hero = home.match(/<picture>[\s\S]*?(<img[^>]+>)/)[1];
  assert.match(hero, /loading="eager"/);
  assert.match(hero, /fetchpriority="high"/);
  assert.match(hero, /width="\d+" height="\d+"/);
  const heroFile = hero.match(/src="([^"]+)"/)[1];
  assert.ok(site.has(heroFile.slice(1)), `hero image written to the output directory: ${heroFile}`);
  assert.match(home, /href="\/assets\/css\/main\.[0-9a-f]{10}\.css"/);
  assert.match(home, /src="\/assets\/js\/site\.[0-9a-f]{10}\.js"/);

  const cssFiles = readdirSync(path.join(site.out, "assets/css"));
  assert.equal(cssFiles.length, 1);
});

test("/health/ is a standalone, noindex page excluded from the sitemap", (t) => {
  const site = build({ CONTEXT: "production", SITE_URL: PROD_URL });
  t.after(() => rmSync(site.out, { recursive: true, force: true }));

  const html = site.read("health/index.html");
  assert.match(html, /<body>Tripeak OK<\/body>/);
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  // Independent of the layout and all assets; nothing about versions or environment.
  assert.doesNotMatch(html, /<link|<script|<img|<style|\sstyle=|\/assets\/|\/fonts\//);
  assert.doesNotMatch(html, /eleventy|tailwind|node|production|tripeak\.test|version/i);
  assert.doesNotMatch(site.read("sitemap.xml"), /health/);
  for (const file of ["index.html", "about/index.html", "404.html"]) {
    assert.doesNotMatch(site.read(file), /href="\/health/, `${file} links to /health/`);
  }
});

test("public contact form posts to the validating function and is not a Netlify form", (t) => {
  const site = build({ CONTEXT: "production", SITE_URL: PROD_URL });
  t.after(() => rmSync(site.out, { recursive: true, force: true }));

  const home = site.read("index.html");
  const forms = [...home.matchAll(/<form [^>]*>/g)].map((m) => m[0]);
  assert.equal(forms.length, 1, "exactly one form on the homepage");
  assert.match(forms[0], /method="POST"/);
  assert.match(forms[0], /action="\/api\/contact"/);
  // If the public form were registered with Netlify, anyone could POST to it directly
  // and skip server-side validation.
  assert.doesNotMatch(forms[0], /data-netlify|netlify-honeypot|\snetlify[\s>]/);
  assert.doesNotMatch(home, /name="form-name"/);

  // Browser limits match the server's, so valid browser input is never rejected.
  for (const [field, { min, max }] of Object.entries(LIMITS)) {
    const tag = home.match(new RegExp(`<(?:input|textarea)[^>]*name="${field}"[^>]*>`))[0];
    assert.match(tag, /\srequired[\s>]/, `${field} required`);
    assert.match(tag, new RegExp(`minlength="${min}"`), `${field} minlength`);
    assert.match(tag, new RegExp(`maxlength="${max}"`), `${field} maxlength`);
  }
  assert.ok(home.includes('name="bot-field"'), "honeypot present");
  assert.doesNotMatch(home, /type="file"|enctype=/);
  assert.ok(site.has("thanks/index.html"));
  assert.ok(site.has("form-error/index.html"));
  assert.match(site.read("form-error/index.html"), /name="robots" content="noindex/);
  assert.doesNotMatch(site.read("sitemap.xml"), /form-error|thanks|__forms/);
});

test("hidden Netlify form uses the secret name, which appears nowhere else", (t) => {
  const site = build({ CONTEXT: "production", SITE_URL: PROD_URL });
  t.after(() => rmSync(site.out, { recursive: true, force: true }));

  const stub = site.read("__forms.html");
  assert.match(stub, new RegExp(`<form name="${FORM_NAME}" data-netlify="true" hidden>`));
  const fields = [...stub.matchAll(/name="([^"]+)"/g)].map((m) => m[1]).filter((n) => n !== FORM_NAME && n !== "robots");
  assert.deepEqual(fields, ["name", "email", "message"]);

  const leaks = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (!file.endsWith("__forms.html") && /\.(html|css|js|txt|xml|svg|json)$|_headers$/.test(file) && readFileSync(file, "utf8").includes(FORM_NAME)) leaks.push(file);
    }
  };
  walk(site.out);
  assert.deepEqual(leaks, [], "secret form name leaked into public files");

  // Direct requests for the stub are blocked (forced 404) on Netlify.
  assert.match(readFileSync("netlify.toml", "utf8"), /from = "\/__forms\.html"\s+to = "\/404\.html"\s+status = 404\s+force = true/);
});

test("without CONTACT_FORM_NAME: no stub locally, and production builds fail", (t) => {
  const local = build({ CONTEXT: "deploy-preview" });
  t.after(() => rmSync(local.out, { recursive: true, force: true }));
  assert.equal(local.has("__forms.html"), false);

  assert.throws(() => build({ CONTEXT: "production", SITE_URL: PROD_URL, CONTACT_FORM_NAME: undefined }), /Command failed/);
  assert.throws(() => build({ CONTEXT: "production", SITE_URL: PROD_URL, CONTACT_FORM_NAME: "Bad Name" }), /Command failed/);
});

test("header and footer use recoloured copies of the supplied complete logo", (t) => {
  const site = build({ CONTEXT: "deploy-preview" });
  t.after(() => rmSync(site.out, { recursive: true, force: true }));

  const home = site.read("index.html");
  const logos = [...home.matchAll(/<img class="w-auto[^"]*" src="(\/assets\/img\/logo-(onLight|onDark)\.[0-9a-f]{10}\.svg)" width="471" height="330" alt="Tripeak Digital — Home">/g)];
  assert.deepEqual(logos.map((m) => m[2]), ["onLight", "onDark"]);

  const expectedFill = { onLight: "#0B1F3A", onDark: "#F5F3EE" };
  for (const [, src, variant] of logos) {
    const svg = site.read(src.slice(1));
    assert.match(svg, new RegExp(`<svg width="471" height="330" fill="${expectedFill[variant]}"`));
    // Wordmark is live text in Cambria (not web-licensed) — documented limitation.
    assert.match(svg, /<text [^>]*font-family="'Cambria', serif"/);
    assert.doesNotMatch(svg, /\sstyle=/, "inline style would be blocked by the CSP");
  }

  // The About page publishes the profile photo with approved alt text.
  assert.match(site.read("about/index.html"), /<img [^>]*alt="Keith Omand, founder of Tripeak Digital"/);
});
