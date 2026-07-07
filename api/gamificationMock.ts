// Моковые данные геймификации-2 — используются, пока BE (place-first-badge,
// progression-lines, activity-types, character-paths) не готов. Активируются флагом
// EXPO_PUBLIC_ACHIEVEMENTS_MOCK=true или при 404 эндпоинта в DEV.
// Контракт зеркалит docs/features/social-trips-gamification-backlog.md (Sprint A).

import type {
  CharacterDetail,
  CharacterPathOption,
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
  data: Omit<
    ProgressionLine,
    'isMaxLevel' | 'visualKey' | 'progressPercent' | 'pointsToNext' | 'levels'
  > & { nextLevelMin: number | null },
): ProgressionLine => {
  const isMaxLevel = data.nextLevelMin == null;
  const span = isMaxLevel ? 0 : (data.nextLevelMin as number) - data.currentLevelMin;
  const done = Math.max(0, data.current - data.currentLevelMin);
  return {
    ...data,
    visualKey: data.slug,
    isMaxLevel,
    progressPercent: isMaxLevel
      ? 100
      : span > 0
        ? Math.min(100, Math.round((done / span) * 100))
        : 0,
    pointsToNext: isMaxLevel
      ? null
      : Math.max(0, (data.nextLevelMin as number) - data.current),
    levels: [],
  };
};

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
const detail = (
  slug: string,
  name: string,
  unlocked: boolean,
  minLevel: number,
): CharacterDetail => ({
  slug,
  name,
  unlocked,
  visualKey: `fox-${slug}`,
  minLevel,
  equipped: unlocked,
});

const pathOption = (
  slug: CharacterPathOption['slug'],
  name: string,
  description: string,
  emoji: string,
  score: number,
  level: number,
): CharacterPathOption => ({
  slug,
  name,
  description,
  emoji,
  score,
  level,
  canSelect: true,
  lockedReason: null,
});

export const MOCK_CHARACTER_STATE: CharacterState = {
  id: 1,
  name: 'Лисья',
  level: 4,
  pathSlug: null,
  pathName: null,
  activePathSlug: 'fox',
  suggestedPathSlug: 'fox',
  switchUnlocked: true,
  details: [
    detail('collar', 'Ошейник', true, 1),
    detail('backpack', 'Рюкзак', true, 2),
    detail('compass', 'Компас', true, 3),
    detail('map', 'Карта', false, 4),
    detail('medals', 'Медали', false, 5),
    detail('cape', 'Плащ', false, 6),
  ],
  pendingChoice: true,
  pathOptions: [
    pathOption('dog', 'Собачья', 'Социальная ветка за участие, помощь другим и командные действия.', '🐕', 47, 2),
    pathOption('boar', 'Кабанья', 'Авторская ветка за маршруты, места и реакции на контент.', '🐗', 10, 1),
    pathOption('fox', 'Лисья', 'Ветка читателя за просмотры, сохранения и изучение маршрутов.', '🦊', 1523, 5),
    pathOption('bird', 'Птичья', 'Исследовательская ветка за страны и первые открытия мест.', '🦅', 15, 1),
  ],
  updatedAt: '2026-06-21T10:00:00Z',
};
