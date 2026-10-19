// Builds the site under different deploy contexts and checks indexing,
// canonical URLs, sitemap and secrets/placeholder leakage.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ELEVENTY = path.resolve("node_modules/@11ty/eleventy/cmd.cjs");
const PROD_URL = "https://tripeak.test"; // reserved .test TLD; never published

function build(env) {
  const out = mkdtempSync(path.join(tmpdir(), "tripeak-build-"));
  const cleanEnv = { ...process.env };
  delete cleanEnv.CONTEXT;
  delete cleanEnv.SITE_URL;
  execFileSync(process.execPath, [ELEVENTY, `--output=${out}`, "--quiet"], {
    env: { ...cleanEnv, ...env },
    stdio: "pipe",
  });
  const read = (file) => readFileSync(path.join(out, file), "utf8");
  return { out, read, has: (file) => existsSync(path.join(out, file)) };
}

test("local/preview builds are not indexable and contain no absolute production URLs", (t) => {
  const site = build({ CONTEXT: "deploy-preview" });
  t.after(() => rmSync(site.out, { recursive: true, force: true }));

  for (const file of ["index.html", "about/index.html", "404.html"]) {
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

  // About is still placeholder content: noindex and excluded from the sitemap.
  assert.match(site.read("about/index.html"), /name="robots" content="noindex/);
  assert.match(site.read("404.html"), /name="robots" content="noindex/);

  const sitemap = site.read("sitemap.xml");
  assert.match(sitemap, new RegExp(`<loc>${PROD_URL}/</loc>`));
  assert.doesNotMatch(sitemap, /about|404/);

  assert.equal(site.read("robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${PROD_URL}/sitemap.xml\n`);
  assert.equal(site.has("_headers"), false);
});

test("generated output has no inline styles/scripts (CSP) and no placeholder domains", (t) => {
  const site = build({ CONTEXT: "production", SITE_URL: PROD_URL });
  t.after(() => rmSync(site.out, { recursive: true, force: true }));

  const htmlFiles = ["index.html", "about/index.html", "404.html"];
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

  // Profile pictures are kept as sources for the About page but not published yet.
  assert.equal(readdirSync(path.join(site.out, "assets/img")).some((f) => /profile/i.test(f)), false);
});
