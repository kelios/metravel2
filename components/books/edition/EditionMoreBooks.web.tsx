import React,{useId} from 'react';
import type {ReadyBookSummary} from '@/services/book/readyBooks/bookMetadata';
import {useBookCopy} from '../bookCopy';
import {catalogCard} from '../catalog/ReadyBooksCatalogContent.web';
import {useEditionLink} from './EditionParts.web';
import {stopCountPhrase} from './editionModel';

/**
 * «Ещё книги»: up to four other editions, named like the catalogue cards
 * («страна · стиль») so equal titles stay distinct (#2953). */
export default function EditionMoreBooks({books}:{books:readonly ReadyBookSummary[]}){
  const t=useBookCopy();
  const id=useId();
  const link=useEditionLink();
  if(!books.length)return null;
  return <section className="rbe-block" aria-labelledby={id}>
    <h2 id={id}>{t('moreTitle')}</h2>
    <ul className="rbe-more">{books.map(book=>{
      const card=catalogCard(book,t);
      const href=`/books/${book.slug}`;
      return <li key={book.id}><a href={href} onClick={link(href)}>
        <span className="rbe-more-thumb"><img src={book.coverUri} alt="" loading="lazy" decoding="async"/></span>
        <span className="rbe-more-body"><span className="rbe-h3" lang={card.titleLang}>{card.title}</span><span className="rbe-small">{stopCountPhrase(book,t)}</span></span>
      </a></li>;
    })}</ul>
  </section>;
}
