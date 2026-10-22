import path from "node:path";
import Image from "@11ty/eleventy-img";

const IMAGE_SOURCE_DIR = "src/assets/images";

// Self-hosted fonts (SIL Open Font License) copied from @fontsource packages.
// Stable filenames, so they get a moderate (not immutable) cache in netlify.toml.
const FONTS = {
  lora: ["lora-latin-600-normal.woff2", "lora-latin-700-normal.woff2"],
  roboto: [
    "roboto-latin-400-normal.woff2",
    "roboto-latin-500-normal.woff2",
    "roboto-latin-700-normal.woff2",
  ],
};

export default function (eleventyConfig) {
  for (const [family, files] of Object.entries(FONTS)) {
    const pkg = `node_modules/@fontsource/${family}`;
    for (const file of files) {
      eleventyConfig.addPassthroughCopy({ [`${pkg}/files/${file}`]: `fonts/${file}` });
    }
    eleventyConfig.addPassthroughCopy({ [`${pkg}/LICENSE`]: `fonts/LICENSE-${family}.txt` });
  }
  eleventyConfig.addPassthroughCopy({ "src/assets/icons/favicon.svg": "favicon.svg" });

  // CSS and JS are built by src/_data/assets.js; rebuild when their sources change.
  eleventyConfig.addWatchTarget("src/assets/css/");
  eleventyConfig.addWatchTarget("src/assets/js/");

  // Responsive images with intrinsic dimensions and content-hashed filenames.
  // Usage: {% image "hero-mountains.jpg", "", { sizes: "100vw", eager: true, class: "..." } %}
  // Pass an empty alt only for decorative images.
  eleventyConfig.addAsyncShortcode("image", async function (src, alt, options = {}) {
    if (alt === undefined) {
      throw new Error(`[image] Missing alt text for "${src}". Use "" for decorative images.`);
    }
    const metadata = await Image(path.join(IMAGE_SOURCE_DIR, src), {
      widths: options.widths || [640, 960, 1440, 1920],
      formats: ["avif", "webp", "jpeg"],
      urlPath: "/assets/img/",
      outputDir: path.join(this.eleventy.directories.output, "assets", "img"),
      sharpAvifOptions: { quality: 50 },
      sharpWebpOptions: { quality: 70 },
      sharpJpegOptions: { quality: 75, mozjpeg: true },
    });
    return Image.generateHTML(metadata, {
      alt,
      sizes: options.sizes || "100vw",
      class: options.class || undefined,
      loading: options.eager ? "eager" : "lazy",
      decoding: options.eager ? "sync" : "async",
      fetchpriority: options.eager ? "high" : undefined,
    });
  });

  // The contact function forwards to a Netlify form whose name is a deploy secret
  // (see src/pages/forms-stub.11ty.js). Never ship production without it.
  eleventyConfig.on("eleventy.before", () => {
    if (process.env.CONTEXT === "production" && !process.env.CONTACT_FORM_NAME) {
      throw new Error("[forms] CONTACT_FORM_NAME must be set for production builds (Netlify env var, Builds + Functions scopes).");
    }
    if (process.env.CONTEXT && process.env.CONTEXT !== "production" && !process.env.CONTACT_FORM_NAME) {
      console.warn("[forms] CONTACT_FORM_NAME is not set: the contact form will show its error page on this deploy.");
    }
  });

  // Raster icons for platforms that don't use the SVG favicon.
  eleventyConfig.on("eleventy.before", async ({ directories }) => {
    for (const [width, name] of [[180, "apple-touch-icon"], [32, "favicon-32"]]) {
      await Image("src/assets/icons/app-icon.svg", {
        widths: [width],
        formats: ["png"],
        urlPath: "/",
        outputDir: directories.output,
        filenameFormat: () => `${name}.png`,
      });
    }
  });

  // Safe JSON for <script type="application/ld+json">: escape "<" so a value can
  // never close the script element.
  eleventyConfig.addFilter("jsonLd", (value) =>
    JSON.stringify(value).replace(/</g, "\\u003c")
  );

  eleventyConfig.addFilter("absoluteUrl", (urlPath, base) =>
    base ? new URL(urlPath, base).toString() : urlPath
  );

  return {
    templateFormats: ["html", "11ty.js"],
    htmlTemplateEngine: "njk",
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
  };
}
