import fs from 'fs';
import path from 'path';
import { makeTempDir, removeDir, runCli } from './cli-test-utils';

// #2712: наборы rag_answers и offtopic — режим ассистента /assistant. Промпт берётся из
// scripts/ai-train/assistant_prompt.json (слепок prompt.ts), карточки — в формате formatSourcesBlock.
const DIR = path.resolve(process.cwd(), 'scripts/ai-train');
const SCRIPT = path.join(DIR, 'build_mix.py');
const PROMPT = JSON.parse(fs.readFileSync(path.join(DIR, 'assistant_prompt.json'), 'utf8'));

const travel = (id: number, title: string, city: string, country: string) => ({
  id,
  slug: `travel-${id}`,
  name: title,
  title,
  cityName: city,
  countryName: country,
  meta_description: `${title}: маршрут на выходные и советы по парковке. Второе предложение.`,
  description: `<p>${'Длинный рассказ о поездке. '.repeat(20)}</p>`,
});
const quest = (id: string, title: string, city: string, alias: string, duration: number, difficulty = 'easy') => ({
  id,
  quest_id: id,
  title,
  city_name: city,
  city_alias: alias,
  country_name: 'Польша',
  duration_min: String(duration),
  difficulty,
  steps: [{ step_id: 'a' }, { step_id: 'b' }, { step_id: 'c' }],
});

const writeJsonl = (file: string, rows: unknown[]) => fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
const readJsonl = (file: string) => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const URL_RE = /https?:\/\/[^\s)\]]+/g;

describe('ai-train rag_answers / offtopic (#2712)', () => {
  let home: string;
  let all: Record<string, any>[];

  beforeAll(() => {
    home = makeTempDir('ai-train-rag-');
    const raw = path.join(home, 'data', 'raw');
    fs.mkdirSync(raw, { recursive: true });
    writeJsonl(path.join(raw, 'travels.jsonl'), [
      travel(1, 'Краков: путеводитель по местам', 'Краков', 'Польша'),
      travel(2, 'Окрестности Кракова за выходные', 'Величка', 'Польша'),
      travel(3, 'Минск за выходные: путеводитель', 'Минск', 'Беларусь'),
      travel(4, 'Гродно за 1 день', 'Гродно', 'Беларусь'),
      travel(5, 'Рысы со словацкой стороны', 'Штрбске Плесо', 'Словакия'),
    ]);
    writeJsonl(path.join(raw, 'quests.jsonl'), [
      quest('krakow-dragon', 'Квест по Кракову: Вавельский дракон', 'Краков', 'krakow', 120),
      quest('krakow-kazimierz', 'Квест по Кракову: Казимеж', 'Краков', 'krakow', 60, 'medium'),
      quest('minsk-cmok', 'Квест по Минску: цмок', 'Минск', 'minsk', 45),
    ]);
    const mixFile = path.join(home, 'rag.json');
    fs.writeFileSync(mixFile, JSON.stringify({ name: 'rag', split: { by: 'key', valid_share: 0.2, test_share: 0.2 }, sets: { rag_answers: {}, offtopic: { options: { variants: 1 } } } }));
    const res = runCli('python3', ['-I', SCRIPT, '--ai-home', home, '--mix', mixFile, '--out', path.join(home, 'out')]);
    expect(res.stderr).toContain('"mix": "rag"');
    expect(res.status).toBe(0);
    all = ['rag_answers', 'offtopic'].flatMap((set) =>
      ['train', 'valid', 'test'].flatMap((part) => readJsonl(path.join(home, 'data', 'sets', set, `${part}.jsonl`))),
    );
  });
  afterAll(() => removeDir(home));

  it('промпт — ровно тот, что собирает экран, на языке интерфейса', () => {
    for (const r of all) {
      const lang = r.set === 'rag_answers' ? r.id.split(':')[2] : r.id.split(':')[0];
      expect(r.messages[0].content).toBe(PROMPT.system[lang]);
      expect(r.messages[1].content.startsWith('Материалы сайта:\n[1] ')).toBe(true);
      expect(r.messages[1].content).toMatch(/\n\nВопрос посетителя: .+$/);
    }
  });

  it('ответ по карточкам: до трёх ссылок, все из карточек, без шаблона статьи; «одно место» — одна ссылка', () => {
    const rag = all.filter((r) => r.set === 'rag_answers');
    expect(new Set(rag.map((r) => r.kind))).toEqual(new Set(['pick', 'quests', 'kids', 'limit', 'injected', 'no_material']));
    for (const r of rag) {
      const answer: string = r.messages[2].content;
      const urls = answer.match(URL_RE) ?? [];
      expect(urls.length).toBeGreaterThan(0);
      expect(urls.length).toBeLessThanOrEqual(3);
      for (const url of urls) expect(r.messages[1].content).toContain(`— ${url}`);
      expect(answer).not.toMatch(/Страна:|Точки маршрута:|google\.com|booking\.com/);
      expect(answer.length).toBeLessThanOrEqual(PROMPT.max_answer_chars);
      if (r.kind === 'limit') expect(urls).toHaveLength(r.messages[1].content.includes('только одно') ? 1 : 2);
      if (r.kind === 'no_material') expect(answer).toMatch(/пока нет материалов|пока ничего нет/);
    }
    const krakow = rag.find((r) => r.kind === 'quests' && r.key === 'place:Краков' && r.id.endsWith(':ru:0'));
    expect(krakow?.messages[2].content).toContain('[Квест по Кракову: Вавельский дракон](https://metravel.by/quests/krakow/krakow-dragon) — городской квест: 3 точки, около 120 мин');
  });

  // Ревью #3267 (LOW-19): пример, отброшенный подгонкой под бюджет, раньше исчезал без следа.
  it('манифест смеси считает отброшенные примеры rag_answers по причине и виду, записи набора при этом те же', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(home, 'out', 'manifest.json'), 'utf8'));
    const dropped = manifest.sets.rag_answers.source.dropped as Record<string, number>;
    expect(Object.keys(dropped).every((key) => /^(?:contour_question|over_budget|evidence_cut):[a-z_]+$/.test(key))).toBe(true);
    expect(Object.values(dropped).every((count) => Number.isInteger(count) && count > 0)).toBe(true);
    // вопросы контура про Минск и Краков в этой фикстуре генерируются и пропускаются — счётчик не пуст
    expect(Object.keys(dropped).some((key) => key.startsWith('contour_question:'))).toBe(true);
  });

  // Ревью #3267 (MEDIUM-5): ключ offtopic по позиции сдвигается при вставке вопроса; edition 2 — ключ по хешу вопроса
  // и пропуск вопросов среза eval_prompts/offtopic.jsonl. Edition 1 (v3–v7) остаётся прежним.
  it('offtopic edition 2: ключ по вопросу, вопросы среза оценки не строятся; edition 1 не меняется', () => {
    const script = [
      'import json, sys',
      `sys.path.insert(0, ${JSON.stringify(DIR)})`,
      'from pathlib import Path',
      'from sets import offtopic as o',
      'from sets.assistant_prompt import norm_question',
      `ctx = {"seed": 20261017, "raw": Path(${JSON.stringify(path.join(home, 'data', 'raw'))}), "sources": Path(${JSON.stringify(path.join(home, 'data', 'sources'))})}`,
      'question = lambda r: norm_question(r["messages"][1]["content"].split("Вопрос посетителя:")[-1])',
      'held = o.held_out_questions()',
      'first, default, second = o.build(ctx, {"edition": 1}), o.build(ctx, {}), o.build(ctx, {"edition": 2})',
      'inserted = dict(o.QUESTIONS["ru"]); inserted["cooking"] = ("Как засолить огурцы на зиму?",) + inserted["cooking"]',
      'o.QUESTIONS = {**o.QUESTIONS, "ru": inserted}',
      'shifted1, shifted2 = o.build(ctx, {"edition": 1}), o.build(ctx, {"edition": 2})',
      'keys = lambda rows: {question(r): r["key"] for r in rows}',
      'moved = lambda before, after: sum(1 for q, key in keys(before).items() if keys(after).get(q) != key)',
      'try:',
      ' o.build(ctx, {"edition": 3}); bad = False',
      'except ValueError: bad = True',
      'print(json.dumps({"same_default": first == default, "held": len(held),',
      ' "held_in_1": sum(question(r) in held for r in first), "held_in_2": sum(question(r) in held for r in second),',
      ' "positional": all(r["key"].rsplit(":", 1)[-1].isdigit() for r in first),',
      ' "hashed": all(r["key"].rsplit(":", 1)[-1].startswith("q") and len(r["key"].rsplit(":", 1)[-1]) == 13 for r in second),',
      ' "one_key_per_question": len(set(keys(second).values())) == len(keys(second)),',
      ' "moved_1": moved(first, shifted1), "moved_2": moved(second, shifted2), "bad_edition": bad}))',
    ].join('\n');
    const res = runCli('python3', ['-I', '-c', script]);
    expect(res.stderr).toBe('');
    const out = JSON.parse(res.stdout);
    expect(out).toMatchObject({ same_default: true, held_in_2: 0, positional: true, hashed: true, one_key_per_question: true, moved_2: 0, bad_edition: true });
    expect(out.held).toBeGreaterThanOrEqual(3);
    expect(out.held_in_1).toBeGreaterThan(0);
    // вставка одного вопроса в начало кортежа сдвигает позиционные ключи остальных вопросов вида
    expect(out.moved_1).toBeGreaterThan(0);
  });

  it('отказ не по теме — фраза отказа локали; сплит держит место и шаблон вопроса на одной стороне', () => {
    const off = all.filter((r) => r.set === 'offtopic');
    expect(off.length).toBeGreaterThan(50);
    for (const r of off) expect(r.messages[2].content).toBe(PROMPT.offtopic_reply[r.id.split(':')[0]]);
    expect(new Set(off.map((r) => r.id.split(':')[0]))).toEqual(new Set(['ru', 'be', 'uk', 'pl', 'en']));
    for (const set of ['rag_answers', 'offtopic']) {
      const keys = (part: string) => new Set(readJsonl(path.join(home, 'data', 'sets', set, `${part}.jsonl`)).map((r) => r.key));
      expect([...keys('train')].filter((k) => keys('test').has(k))).toEqual([]);
    }
  });
});

describe('контур оценки не учится на своих вопросах (#2731)', () => {
  it('ни один вопрос scripts/ai-assistant-eval/cases.jsonl не стоит дословно в генераторах наборов', () => {
    const cases = readJsonl(path.resolve(process.cwd(), 'scripts/ai-assistant-eval/cases.jsonl'));
    const generators = ['sets/rag_answers.py', 'sets/offtopic.py'].map((f) => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n');
    const questions: string[] = cases.flatMap((c: { q?: string; turns?: string[] }) => c.turns ?? [c.q as string]);
    expect(questions.filter((q) => generators.includes(q))).toEqual([]);
  });

  it('собранные примеры не задают вопросов контура и после подстановки города', () => {
    const contour = new Set(
      readJsonl(path.resolve(process.cwd(), 'scripts/ai-assistant-eval/cases.jsonl'))
        .flatMap((c: { q?: string; turns?: string[] }) => c.turns ?? [c.q as string])
        .map((q: string) => q.trim().toLowerCase().replace(/ё/g, 'е')),
    );
    const script = [
      'import sys',
      "sys.path.insert(0, 'scripts/ai-train')",
      'from sets.assistant_prompt import is_contour_question',
      "print(is_contour_question('Какие квесты есть в Минске?'), is_contour_question('  где попробовать ДРАНИКИ в Минске? '), is_contour_question('Какие квесты есть в Пинске?'))",
    ].join('\n');
    const run = runCli('python3', ['-I', '-c', script], { cwd: process.cwd() });
    expect(run.stdout.trim()).toBe('True True False');
    expect(contour.has('какие квесты есть в минске?')).toBe(true);
  });
});

describe('ai-train rag_answers edition 4 (#2731)', () => {
  let home: string;
  let rows: Record<string, any>[];

  beforeAll(() => {
    home = makeTempDir('ai-train-rag4-');
    const raw = path.join(home, 'data', 'raw');
    fs.mkdirSync(raw, { recursive: true });
    writeJsonl(path.join(raw, 'travels.jsonl'), [
      travel(1, 'Краков: путеводитель по местам', 'Краков', 'Польша'),
      travel(2, 'Окрестности Кракова за выходные', 'Величка', 'Польша'),
      travel(3, 'Краков зимой: ярмарки', 'Краков', 'Польша'),
      travel(4, 'Татры: поход к Морскому оку', 'Закопане', 'Польша'),
      travel(5, 'Минск за выходные: путеводитель', 'Минск', 'Беларусь'),
    ]);
    writeJsonl(path.join(raw, 'quests.jsonl'), [
      quest('krakow-dragon', 'Квест по Кракову: Вавельский дракон', 'Краков', 'krakow', 120),
      quest('krakow-kazimierz', 'Квест по Кракову: Казимеж', 'Краков', 'krakow', 60, 'medium'),
      quest('krakow-huta', 'Квест по Кракову: Нова-Хута', 'Краков', 'krakow', 90),
    ]);
    const tr = path.join(home, 'data', 'sources', 'site_translations');
    fs.mkdirSync(tr, { recursive: true });
    writeJsonl(path.join(tr, 'quests.jsonl'), [
      { quest_id: 'krakow-dragon', content_locale: 'pl', title: 'Quest po Krakowie: Smok Wawelski' },
      { quest_id: 'krakow-dragon', content_locale: 'en', title: 'Kraków Quest: The Wawel Dragon' },
      { quest_id: 'krakow-dragon', content_locale: 'be', title: 'Квэст па Кракаве: Вавельскі цмок' },
      { quest_id: 'krakow-dragon', content_locale: 'uk', title: 'Квест по Кракову: Вавельський дракон' },
    ]);
    const mixFile = path.join(home, 'rag4.json');
    fs.writeFileSync(mixFile, JSON.stringify({ name: 'rag4', split: { by: 'key', valid_share: 0.0, test_share: 0.0 }, sets: { rag_answers: { options: { edition: 4, per_place: 2 } } } }));
    const res = runCli('python3', ['-I', SCRIPT, '--ai-home', home, '--mix', mixFile, '--out', path.join(home, 'out')]);
    expect(res.status).toBe(0);
    rows = readJsonl(path.join(home, 'data', 'sets', 'rag_answers', 'train.jsonl'));
  });
  afterAll(() => removeDir(home));

  it('в собранной фикстуре нет ни одного вопроса контура (#2731)', () => {
    const contour = new Set(
      readJsonl(path.resolve(process.cwd(), 'scripts/ai-assistant-eval/cases.jsonl'))
        .flatMap((c: { q?: string; turns?: string[] }) => c.turns ?? [c.q as string])
        .map((q: string) => q.trim().toLowerCase().replace(/ё/g, 'е')),
    );
    const asked = rows.map((r) => String(r.messages[1].content).split('Вопрос посетителя: ').pop()!.trim().toLowerCase().replace(/ё/g, 'е'));
    expect(asked.filter((q) => contour.has(q))).toEqual([]);
  });

  it('тема поездки без статьи — честное «материала нет» со ссылкой из карточек, а не отказ', () => {
    const topics = rows.filter((r) => r.kind === 'topic');
    expect(topics.length).toBeGreaterThan(10);
    for (const r of topics) {
      const answer: string = r.messages[2].content;
      expect(answer).not.toContain('metravel.by по путешествиям');
      expect(answer).toMatch(/материала|статьи|материалу|матэрыялу|матеріалу|materiału|article/);
      for (const url of answer.match(URL_RE) ?? []) expect(r.messages[1].content).toContain(`— ${url}`);
    }
    // Ключ сплита — тема, а не язык: «еда в поход» на всех языках уходит в одну часть.
    const hikeFood = topics.filter((r) => r.key === 'topic:hike-food');
    expect(new Set(hikeFood.map((r) => r.id.split(':')[2]))).toEqual(new Set(['ru', 'be', 'uk', 'pl', 'en']));
  });

  it('много подходящих карточек — ровно три; в injected нет служебной фразы; не-RU — переведённые названия', () => {
    const many = rows.filter((r) => r.kind === 'many');
    expect(many.length).toBeGreaterThan(0);
    for (const r of many) {
      expect(r.messages[2].content.match(URL_RE)).toHaveLength(3);
      // Три выбора смешивают статьи и квесты — вопрос «Какие квесты есть?» им не подходит.
      expect(r.messages[1].content.split('Вопрос посетителя:')[1]).not.toMatch(/квест/i);
    }
    for (const r of rows.filter((x) => x.kind === 'injected')) expect(r.messages[2].content).not.toContain('Ссылки даю только');
    const pl = rows.filter((r) => r.id.split(':')[2] === 'pl' && r.messages[1].content.includes('krakow-dragon'));
    expect(pl.length).toBeGreaterThan(0);
    for (const r of pl) {
      expect(r.messages[1].content).toContain('«Quest po Krakowie: Smok Wawelski»');
      expect(r.messages[1].content).not.toContain('Вавельский дракон');
    }
  });
});


describe('ai-train rag_answers edition 5 (#2751)', () => {
  let home: string;
  let rows: Record<string, any>[];

  beforeAll(() => {
    home = makeTempDir('ai-train-rag5-');
    const raw = path.join(home, 'data', 'raw');
    fs.mkdirSync(raw, { recursive: true });
    writeJsonl(path.join(raw, 'travels.jsonl'), [
      { ...travel(1, 'Краков: прогулки по центру', 'Краков', 'Польша'), description: '<p>Вход на маршрут бесплатный, указана стоимость поездки 10 евро.</p>' },
      travel(2, 'Татры: тропа через горные озёра', 'Закопане', 'Польша'),
      { ...travel(3, 'Исторический памятник', 'Лида', 'Беларусь'), description: '<p>Крупный памятник сельскому Совету. В советские времена здесь был храм. Поездка к руинам замка в Крупе.</p>' },
    ]);
    const quests = Array.from({ length: 8 }, (_, i) => quest(
      `krakow-long-${i}`, `Квест по Кракову: длинное название маршрута номер ${i} для прогулки по историческому центру`,
      'Краков', 'krakow', 30 + i * 10,
    ));
    writeJsonl(path.join(raw, 'quests.jsonl'), quests);
    const translations = path.join(home, 'data', 'sources', 'site_translations');
    fs.mkdirSync(translations, { recursive: true });
    writeJsonl(path.join(translations, 'quests.jsonl'), quests.flatMap((q, i) => [
      { quest_id: q.quest_id, content_locale: 'be', title: `Квэст ${i}: гісторыі старога горада і незвычайныя падарожжы па вуліцах Кракава` },
      { quest_id: q.quest_id, content_locale: 'uk', title: `Квест ${i}: історії старого міста та незвичайні мандрівки вулицями Кракова` },
      { quest_id: q.quest_id, content_locale: 'pl', title: `Quest ${i}: historie starego miasta oraz niezwykłe wyprawy ulicami Krakowa` },
      { quest_id: q.quest_id, content_locale: 'en', title: `Quest ${i}: stories of the old town and unusual journeys through the streets of Krakow` },
    ]));
    const mixFile = path.join(home, 'rag5.json');
    fs.writeFileSync(mixFile, JSON.stringify({
      name: 'rag5', split: { by: 'key', valid_share: 0, test_share: 0 },
      sets: { rag_answers: { options: { edition: 5, per_place: 1 } } },
    }));
    const run = runCli('python3', ['-I', SCRIPT, '--ai-home', home, '--mix', mixFile, '--out', path.join(home, 'out')]);
    expect(run.status).toBe(0);
    rows = readJsonl(path.join(home, 'data', 'sets', 'rag_answers', 'train.jsonl'));
  });
  afterAll(() => removeDir(home));

  it('длинные списки покрывают каждую локаль и останавливаются на трёх ссылках', () => {
    const many = rows.filter((r) => r.kind === 'many' && r.key === 'place:Краков');
    expect(new Set(many.map((r) => r.id.split(':')[2]))).toEqual(new Set(['ru', 'be', 'uk', 'pl', 'en']));
    for (const row of many) {
      const user = row.messages[1].content;
      const answer = row.messages[2].content;
      expect(user.match(/— https:\/\//g)!.length).toBeGreaterThan(3);
      expect(answer.match(URL_RE)).toHaveLength(3);
      expect(answer).not.toMatch(/около|about|каля|близько|джерел|sources list/);
      expect(answer.length).toBeLessThan(700);
      for (const url of answer.match(URL_RE) ?? []) expect(user).toContain(`— ${url}`);
    }
  });

  it('еда, багаж и бюджет поездки получают ответ по карточкам, включая позитивный выбор маршрута', () => {
    const boundary = rows.filter((r) => r.kind.startsWith('boundary_'));
    expect(new Set(boundary.map((r) => r.kind))).toEqual(new Set(['boundary_missing', 'boundary_pick', 'boundary_evidence']));
    expect(new Set(boundary.map((r) => r.id.split(':')[2]))).toEqual(new Set(['ru', 'en']));
    expect(new Set(boundary.filter((r) => r.key === 'topic:packing').map((r) => r.kind))).toEqual(new Set(['boundary_missing', 'boundary_pick']));
    for (const row of boundary) {
      const answer = row.messages[2].content;
      expect(answer).not.toBe(PROMPT.offtopic_reply[row.id.split(':')[2]]);
      expect(answer.match(URL_RE)).toHaveLength(1);
      expect(answer).not.toMatch(/Страна:|Точки маршрута:/);
      for (const url of answer.match(URL_RE) ?? []) expect(row.messages[1].content).toContain(`— ${url}`);
      if (row.kind === 'boundary_evidence') {
        const excerpt = answer.match(/«(.+)» \[/)![1];
        expect(row.messages[1].content).toContain(excerpt);
        expect(answer).not.toContain('/travels/travel-3');
        expect(excerpt).not.toMatch(/Крупный|Совету|советские/);
      }
      if (row.kind === 'boundary_pick') {
        const duration = answer.match(/(\d+) (?:мин|minutes)/)![1];
        expect(row.messages[1].content).toContain(`Длительность: ${duration} мин`);
      }
    }
  });

  it('не учит цитате или длительности, если сокращение карточки скрыло доказательство', () => {
    const script = [
      'import json, sys',
      'from pathlib import Path',
      `sys.path.insert(0, ${JSON.stringify(DIR)})`,
      'from sets import rag_answers as r',
      'from sets.assistant_prompt import build_user_message',
      'r.fit_sources = lambda question, cards, answer, lang, **kwargs: build_user_message(question, [{**c, "snippet":"Сведения сокращены."} for c in cards], lang)',
      `ctx = {'seed':20261017, 'raw':Path(${JSON.stringify(path.join(home, 'data/raw'))}), 'sources':Path(${JSON.stringify(path.join(home, 'data/sources'))})}`,
      'rows = r.build(ctx, {"edition":5, "per_place":1})',
      'assert any(row["kind"] == "boundary_missing" for row in rows)',
      'assert not any(row["kind"] in ("boundary_evidence", "boundary_pick") for row in rows)',
    ].join('\n');
    const run = runCli('python3', ['-I', '-c', script]);
    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
  });

  it('детский ответ и уточнение не выводят возрастную пригодность из лёгкости и сохраняют ссылку', () => {
    const kids = rows.filter((r) => r.kind === 'kids');
    expect(kids.length).toBeGreaterThan(0);
    for (const row of kids) {
      const answer = row.messages[2].content;
      expect(answer).not.toMatch(/подойдут|па[дй]дуць|підійдуть|sprawdzą się|try:/);
      expect(answer).toMatch(/Возрастные|ўзроставыя|вікові|wiekowych|age suitability/);
    }
    const followup = rows.find((r) => r.kind === 'followup' && r.key === 'place:Краков');
    expect(followup).toBeDefined();
    expect(followup!.messages.map((m: { role: string }) => m.role)).toEqual(['system', 'user', 'assistant', 'user', 'assistant']);
    expect(followup!.messages[2].content).not.toContain('\n');
    const answer = followup!.messages.at(-1).content;
    expect(answer).toContain('Сколько лет ребёнку?');
    expect(answer.match(URL_RE)).toHaveLength(1);
    expect(followup!.messages[3].content).toContain(answer.match(URL_RE)![0]);
  });

  it('из компактных целей не попадает невидимая в карточке метаинформация и отложенные вопросы', () => {
    const contour = fs.readdirSync(path.resolve(process.cwd(), 'scripts/ai-assistant-eval'))
      .filter((name) => /^cases.*\.jsonl$/.test(name))
      .flatMap((name) => readJsonl(path.resolve(process.cwd(), 'scripts/ai-assistant-eval', name)))
      .flatMap((c: { q?: string; turns?: string[] }) => c.turns ?? [c.q as string]);
    const normalize = (text: string) => text.normalize('NFKC').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}_]+/gu, ' ').trim();
    const heldout = new Set(contour.map(normalize));
    for (const row of rows) {
      for (const message of row.messages.filter((m: { role: string }) => m.role === 'user')) {
        expect(heldout.has(normalize(message.content.split('Вопрос посетителя: ').at(-1)))).toBe(false);
      }
      expect(row.messages.at(-1).content).not.toContain('советы по парковке');
      expect(row.messages.at(-1).content.match(URL_RE)!.length).toBeLessThanOrEqual(3);
    }
  });
});

describe('ai-train rag_answers edition 6 (#2751 v6)', () => {
  let home: string;
  let rows: Record<string, any>[];
  const lang = (r: Record<string, any>) => r.id.split(':').at(-2);

  beforeAll(() => {
    home = makeTempDir('ai-train-rag6-');
    const raw = path.join(home, 'data', 'raw');
    fs.mkdirSync(raw, { recursive: true });
    writeJsonl(path.join(raw, 'travels.jsonl'), [
      { ...travel(1, 'Краков: путеводитель по местам', 'Краков', 'Польша'), description: '<p>Привет! Мы — Юля и Сергей из metravel.by. Дальше про Краков.</p>' },
      { ...travel(2, 'Окрестности Кракова за выходные', 'Величка', 'Польша'), description: '<p>Соляная шахта и замок за один день из Кракова. Второе предложение.</p>' },
      travel(3, 'Татры: поход к Морскому оку', 'Закопане', 'Польша'),
      travel(4, 'Минск за выходные: путеводитель', 'Минск', 'Беларусь'),
    ]);
    writeJsonl(path.join(raw, 'quests.jsonl'), [
      quest('krakow-dragon', 'Квест по Кракову: Вавельский дракон', 'Краков', 'krakow', 120),
      quest('krakow-kazimierz', 'Квест по Кракову: Казимеж', 'Краков', 'krakow', 60, 'medium'),
      quest('krakow-huta', 'Квест по Кракову: Нова-Хута', 'Краков', 'krakow', 90),
      quest('minsk-cmok', 'Квест по Минску: цмок', 'Минск', 'minsk', 45),
    ]);
    const tr = path.join(home, 'data', 'sources', 'site_translations');
    fs.mkdirSync(tr, { recursive: true });
    writeJsonl(path.join(tr, 'quests.jsonl'), [
      { quest_id: 'krakow-dragon', content_locale: 'pl', title: 'Quest po Krakowie: Smok Wawelski' },
      { quest_id: 'krakow-kazimierz', content_locale: 'pl', title: 'Quest po Krakowie: Kazimierz' },
      { quest_id: 'krakow-huta', content_locale: 'pl', title: 'Quest po Krakowie: Nowa Huta' },
    ]);
    const mixFile = path.join(home, 'rag6.json');
    fs.writeFileSync(mixFile, JSON.stringify({
      name: 'rag6', split: { by: 'key', valid_share: 0, test_share: 0 },
      sets: { rag_answers: { options: { edition: 6, per_place: 1, page_travels: 10, page_quests: 10 } } },
    }));
    const run = runCli('python3', ['-I', SCRIPT, '--ai-home', home, '--mix', mixFile, '--out', path.join(home, 'out')]);
    expect(run.stderr).toContain('"mix": "rag6"');
    expect(run.status).toBe(0);
    rows = readJsonl(path.join(home, 'data', 'sets', 'rag_answers', 'train.jsonl'));
  });
  afterAll(() => removeDir(home));

  it('ровно один квест до N минут — одна ссылка на единственную подходящую карточку с её длительностью, на языке вопроса', () => {
    const one = rows.filter((r) => r.kind === 'exact_one');
    expect(new Set(one.map(lang))).toEqual(new Set(['ru', 'be', 'uk', 'pl', 'en']));
    for (const r of one) {
      const user: string = r.messages[1].content;
      const answer: string = r.messages[2].content;
      const limit = Number(user.split('Вопрос посетителя:')[1].match(/(\d+) (?:минут|хвілін|хвилин|minut|minutes)/)![1]);
      const urls = answer.match(URL_RE)!;
      expect(urls).toHaveLength(1);
      const duration = Number(answer.match(/(\d+) (?:мин|хв|min)(?!\p{L})/u)![1]);
      // «до / короче / under N минут»: strictly below the limit, so every phrasing holds
      expect(duration).toBeLessThan(limit);
      expect(user).toContain(`— ${urls[0]}\nГородской квест`);
      expect(user).toContain(`Длительность: ${duration} мин`);
      // the other quest cards of the same place are longer than the limit: only one card of the place fits
      const place = r.id.split(':')[1];
      const fitting = user.split('Вопрос посетителя:')[0].split('\n\n').filter((block) => {
        const duration = block.match(/Длительность: (\d+) мин/);
        // the place is a city («по городу Краков») or a country («(Польша)»)
        return duration && Number(duration[1]) <= limit && (block.includes(`по городу ${place}`) || block.includes(`(${place})`));
      });
      expect(fitting).toHaveLength(1);
      expect(answer).not.toMatch(/списке источников|liście źródeł|списку джерел|sources list|спісе крыніц/);
      if (lang(r) === 'pl') expect(answer).toMatch(/quest miejski: punktów — \d+, ok\. \d+ min/);
    }
    const article = rows.filter((r) => r.kind === 'one_article');
    expect(article.length).toBeGreaterThan(0);
    for (const r of article) {
      expect(r.messages[2].content.match(URL_RE)).toEqual([expect.stringContaining('/travels/')]);
    }
  });

  it('вопрос о текущей странице — карточка страницы первой среди не более трёх, ответ только о ней и из её фрагмента', () => {
    const pages = rows.filter((r) => r.kind === 'page');
    expect(pages.length).toBeGreaterThan(5);
    expect(pages.some((r) => r.messages[2].content.includes('/travels/'))).toBe(true);
    expect(pages.some((r) => lang(r) !== 'ru')).toBe(true);
    for (const r of pages) {
      const user: string = r.messages[1].content;
      const answer: string = r.messages[2].content;
      const urls = answer.match(URL_RE)!;
      expect(urls).toHaveLength(1);
      expect(user).toContain(`[1] ${urls[0].includes('/quests/') ? 'Квест' : 'Статья'} «`);
      expect(user.split('\n[1] ')[1].split('\n')[0]).toContain(`— ${urls[0]}`);
      expect((user.match(/\n\[\d\] /g) ?? []).length).toBeLessThanOrEqual(3);
      expect(r.key).toBe(`page:${urls[0]}`);
      const duration = answer.match(/(\d+) (?:мин|хв|min)(?!\p{L})/u);
      if (duration) expect(user).toContain(`Длительность: ${duration[1]} мин`);
      // the authors' greeting is not a description of the trip
      expect(answer).not.toMatch(/Привет|Юля и Сергей/);
    }
    const velichka = pages.find((r) => r.messages[2].content.includes('/travels/travel-2'));
    expect(velichka?.messages[2].content).toContain('Соляная шахта и замок за один день из Кракова');
  });

  it('блёрб пункта — только то, что видно в его карточке после ужатия фрагментов', () => {
    let tails = 0;
    for (const r of rows.filter((row) => row.kind !== 'page')) {
      const user: string = r.messages.at(-2).content;
      for (const line of (r.messages.at(-1).content as string).split('\n')) {
        const m = line.match(/\]\((https?:\/\/[^\s)]+)\) — (.+)$/);
        if (!m) continue;
        tails += 1;
        const block = (user.split(`— ${m[1]}\n`)[1] ?? '').split('\n\n')[0];
        if (m[1].includes('/quests/')) {
          const [points, duration] = m[2].match(/\d+/g) ?? [];
          if (points) expect(block).toContain(`Точек: ${points}`);
          if (duration) expect(block).toContain(`Длительность: ${duration} мин`);
        } else {
          expect(block).toContain(m[2].replace(/\.$/, ''));
        }
      }
    }
    expect(tails).toBeGreaterThan(0);
  });

  it('пограничные темы поездки — «материала нет» с ближайшей карточкой, не отказ; естественные не-RU формулировки с блёрбом на языке ответа', () => {
    const topics = rows.filter((r) => r.kind === 'topic');
    expect(new Set(topics.map(lang))).toEqual(new Set(['ru', 'be', 'uk', 'pl', 'en']));
    expect(topics.length).toBeGreaterThan(40);
    for (const r of topics) {
      expect(r.messages[2].content).not.toBe(PROMPT.offtopic_reply[lang(r)]);
      // a general topic → the one nearest card; a city topic («где поесть в X») → the city's cards, ≤ 2
      expect(r.messages[2].content.match(URL_RE)!.length).toBeLessThanOrEqual(r.key.startsWith('topic:') ? 1 : 2);
    }
    expect(topics.filter((r) => r.key.startsWith('topic:')).length).toBeGreaterThan(30);
    const natural = rows.filter((r) => r.kind === 'pick' && lang(r) === 'uk');
    expect(natural.some((r) => /за два дні\?|за один день\?|на вихідних\?/.test(r.messages[1].content))).toBe(true);
    const plQuests = rows.filter((r) => r.kind === 'quests' && lang(r) === 'pl');
    expect(plQuests.length).toBeGreaterThan(0);
    for (const r of plQuests) expect(r.messages[2].content).toMatch(/quest miejski: punktów — \d+, ok\. \d+ min/);
    const kids = rows.filter((r) => r.kind === 'kids' && lang(r) !== 'ru');
    for (const r of kids) expect(r.messages[2].content).toMatch(/Karty nie podają|cards do not state|не пазначаны|не вказано/);
  });
});

describe('ai-train rag_answers edition 7 (#2751 v7)', () => {
  let home: string;
  let rows: Record<string, any>[];
  let rows6: Record<string, any>[];
  const lang = (r: Record<string, any>) => r.id.split(':').at(-2);
  // адреса карточек подсказки по порядку и адреса ответа
  const cardUrls = (r: Record<string, any>): string[] =>
    [...(r.messages.at(-2).content as string).matchAll(/\n?\[\d\] (?:Квест|Статья) «[^»]*» — (https?:\/\/\S+)/g)].map((m) => m[1]);
  const answerUrls = (r: Record<string, any>): string[] => (r.messages.at(-1).content as string).match(URL_RE) ?? [];

  beforeAll(() => {
    home = makeTempDir('ai-train-rag7-');
    const raw = path.join(home, 'data', 'raw');
    fs.mkdirSync(raw, { recursive: true });
    writeJsonl(path.join(raw, 'travels.jsonl'), [
      travel(1, 'Краков: путеводитель по местам', 'Краков', 'Польша'),
      travel(2, 'Минск за выходные: путеводитель', 'Минск', 'Беларусь'),
      travel(3, 'Татры: поход к Морскому оку', 'Закопане', 'Польша'),
    ]);
    writeJsonl(path.join(raw, 'quests.jsonl'), [
      quest('krakow-dragon', 'Квест по Кракову: Вавельский дракон', 'Краков', 'krakow', 120),
      quest('krakow-kazimierz', 'Квест по Кракову: Казимеж', 'Краков', 'krakow', 60, 'medium'),
      quest('krakow-huta', 'Квест по Кракову: Нова-Хута', 'Краков', 'krakow', 90),
      quest('krakow-szopka', 'Квест по Кракову: тропа шопкарей', 'Краков', 'krakow', 100),
      quest('krakow-tyniec', 'Квест по Кракову: Тынец', 'Краков', 'krakow', 240),
      quest('krakow-wanda', 'Квест по Кракову: курган Ванды', 'Краков', 'krakow', 300),
      quest('minsk-cmok', 'Квест по Минску: цмок', 'Минск', 'minsk', 45),
    ]);
    const build = (edition: number) => {
      const mixFile = path.join(home, `rag${edition}.json`);
      fs.writeFileSync(mixFile, JSON.stringify({
        name: `rag${edition}`, split: { by: 'key', valid_share: 0, test_share: 0 },
        sets: { rag_answers: { options: { edition, per_place: 1, page_travels: 3, page_quests: 3 } } },
      }));
      const run = runCli('python3', ['-I', SCRIPT, '--ai-home', home, '--mix', mixFile, '--out', path.join(home, `out${edition}`)]);
      expect(run.stderr).toContain(`"mix": "rag${edition}"`);
      expect(run.status).toBe(0);
      return readJsonl(path.join(home, 'data', 'sets', 'rag_answers', 'train.jsonl'));
    };
    rows6 = build(6);
    rows = build(7);
  });
  afterAll(() => removeDir(home));

  it('в городе с 4–5 квестами среди карточек ответ называет первые три по порядку карточек и отсылает к источникам', () => {
    const crowded = rows.filter((r) => r.kind === 'crowded');
    expect(new Set(crowded.map(lang))).toEqual(new Set(['ru', 'be', 'uk', 'pl', 'en']));
    expect(crowded.length).toBeGreaterThanOrEqual(8);
    for (const r of crowded) {
      const cards = cardUrls(r);
      // только подходящие квесты (города или страны), лишние совпадения остаются в подсказке
      expect(cards.length).toBeGreaterThanOrEqual(4);
      expect(cards.length).toBeLessThanOrEqual(5);
      expect(cards.every((url) => url.includes('/quests/'))).toBe(true);
      if (r.id.includes(':Краков:')) expect(cards.every((url) => url.includes('/quests/krakow/'))).toBe(true);
      expect(answerUrls(r)).toEqual(cards.slice(0, 3));
      expect(r.messages.at(-1).content).toMatch(/списке источников|спісе крыніц|списку джерел|liście źródeł|sources list/);
      expect((r.messages.at(-1).content as string).length).toBeLessThanOrEqual(PROMPT.max_answer_chars);
    }
    // вопросы контура в обучение не попадают
    expect(rows.some((r) => /Есть квест по Вроцлаву\?|Якія квэсты ёсць у Мінску\?/.test(r.messages.at(-2).content))).toBe(false);
  });

  it('в списках квестов выбор идёт по порядку карточек, «самый короткий» — по длительности', () => {
    const inCardOrder = (r: Record<string, any>) => {
      const cards = cardUrls(r);
      const named = answerUrls(r);
      const matching = cards.filter((url) => url.includes('/quests/krakow/'));
      return JSON.stringify(named.filter((url) => url.includes('/quests/'))) === JSON.stringify(matching.slice(0, named.filter((url) => url.includes('/quests/')).length));
    };
    const question = (r: Record<string, any>) => (r.messages.at(-2).content as string).split('Вопрос посетителя:')[1];
    const lists = (set: Record<string, any>[]) => set.filter((r) => r.kind === 'quests' && r.id.includes(':Краков:') && !/коротк/.test(question(r)));
    expect(lists(rows).length).toBeGreaterThan(2);
    for (const r of lists(rows)) expect(inCardOrder(r)).toBe(true);
    // в edition 6 выбор шёл по порядку выгрузки, который модель не видит
    expect(lists(rows6).some((r) => !inCardOrder(r))).toBe(true);
    for (const r of rows.filter((row) => row.kind === 'quests' && /коротк/.test(question(row)) && row.id.includes(':Краков:'))) {
      const durations = [...(r.messages.at(-1).content as string).matchAll(/около (\d+) мин/g)].map((m) => Number(m[1]));
      expect(durations).toEqual([...durations].sort((a, b) => a - b));
    }
  });

  it('edition 6 не меняется: те же записи без вида crowded', () => {
    expect(rows6.some((r) => r.kind === 'crowded')).toBe(false);
    expect(rows.filter((r) => r.kind !== 'crowded').length).toBeGreaterThanOrEqual(rows6.length - 12);
  });
});

// #3276, #3278: признак детского квеста в карточке и в ответе. Остаток v7 mt03#1: в подсказке две карточки
// квестов одного вида, модель отвечала «возраст не указан» и выбирала наугад.
describe('ai-train rag_answers edition 8 (#3278 v8)', () => {
  let home: string;
  let rows: Record<string, any>[];
  let rows7: Record<string, any>[];
  const lang = (r: Record<string, any>) => r.id.split(':').at(-2);
  const user = (r: Record<string, any>): string => r.messages.at(-2).content;
  const answer = (r: Record<string, any>): string => r.messages.at(-1).content;
  const answerUrls = (r: Record<string, any>): string[] => answer(r).match(URL_RE) ?? [];
  const KIDS_URL = 'https://metravel.by/quests/krakow/krakow-kids-dragon';
  const UNKNOWN_RE = /не указаны|не пазначаны|не вказано|nie poda(?:ją|je)|(?:do|does) not state/;

  beforeAll(() => {
    home = makeTempDir('ai-train-rag8-');
    const raw = path.join(home, 'data', 'raw');
    fs.mkdirSync(raw, { recursive: true });
    writeJsonl(path.join(raw, 'travels.jsonl'), [
      travel(1, 'Краков: путеводитель по местам', 'Краков', 'Польша'),
      travel(2, 'Минск за выходные: путеводитель', 'Минск', 'Беларусь'),
    ]);
    writeJsonl(path.join(raw, 'quests.jsonl'), [
      quest('krakow-dragon', 'Квест по Кракову: Вавельский дракон', 'Краков', 'krakow', 120),
      quest('krakow-kazimierz', 'Квест по Кракову: Казимеж', 'Краков', 'krakow', 60, 'medium'),
      // В названии нет слова «детский» — как у 17 из 26 детских квестов каталога.
      { ...quest('krakow-kids-dragon', 'Экзамен смотрителя драконят', 'Краков', 'krakow', 80), tags: { kids: true, family: true, 'age-8-10': true, 'adult-required': true } },
      { ...quest('krakow-family', 'Парк Прокоцим: голоса парка', 'Краков', 'krakow', 90), tags: ['family', 'citywalk'] },
      // Минск без детского квеста: ответ о детях остаётся «возраст не указан».
      quest('minsk-cmok', 'Квест по Минску: цмок', 'Минск', 'minsk', 45),
      quest('minsk-bokhan', 'Квест по Минску: предания', 'Минск', 'minsk', 150, 'medium'),
    ]);
    const build = (edition: number) => {
      const mixFile = path.join(home, `rag${edition}.json`);
      fs.writeFileSync(mixFile, JSON.stringify({
        name: `rag${edition}`, split: { by: 'key', valid_share: 0, test_share: 0 },
        sets: { rag_answers: { options: { edition, per_place: 1, page_travels: 2, page_quests: 6 } } },
      }));
      const run = runCli('python3', ['-I', SCRIPT, '--ai-home', home, '--mix', mixFile, '--out', path.join(home, `out${edition}`)]);
      expect(run.status).toBe(0);
      return readJsonl(path.join(home, 'data', 'sets', 'rag_answers', 'train.jsonl'));
    };
    rows7 = build(7);
    rows = build(8);
  });
  afterAll(() => removeDir(home));

  it('карточка детского и семейного квеста несёт признак так же, как её пишет приложение', () => {
    const prompts = rows.map(user).join('\n');
    expect(prompts).toContain('Детский городской квест по городу Краков (Польша). Возраст: 8–10 лет. Со взрослым. Точек: 3. Длительность: 80 мин. Сложность: лёгкий');
    expect(prompts).toContain('Семейный городской квест по городу Краков (Польша). Точек: 3. Длительность: 90 мин. Сложность: лёгкий');
    // Фикстура `quest()` ставит всем квестам страну «Польша».
    expect(prompts).toContain('\nГородской квест по городу Минск (Польша). Точек: 3. Длительность: 45 мин. Сложность: лёгкий');
    // Edition 7 признака не знает: набор обученной версии не меняется.
    expect(rows7.map(user).join('\n')).not.toMatch(/Детский городской квест|Семейный городской квест|Возраст:/);
    expect(rows7.map(answer).join('\n')).not.toMatch(/детский квест|семейный квест/);
  });

  it('вопрос о детях получает помеченный квест с возрастом, остальные квесты города остаются в карточках', () => {
    const kids = rows.filter((r) => r.kind === 'kids' && r.id.includes(':Краков:'));
    expect(new Set(kids.map(lang))).toEqual(new Set(['ru', 'be', 'uk', 'pl', 'en']));
    for (const r of kids) {
      expect({ id: r.id, urls: answerUrls(r) }).toEqual({ id: r.id, urls: [KIDS_URL] });
      expect(answer(r)).not.toMatch(UNKNOWN_RE);
      expect(user(r)).toContain('Детский городской квест');
    }
    const ru = kids.filter((r) => lang(r) === 'ru');
    expect(ru.length).toBeGreaterThan(0);
    for (const r of ru) {
      expect(answer(r)).toContain('детский квест для 8–10 лет: 3 точки, около 80 мин');
      // Модель видит, что подходящих карточек больше, чем названо.
      expect((user(r).match(/\n?\[\d\] Квест «[^»]*» — https:\/\/metravel\.by\/quests\/krakow\//g) ?? []).length).toBeGreaterThanOrEqual(2);
    }
    expect(kids.find((r) => lang(r) === 'pl') && answer(kids.find((r) => lang(r) === 'pl')!)).toContain('quest dla dzieci w wieku 8–10 lat');
  });

  it('уточнение «что выбрать с ребёнком» на пяти языках выбирает по признаку из двух карточек', () => {
    const follow = rows.filter((r) => r.kind === 'followup' && r.id.includes(':Краков:') && r.messages.length === 5 && /Детский городской квест/.test(user(r)));
    expect(new Set(follow.map(lang))).toEqual(new Set(['ru', 'be', 'uk', 'pl', 'en']));
    for (const r of follow) {
      const cards = [...user(r).matchAll(/\[\d\] Квест «[^»]*» — (\S+)/g)].map((m) => m[1]);
      expect(cards).toHaveLength(2);
      expect(cards).toContain(KIDS_URL);
      expect(answerUrls(r)).toEqual([KIDS_URL]);
      // Первый ответ диалога называл общие квесты, не детский.
      expect(r.messages[2].content).not.toContain(KIDS_URL);
    }
  });

  it('город без помеченного квеста и вопрос о странице обычного квеста — по-прежнему «возраст не указан»', () => {
    const minsk = rows.filter((r) => r.kind === 'kids' && r.id.includes(':Минск:'));
    expect(minsk.length).toBeGreaterThan(0);
    for (const r of minsk) expect(answer(r)).toMatch(UNKNOWN_RE);
    const pages = rows.filter((r) => r.kind === 'page' && /ребёнку|с детьми|дзіцяці|дитині|dziecka|child/.test(user(r).split('Вопрос посетителя:')[1] ?? ''));
    const marked = pages.filter((r) => user(r).split('\n\n')[0].includes('Детский городской квест'));
    const plain = pages.filter((r) => !user(r).split('\n\n')[0].includes('Детский городской квест'));
    for (const r of marked) expect(answer(r)).toMatch(/^(?:Да|Так|Tak|Yes), \[/);
    for (const r of plain) expect(answer(r)).toMatch(UNKNOWN_RE);
    expect(marked.length + plain.length).toBe(pages.length);
  });

  it('квестов места в карточках меньше, чем просит вопрос: названы только они, чужие города не добавляются', () => {
    const scarce = rows.filter((r) => r.kind === 'scarce' && r.id.includes(':Краков:'));
    expect(new Set(scarce.map(lang))).toEqual(new Set(['ru', 'be', 'uk', 'pl', 'en']));
    const ASKED: [RegExp, number][] = [[/три|тры|trzy|three/, 3], [/два|дв[аі]|пару|dwóch|two/, 2]];
    for (const r of scarce) {
      const question = user(r).split('Вопрос посетителя: ')[1];
      const cards = [...user(r).matchAll(/\[\d\] Квест «[^»]*» — (\S+)/g)].map((m) => m[1]);
      const own = cards.filter((url) => url.includes('/quests/krakow/'));
      const asked = ASKED.find(([pattern]) => pattern.test(question))![1];
      // В подсказке остались квесты другого города, а своих меньше, чем просили.
      expect(cards.length - own.length).toBeGreaterThanOrEqual(2);
      expect(own.length).toBeLessThan(asked);
      expect([...answerUrls(r)].sort()).toEqual([...own].sort());
      expect(answer(r)).toMatch(/Других квестов|Іншых квэстаў|Інших квестів|Innych questów|no other quests/);
      expect(answer(r)).not.toMatch(/списке источников|спісе крыніц|списку джерел|liście źródeł|sources list/);
    }
    expect(scarce.some((r) => answerUrls(r).length === 1)).toBe(true);
    expect(scarce.some((r) => answerUrls(r).length === 2)).toBe(true);
    // Вида нет в обученных редакциях.
    expect(rows7.some((r) => r.kind === 'scarce')).toBe(false);
  });

  it('первая реплика диалога о ребёнке не повторяет вопрос контура ни в одном городе и языке', () => {
    // «Какие квесты есть в Минске?» в истории — это on02: prepare_training_data отклоняет весь набор.
    const script = [
      'import sys',
      "sys.path.insert(0, 'scripts/ai-train')",
      'from sets.assistant_prompt import is_contour_question',
      'from sets.rag_answers import KIDS_FIRST_ASK, PLACES_L10N, PLACES_RU, be_fix',
      'hits = []',
      'for name, loc, _, _ in PLACES_RU:',
      "    hits += [KIDS_FIRST_ASK['ru'].format(loc=loc)] if is_contour_question(KIDS_FIRST_ASK['ru'].format(loc=loc)) else []",
      '    for lang, l10n in PLACES_L10N.get(name, {}).items():',
      "        q = (be_fix if lang == 'be' else str)(KIDS_FIRST_ASK[lang].format(loc=l10n))",
      '        hits += [q] if is_contour_question(q) else []',
      'print(hits)',
    ].join('\n');
    const run = runCli('python3', ['-I', '-c', script], { cwd: process.cwd() });
    expect(run.stdout.trim()).toBe('[]');
    expect(rows.some((r) => r.kind === 'followup' && r.messages.length === 5)).toBe(true);
  });

  it('ни один ответ не называет признак, которого нет в его карточке после ужатия фрагментов', () => {
    for (const r of rows) {
      for (const line of answer(r).split('\n')) {
        const url = (line.match(URL_RE) ?? [])[0];
        if (!url || !/детский квест|дзіцячы квэст|дитячий квест|quest dla dzieci|kids' quest/.test(line)) continue;
        const block = user(r).split(`— ${url}\n`)[1]?.split('\n\n')[0] ?? '';
        expect({ id: r.id, block }).toEqual({ id: r.id, block: expect.stringContaining('Детский городской квест') });
        if (/8–10/.test(line)) expect(block).toContain('Возраст: 8–10 лет');
      }
    }
  });
});

// #3319 (круг v9): v8 учил «детский квест + ещё один обычный» (13 из 49 подсказок с одной помеченной карточкой места),
// «выбери один» и пять карточек города не были представлены. Edition 9: один помеченный — один пункт.
describe('ai-train rag_answers edition 9 (#3319 v9)', () => {
  let home: string;
  let rows: Record<string, any>[];
  const lang = (r: Record<string, any>) => r.id.split(':').at(-2);
  const user = (r: Record<string, any>): string => r.messages.at(-2).content;
  const answer = (r: Record<string, any>): string => r.messages.at(-1).content;
  const answerUrls = (r: Record<string, any>): string[] => answer(r).match(URL_RE) ?? [];
  const place = (r: Record<string, any>): string => r.key.split(':')[1];
  // карточки подсказки: [тип, адрес, начало фрагмента]
  const cards = (r: Record<string, any>) =>
    [...user(r).matchAll(/\[\d\] (Квест|Статья) «[^»]*» — (\S+)\n?([^\n]*)/g)].map((m) => ({ type: m[1], url: m[2], head: m[3] }));
  // квесты места: по псевдониму города в адресе (фикстура: krakow, minsk, grodno, warsaw)
  const ALIAS: Record<string, string> = { Краков: 'krakow', Минск: 'minsk', Гродно: 'grodno', Варшава: 'warsaw' };
  const own = (r: Record<string, any>) => cards(r).filter((c) => c.type === 'Квест' && c.url.includes(`/quests/${ALIAS[place(r)]}/`));
  const UNKNOWN_RE = /не указаны|не пазначаны|не вказано|nie poda(?:ją|je)|(?:do|does) not state/;
  const AUDIENCE_KINDS = ['kids', 'kids_followup', 'one_marked', 'one_any'];

  beforeAll(() => {
    home = makeTempDir('ai-train-rag9-');
    const raw = path.join(home, 'data', 'raw');
    fs.mkdirSync(raw, { recursive: true });
    const q = (id: string, title: string, city: string, alias: string, duration: number, extra: Record<string, unknown> = {}) =>
      ({ ...quest(id, title, city, alias, duration), ...extra });
    writeJsonl(path.join(raw, 'travels.jsonl'), [
      travel(1, 'Краков: путеводитель по местам', 'Краков', 'Польша'),
      travel(2, 'Минск за выходные: путеводитель', 'Минск', 'Беларусь'),
      travel(3, 'Гродно за 1 день', 'Гродно', 'Беларусь'),
    ]);
    writeJsonl(path.join(raw, 'quests.jsonl'), [
      // Краков: один детский, один семейный, шесть обычных (пять и больше — для crowded5)
      q('krakow-a', 'Квест по Кракову: Вавельский дракон', 'Краков', 'krakow', 120),
      q('krakow-b', 'Квест по Кракову: Казимеж', 'Краков', 'krakow', 60),
      q('krakow-c', 'Квест по Кракову: Нова-Хута', 'Краков', 'krakow', 90),
      q('krakow-d', 'Квест по Кракову: тропа шопкарей', 'Краков', 'krakow', 100),
      q('krakow-e', 'Квест по Кракову: Тынец', 'Краков', 'krakow', 240),
      q('krakow-f', 'Квест по Кракову: курган Ванды', 'Краков', 'krakow', 300),
      q('krakow-kids', 'Экзамен смотрителя драконят', 'Краков', 'krakow', 80, { tags: { kids: true, 'age-8-10': true, 'adult-required': true } }),
      q('krakow-family', 'Парк Прокоцим: голоса парка', 'Краков', 'krakow', 90, { tags: ['family', 'citywalk'] }),
      // Минск: два детских и четыре обычных
      q('minsk-a', 'Квест по Минску: цмок', 'Минск', 'minsk', 45),
      q('minsk-b', 'Квест по Минску: предания', 'Минск', 'minsk', 150),
      q('minsk-c', 'Квест по Минску: дворики', 'Минск', 'minsk', 110),
      q('minsk-d', 'Квест по Минску: Троицкое', 'Минск', 'minsk', 95),
      q('minsk-kids-1', 'Друзья из бронзы', 'Минск', 'minsk', 75, { tags: { kids: true, 'age-8-10': true } }),
      q('minsk-kids-2', 'Школа маленьких сыщиков', 'Минск', 'minsk', 70, { tags: { kids: true, 'age-5-7': true } }),
      // Гродно: только семейный
      q('grodno-a', 'Квест по Гродно: замки', 'Гродно', 'grodno', 70),
      q('grodno-b', 'Квест по Гродно: улицы', 'Гродно', 'grodno', 95),
      q('grodno-family', 'Лето на Немане', 'Гродно', 'grodno', 80, { tags: { family: true } }),
      // Варшава: пометок нет
      q('warsaw-a', 'Квест по Варшаве: Старый город', 'Варшава', 'warsaw', 90),
      q('warsaw-b', 'Квест по Варшаве: Мокотув и Повисле', 'Варшава', 'warsaw', 100),
      q('warsaw-c', 'Квест по Варшаве: пражский берег', 'Варшава', 'warsaw', 85),
    ]);
    const mixFile = path.join(home, 'rag9.json');
    fs.writeFileSync(mixFile, JSON.stringify({ name: 'rag9', split: { by: 'key', valid_share: 0, test_share: 0 }, sets: { rag_answers: { options: { edition: 9, per_place: 1, page_travels: 2, page_quests: 4 } } } }));
    const run = runCli('python3', ['-I', SCRIPT, '--ai-home', home, '--mix', mixFile, '--out', path.join(home, 'out9')]);
    expect(run.status).toBe(0);
    rows = readJsonl(path.join(home, 'data', 'sets', 'rag_answers', 'train.jsonl'));
  });
  afterAll(() => removeDir(home));

  // Эталон: хеши записей, снятые с кода до правки (HEAD 28d6a6a39) на этой же фикстуре; подсказка приложения и вопросы
  // контура подменены, чтобы хеш не менялся от правок prompt.ts и новых оценочных вопросов.
  it('прежние edition 3–8 выдают те же записи байт в байт', () => {
    const script = [
      'import sys, json, hashlib, tempfile',
      `sys.path.insert(0, ${JSON.stringify(DIR)})`,
      'from pathlib import Path',
      'from sets import assistant_prompt as a, rag_answers as R',
      'a._fixture = {"system": {l: f"SYS {l}" for l in a.LOCALES}, "offtopic_reply": {l: "no" for l in a.LOCALES}, "max_answer_chars": 1200,',
      ' "user_with_sources": "Материалы сайта:\\n{sources}\\n\\nВопрос посетителя: {question}", "user_no_sources": "Материалы сайта: ничего.\\n\\nВопрос посетителя: {question}"}',
      'R.is_contour_question = lambda q: False',
      'raw = Path(tempfile.mkdtemp())',
      'def w(name, rows): (raw/name).write_text("\\n".join(json.dumps(r, ensure_ascii=False) for r in rows)+"\\n", encoding="utf-8")',
      'def travel(i, title, city, country): return {"id": i, "slug": f"travel-{i}", "name": title, "title": title, "cityName": city, "countryName": country,',
      '    "meta_description": f"{title}: маршрут на выходные и советы по парковке. Второе предложение.", "description": "<p>" + "Длинный рассказ о поездке. " * 20 + "</p>"}',
      'def quest(i, title, city, alias, dur, diff="easy", **kw): return {"id": i, "quest_id": i, "title": title, "city_name": city, "city_alias": alias, "country_name": "Польша",',
      '    "duration_min": str(dur), "difficulty": diff, "steps": [{"step_id": "a"}, {"step_id": "b"}, {"step_id": "c"}], **kw}',
      'w("travels.jsonl", [travel(1, "Краков: путеводитель по местам", "Краков", "Польша"), travel(2, "Минск за выходные: путеводитель", "Минск", "Беларусь"),',
      '                    travel(3, "Гродно за 1 день", "Гродно", "Беларусь"), travel(4, "Татры: поход к Морскому оку", "Закопане", "Польша")])',
      'w("quests.jsonl", [quest("krakow-dragon", "Квест по Кракову: Вавельский дракон", "Краков", "krakow", 120), quest("krakow-kazimierz", "Квест по Кракову: Казимеж", "Краков", "krakow", 60, "medium"),',
      '    quest("krakow-huta", "Квест по Кракову: Нова-Хута", "Краков", "krakow", 90), quest("krakow-szopka", "Квест по Кракову: тропа шопкарей", "Краков", "krakow", 100),',
      '    quest("krakow-tyniec", "Квест по Кракову: Тынец", "Краков", "krakow", 240), quest("krakow-wanda", "Квест по Кракову: курган Ванды", "Краков", "krakow", 300),',
      '    quest("krakow-kids-dragon", "Экзамен смотрителя драконят", "Краков", "krakow", 80, tags={"kids": True, "family": True, "age-8-10": True, "adult-required": True}),',
      '    quest("krakow-family", "Парк Прокоцим: голоса парка", "Краков", "krakow", 90, tags=["family", "citywalk"]),',
      '    quest("minsk-cmok", "Квест по Минску: цмок", "Минск", "minsk", 45), quest("minsk-bokhan", "Квест по Минску: предания", "Минск", "minsk", 150, "medium"),',
      '    quest("grodno-a", "Квест по Гродно: замки", "Гродно", "grodno", 70), quest("grodno-b", "Квест по Гродно: улицы", "Гродно", "grodno", 95, "medium"),',
      '    quest("grodno-kids", "Тайна городской башни", "Гродно", "grodno", 60, tags={"kids": True, "age-5-7": True})])',
      'ctx = {"seed": 20261017, "raw": raw, "sources": raw/"nosources"}',
      'h = lambda rows: hashlib.sha256(json.dumps(rows, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]',
      'print(json.dumps({e: [len(rows), h(rows)] for e in (3, 4, 5, 6, 7, 8) for rows in [R.build(ctx, {"edition": e, "per_place": 1, "page_travels": 3, "page_quests": 6})]}))',
    ].join('\n');
    const run = runCli('python3', ['-I', '-c', script]);
    expect(run.stderr).toBe('');
    expect(JSON.parse(run.stdout)).toEqual({
      3: [78, '6af1f12f49e3dddc'], 4: [105, '8635d1f251e96566'], 5: [148, '328411fc1c1b673c'],
      6: [269, '9c85b374b1cc092f'], 7: [283, 'c20fd695159fd245'], 8: [320, '2e5af556d7628643'],
    });
  });

  it('одна помеченная карточка места — один пункт, обычный квест рядом и квест другого города не называются', () => {
    const audience = rows.filter((r) => AUDIENCE_KINDS.includes(r.kind));
    expect(audience.length).toBeGreaterThan(60);
    const table = new Map<string, number>();
    for (const r of audience) {
      const mine = own(r);
      const marked = mine.filter((c) => c.head.startsWith('Детский'));
      const family = mine.filter((c) => c.head.startsWith('Семейный'));
      const named = answerUrls(r);
      // вне квестов места не называется ничего
      expect({ id: r.id, foreign: named.filter((u) => !mine.some((c) => c.url === u)) }).toEqual({ id: r.id, foreign: [] });
      if (marked.length) {
        expect({ id: r.id, named }).toEqual({ id: r.id, named: marked.map((c) => c.url) });
        if (marked.length === 1) expect(named).toHaveLength(1);
      } else if (family.length && r.kind !== 'one_any') {
        expect({ id: r.id, named }).toEqual({ id: r.id, named: family.map((c) => c.url) });
        expect(answer(r)).toMatch(/семейн|сямейн|сімейн|rodzinn|family/);
      } else if (r.kind === 'kids' || r.kind === 'kids_followup') {
        expect(answer(r)).toMatch(UNKNOWN_RE);
        expect(named.length).toBeLessThanOrEqual(2);
      }
      const key = `${r.kind}|${lang(r)}|${marked.length}|${named.length}`;
      table.set(key, (table.get(key) ?? 0) + 1);
    }
    // один помеченный → один пункт; два → два; встречаются все три случая 0/1/2 в диалоге
    const keys = [...table.keys()];
    expect(keys.some((k) => /^kids\|ru\|1\|1$/.test(k))).toBe(true);
    expect(keys.some((k) => /^kids\|pl\|2\|2$/.test(k))).toBe(true);
    for (const k of ['0', '1', '2']) expect(keys.some((x) => x.startsWith('kids_followup|') && x.split('|')[2] === k)).toBe(true);
    expect(keys.filter((k) => /^kids\|[a-z]+\|1\|/.test(k)).every((k) => k.endsWith('|1'))).toBe(true);
  });

  it('новые и изменённые виды идут на пяти языках и в равном числе', () => {
    for (const kind of ['kids', 'kids_followup', 'one_marked', 'one_any', 'crowded5']) {
      const counts = new Map<string, number>();
      for (const r of rows.filter((x) => x.kind === kind)) counts.set(lang(r), (counts.get(lang(r)) ?? 0) + 1);
      expect({ kind, langs: [...counts.keys()].sort() }).toEqual({ kind, langs: ['be', 'en', 'pl', 'ru', 'uk'] });
      // crowded5 теряет пример, чей вопрос совпал с вопросом контура («Какие квесты есть в Кракове?» — русский вариант)
      expect({ kind, spread: Math.max(...counts.values()) - Math.min(...counts.values()) <= (kind === 'crowded5' ? 3 : 1) }).toEqual({ kind, spread: true });
    }
  });

  it('«назови только его»: один пункт, одна ссылка, ровно одна помеченная карточка, без отсылки к источникам и встречного вопроса', () => {
    const marked = rows.filter((r) => r.kind === 'one_marked');
    expect(marked.length).toBeGreaterThan(8);
    for (const r of marked) {
      expect(cards(r).filter((c) => c.head.startsWith('Детский') && own(r).some((o) => o.url === c.url))).toHaveLength(1);
      expect(answerUrls(r)).toHaveLength(1);
      expect(answer(r).split('\n').filter((line) => line.startsWith('- '))).toHaveLength(1);
      expect(answer(r)).not.toMatch(/списке источников|спісе крыніц|списку джерел|liście źródeł|sources list|\?/);
    }
    // «выбери один» — первая карточка подсказки, и среди карточек места нет помеченных
    const any = rows.filter((r) => r.kind === 'one_any');
    expect(any.length).toBeGreaterThan(8);
    for (const r of any) {
      const mine = own(r);
      expect(mine.length).toBeGreaterThanOrEqual(2);
      expect(mine.some((c) => /^(?:Детский|Семейный)/.test(c.head))).toBe(false);
      expect(answerUrls(r)).toEqual([mine[0].url]);
      expect(answer(r)).not.toMatch(/списке источников|спісе крыніц|списку джерел|liście źródeł|sources list|\?/);
    }
  });

  it('диалог о детях: два–пять квестов города в подсказке, первая реплика — список без детского, чужие города не называются', () => {
    const dialog = rows.filter((r) => r.kind === 'kids_followup');
    expect(dialog.length).toBeGreaterThan(20);
    for (const r of dialog) {
      expect(r.messages).toHaveLength(5);
      const mine = own(r);
      expect(mine.length).toBeGreaterThanOrEqual(2);
      expect(mine.length).toBeLessThanOrEqual(5);
      expect(r.messages[1].role).toBe('user');
      expect(r.messages[2].content).toMatch(/https:\/\/metravel\.by\/quests\//);
    }
    // в части примеров рядом лежит карточка чужого города
    expect(dialog.some((r) => cards(r).some((c) => c.type === 'Квест' && !own(r).some((o) => o.url === c.url)))).toBe(true);
    // и ни в одном она не названа — это проверено правилом выше; пятикарточный вариант встречается
    expect(dialog.some((r) => cards(r).length === 5)).toBe(true);
  });

  it('пять квестов одного города: три ссылки без пояснений в порядке карточек и «остальное в списке источников»', () => {
    const five = rows.filter((r) => r.kind === 'crowded5');
    expect(five.length).toBeGreaterThan(15);
    for (const r of five) {
      const shown = cards(r);
      expect(shown).toHaveLength(5);
      expect(new Set(shown.map((c) => c.url.split('/')[4])).size).toBe(1);
      expect(answerUrls(r)).toEqual(shown.slice(0, 3).map((c) => c.url));
      expect(answer(r).split('\n').filter((line) => line.startsWith('- ')).every((line) => /^- \[[^\]]+\]\(https[^)]+\)$/.test(line))).toBe(true);
      expect(answer(r)).toMatch(/списке источников|спісе крыніц|списку джерел|liście źródeł|sources list|списке источников\./);
    }
    const injected = rows.filter((r) => r.kind === 'crowded_injected');
    expect(injected.length).toBeGreaterThan(3);
    for (const r of injected) {
      expect(lang(r)).toBe('ru');
      expect(user(r).split('Вопрос посетителя: ')[1]).toMatch(/google\.com|booking\.com|tripadvisor\.com|wikipedia\.org/);
      expect(answer(r)).not.toMatch(/google|booking|tripadvisor|wikipedia/);
      expect(cards(r)).toHaveLength(5);
      expect(answerUrls(r)).toEqual(cards(r).slice(0, 3).map((c) => c.url));
      expect(answer(r)).toMatch(/списке источников/);
    }
  });

  it('прежняя пара карточек диалога edition 8 заменена, а вопрос другой редакции остаётся как был', () => {
    // у edition 9 нет вида followup с двумя карточками «общий + детский» из edition 8: они теперь kids_followup
    expect(rows.some((r) => r.kind === 'followup' && r.messages.length === 5 && cards(r).length === 2 && /Детский городской квест/.test(user(r)))).toBe(false);
    expect(rows.filter((r) => r.kind === 'kids_followup').length).toBeGreaterThan(0);
  });

  it('вопрос, повторяющий живой или отложенный набор по любому имени cases*.jsonl, генератор не строит', () => {
    const script = [
      'import sys, json, tempfile, shutil',
      `sys.path.insert(0, ${JSON.stringify(DIR)})`,
      'from pathlib import Path',
      'from sets import assistant_prompt as a, rag_answers as R',
      `src = Path(${JSON.stringify(path.join(process.cwd(), 'scripts/ai-assistant-eval'))})`,
      'tmp = Path(tempfile.mkdtemp())',
      'for name in ("cases.jsonl", "cases.quality.jsonl", "cases.complex.jsonl", "fixtures.complex.json"): shutil.copy(src / name, tmp / name)',
      'asks = [t.format(loc="в Минске") for t in R.ONE_KIDS_ASK["ru"]]',
      '(tmp / "cases.live.jsonl").write_text("\\n".join(json.dumps({"q": q}, ensure_ascii=False) for q in asks[:2]) + "\\n", encoding="utf-8")',
      '(tmp / "cases.holdout-2026-11.jsonl").write_text("\\n".join(json.dumps({"turns": [q]}, ensure_ascii=False) for q in asks[2:]) + "\\n", encoding="utf-8")',
      'a.CONTOUR_CASES = tmp / "cases.jsonl"; a._contour = None',
      'print(json.dumps({"all": all(a.is_contour_question(q) for q in asks), "names": sorted(k for k in a.holdout_provenance() if k.startswith("cases"))}))',
    ].join('\n');
    const run = runCli('python3', ['-I', '-c', script]);
    expect(run.stderr).toBe('');
    const out = JSON.parse(run.stdout);
    expect(out.all).toBe(true);
    expect(out.names).toEqual(expect.arrayContaining(['cases.live.jsonl', 'cases.holdout-2026-11.jsonl']));
  });

  it('перефраз оценочных вопросов в их городе не строится: h29, mt03, h28, q11, q12, q29, v5ln03, in08', () => {
    const script = [
      'import sys, json',
      `sys.path.insert(0, ${JSON.stringify(DIR)})`,
      'from sets import rag_answers as R',
      'print(json.dumps({"held": {k: sorted(v) for k, v in R.HELDOUT_CITIES_9.items()}, "asks": [t for l in R.ONE_KIDS_ASK.values() for t in l]}, ensure_ascii=False))',
    ].join('\n');
    const run = runCli('python3', ['-I', '-c', script]);
    expect(run.stderr).toBe('');
    const out = JSON.parse(run.stdout);
    expect(out.held).toEqual({
      kids_followup: ['Барановичи', 'Несвиж', 'Пинск'], one_marked: ['Барановичи', 'Варшава'], one_any: ['Варшава'],
      crowded5: ['Гродно'], crowded_injected: ['Гродно'],
    });
    // q11/q12: «Какой из квестов … детский? Назови только его» / «Який із … квестів дитячий? Назви тільки його»
    for (const ask of out.asks) expect(ask).not.toMatch(/Какой из квестов|Який із квестів|Які з квэстаў|Który z questów|Which of the quests/);
  });

  it('неизвестная edition — ошибка сборки', () => {
    const run = runCli('python3', ['-I', '-c', `import sys\nsys.path.insert(0, ${JSON.stringify(DIR)})\nfrom pathlib import Path\nfrom sets import rag_answers as R\nR.build({"seed": 1, "raw": Path("."), "sources": Path(".")}, {"edition": 10})`]);
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('edition must be 3, 4, 5, 6, 7, 8 or 9');
  });
});
