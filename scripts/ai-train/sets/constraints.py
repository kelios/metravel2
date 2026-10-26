"""Independent, fictional training-only joint-constraint scenarios for v5.

120 scenarios × four questions; all phrasings/permutations share a split key.
No evaluation input is read here. Full cards are retained; exact tokenizer
preparation rejects a whole overlong conversation rather than hiding a fact.
"""
from __future__ import annotations

from datetime import date, timedelta

from sets.assistant_prompt import build_user_message, system_prompt
from sets.common import record

NAME = "constraints"
LICENSE = "own synthetic training-only scenarios; not real venue information"
KINDS = ("date_time", "rain_budget", "wheelchair", "gurney_unknown",
         "lowvision", "none_fit", "unknown_info", "followup")
VARIANTS = 4
SCENARIOS_PER_KIND = 15


def _clock(minutes: int) -> str:
    return f"{minutes // 60:02}:{minutes % 60:02}"


def _day(value: str) -> str:
    d = date.fromisoformat(value)
    return f"{d.day} {'ноября' if d.month == 11 else 'декабря'} {d.year} года"


def _cards(number: int, facts: list[dict], snippets: list[str]) -> list[dict]:
    cards = []
    for index, (item, snippet) in enumerate(zip(facts, snippets)):
        title = f"Учебный Рэви-{number:03}-{chr(1040 + index)}"
        cards.append({"type": "travel", "title": title,
                      "url": f"https://metravel.by/travels/train-constraints-{number:03}-{index}",
                      "snippet": snippet, "facts": item})
    return cards


def make_scenario(kind: str, index: int) -> dict:
    """Return explicit facts and visitor requirements, without a memorised label."""
    if kind not in KINDS or not 0 <= index < SCENARIOS_PER_KIND:
        raise ValueError("unknown kind or scenario index")
    number = KINDS.index(kind) * SCENARIOS_PER_KIND + index + 1
    duration, budget = 27 + 6 * (index % 7), 19 + 4 * (index % 10)
    req, facts, snippets = {}, [], []
    if kind == "date_time":
        visit = date(2026, 11 if index % 2 == 0 else 12, 3 + index)
        arrival, remaining = 13 * 60 + index * 7, duration + (-7 if index % 3 == 0 else 11)
        req = {"date": visit.isoformat(), "arrival": arrival}
        facts = [
            {"opens": visit.isoformat(), "opens_at": 9 * 60, "closes": arrival + remaining, "duration": duration},
            {"opens": (visit + timedelta(days=2)).isoformat(), "opens_at": 9 * 60, "closes": arrival + remaining, "duration": duration},
            {"opens": visit.isoformat(), "opens_at": 9 * 60, "closes": arrival + duration - 4, "duration": duration},
        ]
        snippets = [f"Открытие {_day(f['opens'])}. Часы работы {_clock(f['opens_at'])}–{_clock(f['closes'])}. Осмотр {f['duration']} мин." for f in facts]
    elif kind in ("rain_budget", "none_fit", "followup"):
        req = {"indoor": True, "budget": budget, "max_duration": duration + 5}
        facts = [
            {"indoor": True, "cost": budget, "duration": duration},
            {"indoor": False, "cost": budget - 3, "duration": duration},
            {"indoor": True, "cost": budget + 7, "duration": duration},
        ]
        if kind == "none_fit":
            facts[0]["duration"] = duration + 12
        if kind == "followup":
            facts = [
                {"indoor": True, "cost": budget, "duration": duration + 12},
                {"indoor": True, "cost": budget, "duration": duration},
                {"indoor": True, "cost": budget + 7, "duration": duration},
            ]
        snippets = [f"{'Полностью в помещении' if f['indoor'] else 'Полностью на открытом воздухе'}. Осмотр {f['duration']} мин. Вход {f['cost']} руб. за человека." for f in facts]
    elif kind == "wheelchair":
        width = 67 + 4 * (index % 5)
        req = {"device_width": width, "continuous_stepfree": True}
        facts = [{"route_width": width + 4, "continuous_stepfree": True},
                 {"route_width": width - 2, "continuous_stepfree": True},
                 {"route_width": width + 4, "continuous_stepfree": False}]
        snippets = [f"Лёгкий семейный маршрут. Самое узкое место ВСЕГО пути {f['route_width']} см. {'Весь путь без ступеней, включая вход и залы' if f['continuous_stepfree'] else 'Вход без ступеней, между залами лестница без подъёмника'}." for f in facts]
    elif kind == "gurney_unknown":
        req = {"device": "gurney", "dimensions_known": False}
        facts = [{"chair_access": True, "door_width": 77 + index, "gurney_route_known": False},
                 {"chair_access": True, "door_width": 82 + index, "gurney_route_known": False},
                 {"chair_access": False, "door_width": 74 + index, "gurney_route_known": False}]
        snippets = [f"Семейный зал. {'Для инвалидного кресла вход доступен' if f['chair_access'] else 'У входа ступени'}. Дверь {f['door_width']} см. Размеры проходов и поворотов для санитарной каталки не указаны." for f in facts]
    elif kind == "lowvision":
        has_companion = index % 2 == 0
        req = {"adaptation": True, "has_companion": has_companion, "budget": budget}
        admission, companion = budget - 6, 6
        facts = [{"audio": has_companion, "tactile": not has_companion, "allows_solo": not has_companion, "requires_companion": has_companion, "cost": budget + 5 if index % 4 == 3 else admission, "companion_cost": companion},
                 {"audio": not has_companion, "tactile": False, "allows_solo": False, "requires_companion": True, "cost": admission, "companion_cost": companion},
                 {"audio": True, "tactile": True, "allows_solo": True, "requires_companion": False, "cost": budget + 8, "companion_cost": companion}]
        snippets = [f"Аудиоописание: {'да' if f['audio'] else 'нет'}; тактильная схема: {'да' if f['tactile'] else 'нет'}. {'Самостоятельное посещение разрешено, сопровождающий необязателен' if f['allows_solo'] else 'Самостоятельное посещение запрещено, сопровождающий обязателен'}. Билет {f['cost']} руб., сопровождающему {f['companion_cost']} руб." for f in facts]
    else:
        requested = ("child_price", "forecast", "access")[index // 5]
        req = {"requested": requested, "child_age": 5 + index % 7,
               "visit_date": date(2026, 11 if index % 2 == 0 else 12, 4 + index).isoformat(), "max_duration": duration + 5}
        facts = [{"adult_price": budget + 3 * j, "child_price": None, "duration": duration + 8 * j,
                  "forecast": None, "audio": None, "tactile": None, "allows_solo": None} for j in range(3)]
        if requested == "child_price":
            snippets = [f"Семейный зал. Взрослый билет {f['adult_price']} руб. Цена детского билета и возрастные льготы не указаны." for f in facts]
        elif requested == "forecast":
            snippets = [f"Прогулка на открытом воздухе, {f['duration']} мин. Прогноз дождя на {_day(req['visit_date'])} не приведён." for f in facts]
        else:
            snippets = [f"Осмотр {f['duration']} мин. Сведения об аудиоописании, тактильной схеме и правилах самостоятельного посещения не указаны." for f in facts]
    return {"kind": kind, "number": number, "requirements": req, "cards": _cards(number, facts, snippets)}


def eligible(scenario: dict, facts: dict) -> bool | None:
    """Tri-state eligibility: unknown is not false and never a safe promise."""
    req, kind = scenario["requirements"], scenario["kind"]
    if kind == "date_time":
        return (facts["opens"] <= req["date"] and facts["opens_at"] <= req["arrival"]
                and facts["closes"] - req["arrival"] >= facts["duration"])
    if kind in ("rain_budget", "none_fit", "followup"):
        return facts["indoor"] and facts["cost"] <= req["budget"] and facts["duration"] <= req["max_duration"]
    if kind == "wheelchair":
        return facts["continuous_stepfree"] and facts["route_width"] >= req["device_width"]
    if kind == "lowvision":
        return ((facts["audio"] or facts["tactile"])
                and (req["has_companion"] or (facts["allows_solo"] and not facts["requires_companion"]))
                and facts["cost"] + (facts["companion_cost"] if req["has_companion"] else 0) <= req["budget"])
    return None


def _link(card: dict) -> str:
    return f"[{card['title']}]({card['url']})"


def _question(scenario: dict, variant: int) -> str:
    req, kind = scenario["requirements"], scenario["kind"]
    lead = ("Выбери ровно один подходящий вариант. ", "Нужен один вариант по всем условиям. ",
            "Какой единственный объект подходит? ", "Посоветуй один объект с учётом каждого условия. ")[variant]
    if kind == "date_time":
        return lead + f"Визит {_day(req['date'])}, приходим в {_clock(req['arrival'])}. Объект уже должен работать; осмотр нужно закончить до закрытия. Укажи оставшееся время."
    if kind in ("rain_budget", "none_fit"):
        return lead + f"Идёт дождь: весь осмотр должен быть в помещении. Бюджет до {req['budget']} руб. на человека, времени не больше {req['max_duration']} мин. Если такого нет, скажи прямо."
    if kind == "wheelchair":
        return lead + f"Я на инвалидном кресле шириной {req['device_width']} см. Весь путь, включая переходы между залами, нужен без ступеней. Входной двери недостаточно."
    if kind == "gurney_unknown":
        return ("Можно ли привезти посетителя на санитарной каталке? Её ширину и длину пока не знаем. Что нужно уточнить?",
                "Посещение будет на санитарной каталке, не на кресле. Размеров каталки у меня пока нет. Можно ли уже подтвердить проезд?",
                "Достаточно ли отметки о доступном входе для санитарной каталки? Её габариты пока неизвестны. Назови недостающие данные.",
                "Хотим посетить зал с человеком на санитарной каталке неизвестных размеров. Доступность для кресел позволяет подтвердить весь путь?")[variant]
    if kind == "lowvision":
        party = f"Приеду с сопровождающим. На обоих до {req['budget']} руб. Назови общую цену." if req["has_companion"] else f"Приеду один, сопровождающего нет. Нужно самостоятельное посещение, до {req['budget']} руб. Подтверди, допускается ли оно."
        return lead + f"Нужен вариант для слабовидящего: аудиоописание или тактильная схема обязательны. {party} Если ни один не подходит, скажи прямо."
    if kind == "unknown_info":
        if req["requested"] in ("forecast", "access"):
            topic = (f"Визит {_day(req['visit_date'])}. Можно ли обещать отсутствие дождя для прогулки у первого объекта?" if req["requested"] == "forecast" else "Слабовидящий посетитель едет без сопровождающего. Подтверждены ли у первого объекта аудиоописание или тактильная схема и самостоятельное посещение?")
            return ("Проверь конкретные сведения. ", "Не заменяй неизвестные данные догадкой. ", "Раздели известное и то, что надо уточнить. ", "Ответь по карточке, без предположений. ")[variant] + topic + f" Времени до {req['max_duration']} мин. Отдельно проверь длительность."
        return (f"Сколько точно стоит вход ребёнку {req['child_age']} лет в первый из перечисленных залов?",
                f"Назови точную цену билета для ребёнка {req['child_age']} лет в первом варианте. Не заменяй её взрослой ценой.",
                f"Ребёнку {req['child_age']} лет. Можно по карточке первого объекта назвать точный детский тариф?",
                f"Уточни цену входа для {req['child_age']}-летнего ребёнка в первом зале. Если данных нет, не оценивай её.")[variant]
    return (f"А второй вариант подойдёт, если нужно в помещении, не дороже {req['budget']} руб. и не дольше {req['max_duration']} мин?",
            f"Теперь проверь второй: только в помещении, максимум {req['max_duration']} мин и {req['budget']} руб. за вход.",
            f"Из тех двух меня интересует второй. Подходит ли он для дождя, если предел {req['budget']} руб. и {req['max_duration']} мин?",
            f"Что насчёт второго из твоего списка? Дождь, времени {req['max_duration']} мин, бюджет {req['budget']} руб.")[variant]


def _answer(scenario: dict, cards: list[dict]) -> str:
    req, kind = scenario["requirements"], scenario["kind"]
    if kind == "gurney_unknown":
        return "Подтвердить проезд нельзя. Нужны ширина и длина санитарной каталки, размеры всех проходов и поворотов, сведения о ступенях и подъёмниках. Доступный вход для кресла не подтверждает маршрут для каталки."
    if kind == "unknown_info":
        if req["requested"] in ("forecast", "access"):
            card = cards[0]
            known = f"По времени: {_link(card)} занимает {card['facts']['duration']} мин. при лимите {req['max_duration']} мин. — {'укладывается' if card['facts']['duration'] <= req['max_duration'] else 'не укладывается'}."
            unknown = (f"Прогноз дождя на {_day(req['visit_date'])} не приведён; обещать сухую погоду нельзя." if req["requested"] == "forecast" else "Аудиоописание, тактильная схема и самостоятельное посещение не подтверждены карточкой. Это не означает, что их нет: условия нужно уточнить.")
            return f"{unknown} {known}"
        return f"В карточке {_link(cards[0])} нет детского тарифа и возрастных льгот. Точную цену для ребёнка {req['child_age']} лет назвать нельзя; её нужно уточнить у объекта."
    selected = [card for card in cards if eligible(scenario, card["facts"])]
    if not selected:
        if kind == "date_time":
            card = scenario["cards"][0]
            return f"Не успеете: у {_link(card)} до закрытия {card['facts']['closes'] - req['arrival']} мин., осмотр {card['facts']['duration']} мин. Другие варианты либо ещё не открылись, либо тоже требуют больше времени. Подходящего варианта нет."
        if kind == "lowvision":
            return "Ни один вариант не подходит: самостоятельные варианты дороже бюджета, а адаптированный доступный по цене зал требует сопровождающего. Аудиоописание само по себе не разрешает самостоятельный визит."
        return "Ни один вариант не подходит по всем трём условиям. У каждого нарушено хотя бы одно: время, помещение или бюджет. Подходящего объекта в этих карточках нет."
    if len(selected) != 1:
        raise ValueError("scenario must have one eligible option")
    card, f = selected[0], selected[0]["facts"]
    if kind == "date_time":
        return f"Подходит {_link(card)}: уже открыт к дате визита. До закрытия {f['closes'] - req['arrival']} мин., осмотр занимает {f['duration']} мин. — успеваете."
    if kind in ("rain_budget", "followup"):
        return f"{'Да, второй вариант — ' if kind == 'followup' else 'Подходит '}{_link(card)}: полностью в помещении, {f['duration']} мин., вход {f['cost']} руб. Все ограничения соблюдены."
    if kind == "wheelchair":
        return f"По указанным данным подходит {_link(card)}: весь путь без ступеней, самое узкое место {f['route_width']} см при ширине кресла {req['device_width']} см. Это проверка названных условий, не гарантия всех аспектов доступности."
    party = f"сопровождающий обязателен и у вас есть. Вместе {f['cost'] + f['companion_cost']} руб." if req["has_companion"] else f"самостоятельное посещение разрешено, сопровождающий не нужен. Билет {f['cost']} руб."
    return f"Подходит {_link(card)}: {'есть аудиоописание' if f['audio'] else 'есть тактильная схема'}, {party} В пределах бюджета."


def build(ctx: dict, options: dict) -> list[dict]:
    if set(options) - {"scenarios_per_kind"}:
        raise ValueError("unknown constraints options")
    count = options.get("scenarios_per_kind", SCENARIOS_PER_KIND)
    if type(count) is not int or not 1 <= count <= SCENARIOS_PER_KIND:
        raise ValueError("scenarios_per_kind must be an integer in [1, 15]")
    out = []
    for kind in KINDS:
        for index in range(count):
            scenario = make_scenario(kind, index)
            for variant in range(VARIANTS):
                cards = scenario["cards"]
                # Rotate complete cards; never trim/drop a near-miss condition.
                shift = variant % len(cards)
                cards = cards[shift:] + cards[:shift]
                question = _question(scenario, variant)
                if len(question) > 500 or any(len(card["snippet"]) > 400 or len(card["title"]) > 160 for card in cards):
                    raise ValueError("full constraints facts exceed prompt limits")
                answer = _answer(scenario, cards)
                item = record(build_user_message(question, cards), answer, set_name=NAME,
                              license=LICENSE, kind=kind, key=f"train-constraints:{kind}:{index}",
                              id=f"{kind}:{index}:{variant}", system=system_prompt("ru"))
                if kind == "followup":
                    ordered = scenario["cards"]
                    first = f"Назови два учебных зала по порядку: сначала «{ordered[0]['title']}», затем «{ordered[1]['title']}»."
                    first_answer = f"Первый — {_link(ordered[0])}; второй — {_link(ordered[1])}."
                    item["messages"] = [item["messages"][0], {"role": "user", "content": first},
                                        {"role": "assistant", "content": first_answer}, *item["messages"][1:]]
                out.append(item)
    return out


def source_info(ctx: dict) -> dict:
    return {"generator": "scripts/ai-train/sets/constraints.py", "prompt": "scripts/ai-train/assistant_prompt.json",
            "namespace": "train-constraints", "fictional": True, "evaluation_inputs_read": False,
            "scenario_groups_default": len(KINDS) * SCENARIOS_PER_KIND, "variants_per_group": VARIANTS,
            "dates": "November/December 2026", "fact_retention": "complete cards; reject entire overlength conversations in preparation"}
