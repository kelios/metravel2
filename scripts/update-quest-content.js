#!/usr/bin/env node
/**
 * ОБНОВЛЕНИЕ контента существующего квеста на проде (в отличие от migrate-*,
 * который только создаёт и пропускает существующее). Идёт PATCH-ем по DB-id
 * шагов/интро/финала — для ревью: переписать story/task/hint, спрятать ответы,
 * сплести сквозной сюжет, уточнить координаты, согласовать answer_pattern.
 *
 * Сопоставление по step_id: данные ревью matched к шагам прода по step_id
 * (intro — по is_intro/step_id='intro'). DB-id берётся из bundle.
 *
 *   node scripts/update-quest-content.js --quest-id=<id> --data=scripts/.quest-review/<id>.json [--dry-run]
 *
 * Жизненный цикл снимка (#1448): снимок описывает ЖИВОЙ прод на момент снятия и
 * протухает сразу после следующей правки, поэтому в репозитории он не хранится.
 * Снимок лежит в gitignored `scripts/.quest-review/`, git-tracked файл скрипт
 * применять отказывается, а применённый снимок уезжает в
 * `scripts/.quest-review/applied/`. Источник правды по живому контенту — прод.
 *
 * Токен: --token=, env METRAVEL_TOKEN, .secrets/metravel-token.json, ~/.metravel_token.
 * Формат data-файла (JSON): { intro?: Step, steps: Step[], finale?: { text } }
 *   Step: { step_id, title?, location?, story?, task?, hint?, answer_pattern?:{type,value},
 *           lat?, lng?, maps_url?, input_type? } — присылаются только меняемые поля.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { QUESTS: FINALE_QUESTS } = require('./generate-quest-finale-videos.js');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const get = (k, d) => { const a = args.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const API_BASE = get('api-url', 'https://metravel.by');
const QUEST_ID = get('quest-id');
const DATA_FILE = get('data');

if (!QUEST_ID || !DATA_FILE) { console.error('❌ нужны --quest-id и --data'); process.exit(1); }

const REVIEW_DIR = path.resolve(__dirname, '.quest-review');
const APPLIED_DIR = path.join(REVIEW_DIR, 'applied');

// Снимок под git — это снимок, который кто-то уже применил и оставил в
// репозитории как «канонические» данные. Он неотличим от актуального и при
// повторном применении молча возвращает прод к старому тексту (#1448: так
// вернулись бы подсказки, пересказывающие ответ, исправленные в #1445/#1447).
// cwd — каталог самого файла, а не корень этого чекаута: снимок может лежать в
// соседнем worktree или клоне, и он там ровно так же tracked.
function isTrackedByGit(absPath) {
    try {
        execFileSync('git', ['ls-files', '--error-unmatch', '--', absPath], {
            cwd: path.dirname(absPath),
            stdio: 'ignore',
        });
        return true;
    } catch {
        return false;
    }
}

// Применённый снимок уезжает из рабочего пути: следующий запуск не подхватит его
// как актуальный, но разбор инцидента остаётся возможен.
function archiveApplied(absPath) {
    fs.mkdirSync(APPLIED_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const target = path.join(APPLIED_DIR, `${stamp}-${QUEST_ID}.json`);
    try {
        fs.renameSync(absPath, target);
    } catch {
        fs.copyFileSync(absPath, target);
        fs.unlinkSync(absPath);
    }
    return target;
}

// Точный маппинг questId -> pk финала: тот же источник, по которому заливаются
// финальные видео (`upload-quest-finales.js`), сверенный с продом по тексту.
// Для квеста из маппинга угадывать по тексту не нужно вообще.
const KNOWN_FINALE_PK = new Map(FINALE_QUESTS.filter(q => q.finaleId).map(q => [q.questId, q.finaleId]));

// Верхняя граница перебора для квестов ВНЕ маппинга: FK quest->finale API не
// отдаёт, других идентификаторов в ответе нет. Граница считается от реальных
// данных — фиксированные 60 обрывали перебор на середине (78 из 131 известных
// финалов лежат за ними), и «не нашёл pk» становилось штатным исходом.
const FINALE_PK_SCAN_LIMIT = Math.max(60, ...KNOWN_FINALE_PK.values()) + 20;

// путь для сообщений: относительный внутри репо, абсолютный снаружи
function displayPath(absPath) {
    const rel = path.relative(process.cwd(), absPath);
    return rel && !rel.startsWith('..') ? rel : absPath;
}

// Провал запуска после того, как часть записей уже могла уйти на прод: снимок
// НЕ архивируется — он ещё нужен для повторного применения после разбора
// (PATCH-и идемпотентны, повторный запуск безопасен).
function failRun(dataPath, lines) {
    console.error(`\n❌ ${lines[0]}`);
    for (const line of lines.slice(1)) console.error(line);
    console.error(`   Снимок оставлен на месте: ${displayPath(dataPath)}`);
    process.exit(1);
}

function resolveToken() {
    const t = get('token');
    if (t) return t;
    if (process.env.METRAVEL_TOKEN) return process.env.METRAVEL_TOKEN;
    const sec = path.resolve(__dirname, '..', '.secrets', 'metravel-token.json');
    if (fs.existsSync(sec)) return JSON.parse(fs.readFileSync(sec, 'utf8')).token;
    const home = path.join(os.homedir(), '.metravel_token');
    if (fs.existsSync(home)) return fs.readFileSync(home, 'utf8').trim();
    return null;
}
const TOKEN = resolveToken();
if (!TOKEN && !isDryRun) { console.error('❌ нет токена'); process.exit(1); }

function decimal(v) { const n = Number(v); return Number.isFinite(n) ? Number(n.toFixed(6)).toString() : undefined; }
function serializeAnswer(ap) { return ap ? JSON.stringify(ap) : undefined; }

async function apiGet(endpoint) {
    const r = await fetch(`${API_BASE}${endpoint}`, { headers: TOKEN ? { Authorization: `Token ${TOKEN}` } : {} });
    // statusCode нужен перебору финалов: 404 там означает «нет такой записи» и
    // пропускается, а 5xx/сеть — сбой, после которого пропущенное совпадение
    // превратило бы коллизию в мнимо однозначный резолв.
    if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status} GET ${endpoint}: ${(await r.text()).slice(0, 200)}`), { statusCode: r.status });
    return r.json();
}
async function apiPatch(endpoint, payload) {
    if (isDryRun) { console.log(`  [DRY] PATCH ${endpoint}`, JSON.stringify(payload).slice(0, 140)); return {}; }
    const r = await fetch(`${API_BASE}${endpoint}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Token ${TOKEN}` },
        body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} PATCH ${endpoint}: ${(await r.text()).slice(0, 200)}`);
    return r.json();
}

// собрать PATCH-поля шага из входных данных (только присутствующие)
function stepPayload(s) {
    const p = {};
    for (const k of ['title', 'location', 'story', 'task']) if (s[k] != null) p[k] = s[k];
    if ('hint' in s) p.hint = s.hint || null;
    if (s.answer_pattern) p.answer_pattern = serializeAnswer(s.answer_pattern);
    if (s.maps_url) p.maps_url = s.maps_url;
    if (s.lat != null) p.lat = decimal(s.lat);
    if (s.lng != null) p.lng = decimal(s.lng);
    if (s.input_type) p.input_type = s.input_type;
    return p;
}

// Резолв pk записи финала. Маппинг проверяется по тексту: pk из маппинга и
// финал квеста — одна и та же запись, поэтому расхождение текстов означает, что
// маппинг протух, и продолжать по нему нельзя. Фолбэк для квестов вне маппинга —
// перебор по тексту с детектором коллизии.
async function resolveFinalePk(curText, dataPath) {
    const mapped = KNOWN_FINALE_PK.get(QUEST_ID);
    if (mapped != null) {
        let mappedText = null;
        try { mappedText = ((await apiGet(`/api/quest-finales/${mapped}/`)).text || '').trim(); }
        catch (e) {
            failRun(dataPath, [
                `Финал квеста «${QUEST_ID}» по маппингу должен лежать в pk=${mapped}, но записи нет: ${e.message}`,
                '   Маппинг questId → finaleId в scripts/generate-quest-finale-videos.js протух — сверь его с продом.',
            ]);
        }
        if (mappedText !== curText) {
            failRun(dataPath, [
                `Маппинг ведёт финал квеста «${QUEST_ID}» в pk=${mapped}, но там лежит другой текст — запись ушла бы в чужой квест.`,
                `   В pk=${mapped}: «${mappedText.slice(0, 100)}${mappedText.length > 100 ? '…' : ''}»`,
                `   У квеста:   «${curText.slice(0, 100)}${curText.length > 100 ? '…' : ''}»`,
                '   Поправь маппинг questId → finaleId в scripts/generate-quest-finale-videos.js и повтори.',
            ]);
        }
        return mapped;
    }

    const matches = [];
    for (let i = 1; i <= FINALE_PK_SCAN_LIMIT; i++) {
        let finale = null;
        try { finale = await apiGet(`/api/quest-finales/${i}/`); }
        catch (e) {
            if (e.statusCode === 404) continue;
            // Пропущенный из-за сбоя pk мог быть вторым совпадением: тогда
            // коллизия выглядела бы однозначным резолвом.
            failRun(dataPath, [
                `Перебор финалов оборвался на pk=${i}: ${e.message}`,
                '   Резолв по тексту без полного перебора не отличает коллизию от однозначного совпадения.',
            ]);
        }
        if ((finale.text || '').trim() === curText) matches.push(i);
    }
    if (matches.length > 1) {
        failRun(dataPath, [
            `Текущий текст финала квеста «${QUEST_ID}» совпадает сразу с несколькими записями: pk=${matches.join(', ')}.`,
            '   По тексту нужную запись не отличить, а запись наугад ушла бы в чужой квест.',
            `   Разбери вручную: сравни GET /api/quest-finales/{${matches.join(',')}}/ и примени текст точечно.`,
        ]);
    }
    // Не нашли запись — правка финала не легла бы никуда. Раньше это был ⚠️ с
    // продолжением: снимок уезжал в архив с кодом 0, а отредактированный финал
    // тихо терялся. Пропуск здесь не мягче коллизии, он просто менее заметен.
    if (matches.length === 0) {
        failRun(dataPath, [
            `Не нашёл запись финала квеста «${QUEST_ID}» по текущему тексту в pk 1..${FINALE_PK_SCAN_LIMIT} — текст финала не применён.`,
            '   Текущий текст финала на проде изменился между снятием снимка и запуском,',
            `   либо запись лежит за границей перебора (pk > ${FINALE_PK_SCAN_LIMIT}).`,
            `   Добавь квест в маппинг questId → finaleId (scripts/generate-quest-finale-videos.js) или примени текст точечно.`,
        ]);
    }
    return matches[0];
}

async function main() {
    console.log(`🔧 Update quest content «${QUEST_ID}» → ${API_BASE} (${isDryRun ? 'DRY' : 'LIVE'})\n`);
    const dataPath = path.resolve(DATA_FILE);
    if (isTrackedByGit(dataPath)) {
        console.error(`❌ ${displayPath(dataPath)} лежит под git.`);
        console.error('   Снимок контента квеста — эфемерный артефакт: он описывает прод на момент');
        console.error('   снятия и протухает после следующей правки, а применение протухшего файла');
        console.error('   откатывает прод на старый текст (#1448).');
        console.error(`   Сними свежий снимок в ${displayPath(REVIEW_DIR)}/ и примени его.`);
        process.exit(1);
    }
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    let applied = 0;
    const bundle = await apiGet(`/api/quests/by-quest-id/${encodeURIComponent(QUEST_ID)}/`);
    const steps = typeof bundle.steps === 'string' ? JSON.parse(bundle.steps) : bundle.steps;
    const intro = typeof bundle.intro === 'string' ? JSON.parse(bundle.intro) : bundle.intro;
    const byStepId = new Map();
    if (intro) byStepId.set(intro.step_id || 'intro', intro);
    for (const s of steps) byStepId.set(s.step_id, s);

    // intro
    if (data.intro) {
        const target = intro || [...byStepId.values()].find(s => s.is_intro);
        if (!target) console.warn('  ⚠️ intro на проде не найден, пропуск');
        else { await apiPatch(`/api/quest-steps/${target.id}/`, stepPayload(data.intro)); applied++; console.log(`  ✅ intro (id=${target.id})`); }
    }
    // steps
    for (const s of data.steps || []) {
        const target = byStepId.get(s.step_id);
        if (!target) { console.warn(`  ⚠️ step_id=${s.step_id} не найден на проде, пропуск`); continue; }
        await apiPatch(`/api/quest-steps/${target.id}/`, stepPayload(s));
        applied++;
        console.log(`  ✅ step ${s.step_id} (id=${target.id})`);
    }
    // finale: pk финала НЕ равен pk квеста (FK quest->finale API не отдаёт).
    // Основной путь — точный маппинг questId -> pk (`KNOWN_FINALE_PK`), тот же,
    // по которому заливаются финальные видео. Угадывание по тексту осталось
    // фолбэком для квестов вне маппинга: текст — не ключ (#1458), у двух
    // квестов он может совпасть дословно, поэтому диапазон сканируется целиком
    // и неоднозначность — отказ, а не выбор наугад. Применённым финал считается
    // только после совпавшего verify: сам по себе успешный PATCH не доказывает,
    // что запись ушла в нужный квест.
    if (data.finale && data.finale.text) {
        const curText = (bundle.finale && bundle.finale.text || '').trim();
        // Пустой текущий финал — не повод продолжать: записи, в которую лёг бы
        // текст, у квеста нет, а писать по маппингу вслепую значит писать в
        // чужую. Мягкий пропуск здесь того же класса, что и ненайденный pk:
        // снимок уехал бы в архив с кодом 0, а правка финала потерялась.
        if (!curText) {
            failRun(dataPath, [
                `У квеста «${QUEST_ID}» на проде нет текста финала — применять правку финала некуда.`,
                '   Скрипт только обновляет существующие записи: финал создаётся вместе с квестом (migrate-*).',
                '   Проверь квест на проде или убери блок finale из снимка.',
            ]);
        }
        const pk = await resolveFinalePk(curText, dataPath);
        await apiPatch(`/api/quest-finales/${pk}/`, { text: data.finale.text });
        if (isDryRun) console.log(`  [DRY] finale → pk=${pk}`);
        else {
            const v = await apiGet(`/api/quests/by-quest-id/${encodeURIComponent(QUEST_ID)}/`);
            const liveText = (v.finale && v.finale.text || '').trim();
            if (liveText !== data.finale.text.trim()) {
                failRun(dataPath, [
                    `Текст финала записан в pk=${pk}, но у квеста «${QUEST_ID}» на проде остался другой текст — правка ушла в чужую запись.`,
                    `   Сейчас у квеста: «${liveText.slice(0, 120)}${liveText.length > 120 ? '…' : ''}»`,
                    `   В pk=${pk} лежит текст из снимка — верни его вручную по GET/PATCH /api/quest-finales/${pk}/.`,
                ]);
            }
            applied++;
            console.log(`  ✅ finale (pk=${pk})`);
        }
    }
    if (isDryRun) {
        console.log('\n✅ Done (DRY — снимок остался на месте)');
        return;
    }
    // Ноль применённых записей — это не успех: обычно опечатка в --quest-id или
    // снимок от другого квеста. Архивировать нечего, «Done» печатать нельзя.
    if (applied === 0) {
        console.error('\n❌ Ни одна запись снимка не совпала с квестом на проде — ничего не применено.');
        console.error(`   Проверь --quest-id=${QUEST_ID} и step_id внутри ${displayPath(dataPath)}.`);
        console.error('   Снимок оставлен на месте.');
        process.exit(1);
    }
    const archived = archiveApplied(dataPath);
    console.log(`\n📦 Снимок применён и убран в ${displayPath(archived)}`);
    console.log('✅ Done');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
