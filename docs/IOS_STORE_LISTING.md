# App Store — карточка MeTravel (`by.metravel.app`)

Черновик пакета для [#1424](https://metravel.by/board#task-1424). Не submit.
Владелец сверяет поля в App Store Connect с этим файлом и с accepted
TestFlight build из #1423. Секреты, Team ID, demo-пароль и UDID сюда не
кладутся.

Версия в репозитории на момент черновика: `app.json` → `expo.version` 1.0.5,
`expo.ios.buildNumber` 9. Перед заполнением ASC сверить с выбранным билдом.

Лимиты Apple (2026): name 30, subtitle 30, description 4000, keywords 100,
promotional text 170. Основная локаль карточки — RU.

## RU

**Name (≤30):** `MeTravel`

**Subtitle (≤30):** `Маршруты и городские квесты`

**Promotional text (≤170):**

```
Реальные путешествия с картой, фото и городскими квестами. Планируйте поездку, сохраняйте места и гуляйте по городам с заданиями на точках.
```

**Description:**

```
MeTravel — путеводитель по реальным путешествиям. Внутри рассказы о поездках с точками на карте, городские квесты-прогулки и идеи, куда поехать на выходные.

ЧТО ВНУТРИ

• Путешествия с картой. Каждый маршрут — история с фотографиями, координатами и практическими деталями: как добраться, что посмотреть, сколько времени заложить.

• Интерактивная карта. Точки маршрутов на одной карте: стройте свой план и смотрите, что есть рядом.

• Городские квесты. Пешие маршруты-головоломки: на каждой точке — история места и задание, которое выполняют, стоя перед объектом.

• Поиск мест. Достопримечательности и природные локации по названию и на карте.

• Избранное. Сохраняйте маршруты и места, чтобы вернуться к ним перед поездкой.

• Планировщик поездок. Собирайте маршрут, отмечайте ночёвки и снаряжение.

• Вход через Apple, Google или Facebook. Данные аккаунта можно удалить из настроек приложения.

ДЛЯ КОГО

Для самостоятельной поездки без турагентства: Беларусь, ближнее зарубежье и популярные направления — с практической информацией от путешественников.

Сайт: https://metravel.by
Политика конфиденциальности: https://metravel.by/privacy
Поддержка: https://metravel.by/contact

Приложение бесплатное. Часть ссылок на бронирование отелей и туров — партнёрские. Покупок внутри приложения нет.
```

**Keywords (≤100):** `путешествия,карта,квесты,маршруты,туризм,беларусь,поездки,гид`

## BE

**Name:** `MeTravel`

**Subtitle:** `Маршруты і гарадскія квесты`

**Description:** той жа сэнс, што RU: рэальныя падарожжы з картай, гарадскія квесты, абранае, планавальнік. Сайт metravel.by. Бясплатна, без унутраных пакупак.

**Keywords:** `падарожжы,карта,квесты,маршруты,турызм,беларусь`

## UK

**Name:** `MeTravel`

**Subtitle:** `Маршрути та міські квести`

**Description:** той самий зміст, що RU: реальні подорожі з картою, міські квести, обране, планувальник. Сайт metravel.by. Безкоштовно, без внутрішніх покупок.

**Keywords:** `подорожі,карта,квести,маршрути,туризм`

## PL

**Name:** `MeTravel`

**Subtitle:** `Trasy i miejskie questy`

**Description:** ten sam zakres co RU: prawdziwe podróże z mapą, questy miejskie, ulubione, planer. Strona metravel.by. Bezpłatnie, bez zakupów w aplikacji.

**Keywords:** `podroze,mapa,questy,trasy,turystyka`

## EN

**Name:** `MeTravel`

**Subtitle:** `Routes and city quests`

**Promotional text:**

```
Real trips with maps and photos, plus city walking quests. Plan a route, save places, and explore with tasks at each stop.
```

**Description:**

```
MeTravel is a guide to real trips: mapped travel stories, city walking quests, and ideas for a weekend away.

INSIDE THE APP

• Travel stories with maps. Each route has photos, coordinates and practical notes: how to get there, what to see, how long to allow.

• An interactive map of route points so you can plan and see what is nearby.

• City quests. Walking puzzle routes: each stop has a local story and a task you do standing in front of the place.

• Place search by name and on the map.

• Favorites for routes and places.

• A trip planner for the route, overnights and packing.

• Sign in with Apple, Google or Facebook. You can delete your account from Settings.

WHO IT IS FOR

Independent travellers who plan their own trips. Belarus, nearby countries and popular destinations, with practical notes from people who went.

Website: https://metravel.by
Privacy: https://metravel.by/privacy
Support: https://metravel.by/contact

The app is free. Some hotel and tour links are affiliate. There are no in-app purchases.
```

**Keywords:** `travel,map,quests,routes,tourism,belarus,hiking`

## Категория и служебные поля

- Category: Travel
- Copyright: текущий год, MeTravel
- Support URL: `https://metravel.by/contact`
- Privacy URL: `https://metravel.by/privacy`
- Marketing URL: `https://metravel.by`
- Age rating: сверка с решением #1420 (без шокирующего контента, без UGC-модерации как соцсети)
- Price: Free, нет IAP
- Availability: сверка с #1420
- Encryption: `ITSAppUsesNonExemptEncryption: false` в `app.json`

## Скриншоты (owner / device)

Нужны правдивые снимки accepted TestFlight build из #1423, обязательный iPhone size.
Симулятор и макеты не заменяют. Не обещать функции, которых нет в этом билде.
iPad screenshots — отдельный набор, universal v1.

## App Review notes (без секретов)

Черновик для ASC, demo-пароль только в защищённом поле Connect:

- Приложение: маршруты, карта, квесты, планировщик поездок.
- Вход: Sign in with Apple обязателен (Guideline 4.8), также Google и Facebook.
- Удаление аккаунта: Настройки → удаление аккаунта (Guideline 5.1.1(v)).
- Разрешения: геолокация при использовании карты/квеста, камера и фото по действию пользователя, Face ID только если выбран биометрический вход.
- Демо-аккаунт: non-expiring, логин/пароль только в ASC, не в Git и не в этом файле.
- Export compliance: exempt encryption, как в Info.plist.

## Privacy

Сверка с #1416 и манифестом бинарника. Не копировать web GA4/Yandex в App Privacy, если native analytics выключен. Location / Photos / Account — по фактическому flow бинарника.

## Что остаётся владельцу

1. Выбрать accepted build #1423 в Connect.
2. Снять iPhone (и iPad) скриншоты с этого билда.
3. Вставить тексты выше, уложиться в лимиты Connect.
4. Заполнить demo account и contact только в ASC.
5. Подтвердить пакет в чате — после этого карточка #1424 может идти в testing/done. Submit (#1425 или отдельная команда) не выполняется здесь.
