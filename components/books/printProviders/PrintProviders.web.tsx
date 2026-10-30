import React, {useEffect,useState} from 'react';
import Button from '@/components/ui/Button';
import {formatDate, formatList, formatNumber,translate,getActiveLocale} from '@/i18n';
import {trackReadyBookEvent} from '@/utils/growthFunnelAnalytics';
import {openExternalUrlInNewTab} from '@/utils/externalLinks';
import {resolvePrintProviders, bookPrintBindings, type ProviderMatch} from '@/services/book/readyBooks/providers';
import {loadPrintDirectory} from '@/services/book/readyBooks/printResources';
import type {PublishedBook} from '@/services/book/readyBooks/publication';
import type {PrintCountry,PrintDirectory} from '@/data/travelBooks/schema/providers';
import type {PrintProfile} from '@/types/readyBook';
import {useProviderCopy} from './providerCopy';

type Props = {profileId: PrintProfile['id']; bodyPageCount: number; artifactSha256?: string};
const exclusionCopy = {
  copies: 'providerExcludeCopies', format: 'providerExcludeFormat', binding: 'providerExcludeBinding',
  pages: 'providerExcludePages', ruPdf: 'providerExcludeRuPdf',
} as const;

export function PrintProvidersView({directory,profileId, bodyPageCount, artifactSha256,onProviderOpened}: Props & {directory:PrintDirectory;onProviderOpened?:(providerId:string)=>void}) {
  const t = useProviderCopy();
  const [country, setCountry] = useState<PrintCountry>('BY');
  const [city, setCity] = useState(()=>directory.cities.find(city=>city.country==='BY')!.name);
  const [copies, setCopies] = useState('1');
  const [binding, setBinding] = useState<PrintProfile['binding']>('spiral');
  const [openError, setOpenError] = useState(false);
  const availableBindings = bookPrintBindings(profileId);
  const selectedBinding = availableBindings.includes(binding) ? binding : availableBindings[0];
  const count = Number(copies);
  const validCopies = Number.isSafeInteger(count) && count >= 1;
  const matches = resolvePrintProviders({country, city, copies: count, profileId, bodyPageCount, binding: selectedBinding, artifactSha256},directory);
  const candidates = matches.filter(match => match.exclusions.length === 0);
  const excluded = matches.filter(match => match.exclusions.length > 0);
  const open = async (url: string,providerId:string) => {
    setOpenError(false);
    if (!await openExternalUrlInNewTab(url)) setOpenError(true);
    else onProviderOpened?.(providerId);
  };
  const providerRow = (match: ProviderMatch) => {
    const {provider} = match;
    const answer = provider.acceptsRuPdf === 'yes' ? 'providerYes' : provider.acceptsRuPdf === 'no' ? 'providerNo' : 'providerUnknown';
    return <li key={provider.id}>
      <h4>{provider.name}</h4>
      <p>{t(match.fulfillment === 'local' ? 'providerLocal' : 'providerDelivery', {city: provider.city})}</p>
      {match.exclusions.length > 0 && <ul>{match.exclusions.map(reason => <li key={reason}>{t(exclusionCopy[reason])}</li>)}</ul>}
      {match.confirmedFile && <p>{t('providerFileConfirmed')}</p>}
      <p>{provider.minimumCopies === null ? t('providerUnknownMinimum') : t('providerMinimum', {count: formatNumber(provider.minimumCopies)})}</p>
      <p>{t('providerRuPdf', {value: t(answer)})}</p>
      <p>{t('providerLanguages', {value: provider.contactLanguages.length ? formatList(provider.contactLanguages) : t('providerUnknown')})}</p>
      <p>{t('providerChecked', {date: formatDate(new Date(`${provider.checkedAt}T12:00:00Z`), {timeZone: 'UTC'})})}</p>
      <Button label={t('providerWebsite')} onPress={() => void open(provider.url,provider.id)}/>
      <details><summary>{t('providerDetails')}</summary>
        <p>{t('providerPageLimits', {min: provider.minimumBodyPages === null ? t('providerUnknown') : formatNumber(provider.minimumBodyPages), max: provider.maximumBodyPages === null ? t('providerUnknown') : formatNumber(provider.maximumBodyPages)})}</p>
        <ul>{provider.sourceUrls.map((url, index) => <li key={url}>
        <Button label={t('providerSource', {number: formatNumber(index + 1)})} onPress={() => void open(url,provider.id)}/>
      </li>)}</ul></details>
    </li>;
  };
  return <section aria-label={t('providerTitle')}>
    <h2>{t('providerTitle')}</h2><p>{t('providerIntro')}</p>
    <p className="ready-books-note">{t('providerDirectoryPending')}</p>
    <p>{t('providerFormat', {format: t(profileId === 'album-a5' ? 'providerAlbum' : 'providerPocket'), pages: formatNumber(bodyPageCount)})}</p>
    <div className="ready-books-controls">
      <label>{t('providerCountry')}<select value={country} onChange={event => {
        const next = event.target.value as PrintCountry;
        setCountry(next); setCity(directory.cities.find(item => item.country === next)!.name);
      }}><option value="BY">{t('providerBY')}</option><option value="PL">{t('providerPL')}</option></select></label>
      <label>{t('providerCity')}<select value={city} onChange={event => setCity(event.target.value)}>
        {directory.cities.filter(item => item.country === country).map(item => <option key={item.name} value={item.name}>{item.name}</option>)}
      </select></label>
      <label>{t('providerCopies')}<input type="number" min="1" step="1" inputMode="numeric" value={copies}
        aria-invalid={!validCopies} onChange={event => setCopies(event.target.value)} style={{width: '7em'}}/></label>
      <label>{t('providerBinding')}<select value={selectedBinding} onChange={event => setBinding(event.target.value as PrintProfile['binding'])}>
        {availableBindings.map(value => <option key={value} value={value}>{t(({spiral: 'providerSpiral', rings: 'providerRings', sewn: 'providerSewn'} as const)[value])}</option>)}
      </select></label>
    </div>
    {!validCopies ? <p role="status">{t('providerInvalidCopies')}</p> : <>
      <h3>{t('providerCandidates')}</h3>
      {candidates.length ? <ul>{candidates.map(providerRow)}</ul> : <p>{t('providerEmpty')}</p>}
      {excluded.length > 0 && <details><summary>{t('providerExcluded')}</summary><ul>{excluded.map(providerRow)}</ul></details>}
    </>}
    {openError && <p role="alert">{t('providerOpenError')}</p>}
    <p>{t('providerNoTransfer')}</p>
  </section>;
}


export default function PrintProviders({book,...props}:Props & {book:PublishedBook}){
  const t=useProviderCopy();
  const asset=book.printDirectory;
  const {id,revision}=book;
  const uri=asset?.uri,sha256=asset?.sha256,bytes=asset?.bytes,mime=asset?.mime;
  const key=`${book.id}:${book.revision}:${asset?.uri??''}:${asset?.sha256??''}:${asset?.bytes??0}:${asset?.mime??''}`;
  const [attempt,setAttempt]=useState(0);
  const [state,setState]=useState<{key:string;directory?:PrintDirectory;failed?:boolean}>({key:''});
  useEffect(()=>{
    if(uri===undefined||sha256===undefined||bytes===undefined||mime===undefined)return;
    const controller=new AbortController();
    setState({key});
    void loadPrintDirectory({id,revision,printDirectory:{uri,sha256,bytes,mime}},controller.signal).then(directory=>{
      if(!controller.signal.aborted)setState({key,directory});
    }).catch(()=>{if(!controller.signal.aborted)setState({key,failed:true});});
    return()=>controller.abort();
    // A format change reuses the same directory and preserves the user's filters.
  },[id,revision,uri,sha256,bytes,mime,key,attempt]);
  if(state.key===key&&state.directory)return <PrintProvidersView {...props} directory={state.directory} onProviderOpened={providerId=>trackReadyBookEvent('ReadyBookProviderOpened',book,getActiveLocale(),{profileId:props.profileId,providerId})}/>;
  return <section aria-label={t('providerTitle')}>
    <h2>{t('providerTitle')}</h2>
    {!asset?<p>{translate('books:pending')}</p>:state.key===key&&state.failed?<>
      <p role="alert">{translate('books:pageError')}</p>
      <Button label={translate('books:retry')} onPress={()=>setAttempt(value=>value+1)}/>
    </>:<p role="status">{translate('books:loadingPage')}</p>}
  </section>;
}
