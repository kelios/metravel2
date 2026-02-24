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
} from '@/api/quests';
import { getCountryCodeByCoords } from '@/utils/geoCountry';

// ===================== ТИПЫ ФРОНТЕНДА =====================

/** Метаданные квеста для каталогов/поиска (фронтенд формат) */
export type QuestMeta = {
    id: string;
    title: string;
    points: number;
    cityId: string;
    lat: number;
    lng: number;
    durationMin?: number;
    difficulty?: 'easy' | 'medium' | 'hard';
    tags?: string[];
    petFriendly?: boolean;
    cover?: any;
};

/** Тип бандла для фронтенда (совместим с QuestWizardProps) */
export type FrontendQuestBundle = {
    title: string;
    steps: QuestStep[];
    finale: QuestFinale;
    intro?: QuestStep;
    storageKey?: string;
    city?: QuestCity;
    coverUrl?: string;
};

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

/** Исправляет URL медиа, если бэкенд приклеил свой хост перед S3/CDN URL */
export function fixMediaUrl(url: string | null | undefined): string | undefined {
    if (!url) return undefined;

    let result = url.trim();
    const lower = result.toLowerCase();
    let didFixDoubleHost = false;

    // Паттерн из прода: https://hosthttps://real-url (без слеша между host и второй схемой)
    // а также старый вариант: http://host:porthttp(s)://real-url
    if (lower.startsWith('http://') || lower.startsWith('https://')) {
        const secondHttp = lower.indexOf('http://', 1);
        const secondHttps = lower.indexOf('https://', 1);
        const secondProtocolIndex = [secondHttp, secondHttps]
            .filter(i => i > 0)
            .sort((a, b) => a - b)[0];

        if (typeof secondProtocolIndex === 'number') {
            const protocolEnd = lower.indexOf('://') + 3;
            const firstSlashAfterHost = lower.indexOf('/', protocolEnd);
            // Чиним только если вторая схема появилась до первого path-слеша.
            // Это исключает валидные URL вида /path?next=https://...
            if (firstSlashAfterHost === -1 || secondProtocolIndex < firstSlashAfterHost) {
                result = result.slice(secondProtocolIndex);
                didFixDoubleHost = true;
            }
        }
    }

    // Удаляем невалидные S3 signed параметры для публичных файлов.
    // Бэкенд генерирует signed URL, но подпись невалидна из-за приклеенного хоста.
    // Файлы в metravelprod.s3.amazonaws.com публично доступны без подписи.
    if (didFixDoubleHost && result.includes('.s3.amazonaws.com/') && result.includes('X-Amz-Signature=')) {
        const urlObj = new URL(result);
        // Удаляем все AWS signed параметры
        urlObj.searchParams.delete('X-Amz-Algorithm');
        urlObj.searchParams.delete('X-Amz-Credential');
        urlObj.searchParams.delete('X-Amz-Date');
        urlObj.searchParams.delete('X-Amz-Expires');
        urlObj.searchParams.delete('X-Amz-SignedHeaders');
        urlObj.searchParams.delete('X-Amz-Signature');
        result = urlObj.toString();
    }

    return result;
}

/** Конвертирует шаг из API формата во фронтенд формат */
export function adaptStep(apiStep: ApiQuestStep): QuestStep {
    // answer_pattern (новый формат) или answer_type/answer_value (старый)
    const answerType = apiStep.answer_pattern?.type ?? apiStep.answer_type ?? 'any';
    const answerValue = apiStep.answer_pattern?.value ?? apiStep.answer_value ?? '';

    return {
        id: String(apiStep.step_id ?? apiStep.id),
        title: apiStep.title,
        location: apiStep.location,
        story: apiStep.story,
        task: apiStep.task,
        hint: apiStep.hint || undefined,
        answer: buildAnswerChecker(answerType, answerValue),
        lat: typeof apiStep.lat === 'string' ? parseFloat(apiStep.lat) : apiStep.lat,
        lng: typeof apiStep.lng === 'string' ? parseFloat(apiStep.lng) : apiStep.lng,
        mapsUrl: apiStep.maps_url,
        image: fixMediaUrl(apiStep.image_url),
        inputType: apiStep.input_type,
    };
}

/** Конвертирует финал из API формата */
export function adaptFinale(apiFinale: ApiQuestFinale): QuestFinale {
    const videoUrl = fixMediaUrl(apiFinale.video_url);
    const posterUrl = fixMediaUrl(apiFinale.poster_url);
    
    if (apiFinale.video_url && !videoUrl) {
        console.warn('[Quest] Failed to fix video URL:', apiFinale.video_url);
    }
    if (videoUrl) {
        console.log('[Quest] Finale video URL:', videoUrl);
    }
    
    return {
        text: apiFinale.text,
        video: videoUrl,
        poster: posterUrl,
    };
}

/** Конвертирует город из API формата */
export function adaptCity(apiCity: ApiQuestCity): QuestCity {
    const lat = parseFloat(String(apiCity.lat));
    const lng = parseFloat(String(apiCity.lng));
    const countryCode = apiCity.country_code || getCountryCodeByCoords(lat, lng);
    return {
        name: apiCity.name || undefined,
        lat,
        lng,
        countryCode: countryCode || undefined,
    };
}

/** Конвертирует полный бандл из API формата */
export function adaptBundle(apiBundle: ApiQuestBundle): FrontendQuestBundle {
    let steps: QuestStep[] = [];
    try {
        const rawSteps: ApiQuestStep[] = typeof apiBundle.steps === 'string'
            ? JSON.parse(apiBundle.steps)
            : apiBundle.steps;
        steps = rawSteps.map(adaptStep);
    } catch (e) {
        console.error('Error parsing quest steps:', e);
    }

    let intro: QuestStep | undefined;
    try {
        if (apiBundle.intro) {
            const rawIntro: ApiQuestStep = typeof apiBundle.intro === 'string'
                ? JSON.parse(apiBundle.intro)
                : apiBundle.intro;
            intro = { ...adaptStep(rawIntro), id: 'intro' };
        }
    } catch (e) {
        console.error('Error parsing quest intro:', e);
    }

    return {
        title: apiBundle.title,
        steps,
        finale: adaptFinale(apiBundle.finale),
        intro,
        storageKey: apiBundle.storage_key,
        city: adaptCity(apiBundle.city),
    };
}

/** Конвертирует метаданные квеста из API формата */
export function adaptMeta(apiMeta: ApiQuestMeta): QuestMeta {
    return {
        id: apiMeta.quest_id,
        title: apiMeta.title,
        points: parseInt(String(apiMeta.points), 10) || 0,
        cityId: apiMeta.city_id,
        lat: parseFloat(String(apiMeta.lat)),
        lng: parseFloat(String(apiMeta.lng)),
        durationMin: apiMeta.duration_min ?? undefined,
        difficulty: (apiMeta.difficulty as 'easy' | 'medium' | 'hard') || undefined,
        tags: apiMeta.tags ? Object.keys(apiMeta.tags) : undefined,
        petFriendly: apiMeta.pet_friendly,
        cover: fixMediaUrl(apiMeta.cover_url),
    };
}
