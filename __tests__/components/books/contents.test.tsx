import React from 'react';
import {PassThrough} from 'node:stream';
import {renderToPipeableStream} from 'react-dom/server.node';
import {renderToStaticMarkup} from 'react-dom/server';
import ReadyBookDetails from '@/components/books/ReadyBookDetails.web';
import ReadyBookContents from '@/components/books/ReadyBookContents.web';
import {readyBooks} from '@/services/book/readyBooks/catalog';
import {loadReadyBookMetadata} from '@/services/book/readyBooks/bookMetadata';
import publication from '@/data/travelBooks/manifest.json';
import contents from '@/data/travelBooks/contents.json';

jest.mock('@/components/books/BooksFrame',()=>({BooksFrame:({children,title}:any)=><main><h1>{title}</h1>{children}</main>}));
jest.mock('../../../components/books/preview/ReadyBookPreview',()=>({__esModule:true,default:()=>null}),{virtual:true});
jest.mock('expo-router',()=>({Link:({children,href}:any)=><a href={href}>{children}</a>,useFocusEffect:()=>{}}));
jest.mock('@/services/book/readyBooks/bookMetadata',()=>({loadReadyBookMetadata:jest.fn()}));

function streamHtml(element:React.ReactElement){
  return new Promise<string>((resolve,reject)=>{
    const output=new PassThrough();
    let html='';
    output.on('data',chunk=>{html+=chunk.toString();});
    output.on('end',()=>resolve(html));
    output.on('error',reject);
    const stream=renderToPipeableStream(element,{onAllReady:()=>stream.pipe(output),onError:reject});
  });
}

it('streams the exact complete selected-edition contents before effects or the metadata request',async()=>{
  for(const summary of readyBooks){
    const published=publication.books.find(book=>book.id===summary.id)!;
    const html=await streamHtml(<ReadyBookDetails slug={summary.slug}/>);
    const host=document.createElement('div');host.innerHTML=html;
    const rows=host.querySelectorAll('details ol li');
    expect(rows).toHaveLength(published.stops.length);
    expect(Array.from(rows).map(row=>row.textContent?.split(' · ')[0])).toEqual(published.stops.map(stop=>stop.title));
    expect(host.querySelector('ol')?.lang).toBe('ru');
    expect(html).toContain('application/ld+json');
    expect(loadReadyBookMetadata).not.toHaveBeenCalled();
  }
});

it('refuses a different metadata revision rather than showing another edition contents',()=>{
  const summary=readyBooks[0];
  expect(()=>renderToStaticMarkup(<ReadyBookContents book={{...summary,revision:'different'}}/>)).toThrow('BOOK_CONTENTS_IDENTITY');
  expect(()=>renderToStaticMarkup(<ReadyBookContents book={{...summary,metadata:{...summary.metadata,sha256:'0'.repeat(64)}}}/>)).toThrow('BOOK_CONTENTS_IDENTITY');
  expect(contents.books).toHaveLength(readyBooks.length);
});
