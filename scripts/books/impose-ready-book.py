#!/usr/bin/env python3
"""Compose the tested millimetre plan without rasterisation or scaling."""
import argparse
import copy
import json
from pathlib import Path

from pypdf import PdfReader, PdfWriter, Transformation
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas


def impose(source, plan, output):
    reader = PdfReader(source)
    expected = 56 if plan['component'] == 'body' else 4
    folios = [p['folio'] for sheet in plan['sheets'] for side in ('front', 'back') for p in sheet[side]]
    if len(reader.pages) != expected or sorted(folios) != list(range(1, expected + 1)):
        raise ValueError('Source or plan omits or duplicates folios')
    if plan['scale'] != 1:
        raise ValueError('Home output must keep scale 1')
    width, height = plan['sheetMm']
    page_width, page_height = plan['pageMm']
    writer = PdfWriter()
    for sheet in plan['sheets']:
        for side in ('front', 'back'):
            canvas = writer.add_blank_page(width * mm, height * mm)
            for item in sheet[side]:
                page = copy.copy(reader.pages[item['folio'] - 1])
                box = page.mediabox
                if abs(float(box.width) / mm - page_width) > .1 or abs(float(box.height) / mm - page_height) > .1:
                    raise ValueError('Source must be a reading PDF with the exact trim size, without bleed')
                x, top = item['xMm'], item['yMm']
                if item['rotation'] != 0 or x < 0 or top < 0 or x + page_width > width or top + page_height > height:
                    raise ValueError('Placement is rotated or outside the physical sheet')
                canvas.merge_transformed_page(page, Transformation().translate(x * mm, (height - top - page_height) * mm))
    writer.add_metadata({'/Title': f"MeTravel / {plan['profileId']} / {plan['mode']} / {plan['component']}", '/Author': 'MeTravel'})
    with open(output, 'wb') as stream:
        writer.write(stream)


def control_document(plan, output, root):
    font = root / 'docs/design/travel-memory-books-v1/assets/fonts/NotoSans-Regular.ttf'
    pdfmetrics.registerFont(TTFont('Noto', str(font)))
    width, height = plan['sheetMm']
    canvas = Canvas(str(output), pagesize=(width * mm, height * mm), invariant=1)
    # The feed test must share the imposed file's orientation and duplex edge.
    # A portrait test printed short-edge cannot prove landscape short-edge feed.
    shift = height - 297
    canvas.setTitle('MeTravel / контроль 100% и карта сборки')
    for is_back in (False, True):
        canvas.setFont('Noto', 12)
        canvas.drawString(15 * mm, (279 + shift) * mm, 'ОБОРОТ ↑ ВЕРХ' if is_back else 'ЛИЦО ↑ ВЕРХ')
        canvas.setFont('Noto', 9)
        label = f"{plan['profileId']} / {plan['mode']} / {plan['component']}"
        canvas.drawString(15 * mm, (269 + shift) * mm, label)
        canvas.drawString(15 * mm, (260 + shift) * mm, 'Печатать 100%. Без подгонки, без режима «Брошюра».')
        canvas.drawString(15 * mm, (251 + shift) * mm, 'Линейка 50 мм: допустимый результат 49–51 мм.')
        canvas.line(20 * mm, (237 + shift) * mm, 70 * mm, (237 + shift) * mm)
        for x in range(0, 51):
            canvas.line((20 + x) * mm, (237 + shift) * mm, (20 + x) * mm, (237 + shift + (4 if x % 10 == 0 else 2)) * mm)
        canvas.drawString(20 * mm, (230 + shift) * mm, '0')
        canvas.drawString(65 * mm, (230 + shift) * mm, '50 мм')
        ruler_x = width - 25
        canvas.line(ruler_x * mm, (237 + shift) * mm, ruler_x * mm, (187 + shift) * mm)
        canvas.line((ruler_x - 3) * mm, (237 + shift) * mm, (ruler_x + 3) * mm, (237 + shift) * mm)
        canvas.line((ruler_x - 3) * mm, (187 + shift) * mm, (ruler_x + 3) * mm, (187 + shift) * mm)
        canvas.drawString((width - 50) * mm, (180 + shift) * mm, '50 мм по вертикали')
        canvas.drawString(15 * mm, (218 + shift) * mm, 'Проверка подачи: лицо и оборот должны иметь верх на одной стороне.')
        canvas.drawString(15 * mm, (209 + shift) * mm, 'Сначала один лист. При ручном дуплексе повторить опыт перед тиражом.')
        canvas.showPage()
    # Keep the first two pages an actual duplex calibration pair. Long assembly
    # instructions get their own paginated pages rather than crowding that pair.
    canvas.setFont('Noto', 10)
    canvas.drawString(15 * mm, (height - 17) * mm, 'Инструкция сборки')
    canvas.setFont('Noto', 9)
    y = height - 28
    for instruction in plan['instructions']:
        words, line = instruction.split(), ''
        wrapped = []
        for word in words:
            trial = f'{line} {word}'.strip()
            if pdfmetrics.stringWidth(trial, 'Noto', 9) > (width - 30) * mm:
                wrapped.append(line)
                line = word
            else:
                line = trial
        wrapped.append(line)
        for line in wrapped:
            if y < 22:
                canvas.showPage()
                canvas.setFont('Noto', 9)
                y = height - 20
            canvas.drawString(15 * mm, y * mm, line)
            y -= 5
        y -= 4
    canvas.showPage()
    canvas.setFont('Noto', 10)
    canvas.drawString(15 * mm, (height - 17) * mm, 'Карта сборки: вид на каждую сторону листа; координаты от верха слева')
    canvas.setFont('Noto', 8)
    y = height - 28
    for index, sheet in enumerate(plan['sheets']):
        if y < 48:
            canvas.showPage()
            canvas.setFont('Noto', 8)
            y = height - 20
        for side in ('front', 'back'):
            placements = '; '.join(f"стр. {p['folio']} → x={p['xMm']}, y={p['yMm']} мм" for p in sheet[side])
            canvas.drawString(15 * mm, y * mm, f"Лист {index + 1}, {'лицо' if side == 'front' else 'оборот'}: {placements}")
            y -= 6
        y -= 2
    canvas.drawString(15 * mm, 30 * mm, 'Рез по границам страниц из карты. Для тетрадей: сгиб по центру A4, затем подрезка.')
    canvas.drawString(15 * mm, 23 * mm, 'Бумажный пробник и проверка принтера обязательны перед полной печатью.')
    canvas.save()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True)
    parser.add_argument('--plan', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--control', required=True)
    args = parser.parse_args()
    plan = json.loads(Path(args.plan).read_text())
    impose(args.source, plan, args.output)
    control_document(plan, args.control, Path(__file__).resolve().parents[2])


if __name__ == '__main__':
    main()
