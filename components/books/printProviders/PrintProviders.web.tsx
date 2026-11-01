import React, {useEffect,useState} from 'react';
import Button from '@/components/ui/Button';
import {formatDate,formatNumber,getActiveLocale} from '@/i18n';
import {trackReadyBookEvent} from '@/utils/growthFunnelAnalytics';
import {openExternalUrlInNewTab} from '@/utils/externalLinks';
import {listPrintLocations} from '@/services/book/readyBooks/providers';
import {loadCurrentPrintDirectory} from '@/services/book/readyBooks/printResources';
import type {PublishedBook} from '@/services/book/readyBooks/publication';
import type {PrintCountry,PrintDirectory} from '@/data/travelBooks/schema/providers';
import type {PrintProfile} from '@/types/readyBook';
import {useProviderCopy} from './providerCopy';

type Props = {profileId: PrintProfile['id']; bodyPageCount: number; artifactSha256?: string};

export function PrintProvidersView({directory,profileId,bodyPageCount,initialCountry='BY',onProviderOpened}: Props & {directory:PrintDirectory;initialCountry?:PrintCountry;onProviderOpened?:(providerId:string)=>void}) {
  const t=useProviderCopy();
  const [country,setCountry]=useState<PrintCountry>(initialCountry);
  const [openError,setOpenError]=useState(false);
  const locations=listPrintLocations(country,directory);
  const open=async(url:string,providerId:string)=>{
    setOpenError(false);
    if(!await openExternalUrlInNewTab(url))setOpenError(true);
    else onProviderOpened?.(providerId);
  };
  return <section aria-label={t('providerTitle')}>
    <h2>{t('providerTitle')}</h2><p>{t('providerIntro')}</p>
    <p>{t('providerFormat',{format:t(profileId==='album-a5'?'providerAlbum':'providerPocket'),pages:formatNumber(bodyPageCount)})}</p>
    <p>{t('providerPreparation')}</p>
    <label>{t('providerCountry')}<select value={country} onChange={event=>setCountry(event.target.value as PrintCountry)}>
      <option value="BY">{t('providerBY')}</option><option value="PL">{t('providerPL')}</option>
    </select></label>
    {locations.length?<ul>{locations.map(provider=><li key={provider.id}>
      <h3>{provider.name}</h3><p>{provider.city} · {provider.printHelp.address}</p>
      <p>{t('providerA4')}</p>
      <p>{t(provider.printHelp.fontPolicy==='embedded'?'providerFontsInferred':'providerFontsConfirm')}</p>
      <p>{t(provider.publishedProfiles.includes('album-a5')?'providerNativeA5':'providerNativeUnknown')}</p>
      <p>{t('providerChecked',{date:formatDate(new Date(`${provider.checkedAt}T12:00:00Z`),{timeZone:'UTC'})})}</p>
      <Button label={t('providerWebsite')} onPress={()=>void open(provider.url,provider.id)}/>
      <details><summary>{t('providerDetails')}</summary><ul>{provider.sourceUrls.map((url,index)=><li key={url}>
        <Button label={t('providerSource',{number:formatNumber(index+1)})} onPress={()=>void open(url,provider.id)}/>
      </li>)}</ul></details>
    </li>)}</ul>:<p>{t('providerEmpty')}</p>}
    {openError&&<p role="alert">{t('providerOpenError')}</p>}
    <p>{t('providerNoTransfer')}</p>
  </section>;
}

export default function PrintProviders({book,...props}:Props & {book:PublishedBook}){
  const t=useProviderCopy();
  const [attempt,setAttempt]=useState(0);
  const [state,setState]=useState<{directory?:PrintDirectory;failed?:boolean}>({});
  useEffect(()=>{
    let active=true;
    setState({});
    void loadCurrentPrintDirectory().then(directory=>{if(active)setState({directory});})
      .catch(()=>{if(active)setState({failed:true});});
    return()=>{active=false;};
  },[attempt]);
  if(state.directory)return <PrintProvidersView key={book.country} {...props} initialCountry={book.country} directory={state.directory} onProviderOpened={providerId=>trackReadyBookEvent('ReadyBookProviderOpened',book,getActiveLocale(),{profileId:props.profileId,providerId})}/>;
  return <section aria-label={t('providerTitle')}>
    <h2>{t('providerTitle')}</h2>
    {state.failed?<><p role="alert">{t('pageError')}</p><Button label={t('retry')} onPress={()=>setAttempt(value=>value+1)}/></>:<p role="status">{t('loadingPage')}</p>}
  </section>;
}
