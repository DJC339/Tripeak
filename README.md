# Tripeak Digital website

Static marketing site for Tripeak Digital, built with Eleventy 3 and Tailwind CSS 4.
This is the initial strawman: homepage plus a placeholder About page. The
architecture follows the [11ty modular template](https://github.com/DJC339/11ty-MODULAR-TEMPLATE),
modernised for this project.

## Quick start

Requires Node.js 24 (Active LTS; see `.nvmrc`).

```sh
npm ci                 # install exact locked dependencies
npm run dev            # dev server with live reload at http://localhost:8080
npm run build          # production build into _site/
```

Tests (run after `npm run build`):

```sh
npm run test:install   # one-time: download Playwright's Chromium
npm test               # build-metadata tests + browser tests
```

## Where to edit content

| What | File |
| --- | --- |
| Business name, email, location, tagline, descriptions, CTA destinations | `src/_data/site.js` |
| Header/footer navigation | `src/_data/navigation.js` |
| Homepage copy (hero, capability cards) | `src/pages/index.html` (cards are in the front matter) |
| About page | `src/pages/about.html` (remove `placeholder: true` once the real copy is in) |
| 404 page | `src/pages/404.html` |
| Colours, fonts, type scale, components | `src/assets/css/tailwind.css` (`@theme` block) |
| Header, footer, linked logo, `<head>` | `src/_includes/components/` |
| Logo source and colour variants | `src/assets/images/Logo Version Black.svg`; variants defined in `src/_data/assets.js` |
| Images (source files) | `src/assets/images/`, used via `{% image "file.jpg", "Alt text" %}` |

## Project structure

```text
eleventy.config.js        Eleventy config: font copying, image shortcode, filters
netlify.toml              Build, security headers, caching
playwright.config.js      Browser tests (serves _site with netlify.toml headers)
scripts/serve.mjs         Tiny static server used by the tests
src/
  _data/site.js           Central site data + deploy-aware SEO flags
  _data/navigation.js     Navigation links
  _data/assets.js         Builds Tailwind CSS + site JS with content-hashed URLs
  _includes/layouts/      base.html
  _includes/components/   head, header, footer, brand (linked logo), ui macros
  assets/css/tailwind.css Tailwind source + design tokens
  assets/js/site.js       Mobile navigation (progressive enhancement)
  assets/images/          Source images: hero, supplied logos, profile pictures
  assets/icons/           Favicon sources
  pages/                  index, about, 404, health, robots.txt, sitemap.xml, _headers, asset writer
tests/build/              node:test checks of generated metadata per deploy context
tests/e2e/                Playwright: layout, links, keyboard, mobile nav, axe, contrast
```

## How the build works

- **CSS** is compiled by `@tailwindcss/postcss` inside Eleventy (`src/_data/assets.js`)
  and written to `/assets/css/main.<hash>.css`. There is no separate CSS process,
  and template changes in dev mode regenerate the CSS.
- **JS** is one small file (`site.js`), also content-hashed.
- **Images** go through `@11ty/eleventy-img` → AVIF/WebP/JPEG at several widths,
  hashed filenames, with `width`/`height` attributes. The hero is eager and `fetchpriority="high"`.
- **Logo**: the supplied complete logo (`Logo Version Black.svg`) is recoloured at build
  time into a navy copy (header) and an off-white copy (footer), with content-hashed names.
  The source file is never modified. Its wordmark is live SVG text in Cambria; see
  `docs/HANDOFF.md` for that limitation.
- **Fonts** (Lora 600/700, Roboto 400/500/700, Latin subset) are self-hosted from
  `@fontsource` packages under `/fonts/`, with their OFL licence files.

## Indexing and deploy contexts

| Build | robots meta | robots.txt | X-Robots-Tag | canonical / sitemap |
| --- | --- | --- | --- | --- |
| Local, deploy preview, branch deploy | `noindex` | `Disallow: /` | `noindex` (via generated `_headers`) | omitted |
| Netlify production (`CONTEXT=production`) | none | `Allow: /` | none | only when `SITE_URL` is set |

Before launch, set `SITE_URL` (for example `https://www.example.ca`, with the real
domain) as a Netlify environment variable scoped to **Production**. Without it,
production pages can be indexed but have no canonical URLs or sitemap, and the build logs a warning.

## Monitoring

Point an uptime monitor at **`/health/`** (with the trailing slash; `/health` redirects to it).

Expected response:

- Status `200`, `Content-Type: text/html`
- Body contains exactly the visible text `Tripeak OK` (match on that string)
- Headers: `Cache-Control: no-store` and `X-Robots-Tag: noindex`

The page (`src/pages/health.html`) is standalone, with no layout, CSS, JS, fonts or images.
It is excluded from the sitemap and navigation and reveals no versions or environment
details. It only confirms the deployed static site is reachable and serving files.
It does **not** check email delivery, forms or any other functionality.

## Deployment (prepared, not deployed)

`netlify.toml` builds with `npm run build` on Node 24 and publishes `_site`.

Hosting assumptions:
- Security headers (CSP, HSTS, framing, etc.) and caching are defined for Netlify.
  Another host would need the same headers configured.
- The CSP allows only same-origin scripts, styles, fonts and images, with no
  `unsafe-inline` or `unsafe-eval`. Adding a booking widget, analytics or embeds
  will need deliberate CSP changes.
- HSTS is `max-age=31536000` without `includeSubDomains`/`preload`; widen it only
  once every subdomain of the final domain is confirmed HTTPS-only.
- Caching: `/assets/*` (hashed) is immutable for 1 year; `/fonts/*` 30 days;
  favicons 1 day; `/health/` `no-store`; HTML uses Netlify's default revalidation.
- `scripts/serve.mjs` (used by the tests) applies every matching rule from
  `netlify.toml` and the generated `_headers`, joining duplicate headers. This approximates
  Netlify's behaviour; confirm the real response headers on the first deploy preview.

## Dependency decisions (October 2026)

| Package | Version | Notes |
| --- | --- | --- |
| Node.js | 24 LTS | Active LTS (maintenance from 2026‑10‑20, EOL 2028‑04‑30). Consistent in `.nvmrc`, `engines`, CI and Netlify. Node 26 becomes LTS on 2026‑10‑28; worth moving to it once it does. |
| @11ty/eleventy | 3.1.7 | Upgraded from 2.x; ESM config (`eleventy.config.js`). |
| @11ty/eleventy-img | 7.0.0 | Requires Node ≥ 22. |
| tailwindcss + @tailwindcss/postcss | 4.3.3 | Upgraded from 3.4: CSS-first `@theme` config, no `tailwind.config.js`, no Autoprefixer. Browser baseline: Safari 16.4+, Chrome 111+, Firefox 128+. |
| postcss | 8.5.31 | Runs Tailwind inside Eleventy. |
| @fontsource/lora, @fontsource/roboto | 5.3.0 | Self-hosted OFL fonts. |
| @playwright/test, @axe-core/playwright | 1.64.1, 4.14.0 | Tests only. |

Removed from the template: blog, collections, feeds, post layout, date filters,
Cloudinary, the typography plugin, Autoprefixer, `concurrently`, and the Twitter
handle and placeholder `example.com` metadata. (The template's health page was
replaced by the standalone `/health/` endpoint above.)

`@tailwindcss/cli` was deliberately not used. Its watch dependency chain
(`@parcel/watcher → micromatch → braces`) carries a high-severity advisory
(GHSA-vfj7-8cjw-p6xm) with no non-breaking fix. Running Tailwind through PostCSS
inside Eleventy avoids that chain entirely; `npm audit` reports 0 vulnerabilities.

## Design notes, assets and open decisions

See [`docs/HANDOFF.md`](docs/HANDOFF.md).
