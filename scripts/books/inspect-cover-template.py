#!/usr/bin/env python3
"""Inspect clean native/imposed cover templates without altering any PDF bytes."""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

from pypdf import PdfReader


def inspect(template, presets):
    pdf = Path(template['path'])
    data = pdf.read_bytes()
    reader = PdfReader(pdf)
    width, height = template['widthMm'], template['heightMm']
    mm = 72 / 25.4
    boxes = [[float(value) / mm for value in page.mediabox] for page in reader.pages]
    text = subprocess.run(['pdftotext', '-raw', '-enc', 'UTF-8', str(pdf), '-'], check=True, capture_output=True, text=True, timeout=60).stdout
    normalized = re.sub(r'\s+', '', text).casefold()
    forbidden = [item['text'] for item in presets] + ['Уютная норка подождёт']
    clean = all(re.sub(r'\s+', '', value).casefold() not in normalized for value in forbidden)
    rows = subprocess.run(['pdffonts', str(pdf)], check=True, capture_output=True, text=True, timeout=60).stdout.splitlines()[2:]
    fonts = []
    for row in rows:
        found = re.search(r'\s+(yes|no)\s+(yes|no)\s+(yes|no)\s+\d+\s+\d+\s*$', row)
        if not found:
            raise ValueError('Unrecognized font resource')
        fonts.append({'embedded': found[1] == 'yes', 'unicode': found[3] == 'yes'})
    box_pass = len(boxes) == template['pageCount'] and all(abs(box[0]) < .1 and abs(box[1]) < .1 and abs(box[2] - width) < .1 and abs(box[3] - height) < .1 for box in boxes)
    region = template['textRegion']
    region_pass = region['pageIndex'] == 0 and region['xMm'] >= 0 and region['yMm'] >= 0 and region['xMm'] + region['widthMm'] <= width and region['yMm'] + region['heightMm'] <= height
    # Poppler text positions must leave the declared quote area genuinely empty.
    bbox = subprocess.run(['pdftotext', '-f', '1', '-l', '1', '-bbox', str(pdf), '-'], check=True, capture_output=True, text=True, timeout=60).stdout
    quote_left, quote_right = region['xMm'] * mm, (region['xMm'] + region['widthMm']) * mm
    quote_top, quote_bottom = (height - region['yMm'] - region['heightMm']) * mm, (height - region['yMm']) * mm
    for word in re.finditer(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)"', bbox):
        x1, y1, x2, y2 = map(float, word.groups())
        if x1 < quote_right and x2 > quote_left and y1 < quote_bottom and y2 > quote_top:
            clean = False
    actual_sha = hashlib.sha256(data).hexdigest()
    passed = actual_sha == template['sha256'] and len(data) == template['bytes'] and box_pass and region_pass and clean and bool(fonts) and all(font['embedded'] and font['unicode'] for font in fonts)
    return {'path': str(pdf), 'sha256': actual_sha, 'bytes': len(data), 'pageCount': len(boxes), 'boxes': boxes, 'fonts': fonts, 'blankTextRegion': clean, 'pass': passed}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--descriptor', required=True)
    args = parser.parse_args()
    descriptor = json.loads(Path(args.descriptor).read_text())
    reports = [inspect(template, descriptor['presets']) for template in descriptor['templates']]
    print(json.dumps({'reports': reports, 'pass': len(reports) == 6 and all(report['pass'] for report in reports)}))
