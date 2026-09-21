# Production deployment

Архітектура: **Next.js застосунок** + **PostgreSQL** + **Cloudinary** (фото) + **LiqPay** + **Нова пошта** + **Resend/SMTP** + домен з HTTPS.

## Чек-лист перед публікацією

1. Створено PostgreSQL і `DATABASE_URL` (з `?sslmode=require`, якщо провайдер вимагає).
2. Міграції закомічені (`prisma/migrations`) — див. SETUP.md §2.
3. Заповнені змінні середовища (нижче). `LIQPAY_ALLOW_SANDBOX=false`.
4. `npm run db:constraints` виконано на production-БД (один раз).
5. `npm run db:seed -- --minimal` — категорії й адмін.
6. Юридичні сторінки перевірені юристом; у Адмінка → Налаштування → Магазин заповнені юрназва, ЄДРПОУ/ІПН, адреса, телефон, e-mail.
7. Налаштовано cron (див. §4).
8. Тестова покупка + повернення коштів (LIQPAY.md §7).

## Змінні середовища (production)

| Змінна | Значення |
|---|---|
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_SITE_URL` | `https://ваш-домен` (потрібна **під час збірки** — вона вбудовується в клієнтський код і middleware) |
| `DATABASE_URL` | рядок підключення PostgreSQL |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_TRUST_HOST` | `true` |
| `DATA_ENCRYPTION_KEY` | `openssl rand -hex 32` — **збережіть у менеджері паролів; без нього IMEI/serial не розшифрувати** |
| `STORE_NAME` | назва магазину (можна перевизначити в адмінці) |
| `LIQPAY_PUBLIC_KEY`, `LIQPAY_PRIVATE_KEY`, `LIQPAY_CALLBACK_URL`, `LIQPAY_RESULT_URL` | див. LIQPAY.md |
| `LIQPAY_ALLOW_SANDBOX` | `false` |
| `NOVA_POSHTA_API_KEY` + `NOVA_POSHTA_SENDER_*` | див. NOVA_POSHTA.md |
| `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY` або `SMTP_*`, `ADMIN_EMAIL` | пошта |
| `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` | фото |
| `CRON_SECRET` | `openssl rand -hex 24` |
| `UPSTASH_REDIS_REST_URL/TOKEN` | рекомендовано на serverless (rate limit між інстансами) |
| `GOOGLE_ANALYTICS_ID`, `GOOGLE_TAG_MANAGER_ID`, `META_PIXEL_ID` | необов'язково; також задаються в адмінці |

## 1. Vercel

1. Створіть БД (Neon / Supabase / Vercel Postgres) і скопіюйте `DATABASE_URL`.
2. Імпортуйте репозиторій у Vercel → Framework: Next.js.
3. **Build Command**: `npx prisma migrate deploy && npm run build` (міграції застосовуються перед збіркою).
4. Додайте змінні з таблиці вище (Production).
5. Deploy. Далі — з локальної машини один раз: `DATABASE_URL=<prod> npm run db:constraints && DATABASE_URL=<prod> npm run db:seed -- --minimal`.
6. Домен: Project → Settings → Domains → додайте домен і створіть DNS-записи, які покаже Vercel (A / CNAME). HTTPS-сертифікат випускається автоматично.
7. Оновіть `NEXT_PUBLIC_SITE_URL`, `LIQPAY_CALLBACK_URL`, `LIQPAY_RESULT_URL` на реальний домен і зробіть **Redeploy** (щоб `NEXT_PUBLIC_SITE_URL` потрапив у збірку).

`vercel.json` уже описує cron-задачі. ⚠ На плані Hobby cron обмежений (не частіше ніж раз на добу) — тоді використайте зовнішній планувальник (§4).

## 2. Власний сервер (Docker Compose)

```bash
git clone <repo> && cd idevice-store
cp .env.example .env && nano .env      # усі змінні; POSTGRES_PASSWORD — окремо
docker compose up -d --build
```

Поставте перед застосунком reverse-proxy з HTTPS. Приклад Caddy (`/etc/caddy/Caddyfile`), сертифікат Let's Encrypt автоматично:

```
shop.example.com {
    reverse_proxy 127.0.0.1:3000
    encode zstd gzip
}
```

DNS: `A`-запис `shop.example.com` → IP сервера. Порт 5432 прив'язаний лише до `127.0.0.1`. Бекапи: `docker compose exec db pg_dump -U idevice idevice | gzip > backup-$(date +%F).sql.gz` (cron щодня + зовнішнє сховище).

Оновлення: `git pull && docker compose up -d --build` (сервіс `migrate` застосує нові міграції).

## 3. Домен і листи

* Для Resend/SMTP додайте до DNS домену записи SPF/DKIM (Resend показує їх у панелі) — інакше листи потраплятимуть у спам.
* `EMAIL_FROM` має бути з верифікованого домену.

## 4. Cron

Потрібні два виклики (заголовок `Authorization: Bearer <CRON_SECRET>`):

| URL | Частота | Навіщо |
|---|---|---|
| `/api/cron/release-reservations` | кожні 10 хв | скасувати прострочені неоплачені замовлення, звільнити склад (перед цим перевіряється статус у LiqPay) |
| `/api/cron/sync-shipments` | кожні 1–2 год | оновити статуси Нової пошти |

Зовнішній планувальник (cron-job.org, GitHub Actions, systemd timer):

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://shop.example.com/api/cron/release-reservations
```

## 5. Після запуску

* Перевірте `GET /api/health` → `{"status":"ok"}`.
* Перевірте `robots.txt`, `sitemap.xml`, відсутність індексації `/admin`, `/account`, `/cart`, `/checkout`.
* Підключіть моніторинг (Sentry/Logtail/UptimeRobot) — застосунок пише структуровані `console.*` логи (`[liqpay-callback]`, `[payments]`, `[np]`).
* Заплануйте ротацію `AUTH_SECRET` і перегляд журналу дій (Адмін → Журнал дій).
* **Ротація `DATA_ENCRYPTION_KEY`** вимагає перешифрування `UsedDeviceSecret` (скрипту немає — не міняйте ключ без міграції даних).
