// Визуальные токены значков: цвета тиров (премиум-медали) и иконки по теме.
// Используются BadgeMedal как для процедурной отрисовки (пока нет картинки DES-A1),
// так и для tier-кольца поверх загруженной картинки.

import type { Feather } from '@expo/vector-icons';
import type { BadgeTier } from '@/api/achievements';

type FeatherName = keyof typeof Feather.glyphMap;

export interface TierVisual {
  /** Основной металлик-цвет (кольцо/обводка). */
  ring: string;
  /** Светлый блик для градиента медали. */
  highlight: string;
  /** Тёмный край для глубины. */
  shade: string;
  /** Подпись тира на русском. */
  label: string;
}

export const TIER_VISUALS: Record<BadgeTier, TierVisual> = {
  none: { ring: '#9AA5B1', highlight: '#CBD2D9', shade: '#697587', label: '' },
  bronze: { ring: '#CD7F32', highlight: '#E8A86A', shade: '#8C541E', label: 'Бронза' },
  silver: { ring: '#AEB6BF', highlight: '#E2E8EE', shade: '#7B848D', label: 'Серебро' },
  gold: { ring: '#F2C037', highlight: '#FCE38A', shade: '#C8941A', label: 'Золото' },
  platinum: { ring: '#5BD0E0', highlight: '#B8F1F8', shade: '#2E97A6', label: 'Платина' },
  legendary: { ring: '#B06BE6', highlight: '#E0B8F5', shade: '#7A3FB0', label: 'Легенда' },
};

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
