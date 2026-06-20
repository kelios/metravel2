// api/gamification.ts
// Слой геймификации-2 (Sprint 10): бейдж первооткрывателя места, RPG-линейки
// прогрессии (Собачья/Кабанья/Лисья/Птичья), 4 типа активности
// (Исследователь/Читатель/Автор/Участник), персонажи + выбор пути.
// Контракт зеркалит docs/features/social-trips-gamification-backlog.md (Sprint A).
// Пока бэкенд (BE-place-first-badge/BE-progression-lines/BE-activity-types/
// BE-character-paths) не готов — fetch-функции отдают моки под тем же флагом, что и
// базовые достижения: EXPO_PUBLIC_ACHIEVEMENTS_MOCK=true (или при 404/501/0 в DEV).

import { apiClient, ApiError } from '@/api/client';
import { devWarn } from '@/utils/logger';
import type { BadgeTier } from '@/api/achievements';
import {
  MOCK_PLACE_FIRST_BADGES,
  MOCK_GAMIFICATION_PROGRESS,
  MOCK_CHARACTER_STATE,
} from '@/api/gamificationMock';

// ── Доменные типы (camelCase) ──────────────────────────────────────────────

/** Бейдж первооткрывателя места: автор первым добавил место в каталог. */
export interface PlaceFirstBadge {
  id: number;
  placeId: number;
  placeName: string;
  /** Ссылка на страницу места (deep-link), null если место ещё без публичной страницы. */
  placeUrl: string | null;
  /** Дата открытия (когда место впервые добавлено). */
  discoveredAt: string;
  views: number;
  saves: number;
  visits: number;
  /** Статус автора по месту, напр. «Первооткрыватель». */
  authorStatus: string;
  imageUrl: string | null;
  tier: BadgeTier;
  /** true → показать unlock-тост (открыто в последние сутки). */
  isFresh: boolean;
}

/** Тип активности, прокачивающий соответствующую линейку. */
export type ActivityKind = 'explorer' | 'reader' | 'author' | 'participant';

/** Слаг RPG-линейки прогрессии. */
export type ProgressionLineSlug = 'dog' | 'boar' | 'fox' | 'bird';

/** Одна линейка прогрессии: текущий уровень + % до следующего. */
export interface ProgressionLine {
  slug: ProgressionLineSlug;
  /** Название ветки, напр. «Собачья тропа». */
  name: string;
  activityKind: ActivityKind;
  /** Название типа активности, напр. «Исследователь». */
  activityName: string;
  level: number;
  levelTitle: string;
  /** Текущее значение метрики активности. */
  current: number;
  currentLevelMin: number;
  nextLevelMin: number | null;
  nextLevelTitle: string | null;
  isMaxLevel: boolean;
  /** Эмодзи-маскот ветки (Собака/Кабан/Лиса/Птица). */
  emoji: string;
}

export interface GamificationProgress {
  lines: ProgressionLine[];
}

// ── Персонажи + выбор пути (RPG-ветвление) ──────────────────────────────────

export type CharacterPathSlug = 'cartographer' | 'scout' | 'photohunter';

/** Косметическая деталь персонажа (ошейник/рюкзак/компас/карта/медали/плащ). */
export interface CharacterDetail {
  slug: string;
  name: string;
  unlocked: boolean;
}

/** Вариант пути развития, доступный при разблокировке выбора. */
export interface CharacterPathOption {
  slug: CharacterPathSlug;
  name: string;
  description: string;
  emoji: string;
}

export interface CharacterState {
  id: number;
  name: string;
  level: number;
  /** Выбранный путь (null — ещё не выбран). */
  pathSlug: CharacterPathSlug | null;
  pathName: string | null;
  details: CharacterDetail[];
  /** true → пользователю доступен выбор следующего пути (показать UI выбора). */
  pendingChoice: boolean;
  pathOptions: CharacterPathOption[];
}

export interface ChoosePathInput {
  pathSlug: CharacterPathSlug;
}

// ── Сырые DTO бэкенда (snake_case DRF) ──────────────────────────────────────

interface PlaceFirstBadgeDto {
  id: number;
  place_id: number;
  place_name: string;
  place_url?: string | null;
  discovered_at: string;
  views?: number | null;
  saves?: number | null;
  visits?: number | null;
  author_status?: string | null;
  image_url?: string | null;
  tier?: string | null;
  is_fresh?: boolean | null;
}

interface ProgressionLineDto {
  slug: string;
  name: string;
  activity_kind: string;
  activity_name: string;
  level?: number | null;
  level_title?: string | null;
  current?: number | null;
  current_level_min?: number | null;
  next_level_min?: number | null;
  next_level_title?: string | null;
  emoji?: string | null;
}

interface GamificationProgressDto {
  lines?: ProgressionLineDto[];
}

interface CharacterDetailDto {
  slug: string;
  name: string;
  unlocked?: boolean | null;
}

interface CharacterPathOptionDto {
  slug: string;
  name: string;
  description?: string | null;
  emoji?: string | null;
}

interface CharacterStateDto {
  id: number;
  name: string;
  level?: number | null;
  path_slug?: string | null;
  path_name?: string | null;
  details?: CharacterDetailDto[];
  pending_choice?: boolean | null;
  path_options?: CharacterPathOptionDto[];
}

// ── Мапперы DTO → домен ─────────────────────────────────────────────────────

const TIERS: readonly BadgeTier[] = [
  'none',
  'bronze',
  'silver',
  'gold',
  'platinum',
  'legendary',
];

const normalizeTier = (raw: string | null | undefined): BadgeTier =>
  TIERS.includes(raw as BadgeTier) ? (raw as BadgeTier) : 'gold';

const ACTIVITY_KINDS: readonly ActivityKind[] = [
  'explorer',
  'reader',
  'author',
  'participant',
];

const normalizeActivityKind = (raw: string | null | undefined): ActivityKind =>
  ACTIVITY_KINDS.includes(raw as ActivityKind) ? (raw as ActivityKind) : 'explorer';

const LINE_SLUGS: readonly ProgressionLineSlug[] = ['dog', 'boar', 'fox', 'bird'];

const normalizeLineSlug = (raw: string): ProgressionLineSlug =>
  LINE_SLUGS.includes(raw as ProgressionLineSlug)
    ? (raw as ProgressionLineSlug)
    : 'dog';

const PATH_SLUGS: readonly CharacterPathSlug[] = [
  'cartographer',
  'scout',
  'photohunter',
];

const normalizePathSlug = (
  raw: string | null | undefined,
): CharacterPathSlug | null =>
  PATH_SLUGS.includes(raw as CharacterPathSlug) ? (raw as CharacterPathSlug) : null;

const mapPlaceFirstBadge = (dto: PlaceFirstBadgeDto): PlaceFirstBadge => ({
  id: dto.id,
  placeId: dto.place_id,
  placeName: dto.place_name,
  placeUrl: dto.place_url ? dto.place_url : null,
  discoveredAt: dto.discovered_at,
  views: dto.views ?? 0,
  saves: dto.saves ?? 0,
  visits: dto.visits ?? 0,
  authorStatus: dto.author_status ?? 'Первооткрыватель',
  imageUrl: dto.image_url ? dto.image_url : null,
  tier: normalizeTier(dto.tier),
  isFresh: Boolean(dto.is_fresh),
});

const mapProgressionLine = (dto: ProgressionLineDto): ProgressionLine => {
  const current = dto.current ?? 0;
  const nextLevelMin = dto.next_level_min ?? null;
  return {
    slug: normalizeLineSlug(dto.slug),
    name: dto.name,
    activityKind: normalizeActivityKind(dto.activity_kind),
    activityName: dto.activity_name,
    level: dto.level ?? 1,
    levelTitle: dto.level_title ?? '',
    current,
    currentLevelMin: dto.current_level_min ?? 0,
    nextLevelMin,
    nextLevelTitle: dto.next_level_title ?? null,
    isMaxLevel: nextLevelMin == null,
    emoji: dto.emoji ?? '🐾',
  };
};

const mapProgress = (dto: GamificationProgressDto): GamificationProgress => ({
  lines: (dto.lines ?? []).map(mapProgressionLine),
});

const mapCharacterDetail = (dto: CharacterDetailDto): CharacterDetail => ({
  slug: dto.slug,
  name: dto.name,
  unlocked: Boolean(dto.unlocked),
});

const mapPathOption = (dto: CharacterPathOptionDto): CharacterPathOption => ({
  slug: PATH_SLUGS.includes(dto.slug as CharacterPathSlug)
    ? (dto.slug as CharacterPathSlug)
    : 'cartographer',
  name: dto.name,
  description: dto.description ?? '',
  emoji: dto.emoji ?? '🧭',
});

const mapCharacter = (dto: CharacterStateDto): CharacterState => ({
  id: dto.id,
  name: dto.name,
  level: dto.level ?? 1,
  pathSlug: normalizePathSlug(dto.path_slug),
  pathName: dto.path_name ?? null,
  details: (dto.details ?? []).map(mapCharacterDetail),
  pendingChoice: Boolean(dto.pending_choice),
  pathOptions: (dto.path_options ?? []).map(mapPathOption),
});

// ── Мок-фолбэк (общий флаг с базовыми достижениями) ─────────────────────────

const USE_MOCK = process.env.EXPO_PUBLIC_ACHIEVEMENTS_MOCK === 'true';

const shouldFallbackToMock = (error: unknown): boolean => {
  if (USE_MOCK) return true;
  if (!__DEV__) return false;
  return error instanceof ApiError && [0, 404, 501].includes(error.status);
};

// ── Публичные fetch-функции ─────────────────────────────────────────────────

/** Бейджи первооткрывателя места текущего пользователя. */
export async function fetchMyPlaceFirstBadges(): Promise<PlaceFirstBadge[]> {
  if (USE_MOCK) return MOCK_PLACE_FIRST_BADGES;
  try {
    const dto = await apiClient.get<PlaceFirstBadgeDto[]>(
      '/achievements/place-badges/me/',
    );
    return (dto ?? []).map(mapPlaceFirstBadge);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[gamification] place-badges me → mock fallback');
      return MOCK_PLACE_FIRST_BADGES;
    }
    throw error;
  }
}

/** Бейджи первооткрывателя места конкретного автора (публично). */
export async function fetchUserPlaceFirstBadges(
  userId: string | number,
): Promise<PlaceFirstBadge[]> {
  if (USE_MOCK) return MOCK_PLACE_FIRST_BADGES;
  try {
    const dto = await apiClient.get<PlaceFirstBadgeDto[]>(
      `/achievements/place-badges/user/${userId}/`,
      undefined,
      { skipAuth: true },
    );
    return (dto ?? []).map(mapPlaceFirstBadge);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[gamification] place-badges user → mock fallback');
      return MOCK_PLACE_FIRST_BADGES;
    }
    throw error;
  }
}

/** Линейки прогрессии + типы активности текущего пользователя. */
export async function fetchMyGamificationProgress(): Promise<GamificationProgress> {
  if (USE_MOCK) return MOCK_GAMIFICATION_PROGRESS;
  try {
    const dto = await apiClient.get<GamificationProgressDto>(
      '/achievements/progression/me/',
    );
    return mapProgress(dto);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[gamification] progression me → mock fallback');
      return MOCK_GAMIFICATION_PROGRESS;
    }
    throw error;
  }
}

/** Линейки прогрессии конкретного автора (публично). */
export async function fetchUserGamificationProgress(
  userId: string | number,
): Promise<GamificationProgress> {
  if (USE_MOCK) return MOCK_GAMIFICATION_PROGRESS;
  try {
    const dto = await apiClient.get<GamificationProgressDto>(
      `/achievements/progression/user/${userId}/`,
      undefined,
      { skipAuth: true },
    );
    return mapProgress(dto);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[gamification] progression user → mock fallback');
      return MOCK_GAMIFICATION_PROGRESS;
    }
    throw error;
  }
}

/** Состояние персонажа текущего пользователя (уровни + детали + выбор пути). */
export async function fetchMyCharacter(): Promise<CharacterState> {
  if (USE_MOCK) return MOCK_CHARACTER_STATE;
  try {
    const dto = await apiClient.get<CharacterStateDto>('/achievements/character/me/');
    return mapCharacter(dto);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[gamification] character me → mock fallback');
      return MOCK_CHARACTER_STATE;
    }
    throw error;
  }
}

/** Состояние персонажа конкретного автора (публично). */
export async function fetchUserCharacter(
  userId: string | number,
): Promise<CharacterState> {
  if (USE_MOCK) return MOCK_CHARACTER_STATE;
  try {
    const dto = await apiClient.get<CharacterStateDto>(
      `/achievements/character/user/${userId}/`,
      undefined,
      { skipAuth: true },
    );
    return mapCharacter(dto);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[gamification] character user → mock fallback');
      return MOCK_CHARACTER_STATE;
    }
    throw error;
  }
}

/** Выбор пути развития персонажа. Возвращает обновлённое состояние. */
export async function chooseCharacterPath(
  input: ChoosePathInput,
): Promise<CharacterState> {
  try {
    const dto = await apiClient.post<CharacterStateDto>(
      '/achievements/character/choose-path/',
      { path_slug: input.pathSlug },
    );
    return mapCharacter(dto);
  } catch (error) {
    // Без бэка симулируем применение выбора, чтобы UI-переход работал в превью.
    if (shouldFallbackToMock(error)) {
      devWarn('[gamification] choose-path → mock simulate');
      const chosen =
        MOCK_CHARACTER_STATE.pathOptions.find((o) => o.slug === input.pathSlug) ??
        MOCK_CHARACTER_STATE.pathOptions[0];
      return {
        ...MOCK_CHARACTER_STATE,
        pathSlug: chosen.slug,
        pathName: chosen.name,
        pendingChoice: false,
        pathOptions: [],
      };
    }
    throw error;
  }
}
