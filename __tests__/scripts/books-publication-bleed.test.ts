import {readFileSync} from 'fs';
import path from 'path';

import {printProfileSchema} from '../../data/travelBooks/schema/profiles';
import {runNodeCli} from './cli-test-utils';

// #2952: book.json profiles describe the trim format (bleedMm 0); new revisions also
// record the real bleed of their print-shop PDFs, without rewriting published ones.
const trim = {id: 'album-a5', widthMm: 148, heightMm: 210, bleedMm: 0, safeMm: 5, bindingMm: 15, binding: 'rings'} as const;

const runPublishedProfile = (group: unknown) => runNodeCli(['--input-type=module', '-e', `
  import {publishedProfile} from './scripts/books/publish.mjs';
  try { console.log(JSON.stringify({profile: publishedProfile(${JSON.stringify(group)})})); }
  catch (error) { console.log(JSON.stringify({error: error.message})); }
`], {}, {cwd: process.cwd(), timeoutMs: 10000});

const artifact = (purpose: string, component: string, bleedMm: number) =>
  ({purpose, component, sha256: purpose + component, printProfile: {...trim, bleedMm}});

describe('published print profile bleed', () => {
  it('records the actual print-shop bleed next to the trim-size profile', () => {
    const result = runPublishedProfile({profile: trim, artifacts: [
      artifact('read', 'body', 0), artifact('read', 'cover', 0),
      artifact('print-shop', 'body', 3), artifact('print-shop', 'cover', 3),
      artifact('home-rings', 'body', 0),
    ]});
    expect(result.status).toBe(0);
    const {profile} = JSON.parse(result.stdout);
    expect(profile).toEqual({...trim, printShopBleedMm: 3});
    expect(printProfileSchema.parse(profile)).toEqual(profile);
  });

  it.each([
    ['missing print-shop cover', [artifact('print-shop', 'body', 3)]],
    ['inconsistent body/cover bleed', [artifact('print-shop', 'body', 3), artifact('print-shop', 'cover', 2)]],
    ['print-shop file without bleed', [artifact('print-shop', 'body', 0), artifact('print-shop', 'cover', 0)]],
  ])('refuses to publish a profile with %s', (_name, artifacts) => {
    const result = runPublishedProfile({profile: trim, artifacts});
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).error).toMatch(/Print-shop/);
  });

  it('keeps older published revisions valid and rejects bleed on a non-trim profile', () => {
    expect(printProfileSchema.safeParse(trim).success).toBe(true);
    expect(printProfileSchema.safeParse({...trim, bleedMm: 3, printShopBleedMm: 3}).success).toBe(false);
    expect(printProfileSchema.safeParse({...trim, printShopBleedMm: 1}).success).toBe(false);
  });

  it('does not rewrite the active manifest: existing revisions keep their published profiles', () => {
    const manifest = JSON.parse(readFileSync(path.join(process.cwd(), 'data/travelBooks/manifest.json'), 'utf8'));
    for (const book of manifest.books) for (const profile of book.profiles) {
      expect(printProfileSchema.safeParse(profile).success).toBe(true);
      expect(profile.bleedMm).toBe(0);
    }
  });
});
