import {createHash} from 'node:crypto';
import providerData from '@/data/travelBooks/providers.json';
import {assertBookPrintResource,loadPrintDirectory} from '@/services/book/readyBooks/printResources';
import {publishedFixture} from './publicationFixtures';

const originalFetch=global.fetch;
const subtle=Object.getOwnPropertyDescriptor(global.crypto,'subtle');
const payload=Buffer.from(JSON.stringify(providerData));
const sha256=createHash('sha256').update(payload).digest('hex');
const resourceBook=()=>{
  const book=publishedFixture();
  book.printDirectory={mime:'application/json',uri:`https://metravel.by/travel-books/${book.id}/${book.revision}/providers.json`,bytes:payload.length,sha256};
  return book;
};
beforeEach(()=>{
  Object.defineProperty(global.crypto,'subtle',{configurable:true,value:{digest:jest.fn().mockResolvedValue(Uint8Array.from(Buffer.from(sha256,'hex')).buffer)}});
  global.fetch=jest.fn().mockResolvedValue({ok:true,arrayBuffer:async()=>Uint8Array.from(payload).buffer});
});
afterEach(()=>{
  global.fetch=originalFetch;
  if(subtle)Object.defineProperty(global.crypto,'subtle',subtle);
  else Reflect.deleteProperty(global.crypto,'subtle');
});

it('loads the exact integrity-checked public registry without credentials',async()=>{
  const book=resourceBook(),controller=new AbortController();
  await expect(loadPrintDirectory(book,controller.signal)).resolves.toEqual(providerData);
  expect(global.fetch).toHaveBeenCalledWith(book.printDirectory!.uri,{credentials:'omit',signal:controller.signal});
});

it('rejects byte/hash failures before parsing or substituting a registry',async()=>{
  const wrongSize=resourceBook();wrongSize.printDirectory!.bytes++;
  await expect(loadPrintDirectory(wrongSize)).rejects.toThrow('DOWNLOAD_SIZE');
  const wrongHash=resourceBook();wrongHash.printDirectory!.sha256='b'.repeat(64);
  await expect(loadPrintDirectory(wrongHash)).rejects.toThrow('DOWNLOAD_HASH');
});

it('rejects foreign or cross-revision resources before any request',async()=>{
  for(const uri of ['https://example.com/providers.json','https://metravel.by/travel-books/other/other/providers.json']){
    const book=resourceBook();book.printDirectory!.uri=uri;
    await expect(loadPrintDirectory(book)).rejects.toThrow('BOOK_PRINT_RESOURCE_INVALID');
  }
  expect(global.fetch).not.toHaveBeenCalled();
});

it('does not substitute provider data when a historical edition has no directory descriptor',async()=>{
  await expect(loadPrintDirectory(publishedFixture())).rejects.toThrow('BOOK_PRINT_DIRECTORY_UNAVAILABLE');
  expect(global.fetch).not.toHaveBeenCalled();
});

it('checks document MIME and immutable URL shape before opening',()=>{
  const book=resourceBook(),file=book.printDirectory!;
  expect(()=>assertBookPrintResource(book,{...file,uri:file.uri+'?other=1'})).toThrow();
  expect(()=>assertBookPrintResource(book,{...file,mime:'text/html'})).toThrow();
});
