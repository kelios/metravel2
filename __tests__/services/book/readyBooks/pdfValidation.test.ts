import {validatePdfInspection, type PdfInspection} from '../../../../services/book/readyBooks/validation/pdf';
import type {PrintProfile} from '../../../../types/readyBook';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {runCli} from '../../../scripts/cli-test-utils';

const profile: PrintProfile = {id: 'album-a5', widthMm: 148, heightMm: 210, bleedMm: 3, safeMm: 5, bindingMm: 15, binding: 'rings'};
function validInspection(): PdfInspection {
  return {
    sha256: 'a'.repeat(64), bytes: 100000, pageCount: 56,
    boxes: Array.from({length: 56}, () => ({media: [0, 0, 154, 216], trim: [3, 3, 151, 213], bleed: [0, 0, 154, 216]})),
    fonts: [{embedded: true, unicode: true}], hasCyrillic: true,
    missingText: [], imagePpis: Array(12).fill(318), externalResources: false,
  };
}
const validate = (inspection: PdfInspection) => validatePdfInspection({bookId: 'by', revision: 'v1', profile, component: 'body', purpose: 'print-shop', inspection, expectedSha256: 'a'.repeat(64)});

it('distinguishes digital file verification from provider acceptance and PDF/X', () => {
  const result = validate(validInspection());
  expect(result.digitalPass).toBe(true);
  expect(result.providerReady).toBe(false);
  expect(result.colorSpace).toBe('RGB');
  expect(result.pdfX).toBe(false);
});

it.each([
  ['sha256', (i: PdfInspection) => {i.sha256 = 'b'.repeat(64);}],
  ['page-count', (i: PdfInspection) => {i.pageCount = 55;}],
  ['physical-boxes', (i: PdfInspection) => {i.boxes[55].trim[2] = 150;}],
  ['physical-boxes', (i: PdfInspection) => {i.boxes.pop();}],
  ['fonts', (i: PdfInspection) => {i.fonts[0].embedded = false;}],
  ['fonts', (i: PdfInspection) => {i.fonts[0].unicode = false;}],
  ['cyrillic', (i: PdfInspection) => {i.hasCyrillic = false;}],
  ['complete-text', (i: PdfInspection) => {i.missingText.push('Потерянный текст');}],
  ['image-resolution', (i: PdfInspection) => {i.imagePpis[11] = 299;}],
  ['image-resolution', (i: PdfInspection) => {i.imagePpis = [];}],
  ['embedded-resources', (i: PdfInspection) => {i.externalResources = true;}],
] as const)('rejects real %s inspection failure', (name, mutate) => {
  const inspection = validInspection();
  mutate(inspection);
  const result = validate(inspection);
  expect(result.digitalPass).toBe(false);
  expect(result.checks.find(check => check.name === name)?.status).toBe('fail');
});

describe('production index does not redefine the edition or physical format', () => {
  function checkIndex(mutate: (index: {schemaVersion: number; books: Record<string, unknown>[]}) => void) {
    mkdirSync('.codex-temp', {recursive: true});
    const dir = mkdtempSync(path.resolve('.codex-temp/ready-production-index-'));
    try {
      const books = ['by', 'pl'].map(country => {
        const editorial = require(`../../../../data/travelBooks/${country}/editorial.json`);
        return {bookId: editorial.id, revision: editorial.revision, country: editorial.country,
          editorialPath: `data/travelBooks/${country}/editorial.json`, profiles: [
            {profile: {...profile, id: 'pocket-150x100', widthMm: 150, heightMm: 100, bleedMm: 0}, artifacts: []},
            {profile: {...profile, bleedMm: 0}, artifacts: []},
          ]};
      });
      const index = {schemaVersion: 1, books};
      mutate(index);
      const file = path.join(dir, 'production-index.json');
      writeFileSync(file, JSON.stringify(index));
      return runCli(process.execPath, ['scripts/validate-ready-books.mjs', '--production', file, '--digital-only']);
    } finally {rmSync(dir, {recursive: true, force: true});}
  }

  it('rejects a relabelled editorial revision before inspecting any PDF', () => {
    const result = checkIndex(index => {index.books[0].revision = 'unrelated-revision';});
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('identity differs');
  });

  it('rejects arbitrary dimensions even when an index calls them a supported profile', () => {
    const result = checkIndex(index => {
      const profiles = index.books[0].profiles as {profile: PrintProfile}[];
      profiles[0].profile.widthMm = 148;
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Trim must be');
  });
});
