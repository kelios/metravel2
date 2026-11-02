import copy from '../../../../data/travelBooks/instructions/ru.json';
import {BOOK_PROFILES} from '../../../../data/travelBooks/profiles';
import {buildImpositionPlan} from '../imposition';
import {countRu,PAGES,PLACES,SHEETS} from '../render/counts';
import type {PublishedBook,PublishedArtifact} from '../publication';

import {bookArtifactFilename} from '../artifactFilename';
export {bookArtifactFilename} from '../artifactFilename';

const BINDING={rings:'кольца',spiral:'пружина',sewn:'прошивка'} as const;

/**
 * HTML download names are keyed by artifact kind, not id: augment-publication builds this model
 * before the guide's own instructions/passport PDFs exist, then renders HTML that links them too.
 */
export const guideDownloadKey=(file:Pick<PublishedArtifact,'purpose'|'component'|'variant'|'controlFor'>)=>
  [file.purpose,file.component,file.variant,file.controlFor].filter(Boolean).join(':');

export function buildPrintGuide(book:PublishedBook,profileId:PublishedArtifact['profileId']){
  const profile=book.profiles.find(item=>item.id===profileId);
  if(!profile)throw new Error('Guide profile is absent');
  const rings=buildImpositionPlan({profileId,mode:'home-rings',pageCount:book.bodyPageCount});
  const sewn=profileId==='album-a5'?buildImpositionPlan({profileId,mode:'home-sewn',pageCount:book.bodyPageCount}):null;
  const files=book.artifacts.filter(file=>file.profileId===profileId);
  const entries=files.filter(file=>!['instructions','print-passport'].includes(file.purpose)).map(file=>({id:file.id,purpose:file.purpose,component:file.component,name:bookArtifactFilename(book,file),sha256:file.sha256,pageCount:file.pageCount,bytes:file.bytes}));
  const guideDocuments=[{profileId,purpose:'instructions',component:'instructions'},{profileId,purpose:'print-passport',component:'passport'}] as const;
  const downloadNames=Object.fromEntries([...files,...guideDocuments].map(file=>[guideDownloadKey(file),bookArtifactFilename(book,file)]));
  const shop=files.filter(file=>file.purpose==='print-shop');
  if(shop.length!==2||!files.some(file=>file.purpose==='home-rings'&&file.component==='body'))throw new Error('Guide needs the exact print packages');
  return {revision:book.revision,bookId:book.id,bookProfileId:profileId,locale:'ru' as const,title:copy.title,bookTitle:book.title,
    labels:copy.labels,
    passportSummary:`${profile.widthMm} × ${profile.heightMm} мм после обреза; вылеты 3 мм; безопасное поле ${profile.safeMm} мм; крепление ${profile.bindingMm} мм. Цвет RGB.`,
    sourceNote:`Проверено: ${copy.checkedAt}. Источники настроек и ограничений приведены в PDF-инструкции; руководство вашего принтера имеет приоритет.`,
    controlMm:50,toleranceMm:1,scale:1,checkedAt:copy.checkedAt,
    summary:`${countRu(book.stopCount,PLACES)}; ${countRu(book.bodyPageCount,PAGES)} в книге; 4 стороны обложки. Формат ${profile.widthMm} × ${profile.heightMm} мм. Страницы на кольцах: ${countRu(rings.sheets.length,SHEETS)} A4 с двух сторон; обложка: 1 лист A4 с двух сторон.`,
    assembly:`A4 ${rings.sheetMm[0]} × ${rings.sheetMm[1]} мм; переворот по ${rings.duplexFlip==='long-edge'?'длинной':'короткой'} стороне. Сначала проверить контрольный лист именно этого файла.`,
    signatures:sewn?.signatures??[],
    sewnNote:sewn?`Прошивка: ${countRu(sewn.sheets.length,SHEETS)} A4; тетради по ${sewn.signatures!.join(' + ')} страниц.`:'Компактный формат на A4 не прошивается — используйте кольца.',
    photoMm:BOOK_PROFILES[profileId].photoMm,entries,downloadNames,
    sections:copy.sections.filter(section=>section.id!=='sewn'||sewn),polishNote:copy.polishNote,sources:copy.sources,
    passport:{widthMm:profile.widthMm,heightMm:profile.heightMm,bleedMm:3,safeMm:profile.safeMm,bindingMm:profile.bindingMm,
      binding:BINDING[profile.binding],colorSpace:'RGB',iccStatus:'не подтверждён',pdfXStatus:'не подтверждён',providerProfileId:null,
      printReady:false,checkedAt:copy.checkedAt,
      minIllustrationPpi:book.quality.find(item=>item.profileId===profileId)!.minIllustrationPpi,
      files:shop.map(file=>({name:bookArtifactFilename(book,file),sha256:file.sha256,bytes:file.bytes,pageCount:file.pageCount}))}};
}
export type PrintGuide=ReturnType<typeof buildPrintGuide>;
