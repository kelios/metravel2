/**
 * Резолв pk записи финала квеста — единственный путь для любого писателя
 * `PATCH /api/quest-finales/<pk>/`.
 *
 * pk финала НЕ равен числовому id квеста: `QuestFinale.quest` — OneToOne, но
 * номер записи у финала собственный (#2427: PATCH по id Торуни переписал финал
 * Люблина и наоборот). API связь квест → финал не отдаёт: в ответе
 * `/api/quests/by-quest-id/` у `finale` нет `id`, у `/api/quest-finales/` нет
 * фильтра по квесту, а сериализатор финала скрывает `id` и `quest`.
 *
 * Поэтому pk ищется так:
 * 1. Точный маппинг questId → finaleId из `scripts/generate-quest-finale-videos.js`
 *    (по нему же заливаются финальные видео) — и он сверяется по тексту: запись
 *    из маппинга обязана держать текущий финал квеста, иначе маппинг протух.
 * 2. Для квестов вне маппинга — полный перебор pk по текущему тексту финала с
 *    детектором коллизии (#1458): текст — не ключ, неоднозначность — отказ.
 *
 * Любой непроверяемый исход — `FinalePkError` с готовыми строками отчёта, а не
 * пропуск и не запись наугад.
 */

const { QUESTS: FINALE_QUESTS } = require('../generate-quest-finale-videos.js');
const { ExpectedFailureError } = require('./cli-contract');
const { rethrowTerminalAuthError } = require('./metravel-tool-session');

const KNOWN_FINALE_PK = new Map(FINALE_QUESTS.filter(q => q.finaleId).map(q => [q.questId, q.finaleId]));

// Верхняя граница перебора для квестов ВНЕ маппинга: граница считается от
// реальных данных — фиксированные 60 обрывали перебор на середине, и «не нашёл
// pk» становилось штатным исходом.
const FINALE_PK_SCAN_LIMIT = Math.max(60, ...KNOWN_FINALE_PK.values()) + 20;

const MAPPING_FILE = 'scripts/generate-quest-finale-videos.js';

class FinalePkError extends ExpectedFailureError {
    constructor(lines) {
        super(lines.join('\n'));
        this.name = 'FinalePkError';
        this.lines = lines;
    }
}

const clip = (text, n = 100) => `${text.slice(0, n)}${text.length > n ? '…' : ''}`;
const statusOf = (error) => (error && (error.statusCode || error.status)) || null;

/**
 * @param {object} opts
 * @param {string} opts.questId      строковый quest_id
 * @param {string} opts.currentText  текущий текст финала квеста на проде (из by-quest-id)
 * @param {(endpoint: string) => Promise<any>} opts.apiGet  GET; ошибка несёт statusCode|status
 * @returns {Promise<number>} pk записи финала этого квеста
 */
async function resolveFinalePk({ questId, currentText, apiGet, knownPk = KNOWN_FINALE_PK, scanLimit = FINALE_PK_SCAN_LIMIT }) {
    const curText = (currentText || '').trim();
    // Пустой текущий финал не с чем сверить: писать по маппингу вслепую — значит
    // писать в чужую запись.
    if (!curText) {
        throw new FinalePkError([
            `У квеста «${questId}» на проде нет текста финала — запись финала не найти и не проверить.`,
            '   Скрипты только обновляют существующие финалы: финал создаётся вместе с квестом (migrate-*).',
        ]);
    }

    const mapped = knownPk.get(questId);
    if (mapped != null) {
        let mappedText;
        try { mappedText = ((await apiGet(`/api/quest-finales/${mapped}/`)).text || '').trim(); }
        catch (e) {
            rethrowTerminalAuthError(e);
            throw new FinalePkError([
                `Финал квеста «${questId}» по маппингу должен лежать в pk=${mapped}, но записи нет: ${e.message}`,
                `   Маппинг questId → finaleId в ${MAPPING_FILE} протух — сверь его с продом.`,
            ]);
        }
        if (mappedText !== curText) {
            throw new FinalePkError([
                `Маппинг ведёт финал квеста «${questId}» в pk=${mapped}, но там лежит другой текст — запись ушла бы в чужой квест.`,
                `   В pk=${mapped}: «${clip(mappedText)}»`,
                `   У квеста:   «${clip(curText)}»`,
                `   Поправь маппинг questId → finaleId в ${MAPPING_FILE} и повтори.`,
            ]);
        }
        return mapped;
    }

    const matches = [];
    for (let i = 1; i <= scanLimit; i++) {
        let finale;
        try { finale = await apiGet(`/api/quest-finales/${i}/`); }
        catch (e) {
            rethrowTerminalAuthError(e);
            if (statusOf(e) === 404) continue;
            // Пропущенный из-за сбоя pk мог быть вторым совпадением: тогда
            // коллизия выглядела бы однозначным резолвом.
            throw new FinalePkError([
                `Перебор финалов оборвался на pk=${i}: ${e.message}`,
                '   Резолв по тексту без полного перебора не отличает коллизию от однозначного совпадения.',
            ]);
        }
        if (((finale && finale.text) || '').trim() === curText) matches.push(i);
    }
    if (matches.length > 1) {
        throw new FinalePkError([
            `Текущий текст финала квеста «${questId}» совпадает сразу с несколькими записями: pk=${matches.join(', ')}.`,
            '   По тексту нужную запись не отличить, а запись наугад ушла бы в чужой квест.',
            `   Разбери вручную: сравни GET /api/quest-finales/{${matches.join(',')}}/ и добавь квест в маппинг ${MAPPING_FILE}.`,
        ]);
    }
    if (matches.length === 0) {
        throw new FinalePkError([
            `Не нашёл запись финала квеста «${questId}» по текущему тексту в pk 1..${scanLimit} — текст финала не применён.`,
            '   Текущий текст финала на проде изменился во время прогона,',
            `   либо запись лежит за границей перебора (pk > ${scanLimit}).`,
            `   Добавь квест в маппинг questId → finaleId (${MAPPING_FILE}) или примени текст точечно.`,
        ]);
    }
    return matches[0];
}

module.exports = { resolveFinalePk, FinalePkError, KNOWN_FINALE_PK, FINALE_PK_SCAN_LIMIT };
