import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / 'scripts/books'))
from pdf_text import missing_book_text, story_present


class PdfTextTest(unittest.TestCase):
    def test_continuation_ignores_headers_and_other_folios(self):
        self.assertTrue(story_present('Первое слово. Второе слово.', 'Место Первое\nслово. footer', 'header Второе слово. QR'))
        self.assertTrue(story_present('Целый рассказ.', 'Место Целый рассказ. footer', 'QR'))

    def test_missing_or_replaced_word_cannot_pass(self):
        self.assertFalse(story_present('Первое слово. Второе слово.', 'Первое слово.', 'Второе QR'))
        self.assertFalse(story_present('Первое слово. Второе слово.', 'Первое слово.', 'Другое слово.'))
        self.assertFalse(story_present('целое слово', 'целое сло', 'во'))

    def test_reads_only_the_correct_logical_pages_and_imposed_sides(self):
        book = {'stops': [{'title': 'Замок', 'text': {'compact': 'Начало истории. Конец истории.'}}]}
        pages = [''] * 56
        pages[5] = 'Замок Начало истории. footer'
        pages[7] = 'header Конец истории.'
        self.assertEqual(missing_book_text(book, pages, 'pocket-150x100'), [])
        pages[7] = 'header Конец'
        pages[8] = 'Конец истории.'
        self.assertEqual(len(missing_book_text(book, pages, 'pocket-150x100')), 1)
        plan = {'sheets': [{'front': [{'folio': 6}], 'back': [{'folio': 8}]}]}
        self.assertEqual(missing_book_text(book, ['Замок Начало истории.', 'Конец истории.'], 'pocket-150x100', plan), [])


if __name__ == '__main__':
    unittest.main()
