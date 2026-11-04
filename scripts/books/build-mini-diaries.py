#!/usr/bin/env python3
"""Stage the original six-page mini diaries and matching, verified PDF previews."""
import argparse
import errno
import hashlib
import io
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
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'data/travelBooks/mini-diaries/source.json'
PHOTO_EVIDENCE = ROOT / 'data/travelBooks/by/photo-evidence.json'
PHOTO_INDEX = ROOT / '.codex-temp/books-photo/originals/index.json'
QUEST_COVERS = ROOT / 'data/travelBooks/quests/cover-provenance.json'
QUEST_CACHE = ROOT / '.codex-temp/books-quests'
REFERENCE = ROOT / 'docs/design/travel-memory-books-v1/assets'
WIDTH, HEIGHT = A5
LEFT, RIGHT = 34, WIDTH - 34
TEXT_WIDTH = RIGHT - LEFT
PAGES = 6
INK, MUTED, RULE = map(HexColor, ['#192a24', '#455b51', '#a5b5ab'])
SITE = 'https://metravel.by'
PALETTES = {
    'water': ('#245756', '#e9f3ee', '#acc9bc'),
    'towers': ('#81432e', '#f8eee5', '#d5b59c'),
}
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
        if book['theme'] not in PALETTES or len(book['stops']) != 3 or len(book['prompts']) != 3:
            raise ValueError(f"{book['title']}: expected three distinct journeys and three recap questions")
        if len({stop['mapUrl'] for stop in book['stops']}) != 3:
            raise ValueError(f"{book['title']}: repeated journey destination")
        if book['coverPointId'] not in {stop['evidence'].get('pointId') for stop in book['stops']}:
            raise ValueError(f"{book['title']}: cover must depict an included journey")
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


def load_photos(diaries):
    evidence = read_json(PHOTO_EVIDENCE)
    originals = read_json(PHOTO_INDEX)
    if evidence['schemaVersion'] != 1 or evidence['authorId'] != 1 or evidence['country'] != 'BY':
        raise ValueError('Expected the Belarus photo ledger for author 1')
    places = {entry['pointId']: entry for entry in evidence['places']}
    photo_root = PHOTO_INDEX.parent.parent.resolve()
    photos = {}
    for book in diaries:
        for stop in book['stops']:
            origin = stop['evidence']
            if origin['kind'] != 'author-1-travel':
                continue
            point_id, travel_id = origin['pointId'], origin['travelId']
            place = places[point_id]
            used = [photo for photo in place['photos'] if photo['status'] == 'used' and photo['role'] == 'main']
            if len(used) != 1 or place['articleUrl'] != stop['articleUrl'] or place['articleId'] != travel_id:
                raise ValueError(f'{point_id}: no exact main photograph in the author photo ledger')
            photo = used[0]
            rights = photo['rights']
            if ((photo['pointId'], photo['articleId'], photo['articleUrl'], photo['authorId'])
                    != (point_id, travel_id, stop['articleUrl'], 1)
                    or not photo['peopleFree'] or not photo['verifiedOn'] or not photo['verifiedVia']
                    or (rights['basis'], rights['ownerUserId'], rights['sourceTravelId'], rights['permission'])
                    != ('owner-author-photo', 1, travel_id, 'owner-commissioned-photo-diary')):
                raise ValueError(f'{point_id}: exact photo rights or people check are missing')
            original = originals[photo['originalUri']]
            original_path = (ROOT / original['localPath']).resolve()
            expected_size = (photo['widthPx'], photo['heightPx'])
            if (original['uri'] != photo['originalUri'] or original['sha256'] != photo['sha256']
                    or not original_path.is_relative_to(photo_root)
                    or digest(original_path.read_bytes()) != photo['sha256']):
                raise ValueError(f'{point_id}: cached photo differs from verified original')
            retouch = photo.get('retouch')
            if retouch:
                image_path = (ROOT / retouch['path']).resolve()
                if (not image_path.is_relative_to(photo_root) or not retouch['decision']
                        or digest(image_path.read_bytes()) != retouch['sha256']):
                    raise ValueError(f'{point_id}: authorized retouch differs from the photo ledger')
            else:
                image_path = original_path
            with Image.open(image_path) as image:
                if image.size != expected_size:
                    raise ValueError(f'{point_id}: photo dimensions differ from provenance')
            photo_material = material(f'photo-{point_id}', 'photograph', 'permission', 'MeTravel author 1',
                                      photo['originalUri'], PHOTO_EVIDENCE)
            photo_material['derived'] = True
            photo_material['permissions'].append('adaptation')
            photos[point_id] = {
                'path': image_path, 'material': photo_material, 'sha256': digest(image_path.read_bytes()),
                'originalSha256': photo['sha256'], 'articleUrl': stop['articleUrl'],
            }
    return photos


def load_quest_art(source):
    record = source['questIllustration']
    quest_id = record['questId']
    if digest(QUEST_COVERS.read_bytes()) != record['coverLedgerSha256']:
        raise ValueError('Owner confirmation applies to a different quest cover ledger')
    cover = next(asset for asset in read_json(QUEST_COVERS)['assets'] if asset['questId'] == quest_id)
    collection = read_json(QUEST_CACHE / 'source-collection.json')
    original = next(quest['cover'] for quest in collection['quests'] if quest['questId'] == quest_id)
    image_path = (ROOT / original['localPath']).resolve()
    if ((cover['sha256'], cover['uri']) != (record['sha256'], record['uri'])
            or any(original[key] != cover[key] for key in ('uri', 'sha256', 'bytes', 'widthPx', 'heightPx'))
            or not image_path.is_relative_to(QUEST_CACHE.resolve())
            or digest(image_path.read_bytes()) != cover['sha256']):
        raise ValueError('Cached Lubcha illustration differs from the confirmed cover')
    proof = material('quest-illustration', 'illustration', 'permission', 'MeTravel project owner',
                     cover['uri'], SOURCE.parent / 'README.md')
    proof['derived'] = True
    proof['permissions'].append('adaptation')
    return {quest_id: {'path': image_path, 'material': proof, 'sha256': cover['sha256'],
                       'originalSha256': cover['sha256'], 'articleUrl': cover['questUrl']}}


def art_key(stop):
    evidence = stop['evidence']
    return evidence.get('pointId') if evidence['kind'] == 'author-1-travel' else evidence['questId']


class Page:
    def __init__(self, pdf, number, section, theme):
        self.pdf = pdf
        self.number = number
        self.accent, self.tint, self.soft = map(HexColor, PALETTES[theme])
        pdf.setFillColor(self.accent)
        pdf.rect(LEFT, HEIGHT - 38, 19, 2, stroke=0, fill=1)
        self.text(section, HEIGHT - 30, 8.5, 'Bold', self.accent, x=LEFT + 27, width=TEXT_WIDTH - 27)

    def text(self, value, top, size=11, family='Text', color=INK, x=LEFT, width=TEXT_WIDTH, floor=38):
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
        bottom = self.text(label, y, 9.4, 'Bold', self.accent)
        self.pdf.linkURL(url, (LEFT, bottom, RIGHT, y), relative=0)
        return bottom

    def qr(self, label, url, x, y):
        size = 78
        widget = QrCodeWidget(url, barWidth=size, barHeight=size, barBorder=4, barLevel='M')
        self.pdf.setFillColor(black)
        for rect in widget.draw().contents:
            if rect.fillColor is not None:
                self.pdf.rect(x + rect.x, y + rect.y, rect.width, rect.height, stroke=0, fill=1)
        self.text(label, y + size + 11, 8.3, 'Bold', self.accent, x=x + 4, width=82)
        self.pdf.linkURL(url, (x, y, RIGHT, y + size + 11), relative=0)

    def panel(self, top, height):
        self.pdf.setFillColor(self.tint)
        self.pdf.roundRect(LEFT, top - height, TEXT_WIDTH, height, 8, stroke=0, fill=1)

    def finish(self, caption):
        self.rule(34)
        self.text(caption, 25, 7.5, 'Bold', MUTED, floor=10)
        self.pdf.setFillColor(MUTED)
        self.pdf.setFont('Bold', 8)
        self.pdf.drawRightString(RIGHT, 16, f'{self.number:02d} / {PAGES:02d}')
        self.pdf.showPage()


def draw_photo(pdf, source, bottom, width, height, center):
    with Image.open(source['path']) as image:
        # Fit the print box at the original pixel density, without stretching or upscaling.
        pixels_wide = min(image.width, int(image.height * width / height))
        fit = ImageOps.fit(image.convert('RGB'), (pixels_wide, round(pixels_wide * height / width)), centering=center)
    jpeg = io.BytesIO()
    fit.save(jpeg, 'JPEG', quality=93, subsampling=0)
    pdf.drawImage(ImageReader(jpeg), LEFT, bottom, width, height)


def render_diary(book, artwork, file):
    caption = book['title'] + ' · MeTravel'
    theme = book['theme']
    pdf = Canvas(str(file), pagesize=A5, initialFontName='Text', invariant=1)
    pdf.setAuthor('MeTravel')
    pdf.setTitle(book['title'])
    pdf.setSubject(book['subtitle'])

    page = Page(pdf, 1, 'МИНИ-ДНЕВНИК', theme)
    y = page.text(book['title'], HEIGHT - 65, 34, 'Title', floor=472)
    page.text(book['subtitle'], y - 5, 13, 'Text', page.accent, floor=444)
    draw_photo(pdf, artwork[book['coverPointId']], 165, TEXT_WIDTH, 265, (.5, .5))
    page.text(book['coverLabel'], 157, 8.5, 'Text', MUTED)
    page.text(book['coverLine'], 124, 9.8, 'Bold', page.accent)
    page.text('Чей это дневник', 79, 9, 'Text', MUTED)
    page.rule(51)
    page.finish(caption)

    page = Page(pdf, 2, 'ПЛАНИРУЕМ ПОЕЗДКУ', theme)
    y = page.text('Куда поедем?', HEIGHT - 63, 28, 'Title')
    y = page.text(book['intro'], y - 11, 11.2)
    y -= 12
    for number, stop in enumerate(book['stops'], 1):
        page.panel(y, 42)
        page.text(f'{number:02d}', y - 7, 13, 'Title', page.accent, x=LEFT + 10, width=27)
        page.text(stop['title'], y - 5, 11, 'Bold', x=LEFT + 42, width=248)
        page.text(stop['choiceHint'], y - 22, 9, 'Text', MUTED, x=LEFT + 42, width=250)
        page.text(f'стр. {number + 2}', y - 11, 9, 'Bold', page.accent, x=RIGHT - 45, width=38)
        y -= 48
    y = page.text('План на день', y - 9, 14, 'Title', page.accent)
    for label in ('Дата и место', 'Откуда начинаем и как возвращаемся', 'План на случай дождя или закрытия'):
        page.text(label, y - 9, 9.5, 'Text', MUTED)
        page.rule(y - 36)
        y -= 40
    page.text('Печать дома: бумага A5, масштаб 100 %. Можно распечатать только страницу поездки.',
              y - 10, 9.2, 'Text', MUTED)
    page.finish(caption)

    for number, stop in enumerate(book['stops'], 1):
        page = Page(pdf, number + 2, f'ПОЕЗДКА {number:02d}', theme)
        y = page.text(stop['title'], HEIGHT - 53, 25, 'Title')
        y = page.text(stop['subtitle'], y - 3, 10.3, 'Bold', MUTED)
        art = artwork[art_key(stop)]
        art_top = y - 11
        art_width, art_height = 174, 116
        draw_photo(pdf, art, art_top - art_height, art_width, art_height, (.5, stop.get('photoCenterY', .5)))
        if art['material']['kind'] == 'illustration':
            page.text('Иллюстрация квеста · MeTravel', art_top - art_height - 4, 8, 'Text', MUTED)
        text_left = LEFT + art_width + 15
        text_width = RIGHT - text_left
        y = page.text('Что заметить', art_top - 2, 10.5, 'Bold', page.accent, x=text_left, width=text_width)
        page.text(stop['observation'], y - 4, 10.4, x=text_left, width=text_width, floor=art_top - art_height)
        y = page.text('Перед выездом', art_top - art_height - 23, 10.5, 'Bold', page.accent)
        page.text(stop['access'], y - 3, 10.2, floor=247)
        qr_left = RIGHT - 86
        page.qr('Место на карте', stop['mapUrl'], qr_left, 149)
        label = 'Квест на сайте' if stop['evidence']['kind'] == 'published-quest-stop' else 'Статья на сайте'
        page.qr(label, stop['articleUrl'], qr_left, 52)
        page.text('Кадр, рисунок или заметка', 239, 10.5, 'Bold', page.accent)
        page.text(stop['framePrompt'], 219, 9.4, 'Text', MUTED)
        pdf.setStrokeColor(page.soft)
        pdf.setLineWidth(.65)
        pdf.roundRect(LEFT, 49, TEXT_WIDTH - 106, 152, 7)
        page.finish(caption)

    page = Page(pdf, 6, 'ПОСЛЕ ПОЕЗДКИ', theme)
    y = page.text('Что осталось в памяти', HEIGHT - 63, 25, 'Title')
    y = page.text('Три вопроса, чтобы вернуться к этому дню.', y - 6, 11, 'Text', MUTED) - 8
    for number, prompt in enumerate(book['prompts'], 1):
        page.text(f'0{number}', y - 12, 11, 'Title', page.accent, width=23)
        y = page.text(prompt, y - 13, 11.2, 'Bold', x=LEFT + 25, width=TEXT_WIDTH - 25)
        page.rule(y - 25)
        page.rule(y - 46)
        y -= 54
    y = page.text('Ссылки для подготовки', y - 13, 13, 'Title', page.accent)
    for stop in book['stops']:
        y = page.url(stop['title'] + ' · ' + stop['accessLabel'], stop['accessUrl'], y - 7)
    credit = 'Текст, фотографии и иллюстрация MeTravel.' if theme == 'towers' else 'Текст и фотографии MeTravel.'
    page.text(credit + ' Шрифты Noto Sans и Noto Serif, лицензия SIL OFL 1.1.',
              y - 12, 8.4, 'Text', MUTED)
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
        expects_art = number == 1 or 3 <= number <= 5
        if not page.extract_text().strip() or len(page.images) != int(expects_art):
            raise ValueError(f'{pdf}: page {number} differs from its expected text and photo layout')
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


def stage_book(book, date, fonts, artwork, output):
    with tempfile.TemporaryDirectory(dir=output, prefix='.build-') as scratch:
        folder = Path(scratch)
        render_diary(book, artwork, folder / 'read.pdf')
        report = verify_and_preview(book, folder)
        keys = [art_key(stop) for stop in book['stops']]
        materials = [
            material('editorial-text', 'text', 'original', 'MeTravel', relative(SOURCE), SOURCE),
            *fonts,
            *(artwork[key]['material'] for key in keys),
        ]
        text_and_fonts = ['editorial-text', *(font['id'] for font in fonts)]
        artifact_materials = {
            'read.pdf': [item['id'] for item in materials],
            'cover.webp': [*text_and_fonts, f"photo-{book['coverPointId']}"],
            'preview.webp': [*text_and_fonts, artwork[keys[0]]['material']['id']],
        }
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
                 'artifacts': [{'id': name, 'sha256': sha, 'materialIds': artifact_materials[name]}
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
                      'digitalPass': True, 'pageCount': PAGES, 'qr': report,
                      'artwork': [{'id': artwork[key]['material']['id'], 'sourceSha256': artwork[key]['originalSha256'],
                                   'renderSourceSha256': artwork[key]['sha256'],
                                   'articleUrl': artwork[key]['articleUrl']} for key in keys]}


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
    artwork = {**load_photos(source['diaries']), **load_quest_art(source)}
    results = [stage_book(book, source['checkedAt'], fonts, artwork, output) for book in source['diaries']]
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
