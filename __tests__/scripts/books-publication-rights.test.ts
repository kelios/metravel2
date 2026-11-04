/** @jest-environment node */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const rights = require('../../scripts/books/publication-rights.cjs');
const {collectAssets} = require('../../scripts/books/copy-publication.cjs');
const audit = require('../../data/travelBooks/publication-rights-audit.json');
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const source = 'A project-authored sample';
const target = {bookId: 'sample', revision: 'edition-one', artifacts: [{id: 'sample.pdf', sha256: digest('exact pdf')}]};

function evidence() {
  return {schemaVersion: 1, ...target, artifacts: target.artifacts.map(artifact => ({...artifact, materialIds: ['manuscript']})), materials: [{
    id: 'manuscript', kind: 'text', basis: 'original', rightsHolder: 'Fixture author', source: 'source.md',
    evidencePath: 'source.md', evidenceSha256: digest(source), permissions: ['digital-distribution', 'print'],
    royaltyStatus: 'none', attribution: {required: false, text: 'Fixture author', artifactId: 'sample.pdf'},
  }]};
}

describe('book publication rights', () => {
  let root: string;
  beforeEach(async () => {
    await fs.mkdir('.codex-temp', {recursive: true});
    root = await fs.mkdtemp(path.resolve('.codex-temp/books-rights-test-'));
    await fs.writeFile(path.join(root, 'source.md'), source);
  });
  afterEach(async () => fs.rm(root, {recursive: true, force: true}));

  it('binds reviewed materials and permission to the exact artifact set', async () => {
    const proof = evidence();
    await expect(rights.assertEditionRights({root, ...target, proof})).resolves.toBeUndefined();
    await expect(rights.assertEditionRights({...target, root, proof, artifacts: [{id: 'sample.pdf', sha256: digest('replaced pdf')}]})).rejects.toThrow('does not match exact publication files');
    await expect(rights.assertEditionRights({...target, root, proof, artifacts: [...target.artifacts, {id: 'cover.pdf', sha256: digest('extra pdf')}]})).rejects.toThrow('does not match exact publication files');
    const wrongCredit = evidence();
    wrongCredit.materials[0].attribution.required = true;
    wrongCredit.materials[0].attribution.artifactId = 'unpublished.pdf';
    await expect(rights.assertEditionRights({root, ...target, proof: wrongCredit})).rejects.toThrow('Missing attribution evidence');
    const pending = evidence();
    pending.materials[0].royaltyStatus = 'pending';
    await expect(rights.assertEditionRights({root, ...target, proof: pending})).rejects.toThrow('Unresolved rights');
    await fs.writeFile(path.join(root, 'source.md'), 'replacement material');
    await expect(rights.assertEditionRights({root, ...target, proof})).rejects.toThrow('Rights source evidence changed');
  });

  it('permits unchanged historical assets, never a revision ID with modified files', async () => {
    const expected = new Set<string>();
    for (const sha of audit.legacySnapshotSha256) {
      const bytes = await fs.readFile(`data/travelBooks/releases/${sha}.json`);
      expect(digest(bytes)).toBe(sha);
      const manifest = JSON.parse(bytes.toString('utf8'));
      const assets = collectAssets([manifest]);
      for (const book of manifest.books) {
        const prefix = `${book.id}/${book.revision}/`;
        const artifacts = assets.filter((a: {relative: string}) => a.relative.startsWith(prefix))
          .map((a: {relative: string; sha256: string}) => ({id: a.relative.slice(prefix.length), sha256: a.sha256}));
        expected.add(rights.publicationRightsTargetSha256({bookId: book.id, revision: book.revision, artifacts}));
      }
      await expect(rights.assertFullPublicationRights({root, manifest, assets, source: root})).resolves.toEqual([]);
    }
    expect([...expected].sort()).toEqual(audit.legacyTargetSha256);
    const manifest = JSON.parse(await fs.readFile('data/travelBooks/manifest.json', 'utf8'));
    const assets = collectAssets([manifest]);
    assets[0].sha256 = digest('modified content');
    await expect(rights.assertFullPublicationRights({root, manifest, assets, source: root})).rejects.toThrow('Missing rights proof');
  });

  it('requires the same exact rights evidence for mini diary files', async () => {
    const diary = {id: target.bookId, revision: target.revision};
    const manifest = {books: [], miniDiaries: [diary]};
    const directory = path.join(root, diary.id, diary.revision);
    const assets = target.artifacts.map(artifact => ({relative: `${diary.id}/${diary.revision}/${artifact.id}`, sha256: artifact.sha256}));
    await fs.mkdir(directory, {recursive: true});
    const args = {root, manifest, assets, source: root};
    await expect(rights.assertFullPublicationRights(args)).rejects.toThrow('Missing rights proof for sample/edition-one');
    const proof = evidence();
    await fs.writeFile(path.join(directory, 'rights.json'), JSON.stringify(proof));
    await expect(rights.assertFullPublicationRights(args)).resolves.toEqual([proof]);
  });
});
