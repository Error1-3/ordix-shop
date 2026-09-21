# API

Основний спосіб взаємодії з бекендом — **Server Actions** (форми, кошик, checkout, адмінка) і серверні компоненти. Нижче — HTTP-ендпоінти (`src/app/api/*`).

Загальне: JSON; помилки `{ "error": "code" }`; ліміти — `429` + `Retry-After`. Мутуючі `POST` вимагають `Origin` вашого сайту (CSRF), крім позначених.

## Публічні (без авторизації)

| Метод | URL | Опис |
|---|---|---|
| GET | `/api/health` | `{status:"ok", db:"up"}` або `503`. Для моніторингу/Docker healthcheck |
| GET | `/api/products` | Каталог із фільтрами. Query: `q, category, model, condition (CSV), storage (CSV), color (CSV), brand, minPrice, maxPrice (₴), minBattery, minWarranty, inStock=1, sort=recommended\|newest\|price_asc\|price_desc\|popular, page`. Відповідь: `{items: PublicProductCard[], total, page, pages}` (24/стор.) |
| GET | `/api/search/suggest?q=` | `{products: PublicProductCard[], models: string[]}` (мін. 2 символи) |
| GET | `/api/nova-poshta/cities?q=` | `{cities: [{ref, settlementRef, name, area, region, present}]}` |
| GET | `/api/nova-poshta/warehouses?cityRef=&kind=warehouse\|locker&q=` | `{warehouses: [{ref, number, name, address, kind, maxWeightKg}]}` |
| GET | `/api/me` | `{user:{name,role}\|null, cartCount, wishlist:[productId]}` (`private, no-store`) |

Усі публічні відповіді про товари проходять `assertNoSecrets()`: IMEI, serial, собівартість, постачальник, внутрішні нотатки та точні залишки **ніколи** не повертаються.

`PublicProductCard`: `{id, slug, title, model, brand, shortDescription, price (копійки), compareAtPrice, isNew, hasUsed, inStock, ratingAvg, ratingCount, image, conditions[], bestBatteryHealth}`. Усі суми — цілі числа в копійках.

## Платежі

| Метод | URL | Опис |
|---|---|---|
| POST | `/api/payments/liqpay/callback` | Callback LiqPay. Тіло `application/x-www-form-urlencoded` (`data`, `signature`) або JSON. `400` — підпис/формат, `200 {ok:true,result}` — оброблено/дубль/ігноровано, `500` — повтор. **Без CSRF-перевірки** (захищено підписом) |

## Адмін / службові

| Метод | URL | Доступ |
|---|---|---|
| POST | `/api/upload/sign` | STAFF/ADMIN (`products.write`). Повертає підписані параметри Cloudinary; `501`, якщо Cloudinary не налаштований |
| GET | `/api/cron/release-reservations` | `Authorization: Bearer $CRON_SECRET` |
| GET | `/api/cron/sync-shipments` | `Authorization: Bearer $CRON_SECRET` |
| * | `/api/auth/*` | Auth.js (signin/session/csrf/signout) |

## Server Actions (за модулями)

| Файл | Дії |
|---|---|
| `actions/auth.ts` | register, login, logout, forgotPassword, resetPassword, resendVerification, changePassword |
| `actions/cart.ts` | addToCart, updateCartQuantity, applyCoupon, removeCoupon |
| `actions/checkout.ts` | placeOrder (створює Order+Payment, повертає параметри LiqPay), retryPayment |
| `actions/account.ts` | updateProfile, saveAddress, deleteAddress, toggleWishlist, submitReview, cancelOwnOrder, subscribeNewsletter |
| `actions/admin-products.ts` | saveProduct, setProductActive, deleteProduct (soft), duplicateProduct |
| `actions/admin-orders.ts` | changeStatus, createShipment, attachTtn, refund, addNote |
| `actions/admin-misc.ts` | saveCoupon, deleteCoupon, moderateReview, saveSettings, setUserRole, setUserActive |

Кожна дія: валідація zod → перевірка прав (`requirePermission`) → бізнес-логіка в `services/*` → audit.

## Сторінки, що не індексуються

`/admin/*`, `/account/*`, `/cart`, `/checkout*`, `/order/*`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` (`robots.txt` + `X-Robots-Tag`/`noindex`).
