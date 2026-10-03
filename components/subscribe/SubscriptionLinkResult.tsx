// Экран результата по ссылке из письма рассылки: подтверждение и отписка (#2121).
//
// Первый рендер (и статический экспорт web) всегда «проверяем ссылку»: query на
// SSG недоступен, и решение «нет токена → недействительна» до гидрации мигнуло
// бы ложным текстом. Результат определяется только в эффекте.
//
// Токен одноразовый: API вызывается один раз на пару «токен + попытка». Ref
// переживает двойной вызов эффекта в StrictMode, а ответ применяется, пока
// экран смонтирован, — без `active`-флага из cleanup, который в StrictMode
// отбросил бы единственный ответ и оставил вечный спиннер.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import EmptyState from '@/components/ui/EmptyState';
import { asBottomDimension, useScrollBottomPadding } from '@/components/layout/bottomChromeInset';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { useThemedColors } from '@/hooks/useTheme';
import { buildCanonicalUrl } from '@/utils/seo';
import { translate as i18nT } from '@/i18n';
import {
  resolveSubscriptionLink,
  type SubscriptionLinkAction,
  type SubscriptionLinkResult as LinkResult,
} from '@/api/subscriptionLinks';

type ViewState = 'pending' | LinkResult;

const STATUS_PARAM_RESULTS: Record<string, LinkResult> = {
  confirmed: 'confirmed',
  unsubscribed: 'unsubscribed',
  invalid: 'invalid',
};

const firstParam = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value) ?? '';

const ROUTE_BY_ACTION: Record<SubscriptionLinkAction, string> = {
  confirm: '/subscribe/confirm',
  unsubscribe: '/subscribe/unsubscribe',
};

type Props = {
  action: SubscriptionLinkAction;
};

export default function SubscriptionLinkResult({ action }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // Резерв под нижний док — общий слой #2097: на 320×640 кнопки состояния
  // ошибки иначе уходили под док.
  const scrollBottomPadding = useScrollBottomPadding(24);
  const router = useRouter();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{ token?: string | string[]; status?: string | string[] }>();
  const token = firstParam(params.token).trim();
  const statusParam = firstParam(params.status).trim();

  const [state, setState] = useState<ViewState>('pending');
  const [attempt, setAttempt] = useState(0);
  const requestedKeyRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // `?status=` — результат редиректа бэка для уже отправленных писем (#2122):
    // токен там уже израсходован, повторно API не вызываем.
    if (statusParam) {
      setState(STATUS_PARAM_RESULTS[statusParam] ?? 'invalid');
      return;
    }
    if (!token) {
      setState('invalid');
      return;
    }
    const requestKey = `${action}:${token}:${attempt}`;
    if (requestedKeyRef.current === requestKey) return;
    requestedKeyRef.current = requestKey;
    setState('pending');

    void resolveSubscriptionLink(action, token).then((result) => {
      if (mountedRef.current && requestedKeyRef.current === requestKey) setState(result);
    });
  }, [action, token, statusParam, attempt]);

  const goQuests = useCallback(() => router.push('/quests'), [router]);
  const goHome = useCallback(() => router.push('/'), [router]);
  const retry = useCallback(() => {
    setState('pending');
    setAttempt((value) => value + 1);
  }, []);

  const seo = action === 'confirm'
    ? {
        title: i18nT('sharedStatic:subscriptionLink.confirmSeoTitle'),
        description: i18nT('sharedStatic:subscriptionLink.confirmSeoDescription'),
      }
    : {
        title: i18nT('sharedStatic:subscriptionLink.unsubscribeSeoTitle'),
        description: i18nT('sharedStatic:subscriptionLink.unsubscribeSeoDescription'),
      };

  const toQuestsAction = { label: i18nT('sharedStatic:subscriptionLink.toQuests'), onPress: goQuests };
  const toHomeAction = { label: i18nT('sharedStatic:subscriptionLink.toHome'), onPress: goHome };

  let body: React.ReactNode;
  if (state === 'pending') {
    body = (
      <View
        style={styles.pending}
        accessibilityRole="progressbar"
        accessibilityLabel={i18nT('sharedStatic:subscriptionLink.loading')}
        testID="subscription-link-pending"
      >
        <ActivityIndicator size="large" color={colors.primaryDark} />
      </View>
    );
  } else if (state === 'confirmed' || state === 'unsubscribed') {
    const isConfirmed = state === 'confirmed';
    body = (
      <View style={styles.result} testID={`subscription-link-${state}`}>
        <EmptyState
          density="full"
          icon={isConfirmed ? 'check-circle' : 'bell-off'}
          title={i18nT(isConfirmed
            ? 'sharedStatic:subscriptionLink.confirmedTitle'
            : 'sharedStatic:subscriptionLink.unsubscribedTitle')}
          description={i18nT(isConfirmed
            ? 'sharedStatic:subscriptionLink.confirmedText'
            : 'sharedStatic:subscriptionLink.unsubscribedText')}
          action={toQuestsAction}
          secondaryAction={toHomeAction}
        />
      </View>
    );
  } else if (state === 'invalid') {
    body = (
      <View style={styles.result} testID="subscription-link-invalid">
        <EmptyState
          density="full"
          icon="alert-circle"
          variant="empty"
          title={i18nT('sharedStatic:subscriptionLink.invalidTitle')}
          description={i18nT(action === 'confirm'
            ? 'sharedStatic:subscriptionLink.invalidConfirmText'
            : 'sharedStatic:subscriptionLink.invalidUnsubscribeText')}
          action={toQuestsAction}
          secondaryAction={toHomeAction}
        />
      </View>
    );
  } else {
    body = (
      <View style={styles.result} testID="subscription-link-error">
        <EmptyState
          density="full"
          icon="wifi-off"
          variant="error"
          title={i18nT('sharedStatic:subscriptionLink.errorTitle')}
          description={i18nT('sharedStatic:subscriptionLink.errorText')}
          action={{ label: i18nT('sharedStatic:subscriptionLink.retry'), onPress: retry }}
          secondaryAction={toQuestsAction}
          moreActions={[toHomeAction]}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: asBottomDimension(scrollBottomPadding) }]}
    >
      {isFocused && (
        <InstantSEO
          headKey={`subscription-link-${action}`}
          title={seo.title}
          description={seo.description}
          canonical={buildCanonicalUrl(ROUTE_BY_ACTION[action])}
          robots="noindex, nofollow"
        />
      )}
      {body}
    </ScrollView>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 24,
    },
    pending: {
      minHeight: 260,
      justifyContent: 'center',
      alignItems: 'center',
    },
    result: {
      width: '100%',
      maxWidth: 560,
    },
  });
