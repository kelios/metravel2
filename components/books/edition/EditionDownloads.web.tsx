import React,{useId} from 'react';
import {bookArtifactFilename} from '@/services/book/readyBooks/artifactFilename';
import type {PublishedArtifact,PublishedBook} from '@/services/book/readyBooks/publication';
import {useBookCopy,type bookT} from '../bookCopy';
import {describeArtifact,formatArtifactSize,visibleArtifacts} from '../bookArtifacts';
import {EditionAccordion,EditionIcon} from './EditionParts.web';
import {pageCountPhrase,sheetCountPhrase} from './editionModel';

type T = typeof bookT;
type Group = {key:string;title:Parameters<T>[0];hint:Parameters<T>[0];files:PublishedArtifact[];notes:string[]};

/** Imposed A4 packages count physical sheets; every other PDF counts book pages. */
const isImposed=(file:PublishedArtifact)=>file.purpose==='home-rings'||file.purpose==='home-sewn'||file.purpose==='stickers';
const fileFacts=(file:PublishedArtifact,t:T)=>['PDF',isImposed(file)?sheetCountPhrase(file.pageCount,t):pageCountPhrase(file.pageCount,t),formatArtifactSize(file.bytes,t)].join(' · ');

function fileLabel(file:PublishedArtifact,t:T,bothAssemblies:boolean){
  if(file.purpose==='control'){
    const label=t(file.component==='cover'?'controlCover':'controlBody');
    return bothAssemblies&&file.controlFor?`${label} · ${t(file.controlFor==='home-sewn'?'sewn':'rings')}`:label;
  }
  if(file.purpose==='print-passport')return t('passport');
  if(file.purpose==='instructions')return t('instructions');
  return t(file.component==='cover'?'cover':'body');
}

/**
 * «Скачать». Every published file of the selected size appears exactly once (after the #2944
 * de-duplication) as a plain `<a download>` (#2951): reading pages and their cover up front,
 * stickers beside them, and the print packages inside «Файлы для печати».
 */
export default function EditionDownloads({book,profileId,details,coverUri,version,onRequested,sectionId,printSectionId}:{
  book:PublishedBook;profileId:PublishedArtifact['profileId'];details:string;coverUri?:string;version?:string;
  onRequested:(file:PublishedArtifact)=>void;sectionId:string;printSectionId:string;
}){
  const t=useBookCopy();
  const id=useId();
  const files=visibleArtifacts(book,profileId);
  const all=book.artifacts.filter(file=>file.profileId===profileId);
  const find=(purpose:PublishedArtifact['purpose'],component:PublishedArtifact['component'])=>files.find(file=>file.purpose===purpose&&file.component===component);
  const body=find('read','body');
  const cover=find('read','cover');
  const stickers=files.filter(file=>file.purpose==='stickers');
  const deduplicated=(component:'body'|'cover')=>all.some(file=>file.purpose==='print-shop'&&file.component===component)&&!find('print-shop',component);
  const controls=files.filter(file=>file.purpose==='control');
  const bothAssemblies=new Set(controls.map(file=>file.controlFor)).size>1;
  const groups:Group[]=[
    {key:'shop',title:'groupShop',hint:'groupShopHint',files:files.filter(file=>file.purpose==='print-shop'||file.purpose==='print-passport'||file.purpose==='instructions'),
      notes:[deduplicated('body')&&t('groupShopSameBody'),deduplicated('cover')&&t('groupShopSameCover')].filter((note):note is string=>Boolean(note))},
    {key:'rings',title:'groupRings',hint:'groupRingsHint',files:files.filter(file=>file.purpose==='home-rings'),notes:[]},
    {key:'sewn',title:'groupSewn',hint:'groupSewnHint',files:files.filter(file=>file.purpose==='home-sewn'),notes:[]},
    {key:'control',title:'groupControl',hint:'groupControlHint',files:controls,notes:[]},
  ].filter(group=>group.files.length>0||group.notes.length>0) as Group[];
  const link=(file:PublishedArtifact,label:string,className:string,icon=true)=><a key={file.id} className={className} href={file.uri} download={bookArtifactFilename(book,file)}
    aria-label={`${t('download')}: ${describeArtifact(file,t)}`} onClick={()=>onRequested(file)}>{icon&&<EditionIcon name="download"/>}{label}</a>;
  return <section className="rbe-block" id={sectionId} aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>{t('downloads')}</h2>
    <p className="rbe-lead">{t('downloadLead',{details})}</p>
    {body&&<div className="rbe-dl-main">
      <div className="rbe-dl-thumb">{coverUri&&<img src={coverUri} alt="" loading="lazy" decoding="async"/>}</div>
      <div><h3>{t('fileWhole')}</h3><p className="rbe-small">{fileFacts(body,t)} · {t('fileWholeHint')}</p></div>
      {link(body,t('ctaDownload'),'rbe-btn rbe-btn-primary')}
    </div>}
    {(cover||stickers.length>0)&&<div className="rbe-dl-row">
      {cover&&<div className="rbe-dl-card">
        <div className="rbe-dl-thumb rbe-dl-thumb-sm">{coverUri&&<img src={coverUri} alt="" loading="lazy" decoding="async"/>}</div>
        <div className="rbe-grow"><h3>{t('cover')}</h3><p className="rbe-small">{fileFacts(cover,t)}</p></div>
        <div className="rbe-dl-acts">{link(cover,t('downloadCover'),'rbe-btn rbe-btn-secondary rbe-btn-sm')}</div>
      </div>}
      {stickers.length>0&&<div className="rbe-dl-card">
        <div className="rbe-dl-thumb rbe-dl-thumb-sm rbe-dl-thumb-icon"><EditionIcon name="tag" size={28}/></div>
        <div className="rbe-grow"><h3>{t('fileStickers')}</h3><p className="rbe-small">{[t(book.kind==='quests'?'fileStickersQuestHint':'fileStickersHint'),`${sheetCountPhrase(stickers[0].pageCount,t)} A4`,formatArtifactSize(stickers[0].bytes,t)].join(' · ')}</p></div>
        <div className="rbe-dl-acts">{stickers.map(file=>link(file,t(file.variant==='no-background'?'noBackground':'color'),'rbe-btn rbe-btn-secondary rbe-btn-sm',false))}</div>
      </div>}
    </div>}
    {groups.length>0&&<section className="rbe-dl-print" id={printSectionId} tabIndex={-1} aria-labelledby={`${id}-print-title`}>
      <h3 id={`${id}-print-title`}>{t('printFiles')}</h3>
      <p className="rbe-small">{t('printNotCertified')}</p>
      {groups.map(group=><EditionAccordion key={group.key} icon="printer" title={t(group.title)} hint={t(group.hint)}>
        <div className="rbe-files-group">
        {group.notes.map(note=><p key={note} className="rbe-small">{note}</p>)}
        {group.files.length>0&&<ul className="rbe-files">{group.files.map(file=><li key={file.id}>
          <span><b>{fileLabel(file,t,bothAssemblies)}</b> · {fileFacts(file,t)}</span>
          {link(file,t('download'),'rbe-btn rbe-btn-secondary rbe-btn-sm',false)}
        </li>)}</ul>}
        </div>
      </EditionAccordion>)}
    </section>}
    {version&&<p className="rbe-small rbe-version">{version}</p>}
  </section>;
}
