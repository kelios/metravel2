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
import { normalizeMediaUrl } from '@/utils/mediaUrl';
import { isSameWordForm, matchesAnyWordForm } from '@/utils/questAnswerMorphology';
import { devError } from '@/utils/logger';
import { getQuestAgeCategory, type QuestAgeCategory } from '@/utils/questAudience';
import {
    buildQuestCountModel,
    type QuestCountModel,
    type QuestPointRole,
} from '@/utils/questCountModel';
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

/**
 * Quest copy is plain text, so React Native does not decode HTML character
 * references. Some persisted quest texts use numeric entities for newlines;
 * decode only those entities and leave all other markup-like text untouched.
 */
const normalizeQuestText = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    return value
        .replace(/&#(?:0*13|x0*d);&#(?:0*10|x0*a);/gi, '\n')
        .replace(/&#(?:0*10|0*13|x0*a|x0*d);/gi, '\n');
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
    cover?: string;
    /** Квадратный source + web-лестница; отсутствуют при непригодном manifest. */
    squareCoverWebResponsiveSource?: QuestSquareCoverResponsiveSource;
    ageCategory?: QuestAgeCategory;
    ratingAvg: number | null;
    ratingCount: number;
    completionsCount: number;
    isCompletedByMe: boolean;
    firstCompleter: ApiQuestFirstCompleter | null;
};

export type QuestSquareCoverResponsiveSource = {
    src: string;
    srcSet?: string;
    sizes?: string;
};

const QUEST_SQUARE_VARIANT_WIDTHS = new Set([160, 320]);
const QUEST_SQUARE_SRCSET_CANDIDATE = /^(\S+)\s+(\d+)w$/;

/**
 * Выбирает только backend-owned квадратные производные для плитки #1542.
 * Обычная `cover_url` сюда намеренно не попадает: она ландшафтная и остаётся
 * отдельным fallback, пока backfill #1587 не заполнит square manifest.
 */
function adaptSquareCoverMedia(apiMeta: ApiQuestMeta): QuestSquareCoverResponsiveSource | undefined {
    const coverMedia = apiMeta.media?.cover;
    if (!coverMedia) return undefined;

    const candidates = new Map<number, string>();
    if (typeof coverMedia.srcset_square === 'string') {
        for (const rawCandidate of coverMedia.srcset_square.split(',')) {
            const match = QUEST_SQUARE_SRCSET_CANDIDATE.exec(rawCandidate.trim());
            if (!match) continue;
            const width = Number(match[2]);
            if (!QUEST_SQUARE_VARIANT_WIDTHS.has(width) || candidates.has(width)) continue;
            const url = fixMediaUrl(match[1]);
            if (url) candidates.set(width, url);
        }
    }

    for (const [width, rawUrl] of [
        [160, coverMedia.variants?.square_160],
        [320, coverMedia.variants?.square_320],
    ] as const) {
        if (candidates.has(width)) continue;
        const url = fixMediaUrl(rawUrl);
        if (url) candidates.set(width, url);
    }

    const canonicalSrc =
        fixMediaUrl(coverMedia.src_square) ??
        candidates.get(320) ??
        candidates.get(160);
    if (!canonicalSrc) return undefined;

    const srcSet = Array.from(candidates.entries())
        .sort(([left], [right]) => left - right)
        .map(([width, url]) => `${url} ${width}w`)
        .join(', ');
    const sizes = typeof coverMedia.sizes_hint_square === 'string'
        ? coverMedia.sizes_hint_square.trim()
        : '';

    return {
        src: canonicalSrc,
        ...(srcSet ? { srcSet } : {}),
        ...(sizes ? { sizes } : {}),
    };
}

/** Тип бандла для фронтенда (совместим с QuestWizardProps) */
export type FrontendQuestBundle = {
    id: number;
    questId: string;
    title: string;
    steps: QuestStep[];
    finale: QuestFinale;
    intro?: QuestStep;
    countModel: QuestCountModel;
    storageKey?: string;
    city?: QuestCity;
    coverUrl?: string;
    /** Теги квеста (meta.tags). В detail-API их нет — хук дообогащает из списка. */
    tags?: string[];
    ratingAvg: number | null;
    ratingCount: number;
    userRating: number | null;
    completionsCount: number;
    isCompletedByMe: boolean;
    firstCompleter: ApiQuestFirstCompleter | null;
};

const INTRO_STEP_ID = 'intro';

const QUEST_POINT_ROLES = new Set<QuestPointRole>(['start', 'required', 'optional', 'final']);

/**
 * Accept only backend-owned classification fields. Authored titles and ids are
 * not authority, and answer behavior is not a role: optional pauses and the
 * final point can use the same `any` checker.
 */
function adaptPointRole(apiStep: ApiQuestStep): QuestPointRole | undefined {
    if (apiStep.is_intro) return 'start';

    const rawRole = apiStep.point_role;
    if (typeof rawRole === 'string' && QUEST_POINT_ROLES.has(rawRole as QuestPointRole)) {
        return rawRole as QuestPointRole;
    }
    return undefined;
}

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

/**
 * Создаёт функцию проверки ответа из бэкенд-конфига.
 * Тип паттерна остаётся на самой функции (`_answerType`): телеметрия попыток
 * решает по нему, можно ли отправлять сырой ввод, а карточка шага о правилах
 * проверки по-прежнему ничего не знает.
 */
export function buildAnswerChecker(answerType: string, answerValue: string): QuestStep['answer'] {
    const checker = createAnswerChecker(answerType, answerValue);
    checker._answerType = answerType;
    return checker;
}

function createAnswerChecker(answerType: string, answerValue: string): QuestStep['answer'] {
    switch (answerType) {
        case 'any': {
            const fn: QuestStep['answer'] = () => true;
            fn._isAny = true;
            return fn;
        }

        case 'exact': {
            // Обе стороны сравнения проходят одну нормализацию. Раньше эталон брался
            // как `toLowerCase()`, и значение с «ё», дефисом или пунктуацией было
            // недостижимо: ввод игрока их терял, эталон — нет.
            const target = normalize(answerValue);
            return (input: string) => {
                const n = normalize(input);
                // Пробуем как число
                const asNum = parseInt(input, 10);
                if (!Number.isNaN(asNum) && String(asNum) === target) return true;
                if (n === target) return true;
                // Второй проход — словоформа эталона (#1631). Он не способен
                // отменить уже работающий ответ: до него доходят только вводы,
                // которые строгое сравнение отвергло.
                return isSameWordForm(n, target);
            };
        }

        case 'exact_any': {
            try {
                const parsed: unknown = JSON.parse(answerValue);
                if (!Array.isArray(parsed)) return () => false;
                // Нормализуем словарь один раз при сборке чекера, а не на каждую
                // попытку. Пустые после нормализации варианты выкидываем: иначе
                // словарь с `"-"` принимал бы любой ввод, схлопнувшийся в пустую
                // строку. Аудит прода 06.08.2026: 161 вариант в 93 шагах был
                // недостижим, из них 63 — единственная форма ответа на шаге.
                const variants = parsed
                    .map((v) => normalize(String(v)))
                    .filter((v) => v.length > 0);
                return (input: string) => {
                    const n = normalize(input);
                    if (variants.some(v => n === v)) return true;
                    // Второй проход — словоформа одного из вариантов (#1631):
                    // словарь с `пули` и `снаряды` обязан принимать `пуля` и
                    // `снаряд`, иначе игрок получает отказ на собственный
                    // словарь шага. Правило узкое, разбор — в
                    // `utils/questAnswerMorphology.ts`.
                    return matchesAnyWordForm(n, variants);
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
            // У свободного ответа единственное условие — длина, поэтому порог
            // вешаем на саму функцию: карточка шага по нему объясняет игроку,
            // что ответ свободный и сколько символов нужно. Без этого короткий
            // ответ получал «Неверный ответ» и выглядел как непроходимый вопрос.
            let minLength = 1;
            try {
                const parsed = JSON.parse(answerValue);
                const raw = Number(parsed?.min_length);
                if (Number.isFinite(raw) && raw > 0) minLength = raw;
            } catch { /* повреждённый value — остаётся порог 1 символ */ }

            const fn: QuestStep['answer'] = (input: string) => normalize(input).length >= minLength;
            fn._freeTextMinLength = minLength;
            return fn;
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
            // Fail closed. `answer_value` приходит с бэкенда, поэтому исполнять его
            // (раньше здесь был `eval`) — это выполнение произвольного кода в клиенте
            // по данным, которыми управляет не клиент. Проверено 2026-08-17: на проде
            // 139 квестов / 1160 шагов, ни одного паттерна `function`; такой тип
            // порождают только legacy-скрипты миграции, когда не смогли сериализовать
            // ответ, и теперь они на этом падают, а не заливают шаг.
            console.warn(
                '[quests] answer_pattern type "function" не поддерживается: шаг не будет ' +
                'принимать ответы. Пересериализуй его в exact/exact_any/range/any_text.'
            );
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

/**
 * Человекочитаемый ожидаемый ответ шага — для «страницы ведущего» в печатной
 * версии (QuestPrintable). Свободные типы (any/any_text/any_number) отдают
 * undefined: там любой осмысленный ответ засчитывается.
 */
export function buildAnswerDisplay(answerType: string, answerValue: string): string | undefined {
    try {
        switch (answerType) {
            case 'exact':
                return answerValue || undefined;
            case 'exact_any': {
                const variants = JSON.parse(answerValue);
                if (!Array.isArray(variants) || !variants.length) return undefined;
                return variants.slice(0, 3).join(' / ');
            }
            case 'range': {
                const { min, max } = JSON.parse(answerValue);
                return min === max ? String(min) : `${min}–${max}`;
            }
            case 'approx': {
                const { target, tolerance } = JSON.parse(answerValue);
                return tolerance ? `≈ ${target} (±${tolerance})` : `≈ ${target}`;
            }
            default:
                return undefined;
        }
    } catch {
        return undefined;
    }
}

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
        story: normalizeQuestText(apiStep.story),
        task: normalizeQuestText(apiStep.task),
        hint: apiStep.hint ? normalizeQuestText(apiStep.hint) : undefined,
        answer: buildAnswerChecker(answerType, answerValue),
        answerDisplay: buildAnswerDisplay(answerType, answerValue),
        lat: coordNum(apiStep.lat),
        lng: coordNum(apiStep.lng),
        mapsUrl: apiStep.maps_url || '',
        image: fixMediaUrl(apiStep.image_url),
        inputType: resolveStepInputType(answerType, answerValue, apiStep.input_type),
        poiInfo: adaptPoiInfo(apiStep),
        pointRole: adaptPointRole(apiStep),
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

// #1393: раньше здесь был фолбэк `getCountryCodeByCoords(lat, lng)` на случай,
// когда бэкенд не прислал `country_code`. Он тянул `utils/geoCountry` с таблицей
// контуров стран (47 КБ raw) в слой данных квестов, а оттуда — в стартовый граф
// маршрутов, которым квесты не нужны вовсе.
//
// Замер прод-API 2026-08-10: `country_code` непустой у всех 139 квестов
// (27 различных кодов, ни одного пропуска), то есть фолбэк не срабатывал ни разу.
// Таблица контуров осталась там, где по координатам действительно ищут страну, —
// у партнёрских блоков (`AffiliateSection`, `TripAffiliateBlock`, `BelkrajWidget`).
export function normalizeQuestCountryCode(rawCode: unknown): string | undefined {
    const normalizedRawCode = typeof rawCode === 'string'
        ? rawCode.trim().toUpperCase()
        : rawCode == null
            ? ''
            : String(rawCode).trim().toUpperCase();

    return normalizedRawCode || undefined;
}

/** Конвертирует город из API формата */
export function adaptCity(apiCity: ApiQuestCity): QuestCity {
    const lat = coordNum(apiCity.lat);
    const lng = coordNum(apiCity.lng);
    const countryCode = normalizeQuestCountryCode(apiCity.country_code);
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
            intro = { ...adaptStep(rawIntro), id: INTRO_STEP_ID, pointRole: 'start' };
        } else {
            const introFromSteps = rawSteps.find((s) => isIntroStep(s));
            if (introFromSteps) {
                intro = { ...adaptStep(introFromSteps), id: INTRO_STEP_ID, pointRole: 'start' };
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
            pointRole: 'start',
        };
    }

    const countModel = buildQuestCountModel(steps, intro);
    // Role semantics are atomic: a partially classified payload must not label
    // only some route points as required/optional/final.
    if (countModel.source === 'fallback') {
        steps = steps.map((step) => step.pointRole == null
            ? step
            : { ...step, pointRole: undefined });
    }

    return {
        id: apiBundle.id,
        questId: apiBundle.quest_id,
        title: apiBundle.title,
        steps,
        finale: adaptFinale(apiBundle.finale),
        intro,
        countModel,
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
    const normalizedCountryCode = normalizeQuestCountryCode(apiMeta.country_code);
    const tags = apiMeta.tags ? Object.keys(apiMeta.tags) : undefined;
    const squareCoverWebResponsiveSource = adaptSquareCoverMedia(apiMeta);

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
        squareCoverWebResponsiveSource,
        ageCategory: getQuestAgeCategory(tags) ?? undefined,
        ratingAvg: apiMeta.rating_avg ?? null,
        ratingCount: apiMeta.rating_count ?? 0,
        completionsCount: apiMeta.completions_count ?? 0,
        isCompletedByMe: apiMeta.is_completed_by_me ?? false,
        firstCompleter: adaptFirstCompleter(apiMeta.first_completer),
    };
}
