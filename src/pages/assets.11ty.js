// Writes the hashed CSS and JS produced by src/_data/assets.js.
export default class {
  data() {
    return {
      pagination: { data: "assets.files", size: 1, alias: "asset" },
      permalink: (data) => data.asset.href,
      eleventyExcludeFromCollections: true,
      layout: false,
    };
  }

  render({ asset }) {
    return asset.code;
  }
}
