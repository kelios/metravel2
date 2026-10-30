import {publishedFixture} from './publicationFixtures';
import {publishedBookSchema} from '@/services/book/readyBooks/publication';
import {bookPreview,previewWindow} from '@/services/book/readyBooks/preview';
import {fetchBookArtifact} from '@/services/book/readyBooks/download';
import {fixturePdf,fixtureHash} from './fixtures';

describe('partial publication integrity',()=>{
  it('keeps historical front-map revisions valid while enforcing the new end-map version',()=>{
    const current=publishedFixture(31);
    expect(current.layoutVersion).toBe(2);
    expect(current.stops[0].page).toBe(8);
    const legacy:Record<string,unknown>={...current,stops:current.stops.map(stop=>({...stop,page:stop.page+1}))};
    delete legacy.layoutVersion;
    expect(publishedBookSchema.parse(legacy).layoutVersion).toBe(1);
    expect(publishedBookSchema.safeParse({...legacy,layoutVersion:2}).success).toBe(false);
  });
  it('rejects prototype counts and false physical quality claims',()=>{const book=publishedFixture();Object.assign(book,{stopCount:12,bodyPageCount:56});expect(publishedBookSchema.safeParse(book).success).toBe(false);const quality=publishedFixture();quality.quality[0].physicalChecks=['provider-acceptance','paper-check'];expect(publishedBookSchema.safeParse(quality).success).toBe(false);});

  it('keeps partial status and requires both complete core physical packages',()=>{
    const book=publishedFixture();expect(book.status).toBe('partial');
    book.artifacts.pop();expect(publishedBookSchema.safeParse(book).success).toBe(false);
  });
  it('requires one labelled control for each exact assembly mode and component',()=>{
    const book=publishedFixture();const controls=book.artifacts.filter(a=>a.profileId==='album-a5'&&a.purpose==='control');
    expect(controls.map(a=>[a.controlFor,a.component])).toEqual([['home-rings','body'],['home-rings','cover'],['home-sewn','body']]);
    for(const mutate of [(b:ReturnType<typeof publishedFixture>)=>{b.artifacts.find(a=>a.purpose==='control')!.controlFor=undefined;},(b:ReturnType<typeof publishedFixture>)=>{b.artifacts.find(a=>a.purpose==='control')!.component='cover';},(b:ReturnType<typeof publishedFixture>)=>{b.artifacts.find(a=>a.purpose==='read')!.controlFor='home-rings';}]){const invalid=publishedFixture();mutate(invalid);expect(publishedBookSchema.safeParse(invalid).success).toBe(false);}
  });
  it('rejects mixed preview source, revisions and incomplete folios',()=>{
    for(const change of [(b:ReturnType<typeof publishedFixture>)=>{b.preview[0].sourceSha256='a'.repeat(64);},(b:ReturnType<typeof publishedFixture>)=>{b.artifacts[0].revision='old';},(b:ReturnType<typeof publishedFixture>)=>{b.preview[0].pages.pop();}]){
      const book=publishedFixture();change(book);expect(publishedBookSchema.safeParse(book).success).toBe(false);
    }
    const book=publishedFixture();book.preview[0].revision='old';expect(()=>bookPreview(book,'pocket-150x100','body')).toThrow();
  });
  it.each([
    [1,true,56,[1]], [6,true,56,[6,7]], [51,true,56,[50,51]],
    [56,true,56,[56]], [51,false,56,[51]],
    [93,true,93,[92,93]], [94,true,94,[94]], [1000,true,93,[92,93]],
    [0,true,94,[1]], [7,true,0,[]], [7,true,3.5,[]],
  ] as const)('loads the exact preview window for page %s, spread %s, total %s',(page,spread,total,expected)=>{
    expect(previewWindow(page,spread,total)).toEqual(expected);
  });
  it('rejects 404, wrong byte count and wrong hash without authenticating',async()=>{
    const original=global.fetch;
    const file={...publishedFixture().artifacts[0],bytes:fixturePdf.length,sha256:fixtureHash};
    const data=Uint8Array.from(fixturePdf).buffer;
    Object.defineProperty(global.crypto,'subtle',{configurable:true,value:{digest:jest.fn()}});
    const digest=jest.spyOn(crypto.subtle,'digest').mockResolvedValue(Uint8Array.from(Buffer.from(fixtureHash,'hex')).buffer);
    try{
      global.fetch=jest.fn().mockResolvedValue({ok:false,status:404});await expect(fetchBookArtifact(file)).rejects.toThrow('404');
      global.fetch=jest.fn().mockResolvedValue({ok:true,arrayBuffer:async()=>data});
      await expect(fetchBookArtifact({...file,bytes:file.bytes+1})).rejects.toThrow('SIZE');
      await expect(fetchBookArtifact({...file,sha256:'0'.repeat(64)})).rejects.toThrow('HASH');
      await expect(fetchBookArtifact(file)).resolves.toBeInstanceOf(Blob);
      expect(global.fetch).toHaveBeenLastCalledWith(file.uri,{credentials:'omit',signal:undefined});
    }finally{global.fetch=original;digest.mockRestore();}
  });
});
