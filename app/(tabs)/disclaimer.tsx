import LegalPage from '@/components/legal/LegalPage'
import { useTranslation } from '@/i18n/LocaleProvider'
import { translate as i18nT } from '@/i18n'
import { routeMetadata } from '@/utils/seoRoutes/routeMetadata'
import { DEFAULT_OG_IMAGE_PATH } from '@/utils/seo'

// #2740: единый источник SEO маршрута — экран (LegalPage) и generateMetadata()
const DISCLAIMER_SEO = {
  titleKey: 'legal:app.tabs.disclaimer.otkaz_ot_otvetstvennosti_metravel_afb39844',
  descriptionKey: 'legal:app.tabs.disclaimer.otkaz_ot_otvetstvennosti_metravel_informatsi_5a2b8e74',
  canonical: '/disclaimer',
} as const

export default function DisclaimerScreen() {
  const { t } = useTranslation()

  return (
    <LegalPage
      headKey="legal-disclaimer"
      seoTitle={t(DISCLAIMER_SEO.titleKey)}
      seoDescription={t(DISCLAIMER_SEO.descriptionKey)}
      pageTitle={t('legal:app.tabs.disclaimer.otkaz_ot_otvetstvennosti_3706532b')}
      effectiveDate="21.07.2026"
      intro={[
        t('legal:app.tabs.disclaimer.metravel_nekommercheskiy_proekt_dlya_obmena__096f27a4'),
      ]}
      sections={[
        {
          heading: t('legal:app.tabs.disclaimer.1_aktualnost_informatsii_edc7bee1'),
          paragraphs: [
            t('legal:app.tabs.disclaimer.opisaniya_mest_marshrutov_tsen_rezhimov_rabo_d3a39673'),
            t('legal:app.tabs.disclaimer.pered_poezdkoy_samostoyatelno_proveryayte_ak_ecd7ab3c'),
          ],
        },
        {
          heading: t('legal:app.tabs.disclaimer.2_samostoyatelnost_i_riski_006bfe69'),
          paragraphs: [
            t('legal:app.tabs.disclaimer.lyubye_puteshestviya_prohozhdenie_kvestov_i__4f3efaa7'),
            t('legal:app.tabs.disclaimer.servis_ne_neset_otvetstvennosti_za_travmy_us_96bd7aa6'),
            t('legal:app.tabs.disclaimer.otsenivayte_svoyu_podgotovku_pogodnye_uslovi_3cdade22'),
          ],
        },
        {
          heading: t('legal:app.tabs.disclaimer.aiUsageHeading'),
          paragraphs: [
            t('legal:app.tabs.disclaimer.aiQuestAndContentUsage'),
            t('legal:app.tabs.disclaimer.aiAuthorExperience'),
            t('legal:app.tabs.disclaimer.aiAccuracyAndFeedback'),
          ],
        },
        {
          heading: t('legal:app.tabs.disclaimer.3_polzovatelskiy_kontent_5f32583b'),
          paragraphs: [
            t('legal:app.tabs.disclaimer.materialy_publikuyutsya_polzovatelyami_mneni_503bc73a'),
            t('legal:app.tabs.disclaimer.servis_ne_proveryaet_kazhduyu_publikatsiyu_i_1138b189'),
          ],
        },
        {
          heading: t('legal:app.tabs.disclaimer.4_vneshnie_ssylki_4232f482'),
          paragraphs: [
            t('legal:app.tabs.disclaimer.sayt_mozhet_soderzhat_ssylki_na_storonnie_re_9d6ab905'),
          ],
        },
        {
          heading: t('legal:app.tabs.disclaimer.5_kontakty_56aae803'),
          paragraphs: [
            t('legal:app.tabs.disclaimer.po_voprosam_svyazannym_s_nastoyaschim_otkazo_473671f7'),
          ],
        },
      ]}
    />
  )
}

// #2740: head статического HTML объявляет маршрут (Expo SDK 58 пишет его из
// generateMetadata, helmet в экспорт больше не попадает); строки те же, что у экрана
export function generateMetadata() {
  return routeMetadata({
    title: i18nT(DISCLAIMER_SEO.titleKey),
    description: i18nT(DISCLAIMER_SEO.descriptionKey),
    canonical: DISCLAIMER_SEO.canonical,
    image: DEFAULT_OG_IMAGE_PATH,
    ogType: 'website',
  })
}
