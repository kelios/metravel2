---
name: metravel-quest-finale
description: "Финал городского квеста: текст, финальное видео (Ken Burns по обложке) и постер — сгенерировать, залить на прод, проверить. Триггеры: «добавь финальное видео квесту», «какие квесты без финала»."
---

# metravel-quest-finale

Финал квеста — последний экран после прохождения всех точек. Состоит из:

- **`text`** — тёплый человеческий вывод о городе/маршруте (создаётся в
  миграции квеста, см. скилл `metravel-quest`). Есть у **всех** квестов.
- **`video_url`** + **`poster_url`** — короткое финальное видео (Ken Burns по
  обложке квеста, ~17с, 1280×720, **без надписей и звука**) и его постер. Это отдельный пост-шаг, его легко забыть для новых
  квестов.

«Квест без финала» на практике = **есть текст, но нет `video_url`** (новый квест
залит миграцией, но видео не сгенерировано/не залито).

## Полномочия

«Какие квесты без финала» — read-only инвентаризация: верни список и отсутствующие
поля. Генерацию выполняй по запросу на создание медиа; авторский текст — после
подтверждения по `docs/RULES.md` → `Images and placeholders`, с учётом уже
полученного подтверждения в разговоре. Upload/PATCH требуют явного разрешения
на публикацию для выбранных `quest_id`; готовые файлы и dry-run его не заменяют.

## Модель данных

- API детали: `GET /api/quests/by-quest-id/<quest_id>/` → `finale: { text,
  video_url, poster_url }`.
- Запись медиа: `PATCH /api/quest-finales/<finaleId>/` с полями-файлами
  `video` и `poster` (multipart). Токен `Authorization: Token <...>`.
- **`finaleId` НЕ обязан совпадать с числовым `id` квеста.** У квестов 1–25
  совпадал, но у Пафоса (04.10.2026) сдвинут на единицу: квест 220 → финал 219,
  221 → 220, 222 → 221. Фильтра по квесту у `/api/quest-finales/` нет (`?quest=`
  игнорируется), поля квеста в ответе финала тоже нет. Поэтому `finaleId` берут
  только сверкой текста: `finale.text` из `GET /api/quests/by-quest-id/<quest_id>/`
  должен совпасть с `text` из `GET /api/quest-finales/<finaleId>/`. ВСЕГДА сверяй
  перед заливкой и пост-проверкой `video_url`: PATCH идёт по `finaleId`, ошибка
  перезапишет чужой финал.

## Найти квесты без видео-финала

```bash
node -e '
const https=require("https");
const get=u=>new Promise((r,j)=>https.get(u,x=>{let d="";x.on("data",c=>d+=c);x.on("end",()=>r(d))}).on("error",j));
(async()=>{
  // /api/quests/ — DRF-пагинация: {count, next, previous, results}
  let page=1, all=[];
  while(true){ const j=JSON.parse(await get("https://metravel.by/api/quests/?page="+page));
    all.push(...j.results); if(!j.next) break; page++; }
  for(const q of all){ const b=JSON.parse(await get("https://metravel.by/api/quests/by-quest-id/"+q.quest_id+"/"));
    const f=b.finale||{}; if(!f.video_url) console.log("НЕТ ВИДЕО:", q.id, q.quest_id, "|", q.title); }
})();'
```

## Процесс добавления видео-финала

1. **Найди пробелы** командой выше — выпиши `id` + `quest_id` квестов без видео.
2. **Внеси квест в список** `scripts/generate-quest-finale-videos.js` → массив
   `QUESTS`: `{ questId, dir (camelCase), finaleId }`. `finaleId` берётся
   из проверенного маппинга и сверки текущего текста/медиа, не вычисляется
   из числового id квеста. Обложка скачивается с прода автоматически.
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
5. **При разрешённой публикации залей только проверенные targets.** Используй
   версию `scripts/upload-quest-finales.js`, подключённую к общему
   `scripts/lib/metravel-token.js`: она проверяет ожидаемую identity через
   protected `/me/` и не передаёт токен через stdout/argv. Вывод
   `get-quest-token.js` — диагностический JSON, не токен; command substitution
   для `METRAVEL_TOKEN` запрещён. До подключения uploader к этому resolver
   публикация через старый CLI не является проверенным путём.
   Для массовой замены #2207 нужен reviewed video-only manifest, исходные MP4
   backups, проверка preimage/postimage и остановка на первой ошибке; poster,
   текст и переводы не меняются. Заливка последовательная, с паузами и
   checkpoint каждой пачки. UI выкатывается только после всей media серии.
6. **Проверь GET-ом** `GET /api/quests/by-quest-id/<quest_id>/` — `finale.video_url`
   и `poster_url` непустые и ведут на S3. Видео отдаётся байт-в-байт (размер =
   локальному `finale.mp4`), а постер бэк перекодирует в WebP 1200×675 — его
   размер с `poster.jpg` не сравнивать, картинку сверять перцептивно.

## Диагностика 401 при заливке

`GET /api/quest-finales/<id>/` **публичный** — отдаёт 200 без заголовка вообще и
даже с мусорным `Authorization`. Поэтому «GET прошёл» НЕ доказывает, что токен
рабочий, и подбирать схему авторизации по коду GET бессмысленно. Схема верная
одна — `Token <...>`. Различай два ответа на запись:

| ответ на PATCH | что значит | что делать |
| --- | --- | --- |
| `401 {"detail":"Invalid token."}` | схема распознана, токен протух | взять свежий: `node scripts/get-quest-token.js` |
| `401 {"detail":"Authentication credentials were not provided."}` | заголовок не распознан (напр. `Bearer`) или его нет | вернуть схему `Token <...>` |

Protected `/me/` подтверждает identity, а DRF `OPTIONS`/read-only verification
подтверждает доступные capabilities. Публичный GET не заменяет эти проверки.
Не делай no-op PATCH как auth-check и не выводи Authorization/token в команды
или логи. Успешная identity-проверка не заменяет live preimage и postverify
конкретного разрешённого media PATCH.

## Только постер (для квестов с уже готовым видео)

Если видео есть, а постера нет — `generate-quest-finale-videos.js
--posters-existing` извлечёт кадр из прод-видео в `poster.jpg`, затем
`upload-quest-finales.js --posters-only`.

## Окружение / macOS (проверено на практике)

- **Генераторы textless:** нужен только рабочий `ffmpeg` и `ffprobe`.
  Fonts/PIL/drawtext не требуются. Сначала `ffmpeg -version`: сломанная
  homebrew-сборка после обновления зависимостей должна остановить процесс.
- **Ken Burns** сохраняет три zoompan-сегмента и два xfade. **AI** сохраняет
  исходную анимацию, чистый стоп-кадр 4.5 секунды и финальный fade-out.
  Не накладывай PNG, поздравление или название города на видео/постер.
  Поздравление рисует общий UI на языке игрока, город берётся из bundle.
- **AI без сырья:** сохрани исходный production MP4; определи визуально
  последнюю чистую часть до вшитой надписи, декодируй/перекодируй её и проверь
  границу до textless postprocess. Не считай `duration - 4.5` доказанной
  границей и не делай stream-copy cut по GOP. Если чистого клипа нет —
  останови этот target, не заменяй существующую анимацию без решения владельца.
- **Откат:** `video_url` read-only; сохранённый URL не делает rollback рабочим.
  До записи проверь оригинальный MP4 и возможность повторной загрузки файла.
  После восстановления байты видео должны совпасть с backup; URL может измениться.
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
