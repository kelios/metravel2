#!/usr/bin/env node
/**
 * Синхронизирует контент уже залитого квеста из локального data-файла на прод.
 * В отличие от migrate-* (только создаёт), этот PATCH-ит существующие шаги по step_id:
 * story, task, hint, answer_pattern, lat, lng, maps_url; плюс intro и finale.
 * Совпадение шагов — по step_id (структура шагов НЕ меняется, только их поля).
 *
 * Режим запуска обязателен и выбирается явно:
 *
 * NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/sync-quest-to-prod.js \
 *   --source-file=scripts/tallinn-quest-data.js --dry-run
 * NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/sync-quest-to-prod.js \
 *   --source-file=scripts/tallinn-quest-data.js --apply \
 *   [--api-url=https://metravel.by] [--token=…] [--reorder]
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
    UsageError,
    parseCliArgs,
    parseCliTokens,
    requireNoBatchFailures,
    requireNonEmptySelection,
    runCli,
} = require('./lib/cli-contract');

const USAGE = `Синк контента квеста из локального data-файла на прод

Usage:
  node scripts/sync-quest-to-prod.js --source-file <file> (--dry-run | --apply) [--api-url <url>] [--token <token>] [--reorder]

Options:
  --source-file <file>  локальный data-файл квестов (обязателен)
  --dry-run             репетиция: печатает PATCH-и, на прод ничего не пишет
  --apply               боевая запись на прод (нужен токен)
  --api-url <url>       адрес прода (по умолчанию https://metravel.by)
  --token <token>       токен; по умолчанию METRAVEL_TOKEN или ~/.metravel_token
  --reorder             перенести порядок шагов из файла (по умолчанию НЕ трогаем)
  --help, -h            напечатать эту справку и выйти`;

// У режима нет дефолта НИ В ОДНУ сторону, и это главное в контракте этого файла.
// Дефолт `--dry-run=выключено` превращал опечатку в необратимую правку прода:
// `--dryrun` молча отбрасывался, скрипт считал себя боевым и переписывал контент
// живых квестов. Зеркальный дефолт `--dry-run=включено` — такая же ложь с другой
// стороны: оператор уверен, что залил, а не произошло ничего. Поэтому запуск без
// явного `--dry-run` или `--apply` падает UsageError и не делает НИЧЕГО.
const CLI_SPEC = {
    name: 'sync-quest-to-prod',
    usage: USAGE,
    selection: 'quests from the data file',
    modes: {
        flags: ['dry-run', 'apply'],
        label: 'режимы запуска',
        missing: 'Режим не выбран: --dry-run (репетиция) или --apply (боевая запись) — явно',
    },
    flags: {
        'source-file': { type: 'string', required: true },
        'api-url': { type: 'string', default: 'https://metravel.by', stripTrailingSlash: true },
        // Токен — непрозрачная строка, ведущий дефис в ней законен.
        token: { type: 'string', allowLeadingDash: true },
        'dry-run': { type: 'boolean' },
        apply: { type: 'boolean' },
        reorder: { type: 'boolean' },
    },
};

/**
 * Разбор одних только аргументов, без префикса `node script.js`, — форма для
 * тестов и ручной пробы оператора: она отвечает про переданный флаг, а не
 * срезает его молча (#1934).
 */
const parseArgs = (tokens) => parseCliTokens(tokens, CLI_SPEC);

function resolveToken(explicit) {
    if (explicit) return explicit;
    if (process.env.METRAVEL_TOKEN) return process.env.METRAVEL_TOKEN;
    try { const p = path.join(os.homedir(), '.metravel_token'); if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim(); } catch { /* ignore */ }
    return null;
}

function dec(v) { const n = Number(v); return Number.isFinite(n) ? Number(n.toFixed(6)).toString() : '0'; }
function serAnswer(s) { return JSON.stringify(s.answer_pattern || { type: 'any', value: '' }); }

/**
 * Клиент прода замкнут на разобранные аргументы, а не на модульные константы:
 * пока `API_BASE`/`TOKEN`/`isDryRun` вычислялись при загрузке модуля, разбор
 * аргументов физически не мог жить внутри `main()` — а значит и битый вызов
 * падал раньше, чем кто-либо проверял, что именно попросили сделать.
 */
function createApi({ apiBase, token, dryRun }) {
    const authHeaders = token ? { Authorization: `Token ${token}` } : {};
    return {
        async get(endpoint) {
            const r = await fetch(`${apiBase}${endpoint}`, { headers: { ...authHeaders } });
            if (!r.ok) throw new Error(`HTTP ${r.status} GET ${endpoint}: ${await r.text()}`);
            return r.json();
        },
        async patch(endpoint, payload) {
            if (dryRun) { console.log(`  [DRY] PATCH ${endpoint}`, JSON.stringify(payload).slice(0, 120)); return {}; }
            const headers = { 'Content-Type': 'application/json', ...authHeaders };
            const r = await fetch(`${apiBase}${endpoint}`, { method: 'PATCH', headers, body: JSON.stringify(payload) });
            if (!r.ok) throw new Error(`HTTP ${r.status} PATCH ${endpoint}: ${await r.text()}`);
            return r.json();
        },
    };
}

function stepPayload(s, order) {
    const apType = (s.answer_pattern || {}).type;
    const inputType = s.inputType || (apType === 'range' || apType === 'exact' || apType === 'any_number' ? 'number' : 'text');
    const payload = {
        title: s.title, location: s.location, story: s.story, task: s.task,
        hint: s.hint || null, answer_pattern: serAnswer(s),
        lat: dec(s.lat), lng: dec(s.lng),
        maps_url: s.mapsUrl || `https://maps.google.com/?q=${s.lat},${s.lng}`,
        input_type: inputType,
    };
    // poi_info из data-файла синкается как есть (контракт: is_museum об. bool,
    // opening_hours/ticket_price/website опц.); отсутствует в данных — поле не трогаем
    const poiInfo = s.poi_info || s.poiInfo;
    if (poiInfo !== undefined) payload.poi_info = poiInfo;
    // point_role ('required' | 'optional' | 'final') синкается только если задан явно
    const pointRole = s.point_role || s.pointRole;
    if (pointRole !== undefined) payload.point_role = pointRole;
    if (order !== undefined) payload.order = order;
    return payload;
}

async function main() {
    const args = parseCliArgs(process.argv, CLI_SPEC);
    const isDryRun = args.mode === 'dry-run';
    // Порядок шагов на проде мог быть изменён после миграции, а локальный data-файл — устареть.
    // Поэтому order переносим ТОЛЬКО по явному --reorder (иначе затрём правильный прод-порядок).
    const doReorder = args.reorder;

    const token = resolveToken(args.token);
    // Токен нужен только боевой записи: репетиция ничего не отправляет и обязана
    // запускаться без секрета. Проверка живёт внутри main() — на верхнем уровне
    // модуля она отрабатывала бы раньше разбора аргументов, и «нет токена»
    // отвечало бы даже на `--help`.
    if (!token && !isDryRun) throw new UsageError('Нужен токен: --token=…, METRAVEL_TOKEN или ~/.metravel_token');

    // Файл читается здесь, а не при загрузке модуля: иначе опечатка в пути
    // роняла бы прогон стеком require раньше, чем кто-то проверил остальные
    // аргументы, и оператор не видел бы, что именно он попросил.
    const quests = requireNonEmptySelection(require(path.resolve(process.cwd(), args.sourceFile)), {
        what: 'квестов',
        source: `--source-file ${args.sourceFile}`,
        hint: 'data-файл должен экспортировать непустой массив квестов',
    });

    const api = createApi({ apiBase: args.apiUrl, token, dryRun: isDryRun });
    // Квесты, у которых хоть один шаг пропущен как отсутствующий на проде.
    // Пропуск — это молча НЕ применённая правка: шаг остаётся в старой редакции,
    // а прогон до #1934 заканчивался кодом 0 и строкой «Sync завершён» — тем
    // самым ложным зелёным отчётом, ради которого заведена карточка.
    let questsWithSkippedSteps = 0;

    for (const q of quests) {
        console.log(`\n📋 sync ${q.quest_id} → ${args.apiUrl} (${isDryRun ? 'DRY' : 'LIVE'})`);
        const bundle = await api.get(`/api/quests/by-quest-id/${encodeURIComponent(q.quest_id)}/`);
        const byStepId = new Map();
        for (const s of (bundle.steps || [])) byStepId.set(s.step_id, s);

        // intro — приходит отдельным полем bundle.intro (не в steps), но с id
        if (q.intro) {
            const dbIntro = bundle.intro && bundle.intro.id
                ? bundle.intro
                : (bundle.steps || []).find(s => s.is_intro || s.step_id === (q.intro.step_id || 'intro'));
            if (dbIntro && dbIntro.id) {
                await api.patch(`/api/quest-steps/${dbIntro.id}/`, { title: q.intro.title, location: q.intro.location, story: q.intro.story, task: q.intro.task, hint: q.intro.hint || null });
                console.log('  ✅ intro');
            } else {
                console.log('  ⚠️ intro id не найден — пропуск');
            }
        }
        // steps. ВАЖНО: по умолчанию order НЕ трогаем — локальный data-файл может
        // содержать устаревший порядок, а на проде квест уже переупорядочен
        // (см. brest-lantern). Реордер — только по явному --reorder.
        if (doReorder) {
            // двухфазно во избежание коллизий unique(quest, order)
            const present = q.steps.filter(s => byStepId.get(s.step_id));
            for (let i = 0; i < present.length; i++) {
                const db = byStepId.get(present[i].step_id);
                await api.patch(`/api/quest-steps/${db.id}/`, { order: 900 + i });
            }
        }
        let skippedSteps = 0;
        for (const s of q.steps) {
            const db = byStepId.get(s.step_id);
            if (!db) { skippedSteps++; console.log(`  ⚠️ step ${s.step_id} нет на проде — пропуск (структура не совпадает)`); continue; }
            const finalOrder = doReorder ? q.steps.indexOf(s) + 1 : undefined;
            // Ошибка PATCH по-прежнему летит наружу и роняет прогон: заливка
            // применяется по одному шагу, и частичная запись на проде должна быть
            // видна со стеком — «на каком шаге какого квеста встали» здесь и есть
            // весь вопрос.
            await api.patch(`/api/quest-steps/${db.id}/`, stepPayload(s, finalOrder));
            console.log(`  ✅ step ${s.step_id}${doReorder ? ` (order ${finalOrder})` : ''}`);
        }
        if (skippedSteps) questsWithSkippedSteps++;
        // finale — OneToOne с квестом: finale id == numeric quest id (bundle.id).
        // Список финалов скрывает id, но detail /api/quest-finales/<id>/ доступен по id квеста.
        const finaleText = q.finale && (q.finale.text || q.finale.story);
        if (finaleText && bundle.finale && bundle.finale.text !== finaleText) {
            await api.patch(`/api/quest-finales/${bundle.id}/`, { text: finaleText });
            console.log('  ✅ finale');
        }
    }
    console.log('\n✅ Sync завершён');

    // После отчёта, а не вместо него: оператор должен увидеть, КАКИЕ шаги не
    // доехали, раньше вердикта. Вердикт одинаков для обоих режимов — в
    // репетиции расхождение состава так же реально, как в боевом прогоне.
    requireNoBatchFailures(questsWithSkippedSteps, {
        total: quests.length,
        message: `шаги не доехали (нет на проде) у ${questsWithSkippedSteps} из ${quests.length} квестов — эти правки НЕ применены, структура разошлась`,
    });
}

module.exports = { CLI_SPEC, USAGE, parseArgs, createApi, resolveToken, stepPayload, main };

if (require.main === module) {
    runCli(main, { name: CLI_SPEC.name, usage: USAGE });
}
