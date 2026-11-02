"""Verify all requested prose on its logical destination folio, including imposed output."""
import re
from decimal import Decimal, ROUND_HALF_UP
from urllib.parse import urlsplit


def normalized(text):
    return re.sub(r'\s+', '', text)


def story_present(story, destination, continuation=''):
    return normalized(story) in normalized(destination)


def printed_metric(value):
    if isinstance(value, dict):
        return printed_metric(value['min']) + '–' + printed_metric(value['max'])
    number = Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    return format(number, 'f').rstrip('0').rstrip('.').replace('.', ',') if number % 1 else str(int(number))


def thematic_fragments(stop):
    evidence = stop.get('thematic')
    if not evidence:
        return []
    required = [evidence['media']['caption']]
    route = evidence.get('route')
    if route:
        required.extend([
            ' — '.join([route['start'], *route['via'], route['finish']]), route['scope'],
            f"{printed_metric(route['distanceKm'])} км · набор высоты {printed_metric(route['elevationGainM'])} м · {printed_metric(route['durationMinutes'])} мин.",
            route['metricNote'], route['difficulty'], route['seasonality'],
            route['availability']['checkedOn'], route['availability']['note'],
        ])
        if route.get('routeDate'):
            required.append(route['routeDate'])
        roles = {'author-estimate': 'Оценка автора', 'official': 'Официальные данные',
                 'provider-estimate': 'Оценка провайдера', 'gpx-measurement': 'Расчёт по GPX',
                 'historical-provider': 'Исторический источник', 'mixed': 'Смешанные источники'}
        required.append(roles[route['sourceType']])
        required.extend(urlsplit(url).hostname.removeprefix('www.') for url in route['sourceUrls'])
        if route['availability'].get('authorityUrl'):
            required.append(urlsplit(route['availability']['authorityUrl']).hostname.removeprefix('www.'))
    return required


def folio_indices(page_count, plan=None):
    if plan is None:
        return {index + 1: index for index in range(page_count)}
    return {placement['folio']: index * 2 + side_index
            for index, sheet in enumerate(plan['sheets']) for side_index, side in enumerate(('front', 'back'))
            for placement in sheet[side] if placement['folio'] is not None}


def missing_thematic_links(book, page_links, page_map, plan=None):
    if book.get('sourceContract') != 'thematic-v1':
        return []
    indices = folio_indices(len(page_links), plan)
    destinations = {page['stopId']: page['folio'] for page in page_map if page.get('kind') == 'destination'}
    missing = []
    for stop in book['stops']:
        route = stop['thematic'].get('route')
        if not route:
            continue
        expected = [*route['sourceUrls'], route['availability'].get('authorityUrl')]
        index = indices.get(destinations[stop['id']])
        actual = page_links[index] if index is not None and index < len(page_links) else set()
        missing.extend(f"{stop['id']}: missing PDF link {url}" for url in expected if url and url not in actual)
    return missing


def missing_book_text(book, pages, profile_id, page_map, plan=None):
    if book.get('kind') == 'quests':
        return missing_quest_book_text(book, pages, profile_id, page_map, plan)
    destinations = [page for page in page_map if page.get('kind') == 'destination']
    selected_ids = {stop['id'] for stop in book['stops']}
    if (len(destinations) != len(book['stops'])
            or {page.get('stopId') for page in destinations} != selected_ids
            or any(type(page.get('folio')) is not int or page['folio'] < 1 for page in destinations)
            or len({page['folio'] for page in destinations}) != len(destinations)):
        raise ValueError('Page map must identify every selected destination exactly once')
    destination_folios = {page['stopId']: page['folio'] for page in destinations}
    folios = folio_indices(len(pages), plan)
    missing = []
    for stop in book['stops']:
        folio = destination_folios[stop['id']]
        destination = pages[folios[folio]] if folio in folios and folios[folio] < len(pages) else ''
        if normalized(stop['title']) not in normalized(destination):
            missing.append(stop['title'])
        story = stop['text']['compact' if profile_id == 'pocket-150x100' else 'album']
        if not story_present(story, destination):
            missing.append(story)
        missing.extend(fragment for fragment in thematic_fragments(stop) if normalized(fragment) not in normalized(destination))
    return missing


def print_quest_label(value):
    # Project source uses decorative leading pictographs; preserve all actual names.
    return re.sub(r'^(?:[\U0001F000-\U0001FAFF\u2600-\u27BF][\uFE0F\u200D\s]*)+', '', value)


def missing_quest_book_text(book, pages, profile_id, page_map, plan=None):
    destinations = [page for page in page_map if page.get('kind') == 'quest-story']
    selected = {quest['questId'] for quest in book['quests']}
    if len(destinations) != len(selected) or {page.get('questId') for page in destinations} != selected or len({page['folio'] for page in destinations}) != len(selected):
        raise ValueError('Page map must identify every selected quest once')
    folios = folio_indices(len(pages), plan)
    destinations = {page['questId']: page['folio'] for page in destinations}
    missing = []
    for quest in book['quests']:
        folio = destinations[quest['questId']]
        text = pages[folios[folio]] if folio in folios and folios[folio] < len(pages) else ''
        expected = [print_quest_label(quest['title']), quest.get('compactOverview', quest['overview']) if profile_id == 'pocket-150x100' else quest['overview'], *[print_quest_label(point['title']) for point in quest['points']]]
        missing.extend(fragment for fragment in expected if normalized(fragment) not in normalized(text))
    return missing
