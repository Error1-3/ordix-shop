import { test } from "node:test";
import assert from "node:assert/strict";
import { decryptField, encryptField, hashIdentifier, isValidImei } from "@/lib/crypto";

process.env.DATA_ENCRYPTION_KEY = "0".repeat(63) + "1";

test("encrypt/decrypt round trip; ciphertext is randomised and never contains the plaintext", () => {
  const imei = "356938035643809";
  const a = encryptField(imei);
  const b = encryptField(imei);
  assert.notEqual(a, b);
  assert.ok(!a.includes(imei));
  assert.equal(decryptField(a), imei);
});

test("tampered ciphertext is rejected (GCM auth tag)", () => {
  const enc = encryptField("secret");
  const parts = enc.split(":");
  parts[3] = Buffer.from("garbage!!").toString("base64");
  assert.throws(() => decryptField(parts.join(":")));
});

test("hash is deterministic and case/whitespace-insensitive", () => {
  assert.equal(hashIdentifier(" f2lxk1 "), hashIdentifier("F2LXK1"));
  assert.notEqual(hashIdentifier("A"), hashIdentifier("B"));
});

test("IMEI luhn validation", () => {
  assert.ok(isValidImei("356938035643809"));
  assert.equal(isValidImei("356938035643808"), false);
  assert.equal(isValidImei("12345"), false);
});

test("missing/invalid key is a hard error", () => {
  const prev = process.env.DATA_ENCRYPTION_KEY;
  process.env.DATA_ENCRYPTION_KEY = "short";
  assert.throws(() => encryptField("x"));
  process.env.DATA_ENCRYPTION_KEY = prev;
});
