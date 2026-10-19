// Production allows crawling; previews, branch deploys and local builds do not.
export default class {
  data() {
    return { permalink: "/robots.txt", eleventyExcludeFromCollections: true, layout: false };
  }

  render({ site }) {
    if (!site.indexable) return "User-agent: *\nDisallow: /\n";
    const sitemap = site.url ? `\nSitemap: ${site.url}/sitemap.xml\n` : "";
    return `User-agent: *\nAllow: /\n${sitemap}`;
  }
}
