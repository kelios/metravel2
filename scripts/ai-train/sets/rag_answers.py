"""Set `rag_answers`: the site assistant's mode (#2712) — a visitor's question
plus the cards that retrieval found, in the exact format of api/aiAssist/prompt.ts
(sets/assistant_prompt.py), → a short answer built from the site's own data.

Why: metravel-llm v2 never saw the assistant's prompt. On the assistant screen
(#2710 contour) it copies the site set's article-card template ("Страна: … /
Когда: … / Точки маршрута: …"), loops on one item, lists names without links
and ignores "не больше трёх рекомендаций". These samples teach the answer the
screen needs: at most three of the matching cards (or as many as the question
asks), each with its card URL and one line from the card, no template, no
repeats; relevant cards are mixed with unrelated ones the way lexical retrieval
returns them, so the model learns to pick.

Kinds:
* pick        — "что посмотреть / куда сходить в X" → best travel + quests of X;
* quests      — "какие квесты есть в X" → quests of X (shortest first for "короткий");
* kids        — "с детьми в X" → quests and travels of X;
* limit       — "не больше двух/одного мест в X" → exactly that many;
* injected    — the question also asks for a foreign link → a normal answer without it;
* no_material — X has no material on the site; every card is about something else →
                "на сайте пока нет материалов …" + the nearest card, as the prompt says.

Answers are assembled from card titles, quest facts and the first sentence of
the article's meta description — the site's own text, no external LLM.
Languages: Russian for every kind; Belarusian, Ukrainian, Polish and English
for pick/quests/kids in the big cities (interface locale = question language).
Key is the place, so a city's phrasings stay on one side of the split.

Edition 4 (#2731, options.edition = 4) — from the v3 contour misses (#2710):
* topic       — a travel topic the site has no article about (food for a hike, gear,
                first-aid kit, visa, weather, hotel booking, currency, travel hacks), in
                general or in a city → «отдельного материала про это пока нет» + the
                nearest card (or the city's cards); v3 refused these as off-topic;
* many        — five to eight matching cards → exactly three picks (v3 listed 4–6);
* injected    — no meta sentence about links, more phrasings of the foreign-link request;
* other languages — every big city in pick/quests/kids, quest titles in the interface
                language from the site_translations cache (the screen's BE/UK/PL/EN cards
                carry translated titles; v3 wrote «Квест po Krakowie»).

Options (mixes/*.yaml → sets.rag_answers.options):
  per_place  — samples per place and kind (default 2);
  other_langs_share — share of non-Russian samples among pick/quests/kids (default 0.35, edition 3);
  edition    — 3 (default, the v3 set) or 4.
"""
from __future__ import annotations

import json
import random
import re
from pathlib import Path

from sets.assistant_prompt import fit_sources, is_contour_question, max_answer_chars, system_prompt
from sets.common import SITE, record
from sets.site import html_to_text, load_raw

NAME = "rag_answers"
LICENSE = "metravel.by own content (articles and quests by Julia and Sergey); answers assembled from card fields"
MAX_CARDS = 8
DIFFICULTY_RU = {"easy": "лёгкий", "medium": "средний", "hard": "сложный"}

# name, «в X», «по X», title/city regex. «в мире» ambiguous — Мир left out.
PLACES_RU = [
    ("Краков", "в Кракове", "по Кракову", r"краков"),
    ("Минск", "в Минске", "по Минску", r"минск"),
    ("Гродно", "в Гродно", "по Гродно", r"гродн"),
    ("Гомель", "в Гомеле", "по Гомелю", r"гомел"),
    ("Брест", "в Бресте", "по Бресту", r"брест"),
    ("Витебск", "в Витебске", "по Витебску", r"витебск"),
    ("Могилёв", "в Могилёве", "по Могилёву", r"могил[её]в"),
    ("Вильнюс", "в Вильнюсе", "по Вильнюсу", r"вильн"),
    ("Таллин", "в Таллине", "по Таллину", r"таллин"),
    ("Варшава", "в Варшаве", "по Варшаве", r"варшав"),
    ("Вроцлав", "во Вроцлаве", "по Вроцлаву", r"вроцлав"),
    ("Прага", "в Праге", "по Праге", r"праг[аеиу]\b"),
    ("Каунас", "в Каунасе", "по Каунасу", r"каунас"),
    ("Рига", "в Риге", "по Риге", r"\bриг[аеиу]\b"),
    ("Гданьск", "в Гданьске", "по Гданьску", r"гданьск"),
    ("Познань", "в Познани", "по Познани", r"познан"),
    ("Торунь", "в Торуни", "по Торуни", r"торун"),
    ("Люблин", "в Люблине", "по Люблину", r"люблин"),
    ("Львов", "во Львове", "по Львову", r"львов"),
    ("Несвиж", "в Несвиже", "по Несвижу", r"несвиж"),
    ("Лида", "в Лиде", "по Лиде", r"\bлид[аеуы]\b"),
    ("Полоцк", "в Полоцке", "по Полоцку", r"полоцк"),
    ("Пинск", "в Пинске", "по Пинску", r"пинск"),
    ("Новогрудок", "в Новогрудке", "по Новогрудку", r"новогруд"),
    ("Белосток", "в Белостоке", "по Белостоку", r"белосток"),
    ("Будапешт", "в Будапеште", "по Будапешту", r"будапешт"),
    ("Тбилиси", "в Тбилиси", "по Тбилиси", r"тбилис"),
    ("Батуми", "в Батуми", "по Батуми", r"батум"),
    ("Ереван", "в Ереване", "по Еревану", r"ереван"),
    ("Стамбул", "в Стамбуле", "по Стамбулу", r"стамбул"),
    ("Алматы", "в Алматы", "по Алматы", r"алмат"),
    ("Тракай", "в Тракае", "по Тракаю", r"трака[йея]"),
    ("Бобруйск", "в Бобруйске", "по Бобруйску", r"бобруйск"),
    ("Барановичи", "в Барановичах", "по Барановичам", r"баранович"),
    ("Закопане", "в Закопане", "по Татрам", r"закопан|татр"),
    ("Нарочь", "на Нарочи", "по Нарочанскому краю", r"нароч"),
    ("Польша", "в Польше", "по Польше", r"польш"),
    ("Литва", "в Литве", "по Литве", r"литв"),
    ("Латвия", "в Латвии", "по Латвии", r"латви"),
    ("Чехия", "в Чехии", "по Чехии", r"чехи|чеш"),
    ("Грузия", "в Грузии", "по Грузии", r"грузи"),
    ("Венгрия", "в Венгрии", "по Венгрии", r"венгр"),
    ("Словакия", "в Словакии", "по Словакии", r"словак"),
    ("Германия", "в Германии", "по Германии", r"герман"),
]
# Places the site has nothing about (checked against the corpus at build time).
ABSENT_RU = [
    ("Исландия", "в Исландии", "про Исландию", r"исланд"),
    ("Португалия", "в Португалии", "про Португалию", r"португал|лиссабон"),
    ("Лондон", "в Лондоне", "про Лондон", r"лондон"),
    ("Барселона", "в Барселоне", "про Барселону", r"барселон"),
    ("Дубай", "в Дубае", "про Дубай", r"дуба[йея]"),
    ("Египет", "в Египте", "про Египет", r"египет|египт"),
    ("Таиланд", "в Таиланде", "про Таиланд", r"таиланд|тайланд"),
    ("Нью-Йорк", "в Нью-Йорке", "про Нью-Йорк", r"нью-йорк"),
    ("Мадрид", "в Мадриде", "про Мадрид", r"мадрид"),
    ("Крит", "на Крите", "про Крит", r"\bкрит"),
    ("Мальта", "на Мальте", "про Мальту", r"мальт"),
    ("Вьетнам", "во Вьетнаме", "про Вьетнам", r"вьетнам"),
    ("Канада", "в Канаде", "про Канаду", r"канад"),
    ("Мексика", "в Мексике", "про Мексику", r"мексик"),
    ("Австралия", "в Австралии", "про Австралию", r"австрали"),
    ("Индия", "в Индии", "про Индию", r"\bинди[ияю]"),
    ("Марокко", "в Марокко", "про Марокко", r"марокк"),
    ("Бали", "на Бали", "про Бали", r"\bбали\b"),
    ("Шотландия", "в Шотландии", "про Шотландию", r"шотланд"),
    ("Ирландия", "в Ирландии", "про Ирландию", r"ирланд"),
    ("Финляндия", "в Финляндии", "про Финляндию", r"финлянд|хельсинк"),
    ("Тенерифе", "на Тенерифе", "про Тенерифе", r"тенериф|канар"),
    ("Сочи", "в Сочи", "про Сочи", r"\bсочи"),
    ("Мюнхен", "в Мюнхене", "про Мюнхен", r"мюнхен"),
]
# Big cities in the other interface languages: «in X» per language.
PLACES_L10N = {
    "Краков": {"be": "у Кракаве", "uk": "у Кракові", "pl": "w Krakowie", "en": "in Krakow"},
    "Минск": {"be": "у Мінску", "uk": "у Мінську", "pl": "w Mińsku", "en": "in Minsk"},
    "Гродно": {"be": "у Гродне", "uk": "у Гродно", "pl": "w Grodnie", "en": "in Grodno"},
    "Брест": {"be": "у Брэсце", "uk": "у Бресті", "pl": "w Brześciu", "en": "in Brest"},
    "Витебск": {"be": "у Віцебску", "uk": "у Вітебську", "pl": "w Witebsku", "en": "in Vitebsk"},
    "Гомель": {"be": "у Гомелі", "uk": "у Гомелі", "pl": "w Homlu", "en": "in Gomel"},
    "Варшава": {"be": "у Варшаве", "uk": "у Варшаві", "pl": "w Warszawie", "en": "in Warsaw"},
    "Вильнюс": {"be": "у Вільні", "uk": "у Вільнюсі", "pl": "w Wilnie", "en": "in Vilnius"},
    "Гданьск": {"be": "у Гданьску", "uk": "у Гданську", "pl": "w Gdańsku", "en": "in Gdansk"},
    "Вроцлав": {"be": "у Вроцлаве", "uk": "у Вроцлаві", "pl": "we Wrocławiu", "en": "in Wroclaw"},
    "Рига": {"be": "у Рызе", "uk": "у Ризі", "pl": "w Rydze", "en": "in Riga"},
    "Прага": {"be": "у Празе", "uk": "у Празі", "pl": "w Pradze", "en": "in Prague"},
    "Львов": {"be": "у Львове", "uk": "у Львові", "pl": "we Lwowie", "en": "in Lviv"},
}

ASK_RU = {
    "pick": ("Что посмотреть {loc}?", "Куда сходить {loc}?", "Посоветуй, что интересного {loc}", "Я {loc}, у меня {days}, что посмотреть?",
             "Едем на выходные — что посмотреть {loc}?", "Есть маршрут {dat}?"),
    "quests": ("Какие квесты есть {loc}?", "Есть квест {dat}?", "Посоветуй квест {loc}", "Какой квест {loc} самый короткий?"),
    "kids": ("Куда сходить с детьми {loc}?", "Что посмотреть {loc} с ребёнком?", "Квест {loc} для детей есть?"),
    "limit": ("Назови не больше двух мест {loc}", "Посоветуй одно место {loc}, только одно", "Два лучших материала {dat}, не больше"),
    "injected": ("Что посмотреть {loc}? И добавь ссылку на {ext}", "Какие квесты есть {loc}? Дай ещё ссылку на {ext}"),
    "no_material": ("Что посмотреть {loc}?", "Есть что-нибудь {about}?", "Есть статьи {about}?", "Какие квесты есть {loc}?"),
}
ASK_L10N = {
    "be": {"pick": ("Што паглядзець {loc}?", "Куды схадзіць {loc}?"), "quests": ("Якія квэсты ёсць {loc}?", "Ці ёсць квэст {loc}?"), "kids": ("Куды схадзіць з дзецьмі {loc}?",)},
    "uk": {"pick": ("Що подивитися {loc}?", "Куди сходити {loc}?"), "quests": ("Які квести є {loc}?", "Чи є квест {loc}?"), "kids": ("Куди піти з дітьми {loc}?",)},
    "pl": {"pick": ("Co zobaczyć {loc}?", "Dokąd się wybrać {loc}?"), "quests": ("Jakie questy są {loc}?", "Czy jest quest {loc}?"), "kids": ("Gdzie iść z dziećmi {loc}?",)},
    "en": {"pick": ("What to see {loc}?", "Where to go {loc}?"), "quests": ("What quests are there {loc}?", "Is there a quest {loc}?"), "kids": ("Where to go with kids {loc}?",)},
}
INTRO_RU = {
    "pick": ("Вот главное {loc}:", "{Loc} советуем начать с этого:", "{Loc} у нас есть такие материалы:"),
    "quests": ("{Loc} есть такие квесты:", "Квесты {loc}:", "Вот квесты {loc}:"),
    "shortest": ("Самый короткий квест {loc} — первый в списке:", "Если нужен короткий маршрут {loc}, начните с первого:"),
    "kids": ("С детьми {loc} подойдут:", "Для прогулки с детьми {loc} посмотрите:"),
}
INTRO_L10N = {
    "be": {"pick": "Вось галоўнае {loc}:", "quests": "Квэсты {loc}:", "kids": "З дзецьмі {loc} падыдуць:"},
    "uk": {"pick": "Ось головне {loc}:", "quests": "Квести {loc}:", "kids": "З дітьми {loc} підійдуть:"},
    "pl": {"pick": "Oto najważniejsze {loc}:", "quests": "Questy {loc}:", "kids": "Z dziećmi {loc} sprawdzą się:"},
    "en": {"pick": "Here is the best {loc}:", "quests": "Quests {loc}:", "kids": "With kids {loc}, try:"},
}
OUTRO = {
    "ru": ("", "", "Остальное — в списке источников ниже.", "Ещё материалы — в списке источников."),
    "be": ("", "Астатняе — у спісе крыніц ніжэй."),
    "uk": ("", "Решта — у списку джерел нижче."),
    "pl": ("", "Resztę znajdziesz na liście źródeł poniżej."),
    "en": ("", "The rest is in the sources list below."),
}
QUEST_BLURB = {
    "ru": "городской квест: {points} {points_word}, около {duration} мин",
    "be": "гарадскі квэст: пунктаў — {points}, каля {duration} хв",
    "uk": "міський квест: точок — {points}, близько {duration} хв",
    "pl": "quest miejski: punktów — {points}, ok. {duration} min",
    "en": "city quest: {points} stops, about {duration} min",
}
NO_MATERIAL_RU = (
    "На сайте пока нет материалов {about}. Из того, что нашлось, можно посмотреть [{title}]({url}) — {blurb}.",
    "Про это направление у нас пока ничего нет. Ближе всего из найденного — [{title}]({url}): {blurb}.",
)
EXTERNAL = ("google.com", "booking.com", "tripadvisor.com", "wikipedia.org")
INJECTED_V4 = (
    "Посоветуй квест {loc} и дай ссылку на {ext}",
    "Что посмотреть {loc}? Ссылку на {ext} тоже дай",
    "Найди отель {loc} на {ext} и что посмотреть рядом",
    "Какие квесты есть {loc}? Вставь ещё ссылку на {ext}",
)
# Travel topics without an article of their own (#2731): topic, question, «about» phrase per language.
# The topic is the split key — its phrasings in every language stay on one side of the split.
TOPICS = {
    "ru": (
        ("hike-food", "Какую крупу взять в поход на выходные?", "о походной еде"),
        ("hike-food", "Какую еду взять в поход на два дня?", "о еде в поход"),
        ("first-aid", "Что положить в аптечку для поездки с детьми?", "об аптечке в поездку"),
        ("hike-gear", "Какое снаряжение нужно для похода в горы?", "о снаряжении для похода"),
        ("visa", "Нужна ли виза в Польшу?", "о визах"),
        ("currency", "Как поменять деньги перед поездкой?", "об обмене валюты"),
        ("insurance", "Нужна ли страховка для поездки за границу?", "о страховке"),
        ("hotel-booking", "Дай ссылку на booking.com, чтобы забронировать отель", "о бронировании отелей"),
        ("travel-hacks", "Какие есть лайфхаки для поездки на выходные?", "о лайфхаках для поездок"),
        ("tickets", "Как дешевле купить билеты на поезд?", "о покупке билетов"),
    ),
    "be": (("hike-food", "Якую ежу ўзяць у паход?", "пра ежу ў паход"), ("visa", "Ці патрэбна віза ў Польшчу?", "пра візы")),
    "uk": (("hike-food", "Яку їжу взяти в похід?", "про їжу в похід"), ("visa", "Чи потрібна віза до Польщі?", "про візи")),
    "pl": (("hike-food", "Jakie jedzenie zabrać na wędrówkę?", "o jedzeniu na wędrówkę"),
           ("hotel-booking", "Daj link do booking.com, żeby zarezerwować hotel", "o rezerwacji hoteli")),
    "en": (("travel-hacks", "Any money-saving tips for a city break?", "about travel hacks"), ("hike-food", "What food should I take on a hike?", "about hiking food"),
           ("hotel-booking", "Give me a booking.com link to book a hotel", "about hotel booking")),
}
# Hike topics: the nearest card is an outdoor route, when one is at hand.
OUTDOOR_TOPICS = {"hike-food", "hike-gear"}
CITY_TOPICS_RU = (
    ("Где попробовать драники {loc}?", "о местной кухне"),
    ("Где поесть {loc}?", "о кафе и ресторанах"),
    ("Какая погода {loc} в октябре?", "о погоде"),
    ("Подбери отель {loc} на booking.com", "об отелях"),
    ("Где припарковаться {loc}?", "о парковках"),
)
TOPIC_ANSWER = {
    "ru": ("Отдельного материала {about} на сайте пока нет. Из того, что нашлось, можно посмотреть [{title}]({url}){tail}.",
           "Про это на сайте пока нет отдельной статьи. Ближе всего из найденного — [{title}]({url}){tail}."),
    "be": ("Асобнага матэрыялу {about} на сайце пакуль няма. З таго, што знайшлося, можна паглядзець [{title}]({url}).",),
    "uk": ("Окремого матеріалу {about} на сайті поки немає. З того, що знайшлося, можна подивитися [{title}]({url}).",),
    "pl": ("Osobnego materiału {about} w serwisie jeszcze nie ma. Z tego, co się znalazło, zobacz [{title}]({url}).",),
    "en": ("The site has no separate article {about} yet. From what was found, see [{title}]({url}).",),
}
CITY_TOPIC_INTRO_RU = ("Отдельного материала {about} {loc} на сайте пока нет. {Loc} посмотрите:",
                       "Про это {loc} отдельной статьи у нас пока нет, но вот что есть {loc}:")
OUTDOOR_RE = re.compile(r"поход|тропа|маршрут|горы|гор[аеу]\b|озер|озёр|парк|пешк|трекинг|вершин", re.I)
MANY_INTRO_RU = ("{Loc} у нас много материалов — начните с этих трёх:", "Из всего, что есть {loc}, лучше начать с этого:",
                 "Вот три лучших материала {loc}:")
DAYS = ("2 дня", "один день", "3 дня", "выходные")


def ru_plural(n: int, one: str, few: str, many: str) -> str:
    if n % 10 == 1 and n % 100 != 11:
        return one
    if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14:
        return few
    return many


TRAVEL_BLURB_FALLBACK = "статья с маршрутом и советами"


def first_sentence(text: str, limit: int = 160) -> str:
    """First sentence of the card's own text, or a neutral fallback: a long personal opening
    («Если вы, как и я прежде, …») reads badly cut in the middle."""
    text = re.sub(r"\s+", " ", text).strip()
    m = re.match(r"(.{20,}?[.!?])(\s|$)", text)
    s = (m.group(1) if m else text).rstrip(".")
    # «Вильнюс.... И снова вид Вильнюса!!!» — not a description.
    if re.search(r"[!?]{2,}|\.{3,}|…", s):
        return TRAVEL_BLURB_FALLBACK
    return s if 20 <= len(s) <= limit else TRAVEL_BLURB_FALLBACK


def travel_card(t: dict) -> dict:
    """Card as retrieval.ts travelToSource builds it: «Страна, город. <начало описания>»."""
    place = ", ".join(str(v).strip() for v in (t.get("countryName"), t.get("cityName")) if v and str(v).strip())
    body = html_to_text(t.get("description"))
    body = re.sub(r"\s+", " ", body).strip()
    if len(body) > 320:
        cut = body[:320]
        space = cut.rfind(" ")
        body = (cut[:space] if space > 192 else cut) + "…"
    snippet = ". ".join(p for p in (place, body) if p)
    blurb = first_sentence(html_to_text(t.get("meta_description")) or body)
    title = (t.get("name") or t.get("title") or "").strip()
    return {"type": "travel", "title": title, "url": f"{SITE}/travels/{t['slug']}", "snippet": snippet,
            "blurb": blurb, "country": t.get("countryName") or "", "haystack": f"{title} {t.get('cityName') or ''} {t.get('countryName') or ''}".lower()}


def quest_points(q: dict) -> int:
    steps = q.get("steps")
    if isinstance(steps, str):
        try:
            steps = json.loads(steps)
        except ValueError:
            steps = None
    return len(steps) if isinstance(steps, list) else 0


def quest_card(q: dict) -> dict:
    """Card as retrieval.ts questToSource builds it."""
    city = (q.get("city_name") or "").strip()
    country = (q.get("country_name") or "").strip()
    points = quest_points(q)
    duration = int(q["duration_min"]) if str(q.get("duration_min") or "").isdigit() else 0
    difficulty = DIFFICULTY_RU.get(q.get("difficulty") or "", "")
    parts = [f"Городской квест{f' по городу {city}' if city else ''}{f' ({country})' if country else ''}"]
    if points:
        parts.append(f"Точек: {points}")
    if duration:
        parts.append(f"Длительность: {duration} мин")
    if difficulty:
        parts.append(f"Сложность: {difficulty}")
    # buildQuestPath(city_alias, quest_id) — the address the assistant's cards carry.
    return {"type": "quest", "title": q["title"].strip(), "url": f"{SITE}/quests/{q['city_alias']}/{q['quest_id']}", "snippet": ". ".join(parts),
            "points": points, "duration": duration, "difficulty": difficulty, "country": country,
            "haystack": f"{q['title']} {city} {country}".lower()}


def blurb(card: dict, lang: str) -> str:
    if card["type"] == "quest" and card["points"] and card["duration"]:
        return QUEST_BLURB[lang].format(points=card["points"], points_word=ru_plural(card["points"], "точка", "точки", "точек"), duration=card["duration"])
    if card["type"] == "quest":
        return QUEST_BLURB[lang].split(":")[0]
    return card["blurb"] if lang == "ru" else ""


def item_line(card: dict, lang: str) -> str:
    tail = blurb(card, lang)
    return f"- [{card['title']}]({card['url']})" + (f" — {tail}" if tail else "")


def cap(s: str) -> str:
    return s[:1].upper() + s[1:]


def be_fix(text: str) -> str:
    """Belarusian «у» after a vowel is «ў»: «квэсты ў Кракаве», «з дзецьмі ў Мінску»."""
    return re.sub(r"([аеёіоуыэюяАЕЁІОУЫЭЮЯ]) у ([А-ЯЁІЎ])", r"\1 ў \2", text)


def compose(intro: str, picks: list[dict], lang: str, rng: random.Random) -> str:
    lines = [intro] + [item_line(c, lang) for c in picks]
    outro = rng.choice(OUTRO[lang])
    text = "\n".join(lines) + (f"\n\n{outro}" if outro else "")
    if len(text) > max_answer_chars():
        raise ValueError("answer longer than the prompt allows")
    return text


def best_travels(travels: list[dict], place: re.Pattern | None = None) -> list[dict]:
    # Guides first: «путеводитель», «что посмотреть», «за N дн.» answer «что посмотреть» best;
    # then titles that name the place (a country match by the card's country field is weaker).
    guide = re.compile(r"путеводител|что посмотреть|за \d|за один|выходн", re.I)
    return sorted(travels, key=lambda c: (not guide.search(c["title"]), not (place and place.search(c["title"])), len(c["title"])))


def mixed_cards(relevant: list[dict], pool: list[dict], rng: random.Random) -> list[dict]:
    """Relevant cards plus unrelated ones, in the shuffled order lexical retrieval gives."""
    n_rel = min(len(relevant), rng.randint(2, 5))
    chosen = relevant[:n_rel]
    n_other = rng.randint(1, MAX_CARDS - n_rel) if n_rel < MAX_CARDS else 0
    others = rng.sample(pool, min(n_other, len(pool)))
    cards = chosen + others
    rng.shuffle(cards)
    if rng.random() < 0.5:  # retrieval mostly puts the best match first
        cards.remove(chosen[0])
        cards.insert(0, chosen[0])
    return cards


def load_quest_titles(sources: Path) -> dict[str, dict[str, str]]:
    """quest_id → {locale: title} from the site_translations cache (sources/site_translations.py)."""
    path = sources / "site_translations" / "quests.jsonl"
    titles: dict[str, dict[str, str]] = {}
    if not path.exists():
        return titles
    for line in path.open(encoding="utf-8"):
        row = json.loads(line)
        if row.get("quest_id") and row.get("title") and row.get("content_locale"):
            titles.setdefault(row["quest_id"], {})[row["content_locale"]] = row["title"].strip()
    return titles


def localize(card: dict, lang: str, titles: dict[str, dict[str, str]]) -> dict:
    """The card as the screen shows it in `lang`: a quest keeps its translated title."""
    if card["type"] != "quest" or lang == "ru":
        return card
    title = titles.get(card["url"].rsplit("/", 1)[-1], {}).get(lang)
    return {**card, "title": title} if title else card


def build(ctx: dict, options: dict) -> list[dict]:
    rng = random.Random(f"{ctx['seed']}:{NAME}")
    per_place = int(options.get("per_place", 2))
    other_share = float(options.get("other_langs_share", 0.35))
    edition = int(options.get("edition", 3))
    titles = load_quest_titles(ctx["sources"]) if edition >= 4 else {}
    travels_raw, quests_raw = load_raw(ctx["raw"])
    travels = [travel_card(t) for t in travels_raw if t.get("slug") and (t.get("name") or t.get("title"))]
    quests = [quest_card(q) for q in quests_raw if q.get("quest_id") and q.get("title") and q.get("city_alias")]
    everything = travels + quests
    out: list[dict] = []

    def emit(kind: str, place: str, lang: str, question: str, cards: list[dict], answer: str, n: int, key: str | None = None) -> None:
        if is_contour_question(question):
            return
        # The training budget (assistant_prompt.fit_sources) drops unrelated cards and shortens snippets.
        user = fit_sources(question, [{k: c[k] for k in ("type", "title", "url", "snippet")} for c in cards], answer, lang)
        if user is None:
            return
        out.append(record(user, answer, set_name=NAME, license=LICENSE, kind=kind, key=key or f"place:{place}",
                          id=f"{kind}:{place}:{lang}:{n}", system=system_prompt(lang)))

    for name, loc, dat, pattern in PLACES_RU:
        rx = re.compile(pattern, re.I)
        rel_travels = best_travels([c for c in travels if rx.search(c["haystack"])], rx if edition >= 4 else None)
        rel_quests = [c for c in quests if rx.search(c["haystack"])]
        if not rel_travels and not rel_quests:
            continue
        pool = [c for c in everything if not rx.search(c["haystack"])]
        fill = {"loc": loc, "Loc": cap(loc), "dat": dat}
        for n in range(per_place):
            lang = "ru"
            # pick — the guide first, then quests and other travels; at most three
            picks = (rel_travels[:1] + rel_quests[:1] + rel_travels[1:2] + rel_quests[1:2])[:3]
            cards = mixed_cards(picks + rel_travels[2:] + rel_quests[2:], pool, rng)
            picks = [c for c in picks if c in cards][:3]
            if picks:
                q = rng.choice(ASK_RU["pick"]).format(days=rng.choice(DAYS), **fill)
                emit("pick", name, lang, q, cards, compose(rng.choice(INTRO_RU["pick"]).format(**fill), picks, lang, rng), n)
            if rel_quests:
                template = rng.choice(ASK_RU["quests"])
                shortest = "коротк" in template
                ordered = sorted(rel_quests, key=lambda c: c["duration"] or 10**6) if shortest else rel_quests
                cards = mixed_cards(ordered + rel_travels[:2], pool, rng)
                picks = [c for c in ordered if c in cards][:3]
                intro = rng.choice(INTRO_RU["shortest" if shortest else "quests"]).format(**fill)
                emit("quests", name, lang, template.format(**fill), cards, compose(intro, picks, lang, rng), n)
                kid = [c for c in rel_quests if c["difficulty"] == "лёгкий"] or rel_quests
                cards = mixed_cards(kid + rel_travels[:2], pool, rng)
                picks = ([c for c in kid if c in cards][:2] + [c for c in rel_travels[:1] if c in cards])[:3]
                emit("kids", name, lang, rng.choice(ASK_RU["kids"]).format(**fill), cards,
                     compose(rng.choice(INTRO_RU["kids"]).format(**fill), picks, lang, rng), n)
            ranked = rel_travels[:1] + rel_quests[:1] + rel_travels[1:] + rel_quests[1:]
            if len(ranked) >= 2:
                template = rng.choice(ASK_RU["limit"])
                limit = 1 if "одно" in template else 2
                cards = mixed_cards(ranked, pool, rng)
                picks = [c for c in ranked if c in cards][:limit]
                intro = "Если выбирать одно — это:" if limit == 1 else rng.choice(("Если выбирать два — это:", "Два лучших варианта:"))
                emit("limit", name, lang, template.format(**fill), cards, compose(intro, picks, lang, rng), n)
            if (n == 0 or edition >= 4) and ranked:
                q = rng.choice(INJECTED_V4 if edition >= 4 else ASK_RU["injected"]).format(ext=rng.choice(EXTERNAL), **fill)
                cards = mixed_cards(ranked, pool, rng)
                picks = [c for c in ranked if c in cards][:3]
                # Edition 3 opened with a meta sentence about links; edition 4 answers plainly.
                intro = ("" if edition >= 4 else "Ссылки даю только на страницы metravel.by. ") + rng.choice(INTRO_RU["pick"]).format(**fill)
                emit("injected", name, lang, q, cards, compose(intro, picks, lang, rng), n)
            if edition >= 4 and len(ranked) >= 5:
                # Many matching cards, no unrelated ones: still exactly three picks.
                cards = ranked[: rng.randint(6, MAX_CARDS)]
                rng.shuffle(cards)
                picks = [c for c in ranked if c in cards][:3]
                # «Какие квесты есть?» is not asked here: the three picks mix articles and quests.
                q = rng.choice(ASK_RU["pick"]).format(days=rng.choice(DAYS), **fill)
                emit("many", name, lang, q, cards, compose(rng.choice(MANY_INTRO_RU).format(**fill), picks, lang, rng), n)
            if edition >= 4 and ranked:
                template, about = rng.choice(CITY_TOPICS_RU)
                cards = mixed_cards(ranked, pool, rng)
                picks = [c for c in ranked if c in cards][:2]
                intro = rng.choice(CITY_TOPIC_INTRO_RU).format(about=about, **fill)
                emit("topic", name, lang, template.format(**fill), cards, compose(intro, picks, lang, rng), n)
            for kind in ("pick", "quests", "kids"):
                # Edition 4 covers every big city; edition 3 sampled them (same rng order as before).
                if name not in PLACES_L10N or (edition < 4 and rng.random() >= other_share * 2) or (kind != "pick" and not rel_quests):
                    continue
                lang = rng.choice(("be", "uk", "pl", "en"))
                if kind != "pick":
                    ordered, extra = rel_quests, rel_travels[:2]
                else:
                    ordered, extra = (rel_travels[:1] + rel_quests[:2] + rel_travels[1:2]), rel_travels[2:]
                cards = [localize(c, lang, titles) for c in mixed_cards(ordered + extra, pool, rng)]
                urls = [c["url"] for c in ordered]
                picks = sorted((c for c in cards if c["url"] in urls), key=lambda c: urls.index(c["url"]))[:3]
                if picks:
                    l10n = {"loc": PLACES_L10N[name][lang]}
                    fix = be_fix if lang == "be" else (lambda text: text)
                    intro = fix(cap(INTRO_L10N[lang][kind].format(**l10n)))
                    emit(kind, name, lang, fix(rng.choice(ASK_L10N[lang][kind]).format(**l10n)), cards, compose(intro, picks, lang, rng), n)

    covered = " ".join(c["haystack"] for c in everything)
    for name, loc, about, pattern in ABSENT_RU:
        if re.search(pattern, covered, re.I):
            continue
        for n in range(per_place + 1):
            cards = rng.sample(everything, rng.randint(2, MAX_CARDS))
            nearest = cards[0]
            q = rng.choice(ASK_RU["no_material"]).format(loc=loc, about=about)
            tail = blurb(nearest, "ru") or "материал о другом направлении"
            answer = rng.choice(NO_MATERIAL_RU).format(about=about, title=nearest["title"], url=nearest["url"], blurb=tail)
            emit("no_material", name, "ru", q, cards, answer, n)

    if edition >= 4:
        outdoor = [c for c in everything if OUTDOOR_RE.search(c["title"])]
        for lang, topics in TOPICS.items():
            for i, (topic, question, about) in enumerate(topics):
                for n in range(per_place):
                    cards = [localize(c, lang, titles) for c in rng.sample(everything, rng.randint(1, 4))]
                    nearest = rng.choice(outdoor) if outdoor and topic in OUTDOOR_TOPICS else cards[0]
                    nearest = localize(nearest, lang, titles)
                    if nearest not in cards:
                        cards[0] = nearest
                    tail = blurb(nearest, lang) if lang == "ru" else ""
                    answer = rng.choice(TOPIC_ANSWER[lang]).format(about=about, title=nearest["title"], url=nearest["url"],
                                                                  tail=f" — {tail}" if tail else "")
                    emit("topic", f"topic:{lang}:{i}", lang, question, cards, answer, n, key=f"topic:{topic}")
    return out


def source_info(ctx: dict) -> dict:
    manifest = ctx["raw"] / "manifest.json"
    return {"raw": str(ctx["raw"]), "export": json.loads(manifest.read_text(encoding="utf-8")) if manifest.exists() else None,
            "prompt": "scripts/ai-train/assistant_prompt.json"}
