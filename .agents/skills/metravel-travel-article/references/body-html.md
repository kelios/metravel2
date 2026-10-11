# Тело статьи: HTML, вёрстка, блоки

Читается при сборке или правке `description`. Жанр (2d) — в SKILL.md.

## Вёрстка задаётся структурой HTML

Фронт считает раскладку при показе (`utils/richTextImageLayout.ts` →
`applySmartImageLayout`, вызов из `components/travel/stableContent/htmlTransform.ts`),
поэтому обёртки `img-row-2`/`img-grid` в тело не писать — достаточно порядка
плоских `<p><img>`:

- одиночный портрет между абзацами → обтекаемый float с чередованием сторон
  (сторону фиксирует `class="img-float-right|left"` на `<p>`; ≈45 % колонки на
  desktop, одна колонка на mobile);
- одиночный пейзаж → на всю ширину; два `<p><img>` подряд → ряд; три портрета →
  триптих; четыре → сетка; пять и больше подряд → высокая колонка, разбить абзацем;
- кадры в порядке дня, рядом с абзацем про них; закат — в конце.

Хранимые `<div class="img-jrow">` из старых сохранений выбрасывать: рендер их
снимает (`removeImageLayoutClasses`) и собирает ряды заново. Реальные `width`/
`height` обязательны — по ним считается раскладка. Раскладку проверять по
классам на странице, а не по HTML в API; без браузера —
`typescript.transpileModule` файла `utils/richTextImageLayout.ts` →
`applySmartImageLayout(html)` → счёт классов `img-*`.

```html
<p><img src="https://metravel.by/travel-description-image/<hash>.jpg.webp"
        width="1600" height="1200" alt="Руины замка в Ойцове над долиной Прондника" /></p>
```

**В тело — только свои `travel-description-image/…`.** Внешние, стоковые и
Wikimedia-картинки запрещены; своего фото под раздел нет — раздел без фото.
`address-image/<pointId>/conversions/<hash>.webp` умирает дважды: при
пересоздании точек и при перезаливке фото точки (#1834) — встреченный кадр
перезалить в `collection=description` и заменить ссылку. `alt="Изображение"`
(так сохраняет визард) — дефект во всей статье, не только в своих кадрах.

## Видео и Instagram

YouTube — `?v=` обязателен, между `>` и `</iframe>` ничего:

```html
<p><iframe src="https://www.youtube.com/embed/<ID>?v=<ID>" title="…"
   allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
   allowfullscreen="true" frameborder="0" width="560" height="315"></iframe></p>
```

Без `?v=` `replaceYouTubeIframes` не извлечёт id, и на web вместо лёгкого
фасада загрузится живой плеер.

Instagram (reel/пост) — ТОЛЬКО абзацем-ссылкой
`<p><a href="https://www.instagram.com/reel/<id>/">…</a></p>`. `<iframe src=".../embed">`
бэкенд срезает в `rich_text` — на странице пустой `<p>`; ссылку фронт
(`replaceStandaloneInstagramBlocks`) сам превращает в фасад/iframe на web и
WebView на native.

## «Что рядом» — искать обязательно

Ровно один блок, 3–4 ссылки на СВОИ статьи про тот же массив, город, долину или
тип маршрута. Соседи — двумя запросами с `userIds==1`: по теме
`GET /api/travels/?query=<массив|город|река>&perPage=100` и по сезону
`GET /api/travels/?year=<год>&perPage=100`. Статьи одной поездки или серии
перелинковываются между собой; самую близкую упомянуть и по контексту в теле
(«той же дорогой, что и в …»), если есть естественное место. Каждый слаг —
`curl -o /dev/null -w "%{http_code}" https://metravel.by/travels/<slug>` = 200;
301 → взять канонический слаг из `redirect_url`. Без `?returnTo=`.

## «Квесты по городам рядом»

Ровно один блок с этим заголовком, между «Что рядом» и FAQ (тематические блоки
вроде «Квесты для детей и подростков», `docs/QUEST_CONTENT_PLAN.md` §3.1, —
другой блок, не в счёт). Автоблок «Квест по городу» его не заменяет: он
матчит по названию города и поднимается редко.

Пути — только `/quests/<city_id>/<quest_id>` из `GET /api/quests/` (страница ≤200
записей — идти по `next`; `utils/questCityAlias.js` → `questRouteKey`). Slug не
собирать из названия. curl 200 ничего не доказывает: `/quests/` отдаёт SPA-шелл
на любой путь; валидна только пара `(city_id, quest_id)` из ответа API. Оттуда же
`points` и `duration_min`.

```html
<h2>Квесты по городам рядом</h2>
<p>Своего квеста по <место> у нас пока нет, но если формат «идёшь по городу и
ищешь ответы на месте» вам заходит, рядом есть подходящие маршруты — все
бесплатные и проходятся с телефона.</p>
<ul>
  <li><a href="/quests/<city_id>/<quest_id>">Полное название квеста</a> — зачем он
  именно этому читателю (расстояние, регион, тема). N точек, около M минут.</li>
</ul>
<p>Полный список — на странице <a href="/quests">квестов metravel</a>.</p>
```

3–4 пункта от самого релевантного к дальнему; собственный квест места — первым,
вводный абзац переписывается под него.

## FAQ — только `<details>/<summary>`

`extractFaqEntries` (`scripts/generate-seo-pages.js`) читает пары только из
`<details>`: FAQ на `<h3>`/`<p><strong>` выглядит так же, а `FAQPage` в прод-HTML
не попадает. 5–6 реальных вопросов («сколько времени», «сколько стоит», «как
добраться», «можно ли с собакой», «когда ехать»), ответы от первого лица.

```html
<section class="seo-faq" data-faq="metravel-seo" itemscope itemtype="https://schema.org/FAQPage">
<h2>Частые вопросы: …</h2>
<details itemprop="mainEntity" itemscope itemtype="https://schema.org/Question">
<summary itemprop="name"><strong>Вопрос?</strong></summary>
<div itemprop="acceptedAnswer" itemscope itemtype="https://schema.org/Answer"><div itemprop="text">
<p>Ответ.</p>
</div></div>
</details>
</section>
```

Эталоны: `scripts/vitebsk-guide-content.html`, `scripts/grodno-guide-content.html`.
Проверка на генераторе:

```bash
node -e 'const{buildTravelFaqJsonLd}=require("./scripts/generate-seo-pages");
const h=require("fs").readFileSync(process.argv[1],"utf8");
const j=buildTravelFaqJsonLd(h);console.log(j?j.mainEntity.length+" вопросов":"FAQPage НЕ БУДЕТ")' <файл>.html
```

Ноль вопросов при видимом FAQ — не сдавать. По корпусу то же ловит
`node scripts/seo-audit.js --user-id 1` строкой `FAQ block without FAQPage markup:` (= 0).

## Чистота текста

- Беларусь: никаких упоминаний и ссылок на ресурсы из перечня экстремистских
  материалов РБ («Наша Ніва», «Зеркало»/TUT.BY, «Свабода», «Белсат»,
  «Еврорадио», «Хартия'97»). Легенда, известная только по такому пересказу, —
  «по поздним пересказам краеведов» без ссылки; факт — из книги, музея,
  энциклопедии, госСМИ. Перед записью: `node scripts/scan-content-sources.js <файл>` = 0.
- Приватные данные: скриншоты броней и личных кабинетов из тела убирать;
  `sid=`, `checkin=`/`checkout=` в ссылках срезать, а `aid=`/`label=` (партнёрская
  атрибуция booking) сохранять.
- `[уточнить]`, `__draft_placeholder__`, U+FFFD, `utm_source=chatgpt.com`,
  `<span></span>` в `<li>`, одноэлементные `<ol>`, `<p><br /></p>`, пустые `<h2>` — 0.
