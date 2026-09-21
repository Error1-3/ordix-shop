import { test } from "node:test";
import assert from "node:assert/strict";
import { assertNoSecrets, toPublicProduct, type ProductRow } from "@/lib/public-dto";

// A DB row exactly as a careless query could return it: including secrets.
const dirtyRow = {
  id: "p1", slug: "iphone-13", title: "iPhone 13", model: "iPhone 13", brand: "Apple", shortDescription: "s", description: "d",
  price: 1500000, compareAtPrice: null, costPrice: 1000000, isNew: false, hasUsed: true, ratingSum: 9, ratingCount: 2,
  category: { slug: "iphone", name: "iPhone" },
  images: [{ id: "i1", url: "https://x/1.jpg", alt: "a", variantId: null, isPrimary: true, publicId: "cloud/1" }],
  variants: [{
    id: "v1", sku: "S1", storage: "128 GB", color: "Blue", colorHex: null, condition: "EXCELLENT", simType: null, connectivity: null,
    price: 1500000, compareAtPrice: null, costPrice: 1000000, warrantyMonths: 12, isActive: true,
    inventory: { stock: 3, reservedStock: 1 },
    usedDevice: {
      batteryHealth: 92, cycleCount: 210, deviceGrade: "A", physicalCondition: "MINOR_WEAR", screenCondition: "PERFECT",
      cameraCondition: "OK", faceIdStatus: "OK", touchIdStatus: "NOT_APPLICABLE", trueToneStatus: "OK", speakerStatus: "OK",
      microphoneStatus: "OK", chargingPortStatus: "OK", wifiStatus: "OK", bluetoothStatus: "OK", simStatus: "OK",
      accessoriesIncluded: ["Кабель"], warrantyMonths: 3, defects: null, inspectionNotes: "ok",
      // secrets that must never survive mapping:
      secret: { imeiEncrypted: "v1:aaa", serialEncrypted: "v1:bbb", purchaseCost: 900000, supplier: "X", internalNotes: "n" },
      imei: "356938035643809", serialNumber: "F2LXK1",
    },
  }],
} as unknown as ProductRow;

test("toPublicProduct drops IMEI, serial, cost and supplier data even if the row contains them", () => {
  const dto = toPublicProduct(dirtyRow);
  const json = JSON.stringify(dto);
  for (const needle of ["356938035643809", "F2LXK1", "imeiEncrypted", "serialEncrypted", "900000", "supplier", "internalNotes", "1000000", "cloud/1"]) {
    assert.ok(!json.includes(needle), `leaked: ${needle}`);
  }
  assert.doesNotThrow(() => assertNoSecrets(dto));
});

test("public variant exposes capped availability, not raw stock/reserved counters", () => {
  const dto = toPublicProduct(dirtyRow);
  assert.equal(dto.variants[0].available, 2);
  assert.ok(!("stock" in dto.variants[0]) && !("reservedStock" in dto.variants[0]));
  assert.equal(dto.variants[0].usedDevice?.batteryHealth, 92);
  assert.equal(dto.bestBatteryHealth, 92);
});

test("assertNoSecrets catches leaks at any depth", () => {
  assert.throws(() => assertNoSecrets({ a: [{ b: { imei: "1" } }] }));
  assert.throws(() => assertNoSecrets({ costPrice: 1 }));
  assert.doesNotThrow(() => assertNoSecrets({ price: 1, title: "x" }));
});

test("sold-out product is reported as not in stock", () => {
  const row = structuredClone(dirtyRow) as any;
  row.variants[0].inventory = { stock: 1, reservedStock: 1 };
  assert.equal(toPublicProduct(row).inStock, false);
});
