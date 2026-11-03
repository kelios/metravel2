import React, {useEffect,useId,useState} from 'react';
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
import {EditionAccordion,EditionIcon} from '../edition/EditionParts.web';
import {cityKey,useProviderCopy,type ProviderCopy} from './providerCopy';
import {printProvidersCss} from './printProvidersStyles.web';

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

/**
 * Directory of print points: country + city controls, then one card per point. Styles are the
 * `rbe-pp-*` rules of `printProvidersCss` (mounted by the wrapper below); the host supplies the `.rbe` scope.
 */
export function PrintProvidersView({directory,profileId,bodyPageCount,initialCountry='BY',onProviderOpened,titleHidden=false}: Props & {directory:PrintDirectory;initialCountry?:PrintCountry;onProviderOpened?:(providerId:string)=>void;titleHidden?:boolean}) {
  const t=useProviderCopy();
  const cityId=useId();
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
  return <section className="rbe-pp" aria-label={t('providerTitle')}>
    {!titleHidden&&<h2>{t('providerTitle')}</h2>}
    <p className="rbe-pp-lead">{t('providerIntro')}</p>
    <div className="rbe-pp-note"><EditionIcon name="info" size={18}/><div>
      <p className="rbe-pp-format">{t('providerFormat',{format:t(profileId==='album-a5'?'providerAlbum':'providerPocket'),pages:formatNumber(bodyPageCount)})}</p>
      <p>{t('providerPreparation')}</p>
    </div></div>
    <div className="rbe-pp-controls">
      <div className="rbe-pp-seg" role="group" aria-label={t('providerCountry')}>{COUNTRIES.map(id=><Chip key={id} label={t(id==='BY'?'providerBY':'providerPL')} selected={country===id} onPress={()=>changeCountry(id)}/>)}</div>
      {city&&<div className="rbe-pp-city"><label htmlFor={cityId}>{t('providerCity')}</label><span className="rbe-pp-select">
        <select id={cityId} value={city} onChange={event=>setCity(event.target.value as PrintCityId)}>
          {cities.map(id=><option key={id} value={id}>{t(cityKey(id))}</option>)}
        </select><EditionIcon name="chevron-down" size={16}/>
      </span></div>}
    </div>
    {locations.length?<ul className="rbe-pp-list">{locations.map(provider=><li key={provider.id} className="rbe-pp-card">
      <h3>{provider.name}</h3>
      <p className="rbe-pp-addr"><EditionIcon name="map-pin" size={16}/><span>{provider.address}</span></p>
      <ul className="rbe-pp-facts">
        {capabilityLines(provider,t).map(line=><li key={line}><EditionIcon name="check" size={16}/><span>{line}</span></li>)}
        <li className={provider.fontPolicy==='embedded-ok'?undefined:'is-ask'}><EditionIcon name={provider.fontPolicy==='embedded-ok'?'check':'alert-circle'} size={16}/><span>{t(FONT_KEYS[provider.fontPolicy])}</span></li>
      </ul>
      <div className="rbe-pp-actions">
        <Button variant="outline" size="sm" icon=<EditionIcon name="external-link" size={16}/> label={t('providerWebsite')} accessibilityLabel={`${t('providerWebsite')}: ${provider.name}`} onPress={()=>void open(provider.url,provider.id)}/>
        <details className="rbe-pp-src"><summary>{t('providerDetails')}<span className="rbe-sr">: {provider.name}</span><EditionIcon name="chevron-down" size={16}/></summary><ul>{provider.sourceUrls.map((url,index)=><li key={url}>
          <Button variant="ghost" size="sm" label={t('providerSource',{number:formatNumber(index+1)})} onPress={()=>void open(url,provider.id)}/>
        </li>)}</ul></details>
      </div>
    </li>)}</ul>:<p className="rbe-pp-empty">{t('providerEmpty')}</p>}
    {openError&&<p className="rbe-pp-error" role="alert">{t('providerOpenError')}</p>}
    <p className="rbe-pp-foot"><EditionIcon name="shield" size={16}/><span>{t('providerNoTransfer')}</span></p>
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
  const styles=<style>{printProvidersCss}</style>;
  if(!embedded)return <>{styles}{view}</>;
  return <EditionAccordion className="rbe-providers" icon="map-pin" title={t('providerTitle')}
    hint={state.directory?providerSummary(state.directory,t):undefined}>
    {styles}{view}
  </EditionAccordion>;
}
