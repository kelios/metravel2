import LegalPage from '@/components/legal/LegalPage'
import { translate as i18nT } from '@/i18n'


export default function PrivacyScreen() {
  return (
    <LegalPage
      headKey="privacy-policy"
      seoTitle={i18nT('legal:app.tabs.privacy.politika_konfidentsialnosti_i_obrabotka_dann_92a2b75f')}
      seoDescription={i18nT('legal:app.tabs.privacy.podrobnaya_politika_konfidentsialnosti_metra_8843276e')}
      pageTitle={i18nT('legal:app.tabs.privacy.politika_konfidentsialnosti_695191e7')}
      effectiveDate="21.07.2026"
      sections={[
        {
          heading: i18nT('legal:app.tabs.privacy.1_kto_my_3a41f887'),
          paragraphs: [
            i18nT('legal:app.tabs.privacy.kontrolerom_personalnyh_dannyh_yavlyaetsya_c_815ce399'),
            i18nT('legal:app.tabs.privacy.sayt_upravlyaetsya_iz_respubliki_belarus_nes_b83d839b'),
          ],
        },
        {
          heading: i18nT('legal:app.tabs.privacy.2_kakie_dannye_my_obrabatyvaem_efe4f0d3'),
          paragraphs: [
            i18nT('legal:app.tabs.privacy.pri_registratsii_i_ispolzovanii_akkaunta_my__5008631d'),
            i18nT('legal:app.tabs.privacy.dopolnitelno_obrabatyvayutsya_dannye_autenti_9127f1c1'),
            i18nT('legal:app.tabs.privacy.communicationsData'),
            i18nT('legal:app.tabs.privacy.pushTokenData'),
          ],
        },
        {
          heading: i18nT('legal:app.tabs.privacy.3_tseli_i_pravovye_osnovaniya_obrabotki_e4d0afa1'),
          paragraphs: [
            i18nT('legal:app.tabs.privacy.osnovnye_tseli_obrabotki_vklyuchayut_499189dd'),
            i18nT('legal:app.tabs.privacy.predostavlenie_i_podderzhku_raboty_servisa_s_cf95b9d6'),
            i18nT('legal:app.tabs.privacy.obespechenie_bezopasnosti_servisa_predotvras_caa9be6c'),
            i18nT('legal:app.tabs.privacy.ispolzovanie_analitiki_naprimer_yandeks_metr_7215ad5d'),
            i18nT('legal:app.tabs.privacy.vypolnenie_otdelnyh_yuridicheskih_obyazatels_58b121b6'),
          ],
        },
        {
          heading: i18nT('legal:app.tabs.privacy.4_cookies_i_lokalnoe_hranilische_8c993f3f'),
          paragraphs: [
            i18nT('legal:app.tabs.privacy.my_ispolzuem_tehnicheski_neobhodimye_fayly_c_86b4b204'),
            i18nT('legal:app.tabs.privacy.analiticheskie_instrumenty_takie_kak_yandeks_03d8dc46'),
          ],
        },
        {
          heading: i18nT('legal:app.tabs.privacy.5_obrabotka_dannyh_o_mestopolozhenii_131076ea'),
          paragraphs: [
            i18nT('legal:app.tabs.privacy.my_mozhem_zaprashivat_dostup_k_vashemu_prime_03ad6ba6'),
          ],
        },
        {
          heading: i18nT('legal:app.tabs.privacy.6_mezhdunarodnaya_peredacha_dannyh_c1c2408c'),
          paragraphs: [
            i18nT('legal:app.tabs.privacy.nashi_servery_i_infrastruktura_mogut_raspola_fd4ab957'),
            i18nT('legal:app.tabs.privacy.v_takih_sluchayah_my_po_vozmozhnosti_ispolzu_ab3bdb8e'),
          ],
        },
        {
          heading: i18nT('legal:app.tabs.privacy.7_sroki_hraneniya_dannyh_d65c1bc0'),
          paragraphs: [
            i18nT('legal:app.tabs.privacy.my_hranim_personalnye_dannye_ne_dolshe_chem__0a1ebee0'),
          ],
        },
        {
          heading: i18nT('legal:app.tabs.privacy.8_vashi_prava_8c551843'),
          paragraphs: [
            i18nT('legal:app.tabs.privacy.v_sootvetstvii_s_primenimym_zakonodatelstvom_231e7416'),
            i18nT('legal:app.tabs.privacy.selfServiceRights'),
            i18nT('legal:app.tabs.privacy.dlya_realizatsii_svoih_prav_vy_mozhete_svyaz_b024d59a'),
          ],
        },
        {
          heading: i18nT('legal:app.tabs.privacy.minorsHeading'),
          paragraphs: [i18nT('legal:app.tabs.privacy.minorsPolicy')],
        },
        {
          heading: i18nT('legal:app.tabs.privacy.policyChangesHeading'),
          paragraphs: [i18nT('legal:app.tabs.privacy.policyChanges')],
        },
        {
          heading: i18nT('legal:app.tabs.privacy.9_kontakty_2b536753'),
          paragraphs: [
            i18nT('legal:app.tabs.privacy.po_voprosam_svyazannym_s_obrabotkoy_personal_5da4d840'),
          ],
        },
      ]}
    />
  )
}
