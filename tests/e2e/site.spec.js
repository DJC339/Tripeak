import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES = ["/", "/about/", "/404.html"];
const WIDTHS = [320, 375, 768, 1024, 1440];

// Adds test-only CSS through the CSSOM (the page's CSP rightly blocks <style> injection).
const injectCss = (page, css) =>
  page.evaluate((text) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(text);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  }, css);

// Collects console errors, page errors, CSP violations and failed requests.
function watchForProblems(page) {
  const problems = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") problems.push(`console ${msg.type()}: ${msg.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
  page.on("requestfailed", (req) => problems.push(`request failed: ${req.url()}`));
  page.on("response", (res) => {
    if (res.status() >= 400 && !res.url().endsWith("/does-not-exist/")) problems.push(`HTTP ${res.status()}: ${res.url()}`);
  });
  return problems;
}

for (const width of WIDTHS) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    for (const path of PAGES) {
      test(`${path} renders cleanly`, async ({ page }) => {
        const problems = watchForProblems(page);
        await page.goto(path, { waitUntil: "networkidle" });

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, "horizontal overflow").toBeLessThanOrEqual(0);

        await expect(page.locator("h1")).toHaveCount(1);

        // The footer email should never break mid-address.
        const email = await page.locator('footer a[href^="mailto"]').boundingBox();
        expect(email.height, "footer email wraps").toBeLessThanOrEqual(48);

        const brokenImages = await page.$$eval("img", (imgs) =>
          imgs.filter((img) => !img.complete || img.naturalWidth === 0).map((img) => img.src)
        );
        expect(brokenImages).toEqual([]);

        expect(problems).toEqual([]);
      });
    }

    test("hero text has sufficient contrast over the photo", async ({ page }) => {
      await page.goto("/", { waitUntil: "networkidle" });
      const hero = page.locator("section").first();
      const texts = hero.locator("p, h1");

      // Measure the background with the text hidden, then compare with each text colour.
      const boxes = await texts.evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y + window.scrollY, w: r.width, h: r.height, color: getComputedStyle(el).color, large: el.tagName === "H1" };
        })
      );
      await injectCss(page, "section:first-of-type :is(p, h1, a) { visibility: hidden }");
      const png = await hero.screenshot();
      const heroBox = await hero.boundingBox();

      // Analyse pixels in a blank page: the site's CSP (correctly) forbids data: images.
      const scratch = await page.context().newPage();
      const ratios = await scratch.evaluate(
        async ({ data, boxes, heroBox }) => {
          const img = new Image();
          img.src = `data:image/png;base64,${data}`;
          await img.decode();
          const canvas = new OffscreenCanvas(img.width, img.height);
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          const scale = img.width / heroBox.width;
          const lum = (r, g, b) =>
            [r, g, b]
              .map((v) => v / 255)
              .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
              .reduce((acc, c, i) => acc + c * [0.2126, 0.7152, 0.0722][i], 0);
          return boxes.map((box) => {
            const { data: px } = ctx.getImageData(
              Math.floor(box.x * scale),
              Math.floor((box.y - heroBox.y) * scale),
              Math.max(1, Math.floor(box.w * scale)),
              Math.max(1, Math.floor(box.h * scale))
            );
            let maxBg = 0;
            for (let i = 0; i < px.length; i += 4) maxBg = Math.max(maxBg, lum(px[i], px[i + 1], px[i + 2]));
            const [r, g, b] = box.color.match(/\d+/g).map(Number);
            const fg = lum(r, g, b);
            return { ratio: (Math.max(fg, maxBg) + 0.05) / (Math.min(fg, maxBg) + 0.05), min: box.large ? 3 : 4.5 };
          });
        },
        { data: png.toString("base64"), boxes, heroBox }
      );

      for (const [i, { ratio, min }] of ratios.entries()) {
        expect(ratio, `hero text #${i + 1} contrast ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(min);
      }
    });
  });
}

test.describe("accessibility (axe, WCAG 2.2 A/AA rules)", () => {
  for (const width of [375, 1440]) {
    for (const path of PAGES) {
      test(`${path} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
          .analyze();
        expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
      });
    }
  }
});

test.describe("links", () => {
  test("every internal link and anchor resolves; CTAs use the contact email", async ({ page, request }) => {
    const seen = new Set();
    for (const path of PAGES) {
      await page.goto(path);
      const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
      for (const href of hrefs) {
        expect(href, `empty link on ${path}`).toMatch(/\S/);
        expect(href).not.toBe("#");
        if (href.startsWith("mailto:")) {
          expect(href).toMatch(/^mailto:info@tripeakdigital\.ca(\?subject=[^&]+)?$/);
          continue;
        }
        expect(href, `external or unexpected link ${href}`).toMatch(/^\/|^#/);
        seen.add(new URL(href, `http://localhost:8080${path}`).href);
      }
    }
    for (const url of seen) {
      const { pathname, hash } = new URL(url);
      const res = await request.get(pathname);
      expect(res.status(), url).toBe(200);
      if (hash) {
        await page.goto(url);
        await expect(page.locator(hash), `anchor ${url}`).toHaveCount(1);
      }
    }
  });

  test("unknown URLs serve the 404 page", async ({ page }) => {
    const res = await page.goto("/does-not-exist/");
    expect(res.status()).toBe(404);
    await expect(page.locator("h1")).toHaveText(/couldn’t find that page/);
  });
});

test.describe("keyboard and navigation", () => {
  test("skip link moves focus to main content", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();
  });

  test("current page is marked in the primary navigation", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/about/");
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.getByRole("link", { name: "About" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });

  test("desktop shows navigation without a toggle", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Menu" })).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "About" })).toBeVisible();
  });

  test("at 320px the logo and menu button share one header row", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/");
    const brand = await page.locator("header a").first().boundingBox();
    const toggle = await page.getByRole("button", { name: "Menu" }).boundingBox();
    // Same row: vertical centres align (the logo is taller than the button).
    expect(Math.abs(brand.y + brand.height / 2 - (toggle.y + toggle.height / 2))).toBeLessThan(4);
  });

  test("mobile menu toggles, reports state, and closes with Escape", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "Menu" });
    const aboutLink = page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "About" });

    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(aboutLink).toBeHidden();

    const size = await toggle.boundingBox();
    expect(size.height).toBeGreaterThanOrEqual(44);
    expect(size.width).toBeGreaterThanOrEqual(44);

    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(aboutLink).toBeVisible();

    await page.keyboard.press("Tab");
    await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Home" })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
    await expect(aboutLink).toBeHidden();
  });

  test("choosing Services in the mobile menu closes it and jumps to the section", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/");
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Services" }).click();
    await expect(page).toHaveURL(/#services$/);
    await expect(page.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("heading", { name: "Our Core Capabilities" })).toBeInViewport();
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 375, height: 800 } });

  test("navigation links remain visible and the toggle is not shown", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary" });
    for (const name of ["Home", "About", "Services", "Contact"]) {
      await expect(nav.getByRole("link", { name })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Menu" })).toBeHidden();
  });
});

test.describe("zoom and text spacing", () => {
  test("200% text size at 1280px does not cause horizontal scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await injectCss(page, "html { font-size: 200% !important }");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("WCAG text-spacing overrides do not clip content at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/");
    await injectCss(
      page,
      "* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important } p { margin-bottom: 2em !important }"
    );
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("monitoring endpoint", () => {
  test("/health/ returns 200, the expected text, and no-store/noindex headers", async ({ page, request }) => {
    const res = await request.get("/health/", { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/^text\/html/);
    // Exact value: proves no broader rule adds or overrides Cache-Control here.
    expect(res.headers()["cache-control"]).toBe("no-store");
    expect(res.headers()["x-robots-tag"]).toMatch(/\bnoindex\b/);

    // Loads nothing but the document itself.
    const requests = [];
    page.on("request", (req) => requests.push(req.url()));
    await page.goto("/health/");
    expect(await page.locator("body").innerText()).toBe("Tripeak OK");
    expect(requests.filter((url) => !url.endsWith("/favicon.ico"))).toEqual([new URL("/health/", res.url()).href]);
  });

  test("other pages are not marked no-store", async ({ request }) => {
    const res = await request.get("/");
    expect(res.headers()["cache-control"]).toBeUndefined();
  });
});

test.describe("logos", () => {
  for (const width of [320, 375, 768, 1024, 1440]) {
    test(`header and footer logos at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");

      for (const [region, minHeight] of [["banner", 64], ["contentinfo", 90]]) {
        // One link, named once by the image alt (no duplicate visible text).
        const link = page.getByRole(region).getByRole("link", { name: "Tripeak Digital — Home", exact: true });
        await expect(link).toHaveCount(1);
        await expect(link).toHaveAttribute("href", "/");
        expect(await link.innerText()).toBe("");

        const img = link.locator("img");
        const box = await img.boundingBox();
        const natural = await img.evaluate((el) => ({ w: el.naturalWidth, h: el.naturalHeight }));
        expect(natural.w).toBeGreaterThan(0);
        // Proportions preserved (471 × 330) and large enough for the wordmark to be legible.
        expect(Math.abs(box.width / box.height - 471 / 330)).toBeLessThan(0.02);
        expect(box.height).toBeGreaterThanOrEqual(minHeight);
      }
    });
  }
});
