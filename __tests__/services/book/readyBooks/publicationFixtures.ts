import {buildReadyBookPagePlan} from '../../../../services/book/readyBooks/composition';
import {publishedBookSchema} from '@/services/book/readyBooks/publication';
import {makeReadyBook} from './fixtures';
import {coverTextGeometry,imposedCoverTextGeometry} from '@/services/book/readyBooks/render/coverGeometry';
import {buildImpositionPlan} from '@/services/book/readyBooks/imposition';
import coverCopy from '../../../../data/travelBooks/cover-copy.json';
export function publishedFixture(stopCount=30){
  const full=makeReadyBook(stopCount);
  const destinations=buildReadyBookPagePlan(full).filter(page=>page.kind==='destination');
  const artifacts=full.artifacts.filter(a=>['read','home-rings','home-sewn','print-shop'].includes(a.purpose)).map(({id,revision,profileId,purpose,component,uri,mime,sha256,bytes,pageCount})=>({id,revision,profileId,purpose,component,uri,mime,sha256,bytes,pageCount}));
  const controls=artifacts.filter(a=>a.purpose==='home-rings'||a.purpose==='home-sewn').map(a=>({...a,id:a.id+'.control',purpose:'control',controlFor:a.purpose,uri:a.uri.replace(/\.pdf$/,'.control.pdf'),pageCount:4}));
  const coverResource=(filename:string,mime:string)=>({uri:`https://metravel.by/travel-books/${full.id}/${full.revision}/${filename}`,sha256:'a'.repeat(64),bytes:100,mime});
  const coverPersonalization={...coverCopy,font:{...coverResource('fonts/MarckScript-Regular.ttf','font/ttf'),license:coverResource('fonts/OFL.txt','text/plain')},templates:(['pocket-150x100','album-a5'] as const).flatMap(profileId=>(['read','print-shop','home-rings'] as const).map(mode=>{
    const profile={id:profileId,widthMm:profileId==='album-a5'?148:150,heightMm:profileId==='album-a5'?210:100,bleedMm:mode==='print-shop'?3:0,safeMm:5,bindingMm:15,binding:'rings' as const};
    return {...coverResource(`${profileId}/template-${mode}-cover.pdf`,'application/pdf'),profileId,mode,pageCount:mode==='home-rings'?2:4,...(mode==='home-rings'?imposedCoverTextGeometry(profile,buildImpositionPlan({profileId,mode,component:'cover',pageCount:4})):coverTextGeometry(profile))};
  }))};
  return publishedBookSchema.parse({id:full.id,slug:full.slug,title:full.title,country:full.country,revision:full.revision,contentLocale:'ru',status:'partial',layoutVersion:2,coverPersonalization,bodyPageCount:full.bodyPageCount,coverPageCount:4,stopCount:full.stops.length,quality:['pocket-150x100','album-a5'].map(profileId=>({profileId,printReady:false,minIllustrationPpi:181,physicalChecks:['image-resolution','provider-acceptance','paper-check']})),coverUri:full.preview[0].pages[0].uri,
    missing:['stickers','instructions','print-passport','provider-acceptance','paper-check'],
    stops:full.stops.map((s,i)=>({id:s.id,title:s.title,page:destinations[i].number,sourceUrl:s.navigation!.articleUrl,pointId:s.navigation!.pointId,sourceTravelId:s.navigation!.sourceTravelId,authorId:1})),
    profiles:['pocket-150x100','album-a5'].map(id=>full.artifacts.find(a=>a.profileId===id&&a.purpose==='read')!.printProfile),
    artifacts:[...artifacts,...controls],preview:full.preview});
}
