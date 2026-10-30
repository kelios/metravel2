#!/usr/bin/env python3
"""Set physical boxes on the locally compiled RGB PDF; this does not certify PDF/X."""
import argparse
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject

parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--width-mm', type=float, required=True)
parser.add_argument('--height-mm', type=float, required=True)
parser.add_argument('--bleed-mm', type=float, required=True)
args = parser.parse_args()
mm = 72 / 25.4
writer = PdfWriter()
for page in PdfReader(args.source).pages:
    expected = [(args.width_mm + args.bleed_mm * 2) * mm, (args.height_mm + args.bleed_mm * 2) * mm]
    if abs(float(page.mediabox.width) - expected[0]) > .8 or abs(float(page.mediabox.height) - expected[1]) > .8:
        raise ValueError('Compiled page geometry does not match the physical profile')
    # Chromium quantizes CSS millimetres; normalize boxes to the exact production dimensions.
    page.mediabox = RectangleObject([0, 0, *expected])
    inset = args.bleed_mm * mm
    page.trimbox = RectangleObject([inset, inset, expected[0] - inset, expected[1] - inset])
    page.bleedbox = RectangleObject([0, 0, *expected])
    writer.add_page(page)
writer.add_metadata({'/Producer': 'MeTravel ready books / Chromium / pypdf', '/Subject': 'RGB; provider acceptance required; not certified PDF/X'})
with open(args.output, 'wb') as output:
    writer.write(output)
