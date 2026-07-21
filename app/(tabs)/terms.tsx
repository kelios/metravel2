import LegalPage from '@/components/legal/LegalPage'
import { translate as i18nT } from '@/i18n'


export default function TermsScreen() {
  return (
    <LegalPage
      headKey="legal-terms"
      seoTitle={i18nT('legal:app.tabs.terms.polzovatelskoe_soglashenie_metravel_a107cf93')}
      seoDescription={i18nT('legal:app.tabs.terms.polzovatelskoe_soglashenie_metravel_usloviya_860ebcea')}
      pageTitle={i18nT('legal:app.tabs.terms.polzovatelskoe_soglashenie_13d561c9')}
      effectiveDate="21.07.2026"
      intro={[
        i18nT('legal:app.tabs.terms.nastoyaschee_polzovatelskoe_soglashenie_regu_15e5e27a'),
        i18nT('legal:app.tabs.terms.relatedDocuments'),
      ]}
      sections={[
        {
          heading: i18nT('legal:app.tabs.terms.1_akkaunt_978a3a7c'),
          paragraphs: [
            i18nT('legal:app.tabs.terms.dlya_chasti_funktsiy_trebuetsya_registratsiy_40a945b7'),
            i18nT('legal:app.tabs.terms.minimumAge'),
            i18nT('legal:app.tabs.terms.vy_nesete_otvetstvennost_za_deystviya_sovers_86ded067'),
            i18nT('legal:app.tabs.terms.accountDeletion'),
          ],
        },
        {
          heading: i18nT('legal:app.tabs.terms.2_kontent_polzovateley_d2a6fead'),
          paragraphs: [
            i18nT('legal:app.tabs.terms.publikuya_materialy_teksty_fotografii_marshr_2e0c0e2a'),
            i18nT('legal:app.tabs.terms.vy_predostavlyaete_servisu_neisklyuchitelnoe_988417e0'),
            i18nT('legal:app.tabs.terms.zaprescheno_publikovat_nezakonnye_oskorbitel_bbb53e2a'),
            i18nT('legal:app.tabs.terms.contentComplaints'),
          ],
        },
        {
          heading: i18nT('legal:app.tabs.terms.3_dopustimoe_ispolzovanie_3835e5b1'),
          paragraphs: [
            i18nT('legal:app.tabs.terms.zapreschaetsya_vmeshivatsya_v_rabotu_servisa_5ecc50fe'),
            i18nT('legal:app.tabs.terms.administratsiya_vprave_ogranichit_ili_prekra_2a09028d'),
          ],
        },
        {
          heading: i18nT('legal:app.tabs.terms.4_otkaz_ot_garantiy_f275e5a0'),
          paragraphs: [
            i18nT('legal:app.tabs.terms.servis_predostavlyaetsya_kak_est_informatsiy_f035abaa'),
            i18nT('legal:app.tabs.terms.my_ne_garantiruem_bespereboynuyu_rabotu_serv_861a559b'),
          ],
        },
        {
          heading: i18nT('legal:app.tabs.terms.5_personalnye_dannye_0accb3bd'),
          paragraphs: [
            i18nT('legal:app.tabs.terms.obrabotka_personalnyh_dannyh_opisana_v_polit_d54a3f2b'),
          ],
        },
        {
          heading: i18nT('legal:app.tabs.terms.6_izmeneniya_2e26ccb0'),
          paragraphs: [
            i18nT('legal:app.tabs.terms.usloviya_soglasheniya_mogut_obnovlyatsya_pro_ed813383'),
            i18nT('legal:app.tabs.terms.changesNotice'),
          ],
        },
        {
          heading: i18nT('legal:app.tabs.terms.governingLawHeading'),
          paragraphs: [
            i18nT('legal:app.tabs.terms.governingLaw'),
            i18nT('legal:app.tabs.terms.disputeResolution'),
          ],
        },
        {
          heading: i18nT('legal:app.tabs.terms.7_kontakty_4e2c6ee8'),
          paragraphs: [i18nT('legal:app.tabs.terms.po_voprosam_svyazannym_s_soglasheniem_pishit_9361863c')],
        },
      ]}
    />
  )
}
