---
name: metravel-quest-finale
description: >-
  Финальный экран городских квестов на metravel.by: текст финала + финальное
  видео (Ken Burns по обложке) и постер. Найти квесты без видео-финала,
  сгенерировать ffmpeg-видео, залить на прод и проверить. Триггеры: «у квестов
  нет финала», «добавь финальное видео квесту», «какие квесты без финала».
---

# metravel-quest-finale

Финал квеста — последний экран после прохождения всех точек. Состоит из:

- **`text`** — тёплый человеческий вывод о городе/маршруте (создаётся в
  миграции квеста, см. скилл `metravel-quest`). Есть у **всех** квестов.
- **`video_url`** + **`poster_url`** — короткое финальное видео (Ken Burns по
  обложке квеста, ~17с, 1280×720, «Квест пройден!» + название города, **без
  звука**) и его постер. Это отдельный пост-шаг, его легко забыть для новых
  квестов.

«Квест без финала» на практике = **есть текст, но нет `video_url`** (новый квест
залит миграцией, но видео не сгенерировано/не залито).

## Модель данных

- API детали: `GET /api/quests/by-quest-id/<quest_id>/` → `finale: { text,
  video_url, poster_url }`.
- Запись медиа: `PATCH /api/quest-finales/<finaleId>/` с полями-файлами
  `video` и `poster` (multipart). Токен `Authorization: Token <...>`.
- **`finaleId` == числовой `id` квеста** (`finale` — OneToOne, создаётся вместе
  с квестом). Проверено для квестов 1–25. ВСЕГДА сверяй перед заливкой dry-run'ом
  и пост-проверкой `video_url`: PATCH идёт по `finaleId`, ошибка перезапишет
  чужой финал.

## Найти квесты без видео-финала

```bash
node -e '
const https=require("https");
const get=u=>new Promise((r,j)=>https.get(u,x=>{let d="";x.on("data",c=>d+=c);x.on("end",()=>r(d))}).on("error",j));
(async()=>{
  let page=1, all=[];
  while(true){ const j=JSON.parse(await get("https://metravel.by/api/quests/?page="+page));
    all.push(...j.data); if(!j.next_page_url) break; page++; }
  for(const q of all){ const b=JSON.parse(await get("https://metravel.by/api/quests/by-quest-id/"+q.quest_id+"/"));
    const f=b.finale||{}; if(!f.video_url) console.log("НЕТ ВИДЕО:", q.id, q.quest_id, "|", q.title); }
})();'
```

## Процесс добавления видео-финала

1. **Найди пробелы** командой выше — выпиши `id` + `quest_id` квестов без видео.
2. **Внеси квест в список** `scripts/generate-quest-finale-videos.js` → массив
   `QUESTS`: `{ questId, dir (camelCase), city (подпись на видео), finaleId
   = числовой id квеста }`. Обложка скачивается с прода автоматически.
3. **Сгенерируй видео + постер** (нужен только `ffmpeg`, музыка не нужна —
   backend-профиль запрещает аудиодорожку):
   ```bash
   FFMPEG_PATH=ffmpeg node scripts/generate-quest-finale-videos.js --quest-id=<quest_id>
   ```
   Выход: `assets/quests/<dir>/finale.mp4` + `poster.jpg` (каталог в .gitignore).
   Без `--quest-id` генерит все из `QUESTS`.
4. **Dry-run заливки** — проверь, что `finaleId` и файлы верные:
   ```bash
   node scripts/upload-quest-finales.js --dry-run --quest-id=<quest_id>
   ```
5. **Залей на прод** (токен из `.secrets/metravel-token.json`):
   ```bash
   node scripts/upload-quest-finales.js --quest-id=<quest_id>
   ```
   Скрипт PATCH-ит `/api/quest-finales/<finaleId>/` и сам проверяет, что у
   нужного `quest_id` появился `video_url`/`poster_url` (✅/❌ в выводе).
   Без `--quest-id` зальёт все; `--posters-only` — только постеры (вкл. старые
   квесты с уже готовым видео).
6. **Проверь GET-ом** `GET /api/quests/by-quest-id/<quest_id>/` — `finale.video_url`
   и `poster_url` непустые и ведут на S3.

## Только постер (для квестов с уже готовым видео)

Если видео есть, а постера нет — `generate-quest-finale-videos.js
--posters-existing` извлечёт кадр из прод-видео в `poster.jpg`, затем
`upload-quest-finales.js --posters-only`.

## Окружение / macOS (проверено на практике)

- **Шрифты кроссплатформенны через env** (дефолт — Windows):
  `FONT_BOLD_PATH='/System/Library/Fonts/Supplemental/Arial Bold.ttf'`,
  `FONT_REG_PATH='/System/Library/Fonts/Supplemental/Arial.ttf'`.
- **`ffmpeg` обязателен** (`brew install ffmpeg`). Если сборка БЕЗ `libfreetype`
  (`ffmpeg -filters | grep drawtext` пусто → ошибка `No such filter: drawtext`) —
  текст «Квест пройден! / <город>» рендерится в прозрачный PNG (Python PIL,
  Arial Bold 64 @ y=h-220 + Arial 40 @ y=h-130, white + stroke black@~0.55) и
  накладывается `overlay`-ом с `fade=in:st=12.44:d=0.8` поверх той же
  zoompan/xfade-анимации. PNG подавать как `-loop 1 -framerate 25 -t 16.96 -i`,
  иначе overlay виден только в кадре 0.
- **Звука в новых финалах нет.** Backend отклоняет upload с аудиодорожкой
  (`quests/video_policy.py`, документ `docs/QUEST_FINALE_VIDEO_POLICY.md` в
  бэк-репо). Профиль ролика на фронте один —
  `scripts/quest-finale-video-profile.js`: H.264/yuv420p, CRF 28, `+faststart`,
  без аудио, ≤1280 px, ≤30 c, ≤2.5 Мбит/с, ≤8 MiB. Второй набор констант в
  скриптах заводить нельзя; правки — только вслед за backend-документом.
- **Проверить готовый файл** тем же набором правил, что и команда бэка
  `audit_quest_finale_videos`:
  `node scripts/quest-finale-video-profile.js assets/quests/<dir>/finale.mp4`
  (пустой `policy_violations` = ролик примет upload-валидатор). Генераторы
  вызывают эту проверку сами и падают, если ролик вне профиля.
- **Старые прод-ролики со звуком** перекодирует backend-задача #1169 — не
  переливай их вручную.

## Owner-controlled

Генерация требует локального `ffmpeg`, заливка — прод-токена в
`.secrets/metravel-token.json` (gitignored, в чат не вставлять). Это прод-запись —
запускает владелец. Агент готовит код (список `QUESTS`) и команды, не пишет на
прод без явного запроса.

## Связанное

- `metravel-quest` — создание квеста и текстового финала (`/api/quest-finales/`
  через миграцию).
- Скрипты: `scripts/generate-quest-finale-videos.js`,
  `scripts/upload-quest-finales.js`, `scripts/postprocess-quest-ai-video.js`.
