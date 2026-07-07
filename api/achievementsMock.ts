// Моковые данные системы достижений — используются, пока бэкенд (BE-A4) не готов.
// Активируются флагом EXPO_PUBLIC_ACHIEVEMENTS_MOCK=true или при 404 эндпоинта в DEV.
// Контракт зеркалит docs/ACHIEVEMENTS_DESIGN.md (§5). Картинки значков (imageUrl)
// намеренно null — BadgeMedal рисует процедурную медаль до готовности DES-A1.

import type {
  ActivityType,
  Badge,
  BadgeProgress,
  MyAchievements,
  PeerBadge,
  PeerBadgeReceived,
  PeerBadgeTarget,
  PublicAchievements,
  RareAward,
  RareAwardCatalogItem,
  UserBadge,
  UserRank,
} from '@/api/achievements';

const badge = (
  id: number,
  slug: string,
  name: string,
  description: string,
  categorySlug: string,
  categoryName: string,
  tier: Badge['tier'],
  points: number,
): Badge => ({
  id,
  slug,
  name,
  description,
  categoryId: null,
  categorySlug,
  categoryName,
  categoryIcon: null,
  tier,
  imageUrl: null,
  imageStatus: 'none',
  awardType: 'auto',
  target: 'user',
  points,
  isSecret: false,
  order: id,
});

export const MOCK_BADGES: Badge[] = [
  badge(1, 'welcome', 'Добро пожаловать', 'Регистрация на MeTravel', 'onboarding', 'Старт', 'bronze', 5),
  badge(2, 'profile-ready', 'Профиль готов', 'Заполнен профиль и аватар', 'onboarding', 'Старт', 'bronze', 15),
  badge(3, 'first-steps', 'Первые шаги', 'Первое опубликованное путешествие', 'writer', 'Автор', 'bronze', 25),
  badge(4, 'author-silver', 'Серебряный автор', '15 опубликованных путешествий', 'writer', 'Автор', 'silver', 60),
  badge(5, 'author-gold', 'Золотой автор', '30 опубликованных путешествий', 'writer', 'Автор', 'gold', 120),
  badge(6, 'hiker-bronze', 'Хайкер', '3 похода/трекинга', 'theme', 'Темы', 'bronze', 20),
  badge(7, 'cyclist-bronze', 'Велопутешественник', '3 велопоездки', 'theme', 'Темы', 'bronze', 20),
  badge(8, 'quest-novice', 'Квест-новичок', 'Первый пройденный квест', 'quests', 'Квесты', 'bronze', 15),
  badge(9, 'quest-master', 'Мастер квестов', '15 пройденных квестов', 'quests', 'Квесты', 'gold', 120),
  badge(10, 'crowd-favorite', 'Любимец публики', '50 лайков на путешествиях', 'social', 'Сообщество', 'silver', 40),
  badge(11, 'world-citizen', 'Гражданин мира', '15 посещённых стран', 'geo', 'География', 'legendary', 200),
];

// UserBadge.id умышленно НЕ равен badge.id (смещение +100): моки повторяют BE-контракт,
// где earned_badges[].id (PK разблокировки) ≠ earned_badges[].badge.id (каталог).
const earned = (b: Badge, earnedAt: string): UserBadge => ({
  id: b.id + 100,
  badge: b,
  earnedAt,
  period: null,
  discovery: null,
});

// Значения зеркалят готовый rank-progress summary с бэка (#721):
// span=900-400=500, done=480-400=80 → ratio=0.16, remaining=900-480=420.
export const MOCK_RANK: UserRank = {
  level: 4,
  title: 'Бывалый',
  totalPoints: 480,
  badgesCount: 6,
  currentLevelMinPoints: 400,
  nextLevelMinPoints: 900,
  nextLevelTitle: 'Писатель',
  isMaxLevel: false,
  progressRatio: 0.16,
  remainingPoints: 420,
  recomputedAt: '2026-01-22T08:10:00Z',
};

// Типы активности (top-level activity_types[] в живом ответе). Метрики — произвольные
// счётчики: маппер кладёт их как есть в Record<string, number>.
export const MOCK_ACTIVITY_TYPES: ActivityType[] = [
  {
    type: 'explorer',
    label: 'Исследователь',
    score: 320,
    level: 3,
    nextThreshold: 500,
    progressPercent: 64,
    metrics: { places: 42, countries: 7 },
  },
  {
    type: 'author',
    label: 'Автор',
    score: 180,
    level: 2,
    nextThreshold: 300,
    progressPercent: 60,
    metrics: { travels: 12, likes: 210 },
  },
  {
    type: 'reader',
    label: 'Читатель',
    score: 1523,
    level: 5,
    nextThreshold: null,
    progressPercent: 100,
    metrics: { reads: 1523, saves: 88 },
  },
  {
    type: 'participant',
    label: 'Участник',
    score: 47,
    level: 2,
    nextThreshold: 75,
    progressPercent: 44,
    metrics: { joinedTrips: 4, comments: 63 },
  },
];

const MOCK_EARNED: UserBadge[] = [
  earned(MOCK_BADGES[0], '2025-09-01T10:00:00Z'),
  earned(MOCK_BADGES[1], '2025-09-01T10:05:00Z'),
  earned(MOCK_BADGES[2], '2025-09-12T14:20:00Z'),
  earned(MOCK_BADGES[5], '2025-10-03T09:00:00Z'),
  earned(MOCK_BADGES[7], '2025-11-18T19:30:00Z'),
  earned(MOCK_BADGES[9], '2026-01-22T08:10:00Z'),
];

const progress = (b: Badge, current: number, threshold: number): BadgeProgress => ({
  badge: b,
  current,
  threshold,
});

const MOCK_LOCKED: BadgeProgress[] = [
  progress(MOCK_BADGES[3], 9, 15),
  progress(MOCK_BADGES[4], 9, 30),
  progress(MOCK_BADGES[6], 1, 3),
  progress(MOCK_BADGES[8], 4, 15),
  progress(MOCK_BADGES[10], 7, 15),
];

export const MOCK_MY_ACHIEVEMENTS: MyAchievements = {
  rank: MOCK_RANK,
  earned: MOCK_EARNED,
  locked: MOCK_LOCKED,
  recentlyEarned: [
    MOCK_EARNED[5], // badge id=10, earnedAt 2026-01-22 (~5 months ago)
    MOCK_EARNED[4], // badge id=8, earnedAt 2025-11-18 (~7 months ago)
    MOCK_EARNED[3], // badge id=6, earnedAt 2025-10-03 (~8 months ago)
  ],
  activityTypes: MOCK_ACTIVITY_TYPES,
};

// ── Peer-awarded badges (§10) ───────────────────────────────────────────────

const peerBadge = (
  id: number,
  slug: string,
  name: string,
  description: string,
  target: PeerBadgeTarget,
  tier: PeerBadge['tier'],
): PeerBadge => ({
  id,
  slug,
  name,
  description,
  categoryId: null,
  categorySlug: 'community',
  categoryName: 'От сообщества',
  categoryIcon: null,
  tier,
  imageUrl: null,
  imageStatus: 'none',
  awardType: 'peer',
  target,
  points: 0,
  isSecret: false,
  order: id,
});

export const MOCK_PEER_CATALOG: PeerBadge[] = [
  peerBadge(101, 'favorite-author', 'Любимый автор', 'Один из ваших любимых авторов', 'user', 'gold'),
  peerBadge(102, 'inspired-me', 'Вдохновил меня', 'Этот автор вдохновил на путешествие', 'user', 'silver'),
  peerBadge(103, 'best-storyteller', 'Лучший рассказчик', 'Истории, которые хочется читать', 'user', 'platinum'),
  peerBadge(104, 'discovery', 'Открытие', 'Приятное открытие среди авторов', 'user', 'bronze'),
  peerBadge(111, 'best-article', 'Лучшая статья', 'Лучшая статья, что вы читали', 'travel', 'gold'),
  peerBadge(112, 'best-photos', 'Лучшие фото', 'Потрясающие фотографии', 'travel', 'platinum'),
  peerBadge(113, 'want-to-repeat', 'Хочу повторить', 'Маршрут, который хочется пройти', 'travel', 'silver'),
  peerBadge(114, 'most-useful', 'Самый полезный', 'Очень полезный материал', 'travel', 'bronze'),
];

const received = (
  badge: PeerBadge,
  count: number,
  grantedByMe: boolean,
): PeerBadgeReceived => ({ badge, count, grantedByMe });

export const MOCK_PEER_RECEIVED: PeerBadgeReceived[] = [
  received(MOCK_PEER_CATALOG[0], 42, false),
  received(MOCK_PEER_CATALOG[1], 17, true),
  received(MOCK_PEER_CATALOG[2], 8, false),
];

export const MOCK_TRAVEL_PEER_RECEIVED: PeerBadgeReceived[] = [
  received(MOCK_PEER_CATALOG[4], 23, false),
  received(MOCK_PEER_CATALOG[5], 31, true),
  received(MOCK_PEER_CATALOG[7], 12, false),
];

export const MOCK_PUBLIC_ACHIEVEMENTS: PublicAchievements = {
  rank: MOCK_RANK,
  earned: MOCK_EARNED,
  peerReceived: MOCK_PEER_RECEIVED,
  activityTypes: MOCK_ACTIVITY_TYPES,
};

// ── Редкие награды (Sprint 11 / блок B) ──────────────────────────────────────

const rareAward = (
  id: number,
  slug: string,
  category: string,
  title: string,
  level: RareAward['level'],
  reason: string,
  grantedAt: string,
  granter: RareAward['grantedByProfile'],
  ownerLimit: number | null,
): RareAward => ({
  id,
  slug,
  category,
  title,
  level,
  reason,
  grantedAt,
  grantedByProfile: granter,
  ownerLimit,
  isRare: true,
  shareTemplate: 'rare',
});

const TEAM: RareAward['grantedByProfile'] = { id: 1, name: 'Команда MeTravel' };

export const MOCK_RARE_AWARDS: RareAward[] = [
  rareAward(
    901,
    'first-wave',
    'first-wave',
    'Первая волна',
    'legendary',
    'Один из первых авторов сообщества MeTravel',
    '2025-08-01T09:00:00Z',
    TEAM,
    100,
  ),
  rareAward(
    902,
    'ambassador',
    'ambassador',
    'Амбассадор',
    'platinum',
    'Привёл новых путешественников и продвигает проект',
    '2026-02-14T12:00:00Z',
    TEAM,
    50,
  ),
];

const rareCatalogItem = (
  slug: string,
  category: string,
  title: string,
  level: RareAwardCatalogItem['level'],
  description: string,
  ownerLimit: number | null,
  ownersCount: number,
): RareAwardCatalogItem => ({
  slug,
  category,
  title,
  level,
  description,
  ownerLimit,
  ownersCount,
});

export const MOCK_RARE_AWARD_CATALOG: RareAwardCatalogItem[] = [
  rareCatalogItem('first-wave', 'first-wave', 'Первая волна', 'legendary', 'Один из первых авторов сообщества', 100, 37),
  rareCatalogItem('ambassador', 'ambassador', 'Амбассадор', 'platinum', 'Продвигает проект и приводит людей', 50, 12),
  rareCatalogItem('story-creator', 'story-creator', 'Создатель историй', 'gold', 'Автор выдающихся видео/историй о местах', 100, 8),
  rareCatalogItem('community-heart', 'community-heart', 'Сердце сообщества', 'gold', 'Помогает другим и держит атмосферу', 100, 5),
  rareCatalogItem('legendary', 'legendary', 'Легендарная награда', 'legendary', 'Исключительный вклад в проект', 10, 2),
];
