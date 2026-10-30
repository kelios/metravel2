import React,{useEffect,useRef,useState} from 'react';
import Button from '@/components/ui/Button';
import type {PublishedBook} from '@/services/book/readyBooks/publication';
import {bookPreview,previewWindow} from '@/services/book/readyBooks/preview';
import {formatNumber} from '@/i18n';
import {useBookCopy} from '../bookCopy';

function PreviewPage({uri,alt,ratio}:{uri:string,alt:string,ratio:number}){
  const bookT=useBookCopy();
  const paper=useRef<HTMLDivElement>(null);
  const [state,setState]=useState<'loading'|'ready'|'error'>('loading');
  const [attempt,setAttempt]=useState(0);
  return <div ref={paper} tabIndex={-1} className="ready-books-paper" style={{aspectRatio:String(ratio)}}>
    {state==='loading'&&<span role="status" style={{position:'absolute'}}>{bookT('loadingPage')}</span>}
    {state==='error'?<div role="alert"><p>{bookT('pageError')}</p><Button label={bookT('retry')} onPress={()=>{setState('loading');setAttempt(v=>v+1);paper.current?.focus();}}/></div>:<img key={attempt} src={uri} alt={alt} lang="ru" onLoad={()=>setState('ready')} onError={()=>setState('error')} style={{visibility:state==='ready'?'visible':'hidden'}}/>}
  </div>;
}
export default function ReadyBookPreview({book,profileId,onClose}:{book:PublishedBook,profileId:string,onClose:()=>void}){
  const bookT=useBookCopy();
  const [positions,setPositions]=useState({body:1,cover:1}),[scale,setScale]=useState(1);
  const [component,setComponent]=useState<'body'|'cover'>('body');
  const page=positions[component];
  const setPage=(value:number|((prior:number)=>number))=>setPositions(prior=>({...prior,[component]:typeof value==='function'?value(prior[component]):value}));
  const [spread,setSpread]=useState(false);
  const title=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{const query=matchMedia('(min-width: 800px)');const update=()=>setSpread(query.matches);update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
  useEffect(()=>{title.current?.focus();},[]);
  const preview=bookPreview(book,profileId,component);
  const pages=previewWindow(page,spread,preview.pages.length);
  const profile=book.profiles.find(p=>p.id===profileId)!;
  const move=(delta:number)=>setPage(v=>Math.max(1,Math.min(preview.pages.length,v+delta)));
  return <section className="ready-books-preview" aria-label={bookT('preview')} onKeyDown={event=>{
    if(event.key==='Escape'){event.preventDefault();onClose();}
    if(event.target instanceof HTMLInputElement||event.target instanceof HTMLSelectElement) return;
    if(event.key==='ArrowRight'){event.preventDefault();move(spread?2:1);}if(event.key==='ArrowLeft'){event.preventDefault();move(spread?-2:-1);}
  }}><h2 tabIndex={-1} ref={title}>{bookT('preview')}</h2>
    <p>{bookT('revision')}: {book.revision} · {formatNumber(profile.widthMm)} × {formatNumber(profile.heightMm)} {bookT('millimeters')} · {bookT('language')}</p>
    <Button label={bookT('close')} onPress={onClose}/>
    <div className="ready-books-controls">
      <label>{bookT('contents')}<select value={component} onChange={event=>setComponent(event.target.value as 'body'|'cover')}><option value="body">{bookT('bodyTab')}</option><option value="cover">{bookT('coverTab')}</option></select></label>
      <Button label={bookT('previous')} disabled={pages[0]===1} onPress={()=>move(spread?-2:-1)}/>
      <label>{bookT('page')}<input type="number" min={1} max={preview.pages.length} value={page} onChange={event=>setPage(Math.max(1,Math.min(preview.pages.length,Math.trunc(Number(event.target.value))||1)))} style={{width:80}}/> / {formatNumber(preview.pages.length)}</label>
      <Button label={bookT('next')} disabled={pages[pages.length-1]>=preview.pages.length} onPress={()=>move(spread?2:1)}/>
      <label>{bookT('zoom')}<select value={scale} onChange={event=>setScale(Number(event.target.value))}>{[1,1.5,2].map(value=><option key={value} value={value}>{formatNumber(value,{style:'percent'})}</option>)}</select></label>
    </div>
    <div style={{overflowX:'auto'}}><div className="ready-books-pages" style={{width:`${scale*100}%`}}>{pages.map(number=>{const item=preview.pages[number-1];return <PreviewPage key={`${profileId}:${component}:${number}`} uri={item.uri} alt={item.alt} ratio={profile.widthMm/profile.heightMm}/>;})}</div></div>
    <details><summary>{bookT('contents')}</summary><ol lang={book.contentLocale}>{book.stops.map(stop=><li key={stop.id}><Button variant="ghost" fullWidth labelNumberOfLines={3} label={`${formatNumber(stop.page)} · ${stop.title}`} onPress={()=>{setComponent('body');setPositions(prior=>({...prior,body:stop.page}));title.current?.focus();}}/></li>)}</ol></details>
  </section>;
}
