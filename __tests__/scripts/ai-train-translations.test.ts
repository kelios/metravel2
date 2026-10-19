import fs from 'fs';
import path from 'path';
import { makeTempDir, removeDir, runCli } from './cli-test-utils';

// #2476: набор translations (квесты и строки интерфейса RU → BE/UK/PL/EN) и
// проверка языка ответа в eval.py. Фикстура кэша sources/site_translations.
const DIR = path.resolve(process.cwd(), 'scripts/ai-train');
const SCRIPT = path.join(DIR, 'build_mix.py');

const quest = (id: number, locale: string, t: (s: string) => string) => ({
  id,
  title: t(`Квест ${id}`),
  content_locale: locale,
  url: `https://metravel.by/quests/kvest-${id}`,
  city: { name_localized: t('Гродно') },
  city_name: 'Гродно',
  duration_min: 90,
  difficulty: 'easy',
  intro: {
    story: [t('Прогулка по старому городу.'), t('Второй абзац.'), t('x'.repeat(700))].join('\n\n'),
    task: t('Билеты — на muzeumkrakowa.pl'), // домен без схемы — тоже чужой сайт
  },
  // шаги перепутаны в переводе: выравнивание по step_id, а не по порядку
  steps: (locale === 'ru' ? ['a', 'b'] : ['b', 'a']).map((sid) => ({
    step_id: sid,
    title: t(`Точка ${sid}`),
    story: t(`История точки ${sid}.`),
    task: sid === 'b' ? t('Сколько башен? Подробнее: https://example.com/towers') : t(`Найди герб ${sid}.`),
  })),
  finale_text: t('Финал у реки.'),
});

const be = (s: string) => `[be] ${s}`;
const pl = (s: string) => `[pl] ${s}`;

const writeJsonl = (file: string, rows: unknown[]) =>
  fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
const readJsonl = (file: string) =>
  fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

describe('ai-train translations (#2476)', () => {
  let home: string;

  beforeAll(() => {
    home = makeTempDir('ai-train-tr-');
    const cache = path.join(home, 'data', 'sources', 'site_translations');
    fs.mkdirSync(cache, { recursive: true });
    const quests = [1, 2, 3, 4].flatMap((id) => [quest(id, 'ru', (s) => s), quest(id, 'be', be), ...(id % 2 ? [quest(id, 'pl', pl)] : [])]);
    writeJsonl(path.join(cache, 'quests.jsonl'), [...quests, quest(9, 'be', be)]); // 9 — без русской версии
    const strings = Array.from({ length: 25 }, (_, i) => ({
      ns: i < 15 ? 'generated/quests_01' : 'common',
      key: `k${i}`,
      ru: `Строка ${i} {{value1}}`,
      be: i === 3 ? `Строка ${i} {{value1}}` : `Радок ${i} {{value1}}`,
      pl: i === 4 ? 'Zob. https://example.com' : `Wiersz ${i} {{value1}}`,
    }));
    writeJsonl(path.join(cache, 'i18n.jsonl'), [...strings, { ns: 'common', key: 'brand', ru: 'METRAVEL', be: 'METRAVEL.BY' }]);
  });
  afterAll(() => removeDir(home));

  const run = (mix: Record<string, unknown>, out: string, aiHome = home) => {
    const mixFile = path.join(aiHome, `${String(mix.name)}.json`);
    fs.writeFileSync(mixFile, JSON.stringify(mix));
    return runCli('python3', ['-I', SCRIPT, '--ai-home', aiHome, '--mix', mixFile, '--out', out]);
  };

  it('набор: виды, выравнивание шагов по step_id, сплит по сущности, без чужих URL', () => {
    const res = run({ name: 'tr', split: { by: 'key', valid_share: 0.2, test_share: 0.2 }, sets: { translations: { options: { ui_batch: 10 } } } }, path.join(home, 'out'));
    expect(res.stderr).toContain('"mix": "tr"');
    expect(res.status).toBe(0);

    const parts = Object.fromEntries(['train', 'valid', 'test'].map((p) => [p, readJsonl(path.join(home, 'data', 'sets', 'translations', `${p}.jsonl`))]));
    const all = [...parts.train, ...parts.valid, ...parts.test];
    const keys = (p: string) => new Set(parts[p].map((r: { key: string }) => r.key));
    for (const [a, b] of [['train', 'test'], ['train', 'valid'], ['valid', 'test']]) {
      expect([...keys(a)].filter((k) => keys(b).has(k))).toEqual([]);
    }
    expect(new Set(all.map((r) => r.id)).size).toBe(all.length);
    expect(all.every((r) => r.set === 'translations' && r.license.startsWith('metravel.by own content'))).toBe(true);
    expect(new Set(all.map((r) => r.kind))).toEqual(new Set(['quest_translate', 'quest_card_l', 'quest_card_from_ru', 'ui_strings']));
    expect(all.some((r) => r.key === 'quest:9')).toBe(false);
    expect(all.some((r) => /example\.com|muzeumkrakowa/.test(r.messages[2].content))).toBe(false);

    const byId = Object.fromEntries(all.map((r) => [r.id, r]));
    // квест 1: интро, шаги a/b, задание a, финал (задание b с чужим URL выпало), карточки
    expect(Object.keys(byId).filter((id) => id.startsWith('q1be:')).sort()).toEqual(['q1be:c', 'q1be:f', 'q1be:i', 'q1be:r', 'q1be:s:a', 'q1be:s:b', 'q1be:t:a']);
    expect(byId['q1be:s:b'].messages[1].content).toMatch(/белорусск[ийом]+ язык[еа]?[^]*Точка b\n\nИстория точки b\./);
    expect(byId['q1be:s:b'].messages[2].content).toBe('[be] Точка b\n\n[be] История точки b.');
    expect(byId['q2pl:i']).toBeUndefined(); // квест 2 не переведён на польский
    expect(byId['q1be:it']).toBeUndefined(); // задание интро с доменом чужого сайта
    expect(['Opowiedz o queście „[pl] Квест 1”.', 'Co to za quest „[pl] Квест 1” na metravel.by?']).toContain(byId['q1pl:c'].messages[1].content);
    // лид карточки — абзацы интро до 600 знаков, столько же абзацев в переводе
    expect(byId['q1pl:c'].messages[2].content).toBe('[pl] Прогулка по старому городу.\n\n[pl] Второй абзац.\n\nMiasto: [pl] Гродно. Czas: około 90 min. Poziom: łatwy. Punktów trasy: 2.\n\nRozpocznij: https://metravel.by/quests/kvest-1');
    expect(byId['q1pl:i'].messages[2].content).toContain('x'.repeat(700));
    expect(byId['q1be:r'].messages[1].content).toContain('Город: Гродно. Продолжительность: около 90 мин. Уровень: лёгкий. Точек маршрута: 2.\n\nНачать: https://metravel.by/quests/kvest-1');

    // строки интерфейса: пачки по 10 внутри пространства имён; без перевода и с чужим URL — выпадают
    const ui = byId['uibe:generated/quests_01:0'];
    expect(ui.key).toBe('ui:generated/quests_01:0');
    expect(byId['uipl:generated/quests_01:0'].key).toBe(ui.key);
    expect(ui.messages[1].content).toContain('плейсхолдеры вида {{value1}}:\n1. Строка 0 {{value1}}');
    expect(ui.messages[2].content.split('\n')).toHaveLength(9);
    expect(byId['uipl:generated/quests_01:0'].messages[2].content.split('\n')).toHaveLength(9);
    expect(byId['uibe:common:0'].messages[1].content).not.toContain('METRAVEL');

    const manifest = JSON.parse(fs.readFileSync(path.join(home, 'out', 'manifest.json'), 'utf8'));
    expect(manifest.sets.translations.source.cache).toContain('site_translations');
  });

  it('kind_share: детерминированная доля вида по id, повторная сборка даёт те же файлы', () => {
    const mix = { name: 'share', sets: { translations: { options: { kind_share: { quest_translate: 0.5, ui_strings: 0 } } } } };
    expect(run(mix, path.join(home, 'out-share-a')).status).toBe(0);
    const set = () => ['train', 'valid', 'test'].flatMap((p) => readJsonl(path.join(home, 'data', 'sets', 'translations', `${p}.jsonl`)));
    const a = set();
    expect(run(mix, path.join(home, 'out-share-b')).status).toBe(0);
    expect(set()).toEqual(a);
    const count = (kind: string) => a.filter((r) => r.kind === kind).length;
    expect(count('ui_strings')).toBe(0);
    expect(count('quest_card_from_ru')).toBe(6); // 4 квеста на be + 2 на pl, доля 1.0 по умолчанию
    expect(count('quest_translate')).toBeGreaterThan(0);
    expect(count('quest_translate')).toBeLessThan(6 * 6);
    const bad = run({ name: 'bad', sets: { translations: { options: { kind_share: { quest_cards: 0.5 } } } } }, path.join(home, 'out-bad'));
    expect(bad.status).not.toBe(0);
    expect(bad.stderr).toContain('kind_share');
  });

  it('опции: только UI для одной локали; нет кэша — понятная ошибка', () => {
    const res = run({ name: 'ui', sets: { translations: { options: { locales: ['pl'], quests: false } } } }, path.join(home, 'out-ui'));
    expect(res.status).toBe(0);
    const rows = ['train', 'valid', 'test'].flatMap((p) => readJsonl(path.join(home, 'data', 'sets', 'translations', `${p}.jsonl`)));
    expect(new Set(rows.map((r) => r.id.slice(0, 4)))).toEqual(new Set(['uipl']));

    const bare = makeTempDir('ai-train-tr-bare-');
    try {
      const missing = run({ name: 'm', sets: { translations: {} } }, path.join(bare, 'm'), bare);
      expect(missing.status).not.toBe(0);
      expect(missing.stderr).toContain('sources/site_translations.py');
      const badLocale = run({ name: 'b', sets: { translations: { options: { locales: ['de'] } } } }, path.join(home, 'out-b'));
      expect(badLocale.status).not.toBe(0);
      expect(badLocale.stderr).toContain('unknown locales');
    } finally {
      removeDir(bare);
    }
  });

  it('загрузчик: строки локали с ключами в кавычках и без (offline.ts), экранирование', () => {
    const file = path.join(home, 'offline.ts');
    fs.writeFileSync(file, [
      'export const offline = {',
      "  'a.b': 'Перевод \\'в кавычках\\'',",
      '  "c": "Строка\\nвторая",',
      "  title: 'Офлайн',",
      "  nested: {",
      "  summary: '{{count}} {{objects}}',",
      '} as const',
    ].join('\n'));
    const code = `
import json, sys
from pathlib import Path
sys.path.insert(0, sys.argv[1] + "/sources")
sys.path.insert(0, sys.argv[1])
import site_translations as st
print(json.dumps(st.read_strings(Path(sys.argv[2])), ensure_ascii=False))
`;
    const res = runCli('python3', ['-I', '-c', code, DIR, file]);
    expect(res.stderr).toBe('');
    expect(JSON.parse(res.stdout)).toEqual({
      'a.b': "Перевод 'в кавычках'", c: 'Строка\nвторая', title: 'Офлайн', summary: '{{count}} {{objects}}',
    });
  });

  it('eval.py: язык ответа и expect=lang', () => {
    const code = `
import json, sys
sys.path.insert(0, sys.argv[1])
from eval import check, detect_lang, verdict
texts = {
  "ru": "Квест проходит по старому городу: замок, ратуша и набережная. Начать: https://metravel.by/quests/1",
  "be": "Квэст праходзіць па старым горадзе: замак, ратуша і набярэжная. Пачаць: https://metravel.by/quests/1",
  "uk": "Квест проходить старим містом: замок, ратуша і набережна. Почати можна ввечері, їхати недалеко.",
  "pl": "Quest prowadzi przez stare miasto: zamek, ratusz i bulwary. Rozpocznij wieczorem.",
  "en": "The quest goes through the old town: the castle, the town hall and the embankment.",
}
known = {"https://metravel.by/quests/1"}
out = {k: detect_lang(v) for k, v in texts.items()}
out["none"] = detect_lang("https://metravel.by/quests/1 {{value1}} 123")
out["be_ok"] = verdict("lang", check(texts["be"], known), "be")
out["be_as_uk"] = verdict("lang", check(texts["be"], known), "uk")
out["made_up"] = verdict("lang", check(texts["be"] + " https://metravel.by/quests/999", known), "be")
out["no_link"] = verdict("lang", check(texts["uk"], known), "uk")
out["loop"] = verdict("lang", check(texts["be"] + " Яму ўжо шасцццццццц", known), "be")
out["answer_untouched"] = verdict("answer", check(texts["ru"], known))
print(json.dumps(out))
`;
    const res = runCli('python3', ['-I', '-c', code, DIR]);
    expect(res.stderr).toBe('');
    expect(JSON.parse(res.stdout)).toEqual({
      ru: 'ru', be: 'be', uk: 'uk', pl: 'pl', en: 'en', none: null,
      be_ok: true, be_as_uk: false, made_up: false, no_link: false, loop: false, answer_untouched: true,
    });
  });
});
