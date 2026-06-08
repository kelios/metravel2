# Индексация metravel.by — хендофф (2026-06-08)

Контекст и диагноз — `docs/GROWTH_PLAN.md` раздел 9. Этот файл — что уже сделано в коде
и что осталось сделать **владельцу** и **бэкенду**.

---

## ✅ Сделано в коде (FE) — ждёт деплоя

Корень проблемы был: статические страницы отдавали Googlebot только мета + скелетон
(~20 видимых слов), текст статьи рендерил JS. Исправлено:

| Задача | Что сделано | Файлы |
|---|---|---|
| **FE-IDX-1** | SSG инжектит реальный текст статьи (санитизированные `p/h2/ul/li/a`) + видимый `<h1>` в статику. Googlebot теперь видит ~1400 слов вместо ~20. | `scripts/ssg-skeletons.js`, `scripts/generate-seo-pages.js` |
| **FE-IDX-3** | Crawlable блок «Похожие путешествия» (до 6 внутренних ссылок) в каждой travel-странице — краул-глубина для orphan-страниц. | `scripts/ssg-skeletons.js`, `scripts/generate-seo-pages.js` |
| **FE-IDX-4** | Видимый `<h1>` (был скрыт `clip:rect(0,0,0,0)`). | `scripts/ssg-skeletons.js` |
| **FE-IDX-2** | Диагностика генерации: warning на статьи без имени (generic-заголовок) + % страниц с телом. | `scripts/generate-seo-pages.js` |

Безопасно: санитайзер вырезает `script/style/iframe/img/on*-хендлеры/javascript:`; внешним
ссылкам ставит `rel="nofollow noopener"`, внутренние оставляет followable. Пустое описание →
фолбэк на прежний скелетон (ничего не ломается). Тесты: 654/654 зелёные, eslint чист.

> ⚠️ **Эти правки попадут в Google только после пересборки и деплоя прода.**

---

## 👤 ВЛАДЕЛЕЦ — по шагам

### 1. Собрать и задеплоить прод
```bash
npm run build:web:prod      # expo export → dist/prod
npm run seo:generate-pages  # инжект мета + тела статей + перелинковки
# выложить dist/prod на сервер (как обычно)
```
После деплоя проверь любую статью «как Googlebot»:
```bash
curl -s -A "Googlebot" https://metravel.by/travels/krasnyy-bereg | grep -c "ssg-travel-article"
```
Должно быть `1` (тело статьи в HTML).

### 2. Запросить индексирование в GSC (после деплоя)
GSC → «Проверка URL» → вставить URL → «Запросить индексирование». ~10–12 URL/день.
Приоритет — **37 статей «URL неизвестен Google»** (Google их ещё не краулил; они в sitemap,
но без краула; перелинковка FE-IDX-3 + запрос помогут):

Полный актуальный список в любой момент:
```bash
npm run stats:index:json   # поле problems[].url, coverageState
```
Топ на сейчас (Хорватия/Париж/Польша — свежие):
- /travels/plitvitskie-ozera-v-khorvatii-...
- /travels/natsionalnyi-park-krka-v-khorvatii-...
- /travels/zagreb-za-odin-den-...
- /travels/split-za-odin-den-...
- /travels/kak-poekhat-v-parizhskii-disneilend-...
- /travels/idealnyi-uikend-v-parizhe-...
- /travels/zamok-ksenzh-v-polshe-...
- /travels/reka-isloch-otdykh-s-sobakoi-...
- /travels/park-stankovo-pod-minskom-...
- /travels/kaliningrad-zimoi-...
(и ещё 27 — см. команду выше)

### 3. Эффект
Через 3–7 дней после деплоя+запроса часть «неизвестных» уйдёт в индекс. «Просканированные,
но не проиндексированные» (19 шт.) подтянутся за 1–3 недели — у них теперь есть тело.
Контроль: `npm run stats:index` (сравнить с `scripts/.index-cache/baseline-2026-06-08.json`:
было 238/294 в индексе).

---

## 🔧 БЭКЕНД — спека (BE-IDX)

### BE-IDX-1 — 301-редиректы при смене slug
Сейчас slug генерится из `name`; смена `name` меняет URL и теряет ссылочный вес + ломает
закладки/выдачу. Нужно: при изменении slug писать запись `old_slug → new_slug` (таблица или
nginx-map) и отдавать **301** со старого пути на новый. Без этого нельзя безопасно чистить
раздутые заголовки.

### BE-IDX-2 — чистка раздутых слагов
50 статей user_id 1 со slug > 90 символов (keyword-stuffed). Это вторичный сигнал низкого
качества. После BE-IDX-1 — сократить `name`/slug. Топ-10 по трафику (id | views | новый slug):

| id | views | новый slug |
|---|---|---|
| 252 | 3641 | chto-posmotret-v-oshmyanah |
| 219 | 3356 | velomarshrut-golynka-novickie |
| 188 | 2132 | marshrut-grodnenskaya-oblast-usadby |
| 243 | 2037 | dvorec-slacvinskih-memorialnyy |
| 187 | 1955 | mogilev-usadba-tolstykh-bykhovskiy-zamok |
| 247 | 1501 | letnyaya-rezidenciya-radzivilov-usadby |
| 189 | 1457 | velomarshrut-doty-pervoy-mirovoy-usadby |
| 290 | 1389 | zamok-nemodlin-dvorets-kopitse |
| 196 | 1331 | velomarshrut-krevskiy-zamok-golshany |
| 131 | 1298 | baikovskiy-rodnik-mogilevskaya-oblast |

Каждой — 301 со старого slug. Полный список 50: `node scripts/seo-audit.js --user-id 1 --json`.

### BE-IDX-3 — sitemap (= BE-2)
Проверено: 37 «неизвестных» статей в sitemap **есть**. Дыры нет. Но убедиться, что `lastmod`
обновляется при правке статьи (Google смотрит на дату), и что нет 404/301 внутри sitemap.

### Старые слаги (источник generic-фолбэка)
Часть URL (напр. `/travels/dominikana`) — старые слаги без статической страницы → nginx
отдаёт `[param].html` с заголовком «Путешествие | Metravel». Лечится BE-IDX-1 (301 на актуальный URL).

---

## Мониторинг
- `npm run stats:index` — индексация статей user_id 1 (в индексе / не в индексе + причины).
- Агент `index-doctor` — разбирает не-в-индексе и чинит контентом (только user_id 1).
- Baseline: `scripts/.index-cache/baseline-2026-06-08.json`.
