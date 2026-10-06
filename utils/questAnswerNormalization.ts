// utils/questAnswerNormalization.ts
//
// Нормализация ответа игрока по языку контента квеста (#2196, решение D6 в
// `openspec/changes/add-quest-content-localization/design.md`).
//
// До #2196 правило было одно — русско-белорусское (`normalize` ниже), и оно
// применялось к любому вводу. Для перевода квеста его мало: «orzel» без
// хвостика у буквы не совпадал с «orzeł», «the eagle» — с «eagle». Теперь
// правило выбирается по локали контента шага из реестра, а локаль без записи
// получает универсальное правило — новый язык не требует ни строки кода.
//
// Реестр не держит собственного перечня языков: ключи типизированы
// `SupportedLocale` из `i18n/config.ts`, и тест сверяет их с
// `SUPPORTED_LOCALES`.
//
// Ответ сверяется под правилом локали контента И под правилом источника
// (`ru`): объединённый словарь шага содержит русские варианты, и русские
// правила (ё→е) под польским нормализатором не применились бы.

import type { SupportedLocale } from '@/i18n/config'

/** Язык, на котором авторы пишут квесты; его правило действует всегда. */
export const QUEST_ANSWER_SOURCE_LOCALE = 'ru'

/**
 * Нормализация ответа (дублирует логику из data файлов).
 * Косметика обеих сторон сравнения: регистр, пробелы, пунктуация, «ё»→«е»,
 * белорусские «і»→«и» и «э»→«е», служебное «ад»→«от» (#1927). Не стеммер.
 *
 * Правило локалей `ru`/`be`. Цепочку зеркалит `scripts/lib/questAnswerNormalize.js`
 * — паритет сторожит `__tests__/scripts/scanQuestAnswerReachability.test.ts`.
 */
export function normalize(s: string): string {
    return s
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[.,;:!?'„""–—-]/g, '')
        .replace(/ё/g, 'е')
        .replace(/і/g, 'и')
        .replace(/э/g, 'е')
        .replace(/(^| )ад(?= |$)/g, '$1от')
        .trim();
}

/** Предлог/союз, который игрок ставит перед уже принимаемым ответом (#1927). */
const LEADING_FUNCTION_WORDS = new Set(['от', 'и']);

/**
 * Снимает одно ведущее служебное слово. Числовой остаток не трогаем: «от 6»
 * на счётном шаге не имеет права стать «6».
 */
export function stripLeadingFunctionWords(value: string): string {
    const words = value.split(' ');
    if (words.length < 2) return value;
    if (!LEADING_FUNCTION_WORDS.has(words[0])) return value;
    const rest = words.slice(1).join(' ');
    if (!rest || /^\d+$/.test(rest)) return value;
    return rest;
}

export type QuestAnswerNormalizer = {
    /** Симметричная косметика: применяется и к вводу, и к эталону. */
    normalize: (value: string) => string;
    /** Второй проход после провала полного совпадения: ведущее служебное слово. */
    stripLeadingWords?: (value: string) => string;
    /** Словоформы `utils/questAnswerMorphology.ts` знают только RU/BE окончания. */
    morphology: boolean;
};

// Пунктуация для нерусских правил шире: кавычки-ёлочки, типографские
// апострофы (украинское «м’ята», английское «king’s»), скобки и многоточие.
const LATIN_PUNCTUATION = /[.,;:!?'"„“”«»‘’ʼ`´–—\-()[\]/…]/g;
const COMBINING_MARKS = /[̀-ͯ]/g;

// Буквы, которые NFKD не раскладывает на «база + знак».
const UNDECOMPOSABLE_LETTERS: Readonly<Record<string, string>> = {
    ł: 'l',
    ø: 'o',
    đ: 'd',
    ı: 'i',
    ß: 'ss',
    æ: 'ae',
    œ: 'oe',
};
const UNDECOMPOSABLE_PATTERN = new RegExp(`[${Object.keys(UNDECOMPOSABLE_LETTERS).join('')}]`, 'g');

const collapse = (value: string): string =>
    value.toLowerCase().replace(LATIN_PUNCTUATION, '').replace(/\s+/g, ' ').trim();

const stripDiacritics = (value: string): string => {
    const folded = value.replace(UNDECOMPOSABLE_PATTERN, (letter) => UNDECOMPOSABLE_LETTERS[letter] ?? letter);
    try {
        return folded.normalize('NFKD').replace(COMBINING_MARKS, '');
    } catch {
        // Движок без Unicode-нормализации: остаются явные замены выше.
        return folded;
    }
};

/** Универсальное правило: регистр, пунктуация, пробелы, диакритика. */
const universalNormalize = (value: string): string => collapse(stripDiacritics(value.toLowerCase()));

const ENGLISH_ARTICLE = /^(the|an|a) (?=\S)/;

const SOURCE_NORMALIZER: QuestAnswerNormalizer = {
    normalize,
    stripLeadingWords: stripLeadingFunctionWords,
    morphology: true,
};

export const UNIVERSAL_QUEST_ANSWER_NORMALIZER: QuestAnswerNormalizer = {
    normalize: universalNormalize,
    morphology: false,
};

/** Собственные правила языков. Локаль без записи получает универсальное. */
export const QUEST_ANSWER_NORMALIZERS: Readonly<Partial<Record<SupportedLocale, QuestAnswerNormalizer>>> = {
    ru: SOURCE_NORMALIZER,
    be: SOURCE_NORMALIZER,
    // Апостроф («пам’ятка», «пам'ятка», «памʼятка») — в пунктуации; ґ→г.
    uk: {
        normalize: (value) => collapse(value).replace(/ґ/g, 'г'),
        morphology: false,
    },
    pl: UNIVERSAL_QUEST_ANSWER_NORMALIZER,
    en: {
        normalize: (value) => universalNormalize(value).replace(ENGLISH_ARTICLE, ''),
        morphology: false,
    },
};

/** Правило локали контента; `pl-PL` → `pl`, неизвестная локаль → универсальное. */
export function resolveQuestAnswerNormalizer(locale?: string | null): QuestAnswerNormalizer {
    const language = String(locale ?? QUEST_ANSWER_SOURCE_LOCALE).trim().toLowerCase().split(/[-_]/)[0];
    return Object.prototype.hasOwnProperty.call(QUEST_ANSWER_NORMALIZERS, language)
        ? QUEST_ANSWER_NORMALIZERS[language as SupportedLocale]!
        : UNIVERSAL_QUEST_ANSWER_NORMALIZER;
}

/**
 * Правила, под которыми сверяется ответ шага: локали контента и источника.
 * Для русского квеста — одно правило, поведение до #2196 не меняется.
 */
export function questAnswerNormalizers(contentLocale?: string | null): readonly QuestAnswerNormalizer[] {
    const content = resolveQuestAnswerNormalizer(contentLocale);
    return content === SOURCE_NORMALIZER ? [SOURCE_NORMALIZER] : [content, SOURCE_NORMALIZER];
}

/** Нормализация ответа под правилом локали. */
export function normalizeQuestAnswer(input: string, locale?: string | null): string {
    return resolveQuestAnswerNormalizer(locale).normalize(input);
}
