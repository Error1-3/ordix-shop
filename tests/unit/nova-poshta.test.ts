import { test } from "node:test";
import assert from "node:assert/strict";
import { formatNpDate, isLocker, mapNpStatusCode, npPhone, parseNpDate } from "@/services/shipping/nova-poshta-core";

test("status mapping", () => {
  assert.equal(mapNpStatusCode("1"), "CREATED");
  assert.equal(mapNpStatusCode(7), "ARRIVED");
  for (const c of ["9", "10", "11"]) assert.equal(mapNpStatusCode(c), "DELIVERED");
  assert.equal(mapNpStatusCode("102"), "RETURNING");
  assert.equal(mapNpStatusCode("99999"), "UNKNOWN");
  assert.equal(mapNpStatusCode(null), "UNKNOWN");
});

test("date helpers", () => {
  assert.equal(formatNpDate(new Date("2026-09-20T12:00:00Z")), "20.09.2026");
  assert.equal(formatNpDate(new Date("2026-12-31T23:30:00Z")), "01.01.2027"); // Kyiv is already in the next day
  assert.equal(parseNpDate("2026-09-25 00:00:00")?.toISOString().slice(0, 10), "2026-09-25");
  assert.equal(parseNpDate("25.09.2026 12:00:00")?.toISOString().slice(0, 10), "2026-09-25");
  assert.equal(parseNpDate(""), null);
});

test("locker detection prefers CategoryOfWarehouse, falls back to description", () => {
  assert.ok(isLocker({ CategoryOfWarehouse: "Postomat" }));
  assert.equal(isLocker({ CategoryOfWarehouse: "Branch", Description: "Поштомат" }), false);
  assert.ok(isLocker({ Description: "Поштомат «Нова пошта» №1234" }));
  assert.equal(isLocker({ Description: "Відділення №5" }), false);
});

test("phone digits", () => assert.equal(npPhone("+380 (67) 123-45-67"), "380671234567"));
