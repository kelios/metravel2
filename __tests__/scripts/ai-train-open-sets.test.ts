import fs from 'fs';
import path from 'path';
import { makeTempDir, removeDir, runCli } from './cli-test-utils';

// #2477–#2479: наборы toponyms / wikivoyage / osm_intents на открытых данных и
// срезы eval.py (expect=exact/info/json). Только чистые функции и фикстуры кэша,
// без сети.
const DIR = path.resolve(process.cwd(), 'scripts/ai-train');

const py = (code: string, ...args: string[]) => {
  const res = runCli('python3', ['-I', '-c', `import sys\nsys.path.insert(0, sys.argv[1])\n${code}`, DIR, ...args]);
  expect(res.stderr).toBe('');
  return JSON.parse(res.stdout);
};

describe('ai-train open-data sets (#2477–#2479)', () => {
  it('clean_wikitext: позиционные параметры, вложенные ссылки в подписи, таблицы и галереи', () => {
    const out = py(`
import json
from sources.wikivoyage import clean_wikitext
text = """[[File:Square.jpg|thumb|Square in [[Minsk]]]]
Минск ({{lang|be|Мінск}}) — столица. {{PAGENAME}} лежит на трассе {{Белорусская трасса|М|1}}, {{km|12}} от кольца.
{| class="wikitable"
|-
| Цена || 5
|}
<gallery>
Plik:Ratusz.jpg|Ratusz
</gallery>
* {{Znacznik|Pałac|52.4|31.0|treść=Barokowy pałac}}
* [[Wrocław]]ia i [[Gdańsk|Gdańska]]"""
print(json.dumps(clean_wikitext(text, "Минск"), ensure_ascii=False))
`);
    expect(out).toBe('Минск (Мінск) — столица. Минск лежит на трассе М1, 12 km от кольца.\n\n• Pałac: Barokowy pałac\n• Wrocławia i Gdańska');
  });

  it('wikivoyage: страница через редирект и строки с контактами не попадают в ответы', () => {
    const home = makeTempDir('ai-train-wv-');
    try {
      const cache = path.join(home, 'data', 'sources', 'wikivoyage');
      fs.mkdirSync(cache, { recursive: true });
      const body = 'Город на реке, старый центр и замок. '.repeat(8);
      const page = (title: string, qid: string, extra: string) => ({
        lang: 'ru', title, pageid: 7, qid, country: 'BY', revision: 1, touched: '2026-10-24T00:00:00Z',
        sections: { understand: `${body}\n* Касса: тел. 41 366 15 00\n* Музей, muzeum@example.pl\n* Билеты на aeroBUS.pl\n${extra}` },
      });
      // одна и та же страница дважды: под своим QID и под QID редиректа (Leninski → Brest Oblast)
      fs.writeFileSync(path.join(cache, 'pages.jsonl'),
        [page('Брест', 'Q1', '* Год основания 1019-1020'), page('Брест', 'Q2', '')].map((r) => JSON.stringify(r)).join('\n') + '\n');
      fs.writeFileSync(path.join(cache, 'pages_list.json'),
        JSON.stringify([{ lang: 'ru', title: 'Брест', qid: 'Q1', country: 'BY' }, { lang: 'ru', title: 'Ленинский', qid: 'Q2', country: 'BY' }]));
      const out = py(`
import json
from pathlib import Path
from sets import wikivoyage
recs = wikivoyage.build({"sources": Path(sys.argv[2]), "seed": 1}, {"langs": ["ru"]})
print(json.dumps([{"key": r["key"], "answer": r["messages"][2]["content"]} for r in recs], ensure_ascii=False))
`, path.join(home, 'data', 'sources'));
      expect(out).toHaveLength(1);
      expect(out[0].key).toBe('wd:Q1');
      expect(out[0].answer.startsWith('По открытым данным: Город на реке')).toBe(true);
      expect(out[0].answer).toContain('Год основания 1019-1020');
      expect(out[0].answer).not.toMatch(/41 366|@|aeroBUS/);
    } finally {
      removeDir(home);
    }
  });

  it('osm_intents: склонение только для ясных окончаний, первый JSON в ответе', () => {
    const out = py(`
import json
from sets.osm_intents import decline_ru, extract_json, validate_filter
names = ["Минск", "Несвиж", "Лида", "Вилейка", "Речица", "Гродно", "Гомель", "Гдыня", "Глубокое", "Лунинец", "Октябрьский"]
decl = {n: [decline_ru(n, "gen"), decline_ru(n, "ins")] for n in names}
answer = 'Вот фильтр:\\n\`\`\`json\\n{"categories": ["history"], "radius_km": 50, "center": {"name": "Гродно"}}\\n\`\`\`\\nПоля {categories, radius_km} заполнены.'
obj = extract_json(answer)
print(json.dumps({"decl": decl, "obj": obj, "errors": validate_filter(obj), "none": extract_json("{не json}")}, ensure_ascii=False))
`);
    expect(out.decl).toEqual({
      Минск: ['Минска', 'Минском'], Несвиж: ['Несвижа', 'Несвижем'], Лида: ['Лиды', 'Лидой'],
      Вилейка: ['Вилейки', 'Вилейкой'], Речица: ['Речицы', 'Речицей'], Гродно: ['Гродно', 'Гродно'],
      Гомель: [null, null], Гдыня: [null, null], Глубокое: [null, null], Лунинец: [null, null], Октябрьский: [null, null],
    });
    expect(out.obj).toEqual({ categories: ['history'], radius_km: 50, center: { name: 'Гродно' } });
    expect(out.errors).toEqual([]);
    expect(out.none).toBeNull();
  });

  it('eval.py: expect=exact / info / json', () => {
    const out = py(`
import json
from eval import check, verdict
def v(p, answer):
    return verdict(p, check(answer, set()), answer)
same = {"expect": "exact", "accept": ["^\\\\s*да\\\\b|одно и то же"], "reject": ["^\\\\s*нет\\\\b", "разные"]}
info = {"expect": "info", "lang": "ru", "accept": ["Тарнув|Тарнов"]}
long_ru = "По открытым данным: Тарнов — город на юге Польши, " + "старый рынок, ратуша и собор. " * 8
filt = {"expect": "json", "accept": ['"history"']}
print(json.dumps({
  "same_yes": v(same, "Да, это одно и то же место."),
  "same_no": v(same, "Нет, это разные места."),
  "info_ok": v(info, long_ru),
  "info_link": v(info, long_ru + " https://metravel.by/travels"),
  "info_short": v(info, "Тарнов — город."),
  "json_ok": v(filt, '{"categories": ["history"], "radius_km": 25, "center": null}'),
  "json_bad_radius": v(filt, '{"categories": ["history"], "radius_km": 30, "center": null}'),
}))
`);
    expect(out).toEqual({
      same_yes: true, same_no: false, info_ok: true, info_link: false, info_short: false, json_ok: true, json_bad_radius: false,
    });
  });
});
