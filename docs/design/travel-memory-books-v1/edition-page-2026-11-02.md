# Страница издания `/books/<slug>`: макет редизайна

Карточка #2948 [FE-BOOKS-G1]. **Утверждён владельцем 02.11.2026**; решения по
открытым вопросам — в разделе «Решения владельца» ниже. Поведение раздела —
[`docs/features/travel-memory-books.md`](../../features/travel-memory-books.md)
(«Раздел сайта и предпросмотр»). Пример — `/books/belarus` (`belarus-memory`,
акварель, 31 место, 108 страниц).

Реализация: [`components/books/ReadyBookDetails.web.tsx`](../../../components/books/ReadyBookDetails.web.tsx)
и блоки в [`components/books/edition/`](../../../components/books/edition/), стили —
`editionCss` в [`components/books/booksStyles.ts`](../../../components/books/booksStyles.ts).
Номера строк в таблицах ниже относятся к коду до редизайна.

Артефакты согласования лежат в игнорируемой рабочей папке `.codex-temp/FE-BOOKS-G1/`
(в репозиторий не входят; основа — раздел 2 `.codex-temp/books-design/edition-page-redesign.md`):

- `mockup.html` — статический макет на реальных обложках и страницах из
  `dist/prod/travel-books/**` (уменьшенные копии в `assets/`). `?size=a5` —
  формат A5, `?clean` — без жёлтых меток секций, `?sticky` — липкая панель.
  Стиль и размер переключаются кликом.
- `edition-1440.png`, `edition-390.png` — полная страница; `edition-390-sticky.png`
  — липкая панель после прокрутки героя; `edition-1440-a5.png` — герой A5.
- `shoot.mjs` — рендер через Playwright из репозитория (`node shoot.mjs`).

Решение владельца 02.11.2026 сохраняется: на публичной странице нет служебных
пометок (готовность к печати, ppi, «тестовый файл», хэш ревизии, «Честно о печати»).

## Порядок секций

Desktop 1440: контейнер 1120 px (`booksStyles.ts:3`), секции разделены линией
`borderStrong`, вертикальный ритм `spacing.xxl` (48). Mobile 390: тот же порядок,
одна колонка, поля 16 px, без горизонтальной прокрутки страницы (проверено в
`shoot.mjs`: overflow 0 на 1440 и 390).

| # | Секция | Видно сразу | Свёрнуто по умолчанию |
|---|---|---|---|
| 1 | Герой | обложка выбранного стиля и размера, 2 разворота веером; надзаголовок, `h1`, обещание, 5 чипов, CTA «Скачать книгу» и «Листать книгу», строка файла, ссылка «Другой стиль или размер» | — |
| 2 | Как устроена книга | 3 карточки: страница места / ваши фото / ваши воспоминания | — |
| 3 | Выберите свою | стиль: 4 карточки с обложкой; размер: 2 карточки с силуэтом | — |
| 4 | Маршрут книги | первые 8 мест с номером страницы | «Показать все N мест» |
| 5 | Подпишите обложку | заголовок и одна строка | редактор надписи целиком |
| 6 | Скачать | «Книга целиком», «Обложка», «Наклейки к книге»; версия датой | «Файлы для печати» (3 подгруппы) |
| 7 | Как напечатать / Где напечатать | 3 карточки путей, ссылка на полную инструкцию | шаги каждого пути; «Где напечатать» целиком |
| 8 | Вопросы | 5 вопросов | ответы |
| 9 | Ещё книги | 4 карточки с обложками (desktop — сетка, mobile — лента) | — |
| 10 | Mobile | липкая панель «Скачать · Листать», когда CTA героя ушли вверх | — |

Mobile: в герое обложка идёт над текстом, CTA делят строку пополам; стили —
горизонтальная лента со scroll-snap (карточка 62%), размеры — столбцом, «Ещё книги» —
лента. Липкая панель (`position: fixed`, safe-area снизу) не показывается на ≥800 px.
Странице добавляется нижний отступ 72 px, чтобы панель не закрывала футер.

Хлебные крошки: «Главная › Книги путешественника › Беларусь». Сейчас последние две
части берутся из URL: `toTitleFromSegment` (`hooks/useBreadcrumbModel.ts:152-160`)
переводит только сегменты из `pageTranslations` (`hooks/breadcrumbRouteLabels`), где
`books` нет. Нужен ключ `books` в `pageTranslations` и ветка `/books/<slug>` с
названием из `findReadyBook(slug).title` (как сделано для путешествий и квестов).

## Состояния

- Пока грузится `book.json`, SSR-оболочка показывает героя по каталогу: обложку
  `coverUri`, `h1`, обещание, чипы. Кнопки показываются, но неактивны до загрузки, а
  место разворотов зарезервировано. Ошибка — существующий `role="alert"` с кнопкой
  «Повторить» под героем (`ReadyBookDetails.web.tsx:63`).
- Стиль — это ссылка на соседнее издание с `?profile=`
  (`ReadyBookDetails.web.tsx:93`); при переходе выбранный размер сохраняется.
  Размер переключается на месте и меняет обложку, развороты, миниатюры, все файлы
  и подпись под фото («10 × 7» / «10 × 15»).
- Квестовые книги (`kind: quests`): секции 3 «Стиль» нет (ряд размеров остаётся),
  в секции 2 — страница квеста вместо страницы места, «N мест» → «N квестов».

## Компоненты

| Блок | Сейчас | Предлагается |
|---|---|---|
| CTA, «Скачать» | `components/ui/Button` (primary/secondary/outline), `<a download>` (`ReadyBookDetails.web.tsx:100`) | главная загрузка остаётся обычной ссылкой `<a href download>` в стиле `Button` primary (#2951, жест iOS) |
| Чипы | — | `components/ui/Chip` (не нажимаются, `role` не нужен; список `ul`) |
| Стиль, размер | радио `input` + текстовые ссылки (`:90`, `:93`) | карточки-радио по образцу `SelectionGroup` (`accessibilityRole="radio"`, `components/ui/SelectionGroup.tsx:50`); стиль — `Link` в карточке |
| Лента стилей / книг на mobile | — | `components/ui/CardRail` или `EdgeFadeScrollRow` |
| Аккордеоны (5, 6, 7, 8) | `<details>` в `BookContents.web.tsx` | нативные `<details>/<summary>` на web (без JS, работают в SSR); `CollapsibleBlock` не нужен — это RN-компонент с `Animated` |
| Маршрут | `BookContents.web.tsx` (`h2` + `<details>` со списком) | расширить: первые 8 видны, кнопка `aria-expanded` открывает остальные |
| Листать | `ReadyBookPreview` (`:94-95`), возврат фокуса в `opener` | без изменений; второй вход — из героя и из липкой панели |
| Надпись на обложке | `CoverPersonalizationEditor.web.tsx` | без изменений внутри, обёрнут в `<details>` |
| Как напечатать | `PrintingGuide.web.tsx` (одна кнопка) | новая обёртка: 3 карточки путей + существующая кнопка «Полная инструкция» |
| Где напечатать | `PrintProviders.web.tsx` (#2945) | без изменений, внутри `<details>` |
| Иконки | — | Feather: `download`, `book-open`, `map-pin`, `file-text`, `gift`, `unlock`, `globe`, `edit-3`, `layers`, `home`, `copy`, `briefcase`, `check`, `chevron-down` |

Токены — `DESIGN_TOKENS` (`constants/designSystem.ts:153`, палитра
`constants/modernMattePalette.ts`). В макете: фон `background` #fdfcfb, карточки
`surface` + `shadows.card`, акцент `primary` #7a9d8f с `textOnPrimary`, ссылки
`primaryText` #547769, плашки `primaryLight`. Радиусы: карточки `lg` 20, главная
карточка загрузки `xl` 28, кнопки `md` 16, чипы `pill`. Шкала `typography.scale`:
`display` для `h1` на mobile, `h1` для `h2`, `h3`, `body`, `bodySmall`, `label`.
`booksCss` (`booksStyles.ts`) сейчас рисует рамки `currentColor`; его заменяют
классы на токенах (CSS-переменные тех же `colorVar`, тёмная тема — та же).

## Тексты RU и ключи i18n

Все ключи — в namespace `books` (`i18n/locales/{ru,be,uk,pl,en}/books.ts`), доступ
через `useBookCopy` (`components/books/bookCopy.ts`). Существующие ключи
переиспользуются; новые помечены «+». Склонения («31 место / 30 мест / 41 квест»)
идут через plural-формы i18n, а не через «Мест: N».

**Герой и крошки**

| Ключ | RU |
|---|---|
| + `breadcrumbBooks` (или `pageTranslations.books`) | Книги путешественника |
| + `heroEyebrow` | Фотодневник путешествий |
| + `promise.byCountry` / `promise.plCountry` / `promise.plCastles` / `promise.plMountains` / `promise.byQuests` / `promise.plQuests` | «31 место, куда хочется вернуться. Книга, которую вы допишете сами: на каждое место — рассказ, страница для ваших фото и страница для воспоминаний.»; для остальных книг — свой текст, без копирования |
| + `chipPlaces` (plural) / + `chipQuests` (plural) | {{count}} место / места / мест; {{count}} квест / квеста / квестов |
| + `chipPages` (plural) | {{count}} страница / страницы / страниц |
| + `chipFree` / + `chipNoSignup` / + `chipPdfRu` | Бесплатно / Без регистрации / PDF на русском |
| + `ctaDownload` | Скачать книгу |
| + `ctaRead` (заменяет `preview`) | Листать книгу |
| + `ctaMeta` | PDF · {{size}} · {{format}} · {{style}} |
| + `ctaOtherOptions` | Другой стиль или размер |
| + `stickyDownload` / + `stickyRead` / + `stickyLabel` | Скачать / Листать / Быстрые действия с книгой |

**Как устроена книга, выбор, маршрут**

| Ключ | RU |
|---|---|
| + `howTitle` / + `howLead` | Как устроена книга / На каждое место — три страницы подряд. Одну мы уже написали, две остаются вам. |
| + `howPlace` / + `howPlaceText` | Страница места / Короткая история, иллюстрация и два QR-кода: место на карте и статья автора. |
| + `howPhotos` / + `howPhotosPocket` / + `howPhotosAlbum` | Ваши фото / Свободная страница без рамки — под снимок 10 × 7 см. / … — под снимок 10 × 15 см. |
| + `howMemories` / + `howMemoriesText` | Ваши воспоминания / Чистая страница для записей, билетов и наклеек с марками мест. |
| + `howSample` | пример |
| + `chooseTitle` / + `chooseLead` | Выберите свою / Те же {{count}} мест и те же рассказы — меняются иллюстрации и размер. |
| `style` → «Стиль» (сейчас «Стиль издания»), `size` → «Размер» | — |
| `styleWatercolor` / `stylePhoto` / `styleGraphic` / `styleFantasy` / `stylePhotoSources` | без изменений |
| + `styleWatercolorHint` / + `stylePhotoHint` / + `styleGraphicHint` / + `styleFantasyHint` | Мягкие акварельные рисунки / Настоящие снимки из поездок / Чёрно-белые рисунки пером / Сказочный свет и закаты |
| + `sizePocketTitle` / + `sizePocketHint` | Карманная · 15 × 10 см / Под фото 10 × 7 см. Лёгкая, берите в дорогу. |
| + `sizeAlbumTitle` / + `sizeAlbumHint` | Альбом A5 · 14,8 × 21 см / Под обычное фото 10 × 15 см. |
| + `routeTitle` / + `routeLead` | Маршрут книги / {{count}} мест из поездок автора. Это идеи для самостоятельных поездок, а не один маршрут. |
| + `routePage` | стр. {{page}} |
| + `routeShowAll` (plural) / + `routeCollapse` | Показать все {{count}} мест / Свернуть список |

**Обложка, скачивание, печать**

| Ключ | RU |
|---|---|
| + `coverSectionTitle` / + `coverSectionHint` | Подпишите обложку / Необязательно. Выберите надпись или напишите свою — получите обложку в PDF. |
| `coverPrivate`, `coverDownloadPdf`, остальные `cover*` | без изменений |
| `downloads` → «Скачать» (сейчас «Что скачать») | — |
| + `downloadLead` | {{style}} · {{format}}. Файлы откроются на телефоне и компьютере. |
| + `fileWhole` / + `fileWholeHint` | Книга целиком / читать на экране или напечатать дома |
| `cover` (Обложка), `download` (Скачать) | без изменений |
| + `fileStickers` / + `fileStickersHint` (plural) | Наклейки к книге / Марки {{count}} мест · 2 листа A4 |
| `color` → «Цветные», `noBackground` → «Без фона» | — |
| + `printFiles` / + `printFilesHint` | Файлы для печати / Для копицентра, домашней сборки на кольцах и проверки принтера |
| + `groupShop` / + `groupShopHint` | Для копицентра или типографии / Каждая страница — отдельный лист, обложка отдельно. |
| + `groupRings` / + `groupRingsHint` | Для домашней сборки на кольцах / Страницы разложены по листам A4 для двусторонней печати. |
| + `groupSewn` (только A5) | Для домашней прошивки |
| + `groupControl` / + `groupControlHint` | Проверочные листы для принтера / Напечатайте до основной книги, чтобы проверить подачу бумаги и двустороннюю печать. |
| `body` → «Страницы книги»; + `controlBody` / + `controlCover` | Проверка страниц / Проверка обложки |
| `passport` → «Памятка для типографии» | — |
| + `sheetCount` (plural) | {{count}} лист / листа / листов |
| + `versionDate` | Версия от {{date}} (дата через `i18n/format.ts`) |
| `guideTitle` → «Как напечатать»; + `guideLead` | Выберите удобный путь — шаги откроются по кнопке «Подробнее». |
| + `pathHome` / + `pathHomeText` / + `pathHomeFiles` | Дома на A4 / Цветной принтер, двусторонняя печать, сборка на кольцах. / Файлы: «Для домашней сборки» |
| + `pathCopy` / + `pathCopyText` / + `pathCopyFiles` | В копицентре / Отдайте файл, попросите цветную печать и переплёт на пружину. / Файлы: «Для копицентра» |
| + `pathPress` / + `pathPressText` | В типографии / Плотная бумага и прочная обложка — хороший вариант для подарка. |
| + `pathMore` / + `pathStep{Home,Copy,Press}{1,2,3}` | Подробнее / шаги из макета (бумага 120–160 и 250–300 г/м² — из `data/travelBooks/instructions/ru.json`, раздел `paper`) |
| `guideOpen` → «Полная инструкция по печати» | — |
| `providerTitle` → «Где напечатать»; + `providerSummary` | Копицентры и типографии: {{by}} городов Беларуси и {{pl}} городов Польши |

**Вопросы и ещё книги**

| Ключ | RU |
|---|---|
| + `faqTitle` | Вопросы |
| + `faqFreeQ` / `faqFreeA` | Книга правда бесплатная? / Да. Скачивайте, печатайте для себя и для близких — без оплаты и подписки. |
| + `faqSignupQ` / `faqSignupA` | Нужно ли регистрироваться? / Нет. Файлы скачиваются сразу, без входа и без почты. |
| + `faqPaperQ` / `faqPaperA` | На какой бумаге печатать? / Для страниц подойдёт матовая бумага 120–160 г/м², для обложки — 250–300 г/м². Проверьте, какую плотность берёт ваш принтер. |
| + `faqPhotosQ` / `faqPhotosA` | Как вклеить свои фото? / Сначала приложите снимок без клея. Затем закрепите фотоуголками или клеем для фотографий. Размер — 10 × 7 см в карманной книге, 10 × 15 см в A5. |
| + `faqLanguageQ` / `faqLanguageA` | Есть книга на белорусском или польском? / Пока PDF только на русском. Сайт работает на пяти языках, переводы книги появятся позже. |
| + `moreTitle` | Ещё книги |
| `back` → «Все книги путешественника» | — |

Удаляются со страницы (ключи остаются, пока их читают другие экраны): `language`
как абзац, `counts` («внутренних страниц»), `photoSpace`, `guideLanguage`, `inside`.

## Данные блоков

`summary` — запись каталога (`findReadyBook`), `book` — проверенный `book.json`.
Ссылки — на запись `belarus-memory`.

| Блок | Поля | Где |
|---|---|---|
| Герой: `h1`, `lang` | `title`, `contentLocale` | `catalog.json:8,11`; схема `publication.ts:45` |
| Обложка героя | `book.preview[profile, component=cover].pages[0].uri` (до загрузки — `summary.coverUri`, только pocket) | `manifest.json:890`; `catalog.json:13` |
| Развороты | `book.preview[profile, body].pages` с номерами `stops[0].page` и `+1`, а также страницы содержания | `manifest.json:890`, `:22`; `publication.ts:54` |
| Чипы | `stopCount`, `bodyPageCount`, `contentLocale` | `catalog.json:14,15,11` |
| Строка файла в герое, «Книга целиком» | `artifacts[purpose=read, component=body, profileId].bytes/pageCount` | `manifest.json:535`; `publication.ts:53` |
| Как устроена книга | `preview` body: страницы `stops[0].page`, `+1`, `+2` | `manifest.json:22`, `:890` |
| Стили | соседние издания: `readyBooks` + `editionFamily` + `visualStyle`/`sourceContract`, обложка `coverUri` | `ReadyBookDetails.web.tsx:79`; `catalog.json:100` |
| Размеры | `profiles[].id/widthMm/heightMm` | `catalog.json:16`; `publication.ts:49` |
| Маршрут | `stops[].title/page` (`questId` для квестов) | `manifest.json:22`; `publication.ts:124` |
| Подпишите обложку | `coverPersonalization` | `manifest.json:352`; `publication.ts:50` |
| Обложка, печатные файлы | `visibleArtifacts(book, profileId)`, группировка по `purpose`/`component`/`controlFor` | `bookArtifacts.ts:34`; `manifest.json:535` |
| Наклейки | `artifacts[purpose=stickers, variant]`, `outputPageMm` 210×297 | `manifest.json:758` |
| Как напечатать | `printGuidePages[profileId]`, иначе `artifacts[purpose=instructions]` | `manifest.json:513`; `PrintingGuide.web.tsx:13-14` |
| Где напечатать | `printDirectory` → `providers.json` | `manifest.json:529`; `PrintProviders.web.tsx` |
| Ещё книги | `readyBooks` других семей (`editionFamily`), `coverUri`, `title`, `stopCount` | `services/book/readyBooks/catalog.ts`, `editionFamily.ts:7` |

### Чего нет в данных сегодня

1. **Обещание для каждой книги** — ни в каталоге, ни в manifest. Предложение:
   ключи i18n `promise.*` по семье издания (`editionFamily`), 6 текстов × 5 языков.
2. **Дата версии** — у `belarus-memory`/`poland-memory` ревизия — хэш, даты нет
   (у остальных дата только внутри строки ревизии). Нужно поле `publishedAt`
   (ISO) в manifest/`book.json`.
3. **Превью листа наклеек** — `preview` есть только для `body` и `cover`
   (`publication.ts:54`, `.length(4)`). В макете — растр PDF через `pdftoppm`.
   Нужен `preview` компонента `stickers` (1 webp).
4. **Обложки других стилей в формате A5** — в каталоге только `coverUri` карманного
   формата (`catalog.json:13`). Чтобы карточки стилей и «Ещё книги» следовали
   выбранному размеру без загрузки чужих `book.json`, нужен `coverUris` по
   профилям в каталоге.
5. **Единый PDF «книга с обложкой»** — нет: `read.body` (108 стр.) и `read.cover`
   (4 стр.) — отдельные файлы. Макет называет «Книгой целиком» блок страниц, а
   обложку — отдельной карточкой. Если нужен один файл — это новый артефакт пайплайна.
6. **Карта маршрута** — у `stops` нет координат (только `pointId`), поэтому в макете
   список. Для мини-карты нужны `lat/lng` в `stops`.
7. **Короткие подписи стилей** («Мягкие акварельные рисунки» …) — новые ключи i18n,
   данных не требуют.

## Аналитика

Без изменений схемы (`utils/growthFunnelAnalytics.ts:45`):

- `ReadyBookViewed` — один раз после загрузки `book.json` (`ReadyBookDetails.web.tsx:82`).
- `ReadyBookPreviewOpened` — из героя и из липкой панели; `profileId`. Если нужно
  различать вход, добавить `entry: hero|sticky` (решение владельца).
- `ReadyBookDownloadRequested` (в карточке названо DownloadStarted) — на каждой
  ссылке файла, включая CTA героя и липкую панель (ведут к `read.body`), с
  `profileSource` (`:86`).
- Сохраняются `ReadyBookProfileSelected`, `ReadyBookCoverDownloaded`,
  `ReadyBookInstructionsViewed`, `ReadyBookProviderOpened`. Открытие аккордеонов
  не логируется.

## Доступность

- Один `h1`, далее `h2` для каждой секции и `h3` для карточек. Секции —
  `<section aria-labelledby>`; надзаголовок не входит в `h1`.
- Аккордеоны — нативные `<details>/<summary>`: роль, `expanded`, Enter/Space и
  работа без JS даёт браузер. Заголовок в `summary` — текст, а не вложенный `h2`.
  Иконка шеврона `aria-hidden`; `prefers-reduced-motion` отключает поворот.
- «Показать все места» — `button` с `aria-expanded` и `aria-controls` на `ol`;
  фокус остаётся на кнопке, новые пункты идут в DOM сразу за 8-м.
- Стиль и размер — `role="radiogroup"` с подписью, у карточек `role="radio"` и
  `aria-checked`, roving tabindex и стрелки. Галочка выбора не единственный признак:
  рамка и `aria-checked`. Стиль, ведущий на другое издание, — ссылка внутри карточки
  с `aria-current="true"` у выбранной (решить при реализации: radio или link, не оба).
- Скачивание: `aria-label` = `describeArtifact` (тип · PDF · страницы · размер),
  как сейчас (`ReadyBookDetails.web.tsx:100`). Кнопки «Цветные / Без фона» получают
  полное имя «Наклейки, цветные, PDF, 5 МБ».
- Липкая панель — `role="region"` с `aria-label`, появляется после ухода CTA героя
  (`IntersectionObserver`) и не забирает фокус; при открытом предпросмотре скрыта.
  Цели касания ≥44 px (кнопки 48).
- Изображения: обложка героя — `alt` с названием, стилем и размером; развороты и
  миниатюры декоративны (`alt=""`), их смысл несёт подпись. Пометка «пример» на
  миниатюрах 2–3 — текст, видимый всем.
- Контраст: `textOnPrimary` на `primary`, `primaryText` на `background`/`surface` —
  значения AA из палитры. Фокус — `:focus-visible` 3 px `primaryText`.
- `lang="ru"` на `h1`, названиях мест и надписях обложки при интерфейсе BE/UK/PL/EN.

## Решения владельца (02.11.2026)

1. FAQ: вопрос о подарке и продаже убран — на странице 5 вопросов.
2. Мини-карты маршрута нет: список из 8 мест и кнопка «Показать все».
3. Единого PDF «книга с обложкой» нет: две карточки — «Книга целиком» (страницы)
   и отдельная «Обложка».
4. «Ещё книги» — до 4 других изданий каталога: сначала другие стили той же
   страны, затем другая страна (её издание того же вида и стиля — первым).
5. Обещание — отдельный ключ i18n для каждой семьи издания, на пяти языках.
6. Дата версии: день из датированной ревизии; если у книги лучшей даты нет —
   месяц из `data/travelBooks/edition.json`. Хэш ревизии не показывается никогда.

## Проверки при реализации

Mobile web 390 (сначала), затем desktop 1440; RU и самый длинный перевод
(PL/UK) для чипов, карточек размеров и CTA; поля 320 px без горизонтальной прокрутки;
клавиатура: radiogroup, аккордеоны, предпросмотр с возвратом фокуса; SSR-оболочка до
загрузки `book.json`; квестовая книга без секции стиля; A5 с группой «прошивка».
