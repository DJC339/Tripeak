# Hand-off notes

## Scope

Per the website proposal, the site has four information pages: **Home, Services,
Portfolio and About**. Contact is a section with a form on the homepage (`/#contact`),
not a fifth page. There is no blog. Utility routes: `/thanks/`, `/form-error/` and
`/form-unconfirmed/` (form outcomes), `/404.html` and `/health/` (uptime monitoring), plus the form endpoint `/api/contact`.

The first strawman was limited to Home and About. This scope supersedes that restriction.

## Implemented

- **Pages:** Home and About (each built from its mock-up), Services and Portfolio (shared
  `layouts/page.html`: navy title band, then content), `/thanks/`, 404, `/health/`.
- **Navigation:** Home, About, Portfolio, Services in the header and footer, with
  `aria-current` on the current page. The header **Contact** button and the hero
  **Schedule a Technical Discovery** link go to `/#contact`, which works from any page.
- **Homepage:** hero and capability cards unchanged. **View All Our Services** → `/services/`.
  A **Selected Work** preview → `/portfolio/` (placeholder until projects exist). Contact section.
- **Contact form:** name, email and message, with labels, `autocomplete`, native required/
  length/email validation and a honeypot (`bot-field`). It posts to the **server-side
  validation function** `/api/contact` (`netlify/functions/contact.mjs`), which rejects
  blank, whitespace-only and malformed submissions, then forwards clean data to Netlify
  Forms under a secret form name. Outcome pages: `/thanks/`, `/form-error/` and `/form-unconfirmed/` (result unknown). Details and
  rationale are in the README ("Contact form"). The email address remains as an
  alternative in the contact section and footer. No booking embed, CRM, uploads or
  conditional fields.
- **Portfolio data model:** `src/_data/projects.js` (entry format documented in the file)
  feeds both the Portfolio grid and the homepage preview (`featured: true`, max 3).
  It is empty, so a labelled placeholder card shows instead.
- **Placeholder handling:** `placeholder: true` in front matter shows a "Draft page" label,
  adds `noindex`, and removes the page from the sitemap. Services and Portfolio
  use it today. `/thanks/`, `/form-error/`, `/form-unconfirmed/`, 404 and `/health/` are always `noindex` and never in the sitemap.
- **Unchanged from before:** design tokens, fonts, logo handling, build pipeline, CSP and
  security headers, caching, deploy-context indexing rules, `/health/`.
- **CSP:** no changes needed. The form posts same-origin to `/api/contact`
  (`form-action 'self'`), with no third-party scripts.
- **Tests:** `npm test`. Contact-function unit tests cover blank, whitespace, invisible-
  character, length, email, injection, duplicate-field, honeypot, size, content-type, origin,
  method, misconfiguration and forward-outcome cases (4xx vs uncertain, single attempt),
  rate-limit config, plus log privacy. Build checks cover
  indexing per context, the sitemap, the public form not being a Netlify form, limits
  matching the server, the secret form name not leaking, the production build failing
  without it, inline-code/CSP hygiene, `/health/` and logos. Browser checks cover every
  page at 320/375/768/1024/1440 px, axe scans of all pages (including the form) at
  375/1440 px, links and anchors, navigation order and active states, CTA destinations,
  mobile menu and keyboard, no-JS navigation, form validation and local submission,
  hero contrast, zoom/text spacing, `/health/` headers, and logos.

## Placeholder content awaiting Keith

Each item appears on the site as a block labelled **"Placeholder — content awaiting Keith"**.

| Page | Section | Needed |
| --- | --- | --- |
| Services | Power Platform & Automation Offerings | Each offering: name, audience, what is delivered, security/governance approach |
| Services | Our Process | Steps, and what the client provides and receives |
| Services | Engagement Options | Technical discovery (purpose, format, outputs); staged projects; any other models |
| Portfolio | Projects | Approved project examples or anonymized case summaries (title, sector, summary, challenge, solution, approved outcome, technologies) and written client approval. No fixed number required. |
| Home | Selected Work | Comes from Portfolio entries marked `featured: true` |

The capability cards, all homepage copy and the whole About page come from the mock-ups and are not placeholders.
No clients, results, metrics, testimonials or credentials have been invented.

When a page's content is approved: replace the placeholder blocks, delete
`placeholder: true`, and the page becomes indexable in production and joins the sitemap.

## Hosting configuration and checks awaiting deployment

Prepared locally in `netlify.toml`, `netlify/functions/contact.mjs` and the form markup.
**None of this has been verified on Netlify yet.** `npm run verify:deploy -- <url> [<url>…]`
automates the observable checks (see the script header). Run it against every URL that
serves the deploy: production, the deploy preview, and the deploy-specific permalink
(`https://<deploy-id>--<site>.netlify.app`). Add `--production` for the live site and
`--rate-limit` once per deploy to exercise the limiter. It never creates a stored
submission; anything it can't observe is printed as a MANUAL step.

Configuration
- [ ] **`CONTACT_FORM_NAME`:** set a random value (16–64 lowercase letters/digits/hyphens,
      e.g. `openssl rand -hex 16`) for all deploy contexts, with Builds + Functions scopes.
      Production builds fail without it.
- [ ] **Form detection:** enable it in the Netlify UI and deploy. Confirm the secret-named
      form appears under *Forms* with fields name, email and message only.
- [ ] **Email notifications:** add a form submission notification to the agreed address.

Secret form name and bypass
- [ ] `/__forms.html` (and `/__forms`, `?query`, case and trailing-slash variants) returns 404
      on **production, the deploy preview and the deploy-specific URL** (script).
- [ ] **Previously registered public forms:** check *Forms* for any form with a public or
      guessable name (e.g. `contact`) left from earlier deploys. Delete it, then confirm that a
      direct POST with that `form-name` to `/` stores nothing. Netlify's docs don't say whether
      a form removed from the HTML still accepts submissions, so treat this as unverified
      until checked. (Tripeak has never been deployed, so none are expected; the port to
      Northern Strike *will* have one.)
- [ ] Blank/whitespace POSTs to `/api/contact` return `303 → /form-error/` (script). Direct
      blank POSTs to `/` with `form-name=contact` store nothing (script sends; check *Forms*).

Rate limiting
- [ ] The deploy log's *post-processing* stage lists the `/api/contact` rate-limit rule
      (invalid rules don't fail the deploy, and some errors are silent).
- [ ] Repeated POSTs return `429` (`--rate-limit`). Enforcement can lag about 10 s.
- [ ] The rule appears on preview deploys too (code rules follow the branch).

Delivery
- [ ] **Test submission** from the site: appears in *Forms*, `/thanks/` is shown, and the
      notification email arrives (check spam folders and sender details).
- [ ] **Spam handling:** a submission with `bot-field` filled is dropped (shows `/thanks/`,
      nothing stored). Review Netlify's spam filter.
- [ ] **Function logs:** outcomes logged with no personal data.
- [ ] **Plan limits:** check the monthly form-submission and function allowances.
- [ ] **Uncertain outcomes:** can't be forced on a live site. If `/form-unconfirmed/` is ever
      reported, check *Forms* for the submission before asking the visitor to resend.

Headers and indexing
- [ ] Live CSP and security headers, `/assets/*` immutable caching, `/health/`
      `Cache-Control: no-store` and `X-Robots-Tag: noindex`, and preview-wide `X-Robots-Tag:
      noindex` (script). The local test server only approximates Netlify's header merging.
- [ ] Deploy preview `robots.txt` is `Disallow: /`. After launch, production allows indexing
      of finished pages only (script with `--production`).

Local tests run the real contact function (the forward to Netlify Forms is captured
locally). They prove what it accepts, rejects and sends. They do **not** prove Netlify form
detection, storage, rate limiting, spam filtering or email delivery.

## Security review (OWASP Top 10:2025)

Scope: a static site plus one Netlify Function (the contact form). No accounts, database,
cookies or sessions, and no third-party scripts. Reviewed October 2026.

Status labels:
- **Implemented locally — hosted verification pending:** the control depends on Netlify
  behaviour or configuration, which can only be confirmed on a deploy (checklist above).
- **Implemented and tested locally:** pure code or build behaviour, covered by `npm test`.

| Category | Status | Controls |
| --- | --- | --- |
| **A01 Broken Access Control** (incl. SSRF) | Implemented locally — hosted verification pending | No protected content or auth. Function is POST-only. The hidden form definition is force-404'd and its name is secret, so Netlify Forms can't be reached directly (404 on all deploy URLs and stale public forms: to verify). Forward target is Netlify's `URL` env var, never a request header (no SSRF; tested locally). |
| **A02 Security Misconfiguration** | Implemented locally — hosted verification pending | Strict CSP (self only, no `unsafe-inline`/`unsafe-eval`), HSTS, `nosniff`, `X-Frame-Options: DENY`/`frame-ancestors 'none'`, Referrer and Permissions policies, COOP/CORP, preview `noindex`, all via Netlify headers. Function responses set their own `no-store`/`noindex`/`nosniff`. No debug output or stack traces. |
| **A03 Software Supply Chain Failures** | Implemented and tested locally | Exact versions and a lockfile, `npm ci`, `npm audit` 0 vulnerabilities (also in CI), Dependabot. The function has no dependencies. Fonts self-hosted, no CDN scripts. *Optional hardening:* pin GitHub Actions to commit SHAs. |
| **A04 Cryptographic Failures** | Implemented locally — hosted verification pending | HTTPS (Netlify) plus HSTS. No secrets in the repo or output (scanned locally). `CONTACT_FORM_NAME` only in Netlify env vars. |
| **A05 Injection** | Implemented and tested locally | No database or shell. User input is never rendered by the site: outcome pages are static. Nunjucks autoescapes (verified), and `safe` is used only for trusted content. The JSON-LD `<` escaping was found ineffective in this review and **fixed**. The function rejects CR/LF in name/email and control characters, and forwards only known fields. |
| **A06 Insecure Design** | Validation: implemented and tested locally. Rate limiting: implemented locally — hosted verification pending | Server-side validation is authoritative (browser checks are UX only). Fixed field allow-list, size cap, origin check, honeypot, Akismet (Netlify). **Rate limiting:** Netlify code-based rule on `/api/contact`, 5 requests per 180 s per IP (available on all plans; enforced by Netlify, so it can't be tested locally). It slows but doesn't stop a distributed flood of valid-looking messages; Akismet and plan limits apply. |
| **A07 Authentication Failures** | Not applicable | No logins. Protect the Netlify and GitHub accounts with MFA. |
| **A08 Software or Data Integrity Failures** | Implemented and tested locally | No third-party runtime code. Builds come from the lockfile in CI. Hashed asset filenames. |
| **A09 Security Logging & Alerting Failures** | Implemented locally — hosted verification pending | The function logs each outcome (accepted/rejected/dropped/uncertain/error, with the reason) and never personal data (tested locally; Netlify log visibility to verify). **Gap:** no alerting. Check function logs if form volume looks wrong. |
| **A10 Mishandling of Exceptional Conditions** | Implemented and tested locally | Failures **before** the forward (bad input, missing/invalid config, exceptions) send nothing and show `/form-error/`. A 4xx from Netlify means it wasn't stored (`/form-error/`). A **timeout (8 s), network error or 5xx after the forward was sent is uncertain:** Netlify may have stored it. The visitor sees `/form-unconfirmed/` (asked not to resend, and to email to check), and the function makes exactly one attempt, never retrying, to avoid duplicates. No error details are exposed. |

**Northern Strike Fishing:** the same direct-POST bypass applies, because its public form
name is registered via `__forms.html`. Validate this design on Tripeak's Netlify deploy
first, then port the verified changes to Northern Strike as a separate fix. That includes
deleting its existing public `contact` form in Netlify and re-running the bypass checks there.

## Remaining launch tasks

1. Keith's content for every placeholder above; then remove `placeholder: true` per page.
2. **Hero photo licence:** confirm source and licence (extracted from the PDF at 2880×1180),
   ideally with the original file.
3. **Outlined logo:** a version of the complete logo with the wordmark converted to paths
   (see the logo limitation below).
4. **Production domain:** set `SITE_URL` in Netlify (Production context).
5. **Social sharing image** (1200×630) for `og:image`, if wanted.
6. Complete the deployment checklist above (`npm run verify:deploy` on every deploy URL).
   Then port the verified contact-form changes to Northern Strike Fishing as a separate fix.
7. Manual accessibility checks (see below).
8. Optional, if Keith supplies one: a scheduling link for technical discovery. This would
   need a CSP review if it embeds third-party code; a plain link would not.

---

## Design sources used

`Home Page Mock Up.pdf` is in `Tripeak-content/` (outside this repo). The logos and
profile pictures are in `src/assets/images/`.

| File | Used for |
| --- | --- |
| `Home Page Mock Up.pdf` | Layout, copy, palette, type scale, card spec. Embedded fonts identify the typefaces; the hero photo was extracted from page 1. |
| `Logo Version Black.svg` | **Header and footer logo** (complete logo: mark above wordmark). Recoloured at build time to navy (header, as in the mock-up) and off-white (footer). |
| `Logo Version Black Mnt only transparent.svg` | Favicon and app icon (`src/assets/icons/`), where a wordmark would be illegible. |
| `About Page Mock Up.pdf`, `About Page Mock Up - Expanded Cards.pdf` | About page layout and copy. The two PDFs differ on the fourth tenet title; "Mission-Centric Design" was confirmed. Tenet cards use native `<details>` (closed: two-line preview; open: full text). |
| `Profile Image.webp` | About page hero photo, alt text "Keith Omand, founder of Tripeak Digital" (approved). |
| `Profile Image Long.webp` | Not used. |

Services and Portfolio had no mock-up. They reuse the homepage's tokens
and components: navy title band, Lora headings, white cards with shadow, sand accents and
teal buttons.

### Logo limitation: the wordmark depends on an installed font

In `Logo Version Black.svg`, "Tripeak Digital" is live SVG `<text>` with
`font-family: 'Cambria', serif`, not outlined paths. Cambria is a Microsoft font, installed
on Windows and on Macs with Microsoft Office. It is not licensed for web embedding, so the
site cannot supply it.

- Where Cambria is installed, the logo renders as designed.
- Elsewhere (most Android, Linux, many iOS/macOS devices) the browser substitutes its
  default serif. In testing, Times New Roman still fits inside the logo. A wider default
  serif (e.g. Noto Serif on Android) may look different or clip the edge of "Digital".
- Because the logo is an `<img>`, the page's web fonts can't be used as a fallback.

**Fix:** ask Keith for a version with the text converted to outlines (paths). Drop it in
at the same filename and the build will recolour it automatically.

Other logo notes:
- The mock-up header shows a side-by-side lockup (mark left, wordmark right). The supplied
  complete logo is stacked, so the header is now 80 px (mobile) / 88 px (desktop) tall
  instead of 80 px. That keeps the wordmark at roughly 13.5–15 px.
- Each logo link's accessible name is "Tripeak Digital — Home", from the image alt text only.

### Typography: "Loras" is Lora

The PDF's style sheet labels the heading font "Loras", but the fonts embedded in the PDF are
`Lora-Bold` and `Lora-SemiBold` (with `Roboto-Regular/Medium/Bold` for body text). "Loras" is a
typo for **Lora**. Both Lora and Roboto are SIL Open Font License fonts, self-hosted from
`@fontsource` (licence files ship in `/fonts/`).

The mock-up's body text looks slightly narrower and more widely tracked than standard Roboto.
That may be a rendering artefact of the design tool. Keith's CSS would confirm it.

### Sizes

The PDF lists H1 62 / H2 42 / H3 25 / H4 22 / P 18 "pt". The rendered mock-up (1440 px wide)
measures about 58 / 42 / 21 (card titles) / 22 (lead) / 17–23 px. These are implemented as
fluid `clamp()` rem sizes that reach those values at desktop widths and scale down on phones.

Heading levels follow document structure (one H1 per page, H2 for sections, H3 for cards),
not the PDF's visual labels (e.g. "Header is H4" for card titles).

## Missing assets

Not found in the repo or `Tripeak-content/`:

1. **Keith's HTML/CSS source.** The design was implemented from the PDF instead. If the
   HTML/CSS turns up, compare letter-spacing, button radii, hover states and the body font width.
2. **Font files.** Nothing was supplied. Substituted with the official Lora/Roboto from Fontsource (OFL).
3. **Outlined-text version of the complete logo** (see the logo limitation above).
4. **Hero photo source and licence.** See remaining launch tasks.
5. **Social sharing image** (Open Graph, 1200×630). None was supplied, so no `og:image` is set.
6. **Production domain.** Not confirmed; see "Indexing" in the README (`SITE_URL`).

## Mock-up elements and current behaviour

| Mock-up element | Current behaviour |
| --- | --- |
| Nav: Home / About / Portfolio / Services | As designed, linking to the four pages |
| Header "Contact" button | `/#contact` (homepage contact section) |
| "Schedule a Technical Discovery" | `/#contact` for now. A scheduling link can replace it later if Keith supplies one. |
| "View All Our Services" | `/services/` |
| Footer "Explore" / "Contact" | The four pages / email, contact-form link, location |
| Copyright year | Build year (currently 2026) |

## Deliberate departures from the mock-up

- **Hero overlay.** The navy gradient is anchored to where the text starts, so the eyebrow, H1
  and paragraph keep WCAG AA contrast at every width. A test measures this. The photo is
  slightly less visible behind the eyebrow than in the mock-up.
- **Mobile.** The header collapses to the logo and a "Menu" button. The menu stays visible
  without JavaScript. Cards stack in one column below 1024 px. The footer stacks.
- **Card body text** may wrap to three lines at some widths where the mock-up shows two (see the font note above).
- **Header height** is 8 px taller on desktop, to fit the stacked logo (see logo notes).

## Accessibility status

Automated checks (axe-core with WCAG 2.0/2.1/2.2 A/AA plus best-practice rules) pass on every
page, including the contact form, at 375 and 1440 px. Scripted checks cover the skip link, menu
open/close/Escape/focus return, no-JS navigation, form labels, required fields and
honeypot exclusion from tab order, 200% text size, WCAG text-spacing overrides, and hero
text contrast. These do **not** establish full WCAG 2.2 AA conformance. Still to do by hand:

- Screen reader pass (NVDA + Firefox/Chrome, VoiceOver on iOS/macOS), including the form's
  browser validation messages and the `/form-error/` page.
- Real-device checks (iOS Safari, Android Chrome) and browser zoom to 400% on desktop.
- Windows High Contrast / forced-colours review (the card chevron is decorative and disappears there).
- Content review of final copy and any added images' alt text.
