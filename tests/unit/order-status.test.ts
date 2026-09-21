import { test } from "node:test";
import assert from "node:assert/strict";
import { ORDER_STATUSES, allowedNext, canTransition, holdsReservation, isTerminal } from "@/lib/order-status";

test("happy path", () => {
  const path = ["PENDING", "PAYMENT_PENDING", "PAID", "PROCESSING", "PACKED", "SHIPPED", "DELIVERED"] as const;
  for (let i = 0; i < path.length - 1; i++) assert.ok(canTransition(path[i], path[i + 1]), `${path[i]} -> ${path[i + 1]}`);
});

test("cannot skip backwards or from terminal states", () => {
  assert.equal(canTransition("DELIVERED", "PENDING"), false);
  assert.equal(canTransition("CANCELLED", "PAID"), false);
  assert.equal(canTransition("SHIPPED", "CANCELLED"), false); // shipped goods are returned, not cancelled
  assert.equal(canTransition("PAID", "PAID"), false);
});

test("terminal states have no transitions", () => {
  for (const s of ORDER_STATUSES) assert.equal(isTerminal(s), allowedNext(s).length === 0);
  assert.ok(isTerminal("CANCELLED"));
  assert.ok(isTerminal("REFUNDED"));
});

test("only unpaid orders hold reservations", () => {
  assert.ok(holdsReservation("PENDING"));
  assert.ok(holdsReservation("PAYMENT_PENDING"));
  assert.equal(holdsReservation("PAID"), false);
});
