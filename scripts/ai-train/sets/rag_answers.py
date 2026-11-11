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

Edition 9 (#3319 v9, 11.11.2026) — from the v8 acceptance (h29, v5ln03, v5bd06, h28, q11–q13, q29, in08):
* kids        — one marked quest, one item. The children's mark decides: the children's quests of the place
                are named and only they («один — один пункт, два — два»); no children's quest, a family one
                among the cards → only the family ones, called «семейный»; no mark at all → as before (two
                quests of the place and «возраст в карточках не указан»). An ordinary quest next to a marked
                one and a quest of another city are never named (v8 trained 13 of 49 one-marked prompts with
                a second, ordinary quest, and the model answered «детский + ещё один»). The prompt holds 1–5
                quests of the place in a random order, sometimes an article of the place and one or two cards
                of other cities (the marked one of another city among them); every language over the same
                cities, so the counts are equal by construction;
* kids_followup — «какие квесты в X» → «что из этого подойдёт детям»: 2–5 quests of the city in a random
                order, 0, 1 or 2 of them marked (v8: always two cards, ten samples per language), the answer
                by the rule above; in 15 % of the samples one or two cards of other cities;
* one_marked  — «какой из квестов X детский — назови только его», «дай ссылку только на него»: exactly one
                marked card among the cards, the answer is that one item with its link, no «остальное в списке
                источников» and no counter-question;
* one_any     — «выбери один квест X», «один вариант»: unmarked cards only, the answer is the first card of
                the prompt (the only criterion the model can see; a choice by durations or stops is the circle
                of v10, #3294);
* crowded5    — five quests of one city (all cities with five, every language over the same cities), three
                links in card order without a blurb and «остальное — в списке источников»: a link-only item
                is what lets five cards stand in 1024 tokens (v8 trained 41 of 1307 prompts with five cards);
* crowded_injected — the same five cards under the existing foreign-link requests of `injected`
                (INJECTED_V4, Russian only like `injected`): the answer ignores the request and names three.
Edition 8's pair dialogue `followup` of mt03 (two cards) is replaced by kids_followup; the follow-up of edition 5
(one card) stays. Editions 3–8 are unchanged; the edition-9 samples use their own random stream.

Edition 8 (#3276, #3278, 11.11.2026) — from the v7 residual mt03#1 («какой из них подойдёт детям?»):
* audience    — quest cards carry the children's mark of the catalogue the way the app writes it
                («Детский городской квест по городу …. Возраст: 8–10 лет. Со взрослым. Точек: …»,
                «Семейный городской квест …»); every answer names such a quest as «детский квест для
                8–10 лет: …» in the answer language;
* kids        — a question about children is answered with the marked quests of the place (at most
                two), the other quests of the place stay among the cards; «Возрастные ограничения в
                карточках не указаны» remains only when no card is marked;
* followup    — the dialogue of mt03 on five languages: the first answer lists general quests, the
                second question asks about a child, the cards hold a general quest and the children's
                one in a random order, the answer picks by the mark;
* page        — «Этот квест подойдёт ребёнку?» on a marked quest is answered «Да, … — детский квест
                для 8–10 лет…»;
* scarce      — fewer quests of the place among the cards than the question asks for («три квеста
                {loc}» with one or two of them next to two or three quests of other cities): the
                answer names only the quests of the place and says there are no others. From the
                acceptance of 11.11.2026: v4 and v7 topped the list up to the asked number with
                quests of other cities (off_place_card on five held-out questions), and no sample of
                editions 3–7 showed fewer matches than asked. Editions 3–7 are unchanged.

Edition 7 (#2751 v7, 09.11.2026) — from the v6 acceptance (on13, BE ln02: four to six quests
listed instead of three, on v4 and v6 alike):
* card order  — which three of the matching cards an answer names used to follow the dump order
                of the quests, which the model never sees: with four or more quests of a city in
                the prompt the choice was unpredictable and the model listed them all. In
                quests / kids answers (RU and the other languages) the picks now go in the order
                of the cards in the prompt, the way retrieval ranks them («самый короткий» keeps
                the visible duration order);
* crowded     — a city with four or five of its quests among the cards (all the 1024-token
                training budget holds; the screen sends up to eight), on five languages and
                natural phrasings («Есть квест …?», «Якія квэсты ёсць …?»): the answer names
                the first three in card order and leaves the rest to the sources list. The
                matching cards the answer does not link stay in the prompt (`fit_sources(keep=)`)
                — before, the fit dropped exactly them, so the model never saw more matching
                cards than it named.

Edition 6 (#2751 v6, 08.11.2026) — from the v5-rag acceptance misses (01.11.2026):
* topic       — back (edition 5 dropped it for `boundary_*`): on the screen a borderline
                question («какую крупу брать в поход») arrives with unrelated cards and v5-rag
                refused it as off-topic; TOPICS6 adds natural RU/EN/BE/UK/PL phrasings
                (food, gear, packing, budget, first aid, clothes, transport, kids on the road);
* exact_one   — «ровно один / только один квест {loc} до N минут» → one item with its
                duration from the card (v5-rag listed two for «ровно один» and skipped the
                duration); one_article — «одна статья {dat}, без квестов» → one article;
* page        — the question is about the page the visitor opened (#2897: that card comes
                first among ≤ 3): «о чём эта статья», «сколько точек и сколько длится этот
                квест», «подойдёт ли ребёнку» → the answer about card [1] only, facts from
                its snippet, one link;
* other languages — natural phrasings next to the compact ones («Што паглядзець {loc} за
                два дні?»), and every item carries the quest blurb in the answer language
                (compact title-only lists read as Russian when the titles are Russian).

Options (mixes/*.yaml → sets.rag_answers.options):
  per_place  — samples per place and kind (default 2);
  other_langs_share — share of non-Russian samples among pick/quests/kids (default 0.35, edition 3);
  edition    — 3 (default), 4, 5 (compact locale-balanced #2751 continuation), 6 (v6), 7 (v7), 8 (v8) or 9 (v9);
  page_travels, page_quests — pages sampled for the `page` kind (edition 6; default 60 / 80).
"""
from __future__ import annotations

import json
import random
import re
from collections import Counter
from pathlib import Path

from sets.assistant_prompt import SAMPLE_CHARS_BUDGET, fit_sources, is_contour_question, max_answer_chars, sanitize_fragment, system_prompt
from sets.common import SITE, record
from sets.site import html_to_text, load_raw

NAME = "rag_answers"
# Samples the last build() did not emit, by reason and kind — reported in the mix manifest (source_info):
# a sample dropped by the token-budget fit disappears without a trace otherwise (49 of 1431 in edition 7).
_dropped: Counter = Counter()
LICENSE = "metravel.by own content (articles and quests by Julia and Sergey); answers assembled from card fields"
MAX_CARDS = 8
# Edition 7 `crowded`: this many quests of one city among the cards (on13 had 4, BE ln02 had 6).
# Five is what the training budget holds next to the system prompt (SAMPLE_CHARS_BUDGET ≈ 1024
# tokens: four cards with full snippets, five with shortened ones), so no unrelated cards here.
CROWDED_MIN, CROWDED_MAX = 4, 5
CROWDED_VARIANTS = 3
CROWDED_VARIANTS_L10N = 2
# The character budget is a proxy for 1024 tokens (≈ 2,9 characters per token here); `crowded`
# prompts are URL-heavy and stay under the limit at a larger budget, which keeps the durations in
# the cards and the blurbs in the answer. prepare_training_data.py drops the few that still exceed.
CROWDED_CHARS_BUDGET = 2950
# Edition 9 kinds that carry up to five cards of the place (and a history turn): the same wide budget as `crowded`;
# a sample that still exceeds 1024 tokens is dropped whole by prepare_training_data.py. `strict` samples never fall
# back to a prompt without their unnamed matching cards — that was the v6 failure (the model never saw more
# matching cards than it named).
WIDE_KINDS_9 = frozenset({"kids", "kids_followup", "one_marked", "one_any", "crowded5", "crowded_injected"})
# Characters per 1024 tokens of the chat template by language (the draft build of 11.11.2026: RU 3,04, EN 3,06, PL 2,98, UK 2,93,
# BE 2,87 chars per token, ≈ 40 tokens of template markup): a flat budget lost 8 of 19 BE `crowded5` prompts to the token fit
# and left BE/UK with fewer dialogues than RU/EN. The shorter prompt keeps the sample (a shorter snippet) instead of losing it.
WIDE_BUDGET_9 = {"ru": 2950, "en": 2950, "pl": 2900, "uk": 2850, "be": 2800}
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
# Edition 8 (#3276, #3278): the audience of a quest. The catalogue marks children's quests (`tags.kids`
# on 26 of 343 quests, `family`, `age-8-10`, `adult-required`), but the card the assistant sent carried
# only the city, the number of stops, the duration and the difficulty — and «детский» stands in the title
# of 9 of those 26. Asked «какой из них подойдёт детям?», the model saw two cards of one shape, answered
# as edition 5 taught («Возрастные ограничения в карточках не указаны») and picked at random
# (mt03#1, 11.11.2026). The app now writes the audience into the card (questToSource); these samples teach
# the answer to pick by it and to name the age.
AUDIENCE_HEAD_RU = {"kids": "Детский городской квест", "family": "Семейный городской квест"}
AUDIENCE_BLURB = {
    "ru": {"kids": "детский квест{age}: {points} {points_word}, около {duration} мин", "family": "семейный квест: {points} {points_word}, около {duration} мин",
           "age": " для {lo}–{hi} лет"},
    "be": {"kids": "дзіцячы квэст{age}: пунктаў — {points}, каля {duration} хв", "family": "сямейны квэст: пунктаў — {points}, каля {duration} хв",
           "age": " для {lo}–{hi} гадоў"},
    "uk": {"kids": "дитячий квест{age}: точок — {points}, близько {duration} хв", "family": "сімейний квест: точок — {points}, близько {duration} хв",
           "age": " для {lo}–{hi} років"},
    "pl": {"kids": "quest dla dzieci{age}: punktów — {points}, ok. {duration} min", "family": "quest rodzinny: punktów — {points}, ok. {duration} min",
           "age": " w wieku {lo}–{hi} lat"},
    "en": {"kids": "kids' quest{age}: {points} stops, about {duration} min", "family": "family quest: {points} stops, about {duration} min",
           "age": " for ages {lo}–{hi}"},
}
KIDS_PICK_INTRO = {"ru": ("Для детей {loc} есть:", "С ребёнком {loc} подойдёт:"), "be": ("Для дзяцей {loc} ёсць:",), "uk": ("Для дітей {loc} є:",),
                   "pl": ("Dla dzieci {loc} jest:",), "en": ("For children {loc} there is:",)}
KIDS_FOLLOW_ASK = {
    "ru": ("Что из этого выбрать, если идём с ребёнком?", "Какой из этих квестов рассчитан на детей?", "А с ребёнком куда лучше?"),
    "be": ("Што з гэтага выбраць, калі ідзём з дзіцем?",), "uk": ("Що з цього обрати, якщо йдемо з дитиною?",),
    "pl": ("Co z tego wybrać, jeśli idziemy z dzieckiem?",), "en": ("Which of these should we pick if we go with a child?",),
}
KIDS_FOLLOW_INTRO = {"ru": "С ребёнком выбирайте:", "be": "З дзіцем выбірайце:", "uk": "З дитиною обирайте:", "pl": "Z dzieckiem wybierzcie:",
                     "en": "With a child, choose:"}
# Not «Какие квесты есть {loc}?»: with {loc} filled in it is the contour's on02, v01, BE ln02, UK ln04 word for word,
# and a history turn is checked by prepare_training_data.holdout_violation like the question itself.
KIDS_FIRST_ASK = {"ru": "Какие квесты можно пройти {loc}?", "be": "Якія квэсты можна прайсці {loc}?", "uk": "Які квести можна пройти {loc}?",
                  "pl": "Jakie questy można przejść {loc}?", "en": "Which quests can we do {loc}?"}
PAGE_KIDS_TAGGED = {
    "ru": "Да, [{title}]({url}) — {blurb}.",
    "be": "Так, [{title}]({url}) — {blurb}.",
    "uk": "Так, [{title}]({url}) — {blurb}.",
    "pl": "Tak, [{title}]({url}) — {blurb}.",
    "en": "Yes, [{title}]({url}) is a {blurb}.",
}
# Edition 8 `scarce`: the question asks for more quests of the place than the cards hold. The wording is
# built apart from the held-out questions of the contour (cases.holdout.jsonl is never read here).
SCARCE_ASK = {
    "ru": {2: ("Нужны два квеста {loc} на выходные.", "Хотим пройти пару квестов {loc}. Какие?"),
           3: ("Хотим пройти три квеста {loc}. Какие посоветуешь?", "Подбери три квеста {loc}.")},
    "be": {2: ("Патрэбны два квэсты {loc} на выхадныя.",), 3: ("Хочам прайсці тры квэсты {loc}. Якія параіш?",)},
    "uk": {2: ("Потрібні два квести {loc} на вихідні.",), 3: ("Хочемо пройти три квести {loc}. Які порадиш?",)},
    "pl": {2: ("Szukamy dwóch questów {loc} na weekend.",), 3: ("Chcemy przejść trzy questy {loc}. Które polecasz?",)},
    "en": {2: ("We need two quests {loc} for the weekend.",), 3: ("We would like to do three quests {loc}. Which ones?",)},
}
SCARCE_INTRO = {
    "ru": {1: "{Loc} в карточках один квест:", 2: "{Loc} в карточках два квеста:"},
    "be": {1: "{Loc} у картках адзін квэст:", 2: "{Loc} у картках два квэсты:"},
    "uk": {1: "{Loc} у картках один квест:", 2: "{Loc} у картках два квести:"},
    "pl": {1: "{Loc} w kartach jest jeden quest:", 2: "{Loc} w kartach są dwa questy:"},
    "en": {1: "{Loc} the cards hold one quest:", 2: "{Loc} the cards hold two quests:"},
}
SCARCE_TAIL = {
    "ru": "Других квестов {loc} среди найденного нет.",
    "be": "Іншых квэстаў {loc} сярод знойдзенага няма.",
    "uk": "Інших квестів {loc} серед знайденого немає.",
    "pl": "Innych questów {loc} wśród znalezionych nie ma.",
    "en": "There are no other quests {loc} among the cards.",
}
# ----------------------------------------------------------------------------- edition 9 (#3319 v9)
# Cities whose BE/UK/PL/EN forms were not in PLACES_L10N (edition ≤ 8 iterates it, so it stays as it is): the
# edition-9 audience kinds run every language over the same cities, among them those with a children's quest.
PLACES_L10N_EXTRA = {
    "Могилёв": {"be": "у Магілёве", "uk": "у Могильові", "pl": "w Mohylewie", "en": "in Mogilev"},
    "Пинск": {"be": "у Пінску", "uk": "у Пінську", "pl": "w Pińsku", "en": "in Pinsk"},
    "Лида": {"be": "у Лідзе", "uk": "у Лиді", "pl": "w Lidzie", "en": "in Lida"},
    "Несвиж": {"be": "у Нясвіжы", "uk": "у Несвіжі", "pl": "w Nieświeżu", "en": "in Nesvizh"},
    "Полоцк": {"be": "у Полацку", "uk": "у Полоцьку", "pl": "w Połocku", "en": "in Polotsk"},
    "Бобруйск": {"be": "у Бабруйску", "uk": "у Бобруйську", "pl": "w Bobrujsku", "en": "in Bobruisk"},
    "Барановичи": {"be": "у Баранавічах", "uk": "у Барановичах", "pl": "w Baranowiczach", "en": "in Baranovichi"},
    "Новогрудок": {"be": "у Навагрудку", "uk": "у Новогрудку", "pl": "w Nowogródku", "en": "in Novogrudok"},
    "Белосток": {"be": "у Беластоку", "uk": "у Білостоку", "pl": "w Białymstoku", "en": "in Bialystok"},
    "Познань": {"be": "у Познані", "uk": "у Познані", "pl": "w Poznaniu", "en": "in Poznan"},
    "Торунь": {"be": "у Торуні", "uk": "у Торуні", "pl": "w Toruniu", "en": "in Torun"},
    "Люблин": {"be": "у Любліне", "uk": "у Любліні", "pl": "w Lublinie", "en": "in Lublin"},
    "Таллин": {"be": "у Таліне", "uk": "у Таллінні", "pl": "w Tallinie", "en": "in Tallinn"},
    "Каунас": {"be": "у Коўне", "uk": "у Каунасі", "pl": "w Kownie", "en": "in Kaunas"},
}
LANGS5 = ("ru", "be", "uk", "pl", "en")
# Cities a kind skips in every language (so the language counts stay equal): in that city the kind restates an evaluation
# question that the exact-match check (is_contour_question) does not catch — the UK kids follow-up over Pinsk is h29,
# INJECTED_V4's «…квесты есть {loc}? Вставь ещё ссылку…» over Grodno is in08 with one verb swapped.
HELDOUT_CITIES_9 = {
    "kids_followup": frozenset({"Пинск", "Несвиж", "Барановичи"}),  # h29 (uk), mt03 (ru), h28 (ru)
    "one_marked": frozenset({"Барановичи", "Варшава"}),  # q11 (ru), q12 (uk)
    "one_any": frozenset({"Варшава"}),  # q29 (be)
    "crowded5": frozenset({"Гродно"}),  # v5ln03 (pl)
    "crowded_injected": frozenset({"Гродно"}),  # in08 (ru)
}
FOREIGN_SHARE = 0.15  # prompts with one or two cards of other cities
# A sample that does not fit the budget (or whose question is a held-out one) is drawn again with other cards and wording, so
# the languages keep equal counts: a heavy language (BE, UK) would otherwise lose more samples to the budget than RU or EN.
RETRIES_9 = 4
FAMILY_INTRO = {
    "ru": ("Детских квестов в карточках нет, зато есть семейный:", "Детских квестов в карточках нет, зато есть семейные:"),
    "be": ("Дзіцячых квэстаў у картках няма, затое ёсць сямейны:", "Дзіцячых квэстаў у картках няма, затое ёсць сямейныя:"),
    "uk": ("Дитячих квестів у картках немає, зате є сімейний:", "Дитячих квестів у картках немає, зате є сімейні:"),
    "pl": ("Questów dla dzieci w kartach nie ma, ale jest rodzinny:", "Questów dla dzieci w kartach nie ma, ale są rodzinne:"),
    "en": ("The cards hold no kids' quest, but there is a family one:", "The cards hold no kids' quest, but there are family ones:"),
}
# Own wording: no held-out question is read or paraphrased here (the leak checks run in emit() and prepare_training_data).
KIDS_ASK9 = {
    "ru": ("Подскажи, есть ли {loc} квест, который осилит ребёнок?", "Мы едем с малышом. Какой квест {loc} нам подойдёт?"),
    "be": ("Ці ёсць {loc} квэст, які асіліць дзіця?",), "uk": ("Чи є {loc} квест, який під силу дитині?",),
    "pl": ("Czy jest {loc} quest, z którym poradzi sobie dziecko?",), "en": ("Is there a quest {loc} that a small child can manage?",),
}
KIDS_FOLLOW_ASK9 = {
    "ru": ("Мы пойдём с малышом — какой из этих вариантов нам годится?", "Есть ли среди этих квестов тот, что сделан для детей?",
           "Ребёнок пойдёт с нами. Что посоветуешь из перечисленного?"),
    "be": ("Мы пойдзем з малым — які з гэтых варыянтаў нам падыдзе?", "Ці ёсць сярод гэтых квэстаў той, што зроблены для дзяцей?"),
    "uk": ("Ми підемо з малям — який із цих варіантів нам підходить?", "Чи є серед цих квестів той, що створений для дітей?"),
    "pl": ("Pójdziemy z maluchem — który z tych wariantów nam pasuje?", "Czy wśród tych questów jest taki, który stworzono dla dzieci?"),
    "en": ("We are bringing a little one — which of these options fits us?", "Is any of these quests made for children?"),
}
ONE_KIDS_ASK = {
    # Not «Какой из квестов {loc} детский? Назови только его»: that is q11 (RU) and q12 (UK) with the city swapped.
    "ru": ("Ищу квест {loc}, сделанный для детей. Хватит одного.", "Нужен только детский квест {loc}: один, со ссылкой.",
           "Дай ссылку только на детский квест {loc}.", "Подскажи один квест {loc} для ребёнка, больше ничего не надо."),
    "be": ("Шукаю квэст {loc}, зроблены для дзяцей. Хопіць аднаго.", "Дай спасылку толькі на дзіцячы квэст {loc}.", "Падкажы адзін квэст {loc} для дзіцяці, болей нічога не трэба."),
    "uk": ("Шукаю квест {loc}, зроблений для дітей. Вистачить одного.", "Дай посилання лише на дитячий квест {loc}.", "Підкажи один квест {loc} для дитини, більше нічого не треба."),
    "pl": ("Szukam questu {loc} przygotowanego dla dzieci. Wystarczy jeden.", "Daj link tylko do questu dla dzieci {loc}.", "Wskaż jeden quest {loc} dla dziecka, nic więcej."),
    "en": ("I'm looking for a quest {loc} made for kids. One is enough.", "Give me a link to the kids' quest {loc} only.", "Point me to one quest {loc} for a child, nothing else."),
}
ONE_KIDS_INTRO = {"ru": ("Детский квест здесь один:", "Из найденного детский только этот:"), "be": ("Дзіцячы квэст тут адзін:",),
                  "uk": ("Дитячий квест тут один:",), "pl": ("Quest dla dzieci jest jeden:",), "en": ("There is one kids' quest:",)}
ONE_ANY_ASK = {
    "ru": ("Выбери один квест {loc}, только один.", "Дай один вариант квеста {loc}.", "Назови любой один квест {loc} и дай на него ссылку.",
           "Нужен ровно один квест {loc} — какой?", "Посоветуй один квест {loc}, без остальных."),
    "be": ("Абяры адзін квэст {loc}, толькі адзін.", "Дай адзін варыянт квэсту {loc} са спасылкай.", "Параі адзін квэст {loc}, без астатніх."),
    "uk": ("Обери один квест {loc}, лише один.", "Дай один варіант квесту {loc} із посиланням.", "Порадь один квест {loc}, без решти."),
    "pl": ("Wybierz jeden quest {loc}, tylko jeden.", "Daj jeden wariant questu {loc} z linkiem.", "Polec jeden quest {loc}, bez pozostałych."),
    "en": ("Choose one quest {loc}, just one.", "Give me one quest option {loc} with a link.", "Recommend a single quest {loc}, nothing else."),
}
ONE_ANY_INTRO = {"ru": ("Вот один квест:", "Один вариант:"), "be": ("Вось адзін квэст:",), "uk": ("Ось один квест:",),
                 "pl": ("Oto jeden quest:",), "en": ("Here is one quest:",)}
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

# Edition 5 separates trip intent from standalone cooking/finance requests.
# These are independently authored training templates, never evaluation inputs.
BOUNDARY = {
    "ru": (
        ("hike-food", "Собираюсь на тропу с ночёвкой: что известно о продуктах из этих материалов?", "о продуктах для тропы"),
        ("hike-food", "Нужно спланировать питание в пешем путешествии. Что есть в подборке?", "о питании в пешем путешествии"),
        ("hike-gear", "Готовлю вещи для пешего маршрута: что советуют материалы?", "о вещах для пешего маршрута"),
        ("packing", "Хочу ехать налегке, только с небольшой сумкой. Есть советы в карточках?", "о сборах с небольшой сумкой"),
        ("packing", "Как сократить багаж в короткой поездке по этим материалам?", "о сокращении багажа в поездке"),
        ("travel-hacks", "Готовлю недорогую поездку на пару суток. Что полезного есть в материалах?", "о недорогой поездке"),
        ("travel-hacks", "Ищу практичные хитрости для короткого путешествия. Что нашлось на сайте?", "о практичных хитростях в путешествии"),
        ("trip-budget", "Как по этим карточкам спланировать расходы в путешествии?", "о расходах в путешествии"),
    ),
    "en": (
        ("hike-food", "I'm arranging meals for an overnight walking trip. What do the cards say?", "about meals for a walking trip"),
        ("hike-food", "Does the supplied material discuss provisions for a trail holiday?", "about trail provisions"),
        ("hike-gear", "I'm choosing equipment for a walking holiday. What is in these materials?", "about equipment for a walking holiday"),
        ("packing", "I want to travel with a small daypack. What advice do these cards contain?", "about travelling with a small daypack"),
        ("packing", "Can these materials help me reduce luggage on a short holiday?", "about reducing holiday luggage"),
        ("travel-hacks", "I'm after practical shortcuts for a brief holiday. What is in the supplied material?", "about practical shortcuts for a holiday"),
        ("travel-hacks", "How can I make a two-night city break simpler using these materials?", "about simplifying a city break"),
        ("trip-budget", "What do these cards tell me about planning a travel budget?", "about planning a travel budget"),
    ),
}
# Whole words and topic phrases, rather than stems such as «совет»/«круп»:
# a village council, Soviet history or a large building is not travel advice.
BOUNDARY_EVIDENCE = {
    "hike-food": r"\b(?:еда|еду|еды|едой|питани[еяюи]|продукт(?:ы|ов|ами|а|у)?|каша|кашу|каши|кашей|food|meals?|provisions?)\b",
    "hike-gear": r"\b(?:снаряжени[еяюи]|экипировк\w*|equipment|gear)\b",
    "packing": r"\b(?:багаж\w*|рюкзак\w*|чемодан\w*|сумк[ауие]|сумкой|luggage|backpacks?|daypacks?|bags?)\b",
    "travel-hacks": r"\b(?:полезн\w*\s+совет\w*|совет(?:уем|ую|уют)|советы\s+(?:по|для)|лайфхак\w*|хитрост[ьи]\w*|tips?|hacks?|shortcuts?)\b",
    "trip-budget": r"\b(?:цен[аыуе]|ценой|ценам[и]?|стоимост[ьи]|бюджет\w*|евро|рубл\w*|prices?|costs?|budget|euros?)\b|(?<!\w)руб\.(?!\w)",
}
KIDS_UNKNOWN = {
    "ru": "Возрастные ограничения в карточках не указаны. Сколько лет ребёнку?",
    "be": "У картках не пазначаны ўзроставыя абмежаванні. Колькі гадоў дзіцяці?",
    "uk": "У картках не вказано вікові обмеження. Скільки років дитині?",
    "pl": "Karty nie podają ograniczeń wiekowych. Ile lat ma dziecko?",
    "en": "The cards do not state age suitability. How old is the child?",
}
KIDS_INTRO = {"ru": "Для выбора маршрута с ребёнком:", "be": "Для выбару маршруту з дзіцем:",
              "uk": "Для вибору маршруту з дитиною:", "pl": "Do wyboru trasy z dzieckiem:", "en": "For choosing a route with a child:"}

COMPACT_ASK = {
    "be": {"pick": "Прапануй некалькі матэрыялаў для наведвання {loc}.", "quests": "Выберы да трох гарадскіх квэстаў {loc}.", "kids": "Выбіраем прагулку з дзіцем {loc}. Якія ёсць матэрыялы?"},
    "uk": {"pick": "Запропонуй кілька матеріалів для відвідування {loc}.", "quests": "Вибери до трьох міських квестів {loc}.", "kids": "Обираємо прогулянку з дитиною {loc}. Які є матеріали?"},
    "pl": {"pick": "Zaproponuj kilka materiałów na zwiedzanie {loc}.", "quests": "Wybierz do trzech questów miejskich {loc}.", "kids": "Wybieramy spacer z dzieckiem {loc}. Jakie materiały są dostępne?"},
    "en": {"pick": "Suggest a few materials for a visit {loc}.", "quests": "Choose up to three city quests {loc}.", "kids": "We are choosing a walk with a child {loc}. Which materials are available?"},
}

# ----------------------------------------------------------------------------- edition 6 (#2751 v6)
# Natural phrasings the way visitors type them. Some share the contour's wording with another
# city (as ASK_RU/ASK_L10N do); the contour's own questions are skipped by is_contour_question.
ASK_L10N6 = {
    "be": {"pick": ("Што паглядзець {loc} за два дні?", "Што паглядзець {loc} за адзін дзень?", "Куды схадзіць {loc} на выходныя?"),
           "quests": ("Якія квэсты ёсць {loc}?", "Парай квэст {loc}."), "kids": ("Куды схадзіць з дзецьмі {loc}?", "Ці ёсць квэст {loc} для дзяцей?")},
    "uk": {"pick": ("Що подивитися {loc} за два дні?", "Що подивитися {loc} за один день?", "Куди сходити {loc} на вихідних?"),
           "quests": ("Які квести є {loc}?", "Порадь квест {loc}."), "kids": ("Куди піти з дітьми {loc}?", "Чи є квест {loc} для дітей?")},
    "pl": {"pick": ("Co zobaczyć {loc} w dwa dni?", "Co zobaczyć {loc} w jeden dzień?", "Dokąd się wybrać {loc} na weekend?"),
           "quests": ("Jakie questy są {loc}?", "Poleć quest {loc}."), "kids": ("Gdzie iść z dziećmi {loc}?", "Czy jest quest {loc} dla dzieci?")},
    "en": {"pick": ("What to see {loc} in two days?", "What to see {loc} in one day?", "Where to go {loc} for a weekend?"),
           "quests": ("What quests are there {loc}?", "Recommend a quest {loc}."), "kids": ("Where to go with kids {loc}?", "Are there any quests {loc} for kids?")},
}
# Borderline travel topics without an article: the screen hands these over with whatever
# unrelated cards lexical search found, and the answer must stay «material is missing + the
# nearest card», never the off-topic refusal. Topic is the split key, as in edition 4.
TOPICS6 = {
    "ru": (
        ("hike-food", "Какие продукты брать в двухдневный поход?", "о походной еде"),
        ("hike-food", "Что приготовить на костре в походе, чтобы было сытно?", "о еде в походе"),
        ("hike-food", "Чем питаться на тропе, если идём с палаткой на три дня?", "о питании в походе"),
        ("hike-gear", "Какие ботинки и рюкзак выбрать для похода в горы?", "о снаряжении для похода"),
        ("hike-gear", "Что обязательно положить в рюкзак на однодневный трекинг?", "о снаряжении для трекинга"),
        ("packing", "Как собрать чемодан на три дня, чтобы взять только нужное?", "о сборах в поездку"),
        ("packing", "Что брать с собой в короткую поездку, чтобы ехать налегке?", "о сборах налегке"),
        ("travel-hacks", "Какие хитрости помогают путешествовать дешевле?", "о лайфхаках для путешествий"),
        ("travel-hacks", "Как спланировать поездку на пару дней без лишних трат?", "о планировании недорогой поездки"),
        ("trip-budget", "Сколько денег закладывать на поездку по Беларуси на выходные?", "о бюджете поездки"),
        ("trip-budget", "На чём можно сэкономить в автопутешествии?", "об экономии в автопутешествии"),
        ("first-aid", "Что взять в дорожную аптечку на неделю?", "об аптечке в дорогу"),
        ("clothes", "Какую одежду брать в поездку осенью?", "об одежде в поездку"),
        ("transport", "Что удобнее для поездки по Польше — поезд или машина?", "о транспорте в поездке"),
        ("sleep", "Где лучше ночевать в походе — в палатке или в агроусадьбе?", "о ночёвке в походе"),
        ("kids-trip", "Как развлечь ребёнка в долгой дороге на машине?", "о долгой дороге с ребёнком"),
    ),
    "en": (
        ("hike-food", "What food is worth carrying on a two-day hike?", "about hiking food"),
        ("hike-food", "What should I eat on the trail when camping for a few nights?", "about trail food"),
        ("hike-gear", "Which boots and backpack suit a mountain hike?", "about hiking gear"),
        ("packing", "How do I fit everything for three days into a carry-on?", "about packing for a short trip"),
        ("packing", "What is the minimum to bring for a two-day city trip?", "about travelling light"),
        ("travel-hacks", "Which tricks make a short trip cheaper and smoother?", "about travel tips"),
        ("travel-hacks", "How do I plan a two-day getaway without overspending?", "about planning a cheap getaway"),
        ("trip-budget", "How much money should I budget for a weekend in Poland?", "about a trip budget"),
        ("first-aid", "What belongs in a travel first-aid kit?", "about a travel first-aid kit"),
        ("clothes", "What clothes should I pack for a spring trip to Belarus?", "about clothes for a trip"),
    ),
    "be": (("hike-food", "Якія прадукты браць у двухдзённы паход?", "пра ежу ў паход"), ("packing", "Як сабрацца ў кароткую паездку налегцы?", "пра зборы ў паездку")),
    "uk": (("hike-food", "Які продукти брати у дводенний похід?", "про їжу в похід"), ("packing", "Як зібратися в коротку поїздку без зайвого багажу?", "про збори в поїздку")),
    "pl": (("hike-food", "Jakie jedzenie zabrać na dwudniową wędrówkę?", "o jedzeniu na wędrówkę"), ("packing", "Jak spakować się na krótki wyjazd z małym plecakiem?", "o pakowaniu na krótki wyjazd")),
}
EXACT_ONE_ASK = {
    "ru": ("Выбери один квест {loc} до {limit} минут — только один вариант, и скажи, сколько он идёт.",
           "Посоветуй только один квест {loc}, чтобы уложиться в {limit} минут.",
           "Какой один квест {loc} можно пройти за {limit} минут? Укажи его длительность.",
           "Мне нужен единственный вариант квеста {loc} короче {limit} минут, с длительностью."),
    "be": ("Патрэбны роўна адзін квэст {loc} не даўжэй за {limit} хвілін. Назаві яго і працягласць.",),
    "uk": ("Потрібен рівно один квест {loc} до {limit} хвилин. Назви його і тривалість.",),
    "pl": ("Potrzebuję dokładnie jednego questu {loc}, nie dłuższego niż {limit} minut. Podaj nazwę i czas.",),
    "en": ("I need exactly one quest {loc} that takes under {limit} minutes. Name it and give its duration.",),
}
EXACT_ONE_INTRO = {"ru": ("Подойдёт ровно один вариант:", "Если нужен один квест — вот он:"), "be": ("Падыдзе адзін варыянт:",),
                   "uk": ("Підійде один варіант:",), "pl": ("Pasuje jeden wariant:",), "en": ("One option fits:",)}
DURATION_LIMITS = (45, 60, 90, 120, 150, 180, 240, 300)
ONE_ARTICLE_ASK_RU = ("Дай одну статью {dat}, только статью, без квестов.", "Нужна ровно одна статья {dat} — какую выбрать?")
PAGE_ASK_TRAVEL_RU = ("О чём эта статья?", "Расскажи коротко, про что этот маршрут.", "Где проходит эта поездка?", "Что это за поездка, в двух словах?")
PAGE_ASK_QUEST = {
    "ru": {"facts": ("Сколько точек в этом квесте и сколько он длится?", "Сколько времени занимает этот квест?", "Какой этот маршрут по точкам и времени?"),
           "difficulty": ("Какая сложность у этого квеста?", "Этот квест сложный?"),
           "kids": ("Этот квест подойдёт ребёнку?", "Можно ли пройти этот квест с детьми?")},
    "be": {"facts": ("Колькі пунктаў у гэтым квэсце і колькі ён доўжыцца?",), "kids": ("Ці падыдзе гэты квэст дзіцяці?",)},
    "uk": {"facts": ("Скільки точок у цьому квесті і скільки він триває?",), "kids": ("Чи підійде цей квест дитині?",)},
    "pl": {"facts": ("Ile punktów ma ten quest i ile trwa?",), "kids": ("Czy ten quest nadaje się dla dziecka?",)},
    "en": {"facts": ("How many stops does this quest have and how long does it take?",), "kids": ("Is this quest suitable for a child?",)},
}
PAGE_FACTS = {
    "ru": "В квесте [{title}]({url}) {points} {points_word}, около {duration} мин.",
    "be": "У квэсце [{title}]({url}) пунктаў — {points}, каля {duration} хв.",
    "uk": "У квесті [{title}]({url}) точок — {points}, близько {duration} хв.",
    "pl": "Quest [{title}]({url}) ma {points} punktów i trwa ok. {duration} min.",
    "en": "The quest [{title}]({url}) has {points} stops and takes about {duration} min.",
}
PAGE_DIFFICULTY_RU = "Сложность квеста [{title}]({url}) по карточке — {difficulty}; {points} {points_word}, около {duration} мин."
PAGE_KIDS = {
    "ru": "Возрастные ограничения в карточке не указаны: [{title}]({url}) — городской квест, {points} {points_word}, около {duration} мин. Сколько лет ребёнку?",
    "be": "У картцы не пазначаны ўзроставыя абмежаванні: [{title}]({url}) — гарадскі квэст, пунктаў — {points}, каля {duration} хв. Колькі гадоў дзіцяці?",
    "uk": "У картці не вказано вікові обмеження: [{title}]({url}) — міський квест, точок — {points}, близько {duration} хв. Скільки років дитині?",
    "pl": "Karta nie podaje ograniczeń wiekowych: [{title}]({url}) — quest miejski, punktów — {points}, ok. {duration} min. Ile lat ma dziecko?",
    "en": "The card does not state age suitability: [{title}]({url}) is a city quest with {points} stops, about {duration} min. How old is the child?",
}
PAGE_TRAVEL_RU = ("Статья [{title}]({url}) — о поездке: {place}. {blurb}.", "Это [{title}]({url}): {place}. {blurb}.")
PAGE_SKIP_RE = re.compile(r"привет|здравствуй|юля и сергей|metravel|подписыва", re.I)
PAGE_TRAVEL_PLACE_RU = ("Статья [{title}]({url}) — о поездке: {place}.", "Это [{title}]({url}) — маршрут: {place}.")


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
    # `place` and `body` are what the card itself shows (edition 6 `page` answers use only them;
    # `blurb` may come from meta_description, which the visitor's card does not carry).
    return {"type": "travel", "title": title, "url": f"{SITE}/travels/{t['slug']}", "snippet": snippet, "place": place, "body": body,
            "blurb": blurb, "country": t.get("countryName") or "", "haystack": f"{title} {t.get('cityName') or ''} {t.get('countryName') or ''}".lower()}


def quest_points(q: dict) -> int:
    steps = q.get("steps")
    if isinstance(steps, str):
        try:
            steps = json.loads(steps)
        except ValueError:
            steps = None
    return len(steps) if isinstance(steps, list) else 0


def quest_audience(tags) -> dict | None:
    """`{kind, age, adult}` of a quest by its catalogue tags (a slug list or a `{tag: true}` map), or None.
    The same rule as api/aiAssist/questAudience.ts — a test compares the two on the tag fixtures; like
    utils/questTags.js, a list with a non-string item or any other shape reads as no tags at all."""
    if isinstance(tags, dict):
        slugs = [t for t, on in tags.items() if on]
    elif isinstance(tags, list) and all(isinstance(t, str) for t in tags):
        slugs = tags
    else:
        return None
    kind = "kids" if "kids" in slugs else "family" if "family" in slugs else None
    if not kind:
        return None
    ages = [tuple(map(int, m.groups())) for m in (re.fullmatch(r"age-(\d+)-(\d+)", t) for t in slugs) if m]
    return {"kind": kind, "age": (min(a for a, _ in ages), max(b for _, b in ages)) if ages else None, "adult": "adult-required" in slugs}


def quest_card(q: dict, audience: bool = False) -> dict:
    """Card as retrieval.ts questToSource builds it; `audience` (edition 8) — with the children's mark."""
    city = (q.get("city_name") or "").strip()
    country = (q.get("country_name") or "").strip()
    points = quest_points(q)
    duration = int(q["duration_min"]) if str(q.get("duration_min") or "").isdigit() else 0
    difficulty = DIFFICULTY_RU.get(q.get("difficulty") or "", "")
    who = quest_audience(q.get("tags")) if audience else None
    parts = [f"{AUDIENCE_HEAD_RU[who['kind']] if who else 'Городской квест'}{f' по городу {city}' if city else ''}{f' ({country})' if country else ''}"]
    if who and who["age"]:
        parts.append(f"Возраст: {who['age'][0]}–{who['age'][1]} лет")
    if who and who["adult"]:
        parts.append("Со взрослым")
    if points:
        parts.append(f"Точек: {points}")
    if duration:
        parts.append(f"Длительность: {duration} мин")
    if difficulty:
        parts.append(f"Сложность: {difficulty}")
    # buildQuestPath(city_alias, quest_id) — the address the assistant's cards carry.
    return {"type": "quest", "title": q["title"].strip(), "url": f"{SITE}/quests/{q['city_alias']}/{q['quest_id']}", "snippet": ". ".join(parts),
            "points": points, "duration": duration, "difficulty": difficulty, "country": country,
            "haystack": f"{q['title']} {city} {country}".lower(), **({"audience": who} if who else {})}


def for_kids(card: dict) -> bool:
    return card["type"] == "quest" and (card.get("audience") or {}).get("kind") == "kids"


def blurb(card: dict, lang: str) -> str:
    who = card.get("audience") if card["type"] == "quest" else None
    if who and card["points"] and card["duration"]:
        forms = AUDIENCE_BLURB[lang]
        age = forms["age"].format(lo=who["age"][0], hi=who["age"][1]) if who["kind"] == "kids" and who["age"] else ""
        return forms[who["kind"]].format(age=age, points=card["points"], points_word=ru_plural(card["points"], "точка", "точки", "точек"),
                                         duration=card["duration"])
    if card["type"] == "quest" and card["points"] and card["duration"]:
        return QUEST_BLURB[lang].format(points=card["points"], points_word=ru_plural(card["points"], "точка", "точки", "точек"), duration=card["duration"])
    if card["type"] == "quest":
        return QUEST_BLURB[lang].split(":")[0]
    return card["blurb"] if lang == "ru" else ""


def item_line(card: dict, lang: str, short: bool = False) -> str:
    tail = blurb(card, lang)
    title = short_title(card["title"]) if short else card["title"]
    return f"- [{title}]({card['url']})" + (f" — {tail}" if tail else "")


def cap(s: str) -> str:
    return s[:1].upper() + s[1:]


def be_fix(text: str) -> str:
    """Belarusian «у» after a vowel is «ў»: «квэсты ў Кракаве», «з дзецьмі ў Мінску»."""
    return re.sub(r"([аеёіоуыэюяАЕЁІОУЫЭЮЯ]) у ([А-ЯЁІЎ])", r"\1 ў \2", text)


def short_title(title: str) -> str:
    return title if len(title) <= 64 else title[:61].rsplit(" ", 1)[0] + "…"


def compose(intro: str, picks: list[dict], lang: str, rng: random.Random, compact: bool = False, short: bool = False, outro: bool = True,
            rest: bool = False) -> str:
    def compact_line(card: dict) -> str:
        # Keep the source identity and URL; stop long translated titles from
        # consuming the app's 400-token generation budget. No unobserved meta text.
        return f"- [{short_title(card['title'])}]({card['url']})"
    # Edition 6: short titles as in compact lines, but with the quest blurb in the answer
    # language — a title-only list of Russian titles reads as a Russian answer.
    lines = ([intro] if intro else []) + [(compact_line(c) if compact else item_line(c, lang, short)) for c in picks[:3]]
    # `rest` (edition 7 `crowded`): more matching cards than picks — the answer always says where the rest is.
    tail = rng.choice([o for o in OUTRO[lang] if o or not rest]) if outro and not compact else ""
    text = "\n".join(lines) + (f"\n\n{tail}" if tail else "")
    if len(text) > max_answer_chars():
        raise ValueError("answer longer than the prompt allows")
    return text


def family_card(card: dict) -> bool:
    return card["type"] == "quest" and (card.get("audience") or {}).get("kind") == "family"


def audience_picks(own: list[dict]) -> tuple[str, list[dict]]:
    """Edition 9: what a question about children names among the quests of the place that the prompt shows (in the
    order of the prompt): the children's quests only; none → the family ones only; no mark → two quests, age unknown.
    An ordinary quest next to a marked one is never named."""
    kids = [c for c in own if for_kids(c)]
    if kids:
        return "kids", kids[:3]
    family = [c for c in own if family_card(c)]
    if family:
        return "family", family[:3]
    return "none", own[:2]


def audience_answer(kids_intro: str, own: list[dict], lang: str, rng: random.Random) -> str:
    mode, picks = audience_picks(own)
    if mode == "kids":
        return compose(kids_intro, picks, lang, rng, short=True, outro=False)
    if mode == "family":
        return compose(FAMILY_INTRO[lang][0 if len(picks) == 1 else 1], picks, lang, rng, short=True, outro=False)
    return compose(KIDS_INTRO[lang], picks, lang, rng, short=True, outro=False) + "\n" + KIDS_UNKNOWN[lang]


def compose_links(intro: str, picks: list[dict], lang: str, rng: random.Random) -> str:
    """Edition 9 `crowded5`: three links without a blurb and the pointer to the sources list — five cards of one
    city stand in 1024 tokens only with this shortest item."""
    lines = [intro] + [f"- [{short_title(c['title'])}]({c['url']})" for c in picks[:3]]
    text = "\n".join(lines) + "\n\n" + rng.choice([o for o in OUTRO[lang] if o])
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


def crowded_cards(relevant: list[dict], rng: random.Random) -> list[dict]:
    """Edition 7: four or five matching cards of one place (a city or a country) in a random order, nothing else."""
    return rng.sample(relevant, min(len(relevant), rng.randint(CROWDED_MIN, CROWDED_MAX)))


def in_card_order(cards: list[dict], relevant: list[dict]) -> list[dict]:
    """The matching cards in the order of the prompt — the only order the model can see."""
    urls = {c["url"] for c in relevant}
    return [c for c in cards if c["url"] in urls]


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
    if edition not in (3, 4, 5, 6, 7, 8, 9):
        raise ValueError("rag_answers edition must be 3, 4, 5, 6, 7, 8 or 9")
    titles = load_quest_titles(ctx["sources"]) if edition >= 4 else {}
    travels_raw, quests_raw = load_raw(ctx["raw"])
    travels = [travel_card(t) for t in travels_raw if t.get("slug") and (t.get("name") or t.get("title"))]
    quests = [quest_card(q, audience=edition >= 8) for q in quests_raw if q.get("quest_id") and q.get("title") and q.get("city_alias")]
    everything = travels + quests
    out: list[dict] = []
    _dropped.clear()

    def emit(kind: str, place: str, lang: str, question: str, cards: list[dict], answer: str, n: int,
             key: str | None = None, history: list[dict] | None = None, required_evidence: str | None = None,
             keep: list[dict] | None = None, strict: bool = False) -> bool:
        # History turns too: prepare_training_data rejects the whole mix on a contour question in any user turn.
        if is_contour_question(question) or any(m["role"] == "user" and is_contour_question(m["content"]) for m in history or []):
            _dropped[f"contour_question:{kind}"] += 1
            return False
        # buildAssistantMessages sanitizes historical text, including newlines.
        history = [{**message, "content": sanitize_fragment(message["content"], 1200)} for message in history or []]
        # The training budget (assistant_prompt.fit_sources) drops unrelated cards and shortens snippets.
        if edition >= 9 and kind in WIDE_KINDS_9:
            limit = WIDE_BUDGET_9[lang]
        else:
            limit = CROWDED_CHARS_BUDGET if kind == "crowded" else SAMPLE_CHARS_BUDGET
        budget = limit - sum(len(m["content"]) for m in history or [])
        sources = [{k: c[k] for k in ("type", "title", "url", "snippet")} for c in cards]
        # Edition 7: matching cards the answer leaves to the sources list stay in the prompt.
        fit = {"budget": budget, "keep": frozenset(c["url"] for c in keep)} if keep else {"budget": budget}
        user = fit_sources(question, sources, answer, lang, **fit)
        if user is None and keep and kind != "crowded" and not strict:
            # The extra matching cards do not fit: the sample stays as before edition 7.
            fit = {"budget": budget}
            user = fit_sources(question, sources, answer, lang, **fit)
        if edition >= 6 and user is not None and not required_evidence:
            # Short snippets can lose «Длительность» or the article's first sentence; the answer
            # then names the item without a fact the model cannot see.
            seen = _observed_only(answer, user, cards)
            if seen != answer:
                answer, user = seen, fit_sources(question, sources, seen, lang, **fit)
        if user is None or (required_evidence and sanitize_fragment(required_evidence) not in user):
            _dropped[f"{'over_budget' if user is None else 'evidence_cut'}:{kind}"] += 1
            return False
        item = record(user, answer, set_name=NAME, license=LICENSE, kind=kind, key=key or f"place:{place}",
                      id=f"{kind}:{place}:{lang}:{n}", system=system_prompt(lang))
        if history:
            item["messages"] = [item["messages"][0], *history, *item["messages"][1:]]
        out.append(item)
        return True

    def render(intro: str, picks: list[dict], lang: str, kind: str = "") -> str:
        if edition >= 9 and kind == "kids":
            return audience_answer(intro or KIDS_INTRO[lang], picks, lang, rng)
        if edition >= 8 and kind == "kids" and any(for_kids(c) for c in picks):
            # The cards say which quest is for children: name those (at most two), with the age — no «не указаны».
            return compose(intro or KIDS_INTRO[lang], [c for c in picks if for_kids(c)][:2], lang, rng, short=True, outro=False)
        if edition >= 5 and kind == "kids":
            return compose(KIDS_INTRO[lang], picks[:2], lang, rng, compact=edition == 5, short=True, outro=False) + "\n" + KIDS_UNKNOWN[lang]
        return compose(intro, picks, lang, rng, compact=edition == 5, short=edition >= 6, rest=kind == "crowded")

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
                emit("pick", name, lang, q, cards, render(rng.choice(INTRO_RU["pick"]).format(**fill), picks, lang), n)
            if rel_quests:
                template = rng.choice(ASK_RU["quests"])
                shortest = "коротк" in template
                ordered = sorted(rel_quests, key=lambda c: c["duration"] or 10**6) if shortest else rel_quests
                cards = mixed_cards(ordered + rel_travels[:2], pool, rng)
                # Edition 7: the choice follows the cards as given; «самый короткий» — the visible durations.
                picks = (in_card_order(cards, ordered) if edition >= 7 and not shortest else [c for c in ordered if c in cards])[:3]
                intro = rng.choice(INTRO_RU["shortest" if shortest else "quests"]).format(**fill)
                emit("quests", name, lang, template.format(**fill), cards, render(intro, picks, lang), n,
                     keep=in_card_order(cards, ordered) if edition >= 7 else None)
                kid = rel_quests if edition >= 5 else ([c for c in rel_quests if c["difficulty"] == "лёгкий"] or rel_quests)
                cards = mixed_cards(kid + rel_travels[:2], pool, rng)
                picks = ((in_card_order(cards, kid) if edition >= 7 else [c for c in kid if c in cards])[:2] + [c for c in rel_travels[:1] if c in cards])[:3]
                marked = [c for c in in_card_order(cards, kid) if for_kids(c)] if edition >= 8 else []
                if edition >= 9:
                    pass  # edition 9: `kids` and the dialogue come from _emit_audience() with the rule «marked only»
                elif marked:
                    # Edition 8: the children's quests of the place, the other quests stay among the cards.
                    emit("kids", name, lang, rng.choice(ASK_RU["kids"]).format(**fill), cards,
                         render(rng.choice(KIDS_PICK_INTRO[lang]).format(**fill), marked, lang, "kids"), n, keep=in_card_order(cards, kid)[:4])
                else:
                    emit("kids", name, lang, rng.choice(ASK_RU["kids"]).format(**fill), cards,
                         render(rng.choice(INTRO_RU["kids"]).format(**fill), picks, lang, "kids"), n)
                others = [c for c in rel_quests if not for_kids(c)]
                if edition == 8 and n == 0 and any(for_kids(c) for c in rel_quests) and others:
                    # The follow-up of mt03: the first answer named the general quests, the second question is
                    # about a child — the cards hold a general quest and the children's one, the answer picks by the mark.
                    child = next(c for c in rel_quests if for_kids(c))
                    for follow_lang in ("ru", "be", "uk", "pl", "en"):
                        if follow_lang != "ru" and name not in PLACES_L10N:
                            continue
                        place = {"loc": loc} if follow_lang == "ru" else {"loc": PLACES_L10N[name][follow_lang]}
                        fix = be_fix if follow_lang == "be" else (lambda text: text)
                        first = [localize(c, follow_lang, titles) for c in others[:2]]
                        pair = [localize(c, follow_lang, titles) for c in (others[0], child)]
                        rng.shuffle(pair)
                        history = [{"role": "user", "content": fix(KIDS_FIRST_ASK[follow_lang].format(**place))},
                                   {"role": "assistant", "content": compose("", first, follow_lang, rng, short=True, outro=False)}]
                        emit("followup", name, follow_lang, rng.choice(KIDS_FOLLOW_ASK[follow_lang]), pair,
                             render(KIDS_FOLLOW_INTRO[follow_lang], pair, follow_lang, "kids"), per_place + 1, history=history,
                             keep=pair)
                if edition >= 5 and n == 0:
                    # A follow-up must retain the selected source link while
                    # keeping child suitability separate from easy difficulty.
                    follow_picks = kid[:1]
                    history = [{"role": "user", "content": f"Какие материалы собраны для поездки {loc}?"},
                               {"role": "assistant", "content": render("Можно начать здесь:", follow_picks, lang)}]
                    emit("followup", name, lang, "Если едем с ребёнком, на что обратить внимание в этой подборке?",
                         follow_picks, render("", follow_picks, lang, "kids"), n, history=history)
            ranked = rel_travels[:1] + rel_quests[:1] + rel_travels[1:] + rel_quests[1:]
            if len(ranked) >= 2:
                template = rng.choice(ASK_RU["limit"])
                limit = 1 if "одно" in template else 2
                cards = mixed_cards(ranked, pool, rng)
                picks = [c for c in ranked if c in cards][:limit]
                intro = "Если выбирать одно — это:" if limit == 1 else rng.choice(("Если выбирать два — это:", "Два лучших варианта:"))
                emit("limit", name, lang, template.format(**fill), cards, render(intro, picks, lang), n)
            if (n == 0 or edition >= 4) and ranked:
                q = rng.choice(INJECTED_V4 if edition >= 4 else ASK_RU["injected"]).format(ext=rng.choice(EXTERNAL), **fill)
                cards = mixed_cards(ranked, pool, rng)
                picks = [c for c in ranked if c in cards][:3]
                # Edition 3 opened with a meta sentence about links; edition 4 answers plainly.
                intro = ("" if edition >= 4 else "Ссылки даю только на страницы metravel.by. ") + rng.choice(INTRO_RU["pick"]).format(**fill)
                emit("injected", name, lang, q, cards, render(intro, picks, lang), n)
            if edition >= 4 and len(ranked) >= 5:
                # Many matching cards, no unrelated ones: still exactly three picks.
                cards = ranked[: rng.randint(6, MAX_CARDS)]
                rng.shuffle(cards)
                picks = [c for c in ranked if c in cards][:3]
                # «Какие квесты есть?» is not asked here: the three picks mix articles and quests.
                q = rng.choice(ASK_RU["pick"]).format(days=rng.choice(DAYS), **fill)
                emit("many", name, lang, q, cards, render(rng.choice(MANY_INTRO_RU).format(**fill), picks, lang), n)
            if (edition == 4 or edition >= 6) and ranked:
                template, about = rng.choice(CITY_TOPICS_RU)
                cards = mixed_cards(ranked, pool, rng)
                picks = [c for c in ranked if c in cards][:2]
                intro = rng.choice(CITY_TOPIC_INTRO_RU).format(about=about, **fill)
                emit("topic", name, lang, template.format(**fill), cards, render(intro, picks, lang), n)
            for kind in ("pick", "quests", "kids"):
                # Edition 4 covers every big city; edition 3 sampled them (same rng order as before).
                if name not in PLACES_L10N or (edition < 4 and rng.random() >= other_share * 2) or (kind != "pick" and not rel_quests):
                    continue
                if edition >= 9 and kind == "kids":
                    continue  # edition 9: _emit_audience() runs every language over the same cities
                languages = ("be", "uk", "pl", "en") if edition >= 5 else (rng.choice(("be", "uk", "pl", "en")),)
                for lang in languages:
                    if kind != "pick":
                        ordered, extra = rel_quests, rel_travels[:2]
                    else:
                        ordered, extra = (rel_travels[:1] + rel_quests[:2] + rel_travels[1:2]), rel_travels[2:]
                    cards = [localize(c, lang, titles) for c in mixed_cards(ordered + extra, pool, rng)]
                    urls = [c["url"] for c in ordered]
                    picks = sorted((c for c in cards if c["url"] in urls), key=lambda c: urls.index(c["url"]))[:3]
                    if edition >= 7 and kind != "pick":
                        picks = in_card_order(cards, ordered)[:3]
                    if edition >= 8 and kind == "kids" and any(for_kids(c) for c in cards):
                        picks = [c for c in in_card_order(cards, ordered) if for_kids(c)]
                    if picks:
                        l10n = {"loc": PLACES_L10N[name][lang]}
                        fix = be_fix if lang == "be" else (lambda text: text)
                        intro = fix(cap(INTRO_L10N[lang][kind].format(**l10n)))
                        question = (COMPACT_ASK[lang][kind] if edition >= 5 else rng.choice(ASK_L10N[lang][kind])).format(**l10n)
                        emit(kind, name, lang, fix(question), cards, render(intro, picks, lang, kind), n)
                        if edition >= 6:
                            # The natural phrasing next to the compact one, same cards and picks.
                            natural = rng.choice(ASK_L10N6[lang][kind]).format(**l10n)
                            emit(kind, name, lang, fix(natural), cards, render(intro, picks, lang, kind), per_place + n)
                        if edition >= 5 and kind == "quests" and len(rel_quests) >= 5:
                            many_cards = [localize(c, lang, titles) for c in rel_quests[:MAX_CARDS]]
                            rng.shuffle(many_cards)
                            emit("many", name, lang, fix(COMPACT_ASK[lang][kind].format(**l10n)),
                                 many_cards, render(intro, many_cards[:3], lang), n)

            if edition >= 7 and len(rel_quests) >= CROWDED_MIN:
                # Four or five quests of the place among the cards: three in card order, the rest in sources.
                templates = [t for t in ASK_RU["quests"] if "коротк" not in t]
                for v in range(CROWDED_VARIANTS):
                    cards = crowded_cards(rel_quests, rng)
                    intro = rng.choice(INTRO_RU["quests"]).format(**fill)
                    emit("crowded", name, "ru", rng.choice(templates).format(**fill), cards,
                         render(intro, cards[:3], "ru", "crowded"), per_place * v + n, keep=cards)
                if name in PLACES_L10N:
                    for lang in ("be", "uk", "pl", "en"):
                        l10n = {"loc": PLACES_L10N[name][lang]}
                        fix = be_fix if lang == "be" else (lambda text: text)
                        intro = fix(cap(INTRO_L10N[lang]["quests"].format(**l10n)))
                        for v in range(CROWDED_VARIANTS_L10N):
                            cards = [localize(c, lang, titles) for c in crowded_cards(rel_quests, rng)]
                            emit("crowded", name, lang, fix(rng.choice(ASK_L10N6[lang]["quests"]).format(**l10n)), cards,
                                 render(intro, cards[:3], lang, "crowded"), per_place * v + n, keep=cards)

            foreign = [c for c in pool if c["type"] == "quest"]
            if edition >= 8 and n == 0 and rel_quests and len(foreign) >= 2:
                # Fewer quests of the place among the cards than asked: only they are named, nothing is topped up.
                for lang in ("ru", "be", "uk", "pl", "en"):
                    if lang != "ru" and name not in PLACES_L10N:
                        continue
                    place = {"loc": loc} if lang == "ru" else {"loc": PLACES_L10N[name][lang]}
                    place["Loc"] = cap(place["loc"])
                    fix = be_fix if lang == "be" else (lambda text: text)
                    for own_count in range(1, min(len(rel_quests), 2) + 1):
                        own = rng.sample(rel_quests, own_count)
                        asked = rng.randint(own_count + 1, 3)
                        # at most four cards: with five the budget cuts every snippet down to the head
                        cards = [localize(c, lang, titles) for c in own + rng.sample(foreign, min(len(foreign), rng.randint(2, 4 - own_count)))]
                        rng.shuffle(cards)
                        picks = in_card_order(cards, own)
                        answer = (compose(fix(SCARCE_INTRO[lang][own_count].format(**place)), picks, lang, rng, short=True, outro=False)
                                  + "\n\n" + fix(SCARCE_TAIL[lang].format(**place)))
                        emit("scarce", name, lang, fix(rng.choice(SCARCE_ASK[lang][asked]).format(**place)), cards, answer, own_count, keep=cards)

    covered = " ".join(c["haystack"] for c in everything)
    for name, loc, about, pattern in ABSENT_RU:
        if re.search(pattern, covered, re.I):
            continue
        for n in range(per_place + 1):
            cards = rng.sample(everything, rng.randint(2, MAX_CARDS))
            nearest = cards[0]
            q = rng.choice(ASK_RU["no_material"]).format(loc=loc, about=about)
            tail = blurb(nearest, "ru") or "материал о другом направлении"
            if edition >= 5:
                answer = f"Материалов {about} в карточках нет. Ближайшее из найденного:\n" + compose("", [nearest], "ru", rng, compact=True).lstrip()
            else:
                answer = rng.choice(NO_MATERIAL_RU).format(about=about, title=nearest["title"], url=nearest["url"], blurb=tail)
            emit("no_material", name, "ru", q, cards, answer, n)

    if edition == 4 or edition >= 6:
        outdoor = [c for c in everything if OUTDOOR_RE.search(c["title"])]
        topics_by_lang = {lang: tuple(TOPICS[lang]) + (tuple(TOPICS6.get(lang, ())) if edition >= 6 else ()) for lang in TOPICS}
        for lang, topics in topics_by_lang.items():
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
    if edition >= 5:
        _emit_boundary(emit, everything, titles, rng, per_place)
    if edition >= 6:
        _emit_exact_one(emit, travels, quests, titles, rng)
        _emit_page(emit, travels, quests, titles, rng,
                   int(options.get("page_travels", 60)), int(options.get("page_quests", 80)))
    if edition >= 9:
        # an own random stream: the draws above stay what edition 8 makes of them
        rng9 = random.Random(f"{ctx['seed']}:{NAME}:9")
        _emit_audience(emit, travels, quests, titles, rng9)
        _emit_crowded5(emit, quests, titles, rng9)
    return out


def _observed_only(answer: str, user: str, cards: list[dict]) -> str:
    """Edition 6: drop an item's « — blurb» when the fitted user message no longer shows it in that
    card (quest points/duration, the article's sentence). A shorter answer only lengthens snippets
    on the second fit_sources pass, so the kept blurbs stay visible."""
    lines = answer.split("\n")
    for i, line in enumerate(lines):
        for card in cards:
            marker = f"]({card['url']}) — "
            if marker not in line:
                continue
            head, tail = line.split(marker, 1)
            block = user.split(f"— {card['url']}\n", 1)[1].split("\n\n", 1)[0] if f"— {card['url']}\n" in user else ""
            if card["type"] == "quest":
                facts = (f"Точек: {card['points']}", f"Длительность: {card['duration']} мин") if re.search(r"\d", tail) else ()
                who = card.get("audience")
                if who:
                    # «детский квест для 8–10 лет» is a fact of the card too: the shortened snippet must still show it.
                    facts += (AUDIENCE_HEAD_RU[who["kind"]],) + ((f"Возраст: {who['age'][0]}–{who['age'][1]} лет",) if who["kind"] == "kids" and who["age"] else ())
                visible = all(fact in block for fact in facts)
            else:
                visible = sanitize_fragment(tail.rstrip(".")) in block
            if not visible:
                lines[i] = f"{head}]({card['url']})" + ("." if tail.endswith(".") else "")
            break
    return "\n".join(lines)


def _emit_exact_one(emit, travels: list[dict], quests: list[dict], titles: dict, rng: random.Random) -> None:
    """«Ровно один квест {loc} до N минут» → the one card under the limit, with its duration;
    «одна статья {dat}» → one article. v5-rag answered «ровно один» with two items and no
    duration (quality q01/q03/q08/q09, 01.11.2026). The limit is the next step of
    DURATION_LIMITS above the chosen quest; the other quest cards of the place are longer than
    it, so exactly one card satisfies the question."""
    for name, loc, dat, pattern in PLACES_RU:
        rx = re.compile(pattern, re.I)
        rel_quests = [c for c in quests if rx.search(c["haystack"]) and c["duration"] and c["points"]]
        rel_travels = best_travels([c for c in travels if rx.search(c["haystack"])], rx)
        others = [c for c in travels + quests if not rx.search(c["haystack"])]
        if rel_quests:
            chosen = rng.choice(rel_quests)
            limit = next((step for step in DURATION_LIMITS if step > chosen["duration"]), None)
            if limit is not None:
                longer = [c for c in rel_quests if c["duration"] > limit]
                languages = ("ru",) + (("be", "uk", "pl", "en") if name in PLACES_L10N else ())
                for lang in languages:
                    cards = [chosen] + rng.sample(longer, min(len(longer), 3)) + rng.sample(others, min(len(others), rng.randint(1, 2)))
                    cards = [localize(c, lang, titles) for c in cards]
                    rng.shuffle(cards)
                    loc_l = loc if lang == "ru" else PLACES_L10N[name][lang]
                    fix = be_fix if lang == "be" else (lambda text: text)
                    question = fix(rng.choice(EXACT_ONE_ASK[lang]).format(loc=loc_l, limit=limit))
                    answer = compose(rng.choice(EXACT_ONE_INTRO[lang]), [localize(chosen, lang, titles)], lang, rng, short=True, outro=False)
                    emit("exact_one", name, lang, question, cards, answer, 0, required_evidence=f"Длительность: {chosen['duration']} мин")
        if len(rel_travels) >= 2:
            cards = rel_travels[:3] + [c for c in quests if rx.search(c["haystack"])][:2]
            rng.shuffle(cards)
            question = rng.choice(ONE_ARTICLE_ASK_RU).format(dat=dat)
            emit("one_article", name, "ru", question, cards, compose("Если нужна одна статья — это:", rel_travels[:1], "ru", rng, short=True, outro=False), 0)


def _emit_page(emit, travels: list[dict], quests: list[dict], titles: dict, rng: random.Random, n_travels: int, n_quests: int) -> None:
    """The visitor opened an article or a quest and asks about *this* page (#2897): the page's card
    comes first among at most three (sourceRef.pinSourceFirst, AI_SOURCES_LIMIT_PINNED). The answer
    is about card [1] alone: its facts from the snippet, its link, nothing from the neighbours."""
    def pin(card: dict, lang: str) -> list[dict]:
        pool = [c for c in travels + quests if c["url"] != card["url"]]
        return [localize(c, lang, titles) for c in [card] + rng.sample(pool, min(len(pool), rng.randint(0, 2)))]

    for card in rng.sample(travels, min(n_travels, len(travels))):
        if not card["place"]:
            continue
        sentence = first_sentence(card["body"])
        fill = {"title": short_title(card["title"]), "url": card["url"], "place": card["place"], "blurb": sentence.rstrip("!?")}
        if (sentence != TRAVEL_BLURB_FALLBACK and sentence in card["snippet"] and not PAGE_SKIP_RE.search(sentence)
                and sentence.count("«") == sentence.count("»")):  # «О чём молчат храмы. → cut inside a quote
            answer, evidence = rng.choice(PAGE_TRAVEL_RU).format(**fill), sentence
        else:
            answer, evidence = rng.choice(PAGE_TRAVEL_PLACE_RU).format(**fill), card["place"]
        emit("page", card["url"].rsplit("/", 1)[-1], "ru", rng.choice(PAGE_ASK_TRAVEL_RU), pin(card, "ru"), answer, 0,
             key=f"page:{card['url']}", required_evidence=evidence)
    rotation = ("be", "uk", "pl", "en")
    for index, card in enumerate(rng.sample(quests, min(n_quests, len(quests)))):
        if not (card["duration"] and card["points"]):
            continue
        fill = {"title": short_title(card["title"]), "url": card["url"], "points": card["points"],
                "points_word": ru_plural(card["points"], "точка", "точки", "точек"), "duration": card["duration"], "difficulty": card["difficulty"]}
        kind = rng.choice(("facts", "facts", "kids") + (("difficulty",) if card["difficulty"] else ()))
        answer = {"facts": PAGE_FACTS["ru"], "kids": PAGE_KIDS["ru"], "difficulty": PAGE_DIFFICULTY_RU}[kind].format(**fill)
        evidence = f"Сложность: {card['difficulty']}" if kind == "difficulty" else f"Длительность: {card['duration']} мин"
        if kind == "kids" and for_kids(card):
            # Edition 8 (only then a card carries `audience`): the card answers the question itself.
            answer, evidence = PAGE_KIDS_TAGGED["ru"].format(title=fill["title"], url=card["url"], blurb=blurb(card, "ru")), AUDIENCE_HEAD_RU["kids"]
        emit("page", card["url"].rsplit("/", 1)[-1], "ru", rng.choice(PAGE_ASK_QUEST["ru"][kind]), pin(card, "ru"), answer, 0,
             key=f"page:{card['url']}", required_evidence=evidence)
        if index % 2 == 0:
            lang = rotation[(index // 2) % len(rotation)]
            kind = rng.choice(("facts", "kids"))
            local = localize(card, lang, titles)
            answer = {"facts": PAGE_FACTS, "kids": PAGE_KIDS}[kind][lang].format(**{**fill, "title": short_title(local["title"])})
            evidence = f"Длительность: {card['duration']} мин"
            if kind == "kids" and for_kids(card):
                answer, evidence = PAGE_KIDS_TAGGED[lang].format(title=short_title(local["title"]), url=card["url"], blurb=blurb(card, lang)), AUDIENCE_HEAD_RU["kids"]
            emit("page", card["url"].rsplit("/", 1)[-1], lang, rng.choice(PAGE_ASK_QUEST[lang][kind]), pin(card, lang), answer, 1,
                 key=f"page:{card['url']}", required_evidence=evidence)


def _emit_boundary(emit, everything: list[dict], titles: dict, rng: random.Random, per_place: int) -> None:
    """Trip context can mention food, equipment or money without being off-topic.

    Missing-topic targets never invent practical advice. Positive partners ask
    for a concrete travel choice, answered only with supplied quest facts.
    All phrasings/partners of a topic share its split key across both languages.
    """
    outdoor = [c for c in everything if c["type"] == "travel" and OUTDOOR_RE.search(c["title"])]
    quests = [c for c in everything if c["type"] == "quest" and c["duration"]]
    for lang, topics in BOUNDARY.items():
        for i, (topic, question, about) in enumerate(topics):
            for n in range(per_place):
                # The source is explicitly a nearby travel material, not purported
                # evidence for meals, luggage size or prices that the card lacks.
                candidates = outdoor if topic in OUTDOOR_TOPICS and outdoor else everything
                # Do not claim a topic is missing if the actual snippet names it.
                evidence = BOUNDARY_EVIDENCE[topic]
                if lang == "ru":
                    supported = [c for c in everything if c["type"] == "travel" and re.search(evidence, c["snippet"], re.I)]
                    if supported:
                        card = rng.choice(supported)
                        sentences = re.split(r"(?<=[.!?])\s+", card["snippet"])
                        excerpt = next(sentence for sentence in sentences if re.search(evidence, sentence, re.I))
                        # Copy a complete short source sentence; no guessed
                        # translation or paraphrase can add unsupported advice.
                        if len(excerpt) <= 220 and not excerpt.endswith("…"):
                            answer = (f"В материале есть такая информация: «{excerpt}» "
                                      f"[{short_title(card['title'])}]({card['url']}). "
                                      "Это сведения из карточки; отдельного совета сверх них здесь нет.")
                            emit("boundary_evidence", f"boundary-{i}", lang, question,
                                 [{**card, "snippet": excerpt}], answer, n, key=f"topic:{topic}", required_evidence=excerpt)
                pool = [c for c in candidates if not re.search(evidence, c["title"] + " " + c["snippet"], re.I)]
                if not pool:
                    continue
                nearest = localize(rng.choice(pool), lang, titles)
                cards = [nearest]
                if lang == "ru":
                    answer = (f"В этих карточках нет сведений {about}, поэтому конкретный совет из них не получить. "
                              f"Ближайший материал о поездке — [{short_title(nearest['title'])}]({nearest['url']}). "
                              "Он поможет с маршрутом; сведения по вашему вопросу нужно уточнить отдельно.")
                else:
                    answer = (f"These cards contain no details {about}, so I cannot derive that advice from them. "
                              f"The nearest travel material is [{short_title(nearest['title'])}]({nearest['url']}). "
                              "It can help with the itinerary; details for your specific question are not supplied.")
                emit("boundary_missing", f"boundary-{i}", lang, question, cards, answer, n, key=f"topic:{topic}")
                if not quests:
                    continue
                card = localize(rng.choice(quests), lang, titles)
                if lang == "ru":
                    positive = question + " Начну с маршрута: предложи один квест и укажи длительность."
                    answer = (f"Сведений {about} в этой карточке нет. Для маршрута можно начать с "
                              f"[{short_title(card['title'])}]({card['url']}): в карточке указано {card['duration']} мин.")
                else:
                    positive = question + " For the itinerary, suggest one quest and state its duration."
                    answer = (f"The card does not provide details {about}. For the itinerary, try "
                              f"[{short_title(card['title'])}]({card['url']}): the card states {card['duration']} minutes.")
                emit("boundary_pick", f"boundary-{i}", lang, positive, [card], answer, n, key=f"topic:{topic}",
                     required_evidence=f"Длительность: {card['duration']} мин")


def _drawn(attempt) -> None:
    """Edition 9: `attempt()` draws and emits one sample and says whether it was emitted; it runs again (other cards,
    other wording) up to RETRIES_9 times. The drop of an attempt that is repeated is not counted in `_dropped`."""
    for i in range(RETRIES_9):
        before = Counter(_dropped)
        if attempt():
            return
        if i < RETRIES_9 - 1:
            _dropped.clear()
            _dropped.update(before)


def _identity(text: str) -> str:
    return text


def _cities9() -> dict[str, dict[str, str]]:
    return {**PLACES_L10N, **PLACES_L10N_EXTRA}


def _own_cards(rng: random.Random, own_all: list[dict], kids_n: int, family_n: int, total: int) -> list[dict]:
    """`kids_n` children's, `family_n` family quests and ordinary ones up to `total` (at least one ordinary, when
    the place has one), in a random order — what the prompt shows of the place."""
    kids, family = [c for c in own_all if for_kids(c)], [c for c in own_all if family_card(c)]
    plain = [c for c in own_all if not c.get("audience")]
    chosen = rng.sample(kids, min(kids_n, len(kids))) + rng.sample(family, min(family_n, len(family)))
    chosen += rng.sample(plain, min(max(total - len(chosen), 1), len(plain)))
    rng.shuffle(chosen)
    return chosen


def _emit_audience(emit, travels: list[dict], quests: list[dict], titles: dict, rng: random.Random) -> None:
    """Edition 9: questions about children and direct requests for one quest, every language over the same cities."""
    cities = _cities9()
    for name, loc_ru, _dat, pattern in PLACES_RU:
        if name not in cities:
            continue
        rx = re.compile(pattern, re.I)
        own_all = [c for c in quests if rx.search(c["haystack"])]
        if not own_all:
            continue
        articles = best_travels([c for c in travels if rx.search(c["haystack"])], rx)
        foreign = [c for c in quests if not rx.search(c["haystack"])]
        foreign_kids = [c for c in foreign if for_kids(c)]
        kids, family = [c for c in own_all if for_kids(c)], [c for c in own_all if family_card(c)]
        plain = [c for c in own_all if not c.get("audience")]
        if kids:
            kid_plans = [(1, 0), (min(2, len(kids)), 0) if len(kids) >= 2 else (1, 1 if family else 0)]
            follow_plans = [(1, 0), (min(2, len(kids)), 0) if len(kids) >= 2 else (0, 0)]
        elif family:
            kid_plans = [(0, 1)]
            follow_plans = [(0, 1)]
        else:
            kid_plans = [(0, 0)]
            follow_plans = [(0, 0)]

        def totals() -> int:
            return rng.choice((2, 3, 3, 4, 4, 5, 5))

        for lang in LANGS5:
            loc = loc_ru if lang == "ru" else cities[name][lang]
            fix = be_fix if lang == "be" else _identity
            local = lambda cards: [localize(c, lang, titles) for c in cards]  # noqa: E731

            def shown(own: list[dict]) -> tuple[list[dict], list[dict]]:
                """Cards of the prompt (own ones plus, rarely, cards of other cities and an article of the place) and
                the own ones in the order of the prompt."""
                extra: list[dict] = []
                if len(own) < 4 and foreign and rng.random() < FOREIGN_SHARE:
                    pool = foreign_kids if foreign_kids and rng.random() < 0.5 else foreign
                    extra += rng.sample(pool, min(len(pool), rng.randint(1, 2)))
                if len(own) < 4 and articles and rng.random() < 0.2:
                    extra.append(articles[0])
                cards = own + extra
                rng.shuffle(cards)
                urls = {c["url"] for c in own}
                return local(cards), [c for c in local(cards) if c["url"] in urls]

            asks = (*ASK_RU["kids"], *KIDS_ASK9["ru"]) if lang == "ru" else (*ASK_L10N[lang]["kids"], *ASK_L10N6[lang]["kids"], COMPACT_ASK[lang]["kids"], *KIDS_ASK9[lang])
            def kids_sample(v: int, m: int, f: int) -> bool:
                own = _own_cards(rng, own_all, m, f, totals())
                cards, in_order = shown(own)
                intro = fix(rng.choice(KIDS_PICK_INTRO[lang]).format(loc=loc))
                return emit("kids", name, lang, fix(rng.choice(asks).format(loc=loc)), cards, audience_answer(intro, in_order, lang, rng), v,
                            keep=in_order, strict=True)

            for v, (m, f) in enumerate(kid_plans):
                _drawn(lambda v=v, m=m, f=f: kids_sample(v, m, f))

            first_ask = fix(KIDS_FIRST_ASK[lang].format(loc=loc))
            follow_asks = (*KIDS_FOLLOW_ASK[lang], *KIDS_FOLLOW_ASK9[lang])
            def follow_sample(v: int, m: int, f: int) -> bool:
                own = _own_cards(rng, own_all, m, f, max(totals(), 2))
                if len(own) < 2:
                    return True  # «какой из них» needs at least two quests of the place: nothing to draw again
                cards, in_order = shown(own)
                # the first answer listed two or three of the quests, as a rule the ordinary ones
                listed = [c for c in in_order if not c.get("audience")] if rng.random() < 0.7 else list(in_order)
                listed = (listed or list(in_order))[:rng.randint(2, 3)]
                history = [{"role": "user", "content": first_ask},
                           {"role": "assistant", "content": compose("", listed, lang, rng, compact=True)}]
                return emit("kids_followup", name, lang, rng.choice(follow_asks), cards, audience_answer(KIDS_FOLLOW_INTRO[lang], in_order, lang, rng), v,
                            history=history, keep=in_order, strict=True)

            if len(own_all) >= 2 and name not in HELDOUT_CITIES_9["kids_followup"]:
                for v, (m, f) in enumerate(follow_plans):
                    _drawn(lambda v=v, m=m, f=f: follow_sample(v, m, f))

            def one_marked_sample() -> bool:
                # exactly one children's card among the cards: «назови только его»
                own = _own_cards(rng, own_all, 1, 1 if family and rng.random() < 0.3 else 0, totals())
                cards, in_order = shown(own)
                marked = [c for c in in_order if for_kids(c)]
                answer = compose(fix(rng.choice(ONE_KIDS_INTRO[lang])), marked, lang, rng, short=True, outro=False)
                return emit("one_marked", name, lang, fix(rng.choice(ONE_KIDS_ASK[lang]).format(loc=loc)), cards, answer, 0, keep=in_order, strict=True)

            def one_any_sample() -> bool:
                # no marked card in the prompt: the first card is the choice, the only criterion the model sees
                own = rng.sample(plain, min(len(plain), totals()))
                own = own if len(own) >= 2 else plain[:2]
                cards, in_order = shown(own)
                answer = compose(fix(rng.choice(ONE_ANY_INTRO[lang])), in_order[:1], lang, rng, short=True, outro=False)
                return emit("one_any", name, lang, fix(rng.choice(ONE_ANY_ASK[lang]).format(loc=loc)), cards, answer, 0, keep=in_order, strict=True)

            if kids and name not in HELDOUT_CITIES_9["one_marked"]:
                _drawn(one_marked_sample)
            if len(plain) >= 2 and name not in HELDOUT_CITIES_9["one_any"]:
                _drawn(one_any_sample)


CROWDED5_VARIANTS = 3
CROWDED_INJECTED_VARIANTS = 4


def _emit_crowded5(emit, quests: list[dict], titles: dict, rng: random.Random) -> None:
    """Edition 9: exactly five quests of a city, three links without a blurb and the pointer to the sources list;
    in Russian also under the foreign-link requests of `injected`. Cities only (a country holds many cities)."""
    cities = _cities9()
    for name, loc_ru, dat_ru, pattern in PLACES_RU:
        if name not in cities:
            continue
        rx = re.compile(pattern, re.I)
        own_all = [c for c in quests if rx.search(c["haystack"])]
        if len(own_all) < 5:
            continue
        for lang in LANGS5:
            loc = loc_ru if lang == "ru" else cities[name][lang]
            fix = be_fix if lang == "be" else _identity
            asks = [t for t in ASK_RU["quests"] if "коротк" not in t] if lang == "ru" else list(ASK_L10N6[lang]["quests"])
            intro = INTRO_RU["quests"][0].format(loc=loc, Loc=cap(loc)) if lang == "ru" else fix(cap(INTRO_L10N[lang]["quests"].format(loc=loc)))
            def crowded_sample(v: int) -> bool:
                cards = [localize(c, lang, titles) for c in rng.sample(own_all, 5)]
                return emit("crowded5", name, lang, fix(rng.choice(asks).format(loc=loc, dat=dat_ru if lang == "ru" else loc)), cards,
                            compose_links(intro, cards[:3], lang, rng), v, keep=cards, strict=True)

            if name in HELDOUT_CITIES_9["crowded5"]:
                continue
            for v in range(CROWDED5_VARIANTS):
                _drawn(lambda v=v: crowded_sample(v))

        def injected_sample(v: int) -> bool:
            cards = rng.sample(own_all, 5)
            ask = rng.choice(INJECTED_V4).format(loc=loc_ru, ext=rng.choice(EXTERNAL))
            intro = rng.choice(INTRO_RU["quests"]).format(loc=loc_ru, Loc=cap(loc_ru))
            return emit("crowded_injected", name, "ru", ask, cards, compose_links(intro, cards[:3], "ru", rng), v, keep=cards, strict=True)

        if name in HELDOUT_CITIES_9["crowded_injected"]:
            continue
        for v in range(CROWDED_INJECTED_VARIANTS):
            _drawn(lambda v=v: injected_sample(v))


def source_info(ctx: dict) -> dict:
    manifest = ctx["raw"] / "manifest.json"
    return {"raw": str(ctx["raw"]), "export": json.loads(manifest.read_text(encoding="utf-8")) if manifest.exists() else None,
            "prompt": "scripts/ai-train/assistant_prompt.json", "dropped": dict(sorted(_dropped.items()))}
