# Безпека

## Що реалізовано

| Ризик | Захист | Де |
|---|---|---|
| Довіра до frontend (ціни, склад, оплата) | Сума, знижка, доставка, комісія рахуються **на сервері** з цін у БД (`computeOrderTotals`); склад резервується атомарним `UPDATE … WHERE stock - reserved >= n`; статус оплати змінює лише перевірений callback/status API | `services/orders.ts`, `services/inventory.ts`, `services/payment-events.ts` |
| Overselling / race conditions | Умовний `UPDATE` у транзакції + `CHECK (reservedStock <= stock)` у БД + упорядкування блокувань; тест на 10 паралельних покупців одного товару | `prisma/sql/constraints.sql`, `tests/integration/inventory.test.ts` |
| Підроблений платіж | Перевірка підпису LiqPay (constant-time), перевірка `public_key`/суми/валюти, ідемпотентність по `eventKey`, `FOR UPDATE`, sandbox ≠ гроші | `liqpay-core.ts`, `payment-events.ts` |
| Витік IMEI / serial / собівартості | Окрема таблиця `UsedDeviceSecret`; шифрування AES-256-GCM; публічні запити лише з явним `select`; DTO-мапери з whitelist + `assertNoSecrets`; тести; JSON-LD лише з DTO; audit-лог не містить значень | `lib/public-dto.ts`, `lib/crypto.ts`, `services/catalog.ts` |
| Паролі | bcrypt (cost 12, `bcryptjs`), політика довжини ≥10, вирівнювання часу для неіснуючих акаунтів, блокування після 8 невдалих спроб на 15 хв | `auth.ts`, `actions/auth.ts` |
| Перебір / спам | Rate limiting (login, реєстрація, відновлення, checkout, кошик, пошук, промокоди, підписка, відгуки, довідники НП); Upstash Redis або in-memory | `lib/rate-limit.ts` |
| Enumeration акаунтів | Однакові відповіді для реєстрації/відновлення пароля незалежно від існування e-mail | `actions/auth.ts` |
| Токени e-mail/reset | 256 біт випадковості, у БД лише SHA-256, одноразові, TTL, попередні анулюються | `lib/tokens.ts` |
| Сесії | Auth.js JWT, `HttpOnly`, `SameSite=Lax`, `Secure` у production, 14 днів; роль і `isActive` **перевіряються в БД** на кожній чутливій дії | `auth.config.ts`, `lib/authz.ts` |
| RBAC | Матриця дозволів (`lib/rbac.ts`), перевірка в middleware, layout і кожній Server Action/route | `lib/rbac.ts`, `lib/authz.ts` |
| IDOR | Замовлення/адреси/обране завжди фільтруються по `userId`; гостьові замовлення — HMAC-посилання | `services/order-queries.ts`, `lib/order-access.ts` |
| CSRF | Server Actions мають вбудовану перевірку Origin; для `POST /api/*` middleware вимагає `Origin` = наш сайт (виняток — callback LiqPay і cron, які захищені підписом/секретом) | `middleware.ts` |
| XSS | React екранує вивід; вхідні дані проходять `sanitizeText/Multiline`; JSON-LD екранується (`</script>`-safe); e-mail шаблони екранують дані | `lib/sanitize.ts`, `components/json-ld.tsx` |
| SQL injection | Prisma (параметризовані запити); у `$queryRaw`/`$executeRaw` — тільки tagged templates | скрізь |
| Відкриті редіректи | `safeRedirectPath` для `callbackUrl` | `lib/sanitize.ts` |
| Небезпечні зображення | Тільки URL Cloudinary-акаунта магазину або `/images/…` | `lib/images.ts` |
| Заголовки | CSP, HSTS (prod), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP; `X-Robots-Tag: noindex` для `/admin`, `/account` | `next.config.mjs` |
| Секрети | Лише змінні середовища на сервері, валідація zod; ключі не потрапляють у клієнтські бандли | `lib/env.ts` |
| Аудит | Дії адміна/персоналу з old/new, IP, User-Agent; секретні поля редагуються | `lib/audit.ts` |
| Cron | `Authorization: Bearer $CRON_SECRET`, порівняння в постійному часі; без секрету — 401 | `api/cron/*` |

## Відомі обмеження / компроміси (свідомі)

1. **CSP містить `'unsafe-inline'` для скриптів.** Next.js + GTM без per-request nonce цього вимагають; nonce робить усі сторінки динамічними й вимикає ISR. Якщо безпека важливіша за кеш — перейдіть на nonce-CSP через middleware (документація Next.js «Content Security Policy»).
2. **Rate limiting без Redis — per-process.** У serverless/кількох інстансах задайте `UPSTASH_REDIS_REST_*`.
3. **Ротація `DATA_ENCRYPTION_KEY` не автоматизована.** Ключ втрачено = IMEI/serial втрачено. Робіть бекап ключа окремо від БД.
4. **Немає 2FA** для адмінів. Рекомендовано додати (TOTP) перед масштабуванням команди, обмежити `/admin` по IP на рівні проксі.
5. **JWT-сесії не відкликаються миттєво** (лише через `isActive`/роль у БД при чутливих діях). Для примусового виходу змініть `AUTH_SECRET`.
6. Платіжні дані картки ніколи не проходять через наш сервер (LiqPay hosted checkout) — PCI-обсяг мінімальний, але це не звільняє від вимог договору з LiqPay.
7. **Відсутність перевірки в «живому» середовищі**: автор не мав доступу до вашого LiqPay/НП/БД; див. розділ «Що перевірено» в README.

## Чек-лист production

- [ ] `LIQPAY_ALLOW_SANDBOX=false`
- [ ] Унікальні `AUTH_SECRET`, `DATA_ENCRYPTION_KEY`, `CRON_SECRET` (не з прикладів)
- [ ] HTTPS увімкнено, HSTS активний, `NEXT_PUBLIC_SITE_URL=https://…`
- [ ] Пароль адміна змінено; зайві STAFF-акаунти відсутні
- [ ] БД недоступна з інтернету; щоденні бекапи + перевірка відновлення
- [ ] `npm audit` без критичних вразливостей; Dependabot/Renovate увімкнено
- [ ] Логи та алерти (5xx на `/api/payments/liqpay/callback`, `payment_alert` у замовленнях)
- [ ] Юридичні сторінки перевірені юристом
- [ ] Тестова покупка + повернення виконані на бойових ключах

## Повідомлення про вразливості

Вкажіть свою контактну адресу (наприклад `security@ваш-домен`) у `/.well-known/security.txt`.
