import { expect, test } from "@playwright/test";
import { sendLiqPayCallback } from "./helpers";

const email = `e2e+${Date.now()}@example.com`;
const password = "E2E-strong-password-1";

test.describe.serial("customer journey", () => {
  test("register -> (verify) -> login", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Ім'я").fill("Тест");
    await page.getByLabel("Прізвище").fill("Користувач");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Пароль").fill(password);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Зареєструватися" }).click();
    await expect(page.getByRole("status")).toContainText(/Акаунт створено|Перевірте пошту|Пароль змінено/);
    // With REQUIRE_EMAIL_VERIFICATION=false (recommended for the E2E environment) the account can sign in immediately.
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Пароль").fill(password);
    await page.getByRole("button", { name: "Увійти" }).click();
    await expect(page).toHaveURL(/\/account/);
  });

  test("browse catalog, filter used devices, open product with device diagnostics", async ({ page }) => {
    await page.goto("/catalog/iphone");
    await expect(page.getByRole("heading", { name: "iPhone", level: 1 })).toBeVisible();
    await page.goto("/catalog?condition=GOOD,FAIR,EXCELLENT");
    const first = page.locator("a[href^='/product/']").first();
    await first.click();
    await expect(page.getByRole("heading", { name: "Стан пристрою" })).toBeVisible();
    // IMEI / serial must never be in the rendered HTML
    const html = await page.content();
    expect(html).not.toMatch(/\b\d{15}\b/);
    expect(html.toLowerCase()).not.toContain("imei");
  });

  test("add to cart and see it in the cart", async ({ page }) => {
    await page.goto("/catalog/iphone");
    await page.locator("a[href^='/product/']").first().click();
    await page.getByRole("button", { name: "У кошик" }).click();
    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: "Кошик", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Оформити замовлення" })).toBeVisible();
  });

  test("public product API never exposes secrets", async ({ request }) => {
    const res = await request.get("/api/products?condition=GOOD,FAIR,EXCELLENT");
    expect(res.ok()).toBeTruthy();
    const text = await res.text();
    for (const forbidden of ["imei", "serial", "purchaseCost", "supplier", "internalNotes", "costPrice"]) expect(text.toLowerCase()).not.toContain(forbidden.toLowerCase());
  });

  test("callback endpoint rejects unsigned / forged requests", async ({ request }) => {
    const bad = await request.post("/api/payments/liqpay/callback", { form: { data: Buffer.from("{}").toString("base64"), signature: "forged" } });
    expect(bad.status()).toBe(400);
    const none = await request.post("/api/payments/liqpay/callback", { form: {} });
    expect(none.status()).toBe(400);
  });
});

test("payment flow (requires seeded product, NP key and LiqPay keys in the E2E environment)", async ({ page, request }) => {
  test.skip(!process.env.E2E_FULL_CHECKOUT, "set E2E_FULL_CHECKOUT=1 with NOVA_POSHTA_API_KEY + LIQPAY_* configured");
  await page.goto("/catalog/iphone");
  await page.locator("a[href^='/product/']").first().click();
  await page.getByRole("button", { name: "Купити зараз" }).click();
  await page.getByLabel("Ім'я").fill("Тест");
  await page.getByLabel("Прізвище").fill("Покупець");
  await page.getByLabel("Телефон").fill("+380671234567");
  await page.getByLabel("E-mail").fill(email);
  await page.getByPlaceholder(/Почніть вводити/).fill("Київ");
  await page.getByRole("option").first().click();
  await page.getByRole("option").first().click(); // first warehouse
  await page.getByRole("checkbox", { name: /оферти/ }).check();
  const [navigation] = await Promise.all([page.waitForRequest(/liqpay\.ua\/api\/3\/checkout/), page.getByRole("button", { name: "Перейти до оплати" }).click()]);
  const form = new URLSearchParams(navigation.postData() ?? "");
  expect(form.get("data")).toBeTruthy();
  expect(form.get("signature")).toBeTruthy();
  expect(navigation.postData()).not.toContain(process.env.LIQPAY_PRIVATE_KEY!);
  const payload = JSON.parse(Buffer.from(form.get("data")!, "base64").toString());
  // Redirect alone must not mark the order paid…
  await page.goto(`/checkout/result?order=${payload.order_id.replace(/-1$/, "")}`);
  // …the signed server callback does:
  const cb = await sendLiqPayCallback(request, { orderId: payload.order_id, amountUah: payload.amount });
  expect(cb.ok()).toBeTruthy();
});
