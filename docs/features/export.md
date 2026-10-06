# Фича: export (PDF-книга, печать и выгрузка маршрута)

**Последняя актуализация:** 2026-10-06

**Ответственный домен:** frontend export/print

## TL;DR

Под «экспортом» в MeTravel живут три несвязанных контура: **PDF-книга
путешествий** (собирается на сайте и в приложениях, печать — `printHtml`),
**печатная версия квеста**
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
BookSettingsModal (web DOM / native RN; общий useBookSettingsForm)
  → usePdfExport / usePdfExportRuntime
  → BookHtmlExportService
  → TravelDataTransformer
  → EnhancedPdfGenerator (публичная точка v2)
  → HTML → printHtml: окно браузера (web) или системный диалог печати (приложения)
```

| Файл | LOC | Зона ответственности |
| --- | --- | --- |
| `components/export/BookSettingsModal.tsx` | 779 | модалка настроек, валидация, сохранение выбора |
| `components/export/ThemePreview.tsx` | 765 | превью тем |
| `components/export/PresetSelector.tsx` | 462 | пресеты книги |
| `components/export/GalleryLayoutSelector.tsx` | 280 | раскладки галереи |
| `hooks/usePdfExportRuntime.ts` | 354 | стадии прогона, прогресс, ошибки |
| `services/book/BookHtmlExportService.ts` | 66 | оркестрация сборки HTML |
| `services/book/bookPrintChrome(.web|.native).ts` | 283 / 9 | панель «Печать» и скрипт ожидания картинок — только для окна браузера |
| `services/pdf-export/parsers/contentParser/htmlTree(.web|.native).ts` | 12 / 240 | дерево HTML описаний: `DOMParser` на web, parse5 в приложениях |
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
  через `expo-print`: bounded `printToFileAsync({ html })`, затем `printAsync({ uri })`. На iOS закрытие листа без печати =
  reject `PrintIncompleteException` (`code: 'ERR_PRINT_INCOMPLETE'`) → `'cancelled'`
  (код `ERR_PICKER_CANCELED` тоже считается отменой, его даёт только
  `selectPrinterAsync`). На iOS (RN 0.86, expo-print 57) `code` до JS может не
  дойти — отмена распознаётся по коду или по причине исключения («Printing did not
  complete»), включая вложенную `cause` (#2160). На Android `printAsync({ uri })` резолвится сразу после
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
  повторный вызов безопасен), native — прерывает подготовку и не даёт системному листу открыться позже (#2274). План и квест зовут `cancel()` в
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

Картинки на native: генератор использует абсолютные https-URL (первопартийные —
через image-proxy `printImageUrl`). Перед `expo-print` `printResourcePreflight`
материализует их в data URL: GET и чтение body вместе ограничены 30 с на ресурс;
ошибки HTTP, неподдерживаемый MIME, пустые/слишком большие данные и timeout
заменяются прозрачным placeholder, число пропущенных изображений идёт в тост.
Дедлайн подготовки — 120 с от `beginPrint` (клика), без дополнительного окна на
картинки после генерации. HEAD не используется: он не гарантирует последующий
GET WKWebView. HTML разбирается parse5; внешние stylesheet/import/script/frame,
media sources и srcset удаляются/нейтрализуются, CSS/SVG image URL также
материализуются. CSP запрещает оставшиеся сетевые зависимости в WKWebView.
Системный лист получает самостоятельный документ и не делает второй GET.

`PrintSession.preparationSignal` на native прерывает подготовку по дедлайну;
`getPreparationError()` хранит причину до abort. Это явный контракт: RN
AbortController polyfill не поддерживает `AbortSignal.reason`. Default abort
от cleanup не является timeout и не подавляет исходную ошибку генератора/печати.
`usePdfExport` завершает ожидание lazy runtime/генерации при отмене или timeout;
поздний результат не печатается и не меняет прогресс. Отмена серверного запроса
также проверяется после job/download/body: поздний артефакт не скачивается.
Подготовка включает `printToFileAsync({ html })` под тем же deadline/signal:
это отдельный native WKWebView/WebView renderer, который не открывает системный
лист. После race и abort guard в `printAsync` передаётся только готовый локальный
PDF URI; отменённый renderer не может поздно показать лист. Его поздний файл
удаляется через `expo-file-system/legacy.deleteAsync` (idempotent).
Таймер очищается перед `printAsync({ uri })`: время работы пользователя в открытом
системном листе не ограничивается. На iOS временный PDF удаляется после завершения
листа. На Android успешный PDF остаётся в Expo cache: `printAsync` завершается
сразу после presentation, а `PrintDocumentAdapter.onWrite` читает URI позже;
удалять его в этот момент нельзя. Отменённые до передачи системе файлы удаляются
на обеих платформах. Карты дней плана строятся canvas'ом, которого
на native нет; план печатается списком точек, квест — встроенной SVG-картой.

### Общая форма настроек (#2229)

Web-окно и `BookSettingsModal.native` используют `useBookSettingsForm`: одни
валидация, premium-гейты, пресеты и обработчики сохранения/превью. Web сохраняет
прежний localStorage-контракт через load/persist callbacks; DOM, focus trap,
Escape и блокировка body-scroll остаются в web-окне. Native использует RN Modal,
SafeArea и существующие выбиралки; доступность окна включена на всех платформах.

### Книга в приложениях (#2119)

Книга и экспорт одного путешествия собираются на всех платформах; печатает их
`printHtml`. В общем пути сборки (`services/pdf-export/**`, `services/book/**`)
браузерных глобалов нет — это держит
`__tests__/config/pdf-export-dom-governance.test.ts`.

- **Дерево HTML описаний** — `services/pdf-export/parsers/contentParser/htmlTree`:
  тонкий интерфейс (`htmlTree.types.ts`, подмножество DOM), на web — сам
  `DOMParser` (`htmlTree.web.ts`), в приложениях — parse5 (`htmlTree.native.ts`).
  parse5 строит дерево по тому же алгоритму HTML, что браузер: замер 04.10.2026 —
  1699 документов (794 поля описаний с прода сырыми и после санитайзера книги,
  синтетика), расхождений дерева с Chromium 149 — 0. `htmlparser2`, который уже
  лежит в бандле, расходится на битой разметке (ведущие `style`/`script` печатает
  текстом, не выносит текст из таблиц, не чинит перекрывающиеся теги), поэтому не
  выбран. Глобалы `document`/`DOMParser` в приложении не подменяются: по ним
  остальной код отличает браузер от приложения.
- **Документ книги** — `services/book/bookPrintChrome`: на web к документу
  добавляются панель «Печать» и скрипт ожидания картинок (`.web.ts`), в
  приложениях документ материализуется перед системным диалогом (`.native.ts`, #2274).
- **Входы** — одно правило `isBookExportEntryVisible`
  (`constants/platformNavRoutes.ts`): на сайте вход в каталог `/export` есть
  только на десктопной поверхности (из мобильных убран решением владельца
  01.07.2026), в приложении — на любой, когда в сборке есть модуль печати
  (`isPrintAvailable()` из `utils/printAvailability`). Так же по наличию печати
  показывается кнопка «PDF / книга» на экране путешествия. В старой сборке без
  `expo-print` пунктов нет.
- **Чем приложение отличается от сайта:**
  - настройки доступны в каталоге и для одного путешествия: нативное окно
    `BookSettingsModal.native.tsx` и окно сайта используют общий
    `useBookSettingsForm`; выбранные настройки передаются в книгу (#2229);
  - растрового снимка карты нет (canvas): страница карты рисуется SVG-схемой
    маршрута, как на сайте при неудавшемся снимке;
  - QR-коды рисуются SVG, а не PNG (canvas нет);
  - кадр без пропорции в медиа-манифесте не замеряется (нет глобального
    `Image`): галерея для него — contain с полями, фото описания — раскладка из
    разметки (см. «Пропорции картинок»);
  - серверный экспорт (`tryServerBookExport`) не запрашивается: его
    файл-артефакт сохраняет только браузер.
- **Эталоны** — `__tests__/fixtures/pdfBook/`: 11 реальных путешествий, 100
  синтетических случаев разметки, блоки разбора и HTML трёх книг. Web-тест
  (`bookGolden.test.ts`, jsdom) и тест приложений (`bookGolden.native.test.ts`,
  Node без `document`) сверяются с одними и теми же файлами; документ приложения
  с навешенной web-обвязкой обязан совпасть с web-эталоном побайтно. Эталон
  меняется только командой `UPDATE_PDF_BOOK_GOLDEN=1 npx jest
  __tests__/services/pdf-export/bookGolden.test.ts` — после правки шаблонов книги
  её нужно выполнить и просмотреть `git diff` эталонов.

### Пропорции картинок (#2232)

Журнальная «Фотогалерея» строит ряды по пропорциям кадров, фото описания
выбирают слот по ориентации. Источник на всех платформах — медиа-манифест
ответа `GET /api/travels/<id>/` (`services/pdf-export/utils/imageAspects.ts`):
`TravelDataTransformer` переносит `media.gallery[]` в `gallery[].aspect` (по
`id`) и `media.article_body.gallery[]` в `descriptionImageAspects` (по ключу
файла `resolveMediaPlaceholderKey`, не по индексу). Пропорция — `aspect_ratio`,
иначе `width / height`; `0`, `null`, `NaN` — «пропорции нет». Браузерный замер
(`measureImageAspects`, `new Image()`, до 8 с на кадр) остаётся только для
кадров без пропорции (`splitImageAspectTargets`) и только на сайте; в
приложении такие кадры идут на запасной раскладке без сети.

Замер 06.10.2026 (59 путешествий: 11 корпуса, 40 свежих и 8 самых старых
опубликованных; 3 не собираются из-за длины описания; Chromium на тех же URL,
что грузит книга): галерея — 561 из 561 кадра с пропорцией в манифесте,
описания — 152 из 217 картинок без размеров в разметке; расхождение с
браузерным замером — медиана 0, максимум 1.1·10⁻⁶, смен ориентации 0; книги
«манифест + замер недостающих» и «только замер» побайтно одинаковы у 56 из 56.
Без пропорции в манифесте — 65 картинок описаний в 5 путешествиях: это кадры
галереи, вставленные в описание (`/gallery/<id>/conversions/*-detail_hd.jpg`),
у их записей `article_body` `width`, `height` и `aspect_ratio` равны `null`
(недоработка бэкенда, отдельная задача `area=back`). Число картинок, которые
сайт грузит ради замера, на выборке падает с 778 до 65.

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

- `__tests__/services/pdf-export/` — `imageAspects` и `bookImageAspects.native`
  (пропорции из манифеста, окружение без `Image`), `TravelDataTransformer`, `BlockRenderer`
  (карта уровней заголовков автора по 4 блокам × h1–h6 × 20 темам),
  `bookHeadingLevels` (то же соотношение в готовом документе книги), `premiumSettingsGate`, `descriptionImageSizes`,
  `printImageFallbackMarkup`, `printPageBreaks`, плюс подкаталоги `generators`,
  `layouts`, `themes`;
- `__tests__/components/export/` — `BookSettingsModal` и его premium-ветка,
  `PresetSelector`, `ThemePreview` (обычная и premium);
- `__tests__/services/pdf-export/bookGolden.test.ts` и `bookGolden.native.test.ts` —
  эталоны разбора и HTML книги на web и в окружении приложений (см. «Книга в
  приложениях»); `__tests__/hooks/usePdfExportRuntime.native.test.ts` — путь от
  `runPdfExport` до `printAsync` без DOM;
- `__tests__/config/pdf-export-dom-governance.test.ts` — страж браузерных глобалов;
- `__tests__/utils/routeExport.test.ts`, `routeExportSave.test.ts`.

Печатный вывод как таковой (реальный PDF из браузера) автотестами не
покрывается — проверяется только сборка HTML и раскладка.

## Известные ловушки

- **Книга в приложении — не копия сайта один в один.** Нет растрового
  снимка карты и замера пропорций кадров без записи в медиа-манифесте (см.
  «Пропорции картинок»); отчёт «на телефоне галерея выглядит иначе» у
  путешествия с полным манифестом — регрессия, у кадров без записи — ожидаемо.
- **jsdom ≠ браузер в одном месте.** Текст прямо внутри `<table>` jsdom 20
  переносит в конец документа кусками (ошибка `insertTextBefore`), браузер и
  parse5 — одним узлом перед таблицей. Эталон разбора снят под jsdom, поэтому
  тест приложений держит для этого случая отдельное ожидание.
- **Заголовок автора внутри блока книги печатается мельче названия блока
  (#1296, #2210, #2255).** Разметка блоков допускает h1–h6, тема описывает
  стиль h1–h4. Правило одно для всех четырёх rich-text блоков и живёт в
  `services/pdf-export/themes/headingLevels.ts`: список блоков с уровнем их
  названия (`PDF_RICH_TEXT_SECTION_TITLE_LEVELS`) и понижение
  `resolveSectionHeadingLevel` — ступень автора (h1–h2 — первая, h3–h6 — вторая)
  отсчитывается вниз от названия блока. `BlockRenderer.renderBlocks` и
  `renderRichText` без блока не вызываются; шаблон `travelContentPage.ts` только
  сообщает, какой это блок. Под шкалой темы две производные ступени: h5 — кегль
  основного текста, h6 — кегль мелкого текста, насыщенность, интерлиньяж и
  отступ h4 (`resolveHeadingStyle`); в конфиги 20 тем они не добавляются, верхний
  отступ h5/h6 — `1.33em`, как у h4 (`htmlDocument.ts`). Карта:

  | Блок | Название блока | h1, h2 автора | h3–h6 автора |
  | --- | --- | --- | --- |
  | «Описание» | h2 | h3 | h4 |
  | «Рекомендации» | h2 | h3 | h4 |
  | «Плюсы», «Минусы» | стиль h4 (`runtime`; у `standalone` — h3) | h5 | h6 |

  Пример — путешествие 498, тема minimal: в «Рекомендациях» (24 пт) три `<h2>`
  автора 24 → 18 пт, `<h3>` «Планирование» 18 → 14 пт; в карточке «Плюсы»
  (14 пт) `<h2>` «✅ Плюсы маршрута» 24 → 12 пт, пять `<h3>` 18 → 11 пт (кегль
  текста карточки, жирным); в «Минусах» `<h2>` 24 → 12 пт, четыре `<h3>` 18 → 11
  пт; «Описание» без изменений. Отклонены: жирный текст без тега (уровни автора
  сливаются в один) и перевод названия карточки в h3 (меняется вид названия, вне
  рамок #2255).
- **Проба книги с подменой ответа API (Playwright).** Пока включён
  `page.route` или `context.route`, запросы окна книги (документ пишется в него
  через `document.write`) остаются на паузе: шрифты и картинки не приходят,
  документ висит с `readyState: 'loading'` без `body` — выглядит как зависшая
  сборка. Перехват снимается до клика, открывающего окно (`page.unrouteAll`);
  сбой сборки до записи документа (окно закрывается, тост) он не искажает (#2210).
- **Результат — печать браузера или системный диалог, а не файл.** Расхождения между превью и
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
