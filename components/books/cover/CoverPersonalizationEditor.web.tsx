import React,{useCallback,useEffect,useId,useRef,useState} from 'react';
import Feather from '@expo/vector-icons/Feather';
import {useFocusEffect} from 'expo-router';
import Button from '@/components/ui/Button';
import {DESIGN_TOKENS} from '@/constants/designSystem';
import {formatNumber} from '@/i18n';
import {useTranslation} from '@/i18n/LocaleProvider';
import type {PublishedBook} from '@/services/book/readyBooks/publication';
import {createPersonalizedCoverBlob,CoverPersonalizationError,type CoverOutputMode} from '@/services/book/readyBooks/coverPersonalization';
import {CoverTextError} from '@/services/book/readyBooks/coverText';
import {downloadBlobOnWeb} from '@/utils/downloadUrlOnWeb';
import {openWebWindow} from '@/utils/externalLinks';

type Result = {blob:Blob;url:string;identity:string};
type Request = {controller:AbortController;identity:string};
const modes:CoverOutputMode[]=['read','print-shop','home-rings'];

export default function CoverPersonalizationEditor({book,profileId}:{book:PublishedBook;profileId:string}) {
  const {t}=useTranslation();
  const descriptor=book.coverPersonalization;
  const id=useId();
  const [selection,setSelection]=useState<string>(descriptor?.defaultPresetId??'home-memories');
  const [customText,setCustomText]=useState('');
  const [mode,setMode]=useState<CoverOutputMode>('read');
  const [result,setResult]=useState<Result|null>(null);
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState<{identity:string;code:string}|null>(null);
  const [previewNotice,setPreviewNotice]=useState(false);
  const text=selection==='custom'?customText:descriptor?.presets.find(preset=>preset.id===selection)?.text??'';
  // The identity is private in-memory state, never a URL, DOM attribute or event.
  const identity=JSON.stringify([book.id,book.revision,profileId,mode,selection,text]);
  const currentIdentity=useRef(identity);
  currentIdentity.current=identity;
  const active=useRef<Request|null>(null);
  const currentResult=useRef<Result|null>(null);
  const release=useCallback((obsoleteIdentity?:string)=>{
    if(active.current&&(!obsoleteIdentity||active.current.identity===obsoleteIdentity)) {
      active.current.controller.abort();
      active.current=null;
    }
    if(currentResult.current&&(!obsoleteIdentity||currentResult.current.identity===obsoleteIdentity)) {
      URL.revokeObjectURL(currentResult.current.url);
      currentResult.current=null;
    }
  },[]);
  useEffect(()=>()=>release(identity),[identity,release]);
  useEffect(()=>()=>release(),[release]);
  const invalidate=useCallback(()=>{release();setResult(null);setBusy(null);setError(null);setPreviewNotice(false);},[release]);
  // Expo can retain this screen after navigation: blur must release private PDF
  // state even when neither the book identity nor the component mount changes.
  useFocusEffect(useCallback(()=>()=>{
    invalidate();
    setCustomText('');
  },[invalidate]));
  const available=result&&result===currentResult.current&&result.identity===identity?result:null;
  const selectedError=error?.identity===identity?error.code:null;
  const errorText=selectedError==='COVER_TEXT_EMPTY'?t('books:coverErrorEmpty'):
    selectedError==='COVER_TEXT_TOO_LONG'?t('books:coverErrorLength'):
    selectedError==='COVER_UNSUPPORTED_GLYPH'?t('books:coverErrorGlyph'):
    selectedError==='COVER_TEXT_OVERFLOW'?t('books:coverErrorOverflow'):
    selectedError==='COVER_MODE_UNAVAILABLE'?t('books:coverErrorMode'):t('books:coverErrorGenerate');
  if(!descriptor)return null;
  const generate=async()=>{
    invalidate();
    const request={controller:new AbortController(),identity};
    active.current=request;
    setBusy(identity);
    try {
      const blob=await createPersonalizedCoverBlob({book,profileId,mode,text,signal:request.controller.signal});
      if(active.current!==request||request.controller.signal.aborted||currentIdentity.current!==identity)return;
      const next={blob,url:URL.createObjectURL(blob),identity};
      currentResult.current=next;
      setResult(next);
    } catch(caught) {
      if(active.current!==request||request.controller.signal.aborted||currentIdentity.current!==identity)return;
      const code=caught instanceof CoverTextError||caught instanceof CoverPersonalizationError?caught.code:'COVER_GENERATE';
      setError({identity,code});
    } finally {
      if(active.current===request){active.current=null;setBusy(null);}
    }
  };
  const colors=DESIGN_TOKENS.colors;
  const fieldStyle={boxSizing:'border-box',width:'100%',minHeight:44,color:colors.bookPageText,background:colors.bookPageSurfaceMuted,border:`1px solid ${colors.bookPageBorder}`,borderRadius:DESIGN_TOKENS.radii.sm,padding:DESIGN_TOKENS.spacing.sm} as const;
  return <section className="ready-books-note" aria-labelledby={`${id}-title`} style={{background:colors.bookPageSurface,color:colors.bookPageText,borderColor:colors.bookPageBorder}}>
    <h2 id={`${id}-title`}>{t('books:coverEditorTitle')}</h2>
    <p id={`${id}-privacy`}>{t('books:coverPrivate')}</p>
    <fieldset style={{border:0,padding:0,margin:0}}>
      <legend>{t('books:coverTextChoice')}</legend>
      {descriptor.presets.map(preset=><label key={preset.id} style={{display:'flex',gap:DESIGN_TOKENS.spacing.sm,alignItems:'flex-start',paddingBlock:DESIGN_TOKENS.spacing.sm,minHeight:44}}>
        <input type="radio" name={`${id}-text`} checked={selection===preset.id} onChange={()=>{invalidate();setSelection(preset.id);}}/>
        <span lang="ru">{preset.text}</span>
      </label>)}
      <label style={{display:'flex',gap:DESIGN_TOKENS.spacing.sm,alignItems:'center',minHeight:44}}><input type="radio" name={`${id}-text`} checked={selection==='custom'} onChange={()=>{invalidate();setSelection('custom');}}/>{t('books:coverOwnText')}</label>
    </fieldset>
    {selection==='custom'&&<label style={{display:'block'}}>{t('books:coverCustomLabel')}
      <textarea className="ym-disable-keys ym-hide-content" value={customText} rows={3} autoComplete="off" spellCheck={false} aria-describedby={`${id}-privacy ${id}-count`} style={fieldStyle} onChange={event=>{invalidate();setCustomText(event.target.value);}}/>
      <span id={`${id}-count`}>{t('books:coverCharacterCount',{count:formatNumber(Array.from(customText.normalize('NFC').trim()).length),max:formatNumber(descriptor.maxCharacters)})}</span>
    </label>}
    <label style={{display:'block',marginTop:DESIGN_TOKENS.spacing.md}}>{t('books:coverOutput')}
      <select value={mode} style={fieldStyle} onChange={event=>{invalidate();setMode(event.target.value as CoverOutputMode);}}>{modes.map(value=><option key={value} value={value}>{value==='read'?t('books:read'):value==='print-shop'?t('books:shop'):t('books:rings')}</option>)}</select>
    </label>
    <p>{t('books:coverNoSewn')}</p>
    <div className="ready-books-controls">
      <Button label={busy===identity?t('books:coverGenerating'):selectedError?t('books:retry'):t('books:coverGenerate')} disabled={busy===identity} icon={<Feather name="type" size={18} color={colors.bookPageAccent}/>} onPress={()=>void generate()}/>
      {available&&<>
        <Button label={t('books:coverPreviewPdf')} variant="outline" icon={<Feather name="eye" size={18} color={colors.bookPageAccent}/>} onPress={()=>{
          if(currentIdentity.current===available.identity&&currentResult.current===available)setPreviewNotice(!openWebWindow(available.url,{windowFeatures:'noopener,noreferrer'}));
        }}/>
        <Button label={t('books:coverDownloadPdf')} icon={<Feather name="download" size={18} color={colors.bookPageAccent}/>} onPress={()=>{
          if(currentIdentity.current===available.identity&&currentResult.current===available&&!downloadBlobOnWeb(available.blob,`${book.slug}-${book.revision}-${profileId}-${mode}-personal-cover.pdf`))setError({identity,code:'COVER_GENERATE'});
        }}/>
      </>}
    </div>
    {busy===identity&&<p role="status">{t('books:coverGenerating')}</p>}
    {selectedError&&<p role="alert">{errorText}</p>}
    {available&&<p role="status">{t('books:coverReady')}</p>}
    {previewNotice&&available&&<p role="status">{t('books:coverPreviewHelp')}</p>}
  </section>;
}
