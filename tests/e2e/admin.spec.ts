import { expect, test } from "@playwright/test";

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

test.describe("admin", () => {
  test.skip(!email || !password, "set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD (seeded admin)");

  test("anonymous users are redirected away from /admin", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("admin logs in, creates a product with a used variant, sees it in the list", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email!);
    await page.getByLabel("Пароль").fill(password!);
    await page.getByRole("button", { name: "Увійти" }).click();
    await expect(page).toHaveURL(/\/admin/);

    await page.goto("/admin/products/new");
    const title = `E2E iPhone ${Date.now()}`;
    await page.getByLabel("Назва").fill(title);
    await page.getByLabel(/^Модель/).fill("iPhone E2E");
    await page.getByLabel(/Артикул товару/).fill(`E2E-${Date.now()}`);
    await page.getByRole("tab", { name: "Варіанти" }).click();
    await page.getByLabel("Артикул", { exact: true }).first().fill(`E2EV-${Date.now()}`);
    await page.getByLabel("Ціна, ₴").first().fill("12 999");
    await page.getByRole("button", { name: "Зберегти" }).click();
    await expect(page).toHaveURL(/\/admin\/products\/[a-z0-9]+$/);
    await page.goto(`/admin/products?q=${encodeURIComponent(title)}`);
    await expect(page.getByText(title)).toBeVisible();
  });

  test("admin can open the orders list and an order (status actions visible)", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email!);
    await page.getByLabel("Пароль").fill(password!);
    await page.getByRole("button", { name: "Увійти" }).click();
    await page.goto("/admin/orders");
    await expect(page.getByRole("heading", { name: "Замовлення" })).toBeVisible();
    const link = page.locator("a[href^='/admin/orders/']").first();
    if (await link.count()) { await link.click(); await expect(page.getByText("Дії із замовленням")).toBeVisible(); }
  });
});
