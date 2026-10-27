import React, { useMemo, useSyncExternalStore } from 'react';
import { Link, type Href, useIsFocused, useLoaderData } from 'expo-router';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import QuestVersionLinks from '@/components/quests/QuestVersionLinks';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import type { QuestPublicProjection } from '@/utils/questPublicPage';
import type { QuestServingProjection } from '@/utils/questLocaleRouting';
import { jsonLdScript } from '@/components/seo/jsonLdScript';
import { quotedCyrillicSegments } from '@/utils/cyrillicLanguage';
import { buildQuestPublicStructuredData, questPublicAlternates } from './questPublicSeo';

const PUBLIC_STYLES = `
[data-quest-public-page]{box-sizing:border-box;width:100%;max-width:840px;margin:0 auto;padding:24px 20px 100px;color:var(--color-text);font:16px/1.55 system-ui,-apple-system,sans-serif;overflow-wrap:anywhere}
[data-quest-public-page] h1{font-size:28px;line-height:1.2;margin:16px 0 12px}
[data-quest-public-page] h2{font-size:21px;line-height:1.3;margin:24px 0 10px}
[data-quest-public-page] h3{font-size:18px;line-height:1.35;margin:16px 0 6px}
[data-quest-public-page] p{margin:0 0 14px}
[data-quest-public-page] a{color:var(--color-primary);text-underline-offset:3px}
[data-quest-public-page] li{margin:0 0 12px}
[data-quest-public-page] .quest-public-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px 16px;padding:0;list-style:none;color:var(--color-text-muted)}
@media(max-width:640px){[data-quest-public-page]{padding:16px 14px 96px}[data-quest-public-page] h1{font-size:23px}}
`;

function servingProjection(data: QuestPublicProjection): QuestServingProjection | null {
  if (data.kind !== 'detail' || !data.city_id || !data.quest_slug) return null;
  return { schema_version: 1, release_id: data.publication_id, city_id: data.city_id,
    quest_slug: data.quest_slug, locale: data.locale, state: 'available', canonical_path: data.canonical_path,
    ru_source_path: data.ru_source_path, versions: data.versions.map(({ locale, path }) => ({ locale, path })) };
}

function PublicText({ text, locale, countryCode }: { text: string; locale: string; countryCode: string | null }) {
  const segments = quotedCyrillicSegments(text, { contentLocale: locale, countryCode: countryCode ?? undefined });
  return <>{segments ? segments.map((segment, index) => segment.lang
    ? <span key={index} lang={segment.lang}>{segment.text}</span> : segment.text) : text}</>;
}

function QuestPublicDocument({ data }: { data: QuestPublicProjection }) {
  const focused = useIsFocused();
  const projection = useMemo(() => servingProjection(data), [data]);
  const structured = useMemo(() => buildQuestPublicStructuredData(data), [data]);
  const additionalTags = useMemo(() => Object.entries(questPublicAlternates(data)).map(([locale, href]) =>
    <link key={locale} rel="alternate" hrefLang={locale} href={href} />), [data]);
  const page = data.page;
  const text = (value: string, locale: string = data.locale) => <PublicText text={value} locale={locale} countryCode={data.country_code} />;
  return <>
    <style>{PUBLIC_STYLES}</style>
    {focused ? <InstantSEO headKey={`quest-public-${data.canonical_path}`} {...page.meta} image={page.meta.image ?? undefined} ogType="website"
      robots={data.quality.indexable ? 'index, follow' : 'noindex, follow'} additionalTags={additionalTags} /> : null}
    {jsonLdScript(structured, { id: 'quest-public-structured-data', marker: 'quest-public' })}
    <main data-quest-public-page={data.kind} lang={data.locale}>
      {page.kicker ? <p>{text(page.kicker)}</p> : null}
      <h1>{text(page.heading)}</h1>
      {projection ? <QuestVersionLinks projection={projection} currentLocale={data.locale} /> : null}
      <p>{text(page.lead)}</p>
      {data.kind === 'detail' && page.meta.image ? <ImageCardMedia src={page.meta.image} alt={page.heading}
        height={320} width="100%" fit="contain" blurBackground priority="high" loading="eager"
        borderRadius={DESIGN_TOKENS.radii.md} /> : null}
      {page.paragraphs.map((value, index) => <p key={index}>{text(value)}</p>)}
      {page.facts.length ? <ul className="quest-public-facts">{page.facts.map((value, index) => <li key={index}>{text(value)}</li>)}</ul> : null}
      {page.sections.map((section, sectionIndex) => <section key={sectionIndex}>
        {section.heading ? <h2>{text(section.heading)}</h2> : null}
        {section.paragraphs.map((value, index) => <p key={index}>{text(value)}</p>)}
        {section.items.length ? <ul>{section.items.map((item, index) => <li key={index} lang={item.lang ?? undefined}>
          {item.path ? <Link href={item.path as Href}>{text(item.title, item.lang ?? data.locale)}</Link> : <h3>{text(item.title)}</h3>}
          {item.text ? <p>{text(item.text, item.lang ?? data.locale)}</p> : null}{item.facts ? <p>{text(item.facts)}</p> : null}
        </li>)}</ul> : null}
      </section>)}
    </main>
  </>;
}

const subscribeNever = () => () => {};

/**
 * The projection document is the server HTML only (crawlers, no-JS, first paint).
 * React reads the server snapshot while rendering on the server and hydrating, so
 * the markup matches; it then re-renders with the client snapshot. A client-side
 * navigation mounts with the client snapshot directly: the visitor gets the
 * regular app screen without a document frame (#2831, #2832).
 */
export default function QuestPublicLoaderScreen({ children }: {
  /** The app screen; a detail receives the loader projection as its publication proof. */
  children: (projection: QuestServingProjection | null) => React.ReactNode;
}) {
  const data = useLoaderData() as QuestPublicProjection | null;
  const serverMarkup = useSyncExternalStore(subscribeNever, () => false, () => true);
  const projection = useMemo(() => (data ? servingProjection(data) : null), [data]);
  return data && serverMarkup ? <QuestPublicDocument key={data.canonical_path} data={data} /> : <>{children(projection)}</>;
}
