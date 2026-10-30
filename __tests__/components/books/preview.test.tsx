import React from 'react';
import {render,fireEvent,screen} from '@testing-library/react';
import ReadyBookPreview from '@/components/books/preview/ReadyBookPreview.web';
import {publishedFixture} from '../../services/book/readyBooks/publicationFixtures';
jest.mock('@/components/ui/Button',()=>({__esModule:true,default:({label,onPress,disabled}:any)=><button disabled={disabled} onClick={onPress}>{label}</button>}));
jest.mock('@/components/books/bookCopy',()=>({useBookCopy:()=>((key:string)=>key)}));
beforeEach(()=>{Object.defineProperty(window,'matchMedia',{configurable:true,value:()=>({matches:false,addEventListener:jest.fn(),removeEventListener:jest.fn()})});});
describe('preview interaction',()=>{
  it('changes page, retries the same page, preserves page when zooming and closes by Escape',()=>{
    const book=publishedFixture(),close=jest.fn();
    render(<ReadyBookPreview book={book} profileId="pocket-150x100" onClose={close}/>);
    const page=screen.getByRole('spinbutton');fireEvent.change(page,{target:{value:'6'}});
    const image=screen.getByRole('img',{hidden:true});expect(image.getAttribute('src')).toBe(book.preview.find(p=>p.component==='body'&&p.profileId==='pocket-150x100')!.pages[5].uri);
    fireEvent.error(image);fireEvent.click(screen.getByText('retry'));expect((page as HTMLInputElement).value).toBe('6');
    fireEvent.change(screen.getByLabelText('zoom'),{target:{value:'2'}});expect((page as HTMLInputElement).value).toBe('6');
    fireEvent.change(screen.getByRole('combobox',{name:'contents'}),{target:{value:'cover'}});
    expect((page as HTMLInputElement).value).toBe('1');
    fireEvent.change(page,{target:{value:'3'}});
    fireEvent.change(screen.getByRole('combobox',{name:'contents'}),{target:{value:'body'}});
    expect((page as HTMLInputElement).value).toBe('6');
    fireEvent.change(screen.getByRole('combobox',{name:'contents'}),{target:{value:'cover'}});
    expect((page as HTMLInputElement).value).toBe('3');
    fireEvent.keyDown(screen.getByRole('region'),{key:'Escape'});expect(close).toHaveBeenCalledTimes(1);
  });
});

it('loads only the current page and reaches the real final folio beyond page 56',()=>{
  const book=publishedFixture();
  render(<ReadyBookPreview book={book} profileId="pocket-150x100" onClose={jest.fn()}/>);
  expect(screen.getAllByRole('img',{hidden:true})).toHaveLength(1);
  const page=screen.getByRole('spinbutton');
  expect(page.getAttribute('max')).toBe(String(book.bodyPageCount));
  expect(book.bodyPageCount).toBeGreaterThan(56);
  fireEvent.change(page,{target:{value:String(book.bodyPageCount)}});
  const image=screen.getByRole('img',{hidden:true});
  const body=book.preview.find(p=>p.component==='body'&&p.profileId==='pocket-150x100')!;
  expect(image.getAttribute('src')).toBe(body.pages[book.bodyPageCount-1].uri);
  expect((screen.getByRole('button',{name:'next'}) as HTMLButtonElement).disabled).toBe(true);
});
it('opens at most two images on desktop and keeps keyboard focus in the preview after retry',()=>{
  Object.defineProperty(window,'matchMedia',{configurable:true,value:()=>({matches:true,addEventListener:jest.fn(),removeEventListener:jest.fn()})});
  render(<ReadyBookPreview book={publishedFixture()} profileId="album-a5" onClose={jest.fn()}/>);
  fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'6'}});
  expect(screen.getAllByRole('img',{hidden:true})).toHaveLength(2);
  fireEvent.error(screen.getAllByRole('img',{hidden:true})[0]);
  fireEvent.click(screen.getByRole('button',{name:'retry'}));
  expect(document.activeElement?.classList.contains('ready-books-paper')).toBe(true);
  fireEvent.keyDown(document.activeElement!,{key:'ArrowRight'});
  expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('8');
});

it('opens the selected contents folio and returns keyboard focus to the preview heading',()=>{
  const book=publishedFixture(),stop=book.stops[book.stops.length-1];
  render(<ReadyBookPreview book={book} profileId="album-a5" onClose={jest.fn()}/>);
  fireEvent.click(screen.getByText('contents',{selector:'summary'}));
  fireEvent.click(screen.getByRole('button',{name:String(stop.page)+' · '+stop.title}));
  expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe(String(stop.page));
  expect(document.activeElement).toBe(screen.getByRole('heading',{name:'preview'}));
  fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'6.5'}});
  expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('6');
});
