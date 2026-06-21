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

// BE-модель: «путь» персонажа — это одна из четырёх линеек прогрессии
// (Собачья/Кабанья/Лисья/Птичья). Слаг пути == слаг линейки.
export type CharacterPathSlug = ProgressionLineSlug;

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

/** Один уровень внутри линейки прогрессии. */
interface ProgressionLevelDto {
  level: number;
  title?: string | null;
  min_score?: number | null;
  visual_key?: string | null;
}

/** Линейка прогрессии в ответе BE (`progression/me/` — массив таких объектов). */
interface ProgressionLineDto {
  slug: string;
  name: string;
  description?: string | null;
  visual_key?: string | null;
  activity_type: string;
  activity_label: string;
  score?: number | null;
  progress_percent?: number | null;
  points_to_next?: number | null;
  level: ProgressionLevelDto;
  next_level?: ProgressionLevelDto | null;
  levels?: ProgressionLevelDto[];
}

/** Визуальная деталь персонажа в `character/me/` (`visual_details[]`). */
interface CharacterVisualDetailDto {
  key: string;
  label: string;
  visual_key?: string | null;
  min_level?: number | null;
  unlocked?: boolean | null;
  equipped?: boolean | null;
}

/** Доступный для выбора путь в `character/me/` (`available_paths[]`). */
interface AvailablePathDto {
  slug: string;
  name: string;
  description?: string | null;
  activity_type?: string | null;
  score?: number | null;
  level?: ProgressionLevelDto | null;
  selected?: boolean | null;
  can_select?: boolean | null;
  locked_reason?: string | null;
}

/** Состояние персонажа из `character/me/` (current-user endpoint). */
interface CharacterStateDto {
  user_id: number;
  selected_path?: ProgressionLineDto | null;
  active_path?: ProgressionLineDto | null;
  suggested_path?: ProgressionLineDto | null;
  switch_unlocked?: boolean | null;
  available_paths?: AvailablePathDto[];
  visual_details?: CharacterVisualDetailDto[];
  updated_at?: string | null;
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

const normalizePathSlug = (
  raw: string | null | undefined,
): CharacterPathSlug | null =>
  LINE_SLUGS.includes(raw as CharacterPathSlug) ? (raw as CharacterPathSlug) : null;

/** Эмодзи-маскот ветки по слагу (BE не отдаёт emoji — выводим на FE). */
const LINE_EMOJI: Record<ProgressionLineSlug, string> = {
  dog: '🐕',
  boar: '🐗',
  fox: '🦊',
  bird: '🦅',
};

const lineEmoji = (slug: ProgressionLineSlug): string => LINE_EMOJI[slug];

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
  const slug = normalizeLineSlug(dto.slug);
  const current = dto.score ?? 0;
  const nextLevelMin = dto.next_level?.min_score ?? null;
  return {
    slug,
    name: dto.name,
    activityKind: normalizeActivityKind(dto.activity_type),
    activityName: dto.activity_label,
    level: dto.level?.level ?? 1,
    levelTitle: dto.level?.title ?? '',
    current,
    currentLevelMin: dto.level?.min_score ?? 0,
    nextLevelMin,
    nextLevelTitle: dto.next_level?.title ?? null,
    isMaxLevel: dto.next_level == null,
    emoji: lineEmoji(slug),
  };
};

// BE `progression/me/` отдаёт массив линеек (не `{lines:[]}`); поддерживаем оба.
const mapProgress = (
  dto: ProgressionLineDto[] | { lines?: ProgressionLineDto[] } | null | undefined,
): GamificationProgress => {
  const rawLines = Array.isArray(dto) ? dto : (dto?.lines ?? []);
  return { lines: rawLines.map(mapProgressionLine) };
};

const mapVisualDetail = (dto: CharacterVisualDetailDto): CharacterDetail => ({
  slug: dto.key,
  name: dto.label,
  unlocked: Boolean(dto.unlocked),
});

// Вариант пути == доступная для выбора линейка прогрессии (available_paths[]).
const mapAvailablePath = (dto: AvailablePathDto): CharacterPathOption => {
  const slug = normalizeLineSlug(dto.slug) as CharacterPathSlug;
  return {
    slug,
    name: dto.name,
    description: dto.description ?? dto.level?.title ?? '',
    emoji: lineEmoji(slug),
  };
};

const mapCharacter = (dto: CharacterStateDto): CharacterState => {
  const active = dto.active_path ?? dto.selected_path ?? null;
  const selected = dto.selected_path ?? null;
  // Выбор доступен, когда BE разблокировал смену и путь ещё не закреплён.
  const pendingChoice = Boolean(dto.switch_unlocked) && selected == null;
  const options = (dto.available_paths ?? []).filter(
    (p) => p.can_select !== false,
  );
  return {
    id: dto.user_id,
    name: active?.name ?? 'Персонаж',
    level: active?.level?.level ?? 1,
    pathSlug: normalizePathSlug(selected?.slug),
    pathName: selected?.name ?? null,
    details: (dto.visual_details ?? []).map(mapVisualDetail),
    pendingChoice,
    pathOptions: options.map(mapAvailablePath),
  };
};

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

/** Бейджи первооткрывателя места конкретного автора (публично).
 *  NB: у BE пока НЕТ per-user эндпоинта place-badges (есть только
 *  `/achievements/place-badges/me/`). До появления BE-эндпоинта вызов отдаёт 404 →
 *  graceful mock-fallback. Нужна BE-задача на `/achievements/user/{id}/place-badges/`. */
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
    const dto = await apiClient.get<ProgressionLineDto[]>(
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
    const dto = await apiClient.get<ProgressionLineDto[]>(
      `/achievements/user/${userId}/progression-lines/`,
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
      `/achievements/user/${userId}/character/`,
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
      '/achievements/character/me/path/',
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
