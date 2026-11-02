import {execFileSync} from 'node:child_process';
import providerData from '@/data/travelBooks/providers.json';
import {BOOK_PROFILES} from '@/data/travelBooks/profiles';
import {BOOK_PROFILES as schemaProfiles,printProfileSchema} from '@/data/travelBooks/schema/profiles';
import {printCityIds,printDirectorySchema,publishedPrintDirectorySchema} from '@/data/travelBooks/schema/providers';
import legacyDirectory from './legacyPrintDirectory.v1.json';

it('validates the exact provider registry consumed by the browser before publication',()=>{
  const directory=printDirectorySchema.parse(providerData);
  // Every regional centre of Belarus and each listed Polish city keeps at least two dated points.
  for(const city of [...printCityIds.BY,...printCityIds.PL]){
    expect(directory.providers.filter(provider=>provider.city===city).length).toBeGreaterThanOrEqual(2);
  }
  const invalid=JSON.parse(JSON.stringify(providerData));
  invalid.providers[0].printing.pdf='no';
  expect(printDirectorySchema.safeParse(invalid).success).toBe(false);
  invalid.providers[0].printing.pdf='yes';
  invalid.providers[0].city='gdansk';
  expect(printDirectorySchema.safeParse(invalid).success).toBe(false);
  invalid.providers[0].city=providerData.providers[0].city;
  invalid.providers[0].acceptsRuPdf='unknown';
  expect(printDirectorySchema.safeParse(invalid).success).toBe(false);
});

it('keeps legacy provider snapshots of published revisions valid without letting them back into the current directory',()=>{
  expect(publishedPrintDirectorySchema.safeParse(legacyDirectory).success).toBe(true);
  expect(publishedPrintDirectorySchema.safeParse(providerData).success).toBe(true);
  expect(printDirectorySchema.safeParse(legacyDirectory).success).toBe(false);
});

it('keeps one set of physical dimensions for the browser and authoring schemas',()=>{
  expect(schemaProfiles).toBe(BOOK_PROFILES);
  for(const id of ['pocket-150x100','album-a5'] as const){
    const profile=BOOK_PROFILES[id];
    expect(printProfileSchema.parse({id,widthMm:profile.widthMm,heightMm:profile.heightMm,bleedMm:0,safeMm:5,bindingMm:15,binding:'rings'}).id).toBe(id);
  }
});

it('bundles real browser metadata without authoring schemas while retaining the validator',()=>{
  // Run esbuild in its Node realm rather than the Jest jsdom Uint8Array realm.
  const output=execFileSync(process.execPath,['-e',`
    const {buildSync}=require('esbuild');
    const options={bundle:true,write:false,metafile:true,platform:'browser',format:'esm',logLevel:'silent'};
    const browser=buildSync({...options,splitting:true,outdir:'.codex-temp/browser-metadata-check',stdin:{contents:"export * from './services/book/readyBooks/providers'; export * from './services/book/readyBooks/printResources'; export * from './services/book/readyBooks/artifactFilename';",resolveDir:process.cwd(),sourcefile:'book-metadata.ts'}});
    const validator=buildSync({...options,entryPoints:['data/travelBooks/schema/providers.ts']});
    const entry=Object.values(browser.metafile.outputs).find(output=>output.entryPoint==='book-metadata.ts');
    console.log(JSON.stringify({browser:Object.keys(browser.metafile.inputs),entryInputs:Object.keys(entry.inputs),dynamicImports:entry.imports.filter(item=>item.kind==='dynamic-import').length,validator:Object.keys(validator.metafile.inputs)}));
  `],{encoding:'utf8',cwd:process.cwd(),timeout:30000});
  const graph=JSON.parse(output) as {browser:string[];entryInputs:string[];dynamicImports:number;validator:string[]};
  expect(graph.browser).toContain('services/book/readyBooks/printResources.ts');
  expect(graph.browser).toContain('services/book/readyBooks/artifactFilename.ts');
  expect(graph.browser).toContain('data/travelBooks/providers.json');
  expect(graph.entryInputs).not.toContain('data/travelBooks/providers.json');
  expect(graph.dynamicImports).toBeGreaterThan(0);
  expect(graph.browser).not.toContain('data/travelBooks/instructions/ru.json');
  expect(graph.browser).not.toContain('services/book/readyBooks/printingGuide/index.ts');
  expect(graph.browser).not.toContain('services/book/readyBooks/imposition/index.ts');
  expect(graph.browser.some(file=>file.includes('data/travelBooks/schema/')||file.includes('node_modules/zod/'))).toBe(false);
  expect(graph.validator.some(file=>file.includes('node_modules/zod/'))).toBe(true);
});
