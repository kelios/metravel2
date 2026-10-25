import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
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
    const run = spawnSync('python3', ['-I', '-c', script], { cwd: process.cwd(), encoding: 'utf8' });
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

