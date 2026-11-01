import {runNodeCli} from '../../../scripts/cli-test-utils';

it.each(['watercolor', 'photo', 'fantasy'])('accepts the approved %s style while refusing an output outside local staging', style => {
  const result = runNodeCli(['scripts/build-ready-books.mjs', '--style', style, '--output', '/not-a-book-staging-directory']);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Output must be in ignored .codex-temp/');
  expect(result.stderr).not.toContain('No approved edition identity');
});

it('keeps the pending graphic series unavailable to the production CLI', () => {
  const result = runNodeCli(['scripts/build-ready-books.mjs', '--style', 'graphic', '--output', '/not-a-book-staging-directory']);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('No approved edition identity for style: graphic');
});

it('derives distinct defaults from the approved source registry without starting a renderer', () => {
  const result = runNodeCli(['--input-type=module', '-e', `
    import {readyBookDefaultOutput} from './scripts/build-ready-books.mjs';
    import {BOOK_IDENTITY} from './scripts/books/source-ready-book.mjs';
    const defaults=Object.fromEntries(Object.keys(BOOK_IDENTITY).map(style=>[style,readyBookDefaultOutput(style)]));
    let unknown=false;try{readyBookDefaultOutput('unapproved-style');}catch{unknown=true;}
    console.log(JSON.stringify({defaults,unknown}));
  `]);
  expect(result.status).toBe(0);
  const report = JSON.parse(result.stdout.trim());
  expect(report.defaults).toMatchObject({watercolor: '.codex-temp/books-next/production', photo: '.codex-temp/books-photo/production', fantasy: '.codex-temp/books-fantasy/production'});
  expect(new Set(Object.values(report.defaults)).size).toBe(Object.keys(report.defaults).length);
  expect(report.unknown).toBe(true);
});
