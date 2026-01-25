import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, Pressable } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { useThemedColors } from '@/hooks/useTheme';
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
    return {
      necessary: !!parsed.necessary,
      analytics: !!parsed.analytics,
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
  const { buildCanonicalUrl, buildOgImageUrl } = require('@/utils/seo');
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
      // Если ничего не сохранено, считаем, что пока только необходимые
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

    if (analyticsAllowed && typeof window !== 'undefined' && (window as any).metravelLoadAnalytics) {
      try {
        (window as any).metravelLoadAnalytics();
      } catch {
        // ignore
      }
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const title = 'Настройки cookies и аналитики | Metravel';
  const description = 'Страница управления настройками cookies и аналитических инструментов на сайте Metravel.';

  return (
    <View style={styles.root}>
      <InstantSEO
        headKey="cookie-settings"
        title={title}
        description={description}
        canonical={buildCanonicalUrl(pathname || '/cookies')}
        image={buildOgImageUrl('/og-preview.jpg')}
        ogType="website"
        robots="noindex, nofollow"
      />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.heading}>Настройки cookies и аналитики</Text>
        <Text style={styles.paragraph}>
          На этом экране вы можете изменить свой выбор относительно использования аналитических инструментов
          (например, Яндекс.Метрика и Google Analytics 4). Технически необходимые файлы используются всегда для
          корректной работы сайта.
        </Text>

        <View style={styles.block}>
          <Text style={styles.subheading}>Обязательные файлы</Text>
          <Text style={styles.paragraph}>
            Обязательные cookies и локальное хранилище используются для входа в аккаунт, сохранения настроек интерфейса
            и обеспечения безопасности. Они включены всегда и не могут быть отключены, так как без них сайт работать не
            будет.
          </Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.subheading}>Аналитические инструменты</Text>
          <Text style={styles.paragraph}>
            Аналитика помогает лучше понимать, какие материалы и разделы сайта интересны пользователям, и развивать
            проект. Вы можете разрешить или запретить использование аналитики в любое время.
          </Text>

          <View style={styles.optionGroup}>
            <Pressable
              style={[styles.option, analyticsAllowed === false && styles.optionSelected]}
              onPress={() => setAnalyticsAllowed(false)}
            >
              <View style={styles.radioOuter}>
                {analyticsAllowed === false && <View style={styles.radioInner} />}
              </View>
              <View style={styles.optionTextWrap}>
                <Text style={styles.optionTitle}>Только необходимые</Text>
                <Text style={styles.optionDescription}>
                  Аналитические инструменты отключены. Используются только технически необходимые файлы.
                </Text>
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
                <Text style={styles.optionTitle}>Необходимые и аналитические</Text>
                <Text style={styles.optionDescription}>
                  Разрешить использование Яндекс.Метрики и Google Analytics 4 для сбора обезличенной статистики.
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

        <Pressable style={styles.saveButton} onPress={handleSave} disabled={analyticsAllowed === null}>
          <Text style={styles.saveButtonText}>Сохранить настройки</Text>
        </Pressable>

        {saved && <Text style={styles.savedText}>Настройки сохранены.</Text>}

        <Pressable style={styles.link} onPress={() => router.push('/privacy' as any)}>
          <Text style={styles.linkText}>Подробнее о том, как мы обрабатываем данные — в Политике конфиденциальности.</Text>
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
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});
