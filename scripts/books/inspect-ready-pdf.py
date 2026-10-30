#!/usr/bin/env python3
"""Read actual production PDF bytes with independent Poppler and pypdf checks."""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

from pypdf import PdfReader
from pdf_text import missing_book_text

MM = 72 / 25.4


def command(args):
    return subprocess.run(args, check=True, capture_output=True, text=True, timeout=60).stdout


def inspect(pdf_path, book, component, profile_id, purpose, plan=None, page_map=None):
    pdf = Path(pdf_path)
    reader = PdfReader(pdf)
    # Raw preserves each source page's text order when two folios share an A4 side.
    text = command(['pdftotext', '-raw', '-enc', 'UTF-8', str(pdf), '-'])
    pages = text.split('\f')
    rows = command(['pdffonts', str(pdf)]).splitlines()[2:]
    fonts = []
    for row in rows:
        match = re.search(r'\s+(yes|no)\s+(yes|no)\s+(yes|no)\s+\d+\s+\d+\s*$', row)
        if not match:
            raise ValueError(f'Unrecognised pdffonts row: {row}')
        fonts.append({'embedded': match[1] == 'yes', 'unicode': match[3] == 'yes'})
    image_ppis = []
    for row in command(['pdfimages', '-list', str(pdf)]).splitlines()[2:]:
        fields = row.split()
        if len(fields) >= 14 and fields[2] == 'image':
            image_ppis.append(min(float(fields[12]), float(fields[13])))
    boxes = []
    external = False
    for page in reader.pages:
        boxes.append({
            'media': [float(x) / MM for x in page.mediabox],
            'trim': [float(x) / MM for x in page.trimbox],
            'bleed': [float(x) / MM for x in page.bleedbox],
        })
        resources = page.get('/Resources')
        resources = resources.get_object() if resources else {}
        xobjects = resources.get('/XObject')
        xobjects = xobjects.get_object() if xobjects else {}
        for obj in xobjects.values():
            stream = obj.get_object()
            if '/F' in stream or '/FFilter' in stream:
                external = True
    contents = pdf.read_bytes()
    default_cover_text = None
    if component == 'cover' and purpose != 'control':
        copy = json.loads((Path(__file__).resolve().parents[2] / 'data/travelBooks/cover-copy.json').read_text())
        default = next(item['text'] for item in copy['presets'] if item['id'] == copy['defaultPresetId'])
        default_cover_text = re.sub(r'\s+', '', default) in re.sub(r'\s+', '', text)
    return {
        'sha256': hashlib.sha256(contents).hexdigest(), 'bytes': len(contents),
        'pageCount': len(reader.pages), 'boxes': boxes, 'fonts': fonts,
        'hasCyrillic': bool(re.search('[А-Яа-яЁё]', text)),
        'missingText': missing_book_text(book, pages, profile_id, page_map, plan) if component == 'body' else [],
        'imagePpis': image_ppis, 'externalResources': external,
        'defaultCoverTextPresent': default_cover_text,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--pdf', required=True)
    parser.add_argument('--book', required=True)
    parser.add_argument('--component', required=True)
    parser.add_argument('--profile-id', required=True)
    parser.add_argument('--purpose', required=True)
    parser.add_argument('--plan')
    parser.add_argument('--page-map')
    args = parser.parse_args()
    book = json.loads(Path(args.book).read_text())
    plan = json.loads(Path(args.plan).read_text()) if args.plan else None
    if args.component == 'body' and not args.page_map:
        parser.error('Body inspection requires the canonical emitted --page-map')
    page_map = json.loads(Path(args.page_map).read_text()) if args.page_map else None
    print(json.dumps(inspect(args.pdf, book, args.component, args.profile_id, args.purpose, plan, page_map), ensure_ascii=False))


if __name__ == '__main__':
    main()
