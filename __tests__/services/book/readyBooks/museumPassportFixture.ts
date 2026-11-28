import type {MuseumPassport} from '@/data/travelBooks/schema/museumPassports';

const base='https://metravel.by/travel-books/test-museum-passport/test.1/';
const file=(name:string,mime:'application/pdf'|'image/webp')=>({uri:base+name,mime,bytes:200,sha256:'a'.repeat(64)});
export const museumPassportFixture=():MuseumPassport=>({
  id:'test-museum-passport',slug:'test-museum-passport',revision:'test.1',title:'Музейный паспорт Кракова',summary:'Музеи и наши впечатления',
  country:'PL',contentLocale:'ru',quality:{printReady:false,minIllustrationPpi:90},museumCount:13,logicalPageCount:8,bookletPageCount:4,stickersPageCount:1,
  museums:Array.from({length:13},(_,index)=>({number:index+1,title:`Muzeum ${index+1}`,page:3+Math.floor(index/4)})),
  read:file('read.pdf','application/pdf'),booklet:file('booklet-a3.pdf','application/pdf'),wrapCover:file('cover-a3.pdf','application/pdf'),stickers:file('stickers-a4.pdf','application/pdf'),
  cover:file('cover.webp','image/webp'),preview:file('preview.webp','image/webp'),
});
