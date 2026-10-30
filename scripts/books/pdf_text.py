"""Exact prose verification across the destination/continuation folios."""
import re


def normalized(text):
    return re.sub(r'\s+', '', text)


def story_present(story, destination, continuation):
    """Only a whole-word split is allowed; intervening page furniture is ignored."""
    words = story.split()
    left, right = normalized(destination), normalized(continuation)
    for split in range(len(words), -1, -1):
        before = normalized(' '.join(words[:split]))
        after = normalized(' '.join(words[split:]))
        if (not before or before in left) and (not after or after in right):
            return True
    return False


def missing_book_text(book, pages, profile_id, plan=None):
    folios = {index + 1: index for index in range(56)}
    if plan is not None:
        folios = {
            placement['folio']: index * 2 + side_index
            for index, sheet in enumerate(plan['sheets'])
            for side_index, side in enumerate(('front', 'back'))
            for placement in sheet[side]
        }
    missing = []
    for index, stop in enumerate(book['stops']):
        destination = pages[folios[6 + index * 4]] if folios.get(6 + index * 4, len(pages)) < len(pages) else ''
        continuation = pages[folios[8 + index * 4]] if folios.get(8 + index * 4, len(pages)) < len(pages) else ''
        story = stop['text']['compact' if profile_id == 'pocket-150x100' else 'album']
        if normalized(stop['title']) not in normalized(destination):
            missing.append(stop['title'])
        if not story_present(story, destination, continuation):
            missing.append(story)
    return missing
