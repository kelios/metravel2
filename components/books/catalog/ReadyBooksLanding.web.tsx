import React,{useId} from 'react';
import {readyBooks} from '@/services/book/readyBooks/catalog';
import {selectShowcase,type ShowcasePage} from '@/services/book/readyBooks/showcase';
import {formatNumber} from '@/i18n';
import {useBookCopy} from '../bookCopy';
import {EditionIcon,scrollToAnchor,useEditionLink} from '../edition/EditionParts.web';
import EditionHow from '../edition/EditionHow.web';
import EditionFaq from '../edition/EditionFaq.web';
import ReadyBooksCatalogContent,{catalogCard} from './ReadyBooksCatalogContent.web';

const CHOOSE='#books-choose';
const STEPS='#books-steps';
const STEP_ICONS=['download','printer','map-pin','camera'] as const;
const STEP_COPY=[
  ['catalogStep1Title','catalogStep1Text'],['catalogStep2Title','catalogStep2Text'],
  ['catalogStep3Title','catalogStep3Text'],['catalogStep4Title','catalogStep4Text'],
] as const;

/**
 * `/books` landing (#2970): the first screen says whose book this is — a ready travel
 * journal the reader completes with own photos and notes — before the edition list.
 * Every picture is a real published page of a book (`showcase.json`).
 */
export default function ReadyBooksLanding(){
  const t=useBookCopy();
  const showcase=selectShowcase(readyBooks);
  return <>
    <CatalogHero pages={showcase.hero}/>
    <CatalogSteps/>
    {showcase.how.length===3&&<EditionHow pages={showcase.how} quests={false} album={false}/>}
    <CatalogPlaces places={showcase.places}/>
    <CatalogSection id={CHOOSE.slice(1)} title={t('catalogChooseTitle')} lead={t('catalogChooseLead')}><ReadyBooksCatalogContent/></CatalogSection>
    <EditionFaq/>
  </>;
}

function CatalogSection({id,title,lead,children}:{id:string;title:string;lead:string;children:React.ReactNode}){
  const titleId=useId();
  return <section id={id} tabIndex={-1} className="rbe-block" aria-labelledby={titleId}>
    <h2 id={titleId}>{title}</h2>
    <p className="rbe-lead">{lead}</p>
    {children}
  </section>;
}

function CatalogHero({pages}:{pages:ShowcasePage[]}){
  const t=useBookCopy();
  const titleId=useId();
  const cover=pages[0]?.book;
  // Two spread slots stay reserved so a late image never shifts the hero (edition hero contract).
  const spreads=[pages.slice(0,2),pages.slice(2,4)];
  return <section className="rbe-hero" aria-labelledby={titleId}>
    <div>
      <div className="rbe-stage" data-size="pocket">
        {spreads.map((spread,index)=><div key={index} className={`rbe-spread rbe-spread-${index+1}`} aria-hidden="true">
          {spread.map(page=><img key={page.uri} src={page.uri} alt="" decoding="async"/>)}
        </div>)}
        <div className="rbe-cover">{cover&&<img src={cover.coverUri} alt={t('coverAlt',{title:catalogCard(cover,t).title})} decoding="async"/>}</div>
      </div>
      <p className="rbe-small rbe-stage-caption">{t('catalogStageCaption')}</p>
    </div>
    <div>
      <p className="rbe-eyebrow">{t('catalogEyebrow')}</p>
      <h1 id={titleId}>{t('catalogTitle')}</h1>
      <p className="rbe-promise">{t('catalogPromise')}</p>
      <ul className="rbe-chips" aria-label={t('chipsLabel')}>
        <li className="is-accent"><EditionIcon name="gift" size={16}/>{t('chipFree')}</li>
        <li className="is-accent"><EditionIcon name="unlock" size={16}/>{t('chipNoSignup')}</li>
        <li><EditionIcon name="printer" size={16}/>{t('catalogChipPrint')}</li>
      </ul>
      <div className="rbe-cta">
        <a className="rbe-btn rbe-btn-primary" href={CHOOSE} onClick={scrollToAnchor(CHOOSE)}><EditionIcon name="book-open"/>{t('catalogCtaChoose')}</a>
        <a className="rbe-btn rbe-btn-secondary" href={STEPS} onClick={scrollToAnchor(STEPS)}>{t('catalogCtaHow')}<EditionIcon name="chevron-down"/></a>
      </div>
    </div>
  </section>;
}

function CatalogSteps(){
  const t=useBookCopy();
  return <CatalogSection id={STEPS.slice(1)} title={t('catalogStepsTitle')} lead={t('catalogStepsLead')}>
    <ol className="rbc-steps">{STEP_COPY.map(([title,text],index)=><li key={title} className="rbe-path">
      <span className="rbe-path-ic"><EditionIcon name={STEP_ICONS[index]}/></span>
      <h3><span className="rbe-step" aria-hidden="true">{formatNumber(index+1)}</span>{t(title)}</h3>
      <p>{t(text)}</p>
    </li>)}</ol>
  </CatalogSection>;
}

function CatalogPlaces({places}:{places:ShowcasePage[]}){
  const t=useBookCopy();
  const link=useEditionLink();
  if(!places.length)return null;
  return <CatalogSection id="books-places" title={t('catalogPlacesTitle')} lead={t('catalogPlacesLead')}>
    <ul className="rbc-places">{places.map(place=>{
      const href=`/books/${place.book.slug}`;
      const book=catalogCard(place.book,t);
      return <li key={place.uri}><a href={href} onClick={link(href)}>
        <span className="rbc-place-page"><img src={place.uri} alt={t('catalogPlaceAlt',{title:place.title})} loading="lazy" decoding="async"/></span>
        <span className="rbc-place-body">
          <span className="rbe-h3" lang="ru">{place.title}</span>
          <span className="rbe-small rbc-place-meta"><EditionIcon name="book-open" size={14}/>{t('catalogPlaceBook',{book:book.title})}</span>
        </span>
      </a></li>;
    })}</ul>
  </CatalogSection>;
}
