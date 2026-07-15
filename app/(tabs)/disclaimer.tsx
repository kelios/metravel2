import LegalPage from '@/components/legal/LegalPage'
import { translate as i18nT } from '@/i18n'


export default function DisclaimerScreen() {
  return (
    <LegalPage
      headKey="legal-disclaimer"
      seoTitle={i18nT('legal:app.tabs.disclaimer.otkaz_ot_otvetstvennosti_metravel_afb39844')}
      seoDescription={i18nT('legal:app.tabs.disclaimer.otkaz_ot_otvetstvennosti_metravel_informatsi_5a2b8e74')}
      pageTitle={i18nT('legal:app.tabs.disclaimer.otkaz_ot_otvetstvennosti_3706532b')}
      effectiveDate="20.06.2026"
      draftNotice
      intro={[
        i18nT('legal:app.tabs.disclaimer.metravel_nekommercheskiy_proekt_dlya_obmena__096f27a4'),
      ]}
      sections={[
        {
          heading: i18nT('legal:app.tabs.disclaimer.1_aktualnost_informatsii_edc7bee1'),
          paragraphs: [
            i18nT('legal:app.tabs.disclaimer.opisaniya_mest_marshrutov_tsen_rezhimov_rabo_d3a39673'),
            i18nT('legal:app.tabs.disclaimer.pered_poezdkoy_samostoyatelno_proveryayte_ak_ecd7ab3c'),
          ],
        },
        {
          heading: i18nT('legal:app.tabs.disclaimer.2_samostoyatelnost_i_riski_006bfe69'),
          paragraphs: [
            i18nT('legal:app.tabs.disclaimer.lyubye_puteshestviya_prohozhdenie_kvestov_i__4f3efaa7'),
            i18nT('legal:app.tabs.disclaimer.servis_ne_neset_otvetstvennosti_za_travmy_us_96bd7aa6'),
            i18nT('legal:app.tabs.disclaimer.otsenivayte_svoyu_podgotovku_pogodnye_uslovi_3cdade22'),
          ],
        },
        {
          heading: i18nT('legal:app.tabs.disclaimer.3_polzovatelskiy_kontent_5f32583b'),
          paragraphs: [
            i18nT('legal:app.tabs.disclaimer.materialy_publikuyutsya_polzovatelyami_mneni_503bc73a'),
            i18nT('legal:app.tabs.disclaimer.servis_ne_proveryaet_kazhduyu_publikatsiyu_i_1138b189'),
          ],
        },
        {
          heading: i18nT('legal:app.tabs.disclaimer.4_vneshnie_ssylki_4232f482'),
          paragraphs: [
            i18nT('legal:app.tabs.disclaimer.sayt_mozhet_soderzhat_ssylki_na_storonnie_re_9d6ab905'),
          ],
        },
        {
          heading: i18nT('legal:app.tabs.disclaimer.5_kontakty_56aae803'),
          paragraphs: [
            i18nT('legal:app.tabs.disclaimer.po_voprosam_svyazannym_s_nastoyaschim_otkazo_473671f7'),
          ],
        },
      ]}
    />
  )
}
