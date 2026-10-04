# Фича: export (PDF-книга, печать и выгрузка маршрута)

**Последняя актуализация:** 2026-08-17

**Ответственный домен:** frontend export/print

## TL;DR

Под «экспортом» в MeTravel живут три несвязанных контура: **PDF-книга
путешествий** (сборка — web, печать — `printHtml`), **печатная версия квеста**
(HTML-документ для печати) и **выгрузка маршрута поездки** в GPX/KML
(работает и на native, но разными механизмами сохранения). Общего движка у них
нет — объединяет их только то, что результат уходит из приложения наружу.

## Границы

| В этой карте | Где живёт остальное |
| --- | --- |
| три контура экспорта, их пайплайны и ограничения | — |
| подготовка картинок к печати (`printImageUrl`) | лестницы ширин и контракт прокси — `docs/features/images.md` |
| данные путешествия | `docs/features/travel.md` |
| планировщик маршрута, откуда берутся точки | `docs/features/trips.md` |
| контент квеста | `docs/features/quests.md` |

## Контур 1 — PDF-книга путешествий

### Точки входа

| Путь | Назначение |
| --- | --- |
| `app/(tabs)/export.tsx` (155) | экран выбора своих путешествий для книги; требует авторизации |
| `components/travel/TravelPdfExportControl.tsx` (113) | запуск экспорта с карточки/детали путешествия |
| `components/listTravel/ListTravelExportControls.tsx` (361) | выбор и запуск из списка |

### Пайплайн

```
BookSettingsModal
  → usePdfExport / usePdfExportRuntime
  → BookHtmlExportService
  → TravelDataTransformer
  → EnhancedPdfGenerator (публичная точка v2)
  → HTML → openBookPreviewWindow → печать браузера
```

| Файл | LOC | Зона ответственности |
| --- | --- | --- |
| `components/export/BookSettingsModal.tsx` | 779 | модалка настроек, валидация, сохранение выбора |
| `components/export/ThemePreview.tsx` | 765 | превью тем |
| `components/export/PresetSelector.tsx` | 462 | пресеты книги |
| `components/export/GalleryLayoutSelector.tsx` | 280 | раскладки галереи |
| `hooks/usePdfExportRuntime.ts` | 354 | стадии прогона, прогресс, ошибки |
| `services/book/BookHtmlExportService.ts` | 345 | оркестрация сборки HTML |
| `services/pdf-export/TravelDataTransformer.ts` | 493 | валидация и нормализация выбранных путешествий |
| `services/pdf-export/**` | ~12 700 суммарно | генератор v2, страницы, рендереры, темы, парсеры rich text |

Темы лежат в `services/pdf-export/themes/configs/` (`classic`, `modern`,
`minimal`, `dark`, `light`, `forest`, `adventure`, `illustrated`, `blackWhite`,
`editorialLuxe`) и делятся на тиры (`themes/themeTiers.ts`).

### Premium

Доступность премиальных настроек решает `services/pdf-export/premiumSettingsGate.ts`
и `components/export/BookSettingsModal.premium.ts`; источник прав —
`services/pdf-export/entitlement/PdfEntitlementSource.ts`. Контракт: **у каждой
premium-настройки обязан быть явный free-фолбэк**, а показ пейволла
сопровождается `trackPaywallView`.

### Печать — одна точка `utils/printHtml` (#2102)

Все печатные документы (план поездки, квест, книга) уходят в
`printHtml(html, { title }) → 'printed' | 'cancelled' | 'unavailable'`
(`utils/printHtml.ts` + `.web.ts` + `.native.ts`, типы — `printHtml.types.ts`):

- **web** — HTML пишется в окно браузера (`utils/openBookPreviewWindow.ts`), где
  пользователь печатает или сохраняет в PDF. Окно резервирует `beginPrint()`
  синхронно в обработчике клика, до первого `await` (иначе блокировщик
  всплывающих окон); HTML догружается позже в то же окно. Кнопка «Печать» в
  документе помечена `data-print-action`, обработчик с `window.print()` вешает
  только web-адаптер — единственный владелец `window.print` среди файлов печати,
  которые проверяет governance-тест (`QuestFullMap.tsx` и
  `BookHtmlExportService.ts` — вне его scope). Если окно не открылось (попап
  заблокирован), `beginPrint().available` = false и вызывающий выходит с
  `'unavailable'` до загрузки чеклиста, карт и картинок;
- **iPhone/Android** — системный диалог печати (AirPrint, «Сохранить как PDF»)
  через `expo-print` `printAsync({ html })`. На iOS закрытие листа без печати =
  reject `PrintIncompleteException` (`code: 'ERR_PRINT_INCOMPLETE'`) → `'cancelled'`
  (код `ERR_PICKER_CANCELED` тоже считается отменой, его даёт только
  `selectPrinterAsync`). На iOS (RN 0.86, expo-print 57) `code` до JS может не
  дойти — отмена распознаётся по коду или по причине исключения («Printing did not
  complete»), включая вложенную `cause` (#2160). На Android `printAsync({ html })` резолвится сразу после
  показа диалога (`PrintModule.kt`), поэтому там `'cancelled'` недостижим, а
  `'printed'` означает «диалог показан».
  `expo-print` — native-модуль: в сборках без него `isPrintAvailable()` = false
  (проверка `requireOptionalNativeModule('ExpoPrint')`, не `Platform.OS`),
  кнопки печати скрыты, `printHtml` отвечает `'unavailable'`;
- **разметка не зависит от платформы**: `isPrintAvailable()` на web всегда true
  (не смотрит на `window`), поэтому кнопки печати одинаковы в SSG и после гидрации;
- строка `common:print.unavailable` — ошибка «печать недоступна»;
- **книга резервирует окно в одном месте (#2125)**: все входы (каталог
  `ListTravelExportControls`, «Предпросмотр PDF» одного путешествия через
  `ShareButtonsPdfExportBridge`/`useSingleTravelExport`) сходятся в
  `usePdfExport.openPrintBook`, который первой строкой зовёт `beginPrint()` и
  передаёт сессию в `runPdfExport({ printSession })`. Окно заблокировано — тост
  `common:print.unavailable` и выход до аналитики, рантайма, серверного экспорта,
  загрузки деталей и генерации. Серверный HTML и клиентская книга печатаются через
  `printSession.print(html, { title })`; серверный файл-артефакт скачивается, и окно
  закрывается;
- **`PrintSession.cancel()` (#2125)**: документ печататься не будет (ошибка сборки,
  нечего печатать, ранний выход, сервер отдал файл) — вызывающий закрывает
  зарезервированное окно, заглушка «Готовим печатную версию…» не остаётся висеть.
  Web закрывает только окно-заглушку (окно с записанным документом не трогает,
  повторный вызов безопасен), native — без эффекта. План и квест зовут `cancel()` в
  `catch` сборки документа и пробрасывают ошибку. Окно, закрытое пользователем во
  время сборки, даёт `'cancelled'` без записи;
- **сообщения печати и экспорта — `showToast`** (`@/utils/toast`, `position:
  'bottom'`), не `Alert.alert`: в react-native-web он пустая функция, и сообщение на
  сайте терялось (#2125);
- **гвард** `__tests__/config/print-governance.test.ts`: в файлах печати
  (`components/**/print/**`, `components/quests/printable/**`, `QuestPrintable.tsx`,
  `ListTravelExportControls.tsx`, `hooks/usePdfExport*.ts`) запрещены `window.print`
  и `Platform.OS !== 'web'`; **гвард** `__tests__/config/web-alert-governance.test.ts`:
  в файлах печати и экспорта `Alert.alert` запрещён, по всему коду — ратчет
  BASELINE (сокращается до пустого в #2127).

Картинки на native: печатные HTML используют абсолютные https-URL (первопартийные —
через image-proxy `printImageUrl`). `printAsync` на iOS грузит их через WKWebView и
не умеет локальные ассеты; карты дней плана и квеста строятся canvas'ом, которого на
native нет, — там план печатается списком точек, квест — встроенной SVG-картой.
Если на устройстве картинки не успевают, запасной путь — base64 или
`printToFileAsync` + `expo-sharing` (проверяет #2113 на dev-сборке).

**Книга на native пока недоступна**: генераторы (`ContentParser`) разбирают HTML через
`DOMParser`, поэтому `usePdfExportRuntime` без DOM показывает `Alert`
«просмотр книги и печать доступны только в вебе», а `BookSettingsModal` на native не
рендерится. Сама печать результата уже идёт через `printHtml`; снять ограничение
можно только заменой DOM-разбора на строковый.

### Картинки в печати

`utils/printImageUrl.ts` (137) выбирает ступень печати по семейству источника:
первопартийные картинки идут через собственный прокси на явной ступени лестницы,
сторонние отдаются как есть. Это результат `#1163` — до него каждая внешняя
картинка гналась через `images.weserv.nl`, а своя отдавалась мастером целиком.
Ступени печати входят в `ALLOWED_IMAGE_WIDTHS` бэкенда, поэтому прокси
обслуживает их без округления вверх. Общий контракт — `docs/features/images.md`.

## Контур 2 — печатная версия квеста

`components/quests/QuestPrintable.tsx` (354) плюс `components/quests/printable/styles.ts`
(886, кандидат на распил — порог `guard:file-complexity` 800). Точка вызова —
`generatePrintableQuest` из `components/quests/QuestWizard.tsx`. Это отдельный
HTML-документ под печать, к пайплайну книги отношения не имеет.

## Контур 3 — выгрузка маршрута поездки

| Файл | LOC | Зона ответственности |
| --- | --- | --- |
| `utils/routeExport/gpx.ts` | 54 | сборка GPX |
| `utils/routeExport/kml.ts` | 82 | сборка KML |
| `utils/routeExport/normalize.ts` | 101 | нормализация точек |
| `utils/routeExport/navigator.ts` | 106 | ссылки во внешние навигаторы |
| `utils/routeExport/save.ts`, `download.ts` | 33 / 22 | сохранение файла |
| `components/trips/planning/TripRouteExportMenu.tsx` | — | UI меню в планировщике |
| `utils/travelPointsExport.ts` | 104 | точки путешествия как источник маршрута, `buildGoogleMapsDirectionsUrl` |

**Этот контур не web-only.** `shouldRenderTripRouteExportMenu` пропускает
`web`, `ios` и `android`; различается механизм сохранения — на web это `Blob` и
`<a download>`, на native `expo-file-system` + `expo-sharing`, из-за чего
меняются и подписи кнопок («Скачать GPX» против «Поделиться GPX»). Фолбэк
«доступно в веб-версии и мобильном приложении» достижим только для прочих
значений `Platform.OS`.

Меню требует минимум двух точек с координатами, иначе показывает подсказку
вместо кнопок.

## Тесты

- `__tests__/services/pdf-export/` — `TravelDataTransformer`, `BlockRenderer`,
  `premiumSettingsGate`, `descriptionImageSizes`, `printImageFallbackMarkup`,
  `printPageBreaks`, плюс подкаталоги `generators`, `layouts`, `themes`;
- `__tests__/components/export/` — `BookSettingsModal` и его premium-ветка,
  `PresetSelector`, `ThemePreview` (обычная и premium);
- `__tests__/utils/routeExport.test.ts`, `routeExportSave.test.ts`.

Печатный вывод как таковой (реальный PDF из браузера) автотестами не
покрывается — проверяется только сборка HTML и раскладка.

## Известные ловушки

- **Книга не существует вне web.** Любой отчёт «проверил экспорт книги на
  устройстве» неверен по построению: на native контур обрывается `Alert`'ом.
- **Результат — печать браузера, а не файл.** Расхождения между превью и
  итоговым PDF (разрывы страниц, поля, фон) — это поведение печати конкретного
  браузера, а не баг генератора; воспроизводить надо в том же браузере.
- **Настройки книги переживают сессию** через `localStorage`: «у меня другая
  тема» часто означает сохранённый выбор, а не регрессию.
- **Стили печати квеста весят 886 строк** и живут отдельно от дизайн-системы —
  правка токенов приложения на них не влияет.
- **Экспорт маршрута легко перепутать с книгой.** Это разные контуры с разными
  платформенными ограничениями; «экспорт не работает» без указания контура —
  непроверяемая постановка.

## Открытые вопросы и долги

- Планируется ли серверная генерация PDF вместо печати браузером — в
  репозитории следов нет.
- `services/pdf-export/**` (~12 700 строк) не имеет feature-карты внутри себя;
  граница между `generators/v2/pages`, `processors` и `runtime` описана только
  в `services/pdf-export/README.md` укрупнённо.
- `components/quests/printable/styles.ts` (886) превышает порог распила, план
  распила нигде не зафиксирован.
- Насколько расходятся превью и печать в разных браузерах — систематически не
  измерялось; регрессий на это нет.
- Сколько пользователей реально доходит до печати — телеметрию этого контура я
  не проверял.
