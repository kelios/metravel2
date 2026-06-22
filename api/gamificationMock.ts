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

// Пары слаг↔активность и пороги уровней зеркалят реальный BE
// (dog=Участник, boar=Автор, fox=Читатель, bird=Исследователь).
export const MOCK_GAMIFICATION_PROGRESS: GamificationProgress = {
  lines: [
    line({
      slug: 'dog',
      name: 'Собачья',
      activityKind: 'participant',
      activityName: 'Участник',
      description: 'Совместные поездки, к которым вы присоединились',
      level: 2,
      levelTitle: 'Следопыт стаи',
      current: 47,
      currentLevelMin: 25,
      nextLevelMin: 75,
      nextLevelTitle: 'Надёжный спутник',
      emoji: '🐕',
    }),
    line({
      slug: 'boar',
      name: 'Кабанья',
      activityKind: 'author',
      activityName: 'Автор',
      description: 'Опубликованные путешествия и статьи',
      level: 1,
      levelTitle: 'Кабанёнок',
      current: 10,
      currentLevelMin: 0,
      nextLevelMin: 25,
      nextLevelTitle: 'Тропоруб',
      emoji: '🐗',
    }),
    line({
      slug: 'fox',
      name: 'Лисья',
      activityKind: 'reader',
      activityName: 'Читатель',
      description: 'Прочитанные истории путешествий',
      level: 5,
      levelTitle: 'Мудрая лиса',
      current: 1523,
      currentLevelMin: 300,
      nextLevelMin: null,
      nextLevelTitle: null,
      emoji: '🦊',
    }),
    line({
      slug: 'bird',
      name: 'Птичья',
      activityKind: 'explorer',
      activityName: 'Исследователь',
      description: 'Открытые места и точки на карте',
      level: 1,
      levelTitle: 'Птенец',
      current: 15,
      currentLevelMin: 0,
      nextLevelMin: 25,
      nextLevelTitle: 'Наблюдатель',
      emoji: '🦅',
    }),
  ],
};

// BE-модель: «путь» персонажа — одна из четырёх линеек прогрессии
// (dog/boar/fox/bird). Мок зеркалит camelCase-домен из mapCharacter.
export const MOCK_CHARACTER_STATE: CharacterState = {
  id: 1,
  name: 'Лисья',
  level: 4,
  pathSlug: null,
  pathName: null,
  details: [
    { slug: 'collar', name: 'Ошейник', unlocked: true },
    { slug: 'backpack', name: 'Рюкзак', unlocked: true },
    { slug: 'compass', name: 'Компас', unlocked: true },
    { slug: 'map', name: 'Карта', unlocked: false },
    { slug: 'medals', name: 'Медали', unlocked: false },
    { slug: 'cape', name: 'Плащ', unlocked: false },
  ],
  pendingChoice: true,
  pathOptions: [
    {
      slug: 'dog',
      name: 'Собачья',
      description: 'Социальная ветка за участие, помощь другим и командные действия.',
      emoji: '🐕',
    },
    {
      slug: 'boar',
      name: 'Кабанья',
      description: 'Авторская ветка за маршруты, места и реакции на контент.',
      emoji: '🐗',
    },
    {
      slug: 'fox',
      name: 'Лисья',
      description: 'Ветка читателя за просмотры, сохранения и изучение маршрутов.',
      emoji: '🦊',
    },
    {
      slug: 'bird',
      name: 'Птичья',
      description: 'Исследовательская ветка за страны и первые открытия мест.',
      emoji: '🦅',
    },
  ],
};
