#!/usr/bin/env node
import {readFile, mkdir, writeFile, realpath} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

if (!process.execArgv.includes('--experimental-strip-types')) {
  const child = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', fileURLToPath(import.meta.url), ...process.argv.slice(2)], {stdio: 'inherit'});
  if (child.error) console.error(child.error.message);
  process.exit(child.status ?? 1);
}
const {validatePdfInspection} = await import('../../services/book/readyBooks/validation/pdf.ts');
const {buildImpositionPlan} = await import('../../services/book/readyBooks/imposition/index.ts');
const {editorialBookDraftSchema} = await import('../../data/travelBooks/schema/editorial.ts');
const {printProfileSchema} = await import('../../data/travelBooks/schema/profiles.ts');
const args = process.argv.slice(2);
let indexFile, digitalOnly = false;
let python = process.env.READY_BOOKS_PYTHON || '.codex-temp/books-production/venv/bin/python';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--digital-only') digitalOnly = true;
  else if (args[i] === '--python') python = args[++i];
  else if (!indexFile && !args[i].startsWith('-')) indexFile = args[i];
  else throw new Error(`Unknown argument: ${args[i]}`);
}
if (!indexFile || !python) throw new Error('Usage: --production <production-index.json> [--digital-only] [--python <path>]');
const root = path.dirname(await realpath(indexFile));
if (!root.startsWith(path.resolve('.codex-temp') + path.sep)) throw new Error('Production index must be in ignored .codex-temp/');
const index = JSON.parse(await readFile(indexFile, 'utf8'));
if (index.schemaVersion !== 1 || index.books?.length !== 2 || new Set(index.books.map(b => b.country)).size !== 2 || !index.books.every(b => ['BY', 'PL'].includes(b.country))) throw new Error('Expected both BY and PL production editions');
const reports = [];
const checkPath = async file => {
  const resolved = await realpath(file);
  if (!resolved.startsWith(root + path.sep)) throw new Error('Production artifact escapes package');
  return resolved;
};
for (const book of index.books) {
  const editorial = editorialBookDraftSchema.parse(JSON.parse(await readFile(book.editorialPath, 'utf8')));
  if (editorial.id !== book.bookId || editorial.revision !== book.revision || editorial.country !== book.country) throw new Error('Production edition identity differs from editorial source');
  if (book.profiles?.length !== 2 || new Set(book.profiles.map(p => p.profile.id)).size !== 2 || !book.profiles.every(p => ['pocket-150x100', 'album-a5'].includes(p.profile.id))) throw new Error('Expected two physical profiles');
  for (const group of book.profiles) {
    printProfileSchema.parse(group.profile);
    const required = ['read:body', 'read:cover', 'print-shop:body', 'print-shop:cover', 'home-rings:body', 'home-rings:cover', ...(group.profile.id === 'album-a5' ? ['home-sewn:body'] : [])];
    const combinations = group.artifacts.map(a => `${a.purpose}:${a.component}`);
    if (combinations.length !== required.length || new Set(combinations).size !== required.length || required.some(key => !combinations.includes(key))) throw new Error('Incomplete/duplicate production artifacts');
    for (const artifact of group.artifacts) {
      printProfileSchema.parse(artifact.printProfile);
      if (artifact.printProfile.id !== group.profile.id) throw new Error('Artifact physical profile differs from group');
      const file = await checkPath(artifact.path);
      let plan, planPath;
      if (artifact.purpose.startsWith('home-')) {
        plan = buildImpositionPlan({profileId: group.profile.id, mode: artifact.purpose, component: artifact.component});
        planPath = await checkPath(artifact.planPath);
        if (JSON.stringify(JSON.parse(await readFile(planPath, 'utf8'))) !== JSON.stringify(plan)) throw new Error('Saved imposition plan differs from canonical geometry');
        if (artifact.printProfile.bleedMm !== 0 || artifact.printProfile.binding !== (artifact.purpose === 'home-sewn' ? 'sewn' : 'rings')) throw new Error('Home package binding or bleed differs from imposition');
      }
      const result = spawnSync(python, ['scripts/books/inspect-ready-pdf.py', '--pdf', file, '--book', book.editorialPath, '--component', artifact.component, '--profile-id', group.profile.id, '--purpose', artifact.purpose, ...(planPath ? ['--plan', planPath] : [])], {encoding: 'utf8', timeout: 180_000, maxBuffer: 8 * 1024 * 1024});
      if (result.error || result.status !== 0) throw new Error(`Inspection failed: ${result.error?.message || result.stderr}`);
      const inspection = JSON.parse(result.stdout);
      let report;
      if (['read', 'print-shop'].includes(artifact.purpose)) {
        report = validatePdfInspection({bookId: book.bookId, revision: book.revision, profile: artifact.printProfile, component: artifact.component, purpose: artifact.purpose, inspection, expectedSha256: artifact.sha256});
        if (inspection.bytes !== artifact.bytes || inspection.pageCount !== artifact.pageCount) report.checks.push({name: 'index-counts', status: 'fail', details: 'Byte/page count differs from production index'});
        report.digitalPass = report.checks.every(check => check.status === 'pass');
      } else {
        const [w, h] = plan.sheetMm;
        const pass = inspection.sha256 === artifact.sha256 && inspection.bytes === artifact.bytes && inspection.pageCount === artifact.pageCount && inspection.pageCount === plan.sheets.length * 2 && inspection.boxes.length === inspection.pageCount && inspection.boxes.every(box => Math.abs(box.media[0]) <= .1 && Math.abs(box.media[1]) <= .1 && Math.abs(box.media[2] - w) <= .1 && Math.abs(box.media[3] - h) <= .1) && inspection.missingText.length === 0 && inspection.fonts.length > 0 && inspection.fonts.every(f => f.embedded && f.unicode) && inspection.imagePpis.length > 0 && inspection.imagePpis.every(ppi => Number.isFinite(ppi) && ppi >= 300) && !inspection.externalResources;
        report = {bookId: book.bookId, revision: book.revision, profileId: group.profile.id, purpose: artifact.purpose, component: artifact.component, digitalPass: pass, checks: [{name: 'home-integrity', status: pass ? 'pass' : 'fail', details: 'Exact A4 size, hashes, fonts, text and images; assembly geometry is unit-tested'}], artifactHashes: {[artifact.path]: inspection.sha256}, providerReady: false};
      }
      reports.push(report);
      console.log(`${report.digitalPass ? 'PASS' : 'FAIL'} ${book.bookId}/${group.profile.id}/${artifact.purpose}-${artifact.component}${report.digitalPass ? '' : ': ' + report.checks.filter(c => c.status === 'fail').map(c => c.name + ': ' + c.details).join('; ')}`);
    }
    const homes = group.artifacts.filter(a => a.purpose.startsWith('home-'));
    if (!Array.isArray(group.controls) || group.controls.length !== homes.length) throw new Error('Missing home control documents');
    const matchedPlans = new Set();
    for (const control of group.controls) {
      const planPath = await checkPath(control.planPath);
      if (matchedPlans.has(planPath) || !homes.some(a => path.resolve(a.planPath) === planPath)) throw new Error('Duplicate or unknown home control plan');
      matchedPlans.add(planPath);
      const controlFile = await checkPath(control.path);
      if (createHash('sha256').update(await readFile(controlFile)).digest('hex') !== control.sha256) throw new Error('Home control document hash differs from index');
    }
  }
}
const report = {schemaVersion: 1, reports, digitalPass: reports.every(r => r.digitalPass), providerReady: false, publishable: false, limitations: ['RGB; PDF/X и CMYK не подтверждены.', 'Нет подтверждения приёма точных файлов провайдерами BY/PL. Зависимость #2803.', 'Бумажная проверка H1 не выполнена.']};
await mkdir(path.join(root, 'validation'), {recursive: true});
await writeFile(path.join(root, 'validation', 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log('Provider acceptance: NOT VERIFIED; production publication: NOT READY');
process.exitCode = report.digitalPass && digitalOnly ? 0 : 1;
