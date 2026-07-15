// utils/questAdapters.ts
// Чистые функции-адаптеры и типы для конвертации данных квестов из API формата во фронтенд формат.
// Извлечены из hooks/useQuestsApi.ts для независимого тестирования и переиспользования.

import type { QuestStep, QuestFinale, QuestCity } from '@/components/quests/QuestWizard';
import type {
    ApiQuestMeta,
    ApiQuestBundle,
    ApiQuestStep,
    ApiQuestCity,
    ApiQuestFinale,
    ApiQuestFirstCompleter,
} from '@/api/quests';
import { getCountryCodeByCoords } from '@/utils/geoCountry';
import { normalizeMediaUrl } from '@/utils/mediaUrl';
import { devError } from '@/utils/logger';
import { getQuestAgeCategory, type QuestAgeCategory } from '@/utils/questAudience';
import { translate as i18nT } from '@/i18n'


/**
 * Парсит координату из API (число или строка).
 * Поведение идентично прежнему `parseFloat`, но в dev предупреждает о невалидных
 * значениях, чтобы плохие backend-данные не уходили в маркеры как тихий `NaN` (F-012).
 */
const coordNum = (value: unknown): number => {
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    if (__DEV__ && !Number.isFinite(n)) {
        devError('[Quest] Невалидная координата из API:', value);
    }
    return n;
};

const optionalText = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed || undefined;
};

function adaptPoiInfo(apiStep: ApiQuestStep): QuestStep['poiInfo'] {
    const raw = apiStep.poi_info;
    if (!raw) return null;

    const openingHours = optionalText(raw.opening_hours);
    const ticketPrice = optionalText(raw.ticket_price);
    const website = optionalText(raw.website);

    return {
        isMuseum: Boolean(raw.is_museum),
        ...(openingHours ? { openingHours } : {}),
        ...(ticketPrice ? { ticketPrice } : {}),
        ...(website ? { website } : {}),
    };
}

// ===================== ТИПЫ ФРОНТЕНДА =====================

/** Метаданные квеста для каталогов/поиска (фронтенд формат) */
export type QuestMeta = {
    id: string;
    title: string;
    points: number;
    cityId: string;
    cityName?: string;
    countryName?: string;
    countryCode?: string;
    lat: number;
    lng: number;
    durationMin?: number;
    difficulty?: 'easy' | 'medium' | 'hard';
    tags?: string[];
    petFriendly?: boolean;
    cover?: any;
    ageCategory?: QuestAgeCategory;
    ratingAvg: number | null;
    ratingCount: number;
    completionsCount: number;
    isCompletedByMe: boolean;
    firstCompleter: ApiQuestFirstCompleter | null;
};

/** Тип бандла для фронтенда (совместим с QuestWizardProps) */
export type FrontendQuestBundle = {
    id: number;
    questId: string;
    title: string;
    steps: QuestStep[];
    finale: QuestFinale;
    intro?: QuestStep;
    storageKey?: string;
    city?: QuestCity;
    coverUrl?: string;
    ratingAvg: number | null;
    ratingCount: number;
    userRating: number | null;
    completionsCount: number;
    isCompletedByMe: boolean;
    firstCompleter: ApiQuestFirstCompleter | null;
};

const INTRO_STEP_ID = 'intro';

// ===================== АДАПТЕРЫ: API → Frontend =====================

/** Нормализация ответа пользователя (дублирует логику из data файлов) */
export function normalize(s: string): string {
    return s
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[.,;:!?'„""–—-]/g, '')
        .replace(/ё/g, 'е')
        .trim();
}

/** Создаёт функцию проверки ответа из бэкенд-конфига */
export function buildAnswerChecker(answerType: string, answerValue: string): (input: string) => boolean {
    switch (answerType) {
        case 'any': {
            const fn = () => true;
            (fn as any)._isAny = true;
            return fn;
        }

        case 'exact': {
            const target = answerValue.toLowerCase();
            return (input: string) => {
                const n = normalize(input);
                // Пробуем как число
                const asNum = parseInt(input, 10);
                if (!Number.isNaN(asNum) && String(asNum) === target) return true;
                return n === target;
            };
        }

        case 'exact_any': {
            try {
                const variants: string[] = JSON.parse(answerValue);
                return (input: string) => {
                    const n = normalize(input);
                    return variants.some(v => n === v.toLowerCase());
                };
            } catch {
                return () => false;
            }
        }

        case 'range': {
            try {
                const { min, max } = JSON.parse(answerValue);
                return (input: string) => {
                    const n = parseInt(input, 10);
                    return !Number.isNaN(n) && n >= min && n <= max;
                };
            } catch {
                return () => false;
            }
        }

        case 'any_text': {
            try {
                const { min_length } = JSON.parse(answerValue);
                return (input: string) => normalize(input).length >= (min_length || 1);
            } catch {
                return (input: string) => normalize(input).length > 0;
            }
        }

        case 'any_number':
            return (input: string) => !Number.isNaN(parseInt(input, 10));

        case 'approx': {
            try {
                const { target, tolerance } = JSON.parse(answerValue);
                return (input: string) => {
                    const val = parseFloat(input.replace(',', '.'));
                    return !Number.isNaN(val) && Math.abs(val - target) < tolerance;
                };
            } catch {
                return () => false;
            }
        }

        case 'function': {
            // Fallback: пробуем eval (только для миграции, в проде не должно быть)
            try {
                const fn = eval(`(${answerValue})`);
                if (typeof fn === 'function') return fn;
            } catch { /* ignore */ }
            return () => false;
        }

        default:
            return () => false;
    }
}

function resolveStepInputType(
    answerType: string,
    answerValue: string,
    apiInputType?: ApiQuestStep['input_type']
): QuestStep['inputType'] {
    switch (answerType) {
        case 'any_text':
        case 'exact_any':
            return 'text';
        case 'range':
        case 'any_number':
        case 'approx':
            return 'number';
        case 'exact': {
            if (apiInputType === 'number') {
                const normalized = answerValue.replace(',', '.').trim();
                return normalized !== '' && Number.isFinite(Number(normalized)) ? 'number' : 'text';
            }
            return apiInputType;
        }
        default:
            return apiInputType;
    }
}

function resolveAnswerPattern(pattern: ApiQuestStep['answer_pattern']): { type?: string; value?: unknown } {
    if (!pattern) return {};
    if (typeof pattern === 'string') {
        try {
            const parsed = JSON.parse(pattern) as unknown;
            if (parsed && typeof parsed === 'object') {
                const record = parsed as Record<string, unknown>;
                return {
                    type: typeof record.type === 'string' ? record.type : undefined,
                    value: record.value,
                };
            }
        } catch {
            // Backend returns a raw string only for non-JSON legacy values.
        }
        return { type: pattern, value: '' };
    }
    return pattern;
}

/** Исправляет URL медиа, если бэкенд приклеил свой хост перед S3/CDN URL */
export function fixMediaUrl(url: string | null | undefined): string | undefined {
    const normalized = normalizeMediaUrl(url);
    return normalized || undefined;
}

const adaptFirstCompleter = (
    firstCompleter: ApiQuestFirstCompleter | null | undefined,
): ApiQuestFirstCompleter | null => {
    if (!firstCompleter) return null;
    return {
        ...firstCompleter,
        avatar: fixMediaUrl(firstCompleter.avatar) ?? null,
    };
};

/** Конвертирует шаг из API формата во фронтенд формат */
export function adaptStep(apiStep: ApiQuestStep): QuestStep {
    // answer_pattern (новый формат) или answer_type/answer_value (старый)
    const answerPattern = resolveAnswerPattern(apiStep.answer_pattern);
    const answerType = answerPattern.type ?? apiStep.answer_type ?? 'any';
    const rawAnswerValue = answerPattern.value ?? apiStep.answer_value ?? '';
    // Бэкенд может прислать value числом/объектом (напр. exact -> 2). buildAnswerChecker
    // ждёт строку (.toLowerCase / JSON.parse), иначе бросает и роняет ВЕСЬ список шагов.
    const answerValue = typeof rawAnswerValue === 'string'
        ? rawAnswerValue
        : rawAnswerValue == null
            ? ''
            : typeof rawAnswerValue === 'object'
                ? JSON.stringify(rawAnswerValue)
                : String(rawAnswerValue);

    return {
        id: String(apiStep.step_id ?? apiStep.id),
        title: apiStep.title,
        location: apiStep.location,
        story: apiStep.story,
        task: apiStep.task,
        hint: apiStep.hint || undefined,
        answer: buildAnswerChecker(answerType, answerValue),
        lat: coordNum(apiStep.lat),
        lng: coordNum(apiStep.lng),
        mapsUrl: apiStep.maps_url || '',
        image: fixMediaUrl(apiStep.image_url),
        inputType: resolveStepInputType(answerType, answerValue, apiStep.input_type),
        poiInfo: adaptPoiInfo(apiStep),
    };
}

/** Конвертирует финал из API формата */
export function adaptFinale(apiFinale: ApiQuestFinale): QuestFinale {
    const videoUrl = fixMediaUrl(apiFinale.video_url);
    const posterUrl = fixMediaUrl(apiFinale.poster_url);
    
    if (apiFinale.video_url && !videoUrl) {
        console.warn('[Quest] Failed to fix video URL:', apiFinale.video_url);
    }
    
    return {
        text: apiFinale.text,
        video: videoUrl,
        poster: posterUrl,
    };
}

export function normalizeQuestCountryCode(rawCode: unknown, lat: number, lng: number): string | undefined {
    const normalizedRawCode = typeof rawCode === 'string'
        ? rawCode.trim().toUpperCase()
        : rawCode == null
            ? ''
            : String(rawCode).trim().toUpperCase();

    return normalizedRawCode || getCountryCodeByCoords(lat, lng) || undefined;
}

/** Конвертирует город из API формата */
export function adaptCity(apiCity: ApiQuestCity): QuestCity {
    const lat = coordNum(apiCity.lat);
    const lng = coordNum(apiCity.lng);
    const countryCode = normalizeQuestCountryCode(apiCity.country_code, lat, lng);
    return {
        name: apiCity.name || undefined,
        lat,
        lng,
        countryCode,
    };
}

/** Конвертирует полный бандл из API формата */
export function adaptBundle(apiBundle: ApiQuestBundle): FrontendQuestBundle {
    const normalizeStepKey = (step: Partial<ApiQuestStep> | null | undefined): string => {
        const key = step?.step_id ?? step?.id;
        return String(key ?? '').trim().toLowerCase();
    };
    const isIntroStep = (step: Partial<ApiQuestStep> | null | undefined): boolean => {
        if (!step) return false;
        return Boolean(step.is_intro) || normalizeStepKey(step) === INTRO_STEP_ID;
    };

    let rawSteps: ApiQuestStep[] = [];
    let steps: QuestStep[] = [];
    try {
        const parsedSteps = typeof apiBundle.steps === 'string'
            ? JSON.parse(apiBundle.steps)
            : apiBundle.steps;
        rawSteps = Array.isArray(parsedSteps) ? parsedSteps : [];
        // Порядок шагов должен быть строго последовательным по полю `order`,
        // не завися от порядка выдачи API. Прогресс ключуется по step_id, а не
        // по позиции, поэтому пересортировка не затирает прохождение. Шаги без
        // order уходят в конец, сохраняя исходный относительный порядок (стабильно).
        rawSteps = rawSteps
            .map((s, index) => ({ s, index }))
            .sort((a, b) => {
                const oa = typeof a.s.order === 'number' ? a.s.order : Number.POSITIVE_INFINITY;
                const ob = typeof b.s.order === 'number' ? b.s.order : Number.POSITIVE_INFINITY;
                return oa === ob ? a.index - b.index : oa - ob;
            })
            .map((x) => x.s);
        // Адаптируем пошагово: сбой одного шага не должен ронять весь маршрут (квест без точек).
        steps = rawSteps
            .filter((s) => !isIntroStep(s))
            .map((s) => {
                try {
                    return adaptStep(s);
                } catch (e) {
                    console.error('Error adapting quest step:', s?.step_id ?? s?.id, e);
                    return null;
                }
            })
            .filter((s): s is QuestStep => s !== null);
    } catch (e) {
        console.error('Error parsing quest steps:', e);
    }

    let intro: QuestStep | undefined;
    try {
        if (apiBundle.intro) {
            const rawIntro: ApiQuestStep = typeof apiBundle.intro === 'string'
                ? JSON.parse(apiBundle.intro)
                : apiBundle.intro;
            intro = { ...adaptStep(rawIntro), id: INTRO_STEP_ID };
        } else {
            const introFromSteps = rawSteps.find((s) => isIntroStep(s));
            if (introFromSteps) {
                intro = { ...adaptStep(introFromSteps), id: INTRO_STEP_ID };
            }
        }
    } catch (e) {
        console.error('Error parsing quest intro:', e);
    }

    // Fallback: always provide an intro so each quest starts with a dedicated start screen.
    if (!intro) {
        const cityName = apiBundle.city?.name || i18nT('quests:utils.questAdapters.defaultCity');
        const stepCount = steps.length;
        intro = {
            id: INTRO_STEP_ID,
            title: i18nT('shared:utils.questAdapters.start_kvesta_value1_f0fb29cb', { value1: apiBundle.title }),
            location: cityName,
            story: i18nT('quests:utils.questAdapters.routeIntro', { count: stepCount }),
            task: i18nT('shared:utils.questAdapters.nazhmite_knopku_nachat_kvest_0676ff7c'),
            answer: () => true,
            lat: coordNum(apiBundle.city?.lat || 0),
            lng: coordNum(apiBundle.city?.lng || 0),
            mapsUrl: 'https://metravel.by/quests',
            inputType: 'text',
        };
    }

    return {
        id: apiBundle.id,
        questId: apiBundle.quest_id,
        title: apiBundle.title,
        steps,
        finale: adaptFinale(apiBundle.finale),
        intro,
        storageKey: apiBundle.storage_key,
        city: adaptCity(apiBundle.city),
        coverUrl: fixMediaUrl(apiBundle.cover_url),
        ratingAvg: apiBundle.rating_avg ?? null,
        ratingCount: apiBundle.rating_count ?? 0,
        userRating: apiBundle.user_rating ?? null,
        completionsCount: apiBundle.completions_count ?? 0,
        isCompletedByMe: apiBundle.is_completed_by_me ?? false,
        firstCompleter: adaptFirstCompleter(apiBundle.first_completer),
    };
}

/** Конвертирует метаданные квеста из API формата */
export function adaptMeta(apiMeta: ApiQuestMeta): QuestMeta {
    const lat = coordNum(apiMeta.lat);
    const lng = coordNum(apiMeta.lng);
    const normalizedCountryCode = normalizeQuestCountryCode(apiMeta.country_code, lat, lng);
    const tags = apiMeta.tags ? Object.keys(apiMeta.tags) : undefined;

    return {
        id: apiMeta.quest_id,
        title: apiMeta.title,
        points: parseInt(String(apiMeta.points), 10) || 0,
        cityId: apiMeta.city_id,
        cityName: apiMeta.city_name || undefined,
        countryName: apiMeta.country_name || undefined,
        countryCode: normalizedCountryCode,
        lat,
        lng,
        durationMin: apiMeta.duration_min ?? undefined,
        difficulty: (apiMeta.difficulty as 'easy' | 'medium' | 'hard') || undefined,
        tags,
        petFriendly: apiMeta.pet_friendly,
        cover: fixMediaUrl(apiMeta.cover_url),
        ageCategory: getQuestAgeCategory(tags) ?? undefined,
        ratingAvg: apiMeta.rating_avg ?? null,
        ratingCount: apiMeta.rating_count ?? 0,
        completionsCount: apiMeta.completions_count ?? 0,
        isCompletedByMe: apiMeta.is_completed_by_me ?? false,
        firstCompleter: adaptFirstCompleter(apiMeta.first_completer),
    };
}
