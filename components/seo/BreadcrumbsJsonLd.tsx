import React, { useMemo } from 'react';
import Head from 'expo-router/head';
import { usePathname } from 'expo-router';
import { useBreadcrumbModel, type BreadcrumbModel } from '@/hooks/useBreadcrumbModel';
import { getSiteBaseUrl } from '@/utils/seo';

const normalizePath = (path: string) => {
  if (!path) return '/';
  if (path.startsWith('http')) return path;
  return path.startsWith('/') ? path : `/${path}`;
};

const toAbsoluteUrl = (path: string) => {
  if (path.startsWith('http')) return path;
  return `${getSiteBaseUrl()}${normalizePath(path)}`;
};

type BreadcrumbsJsonLdProps = {
  model?: BreadcrumbModel;
  pathname?: string | null;
};

export default function BreadcrumbsJsonLd({ model: modelProp, pathname: pathnameProp }: BreadcrumbsJsonLdProps) {
  const hookPathname = usePathname();
  const hookModel = useBreadcrumbModel();
  const pathname = pathnameProp ?? hookPathname;
  const model = modelProp ?? hookModel;

  const itemListElement = useMemo(() => {
    const modelItems = model?.items ?? [];
    if (!model?.showBreadcrumbs || modelItems.length === 0) return null;
    const items = [{ label: 'Главная', path: '/' }, ...modelItems];
    return items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      item: toAbsoluteUrl(item.path),
    }));
  }, [model?.items, model?.showBreadcrumbs]);

  if (!itemListElement) return null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement,
  };

  return (
    <Head key={`breadcrumbs-${pathname ?? 'page'}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </Head>
  );
}
