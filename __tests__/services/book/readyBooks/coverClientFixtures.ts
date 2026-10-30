import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {coverPersonalizationSchema} from '@/services/book/readyBooks/publication';
import {coverTextGeometry,imposedCoverTextGeometry} from '@/services/book/readyBooks/render/coverGeometry';
import {buildImpositionPlan} from '@/services/book/readyBooks/imposition';
import coverCopy from '@/data/travelBooks/cover-copy.json';
import {publishedFixture} from './publicationFixtures';

// Isolated client-contract fixtures. Fake template bytes never claim print readiness;
// the separate core suite parses real PDFs with the same full Marck source font.
export function coverClientFixture() {
  const book=publishedFixture();
  const contents=new Map<string,Uint8Array>();
  const resource=(relative:string,data:Uint8Array,mime:string)=>{
    const uri=`https://metravel.by/travel-books/${book.id}/${book.revision}/${relative}`;
    contents.set(uri,data);
    return {uri,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex'),mime};
  };
  const font=resource('fonts/MarckScript-Regular.ttf',new Uint8Array(readFileSync('data/travelBooks/assets/fonts/marckscript/MarckScript-Regular.ttf')),'font/ttf');
  const license=resource('fonts/OFL.txt',new Uint8Array(readFileSync('data/travelBooks/assets/fonts/marckscript/OFL.txt')),'text/plain');
  const templates=book.profiles.flatMap(profile=>(['read','print-shop','home-rings'] as const).map(mode=>{
    const prepared={...profile,bleedMm:mode==='print-shop'?3:0};
    const geometry=mode==='home-rings'?imposedCoverTextGeometry(prepared,buildImpositionPlan({profileId:profile.id,mode:'home-rings',component:'cover',pageCount:4})):coverTextGeometry(prepared);
    return {...resource(`${profile.id}/template-${mode}-cover.pdf`,new Uint8Array(Buffer.from('%PDF-isolated-client-fixture-'+profile.id+'-'+mode)),'application/pdf'),profileId:profile.id,mode,pageCount:mode==='home-rings'?2:4,...geometry};
  }));
  book.coverPersonalization=coverPersonalizationSchema.parse({...coverCopy,font:{...font,license},templates});
  return {book,contents};
}
