# Нова пошта — інтеграція

Джерело: офіційна документація API Нової пошти — <https://developers.novaposhta.ua/documentation>. API 2.0: один endpoint `https://api.novaposhta.ua/v2.0/json/`, метод `POST`, тіло `{ apiKey, modelName, calledMethod, methodProperties }`.

Уся логіка — в окремому сервісі `NovaPoshtaService` (`src/services/shipping/nova-poshta.ts`); checkout викликає його лише через HTTP-ендпоінти `/api/nova-poshta/*`, а створення ЕН — через `order-lifecycle.ts`.

## 1. API-ключ 🔎

1. Увійдіть в особистий кабінет бізнес-клієнта Нової пошти (`business.novaposhta.ua`).
2. **Налаштування → Безпека → Ключі API** (або аналогічний розділ) → створити ключ.
3. Вставте в `NOVA_POSHTA_API_KEY` (`.env` або змінні хостингу). Ключ використовується лише на сервері.

## 2. Дані відправника (потрібні для створення ЕН)

Один раз, після появи ключа:

```bash
NOVA_POSHTA_API_KEY=ваш_ключ npx tsx scripts/np-setup.ts
```

Скрипт реально викликає API (`Counterparty.getCounterparties`, `getCounterpartyContactPersons`, `getCounterpartyAddresses`) і друкує рядки для `.env`:

```
NOVA_POSHTA_SENDER_REF=…
NOVA_POSHTA_SENDER_CONTACT_REF=…
NOVA_POSHTA_SENDER_PHONE=…
NOVA_POSHTA_SENDER_WAREHOUSE_REF=…
NOVA_POSHTA_SENDER_CITY_REF=…
```

Якщо у кабінеті кілька контрагентів/адрес — виберіть потрібний набір.

## 3. Які методи API використовуються

| Задача | Model.method | У коді |
|---|---|---|
| Пошук міста/населеного пункту | `Address.searchSettlements` (`CityName`, `Limit`, `Page`) | `searchCities()` → `GET /api/nova-poshta/cities?q=` |
| Відділення й поштомати міста | `Address.getWarehouses` (`CityRef`, `FindByString`, `Limit`, `Page`, `Language`); при помилці — одноразовий fallback на `AddressGeneral.getWarehouses` | `getWarehouses()` → `GET /api/nova-poshta/warehouses?cityRef=&kind=warehouse\|locker&q=` |
| Отримувач | `Counterparty.save` (`PrivatePerson`, `Recipient`) | `createRecipient()` |
| Створення ЕН | `InternetDocument.save` | `createShipment()` |
| Трекінг | `TrackingDocument.getStatusDocuments` | `track()` |

* **Місто**: користувач вводить ≥2 символів → список `present` (напр. «м. Київ, Київська обл.»). Для запитів відділень використовується `DeliveryCity` як `CityRef`.
* **Відділення / поштомат**: розрізняються за `CategoryOfWarehouse` (`Postomat` ↔ інші); UUID типів у коді не зашиті.
* **Післяплата**: у ЕН додається `BackwardDeliveryData: [{ PayerType: "Recipient", CargoType: "Money", RedeliveryString: "<сума в грн>" }]`.
* Оголошена вартість `Cost` = сума замовлення, вага = сума `weightGrams` варіантів (налаштовується в товарі).

## 4. Створення ЕН і ТТН

Адмінка → Замовлення → відкрити замовлення → **«Створити ТТН Нової пошти»**. Умови: доставка у відділення/поштомат; для онлайн-оплати — платіж підтверджений. Номер ЕН (`IntDocNumber`) зберігається в `NovaPoshtaShipment.trackingNumber` і показується клієнту.

Кур'єрська доставка: автоматичне створення не підтримується (потрібен `StreetRef`/будинок із довідників НП). Створіть ЕН у кабінеті НП і додайте номер вручну кнопкою «Додати ТТН вручну».

## 5. Статус доставки

Cron `GET /api/cron/sync-shipments` (кожні ~2 год) опитує `getStatusDocuments` і:
* оновлює статус на сторінці замовлення клієнта;
* `PACKED → SHIPPED`, коли посилка в дорозі; `→ DELIVERED`, коли одержувач забрав (коди 9/10/11).

Мапінг кодів — `mapNpStatusCode()` у `nova-poshta-core.ts`. 🔎 Перед запуском звірте коди зі списком статусів у документації; невідомі коди мапляться в `UNKNOWN` і **не** змінюють статус замовлення.

## 6. Комісія та вартість доставки

Застосунок **не вгадує тарифи** перевізника. Комісія післяплати (`codCommissionPercent`, `codCommissionFixed`) і фіксована вартість доставки задаються в Адмінка → Налаштування → Оплата / Доставка (за замовчуванням 0; доставка «за тарифами перевізника», сплачується при отриманні).

## 7. Обмеження

* Без `NOVA_POSHTA_API_KEY` вибір міста/відділення не працює → оформити замовлення неможливо (свідомо: жодного «фейкового» довідника).
* Потрібен реальний ключ і дані відправника для створення ЕН; це не можна перевірити без вашого акаунта НП — автотести використовують mock відповіді API (`tests/unit/nova-poshta-service.test.ts`).
