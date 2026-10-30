import {runCli} from '../../../scripts/cli-test-utils';

// Use actual print assets: mocks cannot prove rights coverage or image density.
describe('ready-book print-media gate', () => {
  it('checks the complete 24-place and two-cover registry', () => {
    const result = runCli(process.execPath, ['scripts/books/media-check.mjs']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('26 images; 24 stops + 2 covers');
  });

  it('rejects incomplete rights, substitution, low resolution and corrupt bytes', () => {
    const result = runCli(process.execPath, ['--input-type=module', '-e', `
      import {readFile} from 'node:fs/promises';
      import {validateBookMedia, effectivePpi} from './scripts/books/media-validation.mjs';
      const registry=JSON.parse(await readFile('data/travelBooks/rights.json','utf8'));
      const books=await Promise.all(['by','pl'].map(async c=>JSON.parse(await readFile('data/travelBooks/'+c+'/editorial.json','utf8'))));
      const cases={};
      const mutations={
        rights:r=>r.assets[0].printAllowed=false,
        unknown:r=>r.assets[0].stopId='another-castle',
        density:r=>{r.assets[0].widthPx=50;r.assets[0].heightPx=40},
        corrupt:r=>r.assets[0].sha256='0'.repeat(64),
        licence:r=>r.assets[0].rights='All rights reserved',
        crop:r=>r.assets[0].fit='cover',
        missing:r=>r.assets.splice(0,1),
        escape:r=>r.assets[0].localPath='../outside.jpg',
        date:r=>r.assets[0].checkedAt='2026-02-30',
        original:r=>delete r.assets[0].original.widthPx,
      };
      for(const [key,mutate] of Object.entries(mutations)){
        const copy=structuredClone(registry);mutate(copy);cases[key]=await validateBookMedia(copy,books);
      }
      console.log(JSON.stringify({cases,contain:effectivePpi(1200,600,100,100)}));
    `]);
    expect(result.status).toBe(0);
    const data = JSON.parse(result.stdout);
    const expected: Record<string, string> = {
      rights: 'Missing print rights', unknown: 'Expected one image', density: 'below 300 ppi',
      corrupt: 'SHA-256/bytes mismatch', licence: 'License requires manual review',
      crop: 'Only uncropped contain', missing: 'Expected one image', escape: 'print:',
      date: 'Missing verification evidence', original: 'Missing original',
    };
    for (const [name, diagnostic] of Object.entries(expected)) {
      expect(data.cases[name].some((issue: string) => issue.includes(diagnostic))).toBe(true);
    }
    // A 1200×600 image contained in 100×100 mm prints as 100×50 mm.
    expect(data.contain).toBeCloseTo(304.8);
  });
});
