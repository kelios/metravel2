# Фича: article (rich-text тело статьи и редактор)

**Последняя актуализация:** 2026-08-17

**Ответственный домен:** frontend travel/article

## TL;DR

«Статья» в MeTravel — это **rich-text тело**, а не отдельная сущность. Основной
носитель — travel-запись: её `description` (плюс `plus`, `minus`,
`recommendation`) редактируется редактором `components/article/**`, хранится как
HTML и отдаётся на трёх поверхностях — гидратированный web, native и
предрендеренный SSG-шелл. Параллельно существует **второй, отдельный тип
контента** `articles` с роутом `/article/{id}` и своим API; его SSG-страницы
генерируются `noindex, nofollow`.

## Границы

| В этой карте | Где живёт остальное |
| --- | --- |
| редактор rich text, санитизация, рендер тела, эмбеды | — |
| черновики и автосейв **тела** | полный контракт черновиков — `docs/TRAVEL_DRAFT_RECOVERY.md` |
| публикация и модерация тела | контракт — `docs/TRAVEL_SAVE_MODERATION_CONTRACT.md`, UI мастера — `docs/features/travel.md` |
| SSG-подача тела и meta | генератор и гейты — ниже; пайплайн картинок — `docs/features/images.md` |
| адреса картинок в теле, лестницы ширин, клэмп по семейству | `docs/features/images.md` §2.3 |

## Точки входа

| Путь | Назначение |
| --- | --- |
| `app/(tabs)/travels/[slug]` | страница travel — здесь тело статьи читают |
| мастер travel, шаг «Детали» | `components/travel/TravelWizardStepDetails.tsx` — три редактора: `plus`, `minus`, `recommendation` |
| мастер travel, описание | `components/travel/ContentUpsertSection.tsx` — инлайновый и полноэкранный редактор `description` |
| `app/(tabs)/article/[id].tsx` / `.web.tsx` / `.native.tsx` | отдельный тип `articles`, SSG-страницы `noindex, nofollow` (`scripts/generate-seo-pages.js:3396-3402`) |

## Ключевые компоненты

```
<ArticleEditor>                      // components/article/ArticleEditor.tsx — диспетчер web/native
 ├─ ArticleEditor.web.tsx            // Quill-редактор
 │   ├─ QuillEditor.web.tsx
 │   ├─ ArticleEditor.web.effects.ts // автосейв, backoff, форс-синк
 │   ├─ ArticleEditorWebChrome.tsx   // тулбар, кнопка ручного сохранения
 │   └─ articleEditor*Helpers.ts     // quill / media / ui / lifecycle
 └─ ArticleEditor.ios.tsx            // WebView-редактор; ArticleEditor.android.tsx его ре-экспортирует
```

| Файл | LOC | Зона ответственности |
| --- | --- | --- |
| `components/article/ArticleEditor.web.tsx` | 817 | web-редактор, состояние html, ручное сохранение, телеметрия |
| `components/article/QuillEditor.web.tsx` | 635 | обёртка Quill, ленивая загрузка |
| `components/article/ArticleEditor.web.effects.ts` | 504 | автосейв с backoff, форс-синк содержимого |
| `components/article/ArticleEditor.ios.tsx` | 489 | native-редактор в WebView; Android — ре-экспорт |
| `components/travel/stableContent/htmlTransform.ts` | 835 | превращение сохранённого HTML в рендер web: картинки, эмбеды, фасады |
| `components/travel/stableContent/useWebEffects.ts` | 551 | пост-монтажные эффекты рендера (в т.ч. валидация Instagram) |
| `components/travel/stableContent/useRenderConfig.native.tsx` | 412 | рендер тела на native |
| `utils/sanitizeRichText.ts` | 499 | санитайзер рантайма и сохранения |
| `components/article/SafeHtml.tsx` | 227 | безопасный вывод фрагмента HTML |
| `components/travel/stableContent/articleBodyMedia.ts` | 172 | индекс адресов картинок тела по ключу (#1256) |
| `api/articles.ts` | 424 | API отдельного типа `articles`, включая `resolve-slug` |

`ArticleEditor.web.tsx` (817) — единственный файл фичи у порога распила
(`guard:file-complexity`, порог 800); `htmlTransform.ts` (835) формально за
порогом и относится к рендеру.

## Пайплайн rich text

### Ввод

- Изменения Quill с `source === 'user'` идут в `fireChange` с
  `markUserEdited`; программные (`source === 'api'`) автосейв не взводят.
- Дебаунс проброса наружу — `ARTICLE_EDITOR_CHANGE_DEBOUNCE_MS = 250`
  (`components/article/articleEditorConfig.ts:7`).
- Родителю в `onChange` уходит **санитизированный** HTML, а во `value` самого
  Quill остаётся сырой — иначе прыгает каретка.

### Автосейв редактора — существует, но в проде не подключён

- `onAutosave` вызывается через `ARTICLE_EDITOR_DEFAULT_AUTOSAVE_DELAY = 5000`
  (`articleEditorConfig.ts:9`) при трёх условиях: компонент смонтирован,
  пользователь реально правил, html отличается от последнего сохранённого.
  При отказе — экспоненциальный backoff `min(60000, delay * 2^min(4, fails))`
  без требования новой правки.
- **Ни один продовый вызов `<ArticleEditor>` не передаёт `onAutosave`** —
  `TravelWizardStepDetails.tsx` и `ContentUpsertSection.tsx` передают
  `content`/`onChange` (и иногда `onManualSave`). Контур покрыт только тестами
  (`__tests__/components/ArticleEditor.web.autosave.test.tsx`).
- Собственного хранилища черновиков у редактора нет: ни `localStorage`, ни
  `AsyncStorage` в `components/article/**` не используются. Содержимое приходит
  пропом `content`.

### Что реально сохраняет тело

Прод-путь идёт через мастер travel: `onChange` → `formData.description|plus|
minus|recommendation` → `hooks/useTravelFormPersistence.ts` (серверный автосейв,
дебаунс 5 с) и локальный черновик `hooks/useDraftRecovery.ts` (дебаунс 2 с,
TTL 24 ч). Контракт черновиков полностью описан в
`docs/TRAVEL_DRAFT_RECOVERY.md` — здесь не дублируется.

**Важно:** серверный автосейв жёстко выключен для завершённых записей —
`useTravelFormPersistence.ts:585-593` требует `!formState.data.moderation &&
!formState.data.publish`. После модерации правки сохраняются только вручную.

### Санитизация при сохранении

`api/misc.ts` перед отправкой в `PUT /travels/upsert/`:

- `description` → `sanitizeRichText(stripBase64Images(...))` — base64-картинки
  вырезаются до сохранения (`#1319`/`#1320`: инлайновый base64 раздувал страницу);
- `plus`, `minus`, `recommendation` — санитизация и обрезка до 5000 символов;
- `name` — 200 символов;
- защита от пустого payload при существующем `id` (инцидент с travel 641).

`utils/sanitizeRichText.ts` держит allowlist тегов и:

- разрешённые схемы `http`, `https`, `mailto`;
- allowlist хостов iframe: `youtube.com`, `youtube-nocookie.com`, `youtu.be`,
  `player.vimeo.com`, `www.google.com`, `instagram.com` — всё остальное
  вырезается;
- нормализацию адресов картинок: разворачивание weserv-обёрток
  (`unwrapWeservImageUrl`) и приведение к первопартийным медиа-роутам
  (`/gallery`, `/travel-image`, `/travel-description-image`, `/address-image`).

### Рендер

- **Web (гидратированный):** `htmlTransform.ts` подставляет адреса картинок,
  строит `srcset`/`sizes` и заменяет эмбеды фасадами; `useWebEffects.ts`
  доводит их после монтирования.
- **Native:** `useRenderConfig.native.tsx`.
- **SSG-шелл:** отдельный, более строгий санитайзер — см. ниже.

## Картинки в теле

Адреса берутся из манифеста `media.article_body` (с #1256), **сопоставление по
ключу картинки, а не по индексу** — иначе фасады Instagram, вставляющие чужие
`<img>`, сбивают нумерацию. Индекс и выбор ступени — в
`components/travel/stableContent/articleBodyMedia.ts`. Лестницы ширин, клэмп по
семейству источника и потолки — контракт `docs/features/images.md` §2.3,
дублировать его здесь нельзя.

## Эмбеды

YouTube и Instagram рендерятся фасадами, а не живыми iframe: фасад грузит
превью и подставляет реальный плеер по клику. Instagram дополнительно
валидируется при монтировании (`useWebEffects.ts`). В SSG-шелл эмбеды не
попадают вовсе — `<iframe>` вырезается санитайзером шелла.

## Публикация и модерация

Полный контракт — `docs/TRAVEL_SAVE_MODERATION_CONTRACT.md`, UI шага 6 —
`components/travel/TravelWizardStepPublish.tsx` и
`useTravelPublishModeration.ts`. Ключевое для тела статьи: сохранение никогда не
меняет статус публикации, а проверка полноты (`validateReadyForModeration`)
запускается только при явном `intent='publish'`, который добавляет в payload
`enforce_moderation_validation: true`.

Для модерации обязательны `name` (3–200), `description` (минимум 50 символов
текста, считается по HTML), `coordsMeTravel`, `countries`, `categories`
(`utils/travelWizardValidation.ts:169-197`).

## SSG и SEO

### Тело в предрендере

`scripts/generate-seo-pages.js` собирает страницу travel и вкладывает тело через
`injectSkeletonShell` → `buildTravelSkeletonHtml` → `sanitizeArticleBodyHtml`
(`scripts/ssg-skeletons.js:765-813`). Санитайзер шелла жёстче рантаймового:

- allowlist тегов `p, h2, h3, h4, ul, ol, li, strong, b, em, i, br, blockquote, a`;
- `script`, `style`, `iframe`, `noscript`, `picture`, `video`, `img`, `source`
  вырезаются **вместе с содержимым**; все атрибуты, кроме безопасного
  `<a href>`, снимаются;
- внешние ссылки получают `rel="nofollow noopener"`, внутренние остаются
  проходимыми;
- **лимит `SSG_ARTICLE_BODY_MAX_CHARS = 60000`** (`ssg-skeletons.js:736`), рез по
  границе блока (`clampHtmlAtBlock`), чтобы не рвать тег. Прежнее значение 9000
  молча обрезало 150 из 306 опубликованных статей на середине — `#1324`.
- Инъекция идёт **функциями-replacer'ами**, а не строками замены: `$'`/`$&`
  внутри авторского текста иначе разворачивали документ (`#1356`).

Полное тело при этом попадает в `window.__metravelTravelPreload` без обрезки —
шелл и гидратация несут разный объём.

### Meta description

`buildTravelSeoDescription` → `stripHtmlToSnippet` → `normalizeSeoLead` →
`clampDescriptionForAttr`, целевая длина **160**. `normalizeSeoLead`
(`utils/seoText.js`) снимает **до** обрезки всё, что занимает бюджет, но не
отвечает на запрос: декоративные пиктограммы, служебную первую строку маршрута
и непояснительную преамбулу лида — координатный блок («Координаты gps: …
Расстояние от Минска: 173 км.»), эпиграф вместе с подписью автора и авторское
приветствие («Привет! Мы — Юля и Сергей…»). Финальный клэмп считает длину
**в HTML-экранированном виде**, потому что `< > & "` разворачиваются в сущности.

Границы среза держат правила, иначе преамбула уносила бы смысл (`#1754`):

- кавычки сами по себе эпиграфом не являются: «Родники Святые Криницы» —
  гидрологический памятник… держит в кавычках **название объекта**, и признак
  здесь в том, что после закрывающей кавычки фраза продолжается — запятой или
  строчной буквой;
- конец цитаты ищется **по балансу вложенности** той же пары кавычек: в
  «Духовная жизнь начинается, когда положение кажется «безвыходным», тогда…»
  первая `»` закрывает вложенное слово, и срез по ней отдавал бы в сниппет
  вторую половину эпиграфа;
- границей абзаца работают только распорки со смыслом пробела (U+2800, U+200B).
  Мягкий перенос U+00AD и U+200C стоят ВНУТРИ слова: они удаляются без подстановки
  пробела, иначе «Ста­рый Свержень» превращался бы в «Ста рый»;
- представление авторов («Мы — Юля и Сергей…») снимается только следом за
  приветствием: без «Привет!» такая фраза уже содержательная;
- границу между подписью автора и текстом статьи даёт невидимая распорка
  абзаца (U+2800 и родня) — поэтому распорки снимаются **после** разбора
  преамбулы, а не в начале. Без распорки подпись **не срезается вовсе**:
  русский лид сплошь и рядом открывается двумя словами с заглавной («Усадьба
  Павлиново», «Старый Свержень»), и по форме это неотличимо от «Пётр
  Квятковский» — любая эвристика съедала бы слова текста;
- цитата без подписи снимается, если она кончается как высказывание (точка,
  восклицание, вопрос) либо длиннее 60 символов. «Спасо-Преображенская церковь
  в Заславле» так не кончается — название остаётся на месте;
- любой срез отменяется, если после него в лиде остаётся меньше 40 символов:
  статья, целиком построенная на цитате, не должна остаться без описания.

Рантаймовый двойник `getTravelSeoDescription` (`utils/travelSeo.ts:135-147`)
**не побайтово идентичен** SSG-версии: у него нет предпочтения конца
предложения и нет клэмпа по экранированной длине.

### og:image

`pickTravelSeoImage` (`generate-seo-pages.js:452-505`) идёт по лестнице:
первая картинка галереи → `travel_image_detail_hd_url` → апгрейд
`-thumb_200` → `-detail_hd` → мелкий thumb → логотип-фолбэк. Ширина
подставляется в **одной** точке — `withSocialPreviewWidth` внутри `injectMeta`
(`#1221`), таблица ширин по роутам зеркалит `constants/imageContract.ts` и
проверяется `__tests__/scripts/socialPreviewWidthParity.test.ts`.

### Смена slug

Канонический URL — `${SITE_URL}/travels/${slug || id}`. При переименовании пара
`{from, to}` дописывается в `scripts/seo-redirects.json`; генератор кладёт
заглушку и **пропускает** запись, если `from` совпал с живым slug.

**Заглушка — не 301.** nginx отдаёт статику через `try_files $uri.html` и
возвращает **200**, поэтому настоящий редирект из статического файла невозможен:
заглушка несёт `canonical`, `noindex, follow`, meta-refresh и `location.replace`.
На рантайме slug разрешает бэкенд — `/travels/resolve-slug/{slug}/`
(`api/travelDetailsQueries.ts:443-475`), у `articles` свой резолвер с фолбэком
на `by-slug` (`api/articles.ts:351-374`).

## Гейты и тесты

| Гейт | Где | Что ловит |
| --- | --- | --- |
| body-injected | `build-prod.sh:417-423` | ни один файл `travels/**` не содержит `ssg-travel-article` → сборка падает |
| единственный `<h1>` | `build-prod.sh:427-443` | выборка 20 страниц, ровно один `<h1>`. Обходит `find … -name index.html`, то есть плоскую форму не видит |
| полнота выхода (`assertTravelStaticPagesComplete`) | `generate-seo-pages.js`, шаг 6 `main()` | опубликованный travel, у которого в срезе нет `travels/<slug>.html` ИЛИ `travels/<slug>/index.html` → сборка падает со списком недостающих слагов. Стоит последним шагом, после redirect-стабов, поэтому описывает итоговый каталог |
| `verify-static-travel-seo.js` | `build-prod.sh:446` | обе формы страницы по всему каталогу: отсутствие файла, generic title, отсутствующий/дублированный description, canonical ≠ ожидаемого, нет `og:image`/Article JSON-LD |
| `post-deploy-seo-check.js` | `npm run test:seo:postdeploy` | длина description вне 80–170, отсутствие SSR-маркеров на проде |
| `post-deploy-media-check.js` | `npm run test:media:postdeploy` | нерабочие ступени `media.article_body[*].srcset` |

Юнит- и e2e-покрытие: `__tests__/scripts/ssg-skeletons.test.ts` (санитайзер,
клэмп, `$`-паттерны из авторского текста), `__tests__/scripts/generate-seo-pages.test.ts`
(meta, редиректы slug), `__tests__/scripts/generate-seo-pages.output-coverage.test.ts`
и `__tests__/scripts/verify-static-travel-seo.test.ts` (полнота выхода: обе формы
страницы, обход всего каталога), `__tests__/components/ArticleEditor.web.autosave.test.tsx`
(контур автосейва), `__tests__/hooks/useDraftRecovery.test.ts`,
`e2e/draft-recovery.spec.ts`, `__tests__/api/misc.behavior.test.ts`.

## Известные ловушки

- **Правка не видна до пересборки.** Тело в шелле статично: изменение
  `description` доезжает до выдачи только следующим прогоном SSG и деплоем.
- **Автосейв не работает после модерации.** `useTravelFormPersistence` выключен
  при `moderation || publish`; автор, правящий опубликованную статью, обязан
  жать «Сохранить» вручную, иначе правки не уходят.
- **Полное тело живёт в двух версиях.** Шелл обрезан 60 000 символами и без
  картинок, гидратация — полная. Расхождение ожидаемо; путать их при отладке
  выдачи нельзя.
- **Санитайзеры разные.** Тег, переживший `sanitizeRichText`, может быть срезан
  `sanitizeArticleBodyHtml`. «В редакторе видно, а в выдаче нет» — чаще всего
  это, а не потеря данных.
- **`isDirty` структурный.** Программные мутации формы помечают её грязной, из-за
  чего черновик может перезаписаться данными, эквивалентными серверным
  (`WIZARD-DRAFT-001`).
- **Full-replace upsert.** Автосейв шлёт полную замену из частично
  гидратированного состояния и способен стереть серверные поля; постоянное
  решение — серверный `PATCH`/ревизия, оно в P0-бэклоге (`TRAVEL-SAVE-001`).
- **Рекурсия weserv.** Сохранённые адреса, повторно прошедшие нормализацию,
  накапливали до семи вложенных слоёв прокси и тормозили герой-слайды; лечится
  единой развёрткой `unwrapWeservImageUrl` и одним каноническим адресом.

## Открытые вопросы и долги

Исправлено 2026-08-17: расхождение `docs/TRAVEL_DRAFT_RECOVERY.md` про
`recoverDraft` (он черновик не удаляет) и таблица статусов в
`docs/TRAVEL_SAVE_MODERATION_CONTRACT.md` (состояние «отправлено» —
`publish=true, moderation=false`, а `publication_status` — отдельное
бэкендовое поле, которое мастер не пишет). Оба документа приведены к коду.

- `onAutosave` редактора не подключён ни к одному продовому вызову: это
  задел, мёртвый контур или пропущенная проводка — не установлено.
- Как бэкенд обрабатывает `enforce_moderation_validation` и как маппит
  `publish`/`moderation` в `publication_status` — из этого репозитория не видно.
- `rejectionComment` при отклонении модерации никуда не отправляется: он только
  UI-состояние и телеметрия. Доходит ли причина отказа до автора — не
  установлено.
- Выдаёт ли nginx настоящий 301 для сменённых slug — в репозитории следов нет,
  комментарии в коде утверждают обратное.
- Отдельный тип `articles` (`/article/{id}`, `api/articles.ts`, 424 LOC) описан
  здесь только по границам: его собственный жизненный цикл, редактирование и
  роль относительно travel-статей требуют отдельного разбора.
