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
