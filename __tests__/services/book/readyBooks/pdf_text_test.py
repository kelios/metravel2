import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[4] / 'scripts/books'))
from pdf_text import missing_book_text, story_present


class PdfTextTest(unittest.TestCase):
    def test_thematic_caption_and_guidebook_route_line_stay_on_their_folio(self):
        route = {'start': 'Начало', 'via': ['Перевал'], 'finish': 'Вершина', 'scope': 'В одну сторону',
                 'distanceKm': {'min': 5, 'max': 6}, 'elevationGainM': {'min': 100, 'max': 200}, 'durationMinutes': 90,
                 'metricNote': 'Время оценочное.', 'difficulty': 'Оценка сложности не проверена.',
                 'seasonality': 'возможен снег', 'sourceType': 'provider-estimate', 'sourceUrls': ['https://trail.example/route/1'],
                 'availability': {'checkedOn': '2026-11-02', 'note': 'За ограждение не заходить.', 'authorityUrl': 'https://park.example/notices'}}
        stop = {'id': 'mountain', 'title': 'Гора', 'text': {'compact': 'История горы.'},
                'thematic': {'media': {'caption': 'Контекстный вид массива.'}, 'route': route}}
        book = {'sourceContract': 'thematic-v1', 'stops': [stop]}
        page_map = [{'kind': 'destination', 'stopId': 'mountain', 'folio': 5}]
        whole = ('Гора История горы. Контекстный вид массива. Маршрут: Начало — Перевал — Вершина. '
                 'В одну сторону: 5–6 км, набор высоты 100–200 м, около 1 ч 30 мин. Сезон: возможен снег.')
        pages = [''] * 6; pages[4] = whole
        self.assertEqual(missing_book_text(book, pages, 'pocket-150x100', page_map), [])
        pages[4] = whole.replace('Контекстный вид массива.', '').replace('Сезон: возможен снег.', '')
        pages[5] = whole
        missing = missing_book_text(book, pages, 'pocket-150x100', page_map)
        self.assertIn('Контекстный вид массива.', missing)
        self.assertIn('Сезон: возможен снег.', missing)
        plan = {'sheets': [{'front': [{'folio': 5}], 'back': [{'folio': None}]}]}
        self.assertEqual(missing_book_text(book, [whole, ''], 'pocket-150x100', page_map, plan), [])

    def test_whole_prose_stays_on_destination(self):
        self.assertTrue(story_present('Целый рассказ.', 'Место Целый\nрассказ.'))
        self.assertFalse(story_present('Первое слово. Второе слово.', 'Первое слово. Другое слово.'))
        self.assertFalse(story_present('целое слово', 'целое сло', 'во'))

    def test_reads_dynamic_logical_pages_and_imposed_sides(self):
        book = {'stops': [{'id': 'castle', 'title': 'Замок', 'text': {'compact': 'История этого замка.'}}]}
        page_map = [{'kind': 'destination', 'stopId': 'castle', 'folio': 5}]
        pages = [''] * 12
        pages[4] = 'Замок История этого замка.'
        self.assertEqual(missing_book_text(book, pages, 'pocket-150x100', page_map), [])
        pages[4] = 'Замок'
        pages[5] = 'История этого замка.'
        self.assertEqual(len(missing_book_text(book, pages, 'pocket-150x100', page_map)), 1)
        plan = {'sheets': [{'front': [{'folio': 5}], 'back': [{'folio': None}]}]}
        self.assertEqual(missing_book_text(book, ['Замок История этого замка.', ''], 'pocket-150x100', page_map, plan), [])

    def test_uses_emitted_folios_for_legacy_and_end_map_editions(self):
        book = {'stops': [{'id': f'place-{i}', 'title': f'Место {i}', 'text': {'album': f'Рассказ {i}.'}} for i in range(31)]}
        for first in (8, 9):
            page_map = [{'kind': 'destination', 'stopId': stop['id'], 'folio': first + i * 3} for i, stop in enumerate(book['stops'])]
            pages = [''] * 108
            for stop, page in zip(book['stops'], page_map):
                pages[page['folio'] - 1] = stop['title'] + ' ' + stop['text']['album']
            self.assertEqual(missing_book_text(book, pages, 'album-a5', list(reversed(page_map))), [])
            shifted = [{**page, 'folio': page['folio'] + 1} for page in page_map]
            self.assertEqual(len(missing_book_text(book, pages, 'album-a5', shifted)), 62)

    def test_rejects_omitted_duplicate_and_unknown_destination_maps(self):
        book = {'stops': [{'id': 'place', 'title': 'Место', 'text': {'compact': 'Рассказ.'}}]}
        for page_map in ([], [{'kind': 'destination', 'stopId': 'other', 'folio': 5}],
                         [{'kind': 'destination', 'stopId': 'place', 'folio': 0}],
                         [{'kind': 'destination', 'stopId': 'place', 'folio': 5}] * 2):
            with self.assertRaises(ValueError):
                missing_book_text(book, [''] * 12, 'pocket-150x100', page_map)


if __name__ == '__main__':
    unittest.main()
