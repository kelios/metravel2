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
