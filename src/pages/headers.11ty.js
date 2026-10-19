// Netlify _headers file: adds X-Robots-Tag on every non-production deploy so
// previews can't be indexed even if a page is linked from elsewhere.
// Security and cache headers live in netlify.toml.
export default class {
  data() {
    return {
      permalink: (data) => (data.site.indexable ? false : "/_headers"),
      eleventyExcludeFromCollections: true,
      layout: false,
    };
  }

  render() {
    return "/*\n  X-Robots-Tag: noindex, nofollow\n";
  }
}
