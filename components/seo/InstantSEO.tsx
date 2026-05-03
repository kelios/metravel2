import React, { useEffect } from 'react';
import Head from 'expo-router/head';
import { normalizeOgImageUrl } from '@/utils/seo';

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

const InstantSEO: React.FC<Props> = ({
    headKey,
    title,
    description,
    canonical,
    image,
    imageAlt,
    imageWidth,
    imageHeight,
    ogType = 'website',
    robots,
    additionalTags,
    children,
}) => {
    const normalizedImage = normalizeOgImageUrl(image);
    const twitterCard = normalizedImage ? 'summary_large_image' : 'summary';
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
            {normalizedImage && <meta key="og:image" property="og:image" content={normalizedImage} />}
            {normalizedImage && <meta key="og:image:secure_url" property="og:image:secure_url" content={normalizedImage} />}
            {normalizedImage && imageWidth && <meta key="og:image:width" property="og:image:width" content={String(imageWidth)} />}
            {normalizedImage && imageHeight && <meta key="og:image:height" property="og:image:height" content={String(imageHeight)} />}
            {normalizedImage && imageAlt && <meta key="og:image:alt" property="og:image:alt" content={imageAlt} />}
            <meta key="og:site_name" property="og:site_name" content="MeTravel" />
            <meta key="og:locale" property="og:locale" content="ru_RU" />

            {/* Twitter */}
            <meta key="twitter:card" name="twitter:card" content={twitterCard} />
            <meta key="twitter:title" name="twitter:title" content={title} />
            {description && (
                <meta key="twitter:description" name="twitter:description" content={description} />
            )}
            {normalizedImage && <meta key="twitter:image" name="twitter:image" content={normalizedImage} />}
            {normalizedImage && imageAlt && <meta key="twitter:image:alt" name="twitter:image:alt" content={imageAlt} />}
            {additionalTags}
            {children}
        </Head>
    );
};

export default InstantSEO;
