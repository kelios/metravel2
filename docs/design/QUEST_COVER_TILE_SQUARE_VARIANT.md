# #1542 — квадратный вариант обложки в `QuestForCityCard`

## Цель и область проверки

Карточка `QuestForCityCard` использует фиксированный media-slot `132×132` и
`fit="contain"`. Изменение выбирает backend-owned квадратный вариант обложки,
когда manifest пригоден, и сохраняет прежний `cover_url`, пока square-поля
пусты. Проверяются две web-ширины: desktop `1280px` и mobile `390px`.

UI-поверхности:

1. Home promo grid: `https://metravel.by/`, секция `HomeQuestsPromoSection`
   после hero.
2. Travel detail: `https://metravel.by/travels/78-parkov-78-pechatei-kak-stat-issledovatelem-krakovskikh-parkov`,
   секция `[data-section-key="quest-for-city"]`.
3. Quest finale: `https://metravel.by/quests/1/krakow-dragon`, состояние после
   завершения, marker `quest-next-step-section`. В городе девять квестов, поэтому
   секция содержит рекомендации.

## Состояния evidence

| Состояние | Payload | Ожидаемый raster | Геометрия |
|---|---|---|---|
| Before / production 2026-08-27 | `src_square`, `srcset_square`, `sizes_hint_square` и square-варианты присутствуют, но у всех 156 квестов равны `null` | прежний `cover_url` | `132×132`, `contain`; у landscape-обложек остаётся поле 12.5–21.9% |
| After / square mock | `src_square=/quest-cover/1/square-main.webp`, `srcset_square` содержит ступени `160w` и `320w`, `sizes_hint_square=132px` | один square raster, выбранный браузером из той же лестницы | `132×132`, `contain`; поле 0%, целевой предел ≤10% |
| After / partial manifest | top-level square-поля `null`, `variants.square_160` и `variants.square_320` заполнены | `square_320` как `src`, обе ступени как `srcset` | без изменения slot/radius/layout |
| Fallback | все square-поля `null` или непригодны | прежний нормализованный `cover_url` | без изменения slot/radius/layout |

Пока #1587 не заполнил production manifest, after-состояния доказываются
детерминированным API mock/route interception на каждой из трёх поверхностей.
Production fallback проверяется отдельно без interception.

## Browser evidence contract

Для каждой поверхности и ширины (`1280`, `390`) зафиксировать:

- screenshot всей карточки и computed media-box `132×132`;
- `img.currentSrc`, `img.naturalWidth/naturalHeight`, `object-fit: contain`;
- долю поля `(slotHeight - renderedBitmapHeight) / 2 / slotHeight`, ожидается
  `≤0.10` для square mock;
- один image slot и один effective raster request: нет второго `<img>`,
  `background-image`, blur URL или повторного transfer той же карточки;
- отсутствие новых `console.error`, `pageerror`, HTTP `4xx/5xx`.

## Инварианты

- `docs/RULES.md`: изображения сохраняют пропорции через `contain`; квадратный
  slot нельзя менять на landscape и нельзя переключать на `cover`.
- Web использует ровно один raster; letterbox fill не создаёт второй `<img>` или
  CSS `background-image`. Native blur, если он активен внутри `ImageCardMedia`,
  использует тот же `source`.
- Square source имеет приоритет только внутри `QuestForCityCard`; legacy
  `QuestMeta.cover` не заменяется, потому что detail/hero fallback может требовать
  исходную landscape-обложку.
- `webResponsiveSource` передаётся только для пригодного square manifest и
  проходит тот же viewport gate, что основной `source`.
- Новый UI-текст отсутствует; RU/BE/UK/PL/EN не затрагиваются.

