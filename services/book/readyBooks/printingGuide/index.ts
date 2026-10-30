import copy from '../../../../data/travelBooks/instructions/ru.json';
import {BOOK_PROFILES} from '../../../../data/travelBooks/profiles';
import {buildImpositionPlan} from '../imposition';
import type {PublishedBook,PublishedArtifact} from '../publication';

/** The browser and the printed guide use exactly the same download names. */
export function bookArtifactFilename(book:Pick<PublishedBook,'slug'|'revision'>,file:Pick<PublishedArtifact,'id'>){
  return `${book.slug}-${book.revision}-${file.id}.pdf`;
}
export function buildPrintGuide(book:PublishedBook,profileId:PublishedArtifact['profileId']){
  const profile=book.profiles.find(item=>item.id===profileId);
  if(!profile)throw new Error('Guide profile is absent');
  const rings=buildImpositionPlan({profileId,mode:'home-rings',pageCount:book.bodyPageCount});
  const sewn=profileId==='album-a5'?buildImpositionPlan({profileId,mode:'home-sewn',pageCount:book.bodyPageCount}):null;
  const files=book.artifacts.filter(file=>file.profileId===profileId);
  const entries=files.filter(file=>!['instructions','print-passport'].includes(file.purpose)).map(file=>({id:file.id,purpose:file.purpose,component:file.component,name:bookArtifactFilename(book,file),sha256:file.sha256,pageCount:file.pageCount,bytes:file.bytes}));
  const shop=files.filter(file=>file.purpose==='print-shop');
  if(shop.length!==2||!files.some(file=>file.purpose==='home-rings'&&file.component==='body'))throw new Error('Guide needs the exact print packages');
  return {revision:book.revision,bookId:book.id,bookProfileId:profileId,locale:'ru' as const,title:copy.title,bookTitle:book.title,
    labels:copy.labels,
    passportSummary:`${profile.widthMm} × ${profile.heightMm} мм после обреза; вылеты 3 мм; безопасное поле ${profile.safeMm} мм; крепление ${profile.bindingMm} мм. RGB; ICC и PDF/X не подтверждены. Приём точных файлов типографией и бумажная проба не выполнены.`,
    sourceNote:`Проверено: ${copy.checkedAt}. Источники настроек и ограничений приведены в PDF-инструкции; руководство вашего принтера имеет приоритет.`,
    controlMm:50,toleranceMm:1,scale:1,checkedAt:copy.checkedAt,
    summary:`${book.stopCount} мест; ${book.bodyPageCount} страниц блока; 4 стороны обложки. Формат ${profile.widthMm} × ${profile.heightMm} мм. Блок на кольцах: ${rings.sheets.length} листов A4 с двух сторон; обложка: 1 лист A4 с двух сторон.`,
    assembly:`A4 ${rings.sheetMm[0]} × ${rings.sheetMm[1]} мм; переворот по ${rings.duplexFlip==='long-edge'?'длинной':'короткой'} стороне. Сначала проверить контрольный лист именно этого файла.`,
    signatures:sewn?.signatures??[],
    sewnNote:sewn?`Прошивка: ${sewn.sheets.length} листов A4; тетради ${sewn.signatures!.join(' + ')} страниц. Крепление обложки ещё не проверено.`:'Прошивка компактного формата на A4 не поддерживается.',
    photoMm:BOOK_PROFILES[profileId].photoMm,entries,
    sections:copy.sections.filter(section=>section.id!=='sewn'||sewn),polishNote:copy.polishNote,sources:copy.sources,
    passport:{widthMm:profile.widthMm,heightMm:profile.heightMm,bleedMm:3,safeMm:profile.safeMm,bindingMm:profile.bindingMm,
      binding:profile.binding,colorSpace:'RGB',iccStatus:'не подтверждён',pdfXStatus:'не подтверждён',providerProfileId:null,
      printReady:false,checkedAt:copy.checkedAt,
      minIllustrationPpi:book.quality.find(item=>item.profileId===profileId)!.minIllustrationPpi,
      files:shop.map(file=>({name:bookArtifactFilename(book,file),sha256:file.sha256,bytes:file.bytes,pageCount:file.pageCount}))}};
}
export type PrintGuide=ReturnType<typeof buildPrintGuide>;
