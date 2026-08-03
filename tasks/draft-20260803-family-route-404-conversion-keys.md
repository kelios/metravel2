# [BE-IMAGE][P2] Conversion-ключи с не-id первым сегментом отдают 404 на family-роуте — они адресуемы только через /media-resize/legacy/

> **Fallback-файл.** Карточка на общий MCP task board не заведена: 2026-08-03 API
> борда начал отвечать `401 {"detail":"Invalid token."}` и на запись, и на чтение
> (в начале сессии чтение работало). Импортировать на борд после замены staff-токена
> в `.secrets/metravel-task-board.env`.
>
> - kind: `bug` · area: `back` · status: `todo` · urgency: `medium` · sprint: 2 (Android Release)
> - assignee: `backend-owner` · reporter: `frontend`
> - related: #1204, #1168, #1200, #1175, #1136 · blocked_by: нет
> - блокирует: #1204

## Симптом

Часть conversion-ключей отдаётся **только** legacy-роутом `/media-resize/legacy/<key>`
и даёт **404** на штатном family-роуте `/travel-image/<key>`. Производная в S3 при
этом существует и корректна — проблема в адресации, а не в покрытии.

## Замер (прод, read-only GET, 2026-08-03, анонимно)

Один и тот же ключ, два роута:

```
3994/conversions/HcQK2WZBkjkvHnupzbuIPA9ulGbifqOiIvgmkOlG-detail_hd.jpg
  w=320   /media-resize/legacy/… → 200  image/webp  25 062 B  immutable
          /travel-image/…        → 404  application/json (23 B)
  w=1280  /media-resize/legacy/… → 200  x-metravel-image-transform: stored-derivative  immutable
          /travel-image/…        → 404  application/json
```

Для контраста — ключ, который отвечает обоими роутами:

```
155/conversions/PBxxUgYJSDeWyJw8Vm7sVzvrA1oq30ocPIiKz3WD-thumb_200.jpg?w=96
  /travel-image/…        → 200  stored-derivative
  /media-resize/legacy/… → 200  stored-derivative
```

## Причина — подтверждена, не гипотеза

Первый сегмент ключа трактуется как id записи, но им является **не всегда**:

```
GET /api/travels/155   → 200  {"id":155,"name":"Зимнее путешествие по Польше…"}
GET /api/travels/3994  → 404  {"detail":"Not found."}
```

Записи 3994 не существует → проверка владения на model-owned роуте не проходит →
404, хотя объект `d/v1/…` лежит в бакете и отдаётся legacy-роутом. Ключи класса
`<не-id>/conversions/<hash>-<variant>.<ext>` сейчас недостижимы штатным путём в принципе.

## Почему это важно

Оба вида URL живут на одной странице: на `/travels/ourvietnam` hero идёт через
`/media-resize/legacy/3994/…`, а превью — через `/travel-image/155/…`. Поэтому:

1. **#1204 (снять FE-rewrite на legacy) невозможен**, пока это не закрыто:
   снятие обхода даст не «те же адреса другим путём», а 404 на части медиа —
   независимо от того, покрыта ли предгенерация на 100%.
2. Legacy-роут нельзя вывести из эксплуатации, а значит и FE-код, который решает
   «этот ключ адресуется так, а тот иначе» (`toLegacyResizePath` в
   `utils/mediaUrl.ts` + зеркало в `scripts/generate-seo-pages.js`), остаётся навсегда.
3. #1168 (снять динамический ресайз) при живом втором роуте закрывает не весь трафик.

Это остаток, который **не** покрыт #1200: тот втянул legacy-ключи в предгенерацию
`d/v1` и научил legacy-роут читать производные (сделано, роут отдаёт
`stored-derivative`). Здесь речь о другом — о разрешении владения на family-роуте.

## Scope

- Резолвить владельца для ключей `**/conversions/**` из самого storage-ключа,
  а не по допущению «первый сегмент = id записи» (обратный индекс по ключу
  ImageField / явный маппинг — на усмотрение владельца бэка).
- Проверка владения **не ослабляется**: ключ, не принадлежащий ни одной записи,
  обязан по-прежнему давать 404. Открытого прокси по произвольному ключу быть не должно.
- Fail-closed сохраняется: неподдерживаемая ширина → 400/404, мастер целиком
  не отдаётся ни при каких условиях (регресс #1112/#1120/#1195).
- Чтение durable-производных (`d/v1/<master-key>/<width>.webp`) не меняется.

## Task Contract

- **Scope:** backend (media_assets, разрешение владения на model-owned роутах). Frontend не меняется.
- **User-visible result:** отсутствует — те же байты по тем же публичным URL.
- **Data/API contract:** публичные URL не меняются; новых объектов в S3 не создаётся.
- **Platform impact:** shared — desktop web, mobile web и Android берут одни и те же
  медиа-URL; mobile web и Android проверяются парно.
- **Localization impact:** none.
- **Dependencies:** нет. Производные уже лежат (#1200 done), механизм чтения на месте
  (#1136). Задача **блокирует** #1204 и завершает scope #1168.
- **Fallback policy:** пока не закрыто — FE-rewrite на `/media-resize/legacy/` остаётся;
  снимать его нельзя.

## Как проверить

1. Инвентаризация: собрать conversion-ключи из живого HTML/SSG-выдачи и для каждого
   сравнить family- и legacy-роут. **Ни одного ключа, который 200 через legacy и 404 через family.**

```
curl -s https://metravel.by/travels/ourvietnam \
  | grep -oE '(/media-resize/legacy/|/travel-image/)[^" ]*conversions/[^" ?]*' | sort -u
```

2. Контрольная пара (сейчас 404 / 200, должна стать 200 / 200):

```
curl -sI "https://metravel.by/travel-image/3994/conversions/HcQK2WZBkjkvHnupzbuIPA9ulGbifqOiIvgmkOlG-detail_hd.jpg?w=320"
curl -sI "https://metravel.by/media-resize/legacy/3994/conversions/HcQK2WZBkjkvHnupzbuIPA9ulGbifqOiIvgmkOlG-detail_hd.jpg?w=320"
```

   Совпадение: статус, `content-length`, `x-metravel-image-transform: stored-derivative`,
   `cache-control: public, max-age=31536000, immutable`.

3. Негативный тест владения: синтетический ключ вида
   `<любой>/conversions/<несуществующий-hash>.jpg` → 404 на обоих роутах.
4. Негативный тест ширины: ширина вне политики профиля → 400, ни одного ответа
   `source-pass-through` / `no-store` и ни одного ответа весом с мастер.
5. `make test`; `nginx -t` при правках конфига.

## Done gate

Каждый conversion-ключ, встречающийся в выдаче, отвечает family-роутом теми же
байтами, что и legacy; негативные пробы владения и ширины fail-closed; после этого
#1204 переводится из `blocked_by` в работу, а `/media-resize/legacy/` можно
планировать к выводу.
