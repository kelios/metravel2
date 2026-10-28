#!/usr/bin/env python3
"""Check the saved A2 reference; this does not certify production PDF or paper."""
import hashlib
import json
from pathlib import Path

from pypdf import PdfReader

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
EPS = 0.002


def intersects(a, b):
    return (min(a['x'] + a['width'], b['x'] + b['width']) > max(a['x'], b['x']) + EPS
            and min(a['top'] + a['height'], b['top'] + b['height']) > max(a['top'], b['top']) + EPS)


def verify():
    geometry = json.loads((HERE / 'geometry-v1.json').read_text())
    provenance = json.loads((HERE / 'assets' / 'provenance.json').read_text())
    pdf = PdfReader(HERE / 'print-layouts-v1.pdf')
    assert geometry['status'] == 'design-reference' and geometry['notReadyBook'] is True
    assert len(pdf.pages) == len(geometry['pages']) == 39
    expected_fonts = {Path(record['file']).name: record['sha256'] for record in provenance['fonts']}
    assert geometry['fontFiles'] == expected_fonts, 'Rendered font hashes differ from provenance'
    for record in [*provenance['assets'], *provenance['fonts'], provenance['fontLicense']]:
        assert hashlib.sha256((HERE / 'assets' / record['file']).read_bytes()).hexdigest() == record['sha256'], record['file']
    for country, record in geometry['sourceBooks'].items():
        source = ROOT / 'data' / 'travelBooks' / country / 'editorial.json'
        assert hashlib.sha256(source.read_bytes()).hexdigest() == record['sha256'], f'Editorial source changed: {country}'
    for page, actual in zip(geometry['pages'], pdf.pages):
        number = page['pdfPage']
        assert abs(float(actual.mediabox.width) * 25.4 / 72 - page['widthMm']) < EPS, number
        assert abs(float(actual.mediabox.height) * 25.4 / 72 - page['heightMm']) < EPS, number
        if page['component'] != 'body':
            continue
        left = 5 if page['logicalPage'] % 2 == 0 else 15
        right = page['widthMm'] - (15 if page['logicalPage'] % 2 == 0 else 5)
        assert page['bindingMm'] == 15 and page['safeMm'] == 5
        assert page['bindingSide'] == ('right' if page['logicalPage'] % 2 == 0 else 'left')
        frames = [frame for frame in page['frames'] if frame['type'] != 'binding-exclusion']
        for frame in frames:
            assert left - EPS <= frame['x'] and frame['x'] + frame['width'] <= right + EPS, (number, frame)
            assert 5 - EPS <= frame['top'] and frame['top'] + frame['height'] <= page['heightMm'] - 5 + EPS, (number, frame)
            if frame['type'] == 'text':
                minimum = 10.5 if page['profileId'] == 'album-a5' and 12 <= frame['top'] < 200 else 9
                assert frame['sizePt'] >= minimum, (number, frame)
                if minimum == 10.5 and frame['font'] == 'Sans':
                    assert frame['leadingRatio'] >= 1.35, (number, frame)
            elif frame['type'] == 'qr':
                assert frame['dataMm'] >= (20 if page['profileId'] == 'album-a5' else 18)
                assert frame['quietModules'] >= 4
            elif frame['type'] == 'photo-slot':
                expected = (108, 158) if page['profileId'] == 'album-a5' else (100, 70)
                assert (frame['width'], frame['height']) == expected
                assert all(size <= bound for size, bound in zip(frame['maxPhotoMm'], expected))
        occupied = [frame for frame in frames if frame['type'] in ['text', 'image', 'qr']]
        for index, frame in enumerate(occupied):
            for other in occupied[index + 1:]:
                assert not intersects(frame, other), (number, 'overlap', frame, other)
    for country in ['BY', 'PL']:
        for profile in ['pocket-150x100', 'album-a5']:
            pages = [p for p in geometry['pages'] if p.get('country') == country and p.get('profileId') == profile
                     and not p.get('syntheticStressSample') and p['pdfPage'] <= 32]
            assert len([p for p in pages if p['component'] == 'cover']) == 4
            body = [p for p in pages if p['component'] == 'body']
            assert [p['logicalPage'] for p in body] == [6, 7, 8, 9]
            text = ' '.join(pdf.pages[p['pdfPage'] - 1].extract_text() for p in body)
            assert 'Факт.' in text and 'Подход:' in text and 'Присмотритесь.' in text
    controls = [page for page in geometry['pages'] if page['component'] == 'control']
    assert len(controls) == 2 and all(page['rulerMm'] == 50 for page in controls)
    stress = [page for page in geometry['pages'] if page.get('syntheticStressSample')]
    assert sorted(page['storyChars'] for page in stress) == [550, 900]
    html = (HERE / 'screen-states-v1.html').read_text()
    for width in [320, 390, 1440]:
        assert html.count(f'style="width:{width}px"') == 8
    assert all(html.count(f'data-state="{state}"') == 3 for state in ['catalogue', 'detail', 'preview', 'loading', 'error', 'empty', 'focus', 'offline'])
    print(json.dumps(dict(status='pass', pages=len(pdf.pages), screenArtboards=24,
                          safeAndBindingViolations=0, textImageQrOverlaps=0, productionOrPaperCertified=False)))


if __name__ == '__main__':
    verify()
