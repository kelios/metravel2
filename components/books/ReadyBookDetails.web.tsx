import React,{useEffect,useRef,useState} from 'react';
import {Link} from 'expo-router';
import Button from '@/components/ui/Button';
import {bookStyleKey,hasPrintSupplements} from '@/services/book/readyBooks/publicationState';
import {useHydrationReady} from '@/hooks/useHydrationReady';
import {findReadyBook,readyBooks} from '@/services/book/readyBooks/catalog';
import {loadReadyBookMetadata} from '@/services/book/readyBooks/bookMetadata';
import type {PublishedBook,PublishedArtifact} from '@/services/book/readyBooks/publication';
import {fetchBookArtifact} from '@/services/book/readyBooks/download';
import {formatNumber,getActiveLocale} from '@/i18n';
import {trackReadyBookEvent} from '@/utils/growthFunnelAnalytics';
import {BooksFrame} from './BooksFrame';
import {formatReadyBookCounts,useBookCopy} from './bookCopy';
import ReadyBookPreview from './preview/ReadyBookPreview';
import PrintingGuide from './printingGuide/PrintingGuide.web';
import PrintProviders from './printProviders/PrintProviders.web';
import {bookArtifactFilename} from '@/services/book/readyBooks/artifactFilename';
import CoverPersonalizationEditor from './cover/CoverPersonalizationEditor.web';

const purposeKey={read:'read','home-rings':'rings','home-sewn':'sewn','print-shop':'shop',control:'control',stickers:'stickers',instructions:'instructions','print-passport':'passport'} as const;
const physicalCheckKey={'image-resolution':'resolutionPending','provider-acceptance':'providerAcceptance','paper-check':'paperCheck'} as const;
export default function ReadyBookDetails({slug,initialProfileId}:{slug:unknown;initialProfileId?:unknown}){
  const bookT=useBookCopy();
  const summary=findReadyBook(slug);
  const [loaded,setLoaded]=useState<{key:string;book?:PublishedBook;failed?:boolean}>();
  const [attempt,setAttempt]=useState(0);
  const key=summary?`${summary.id}:${summary.revision}:${summary.metadata.sha256}`:'';
  useEffect(()=>{
    if(!summary)return;
    const controller=new AbortController();
    setLoaded({key});
    loadReadyBookMetadata(summary,controller.signal).then(book=>{
      if(!controller.signal.aborted)setLoaded({key,book});
    }).catch(()=>{if(!controller.signal.aborted)setLoaded({key,failed:true});});
    return()=>controller.abort();
  },[summary,key,attempt]);
  if(!summary)return <BooksFrame title={bookT('notFound')} path="/books" robots="noindex, nofollow"><Link href="/books">{bookT('back')}</Link></BooksFrame>;
  if(loaded?.key===key&&loaded.book)return <LoadedBookDetails key={key} book={loaded.book} initialProfileId={initialProfileId}/>;
  return <BooksFrame title={summary.title} path={`/books/${summary.slug}`} headingLang={summary.contentLocale}>
    <Link href="/books">{bookT('back')}</Link>
    {loaded?.key===key&&loaded.failed?<div role="alert"><p>{bookT('metadataError')}</p><Button label={bookT('retry')} onPress={()=>setAttempt(value=>value+1)}/></div>:<p role="status">{bookT('metadataLoading')}</p>}
  </BooksFrame>;
}

function LoadedBookDetails({book,initialProfileId}:{book:PublishedBook;initialProfileId?:unknown}){
  const bookT=useBookCopy();
  // A style switch keeps the chosen physical size through the `profile` query of the other edition.
  // The static shell knows no query, so the size is applied only after hydration (docs/RULES.md, hydration policy).
  const [profileId,setProfile]=useState(book?.profiles[0]?.id??'pocket-150x100');
  const hydrated=useHydrationReady();
  const requestedProfileId=book?.profiles.find(profile=>profile.id===initialProfileId)?.id;
  useEffect(()=>{if(hydrated&&requestedProfileId)setProfile(requestedProfileId);},[hydrated,requestedProfileId]);
  // Only place editions of the same country switch styles; quest collections (kind 'quests', F1 #2808) are not alternatives.
  const isPlaces=(edition:object)=>((edition as {kind?:string}).kind??'places')==='places';
  const otherStyles=book&&isPlaces(book)?readyBooks.filter(other=>other.id!==book.id&&other.country===book.country&&isPlaces(other)):[];
  const [preview,setPreview]=useState(false);
  const [busy,setBusy]=useState<string|null>(null),[failed,setFailed]=useState<string|null>(null);
  const opener=useRef<HTMLDivElement>(null);
  const active=useRef<AbortController|null>(null);
  useEffect(()=>{if(book)trackReadyBookEvent('ReadyBookViewed',book,getActiveLocale());return()=>active.current?.abort();},[book]);
  const close=()=>{setPreview(false);opener.current?.querySelector<HTMLElement>('[role="button"],button')?.focus();};
  const quality=book.quality.find(item=>item.profileId===profileId)!;
  const download=async(file:PublishedArtifact)=>{
    active.current?.abort();const controller=new AbortController();active.current=controller;
    setBusy(file.id);setFailed(null);
    try{
      const blob=await fetchBookArtifact(file,controller.signal);
      if(controller.signal.aborted)return;
      const uri=URL.createObjectURL(blob),anchor=document.createElement('a');
      anchor.href=uri;anchor.download=bookArtifactFilename(book,file);
      document.body.appendChild(anchor);anchor.click();anchor.remove();
      setTimeout(()=>URL.revokeObjectURL(uri),60000);
      trackReadyBookEvent('ReadyBookDownloadStarted',book,getActiveLocale(),{profileId:file.profileId,artifactPurpose:file.purpose});
    }catch{if(!controller.signal.aborted){setFailed(file.id);trackReadyBookEvent('ReadyBookDownloadFailed',book,getActiveLocale(),{profileId:file.profileId,artifactPurpose:file.purpose});}}
    finally{if(active.current===controller)setBusy(null);}
  };
  return <BooksFrame title={book.title} path={`/books/${book.slug}`} headingLang={book.contentLocale}>
    <Link href="/books">{bookT('back')}</Link><p>{bookT('language')}</p><p>{formatReadyBookCounts(book,bookT)}</p><p className="ready-books-note">{bookT(hasPrintSupplements(book)?'digitalKit':'partial')}</p>
    <h2>{bookT('size')}</h2><div className="ready-books-controls">{book.profiles.map(profile=><label key={profile.id}><input type="radio" name="book-format" checked={profileId===profile.id} onChange={()=>{setProfile(profile.id);setFailed(null);trackReadyBookEvent('ReadyBookProfileSelected',book,getActiveLocale(),{profileId:profile.id});}}/>{bookT(profile.id==='album-a5'?'album':'pocket')}</label>)}</div>
    <p>{bookT(book.kind==='quests'?'questPhotoSpace':'photoSpace')}</p>
    {book.kind!=='quests'&&<><h2>{bookT('style')}</h2><p>{bookT(bookStyleKey(book.visualStyle))}</p></>}
    {otherStyles.length>0&&<nav aria-label={bookT('styleOthers')} className="ready-books-controls">{otherStyles.map(other=><Link key={other.id} href={`/books/${other.slug}?profile=${profileId}`}>{bookT(bookStyleKey(other.visualStyle))}</Link>)}</nav>}
    <div ref={opener}><Button label={bookT('preview')} onPress={()=>{setPreview(true);trackReadyBookEvent('ReadyBookPreviewOpened',book,getActiveLocale(),{profileId});}}/></div>
    {preview&&<ReadyBookPreview key={book.id} book={book} profileId={profileId} onClose={close}/>}
    {book.coverPersonalization&&<CoverPersonalizationEditor key={`${book.id}:${book.revision}`} book={book} profileId={profileId}/>}
    <section className="ready-books-note" aria-label={bookT('quality')}>
      <h2>{bookT('quality')}</h2>{!quality.printReady&&<p>{bookT('proofOnly')}</p>}
      <p>{bookT('illustrationPpi',{ppi:formatNumber(quality.minIllustrationPpi,{maximumFractionDigits:1})})}</p>
      <p>{bookT('physicalChecks')}</p><ul>{quality.physicalChecks.map(check=><li key={check}>{bookT(physicalCheckKey[check])}</li>)}</ul>
    </section>
    <h2>{bookT('inside')}</h2><details><summary>{bookT('contents')}</summary><ol lang={book.contentLocale}>{book.stops.map(stop=><li key={stop.id}>{stop.title} · {formatNumber(stop.page)}</li>)}</ol></details>
    <h2>{bookT('downloads')}</h2><p>{bookT('providerPending')}</p><ul className="ready-books-files">{book.artifacts.filter(file=>file.profileId===profileId).map(file=><li key={file.id}>
      <span>{bookT(purposeKey[file.purpose])} · {file.controlFor&&<>{bookT(purposeKey[file.controlFor])} · </>}{['body','cover'].includes(file.component)&&<>{bookT(file.component)} · </>}{file.variant&&<>{bookT(file.variant==='color'?'color':'noBackground')} · </>}PDF · {bookT('pageCount',{count:formatNumber(file.pageCount)})} · {formatNumber(file.bytes/1024/1024,{maximumFractionDigits:1})} {bookT('megabytes')}</span>
      <Button disabled={busy!==null} label={busy===file.id?bookT('downloading'):failed===file.id?bookT('retry'):bookT('download')} onPress={()=>void download(file)}/>
      {failed===file.id&&<p role="alert">{bookT('downloadError')}</p>}
    </li>)}</ul><p>{bookT('revision')}: {book.revision}</p>
    <PrintingGuide book={book} profileId={profileId}/>
    <PrintProviders book={book} profileId={profileId} bodyPageCount={book.bodyPageCount} artifactSha256={book.artifacts.find(file=>file.profileId===profileId&&file.purpose==='print-shop'&&file.component==='body')?.sha256}/>
  </BooksFrame>;
}
