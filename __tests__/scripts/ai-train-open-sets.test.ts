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
strict = {"expect": "json", "accept": ['"history"', '"camper"\\\\s*:\\\\s*true'], "reject": ['"kids"\\\\s*:\\\\s*true']}
print(json.dumps({
  "same_yes": v(same, "Да, это одно и то же место."),
  "same_no": v(same, "Нет, это разные места."),
  "info_ok": v(info, long_ru),
  "info_link": v(info, long_ru + " https://metravel.by/travels"),
  "info_short": v(info, "Тарнов — город."),
  "json_ok": v(filt, '{"categories": ["history"], "radius_km": 25, "center": null}'),
  "json_bad_radius": v(filt, '{"categories": ["history"], "radius_km": 30, "center": null}'),
  "json_reject_clean": v(strict, '{"categories": ["history"], "radius_km": 25, "center": null, "constraints": {"camper": true}}'),
  "json_reject_extra": v(strict, '{"categories": ["history"], "radius_km": 25, "center": null, "constraints": {"camper": true, "kids": true}}'),
  "json_reject_false": v(strict, '{"categories": ["history"], "radius_km": 25, "center": null, "constraints": {"camper": true, "kids": false}}'),
}))
`);
    expect(out).toEqual({
      same_yes: true, same_no: false, info_ok: true, info_link: false, info_short: false, json_ok: true, json_bad_radius: false,
      // #3267: ограничение, о котором посетитель не просил, проваливает случай; `false` — не включённое.
      json_reject_clean: true, json_reject_extra: false, json_reject_false: true,
    });
  });

  // Ревью #3267 (HIGH-2): regex по тексту ответа пропускал фильтр со всеми категориями, склонённым центром и
  // четырьмя ограничениями. С полем `expected` сравнивается сам объект; `pass_accept` хранит прежнюю метрику.
  it('eval.py: expect=json с expected сравнивает категории, радиус, центр и ограничения', () => {
    const out = py(`
import json
from eval import check, verdict, verdict_accept
case = {"id": "x", "expect": "json", "accept": ['"viewpoints"', "Несвиж", '"camper"\\\\s*:\\\\s*true'],
        "expected": {"categories": ["viewpoints"], "center": "^(?:Несвиж)", "constraints": ["camper"], "radius_km": 50}}
country = {"id": "y", "expect": "json", "expected": {"categories": ["history"], "center": None, "constraints": []}}
def both(p, obj):
    answer = json.dumps(obj, ensure_ascii=False)
    c = check(answer, set())
    return [verdict(p, c, answer), verdict_accept(p, c, answer)]
good = {"categories": ["viewpoints"], "radius_km": 50, "center": {"name": "Несвиж"}, "constraints": {"camper": True}}
print(json.dumps({
  "exact": both(case, good),
  "extra_false_ok": both(case, {**good, "constraints": {"camper": True, "kids": False}}),
  "extra_category": both(case, {**good, "categories": ["viewpoints", "attractions"]}),
  "all_categories": both(case, {**good, "categories": ["attractions", "culture", "viewpoints", "entertainment", "religion", "history"]}),
  "extra_constraint": both(case, {**good, "constraints": {"camper": True, "dogs": True}}),
  "missing_constraint": both(case, {k: v for k, v in good.items() if k != "constraints"}),
  "declined_centre": both(case, {**good, "center": {"name": "Несвижем"}}),
  "other_place": both(case, {**good, "center": {"name": "Новый Несвиж"}}),
  "null_centre": both(case, {**good, "center": None}),
  "other_radius": both(case, {**good, "radius_km": 25}),
  "bad_schema": both(case, {**good, "radius_km": 30}),
  "country_ok": both(country, {"categories": ["history"], "radius_km": 200, "center": None}),
  "country_any_radius": both(country, {"categories": ["history"], "radius_km": 100, "center": None}),
  "country_with_centre": both(country, {"categories": ["history"], "radius_km": 200, "center": {"name": "Минск"}}),
}))
`);
    expect(out).toEqual({
      exact: [true, true],
      extra_false_ok: [true, true],
      // прежняя метрика (схема + accept) эти ответы засчитывала
      extra_category: [false, true],
      all_categories: [false, true],
      extra_constraint: [false, true],
      // центр — место, а не написание: склонённое название геокодер разрешит, другое название — нет
      declined_centre: [true, true],
      other_place: [false, true],
      other_radius: [false, true],
      missing_constraint: [false, false],
      null_centre: [false, false],
      bad_schema: [false, false],
      // радиус проверяется, только когда вопрос называет число
      country_ok: [true, true],
      country_any_radius: [true, true],
      country_with_centre: [false, true],
    });
  });

  it('срез osm_intents: у каждого случая есть expected, согласованный с accept и reject', () => {
    const out = py(`
import json
from eval import check, verdict, verdict_accept
from sets import osm_intents as o
rows = [json.loads(line) for line in o.EVAL_PROMPTS.read_text(encoding="utf-8").splitlines() if line.strip()]
def first_name(pattern):
    # "^(?:Gdańsk|Gda[ńn]sk)" → "Gdańsk": первый вариант — название в именительном падеже, дальше — основа
    alt, out, i = pattern[len("^(?:"):-len(")")].split("|")[0], "", 0
    while i < len(alt):
        if alt[i] == "[":
            out, i = out + alt[i + 1], alt.index("]", i) + 1
        else:
            out, i = out + alt[i], i + 1
    return out
bad = []
for row in rows:
    e = row.get("expected")
    if (not isinstance(e, dict) or not e.get("categories") or set(e["categories"]) - set(o.CATEGORIES) or set(e.get("constraints", [])) - set(o.CONSTRAINTS)
            or ("radius_km" in e and e["radius_km"] not in o.RADII) or not (e["center"] is None or isinstance(e["center"], str))):
        bad.append(row["id"]); continue
    # ответ, собранный из expected, проходит и строгую, и прежнюю проверку, и accept/reject случая
    name = None if e["center"] is None else first_name(e["center"])
    ref = {"categories": e["categories"], "radius_km": e.get("radius_km", 25), "center": {"name": name} if name else None}
    if e.get("constraints"):
        ref["constraints"] = {c: True for c in e["constraints"]}
    text = o.dump_filter(ref)
    c = check(text, set())
    legacy = {k: v for k, v in row.items() if k != "expected"}
    if o.validate_filter(ref) or not (verdict(row, c, text) and verdict_accept(row, c, text) and verdict(legacy, c, text)):
        bad.append(row["id"])
print(json.dumps({"cases": len(rows), "bad": bad, "with_radius": sum("radius_km" in r["expected"] for r in rows if isinstance(r.get("expected"), dict)),
                  "country_wide": sum(r["expected"]["center"] is None for r in rows if isinstance(r.get("expected"), dict))}))
`);
    expect(out.bad).toEqual([]);
    expect(out.cases).toBeGreaterThanOrEqual(40);
    expect(out.with_radius).toBeGreaterThanOrEqual(8);
    expect(out.country_wide).toBeGreaterThanOrEqual(3);
  });

  // Ревью #3267 (MEDIUM-7, MEDIUM-8, LOW-10, LOW-11, LOW-17).
  it('eval.py: offtopic без ответа по существу, rag только по карточкам подсказки, адреса и отказ', () => {
    const out = py(`
import json
from eval import SITE, base_cache_valid, check, find_urls, verdict
from sets.assistant_prompt import offtopic_reply
known = {SITE + "/travels/krakow", SITE + "/quests/minsk/cmok", SITE + "/travels/other"}
def v(p, answer):
    return verdict(p, check(answer, known), answer)
off = {"expect": "offtopic", "lang": "ru"}
cards = "Материалы сайта:\\n[1] Статья «Краков» — " + SITE + "/travels/krakow\\n[2] Квест «Цмок» — " + SITE + "/quests/minsk/cmok\\nВопрос посетителя: Что посмотреть?"
rag = {"expect": "rag", "lang": "ru", "group": "pick", "prompt": cards}
absent = {**rag, "group": "no_material", "max_urls": 2}
link = "[Краков](" + SITE + "/travels/krakow)"
print(json.dumps({
  "refusal": v(off, offtopic_reply("ru")),
  "refusal_en": v({"expect": "offtopic", "lang": "en"}, offtopic_reply("en")),
  "refusal_then_recipe": v(off, offtopic_reply("ru") + " Но вот рецепт: гречку варят 20 минут под крышкой, на стакан крупы два стакана воды, посолить в начале."),
  "rag_card": v(rag, "Посмотрите " + link + " — путеводитель по городу."),
  "rag_site_url_not_in_cards": v(rag, "Посмотрите [другое](" + SITE + "/travels/other) — тоже статья сайта."),
  "no_material_admitted": v(absent, "Материалов об Австралии в карточках нет. Ближайшее из найденного:\\n- " + link),
  "no_material_admitted_other_order": v(absent, "На сайте пока нет материалов про Австралию. Из того, что нашлось, — " + link + "."),
  "no_material_silent": v(absent, "Посмотрите " + link + " — путеводитель по городу."),
  "praise_is_not_refusal": check("Нет ничего лучше прогулки по набережной.", known)["refused"],
  "real_refusal": check("На сайте пока нет ничего про Исландию.", known)["refused"],
  "bare_site": check("Загляните на metravel.by/travels/vydumka и всё.", known)["urls_unknown"],
  "bare_www": check("Забронируйте на www.booking.com.", known)["external"],
  "bold_url": find_urls("**" + SITE + "/travels/krakow**"),
  "email": find_urls("пишите на info@metravel.by/test"),
  "cache": [
    base_cache_valid({"source": "s#m", "max_tokens": 500, "prompts": ["q"], "systems": ["sys"], "answers": ["a"]}, "s#m", [{"prompt": "q", "system": "sys"}], 500),
    base_cache_valid({"source": "s#m", "max_tokens": 500, "prompts": ["q"], "systems": ["sys"], "answers": ["a"]}, "s#m", [{"prompt": "q", "system": "other"}], 500),
    base_cache_valid({"source": "s#m", "max_tokens": 500, "prompts": ["q"], "systems": ["sys"], "answers": ["a"]}, "s#m", [{"prompt": "q", "system": "sys"}], 400),
    base_cache_valid({"source": "s#other", "max_tokens": 500, "prompts": ["q"], "systems": ["sys"], "answers": ["a"]}, "s#m", [{"prompt": "q", "system": "sys"}], 500),
    base_cache_valid({"source": "s#m", "prompts": ["q"], "answers": ["a"]}, "s#m", [{"prompt": "q", "system": "sys"}], 500),
  ],
}))
`);
    expect(out).toEqual({
      refusal: true,
      refusal_en: true,
      refusal_then_recipe: false,
      rag_card: true,
      rag_site_url_not_in_cards: false,
      no_material_admitted: true,
      no_material_admitted_other_order: true,
      no_material_silent: false,
      praise_is_not_refusal: false,
      real_refusal: true,
      bare_site: ['https://metravel.by/travels/vydumka'],
      bare_www: ['https://www.booking.com'],
      bold_url: ['https://metravel.by/travels/krakow'],
      email: [],
      // тот же источник, подсказки, системные промпты и max_tokens — иначе база генерируется заново (и старый base.json без этих полей)
      cache: [true, false, false, false, false],
    });
  });

  it('eval.py: неизвестный expect — ошибка, а не молчаливое «answer»', () => {
    const dir = makeTempDir('ai-train-expect-', { root: path.join(process.cwd(), '.codex-temp') });
    try {
      const file = path.join(dir, 'typo.jsonl');
      fs.writeFileSync(file, JSON.stringify({ id: 't1', group: 'g', expect: 'anwser', prompt: 'Что посмотреть?' }) + '\n');
      const load = runCli('python3', ['-I', '-c', 'import sys, pathlib\nsys.path.insert(0, sys.argv[1])\nimport eval as e\ne.load_prompts([pathlib.Path(sys.argv[2])])', DIR, file]);
      expect(load.status).not.toBe(0);
      expect(load.stderr).toContain("unknown expect 'anwser'");
      const direct = runCli('python3', ['-I', '-c', 'import sys\nsys.path.insert(0, sys.argv[1])\nimport eval as e\ne.verdict({"id": "t1", "expect": "anwser"}, e.check("ответ", set()), "ответ")', DIR]);
      expect(direct.status).not.toBe(0);
      expect(direct.stderr).toContain("unknown expect 'anwser'");
      // все подсказки репозитория проходят загрузку
      const real = runCli('python3', ['-I', '-c', 'import sys, pathlib\nsys.path.insert(0, sys.argv[1])\nimport eval as e\nprint(len(e.load_prompts(sorted((pathlib.Path(sys.argv[1]) / "eval_prompts").glob("*.jsonl")))))', DIR]);
      expect(real.stderr).toBe('');
      expect(Number(real.stdout)).toBeGreaterThanOrEqual(140);
    } finally {
      removeDir(dir);
    }
  });

  // #3267: срез оценки фильтра карты заморожен — набор не учит его вопросы, а каждый случай проверяем.
  it('osm_intents: вопросы eval_prompts/osm_intents.jsonl не попадают в набор', () => {
    const out = py(`
import json, random
from sets import osm_intents as o
held = o.held_out_prompts()
rows = [json.loads(line) for line in o.EVAL_PROMPTS.read_text(encoding="utf-8").splitlines() if line.strip()]
question = rows[0]["prompt"].split("«", 1)[1].rsplit("»", 1)[0]
real = o.intent_sample
calls = {"n": 0}
def fake(rng, lang, centres):
    calls["n"] += 1
    if calls["n"] == 2:
        return question.upper() + " ", {"categories": ["viewpoints"], "radius_km": 25, "center": {"name": "Несвиж"}}, "wd:Q1"
    return real(rng, lang, centres)
o.intent_sample = fake
o.load_pois = lambda root: []
o.load_centres = lambda root, pois, per: {"BY": [{"key": "wd:Q2", "ru": "Лида", "be": "Ліда", "pl": "Lida"}], "PL": [{"key": "wd:Q3", "ru": "Гданьск", "be": "Гданьск", "pl": "Gdańsk"}]}
records = o.build({"seed": 1, "sources": None}, {"intents": 40, "describe": 0})
users = [r["messages"][1]["content"] for r in records]
print(json.dumps({
  "cases": len(rows), "held": len(held), "langs": sorted({r["lang"] for r in rows}),
  "built": len(records) > 20, "leaked": sum(1 for u in users if o.norm_question(u) in held),
  "with_reject": sum(1 for r in rows if r.get("reject")),
  "constraints": {c: sorted({r["lang"] for r in rows if any(c in a and "true" in a for a in r["accept"])}) for c in o.CONSTRAINTS},
}))
`);
    expect(out.cases).toBeGreaterThanOrEqual(40);
    expect(out.held).toBe(out.cases);
    expect(out.langs).toEqual(['be', 'pl', 'ru']);
    expect(out.built).toBe(true);
    expect(out.leaked).toBe(0);
    expect(out.with_reject).toBeGreaterThanOrEqual(30);
    // Каждое ограничение — на русском и хотя бы на одном другом языке.
    for (const langs of Object.values(out.constraints as Record<string, string[]>)) {
      expect(langs).toContain('ru');
      expect(langs.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('osm descriptions use supplied country and tags without invented access, timing or weather claims', () => {
    const out = py(`
import json
from sets.osm_intents import describe_answer, tags_prompt
peak = {"country": "BY", "tags": {"name": "Учебная вершина", "natural": "peak", "ele": "250"}}
castle = {"country": "PL", "tags": {"name": "Zamek", "historic": "castle", "fee": "no", "wheelchair": "yes"}}
bare = {"country": "BY", "tags": {"name": "Точка", "tourism": "viewpoint"}}
print(json.dumps({
    "peak_prompt": tags_prompt(peak["tags"], peak["country"]),
    "peak": describe_answer(peak),
    "castle_prompt": tags_prompt(castle["tags"], castle["country"]),
    "castle": describe_answer(castle),
    "bare": describe_answer(bare),
}, ensure_ascii=False))
`);
    expect(out.peak_prompt).toContain('Страна по границе выборки: Беларусь.');
    expect(out.peak).toBe('Учебная вершина — вершина в Беларуси. Высота — 250 м над уровнем моря.');
    expect(out.castle_prompt).toContain('Страна по границе выборки: Польша.');
    expect(out.castle).toBe('Zamek — замок в Польше. Вход свободный. Доступно для коляски.');
    expect(out.bare).toBe('Точка — смотровая площадка в Беларуси.');
    expect([out.peak, out.castle, out.bare].join(' ')).not.toMatch(/по силам большинству|полчаса|свет для фото|без спешки/);
  });
});

// #3278: в edition 1 ограничение всегда стояло через запятую в конце вопроса (130 из 130 примеров train v7),
// и модель теряла его в любом другом месте.
describe('ai-train osm_intents edition 2 (#3278 v8)', () => {
  it('ограничение стоит в разных местах вопроса, пар категорий больше, ответ остаётся фильтром по схеме', () => {
    const out = py(`
import json, re
from sets import osm_intents as o
o.load_pois = lambda root: []
o.load_centres = lambda root, pois, per: {"BY": [{"key": "wd:Q2", "ru": "Лида", "be": "Ліда", "pl": "Lida"}, {"key": "wd:Q4", "ru": "Гомель", "be": "Гомель", "pl": "Homel"}],
                                         "PL": [{"key": "wd:Q3", "ru": "Гданьск", "be": "Гданьск", "pl": "Gdańsk"}, {"key": "wd:Q5", "ru": "Краков", "be": "Кракаў", "pl": "Kraków"}]}
def stats(edition):
    rows = o.build({"seed": 7, "sources": None}, {"intents": 1500, "describe": 0, "edition": edition, "lang_share": {"be": 0.2, "pl": 0.2}})
    held = o.held_out_prompts()
    cons = tail = pairs = bad = leaked = 0
    layouts = {"mid": 0, "noun": 0, "lead": 0, "sentence": 0}
    for r in rows:
        user, answer = r["messages"][1]["content"], json.loads(r["messages"][2]["content"])
        q = user.split("«", 1)[1].rsplit("»", 1)[0]
        bad += bool(o.validate_filter(answer))
        leaked += o.norm_question(user) in held
        pairs += len(answer["categories"]) == 2
        if answer.get("constraints"):
            cons += 1
            tail += bool(re.search(r", [^,.?]+[?.]?$", q))
            layouts["sentence"] += bool(re.search(r"[.?] [А-ЯA-ZЁІŁŚŻ]", q))
            layouts["lead"] += bool(re.match(r"(?:Бесплатные|Бясплатныя|Darmowe|Bezpłatne) ", q))
            layouts["noun"] += bool(re.search(r"парковка для кемпера|стоянка для автодома|место для кемпера|стаянка для кемпера|паркоўка для аўтадома|parking dla kampera|miejsce na kampera", q))
            layouts["mid"] += bool(re.search(r"(?:без платы за вход|для детей|dla dzieci|для дзяцей|bez biletu) (?:в |не |около|рядом|недалеко|возле|по |у |каля|недалёка|па |w |do |niedaleko|gdzie)", q))
    return {"n": len(rows), "bad": bad, "leaked": leaked, "pair_share": round(pairs / len(rows), 2), "cons": cons, "tail_share": round(tail / max(cons, 1), 2), "layouts": layouts}
print(json.dumps({"e1": stats(1), "e2": stats(2)}))
`);
    expect(out.e1.tail_share).toBe(1);
    expect(out.e1.layouts).toEqual({ mid: 0, noun: 0, lead: 0, sentence: 0 });
    expect(out.e2.bad).toBe(0);
    expect(out.e2.leaked).toBe(0);
    expect(out.e2.tail_share).toBeLessThan(0.6);
    for (const count of Object.values(out.e2.layouts as Record<string, number>)) expect(count).toBeGreaterThan(10);
    expect(out.e2.pair_share).toBeGreaterThan(out.e1.pair_share + 0.05);
  });

  it('неизвестная edition — ошибка сборки', () => {
    const res = runCli('python3', ['-I', '-c', `import sys\nsys.path.insert(0, sys.argv[1])\nfrom sets import osm_intents as o\no.build({"seed": 1, "sources": None}, {"edition": 3})`, DIR]);
    expect(res.status).not.toBe(0);
    expect(res.stderr).toContain('edition must be 1 or 2');
  });
});
