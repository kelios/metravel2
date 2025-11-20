import React, { useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { fetchTravel } from '@/src/api/travels';
import { Travel as TravelType } from '@/src/types/types';
import { sanitizeRichText, sanitizeRichTextForPdf } from '@/src/utils/sanitizeRichText';

interface Travel {
    id: number;
    name: string;
    countryName?: string;
    countryCode?: string;
    year?: string;
    number_days?: number;
    description?: string;
    plus?: string;
    minus?: string;
    recommendation?: string;
    youtube_link?: string;
    gallery?: Array<{
        id: number;
        url: string;
        updated_at?: string;
    }>;
    travelAddress?: Array<{
        id: number;
        name: string;
        description?: string;
        coords?: string;
    }>;
    coordsMeTravel?: Array<{
        lat: number;
        lng: number;
    }>;
    user?: {
        name: string;
        avatar?: string;
    };
    created_at?: string;
    updated_at?: string;
    userName?: string; // Fallback для user.name
}

/**
 * Нормализует данные путешествия из API в формат для PDF шаблона
 */
function normalizeTravelForPdf(travel: TravelType): Travel {
    // Нормализуем gallery: может быть string[] или объекты
    const normalizedGallery = Array.isArray(travel.gallery) && travel.gallery.length > 0
        ? travel.gallery.map((item, idx) => {
            if (typeof item === 'string') {
                return { id: idx, url: item };
            }
            return typeof item === 'object' && item !== null && 'url' in item
                ? { id: (item as any).id || idx, url: (item as any).url, updated_at: (item as any).updated_at }
                : { id: idx, url: String(item) };
        })
        : undefined;

    // Нормализуем travelAddress: может быть string[] или объекты
    const normalizedTravelAddress = Array.isArray(travel.travelAddress) && travel.travelAddress.length > 0
        ? travel.travelAddress.map((item, idx) => {
            if (typeof item === 'string') {
                return { id: idx, name: item, description: undefined };
            }
            return typeof item === 'object' && item !== null
                ? { 
                    id: (item as any).id || idx, 
                    name: (item as any).name || String(item),
                    description: (item as any).description,
                    coords: (item as any).coords
                }
                : { id: idx, name: String(item) };
        })
        : undefined;

    return {
        id: travel.id,
        name: travel.name || '',
        countryName: travel.countryName,
        countryCode: travel.countryCode,
        year: travel.year,
        number_days: travel.number_days,
        description: travel.description,
        plus: travel.plus,
        minus: travel.minus,
        recommendation: travel.recommendation,
        youtube_link: travel.youtube_link,
        gallery: normalizedGallery,
        travelAddress: normalizedTravelAddress,
        user: travel.userName ? { name: travel.userName } : undefined,
        userName: travel.userName,
        // created_at и updated_at могут приходить из API, но их нет в базовом типе
        // Если нужны, их нужно добавить в TravelType или получать отдельно
    };
}

interface TravelPdfTemplateProps {
    travelId?: number;
}

const TravelPdfTemplate: React.FC<TravelPdfTemplateProps> = ({ travelId }) => {
    const { data: rawTravel, isLoading, isError } = useQuery<TravelType>({
        queryKey: ['travelDetails', travelId],
        queryFn: () => {
            if (!travelId) {
                throw new Error('Travel ID is required');
            }
            return fetchTravel(travelId);
        },
        staleTime: 600_000,
        enabled: !!travelId, // Запрос выполняется только если travelId существует
    });

    // Нормализуем данные для использования в компоненте
    const travel: Travel | undefined = useMemo(() => {
        return rawTravel ? normalizeTravelForPdf(rawTravel) : undefined;
    }, [rawTravel]);

    const formatDate = (dateString?: string) => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        } catch {
            return '';
        }
    };

    const renderHtmlContent = (html?: string | null) => {
        if (!html) return null;
        return (
            <div
                style={styles.htmlContent}
                className="pdf-text-content"
                dangerouslySetInnerHTML={{ __html: html }}
            />
        );
    };

    const sanitizedSections = useMemo(() => ({
        description: travel?.description ? sanitizeRichTextForPdf(travel.description) : '',
        recommendation: travel?.recommendation ? sanitizeRichTextForPdf(travel.recommendation) : '',
        plus: travel?.plus ? sanitizeRichTextForPdf(travel.plus) : '',
        minus: travel?.minus ? sanitizeRichTextForPdf(travel.minus) : '',
        travelAddress: travel?.travelAddress?.map((place) => ({
            ...place,
            description: place.description ? sanitizeRichText(place.description) : '',
        })) ?? [],
    }), [travel]);

    if (isLoading) {
        return (
            <div style={styles.loadingContainer}>
                <p>Загрузка данных о путешествии...</p>
            </div>
        );
    }

    if (isError || !travel) {
        return (
            <div style={styles.errorContainer}>
                <p>Ошибка загрузки данных о путешествии</p>
            </div>
        );
    }

    // TypeScript guard: travel гарантированно определен после проверки выше
    const normalizedTravel: Travel = travel;

    return (
        <div style={styles.container}>
            <style>
                {`
                    @page { 
                        size: A4; 
                        margin: 10mm;
                    }
                    * {
                        -webkit-print-color-adjust: exact !important;
                        color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        box-sizing: border-box;
                        margin: 0;
                        padding: 0;
                    }
                    body {
                        font-family: 'Helvetica Neue', Arial, sans-serif;
                    }
                    img {
                        max-width: 100%;
                        height: auto;
                    }
                    ul, ol {
                        padding-left: 20px;
                    }
                    .pdf-text-content {
                        white-space: normal !important;
                        word-wrap: break-word;
                        letter-spacing: normal !important;
                        word-spacing: normal !important;
                        text-rendering: optimizeLegibility;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    .pdf-text-content p {
                        margin: 0 !important;
                        padding: 0 !important;
                        white-space: normal !important;
                        letter-spacing: normal !important;
                        word-spacing: normal !important;
                        display: block;
                        line-height: inherit;
                        page-break-inside: avoid !important;
                        page-break-after: auto !important;
                        page-break-before: auto !important;
                        break-inside: avoid !important;
                        break-after: auto !important;
                        break-before: auto !important;
                    }
                    .pdf-text-content p + p {
                        margin-top: 0 !important;
                    }
                    .pdf-text-content * {
                        white-space: normal !important;
                        letter-spacing: normal !important;
                        word-spacing: normal !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    .pdf-text-content br {
                        line-height: inherit;
                    }
                    .pdf-text-content div,
                    .pdf-text-content span {
                        display: inline;
                    }
                `}
            </style>

            <header style={styles.header}>
                <h1 style={styles.title}>{normalizedTravel.name}</h1>

                <div style={styles.metaContainer}>
                    {normalizedTravel.countryName && (
                        <div style={styles.metaItem}>
                            <span style={styles.metaLabel}>Страна:</span>
                            <span style={styles.metaValue}>{normalizedTravel.countryName}</span>
                        </div>
                    )}
                    {normalizedTravel.year && (
                        <div style={styles.metaItem}>
                            <span style={styles.metaLabel}>Год:</span>
                            <span style={styles.metaValue}>{normalizedTravel.year}</span>
                        </div>
                    )}
                    {normalizedTravel.number_days && (
                        <div style={styles.metaItem}>
                            <span style={styles.metaLabel}>Длительность:</span>
                            <span style={styles.metaValue}>{normalizedTravel.number_days} дней</span>
                        </div>
                    )}
                    {normalizedTravel.user?.name && (
                        <div style={styles.metaItem}>
                            <span style={styles.metaLabel}>Автор:</span>
                            <span style={styles.metaValue}>{normalizedTravel.user.name}</span>
                        </div>
                    )}
                    {normalizedTravel.created_at && (
                        <div style={styles.metaItem}>
                            <span style={styles.metaLabel}>Опубликовано:</span>
                            <span style={styles.metaValue}>{formatDate(normalizedTravel.created_at)}</span>
                        </div>
                    )}
                </div>
            </header>

            <main style={styles.mainContent}>
                {sanitizedSections.description && (
                    <section style={styles.section}>
                        <h2 style={styles.sectionTitle}>Описание путешествия</h2>
                        {renderHtmlContent(sanitizedSections.description)}
                    </section>
                )}

                {normalizedTravel.gallery && normalizedTravel.gallery.length > 0 && (
                    <section style={styles.section}>
                        <h2 style={styles.sectionTitle}>Фотографии из путешествия</h2>
                        <div style={styles.galleryGrid}>
                            {normalizedTravel.gallery.map((img, i) => (
                                <div key={`${img.id}-${i}`} style={styles.galleryItem}>
                                    <img
                                        src={img.url}
                                        style={styles.galleryImage}
                                        alt={`Фото ${i + 1} из путешествия`}
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = 'none';
                                        }}
                                    />
                                    {img.updated_at && (
                                        <div style={styles.imageDate}>
                                            {formatDate(img.updated_at)}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {(sanitizedSections.plus || sanitizedSections.minus) && (
                    <section style={styles.section}>
                        <h2 style={styles.sectionTitle}>Плюсы и минусы</h2>
                        <div style={styles.prosConsContainer}>
                            {sanitizedSections.plus && (
                                <div style={styles.prosBox}>
                                    <h3 style={styles.prosTitle}>Что понравилось</h3>
                                    {renderHtmlContent(sanitizedSections.plus)}
                                </div>
                            )}
                            {sanitizedSections.minus && (
                                <div style={styles.consBox}>
                                    <h3 style={styles.consTitle}>Что не понравилось</h3>
                                    {renderHtmlContent(sanitizedSections.minus)}
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {sanitizedSections.recommendation && (
                    <section style={styles.section}>
                        <h2 style={styles.sectionTitle}>Рекомендации и советы</h2>
                        {renderHtmlContent(sanitizedSections.recommendation)}
                    </section>
                )}

                {sanitizedSections.travelAddress.length > 0 && (
                    <section style={styles.section}>
                        <h2 style={styles.sectionTitle}>Посещенные места</h2>
                        <ul style={styles.placesList}>
                            {sanitizedSections.travelAddress.map((place: { id: number; name: string; description?: string }) => (
                                <li key={place.id} style={styles.placeItem}>
                                    <h3 style={styles.placeName}>{place.name}</h3>
                                    {place.description && renderHtmlContent(place.description)}
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {normalizedTravel.youtube_link && (
                    <section style={styles.section}>
                        <h2 style={styles.sectionTitle}>Видео из путешествия</h2>
                        <div style={styles.videoContainer}>
                            <p style={styles.videoLink}>
                                Ссылка на видео: {normalizedTravel.youtube_link}
                            </p>
                        </div>
                    </section>
                )}
            </main>

            <footer style={styles.footer}>
                <div style={styles.footerContent}>
                    <p style={styles.footerText}>
                        Документ сгенерирован в приложении MyTravels
                    </p>
                    <p style={styles.footerText}>
                        {new Date().toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                        })}
                    </p>
                </div>
            </footer>
        </div>
    );
};

const styles = {
    container: {
        width: '794px',
        minHeight: '1123px',
        padding: '40px',
        backgroundColor: '#fff',
        color: '#333',
        lineHeight: 1.6,
        boxSizing: 'border-box',
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
    } as React.CSSProperties,

    loadingContainer: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#666',
    } as React.CSSProperties,

    errorContainer: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#d32f2f',
    } as React.CSSProperties,

    header: {
        borderBottom: '2px solid #6b8e7f',
        paddingBottom: '20px',
        marginBottom: '30px',
    } as React.CSSProperties,

    title: {
        fontSize: '28px',
        color: '#4a6b5f',
        margin: '0 0 10px 0',
        fontWeight: 600,
        lineHeight: 1.3,
    } as React.CSSProperties,

    metaContainer: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '15px',
        fontSize: '14px',
        color: '#555',
    } as React.CSSProperties,

    metaItem: {
        display: 'flex',
        gap: '5px',
    } as React.CSSProperties,

    metaLabel: {
        fontWeight: 600,
    } as React.CSSProperties,

    metaValue: {
        color: '#444',
    } as React.CSSProperties,

    mainContent: {
        margin: '20px 0',
    } as React.CSSProperties,

    section: {
        marginBottom: '30px',
        pageBreakInside: 'avoid',
    } as React.CSSProperties,

    sectionTitle: {
        fontSize: '20px',
        color: '#5a7a6f',
        margin: '0 0 15px 0',
        fontWeight: 600,
        paddingBottom: '5px',
        borderBottom: '1px solid #eee',
    } as React.CSSProperties,

    htmlContent: {
        lineHeight: 1.6,
        fontSize: '14px',
        color: '#444',
        whiteSpace: 'normal',
    } as React.CSSProperties,

    galleryGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '15px',
        margin: '15px 0',
    } as React.CSSProperties,

    galleryItem: {
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        position: 'relative',
    } as React.CSSProperties,

    galleryImage: {
        width: '100%',
        height: '200px',
        objectFit: 'cover',
        display: 'block',
    } as React.CSSProperties,

    imageDate: {
        position: 'absolute',
        bottom: '0',
        left: '0',
        right: '0',
        backgroundColor: 'rgba(0,0,0,0.5)',
        color: '#fff',
        padding: '5px 10px',
        fontSize: '12px',
        textAlign: 'center',
    } as React.CSSProperties,

    prosConsContainer: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px',
        margin: '15px 0',
    } as React.CSSProperties,

    prosBox: {
        backgroundColor: '#f5faf7',
        padding: '15px',
        borderRadius: '8px',
        borderLeft: '4px solid #6b8e7f',
    } as React.CSSProperties,

    consBox: {
        backgroundColor: '#faf5f5',
        padding: '15px',
        borderRadius: '8px',
        borderLeft: '4px solid #a05050',
    } as React.CSSProperties,

    prosTitle: {
        color: '#6b8e7f',
        margin: '0 0 10px 0',
        fontSize: '16px',
    } as React.CSSProperties,

    consTitle: {
        color: '#a05050',
        margin: '0 0 10px 0',
        fontSize: '16px',
    } as React.CSSProperties,

    placesList: {
        listStyle: 'none',
        margin: '15px 0',
    } as React.CSSProperties,

    placeItem: {
        marginBottom: '15px',
        paddingBottom: '15px',
        borderBottom: '1px dashed #eee',
    } as React.CSSProperties,

    placeName: {
        fontSize: '16px',
        color: '#6b8e7f',
        margin: '0 0 5px 0',
    } as React.CSSProperties,

    videoContainer: {
        margin: '15px 0',
        padding: '15px',
        backgroundColor: '#f5f5f7',
        borderRadius: '8px',
    } as React.CSSProperties,

    videoLink: {
        wordBreak: 'break-all',
        fontSize: '14px',
    } as React.CSSProperties,

    footer: {
        marginTop: '40px',
        paddingTop: '20px',
        borderTop: '1px solid #eee',
        fontSize: '12px',
        color: '#999',
    } as React.CSSProperties,

    footerContent: {
        display: 'flex',
        justifyContent: 'space-between',
    } as React.CSSProperties,

    footerText: {
        margin: 0,
    } as React.CSSProperties,
};

export default TravelPdfTemplate;