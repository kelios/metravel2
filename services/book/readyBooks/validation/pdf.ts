import type {PrintProfile} from '../../../../types/readyBook.ts';

type Box = [number, number, number, number];
export type PdfInspection = {
  sha256: string; bytes: number; pageCount: number;
  boxes: {media: Box; trim: Box; bleed: Box}[];
  fonts: {embedded: boolean; unicode: boolean}[];
  hasCyrillic: boolean; missingText: string[]; imagePpis: number[]; externalResources: boolean;
};
export type PdfValidationReport = {
  bookId: string; revision: string; profileId: PrintProfile['id']; component: 'body' | 'cover';
  purpose: 'read' | 'print-shop'; pageCount: number;
  checks: {name: string; status: 'pass' | 'fail'; details: string}[];
  artifactHashes: Record<string, string>; digitalPass: boolean;
  colorSpace: 'RGB'; pdfX: false; providerReady: false;
};

/** A digital pass never asserts that a provider accepted these exact bytes. */
export function validatePdfInspection({bookId, revision, profile, component, purpose, inspection, expectedSha256}: {
  bookId: string; revision: string; profile: PrintProfile; component: 'body' | 'cover';
  purpose: 'read' | 'print-shop'; inspection: PdfInspection; expectedSha256: string;
}): PdfValidationReport {
  const {widthMm: width, heightMm: height} = profile;
  const bleed = purpose === 'print-shop' ? profile.bleedMm : 0;
  const expectedMedia: Box = [0, 0, width + 2 * bleed, height + 2 * bleed];
  const expectedTrim: Box = [bleed, bleed, width + bleed, height + bleed];
  const close = (a: Box, b: Box) => a.length === 4 && a.every((value, index) => Number.isFinite(value) && Math.abs(value - b[index]) <= .1);
  const checks: PdfValidationReport['checks'] = [];
  const check = (name: string, pass: boolean, details: string) => checks.push({name, status: pass ? 'pass' : 'fail', details});
  check('sha256', /^[a-f0-9]{64}$/.test(expectedSha256) && expectedSha256 === inspection.sha256, 'Сверены реальные байты файла с индексом сборки');
  check('page-count', inspection.pageCount === (component === 'body' ? 56 : 4), `${inspection.pageCount} страниц`);
  check('physical-boxes', inspection.boxes.length === inspection.pageCount && inspection.boxes.every(box =>
    close(box.media, expectedMedia) && close(box.trim, expectedTrim) && close(box.bleed, expectedMedia)), 'MediaBox/TrimBox/BleedBox каждой страницы; допуск 0,1 мм');
  check('bleed-profile', purpose === 'print-shop' ? bleed === 2 || bleed === 3 : profile.bleedMm === 0, 'Печатный профиль и назначение файла согласованы');
  check('fonts', inspection.fonts.length > 0 && inspection.fonts.every(font => font.embedded && font.unicode), 'Все шрифты встроены и имеют Unicode mapping');
  check('cyrillic', inspection.hasCyrillic, 'Poppler извлекает кириллицу');
  check('complete-text', inspection.missingText.length === 0, `${inspection.missingText.length} отсутствующих текстовых фрагментов`);
  check('image-resolution', inspection.imagePpis.length >= (component === 'body' ? 12 : 1) && inspection.imagePpis.every(ppi => Number.isFinite(ppi) && ppi >= 300), 'Фактическое разрешение размещённых растров не ниже 300 ppi');
  check('embedded-resources', !inspection.externalResources, 'Растровые ресурсы содержатся внутри PDF');
  return {
    bookId, revision, profileId: profile.id, component, purpose, pageCount: inspection.pageCount,
    checks, artifactHashes: {[`${purpose}:${component}`]: inspection.sha256},
    digitalPass: checks.every(item => item.status === 'pass'), colorSpace: 'RGB', pdfX: false, providerReady: false,
  };
}
