import React from 'react';
import Head from 'expo-router/head';

type Props = {
    headKey?: string | null;
    title: string;
    description?: string;
    canonical?: string;
    image?: string;
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
    ogType = 'website',
    robots,
    additionalTags,
    children,
}) => {
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

            {/* Twitter */}
            <meta key="twitter:card" name="twitter:card" content="summary_large_image" />
            <meta key="twitter:title" name="twitter:title" content={title} />
            {description && (
                <meta key="twitter:description" name="twitter:description" content={description} />
            )}
            {image && <meta key="twitter:image" name="twitter:image" content={image} />}
            {additionalTags}
            {children}
        </Head>
    );
};

export default InstantSEO;
