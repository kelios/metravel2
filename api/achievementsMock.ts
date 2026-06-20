// Моковые данные системы достижений — используются, пока бэкенд (BE-A4) не готов.
// Активируются флагом EXPO_PUBLIC_ACHIEVEMENTS_MOCK=true или при 404 эндпоинта в DEV.
// Контракт зеркалит docs/ACHIEVEMENTS_DESIGN.md (§5). Картинки значков (imageUrl)
// намеренно null — BadgeMedal рисует процедурную медаль до готовности DES-A1.

import type {
  Badge,
  BadgeProgress,
  MyAchievements,
  PeerBadge,
  PeerBadgeReceived,
  PeerBadgeTarget,
  PublicAchievements,
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
  categorySlug,
  categoryName,
  tier,
  imageUrl: null,
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

const earned = (b: Badge, earnedAt: string): UserBadge => ({ badge: b, earnedAt });

export const MOCK_RANK: UserRank = {
  level: 4,
  title: 'Бывалый',
  totalPoints: 480,
  badgesCount: 6,
  currentLevelMinPoints: 400,
  nextLevelMinPoints: 900,
  nextLevelTitle: 'Писатель',
  isMaxLevel: false,
};

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
  recentlyEarned: [MOCK_EARNED[5]],
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
  categorySlug: 'community',
  categoryName: 'От сообщества',
  tier,
  imageUrl: null,
  points: 0,
  isSecret: false,
  order: id,
  target,
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
};
