import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import Head from 'expo-router/head';

type Props = {
  headKey?: string | null;
  title: string;
  description?: string;
  canonical?: string;
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
  ogType?: 'website' | 'article';
  robots?: string;
  additionalTags?: React.ReactNode;
  children?: React.ReactNode;
};

function StaticHead({
  headKey,
  title,
  description,
  canonical,
  image,
  imageWidth,
  imageHeight,
  ogType = 'website',
  robots,
  additionalTags,
  children,
}: Props) {
  useEffect(() => {
    if (typeof document === 'undefined' || !robots) return;
    const upsertMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('name', name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };
    upsertMeta('robots', robots);
  }, [robots]);

  return (
    <Head key={headKey ?? 'instant-seo'}>
      <title key="title">{title}</title>
      {description && <meta key="description" name="description" content={description} />}
      {robots && <meta key="robots" name="robots" content={robots} />}
      {canonical && <link key="canonical" rel="canonical" href={canonical} />}

      {/* Open Graph */}
      <meta key="og:type" property="og:type" content={ogType} />
      <meta key="og:title" property="og:title" content={title} />
      {description && <meta key="og:description" property="og:description" content={description} />}
      {canonical && <meta key="og:url" property="og:url" content={canonical} />}
      {image && <meta key="og:image" property="og:image" content={image} />}
      {image && imageWidth && <meta key="og:image:width" property="og:image:width" content={String(imageWidth)} />}
      {image && imageHeight && <meta key="og:image:height" property="og:image:height" content={String(imageHeight)} />}
      <meta key="og:site_name" property="og:site_name" content="MeTravel" />

      {/* Twitter */}
      <meta key="twitter:card" name="twitter:card" content="summary_large_image" />
      <meta key="twitter:title" name="twitter:title" content={title} />
      {description && <meta key="twitter:description" name="twitter:description" content={description} />}
      {image && <meta key="twitter:image" name="twitter:image" content={image} />}
      {additionalTags}
      {children}
    </Head>
  );
}

export default function LazyInstantSEO(props: Props) {
  const isWeb = Platform.OS === 'web';

  if (!isWeb) return null;

  return <StaticHead {...props} />;
}
