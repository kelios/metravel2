"""Local, deterministic sticker PDF authoring and independent byte inspection."""
import argparse
import hashlib
import io
import json
import re
import subprocess
from pathlib import Path

from PIL import Image, ImageOps
from pypdf import PdfReader
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

MM = 72 / 25.4


def wrap(text, width, size):
    lines = ['']
    for word in text.split():
        candidate = (lines[-1] + ' ' + word).strip()
        if pdfmetrics.stringWidth(candidate, 'Diary', size) <= width:
            lines[-1] = candidate
        else:
            if not lines[-1] or pdfmetrics.stringWidth(word, 'Diary', size) > width:
                raise ValueError('Sticker label has an unbreakable word: ' + text)
            lines.append(word)
    if len(lines) > 3:
        raise ValueError('Sticker label exceeds three readable lines: ' + text)
    return lines


def image_for(asset, variant):
    native = Path(asset['path']).read_bytes()
    if hashlib.sha256(native).hexdigest() != asset['sha256']:
        raise ValueError('Artwork hash mismatch: ' + asset['stopId'])
    with Image.open(asset['path']) as source:
        source = source.convert('RGB')
        bounds = asset['bounds']
        w, h = source.size
        image = source.crop((round(w * bounds['left']), round(h * bounds['top']), round(w * (bounds['left'] + bounds['width'])), round(h * (bounds['top'] + bounds['height']))))
    if variant == 'no-background':
        # Preserve the same scene; omit colour and clear the near-white paper tone.
        image = ImageOps.grayscale(image).point(lambda value: 255 if value >= 242 else value)
    # A stamp is at most 33 × 21 mm. Keep up to 600 real ppi without embedding
    # full multi-megapixel artwork or increasing the native source dimensions.
    image.thumbnail((round(33 / 25.4 * 600), round(21 / 25.4 * 600)), Image.Resampling.LANCZOS)
    return image


def draw_memory(pdf, sticker, color):
    x, top = sticker['xMm'] * MM, (297 - sticker['yMm']) * MM
    center = x + 17.5 * MM
    pdf.setStrokeColor(color)
    pdf.setLineWidth(.7)
    if sticker['kind'] == 'frame':
        pdf.roundRect(x + 6 * MM, top - 21 * MM, 23 * MM, 15 * MM, 2 * MM, fill=0)
        pdf.circle(center, top - 13.5 * MM, 4.5 * MM, fill=0)
        pdf.line(x + 8 * MM, top - 5 * MM, x + 14 * MM, top - 5 * MM)
    elif sticker['kind'] == 'date':
        pdf.setFont('Diary', 14)
        pdf.drawCentredString(center, top - 13 * MM, 'Дата')
        pdf.setFont('Diary', 11)
        pdf.drawCentredString(center, top - 23 * MM, '____ / ____ / ____')
        return
    else:
        pdf.circle(center, top - 13.5 * MM, 7 * MM, fill=0)
        if sticker['kind'] == 'visit':
            pdf.line(center - 4 * MM, top - 13 * MM, center - 1 * MM, top - 16 * MM)
            pdf.line(center - 1 * MM, top - 16 * MM, center + 5 * MM, top - 10 * MM)
        else:
            pdf.circle(center - 2.5 * MM, top - 12 * MM, .45 * MM, stroke=0, fill=1)
            pdf.circle(center + 2.5 * MM, top - 12 * MM, .45 * MM, stroke=0, fill=1)
            pdf.arc(center - 4 * MM, top - 18 * MM, center + 4 * MM, top - 11 * MM, 210, 120)
    pdf.setFont('Diary', 12)
    pdf.drawCentredString(center, top - 29 * MM, sticker['label'])


def inspect(file, spec):
    raw = Path(file).read_bytes()
    reader = PdfReader(file)
    # Poppler independently verifies text and fonts, not just ReportLab input.
    text = subprocess.run(['pdftotext', '-raw', '-enc', 'UTF-8', file, '-'], capture_output=True, text=True, check=True).stdout
    normalize = lambda value: re.sub(r'\s+', '', value)
    pages = text.split('\f')
    missing = [sticker['label'] for sticker in spec['sheets'][0]['stickers'] if normalize(sticker['label']) not in normalize(pages[0])]
    fonts = subprocess.run(['pdffonts', file], capture_output=True, text=True, check=True).stdout.splitlines()[2:]
    embedded = bool(fonts) and all(re.search(r'\s+yes\s+(?:yes|no)\s+yes\s+\d+\s+\d+\s*$', row) for row in fonts)
    image_rows = subprocess.run(['pdfimages', '-list', file], capture_output=True, text=True, check=True).stdout.splitlines()[2:]
    image_ppis = [min(float(fields[12]), float(fields[13])) for row in image_rows if len(fields := row.split()) >= 14 and fields[2] == 'image']
    boxes = [[float(v) / MM for v in page.mediabox] for page in reader.pages]
    exact_a4 = len(boxes) == 2 and all(abs(box[2] - 210) < .01 and abs(box[3] - 297) < .01 for box in boxes)
    # Actual vector line operators must include the 50 mm ruler on each sheet.
    ruler_lines = []
    for page in reader.pages:
        operations = page.get_contents().operations
        last_move = None
        found = False
        for values, operator in operations:
            if operator == b'm':
                last_move = [float(value) for value in values]
            elif operator == b'l' and last_move:
                x, y = [float(value) for value in values]
                if abs(y - last_move[1]) < .001 and abs(abs(x - last_move[0]) / MM - 50) < .001:
                    found = True
        ruler_lines.append(found)
    checks = {'a4TwoSheets': exact_a4, 'allPlaceLabels': not missing, 'embeddedCyrillicFont': embedded, 'vector50MmRuler': all(ruler_lines), 'scale100Label': all('100%' in page for page in pages[:2]), 'realImages300Ppi': len(image_ppis) == len(spec['sheets'][0]['stickers']) and min(image_ppis) >= 300}
    report = {'bookId': spec['bookId'], 'revision': spec['revision'], 'variant': spec['variant'], 'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw), 'pageCount': len(reader.pages), 'boxesMm': boxes, 'minImagePpi': min(image_ppis) if image_ppis else None, 'checks': checks, 'missingLabels': missing, 'pass': all(checks.values())}
    if not report['pass']:
        raise ValueError('Sticker PDF inspection failed: ' + json.dumps(report, ensure_ascii=False))
    return report


def render(spec, file):
    font = spec['font']
    if hashlib.sha256(Path(font['path']).read_bytes()).hexdigest() != font['sha256']:
        raise ValueError('Sticker font hash mismatch')
    pdfmetrics.registerFont(TTFont('Diary', font['path']))
    pdf = canvas.Canvas(file, pagesize=(210 * MM, 297 * MM), invariant=1, pageCompression=1, initialFontName='Diary')
    pdf.setTitle(spec['title'] + ' - наклейки - ' + spec['variant'])
    pdf.setAuthor('MeTravel')
    color = HexColor('#485f50' if spec['variant'] == 'color' else '#252525')
    assets = {asset['stopId']: asset for asset in spec['assets']}
    for sheet in spec['sheets']:
        pdf.setFillColor(color)
        pdf.setStrokeColor(color)
        pdf.setFont('Diary', 14)
        title = spec['countryTitle'] + (' - марки мест' if sheet['page'] == 1 else ' - отметки воспоминаний')
        pdf.drawString(10 * MM, 283 * MM, title)
        pdf.setFont('Diary', 8.5)
        pdf.drawString(10 * MM, 276 * MM, '100%  -  Односторонняя печать  -  Ручная резка')
        pdf.setFont('Diary', 8)
        pdf.drawString(145 * MM, 279 * MM, 'Контроль 50 мм (±1 мм)')
        pdf.setLineWidth(.5)
        pdf.line(145 * MM, 275 * MM, 195 * MM, 275 * MM)
        for x in (145, 195):
            pdf.line(x * MM, 274 * MM, x * MM, 276 * MM)
        for sticker in sheet['stickers']:
            x, y = sticker['xMm'] * MM, (297 - sticker['yMm'] - 35) * MM
            pdf.setStrokeColor(HexColor('#777777'))
            pdf.setFillColor(HexColor('#fffefa') if spec['variant'] == 'color' else HexColor('#ffffff'))
            pdf.setLineWidth(.3)
            pdf.roundRect(x, y, 35 * MM, 35 * MM, 1.5 * MM, fill=int(spec['variant'] == 'color'))
            pdf.setFillColor(color)
            if sticker['kind'] == 'place':
                image = image_for(assets[sticker['stopId']], spec['variant'])
                image_w, image_h = image.size
                scale = min(33 * MM / image_w, 21 * MM / image_h)
                width, height = image_w * scale, image_h * scale
                encoded = io.BytesIO()
                image.save(encoded, format='JPEG', quality=93, optimize=True)
                encoded.seek(0)
                pdf.drawImage(ImageReader(encoded), x + (35 * MM - width) / 2, y + 13 * MM + (21 * MM - height) / 2, width, height)
                size = 8
                lines = wrap(sticker['label'], 31 * MM, size)
                pdf.setFont('Diary', size)
                for index, line in enumerate(lines):
                    pdf.drawCentredString(x + 17.5 * MM, y + (10.4 * MM) - index * 9, line)
            else:
                draw_memory(pdf, sticker, color)
        pdf.showPage()
    pdf.save()
    return inspect(file, spec)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--spec', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    print(json.dumps(render(json.loads(Path(args.spec).read_text()), args.output), ensure_ascii=False))
