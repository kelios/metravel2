/** @jest-environment node */
import {loadReadyBookMetadata,type ReadyBookSummary} from '@/services/book/readyBooks/bookMetadata';
import {fetchVerifiedBookAsset} from '@/services/book/readyBooks/download';
import {publishedFixture} from './publicationFixtures';
jest.mock('@/services/book/readyBooks/download',()=>({fetchVerifiedBookAsset:jest.fn()}));
const fixture=()=>{
  const book=publishedFixture();
  const summary:ReadyBookSummary={...book,metadata:{kind:'book-metadata',bookId:book.id,revision:book.revision,uri:`https://metravel.by/travel-books/${book.id}/${book.revision}/book.json`,mime:'application/json',bytes:123,sha256:'a'.repeat(64)}};
  return {book,summary};
};
beforeEach(()=>jest.mocked(fetchVerifiedBookAsset).mockReset());
test('authenticates legacy raw metadata without adding kind and caches only its pinned identity',async()=>{
  const {book,summary}=fixture();
  const legacy={...book} as Partial<typeof book>;delete legacy.kind;
  jest.mocked(fetchVerifiedBookAsset).mockResolvedValue(new TextEncoder().encode(JSON.stringify(legacy)).buffer as ArrayBuffer);
  const value=await loadReadyBookMetadata(summary);
  expect(value).toEqual(legacy);
  expect('kind'in value).toBe(false);
  expect(await loadReadyBookMetadata(summary)).toBe(value);
  expect(fetchVerifiedBookAsset).toHaveBeenCalledTimes(1);
});
test('rejects a descriptor for another revision before any fetch',async()=>{
  const {summary}=fixture();summary.metadata={...summary.metadata,revision:'swapped'};
  await expect(loadReadyBookMetadata(summary)).rejects.toThrow('BOOK_METADATA_IDENTITY');
  expect(fetchVerifiedBookAsset).not.toHaveBeenCalled();
});
test('does not accept same-ID metadata with swapped style/count or a catalogue summary mismatch',async()=>{
  const {book,summary}=fixture();summary.metadata={...summary.metadata,sha256:'b'.repeat(64)};
  jest.mocked(fetchVerifiedBookAsset).mockResolvedValue(new TextEncoder().encode(JSON.stringify({...book,stopCount:book.stopCount+1})).buffer as ArrayBuffer);
  await expect(loadReadyBookMetadata(summary)).rejects.toThrow('BOOK_METADATA_IDENTITY');
  jest.mocked(fetchVerifiedBookAsset).mockResolvedValue(new TextEncoder().encode(JSON.stringify({...book,visualStyle:'photo'})).buffer as ArrayBuffer);
  await expect(loadReadyBookMetadata(summary)).rejects.toThrow('BOOK_METADATA_IDENTITY');
});
test('honours an already aborted selection before returning cached metadata',async()=>{
  const {summary}=fixture(),controller=new AbortController();controller.abort();
  await expect(loadReadyBookMetadata(summary,controller.signal)).rejects.toMatchObject({name:'AbortError'});
});
