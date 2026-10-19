// Only generated when SITE_URL is known (absolute URLs are required).
// Pages marked noindex or placeholder are left out.
export default class {
  data() {
    return {
      permalink: (data) => (data.site.url ? "/sitemap.xml" : false),
      eleventyExcludeFromCollections: true,
      layout: false,
    };
  }

  render({ site, collections }) {
    const urls = collections.all
      .filter((item) => item.outputPath?.endsWith(".html") && !item.data.noindex && !item.data.placeholder)
      .map((item) => `  <url><loc>${site.url}${item.url}</loc></url>`)
      .join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  }
}
