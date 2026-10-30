import {mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {runCli} from '../../../scripts/cli-test-utils';
import {buildReadyBookPagePlan, validateEditorialBookDraft, validateReadyBook} from '../../../../services/book/readyBooks/validation';
import type {ReadyBook} from '../../../../types/readyBook';
import {fixturePdf, makeEditorialDraft, makeReadyBook} from './fixtures';

describe('ready-book publication contract', () => {
  it('accepts complete independent profiles and keeps draft readiness separate', () => {
    expect(validateReadyBook(makeReadyBook()).success).toBe(true);
    expect(validateEditorialBookDraft(makeEditorialDraft()).success).toBe(true);
    expect(validateReadyBook(makeEditorialDraft()).success).toBe(false);
    expect(validateEditorialBookDraft(makeReadyBook()).success).toBe(false);
  });

  it.each([
    [undefined, 8, 'map'],
    [2, 8, 'map'],
    [1, 9, 'credits'],
  ] as const)('derives separate cover numbering and three place roles for layout %s', (layoutVersion, firstDestination, lastKind) => {
    const draft = makeEditorialDraft();
    const plan = buildReadyBookPagePlan({...draft, layoutVersion});
    expect(plan.map(page => page.number)).toEqual(Array.from({length: 104}, (_, index) => index + 1));
    expect(plan.filter(page => page.kind === 'destination').map(page => page.number)).toEqual(Array.from({length: draft.stops.length}, (_, index) => firstDestination + 3 * index));
    expect(plan[firstDestination]).toMatchObject({number: firstDestination + 1, kind: 'photo-memory', stopId: draft.stops[0].id});
    expect(plan[firstDestination + 1]).toMatchObject({number: firstDestination + 2, kind: 'notes', stopId: draft.stops[0].id});
    expect(plan.at(-1)).toMatchObject({number: 104, kind: lastKind});
    expect(plan.filter(page => page.kind === 'map')).toEqual([{number: layoutVersion === 1 ? 8 : 104, kind: 'map'}]);
  });

  const invalid: [string, (book: ReadyBook) => void, string][] = [
    ['missing artifact', b => {b.artifacts.splice(0, 1);}, 'artifacts'],
    ['missing stop', b => {b.stops.pop();}, 'stops'],
    ['duplicate stop', b => {b.stops[1].id = b.stops[0].id;}, 'stops.1.id'],
    ['duplicate artifact', b => {b.artifacts[1].id = b.artifacts[0].id;}, 'artifacts.1.id'],
    ['invalid coordinate', b => {b.stops[0].lat = 91;}, 'stops.0.lat'],
    ['invalid date', b => {b.stops[0].references[0].checkedAt = '2026-02-30';}, 'stops.0.references.0.checkedAt'],
    ['unsafe source URL', b => {b.stops[0].source.url = 'javascript:alert(1)';}, 'stops.0.source.url'],
    ['insufficient physical resolution', b => {b.stops[0].image.effectivePpi = 181;}, 'stops.0.image.effectivePpi'],
    ['missing print permission', b => {Object.assign(b.stops[0].image, {printAllowed: false});}, 'stops.0.image.printAllowed'],
    ['unlabelled AI image', b => {Object.assign(b.stops[0].image, {rightsBasis: 'ai-generated', illustrated: false});}, 'stops.0.image.illustrated'],
    ['bad SHA-256', b => {b.artifacts[0].sha256 = 'bad';}, 'artifacts.0.sha256'],
    ['wrong trim', b => {b.artifacts[0].printProfile.widthMm = 210;}, 'artifacts.0.printProfile.widthMm'],
    ['unsafe binding margin', b => {b.artifacts[0].printProfile.bindingMm = 5;}, 'artifacts.0.printProfile.bindingMm'],
    ['binding margin hides the supported photo', b => {b.artifacts[0].printProfile.bindingMm = 50;}, 'artifacts.0.printProfile.bindingMm'],
    ['safe margin hides the supported photo', b => {b.artifacts[0].printProfile.safeMm = 20;}, 'artifacts.0.printProfile.safeMm'],
    ['wrong output size', b => {b.artifacts[0].outputPageMm.width = 210;}, 'artifacts.0.outputPageMm'],
    ['wrong body count', b => {b.artifacts[0].pageCount = 60;}, 'artifacts.0.pageCount'],
    ['wrong revision', b => {b.artifacts[0].revision = 'old';}, 'artifacts.0.revision'],
    ['mutable asset URL', b => {b.artifacts[0].uri = '/books/latest.pdf';}, 'artifacts.0.uri'],
    ['path traversal', b => {b.artifacts[0].uri = `/books/${b.revision}/../latest.pdf`;}, 'artifacts.0.uri'],
    ['malformed absolute asset URL', b => {b.artifacts[0].uri = 'https://[invalid';}, 'artifacts.0.uri'],
    ['preview revision mismatch', b => {b.preview[0].revision = 'old';}, 'preview.0.revision'],
    ['preview checksum mismatch', b => {b.preview[0].sourceSha256 = 'a'.repeat(64);}, 'preview.0.sourceSha256'],
    ['same URI with conflicting artifact metadata', b => {b.artifacts[1].uri = b.artifacts[0].uri;}, 'artifacts.1.uri'],
    ['same URI with conflicting image checksum', b => {b.stops[1].image.uri = b.stops[0].image.uri; b.stops[1].image.sha256 = 'a'.repeat(64);}, 'stops.1.image.uri'],
    ['same URI with conflicting preview bytes', b => {b.preview[0].pages[1].uri = b.preview[0].pages[0].uri; b.preview[0].pages[1].bytes++;}, 'preview.0.pages.1.uri'],
    ['incomplete preview', b => {b.preview[0].pages.pop();}, 'preview.0.pages'],
    ['unordered preview', b => {b.preview[0].pages[1].number = 1;}, 'preview.0.pages'],
    ['duplicate preview profile', b => {b.preview[1] = b.preview[0];}, 'preview.1'],
    ['wrong signature sequence', b => {b.artifacts.find(f => f.purpose === 'home-sewn')!.signatures = [16, 16, 24];}, 'signatures'],
    ['pocket sewn package', b => {const f = b.artifacts.find(f => f.purpose === 'home-sewn')!; f.profileId = 'pocket-150x100';}, 'artifacts'],
    ['unknown trip stop', b => {b.miniTrips[0].stopIds[0] = 'absent';}, 'miniTrips'],
    ['unresolved editorial gap', b => {b.gaps = ['Unverified route'];}, 'gaps'],
  ];
  it.each(invalid)('rejects %s with a diagnostic path', (_name, mutate, expectedPath) => {
    const book = makeReadyBook();
    mutate(book);
    const result = validateReadyBook(book);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues.some(issue => issue.path.includes(expectedPath))).toBe(true);
  });
});

describe('ready-book CLI integrity gate', () => {
  let root: string;
  beforeEach(() => {
    mkdirSync('.codex-temp', {recursive: true});
    root = mkdtempSync(path.join(process.cwd(), '.codex-temp', 'ready-book-test-'));
  });
  afterEach(() => rmSync(root, {recursive: true, force: true}));
  const cli = (...args: string[]) => runCli(process.execPath, ['scripts/validate-ready-books.mjs', ...args]);

  it('checks actual bytes and catches file corruption after a valid manifest', () => {
    const book = makeReadyBook();
    const assets = [...book.artifacts, ...book.stops.map(stop => stop.image), ...book.preview.flatMap(p => p.pages)];
    for (const asset of assets) {
      const file = path.join(root, asset.uri);
      mkdirSync(path.dirname(file), {recursive: true});
      writeFileSync(file, fixturePdf);
    }
    const manifest = path.join(root, 'manifest.json');
    writeFileSync(manifest, JSON.stringify(book));
    expect(cli('--assets-root', root, manifest).status).toBe(0);
    const changed = Buffer.from(fixturePdf);
    changed[changed.length - 1] ^= 1;
    writeFileSync(path.join(root, book.artifacts[0].uri), changed);
    const result = cli('--assets-root', root, manifest);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('SHA-256 mismatch');
  });

  it('never labels metadata validation as verified assets', () => {
    const manifest = path.join(root, 'manifest.json');
    writeFileSync(manifest, JSON.stringify(makeReadyBook()));
    const result = cli('--metadata-only', manifest);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('METADATA ONLY');
    expect(result.stdout).not.toContain('ASSETS VERIFIED');
    expect(cli(manifest).status).toBe(1);
  });

  it('rejects a symlink escaping the declared assets root', () => {
    const book = makeReadyBook();
    const assetsRoot = path.join(root, 'public');
    const outside = path.join(root, 'outside.pdf');
    const link = path.join(assetsRoot, book.artifacts[0].uri);
    mkdirSync(path.dirname(link), {recursive: true});
    writeFileSync(outside, fixturePdf);
    symlinkSync(outside, link);
    const manifest = path.join(root, 'manifest.json');
    writeFileSync(manifest, JSON.stringify(book));
    const result = cli('--assets-root', assetsRoot, manifest);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Asset escapes root');
  });

  it.each(['id', 'slug', 'country'] as const)('rejects collection collision on %s', field => {
    const first = makeReadyBook();
    const second = {...makeReadyBook(), id: 'poland-memory', slug: 'poland', country: 'PL'};
    const firstFile = path.join(root, 'first.json');
    const secondFile = path.join(root, 'second.json');
    writeFileSync(firstFile, JSON.stringify(first));
    writeFileSync(secondFile, JSON.stringify(second));
    expect(cli('--metadata-only', firstFile, secondFile).status).toBe(0);
    second[field] = first[field];
    writeFileSync(secondFile, JSON.stringify(second));
    const result = cli('--metadata-only', firstFile, secondFile);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Duplicate edition ID, slug or country');
  });

  it('reports malformed editorial JSON and accepts an explicit draft', () => {
    const file = path.join(root, 'editorial.json');
    writeFileSync(file, JSON.stringify(makeEditorialDraft()));
    expect(cli('--editorial', file).status).toBe(0);
    writeFileSync(file, '{');
    expect(cli('--editorial', file).status).toBe(1);
  });
});
