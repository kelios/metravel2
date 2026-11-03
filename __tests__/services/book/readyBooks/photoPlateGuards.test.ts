import {runNodeCli} from '../../../scripts/cli-test-utils';

// #2968: the photo-edition loader refuses a second frame, an unchecked photo, a
// feathered plate and a plate composed from another retouch state.
it('rejects every plate or place that would print more than one clean, disclosed photograph', () => {
  const result = runNodeCli(['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import {checkPrintedPlace, checkPhotoPlate, checkRetouchState} from './scripts/books/source-ready-book.mjs';
    const sha = 'a'.repeat(64), other = 'b'.repeat(64);
    const photo = {role: 'main', peopleFree: true, sha256: sha};
    checkPrintedPlace('p', [photo], true);
    assert.throws(() => checkPrintedPlace('p', [photo, {...photo, sha256: other}], true), /exactly one/);
    assert.throws(() => checkPrintedPlace('p', [{...photo, peopleFree: undefined}], true), /people-free/);
    assert.throws(() => checkPrintedPlace('p', [{...photo, role: 'support'}], true), /exactly one/);
    assert.throws(() => checkPrintedPlace('p', [photo], false), /exactly one/);
    const placed = {sha256: sha, upscaled: false, embeddedPpi: 200, nativePpiAtPlacedSize: 200, retouchedSha256: null};
    const plate = {box: 'page-album-a5', sha256: sha, featherMm: 0, photos: [placed]};
    checkPhotoPlate('p', plate, 'page-album-a5', new Set([sha]));
    assert.throws(() => checkPhotoPlate('p', {...plate, featherMm: 6}, 'page-album-a5', new Set([sha])), /crisp/);
    assert.throws(() => checkPhotoPlate('p', {...plate, photos: [placed, placed]}, 'page-album-a5', new Set([sha])), /crisp/);
    assert.throws(() => checkPhotoPlate('p', plate, 'page-album-a5', new Set([other])), /outside the verified evidence/);
    assert.throws(() => checkPhotoPlate('p', {...plate, photos: [{...placed, upscaled: true}]}, 'page-album-a5', new Set([sha])), /upscales/);
    checkRetouchState('p', plate, photo);
    const retouched = {...photo, retouch: {sha256: other}};
    assert.throws(() => checkRetouchState('p', plate, retouched), /retouch state/);
    checkRetouchState('p', {...plate, photos: [{...placed, retouchedSha256: other}]}, retouched);
    assert.throws(() => checkRetouchState('p', {...plate, photos: [{...placed, retouchedSha256: other}]}, photo), /retouch state/);
    console.log('ok');
  `]);
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  expect(result.stdout.trim()).toBe('ok');
});
