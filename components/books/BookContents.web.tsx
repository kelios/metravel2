import React,{useId,useState} from 'react';
import {formatNumber} from '@/i18n';
import type {PublishedBook} from '@/services/book/readyBooks/publication';
import {useBookCopy} from './bookCopy';
import {stopCountPhrase} from './edition/editionModel';

export type BookContentsProps = {
  stops: {id:string;title:string;page:number}[];
  contentLocale: PublishedBook['contentLocale'];
  kind?: 'places'|'quests';
};

const VISIBLE_STOPS=8;

/**
 * «Маршрут книги». Every place is in the first HTML (search and no-JS readers get the full
 * contents); places after the eighth are `hidden` until the button expands the list in place.
 */
export default function BookContents({stops,contentLocale,kind='places'}:BookContentsProps){
  const t=useBookCopy();
  const id=useId();
  const [expanded,setExpanded]=useState(false);
  const quests=kind==='quests';
  const collapsible=stops.length>VISIBLE_STOPS;
  const count={count:stops.length,value:formatNumber(stops.length)};
  const phrase=stopCountPhrase({kind,stopCount:stops.length},t);
  return <section className="rbe-block" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>{t(quests?'routeTitleQuests':'routeTitle')}</h2>
    <p className="rbe-lead">{quests?t('routeLeadQuests',{quests:phrase}):t('routeLead',{places:phrase})}</p>
    <ol className="rbe-route" id={`${id}-list`}>
      {stops.map((stop,index)=><li key={stop.id} hidden={collapsible&&!expanded&&index>=VISIBLE_STOPS}>
        <span className="rbe-route-n" aria-hidden="true">{formatNumber(index+1)}</span>
        <span className="rbe-route-t" lang={contentLocale}>{stop.title}</span>
        <span className="rbe-route-p">{t('routePage',{page:formatNumber(stop.page)})}</span>
      </li>)}
    </ol>
    {collapsible&&<button type="button" className="rbe-btn rbe-btn-outline rbe-btn-sm rbe-route-toggle" aria-expanded={expanded} aria-controls={`${id}-list`} onClick={()=>setExpanded(value=>!value)}>
      {expanded?t('routeCollapse'):t(quests?'routeShowAllQuests':'routeShowAll',count)}
    </button>}
  </section>;
}
