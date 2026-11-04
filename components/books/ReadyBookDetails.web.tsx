import React,{Suspense,useEffect,useId,useRef,useState} from 'react';
import {Link} from 'expo-router';
import Button from '@/components/ui/Button';
import {jsonLdScript} from '@/components/seo/jsonLdScript';
import {useHydrationReady} from '@/hooks/useHydrationReady';
import {findReadyBook,readyBooks} from '@/services/book/readyBooks/catalog';
import {loadReadyBookMetadata,type ReadyBookSummary} from '@/services/book/readyBooks/bookMetadata';
import {editionFamily} from '@/services/book/readyBooks/editionFamily';
import type {ReadyBookEntrySource} from '@/services/book/readyBooks/related';
import type {PublishedBook,PublishedArtifact} from '@/services/book/readyBooks/publication';
import {formatList,getActiveLocale} from '@/i18n';
import {buildCanonicalUrl,normalizeOgImageUrl} from '@/utils/seo';
import {trackReadyBookEvent} from '@/utils/growthFunnelAnalytics';
import {BooksFrame} from './BooksFrame';
import {useBookCopy,type bookT as BookT} from './bookCopy';
import {bookStyleLabel,formatArtifactSize,readyBookDescription,visibleArtifacts} from './bookArtifacts';
import {editionCss} from './booksStyles.web';
import ReadyBookPreview from './preview/ReadyBookPreview';
import PrintingGuide from './printingGuide/PrintingGuide.web';
import PrintProviders from './printProviders/PrintProviders.web';
import {bookArtifactFilename} from '@/services/book/readyBooks/artifactFilename';
import {lazyWithRetry} from '@/utils/chunkReload';
import BookContents from './BookContents.web';
import CoverPersonalizationEditor from './cover/CoverPersonalizationEditor.web';
import EditionHero,{type EditionHeroProps} from './edition/EditionHero.web';
import EditionHow from './edition/EditionHow.web';
import EditionChoose from './edition/EditionChoose.web';
import EditionDownloads from './edition/EditionDownloads.web';
import EditionFaq from './edition/EditionFaq.web';
import EditionMoreBooks from './edition/EditionMoreBooks.web';
import EditionStickyBar from './edition/EditionStickyBar.web';
import {EditionAccordion,EditionIcon,useEditionLink} from './edition/EditionParts.web';
import {editionPages,isAlbumProfile,moreBooks,pageCountPhrase,profileShort,promiseText,stopCountPhrase,versionLine} from './edition/editionModel';

const ReadyBookContents=lazyWithRetry(()=>import('./ReadyBookContents.web'),{name:'ReadyBookContents'});
const CHOOSE_ID='book-choose';
const DOWNLOAD_ID='book-download';
const PRINT_ID='book-print-files';
type Edition = ReadyBookSummary|PublishedBook;

/** Schema.org Book from the catalog summary, so the static HTML already names the edition (#2950). */
function BookJsonLd({book,description}:{book:ReadyBookSummary;description:string}){
  return jsonLdScript({
    '@context':'https://schema.org','@type':'Book',name:book.title,description,url:buildCanonicalUrl(`/books/${book.slug}`),
    image:normalizeOgImageUrl(book.coverUri)??undefined,inLanguage:book.contentLocale,numberOfPages:book.bodyPageCount,
    bookFormat:'https://schema.org/EBook',isAccessibleForFree:true,
    publisher:{'@type':'Organization',name:'MeTravel',url:'https://metravel.by'},
  });
}

const styleOf=(book:Edition,t:typeof BookT)=>book.kind==='quests'?undefined:bookStyleLabel(book,t);
/** Hero facts shared by the static shell and the loaded edition: count, pages, free, no sign-up, language. */
function heroFacts(book:Edition,t:typeof BookT):Pick<EditionHeroProps,'title'|'contentLocale'|'promise'|'chips'>{
  return {
    title:book.title,contentLocale:book.contentLocale,promise:promiseText(book,t),
    chips:[
      {icon:'map-pin',label:stopCountPhrase(book,t)},
      {icon:'file-text',label:pageCountPhrase(book.bodyPageCount,t)},
      {icon:'gift',label:t('chipFree'),accent:true},
      {icon:'unlock',label:t('chipNoSignup'),accent:true},
      {icon:'globe',label:t('chipPdfRu')},
    ],
  };
}

function BackLink(){
  const t=useBookCopy();
  const link=useEditionLink();
  return <p className="rbe-foot"><a className="rbe-link" href="/books" onClick={link('/books')}><EditionIcon name="arrow-left" size={16}/>{t('back')}</a></p>;
}

export default function ReadyBookDetails({slug,initialProfileId,entrySource}:{slug:unknown;initialProfileId?:unknown;entrySource?:ReadyBookEntrySource}){
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
  if(loaded?.key===key&&loaded.book)return <LoadedBookDetails key={key} book={loaded.book} summary={summary} description={description} initialProfileId={initialProfileId} entrySource={entrySource}/>;
  // Server markup and the first client frame carry the catalog facts; the full edition arrives after hydration.
  const style=styleOf(summary,bookT);
  const firstProfile=summary.profiles[0]?.id??'pocket-150x100';
  const caption=[style,profileShort(firstProfile,bookT)].filter(Boolean).join(' · ');
  return <BooksFrame title={summary.title} path={`/books/${summary.slug}`} headingLang={summary.contentLocale} description={description} heading={false}>
    <div className="rbe">
      <style>{editionCss}</style>
      <BookJsonLd book={summary} description={description}/>
      <EditionHero {...heroFacts(summary,bookT)} coverUri={summary.coverUri} coverAlt={bookT('heroCoverAlt',{title:summary.title,details:caption})}
        spreads={[]} album={isAlbumProfile(firstProfile)} caption={caption}
        meta={['PDF',formatList(summary.profiles.map(profile=>profileShort(profile.id,bookT))),style].filter(Boolean).join(' · ')}/>
      {loaded?.key===key&&loaded.failed?<div role="alert" className="rbe-state"><p>{bookT('metadataError')}</p><Button label={bookT('retry')} onPress={()=>setAttempt(value=>value+1)}/></div>:<p role="status" className="rbe-state rbe-small">{bookT('metadataLoading')}</p>}
      <Suspense fallback={null}><ReadyBookContents book={summary}/></Suspense>
      <EditionFaq/>
      <BackLink/>
    </div>
  </BooksFrame>;
}

function LoadedBookDetails({book,summary,description,initialProfileId,entrySource}:{book:PublishedBook;summary:ReadyBookSummary;description:string;initialProfileId?:unknown;entrySource?:ReadyBookEntrySource}){
  const bookT=useBookCopy();
  const coverTitleId=useId();
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
  const readRef=useRef<HTMLButtonElement>(null);
  const ctaRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(entrySource)trackReadyBookEvent('ReadyBookViewed',book,getActiveLocale(),{entrySource});
    else trackReadyBookEvent('ReadyBookViewed',book,getActiveLocale());
  },[book,entrySource]);
  // Both entries (hero and sticky bar) return focus to the hero button, which stays on the page.
  const context=entrySource?{entrySource}:{};
  const openPreview=()=>{setPreview(true);trackReadyBookEvent('ReadyBookPreviewOpened',book,getActiveLocale(),{profileId,...context});};
  const close=()=>{setPreview(false);readRef.current?.focus();};
  const selectProfile=(next:PublishedArtifact['profileId'])=>{setProfile(next);setProfileChosen(true);trackReadyBookEvent('ReadyBookProfileSelected',book,getActiveLocale(),{profileId:next,...context});};
  // A plain link keeps the browser's own progress and the user gesture on iOS Safari; the publisher
  // already verified every byte against book.json, so the browser does not re-hash the file (#2951).
  const requested=(file:PublishedArtifact)=>trackReadyBookEvent('ReadyBookDownloadRequested',book,getActiveLocale(),{profileId:file.profileId,artifactPurpose:file.purpose,artifactComponent:file.component,profileSource:profileChosen?'selected':'default',...context});
  const files=visibleArtifacts(book,profileId);
  const body=files.find(file=>file.purpose==='read'&&file.component==='body');
  const cover=files.find(file=>file.purpose==='read'&&file.component==='cover');
  const downloadLink=(file:PublishedArtifact|undefined)=>file?{href:file.uri,filename:bookArtifactFilename(book,file),onClick:()=>requested(file)}:undefined;
  const download=downloadLink(body);
  const pages=editionPages(book,profileId);
  const album=isAlbumProfile(profileId);
  const style=styleOf(book,bookT);
  const size=profileShort(profileId,bookT);
  const caption=[style,size].filter(Boolean).join(' · ');
  const coverUri=pages.cover?.uri??summary.coverUri;
  return <BooksFrame title={book.title} path={`/books/${book.slug}`} headingLang={book.contentLocale} description={description} heading={false}>
    <div className="rbe">
      <style>{editionCss}</style>
      <BookJsonLd book={summary} description={description}/>
      <EditionHero {...heroFacts(book,bookT)} coverUri={coverUri} coverAlt={bookT('heroCoverAlt',{title:book.title,details:caption})}
        spreads={pages.spreads} album={album} caption={caption}
        meta={['PDF',body&&formatArtifactSize(body.bytes,bookT),size,style].filter(Boolean).join(' · ')}
        download={download} coverDownload={downloadLink(cover)} printHref={`#${PRINT_ID}`} onRead={openPreview} readRef={readRef} ctaRef={ctaRef} chooseHref={`#${CHOOSE_ID}`}/>
      {preview&&<ReadyBookPreview key={book.id} book={book} profileId={profileId} onClose={close}/>}
      {/* The sticky bar is the last child of the after-hero block: CSS keeps it below the hero, no scroll observer (#2948). */}
      <div className="rbe-after">
      <EditionHow pages={pages.how} quests={book.kind==='quests'} album={album}/>
      <EditionChoose book={book} profileId={profileId} currentCoverUri={coverUri} otherStyles={otherStyles} onProfile={selectProfile} sectionId={CHOOSE_ID}/>
      <BookContents stops={book.stops} contentLocale={book.contentLocale} kind={book.kind}/>
      {book.coverPersonalization&&<section className="rbe-block" aria-labelledby={coverTitleId}>
        <EditionAccordion icon="edit-3" title={bookT('coverSectionTitle')} hint={bookT('coverSectionHint')} titleId={coverTitleId}>
          <CoverPersonalizationEditor key={`${book.id}:${book.revision}`} book={book} profileId={profileId}/>
        </EditionAccordion>
      </section>}
      <EditionDownloads book={book} profileId={profileId} details={caption} coverUri={coverUri} version={versionLine(book.revision,bookT)} onRequested={requested} sectionId={DOWNLOAD_ID} printSectionId={PRINT_ID}/>
      <PrintingGuide book={book} profileId={profileId}>
        <PrintProviders embedded book={book} profileId={profileId} bodyPageCount={book.bodyPageCount}/>
      </PrintingGuide>
      <EditionFaq/>
      <EditionMoreBooks books={moreBooks(book,readyBooks)}/>
      <BackLink/>
      {download&&!preview&&<EditionStickyBar download={download} onRead={openPreview}/>}
      </div>
    </div>
  </BooksFrame>;
}
