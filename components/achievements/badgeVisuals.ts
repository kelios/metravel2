// Визуальные токены значков. Арт-направление — векторные гравюрные эмблемы
// (см. BadgeEmblem.tsx): состаренная бумага + тонкая линия + лента-баннер + рамка тира.
// `ring`/`highlight`/`shade` тиров переиспользуются как цвета рамки/ленты эмблемы;
// `badgeIcon` оставлен для legacy-потребителей (a11y/иконки), мотив рисует `badgeMotif`.
// Цвета тиров держим едиными с docs/ACHIEVEMENTS_BADGE_PROMPTS.md.

import type { Feather } from '@expo/vector-icons';
import type { BadgeTier } from '@/api/achievements';
import { translate as i18nT } from '@/i18n';

type FeatherName = keyof typeof Feather.glyphMap;

export interface TierVisual {
  /** Основной цвет тира (рамка/лента/обводка эмблемы). */
  ring: string;
  /** Светлый оттенок тира (двойное кольцо/лучи). */
  highlight: string;
  /** Тёмный оттенок тира (тень/контур ленты). */
  shade: string;
  /** Подпись тира на русском. */
  label: string;
}

export const TIER_VISUALS: Record<BadgeTier, TierVisual> = {
  none: { ring: '#9AA5B1', highlight: '#CBD2D9', shade: '#697587', label: '' },
  bronze: { ring: '#CD7F32', highlight: '#E8A86A', shade: '#8C541E', get label() { return i18nT('achievements:components.achievements.badgeVisuals.tiers.bronze') } },
  silver: { ring: '#AEB6BF', highlight: '#E2E8EE', shade: '#7B848D', get label() { return i18nT('achievements:components.achievements.badgeVisuals.tiers.silver') } },
  gold: { ring: '#F2C037', highlight: '#FCE38A', shade: '#C8941A', get label() { return i18nT('achievements:components.achievements.badgeVisuals.tiers.gold') } },
  platinum: { ring: '#5BD0E0', highlight: '#B8F1F8', shade: '#2E97A6', get label() { return i18nT('achievements:components.achievements.badgeVisuals.tiers.platinum') } },
  legendary: { ring: '#B06BE6', highlight: '#E0B8F5', shade: '#7A3FB0', get label() { return i18nT('achievements:components.achievements.badgeVisuals.tiers.legendary') } },
};

// ── Гравюрная эмблема: рамка по тиру ─────────────────────────────────────────
// Тир кодируется СЛОЖНОСТЬЮ рамки, а не «блеском»:
//   plain   — одиночное тонкое кольцо (bronze)
//   double  — двойное кольцо (silver)
//   laurel  — лавровые ветви по бокам + двойное кольцо (gold)
//   ornate  — орнамент-зубцы по кольцу (platinum)
//   rays    — лучи + звёзды по краю (legendary)

export type TierFrame = 'plain' | 'double' | 'laurel' | 'ornate' | 'rays';

export const TIER_FRAME: Record<BadgeTier, TierFrame> = {
  none: 'plain',
  bronze: 'plain',
  silver: 'double',
  gold: 'laurel',
  platinum: 'ornate',
  legendary: 'rays',
};

export function tierFrame(tier: BadgeTier): TierFrame {
  return TIER_FRAME[tier];
}

// ── Палитра «состаренной бумаги» по категории ────────────────────────────────
// paper — заливка диска, line — цвет тонкой гравюрной линии (мотив + обводка).
// Подобрано так, чтобы читаться и на светлой, и на тёмной теме (см. BadgeEmblem,
// который притемняет paper и осветляет line под dark-режим).

export interface CategoryPalette {
  /** Тёплый/холодный тон бумаги диска (light-режим). */
  paper: string;
  /** Цвет гравюрной линии (light-режим). */
  line: string;
}

export const CATEGORY_PALETTES: Record<string, CategoryPalette> = {
  onboarding: { paper: '#F7EFE0', line: '#7A5C2E' }, // тёплая бумага
  writer: { paper: '#F3ECE2', line: '#5E4B36' }, // пергамент
  theme: { paper: '#EAF1E9', line: '#37563F' }, // мятная карта
  quests: { paper: '#F1E9DC', line: '#6B4A2A' }, // карта-схема
  social: { paper: '#F7E9EC', line: '#8A3A4B' }, // тёплый розовый
  geo: { paper: '#E7EEF4', line: '#2F4A63' }, // холодная синяя
  monthly: { paper: '#EFEAF4', line: '#4E3F66' }, // сиреневая
  community: { paper: '#F4ECE0', line: '#6B5230' }, // peer-награды
  other: { paper: '#F1ECE3', line: '#5A4D3B' },
};

export function categoryPalette(categorySlug: string): CategoryPalette {
  return CATEGORY_PALETTES[categorySlug] ?? CATEGORY_PALETTES.other;
}

// ── Мотивы эмблемы (motif keyed by category + slug) ──────────────────────────
// Каждый ключ рисуется тонкой линией в BadgeEmblem. Резолвинг: сначала точечные
// хинты по slug (как у иконок), затем дефолт по категории.

export type MotifKey =
  | 'star'
  | 'footprint'
  | 'profile'
  | 'quill'
  | 'book'
  | 'mountain'
  | 'bicycle'
  | 'car'
  | 'wave'
  | 'city'
  | 'flag'
  | 'route'
  | 'heart'
  | 'globe'
  | 'calendar'
  | 'laurel';

const CATEGORY_MOTIFS: Record<string, MotifKey> = {
  onboarding: 'star',
  writer: 'quill',
  theme: 'mountain',
  quests: 'flag',
  social: 'heart',
  geo: 'globe',
  monthly: 'calendar',
  community: 'heart',
  other: 'laurel',
};

// Порядок важен: первое совпадение выигрывает.
const SLUG_MOTIF_HINTS: Array<[RegExp, MotifKey]> = [
  [/profile|профиль/i, 'profile'],
  [/welcome|добро|старт|start/i, 'star'],
  [/first-step|первы.?-?шаг|footprint|след/i, 'footprint'],
  [/author|автор|writer|пиш|story|рассказ/i, 'quill'],
  [/book|книг/i, 'book'],
  [/hik|поход|trek|трек|гор/i, 'mountain'],
  [/cycl|bike|вело/i, 'bicycle'],
  [/auto|car|авто|roadtrip|road-?trip|машин/i, 'car'],
  [/water|вод|анкор|anchor|волн|sea|море/i, 'wave'],
  [/city|urban|город/i, 'city'],
  [/quest|квест/i, 'flag'],
  [/route|маршрут|map|карт/i, 'route'],
  [/like|лайк|favorite|сердц|публик|crowd|idol|fan/i, 'heart'],
  [/countr|стран|world|мир|globe|глобус/i, 'globe'],
  [/month|месяц|calendar|календар/i, 'calendar'],
];

/** Мотив эмблемы значка (по slug-хинту, затем по категории). */
export function badgeMotif(categorySlug: string, slug: string): MotifKey {
  for (const [re, motif] of SLUG_MOTIF_HINTS) {
    if (re.test(slug)) return motif;
  }
  return CATEGORY_MOTIFS[categorySlug] ?? CATEGORY_MOTIFS.other;
}

const CATEGORY_ICONS: Record<string, FeatherName> = {
  onboarding: 'star',
  writer: 'edit-3',
  theme: 'compass',
  quests: 'flag',
  social: 'heart',
  geo: 'globe',
  monthly: 'trending-up',
  other: 'award',
};

// Точечные оверрайды по ключевым словам в slug значка (категория «theme» общая).
const SLUG_ICON_HINTS: Array<[RegExp, FeatherName]> = [
  [/hik|поход|trek/i, 'compass'],
  [/cycl|bike|вело/i, 'navigation'],
  [/auto|car|авто/i, 'map'],
  [/water|вод|анкор/i, 'anchor'],
  [/city|urban|город/i, 'map-pin'],
  [/place|место|первооткрыват|discover/i, 'map-pin'],
  [/quest|квест/i, 'flag'],
  [/like|лайк|favorite/i, 'heart'],
  [/subscrib|подпис/i, 'users'],
  [/countr|стран|world|мир/i, 'globe'],
  [/profile|профиль/i, 'user-check'],
];

export function badgeIcon(categorySlug: string, slug: string): FeatherName {
  for (const [re, icon] of SLUG_ICON_HINTS) {
    if (re.test(slug)) return icon;
  }
  return CATEGORY_ICONS[categorySlug] ?? CATEGORY_ICONS.other;
}

export function tierLabel(tier: BadgeTier): string {
  return TIER_VISUALS[tier].label;
}
