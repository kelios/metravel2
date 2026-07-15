import { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useIsFocused } from 'expo-router';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { useThemedColors } from '@/hooks/useTheme';
import { webTouchScrollStyle } from '@/utils';
import { translate as i18nT } from '@/i18n'


export default function PrivacyScreen() {
  const pathname = usePathname();
  const isFocused = useIsFocused();
  const { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } = require('@/utils/seo');
  const canonical = buildCanonicalUrl(pathname || '/privacy');
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const title = i18nT('legal:app.tabs.privacy.politika_konfidentsialnosti_i_obrabotka_dann_92a2b75f');
  const description = i18nT('legal:app.tabs.privacy.podrobnaya_politika_konfidentsialnosti_metra_8843276e');

  return (
    <View style={styles.root}>
      {isFocused && (
        <InstantSEO
          headKey="privacy-policy"
          title={title}
          description={description}
          canonical={canonical}
          image={buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)}
          ogType="website"
        />
      )}
      <ScrollView
        style={webTouchScrollStyle}
        contentContainerStyle={styles.container}
        {...(Platform.OS === 'web' ? ({ tabIndex: 0 } as any) : {})}
      >
        {Platform.OS === 'web' && (
            <h1 style={{
                position: 'absolute' as const,
                width: 1,
                height: 1,
                padding: 0,
                margin: -1,
                overflow: 'hidden' as const,
                clip: 'rect(0,0,0,0)',
                whiteSpace: 'nowrap',
                borderWidth: 0,
            } as any}>{title}</h1>
        )}
        <Text style={styles.heading}>{i18nT('legal:app.tabs.privacy.politika_konfidentsialnosti_695191e7')}</Text>

        <Text style={styles.paragraph}>{i18nT('legal:app.tabs.privacy.data_vstupleniya_v_silu_27_11_2025_4dfc32f2')}</Text>

        <Text style={styles.subheading}>{i18nT('legal:app.tabs.privacy.1_kto_my_3a41f887')}</Text>
        <Text style={styles.paragraph}>
          {i18nT('legal:app.tabs.privacy.kontrolerom_personalnyh_dannyh_yavlyaetsya_c_815ce399')}</Text>
        <Text style={styles.paragraph}>
          {i18nT('legal:app.tabs.privacy.sayt_upravlyaetsya_iz_respubliki_belarus_nes_b83d839b')}</Text>

        <Text style={styles.subheading}>{i18nT('legal:app.tabs.privacy.2_kakie_dannye_my_obrabatyvaem_efe4f0d3')}</Text>
        <Text style={styles.paragraph}>
          {i18nT('legal:app.tabs.privacy.pri_registratsii_i_ispolzovanii_akkaunta_my__5008631d')}</Text>
        <Text style={styles.paragraph}>
          {i18nT('legal:app.tabs.privacy.dopolnitelno_obrabatyvayutsya_dannye_autenti_9127f1c1')}</Text>
        <Text style={styles.paragraph}>
          {i18nT('legal:app.tabs.privacy.my_mozhem_zaprashivat_dostup_k_vashemu_prime_05355f82')}</Text>

        <Text style={styles.subheading}>{i18nT('legal:app.tabs.privacy.3_tseli_i_pravovye_osnovaniya_obrabotki_e4d0afa1')}</Text>
        <Text style={styles.paragraph}>
          {i18nT('legal:app.tabs.privacy.osnovnye_tseli_obrabotki_vklyuchayut_499189dd')}</Text>
        <Text style={styles.paragraph}>
          {i18nT('legal:app.tabs.privacy.predostavlenie_i_podderzhku_raboty_servisa_s_cf95b9d6')}</Text>
        <Text style={styles.paragraph}>
          {i18nT('legal:app.tabs.privacy.obespechenie_bezopasnosti_servisa_predotvras_caa9be6c')}</Text>
        <Text style={styles.paragraph}>
          {i18nT('legal:app.tabs.privacy.ispolzovanie_analitiki_naprimer_yandeks_metr_7215ad5d')}</Text>
        <Text style={styles.paragraph}>
          {i18nT('legal:app.tabs.privacy.vypolnenie_otdelnyh_yuridicheskih_obyazatels_58b121b6')}</Text>

        <Text style={styles.subheading}>{i18nT('legal:app.tabs.privacy.4_cookies_i_lokalnoe_hranilische_8c993f3f')}</Text>
        <Text style={styles.paragraph}>
          {i18nT('legal:app.tabs.privacy.my_ispolzuem_tehnicheski_neobhodimye_fayly_c_86b4b204')}</Text>
        <Text style={styles.paragraph}>
          {i18nT('legal:app.tabs.privacy.analiticheskie_instrumenty_takie_kak_yandeks_03d8dc46')}</Text>

        <Text style={styles.subheading}>{i18nT('legal:app.tabs.privacy.5_obrabotka_dannyh_o_mestopolozhenii_131076ea')}</Text>
        <Text style={styles.paragraph}>
          {i18nT('legal:app.tabs.privacy.my_mozhem_zaprashivat_dostup_k_vashemu_prime_03ad6ba6')}</Text>

        <Text style={styles.subheading}>{i18nT('legal:app.tabs.privacy.6_mezhdunarodnaya_peredacha_dannyh_c1c2408c')}</Text>
        <Text style={styles.paragraph}>
          {i18nT('legal:app.tabs.privacy.nashi_servery_i_infrastruktura_mogut_raspola_fd4ab957')}</Text>
        <Text style={styles.paragraph}>
          {i18nT('legal:app.tabs.privacy.v_takih_sluchayah_my_po_vozmozhnosti_ispolzu_ab3bdb8e')}</Text>

        <Text style={styles.subheading}>{i18nT('legal:app.tabs.privacy.7_sroki_hraneniya_dannyh_d65c1bc0')}</Text>
        <Text style={styles.paragraph}>
          {i18nT('legal:app.tabs.privacy.my_hranim_personalnye_dannye_ne_dolshe_chem__0a1ebee0')}</Text>

        <Text style={styles.subheading}>{i18nT('legal:app.tabs.privacy.8_vashi_prava_8c551843')}</Text>
        <Text style={styles.paragraph}>
          {i18nT('legal:app.tabs.privacy.v_sootvetstvii_s_primenimym_zakonodatelstvom_231e7416')}</Text>
        <Text style={styles.paragraph}>
          {i18nT('legal:app.tabs.privacy.dlya_realizatsii_svoih_prav_vy_mozhete_svyaz_b024d59a')}</Text>

        <Text style={styles.subheading}>{i18nT('legal:app.tabs.privacy.9_kontakty_2b536753')}</Text>
        <Text style={styles.paragraph}>
          {i18nT('legal:app.tabs.privacy.po_voprosam_svyazannym_s_obrabotkoy_personal_5da4d840')}</Text>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    maxWidth: 900,
    alignSelf: 'center',
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  subheading: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 20,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginBottom: 8,
  },
});
