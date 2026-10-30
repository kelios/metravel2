import {buildPrintGuide,bookArtifactFilename} from '@/services/book/readyBooks/printingGuide';
import {publishedFixture} from './publicationFixtures';
import {publishedBookSchema} from '@/services/book/readyBooks/publication';

describe('guide and supplemental publication',()=>{
  it.each([30,31,35])('derives paper counts and signatures from %s actual places',count=>{
    const book=publishedFixture(count);
    const a5=buildPrintGuide(book,'album-a5');
    expect(a5.signatures.reduce((n,size)=>n+size,0)).toBe(Math.ceil(book.bodyPageCount/4)*4);
    expect(a5.entries.every(file=>file.name===bookArtifactFilename(book,{id:file.id}))).toBe(true);
    expect(a5.passport.files).toHaveLength(2);
    expect(a5.passport.files[0].sha256).toBe(book.artifacts.find(a=>a.profileId==='album-a5'&&a.purpose==='print-shop')!.sha256);
    const pocket=buildPrintGuide(book,'pocket-150x100');
    expect(pocket.signatures).toEqual([]);
    expect(pocket.sections.some(s=>s.id==='sewn')).toBe(false);
    expect(pocket.photoMm).toEqual({width:100,height:70});
    expect(a5.photoMm).toEqual({width:108,height:158});
    expect(a5.sections.find(s=>s.id==='control')!.paragraphs.join(' ')).toContain('49–51');
  });
  function supplemented(){
    const book=publishedFixture();
    for(const profile of book.profiles){
      for(const [purpose,component,variant] of [['stickers','stickers','color'],['stickers','stickers','no-background'],['instructions','instructions',undefined],['print-passport','passport',undefined]] as const){
        const id=[profile.id,purpose,component,variant].filter(Boolean).join('.');
        book.artifacts.push({...book.artifacts[0],id,profileId:profile.id,purpose,component,...(variant?{variant}:{}),pageCount:2,outputPageMm:{width:210,height:297},uri:`https://metravel.by/travel-books/${book.id}/${book.revision}/${id}.pdf`});
      }
    }
    book.missing=['provider-acceptance','paper-check'];
    return book;
  }
  it('accepts a complete digital kit while retaining physical limits',()=>{
    const book=publishedBookSchema.parse(supplemented());
    expect(book.status).toBe('partial');expect(book.quality.every(q=>!q.printReady)).toBe(true);
  });
  it('rejects misleading missing lists, lost variants and incomplete profiles',()=>{
    for(const change of [(b:ReturnType<typeof supplemented>)=>b.artifacts.pop(),(b:ReturnType<typeof supplemented>)=>b.missing.push('stickers'),(b:ReturnType<typeof supplemented>)=>{b.artifacts.find(a=>a.variant==='color')!.variant='no-background';},(b:ReturnType<typeof supplemented>)=>{b.artifacts.find(a=>a.purpose==='instructions')!.component='body';}]){
      const book=supplemented();change(book);expect(publishedBookSchema.safeParse(book).success).toBe(false);
    }
  });
});
