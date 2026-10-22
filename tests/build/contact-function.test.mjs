// Unit tests for the contact function's server-side validation and forwarding.
// fetch is stubbed: these prove what the function accepts, rejects and sends,
// not Netlify Forms processing or email delivery.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import handler, { LIMITS, config } from "../../netlify/functions/contact.mjs";

const SITE = "https://tripeak.test";
const FORM_NAME = "secret-form-name-0123456789";
const VALID = { name: "Test Person", email: "test@example.org", message: "Hello, this is a test." };

let forwarded;
const realFetch = globalThis.fetch;
const realLog = console.log;

beforeEach(() => {
  process.env.URL = SITE;
  process.env.CONTACT_FORM_NAME = FORM_NAME;
  forwarded = [];
  globalThis.fetch = async (url, init) => {
    forwarded.push({ url, init, body: Object.fromEntries(new URLSearchParams(init.body)) });
    return new Response("ok", { status: 200 });
  };
  console.log = () => {};
});

afterEach(() => {
  globalThis.fetch = realFetch;
  console.log = realLog;
});

function post(fields, { headers = {}, raw } = {}) {
  const body = raw ?? new URLSearchParams(fields).toString();
  return handler(
    new Request(`${SITE}/api/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: SITE, ...headers },
      body,
    })
  );
}

const location = (res) => res.headers.get("location");

function assertRejected(res, label) {
  assert.equal(res.status, 303, label);
  assert.equal(location(res), "/form-error/", label);
  assert.equal(forwarded.length, 0, `${label}: nothing forwarded`);
}

test("valid submission is forwarded with only the known fields and the secret form name", async () => {
  const res = await post({ ...VALID, "bot-field": "", "form-name": "attacker-form", extra: "ignored", "submitted-by": "x" });
  assert.equal(res.status, 303);
  assert.equal(location(res), "/thanks/");
  assert.equal(forwarded.length, 1);
  assert.equal(forwarded[0].url, `${SITE}/`);
  assert.deepEqual(forwarded[0].body, { "form-name": FORM_NAME, ...VALID });
  assert.equal(res.headers.get("cache-control"), "no-store");
});

test("blank, missing and whitespace-only fields are rejected", async () => {
  const cases = {
    "all empty": { name: "", email: "", message: "" },
    "no fields at all": {},
    "missing message": { name: VALID.name, email: VALID.email },
    "whitespace name": { ...VALID, name: "     " },
    "whitespace message": { ...VALID, message: " \n\t \r\n " },
    "whitespace email": { ...VALID, email: "   " },
    "non-breaking spaces only": { ...VALID, name: "\u00a0\u00a0\u00a0" },
    "zero-width characters only": { ...VALID, message: "\u200b\u200b\u200b\u200b\u200b\u200b" },
    "punctuation only": { ...VALID, name: "...", message: "!!!!!!" },
  };
  for (const [label, fields] of Object.entries(cases)) {
    assertRejected(await post(fields), label);
  }
});

test("fields shorter or longer than the limits are rejected", async () => {
  assertRejected(await post({ ...VALID, name: "A" }), "name too short");
  assertRejected(await post({ ...VALID, name: "A".repeat(LIMITS.name.max + 1) }), "name too long");
  assertRejected(await post({ ...VALID, message: "Hi" }), "message too short");
  assertRejected(await post({ ...VALID, message: "x".repeat(LIMITS.message.max + 1) }), "message too long");
});

test("invalid emails are rejected", async () => {
  for (const email of ["not-an-email", "a@b", "@example.org", "a b@example.org", "a@example.org\nBcc: x@evil.test"]) {
    assertRejected(await post({ ...VALID, email }), email);
  }
});

test("header-injection and control characters are rejected", async () => {
  assertRejected(await post({ ...VALID, name: "Name\r\nBcc: x@evil.test" }), "CRLF in name");
  assertRejected(await post({ ...VALID, message: "Hello\u0000world" }), "NUL in message");
  assertRejected(await post({ ...VALID, name: "Bell\u0007" }), "control char in name");
});

test("repeated fields (parameter pollution) are rejected", async () => {
  assertRejected(await post(null, { raw: "name=A+Person&name=B+Person&email=a%40b.co&message=Hello+there" }), "duplicate name");
});

test("honeypot submissions get the success page but are not forwarded", async () => {
  const res = await post({ ...VALID, "bot-field": "http://spam.test" });
  assert.equal(location(res), "/thanks/");
  assert.equal(forwarded.length, 0);
});

test("oversized bodies, wrong content types, cross-origin posts and other methods are rejected", async () => {
  assertRejected(await post({ ...VALID, message: "x".repeat(4000), pad: "y".repeat(20000) }), "oversized body");
  assertRejected(await post(null, { raw: JSON.stringify(VALID), headers: { "Content-Type": "application/json" } }), "JSON");
  assertRejected(await post(VALID, { headers: { Origin: "https://evil.test" } }), "cross-origin");

  const get = await handler(new Request(`${SITE}/api/contact`));
  assert.equal(get.status, 405);
  assert.equal(get.headers.get("allow"), "POST");
});

test("fails closed when not configured, and when forwarding fails", async () => {
  delete process.env.CONTACT_FORM_NAME;
  assertRejected(await post(VALID), "missing CONTACT_FORM_NAME");

  process.env.CONTACT_FORM_NAME = "short";
  assertRejected(await post(VALID), "invalid CONTACT_FORM_NAME");

  process.env.CONTACT_FORM_NAME = FORM_NAME;
  delete process.env.URL;
  assertRejected(await post(VALID), "missing URL");

  process.env.URL = SITE;
});

test("forward outcomes: 4xx is not stored; timeouts, network errors and 5xx are uncertain; never retried", async () => {
  const cases = [
    ["Netlify rejects (404)", async () => new Response("nope", { status: 404 }), "/form-error/"],
    ["Netlify server error (502)", async () => new Response("bad gateway", { status: 502 }), "/form-unconfirmed/"],
    ["timeout", async () => { throw new DOMException("timed out", "TimeoutError"); }, "/form-unconfirmed/"],
    ["network failure", async () => { throw new TypeError("fetch failed"); }, "/form-unconfirmed/"],
  ];
  for (const [label, impl, expected] of cases) {
    let attempts = 0;
    globalThis.fetch = async (...args) => {
      attempts += 1;
      return impl(...args);
    };
    const res = await post(VALID);
    assert.equal(location(res), expected, label);
    assert.equal(attempts, 1, `${label}: exactly one forward attempt (no retries)`);
  }
});

test("rate limiting is configured for /api/contact (enforced by Netlify, verified on deploy)", () => {
  assert.equal(config.path, "/api/contact");
  assert.deepEqual(config.method, ["POST"]);
  const { windowLimit, windowSize, aggregateBy } = config.rateLimit;
  assert.ok(Number.isInteger(windowLimit) && windowLimit >= 1 && windowLimit <= 10, "a few submissions per visitor");
  assert.ok(windowSize >= 60 && windowSize <= 180, "Netlify's maximum window is 180 s");
  assert.ok(aggregateBy.includes("ip"), "per visitor IP (available on all plans)");
});

test("logs never include submitted personal data", async () => {
  const lines = [];
  console.log = (line) => lines.push(line);
  await post(VALID);
  await post({ ...VALID, email: "bad" });
  const output = lines.join("\n");
  for (const value of Object.values(VALID)) assert.ok(!output.includes(value), `log leaks ${value}`);
  assert.match(output, /"outcome":"accepted"/);
  assert.match(output, /"outcome":"rejected"/);
});
