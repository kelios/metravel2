/** @jest-environment node */
import currentPublication from '../../../../data/travelBooks/manifest.json';
import {publicationSchema, type PublishedBook} from '../../../../services/book/readyBooks/publication';
import {runNodeCli} from '../../../scripts/cli-test-utils';

const {planPublicationMerge} = require('../../../../scripts/books/publish.mjs');

it.each([
  {args: [], message: 'All three publication arguments are required'},
  {args: ['--unknown'], message: 'Use --input DIR --output DIR --base-url HTTPS_URL'},
])('keeps publication CLI errors nonzero without successful output: $message', ({args, message}) => {
  const result = runNodeCli(['scripts/books/publish.mjs', ...args]);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr.trim()).toBe(message);
});

type Catalog = {schemaVersion: 1; releaseId: 'travel-books-v1'; books: PublishedBook[]};
const current = () => {
  const catalog = structuredClone(currentPublication) as unknown as Catalog;
  const books=catalog.books.filter(book=>book.kind!=='quests'&&(!book.visualStyle||['watercolor','photo'].includes(book.visualStyle)));
  // This fixture isolates the global edition-pair contract; typed sidecars are tested separately.
  return {schemaVersion:catalog.schemaVersion,releaseId:catalog.releaseId,books};
};
const subset = (prior: Catalog, style: 'photo' | 'fantasy'): Catalog => ({
  schemaVersion: 1,
  releaseId: 'travel-books-v1',
  books: prior.books.filter(book => !book.visualStyle || book.visualStyle === 'watercolor').map(book => {
    const stem = book.country === 'BY' ? 'belarus' : 'poland';
    const id = `${stem}-${style}-memory`;
    const serialized = JSON.stringify(book).split(`/${book.id}/${book.revision}/`).join(`/${id}/${book.revision}/`);
    return {...JSON.parse(serialized), id, slug: `${stem}-${style}`, visualStyle: style};
  }),
});

it.each(['photo', 'fantasy'] as const)('validates a standalone %s subset against the complete canonical catalog', style => {
  const prior = current(), staged = subset(prior, style);
  // A staging subset does not itself satisfy the global watercolor-pair invariant.
  expect(publicationSchema.safeParse(staged).success).toBe(false);
  const result = planPublicationMerge(prior, staged, (value: unknown) => publicationSchema.parse(value));
  expect(result.staged).toBe(staged);
  expect(result.staged.books).toHaveLength(2);
  expect(publicationSchema.safeParse(result.combined).success).toBe(true);
});

it('fails closed when the complete candidate has lost a mandatory watercolor country', () => {
  const prior = current(), staged = subset(prior, 'fantasy');
  prior.books = prior.books.filter(book => !(book.country === 'PL' && (!book.visualStyle || book.visualStyle === 'watercolor')));
  expect(() => planPublicationMerge(prior, staged, (value: unknown) => publicationSchema.parse(value))).toThrow();
});

it('keeps the four raw accepted objects and emits no schema-normalized fields', () => {
  const prior = current(), staged = subset(prior, 'fantasy');
  const oldJson = JSON.stringify(prior.books), stagedJson = JSON.stringify(staged);
  const result = planPublicationMerge(prior, staged, (value: Catalog) => {
    publicationSchema.parse(value);
    return {...value, books: value.books.map(book => ({...book, kind: 'places'}))};
  });
  expect(prior.books).toHaveLength(4);
  expect(result.combined.books).toHaveLength(6);
  expect(JSON.stringify(result.combined.books.slice(0, 4))).toBe(oldJson);
  expect(JSON.stringify(prior.books)).toBe(oldJson);
  expect(JSON.stringify(result.staged)).toBe(stagedJson);
  expect(result.combined.books.every((book: PublishedBook) => !Object.prototype.hasOwnProperty.call(book, 'kind'))).toBe(true);
});
