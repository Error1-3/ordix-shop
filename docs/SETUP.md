# Локальний запуск

Потрібно: Node.js ≥ 20.11 (рекомендовано 22), npm, PostgreSQL 15+ (або Docker).

## 1. Залежності та змінні

```bash
npm install
cp .env.example .env
openssl rand -base64 32     # → AUTH_SECRET
openssl rand -hex 32        # → DATA_ENCRYPTION_KEY (шифрування IMEI/serial; 64 hex-символи)
```

Для першого запуску достатньо: `DATABASE_URL`, `AUTH_SECRET`, `DATA_ENCRYPTION_KEY`, `NEXT_PUBLIC_SITE_URL`.
Без `EMAIL_PROVIDER` листи друкуються в консоль (`EMAIL_PROVIDER=console`), тому для розробки задайте `REQUIRE_EMAIL_VERIFICATION=false` або беріть посилання підтвердження з логів.

## 2. База даних

PostgreSQL у Docker:

```bash
docker run -d --name idevice-pg -e POSTGRES_USER=idevice -e POSTGRES_PASSWORD=idevice -e POSTGRES_DB=idevice -p 5432:5432 postgres:16-alpine
```

Схема та міграції:

```bash
npm run db:generate                 # prisma generate
npx prisma migrate dev --name init  # створює prisma/migrations/… — ЗАКОМІТЬТЕ цю папку
npm run db:constraints              # CHECK-обмеження складу (reserved ≤ stock тощо), ідемпотентно
```

> У репозиторії немає готових міграцій: їх генерує Prisma під вашу версію. Після `migrate dev --name init` у git з'являється `prisma/migrations`, і далі на серверах використовується `npx prisma migrate deploy`.
> Швидкий варіант для розробки без міграцій: `npm run db:push`.

## 3. Seed

```bash
npm run db:seed                # категорії + адмін + ДЕМО-каталог (лише dev!) + промокод WELCOME10
npm run db:seed -- --minimal   # категорії + адмін (безпечно для production)
```

Адмін: `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. Якщо пароль не задано — буде згенеровано й показано **один раз** у консолі.
Демо-seed відмовляється працювати при `NODE_ENV=production`.

## 4. Запуск

```bash
npm run dev          # http://localhost:3000
```

Для оформлення замовлень потрібні `NOVA_POSHTA_API_KEY` (довідник міст/відділень) і, для картки, `LIQPAY_*` (див. LIQPAY.md).

## 5. Перевірки

```bash
npm run lint
npm run typecheck
npm test                       # unit-тести (node:test через tsx), БД не потрібна
# інтеграційні тести з реальною БД:
export TEST_DATABASE_URL=postgresql://idevice:idevice@localhost:5432/idevice_test
DATABASE_URL=$TEST_DATABASE_URL npx prisma db push --force-reset && DATABASE_URL=$TEST_DATABASE_URL npm run db:constraints
npm run test:integration
# E2E (Playwright)
npx playwright install chromium
npm run build && npm run test:e2e        # E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD для адмін-сценаріїв
npm run check                            # lint + typecheck + test + build
```

## 6. Docker Compose (весь стек)

```bash
cp .env.example .env    # заповніть AUTH_SECRET, DATA_ENCRYPTION_KEY, ключі інтеграцій
docker compose up --build
```

Сервіси: `db` (Postgres + healthcheck) → `migrate` (одноразово: міграції/`db push`, constraints, мінімальний seed) → `app` (healthcheck `/api/health`). Сайт: <http://localhost:3000>.

## 7. Корисне

| Задача | Команда |
|---|---|
| Prisma Studio | `npm run db:studio` |
| Дані відправника НП | `NOVA_POSHTA_API_KEY=… npx tsx scripts/np-setup.ts` |
| Скинути БД (dev) | `npx prisma migrate reset` |
