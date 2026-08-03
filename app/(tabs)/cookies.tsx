import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, Pressable } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useIsFocused } from 'expo-router';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { useThemedColors } from '@/hooks/useTheme';
import { webTouchScrollStyle } from '@/utils';
import { translate as i18nT } from '@/i18n'

const CONSENT_KEY = 'metravel_consent_v1';

interface ConsentState {
  necessary: boolean;
  analytics: boolean;
  date: string;
}

const isWeb = Platform.OS === 'web';

function readConsent(): ConsentState | null {
  if (!isWeb || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.necessary) return null;
    const analytics = typeof (parsed as any).analytics === 'boolean' ? (parsed as any).analytics : false;
    return {
      necessary: !!parsed.necessary,
      analytics: !!analytics,
      date: parsed.date || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function writeConsent(consent: ConsentState) {
  if (!isWeb || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
  } catch {
    // ignore
  }
}

export default function CookieSettingsScreen() {
  const pathname = usePathname();
  const router = useRouter();
  const isFocused = useIsFocused();
  const { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } = require('@/utils/seo');
  const canonical = buildCanonicalUrl(pathname || '/cookies');
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [analyticsAllowed, setAnalyticsAllowed] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isWeb || typeof window === 'undefined') return;
    const existing = readConsent();
    if (existing) {
      setAnalyticsAllowed(existing.analytics);
    } else {
      // Opt-in: если ничего не сохранено, аналитика выключена до явного согласия.
      setAnalyticsAllowed(false);
    }
  }, []);

  const handleSave = () => {
    if (!isWeb || analyticsAllowed === null) return;
    const consent: ConsentState = {
      necessary: true,
      analytics: analyticsAllowed,
      date: new Date().toISOString(),
    };
    writeConsent(consent);

    if (typeof window !== 'undefined') {
      const gaId = (window as any).__metravelGaId;
      if (gaId) {
        try {
          (window as any)[`ga-disable-${String(gaId)}`] = !analyticsAllowed;
        } catch {
          // ignore
        }
      }
      if (analyticsAllowed && (window as any).metravelLoadAnalytics) {
        try {
          (window as any).metravelLoadAnalytics();
        } catch {
          // ignore
        }
      }
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 1000);
  };

  const title = i18nT('legal:app.tabs.cookies.nastroyki_cookies_i_analitiki_metravel_7ef0a94f');
  const description = i18nT('legal:app.tabs.cookies.stranitsa_upravleniya_nastroykami_cookies_i__b15f3958');

  return (
    <View style={styles.root}>
      {isFocused && (
        <InstantSEO
          headKey="cookie-settings"
          title={title}
          description={description}
          canonical={canonical}
          image={buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)}
          ogType="website"
          robots="noindex, nofollow"
        />
      )}
      <ScrollView style={webTouchScrollStyle} contentContainerStyle={styles.container}>
        {isWeb ? (
          <>
            <Text style={styles.heading}>{i18nT('legal:app.tabs.cookies.nastroyki_cookies_i_analitiki_0d2fbf1e')}</Text>
            <Text style={styles.paragraph}>
              {i18nT('legal:app.tabs.cookies.na_etom_ekrane_vy_mozhete_izmenit_svoy_vybor_b082f7b9')}</Text>

            <View style={styles.block}>
              <Text style={styles.subheading}>{i18nT('legal:app.tabs.cookies.obyazatelnye_fayly_b2bdbb34')}</Text>
              <Text style={styles.paragraph}>
                {i18nT('legal:app.tabs.cookies.obyazatelnye_cookies_i_lokalnoe_hranilische__36de273d')}</Text>
            </View>

            <View style={styles.block}>
              <Text style={styles.subheading}>{i18nT('legal:app.tabs.cookies.analiticheskie_instrumenty_58a1013f')}</Text>
              <Text style={styles.paragraph}>
                {i18nT('legal:app.tabs.cookies.analitika_pomogaet_luchshe_ponimat_kakie_mat_21a560d1')}</Text>

              <View style={styles.optionGroup}>
                <Pressable
                  style={[styles.option, analyticsAllowed === false && styles.optionSelected]}
                  onPress={() => setAnalyticsAllowed(false)}
                >
                  <View style={styles.radioOuter}>
                    {analyticsAllowed === false && <View style={styles.radioInner} />}
                  </View>
                  <View style={styles.optionTextWrap}>
                    <Text style={styles.optionTitle}>{i18nT('legal:app.tabs.cookies.tolko_neobhodimye_99bdc974')}</Text>
                    <Text style={styles.optionDescription}>
                      {i18nT('legal:app.tabs.cookies.analiticheskie_instrumenty_otklyucheny_ispol_528afb5f')}</Text>
                  </View>
                </Pressable>

                <Pressable
                  style={[styles.option, analyticsAllowed === true && styles.optionSelected]}
                  onPress={() => setAnalyticsAllowed(true)}
                >
                  <View style={styles.radioOuter}>
                    {analyticsAllowed === true && <View style={styles.radioInner} />}
                  </View>
                  <View style={styles.optionTextWrap}>
                    <Text style={styles.optionTitle}>{i18nT('legal:app.tabs.cookies.neobhodimye_i_analiticheskie_c527c7ea')}</Text>
                    <Text style={styles.optionDescription}>
                      {i18nT('legal:app.tabs.cookies.razreshit_ispolzovanie_yandeks_metriki_i_goo_80c2b3fe')}</Text>
                  </View>
                </Pressable>
              </View>
            </View>

            <Pressable style={styles.saveButton} onPress={handleSave} disabled={analyticsAllowed === null}>
              <Text style={styles.saveButtonText}>{i18nT('legal:app.tabs.cookies.sohranit_nastroyki_94370de3')}</Text>
            </Pressable>

            {saved && <Text style={styles.savedText}>{i18nT('legal:app.tabs.cookies.nastroyki_sohraneny_1ea5478e')}</Text>}
          </>
        ) : (
          <>
            <Text style={styles.heading}>{i18nT('legal:app.tabs.cookies.konfidentsialnost_i_analitika_12436d8d')}</Text>
            <Text style={styles.paragraph}>
              {i18nT('legal:app.tabs.cookies.v_mobilnom_prilozhenii_metravel_ne_ispolzuyu_96853813')}</Text>

            <View style={styles.block}>
              <Text style={styles.subheading}>{i18nT('legal:app.tabs.cookies.kakie_dannye_ispolzuet_prilozhenie_a0311a04')}</Text>
              <Text style={styles.paragraph}>
                {i18nT('legal:app.tabs.cookies.lokalno_na_ustroystve_hranyatsya_tolko_danny_dea019a1')}</Text>
            </View>
          </>
        )}

        <Pressable style={styles.link} onPress={() => router.push('/privacy' as any)}>
          <Text style={styles.linkText}>{i18nT('legal:app.tabs.cookies.podrobnee_o_tom_kak_my_obrabatyvaem_dannye_v_b9ab5eb4')}</Text>
        </Pressable>
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
  block: {
    marginTop: 12,
  },
  optionGroup: {
    marginTop: 8,
    gap: 8 as any,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease',
      },
    }),
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.primary,
    marginTop: 2,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 13,
    color: colors.textMuted,
  },
  saveButton: {
    marginTop: 20,
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 9999,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  saveButtonText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  savedText: {
    marginTop: 8,
    fontSize: 13,
    color: colors.success,
  },
  link: {
    marginTop: 16,
  },
  linkText: {
    fontSize: 13,
    color: colors.primaryText,
    textDecorationLine: 'underline',
  },
});
