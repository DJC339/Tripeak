// Contact form endpoint: validates submissions server-side, then forwards clean
// data to Netlify Forms (storage + email notifications).
//
// Why a function: Netlify Forms stores whatever is POSTed to it, so blank,
// whitespace-only or oversized submissions would bypass the browser's `required`
// checks. Netlify also accepts a submission POSTed to ANY path if its form-name
// matches a registered form. So the registered form's name is a secret
// (CONTACT_FORM_NAME, set in Netlify, never in the repo); only this function knows
// it. The public form has no data-netlify attribute and posts here instead.
//
// Outcomes are redirects to static pages, so no user input is ever echoed back:
//   /thanks/            forwarded and accepted (or honeypot, silently dropped)
//   /form-error/        definitely not stored (rejected input, config error,
//                       or Netlify refused the forward with a 4xx)
//   /form-unconfirmed/  forward sent but the result is unknown (timeout, network
//                       error, 5xx): Netlify may have stored it, so never retry here
//                       (a retry could create a duplicate) and ask the visitor not to resend

export const config = {
  path: "/api/contact",
  method: ["POST"],
  // Netlify code-based rate limiting (all plans; validated at deploy post-processing).
  // Per visitor IP: 5 requests per 180 s (the maximum window). Rejected submissions
  // count too, so bots can't probe the validator quickly. Over-limit requests get a
  // 429 from Netlify and never reach this code. Enforcement can lag up to ~10 s.
  rateLimit: {
    windowLimit: 5,
    windowSize: 180,
    aggregateBy: ["ip", "domain"],
  },
};

export const LIMITS = {
  name: { min: 2, max: 100 },
  email: { min: 3, max: 254 },
  message: { min: 5, max: 5000 },
};
const FIELDS = Object.keys(LIMITS);
const MAX_BODY_BYTES = 16 * 1024;
const FORWARD_TIMEOUT_MS = 8000;
const FORM_NAME_PATTERN = /^[a-z0-9-]{16,64}$/;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Control characters other than tab/newline/carriage return.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const LINE_BREAKS = /[\r\n]/;
// Name and message must contain real text, not only invisible or format characters.
const HAS_TEXT = /[\p{L}\p{N}]/u;

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

const redirect = (location) =>
  new Response(null, { status: 303, headers: { ...RESPONSE_HEADERS, Location: location } });

const plain = (status, text, extra = {}) =>
  new Response(text, { status, headers: { ...RESPONSE_HEADERS, "Content-Type": "text/plain; charset=utf-8", ...extra } });

// Logs the outcome only: never names, emails or message content.
const log = (outcome, reason) => console.log(JSON.stringify({ event: "contact_form", outcome, reason }));

const reject = (reason) => {
  log("rejected", reason);
  return redirect("/form-error/");
};

/** Validates and normalises the posted fields. Returns { values } or { error }. */
export function validate(params) {
  const values = {};
  for (const field of FIELDS) {
    const all = params.getAll(field);
    if (all.length !== 1) return { error: `${field}: missing or repeated` };

    let value = all[0].normalize("NFC").trim();
    if (field === "message") value = value.replace(/\r\n?/g, "\n");
    else if (LINE_BREAKS.test(value)) return { error: `${field}: line break` };

    if (CONTROL_CHARS.test(value)) return { error: `${field}: control character` };

    const { min, max } = LIMITS[field];
    const length = [...value].length;
    if (length < min || length > max) return { error: `${field}: length` };

    if (field !== "email" && !HAS_TEXT.test(value)) return { error: `${field}: no text` };

    values[field] = value;
  }
  if (!EMAIL_PATTERN.test(values.email)) return { error: "email: format" };
  return { values };
}

// Sends one submission to Netlify Forms. Exactly one attempt: no retries.
async function forward(siteUrl, formName, values) {
  let response;
  try {
    response = await fetch(`${siteUrl.replace(/\/+$/, "")}/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ "form-name": formName, ...values }).toString(),
      redirect: "manual",
      signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
    });
  } catch (err) {
    // Timeout or network failure after the request may have been sent.
    log("uncertain", err?.name || "network error");
    return redirect("/form-unconfirmed/");
  }
  if (response.status >= 500) {
    log("uncertain", `forward status ${response.status}`);
    return redirect("/form-unconfirmed/");
  }
  if (response.status >= 400) {
    log("error", `forward status ${response.status}`);
    return redirect("/form-error/");
  }
  log("accepted");
  return redirect("/thanks/");
}

export default async function handler(req) {
  // Everything before forward() is local: any failure means nothing was sent.
  try {
    if (req.method !== "POST") return plain(405, "Method Not Allowed", { Allow: "POST" });

    // Fail closed if the deployment isn't configured.
    const formName = process.env.CONTACT_FORM_NAME || "";
    const siteUrl = process.env.URL || "";
    if (!FORM_NAME_PATTERN.test(formName) || !/^https?:\/\//.test(siteUrl)) {
      log("error", "not configured");
      return redirect("/form-error/");
    }

    // Browsers send Origin on form POSTs; reject other sites posting via a visitor's browser.
    const origin = req.headers.get("origin");
    if (origin && origin !== "null" && origin !== new URL(req.url).origin) return reject("cross-origin");

    const type = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (type !== "application/x-www-form-urlencoded") return reject("content type");

    const declared = Number(req.headers.get("content-length") || 0);
    if (declared > MAX_BODY_BYTES) return reject("too large");
    const body = await req.text();
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) return reject("too large");

    const params = new URLSearchParams(body);

    // Honeypot: pretend success so bots learn nothing, but don't forward.
    if ((params.get("bot-field") || "").length > 0) {
      log("dropped", "honeypot");
      return redirect("/thanks/");
    }

    const { values, error } = validate(params);
    if (error) return reject(error);

    // Forward only the known fields (never client-supplied form-name or extras) to
    // Netlify's trusted site URL, not a request-derived host.
    return await forward(siteUrl, formName, values);
  } catch (err) {
    log("error", err?.name || "exception");
    return redirect("/form-error/");
  }
}
