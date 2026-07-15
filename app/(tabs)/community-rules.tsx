import LegalPage from '@/components/legal/LegalPage'
import { translate as i18nT } from '@/i18n'


export default function CommunityRulesScreen() {
  return (
    <LegalPage
      headKey="legal-community-rules"
      seoTitle={i18nT('legal:app.tabs.community_rules.pravila_soobschestva_metravel_431ec805')}
      seoDescription={i18nT('legal:app.tabs.community_rules.pravila_soobschestva_metravel_kak_my_obschae_f024d655')}
      pageTitle={i18nT('legal:app.tabs.community_rules.pravila_soobschestva_24954009')}
      effectiveDate="20.06.2026"
      draftNotice
      intro={[
        i18nT('legal:app.tabs.community_rules.metravel_soobschestvo_puteshestvennikov_eti__5869b99f'),
      ]}
      sections={[
        {
          heading: i18nT('legal:app.tabs.community_rules.1_uvazhenie_175f0e97'),
          paragraphs: [
            i18nT('legal:app.tabs.community_rules.obschaytes_vezhlivo_nedopustimy_oskorbleniya_5f520fc8'),
          ],
        },
        {
          heading: i18nT('legal:app.tabs.community_rules.2_poleznyy_i_chestnyy_kontent_9e163e56'),
          paragraphs: [
            i18nT('legal:app.tabs.community_rules.delites_realnym_opytom_ne_publikuyte_zavedom_f8da4bfb'),
            i18nT('legal:app.tabs.community_rules.ukazyvayte_istochniki_i_preduprezhdayte_o_ri_b1f22a80'),
          ],
        },
        {
          heading: i18nT('legal:app.tabs.community_rules.3_chto_zaprescheno_5fc0fb1b'),
          paragraphs: [
            i18nT('legal:app.tabs.community_rules.spam_navyazchivaya_reklama_i_massovye_rassyl_1b93e204'),
            i18nT('legal:app.tabs.community_rules.nezakonnyy_kontent_prizyvy_k_nasiliyu_materi_9967ee37'),
            i18nT('legal:app.tabs.community_rules.publikatsiya_personalnyh_dannyh_tretih_lits__8a4a1747'),
            i18nT('legal:app.tabs.community_rules.narushenie_avtorskih_prav_na_teksty_i_fotogr_6edf738a'),
          ],
        },
        {
          heading: i18nT('legal:app.tabs.community_rules.4_bezopasnost_9b47b855'),
          paragraphs: [
            i18nT('legal:app.tabs.community_rules.metravel_ne_proveryaet_podlinnost_akkauntov__63be411b'),
            i18nT('legal:app.tabs.community_rules.ne_peredavayte_neznakomym_lyudyam_konfidents_012d884b'),
          ],
        },
        {
          heading: i18nT('legal:app.tabs.community_rules.5_moderatsiya_535cd1db'),
          paragraphs: [
            i18nT('legal:app.tabs.community_rules.narusheniya_mogut_privodit_k_udaleniyu_konte_19c5a5d5'),
            i18nT('legal:app.tabs.community_rules.soobschit_o_narushenii_mozhno_po_adresu_metr_6a4f0f8b'),
          ],
        },
      ]}
    />
  )
}
