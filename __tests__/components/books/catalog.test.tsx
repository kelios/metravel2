import React from 'react';
import {render,screen} from '@testing-library/react';
import Catalog from '@/components/books/catalog/ReadyBooksCatalog.web';
import {publishedFixture} from '../../services/book/readyBooks/publicationFixtures';
jest.mock('@/components/books/bookCopy',()=>({useBookCopy:()=>((key:string,params?:Record<string,unknown>)=>params?key+':'+JSON.stringify(params):key)}));
jest.mock('@/components/ui/ImageCardMedia',()=>({__esModule:true,default:({src,alt}:any)=><img src={src} alt={alt}/>}));
jest.mock('@/components/books/BooksFrame',()=>({BooksFrame:({children,title}:any)=><main><h1>{title}</h1>{children}</main>}));
jest.mock('expo-router',()=>({Link:({children,href}:any)=><a href={href}>{children}</a>}));
jest.mock('@/services/book/readyBooks/catalog',()=>({readyBooks:[]}));
const books=require('@/services/book/readyBooks/catalog').readyBooks;
afterEach(()=>books.splice(0));
describe('book catalogue',()=>{
  it('never offers fake downloads while publication is not ready',()=>{
    render(<Catalog/>);expect(screen.getByText('preparing')).toBeTruthy();expect(screen.queryByRole('link')).toBeNull();
  });
  it('shows the editorial language, both physical formats and exact edition URL',()=>{
    books.push(publishedFixture());render(<Catalog/>);
    expect(screen.getByText('language')).toBeTruthy();expect(screen.getByText(/pocket/)).toBeTruthy();expect(screen.getByText(/album/)).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/books/belarus');expect(screen.getByText('partial')).toBeTruthy();
    expect(screen.queryByText('order')).toBeNull();
  });
});

it.each([31,37])('shows data-driven counts for a valid %i-place edition',count=>{
  const book=publishedFixture(count);
  books.push(book);
  render(<Catalog/>);
  expect(screen.getByText('counts:'+JSON.stringify({places:String(book.stopCount),pages:String(book.bodyPageCount)}))).toBeTruthy();
  expect(book.stopCount).toBe(count);
  expect(book.bodyPageCount).toBeGreaterThan(56);
});
