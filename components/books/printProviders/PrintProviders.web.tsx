import React, {useEffect,useState} from 'react';
import Feather from '@expo/vector-icons/Feather';
import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';
import {formatList,formatNumber,getActiveLocale} from '@/i18n';
import {trackReadyBookEvent} from '@/utils/growthFunnelAnalytics';
import {openExternalUrlInNewTab} from '@/utils/externalLinks';
import {listPrintCities,listPrintLocations} from '@/services/book/readyBooks/providers';
import {loadCurrentPrintDirectory} from '@/services/book/readyBooks/printResources';
import type {PublishedBook} from '@/services/book/readyBooks/publication';
import type {PrintCityId,PrintCountry,PrintDirectory,PrintProvider} from '@/data/travelBooks/schema/providers';
import type {PrintProfile} from '@/types/readyBook';
import {cityKey,useProviderCopy,type ProviderCopy} from './providerCopy';

type Props = {profileId: PrintProfile['id']; bodyPageCount: number};

const BINDING_KEYS = {rings:'providerBindingRings',spiral:'providerBindingSpiral',stapled:'providerBindingStapled',
  glued:'providerBindingGlued',soft:'providerBindingSoft',hard:'providerBindingHard'} as const;
const COUNTRIES:readonly PrintCountry[]=['BY','PL'];
const FONT_KEYS = {'embedded-ok':'providerFontsEmbedded','outlines-required':'providerFontsOutlines',unknown:'providerFontsAsk'} as const;

/** Only capabilities the point's own website states; "unknown" is left out rather than guessed. */
function capabilityLines(provider:PrintProvider,t:ProviderCopy){
  const {printing}=provider;
  const printed=[printing.colour==='yes'&&t('providerColour'),printing.a4==='yes'&&'A4',printing.a5==='yes'&&'A5']
    .filter((value):value is string=>Boolean(value));
  return [
    printed.length?t('providerPrinting',{list:formatList(printed)}):undefined,
    printing.pdf==='yes'?t('providerFromPdf'):undefined,
    provider.bindings.length?t('providerBinding',{list:formatList(provider.bindings.map(binding=>t(BINDING_KEYS[binding])))}):undefined,
  ].filter((line):line is string=>Boolean(line));
}

export function PrintProvidersView({directory,profileId,bodyPageCount,initialCountry='BY',onProviderOpened,titleHidden=false}: Props & {directory:PrintDirectory;initialCountry?:PrintCountry;onProviderOpened?:(providerId:string)=>void;titleHidden?:boolean}) {
  const t=useProviderCopy();
  const [country,setCountry]=useState<PrintCountry>(initialCountry);
  const cities=listPrintCities(country,directory);
  const [selectedCity,setCity]=useState<PrintCityId|undefined>(cities[0]);
  const city=selectedCity&&cities.includes(selectedCity)?selectedCity:cities[0];
  const [openError,setOpenError]=useState(false);
  const locations=city?listPrintLocations(city,directory):[];
  const open=async(url:string,providerId:string)=>{
    setOpenError(false);
    if(!await openExternalUrlInNewTab(url))setOpenError(true);
    else onProviderOpened?.(providerId);
  };
  const changeCountry=(next:PrintCountry)=>{setCountry(next);setCity(listPrintCities(next,directory)[0]);};
  return <section aria-label={t('providerTitle')}>
    {!titleHidden&&<h2>{t('providerTitle')}</h2>}<p>{t('providerIntro')}</p>
    <p>{t('providerFormat',{format:t(profileId==='album-a5'?'providerAlbum':'providerPocket'),pages:formatNumber(bodyPageCount)})}</p>
    <p>{t('providerPreparation')}</p>
    <div role="group" aria-label={t('providerCountry')}>{COUNTRIES.map(id=><Chip key={id} label={t(id==='BY'?'providerBY':'providerPL')} selected={country===id} onPress={()=>changeCountry(id)}/>)}</div>
    {city&&<label>{t('providerCity')}<select value={city} onChange={event=>setCity(event.target.value as PrintCityId)}>
      {cities.map(id=><option key={id} value={id}>{t(cityKey(id))}</option>)}
    </select></label>}
    {locations.length?<ul>{locations.map(provider=><li key={provider.id}>
      <h3>{provider.name}</h3><p>{provider.address}</p>
      {capabilityLines(provider,t).map(line=><p key={line}>{line}</p>)}
      <p>{t(FONT_KEYS[provider.fontPolicy])}</p>
      <Button label={t('providerWebsite')} onPress={()=>void open(provider.url,provider.id)}/>
      <details><summary>{t('providerDetails')}</summary><ul>{provider.sourceUrls.map((url,index)=><li key={url}>
        <Button label={t('providerSource',{number:formatNumber(index+1)})} onPress={()=>void open(url,provider.id)}/>
      </li>)}</ul></details>
    </li>)}</ul>:<p>{t('providerEmpty')}</p>}
    {openError&&<p role="alert">{t('providerOpenError')}</p>}
    <p>{t('providerNoTransfer')}</p>
  </section>;
}

/** «Копицентры и типографии: 6 городов Беларуси и 10 городов Польши» from the current directory. */
export function providerSummary(directory:PrintDirectory,t:ProviderCopy){
  const count=(country:PrintCountry)=>listPrintCities(country,directory).length;
  const by=count('BY'),pl=count('PL');
  return t('providerSummary',{by:t('providerCitiesBY',{count:by,value:formatNumber(by)}),pl:t('providerCitiesPL',{count:pl,value:formatNumber(pl)})});
}

/**
 * `embedded` (edition page, #2948) puts the whole block inside a native `<details>` whose
 * summary names the coverage; the directory still loads once, on mount.
 */
export default function PrintProviders({book,embedded=false,...props}:Props & {book:PublishedBook;embedded?:boolean}){
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
  const view=state.directory
    ?<PrintProvidersView key={book.country} {...props} titleHidden={embedded} initialCountry={book.country} directory={state.directory} onProviderOpened={providerId=>trackReadyBookEvent('ReadyBookProviderOpened',book,getActiveLocale(),{profileId:props.profileId,providerId})}/>
    :<section aria-label={t('providerTitle')}>
      {!embedded&&<h2>{t('providerTitle')}</h2>}
      {state.failed?<><p role="alert">{t('providerLoadError')}</p><Button label={t('retry')} onPress={()=>setAttempt(value=>value+1)}/></>:<p role="status">{t('loadingPage')}</p>}
    </section>;
  if(!embedded)return view;
  return <details className="rbe-acc rbe-providers">
    <summary>
      <span className="rbe-acc-ic"><span className="rbe-i" aria-hidden="true"><Feather name="map-pin" size={20} color="currentColor"/></span></span>
      <span className="rbe-acc-txt"><span className="rbe-acc-title">{t('providerTitle')}</span>{state.directory&&<span className="rbe-acc-hint">{providerSummary(state.directory,t)}</span>}</span>
      <span className="rbe-acc-chev"><span className="rbe-i" aria-hidden="true"><Feather name="chevron-down" size={20} color="currentColor"/></span></span>
    </summary>
    <div className="rbe-acc-inner">{view}</div>
  </details>;
}
