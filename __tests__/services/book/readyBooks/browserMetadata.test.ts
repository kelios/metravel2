import {execFileSync} from 'node:child_process';
import providerData from '@/data/travelBooks/providers.json';
import {BOOK_PROFILES} from '@/data/travelBooks/profiles';
import {BOOK_PROFILES as schemaProfiles,printProfileSchema} from '@/data/travelBooks/schema/profiles';
import {printDirectorySchema} from '@/data/travelBooks/schema/providers';
import {printDirectory} from '@/services/book/readyBooks/providers';

it('validates the exact provider registry consumed by the browser before publication',()=>{
  expect(printDirectorySchema.parse(providerData)).toEqual(printDirectory);
  const invalid=JSON.parse(JSON.stringify(providerData));
  invalid.providers[0].minimumCopies=0;
  expect(printDirectorySchema.safeParse(invalid).success).toBe(false);
  invalid.providers[0].minimumCopies=null;
  invalid.providers[0].acceptsRuPdf='assumed';
  expect(printDirectorySchema.safeParse(invalid).success).toBe(false);
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
    const browser=buildSync({...options,stdin:{contents:"export * from './services/book/readyBooks/providers'; export * from './services/book/readyBooks/printingGuide';",resolveDir:process.cwd(),sourcefile:'book-metadata.ts'}});
    const validator=buildSync({...options,entryPoints:['data/travelBooks/schema/providers.ts']});
    console.log(JSON.stringify({browser:Object.keys(browser.metafile.inputs),validator:Object.keys(validator.metafile.inputs)}));
  `],{encoding:'utf8',cwd:process.cwd(),timeout:30000});
  const graph=JSON.parse(output) as {browser:string[];validator:string[]};
  expect(graph.browser).toContain('data/travelBooks/providers.json');
  expect(graph.browser).toContain('services/book/readyBooks/printingGuide/index.ts');
  expect(graph.browser.some(file=>file.includes('data/travelBooks/schema/')||file.includes('node_modules/zod/'))).toBe(false);
  expect(graph.validator.some(file=>file.includes('node_modules/zod/'))).toBe(true);
});
