#!/usr/bin/env python3
"""Rebuild the A2 design reference, not a publishable ReadyBook artifact."""
import argparse
import hashlib
import json
import math
from pathlib import Path

from PIL import Image
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
REVISION = '2026-10-27.1'
INK, MUTED, LINE, PAPER = '#29352F', '#59675F', '#BDC7BE', '#FFFEFA'
PROFILES = {
    'pocket-150x100': dict(width=150, height=100, body=9, title=14, photo=[100, 70], qr=18),
    'album-a5': dict(width=148, height=210, body=10.5, title=22, photo=[108, 158], qr=20),
}
COUNTRIES = {
    'by': dict(title='Беларусь', subtitle='Замки, города и природа', accent='#355F48', photo='mir-castle-2023.jpg',
               art='belarus-cover-art-v1.png', credit='Mike1979 Russia / CC BY-SA 3.0', license='https://creativecommons.org/licenses/by-sa/3.0/',
               source='https://commons.wikimedia.org/wiki/File:Mir_Castle_2023-07-02_5836.jpg'),
    'pl': dict(title='Польша', subtitle='Замки, города и горы', accent='#884B36', photo='malbork-castle-2019.jpg',
               art='poland-cover-art-v1.png', credit='Jakub T. Jankiewicz / CC BY-SA 4.0', license='https://creativecommons.org/licenses/by-sa/4.0/',
               source='https://commons.wikimedia.org/wiki/File:Malbork_Castle_Front.jpg'),
}


def lines_for(text, width, font, size):
    lines, line = [], ''
    for word in str(text).split():
        if pdfmetrics.stringWidth(word, font, size) > width * mm:
            raise ValueError(f'Unbreakable word exceeds frame: {word}')
        trial = f'{line} {word}'.strip()
        if pdfmetrics.stringWidth(trial, font, size) > width * mm:
            lines.append(line)
            line = word
        else:
            line = trial
    if line:
        lines.append(line)
    return lines


class Reference:
    def __init__(self, output):
        self.canvas = Canvas(str(output / 'print-layouts-v1.pdf'), invariant=1, pageCompression=1,
                             initialFontName='Sans', initialFontSize=9)
        self.canvas.setTitle('MeTravel / A2 / физические макеты / ' + REVISION)
        self.canvas.setAuthor('MeTravel')
        self.pages = []

    def page(self, width, height, kind, **meta):
        self.w, self.h, self.frames = width, height, []
        self.canvas.setPageSize((width * mm, height * mm))
        self.canvas.setFillColor(HexColor(PAPER))
        self.canvas.rect(0, 0, width * mm, height * mm, fill=1, stroke=0)
        self.meta = dict(pdfPage=len(self.pages) + 1, kind=kind, widthMm=width, heightMm=height, **meta)

    def finish(self):
        self.meta['frames'] = self.frames
        self.pages.append(self.meta)
        self.canvas.showPage()

    def text(self, text, x, top, width, size=9, font='Sans', color=INK, max_height=None, max_lines=None):
        lines = lines_for(text, width, font, size)
        leading = size * 1.3
        height = len(lines) * leading / mm
        if max_height is not None and height > max_height + 0.01:
            raise ValueError(f'Overflow page {self.meta}: {height:.2f} > {max_height}: {text}')
        if max_lines is not None and len(lines) > max_lines:
            raise ValueError(f'Title exceeds {max_lines} lines: {text}')
        if x < 0 or top < 0 or x + width > self.w + 0.01 or top + height > self.h + 0.01:
            raise ValueError(f'Out-of-page frame: {text}')
        self.canvas.setFillColor(HexColor(color))
        self.canvas.setFont(font, size)
        for i, line in enumerate(lines):
            self.canvas.drawString(x * mm, self.h * mm - top * mm - size - i * leading, line)
        self.frames.append(dict(type='text', x=x, top=top, width=width, height=round(height, 3), font=font, sizePt=size))
        return height

    def rect(self, x, top, width, height, fill=None, stroke=LINE, dash=None):
        self.canvas.setStrokeColor(HexColor(stroke))
        self.canvas.setFillColor(HexColor(fill or PAPER))
        self.canvas.setLineWidth(0.4)
        self.canvas.setDash(dash or [])
        self.canvas.rect(x * mm, (self.h - top - height) * mm, width * mm, height * mm, stroke=1, fill=bool(fill))
        self.canvas.setDash([])

    def image(self, filename, x, top, width, height):
        image = Image.open(HERE / 'assets' / filename)
        iw, ih = image.size
        scale = min(width / iw, height / ih)
        dw, dh = iw * scale, ih * scale
        self.canvas.drawImage(str(HERE / 'assets' / filename), (x + (width - dw) / 2) * mm,
                              (self.h - top - height + (height - dh) / 2) * mm, dw * mm, dh * mm, mask='auto')
        self.frames.append(dict(type='image', file=filename, x=x, top=top, width=width, height=height,
                                effectivePpi=round(iw / (dw / 25.4), 1), crop=False))

    def qr(self, url, x, top, data_mm):
        widget = QrCodeWidget(url, barBorder=4, barLevel='M')
        widget.qr.make()
        modules = widget.qr.getModuleCount()
        total_mm = data_mm * (modules + 8) / modules
        bounds = widget.getBounds()
        drawing = Drawing(total_mm * mm, total_mm * mm,
                          transform=[total_mm * mm / (bounds[2] - bounds[0]), 0, 0,
                                     total_mm * mm / (bounds[3] - bounds[1]), 0, 0])
        drawing.add(widget)
        renderPDF.draw(drawing, self.canvas, x * mm, (self.h - top - total_mm) * mm)
        self.frames.append(dict(type='qr', x=x, top=top, width=total_mm, height=total_mm,
                                dataMm=data_mm, quietModules=4, modules=modules, value=url))
        return total_mm

    def body_base(self, profile, country, logical_page, kind, title, stop):
        p = PROFILES[profile]
        c = COUNTRIES[country]
        self.page(p['width'], p['height'], kind, profileId=profile, country=country.upper(),
                  revision=REVISION, component='body', logicalPage=logical_page, stopId=stop['id'])
        left = logical_page % 2 == 0
        self.x, self.cw = (5 if left else 15), p['width'] - 20
        self.text(title, self.x, 5, self.cw, 9, color=c['accent'])
        self.text(str(logical_page), self.x, p['height'] - 9, self.cw, 9, color=MUTED)
        self.meta.update(safeMm=5, bindingMm=15, bindingSide='right' if left else 'left')
        self.frames.append(dict(type='binding-exclusion', x=p['width'] - 15 if left else 0,
                                top=0, width=15, height=p['height']))
        return p, c

    def cover(self, profile, country, side, book):
        p, c = PROFILES[profile], COUNTRIES[country]
        w, h = p['width'], p['height']
        self.page(w, h, 'cover-' + side, profileId=profile, country=country.upper(), component='cover',
                  revision=REVISION, bookId=book['id'])
        if side == 'front':
            self.image(c['art'], 0, 0, w, h)
            self.rect(5, 5, w - 10, 28 if h == 100 else 48, fill=PAPER, stroke=PAPER)
            self.text('MeTravel / Книги путешественника', 9, 8, w - 18, 9, color=c['accent'])
            self.text(c['title'], 9, 14, w - 18, 23 if h == 100 else 32, 'SerifBold', c['accent'])
            self.text(c['subtitle'], 9, 25 if h == 100 else 33, w - 18, 9 if h == 100 else 11)
            self.rect(5, h - 18, w - 10, 13, fill=PAPER, stroke=PAPER)
            self.text('12 мест / книга воспоминаний', 9, h - 16, w - 18, 9)
            self.text('Декоративная AI-иллюстрация серии', 9, h - 11, w - 18, 9, color=MUTED)
        elif side == 'inside-front':
            self.text('Эта книга принадлежит', 15, 12, w - 30, 14 if h == 100 else 22, 'SerifBold', c['accent'])
            for top, label in [(36, 'Имя'), (56, 'Контакт на случай потери')]:
                self.text(label, 15, top - 7, w - 30, 9, color=MUTED)
                self.rect(15, top, w - 30, 0)
            self.text('Заполните вручную только то, чем хотите поделиться.', 15, h - 23, w - 30, 9, max_height=13)
        elif side == 'inside-back':
            self.text('Как читать эту книгу', 15, 12, w - 30, 14 if h == 100 else 22, 'SerifBold', c['accent'])
            text = 'История знакомит с местом. «Факт» опирается на источники. Наблюдение предлагает присмотреться. Пустые страницы принадлежат вашим впечатлениям.'
            self.text(text, 15, 30 if h == 100 else 40, w - 30, p['body'], max_height=h - 45)
        else:
            self.text(c['title'], 15, 12, w - 30, 20 if h == 100 else 28, 'SerifBold', c['accent'])
            self.text(f'Редакционный язык: русский.\n{w} × {h} мм / 56 внутренних страниц\nОбложка отдельно: четыре стороны.\nМакет A2 / {REVISION}',
                      15, 30 if h == 100 else 45, w - 30, 9 if h == 100 else 11, max_height=h - 45)
            self.text('metravel.by', 15, h - 15, w - 30, 9, color=c['accent'])
        self.finish()

    def destination(self, profile, country, stop, stress=False):
        p, c = self.body_base(profile, country, 6, 'destination-stress' if stress else 'destination',
                             ('Тест вместимости / ' if stress else '01 / ') + stop['localName'], stop)
        self.text(stop['title'], self.x, 12, self.cw, p['title'], 'SerifBold', max_lines=2)
        compact = profile.startswith('pocket')
        self.image(c['photo'], self.x, 28 if compact else 34, 56 if compact else 118, 48 if compact else 68)
        size = p['body']
        story = stop['text']['compact' if compact else 'album']
        if compact:
            lines = lines_for(story, 70, 'Sans', size)
            count = math.floor(49 * mm / (size * 1.3))
            shown, remainder = lines[:count], ' '.join(lines[count:])
            self.text(' '.join(shown), self.x + 60, 27, 70, size, max_height=49)
            self.text(c['credit'], self.x, 79, self.cw, 9, max_height=9)
            self.text(f"{stop['lat']:.5f}, {stop['lng']:.5f} / точность: {stop['coordinateAccuracy']}",
                      self.x, 87, self.cw, 9, max_height=8)
        else:
            lines = lines_for(story, self.cw, 'Sans', size)
            count = math.floor(62 * mm / (size * 1.3))
            shown, remainder = lines[:count], ' '.join(lines[count:])
            self.text(' '.join(shown), self.x, 107, self.cw, size, max_height=62)
            qr_total = self.qr(stop['source']['url'], self.x, 174, p['qr'])
            self.text('Официальный источник', self.x + qr_total + 4, 174, self.cw - qr_total - 4, 10.5)
            self.text(f"{stop['lat']:.5f}, {stop['lng']:.5f}", self.x + qr_total + 4, 183, self.cw - qr_total - 4, 10.5)
            self.text('Точка подхода уточняется по указателям музея.', self.x + qr_total + 4, 191, self.cw - qr_total - 4, 10.5, max_height=13)
        self.meta['continuationOnPage8'] = bool(remainder)
        self.finish()
        return remainder

    def memory(self, profile, country, stop):
        p, _ = self.body_base(profile, country, 7, 'memory', 'Дата: __________    С кем: __________', stop)
        pw, ph = p['photo']
        x, top = self.x + (self.cw - pw) / 2, 16 if p['height'] == 100 else 28
        self.rect(x, top, pw, ph, dash=[2, 2])
        self.text('Мой кадр\n' + ('до 100 × 70 мм' if ph == 70 else 'рамка 108 × 158 мм\nфото до 102 × 152 мм'),
                  x + 8, top + ph / 2 - 7, pw - 16, 9 if ph == 70 else 10.5, color=MUTED)
        self.frames.append(dict(type='photo-slot', x=x, top=top, width=pw, height=ph, maxPhotoMm=[100, 70] if ph == 70 else [102, 152]))
        self.text('Хочу запомнить: ____________________', self.x, top + ph + 3, self.cw, 9 if ph == 70 else 10.5, max_height=8)
        self.finish()

    def notes(self, profile, country, stop, remainder):
        p, c = self.body_base(profile, country, 8, 'notes', 'Мои впечатления / история места', stop)
        compact = p['height'] == 100
        top = 14
        if remainder:
            top += self.text('Продолжение истории. ' + remainder, self.x, top, self.cw, p['body'], max_height=22) + 3
        qr_width = self.qr(stop['source']['url'], self.x, top, p['qr'])
        tx, tw = self.x + qr_width + 4, self.cw - qr_width - 4
        top_text = top
        top_text += self.text('Факт. ' + stop['fact'], tx, top_text, tw, p['body'], max_height=22 if compact else 35) + 2
        top_text += self.text('Присмотритесь. ' + stop['observation'], tx, top_text, tw, p['body'], max_height=25 if compact else 45)
        top = max(top + qr_width, top_text) + 4
        if not compact:
            top += self.text('Подход: ' + stop['entrance'], self.x, top, self.cw, p['body'], max_height=38) + 4
            top += self.text('Фото: ' + c['credit'], self.x, top, self.cw, p['body']) + 3
        self.text('Что удивило / что посоветую / хочу вернуться', self.x, top, self.cw, 9 if compact else 10.5)
        for y in range(math.ceil(top + 10), p['height'] - 12, 6):
            self.rect(self.x, y, self.cw, 0)
        self.finish()

    def collage(self, profile, country, stop):
        p, _ = self.body_base(profile, country, 9, 'collage', 'Билет, открытка, ещё один кадр', stop)
        self.rect(self.x, 18, self.cw, p['height'] - 42, dash=[2, 2])
        text = 'Для открытки больше поля используйте отдельный вкладыш.' if p['height'] == 100 else 'Измерьте открытку. Крупную разместите в кармане или на отдельном вкладыше.'
        self.text(text, self.x + 6, p['height'] - 22, self.cw - 12, p['body'], max_height=13)
        self.finish()

    def control(self, verso=False):
        self.page(210, 297, 'home-control-back' if verso else 'home-control-front', component='control', revision=REVISION)
        self.text(('ОБОРОТ' if verso else 'ЛИЦО') + ' / ВЕРХ ↑', 15, 12, 180, 20, 'SerifBold')
        self.text('Контроль 100% / одна PDF-страница на лист A4', 15, 27, 180, 11)
        self.rect(20, 50, 50, 0, stroke=INK)
        for i in range(51):
            self.rect(20 + i, 50 - (3 if i % 10 == 0 else 1.5), 0, 3 if i % 10 == 0 else 1.5, stroke=INK)
        self.text('50 мм / допустимо 49-51 мм', 20, 54, 165, 11)
        for idx, top in enumerate([76, 183]):
            self.rect(30, top, 150, 100)
            self.text(f"150 × 100 мм / {'оборот' if verso else 'лицо'} {idx + 1}", 38, top + 12, 134, 13, 'SansBold')
            self.text('Линии показывают резку, а не сгиб. Вырезать после проверки масштаба и сторон.', 38, top + 30, 134, 11)
        self.meta['rulerMm'] = 50
        self.meta['physicalAcceptance'] = 'H1 required; digital geometry is not a paper pass'
        self.finish()

    def save(self, output):
        self.canvas.save()
        manifest = dict(revision=REVISION, status='design-reference', notReadyBook=True, pages=self.pages,
                        profiles=PROFILES, fontFiles=FONT_HASHES)
        (output / 'geometry-v1.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')

    def credits(self):
        self.page(210, 297, 'credits', component='credits', revision=REVISION)
        self.text('Изображения и шрифты макета A2', 15, 15, 180, 22, 'SerifBold')
        top = 38
        for country, c in COUNTRIES.items():
            self.text(c['title'] + ': фото образца', 15, top, 180, 12, 'SansBold')
            self.text(c['credit'] + '. Только масштабирование, без кадрирования.', 15, top + 10, 180, 10.5)
            self.text('Открыть исходный файл и лицензию', 15, top + 22, 180, 10.5, color=c['accent'])
            self.canvas.linkURL(c['source'], (15 * mm, (297 - top - 29) * mm, 125 * mm, (297 - top - 21) * mm))
            self.text(c['license'], 15, top + 32, 180, 10.5)
            self.canvas.linkURL(c['license'], (15 * mm, (297 - top - 39) * mm, 195 * mm, (297 - top - 31) * mm))
            top += 55
        self.text('Обложки: авторские AI-иллюстрации серии, OpenAI imagegen, 27.10.2026. Это декоративные пейзажи, без утверждения о конкретном месте или тропе. Промпты и SHA-256 сохранены в assets/provenance.json.',
                  15, top, 180, 10.5, max_height=30)
        self.text('Шрифты: Noto Sans Regular/Bold и Noto Serif Bold. SIL Open Font License 1.1. Кириллица встроена в PDF; контрольные суммы исходных шрифтов сохранены в geometry-v1.json.',
                  15, top + 38, 180, 10.5, max_height=30)
        self.text('https://github.com/notofonts/noto-fonts/blob/main/LICENSE', 15, top + 70, 180, 10.5)
        self.text('Это эталон дизайна, не полный комплект издания и не подтверждение физической печати. Производственные файлы, все 24 изображения и бумажный пробник проверяются отдельно в B1–B4/H1.',
                  15, top + 90, 180, 10.5, max_height=35)
        self.finish()


def screen_mocks(output):
    cards = ''.join(f'''<article class="book"><img src="assets/{c['art']}" alt="Декоративная иллюстрация серии: {c['title']}"><div><h2>{c['title']}</h2><p>{c['subtitle']}</p><p class="muted">Русский PDF · 12 мест · бесплатно</p><p>150 × 100 мм или A5 148 × 210 мм</p><button>Посмотреть книгу</button></div></article>''' for c in COUNTRIES.values())
    states = {
        'catalogue': f'<h1>Книги путешественника</h1><p>Готовые истории мест и место для ваших воспоминаний.</p><div class="cards">{cards}</div><h2>Как напечатать</h2><p>Выберите размер книги, затем домашний файл или пакет для типографии.</p><p class="muted">Будущие серии готовятся. Активных загрузок для них нет.</p>',
        'detail': '<h1>Беларусь</h1><p>Замки, города и природа</p><p>Редакционный язык: русский · 12 мест</p><h2>Что внутри</h2><p>Мир, Несвиж, Минск и ещё 9 мест. Истории, карта, страницы памяти.</p><button>Посмотреть всю книгу</button><h2>Размер книги и фотографии</h2><label><input type="radio" name="format" checked>150 × 100 мм / фото до 100 × 70 мм</label><label><input type="radio" name="format">A5 148 × 210 мм / фото до 102 × 152 мм</label><h2>Что скачать</h2><button>Для чтения · PDF · 56 страниц · размер файла</button><p>Домашняя печать · Типография · Наклейки · Инструкция</p><p class="muted">Здесь показан состав карточки. Реальные размеры файлов приходят из manifest C1.</p>',
        'preview': '<h1>Беларусь / предпросмотр</h1><p>150 × 100 мм · RU · редакция 2026-10-27.1</p><div class="preview"><div class="paper"><b>06 / Мирский замок</b><div class="image-placeholder">Фактическая страница read.pdf</div><p>История места</p></div><div class="paper second"><b>07 / Мой кадр</b><div class="photo-slot">Место для фотографии</div></div></div><div class="toolbar"><button aria-label="Предыдущая страница">←</button><label>Страница <input type="number" value="6" min="1" max="56"></label><button aria-label="Следующая страница">→</button><button>Масштаб 100%</button></div><h2>Содержание</h2><p><a href="#">6 · Мирский замок</a></p><p class="muted">В этом дизайн-макете полотно схематическое. В C3 используются изображения той же PDF-ревизии.</p>',
        'loading': '<h1>Книги путешественника</h1><p role="status">Загружаем издания…</p><div class="cards"><div class="skeleton"></div><div class="skeleton"></div></div>',
        'error': '<h1>Беларусь / предпросмотр</h1><div class="message" role="alert"><h2>Не удалось загрузить страницу</h2><p>Выбранные книга, формат и редакция сохранены. Проверьте соединение и попробуйте снова.</p><button>Повторить</button><a href="#">Скачать выбранный PDF</a></div>',
        'empty': '<h1>Книги путешественника</h1><div class="message"><h2>Издание ещё готовится</h2><p>Когда редакция и файлы будут проверены, здесь появятся предпросмотр и скачивание.</p></div>',
        'focus': '<a class="skip-link" href="#content">Перейти к книгам</a><h1 id="content">Беларусь / выбор файла</h1><button class="focused">Посмотреть всю книгу</button><p>Табуляция: просмотр → формат → файл → инструкция → типография.</p><p>Escape закрывает просмотр. Фокус возвращается на кнопку открытия.</p><p class="muted">Кнопка с обводкой показывает нормативное focus-visible состояние.</p>',
        'offline': '<h1>Беларусь / скачивание</h1><div class="message" role="alert"><h2>Нет соединения</h2><p>Новый файл сейчас недоступен. Ранее скачанный PDF можно открыть на устройстве.</p><button>Повторить скачивание</button></div><p class="muted">Сайт не обещает несуществующий офлайн-кэш.</p>',
    }
    artboards = []
    for width in [390, 320, 1440]:
        for name, body in states.items():
            artboards.append(f'<section class="artboard" data-state="{name}" style="width:{width}px"><header>{width}px / {name} / макет A2</header><main class="{ "desktop" if width == 1440 else "mobile" }">{body}</main></section>')
    css = '''*{box-sizing:border-box}body{margin:0;padding:32px;background:#e7e9e6;color:#3a3a3a;font-family:system-ui,sans-serif}.artboard{margin:0 0 48px;background:#fdfcfb;min-height:600px;overflow:hidden}header{padding:12px 20px;color:#636363;background:#f5f4f2;font-size:13px}main{padding:24px 20px}main.desktop{padding:48px 160px}h1{font:600 30px/1.15 Georgia,serif;overflow-wrap:anywhere}h2{font-size:20px;line-height:1.3}p{line-height:1.5;font-size:16px}button,a,input{font:inherit}button{min-height:44px;max-width:100%;padding:12px 16px;border-radius:12px;border:1px solid #547769;background:#f0f5f3;color:#29352f;text-align:left;overflow-wrap:anywhere}a{display:inline-flex;min-height:44px;align-items:center;color:#547769}label{display:block;min-height:44px;line-height:1.4;margin:8px 0}.cards{display:grid;gap:24px}.desktop .cards{grid-template-columns:1fr 1fr}.book{border:1px solid #d6ddd7;border-radius:16px;overflow:hidden;background:#fff}.book img{width:100%;aspect-ratio:3/2;object-fit:cover}.book>div{padding:20px}.muted{color:#636363}.preview{display:flex;gap:12px;padding:16px;background:#f5f4f2}.paper{background:#fffdf8;padding:16px;aspect-ratio:3/2;width:100%;border:1px solid #bdc7be}.desktop .paper{width:50%}.mobile .second{display:none}.image-placeholder,.photo-slot{margin:12px 0;background:#f7f1e7;min-height:90px;padding:12px;font-size:13px}.toolbar{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.toolbar input{width:64px;min-height:44px}.message{padding:24px;border:1px solid #bdc7be;border-radius:16px}.message a{display:flex}.skeleton{height:400px;border-radius:16px;background:linear-gradient(#e3e8e4 65%,#f5f4f2 65%)}.focused,.skip-link{outline:3px solid #2563eb;outline-offset:3px}.skip-link{margin-bottom:20px}'''
    doc = '<!doctype html><html lang="ru"><meta charset="utf-8"><title>MeTravel / A2 / экранные состояния</title><style>' + css + '</style><body>' + ''.join(artboards) + '</body></html>'
    (output / 'screen-states-v1.html').write_text(doc)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--font-dir', type=Path, required=True, help='Directory containing NotoSans-{Regular,Bold}.ttf and NotoSerif-Bold.ttf')
    parser.add_argument('--output', type=Path, default=HERE)
    args = parser.parse_args()
    global FONT_HASHES
    FONT_HASHES = {}
    for name, file in [('Sans', 'NotoSans-Regular.ttf'), ('SansBold', 'NotoSans-Bold.ttf'), ('SerifBold', 'NotoSerif-Bold.ttf')]:
        path = args.font_dir / file
        pdfmetrics.registerFont(TTFont(name, str(path)))
        FONT_HASHES[file] = hashlib.sha256(path.read_bytes()).hexdigest()
    args.output.mkdir(parents=True, exist_ok=True)
    reference = Reference(args.output)
    books = {country: json.loads((ROOT / 'data' / 'travelBooks' / country / 'editorial.json').read_text()) for country in COUNTRIES}
    for country, book in books.items():
        stop = book['stops'][0]
        for profile in PROFILES:
            for side in ['front', 'inside-front', 'inside-back', 'back']:
                reference.cover(profile, country, side, book)
            rest = reference.destination(profile, country, stop)
            reference.memory(profile, country, stop)
            reference.notes(profile, country, stop, rest)
            reference.collage(profile, country, stop)
    reference.control()
    reference.control(verso=True)
    for profile, chars in [('pocket-150x100', 550), ('album-a5', 900)]:
        stop = json.loads(json.dumps(books['by']['stops'][0]))
        stop['title'] = 'Гомельский дворцово-парковый ансамбль'
        key = 'compact' if chars == 550 else 'album'
        seed = stop['text'][key]
        stop['text'][key] = (seed + ' ' + seed)[:chars]
        rest = reference.destination(profile, 'by', stop, stress=True)
        reference.notes(profile, 'by', stop, rest)
    reference.credits()
    reference.save(args.output)
    screen_mocks(args.output)
    print(json.dumps(dict(output=str(args.output), pages=len(reference.pages), screenArtboards=24, overflow=0, revision=REVISION)))


if __name__ == '__main__':
    main()
