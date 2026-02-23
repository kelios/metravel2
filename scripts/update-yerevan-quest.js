#!/usr/bin/env node
/**
 * Обновление квеста «Ереван» на проде:
 * 1. Удаляет старые шаги (DB ids 35-44 + intro 45)
 * 2. Создаёт новые шаги по новому сценарию
 * 3. Обновляет финал
 *
 * NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/update-yerevan-quest.js --token=YOUR_TOKEN
 */

const TOKEN = '5281f4cc17ab9f6f6cdaf2150a09ae9999c277c5';
const API = 'https://metravel.by';
const QUEST_DB_ID = 5;

const headers = (extra = {}) => ({
    'Content-Type': 'application/json',
    'Authorization': `Token ${TOKEN}`,
    ...extra,
});

async function del(endpoint) {
    const r = await fetch(`${API}${endpoint}`, { method: 'DELETE', headers: headers() });
    if (!r.ok && r.status !== 404) {
        const t = await r.text();
        throw new Error(`DELETE ${endpoint}: HTTP ${r.status} ${t.substring(0, 200)}`);
    }
}

async function post(endpoint, payload) {
    const r = await fetch(`${API}${endpoint}`, {
        method: 'POST', headers: headers(), body: JSON.stringify(payload),
    });
    if (!r.ok) {
        const t = await r.text();
        throw new Error(`POST ${endpoint}: HTTP ${r.status} ${t.substring(0, 300)}`);
    }
    return r.json();
}

async function patch(endpoint, payload) {
    const r = await fetch(`${API}${endpoint}`, {
        method: 'PATCH', headers: headers(), body: JSON.stringify(payload),
    });
    if (!r.ok) {
        const t = await r.text();
        throw new Error(`PATCH ${endpoint}: HTTP ${r.status} ${t.substring(0, 300)}`);
    }
    return r.json();
}

// ===================== НОВЫЙ СЦЕНАРИЙ =====================

const NEW_INTRO = {
    step_id: 'intro',
    title: 'Добро пожаловать в розовый город',
    location: 'Ереван',
    story: 'Ереван — один из древнейших городов мира. Он построен из розового туфа — вулканического камня с горы Арарат. Здесь прошлое и настоящее живут рядом: древние легенды, советская архитектура, шумные рынки и аромат свежего кофе.\n\nВ этом квесте ты познакомишься с настоящим Ереваном:\n— увидишь главные символы города\n— заглянешь в старые дворики\n— попробуешь армянскую кухню\n— узнаешь легенды и историю\n— почувствуешь атмосферу города\n\nЭто не экскурсия. Это прогулка по живому городу.\n\nЧто делать:\n1) Читай историю места.\n2) Найди точку.\n3) Осмотрись вокруг.\n4) Выполни задание.\n\nГотов увидеть Ереван таким, каким его знают местные?',
    task: 'Нажми «Начать квест» и отправляйся исследовать город.',
    hint: null,
    answer_pattern: JSON.stringify({ type: 'any', value: '' }),
    lat: '40.1872',
    lng: '44.5152',
    maps_url: 'https://maps.google.com/?q=Yerevan+Armenia',
    input_type: 'text',
    order: 0,
    is_intro: true,
};

const NEW_STEPS = [
    {
        step_id: '1-cascade',
        title: 'Каскад — лестница к небу',
        location: 'Каскад',
        story: 'Ты стоишь у подножия Каскада — огромной лестницы, соединяющей центр города с холмом над Ереваном.\n\nЛестница поднимается вверх словно к небу. Сверху открывается один из лучших видов на город и на гору Арарат.\n\nГоворят, на этом холме когда-то стоял храм богини Анаит — покровительницы Армении. Сегодня здесь современное искусство, фонтаны и жизнь города.',
        task: 'Осмотрись вокруг. Найди любую скульптуру или арт-объект рядом с Каскадом и опиши его одним словом.',
        hint: 'Ищи необычные формы и современные скульптуры.',
        answer_pattern: JSON.stringify({ type: 'any_text', value: JSON.stringify({ min_length: 3 }) }),
        lat: '40.18920', lng: '44.51520',
        maps_url: 'https://maps.google.com/?q=Cascade+Yerevan',
        input_type: 'text', order: 1, is_intro: false,
    },
    {
        step_id: '2-opera',
        title: 'Площадь Свободы — сердце города',
        location: 'Театр оперы и балета',
        story: 'Ты в центре Еревана — на площади Свободы.\n\nЗдание театра оперы и балета спроектировал архитектор Александр Таманян. Именно он создал план современного Еревана — город расходится отсюда кругами, как лучи солнца.\n\nПосмотри вокруг: широкие площади, камень тёплого цвета, спокойный ритм города.',
        task: 'Найди памятник архитектору Таманяну рядом с театром. Что он держит в руках?',
        hint: 'Это связано с его работой.',
        answer_pattern: JSON.stringify({ type: 'any_text', value: JSON.stringify({ min_length: 3 }) }),
        lat: '40.18505', lng: '44.51355',
        maps_url: 'https://maps.google.com/?q=Freedom+Square+Yerevan',
        input_type: 'text', order: 2, is_intro: false,
    },
    {
        step_id: '3-yard',
        title: 'Дворы старого Еревана',
        location: 'ул. Абовяна — старые дворики',
        story: 'Настоящий Ереван прячется не только на площадях, но и во дворах.\n\nЗайди в любой открытый двор рядом. Старые балконы, виноградные лозы, сушащееся бельё и тихие разговоры — здесь можно почувствовать повседневную жизнь города.',
        task: 'Зайди во двор и опиши одним словом атмосферу этого места.',
        hint: 'Спокойный? Шумный? Уютный?',
        answer_pattern: JSON.stringify({ type: 'any_text', value: JSON.stringify({ min_length: 3 }) }),
        lat: '40.18132', lng: '44.51631',
        maps_url: 'https://maps.google.com/?q=Abovyan+street+Yerevan',
        input_type: 'text', order: 3, is_intro: false,
    },
    {
        step_id: '4-vernissage',
        title: 'Вернисаж — рынок памяти',
        location: 'Вернисаж',
        story: 'Вернисаж — крупнейший рынок ремёсел в Ереване.\n\nЗдесь продают ковры, украшения, старинные вещи, резные изделия и сувениры. Символ Армении — гранат. Он означает жизнь, плодородие и удачу.',
        task: 'Найди любой предмет с изображением граната. Из какого он материала?',
        hint: 'Гранат здесь изображают почти на всём.',
        answer_pattern: JSON.stringify({ type: 'any_text', value: JSON.stringify({ min_length: 3 }) }),
        lat: '40.17598', lng: '44.51818',
        maps_url: 'https://maps.google.com/?q=Vernissage+Market+Yerevan',
        input_type: 'text', order: 4, is_intro: false,
    },
    {
        step_id: '5-coffee',
        title: 'Армянский кофе — городской ритуал',
        location: 'Jazzve или любое кафе',
        story: 'Армянский кофе варят медленно в маленьком медном сосуде — джезве.\n\nПосле кофе чашку переворачивают и по узорам гущи гадают на судьбу. Это часть городской культуры.',
        task: 'Зайди в кафе и закажи армянский кофе. Как называется посуда, в которой его варят?',
        hint: 'Маленький медный сосуд с длинной ручкой.',
        answer_pattern: JSON.stringify({ type: 'exact_any', value: JSON.stringify(['джезве','турка','jezve','cezve','джезва']) }),
        lat: '40.18507', lng: '44.51418',
        maps_url: 'https://maps.google.com/?q=Jazzve+Yerevan',
        input_type: 'text', order: 5, is_intro: false,
    },
    {
        step_id: '6-republic',
        title: 'Площадь Республики — розовый камень',
        location: 'Площадь Республики',
        story: 'Это главная площадь Еревана. Все здания вокруг построены из розового туфа — вулканического камня.\n\nИз-за этого Ереван называют «розовым городом». Камень меняет оттенок в зависимости от света и времени дня.',
        task: 'Посмотри на здания вокруг площади. Какого цвета камень ты видишь?',
        hint: 'Обрати внимание на оттенки.',
        answer_pattern: JSON.stringify({ type: 'any_text', value: JSON.stringify({ min_length: 3 }) }),
        lat: '40.17720', lng: '44.51520',
        maps_url: 'https://maps.google.com/?q=Republic+Square+Yerevan',
        input_type: 'text', order: 6, is_intro: false,
    },
    {
        step_id: '7-matenadaran',
        title: 'Матенадаран — память народа',
        location: 'Матенадаран',
        story: 'Матенадаран — одно из крупнейших хранилищ древних рукописей в мире.\n\nПеред зданием стоит памятник Месропу Маштоцу — создателю армянского алфавита. Армянский алфавит используется уже более 1600 лет.',
        task: 'Посмотри на армянские буквы вокруг. Какая из них кажется тебе самой необычной? Опиши её.',
        hint: 'Форма букв сильно отличается от латиницы.',
        answer_pattern: JSON.stringify({ type: 'any_text', value: JSON.stringify({ min_length: 3 }) }),
        lat: '40.19208', lng: '44.52106',
        maps_url: 'https://maps.google.com/?q=Matenadaran+Yerevan',
        input_type: 'text', order: 7, is_intro: false,
    },
    {
        step_id: '8-kond',
        title: 'Конд — старый город',
        location: 'Квартал Конд',
        story: 'Конд — старейший район Еревана. Узкие улочки, старые дома, деревянные двери и каменные стены — здесь время словно остановилось.',
        task: 'Найди старую дверь или ворота и опиши их одним словом.',
        hint: 'Обрати внимание на цвет или состояние.',
        answer_pattern: JSON.stringify({ type: 'any_text', value: JSON.stringify({ min_length: 3 }) }),
        lat: '40.18313', lng: '44.50223',
        maps_url: 'https://maps.google.com/?q=Kond+Yerevan',
        input_type: 'text', order: 8, is_intro: false,
    },
    {
        step_id: '9-blue-mosque',
        title: 'Голубая мечеть — персидское наследие',
        location: 'Голубая мечеть',
        story: 'Ереван всегда был городом разных культур. Голубая мечеть — единственная действующая мечеть города.\n\nОна построена в XVIII веке и украшена узорными изразцами, которые дали ей название.',
        task: 'Посмотри на купол мечети. Какого цвета изразцы его украшают?',
        hint: 'Название мечети — прямая подсказка.',
        answer_pattern: JSON.stringify({ type: 'any_text', value: JSON.stringify({ min_length: 3 }) }),
        lat: '40.17788', lng: '44.50556',
        maps_url: 'https://maps.google.com/?q=Blue+Mosque+Yerevan',
        input_type: 'text', order: 9, is_intro: false,
    },
    {
        step_id: '10-ararat',
        title: 'Вид на Арарат — символ Армении',
        location: 'Смотровая площадка',
        story: 'Перед тобой открывается вид на гору Арарат — главный символ армянского народа.\n\nПо легенде, именно здесь остановился Ноев ковчег после Великого потопа.',
        task: 'Посмотри на город сверху. Опиши одним словом, каким тебе запомнился Ереван.',
        hint: 'Какое чувство вызывает город?',
        answer_pattern: JSON.stringify({ type: 'any_text', value: JSON.stringify({ min_length: 3 }) }),
        lat: '40.19516', lng: '44.52467',
        maps_url: 'https://maps.google.com/?q=Mother+Armenia+Monument',
        input_type: 'text', order: 10, is_intro: false,
    },
];

const NEW_FINALE_TEXT = 'Ты прошёл через разные слои Еревана.\n\nТы увидел современный город и древние кварталы, попробовал армянский кофе, услышал легенды и почувствовал атмосферу улиц.\n\nЕреван — это не только здания и история. Это люди, традиции, камень, музыка и память.\n\nТеперь ты знаешь этот город немного ближе.';

async function getAllSteps(questId) {
    const r = await fetch(`${API}/api/quest-steps/?quest=${questId}`, {
        headers: { 'Authorization': `Token ${TOKEN}` }
    });
    if (!r.ok) throw new Error(`GET quest-steps: HTTP ${r.status}`);
    const data = await r.json();
    return Array.isArray(data) ? data : (data.results ?? []);
}

async function main() {
    console.log('🚀 Обновление квеста «Ереван» на проде\n');

    // 1. Получаем все текущие шаги и удаляем их
    console.log('🗑  Удаляем все текущие шаги квеста...');
    let existingSteps;
    try {
        existingSteps = await getAllSteps(QUEST_DB_ID);
        console.log(`  Найдено шагов: ${existingSteps.length}`);
    } catch (e) {
        console.error(`  ❌ Не удалось получить шаги: ${e.message}`);
        existingSteps = [];
    }
    for (const step of existingSteps) {
        try {
            await del(`/api/quest-steps/${step.id}/`);
            console.log(`  ✅ Удалён step id=${step.id} (step_id=${step.step_id})`);
        } catch (e) {
            console.error(`  ❌ step id=${step.id}: ${e.message}`);
        }
    }

    // 2. Создаём новый intro
    console.log('\n📝 Создаём intro...');
    try {
        const r = await post('/api/quest-steps/', { quest: QUEST_DB_ID, ...NEW_INTRO });
        console.log(`  ✅ Intro создан id=${r.id}`);
    } catch (e) {
        console.error(`  ❌ Intro: ${e.message}`);
    }

    // 3. Создаём новые шаги
    console.log('\n📝 Создаём новые шаги...');
    for (const s of NEW_STEPS) {
        try {
            const r = await post('/api/quest-steps/', { quest: QUEST_DB_ID, ...s });
            console.log(`  ✅ Step ${s.order}: ${s.step_id} id=${r.id}`);
        } catch (e) {
            console.error(`  ❌ Step ${s.step_id}: ${e.message}`);
        }
    }

    // 4. Обновляем финал — сначала получаем его ID
    console.log('\n📝 Обновляем финал...');
    try {
        // Try to get finale ID from quest bundle
        const br = await fetch(`${API}/api/quests/${QUEST_DB_ID}/`, {
            headers: { 'Authorization': `Token ${TOKEN}` }
        });
        const bundle = await br.json();
        console.log(`  bundle.finale keys =`, Object.keys(bundle.finale ?? {}));
        let finaleId = bundle.finale?.id ?? bundle.finale_id ?? null;

        if (!finaleId) {
            // Fallback: fetch all finales and find by quest
            const fr = await fetch(`${API}/api/quest-finales/`, {
                headers: { 'Authorization': `Token ${TOKEN}` }
            });
            const fdata = await fr.json();
            console.log(`  /api/quest-finales/ response type=${Array.isArray(fdata) ? 'array' : 'object'}, keys=`, Object.keys(fdata));
            const finales = Array.isArray(fdata) ? fdata : (fdata.results ?? []);
            console.log(`  Всего финалов: ${finales.length}`, finales.map(f => `id=${f.id} quest=${f.quest}`));
            const match = finales.find(f => f.quest === QUEST_DB_ID || String(f.quest) === String(QUEST_DB_ID));
            finaleId = match?.id ?? null;
            if (finaleId) console.log(`  Финал найден через список id=${finaleId}`);
        }

        if (finaleId) {
            await patch(`/api/quest-finales/${finaleId}/`, { text: NEW_FINALE_TEXT });
            console.log(`  ✅ Финал обновлён id=${finaleId}`);
        } else {
            const fr = await post('/api/quest-finales/', { quest: QUEST_DB_ID, text: NEW_FINALE_TEXT });
            console.log(`  ✅ Финал создан id=${fr.id}`);
        }
    } catch (e) {
        console.error(`  ❌ Финал: ${e.message}`);
    }

    // 5. Обновляем storage_key квеста
    try {
        await patch(`/api/quests/${QUEST_DB_ID}/`, { storage_key: 'quest_yerevan_ararat_v2' });
        console.log('\n  ✅ storage_key обновлён → quest_yerevan_ararat_v2');
    } catch (e) {
        console.error(`  ❌ storage_key: ${e.message}`);
    }

    console.log('\n✅ Квест обновлён!');
    console.log('   URL: https://metravel.by/quests/yerevan/yerevan-ararat');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
