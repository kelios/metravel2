import React,{useState} from 'react';
import Button from '@/components/ui/Button';
import {translate,getActiveLocale} from '@/i18n';
import {trackReadyBookEvent} from '@/utils/growthFunnelAnalytics';
import {useLocaleRevision} from '@/i18n/useLocaleRevision';
import {openExternalUrlInNewTab} from '@/utils/externalLinks';
import {assertBookPrintResource,bookPrintGuidePage} from '@/services/book/readyBooks/printResources';
import type {PublishedBook,PublishedArtifact} from '@/services/book/readyBooks/publication';

export default function PrintingGuide({book,profileId}:{book:PublishedBook;profileId:PublishedArtifact['profileId']}){
  useLocaleRevision();
  const [failedUri,setFailed]=useState<string|null>(null);
  const page=bookPrintGuidePage(book,profileId);
  const file=page??book.artifacts.find(file=>file.profileId===profileId&&file.purpose==='instructions');
  const failed=!!file&&failedUri===file.uri;
  const open=async()=>{
    setFailed(null);
    try{
      if(!file)throw new Error('BOOK_PRINT_GUIDE_UNAVAILABLE');
      assertBookPrintResource(book,file);
      if(!await openExternalUrlInNewTab(file.uri))setFailed(file?.uri??null);
      else trackReadyBookEvent('ReadyBookInstructionsViewed',book,getActiveLocale(),{profileId});
    }catch{setFailed(file?.uri??null);}
  };
  return <section aria-label={translate('books:guideTitle')}>
    <h2>{translate('books:guideTitle')}</h2><p>{translate('books:guideLanguage')}</p>
    {file?<Button label={failed?translate('books:retry'):page?translate('books:guideOpen'):`${translate('books:instructions')} · PDF`} onPress={()=>void open()}/>:<p>{translate('books:pending')}</p>}
    {failed&&<p role="alert">{translate('books:pageError')}</p>}
  </section>;
}
