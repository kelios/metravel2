import LegalPage from '@/components/legal/LegalPage'
import { translate as i18nT } from '@/i18n'


export default function TripRulesScreen() {
  return (
    <LegalPage
      headKey="legal-trip-rules"
      seoTitle={i18nT('trips:app.tabs.trip_rules.pravila_uchastiya_v_poezdkah_metravel_8cf61361')}
      seoDescription={i18nT('trips:app.tabs.trip_rules.pravila_uchastiya_v_sovmestnyh_poezdkah_metr_ab16b279')}
      pageTitle={i18nT('trips:app.tabs.trip_rules.pravila_uchastiya_v_poezdkah_30927e21')}
      effectiveDate="21.07.2026"
      intro={[
        i18nT('trips:app.tabs.trip_rules.eti_pravila_primenyayutsya_k_sovmestnym_poez_b36fb6ab'),
      ]}
      sections={[
        {
          heading: i18nT('trips:app.tabs.trip_rules.1_rol_metravel_f012fa79'),
          paragraphs: [
            i18nT('trips:app.tabs.trip_rules.metravel_predostavlyaet_ploschadku_dlya_pois_3061b785'),
            i18nT('trips:app.tabs.trip_rules.vse_usloviya_poezdki_marshrut_rashody_sroki__2dae8b64'),
          ],
        },
        {
          heading: i18nT('trips:app.tabs.trip_rules.2_organizatoram_cf9bca5f'),
          paragraphs: [
            i18nT('trips:app.tabs.trip_rules.ukazyvayte_dostovernuyu_informatsiyu_o_poezd_7237b770'),
            i18nT('trips:app.tabs.trip_rules.vy_otvechaete_za_korrektnost_opisaniya_i_za__92909a31'),
          ],
        },
        {
          heading: i18nT('trips:app.tabs.trip_rules.3_uchastnikam_872e798a'),
          paragraphs: [
            i18nT('trips:app.tabs.trip_rules.otsenivayte_svoyu_podgotovku_sostoyanie_zdor_355a7fe7'),
            i18nT('trips:app.tabs.trip_rules.samostoyatelno_proveryayte_informatsiyu_ob_o_2011acda'),
          ],
        },
        {
          heading: i18nT('trips:app.tabs.trip_rules.4_bezopasnost_i_kontakty_46f278fd'),
          paragraphs: [
            i18nT('trips:app.tabs.trip_rules.budte_ostorozhny_pri_obmene_kontaktami_i_lic_90040d8b'),
            i18nT('trips:app.tabs.trip_rules.pri_offlayn_vstrechah_vybirayte_bezopasnye_p_ba386bde'),
          ],
        },
        {
          heading: i18nT('trips:app.tabs.trip_rules.5_otvetstvennost_690c3d4d'),
          paragraphs: [
            i18nT('trips:app.tabs.trip_rules.servis_ne_neset_otvetstvennosti_za_deystviya_3abe0e4f'),
            i18nT('trips:app.tabs.trip_rules.spory_mezhdu_uchastnikami_razreshayutsya_imi_7510f719'),
          ],
        },
        {
          heading: i18nT('trips:app.tabs.trip_rules.6_kontakty_f7380129'),
          paragraphs: [
            i18nT('trips:app.tabs.trip_rules.soobschit_o_narushenii_ili_zadat_vopros_mozh_e676e21f'),
          ],
        },
      ]}
    />
  )
}
