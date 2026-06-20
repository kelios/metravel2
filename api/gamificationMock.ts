// Моковые данные геймификации-2 — используются, пока BE (place-first-badge,
// progression-lines, activity-types, character-paths) не готов. Активируются флагом
// EXPO_PUBLIC_ACHIEVEMENTS_MOCK=true или при 404 эндпоинта в DEV.
// Контракт зеркалит docs/features/social-trips-gamification-backlog.md (Sprint A).

import type {
  CharacterState,
  GamificationProgress,
  PlaceFirstBadge,
  ProgressionLine,
} from '@/api/gamification';

export const MOCK_PLACE_FIRST_BADGES: PlaceFirstBadge[] = [
  {
    id: 9001,
    placeId: 4821,
    placeName: 'Заброшенный костёл в Гервятах',
    placeUrl: '/places/4821',
    discoveredAt: '2026-06-19T14:30:00Z',
    views: 1284,
    saves: 96,
    visits: 23,
    authorStatus: 'Первооткрыватель',
    imageUrl: null,
    tier: 'gold',
    isFresh: true,
  },
  {
    id: 9002,
    placeId: 3310,
    placeName: 'Меловые карьеры под Волковыском',
    placeUrl: '/places/3310',
    discoveredAt: '2026-04-02T09:10:00Z',
    views: 5210,
    saves: 412,
    visits: 188,
    authorStatus: 'Первооткрыватель',
    imageUrl: null,
    tier: 'platinum',
    isFresh: false,
  },
];

const line = (
  data: Omit<ProgressionLine, 'isMaxLevel'> & { nextLevelMin: number | null },
): ProgressionLine => ({
  ...data,
  isMaxLevel: data.nextLevelMin == null,
});

export const MOCK_GAMIFICATION_PROGRESS: GamificationProgress = {
  lines: [
    line({
      slug: 'dog',
      name: 'Собачья тропа',
      activityKind: 'explorer',
      activityName: 'Исследователь',
      level: 3,
      levelTitle: 'Следопыт',
      current: 47,
      currentLevelMin: 30,
      nextLevelMin: 70,
      nextLevelTitle: 'Проводник',
      emoji: '🐕',
    }),
    line({
      slug: 'bird',
      name: 'Птичья тропа',
      activityKind: 'reader',
      activityName: 'Читатель',
      level: 2,
      levelTitle: 'Любопытный',
      current: 112,
      currentLevelMin: 100,
      nextLevelMin: 250,
      nextLevelTitle: 'Знаток',
      emoji: '🦅',
    }),
    line({
      slug: 'fox',
      name: 'Лисья тропа',
      activityKind: 'author',
      activityName: 'Автор',
      level: 4,
      levelTitle: 'Рассказчик',
      current: 18,
      currentLevelMin: 15,
      nextLevelMin: 30,
      nextLevelTitle: 'Летописец',
      emoji: '🦊',
    }),
    line({
      slug: 'boar',
      name: 'Кабанья тропа',
      activityKind: 'participant',
      activityName: 'Участник',
      level: 5,
      levelTitle: 'Душа сообщества',
      current: 340,
      currentLevelMin: 300,
      nextLevelMin: null,
      nextLevelTitle: null,
      emoji: '🐗',
    }),
  ],
};

export const MOCK_CHARACTER_STATE: CharacterState = {
  id: 1,
  name: 'Странник',
  level: 4,
  pathSlug: null,
  pathName: null,
  details: [
    { slug: 'collar', name: 'Ошейник проводника', unlocked: true },
    { slug: 'backpack', name: 'Рюкзак исследователя', unlocked: true },
    { slug: 'compass', name: 'Компас', unlocked: true },
    { slug: 'map', name: 'Карта окрестностей', unlocked: false },
    { slug: 'medals', name: 'Медали за вылазки', unlocked: false },
    { slug: 'cloak', name: 'Плащ первопроходца', unlocked: false },
  ],
  pendingChoice: true,
  pathOptions: [
    {
      slug: 'cartographer',
      name: 'Картограф',
      description: 'Бонус прогрессии за новые места и точки на карте.',
      emoji: '🗺️',
    },
    {
      slug: 'scout',
      name: 'Разведчик',
      description: 'Бонус за дальние вылазки и редкие локации.',
      emoji: '🧭',
    },
    {
      slug: 'photohunter',
      name: 'Фотоохотник',
      description: 'Бонус за фотографии мест и их сохранения.',
      emoji: '📷',
    },
  ],
};
