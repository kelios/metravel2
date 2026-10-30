#!/usr/bin/env python3
"""Decode real rasterized reading-PDF pages; never trust the source SVG alone."""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

import zxingcpp
from PIL import Image, ImageOps


def inspect(pdf, book, page_map, output):
    destination = {page['stopId']: page['folio'] for page in page_map if page['kind'] == 'destination'}
    if len(destination) != len(book['stops']):
        raise ValueError('PDF page map must cover each selected place exactly once')
    output.mkdir(parents=True, exist_ok=True)
    reports = []
    for stop in book['stops']:
        if not re.fullmatch(r'[a-z0-9]+(?:[.-][a-z0-9]+)*', stop['id']):
            raise ValueError('Invalid source point identifier')
        navigation = stop['navigation']
        expected = [navigation['mapUrl'], navigation['articleUrl']]
        if navigation.get('quest'):
            expected.append(navigation['quest']['url'])
        folio = destination[stop['id']]
        prefix = output / stop['id']
        subprocess.run(['pdftoppm', '-f', str(folio), '-l', str(folio), '-r', '300', '-singlefile', '-png', str(pdf), str(prefix)], check=True, capture_output=True, timeout=60)
        raster = Path(str(prefix) + '.png')
        with Image.open(raster) as image:
            for mode in ('color', 'grayscale'):
                decoded = [barcode.text for barcode in zxingcpp.read_barcodes(image if mode == 'color' else ImageOps.grayscale(image))]
                passed = len(decoded) == len(expected) and set(decoded) == set(expected)
                reports.append({'stopId': stop['id'], 'folio': folio, 'dpi': 300, 'mode': mode, 'expected': expected, 'decoded': decoded, 'pass': passed})
        raster.unlink()
    return {'sha256': hashlib.sha256(pdf.read_bytes()).hexdigest(), 'stopCount': len(book['stops']), 'digitalPass': all(report['pass'] for report in reports), 'reports': reports}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--pdf', required=True)
    parser.add_argument('--book', required=True)
    parser.add_argument('--page-map', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    result = inspect(Path(args.pdf), json.loads(Path(args.book).read_text()), json.loads(Path(args.page_map).read_text()), Path(args.output))
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
