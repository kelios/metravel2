// utils/questCatalogSearch.ts
// Свободный поиск каталога квестов (экран «Квесты»).
//
// Каталог выкачан целиком, поэтому поиск клиентский (#3239): запрос и текст
// квеста сводятся к одному латинскому «скелету» (кириллица транслитерируется,
// диакритика снимается), слово сравнивается по основе, а не по точной форме.
// Опечатка допускается только вторым уровнем — когда точных совпадений нет
// совсем: иначе «Пинск» приносил бы и Минск. Такая выдача помечается
// `approximate`, и экран говорит, что показаны похожие квесты.

import type { QuestMeta } from '@/utils/questAdapters';
import { getQuestAgeSearchTerms, isBikeQuest, isQuestForChildrenOrTeens, normalizeQuestTag } from '@/utils/questAudience';

const CYRILLIC_TO_LATIN: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', ґ: 'g', д: 'd', е: 'e', ё: 'e', є: 'ye', ж: 'zh', з: 'z',
    и: 'i', і: 'i', ї: 'yi', й: 'j', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', у: 'u', ў: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', '’': '', "'": '', ʼ: '',
};

// Польская орфография сводится к той же записи, что и транслит кириллицы:
// «Kraków» и «Краков» дают один скелет `krakov`.
const LATIN_FOLDS: [RegExp, string][] = [
    [/ł/g, 'l'],
    [/cz/g, 'ch'],
    [/sz/g, 'sh'],
    [/w/g, 'v'],
];

// Окончания (в транслите), которые снимаются для основы слова: «Гродна» и
// «Гродно» → `grodn`, «детей» и «дети» → `det`. Длинные — раньше коротких.
const ENDINGS = [
    'iyami', 'yami', 'ami', 'ogo', 'ego', 'omu', 'emu', 'ymi', 'imi', 'yah', 'yh', 'ih',
    'ah', 'ov', 'ev', 'ej', 'oj', 'yj', 'ij', 'om', 'em', 'am', 'yu', 'ya', 'ie', 'iu',
    'a', 'e', 'i', 'o', 'u', 'y',
];
const MIN_STEM = 4;
// Обратное сравнение: запрос длиннее слова квеста на окончание
// («Минская» ↔ «Минск»). Короткая основа сюда не допускается: «Полацк»
// иначе находил бы «Пола Ревира».
const MIN_REVERSE_STEM = 5;
const MAX_QUERY_ENDING = 3;

// Служебные слова запроса не обязаны совпасть с текстом квеста.
const STOP_WORDS = new Set([
    'dlya', 'dla', 'v', 'vo', 'na', 'po', 'i', 'u', 'iz', 's', 'so', 'z', 'ze', 'for', 'in',
    'the', 'of', 'and', 'with', 'a', 'kvest', 'kvesty', 'kvestov', 'kvesti', 'quest', 'quests',
]);

// Признаки квеста, по которым его ищут словами (#3239). Теги в данных —
// английские id (`castle`, `family`), а посетитель пишет «замок», «семейный»,
// «dla dzieci»: словарь переводит признак в слова на всех языках интерфейса.
// Срезы «Для детей» и «Велоквесты» находятся теми же предикатами, что и
// фильтры каталога, поэтому запрос и фильтр дают один набор.
const KIDS_TERMS = [
    'дети', 'детский', 'для детей', 'с детьми', 'школьники',
    'дзеці', 'дзіцячы', 'для дзяцей', 'діти', 'дитячий', 'для дітей',
    'dzieci', 'dziecięcy', 'kids', 'children', 'child',
];
const BIKE_TERMS = ['велоквест', 'велосипед', 'вело', 'ровар', 'rower', 'rowerowy', 'bike', 'bicycle', 'cycling'];
const TAG_SEARCH_TERMS: Record<string, string[]> = {
    family: ['семейный', 'семья', 'сямейны', 'сям’я', 'сімейний', 'сім’я', 'rodzinny', 'rodzina', 'family'],
    castle: ['замок', 'замки', 'замак', 'замкі', 'zamek', 'zamki', 'castle'],
    palace: ['дворец', 'палац', 'pałac', 'palace'],
    legend: ['легенда', 'легенды', 'легенди', 'паданне', 'legenda', 'legendy', 'legend'],
    mystic: ['мистика', 'призраки', 'містыка', 'містика', 'mistyka', 'mystic', 'ghost'],
    detective: ['детектив', 'дэтэктыў', 'detektyw', 'detective'],
    fairytale: ['сказка', 'сказки', 'казка', 'казкі', 'казки', 'bajka', 'baśń', 'fairy tale'],
    nature: ['природа', 'прырода', 'przyroda', 'nature'],
    food: ['еда', 'кухня', 'ежа', 'їжа', 'jedzenie', 'kuchnia', 'food'],
    halloween: ['хэллоуин', 'хеллоуин', 'гэлоўін', 'хелловін', 'halloween'],
    christmas: ['рождество', 'новый год', 'каляды', 'різдво', 'новий рік', 'boże narodzenie', 'christmas'],
    unesco: ['юнеско', 'unesco'],
};

const MAX_FUZZY_EDITS_SHORT = 1;
const MAX_FUZZY_EDITS_LONG = 2;
const FUZZY_MIN_TOKEN = 4;
const FUZZY_LONG_TOKEN = 8;

/** Текст в поисковый скелет: нижний регистр, без диакритики, кириллица → латиница. */
export function normalizeQuestSearchText(text: string): string {
    let out = '';
    // «й» и «ї» — самостоятельные буквы: NFD разложил бы их в «и»/«і» с
    // диакритикой, и снятие диакритики слило бы «детей» с «детектив».
    const lower = text.toLowerCase().replace(/[йї]/g, (char) => CYRILLIC_TO_LATIN[char]);
    for (const char of lower.normalize('NFD').replace(/\p{M}/gu, '')) {
        out += CYRILLIC_TO_LATIN[char] ?? char;
    }
    for (const [pattern, replacement] of LATIN_FOLDS) out = out.replace(pattern, replacement);
    return out.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function stemQuestSearchToken(token: string): string {
    for (const ending of ENDINGS) {
        if (token.endsWith(ending) && token.length - ending.length >= MIN_STEM) {
            return token.slice(0, token.length - ending.length);
        }
    }
    return token;
}

/**
 * Расстояния Дамерау–Левенштейна (оптимальное выравнивание строк) от всей `a`
 * до каждого начала `b`: элемент `j` — расстояние до `b.slice(0, j)`.
 */
function prefixEditDistances(a: string, b: string): number[] {
    const rows = a.length + 1;
    const cols = b.length + 1;
    const d: number[][] = Array.from({ length: rows }, (_, i) => {
        const row = new Array<number>(cols).fill(0);
        row[0] = i;
        return row;
    });
    for (let j = 0; j < cols; j += 1) d[0][j] = j;
    for (let i = 1; i < rows; i += 1) {
        for (let j = 1; j < cols; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            let value = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                value = Math.min(value, d[i - 2][j - 2] + 1);
            }
            d[i][j] = value;
        }
    }
    return d[rows - 1];
}

type QueryToken = { token: string; stem: string };

type SearchDocument = {
    text: string;
    tokens: string[];
};

function buildDocument(parts: (string | undefined | null)[]): SearchDocument {
    const text = normalizeQuestSearchText(parts.filter(Boolean).join(' '));
    return { text, tokens: [...new Set(text.split(' ').filter(Boolean))] };
}

function parseQuery(searchTerm: string): { text: string; tokens: QueryToken[] } {
    const text = normalizeQuestSearchText(searchTerm);
    const tokens = text
        .split(' ')
        .filter((token) => token && !STOP_WORDS.has(token))
        .map((token) => ({ token, stem: stemQuestSearchToken(token) }));
    return { text, tokens };
}

function tokenMatchesStrict(query: QueryToken, doc: SearchDocument): boolean {
    if (doc.text.includes(query.token)) return true;
    return doc.tokens.some((token) => {
        if (token.startsWith(query.stem)) return true;
        const stem = stemQuestSearchToken(token);
        return stem.length >= MIN_REVERSE_STEM && query.token.startsWith(stem) && query.token.length - stem.length <= MAX_QUERY_ENDING;
    });
}

/** Число правок от слова запроса до слова квеста; `null` — вне допуска. */
function wordFuzzyDistance(query: QueryToken, word: string): number | null {
    const allowed = query.token.length >= FUZZY_LONG_TOKEN ? MAX_FUZZY_EDITS_LONG : MAX_FUZZY_EDITS_SHORT;
    let best: number | null = null;
    for (const candidate of new Set([query.token, query.stem])) {
        if (candidate.length < FUZZY_MIN_TOKEN) continue;
        // Слово квеста сравнивается своим началом той же длины (±1):
        // «грдно» ↔ «гродно», «гродн» ↔ «гродненский». Одна таблица правок
        // даёт расстояния до всех трёх начал сразу.
        const distances = prefixEditDistances(candidate, word.slice(0, candidate.length + 1));
        const from = Math.max(candidate.length - 1, FUZZY_MIN_TOKEN - 1);
        for (let length = from; length < distances.length; length += 1) {
            const distance = distances[length];
            if (distance <= allowed && (best === null || distance < best)) best = distance;
        }
    }
    return best;
}

/**
 * Наименьшее число правок до какого-либо слова документа; `null` — вне допуска.
 * Слова тегов, стран и городов повторяются в сотнях квестов, поэтому расстояние
 * считается один раз на слово за запрос (`memo`), а не на каждый квест.
 */
function tokenFuzzyDistance(query: QueryToken, doc: SearchDocument, memo: Map<string, number | null>): number | null {
    if (query.token.length < FUZZY_MIN_TOKEN) return null;
    let best: number | null = null;
    for (const word of doc.tokens) {
        let distance = memo.get(word);
        if (distance === undefined) {
            distance = wordFuzzyDistance(query, word);
            memo.set(word, distance);
        }
        if (distance !== null && (best === null || distance < best)) best = distance;
    }
    return best;
}

function matchesStrict(query: ReturnType<typeof parseQuery>, doc: SearchDocument): boolean {
    if (!query.tokens.length) return doc.text.includes(query.text);
    return query.tokens.every((token) => tokenMatchesStrict(token, doc));
}

function fuzzyScore(
    query: ReturnType<typeof parseQuery>,
    doc: SearchDocument,
    memos: Map<string, number | null>[],
): number | null {
    if (!query.tokens.length) return null;
    let total = 0;
    for (const [index, token] of query.tokens.entries()) {
        if (tokenMatchesStrict(token, doc)) continue;
        const distance = tokenFuzzyDistance(token, doc, memos[index]);
        if (distance === null) return null;
        total += distance;
    }
    return total;
}

export type QuestCatalogSearchResult<T extends QuestMeta> = {
    quests: T[];
    /** Точных совпадений нет: выдача — ближайшие по написанию квесты. */
    approximate: boolean;
};

export type QuestCatalogSearch<T extends QuestMeta> = (searchTerm: string) => QuestCatalogSearchResult<T>;

/**
 * Поиск по каталогу целиком (#2198, #3239). Город квеста сверяется со всеми
 * его названиями, известными каталогу: у непереведённого квеста `cityName` —
 * русский источник, и «Kraków» ему приносит переведённый квест того же города.
 * Город определяется каноническим id (`buildCanonicalQuestCityIndex`), поэтому
 * одна запись под двумя `city_id` тоже ищется целиком.
 */
export function createQuestCatalogSearch<T extends QuestMeta>(
    quests: T[],
    canonicalCityIdById: Record<string, string>,
): QuestCatalogSearch<T> {
    const cityKey = (quest: QuestMeta) => canonicalCityIdById[quest.cityId] ?? quest.cityId;
    const namesByCity = new Map<string, Set<string>>();
    for (const quest of quests) {
        const names = namesByCity.get(cityKey(quest)) ?? new Set<string>();
        for (const name of [quest.cityName, quest.cityNameCanonical]) {
            if (name) names.add(name);
        }
        namesByCity.set(cityKey(quest), names);
    }
    const documents = quests.map((quest) => buildDocument([
        quest.title,
        quest.countryName,
        ...(namesByCity.get(cityKey(quest)) ?? []),
        ...(quest.tags || []),
        ...getQuestAgeSearchTerms(quest.tags),
        ...(quest.tags || []).flatMap((tag) => TAG_SEARCH_TERMS[normalizeQuestTag(tag)] ?? []),
        ...(isQuestForChildrenOrTeens(quest.tags) ? KIDS_TERMS : []),
        ...(isBikeQuest(quest.tags) ? BIKE_TERMS : []),
    ]));

    return (searchTerm) => {
        const query = parseQuery(searchTerm);
        if (!query.text) return { quests: [], approximate: false };
        const strict = quests.filter((_, index) => matchesStrict(query, documents[index]));
        if (strict.length) return { quests: strict, approximate: false };
        const scored: { quest: T; score: number }[] = [];
        const memos = query.tokens.map(() => new Map<string, number | null>());
        quests.forEach((quest, index) => {
            const score = fuzzyScore(query, documents[index], memos);
            if (score !== null) scored.push({ quest, score });
        });
        // Сортировка стабильна: при равной близости сохраняется порядок каталога.
        scored.sort((a, b) => a.score - b.score);
        return { quests: scored.map(({ quest }) => quest), approximate: scored.length > 0 };
    };
}
