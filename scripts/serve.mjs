// Minimal static server for testing the production build in _site.
// Mimics Netlify closely enough for tests: pretty URLs (with a trailing-slash
// redirect), /404.html for missing pages, and every matching header rule from
// netlify.toml plus the generated _site/_headers file.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve("_site");
const PORT = Number(process.env.PORT || 8080);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

// [[headers]] blocks from netlify.toml (simple `Key = "value"` lines).
function parseToml(toml) {
  return toml
    .split("[[headers]]")
    .slice(1)
    .map((block) => {
      const pattern = block.match(/for\s*=\s*"([^"]+)"/)?.[1];
      const values = [...block.matchAll(/^\s*([A-Za-z-]+)\s*=\s*"(.*)"\s*$/gm)]
        .filter(([, key]) => key !== "for")
        .map(([, key, value]) => [key, value]);
      return { pattern, values };
    });
}

// Netlify _headers format: a path line followed by indented `Key: value` lines.
function parseHeadersFile(text) {
  const rules = [];
  for (const line of text.split(/\r?\n/)) {
    if (/^\S/.test(line)) rules.push({ pattern: line.trim(), values: [] });
    else if (line.trim() && rules.length) {
      const [key, ...rest] = line.trim().split(":");
      rules.at(-1).values.push([key.trim(), rest.join(":").trim()]);
    }
  }
  return rules;
}

const matches = (pattern, urlPath) =>
  new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`).test(urlPath);

// Rules are re-read per request so a rebuild is picked up without a restart.
// When several matching rules set the same header, the values are joined, so a
// test asserting an exact value also proves no broader rule interferes.
async function headersFor(urlPath) {
  const rules = parseToml(await readFile("netlify.toml", "utf8"));
  try {
    rules.push(...parseHeadersFile(await readFile(path.join(ROOT, "_headers"), "utf8")));
  } catch {}

  const headers = {};
  for (const { pattern, values } of rules) {
    if (!pattern || !matches(pattern, urlPath)) continue;
    for (const [key, value] of values) headers[key] = headers[key] ? `${headers[key]}, ${value}` : value;
  }

  // HSTS and upgrade-insecure-requests would break plain-HTTP localhost.
  delete headers["Strict-Transport-Security"];
  if (headers["Content-Security-Policy"]) {
    headers["Content-Security-Policy"] = headers["Content-Security-Policy"].replace(/;\s*upgrade-insecure-requests/, "");
  }
  return headers;
}

async function isFile(file) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  const target = path.join(ROOT, decodeURIComponent(pathname));
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
    res.writeHead(400).end();
    return;
  }

  // Like Netlify: /about → 301 /about/ when /about/index.html exists.
  if (!pathname.endsWith("/") && !(await isFile(target)) && (await isFile(path.join(target, "index.html")))) {
    res.writeHead(301, { Location: `${pathname}/` }).end();
    return;
  }

  let file = (await isFile(target)) ? target : path.join(target, "index.html");
  let status = 200;
  if (!(await isFile(file))) {
    file = path.join(ROOT, "404.html");
    status = 404;
  }

  res.writeHead(status, {
    ...(await headersFor(pathname)),
    "Content-Type": TYPES[path.extname(file)] || "application/octet-stream",
  });
  res.end(await readFile(file));
}).listen(PORT, () => console.log(`Serving _site at http://localhost:${PORT}`));
