import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Head from 'expo-router/head';
import { useIsFocused } from 'expo-router';
import { normalizeOgImageUrl } from '@/utils/seo';
import { applyHeadTags, releaseHeadTags, type HeadTag } from '@/utils/webHeadManager';
import { getActiveLocaleDefinition } from '@/i18n/format';

type Props = {
  headKey?: string | null;
  title: string;
  description?: string;
  canonical?: string;
  image?: string;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
  ogType?: 'website' | 'article';
  robots?: string;
  additionalTags?: React.ReactNode;
  children?: React.ReactNode;
};

const meta = (attr: 'name' | 'property', key: string, content: string | null | undefined): HeadTag[] =>
  content ? [{ kind: 'meta', attr, key, content }] : [];

function buildHeadTags({
  title,
  description,
  canonical,
  image,
  imageAlt,
  imageWidth,
  imageHeight,
  ogType = 'website',
  robots,
}: Props): HeadTag[] {
  const normalizedImage = normalizeOgImageUrl(image);
  const locale = getActiveLocaleDefinition();
  return [
    ...(title ? [{ kind: 'title', content: title } as const] : []),
    ...meta('name', 'description', description),
    ...meta('name', 'robots', robots),
    ...(canonical ? [{ kind: 'link', rel: 'canonical', href: canonical } as const] : []),
    ...meta('property', 'og:type', ogType),
    ...meta('property', 'og:title', title),
    ...meta('property', 'og:description', description),
    ...meta('property', 'og:url', canonical),
    ...meta('property', 'og:image', normalizedImage),
    ...meta('property', 'og:image:secure_url', normalizedImage),
    ...meta('property', 'og:image:width', normalizedImage && imageWidth ? String(imageWidth) : null),
    ...meta('property', 'og:image:height', normalizedImage && imageHeight ? String(imageHeight) : null),
    ...meta('property', 'og:image:alt', normalizedImage ? imageAlt : null),
    ...meta('property', 'og:site_name', 'MeTravel'),
    ...meta('property', 'og:locale', locale.ogLocale),
    ...meta('name', 'twitter:card', normalizedImage ? 'summary_large_image' : 'summary'),
    ...meta('name', 'twitter:title', title),
    ...meta('name', 'twitter:description', description),
    ...meta('name', 'twitter:image', normalizedImage),
    ...meta('name', 'twitter:image:alt', normalizedImage ? imageAlt : null),
  ];
}

function WebSeoHead(props: Props) {
  const isFocused = useIsFocused();
  const [owner] = useState(() => Symbol('instant-seo'));
  // Сериализация — стабильная зависимость: те же значения не перезаписывают head.
  const tagsKey = JSON.stringify(buildHeadTags(props));

  // #2756: SEO-теги пишет менеджер head — один узел на ключ, upsert на месте,
  // без helmet-копий рядом с тегами экспорта (подробно — utils/webHeadManager).
  useEffect(() => {
    if (!isFocused) {
      releaseHeadTags(owner);
      return;
    }
    applyHeadTags(owner, JSON.parse(tagsKey) as HeadTag[]);
  }, [isFocused, owner, tagsKey]);

  useEffect(() => () => releaseHeadTags(owner), [owner]);

  const { headKey, additionalTags, children } = props;
  if (!additionalTags && !children) return null;
  return (
    <Head key={headKey ?? 'instant-seo'}>
      {/* JSON-LD scripts must be string children; Helmet drops dangerouslySetInnerHTML. */}
      {additionalTags}
      {children}
    </Head>
  );
}

export default function LazyInstantSEO(props: Props) {
  if (Platform.OS !== 'web') return null;
  return <WebSeoHead {...props} />;
}
