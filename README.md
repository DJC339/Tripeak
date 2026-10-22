# Tripeak Digital website

Static marketing site for Tripeak Digital, built with Eleventy 3 and Tailwind CSS 4.
The architecture follows the [11ty modular template](https://github.com/DJC339/11ty-MODULAR-TEMPLATE),
modernised for this project.

## Scope and status

Four information pages, per the website proposal. Contact is a homepage section with a
form, not a separate page. There is no blog.

| Page | URL | Status |
| --- | --- | --- |
| Home | `/` | Built from Keith's mock-up. Selected-work preview is a placeholder. Contact form included. |
| Services | `/services/` | Layout built; offerings, process and engagement options are **placeholders**. |
| Portfolio | `/portfolio/` | Reusable project layout built; **no projects yet** (placeholder example card). |
| About | `/about/` | Built from Keith's About mock-up. Final copy; indexable. |

Utility routes (not information pages): `/thanks/`, `/form-error/` and `/form-unconfirmed/` (form outcomes), `/404.html`, `/health/`, plus the form endpoint `/api/contact`.

- **Implemented:** pages, navigation, layout, design system, contact form markup,
  security headers, indexing rules and tests. See [`docs/HANDOFF.md`](docs/HANDOFF.md#implemented).
- **Placeholder content awaiting Keith:** every block labelled "Placeholder — content
  awaiting Keith". See [the list](docs/HANDOFF.md#placeholder-content-awaiting-keith).
- **Awaiting deployment:** `CONTACT_FORM_NAME`, Netlify form detection, notification
  emails, real delivery and bypass tests, and live headers. Local tests do **not** prove form delivery.
  See [the checklist](docs/HANDOFF.md#hosting-configuration-and-checks-awaiting-deployment).
- **Remaining launch tasks:** see [`docs/HANDOFF.md`](docs/HANDOFF.md#remaining-launch-tasks).

## Quick start

Requires Node.js 24 (Active LTS; see `.nvmrc`).

```sh
npm ci                 # install exact locked dependencies
npm run dev            # dev server with live reload at http://localhost:8080
npm run build          # production build into _site/
```

Tests (run after `npm run build`; the test server uses port 8181, so it can run alongside `npm run dev`):

```sh
npm run test:install   # one-time: download Playwright's Chromium
npm test               # build-metadata tests + browser tests
```

## Where to edit content

| What | File |
| --- | --- |
| Business name, email, location, tagline, descriptions, CTA destinations | `src/_data/site.js` |
| Header/footer navigation | `src/_data/navigation.js` |
| Homepage copy (hero, selected work) | `src/pages/index.html` |
| Capability cards (Home + Services) | `src/_data/capabilities.js` |
| Portfolio projects (Portfolio + homepage "Selected Work") | `src/_data/projects.js` (entry format documented in the file) |
| Services / Portfolio / About pages | `src/pages/services.html`, `portfolio.html`, `about.html` |
| Contact section and form | `src/_includes/components/contact-section.html`; validation in `netlify/functions/contact.mjs` |
| Form outcome pages, 404 | `src/pages/thanks.html`, `form-error.html`, `form-unconfirmed.html`, `404.html` |

**Placeholder pages.** Services and Portfolio have `placeholder: true` in their
front matter. While it is set, the page shows a "Draft page" label, is `noindex`, and is
left out of the sitemap. Replace every "Placeholder — content awaiting Keith" block with
approved copy, then delete `placeholder: true`.
| Colours, fonts, type scale, components | `src/assets/css/tailwind.css` (`@theme` block) |
| Header, footer, linked logo, `<head>` | `src/_includes/components/` |
| Logo source and colour variants | `src/assets/images/Logo Version Black.svg`; variants defined in `src/_data/assets.js` |
| Images (source files) | `src/assets/images/`, used via `{% image "file.jpg", "Alt text" %}` |

## Project structure

```text
eleventy.config.js        Eleventy config: font copying, image shortcode, filters
netlify.toml              Build, security headers, caching, redirects
netlify/functions/        contact.mjs: server-side contact form validation (/api/contact)
playwright.config.js      Browser tests (serves _site with netlify.toml headers)
scripts/serve.mjs         Tiny static server used by the tests (runs the contact function)
scripts/verify-deploy.mjs Hosted checks against deployed URLs (npm run verify:deploy)
src/
  _data/site.js           Central site data + deploy-aware SEO flags
  _data/navigation.js     Navigation links
  _data/capabilities.js   Capability cards
  _data/projects.js       Portfolio entries (empty until approved)
  _data/assets.js         Builds Tailwind CSS + site JS with content-hashed URLs
  _includes/layouts/      base.html; page.html (inner pages: title band + content)
  _includes/components/   head, header, footer, brand (linked logo), contact-section,
                          ui macros (buttons, capability/project cards, placeholder notes)
  assets/css/tailwind.css Tailwind source + design tokens
  assets/js/site.js       Mobile navigation (progressive enhancement)
  assets/images/          Source images: hero, supplied logos, profile pictures
  assets/icons/           Favicon sources
  pages/                  index, services, portfolio, about, thanks, form-error, 404, health,
                          forms-stub (hidden Netlify form),
                          robots.txt, sitemap.xml, _headers, asset writer
tests/build/              node:test: generated metadata per deploy context; contact function
tests/e2e/                Playwright: layout, links, navigation, CTAs, form, keyboard,
                          mobile nav, axe, contrast, logos, /health/
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
| Local, deploy preview, branch deploy | `noindex` on every page | `Disallow: /` | `noindex` (via generated `_headers`) | omitted |
| Netlify production (`CONTEXT=production`) | only on placeholder and utility pages | `Allow: /` | only `/health/` | only when `SITE_URL` is set; lists finished pages only |

In production, pages with `placeholder: true` (currently Services and Portfolio),
`/thanks/`, `/form-error/`, `/form-unconfirmed/`, `/404.html` and `/health/` stay `noindex` and out of the sitemap. Today the
sitemap lists Home and About.

Before launch, set `SITE_URL` (for example `https://www.example.ca`, with the real
domain) as a Netlify environment variable scoped to **Production**. Without it,
production pages can be indexed but have no canonical URLs or sitemap, and the build logs a warning.

## Contact form (validated, then stored by Netlify Forms)

The homepage `#contact` form (name, email, message; no JavaScript) posts to a
Netlify Function, **`/api/contact`** (`netlify/functions/contact.mjs`). The function
re-checks every field on the server before anything is stored:

- Trims and normalises each field; rejects blank, whitespace-only or invisible-character
  input, and requires at least one letter or digit in the name and message.
- Length limits: name 2–100, email 3–254, message 5–5000 characters. The browser's
  `minlength`/`maxlength` match these `LIMITS`.
- Rejects invalid emails, line breaks in name/email, control characters and repeated
  fields. Requests must be URL-encoded, at most 16 KB, POST only, and not from another
  site's `Origin`.
- Honeypot (`bot-field`) hits are dropped silently: the bot sees the success page.
- Forwards **only** name, email and message to Netlify Forms, at Netlify's trusted `URL`.
  Client-supplied `form-name` or extra fields are ignored.
- **Rate limited** by Netlify (code-based rule in the function's `config`, available on all
  plans): 5 requests per 180 s per visitor IP. Over-limit requests get `429` and never
  reach the function. Netlify enforces this, so it is only verifiable on a deploy.
- Redirects to a static, `noindex` outcome page. User input is never echoed back.
  - `/thanks/`: forwarded and accepted (honeypot hits also land here).
  - `/form-error/`: definitely not stored (rejected input, missing or invalid config, or a
    4xx from Netlify).
  - `/form-unconfirmed/`: the forward was sent but the result is unknown (8 s timeout,
    network error or 5xx). **Netlify may still have stored it.** The function makes exactly
    one attempt and never retries, to avoid duplicates. The page asks the visitor not to
    resend and to email instead.
- Logs the outcome only, never names, emails or messages.

**Why the form name is a secret.** Netlify accepts a submission POSTed to *any* path if
its `form-name` matches a registered form, without enforcing `required` fields. If the
public form were registered, anyone could skip the function and submit blank data
directly. So:
- The public form has no `data-netlify` attribute and is not registered.
- The Netlify form that stores submissions is defined in a hidden page,
  `/__forms.html` (`src/pages/forms-stub.11ty.js`). It is generated at build time with
  the name from the **`CONTACT_FORM_NAME`** environment variable, which is never in this
  public repo.
- `netlify.toml` force-404s `/__forms.html`, so the name can't be read from the live site.
- Production builds fail if `CONTACT_FORM_NAME` is missing or invalid.

**Setting `CONTACT_FORM_NAME`:** in the Netlify UI, add an environment variable with a
random value of 16–64 lowercase letters, digits or hyphens (e.g. the output of
`openssl rand -hex 16`). Make it available to **all deploy contexts**, with **Builds**
and **Functions** scopes. Changing it registers a new form in Netlify on the next deploy.
Previews forward to the production site's `URL`, so preview form tests need the
production deploy to have the same form registered.

**Pending until deployed** (not verifiable locally). The full checklist is in
[`docs/HANDOFF.md`](docs/HANDOFF.md#hosting-configuration-and-checks-awaiting-deployment).
`npm run verify:deploy -- <url> [<url>…]` automates the observable parts: `/health/`,
`/__forms.html` blocked, headers, indexing, blank-POST rejection and, with
`--rate-limit`, the 429.
1. Set `CONTACT_FORM_NAME`, enable form detection (*Forms* → enable), and deploy. Confirm
   the secret-named form appears under *Forms*.
2. Run the script against **production, the deploy preview and the deploy-specific URL**
   (`https://<deploy-id>--<site>.netlify.app`). `/__forms.html` must be 404 on all of them.
3. Check *Forms* for any previously registered public form (e.g. `contact`). Delete it and
   confirm direct POSTs with that name store nothing.
4. Confirm the rate-limit rule appears in the deploy log's post-processing stage, and that
   `--rate-limit` sees a `429`.
5. Configure email notifications (*Site configuration* → *Notifications* → form
   submission notification to the agreed address). Send one real submission and confirm
   it is stored, `/thanks/` is shown, and the email arrives (spam folder, sender).
6. Check function logs show outcomes without personal data, and check the plan's
   form-submission and function limits.

Local tests run the real function (unit tests in `tests/build/contact-function.test.mjs`,
plus browser tests through `scripts/serve.mjs`), with the forward to Netlify Forms
captured locally. They prove what the function accepts, rejects and sends. They do
**not** prove Netlify's form detection, rate limiting, spam filtering, storage or email
delivery.

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
- `scripts/serve.mjs` (used by the tests, port 8181) applies every matching rule from
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
