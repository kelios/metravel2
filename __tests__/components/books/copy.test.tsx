import React from 'react';
import {act,render,screen} from '@testing-library/react';
import {i18n,getFixedTranslator} from '@/i18n';
import {formatReadyBookCounts,useBookCopy} from '@/components/books/bookCopy';

function Copy(){const t=useBookCopy();return <span>{t('download')}</span>;}
function EditionCopy(){
  const t=useBookCopy();
  return <><span data-testid="metadata-loading">{t('metadataLoading')}</span><span data-testid="metadata-error">{t('metadataError')}</span><span data-testid="quest-counts">{t('questCounts',{volume:'1',quests:'41',pages:'174'})}</span><span data-testid="quest-photo-space">{t('questPhotoSpace')}</span></>;
}
function CountCopy(){
  const t=useBookCopy();
  return <><span data-testid="place-counts">{formatReadyBookCounts({kind:'places',stopCount:12345,bodyPageCount:67890},t)}</span><span data-testid="volume-counts">{formatReadyBookCounts({kind:'quests',stopCount:37,bodyPageCount:156,volume:2},t)}</span></>;
}
describe('book controls follow the active interface language',()=>{
  afterEach(async()=>{await act(async()=>{await i18n.changeLanguage('ru');});});
  it('updates an already mounted control without remounting the book',async()=>{
    await i18n.changeLanguage('ru');
    render(<Copy/>);
    expect(screen.getByText('Скачать')).toBeTruthy();
    await act(async()=>{await i18n.changeLanguage('en');});
    expect(screen.getByText('Download')).toBeTruthy();
  });
  it('renders metadata states and quest copy through the real mapping after each interface-language change',async()=>{
    await i18n.changeLanguage('ru');
    render(<EditionCopy/>);
    for(const locale of ['ru','be','uk','pl','en'] as const){
      await act(async()=>{await i18n.changeLanguage(locale);});
      const t=getFixedTranslator(locale);
      expect(screen.getByTestId('metadata-loading').textContent).toBe(t('books:metadataLoading'));
      expect(screen.getByTestId('metadata-error').textContent).toBe(t('books:metadataError'));
      expect(screen.getByTestId('quest-counts').textContent).toBe(t('books:questCounts',{volume:'1',quests:'41',pages:'174'}));
      expect(screen.getByTestId('quest-counts').textContent).toContain('41');
      expect(screen.getByTestId('quest-photo-space').textContent).toBe(t('books:questPhotoSpace'));
    }
  });
  it('keeps place and quest-volume counts distinct and reformats an already mounted summary on locale changes',async()=>{
    await i18n.changeLanguage('ru');
    render(<CountCopy/>);
    for(const locale of ['ru','be','uk','pl','en'] as const){
      await act(async()=>{await i18n.changeLanguage(locale);});
      const t=getFixedTranslator(locale),numbers=new Intl.NumberFormat(locale);
      expect(screen.getByTestId('place-counts').textContent).toBe(t('books:counts',{places:numbers.format(12345),pages:numbers.format(67890)}));
      expect(screen.getByTestId('volume-counts').textContent).toBe(t('books:questCounts',{quests:'37',pages:'156',volume:'2'}));
    }
  });
});

it.each(['ru','be','uk','pl','en'])('interpolates dynamic book counts and names files without release-audit wording in %s',locale=>{
  const t=getFixedTranslator(locale);
  const counts=t('books:counts',{places:'31',pages:'108'});
  expect(counts).toContain('31');
  expect(counts).toContain('108');
  expect(t('books:language')).not.toContain('12');
  // The books are final editions: public file names carry no trial/test wording (#2944).
  for(const key of ['books:shop','books:control','books:body','books:rings','books:sewn','books:guideGeneric']){
    expect(t(key)).not.toBe(key);
    expect(t(key)).not.toMatch(/пробн|тэст|тест|test|trial|próbn|ppi/i);
  }
  expect(t('books:kilobytes')).not.toBe('books:kilobytes');
});

// Edition page redesign (#2948): every new label exists in all five interface languages,
// and every counted label is a complete plural family (one/few/many/other).
const EDITION_KEYS=['heroEyebrow','heroCoverAlt','promiseByCountry','promisePlCountry','promisePlCastles','promisePlMountains','promiseByQuests','promisePlQuests','chipsLabel','chipFree','chipNoSignup','chipPdfRu','ctaDownload','ctaRead','ctaOtherOptions','stickyDownload','stickyRead','stickyLabel','howTitle','howLead','howLeadQuests','howPlace','howPlaceText','howQuest','howQuestText','howPhotos','howPhotosPocket','howPhotosAlbum','howMemories','howMemoriesText','howMemoriesQuestText','chooseTitle','chooseLead','chooseLeadSize','styleWatercolorHint','stylePhotoHint','stylePhotoSourcesHint','styleGraphicHint','styleFantasyHint','sizePocketTitle','sizePocketHint','sizeAlbumTitle','sizeAlbumHint','sizePocketShort','sizeAlbumShort','routeTitle','routeTitleQuests','routeLead','routeLeadQuests','routePage','routeCollapse','coverSectionTitle','coverSectionHint','downloadLead','fileWhole','fileWholeHint','fileStickers','fileStickersHint','fileStickersQuestHint','printFiles','printFilesHint','groupShop','groupShopHint','groupShopSameBody','groupShopSameCover','groupRings','groupRingsHint','groupSewn','groupSewnHint','groupControl','groupControlHint','controlBody','controlCover','versionDate','versionMonth','guideLead','pathHome','pathHomeText','pathHomeFiles','pathCopy','pathCopyText','pathCopyFiles','pathPress','pathPressText','pathMore','pathStepHome1','pathStepHome2','pathStepHome3','pathStepCopy1','pathStepCopy2','pathStepCopy3','pathStepPress1','pathStepPress2','pathStepPress3','providerSummary','faqTitle','faqFreeQ','faqFreeA','faqSignupQ','faqSignupA','faqPaperQ','faqPaperA','faqPhotosQ','faqPhotosA','faqLanguageQ','faqLanguageA','moreTitle'];
const EDITION_PLURALS=['chipPlaces','chipQuests','chipPages','sheetCount','routeShowAll','routeShowAllQuests','providerCitiesBY','providerCitiesPL'];
it.each(['ru','be','uk','pl','en'])('carries every edition-page label and plural family in %s',locale=>{
  const t=getFixedTranslator(locale);
  // A missing key falls back to the RU «перевод недоступен» text in every locale.
  const missing=getFixedTranslator('ru')('common:i18n.missingTranslation' as never);
  for(const key of EDITION_KEYS){
    const value=t(`books:${key}` as never);
    expect([key,value]).not.toEqual([key,missing]);
    expect(value).not.toBe(`books:${key}`);
  }
  for(const key of EDITION_PLURALS)for(const form of ['','_one','_few','_many','_other']){
    expect([key+form,t(`books:${key}${form}` as never,{value:'7'})]).toEqual([key+form,expect.stringContaining('7')]);
  }
  // The approved page drops the gifting/selling answer and the release-audit wording.
  expect(t('books:faqGiftQ' as never)).toBe(missing);
  for(const key of ['fileWhole','printFiles','groupShop','groupRings','groupControl'])expect(t(`books:${key}` as never)).not.toMatch(/тэст|тест|test|trial|ppi/i);
});
it('registers the new labels in the literal-key copy map',()=>{
  const source=require('node:fs').readFileSync(require('node:path').resolve(__dirname,'../../../components/books/bookCopy.ts'),'utf8');
  for(const key of [...EDITION_KEYS.filter(key=>key!=='providerSummary'),...EDITION_PLURALS.filter(key=>!key.startsWith('providerCities'))]){
    expect(source).toMatch(new RegExp(`\\n  ${key}: \\(params\\?: TranslationParams\\) => translate(Plural)?\\('books:${key}'`));
  }
});
