# LiqPay — інтеграція

Джерело правди: офіційна документація LiqPay — <https://www.liqpay.ua/documentation/uk> (розділи «Checkout», «Підпис (signature)», «Callback», «Статуси платежів», «API»). Перед запуском у production **звірте** пункти, позначені 🔎, з актуальною документацією та кабінетом — назви пунктів меню в кабінеті можуть змінюватись.

## 1. Що саме реалізовано (і що ні)

| Що | Де в коді |
|---|---|
| Формування платіжного запиту `action=pay`, `version=3` | `src/services/payments/liqpay.ts` → `createPayment()` |
| Підпис `base64(sha1(private_key + data + private_key))`, `data = base64(JSON)` | `src/services/payments/liqpay-core.ts` |
| Перевірка підпису callback (constant-time) | `verifyLiqPaySignature()` |
| Мапінг статусів | `mapLiqPayStatus()` |
| Обробка події (ідемпотентність, транзакція, склад) | `src/services/payment-events.ts` → `applyPaymentEvent()` |
| Callback endpoint | `POST /api/payments/liqpay/callback` |
| Перевірка статусу «з нашого боку» (`action=status`) | `LiqPayProvider.fetchStatus()`, `reconcileOrderPayment()` |
| Повернення коштів (`action=refund`) | `LiqPayProvider.refund()` (кнопка в адмінці, лише ADMIN) |
| Тести | `tests/unit/liqpay*.test.ts`, `tests/integration/checkout-payment.test.ts` |

Формат підпису перевірено автотестом на **офіційному прикладі з документації** (`data` → `wR+UZDC4jjeL/qUOvIsofIWpZh8=`).

Параметри запиту, які ми надсилаємо: `version`, `public_key`, `action`, `amount`, `currency`, `description`, `order_id`, `language`, `result_url`, `server_url`, `expired_date`. Інших параметрів не використовуємо. Форма надсилається `POST` на `https://www.liqpay.ua/api/3/checkout` полями `data` і `signature`.

Не реалізовано (свідомо): підписки (`subscribed/unsubscribed` ігноруються), hold/capture, split-платежі, збереження карток. Їх можна додати в `LiqPayProvider`, не чіпаючи решту коду.

## 2. Де взяти ключі 🔎

1. Зареєструйтесь як бізнес на <https://www.liqpay.ua> і створіть **компанію** (потрібна верифікація юрособи/ФОП — це вимога LiqPay, не застосунку).
2. У бізнес-кабінеті відкрийте налаштування компанії → розділ **API** (у різних версіях кабінету — «Налаштування» → «API»).
3. Там — **Public key** (`i12345678901`) та **Private key**.
4. Для тестів LiqPay надає **тестовий (sandbox) режим/ключі** — див. розділ «Sandbox / тестовий режим» у документації. Тестові карти беріть тільки з документації.

| Що | Змінна | Куди вписати |
|---|---|---|
| Public key | `LIQPAY_PUBLIC_KEY` | `.env` / змінні хостингу |
| Private key | `LIQPAY_PRIVATE_KEY` | те саме. **Ніколи** не в git, не у frontend |
| Callback URL | `LIQPAY_CALLBACK_URL` | `https://ВАШ-ДОМЕН/api/payments/liqpay/callback` |
| Result URL | `LIQPAY_RESULT_URL` | `https://ВАШ-ДОМЕН/checkout/result` |
| Дозволити sandbox | `LIQPAY_ALLOW_SANDBOX` | `true` лише на dev/staging; **`false` у production** |

Private key читається тільки в `src/lib/env.ts` на сервері. У браузер потрапляють лише `data` та `signature`.

## 3. Callback URL і Result URL

* **Callback (`server_url`)** — сервер LiqPay шле `POST` (`application/x-www-form-urlencoded`, поля `data`, `signature`) на `POST /api/payments/liqpay/callback`. Ми передаємо цей URL **в кожному платіжному запиті**, тому окреме налаштування в кабінеті не обов'язкове. 🔎 Якщо в кабінеті також задано URL callback — він має збігатися з нашим.
* **Result (`result_url`)** — сторінка, на яку LiqPay повертає покупця: `/checkout/result?order=…&t=…`.
  **Повернення на цю сторінку нічого не доводить.** Вона лише показує стан із нашої БД, а за потреби сама робить серверний запит `action=status` до LiqPay.
* Callback має бути доступний із інтернету по HTTPS. Локально — тунель (`cloudflared tunnel --url http://localhost:3000`, ngrok тощо) і відповідний `LIQPAY_CALLBACK_URL`.

## 4. Як працює підпис

```
data      = base64( JSON({ version, public_key, action, amount, currency, order_id, ... }) )
signature = base64( sha1_binary( private_key + data + private_key ) )
```

Callback: беремо `data` і `signature` як прийшли, рахуємо підпис зі **своїм** private key і порівнюємо у постійному часі. Не збігається — `400`, нічого не обробляється.

## 5. Життєвий цикл замовлення й платежу

1. Checkout створює `Order` (`PAYMENT_PENDING`), `Payment` (`providerOrderId = <номер замовлення>-<спроба>`) і **резервує склад** в одній транзакції; сума береться з БД, не з браузера.
2. Браузер отримує `{url, data, signature}` і робить POST на LiqPay.
3. LiqPay надсилає callback → підпис → `applyPaymentEvent()`.
4. Успіх: `Payment=PAID`, `Order=PAID`, склад **підтверджується** (`stock -= n`, `reserved -= n`), `salesCount++`, лист клієнту.
5. Помилка: `Payment=FAILED`, замовлення лишається `PAYMENT_PENDING` — клієнт може повторити оплату (нова спроба `-2`, `-3`…). Резерв тримається до `reservationMinutes` (за замовчуванням 60).
6. Не сплачено вчасно: cron `release-reservations` спершу питає LiqPay про реальний статус, і лише тоді скасовує замовлення та звільняє склад.

### Мапінг статусів

| Статус LiqPay | Наш стан | Дія |
|---|---|---|
| `success`, `wait_compensation` | PAID | підтвердити продаж |
| `sandbox` (або `success` + `sandbox=1`) | PAID_SANDBOX | оплата лише якщо `LIQPAY_ALLOW_SANDBOX=true`, інакше ігнорується |
| `failure`, `error`, `try_again` | FAILED | платіж невдалий, можна повторити |
| `reversed` | REFUNDED | платіж повернено |
| `3ds_verify`, `otp_verify`, `cvv_verify`, `wait_secure`, `wait_accept`, `processing`, `hold_wait`, `invoice_wait`, … будь-які інші | PROCESSING | чекаємо фінального callback |
| `subscribed`, `unsubscribed` | IGNORED | — |

Консервативне правило: невідомий статус **ніколи** не робить замовлення оплаченим. `wait_secure` (перевірка антифродом) свідомо не вважається оплатою. 🔎 Якщо ваш договір з LiqPay передбачає інше трактування — змініть `mapLiqPayStatus()` і тест.

### Ідемпотентність і безпека

* `PaymentTransaction.eventKey` = HMAC від сирого `data`; однакові callback-и обробляються один раз (перевірено тестом на 20 паралельних дублікатів).
* `SELECT … FOR UPDATE` на рядку `Payment` серіалізує паралельні callback-и.
* Перевіряються `public_key` (наш), `amount` і `currency` (мають збігатися з очікуваними). Розбіжність → `rejected` + лист адміну.
* `PAID` не може «відкотитись» у `FAILED`; допускається лише `REFUNDED`.
* Оплата, що прийшла **після** скасування: резерв поновлюється, якщо товар ще є; якщо ні — статус «потрібне ручне повернення» + лист адміну.

Відповіді callback: `400` — підпис/формат; `200` — оброблено, дубль, проігноровано або бізнес-відмова (повтор не допоможе); `500` — внутрішня помилка (LiqPay повторить).

## 6. Як протестувати

1. `.env`: тестові ключі, `LIQPAY_ALLOW_SANDBOX=true`, публічний `LIQPAY_CALLBACK_URL` (тунель).
2. Оформіть замовлення способом «Картка онлайн», сплатіть тестовою карткою з документації LiqPay.
3. У логах сервера: `[liqpay-callback] { order: ..., status: 'sandbox' | 'success', outcome: 'processed' }`. У адмінці → замовлення → блок «Оплата» видно `raw`-статус кожної спроби, а в історії — «Оплату підтверджено платіжною системою».
4. Без LiqPay: можна вручну надіслати **правильно підписаний** callback (див. `tests/e2e/helpers.ts → sendLiqPayCallback`), або запустити `npm run test:integration`.
5. Перевірте негативні сценарії: підроблений підпис → `400`; повторний callback → `duplicate`; невірна сума → `rejected`.

## 7. Перехід у production

1. Отримайте бойові ключі (компанія повинна бути активована LiqPay). 🔎
2. У змінних хостингу: бойові `LIQPAY_PUBLIC_KEY` / `LIQPAY_PRIVATE_KEY`, **`LIQPAY_ALLOW_SANDBOX=false`**, `LIQPAY_CALLBACK_URL` та `LIQPAY_RESULT_URL` на ваш домен (HTTPS).
3. Зробіть реальний платіж на невелику суму → перевірте `PAID`, лист, склад → зробіть повернення з адмінки (`Повернути кошти`) → перевірте `REFUNDED`.
4. Налаштуйте cron (див. DEPLOYMENT.md), інакше прострочені резерви не звільнятимуться.
5. Налаштуйте сповіщення адміну (`ADMIN_EMAIL`) — саме туди йдуть листи про проблемні платежі.

## 8. Ендпоінти

| Метод | URL | Хто викликає |
|---|---|---|
| POST | `/api/payments/liqpay/callback` | сервер LiqPay |
| GET | `/checkout/result?order=…&t=…` | браузер покупця після оплати |
| POST | `https://www.liqpay.ua/api/3/checkout` | браузер покупця (форма `data`+`signature`) |
| POST | `https://www.liqpay.ua/api/request` | наш сервер (`status`, `refund`) |
| GET | `/api/cron/release-reservations` | планувальник, `Authorization: Bearer $CRON_SECRET` |
