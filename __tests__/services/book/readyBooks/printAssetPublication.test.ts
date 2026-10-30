import {publishedFixture} from './publicationFixtures';
import {publishedBookSchema} from '@/services/book/readyBooks/publication';
import {buildPrintGuide} from '@/services/book/readyBooks/printingGuide';
import {bookArtifactFilename} from '@/services/book/readyBooks/artifactFilename';
import {renderPrintGuideHtml} from '@/scripts/books/render-print-guide-html.mjs';

function resourceBook(){
  const book=publishedFixture();
  const base=`https://metravel.by/travel-books/${book.id}/${book.revision}`;
  book.printGuidePages=book.profiles.map(profile=>({profileId:profile.id,uri:`${base}/${profile.id}/instructions.html`,mime:'text/html' as const,bytes:100,sha256:'a'.repeat(64)}));
  book.printDirectory={uri:`${base}/providers.json`,mime:'application/json',bytes:100,sha256:'b'.repeat(64)};
  return book;
}

it('keeps legacy snapshots valid and requires a complete paired immutable resource set',()=>{
  expect(publishedBookSchema.safeParse(publishedFixture()).success).toBe(true);
  expect(publishedBookSchema.safeParse(resourceBook()).success).toBe(true);
  for(const change of [
    (book:ReturnType<typeof resourceBook>)=>{book.printDirectory=undefined;},
    (book:ReturnType<typeof resourceBook>)=>{book.printGuidePages![1].profileId=book.printGuidePages![0].profileId;},
    (book:ReturnType<typeof resourceBook>)=>{book.printGuidePages![0].uri=book.printGuidePages![0].uri.replace(book.revision,'another');},
    (book:ReturnType<typeof resourceBook>)=>{book.printDirectory!.uri=book.printDirectory!.uri.replace(book.id,'another-book');},
  ]){const book=resourceBook();change(book);expect(publishedBookSchema.safeParse(book).success).toBe(false);}
  const book=resourceBook();
  expect(publishedBookSchema.safeParse({...book,printDirectory:{...book.printDirectory,mime:'text/html'}}).success).toBe(false);
});

function guideBook(){
  const book=publishedFixture();
  book.artifacts=book.artifacts.map(file=>({...file,uri:`https://metravel.by/travel-books/${book.id}/${book.revision}/${file.profileId}/${file.id}.pdf`}));
  return book;
}

it('renders the full PDF model as an accessible document with the exact downloadable names',()=>{
  const book=guideBook(),guide=buildPrintGuide(book,'album-a5');
  const html=renderPrintGuideHtml(guide,{slug:book.slug,artifacts:book.artifacts});
  const doc=new DOMParser().parseFromString(html,'text/html');
  expect(doc.documentElement.lang).toBe('ru');
  expect(doc.head.firstElementChild?.getAttribute('charset')).toBe('utf-8');
  expect(doc.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain('noindex');
  expect(doc.querySelectorAll('script')).toHaveLength(0);
  for(const section of guide.sections)for(const text of [section.title,...section.paragraphs])expect(doc.body.textContent).toContain(text);
  expect(doc.querySelector('[lang="pl"]')?.textContent).toBe(guide.polishNote);
  const files=book.artifacts.filter(file=>file.profileId==='album-a5');
  expect([...doc.querySelectorAll('a[download]')].map(link=>link.getAttribute('download'))).toEqual(files.map(file=>bookArtifactFilename(book,file)));
  expect([...doc.querySelectorAll('a[download]')].map(link=>link.getAttribute('href'))).toEqual(files.map(file=>file.uri));
});

it('escapes editorial content and refuses links from another origin or revision',()=>{
  const book=guideBook(),guide=buildPrintGuide(book,'album-a5');
  guide.bookTitle='<script>alert(1)</script>';
  guide.sections=[{id:'escape',title:'<img src=x>',paragraphs:['<img src=x onerror=alert(1)>']}];
  const html=renderPrintGuideHtml(guide,{slug:book.slug,artifacts:book.artifacts});
  const doc=new DOMParser().parseFromString(html,'text/html');
  expect(doc.querySelectorAll('script,img')).toHaveLength(0);
  expect(doc.body.textContent).toContain('<script>alert(1)</script>');
  const selected=book.artifacts.filter(file=>file.profileId==='album-a5');
  expect(()=>renderPrintGuideHtml(guide,{slug:book.slug,artifacts:[{...selected[0],uri:'https://foreign.test/book.pdf'}]})).toThrow();
  expect(()=>renderPrintGuideHtml(guide,{slug:book.slug,artifacts:[{...selected[0],revision:'wrong'}]})).toThrow();
});
