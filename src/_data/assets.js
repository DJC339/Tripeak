// Builds the stylesheet (Tailwind via PostCSS), site script and logo variants,
// and gives each a content-hashed URL so netlify.toml can cache /assets/* as
// immutable. Output files are written by src/pages/assets.11ty.js.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";

const CSS_SOURCE = "src/assets/css/tailwind.css";
const JS_SOURCE = "src/assets/js/site.js";

// Supplied complete logo (black). Recoloured copies are generated per background;
// the source file is left untouched.
const LOGO_SOURCE = "src/assets/images/Logo Version Black.svg";
const LOGO_VARIANTS = {
  onLight: "#0B1F3A", // navy on the off-white header, as in the mock-up
  onDark: "#F5F3EE", // off-white on the navy footer
};

// SVG style properties that have an equivalent presentation attribute.
const PRESENTATION_ATTRIBUTES = new Set([
  "fill-rule", "clip-rule", "fill-opacity", "stroke-linejoin", "stroke-miterlimit", "font-family", "font-size",
]);

const hash = (content) => createHash("sha256").update(content).digest("hex").slice(0, 10);

// Recolours the logo and converts inline style="" to presentation attributes so the
// site's CSP (style-src 'self', also sent with the SVG) cannot strip them.
function buildLogo(source, fill) {
  const [, width, height] = source.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const svg = source
    .replace(/<\?xml[^>]*>\s*|<!DOCTYPE[^>]*>\s*/g, "")
    .replace(/ style="([^"]*)"/g, (_, style) =>
      style
        .split(";")
        .filter(Boolean)
        .map((declaration) => {
          const [property, value] = declaration.split(":").map((part) => part.trim());
          if (!PRESENTATION_ATTRIBUTES.has(property)) {
            throw new Error(`[assets] Unsupported style "${property}" in ${LOGO_SOURCE}`);
          }
          return ` ${property}="${value.replace(/"/g, "'")}"`;
        })
        .join("")
    )
    .replace(/<svg width="100%" height="100%"/, `<svg width="${width}" height="${height}" fill="${fill}"`);
  return { svg, width: Number(width), height: Number(height) };
}

export default async function () {
  const minify = process.env.ELEVENTY_RUN_MODE === "build";
  const cssSource = await readFile(CSS_SOURCE, "utf8");
  const { css } = await postcss([tailwindcss({ optimize: minify ? { minify: true } : false })])
    .process(cssSource, { from: CSS_SOURCE });
  const js = await readFile(JS_SOURCE, "utf8");
  const logoSource = await readFile(LOGO_SOURCE, "utf8");

  const files = {
    css: { href: `/assets/css/main.${hash(css)}.css`, code: css },
    js: { href: `/assets/js/site.${hash(js)}.js`, code: js },
  };

  const logo = {};
  for (const [variant, fill] of Object.entries(LOGO_VARIANTS)) {
    const { svg, width, height } = buildLogo(logoSource, fill);
    const file = { href: `/assets/img/logo-${variant}.${hash(svg)}.svg`, code: svg };
    logo[variant] = { href: file.href, width, height };
    files[`logo-${variant}`] = file;
  }

  return { ...files, logo, files: Object.values(files) };
}
