# iDevice Store — інтернет-магазин техніки Apple (Україна)

Повноцінний e-commerce: **Next.js 15 (App Router) + TypeScript + PostgreSQL/Prisma + Auth.js + LiqPay + Нова пошта**, адмін-панель, система вживаних/refurbished пристроїв, склад із захистом від overselling, Docker, тести, документація.

- Ринок: Україна · мова `uk-UA` (словники `en` підготовлені) · валюта **UAH ₴** (усі суми — цілі числа в копійках, жодних float)
- Назва магазину — `STORE_NAME` / Адмінка → Налаштування. Логотип Apple не використовується; у футері є застереження, що магазин не є офіційним представником Apple.

> ⚠ **Статус перевірки — прочитайте.** Проєкт створено в середовищі **без доступу до npm registry, PostgreSQL, LiqPay та Нової пошти**. Тому:
> **Перевірено (реально запущено):** 70 unit-тестів (гроші, знижки/купони, статуси замовлень, RBAC, шифрування, санітизація, підпис LiqPay на **офіційному прикладі документації**, статуси платежів, LiqPayProvider, NovaPoshtaService на mock-API, витік секретів у публічних DTO); синтаксичний розбір усіх 186 TS/TSX-файлів; резолв усіх імпортів; відповідність залежностей `package.json`; strict-typecheck модулів без зовнішніх залежностей; аудит витоку серверного коду/секретів у клієнтські бандли.
> **НЕ запускалось (потрібне ваше середовище):** `npm install`, `prisma migrate`, `next build`, `lint`, повний `tsc` (типи Next/React/Prisma), інтеграційні тести з БД (написані, у sandbox пропускаються), E2E Playwright, реальні виклики LiqPay/НП. Першим кроком виконайте `npm run check` і, якщо буде помилка типів чи збірки — це очікуваний етап «перший запуск»; повідомте її текст. Версії пакетів (`^` діапазони) підібрані за знаннями автора без звірки з registry.

## Швидкий старт

```bash
npm install
cp .env.example .env            # AUTH_SECRET, DATA_ENCRYPTION_KEY, DATABASE_URL, …
npx prisma migrate dev --name init && npm run db:constraints
npm run db:seed                 # демо-каталог (лише dev)
npm run dev
```
Або `docker compose up --build`. Докладно — [docs/SETUP.md](docs/SETUP.md).

## Документація

| Файл | Зміст |
|---|---|
| [docs/SETUP.md](docs/SETUP.md) | локальний запуск, БД, seed, тести |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Vercel і власний сервер, домен, HTTPS, cron, змінні |
| [docs/LIQPAY.md](docs/LIQPAY.md) | ключі, callback/result URL, підпис, тестування, перехід у production |
| [docs/NOVA_POSHTA.md](docs/NOVA_POSHTA.md) | ключ, відправник, довідники, ЕН, ТТН, статуси |
| [docs/ADMIN.md](docs/ADMIN.md) | ролі, товари, вживані пристрої, замовлення |
| [docs/SECURITY.md](docs/SECURITY.md) | що захищено, обмеження, чек-лист |
| [docs/API.md](docs/API.md) | HTTP-ендпоінти та Server Actions |

## Структура

```
prisma/            schema.prisma, seed.ts, sql/constraints.sql (CHECK-обмеження складу)
src/app/           сторінки: /, /catalog, /product, /cart, /checkout, /order, /account/*, /admin/*, /legal/*, /api/*
src/actions/       Server Actions (auth, cart, checkout, account, admin-*)
src/services/      catalog, cart, orders, inventory, payment-events, order-lifecycle,
                   payments/ (PaymentProvider, LiqPayProvider), shipping/ (NovaPoshtaService), email/
src/lib/           money, pricing, order-status, rbac, crypto, sanitize, validators, public-dto, env, settings, seo …
src/components/    UI (shadcn-подібні примітиви на Radix), товар, фільтри, кошик, checkout, адмін-редактори
src/messages/      uk.json (повний), en.json (стартовий)
tests/             unit · integration (реальна БД) · e2e (Playwright) · stubs
docs/              документація
```

## Ключові рішення

* **Гроші** — `Int` у копійках; `formatMoney()` → `1 299 ₴`; на межі з LiqPay — точна конвертація.
* **Оплата** — `PaymentProvider` (додати WayForPay/MonoPay = ще один клас). Оплатою вважається лише перевірений callback (або серверний `status`); редирект нічого не доводить.
* **Склад** — резерв при checkout (атомарний `UPDATE … WHERE`), підтвердження при оплаті, звільнення при скасуванні/простроченні (cron), плюс `CHECK`-обмеження в БД.
* **Вживані** — окрема таблиця публічних фактів (`UsedDevice`) і приватних (`UsedDeviceSecret`, IMEI/serial шифруються). Фото прив'язуються до конкретного екземпляра.
* **Кеш/ISR** — публічні сторінки не читають cookies (стан кошика/акаунта підтягується клієнтом через `/api/me`); дані каталогу кешуються з тегом `catalog` і скидаються при змінах в адмінці.
* **i18n** — тексти лише в `src/messages/*.json`. Публічні сторінки рендеряться в `uk` (щоб не вимикати кеш); для `/en` додайте сегмент `[locale]` (словник уже є).
* **Юридичні сторінки** — структуровані шаблони з позначками `[УТОЧНІТЬ: …]`; не є юридичною консультацією.

## Ліцензія / торгові марки

Apple, iPhone, iPad, MacBook, Apple Watch, AirPods — торговельні марки Apple Inc. Проєкт не пов'язаний з Apple.
