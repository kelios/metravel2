#!/usr/bin/env python3
"""Механический линт пакета поста Instagram @metravelby.

Проверяет то, что можно проверить без глаз, до Visual QA:
  V*  — шаблоны голоса (служебная речь, клише, «Юля прошла» в третьем лице);
        регулярки читаются из блока lint-patterns в docs/INSTAGRAM_CONTENT_SPEC.md,
        отдельной копии правил здесь нет;
  F3  — первая строка подписи;
  F4  — длина подписи через len() (не `wc -m`: при пустой локали он считает байты);
  F5  — не больше 2 эмодзи;
  F8  — 3–5 хештегов, все в конце подписи;
  F10 — ответы на задания квеста не раскрыты (если в пакете есть quest_id или адрес квеста и
        локальный scripts/*-quest-data.js с answer_pattern — его читает node); совпадение, которое не
        ответ, снимается строкой `lint-allow: F10 <слово> — <причина>` в package.md;
  F11 — reel.mp4 длится 15–40 с и несёт аудиопоток (если есть ffprobe): тихий Reel — находка,
        трек Epidemic Sound агент скачивает сам (раздел 27); тишина, заказанная владельцем,
        снимается строкой `lint-allow: F11 тишина — <чьё решение и когда>` в package.md;
  F2  — титры Reel из spec.json держатся ≥ 1,5 с + 0,3 с на слово и не длиннее ~7 слов;
        слайд карусели (spec.json) — не больше 4 предложений и 50 слов тела (без кикера и
        заголовка): длиннее — текстовая стена, которую с телефона не читают (замер 18.10.2026:
        принятые слайды 28–49 слов, отвергнутые редактором 60–82);
  V3  — при строке «Состав поездки: мы …» глагол похода в единственном числе («я прошла»,
        «стартовала», «ночевала») на слайдах, в подписи и story.md — поход вдвоём рассказан от
        «я»; снимается строкой `lint-allow: V3 <слово> — <причина>` (Юля реально была одна в
        этом эпизоде); глаголы рассказа («рассказываю», «покажу») и чувства («я давно хотела»)
        не ловятся — рассказчик по V3 Юля;
  R27 — rights.json связывает конечные файлы и локальные доказательства прав через SHA-256;
  B1  — запрещённые по Беларуси источники, общий список
        scripts/content-source-denylist.json (тот же, что у scan-content-sources.js);
  R18 — в package.md чек-лист раздела 18: строка на каждый номер V1–V11 и F1–F13
        с отметкой («- V1 да: …», «V10 не применяется»);
  R16 — в package.md есть строка «Состав поездки: …» (кто ходил — «мы с Сергеем», «я одна»,
        с Тимом/Джери; раздел 25) — голос «я/мы» в тексте сверяется с ней глазами.

Текст слайдов берётся из spec.json (make-carousel.py, вместе с name точек карты) и
slides.txt (слайды другого скрипта или титры Reel: один слайд — блок через пустую строку).

  python3 scripts/instagram/lint-package.py .codex-temp/instagram/posts/<пакет>
  python3 scripts/instagram/lint-package.py --json <пакет>
  python3 scripts/instagram/lint-package.py --quest-data 'scripts/x-quest-data.js' <пакет>

Выход 0 — находок нет, 1 — есть находки, 2 — ошибка вызова.
"""
import glob
import json
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SPEC_PATH = os.path.join(ROOT, 'docs', 'INSTAGRAM_CONTENT_SPEC.md')
DENYLIST_PATH = os.path.join(ROOT, 'scripts', 'content-source-denylist.json')
QUEST_DATA_GLOB = os.path.join(ROOT, 'scripts', '*-quest-data.js')

CAPTION_MAX = 1800
EMOJI_MAX = 2
HASHTAGS_MIN, HASHTAGS_MAX = 3, 5
REEL_MIN_S, REEL_MAX_S = 15, 40
SLIDE_TEXT_KEYS = ('kicker', 'title', 'subtitle', 'text', 'body', 'note', 'items', 'points')
SOURCE_FILES = ('brief.md', 'sources.md', 'package.md', 'article-edits.md')

EMOJI_CHAR = ('[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F000-\U0001F2FF\U00002B00-\U00002BFF'
              '\u231A\u231B\u23E9-\u23F3\u23F8-\u23FA]')
# Модификатор тона кожи и VS16 — часть того же эмодзи, ZWJ-последовательность — одно эмодзи.
EMOJI_TAIL = '[\U0001F3FB-\U0001F3FF]?\uFE0F?'
EMOJI_RE = re.compile('(?:[\U0001F1E6-\U0001F1FF]{2}|[0-9#*]\uFE0F?\u20E3|%s%s(?:\u200D%s%s)*)' % (
    EMOJI_CHAR, EMOJI_TAIL, EMOJI_CHAR, EMOJI_TAIL))
HASHTAG_RE = re.compile(r'(?<![\w#])#[\w]+', re.U)
QUEST_ID_RE = re.compile(r'(?:quest_id\s*[=:]\s*[`"\']?|by-quest-id/)([a-z0-9][a-z0-9-]+)', re.I)
# Адрес квеста по F7 — metravel.by/quests/<city_id>/<quest_id>: квест в пакете находится и без строки quest_id.
QUEST_URL_RE = re.compile(r'\bquests/\d+/([a-z0-9][a-z0-9-]+)', re.I)
ALLOW_RE = re.compile(r'^\s*lint-allow:\s*(F10|F11|V3)\s+(.+?)\s+—\s+\S', re.M)
SLIDE_BODY_KEYS = ('subtitle', 'text', 'body', 'note', 'items', 'points')
SLIDE_WORDS_MAX = 50
SLIDE_SENTENCES_MAX = 4
SENTENCE_END_RE = re.compile(r'[.!?…]+(?:\s+|$)')
# Состав «мы …» без пометки соло: тогда поход, рассказанный от «я», — находка V3.
TRIP_PARTY_WE_RE = re.compile(r'^\s*[-*]?\s*\**Состав поездки\**\s*:\s*\**\s*мы\b', re.M | re.I)
TRIP_PARTY_SOLO_RE = re.compile(r'\b(?:я\s+одна|одна|соло|без\s+Серге)', re.I)
# Глаголы похода/поездки в 1-м лице единственного числа (женский род прошедшего времени);
# глаголы рассказа и чувств сюда не входят.
SOLO_TRIP_VERB_RE = re.compile(
    r'(?<![\w-])(?:сходила|ходила|прошла|пошла|стартовала|ездила|съездила|поехала|приехала|доехала|'
    r'добралась|ночевала|заночевала|зашла|заходила|поднялась|спустилась|гуляла|погуляла|обошла|'
    r'объехала|проехала|прилетела|улетела|долетела|доплыла|припарковалась)(?![\w-])', re.I | re.U)
CHECKLIST_ITEMS = ['V%d' % n for n in range(1, 12)] + ['F%d' % n for n in range(1, 14)]
TRIP_PARTY_RE = re.compile(r'^\s*[-*]?\s*\**Состав поездки\**\s*:\s*\S', re.M | re.I)
# Пункт чек-листа: строка списка «- V1 …» или номер после «·», «;», «.» с отметкой словом, галочкой
# или прочерком — «V2 да (…) · V3 да», «F4 да — 1750 знаков», «V10 неприменимо», «F10 n/a», «F10 — ·».
# Диапазон «V1–V11» и «V2/V3» пунктом не считаются.
CHECKLIST_ITEM_RE = re.compile(
    r'^\s*[-*]\s*\**([VF]\d{1,2})\**(?![\d/–-])'
    r'|(?:^\s*|[·;]\s*|\.\s+)\**([VF]\d{1,2})\**'
    r'(?=\s*[:—–-]?\s*(?:[а-яёА-ЯЁ✓✔]|n/a)|\s*[—–-]\s*(?:[(·;,]|$))', re.M)
BAD_FIRST_LINE_RE = re.compile(r'^\s*(?:(?:всем\s+)?привет\b|итак\b|#|\d{1,2}[./]\d{1,2})', re.I)


def load_spec_patterns(spec_path=SPEC_PATH):
    """Блок ```lint-patterns в ТЗ: строки `ПРАВИЛО :: регулярка :: пояснение`."""
    with open(spec_path, encoding='utf-8') as fh:
        text = fh.read()
    block = re.search(r'```lint-patterns\n(.*?)\n```', text, re.S)
    if not block:
        raise ValueError('в %s нет блока ```lint-patterns' % spec_path)
    patterns = []
    for raw in block.group(1).splitlines():
        line = raw.strip()
        if not line or line.startswith('//'):
            continue
        parts = [part.strip() for part in line.split(' :: ', 2)]
        if len(parts) != 3:
            raise ValueError('строка lint-patterns не в формате `правило :: регулярка :: пояснение`: %s' % line)
        rule, regex, label = parts
        patterns.append({'rule': rule, 're': re.compile(regex, re.I | re.U), 'label': label})
    return patterns


def load_denylist(path=DENYLIST_PATH):
    with open(path, encoding='utf-8') as fh:
        data = json.load(fh)
    return [{'rule': 'B1', 're': re.compile(p['regex'], re.I | re.U),
             'label': 'запрещённый по Беларуси источник ' + p['label']} for p in data['patterns']]


def read(path):
    with open(path, encoding='utf-8-sig') as fh:
        return fh.read()


def slide_lines(package):
    """[(источник, номер строки, текст)] — текст, который лежит на слайдах."""
    spec = os.path.join(package, 'spec.json')
    plain = os.path.join(package, 'slides.txt')
    out = []
    if os.path.exists(spec):
        data = json.loads(read(spec))
        for index, slide in enumerate(data.get('slides', []) if isinstance(data, dict) else [], 1):
            for key in SLIDE_TEXT_KEYS:
                value = slide.get(key)
                for item in (value if isinstance(value, list) else [value]):
                    if isinstance(item, dict):  # точка карты: на слайде печатается её name
                        item = item.get('name')
                    if isinstance(item, str) and item.strip():
                        out.append(('spec.json слайд %02d' % index, 0, item))
        for key in ('segments', 'texts'):  # титры Reel из spec монтажа: {"text": …} или строки
            for index, item in enumerate(data.get(key) or [], 1) if isinstance(data, dict) else []:
                text = item.get('text') if isinstance(item, dict) else item
                if isinstance(text, str) and text.strip():
                    out.append(('spec.json титр %02d' % index, 0, text))
    if os.path.exists(plain):  # титры Reel или слайды другого скрипта — рядом со spec.json тоже
        for number, line in enumerate(read(plain).splitlines(), 1):
            if line.strip():
                out.append(('slides.txt', number, line))
    return out


def scan(lines, patterns):
    hits = []
    for source, number, text in lines:
        for p in patterns:
            for m in p['re'].finditer(text):
                hits.append(finding(source, number, p['rule'], '%s: «%s»' % (p['label'], m.group(0))))
    return hits


def finding(source, line, rule, message):
    return {'source': source, 'line': line, 'rule': rule, 'message': message}


def check_caption(caption):
    hits = []
    text = caption.strip()
    lines = text.split('\n')
    if BAD_FIRST_LINE_RE.search(lines[0]):
        hits.append(finding('caption.txt', 1, 'F3', 'первая строка начинается не с места: «%s»' % lines[0][:40]))
    if len(text) > CAPTION_MAX:
        hits.append(finding('caption.txt', 0, 'F4', 'подпись %d знаков, предел %d' % (len(text), CAPTION_MAX)))
    emoji = EMOJI_RE.findall(text)
    if len(emoji) > EMOJI_MAX:
        hits.append(finding('caption.txt', 0, 'F5', 'эмодзи %d (%s), предел %d' % (len(emoji), ' '.join(emoji), EMOJI_MAX)))
    tags = HASHTAG_RE.findall(text)
    if not HASHTAGS_MIN <= len(tags) <= HASHTAGS_MAX:
        hits.append(finding('caption.txt', 0, 'F8', 'хештегов %d, нужно %d–%d' % (len(tags), HASHTAGS_MIN, HASHTAGS_MAX)))
    # Хештеги — только последним абзацем: всё выше пустой строки перед ним — текст.
    tail_start = len(lines)
    while tail_start > 0 and lines[tail_start - 1].strip():
        tail_start -= 1
    for number, line in enumerate(lines[:tail_start], 1):
        if HASHTAG_RE.search(line):
            hits.append(finding('caption.txt', number, 'F8', 'хештег не в конце подписи: «%s»' % line[:50]))
    return hits


def quest_ids(package):
    ids = set()
    for name in SOURCE_FILES + ('caption.txt',):
        path = os.path.join(package, name)
        if os.path.exists(path):
            text = read(path)
            ids.update(m.lower() for m in QUEST_ID_RE.findall(text) + QUEST_URL_RE.findall(text))
    return ids


# Data-файл квеста — JS-модуль (`value: JSON.stringify([...])`, многострочные объекты, кавычки
# обоих видов), поэтому ответы берёт сам node, а не регулярка по исходнику.
NODE_ANSWERS_JS = r'''
const [file, id] = process.argv.slice(1);
const out = [];
const take = (p) => {
  if (!p || typeof p !== 'object') return;
  if (p.type === 'exact') out.push(p.value);
  if (p.type === 'exact_any') out.push(...(Array.isArray(p.value) ? p.value : JSON.parse(p.value)));
};
const walk = (node, inside) => {
  if (Array.isArray(node)) return node.forEach((n) => walk(n, inside));
  if (!node || typeof node !== 'object') return;
  const here = inside || node.quest_id === id;
  if (here && node.answer_pattern) take(node.answer_pattern);
  Object.values(node).forEach((n) => walk(n, here));
};
walk(require(file), false);
process.stdout.write(JSON.stringify(out.filter((v) => typeof v === 'string')));
'''


def normalize_answer_text(text):
    """Сравнение без регистра, «ё» и дефисов: в data-файлах ответы записаны «огнем», «сине зеленый»."""
    return re.sub(r'[\s\-‐‑]+', ' ', text.lower().replace('ё', 'е')).strip()


def quest_answers(quest_id, data_glob=QUEST_DATA_GLOB):
    """(ответы exact/exact_any, ошибки) из локального data-файла квеста; пусто, если файла нет."""
    marker = re.compile(r'quest_id[\'"]?\s*:\s*[\'"]%s[\'"]' % re.escape(quest_id))
    answers, errors = set(), []
    for path in sorted(glob.glob(data_glob)):
        if not marker.search(read(path)):
            continue
        if not shutil.which('node'):
            errors.append('node не найден — ответы квеста %s не проверены' % quest_id)
            continue
        run = subprocess.run(['node', '-e', NODE_ANSWERS_JS, os.path.abspath(path), quest_id],
                             capture_output=True, text=True, check=False)
        if run.returncode != 0:
            errors.append('не прочитан %s: %s' % (os.path.basename(path), (run.stderr.strip().splitlines() or ['?'])[-1]))
            continue
        answers.update(normalize_answer_text(v) for v in json.loads(run.stdout or '[]'))
    # Короткие числа и однобуквенные ответы встречаются в любом тексте — шум, а не утечка.
    return {a for a in answers if len(a) >= 4 or (a.isdigit() and len(a) >= 3)}, errors


def allowed_answers(package):
    """`lint-allow: F10 <слово> — <причина>` в package.md: совпадение, которое не ответ."""
    path = os.path.join(package, 'package.md')
    if not os.path.exists(path):
        return set()
    return {normalize_answer_text(word.strip('«»"\' ')) for rule, word in ALLOW_RE.findall(read(path)) if rule == 'F10'}


def lint_allows(package, rule):
    """Слова из строк `lint-allow: <rule> <слово> — <причина>` в package.md."""
    path = os.path.join(package, 'package.md')
    if not os.path.exists(path):
        return set()
    return {word.strip('«»"\' ').lower() for found, word in ALLOW_RE.findall(read(path)) if found == rule}


def trip_party_line(package):
    path = os.path.join(package, 'package.md')
    if not os.path.exists(path):
        return ''
    m = TRIP_PARTY_RE.search(read(path))
    if not m:
        return ''
    text = read(path)
    return text[m.start():text.find('\n', m.start()) if text.find('\n', m.start()) != -1 else len(text)]


def check_voice_party(package, lines):
    """V3: состав «мы …» (без «одна»/«без Сергея»), а поход рассказан от «я» — «я прошла»,
    «стартовала», «ночевала» на слайде, в подписи или story.md."""
    party = trip_party_line(package)
    if not party or not TRIP_PARTY_WE_RE.search(party) or TRIP_PARTY_SOLO_RE.search(party):
        return []
    allowed = lint_allows(package, 'V3')
    hits = []
    for source, number, text in lines:
        for m in SOLO_TRIP_VERB_RE.finditer(text):
            if m.group(0).lower() in allowed:
                continue
            hits.append(finding(source, number, 'V3',
                                'поход вдвоём («%s») рассказан от «я»: «%s» — переписать от «мы» или '
                                'lint-allow: V3 %s — <почему Юля была одна>' % (
                                    party.split(':', 1)[1].strip().strip('*')[:40], m.group(0), m.group(0))))
    return hits


def check_slide_density(package):
    """F2 для карусели: слайд spec.json — не больше SLIDE_SENTENCES_MAX предложений и
    SLIDE_WORDS_MAX слов тела (subtitle/text/body/note/items/points; кикер и заголовок не считаются)."""
    spec = os.path.join(package, 'spec.json')
    if not os.path.exists(spec):
        return []
    data = json.loads(read(spec))
    hits = []
    for index, slide in enumerate(data.get('slides', []) if isinstance(data, dict) else [], 1):
        parts = []
        for key in SLIDE_BODY_KEYS:
            value = slide.get(key)
            for item in (value if isinstance(value, list) else [value]):
                if isinstance(item, dict):
                    item = item.get('name')
                if isinstance(item, str) and item.strip():
                    parts.append(item.strip())
        body = ' '.join(parts)
        if not body:
            continue
        words = len(body.split())
        sentences = len([part for part in SENTENCE_END_RE.split(body) if part.strip()])
        where = 'spec.json слайд %02d' % index
        if words > SLIDE_WORDS_MAX:
            hits.append(finding(where, 0, 'F2', '%d слов на слайде, предел %d — разнести на два слайда или '
                                'убрать лишнее в подпись' % (words, SLIDE_WORDS_MAX)))
        if sentences > SLIDE_SENTENCES_MAX:
            hits.append(finding(where, 0, 'F2', '%d предложений на слайде, предел %d' % (sentences, SLIDE_SENTENCES_MAX)))
    return hits


def check_quest_answers(package, lines, data_glob=QUEST_DATA_GLOB):
    hits = []
    allowed = allowed_answers(package)
    for quest_id in sorted(quest_ids(package)):
        answers, errors = quest_answers(quest_id, data_glob)
        hits += [finding('quest-data', 0, 'F10', message) for message in errors]
        answers -= allowed
        for source, number, text in lines:
            low = normalize_answer_text(text)
            for answer in sorted(answers):
                if re.search(r'(?<!\w)%s(?!\w)' % re.escape(answer), low):
                    hits.append(finding(source, number, 'F10', 'ответ задания квеста %s: «%s»' % (quest_id, answer)))
    return hits


TITLE_MIN_S, TITLE_PER_WORD_S, TITLE_MAX_WORDS = 1.5, 0.3, 7


def check_checklist(package):
    """Раздел 18: creator проходит V1–V11 и F1–F13 строкой на номер в package.md;
    раздел 25: строка «Состав поездки: …» (R16)."""
    path = os.path.join(package, 'package.md')
    if not os.path.exists(path):
        return [finding('package.md', 0, 'R18', 'нет package.md с чек-листом V1–V11, F1–F13')]
    text = read(path)
    hits = []
    if not TRIP_PARTY_RE.search(text):
        hits.append(finding('package.md', 0, 'R16', 'нет строки «Состав поездки: …» (кто ходил — раздел 25)'))
    present = {a or b for a, b in CHECKLIST_ITEM_RE.findall(text)}
    missing = [item for item in CHECKLIST_ITEMS if item not in present]
    if missing:
        hits.append(finding('package.md', 0, 'R18', 'в чек-листе нет строк: %s' % ', '.join(missing)))
    return hits


def reel_title_items(data):
    """[(текст, секунд на экране)] из spec монтажа: dict с segments/texts или список сегментов;
    время — `dur`, `t0`/`t1` или строка `t: "0.0-4.0"`."""
    if isinstance(data, list):
        data = {'segments': data}
    if not isinstance(data, dict):
        return []
    items = []
    for item in (data.get('segments') or []) + (data.get('texts') or []):
        if not isinstance(item, dict) or not isinstance(item.get('text'), str):
            continue
        span = re.match(r'^\s*([\d.]+)\s*[-–]\s*([\d.]+)\s*$', str(item.get('t', '')))
        if item.get('dur'):
            items.append((item['text'], float(item['dur'])))
        elif 't0' in item and 't1' in item:
            items.append((item['text'], float(item['t1']) - float(item['t0'])))
        elif span:
            items.append((item['text'], float(span.group(2)) - float(span.group(1))))
    return items


def check_reel_titles(package):
    """F2 для Reel (бриф шаг 5): титр держится ≥ 1,5 с + 0,3 с на слово, не длиннее ~7 слов.
    Spec монтажа — spec.json в пакете или в build/; без тайминга слова считаются по slides.txt."""
    items = []
    for name in ('spec.json', os.path.join('build', 'spec.json')):
        path = os.path.join(package, name)
        if os.path.exists(path) and not items:
            try:
                items = reel_title_items(json.loads(read(path)))
            except ValueError:
                pass
    plain = os.path.join(package, 'slides.txt')
    if not items and os.path.exists(os.path.join(package, 'reel.mp4')):
        if not os.path.exists(plain):
            return [finding('reel.mp4', 0, 'F2', 'титры Reel не найдены: нет spec.json (segments/texts с dur, '
                                                 't0/t1 или t) и slides.txt — линт их не проверил')]
        items = [(block.strip(), None) for block in re.split(r'\n\s*\n', read(plain)) if block.strip()]
    hits = []
    merged = []  # один титр через несколько клипов подряд — одно появление на экране
    for text, shown in items:
        if merged and merged[-1][0] == text and shown is not None:
            merged[-1] = (text, merged[-1][1] + shown)
        else:
            merged.append((text, shown))
    for index, (text, shown) in enumerate(merged, 1):
        words = len(text.split())
        need = TITLE_MIN_S + TITLE_PER_WORD_S * words
        if shown is not None and shown + 1e-6 < need:
            hits.append(finding('spec.json титр %02d' % index, 0, 'F2',
                                'титр «%s» держится %.1f с, нужно ≥ %.1f с' % (text.replace('\n', ' / '), shown, need)))
        if words > TITLE_MAX_WORDS:
            hits.append(finding('spec.json титр %02d' % index, 0, 'F2',
                                'титр «%s» — %d слов, предел ~%d' % (text.replace('\n', ' / '), words, TITLE_MAX_WORDS)))
    return hits


def check_reel(package):
    reel = os.path.join(package, 'reel.mp4')
    if not os.path.exists(reel) or not shutil.which('ffprobe'):
        return []
    probe = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type:format=duration', '-of', 'json', reel],
        capture_output=True, text=True, check=False)
    if probe.returncode != 0:
        return [finding('reel.mp4', 0, 'F11', 'ffprobe не прочитал файл')]
    data = json.loads(probe.stdout or '{}')
    hits = []
    try:
        duration = float(data.get('format', {}).get('duration') or 0)
    except ValueError:  # ffprobe отдаёт «N/A», если длина не читается
        duration = 0.0
    if not REEL_MIN_S <= duration <= REEL_MAX_S:
        hits.append(finding('reel.mp4', 0, 'F11', 'длина %.1f с, нужно %d–%d' % (duration, REEL_MIN_S, REEL_MAX_S)))
    has_audio = any(s.get('codec_type') == 'audio' for s in data.get('streams', []))
    if not has_audio and 'тишина' not in lint_allows(package, 'F11'):
        hits.append(finding('reel.mp4', 0, 'F11',
                            'Reel без звука: скачать трек Epidemic Sound самому и вшить (раздел 27); '
                            'тишина по решению владельца — lint-allow: F11 тишина — <чьё решение и когда>'))
    return hits


def check_rights(package):
    if not shutil.which('node'):
        return [finding('rights.json', 0, 'R27', 'node не найден — права не проверены')]
    run = subprocess.run(['node', os.path.join(ROOT, 'scripts', 'lib', 'instagramRights.js'),
                          os.path.join(os.path.abspath(package), 'rights.json')],
                         capture_output=True, text=True, check=False)
    if run.returncode != 0:
        return [finding('rights.json', 0, 'R27', run.stderr.strip() or 'проверка прав не прошла')]
    return []


def lint_package(package, spec_path=SPEC_PATH, denylist_path=DENYLIST_PATH, data_glob=QUEST_DATA_GLOB):
    caption_path = os.path.join(package, 'caption.txt')
    if not os.path.exists(caption_path):
        return [finding('caption.txt', 0, 'F0', 'нет caption.txt')]
    voice = load_spec_patterns(spec_path)
    belarus = load_denylist(denylist_path)
    caption = read(caption_path)
    caption_lines = [('caption.txt', n, line) for n, line in enumerate(caption.splitlines(), 1)]
    public = caption_lines + slide_lines(package)
    sources = []
    for name in SOURCE_FILES:
        path = os.path.join(package, name)
        if os.path.exists(path):
            sources += [(name, n, line) for n, line in enumerate(read(path).splitlines(), 1)]
    story_path = os.path.join(package, 'story.md')
    story = [('story.md', n, line) for n, line in enumerate(read(story_path).splitlines(), 1)] if os.path.exists(story_path) else []
    hits = check_caption(caption)
    if not os.path.exists(story_path):
        # Шаблон 18.1, проверка 4 (владелец 26.10.2026 о слайде катка: «что даёт эта информация
        # пользователю, где наша история?»): пост без story.md собран из описаний кадров.
        hits.append(finding('story.md', 0, 'S1', 'нет story.md: пост собран без нашей истории (шаблон 18.1, проверка 4)'))
    hits += scan(public, voice)
    hits += check_voice_party(package, public + story)
    hits += check_slide_density(package)
    hits += scan(public + sources, belarus)
    hits += check_quest_answers(package, public, data_glob)
    hits += check_reel(package)
    hits += check_reel_titles(package)
    hits += check_checklist(package)
    hits += check_rights(package)
    return hits


def main(argv):
    args = list(argv)
    as_json = '--json' in args
    data_glob = QUEST_DATA_GLOB
    if '--quest-data' in args:
        index = args.index('--quest-data')
        data_glob = args[index + 1] if index + 1 < len(args) else ''
        del args[index:index + 2]
    targets = [a for a in args if a != '--json']
    if len(targets) != 1 or not os.path.isdir(targets[0]) or not data_glob:
        sys.stderr.write('usage: lint-package.py [--json] [--quest-data <glob>] <папка пакета>\n')
        return 2
    try:
        hits = lint_package(targets[0], data_glob=data_glob)
    except (OSError, ValueError, re.error) as error:  # битый spec.json, блок lint-patterns, denylist
        sys.stderr.write('lint-package.py: %s\n' % error)
        return 2
    if as_json:
        print(json.dumps(hits, ensure_ascii=False, indent=2))
    else:
        for h in hits:
            where = h['source'] + (':%d' % h['line'] if h['line'] else '')
            print('%s [%s] %s' % (where, h['rule'], h['message']))
        print('%s: %d находок' % (os.path.basename(os.path.normpath(targets[0])), len(hits)))
    return 1 if hits else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
