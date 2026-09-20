import { DESIGN_TOKENS } from './designSystem'

// Общие размеры для модели карточек и CSS-сетки лендингов.
export const QUESTS_GRID_WEB_GAP = DESIGN_TOKENS.spacing.xl
export const QUESTS_GRID_MIN_COLUMN_WIDTH = 380
export const QUESTS_LANDING_CONTENT_WIDTH = 840
export const QUESTS_LANDING_PADDING = DESIGN_TOKENS.spacing.lg

/**
 * Базис колонки в списках-ссылках лендингов (города страны, соседние города): на секции 840 px
 * даёт три колонки, на мобильной ширине — одну. Карточка обязана уметь сжиматься (`flexShrink`):
 * контейнеру остаётся ширина экрана минус 80 px, то есть ровно 240 px уже на 320-точечном
 * телефоне, а при делении экрана или зуме — меньше базиса, и без сжатия карточка вылезла бы за
 * рамку секции.
 */
export const QUESTS_LANDING_CARD_MIN_WIDTH = 240

/**
 * Потолок карточки: последний ряд часто неполный, и `flexGrow` растягивал бы одинокую карточку
 * на всю секцию — она читалась бы как отдельный блок, а не как хвост списка. Половина ряда
 * секции: (840 − 32 отступа − 8 зазор) / 2.
 */
export const QUESTS_LANDING_CARD_MAX_WIDTH = 400
