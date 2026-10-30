import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {coverTextGeometry, imposedCoverTextGeometry} from '@/services/book/readyBooks/render/coverGeometry';
import {buildImpositionPlan} from '@/services/book/readyBooks/imposition';
import {publishedBookSchema} from '@/services/book/readyBooks/publication';
import {publishedFixture} from './publicationFixtures';
import coverCopy from '../../../../data/travelBooks/cover-copy.json';
import {renderCoverPage} from '@/services/book/readyBooks/render/cover';
import type {ReadyBookRenderInput} from '@/services/book/readyBooks/render';

describe('cover producer physical contract',()=>{
  it.each(['pocket-150x100','album-a5'] as const)('derives %s quote boxes from the actual native/bleed/A4 geometry',id=>{
    const pocket=id==='pocket-150x100';
    const profile={id,widthMm:pocket?150:148,heightMm:pocket?100:210,bleedMm:0,safeMm:5,bindingMm:15,binding:'rings' as const};
    const native=coverTextGeometry(profile),shop=coverTextGeometry({...profile,bleedMm:3});
    expect(native.textRegion).toMatchObject({pageIndex:0,xMm:15,yMm:pocket?8:15,widthMm:pocket?120:118,heightMm:pocket?28:47,maxFontSizePt:pocket?20:31,minFontSizePt:pocket?12:16,lineHeight:1.18});
    expect(shop.widthMm).toBe(native.widthMm+6);expect(shop.heightMm).toBe(native.heightMm+6);
    expect(shop.textRegion.xMm).toBe(native.textRegion.xMm+3);expect(shop.textRegion.yMm).toBe(native.textRegion.yMm+3);
    const plan=buildImpositionPlan({profileId:id,mode:'home-rings',component:'cover',pageCount:4});
    const home=imposedCoverTextGeometry(profile,plan),front=plan.sheets[0].front.find(p=>p.folio===1)!;
    expect(home.textRegion.xMm).toBe(front.xMm+native.textRegion.xMm);
    expect(home.textRegion.yMm).toBe(plan.sheetMm[1]-front.yMm-profile.heightMm+native.textRegion.yMm);
    expect(()=>imposedCoverTextGeometry(profile,{...plan,scale:2} as unknown as typeof plan)).toThrow('canonical');
  });

  it('publishes exactly six honest, revision-bound template descriptors and keeps old editions readable',()=>{
    const book=publishedFixture();expect(book.coverPersonalization?.templates).toHaveLength(6);
    const old={...book};delete old.coverPersonalization;expect(publishedBookSchema.safeParse(old).success).toBe(true);
    for(const mutate of [
      (b:typeof book)=>{b.coverPersonalization!.templates.pop();},
      (b:typeof book)=>{b.coverPersonalization!.templates[0].widthMm=999;},
      (b:typeof book)=>{b.coverPersonalization!.templates[0].textRegion.xMm=999;},
      (b:typeof book)=>{b.coverPersonalization!.templates[0].uri='https://other.invalid/template.pdf';},
      (b:typeof book)=>{b.coverPersonalization!.font.uri=b.coverPersonalization!.font.uri.replace('/'+b.revision+'/','/other/');},
      (b:typeof book)=>{b.coverPersonalization!.font.bytes=3*1024*1024;},
    ]){const invalid=publishedFixture();mutate(invalid);expect(publishedBookSchema.safeParse(invalid).success).toBe(false);}
  });

  it('retains both exact owner presets, the full licensed Marck font and no discarded cover phrase',()=>{
    expect(coverCopy).toEqual({schemaVersion:1,maxCharacters:120,defaultPresetId:'home-memories',presets:[{id:'home-memories',text:'Хорошо, когда есть куда вернуться. Прекрасно, когда есть что вспомнить'},{id:'world-memories',text:'Однажды мы выйдем за порог — и принесём домой целый мир воспоминаний'}]});
    const font=fs.readFileSync('data/travelBooks/assets/fonts/marckscript/MarckScript-Regular.ttf');
    expect(createHash('sha256').update(font).digest('hex')).toBe('504de8cc6f919163bc9afb67b9bc208d258230c5e8d00cb82ec52474f9fafc3b');
    expect(fs.readFileSync('data/travelBooks/assets/fonts/marckscript/OFL.txt','utf8')).toContain('SIL OPEN FONT LICENSE Version 1.1');
  });

  it('renders a genuinely clean artwork template before the shared PDF engine adds any preset',()=>{
    const book=publishedFixture(31);
    const input={book,profile:book.profiles[0],cover:{dataUri:'data:image/png;base64,aGVsbG8=',widthPx:1054,heightPx:1492}} as unknown as ReadyBookRenderInput;
    const front=renderCoverPage(input,1);
    expect(front).toContain('Беларусь');expect(front).toContain('31 мест');
    for(const preset of coverCopy.presets)expect(front).not.toContain(preset.text);
    expect(front).not.toContain('Уютная норка');expect(front).not.toContain(book.title);
    expect(front).toContain('cover-quote-space');expect(front).not.toContain('<script');
  });
});
