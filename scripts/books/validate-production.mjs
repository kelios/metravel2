#!/usr/bin/env node
import {readFile, mkdir, writeFile, realpath} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {coverResources, coverPersonalizationDescriptor, readCoverResource} from './cover-resources.mjs';

if (!process.execArgv.includes('--experimental-strip-types')) {
  const child = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', fileURLToPath(import.meta.url), ...process.argv.slice(2)], {stdio: 'inherit'});
  if (child.error) console.error(child.error.message);
  process.exit(child.status ?? 1);
}
const {validatePdfInspection} = await import('../../services/book/readyBooks/validation/pdf.ts');
const {buildImpositionPlan} = await import('../../services/book/readyBooks/imposition/index.ts');
const {readyBookBodyPageCount, buildReadyBookPagePlan} = await import('../../services/book/readyBooks/composition.ts');
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
// Reject invalid physical metadata before reading resources or starting inspectors.
for (const book of index.books) {
  if (book.profiles?.length !== 2 || new Set(book.profiles.map(p => p.profile.id)).size !== 2 || !book.profiles.every(p => ['pocket-150x100', 'album-a5'].includes(p.profile.id))) throw new Error('Expected two physical profiles');
  for (const group of book.profiles) {
    printProfileSchema.parse(group.profile);
    for (const artifact of group.artifacts) {
      printProfileSchema.parse(artifact.printProfile);
      if (artifact.printProfile.id !== group.profile.id) throw new Error('Artifact physical profile differs from group');
    }
  }
}
const reports = [];
const coverPersonalizationReports = [];
const coverSchemaBundle=path.join(root,'cover-personalization-validator.cjs');
await build({entryPoints:['services/book/readyBooks/publication.ts'],outfile:coverSchemaBundle,bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
const {coverPersonalizationSchema}=createRequire(import.meta.url)(coverSchemaBundle);
const checkPath = async file => {
  const resolved = await realpath(file);
  if (!resolved.startsWith(root + path.sep)) throw new Error('Production artifact escapes package');
  return resolved;
};
for (const book of index.books) {
  const editorial = editorialBookDraftSchema.parse(JSON.parse(await readFile(book.editorialPath, 'utf8')));
  const bodyCount = readyBookBodyPageCount(editorial.stops.length);
  if (editorial.stops.length < 30 || book.bodyPageCount !== bodyCount || book.stopCount !== editorial.stops.length) throw new Error('Production composition differs from selected places');
  if (editorial.id !== book.bookId || editorial.revision !== book.revision || editorial.country !== book.country) throw new Error('Production edition identity differs from editorial source');
  coverPersonalizationSchema.parse(coverPersonalizationDescriptor(book,filename=>`https://metravel.by/travel-books/${book.bookId}/${book.revision}/${filename}`));
  for(const resource of coverResources(book))await readCoverResource(resource,root);
  const fullFontSha='504de8cc6f919163bc9afb67b9bc208d258230c5e8d00cb82ec52474f9fafc3b';
  if(book.coverPersonalization.font.sha256!==fullFontSha)throw new Error('Personalized covers require the licensed full Marck Script font');
  const descriptorPath=path.join(root,`${book.bookId}-cover-template-inspection.json`);
  await writeFile(descriptorPath,JSON.stringify(book.coverPersonalization,null,2)+'\n');
  const templateResult=spawnSync(python,['scripts/books/inspect-cover-template.py','--descriptor',descriptorPath],{encoding:'utf8',timeout:180_000,maxBuffer:8*1024*1024});
  if(templateResult.error||templateResult.status!==0)throw new Error('Cover template inspection failed: '+(templateResult.error?.message||templateResult.stderr));
  const templateInspection=JSON.parse(templateResult.stdout);
  coverPersonalizationReports.push({bookId:book.bookId,revision:book.revision,pass:templateInspection.pass,fontSha256:book.coverPersonalization.font.sha256,licenseSha256:book.coverPersonalization.font.license.sha256,templates:templateInspection.reports});
  for (const group of book.profiles) {
    const pageMapPath = await checkPath(group.artifacts.find(artifact => artifact.purpose === 'read' && artifact.component === 'body')?.pageMapPath);
    const pageMap = JSON.parse(await readFile(pageMapPath, 'utf8'));
    const canonicalMap = buildReadyBookPagePlan(editorial).map(({number, ...entry}) => ({folio: number, ...entry}));
    if (JSON.stringify(pageMap) !== JSON.stringify(canonicalMap)) throw new Error('Body page map differs from the canonical composition');
    const required = ['read:body', 'read:cover', 'print-shop:body', 'print-shop:cover', 'home-rings:body', 'home-rings:cover', ...(group.profile.id === 'album-a5' ? ['home-sewn:body'] : [])];
    const combinations = group.artifacts.map(a => `${a.purpose}:${a.component}`);
    if (combinations.length !== required.length || new Set(combinations).size !== required.length || required.some(key => !combinations.includes(key))) throw new Error('Incomplete/duplicate production artifacts');
    for (const artifact of group.artifacts) {
      const file = await checkPath(artifact.path);
      let plan, planPath;
      if (artifact.purpose.startsWith('home-')) {
        plan = buildImpositionPlan({profileId: group.profile.id, mode: artifact.purpose, component: artifact.component, pageCount: artifact.component === 'body' ? bodyCount : 4});
        planPath = await checkPath(artifact.planPath);
        if (JSON.stringify(JSON.parse(await readFile(planPath, 'utf8'))) !== JSON.stringify(plan)) throw new Error('Saved imposition plan differs from canonical geometry');
        if (artifact.printProfile.bleedMm !== 0 || artifact.printProfile.binding !== (artifact.purpose === 'home-sewn' ? 'sewn' : 'rings')) throw new Error('Home package binding or bleed differs from imposition');
      }
      const result = spawnSync(python, ['scripts/books/inspect-ready-pdf.py', '--pdf', file, '--book', book.editorialPath, '--component', artifact.component, '--profile-id', group.profile.id, '--purpose', artifact.purpose, ...(artifact.component === 'body' ? ['--page-map', pageMapPath] : []), ...(planPath ? ['--plan', planPath] : [])], {encoding: 'utf8', timeout: 180_000, maxBuffer: 8 * 1024 * 1024});
      if (result.error || result.status !== 0) throw new Error(`Inspection failed: ${result.error?.message || result.stderr}`);
      const inspection = JSON.parse(result.stdout);
      let report;
      if (['read', 'print-shop'].includes(artifact.purpose)) {
        report = validatePdfInspection({bookId: book.bookId, revision: book.revision, profile: artifact.printProfile, component: artifact.component, purpose: artifact.purpose, inspection, expectedSha256: artifact.sha256, expectedPageCount: artifact.component === 'body' ? bodyCount : 4, expectedImageCount: artifact.component === 'body' ? editorial.stops.length : 1});
        if (inspection.bytes !== artifact.bytes || inspection.pageCount !== artifact.pageCount) report.checks.push({name: 'index-counts', status: 'fail', details: 'Byte/page count differs from production index'});
        if(artifact.component==='cover')report.checks.push({name:'default-cover-text',status:inspection.defaultCoverTextPresent===true?'pass':'fail',details:'The shared PDF text engine stamped the exact default preset'});
        report.digitalPass = report.checks.every(check => check.status === 'pass');
        report.digitalIntegrityPass = report.checks.filter(check => check.name !== 'image-resolution').every(check => check.status === 'pass');
      } else {
        const [w, h] = plan.sheetMm;
        const pass = inspection.sha256 === artifact.sha256 && inspection.bytes === artifact.bytes && inspection.pageCount === artifact.pageCount && inspection.pageCount === plan.sheets.length * 2 && inspection.boxes.length === inspection.pageCount && inspection.boxes.every(box => Math.abs(box.media[0]) <= .1 && Math.abs(box.media[1]) <= .1 && Math.abs(box.media[2] - w) <= .1 && Math.abs(box.media[3] - h) <= .1) && inspection.missingText.length === 0 && inspection.fonts.length > 0 && inspection.fonts.every(f => f.embedded && f.unicode) && inspection.imagePpis.length > 0 && inspection.imagePpis.every(ppi => Number.isFinite(ppi) && ppi > 0) && !inspection.externalResources;
        const textPass=artifact.component!=='cover'||inspection.defaultCoverTextPresent===true;
        report = {bookId: book.bookId, revision: book.revision, profileId: group.profile.id, purpose: artifact.purpose, component: artifact.component, digitalPass: pass && textPass && inspection.imagePpis.every(ppi => ppi >= 300), digitalIntegrityPass: pass&&textPass, minIllustrationPpi: inspection.imagePpis.length ? Math.min(...inspection.imagePpis) : 0, printResolutionPass: inspection.imagePpis.every(ppi => ppi >= 300), printReady: false, checks: [{name: 'home-integrity', status: pass&&textPass ? 'pass' : 'fail', details: 'Exact A4 size, hashes, fonts, default cover text and images; assembly geometry is unit-tested'}], artifactHashes: {[artifact.path]: inspection.sha256}, providerReady: false};
      }
      reports.push(report);
      console.log(`${report.digitalIntegrityPass ? 'DIGITAL PASS' : 'DIGITAL FAIL'}; PRINT ${report.digitalPass ? 'RESOLUTION PASS' : 'RESOLUTION FAIL'} ${book.bookId}/${group.profile.id}/${artifact.purpose}-${artifact.component}${report.digitalPass ? '' : ': ' + report.checks.filter(c => c.status === 'fail').map(c => c.name + ': ' + c.details).join('; ')}`);
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
      const plan=JSON.parse(await readFile(planPath,'utf8'));
      const result=spawnSync(python,['scripts/books/inspect-ready-pdf.py','--pdf',controlFile,'--book',book.editorialPath,'--component','cover','--profile-id',group.profile.id,'--purpose','control'],{encoding:'utf8',timeout:180_000,maxBuffer:8*1024*1024});
      if(result.error||result.status!==0)throw new Error('Control inspection failed: '+(result.error?.message||result.stderr));
      const inspection=JSON.parse(result.stdout);
      if(inspection.pageCount!==control.pageCount||inspection.pageCount<2||!inspection.fonts.length||!inspection.fonts.every(font=>font.embedded&&font.unicode)||inspection.externalResources||!inspection.boxes.every(box=>Math.abs(box.media[0])<.1&&Math.abs(box.media[1])<.1&&Math.abs(box.media[2]-plan.sheetMm[0])<.1&&Math.abs(box.media[3]-plan.sheetMm[1])<.1))throw new Error('Control physical pages or embedded fonts differ from canonical assembly');
    }
  }
}
const coverPersonalizationPass=coverPersonalizationReports.length===2&&coverPersonalizationReports.every(report=>report.pass);
const report = {schemaVersion: 1, reports, coverPersonalizationPass, coverPersonalizationReports, digitalPass: coverPersonalizationPass&&reports.every(r => r.digitalPass), digitalIntegrityPass: coverPersonalizationPass&&reports.every(r => r.digitalIntegrityPass), providerReady: false, publishable: false, limitations: ['RGB; PDF/X и CMYK не подтверждены.', 'Нет подтверждения приёма точных файлов провайдерами BY/PL. Зависимость #2803.', 'Бумажная проверка H1 не выполнена.']};
await mkdir(path.join(root, 'validation'), {recursive: true});
await writeFile(path.join(root, 'validation', 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log('Provider acceptance: NOT VERIFIED; production publication: NOT READY');
process.exitCode = report.digitalIntegrityPass && digitalOnly ? 0 : 1;
