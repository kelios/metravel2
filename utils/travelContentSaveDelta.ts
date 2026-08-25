import isEqual from 'fast-deep-equal';

import type { TravelFormData } from '@/types/types';
import { normalizeTravelId } from '@/utils/travelFormUtils';
import { isBlankTravelContent } from '@/utils/travelFormNormalization';

/**
 * Поля, которые принимает узкий `PATCH /travels/{id}/content/` (#1513).
 * Всё остальное — структура статьи и уходит полным `PUT /travels/upsert/`.
 */
export const TRAVEL_CONTENT_SAVE_FIELDS = [
    'name',
    'description',
    'plus',
    'minus',
    'recommendation',
] as const;

export type TravelContentSaveField = (typeof TRAVEL_CONTENT_SAVE_FIELDS)[number];

const CONTENT_FIELD_SET = new Set<string>(TRAVEL_CONTENT_SAVE_FIELDS);

/**
 * Очистка текстового поля обслуживается только полным путём.
 *
 * `ensureRequiredDraftFields` подставляет черновику плейсхолдер вместо пустого
 * значения (имя короче трёх символов, пустые description/plus/minus/
 * recommendation), и узкий эндпоинт такой подмены не делает: его сериализатор
 * принимает у этих полей `null`, но не пустую строку. Отправить «стало пусто»
 * узким путём — это 400 вместо сохранения, поэтому опустошение отдаём полному
 * пути вместе с его draft-семантикой.
 */
const isClearedContentValue = (field: TravelContentSaveField, value: string): boolean =>
    field === 'name' ? value.trim().length < 3 : value.trim().length === 0;

export type TravelContentSavePlan =
    | { kind: 'content'; travelId: number; fields: Partial<Record<TravelContentSaveField, string>> }
    | { kind: 'full' };

const FULL_SAVE: TravelContentSavePlan = { kind: 'full' };

/**
 * Решает, каким контрактом отправлять фоновое сохранение (#1516).
 *
 * Узкий путь берётся ТОЛЬКО когда правка ограничена текстовыми полями уже
 * существующей статьи: сервер тогда обновляет ровно эти колонки и не пересобирает
 * граф статьи. Любое сомнение — точки, галерея, обложка, справочники, отсутствие
 * подтверждённого состояния, новая статья — трактуется в пользу полного
 * сохранения, у которого есть все действующие валидации и защиты.
 *
 * @param next     снимок формы, который автосейв собирается отправить
 * @param baseline последнее подтверждённое сервером состояние (baseline движка
 *                 автосохранения: отправленный и принятый payload)
 */
export function planTravelContentSave(
    next: TravelFormData | null | undefined,
    baseline: TravelFormData | null | undefined,
    fallbackTravelId?: number | null,
): TravelContentSavePlan {
    if (!next || typeof next !== 'object') return FULL_SAVE;
    // Без подтверждённого состояния дифф не с чем считать: любое поле может
    // расходиться с сервером, и узкая отправка молча оставила бы его старым.
    if (!baseline || typeof baseline !== 'object') return FULL_SAVE;

    const travelId = normalizeTravelId(next.id) ?? fallbackTravelId ?? null;
    // Создание статьи — всегда полный путь: узкому эндпоинту нужен существующий id.
    // Первый сейв после создания тоже уходит полным: `id` появляется в снимке и
    // сам попадает в дифф как изменившееся неконтентное поле.
    if (travelId == null) return FULL_SAVE;

    // 🛡 Анти-обнуление: содержательно пустая форма у статьи с id — это признак
    // непрогидратированного состояния (инцидент 2026-07-21, travel 641).
    // Отдаём такой payload полному пути, где он блокируется до отправки.
    if (isBlankTravelContent(next)) return FULL_SAVE;

    const nextRecord = next as unknown as Record<string, unknown>;
    const baselineRecord = baseline as unknown as Record<string, unknown>;
    const keys = new Set([...Object.keys(nextRecord), ...Object.keys(baselineRecord)]);

    const fields: Partial<Record<TravelContentSaveField, string>> = {};

    for (const key of keys) {
        if (isEqual(nextRecord[key], baselineRecord[key])) continue;
        // Изменилось что-то за пределами текстового контракта — структура статьи.
        if (!CONTENT_FIELD_SET.has(key)) return FULL_SAVE;
        const value = nextRecord[key];
        // Узкий путь передаёт только строки. Пустое значение (null/undefined)
        // на изменившемся текстовом поле — потенциальное затирание, его разбирает
        // полный путь со своими нормализациями и guard'ами.
        if (typeof value !== 'string') return FULL_SAVE;
        const field = key as TravelContentSaveField;
        if (isClearedContentValue(field, value)) return FULL_SAVE;
        fields[field] = value;
    }

    if (Object.keys(fields).length === 0) return FULL_SAVE;

    return { kind: 'content', travelId, fields };
}
