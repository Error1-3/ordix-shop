/**
 * Seed.  npm run db:seed              -> categories + admin + demo catalog (DEVELOPMENT ONLY)
 *        npm run db:seed -- --minimal -> categories + admin + default settings (safe for production)
 */
import { PrismaClient, type Condition, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { encryptField, hashIdentifier } from "../src/lib/crypto";
import { slugify } from "../src/lib/sanitize";

const db = new PrismaClient();
const minimal = process.argv.includes("--minimal");
const UAH = (n: number) => n * 100;

const CATEGORIES = [
  { slug: "iphone", name: "iPhone", nameEn: "iPhone", position: 1 },
  { slug: "ipad", name: "iPad", nameEn: "iPad", position: 2 },
  { slug: "macbook", name: "MacBook", nameEn: "MacBook", position: 3 },
  { slug: "imac", name: "iMac", nameEn: "iMac", position: 4 },
  { slug: "mac-mini", name: "Mac mini", nameEn: "Mac mini", position: 5 },
  { slug: "apple-watch", name: "Apple Watch", nameEn: "Apple Watch", position: 6 },
  { slug: "airpods", name: "AirPods", nameEn: "AirPods", position: 7 },
  { slug: "accessories", name: "Аксесуари Apple", nameEn: "Apple accessories", position: 8 },
];
const ACCESSORY_CHILDREN = [
  { slug: "chargers", name: "Зарядні пристрої", nameEn: "Chargers" }, { slug: "cables", name: "Кабелі", nameEn: "Cables" },
  { slug: "cases", name: "Чохли", nameEn: "Cases" }, { slug: "other-accessories", name: "Інші аксесуари", nameEn: "Other accessories" },
];

function luhnImei(seed: number): string {
  const body = `35${String(seed).padStart(12, "0")}`.slice(0, 14);
  let sum = 0;
  for (let i = 0; i < 14; i++) { let d = Number(body[13 - i]); if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9; } sum += d; }
  return body + ((10 - (sum % 10)) % 10);
}

async function main() {
  const catId: Record<string, string> = {};
  for (const c of CATEGORIES) catId[c.slug] = (await db.category.upsert({ where: { slug: c.slug }, create: c, update: { name: c.name, nameEn: c.nameEn, position: c.position } })).id;
  for (const [i, c] of ACCESSORY_CHILDREN.entries()) catId[c.slug] = (await db.category.upsert({ where: { slug: c.slug }, create: { ...c, parentId: catId.accessories, position: 20 + i }, update: { parentId: catId.accessories } })).id;

  const adminEmail = (process.env.SEED_ADMIN_EMAIL || "admin@example.com").toLowerCase();
  let pwd = process.env.SEED_ADMIN_PASSWORD;
  const generated = !pwd;
  if (!pwd) pwd = randomBytes(12).toString("base64url");
  await db.user.upsert({
    where: { email: adminEmail },
    create: { email: adminEmail, name: "Administrator", firstName: "Admin", lastName: "Store", role: "ADMIN", emailVerified: new Date(), passwordHash: await bcrypt.hash(pwd, 12) },
    update: {},
  });
  console.log(`✔ admin: ${adminEmail}${generated ? `  password (shown once): ${pwd}` : ""}`);

  if (minimal) { console.log("✔ minimal seed done"); return; }
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed DEMO data in production. Use --minimal.");
  if (!process.env.DATA_ENCRYPTION_KEY) throw new Error("DATA_ENCRYPTION_KEY is required to seed used devices (openssl rand -hex 32)");

  const IMG = { black: "/images/phone-black.svg", blue: "/images/phone-blue.svg", natural: "/images/phone-natural.svg", white: "/images/phone-white.svg", pink: "/images/phone-pink.svg" };
  type NewSpec = { storage: string; color: keyof typeof IMG; colorName: string; hex: string; price: number; stock: number };
  type UsedSpec = { storage: string; color: keyof typeof IMG; colorName: string; hex: string; condition: Condition; price: number; battery: number; cycles: number; grade: "A_PLUS" | "A" | "B" | "C"; defects?: string };
  const SPEC_IPHONE = [{ group: "Дисплей", items: [{ label: "Тип", value: "OLED Super Retina XDR" }, { label: "Частота", value: "60–120 Гц" }] }, { group: "Загальне", items: [{ label: "Чип", value: "Apple A-series" }, { label: "Захист", value: "IP68" }] }];

  async function phone(title: string, model: string, base: string, newVariants: NewSpec[], usedVariants: UsedSpec[], opts: { featured?: boolean; isNew?: boolean } = {}) {
    const slug = slugify(title);
    const all = [...newVariants.map((v) => v.price), ...usedVariants.map((v) => v.price)];
    const p = await db.product.upsert({
      where: { slug },
      create: {
        slug, title, model, brand: "Apple", categoryId: catId.iphone!, sku: base, price: UAH(Math.min(...all)), isFeatured: !!opts.featured, isNew: !!opts.isNew, hasUsed: usedVariants.length > 0,
        shortDescription: `${title} — ${usedVariants.length ? "нові та вживані екземпляри з діагностикою" : "новий, офіційна комплектація"}`,
        description: `${title}. Демо-опис для розробки. Кожен вживаний екземпляр має власні фото та звіт діагностики.`,
        specifications: SPEC_IPHONE as unknown as Prisma.InputJsonValue,
        faq: [{ q: "Чи розблокований пристрій?", a: "Так, усі пристрої без блокування оператором та iCloud." }] as unknown as Prisma.InputJsonValue,
        images: { create: [{ url: IMG.black, alt: title, isPrimary: true, position: 0 }] },
      },
      update: {},
    });
    let n = 0;
    for (const v of newVariants) {
      const sku = `${base}-N-${v.storage.replace(/\s/g, "")}-${v.color}`.toUpperCase();
      const variant = await db.productVariant.upsert({
        where: { sku }, update: {},
        create: { productId: p.id, sku, storage: v.storage, color: v.colorName, colorHex: v.hex, condition: "NEW", simType: "nano-SIM + eSIM", price: UAH(v.price), warrantyMonths: 12, position: n++, inventory: { create: { stock: v.stock } } },
      });
      await db.productImage.upsert({ where: { id: `img-${variant.id}` }, update: {}, create: { id: `img-${variant.id}`, productId: p.id, variantId: variant.id, url: IMG[v.color], alt: `${title} ${v.colorName}`, position: 1 } });
    }
    let unit = 0;
    for (const u of usedVariants) {
      unit++;
      const sku = `${base}-U-${unit}`.toUpperCase();
      const exists = await db.productVariant.findUnique({ where: { sku } });
      if (exists) continue;
      const seedNo = Math.abs([...sku].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % 1e11;
      const imei = luhnImei(seedNo);
      const variant = await db.productVariant.create({
        data: {
          productId: p.id, sku, storage: u.storage, color: u.colorName, colorHex: u.hex, condition: u.condition, price: UAH(u.price), compareAtPrice: UAH(Math.round(u.price * 1.12)), warrantyMonths: 3, position: 10 + unit,
          inventory: { create: { stock: 1, lowStockThreshold: 0 } },
          usedDevice: {
            create: {
              status: "READY", batteryHealth: u.battery, cycleCount: u.cycles, deviceGrade: u.grade, physicalCondition: u.grade === "A_PLUS" ? "PERFECT" : u.grade === "A" ? "MINOR_WEAR" : "VISIBLE_WEAR",
              screenCondition: u.grade === "C" ? "MINOR_WEAR" : "PERFECT", cameraCondition: "OK", faceIdStatus: "OK", trueToneStatus: "OK", speakerStatus: "OK", microphoneStatus: "OK", chargingPortStatus: "OK", wifiStatus: "OK", bluetoothStatus: "OK", simStatus: "OK",
              accessoriesIncluded: ["Кабель USB-C"], warrantyMonths: 3, defects: u.defects ?? null, inspectionNotes: "Демо-запис. Діагностика пройдена, iCloud чистий.", inspectedAt: new Date(),
              secret: { create: { imeiEncrypted: encryptField(imei), imeiHash: hashIdentifier(imei), serialEncrypted: encryptField(`DEMO${seedNo}`), serialHash: hashIdentifier(`DEMO${seedNo}`), purchaseCost: UAH(Math.round(u.price * 0.78)), supplier: "Demo supplier", purchaseSource: "trade-in", internalNotes: "seed data", testingChecklist: [{ item: "Face ID", passed: true }, { item: "Дисплей", passed: true }] as unknown as Prisma.InputJsonValue } },
            },
          },
        },
      });
      await db.productImage.create({ data: { productId: p.id, variantId: variant.id, url: IMG[u.color], alt: `${title} ${u.colorName} — цей екземпляр`, position: 20 + unit } });
    }
    await db.$executeRaw`UPDATE "Product" p SET "stock" = COALESCE((SELECT SUM(GREATEST(i."stock" - i."reservedStock",0)) FROM "ProductVariant" v JOIN "Inventory" i ON i."variantId"=v.id WHERE v."productId"=p.id AND v."isActive"),0) WHERE p.id = ${p.id}`;
  }

  await phone("iPhone 15 Pro", "iPhone 15 Pro", "IP15P", [
    { storage: "128 GB", color: "natural", colorName: "Natural Titanium", hex: "#b7aa98", price: 44999, stock: 5 }, { storage: "256 GB", color: "black", colorName: "Black Titanium", hex: "#2b2b2e", price: 49999, stock: 3 }, { storage: "256 GB", color: "blue", colorName: "Blue Titanium", hex: "#5b7a99", price: 49999, stock: 2 },
  ], [{ storage: "256 GB", color: "natural", colorName: "Natural Titanium", hex: "#b7aa98", condition: "EXCELLENT", price: 41500, battery: 93, cycles: 142, grade: "A" }], { featured: true, isNew: true });
  await phone("iPhone 16 Pro", "iPhone 16 Pro", "IP16P", [{ storage: "256 GB", color: "black", colorName: "Black Titanium", hex: "#2b2b2e", price: 56999, stock: 4 }, { storage: "512 GB", color: "white", colorName: "White Titanium", hex: "#d9d9dc", price: 65999, stock: 2 }], [], { featured: true, isNew: true });
  await phone("iPhone 17", "iPhone 17", "IP17", [{ storage: "256 GB", color: "blue", colorName: "Blue", hex: "#5b7a99", price: 42999, stock: 6 }, { storage: "256 GB", color: "white", colorName: "White", hex: "#d9d9dc", price: 42999, stock: 6 }], [], { featured: true, isNew: true });
  await phone("iPhone 14", "iPhone 14", "IP14", [{ storage: "128 GB", color: "blue", colorName: "Blue", hex: "#5b7a99", price: 27999, stock: 4 }], [
    { storage: "128 GB", color: "black", colorName: "Midnight", hex: "#2b2b2e", condition: "LIKE_NEW", price: 23500, battery: 97, cycles: 61, grade: "A_PLUS" },
    { storage: "256 GB", color: "pink", colorName: "Starlight", hex: "#e3b7be", condition: "GOOD", price: 21900, battery: 86, cycles: 402, grade: "B", defects: "Дрібні подряпини на рамці" },
  ], { featured: true });
  await phone("iPhone 13", "iPhone 13", "IP13", [], [
    { storage: "128 GB", color: "blue", colorName: "Blue", hex: "#5b7a99", condition: "EXCELLENT", price: 17900, battery: 91, cycles: 288, grade: "A" },
    { storage: "128 GB", color: "black", colorName: "Midnight", hex: "#2b2b2e", condition: "GOOD", price: 16200, battery: 84, cycles: 510, grade: "B", defects: "Сліди використання на корпусі" },
    { storage: "256 GB", color: "pink", colorName: "Pink", hex: "#e3b7be", condition: "FAIR", price: 15400, battery: 80, cycles: 640, grade: "C", defects: "Помітні подряпини на задній панелі" },
  ], { featured: true });

  const simple = async (title: string, model: string, cat: string, base: string, price: number, img: string, storage: string | null, color: string | null) => {
    const slug = slugify(title);
    const p = await db.product.upsert({ where: { slug }, update: {}, create: { slug, title, model, categoryId: catId[cat]!, sku: base, price: UAH(price), isFeatured: true, isNew: true, shortDescription: `${title} — демо-товар`, description: "Демо-опис для розробки.", images: { create: [{ url: img, alt: title, isPrimary: true }] } } });
    await db.productVariant.upsert({ where: { sku: `${base}-1` }, update: {}, create: { productId: p.id, sku: `${base}-1`, storage, color, condition: "NEW", price: UAH(price), inventory: { create: { stock: 8 } } } });
    await db.product.update({ where: { id: p.id }, data: { stock: 8 } });
  };
  await simple("MacBook Air 13 M3", "MacBook Air", "macbook", "MBA13M3", 52999, "/images/laptop.svg", "256 GB", "Midnight");
  await simple("iPad 10", "iPad", "ipad", "IPAD10", 17999, "/images/laptop.svg", "64 GB", "Blue");
  await simple("Apple Watch Series 10", "Apple Watch", "apple-watch", "AWS10", 19999, "/images/watch.svg", null, "Jet Black");
  await simple("AirPods Pro 2", "AirPods Pro", "airpods", "APP2", 9999, "/images/earbuds.svg", null, "White");
  await simple("Кабель USB-C — Lightning 1 м", "Lightning cable", "cables", "CBL-LTN1", 799, "/images/accessory.svg", null, "White");
  await simple("Зарядка 20W USB-C", "Power Adapter", "chargers", "CHG20W", 1199, "/images/accessory.svg", null, "White");

  await db.coupon.upsert({ where: { code: "WELCOME10" }, update: {}, create: { code: "WELCOME10", type: "PERCENT", value: 10, minOrderAmount: UAH(1000), perCustomerLimit: 1, categoryIds: [catId.accessories!, catId.cables!, catId.chargers!, catId.cases!] } });
  console.log("✔ demo catalog + coupon WELCOME10 (accessories only)");
}

main().then(() => db.$disconnect()).catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
