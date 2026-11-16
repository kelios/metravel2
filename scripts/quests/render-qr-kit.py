#!/usr/bin/env python3
"""Local vector PDF renderer for the validated quest-qr-kit model."""
import argparse
import json
import re
from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


def wrap(text, font, size, width):
    lines, line = [], ''
    for word in text.split():
        candidate = (line + ' ' + word).strip()
        if pdfmetrics.stringWidth(candidate, font, size) <= width:
            line = candidate
            continue
        if line:
            lines.append(line)
        line = ''
        for char in word:
            if line and pdfmetrics.stringWidth(line + char, font, size) > width:
                lines.append(line)
                line = ''
            line += char
    if line:
        lines.append(line)
    return lines


def fit(pdf, text, x, top, width, height, maximum, minimum, color, bold=False, align='center'):
    font = 'QuestKitBold' if bold else 'QuestKitRegular'
    face = pdfmetrics.getFont(font).face
    if not text.strip() or any(not face.charToGlyph.get(ord(char)) for char in text if not char.isspace()):
        raise ValueError('PRINT_TEXT_EMPTY_OR_UNSUPPORTED_GLYPH')
    size = maximum
    while size >= minimum:
        lines = wrap(text, font, size, width)
        ascent, descent = pdfmetrics.getAscentDescent(font, size)
        leading = max(size * 1.18, ascent - descent)
        used = (len(lines) - 1) * leading + ascent - descent
        if lines and used <= height + 1e-6:
            pdf.setFillColor(HexColor(color))
            pdf.setFont(font, size)
            baseline = top - (height - used) / 2 - ascent
            for line in lines:
                advance = pdfmetrics.stringWidth(line, font, size)
                if advance > width + 1e-6:
                    raise ValueError('PRINT_TEXT_OVERFLOW')
                left = x if align == 'left' else x + width - advance if align == 'right' else x + (width - advance) / 2
                pdf.drawString(left, baseline, line)
                baseline -= leading
            return {'fontSizePt': size, 'lines': len(lines)}
        size -= 0.5
    raise ValueError('PRINT_TEXT_OVERFLOW: ' + text[:100])


def draw_qr(pdf, qr, target, x, y, size_mm):
    count, data = qr['size'], qr['data']
    if not isinstance(count, int) or not 21 <= count <= 177 or len(data) != count * count or any(bit not in (0, 1) for bit in data):
        raise ValueError('INVALID_QR_MATRIX')
    module_mm = size_mm / (count + 8)
    if module_mm < 0.4:
        raise ValueError('QR_MODULE_TOO_SMALL')
    unit = module_mm * mm
    pdf.setFillColor(HexColor('#ffffff'))
    pdf.rect(x, y, size_mm * mm, size_mm * mm, stroke=0, fill=1)
    pdf.setFillColor(HexColor('#000000'))
    for row in range(count):
        for col in range(count):
            if data[row * count + col]:
                pdf.rect(x + (col + 4) * unit, y + (count + 3 - row) * unit, unit, unit, stroke=0, fill=1)
    pdf.linkURL(target, (x, y, x + size_mm * mm, y + size_mm * mm), relative=0, thickness=0)
    return module_mm


def render(plan, output):
    if not re.fullmatch(r'[a-z0-9][a-z0-9_-]{0,159}', plan['questId']) or plan['locale'] not in ('ru', 'be', 'uk', 'pl', 'en'):
        raise ValueError('INVALID_PRINT_IDENTITY')
    pdfmetrics.registerFont(TTFont('QuestKitRegular', plan['fonts']['regular']))
    pdfmetrics.registerFont(TTFont('QuestKitBold', plan['fonts']['bold']))
    text, colors, reports = plan['text'], plan['colors'], []
    for profile in plan['profiles']:
        flyer = profile['id'] == 'flyer-a5'
        if profile['id'] not in ('flyer-a5', 'sticker-100x120'):
            raise ValueError('UNKNOWN_PRINT_PROFILE')
        width, height, qr_mm = profile['widthMm'], profile['heightMm'], profile['qrMm']
        safe = 10 if flyer else 7
        content_width = (width - safe * 2) * mm
        file = f"{plan['questId']}-{plan['locale']}-{profile['id']}.pdf"
        destination = output / file
        if destination.exists():
            raise ValueError('OUTPUT_ALREADY_EXISTS')
        pdf = canvas.Canvas(str(destination), pagesize=(width * mm, height * mm), pageCompression=1, invariant=1)
        pdf.setTitle(text['title'])
        pdf.setAuthor('MeTravel')
        header_top = (200 if flyer else 113) * mm
        fit(pdf, 'MeTravel', safe * mm, header_top, content_width / 2, 6 * mm, 11 if flyer else 9, 9, colors['brand'], True, 'left')
        fit(pdf, 'metravel.by', width * mm / 2, header_top, content_width / 2, 6 * mm, 9 if flyer else 8, 7, colors['muted'], align='right')
        fit(pdf, text['kicker'], safe * mm, (188 if flyer else 106) * mm, content_width, (8 if flyer else 5) * mm,
            12 if flyer else 9, 9, colors['brand'], True)
        title_fit = fit(pdf, text['title'], safe * mm, (171 if flyer else 99) * mm, content_width, (44 if flyer else 25) * mm,
                        26 if flyer else 16, 18 if flyer else 12, colors['ink'], True)
        fit(pdf, text['duration'], safe * mm, (126 if flyer else 73) * mm, content_width, (9 if flyer else 6) * mm,
            16 if flyer else 11, 13 if flyer else 9, colors['ink'])
        fit(pdf, text['offer'], safe * mm, (113 if flyer else 65) * mm, content_width, (9 if flyer else 6) * mm,
            14 if flyer else 10, 11 if flyer else 9, colors['brand'], True)
        qr_x, qr_y = (width - qr_mm) * mm / 2, (31 if flyer else 14) * mm
        module_mm = draw_qr(pdf, plan['qr'], plan['targetUrl'], qr_x, qr_y, qr_mm)
        fit(pdf, text['scan'], safe * mm, (24 if flyer else 12) * mm, content_width, (8 if flyer else 5) * mm,
            12 if flyer else 9, 10 if flyer else 8, colors['ink'])
        pdf.showPage()
        pdf.save()
        reports.append({'file': file, 'pages': 1, 'widthMm': width, 'heightMm': height, 'safeMm': safe, 'qrMm': qr_mm,
                        'quietModules': 4, 'moduleMm': module_mm, 'title': title_fit})
    return reports


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--plan', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(render(json.loads(args.plan.read_text()), args.output), ensure_ascii=False))
