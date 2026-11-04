#!/usr/bin/env python3
"""Stage the original six-page mini diaries and matching, verified PDF previews."""
import argparse
import errno
import hashlib
import json
import re
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from xml.sax.saxutils import escape

import zxingcpp
from PIL import Image, ImageOps
from pypdf import PdfReader
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.lib.colors import HexColor, black
from reportlab.lib.pagesizes import A5
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'data/travelBooks/mini-diaries/source.json'
REFERENCE = ROOT / 'docs/design/travel-memory-books-v1/assets'
WIDTH, HEIGHT = A5
LEFT, RIGHT = 34, WIDTH - 34
PAGES = 6
INK, MUTED, RULE = map(HexColor, ['#192a24', '#455b51', '#a5b5ab'])
SITE = 'https://metravel.by'
OUTPUT_NAME = 'mini-diaries.json'
ARTIFACTS = {
    'pdf': ('read.pdf', 'application/pdf'),
    'cover': ('cover.webp', 'image/webp'),
    'preview': ('preview.webp', 'image/webp'),
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(data):
    return (json.dumps(data, ensure_ascii=False, indent=2) + '\n').encode()


def read_json(path):
    return json.loads(path.read_bytes())


def check_https(url):
    parsed = urlsplit(url)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.fragment:
        raise ValueError(f'Invalid source URL: {url}')
    return parsed


def load_sources():
    source = read_json(SOURCE)
    diaries = source['diaries']
    if source['schemaVersion'] != 1 or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', source['checkedAt']):
        raise ValueError('Expected a dated source snapshot')
    if not diaries or len({book['id'] for book in diaries}) != len(diaries) or len({book['slug'] for book in diaries}) != len(diaries):
        raise ValueError('Every diary needs a distinct id and slug')
    rows = read_json(ROOT / 'data/travelBooks/by/selection.json')['rows']
    author_points = {row['pointId']: row for row in rows if row['authorId'] == 1}
    for book in diaries:
        if any(not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', book[key]) for key in ('id', 'slug')):
            raise ValueError(f"Invalid diary identity: {book['id']}")
        if book['art'] not in ('water', 'towers') or len(book['stops']) != 3 or len(book['prompts']) != 3:
            raise ValueError(f"{book['title']}: expected three distinct journeys and three recap questions")
        if len({stop['mapUrl'] for stop in book['stops']}) != 3:
            raise ValueError(f"{book['title']}: repeated journey destination")
        for stop in book['stops']:
            map_url, article = (check_https(stop[key]) for key in ('mapUrl', 'articleUrl'))
            check_https(stop['accessUrl'])
            if map_url.netloc != 'metravel.by' or map_url.path != '/map' or article.netloc != 'metravel.by':
                raise ValueError(f"{stop['title']}: navigation must use exact MeTravel routes")
            evidence = stop['evidence']
            if evidence['kind'] == 'author-1-travel':
                row = author_points[evidence['pointId']]
                if (row['travelId'], row['bookMapQrUrl'], row['travelUrl']) != (evidence['travelId'], stop['mapUrl'], stop['articleUrl']):
                    raise ValueError(f"{stop['title']}: navigation differs from author-1 point")
            elif evidence['kind'] == 'published-quest-stop':
                params = parse_qs(map_url.query)
                lat, lng = evidence['coordinates']
                if (params.get('lat') != [str(lat)] or params.get('lng') != [str(lng)]
                        or params.get('focusPlace') != ['1'] or not params.get('placeTitle')
                        or not re.fullmatch(r'/quests/\d+/' + re.escape(evidence['questId']), article.path)):
                    raise ValueError(f"{stop['title']}: navigation differs from the verified quest stop")
            else:
                raise ValueError(f"{stop['title']}: unknown source evidence")
    return source


def relative(path):
    return path.relative_to(ROOT).as_posix()


def register_fonts():
    registry = read_json(REFERENCE / 'provenance.json')
    license_record = registry['fontLicense']
    license_path = REFERENCE / license_record['file']
    license_sha = digest(license_path.read_bytes())
    if license_sha != license_record['sha256']:
        raise ValueError('Noto OFL evidence has changed')
    materials = []
    for role, stem in [('Text', 'NotoSans-Regular'), ('Bold', 'NotoSans-Bold'), ('Title', 'NotoSerif-Bold')]:
        file = f'fonts/{stem}.ttf'
        record = next(item for item in registry['fonts'] if item['file'] == file)
        font_path = REFERENCE / file
        if digest(font_path.read_bytes()) != record['sha256'] or record['licenseFile'] != license_record['file']:
            raise ValueError(f'Font bytes or license differ from provenance: {stem}')
        pdfmetrics.registerFont(TTFont(role, font_path))
        materials.append(material('font-' + stem.lower(), 'font', 'license', record['author'], relative(font_path), license_path))
    return materials


def material(identifier, kind, basis, rights_holder, source, evidence):
    return {
        'id': identifier, 'kind': kind, 'basis': basis, 'rightsHolder': rights_holder,
        'source': source, 'evidencePath': relative(evidence), 'evidenceSha256': digest(evidence.read_bytes()),
        'permissions': ['digital-distribution', 'print'], 'royaltyStatus': 'none',
        'attribution': {'required': False},
    }


class Page:
    def __init__(self, pdf, number, section):
        self.pdf = pdf
        self.number = number
        self.text('METRAVEL  /  ' + section, HEIGHT - 28, 8, 'Bold', MUTED)
        self.rule(HEIGHT - 47)

    def text(self, value, top, size=11, family='Text', color=INK, x=LEFT, width=RIGHT-LEFT, floor=43):
        para = Paragraph(escape(value), ParagraphStyle('MiniDiary', fontName=family, fontSize=size,
                         leading=size * 1.38, textColor=color))
        _, height = para.wrap(width, HEIGHT)
        bottom = top - height
        if bottom < floor:
            raise ValueError(f'Page {self.number}: text overflows its region: {value[:55]}')
        para.drawOn(self.pdf, x, bottom)
        return bottom

    def rule(self, y):
        self.pdf.setStrokeColor(RULE)
        self.pdf.setLineWidth(.58)
        self.pdf.line(LEFT, y, RIGHT, y)

    def url(self, label, url, y):
        bottom = self.text(label, y, 9, 'Bold', MUTED)
        self.pdf.linkURL(url, (LEFT, bottom, RIGHT, y), relative=0)
        return bottom

    def qr(self, label, url, x):
        size = 82
        widget = QrCodeWidget(url, barWidth=size, barHeight=size, barBorder=4, barLevel='M')
        self.pdf.setFillColor(black)
        for rect in widget.draw().contents:
            if rect.fillColor is not None:
                self.pdf.rect(x + rect.x, 250 + rect.y, rect.width, rect.height, stroke=0, fill=1)
        self.text(label, 249, 8.5, 'Bold', INK, x=x + 4, width=140)
        self.pdf.linkURL(url, (x, 236, x + 142, 332), relative=0)

    def finish(self, caption):
        self.rule(37)
        self.text(caption, 26, 7.5, 'Bold', MUTED, floor=10)
        self.pdf.setFillColor(MUTED)
        self.pdf.setFont('Bold', 8)
        self.pdf.drawRightString(RIGHT, 16, f'{self.number:02d} / {PAGES:02d}')
        self.pdf.showPage()


def cover_art(pdf, style):
    pdf.setStrokeColor(MUTED)
    pdf.setLineWidth(1.3)
    if style == 'water':
        for shift in range(0, 58, 19):
            curve = pdf.beginPath()
            curve.moveTo(LEFT, 200 + shift)
            curve.curveTo(126, 257 + shift, 249, 142 + shift, RIGHT, 211 + shift)
            pdf.drawPath(curve)
    else:
        for x, height in ((54, 88), (164, 112), (274, 92)):
            pdf.rect(x, 168, 78, height)
            pdf.lines(((x, 168 + height, x + 39, 188 + height),
                       (x + 39, 188 + height, x + 78, 168 + height)))
            pdf.roundRect(x + 30, 180, 18, 34, 7)


def render_diary(book, file):
    caption = 'МИНИ-ДНЕВНИК  /  ' + book['title'].upper()
    pdf = Canvas(str(file), pagesize=A5, initialFontName='Text', invariant=1)
    pdf.setAuthor('MeTravel')
    pdf.setTitle(book['title'])
    pdf.setSubject(book['subtitle'])

    page = Page(pdf, 1, 'ДНЕВНИК ПОЕЗДОК')
    y = page.text(book['title'], HEIGHT - 96, 34, 'Title')
    page.text(book['subtitle'], y - 14, 16, 'Bold', MUTED)
    page.rule(349)
    page.text(book['coverLine'], 326, 9, 'Bold', MUTED)
    cover_art(pdf, book['art'])
    page.text('МОЙ ДНЕВНИК', 116, 9, 'Bold', MUTED)
    page.rule(83)
    page.finish(caption)

    page = Page(pdf, 2, 'ПЕРЕД ПОЕЗДКОЙ')
    y = page.text('Выберите свой день', HEIGHT - 71, 25, 'Title')
    y = page.text(book['intro'], y - 15)
    y = page.text(book['choice'], y - 12)
    y = page.text('Для домашней печати выберите бумагу A5 и масштаб 100 %. Можно распечатать только страницу выбранной поездки.',
                  y - 12, 9.5, 'Text', MUTED)
    y = page.text('Запишите перед выездом', y - 19, 13, 'Bold')
    for label in ('Дата и место', 'Точка старта и как до неё добраться', 'Как возвращаемся', 'План на случай дождя или закрытия'):
        page.text(label, y - 15, 9.5, 'Text', MUTED)
        page.rule(y - 43)
        y -= 50
    page.finish(caption)

    for number, stop in enumerate(book['stops'], 1):
        page = Page(pdf, number + 2, f'ПОЕЗДКА {number:02d}')
        y = page.text(stop['title'], HEIGHT - 68, 25, 'Title')
        y = page.text(stop['subtitle'], y - 5, 10.4, 'Bold', MUTED)
        y = page.text(stop['observation'], y - 12)
        y = page.text('Перед выездом', y - 13, 9.5, 'Bold')
        page.text(stop['access'], y - 4, 10, floor=337)
        page.qr('Место на карте', stop['mapUrl'], LEFT)
        label = 'Квест на сайте' if stop['evidence']['kind'] == 'published-quest-stop' else 'Статья на сайте'
        page.qr(label, stop['articleUrl'], LEFT + 174)
        page.text(stop['framePrompt'], 219, 9, 'Bold', MUTED)
        pdf.setStrokeColor(RULE)
        pdf.setLineWidth(.65)
        pdf.roundRect(LEFT, 82, RIGHT - LEFT, 119, 8)
        page.text('Моя деталь дня', 71, 8, 'Bold')
        page.rule(47)
        page.finish(caption)

    page = Page(pdf, 6, 'ПОСЛЕ ПОЕЗДКИ')
    y = page.text('Что осталось в памяти', HEIGHT - 71, 23, 'Title')
    for prompt in book['prompts']:
        y = page.text(prompt, y - 20, 11, 'Bold')
        page.rule(y - 27)
        page.rule(y - 48)
        y -= 51
    y = page.text('Перед выездом проверьте доступ', y - 18, 11, 'Bold')
    for stop in book['stops']:
        y = page.url(stop['title'] + ' · ' + stop['accessLabel'], stop['accessUrl'], y - 6)
    page.text('Оригинальные текст и графика MeTravel. Шрифты Noto Sans и Noto Serif, лицензия SIL OFL 1.1.',
              y - 13, 8, 'Text', MUTED)
    page.finish(caption)
    pdf.save()


def render_page(pdf, page, dpi, png):
    subprocess.run(['pdftoppm', '-f', str(page), '-l', str(page), '-r', str(dpi), '-singlefile',
                    '-png', str(pdf), str(png.with_suffix(''))], check=True, capture_output=True, timeout=60)


def verify_and_preview(book, folder):
    pdf = folder / 'read.pdf'
    reader = PdfReader(pdf)
    if len(reader.pages) != PAGES:
        raise ValueError(f'{pdf}: expected exactly {PAGES} pages')
    report = []
    for number, page in enumerate(reader.pages, 1):
        box = page.mediabox
        if abs(float(box.width) - WIDTH) > .01 or abs(float(box.height) - HEIGHT) > .01:
            raise ValueError(f'{pdf}: page {number} is not A5')
        if not page.extract_text().strip() or page.images:
            raise ValueError(f'{pdf}: page {number} needs selectable text and vector art')
        font_resources = page['/Resources']['/Font']
        for ref in font_resources.values():
            descriptor = ref.get_object().get('/FontDescriptor', {})
            if '/FontFile2' not in descriptor:
                raise ValueError(f'{pdf}: page {number} has a non-embedded font')
        annotations = [str(ref.get_object()['/A']['/URI']) for ref in page.get('/Annots', [])]
        expected = []
        if 3 <= number <= 5:
            stop = book['stops'][number - 3]
            expected = [stop['mapUrl'], stop['articleUrl']]
        elif number == 6:
            expected = [stop['accessUrl'] for stop in book['stops']]
        if annotations != expected:
            raise ValueError(f'{pdf}: wrong PDF links on page {number}')
        if number not in (1, 3, 4, 5):
            continue
        png = folder / f'page-{number}.png'
        render_page(pdf, number, 144 if number == 1 else 300, png)
        with Image.open(png) as image:
            if 3 <= number <= 5:
                for mode, raster in (('color', image), ('grayscale', ImageOps.grayscale(image))):
                    decoded = [barcode.text for barcode in zxingcpp.read_barcodes(raster)]
                    if sorted(decoded) != sorted(expected):
                        raise ValueError(f'{pdf}: page {number} {mode} QR decoding mismatch: {decoded}')
                    report.append({'page': number, 'mode': mode, 'dpi': 300, 'urls': expected})
            if number in (1, 3):
                sample = image.convert('RGB')
                sample.thumbnail((1050, 1488), Image.Resampling.LANCZOS)
                sample.save(folder / ('cover.webp' if number == 1 else 'preview.webp'), 'WEBP', quality=88, method=6)
        png.unlink()
    return report


def stage_book(book, date, fonts, output):
    with tempfile.TemporaryDirectory(dir=output, prefix='.build-') as scratch:
        folder = Path(scratch)
        render_diary(book, folder / 'read.pdf')
        report = verify_and_preview(book, folder)
        materials = [
            material('editorial-text', 'text', 'original', 'MeTravel', relative(SOURCE), SOURCE),
            material('vector-art', 'illustration', 'original', 'MeTravel', relative(Path(__file__).resolve()), Path(__file__).resolve()),
            *fonts,
        ]
        hashes = {name: digest((folder / name).read_bytes()) for name, _ in ARTIFACTS.values()}
        revision = date + '.mini.' + digest(json_bytes({'hashes': hashes, 'materials': materials}))[:16]
        artifact_path = book['id'] + '/' + revision
        uri = SITE + '/travel-books/' + artifact_path + '/'
        metadata = {key: book[key] for key in ('id', 'slug', 'title', 'summary')}
        metadata.update({'revision': revision, 'contentLocale': 'ru', 'country': 'BY', 'pageCount': PAGES})
        metadata['stops'] = [{key: stop[key] for key in ('title', 'mapUrl', 'articleUrl')} for stop in book['stops']]
        for key, (name, mime) in ARTIFACTS.items():
            metadata[key] = {'uri': uri + name, 'mime': mime, 'bytes': (folder / name).stat().st_size, 'sha256': hashes[name]}

        proof = {'schemaVersion': 1, 'bookId': book['id'], 'revision': revision, 'materials': materials,
                 'artifacts': [{'id': name, 'sha256': sha, 'materialIds': [item['id'] for item in materials]}
                               for name, sha in hashes.items()]}
        (folder / 'rights.json').write_bytes(json_bytes(proof))
        destination = output / artifact_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.parent.is_symlink() or destination.is_symlink():
            raise ValueError(f'Immutable staged revision must stay inside {output}')
        try:
            folder.rename(destination)
        except OSError as error:
            if error.errno not in (errno.EEXIST, errno.ENOTEMPTY):
                raise
            expected = {path.name: path.read_bytes() for path in folder.iterdir()}
            files = list(destination.iterdir())
            if any(path.is_symlink() or not path.is_file() for path in files):
                raise ValueError(f'Immutable staged revision contains a non-regular file: {destination}') from error
            actual = {path.name: path.read_bytes() for path in files}
            if expected != actual:
                raise ValueError(f'Immutable staged revision conflicts: {destination}') from error
    return metadata, {'id': book['id'], 'revision': revision, 'pdfSha256': hashes['read.pdf'],
                      'coverSha256': hashes['cover.webp'], 'previewSha256': hashes['preview.webp'],
                      'digitalPass': True, 'pageCount': PAGES, 'qr': report}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / '.codex-temp/books-mini-diaries/publication')
    args = parser.parse_args()
    output = args.output.resolve()
    if not output.is_relative_to(ROOT / '.codex-temp') or output == ROOT / '.codex-temp':
        parser.error('stage only in a directory under the repository .codex-temp/')
    output.mkdir(parents=True, exist_ok=True)
    source = load_sources()
    fonts = register_fonts()
    results = [stage_book(book, source['checkedAt'], fonts, output) for book in source['diaries']]
    with tempfile.TemporaryDirectory(dir=output, prefix='.manifest-') as scratch:
        folder = Path(scratch)
        reports = folder / 'validation.json'
        reports.write_bytes(json_bytes({'schemaVersion': 1, 'diaries': [report for _, report in results]}))
        reports.replace(output / reports.name)
        staged = folder / OUTPUT_NAME
        staged.write_bytes(json_bytes({'schemaVersion': 1, 'diaries': [metadata for metadata, _ in results]}))
        staged.replace(output / OUTPUT_NAME)
    print(f'{len(results)} verified A5 diaries staged: {output / OUTPUT_NAME}')


if __name__ == '__main__':
    main()
