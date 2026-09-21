import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, normalizeUaPhone, safeJsonLd, safeRedirectPath, sanitizeText, slugify } from "@/lib/sanitize";

test("sanitizeText strips tags and control chars", () => {
  assert.equal(sanitizeText("<script>alert(1)</script>Іван\u0000"), "alert(1)Іван");
  assert.equal(sanitizeText("  a   b  "), "a b");
});

test("escapeHtml", () => {
  assert.equal(escapeHtml(`<img src=x onerror="a">`), "&lt;img src=x onerror=&quot;a&quot;&gt;");
});

test("safeJsonLd cannot break out of a script tag", () => {
  const out = safeJsonLd({ name: "</script><script>alert(1)</script>" });
  assert.ok(!out.includes("</script>"));
  assert.deepEqual(JSON.parse(out), { name: "</script><script>alert(1)</script>" });
});

test("normalizeUaPhone", () => {
  assert.equal(normalizeUaPhone("+38 (067) 123-45-67"), "380671234567");
  assert.equal(normalizeUaPhone("0671234567"), "380671234567");
  assert.equal(normalizeUaPhone("123"), null);
});

test("safeRedirectPath blocks open redirects", () => {
  assert.equal(safeRedirectPath("/account/orders"), "/account/orders");
  assert.equal(safeRedirectPath("//evil.com"), "/");
  assert.equal(safeRedirectPath("https://evil.com"), "/");
  assert.equal(safeRedirectPath("/\\evil.com"), "/");
  assert.equal(safeRedirectPath(null, "/x"), "/x");
});

test("slugify transliterates Ukrainian", () => {
  assert.equal(slugify("iPhone 15 Pro Max 256 ГБ"), "iphone-15-pro-max-256-hb");
  assert.equal(slugify("Кабель Lightning"), "kabel-lightning");
});
