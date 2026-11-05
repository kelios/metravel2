import React,{useEffect} from 'react';
import type {MiniDiary} from '@/data/travelBooks/schema/miniDiaries';
import {formatNumber,getActiveLocale} from '@/i18n';
import {miniDiaryTrips} from '@/services/book/readyBooks/miniDiaries';
import {trackReadyBookEvent} from '@/utils/growthFunnelAnalytics';
import {BooksFrame} from './BooksFrame';
import {formatArtifactSize} from './bookArtifacts';
import {useBookCopy} from './bookCopy';
import {catalogCss,editionCss} from './booksStyles.web';
import {EditionIcon,scrollToAnchor,useEditionLink} from './edition/EditionParts.web';
import {pageCountPhrase} from './edition/editionModel';

export default function MiniDiaryDetails({diary}:{diary:MiniDiary}){
  const t=useBookCopy();
  const link=useEditionLink();
  const trips=miniDiaryTrips(diary);
  const previewOpened=()=>trackReadyBookEvent('ReadyBookPreviewOpened',diary,getActiveLocale(),{profileId:'album-a5'});
  const contents=[t('miniCoverPage'),t('miniPlanPage'),...diary.stops.map(stop=>stop.title),t('miniMemoryPage')];
  useEffect(()=>{trackReadyBookEvent('ReadyBookViewed',diary,getActiveLocale());},[diary]);
  return <BooksFrame title={diary.title} path={`/books/${diary.slug}`} description={diary.summary} heading={false}>
    <div className="rbe rmd">
      <style>{editionCss+catalogCss}</style>
      <section className="rbe-hero rbc-hero" aria-labelledby="mini-diary-title">
        <div className="rbc-hero-art rmd-hero-art">
          <img src={diary.cover.uri} alt={t('coverAlt',{title:diary.title})} width={420} height={595} decoding="async"/>
          <img src={diary.preview.uri} alt={t('miniSampleAlt',{title:diary.stops[0].title})} width={420} height={595} decoding="async"/>
        </div>
        <div className="rbc-hero-copy">
          <p className="rbe-eyebrow">{t('miniDiary')}</p>
          <h1 id="mini-diary-title" lang={diary.contentLocale}>{diary.title}</h1>
          <p className="rbe-promise" lang={diary.contentLocale}>{diary.summary}</p>
          <ul className="rbe-chips">
            <li><EditionIcon name="file-text" size={16}/>{pageCountPhrase(diary.pageCount,t)} · A5</li>
            <li className="is-accent">{t('language')}</li>
            <li>{t('chipNoSignup')}</li>
          </ul>
          <div className="rbe-cta">
            <a className="rbe-btn rbe-btn-primary" href={diary.pdf.uri} download={`${diary.title} — A5.pdf`}
              onClick={()=>trackReadyBookEvent('ReadyBookDownloadRequested',diary,getActiveLocale(),{profileId:'album-a5',artifactPurpose:'read'})}>
              <EditionIcon name="download"/>{t('miniDownload')}
            </a>
            <a className="rbe-btn rbe-btn-secondary" href="#mini-diary-trips" onClick={scrollToAnchor('#mini-diary-trips')}><EditionIcon name="map-pin"/>{t('miniChooseTrip')}</a>
          </div>
          <p className="rbe-small">{formatArtifactSize(diary.pdf.bytes,t)} · {t('miniStartSmall')}</p>
        </div>
      </section>
      <section className="rbe-block" id="mini-diary-trips" tabIndex={-1} aria-labelledby="mini-diary-trips-title">
        <h2 id="mini-diary-trips-title">{t('miniChooseTrip')}</h2>
        <p className="rbe-lead">{t('miniTripsLead')}</p>
        <ol className="rbe-paths">{trips.map(stop=><li className="rbe-path" key={stop.mapUrl}>
          <p className="rbe-small">{t('routePage',{page:formatNumber(stop.page)})}</p>
          <h3 lang={diary.contentLocale}>{stop.title}</h3>
          <a className="rbe-link" href={stop.mapUrl}><EditionIcon name="map-pin" size={16}/>{t('miniMap')}<span className="rbe-sr" lang={diary.contentLocale}> · {stop.title}</span></a>
          <a className="rbe-link" href={stop.articleUrl}><EditionIcon name={stop.sourceKind==='quest'?'flag':'file-text'} size={16}/>{t(stop.sourceKind==='quest'?'miniQuest':'miniArticle')}<span className="rbe-sr" lang={diary.contentLocale}> · {stop.title}</span></a>
          <a className="rbe-link" href={stop.pdfUrl} onClick={previewOpened}><EditionIcon name="book-open" size={16}/>{t('miniOpenPage',{page:formatNumber(stop.page)})}<span className="rbe-sr" lang={diary.contentLocale}> · {stop.title}</span></a>
        </li>)}</ol>
      </section>
      <section className="rbe-block rmd-inside" aria-labelledby="mini-diary-contents">
        <div>
          <h2 id="mini-diary-contents">{t('miniInsideTitle')}</h2>
          <p className="rbe-lead">{t('miniInsideLead')}</p>
          <ol className="rbe-route">{contents.map((title,index)=><li key={index}>
            <span className="rbe-route-n">{formatNumber(index+1)}</span>
            <span className="rbe-route-t" lang={index>=2&&index<=4?diary.contentLocale:undefined}>{title}</span>
          </li>)}</ol>
          <a className="rbe-link" href={diary.pdf.uri} onClick={previewOpened}><EditionIcon name="book-open" size={16}/>{t('miniReadAll')}</a>
        </div>
        <figure className="rbc-mini-preview">
          <img src={diary.preview.uri} alt={t('miniSampleAlt',{title:diary.stops[0].title})} width={420} height={595} loading="lazy" decoding="async"/>
          <figcaption className="rbe-small">{t('miniSampleCaption',{page:formatNumber(trips[0].page)})}</figcaption>
        </figure>
      </section>
      <section className="rbe-block" aria-labelledby="mini-diary-how">
        <h2 id="mini-diary-how">{t('miniHowTitle')}</h2>
        <ol className="rbe-paths">{(['Choose','Print','Keep'] as const).map((step,index)=><li className="rbe-path" key={step}>
          <h3><span className="rbe-step">{formatNumber(index+1)}</span>{t(`miniStep${step}Title`)}</h3>
          <p>{t(`miniStep${step}Text`)}</p>
        </li>)}</ol>
        <p className="rbe-small rmd-print-note">{t('miniPrintNote')}</p>
      </section>
      <p className="rbe-foot"><a className="rbe-link" href="/books" onClick={link('/books')}><EditionIcon name="arrow-left" size={16}/>{t('back')}</a></p>
    </div>
  </BooksFrame>;
}
