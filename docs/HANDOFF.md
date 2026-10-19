# Strawman hand-off notes

## Design sources used

`Home Page Mock Up.pdf` is in `Tripeak-content/` (outside this repo). The logos and
profile pictures are in `src/assets/images/`.

| File | Used for |
| --- | --- |
| `Home Page Mock Up.pdf` | Layout, copy, palette, type scale, card spec. Embedded fonts identify the typefaces; the hero photo was extracted from page 1. |
| `Logo Version Black.svg` | **Header and footer logo** (complete logo: mark above wordmark). Recoloured at build time to navy (header, as in the mock-up) and off-white (footer). |
| `Logo Version Black Mnt only transparent.svg` | Favicon and app icon (`src/assets/icons/`), where a wordmark would be illegible. |
| `Profile Image.webp`, `Profile Image Long.webp` | Not used or published yet. Available for the About page via `{% image "Profile Image.webp", "<alt text>" %}` once names, copy and alt text are approved. |

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
   Also needed: an **outlined-text version of the complete logo** (see the logo limitation above).
3. **Hero photo source and licence.** The mountain photo (Three Sisters, Canmore) was
   extracted from the PDF at 2880×1180. **Please confirm its licence/source before launch** and
   supply the original file if possible (a higher-resolution original would also improve sharpness).
4. **Social sharing image** (Open Graph, 1200×630). None was supplied, so no `og:image` is set.
5. **Production domain.** Not confirmed; see "Indexing" in the README (`SITE_URL`).
6. **About page copy**, and any photo with approved alt text.

## Temporary decisions (from the mock-up's out-of-scope links)

| Mock-up element | Strawman behaviour | Future decision |
| --- | --- | --- |
| Nav: Home / About / Portfolio / Services | Home, About, Services → `/#services` (the capabilities section). Portfolio omitted. | Add Portfolio/Services pages if they come into scope. |
| Header "Contact" button | `mailto:info@tripeakdigital.ca` | Contact page or form, if wanted. |
| "Schedule a Technical Discovery" | `mailto:` with subject "Technical discovery request" | **Booking integration** (e.g. a scheduling tool). Needs CSP changes and a privacy review. |
| "View All Our Services" | Relabelled **"Ask About Our Services"** and opens an email (subject "Services enquiry"), because there is no Services page | Restore the original label and link once a Services page exists. |
| Footer "Explore" links | Same three links as the header | — |
| Copyright year | Build year (currently 2026) | — |

## Deliberate departures from the mock-up

- **Hero overlay.** The navy gradient is anchored to where the text starts, so the eyebrow, H1
  and paragraph keep WCAG AA contrast at every width. A test measures this. The photo is
  slightly less visible behind the eyebrow than in the mock-up.
- **Mobile.** The header collapses to the logo and a "Menu" button. The menu stays visible
  without JavaScript. Cards stack in one column below 1024 px. The footer stacks.
- **Card body text** may wrap to three lines at some widths where the mock-up shows two (see the font note above).

## Accessibility status

Automated checks (axe-core with WCAG 2.0/2.1/2.2 A/AA plus best-practice rules) pass on all
three pages at 375 and 1440 px. Scripted checks cover keyboard skip link, menu
open/close/Escape/focus return, no-JS navigation, 200% text size, WCAG text-spacing overrides,
and hero text contrast. These do **not** establish full WCAG 2.2 AA conformance. Still to do by hand:

- Screen reader pass (NVDA + Firefox/Chrome, VoiceOver on iOS/macOS).
- Real-device checks (iOS Safari, Android Chrome) and browser zoom to 400% on desktop.
- Windows High Contrast / forced-colours review (the card chevron is decorative and disappears there).
- Content review of the final About copy and any added images' alt text.
