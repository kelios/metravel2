"""Verify all requested prose on its logical destination folio, including imposed output."""
import re


def normalized(text):
    return re.sub(r'\s+', '', text)


def story_present(story, destination, continuation=''):
    return normalized(story) in normalized(destination)


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
    folios = {index + 1: index for index in range(len(pages))}
    if plan is not None:
        folios = {placement['folio']: index * 2 + side_index for index, sheet in enumerate(plan['sheets']) for side_index, side in enumerate(('front', 'back')) for placement in sheet[side] if placement['folio'] is not None}
    missing = []
    for stop in book['stops']:
        folio = destination_folios[stop['id']]
        destination = pages[folios[folio]] if folio in folios and folios[folio] < len(pages) else ''
        if normalized(stop['title']) not in normalized(destination):
            missing.append(stop['title'])
        story = stop['text']['compact' if profile_id == 'pocket-150x100' else 'album']
        if not story_present(story, destination):
            missing.append(story)
    return missing


def print_quest_label(value):
    # Project source uses decorative leading pictographs; preserve all actual names.
    return re.sub(r'^(?:[\U0001F000-\U0001FAFF\u2600-\u27BF][\uFE0F\u200D\s]*)+', '', value)


def missing_quest_book_text(book, pages, profile_id, page_map, plan=None):
    destinations = [page for page in page_map if page.get('kind') == 'quest-story']
    selected = {quest['questId'] for quest in book['quests']}
    if len(destinations) != len(selected) or {page.get('questId') for page in destinations} != selected or len({page['folio'] for page in destinations}) != len(selected):
        raise ValueError('Page map must identify every selected quest once')
    folios = {index + 1: index for index in range(len(pages))}
    if plan is not None:
        folios = {placement['folio']: index * 2 + side_index for index, sheet in enumerate(plan['sheets']) for side_index, side in enumerate(('front', 'back')) for placement in sheet[side] if placement['folio'] is not None}
    destinations = {page['questId']: page['folio'] for page in destinations}
    missing = []
    for quest in book['quests']:
        folio = destinations[quest['questId']]
        text = pages[folios[folio]] if folio in folios and folios[folio] < len(pages) else ''
        expected = [print_quest_label(quest['title']), quest.get('compactOverview', quest['overview']) if profile_id == 'pocket-150x100' else quest['overview'], *[print_quest_label(point['title']) for point in quest['points']]]
        missing.extend(fragment for fragment in expected if normalized(fragment) not in normalized(text))
    return missing
