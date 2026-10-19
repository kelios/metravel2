import fs from 'fs';
import path from 'path';
import { makeTempDir, removeDir, runCli } from './cli-test-utils';

// #2475: build_mix.py — наборы → смеси. Фикстура корпуса вместо прод-выгрузки,
// смеси в .json (PyYAML есть только в venv обучения).
const DIR = path.resolve(process.cwd(), 'scripts/ai-train');
const SCRIPT = path.join(DIR, 'build_mix.py');

const travel = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  slug: `travel-${id}`,
  title: `Поездка ${id}`,
  meta_description: `Короткий рассказ о поездке ${id}.`,
  description: `<p>Первый день: от парковки 12 км по тропе, набор высоты 450 м.</p><p>Второй день — 1 200 км домой, по трассе до 90 км/ч.</p>`,
  countryName: id % 2 ? 'Польша' : 'Беларусь',
  month: [5],
  monthName: 'Май',
  year: 2025,
  number_days: 2,
  transports: [1, 17],
  over_nights_stay: [1],
  travelAddress: [
    { address: `Точка A${id}`, coord: '50.0614960,19.9371130', categoryName: 'Замок' },
    { address: `Точка B${id}`, coord: '50.0442200,19.9492060', categoryName: null },
  ],
  plus: '<ul><li>Виды</li></ul>',
  minus: '<ul><li>Толпы</li></ul>',
  recommendation: '<ul><li>Выезжать рано</li></ul>',
  ...extra,
});

const quest = (id: number) => ({
  id,
  title: `Квест ${id}`,
  url: `https://metravel.by/quests/grodno/kvest-${id}`,
  city_name: 'Гродно',
  country_name: 'Беларусь',
  content_locale: 'ru',
  duration_min: 90,
  difficulty: 'easy',
  intro: { story: 'Прогулка по старому городу.' },
  steps: [{ title: 'Замок', story: 'История замка.' }],
  finale_text: 'Финал у реки.',
});

const writeJsonl = (file: string, rows: unknown[]) =>
  fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

const readJsonl = (file: string) =>
  fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

describe('ai-train build_mix (#2475)', () => {
  let home: string;

  beforeAll(() => {
    home = makeTempDir('ai-train-mix-');
    const raw = path.join(home, 'data', 'raw');
    fs.mkdirSync(raw, { recursive: true });
    writeJsonl(path.join(raw, 'travels.jsonl'), Array.from({ length: 12 }, (_, i) => travel(i + 1)));
    writeJsonl(path.join(raw, 'quests.jsonl'), Array.from({ length: 4 }, (_, i) => quest(i + 1)));
    const filters = path.join(home, 'data', 'sources', 'site_filters');
    fs.mkdirSync(filters, { recursive: true });
    fs.writeFileSync(path.join(filters, 'filters.json'), JSON.stringify({
      transports: [{ id: 1, name: 'Машина' }, { id: 4, name: 'Такси' }, { id: 17, name: 'Такси' }],
      over_nights_stay: [{ id: 1, name: 'Палатка' }],
      complexity: [], companions: [], month: [],
    }));
  });
  afterAll(() => removeDir(home));

  const run = (mix: Record<string, unknown>, out: string, aiHome = home) => {
    const mixFile = path.join(aiHome, `${String(mix.name)}.json`);
    fs.writeFileSync(mixFile, JSON.stringify(mix));
    return runCli('python3', ['-I', SCRIPT, '--ai-home', aiHome, '--mix', mixFile, '--out', out]);
  };

  it('site: сплит по сущности, служебные поля в наборе, в смеси только messages, структурные виды', () => {
    const out = path.join(home, 'out-site');
    const res = run({ name: 'site', split: { by: 'key', valid_share: 0.2, test_share: 0.2 }, sets: { site: { options: { chunk_chars: 2600, structured: true } } } }, out);
    expect(res.stderr).toContain('"mix": "site"');
    expect(res.status).toBe(0);

    const parts = Object.fromEntries(['train', 'valid', 'test'].map((p) => [p, readJsonl(path.join(home, 'data', 'sets', 'site', `${p}.jsonl`))]));
    const keys = (p: string) => new Set(parts[p].map((r: { key: string }) => r.key));
    for (const [a, b] of [['train', 'test'], ['train', 'valid'], ['valid', 'test']]) {
      expect([...keys(a)].filter((k) => keys(b).has(k))).toEqual([]);
    }
    const all = [...parts.train, ...parts.valid, ...parts.test];
    expect(all.every((r) => r.set === 'site' && r.license && r.id && r.kind && r.key)).toBe(true);
    expect(new Set(all.map((r) => r.id)).size).toBe(all.length);

    const card = all.find((r) => r.kind === 'article_route_card');
    const parsed = JSON.parse(card.messages[2].content);
    expect(parsed.transport).toEqual(['Машина', 'Такси']);
    expect(parsed.overnight).toEqual(['Палатка']);
    expect(parsed.months).toEqual(['май']);
    expect(parsed.distances_km).toEqual([12, 1200]);
    expect(parsed.heights_m).toEqual([450]);
    const points = JSON.parse(all.find((r) => r.kind === 'article_route_points').messages[2].content);
    expect(points.points[0]).toEqual({ name: expect.stringMatching(/^Точка A/), lat: 50.0615, lng: 19.93711, category: 'Замок' });

    // гостевые статьи — не «мы ездили»: в редакции v2 подводка нейтральная
    const month = all.find((r) => r.kind === 'country_month');
    expect(month.messages[2].content).not.toContain('мы ездили');

    const mixed = readJsonl(path.join(out, 'train.jsonl'));
    expect(mixed.length).toBe(parts.train.length);
    expect(mixed.every((r) => Object.keys(r).join() === 'messages')).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
    expect(manifest.sets.site.license).toBe('metravel.by own content');
    expect(manifest.sets.site.source.filters).toBeNull();
  });

  it('legacy_texts и split by id — формулировки и сплит v1 для регресс-смеси', () => {
    const out = path.join(home, 'out-v1');
    const res = run({ name: 'v1', split: { by: 'id' }, sets: { site: { options: { chunk_chars: 2600, legacy_texts: true } } } }, out);
    expect(res.status).toBe(0);
    const rows = readJsonl(path.join(out, 'train.jsonl'));
    expect(rows.some((r) => r.messages[2].content.includes('мы ездили'))).toBe(true);
    expect(rows.some((r) => r.messages[2].content.startsWith('{"article"'))).toBe(false);
  });

  it('cap_tokens режет набор подвыборкой по seed, повторная сборка даёт те же файлы', () => {
    const mix = { name: 'cap', sets: { site: { cap_tokens: 3000 } } };
    const [a, b] = [path.join(home, 'out-cap-a'), path.join(home, 'out-cap-b')];
    expect(run(mix, a).status).toBe(0);
    expect(run(mix, b).status).toBe(0);
    const manifest = JSON.parse(fs.readFileSync(path.join(a, 'manifest.json'), 'utf8'));
    expect(manifest.sets.site.factor).toBeLessThan(1);
    expect(manifest.sets.site.tokens_taken).toBeLessThanOrEqual(3300);
    for (const p of ['train', 'valid', 'test']) {
      expect(fs.readFileSync(path.join(a, `${p}.jsonl`), 'utf8')).toBe(fs.readFileSync(path.join(b, `${p}.jsonl`), 'utf8'));
    }
  });

  it('этапы с replay: доля примеров прошлых этапов в следующем', () => {
    const code = `
import random, sys
sys.path.insert(0, sys.argv[1])
from build_mix import build_stages
def rows(name, n):
    return [{"set": name, "key": f"{name}{i}", "id": f"{name}{i}", "kind": "k", "messages": []} for i in range(n)]
built = {s: {"parts": {"train": rows(s, n), "valid": rows(s, 2), "test": rows(s, 2)}} for s, n in (("a", 100), ("b", 50), ("site", 170))}
mix = {"name": "m", "sets": {"a": {}, "b": {}, "site": {}}, "replay": 0.15,
       "stages": [{"name": "s1", "sets": ["a", "b"]}, {"name": "s2", "sets": ["site"]}]}
s1, s2 = build_stages(mix, built, 1)
print(len(s1["parts"]["train"]), s1["replayed"], len(s2["parts"]["train"]), s2["replayed"],
      sum(r["set"] != "site" for r in s2["parts"]["train"]), sum(r["set"] != "site" for r in s2["parts"]["valid"]))
`;
    const res = runCli('python3', ['-I', '-c', code, DIR]);
    expect(res.stderr).toBe('');
    // s2: 170 своих + 30 replay = 15 % потока; valid/test без replay
    expect(res.stdout.trim()).toBe('150 0 200 30 30 0');
  });

  it('ошибки конфигурации: набор вне этапов, нереализованный набор, structured без справочников', () => {
    const bare = makeTempDir('ai-train-bare-');
    try {
      fs.mkdirSync(path.join(bare, 'data'), { recursive: true });
      fs.symlinkSync(path.join(home, 'data', 'raw'), path.join(bare, 'data', 'raw'));
      const orphan = run({ name: 'o', sets: { site: {} }, stages: [{ name: 's1', sets: [] }] }, path.join(bare, 'o'), bare);
      expect(orphan.status).not.toBe(0);
      expect(orphan.stderr).toContain('exactly one stage');
      const missing = run({ name: 'm', sets: { toponyms: {} } }, path.join(bare, 'm'), bare);
      expect(missing.status).not.toBe(0);
      expect(missing.stderr).toContain('not implemented yet');
      const noFilters = run({ name: 'f', sets: { site: { options: { structured: true } } } }, path.join(bare, 'f'), bare);
      expect(noFilters.status).not.toBe(0);
      expect(noFilters.stderr).toContain('sources/site_filters.py');
    } finally {
      removeDir(bare);
    }
  });
});
