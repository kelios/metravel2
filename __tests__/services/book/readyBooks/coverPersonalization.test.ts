/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://metravel.by/"}
 */
import {createHash} from 'node:crypto';
import {waitFor} from '@testing-library/react';
import {coverClientFixture} from './coverClientFixtures';

jest.mock('@/services/book/readyBooks/coverText',()=>({...jest.requireActual('@/services/book/readyBooks/coverText'),createPersonalizedCoverPdf:jest.fn()}));
let createPersonalizedCoverBlob:typeof import('@/services/book/readyBooks/coverPersonalization').createPersonalizedCoverBlob;
let core:jest.MockedFunction<typeof import('@/services/book/readyBooks/coverText').createPersonalizedCoverPdf>;
const originalFetch=global.fetch;
const subtle=Object.getOwnPropertyDescriptor(global.crypto,'subtle');
beforeEach(()=>{
  jest.resetModules();
  ({createPersonalizedCoverBlob}=require('@/services/book/readyBooks/coverPersonalization'));
  core=require('@/services/book/readyBooks/coverText').createPersonalizedCoverPdf;
  core.mockResolvedValue(new Uint8Array(Buffer.from('%PDF-personalized-result')));
  // jsdom ArrayBuffers belong to a different realm than Node's WebCrypto.
  // Bridge the actual bytes to a Node-owned Buffer and compute the real digest.
  Object.defineProperty(global.crypto,'subtle',{configurable:true,value:{
    digest:async(algorithm:AlgorithmIdentifier,data:BufferSource)=>{
      const name=typeof algorithm==='string'?algorithm:algorithm.name;
      if(name!=='SHA-256')throw new Error('Unexpected digest algorithm');
      const view=ArrayBuffer.isView(data)?new Uint8Array(data.buffer,data.byteOffset,data.byteLength):new Uint8Array(data);
      const bytes=Buffer.from(Array.from(view));
      return Uint8Array.from(createHash('sha256').update(bytes).digest()).buffer;
    },
  }});
});
afterEach(()=>{
  global.fetch=originalFetch;
  if(subtle)Object.defineProperty(global.crypto,'subtle',subtle);else Reflect.deleteProperty(global.crypto,'subtle');
});
function respond(contents:Map<string,Uint8Array>) {
  global.fetch=jest.fn(async(uri:RequestInfo|URL)=>{
    const data=contents.get(String(uri));
    return {ok:!!data,status:data?200:404,arrayBuffer:async()=>data!.slice().buffer} as Response;
  });
}
it('fetches only immutable verified templates/font, caches by SHA and never sends private text',async()=>{
  const {book,contents}=coverClientFixture();respond(contents);
  const text='Мои личные воспоминания';
  const args={book,profileId:'pocket-150x100',mode:'read' as const,text};
  const first=await createPersonalizedCoverBlob(args);
  await createPersonalizedCoverBlob({...args,text:'Другой личный заголовок'});
  expect(first.type).toBe('application/pdf');
  expect(global.fetch).toHaveBeenCalledTimes(2);
  for(const [uri,options] of jest.mocked(global.fetch).mock.calls) {
    expect(String(uri)).not.toContain(text);
    expect(String(uri)).toMatch(/^https:\/\/metravel\.by\/travel-books\//);
    expect(options).toEqual({credentials:'omit',signal:undefined});
  }
  expect(core).toHaveBeenCalledTimes(2);
  expect(core.mock.calls[0][0].text).toBe(text);
  expect(core.mock.calls[0][0].fontBytes.length).toBe(book.coverPersonalization!.font.bytes);
  await createPersonalizedCoverBlob({...args,mode:'print-shop'});
  expect(global.fetch).toHaveBeenCalledTimes(3);
});
it('rejects wrong font SHA and cross-origin assets before generating a PDF',async()=>{
  const first=coverClientFixture();respond(first.contents);
  first.book.coverPersonalization!.font.sha256='0'.repeat(64);
  await expect(createPersonalizedCoverBlob({book:first.book,profileId:'pocket-150x100',mode:'read',text:'Мой дневник'})).rejects.toThrow('DOWNLOAD_HASH');
  expect(core).not.toHaveBeenCalled();
  const second=coverClientFixture();respond(second.contents);
  second.book.coverPersonalization!.templates[0].uri='https://example.org/private-template.pdf';
  await expect(createPersonalizedCoverBlob({book:second.book,profileId:'pocket-150x100',mode:'read',text:'Мой дневник'})).rejects.toThrow('COVER_ASSET_INVALID');
  expect(core).not.toHaveBeenCalled();
});
it('does not fall back to another cover mode and rejects invalid text before asset requests',async()=>{
  const {book,contents}=coverClientFixture();respond(contents);
  await expect(createPersonalizedCoverBlob({book,profileId:'album-a5',mode:'home-sewn' as 'read',text:'Мой дневник'})).rejects.toThrow('COVER_MODE_UNAVAILABLE');
  await expect(createPersonalizedCoverBlob({book,profileId:'album-a5',mode:'read',text:'  '})).rejects.toThrow('COVER_TEXT_EMPTY');
  expect(global.fetch).not.toHaveBeenCalled();
  expect(core).not.toHaveBeenCalled();
});
it('discards a generated PDF when its request was aborted while the core was working',async()=>{
  const {book,contents}=coverClientFixture();respond(contents);
  let finish!:(bytes:Uint8Array)=>void;
  core.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
  const controller=new AbortController();
  // Attach both handlers immediately: an unexpected early rejection must not
  // become an unhandled promise if the core-call assertion times out.
  const pending=createPersonalizedCoverBlob({book,profileId:'album-a5',mode:'home-rings',text:'Мой дневник',signal:controller.signal}).then(
    value=>({state:'resolved' as const,value}),
    error=>({state:'rejected' as const,error}),
  );
  await waitFor(()=>expect(core).toHaveBeenCalledTimes(1));
  controller.abort();finish(new Uint8Array([1,2,3]));
  expect(await pending).toMatchObject({state:'rejected',error:{name:'AbortError'}});
});
