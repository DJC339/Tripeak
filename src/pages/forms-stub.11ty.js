// Hidden form definition for Netlify form detection. Netlify registers forms by
// parsing deployed HTML, so this registers the form the contact function forwards
// to (netlify/functions/contact.mjs).
//
// The form name comes from CONTACT_FORM_NAME (set in Netlify, not in the repo).
// Knowing it would let anyone POST straight to Netlify Forms and skip validation,
// so the page is also blocked from public access by a forced 404 in netlify.toml.
//
// Without CONTACT_FORM_NAME the page isn't generated (local builds, tests).
// Production builds fail instead (see eleventy.config.js).
const FORM_NAME_PATTERN = /^[a-z0-9-]{16,64}$/;

export default class {
  data() {
    return {
      permalink: () => (process.env.CONTACT_FORM_NAME ? "/__forms.html" : false),
      eleventyExcludeFromCollections: true,
      layout: false,
    };
  }

  render() {
    const formName = process.env.CONTACT_FORM_NAME;
    // Eleventy still renders templates with permalink: false; nothing to do then.
    if (!formName) return "";
    if (!FORM_NAME_PATTERN.test(formName)) {
      throw new Error("[forms] CONTACT_FORM_NAME must be 16–64 characters: lowercase letters, digits and hyphens.");
    }
    return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><title>Forms</title></head>
<body>
<form name="${formName}" data-netlify="true" hidden>
<input type="text" name="name">
<input type="email" name="email">
<textarea name="message"></textarea>
</form>
</body>
</html>
`;
  }
}
