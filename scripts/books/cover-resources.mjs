import {createHash} from 'node:crypto';
import {lstat, readFile, realpath} from 'node:fs/promises';
import path from 'node:path';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const coverResources = source => {
  if (!source?.coverPersonalization) throw new Error('New production requires cover personalization');
  const cover = source.coverPersonalization;
  return [
    {...cover.font, filename: 'fonts/MarckScript-Regular.ttf', kind: 'font'},
    {...cover.font.license, filename: 'fonts/OFL.txt', kind: 'license'},
    ...cover.templates.map(template => ({...template, filename: `${template.profileId}/template-${template.mode}-cover.pdf`, kind: 'template'})),
  ];
};

/** Public resources have no local paths, plans, arbitrary URLs or tool input. */
export function coverPersonalizationDescriptor(source, uri) {
  const cover = source.coverPersonalization;
  const resource = (item, filename) => ({uri: uri(filename), bytes: item.bytes, sha256: item.sha256, mime: item.mime});
  return {
    schemaVersion: cover.schemaVersion, maxCharacters: cover.maxCharacters, defaultPresetId: cover.defaultPresetId, presets: cover.presets,
    font: {...resource(cover.font, 'fonts/MarckScript-Regular.ttf'), license: resource(cover.font.license, 'fonts/OFL.txt')},
    templates: cover.templates.map(template => ({...resource(template, `${template.profileId}/template-${template.mode}-cover.pdf`), profileId: template.profileId, mode: template.mode, pageCount: template.pageCount, widthMm: template.widthMm, heightMm: template.heightMm, textRegion: template.textRegion})),
  };
}

export async function readCoverResource(item, root) {
  root = await realpath(root);
  const target = path.resolve(item.path);
  if (!target.startsWith(root + path.sep)) throw new Error('Cover resource escapes production package');
  let candidate = root;
  for (const part of path.relative(root, target).split(path.sep)) {
    candidate = path.join(candidate, part);
    if ((await lstat(candidate)).isSymbolicLink()) throw new Error('Cover resource symlinks are forbidden');
  }
  const cap = item.kind === 'font' ? 2 * 1024 * 1024 : item.kind === 'license' ? 64 * 1024 : 20 * 1024 * 1024;
  if (!Number.isSafeInteger(item.bytes) || item.bytes <= 0 || item.bytes > cap || !/^[a-f0-9]{64}$/.test(item.sha256)) throw new Error('Invalid cover resource integrity');
  const bytes = await readFile(target);
  if (bytes.length !== item.bytes || sha(bytes) !== item.sha256) throw new Error('Cover resource checksum mismatch');
  if (item.kind === 'template' && bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('Cover template is not a PDF');
  if (item.kind === 'font' && !bytes.subarray(0, 4).equals(Buffer.from([0, 1, 0, 0]))) throw new Error('Full TrueType font required');
  if (item.kind === 'license' && !bytes.toString('utf8').includes('SIL OPEN FONT LICENSE Version 1.1')) throw new Error('Marck Script OFL license required');
  return bytes;
}
