#!/usr/bin/env python3
"""Build a curated museum passport and its matching print files, locally.

Requires reportlab, pymupdf, pillow, qrcode and Poppler. Input art is reviewed
staging material; licensed Cyrillic fonts are reused from the repository.
"""
import argparse
import hashlib
import io
import json
import math
import subprocess
from pathlib import Path

import pymupdf
import qrcode
from PIL import Image
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, A3, landscape
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


INK = colors.HexColor('#3a3a3a')
MUTED = colors.HexColor('#636363')
SAGE = colors.HexColor('#547769')
RULE = colors.HexColor('#e6dfd5')
FILES = {'read': 'read.pdf', 'booklet': 'booklet-a3.pdf',
         'wrapCover': 'cover-a3.pdf', 'stickers': 'stickers-a4.pdf',
         'cover': 'cover.webp', 'preview': 'preview.webp'}
FONT_FILES = {
    'Body': 'docs/design/travel-memory-books-v1/assets/fonts/NotoSans-Regular.ttf',
    'BodyBold': 'docs/design/travel-memory-books-v1/assets/fonts/NotoSans-Bold.ttf',
    'Heading': 'data/travelBooks/assets/fonts/lora/Lora-Medium.ttf',
}


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def ensure(condition, message):
    if not condition:
        raise ValueError(message)


def verify_inputs(data, resources, root):
    """Rights/provenance must identify the bytes actually entering this edition."""
    provenance = json.loads((root / 'data/travelBooks/museumPassports/krakow-provenance.json').read_text())
    logo = provenance['logo']
    if data['logo'] != logo['source'] or digest(root / data['logo']) != logo['sha256']:
        raise ValueError('The original logo differs from its reviewed provenance')
    art = {Path(entry['resource']).name: entry for entry in provenance['artwork']['files']}
    required = {'cover-wrap.png', *data['atlases'].values()}
    for filename in required:
        record = art.get(filename)
        actual = resources / 'art' / filename
        if not record or digest(actual) != record['sha256']:
            raise ValueError(f'Artwork differs from its reviewed provenance: {filename}')
        with Image.open(actual) as image:
            if image.size != (record['nativeWidth'], record['nativeHeight']):
                raise ValueError(f'Native artwork dimensions differ: {filename}')
    if {font['source'] for font in provenance['fonts']} != set(FONT_FILES.values()):
        raise ValueError('Font provenance must cover every embedded font')
    for font in provenance['fonts']:
        if digest(root / font['source']) != font['sha256']:
            raise ValueError(f'Font differs from its reviewed provenance: {font["source"]}')
    seen = set()
    for museum in data['museums']:
        grid, cell = museum.get('atlasGrid', 4), museum['cell']
        identity = (museum['atlas'], cell)
        if museum['atlas'] not in data['atlases'] or grid not in (1, 4) or not 0 <= cell < grid * grid or identity in seen:
            raise ValueError(f'Invalid or reused sticker illustration: {museum["sourceId"]}')
        seen.add(identity)


def register_fonts(root):
    for family, filename in FONT_FILES.items():
        font = TTFont(family, str(root / filename))
        pdfmetrics.registerFont(font)
        needed = set('Музейный паспорт КраковаąćęłńóśźżĄĆĘŁŃÓŚŹŻ')
        ensure(all(ord(c) in font.face.charToGlyph for c in needed if c != ' '), f'Font lacks required glyphs: {filename}')


def text(c, value, x, y, size=9, font='Body', color=INK, align='left'):
    c.setFillColor(color)
    c.setFont(font, size)
    getattr(c, {'left': 'drawString', 'center': 'drawCentredString', 'right': 'drawRightString'}[align])(x, y, value)


def lines_for(value, width, size, font='Body'):
    result, line = [], ''
    for word in value.split():
        trial = f'{line} {word}'.strip()
        if line and pdfmetrics.stringWidth(trial, font, size) > width:
            result.append(line)
            line = word
        else:
            line = trial
        if pdfmetrics.stringWidth(line, font, size) > width:
            raise ValueError(f'Unbreakable text exceeds its slot: {word}')
    if line:
        result.append(line)
    return result


def paragraph(c, value, x, y, width, size=9, leading=None, font='Body', color=INK, max_lines=None):
    leading = leading or size * 1.45
    rows = lines_for(value, width, size, font)
    if max_lines is not None and len(rows) > max_lines:
        raise ValueError(f'Text does not fit {max_lines} lines: {value}')
    for line in rows:
        text(c, line, x, y, size, font, color)
        y -= leading
    return y


def brand(c, logo, cx, y, size=14, bird_mm=10):
    label = 'metravel.by'
    tw = pdfmetrics.stringWidth(label, 'BodyBold', size)
    bird = bird_mm * mm
    gap = 1.5 * mm
    x = cx - (bird + gap + tw) / 2
    c.drawImage(str(logo), x, y - bird * .25, bird, bird, mask='auto')
    text(c, label, x + bird + gap, y, size, 'BodyBold')


def page_base(c, page, count, heading):
    w, h = A4
    c.setFillColor(colors.white)
    c.rect(0, 0, w, h, fill=1, stroke=0)
    text(c, 'КРАКОВ / МУЗЕЙНЫЙ ПАСПОРТ', 13 * mm, h - 12 * mm, 7, 'BodyBold', SAGE)
    text(c, heading, w - 13 * mm, h - 12 * mm, 7, color=MUTED, align='right')
    text(c, 'metravel.by', 13 * mm, 9 * mm, 7, color=MUTED)
    text(c, f'{page:02d} / {count:02d}', w - 13 * mm, 9 * mm, 7, color=MUTED, align='right')


def cover(out, art, logo):
    w, h = landscape(A3)
    c = canvas.Canvas(str(out), pagesize=(w, h), pageCompression=1, invariant=1, initialFontName='Body')
    c.setTitle('Музейный паспорт Кракова - полная обложка A3 - metravel.by')
    c.drawImage(str(art), 0, 0, w, h)
    front = w * .75
    text(c, 'МУЗЕЙНЫЙ ПАСПОРТ', front, h - 26 * mm, 23, 'Heading', align='center')
    text(c, 'КРАКОВА', front, h - 48 * mm, 47, 'Heading', align='center')
    brand(c, logo, front, 13 * mm, size=18, bird_mm=12)
    text(c, 'Музейный паспорт Кракова', w * .25, h - 34 * mm, 16, 'Heading', align='center')
    brand(c, logo, w * .25, 25 * mm, size=14, bird_mm=10)
    c.showPage()
    c.save()


def qr(c, url, x, y, size):
    code = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=8, border=4)
    code.add_data(url)
    code.make(fit=True)
    if size / mm / len(code.get_matrix()) < .25:
        raise ValueError(f'QR modules are too small for the printed card: {url}')
    buf = io.BytesIO()
    code.make_image(fill_color='black', back_color='white').save(buf, format='PNG')
    buf.seek(0)
    c.drawImage(ImageReader(buf), x, y, size, size)
    c.linkURL(url, (x, y, x + size, y + size), relative=0, thickness=0)


def card(c, item, x, y, width, height):
    top = y + height
    c.setStrokeColor(RULE)
    c.setLineWidth(.5)
    c.roundRect(x, y, width, height, 2 * mm, stroke=1, fill=0)
    text(c, f'{item["number"]:03d}', x + 4 * mm, top - 7 * mm, 9, 'BodyBold', SAGE)
    title_y = paragraph(c, item['name'], x + 4 * mm, top - 14 * mm, width - 8 * mm,
                        10.3, 13.2, 'Heading', max_lines=3)
    address_y = min(title_y - 2 * mm, top - 31 * mm)
    address_y = paragraph(c, item['address'], x + 4 * mm, address_y, width - 8 * mm,
                          7.3, 10, color=MUTED, max_lines=3)
    paragraph(c, item['description'], x + 4 * mm, address_y - 3 * mm, width - 8 * mm,
              8, 11, max_lines=5)
    visit = item.get('visitNote') or ('Сезонное посещение' if item.get('seasonal') else '')
    if visit:
        text(c, visit, x + 4 * mm, y + 61 * mm, 6.7, color=SAGE)
    text(c, 'НАКЛЕЙКА ИЛИ БИЛЕТ', x + width / 2, y + 55 * mm, 6.5, color=MUTED, align='center')
    c.setStrokeColor(RULE)
    c.setDash(2, 2)
    c.roundRect(x + 5 * mm, y + 18 * mm, width - 10 * mm, 34 * mm, 2 * mm, stroke=1, fill=0)
    c.setDash()
    text(c, 'Дата: ____ / ____ / ______', x + 4 * mm, y + 12 * mm, 7)
    text(c, 'Оценка:  1  2  3  4  5', x + 4 * mm, y + 7 * mm, 7)
    qr(c, item['officialUrl'], x + width - 21 * mm, y + 1 * mm, 16 * mm)


def reading_pdf(out, museums, date, logo):
    w, h = A4
    card_pages = math.ceil(len(museums) / 4)
    index_pages = math.ceil(len(museums) / 30)
    total = math.ceil((2 + card_pages + index_pages + 1) / 4) * 4
    c = canvas.Canvas(str(out), pagesize=A4, pageCompression=1, invariant=1, initialFontName='Body')
    c.setTitle('Музейный паспорт Кракова - metravel.by')
    page_base(c, 1, total, 'НАШ МУЗЕЙНЫЙ ПАСПОРТ')
    text(c, 'Музейный паспорт', w / 2, h - 43 * mm, 27, 'Heading', align='center')
    text(c, 'Кракова', w / 2, h - 60 * mm, 37, 'Heading', align='center')
    text(c, f'{len(museums)} мест для индивидуального посещения', w / 2, h - 78 * mm, 11, align='center')
    paragraph(c, 'Музеи, филиалы и исторические экспозиции, куда можно прийти одному человеку. Экскурсии и сеансы с индивидуальным билетом тоже включены.', 24 * mm, h - 101 * mm, w - 48 * mm, 11)
    for caption, yy in [('Наши имена', 134), ('Начало путешествия', 103), ('Наш любимый музей', 72)]:
        text(c, caption, 24 * mm, yy * mm, 11, 'Heading')
        c.setStrokeColor(RULE)
        c.line(24 * mm, (yy - 12) * mm, w - 24 * mm, (yy - 12) * mm)
    brand(c, logo, w / 2, 28 * mm, 15, 10)
    c.showPage()
    page_base(c, 2, total, 'КАК ПОЛЬЗОВАТЬСЯ И ПЕЧАТАТЬ')
    yy = h - 33 * mm
    instructions = [
        ('Выберите музей', 'Номер в указателе совпадает с номером карточки и наклейки. Для обязательной экскурсии купите индивидуальный билет на нужное время.'),
        ('Проверьте визит', 'QR открывает официальный сайт музея или его оператора. Перед поездкой проверьте часы, билеты, доступность экспозиций и сезонные перерывы. Расписание может меняться.'),
        ('Сохраните воспоминание', 'После посещения впишите дату, обведите оценку, вклейте наклейку или билет. Названия музеев сохранены на польском языке.'),
        ('Книжка A3', 'Файл booklet-a3.pdf уже разложен для буклетной печати. A3, альбомная ориентация, двусторонняя печать, переворот по короткой стороне, масштаб 100%. Не включайте режим «буклет» повторно.'),
        ('Обложка и наклейки', 'Обложку cover-a3.pdf печатайте отдельно на A3, с одной стороны, в масштабе 100%. Слева задняя сторона, справа лицевая. Наклейки stickers-a4.pdf - A4, односторонняя печать, масштаб 100%; вырезать по светлому контуру.'),
        ('О составе', f'Условия индивидуального посещения проверены {date}. Закрытые места, посещение только группой и неподтверждённый доступ в этот выпуск не включены. Сезонные места отмечены. Это подборка, а не обещание полноты каталога.'),
    ]
    for heading, body in instructions:
        text(c, heading, 16 * mm, yy, 13, 'Heading')
        yy = paragraph(c, body, 16 * mm, yy - 8 * mm, w - 32 * mm, 9, 13) - 8 * mm
    c.showPage()
    for index in range(card_pages):
        page_base(c, index + 3, total, 'ОТМЕТЬТЕ ПОСЕЩЕНИЕ')
        for offset, item in enumerate(museums[index * 4:(index + 1) * 4]):
            item['page'] = index + 3
            col, row = offset % 2, offset // 2
            card(c, item, (13 + col * 95) * mm, (151 - row * 130) * mm, 89 * mm, 122 * mm)
        c.showPage()
    for index in range(index_pages):
        page_base(c, 3 + card_pages + index, total, 'УКАЗАТЕЛЬ')
        yy = h - 32 * mm
        text(c, 'Все места по номерам', 16 * mm, yy, 20, 'Heading')
        yy -= 12 * mm
        for item in museums[index * 30:(index + 1) * 30]:
            text(c, f'{item["number"]:03d}', 16 * mm, yy, 8.5, 'BodyBold', SAGE)
            sz = 8.3
            while pdfmetrics.stringWidth(item['name'], 'Body', sz) > 154 * mm:
                sz -= .1
            text(c, item['name'], 28 * mm, yy, sz)
            text(c, str(item['page']), w - 16 * mm, yy, 8.5, align='right')
            yy -= 7.4 * mm
        c.showPage()
    current = 3 + card_pages + index_pages
    while current <= total:
        page_base(c, current, total, 'НАШИ ОТКРЫТИЯ' if current < total else 'ИСТОЧНИКИ')
        if current == total:
            yy = paragraph(c, 'Источники и оформление', 18 * mm, h - 36 * mm, w - 36 * mm, 20, font='Heading')
            paragraphs = [
                'Основой послужил переданный владельцем музейный паспорт Кракова. Список отредактирован по условию индивидуального посещения. Официальная страница каждого места доступна по QR на его карточке.',
                f'Проверка условий доступа: {date}. Билет, запись на экскурсию и сезон работы проверяйте перед визитом. Подборка включает музейные филиалы, галереи и исторические экспозиции.',
                'Оформление «Бумажный театр»: AI-иллюстрации музейных тем. Это художественные символы, а не документальные изображения зданий и экспонатов. Оригинальный логотип MeTravel размещён отдельным элементом.',
                'Шрифты Lora и Noto Sans распространяются по SIL Open Font License 1.1. Файл для цифрового чтения и пробной домашней печати; при увеличении иллюстрации могут выглядеть мягче текста.',
                f'Посещено: ______ / {len(museums)}',
            ]
            for value in paragraphs:
                yy = paragraph(c, value, 18 * mm, yy - 12 * mm, w - 36 * mm, 10, 15)
        c.showPage()
        current += 1
    c.save()
    return total


def impose(read_path, out):
    src = pymupdf.open(read_path)
    dst = pymupdf.open()
    count = len(src)
    ensure(count >= 4 and count % 4 == 0, 'Booklet pages must be a positive multiple of four')
    w, h = landscape(A3)
    sequence = []
    for sheet in range(count // 4):
        for pair in [(count - 1 - 2 * sheet, 2 * sheet), (2 * sheet + 1, count - 2 - 2 * sheet)]:
            page = dst.new_page(width=w, height=h)
            for side, number in enumerate(pair):
                page.show_pdf_page(pymupdf.Rect(side * w / 2, 0, (side + 1) * w / 2, h), src, number)
            sequence.append([i + 1 for i in pair])
    dst.save(out, garbage=4, deflate=True, no_new_id=True)
    ensure(sorted(n for pair in sequence for n in pair) == list(range(1, count + 1)), 'Imposition must contain every reading page exactly once')
    return sequence


def sticker_art(c, atlas, cell, x, y, size, grid=4):
    # A PDF clipping path lays out original atlas bytes; no bitmap regeneration.
    col, row = cell % grid, cell // grid
    c.saveState()
    clip = c.beginPath()
    clip.rect(x, y, size, size)
    c.clipPath(clip, stroke=0)
    c.drawImage(str(atlas), x - col * size, y - (grid - 1 - row) * size, size * grid, size * grid)
    c.restoreState()


def stickers(out, museums, atlases, logo):
    w, h = A4
    c = canvas.Canvas(str(out), pagesize=A4, pageCompression=1, invariant=1, initialFontName='Body')
    c.setTitle('Музейный паспорт Кракова - наклейки - metravel.by')
    # Each 45 x 33 mm sticker fits the passport's 79 x 34 mm ticket slot.
    per_page = 28
    count = math.ceil(len(museums) / per_page)
    for page in range(count):
        text(c, 'КРАКОВ / МУЗЕЙНЫЕ НАКЛЕЙКИ', 10 * mm, h - 10 * mm, 9, 'BodyBold', SAGE)
        text(c, f'{page + 1} / {count}', w - 10 * mm, h - 10 * mm, 8, align='right')
        for offset, item in enumerate(museums[page * per_page:(page + 1) * per_page]):
            col, row = offset % 4, offset // 4
            x, y = (10 + col * 48.5) * mm, h - (19 + (row + 1) * 38) * mm
            cw, ch = 45 * mm, 33 * mm
            c.setStrokeColor(RULE)
            c.setLineWidth(.45)
            c.roundRect(x, y, cw, ch, 3 * mm, stroke=1, fill=0)
            art_size = 21 * mm
            atlas = atlases[item['atlas']]
            sticker_art(c, atlas, item['cell'], x + (cw - art_size) / 2, y + 11 * mm, art_size, item.get('atlasGrid', 4))
            text(c, f'{item["number"]:03d}', x + 2 * mm, y + ch - 4 * mm, 6.5, 'BodyBold', SAGE)
            sz = 6
            while len(lines_for(item['name'], cw - 4 * mm, sz, 'BodyBold')) > 2:
                sz -= .1
            paragraph(c, item['name'], x + 2 * mm, y + 9.5 * mm, cw - 4 * mm, sz, 7.5, 'BodyBold', max_lines=2)
            brand(c, logo, x + cw / 2, y + 2.2 * mm, size=6, bird_mm=4.2)
        text(c, 'A4 / 100% / вырезать по светлому контуру', 10 * mm, 7 * mm, 7, color=MUTED)
        c.showPage()
    c.save()
    return count


def render_webp(pdf, out, page=0, clip=None, width=900):
    doc = pymupdf.open(pdf)
    p = doc[page]
    rect = clip or p.rect
    scale = width / rect.width
    png = out.with_suffix('.png')
    subprocess.run(['pdftoppm', '-f', str(page + 1), '-l', str(page + 1),
                    '-scale-to-x', str(round(p.rect.width * scale)), '-scale-to-y', '-1',
                    '-x', str(round(rect.x0 * scale)), '-y', str(round(rect.y0 * scale)),
                    '-W', str(width), '-H', str(round(rect.height * scale)),
                    '-singlefile', '-png', str(pdf), str(png.with_suffix(''))], check=True)
    with Image.open(png) as image:
        image.save(out, 'WEBP', quality=88)


def rights_proof(out, data, assets, root):
    evidence = 'data/travelBooks/museumPassports/krakow-provenance.json'
    common = {'rightsHolder': 'MeTravel owner', 'permissions': ['digital-distribution', 'print', 'adaptation'],
              'royaltyStatus': 'none', 'attribution': {'required': False}}
    materials = []
    for mid, kind, basis, source, path in [
        ('source-text', 'text', 'permission', data['sourcePdf']['filename'], evidence),
        ('paper-art', 'illustration', 'original', 'Owner-commissioned built-in image_gen paper-theater illustrations', evidence),
        ('logo', 'illustration', 'permission', data['logo'], evidence),
        ('font-lora', 'font', 'license', 'Lora / SIL Open Font License 1.1', 'data/travelBooks/assets/fonts/lora/OFL.txt'),
        ('font-noto', 'font', 'license', 'Noto Sans / SIL Open Font License 1.1', 'docs/design/travel-memory-books-v1/assets/fonts/LICENSE.txt'),
    ]:
        materials.append({**common, 'id': mid, 'kind': kind, 'basis': basis, 'source': source,
                          'rightsHolder': 'Font copyright holders in the attached OFL license' if kind == 'font' else common['rightsHolder'],
                          'evidencePath': path, 'evidenceSha256': digest(root / path)})
    artifacts = []
    for key, filename in FILES.items():
        ids = ['source-text', 'logo', 'font-lora', 'font-noto']
        if key in ('wrapCover', 'stickers', 'cover'):
            ids.append('paper-art')
        artifacts.append({'id': filename, 'sha256': assets[key]['sha256'], 'materialIds': ids})
    (out / 'rights.json').write_text(json.dumps({'schemaVersion': 1, 'bookId': data['id'], 'revision': data['revision'],
                                               'artifacts': artifacts, 'materials': materials}, ensure_ascii=False, indent=2) + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--resources', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(args.input.read_text())
    source_ids = [item['sourceId'] for item in data['museums']]
    ensure(bool(source_ids) and len(set(source_ids)) == len(source_ids), 'Empty or duplicate source museums')
    ensure(all(item['decision'] == 'include' and item.get('officialUrl', '').startswith('https://') for item in data['museums']), 'Only included museums with official HTTPS links may be published')
    root = Path(__file__).resolve().parents[2]
    verify_inputs(data, args.resources, root)
    register_fonts(root)
    out = args.output / data['id'] / data['revision']
    out.mkdir(parents=True, exist_ok=True)
    logo = Path(data['logo'])
    cover_art = args.resources / 'art' / 'cover-wrap.png'
    atlases = {name: args.resources / 'art' / filename for name, filename in data['atlases'].items()}
    museums = [{**item, 'number': index + 1} for index, item in enumerate(data['museums'])]
    cover(out / FILES['wrapCover'], cover_art, logo)
    count = reading_pdf(out / FILES['read'], museums, data['checkedAt'], logo)
    sequence = impose(out / FILES['read'], out / FILES['booklet'])
    sticker_count = stickers(out / FILES['stickers'], museums, atlases, logo)
    w, h = landscape(A3)
    render_webp(out / FILES['wrapCover'], out / FILES['cover'], clip=pymupdf.Rect(w / 2, 0, w, h))
    render_webp(out / FILES['read'], out / FILES['preview'], page=2)
    with Image.open(cover_art) as image:
        ppi = min(image.width / (420 / 25.4), image.height / (297 / 25.4))
    assets = {}
    base = f'https://metravel.by/travel-books/{data["id"]}/{data["revision"]}/'
    for key, filename in FILES.items():
        path = out / filename
        assets[key] = {'uri': base + filename, 'mime': 'image/webp' if filename.endswith('.webp') else 'application/pdf', 'bytes': path.stat().st_size, 'sha256': digest(path)}
    rights_proof(out, data, assets, root)
    payload = {'id': data['id'], 'slug': data['slug'], 'revision': data['revision'],
               'title': 'Музейный паспорт Кракова',
               'summary': f'{len(museums)} мест для индивидуального посещения: карточки музеев, обложка и наклейки в стиле «Бумажный театр».',
               'country': 'PL', 'contentLocale': 'ru', 'museumCount': len(museums),
               'logicalPageCount': count, 'bookletPageCount': len(sequence), 'stickersPageCount': sticker_count,
               'quality': {'printReady': False, 'minIllustrationPpi': round(ppi, 1)},
               'museums': [{'number': item['number'], 'title': item['name'], 'page': item['page']} for item in museums], **assets}
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / 'passports.json').write_text(json.dumps({'schemaVersion': 1, 'passports': [payload]}, ensure_ascii=False, indent=2) + '\n')
    # Validate bytes and structure independently from the renderer's bookkeeping.
    for key, pages, expected in [('read', count, A4), ('booklet', len(sequence), landscape(A3)), ('wrapCover', 1, landscape(A3)), ('stickers', sticker_count, A4)]:
        doc = pymupdf.open(out / FILES[key])
        ensure(len(doc) == pages, f'PDF page count differs: {key}')
        ensure(all(abs(page.rect.width - expected[0]) < .1 and abs(page.rect.height - expected[1]) < .1 for page in doc), f'PDF physical dimensions differ: {key}')
        ensure(all(page.get_text().strip() for page in doc), f'Empty text layer: {key}')
    read_text = ''.join(page.get_text() for page in pymupdf.open(out / FILES['read']))
    sticker_text = ''.join(page.get_text() for page in pymupdf.open(out / FILES['stickers']))
    ensure(sticker_text.count('metravel.by') == len(museums), 'Every sticker must contain its brand label')
    normal_read, normal_stickers = ' '.join(read_text.split()), ' '.join(sticker_text.split())
    ensure(all(item['name'] in normal_read and item['name'] in normal_stickers for item in museums), 'The passport and stickers must contain every selected museum')
    report = {'schemaVersion': 1, 'passports': [{'id': data['id'], 'revision': data['revision'], 'digitalPass': True,
              'logicalPageCount': count, 'bookletPageCount': len(sequence), 'stickersPageCount': sticker_count,
              'assets': {key: value['sha256'] for key, value in assets.items()}}],
              'imposition': sequence, 'sourceIds': source_ids, 'artworkMinPpi': round(ppi, 1)}
    (args.output / 'validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'edition': str(out), 'museums': len(museums), 'logicalPages': count, 'A3Sides': len(sequence), 'stickerPages': sticker_count, 'artworkPpi': round(ppi, 1)}))


if __name__ == '__main__':
    main()
