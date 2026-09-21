/**
 * Гейт пропорции обложки квеста (#1987).
 *
 * Слот обложки в карточке каталога `/quests` — ЛАНДШАФТНЫЙ и фиксированный:
 * `cardHeight = cardWidth / 380 * 260`, то есть 1.4615
 * (`screens/tabs/QuestCard.tsx`). Кадрируется только `contain`
 * (`docs/RULES.md` → «Images and placeholders»), поэтому пропорцию держит
 * КОНТЕНТ, а не вёрстка: всё, что уже́ слота, выходит плоским полем по бокам.
 *
 * Замер прода 19.09.2026 по всем 207 обложкам (`/api/quests/?compact=1`) —
 * доля плоского поля на карточке каталога:
 *
 *   1:1  (30 обложек) → 31.6%   ← партия 19.09, из-за неё и заведён гейт
 *   4:3  (55 обложек) →  8.8%
 *   1.46 ( 2 обложки) →  0.0%
 *   3:2  (64 обложки) →  2.6%   ← цель
 *   16:9 (56 обложек) → 17.8%   ← по высоте, исторический хвост
 *
 * Гейт намеренно пропускает всю историческую полосу 4:3…16:9 и отбивает только
 * то, что хуже неё, — иначе он отверг бы 111 уже опубликованных обложек и был
 * бы выключен на первом же прогоне. Ориентир для НОВОЙ обложки — 3:2.
 *
 * Модуль без внешних зависимостей и на CommonJS: его зовут node-скрипты
 * заливки, а размеры кадра из заголовка файла читает общий `./imageSize`
 * (без `sharp`/`jimp`).
 */

const { readImageSize } = require('./imageSize');

/** Ниже этого квест-обложку на прод не пускаем: поле шире исторического 4:3. */
const MIN_COVER_ASPECT = 1.3;

/** Выше — кадр настолько широкий, что поле уезжает в высоту сильнее 16:9. */
const MAX_COVER_ASPECT = 1.8;

/** Пропорция слота карточки каталога; к ней стремится новая обложка. */
const TARGET_COVER_ASPECT = 1.5;

/**
 * Проверка одной обложки. Возвращает разбор, а не бросает: вызывающий скрипт
 * сам решает, пропустить файл или остановить заливку.
 */
function inspectQuestCover(filePath) {
  const size = readImageSize(filePath);
  if (!size || !size.width || !size.height) {
    return { filePath, ok: false, reason: 'unreadable', size: null, aspect: null };
  }
  const aspect = size.width / size.height;
  if (aspect < MIN_COVER_ASPECT) {
    return { filePath, ok: false, reason: 'too-narrow', size, aspect };
  }
  if (aspect > MAX_COVER_ASPECT) {
    return { filePath, ok: false, reason: 'too-wide', size, aspect };
  }
  return { filePath, ok: true, reason: null, size, aspect };
}

/** Доля плоского поля, которую такая пропорция даст на карточке каталога. */
function catalogLetterboxShare(aspect, slotAspect = 1.4615) {
  if (!Number.isFinite(aspect) || aspect <= 0) return 1;
  return aspect < slotAspect ? 1 - aspect / slotAspect : 1 - slotAspect / aspect;
}

/** Человекочитаемая причина отказа — одной строкой в лог скрипта заливки. */
function describeQuestCoverVerdict(verdict) {
  if (verdict.ok) {
    const share = (catalogLetterboxShare(verdict.aspect) * 100).toFixed(1);
    return `${verdict.size.width}×${verdict.size.height} (${verdict.aspect.toFixed(3)}), поле ${share}%`;
  }
  if (verdict.reason === 'unreadable') {
    return 'не удалось прочитать размеры кадра (ожидается PNG/WEBP/JPEG)';
  }
  const share = (catalogLetterboxShare(verdict.aspect) * 100).toFixed(1);
  const bound = verdict.reason === 'too-narrow'
    ? `меньше ${MIN_COVER_ASPECT}`
    : `больше ${MAX_COVER_ASPECT}`;
  return (
    `${verdict.size.width}×${verdict.size.height} — пропорция ${verdict.aspect.toFixed(3)} ${bound}: ` +
    `карточка каталога отдаст ${share}% ширины под плоскую заливку. ` +
    `Обложка квеста генерируется ландшафтной ~${TARGET_COVER_ASPECT} (3:2), см. #1987.`
  );
}

/** Бросает, если обложка не проходит гейт. Для скриптов заливки на прод. */
function assertQuestCoverAspect(filePath) {
  const verdict = inspectQuestCover(filePath);
  if (!verdict.ok) {
    throw new Error(`Обложка квеста отклонена гейтом пропорции: ${describeQuestCoverVerdict(verdict)}`);
  }
  return verdict;
}

module.exports = {
  MIN_COVER_ASPECT,
  MAX_COVER_ASPECT,
  TARGET_COVER_ASPECT,
  assertQuestCoverAspect,
  catalogLetterboxShare,
  describeQuestCoverVerdict,
  inspectQuestCover,
  readImageSize,
};
