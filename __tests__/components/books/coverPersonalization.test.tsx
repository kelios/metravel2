import React from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react';
import Editor from '@/components/books/cover/CoverPersonalizationEditor.web';
import {createPersonalizedCoverBlob} from '@/services/book/readyBooks/coverPersonalization';
import {CoverTextError} from '@/services/book/readyBooks/coverText';
import {downloadBlobOnWeb} from '@/utils/downloadUrlOnWeb';
import {openWebWindow} from '@/utils/externalLinks';
import {publishedFixture} from '../../services/book/readyBooks/publicationFixtures';
import {coverClientFixture} from '../../services/book/readyBooks/coverClientFixtures';

let mockBookFocused=true;
jest.mock('expo-router',()=>({
  useFocusEffect:(callback:()=>void|(()=>void))=>{
    const {useEffect}=require('react');
    const focused=mockBookFocused;
    useEffect(()=>focused?callback():undefined,[callback,focused]);
  },
}));

jest.mock('@expo/vector-icons/Feather',()=>({__esModule:true,default:()=>null}));
jest.mock('@/components/ui/Button',()=>({__esModule:true,default:({label,onPress,disabled}:any)=><button disabled={disabled} onClick={onPress}>{label}</button>}));
jest.mock('@/i18n/LocaleProvider',()=>({useTranslation:()=>({t:(key:string)=>key.replace(/^books:/,''),ready:true})}));
jest.mock('@/services/book/readyBooks/coverPersonalization',()=>({...jest.requireActual('@/services/book/readyBooks/coverPersonalization'),createPersonalizedCoverBlob:jest.fn()}));
jest.mock('@/utils/downloadUrlOnWeb',()=>({downloadBlobOnWeb:jest.fn()}));
jest.mock('@/utils/externalLinks',()=>({openWebWindow:jest.fn()}));

const originalCreate=Object.getOwnPropertyDescriptor(URL,'createObjectURL');
const originalRevoke=Object.getOwnPropertyDescriptor(URL,'revokeObjectURL');
const originalFetch=global.fetch;
let urlCounter=0;
beforeEach(()=>{
  mockBookFocused=true;
  jest.clearAllMocks();
  jest.mocked(createPersonalizedCoverBlob).mockReset().mockResolvedValue(new Blob(['my-pdf'],{type:'application/pdf'}));
  jest.mocked(downloadBlobOnWeb).mockReturnValue(true);
  jest.mocked(openWebWindow).mockReturnValue({} as Window);
  Object.defineProperty(URL,'createObjectURL',{configurable:true,value:jest.fn(()=>`blob:personal-cover-${++urlCounter}`)});
  Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:jest.fn()});
  global.fetch=jest.fn();
});
afterAll(()=>{
  if(originalCreate)Object.defineProperty(URL,'createObjectURL',originalCreate);else Reflect.deleteProperty(URL,'createObjectURL');
  if(originalRevoke)Object.defineProperty(URL,'revokeObjectURL',originalRevoke);else Reflect.deleteProperty(URL,'revokeObjectURL');
  global.fetch=originalFetch;
});
function ownTitle(text:string) {
  fireEvent.click(screen.getByRole('radio',{name:'coverOwnText'}));
  fireEvent.change(screen.getByRole('textbox'),{target:{value:text}});
}
function deferred<T>() {
  let resolve!:(result:T)=>void;
  const promise=new Promise<T>(finish=>{resolve=finish;});
  return {promise,resolve};
}
it('leaves historical editions unchanged and never generates on mount or typing',()=>{
  const historical=publishedFixture();
  delete historical.coverPersonalization;
  const {rerender}=render(<Editor book={historical} profileId="pocket-150x100"/>);
  expect(screen.queryByRole('heading')).toBeNull();
  const {book}=coverClientFixture();
  rerender(<Editor book={book} profileId="pocket-150x100"/>);
  expect(screen.getAllByRole('radio')).toHaveLength(3);
  expect((screen.getByRole('radio',{name:book.coverPersonalization!.presets[0].text}) as HTMLInputElement).checked).toBe(true);
  expect(screen.getAllByRole('option').map(option=>(option as HTMLOptionElement).value)).toEqual(['read','print-shop','home-rings']);
  expect(screen.getByText('coverNoSewn')).toBeTruthy();
  ownTitle('Личный заголовок');
  expect(screen.getByRole('textbox').classList.contains('ym-disable-keys')).toBe(true);
  expect(screen.getByRole('textbox').classList.contains('ym-hide-content')).toBe(true);
  expect(createPersonalizedCoverBlob).not.toHaveBeenCalled();
  expect(global.fetch).not.toHaveBeenCalled();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
it('previews and downloads the same generated Blob and revokes it when text changes',async()=>{
  const {book}=coverClientFixture(),blob=new Blob(['personal-pdf'],{type:'application/pdf'});
  jest.mocked(createPersonalizedCoverBlob).mockResolvedValue(blob);
  const storage=jest.spyOn(Storage.prototype,'setItem');
  try {
    const {unmount}=render(<Editor book={book} profileId="album-a5"/>);
    ownTitle('Личный заголовок Łódź');
    await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'coverGenerate'}));});
    expect(createPersonalizedCoverBlob).toHaveBeenCalledWith(expect.objectContaining({book,profileId:'album-a5',mode:'read',text:'Личный заголовок Łódź'}));
    const url=jest.mocked(URL.createObjectURL).mock.results[0].value;
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    fireEvent.click(screen.getByRole('button',{name:'coverPreviewPdf'}));
    expect(openWebWindow).toHaveBeenCalledWith(url,{windowFeatures:'noopener,noreferrer'});
    fireEvent.click(screen.getByRole('button',{name:'coverDownloadPdf'}));
    expect(downloadBlobOnWeb).toHaveBeenCalledWith(blob,`${book.slug}-${book.revision}-album-a5-read-personal-cover.pdf`);
    expect(storage).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox'),{target:{value:'Другой заголовок'}});
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
    expect(screen.queryByRole('button',{name:'coverDownloadPdf'})).toBeNull();
    unmount();
  } finally {storage.mockRestore();}
});
it('discards an older generation after a profile change even when the producer ignores cancellation',async()=>{
  const {book}=coverClientFixture(),old=deferred<Blob>();
  jest.mocked(createPersonalizedCoverBlob).mockReturnValueOnce(old.promise);
  const {rerender}=render(<Editor book={book} profileId="pocket-150x100"/>);
  fireEvent.click(screen.getByRole('button',{name:'coverGenerate'}));
  const signal=jest.mocked(createPersonalizedCoverBlob).mock.calls[0][0].signal!;
  rerender(<Editor book={book} profileId="album-a5"/>);
  expect(signal.aborted).toBe(true);
  await act(async()=>{old.resolve(new Blob(['stale']));});
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(screen.queryByRole('button',{name:'coverDownloadPdf'})).toBeNull();
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'coverGenerate'}));});
  expect(jest.mocked(createPersonalizedCoverBlob).mock.calls[1][0].profileId).toBe('album-a5');
  expect(screen.getByRole('button',{name:'coverDownloadPdf'})).toBeTruthy();
  const url=jest.mocked(URL.createObjectURL).mock.results[0].value;
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'home-rings'}});
  expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
  expect(screen.queryByRole('button',{name:'coverDownloadPdf'})).toBeNull();
});
it('keeps the selected text and output on error/retry and never downloads a standard fallback',async()=>{
  const {book}=coverClientFixture();
  jest.mocked(createPersonalizedCoverBlob).mockRejectedValueOnce(new CoverTextError('COVER_TEXT_OVERFLOW'));
  render(<Editor book={book} profileId="album-a5"/>);
  ownTitle('Мой личный дневник');
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'print-shop'}});
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'coverGenerate'}));});
  expect(screen.getByRole('alert').textContent).toBe('coverErrorOverflow');
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Мой личный дневник');
  expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('print-shop');
  expect(downloadBlobOnWeb).not.toHaveBeenCalled();
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'retry'}));});
  expect(jest.mocked(createPersonalizedCoverBlob).mock.calls[1][0]).toMatchObject({text:'Мой личный дневник',mode:'print-shop'});
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByRole('button',{name:'coverDownloadPdf'})).toBeTruthy();
});
it('aborts and revokes private state when the editor unmounts',async()=>{
  const {book}=coverClientFixture();
  const {unmount}=render(<Editor book={book} profileId="album-a5"/>);
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'coverGenerate'}));});
  const url=jest.mocked(URL.createObjectURL).mock.results[0].value;
  unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
});

it('releases the private PDF on cached-route blur without unmounting and returns without a stale result',async()=>{
  const {book}=coverClientFixture();
  const {rerender}=render(<Editor book={book} profileId="album-a5"/>);
  ownTitle('Личный текст до ухода');
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'print-shop'}});
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'coverGenerate'}));});
  const section=screen.getByRole('heading',{name:'coverEditorTitle'}).closest('section');
  const url=jest.mocked(URL.createObjectURL).mock.results[0].value;
  mockBookFocused=false;
  rerender(<Editor book={book} profileId="album-a5"/>);
  expect(screen.getByRole('heading',{name:'coverEditorTitle'}).closest('section')).toBe(section);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
  expect(screen.queryByRole('button',{name:'coverDownloadPdf'})).toBeNull();
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
  expect((screen.getByRole('radio',{name:'coverOwnText'}) as HTMLInputElement).checked).toBe(true);
  expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('print-shop');
  mockBookFocused=true;
  rerender(<Editor book={book} profileId="album-a5"/>);
  expect(screen.queryByRole('button',{name:'coverDownloadPdf'})).toBeNull();
  expect(screen.queryByRole('button',{name:'coverPreviewPdf'})).toBeNull();
  expect(screen.queryByText('coverReady')).toBeNull();
  expect(createPersonalizedCoverBlob).toHaveBeenCalledTimes(1);
});
it('aborts on blur and ignores its late completion after a new generation starts on the retained screen',async()=>{
  const {book}=coverClientFixture(),old=deferred<Blob>(),fresh=deferred<Blob>();
  jest.mocked(createPersonalizedCoverBlob).mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
  const {rerender}=render(<Editor book={book} profileId="album-a5"/>);
  ownTitle('Старая личная надпись');
  fireEvent.click(screen.getByRole('button',{name:'coverGenerate'}));
  const oldSignal=jest.mocked(createPersonalizedCoverBlob).mock.calls[0][0].signal!;
  mockBookFocused=false;
  rerender(<Editor book={book} profileId="album-a5"/>);
  expect(oldSignal.aborted).toBe(true);
  mockBookFocused=true;
  rerender(<Editor book={book} profileId="album-a5"/>);
  ownTitle('Новая надпись после возвращения');
  fireEvent.click(screen.getByRole('button',{name:'coverGenerate'}));
  const freshSignal=jest.mocked(createPersonalizedCoverBlob).mock.calls[1][0].signal!;
  await act(async()=>{old.resolve(new Blob(['obsolete-pdf']));});
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(freshSignal.aborted).toBe(false);
  expect((screen.getByRole('button',{name:'coverGenerating'}) as HTMLButtonElement).disabled).toBe(true);
  const freshBlob=new Blob(['fresh-private-pdf'],{type:'application/pdf'});
  await act(async()=>{fresh.resolve(freshBlob);});
  expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  expect(URL.createObjectURL).toHaveBeenCalledWith(freshBlob);
  fireEvent.click(screen.getByRole('button',{name:'coverDownloadPdf'}));
  expect(downloadBlobOnWeb).toHaveBeenCalledWith(freshBlob,`${book.slug}-${book.revision}-album-a5-read-personal-cover.pdf`);
});
it('keeps the draft during focused edits, profile changes and retries without rerunning route cleanup',async()=>{
  const {book}=coverClientFixture();
  const {rerender}=render(<Editor book={book} profileId="pocket-150x100"/>);
  ownTitle('Черновик остаётся на текущей странице');
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Черновик остаётся на текущей странице');
  rerender(<Editor book={book} profileId="album-a5"/>);
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Черновик остаётся на текущей странице');
  jest.mocked(createPersonalizedCoverBlob).mockRejectedValueOnce(new CoverTextError('COVER_TEXT_OVERFLOW'));
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'coverGenerate'}));});
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Черновик остаётся на текущей странице');
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'retry'}));});
  expect(jest.mocked(createPersonalizedCoverBlob).mock.calls[1][0]).toMatchObject({text:'Черновик остаётся на текущей странице',profileId:'album-a5'});
});
