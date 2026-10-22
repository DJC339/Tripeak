// Central site data: branding, contact details, and deploy-aware SEO settings.
//
// SITE_URL  – the production origin, e.g. https://www.example.ca (set in Netlify
//             production env vars once the domain is confirmed). Canonical URLs,
//             sitemap and absolute Open Graph URLs are only emitted when it is set.
// CONTEXT   – provided by Netlify: production | deploy-preview | branch-deploy | dev.
//             Only the production context may be indexed by search engines.
const context = process.env.CONTEXT || "local";
const url = (process.env.SITE_URL || "").trim().replace(/\/+$/, "");
const indexable = context === "production";

if (indexable && !url) {
  console.warn("[site] Production build without SITE_URL: canonical URLs and sitemap are omitted.");
}

const email = "info@tripeakdigital.ca";

const site = {
  name: "Tripeak Digital",
  legalName: "Tripeak Digital Inc.",
  titleTagline: "Secure, Bespoke Power Platform Solutions",
  tagline: "Secure, bespoke Power Platform solutions. Built with military discipline and Canadian integrity.",
  description:
    "Tripeak Digital builds secure, bespoke Microsoft Power Platform solutions. Veteran owned and operated in Edmonton, Alberta.",
  language: "en-CA",
  email,
  location: { locality: "Edmonton", region: "Alberta", country: "CA" },

  // Calls to action. The contact form lives on the homepage (#contact); the
  // absolute path makes the link work from every page. The discovery CTA uses the
  // form for now; a scheduling link can replace it if Keith supplies one.
  contactHref: "/#contact",
  discoveryHref: "/#contact",
  emailHref: `mailto:${email}`,

  url,
  context,
  indexable,
  year: new Date().getFullYear(),
};

// schema.org Organization for the homepage. Supplied facts only; extend when
// confirmed (logo, sameAs profiles, phone, etc.).
site.organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: site.name,
  legalName: site.legalName,
  description: site.description,
  email: site.email,
  address: {
    "@type": "PostalAddress",
    addressLocality: site.location.locality,
    addressRegion: site.location.region,
    addressCountry: site.location.country,
  },
  ...(url && { url: `${url}/` }),
};

export default site;
