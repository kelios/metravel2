import React,{Suspense,useEffect,useRef,useState} from 'react';
import {Link} from 'expo-router';
import Button from '@/components/ui/Button';
import {jsonLdScript} from '@/components/seo/jsonLdScript';
import {useHydrationReady} from '@/hooks/useHydrationReady';
import {findReadyBook,readyBooks} from '@/services/book/readyBooks/catalog';
import {loadReadyBookMetadata,type ReadyBookSummary} from '@/services/book/readyBooks/bookMetadata';
import {editionFamily} from '@/services/book/readyBooks/editionFamily';
import type {PublishedBook,PublishedArtifact} from '@/services/book/readyBooks/publication';
import {getActiveLocale} from '@/i18n';
import {buildCanonicalUrl,normalizeOgImageUrl} from '@/utils/seo';
import {trackReadyBookEvent} from '@/utils/growthFunnelAnalytics';
import {BooksFrame} from './BooksFrame';
import {formatReadyBookCounts,useBookCopy,type bookT as BookT} from './bookCopy';
import {bookStyleLabel,describeArtifact,readyBookDescription,visibleArtifacts} from './bookArtifacts';
import ReadyBookPreview from './preview/ReadyBookPreview';
import PrintingGuide from './printingGuide/PrintingGuide.web';
import PrintProviders from './printProviders/PrintProviders.web';
import {bookArtifactFilename} from '@/services/book/readyBooks/artifactFilename';
import {lazyWithRetry} from '@/utils/chunkReload';
import BookContents from './BookContents.web';
import CoverPersonalizationEditor from './cover/CoverPersonalizationEditor.web';

const profileLabel=(id:string,t:typeof BookT)=>t(id==='album-a5'?'album':'pocket');
const ReadyBookContents=lazyWithRetry(()=>import('./ReadyBookContents.web'),{name:'ReadyBookContents'});

/** Schema.org Book from the catalog summary, so the static HTML already names the edition (#2950). */
function BookJsonLd({book,description}:{book:ReadyBookSummary;description:string}){
  return jsonLdScript({
    '@context':'https://schema.org','@type':'Book',name:book.title,description,url:buildCanonicalUrl(`/books/${book.slug}`),
    image:normalizeOgImageUrl(book.coverUri)??undefined,inLanguage:book.contentLocale,numberOfPages:book.bodyPageCount,
    bookFormat:'https://schema.org/EBook',isAccessibleForFree:true,
    publisher:{'@type':'Organization',name:'MeTravel',url:'https://metravel.by'},
  });
}

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
  const description=readyBookDescription(summary,bookT);
  if(loaded?.key===key&&loaded.book)return <LoadedBookDetails key={key} book={loaded.book} summary={summary} description={description} initialProfileId={initialProfileId}/>;
  // Server markup and the first client frame carry the catalog facts; the full edition arrives after hydration.
  return <BooksFrame title={summary.title} path={`/books/${summary.slug}`} headingLang={summary.contentLocale} description={description}>
    <BookJsonLd book={summary} description={description}/>
    <Link href="/books">{bookT('back')}</Link><p>{bookT('language')}</p><p>{formatReadyBookCounts(summary,bookT)}</p>
    {summary.kind!=='quests'&&<p>{bookT('style')}: {bookStyleLabel(summary,bookT)}</p>}
    <p>{bookT('size')}: {summary.profiles.map(profile=>profileLabel(profile.id,bookT)).join('; ')}</p>
    <p>{bookT(summary.kind==='quests'?'questPhotoSpace':'photoSpace')}</p>
    <Suspense fallback={null}><ReadyBookContents book={summary}/></Suspense>
    {loaded?.key===key&&loaded.failed?<div role="alert"><p>{bookT('metadataError')}</p><Button label={bookT('retry')} onPress={()=>setAttempt(value=>value+1)}/></div>:<p role="status">{bookT('metadataLoading')}</p>}
  </BooksFrame>;
}

function LoadedBookDetails({book,summary,description,initialProfileId}:{book:PublishedBook;summary:ReadyBookSummary;description:string;initialProfileId?:unknown}){
  const bookT=useBookCopy();
  // A style switch keeps the chosen physical size through the `profile` query of the other edition.
  // The static shell knows no query, so the size is applied only after hydration (docs/RULES.md, hydration policy).
  const [profileId,setProfile]=useState(book?.profiles[0]?.id??'pocket-150x100');
  // Downloads report whether the size was chosen or left at the default (#2951).
  const [profileChosen,setProfileChosen]=useState(false);
  const hydrated=useHydrationReady();
  const requestedProfileId=book?.profiles.find(profile=>profile.id===initialProfileId)?.id;
  useEffect(()=>{if(hydrated&&requestedProfileId){setProfile(requestedProfileId);setProfileChosen(true);}},[hydrated,requestedProfileId]);
  // Style alternatives preserve the declared country or thematic-series family.
  const isPlaces=(edition:object)=>((edition as {kind?:string}).kind??'places')==='places';
  const otherStyles=book&&isPlaces(book)?readyBooks.filter(other=>other.id!==book.id&&isPlaces(other)&&editionFamily(other)===editionFamily(book)):[];
  const [preview,setPreview]=useState(false);
  const opener=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(book)trackReadyBookEvent('ReadyBookViewed',book,getActiveLocale());},[book]);
  const close=()=>{setPreview(false);opener.current?.querySelector<HTMLElement>('[role="button"],button')?.focus();};
  // A plain link keeps the browser's own progress and the user gesture on iOS Safari; the publisher
  // already verified every byte against book.json, so the browser does not re-hash the file (#2951).
  const requested=(file:PublishedArtifact)=>trackReadyBookEvent('ReadyBookDownloadRequested',book,getActiveLocale(),{profileId:file.profileId,artifactPurpose:file.purpose,profileSource:profileChosen?'selected':'default'});
  return <BooksFrame title={book.title} path={`/books/${book.slug}`} headingLang={book.contentLocale} description={description}>
    <BookJsonLd book={summary} description={description}/>
    <Link href="/books">{bookT('back')}</Link><p>{bookT('language')}</p><p>{formatReadyBookCounts(book,bookT)}</p>
    <h2>{bookT('size')}</h2><div className="ready-books-controls">{book.profiles.map(profile=><label key={profile.id}><input type="radio" name="book-format" checked={profileId===profile.id} onChange={()=>{setProfile(profile.id);setProfileChosen(true);trackReadyBookEvent('ReadyBookProfileSelected',book,getActiveLocale(),{profileId:profile.id});}}/>{profileLabel(profile.id,bookT)}</label>)}</div>
    <p>{bookT(book.kind==='quests'?'questPhotoSpace':'photoSpace')}</p>
    {book.kind!=='quests'&&<><h2>{bookT('style')}</h2><p>{bookStyleLabel(book,bookT)}</p></>}
    {otherStyles.length>0&&<nav aria-label={bookT('styleOthers')} className="ready-books-controls">{otherStyles.map(other=><Link key={other.id} href={`/books/${other.slug}?profile=${profileId}`}>{bookStyleLabel(other,bookT)}</Link>)}</nav>}
    <div ref={opener}><Button label={bookT('preview')} onPress={()=>{setPreview(true);trackReadyBookEvent('ReadyBookPreviewOpened',book,getActiveLocale(),{profileId});}}/></div>
    {preview&&<ReadyBookPreview key={book.id} book={book} profileId={profileId} onClose={close}/>}
    {book.coverPersonalization&&<CoverPersonalizationEditor key={`${book.id}:${book.revision}`} book={book} profileId={profileId}/>}
    <BookContents stops={book.stops} contentLocale={book.contentLocale}/>
    <h2>{bookT('downloads')}</h2><ul className="ready-books-files">{visibleArtifacts(book,profileId).map(file=>{const label=describeArtifact(file,bookT);return <li key={file.id}>
      <span>{label}</span>
      <a className="ready-books-download" href={file.uri} download={bookArtifactFilename(book,file)} aria-label={`${bookT('download')}: ${label}`} onClick={()=>requested(file)}>{bookT('download')}</a>
    </li>;})}</ul>
    <PrintingGuide book={book} profileId={profileId}/>
    <PrintProviders book={book} profileId={profileId} bodyPageCount={book.bodyPageCount}/>
  </BooksFrame>;
}
