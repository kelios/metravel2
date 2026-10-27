import { z } from 'zod';
import {checkEditorialComposition, editorialShape, editorialStop, httpsUrl, identifier, nonempty} from './editorial.ts';
import {printProfileSchema, profileId} from './profiles.ts';

export const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
export const assetUri = z.string().refine((value) => {
  if (/[%\\\s]/.test(value) || value.split('/').includes('..')) return false;
  if (value.startsWith('/') && !value.startsWith('//')) return !/[?#]/.test(value);
  return httpsUrl.safeParse(value).success && !new URL(value).search && !new URL(value).hash;
}, 'Expected a stable HTTPS or root-relative asset path');

const imageSchema = z.strictObject({
  uri: assetUri, sha256, credit: nonempty, rights: nonempty,
  rightsBasis: z.enum(['owned', 'licensed', 'public-domain', 'ai-generated']),
  rightsSource: httpsUrl, printAllowed: z.literal(true), illustrated: z.boolean(),
}).superRefine((image, ctx) => {
  if (image.rightsBasis === 'ai-generated' && !image.illustrated) {
    ctx.addIssue({code: 'custom', path: ['illustrated'], message: 'AI images must be marked as illustrations'});
  }
});

export const bookArtifactSchema = z.strictObject({
  id: identifier, revision: identifier, profileId,
  purpose: z.enum(['read', 'home-rings', 'home-sewn', 'print-shop', 'stickers', 'instructions', 'print-passport']),
  component: z.enum(['body', 'cover', 'stickers', 'instructions', 'passport']),
  uri: assetUri, mime: z.literal('application/pdf'), sha256,
  bytes: z.number().int().positive(), pageCount: z.number().int().positive(),
  printProfile: printProfileSchema,
  providerProfileId: identifier.optional(),
  outputPageMm: z.strictObject({width: z.number().positive(), height: z.number().positive()}),
  imposition: z.enum(['single-pages', 'a4-cut', 'a4-signatures']),
  signatures: z.array(z.number().int().positive()).optional(),
});

const previewSchema = z.strictObject({
  revision: identifier, profileId, component: z.enum(['body', 'cover']), sourceSha256: sha256,
  pages: z.array(z.strictObject({
    number: z.number().int().positive(), uri: assetUri, sha256,
    bytes: z.number().int().positive(), alt: nonempty,
  })).min(1),
});

export const readyBookSchema = z.strictObject({
  ...editorialShape, status: z.literal('ready'),
  stops: z.array(editorialStop.extend({image: imageSchema})).length(12),
  bodyPageCount: z.literal(56), coverPageCount: z.literal(4),
  artifacts: z.array(bookArtifactSchema).min(1), preview: z.array(previewSchema).length(4),
}).superRefine(checkEditorialComposition).superRefine((book, ctx) => {
  const fail = (path: (string | number)[], message: string) => ctx.addIssue({code: 'custom', path, message});
  if (book.gaps?.length) fail(['gaps'], 'A ready edition cannot have unresolved editorial gaps');
  book.stops.forEach((stop, index) => {
    if (stop.natureRoute?.elevationGainM === null) fail(['stops', index, 'natureRoute'], 'Ready routes need verified elevation');
  });
  const ids = new Set<string>();
  const combinations = new Set<string>();
  const revisionPath = `/${book.revision}/`;
  book.artifacts.forEach((file, index) => {
    const path = ['artifacts', index];
    if (ids.has(file.id)) fail([...path, 'id'], 'Duplicate artifact ID');
    ids.add(file.id);
    const key = `${file.profileId}:${file.purpose}:${file.component}:${file.providerProfileId ?? ''}`;
    if (combinations.has(key)) fail(path, 'Duplicate artifact purpose/component/profile');
    combinations.add(key);
    if (file.revision !== book.revision) fail([...path, 'revision'], 'Artifact revision differs from edition');
    if (!file.uri.includes(revisionPath)) fail([...path, 'uri'], 'Artifact path must contain the immutable revision');
    if (file.profileId !== file.printProfile.id) fail([...path, 'printProfile', 'id'], 'Artifact profile mismatch');
    const {widthMm, heightMm, bleedMm, binding} = file.printProfile;
    let size = {width: widthMm, height: heightMm};
    let imposition = 'single-pages';
    const allowedComponents: Record<string, string[]> = {
      read: ['body', 'cover'], 'print-shop': ['body', 'cover'],
      'home-rings': ['body', 'cover'], 'home-sewn': ['body'],
      stickers: ['stickers'], instructions: ['instructions'], 'print-passport': ['passport'],
    };
    if (!allowedComponents[file.purpose].includes(file.component)) fail([...path, 'component'], 'Component does not match purpose');
    if (file.purpose === 'print-shop') {
      if (!bleedMm) fail([...path, 'printProfile', 'bleedMm'], 'Print-shop requires 2 or 3 mm bleed');
      size = {width: widthMm + 2 * bleedMm, height: heightMm + 2 * bleedMm};
    } else if (bleedMm !== 0) fail([...path, 'printProfile', 'bleedMm'], 'Reading and home files must have no bleed');
    if (file.purpose === 'home-rings' || file.purpose === 'home-sewn') {
      size = file.profileId === 'album-a5' ? {width: 297, height: 210} : {width: 210, height: 297};
      imposition = file.purpose === 'home-sewn' ? 'a4-signatures' : 'a4-cut';
      if (file.pageCount < (file.component === 'body' ? 28 : 2)) fail([...path, 'pageCount'], 'Home package cannot omit imposed pages');
      if (file.purpose === 'home-rings' && binding === 'sewn') fail([...path, 'printProfile', 'binding'], 'Ring package cannot use sewn binding');
    } else if (['stickers', 'instructions', 'print-passport'].includes(file.purpose)) {
      size = {width: 210, height: 297};
    }
    if (file.purpose === 'home-sewn') {
      if (file.profileId !== 'album-a5' || binding !== 'sewn') fail(path, 'Sewn package is only available for A5 with sewn binding');
      if (JSON.stringify(file.signatures) !== '[16,16,16,8]') fail([...path, 'signatures'], 'Expected signatures 16+16+16+8');
    } else if (file.signatures !== undefined) fail([...path, 'signatures'], 'Signatures belong only to home-sewn');
    if (file.imposition !== imposition) fail([...path, 'imposition'], `Expected ${imposition}`);
    if (file.outputPageMm.width !== size.width || file.outputPageMm.height !== size.height) fail([...path, 'outputPageMm'], `Expected PDF page ${size.width}×${size.height} mm`);
    if (file.purpose === 'read' || file.purpose === 'print-shop') {
      if (file.pageCount !== (file.component === 'body' ? 56 : 4)) fail([...path, 'pageCount'], 'Body is 56 pages; separate cover is 4 pages');
    }
    if (file.purpose === 'stickers' && file.pageCount !== 2) fail([...path, 'pageCount'], 'Expected two sticker sheets');
  });
  const required = ['read:body', 'read:cover', 'home-rings:body', 'home-rings:cover', 'print-shop:body', 'print-shop:cover', 'stickers:stickers', 'instructions:instructions', 'print-passport:passport'];
  for (const profile of ['pocket-150x100', 'album-a5']) {
    for (const pair of [...required, ...(profile === 'album-a5' ? ['home-sewn:body'] : [])]) {
      if (!combinations.has(`${profile}:${pair}:`)) fail(['artifacts'], `Missing ${profile}:${pair}`);
    }
  }
  const previews = new Set<string>();
  book.preview.forEach((preview, index) => {
    const path = ['preview', index];
    const key = `${preview.profileId}:${preview.component}`;
    if (previews.has(key)) fail(path, 'Duplicate preview component/profile');
    previews.add(key);
    const source = book.artifacts.find(file => file.profileId === preview.profileId && file.purpose === 'read' && file.component === preview.component);
    if (!source || source.sha256 !== preview.sourceSha256) fail([...path, 'sourceSha256'], 'Preview must identify the exact reading PDF');
    if (preview.revision !== book.revision) fail([...path, 'revision'], 'Preview revision differs from edition');
    const count = preview.component === 'body' ? 56 : 4;
    if (preview.pages.length !== count || preview.pages.some((page, pageIndex) => page.number !== pageIndex + 1)) fail([...path, 'pages'], `Expected ordered pages 1–${count}`);
    preview.pages.forEach((page, pageIndex) => {
      if (!page.uri.includes(revisionPath)) fail([...path, 'pages', pageIndex, 'uri'], 'Preview path must contain the immutable revision');
    });
  });
});
