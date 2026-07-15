import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { MarkerData } from "@/types/types";
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { useThemedColors } from '@/hooks/useTheme';
import { getTravelPointImageUrl } from '@/utils/travelPointImages';
import { EXIF_IMAGE_INPUT_ACCEPT } from '@/utils/exifGps';
import { useStyles } from './markersListStyles';
import EditMarkerModal from './EditMarkerModal';
import { translate as i18nT } from '@/i18n'


interface MarkersListComponentProps {
    markers: MarkerData[];
    categoryTravelAddress: { id: number | string; name: string }[];
    handleMarkerChange: (index: number, field: string, value: string | string[]) => void;
    handleImageUpload: (index: number, imageUrl: string) => void;
    handleMarkerSave?: (index: number, payload: { address: string; categories: string[]; image: string }) => Promise<void> | void;
    handleMarkerRemove: (index: number) => void;
    editingIndex: number | null;
    setEditingIndex: (index: number | null) => void;
    activeIndex?: number | null;
    setActiveIndex?: (index: number | null) => void;
    onAddMarkerFromPhoto?: (file: File) => void | Promise<void>;
}
const MarkersListComponent: React.FC<MarkersListComponentProps> = ({
                                                               markers,
                                                               categoryTravelAddress,
                                                               handleMarkerChange,
                                                               handleImageUpload,
                                                               handleMarkerSave,
                                                               handleMarkerRemove,
                                                               editingIndex,
                                                               setEditingIndex,
                                                               activeIndex,
                                                               setActiveIndex,
                                                               onAddMarkerFromPhoto,
                                                           }) => {
    const colors = useThemedColors();
    const styles = useStyles(colors);
    const [search, setSearch] = useState('');
    const [isDragOver, setIsDragOver] = useState(false);
    const dragDepthRef = useRef(0);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const onRemove = useCallback((index: number) => handleMarkerRemove(index), [handleMarkerRemove]);
    const onEdit = useCallback((index: number) => {
        setEditingIndex(index);
        setActiveIndex?.(index);
    }, [setEditingIndex, setActiveIndex]);

    const searchQuery = search.trim();

    const filteredMarkers = useMemo(
        () =>
            markers
                .map((marker, index) => ({ marker, index }))
                .filter(({ marker }) => {
                    if (!searchQuery) return true;
                    const q = search.toLowerCase();
                    return (marker.address || '').toLowerCase().includes(q);
                }),
        [markers, search, searchQuery],
    );

    useEffect(() => {
        if (typeof document === 'undefined') return;
        if (activeIndex == null) return;

        const el = document.getElementById(`marker-${activeIndex}`);
        if (!el) return;

        const container = document.getElementById('markers-scroll-container');
        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();

        const currentScrollTop = container.scrollTop;
        const elTopInContainer = (elRect.top - containerRect.top) + currentScrollTop;
        const target = elTopInContainer - (container.clientHeight / 2) + (el.clientHeight / 2);

        container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    }, [activeIndex]);

    const handleAddFromPhotoClick = useCallback(() => {
        if (!onAddMarkerFromPhoto) return;
        fileInputRef.current?.click();
    }, [onAddMarkerFromPhoto]);

    const handleDropZoneKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLDivElement>) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleAddFromPhotoClick();
            }
        },
        [handleAddFromPhotoClick],
    );

    const handlePhotoSelected = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            if (!onAddMarkerFromPhoto) return;
            const file = e.target.files?.[0] ?? null;
            // allow selecting the same file again
            e.target.value = '';
            if (!file) return;
            await onAddMarkerFromPhoto(file);
        },
        [onAddMarkerFromPhoto]
    );

    const isImageFile = useCallback((file: File) => {
        if (file.type.startsWith('image/')) return true;
        // HEIC/HEIF often come with an empty MIME type
        return /\.(heic|heif|jpe?g|png|webp)$/i.test(file.name);
    }, []);

    const handleDragOver = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            if (!onAddMarkerFromPhoto) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        },
        [onAddMarkerFromPhoto]
    );

    const handleDragEnter = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            if (!onAddMarkerFromPhoto) return;
            e.preventDefault();
            dragDepthRef.current += 1;
            setIsDragOver(true);
        },
        [onAddMarkerFromPhoto]
    );

    const handleDragLeave = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            if (!onAddMarkerFromPhoto) return;
            e.preventDefault();
            dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
            if (dragDepthRef.current === 0) setIsDragOver(false);
        },
        [onAddMarkerFromPhoto]
    );

    const handleDrop = useCallback(
        async (e: React.DragEvent<HTMLDivElement>) => {
            if (!onAddMarkerFromPhoto) return;
            e.preventDefault();
            dragDepthRef.current = 0;
            setIsDragOver(false);
            const files = Array.from(e.dataTransfer.files || []).filter(isImageFile);
            // process sequentially so reverse-geocode and country derivation stay consistent
            for (const file of files) {
                await onAddMarkerFromPhoto(file);
            }
        },
        [onAddMarkerFromPhoto, isImageFile]
    );

    return (
        <div
            style={{
                ...(styles.container as React.CSSProperties),
                ...(isDragOver ? (styles.containerDragActive as React.CSSProperties) : {}),
            }}
            onDragOver={onAddMarkerFromPhoto ? handleDragOver : undefined}
            onDragEnter={onAddMarkerFromPhoto ? handleDragEnter : undefined}
            onDragLeave={onAddMarkerFromPhoto ? handleDragLeave : undefined}
            onDrop={onAddMarkerFromPhoto ? handleDrop : undefined}
        >
            {isDragOver && onAddMarkerFromPhoto ? (
                <div style={styles.dropOverlay as React.CSSProperties}>
                    <Feather name="image" size={22} color={colors.primaryDark} />
                    <span style={styles.dropOverlayText}>{i18nT('map:components.map.MarkersListComponent.otpustite_foto_dobavim_tochki_po_geolokatsii_be12ffea')}</span>
                </div>
            ) : null}
            <div style={styles.stickyHeader as React.CSSProperties}>
                <div style={styles.headerRow}>
                    <div style={styles.headerTitle}>{i18nT('map:components.map.MarkersListComponent.tochki_1da3e772')}</div>
                    <div style={styles.headerRight}>
                        {onAddMarkerFromPhoto ? (
                            <>
                                <button
                                    type="button"
                                    onClick={handleAddFromPhotoClick}
                                    style={styles.addFromPhotoButton as React.CSSProperties}
                                    title={i18nT('map:components.map.MarkersListComponent.dobavit_tochku_iz_geolokatsii_foto_exif_b56ac886')}
                                >
                                    <Feather name="camera" size={14} color={colors.textMuted} />
                                    <span>{i18nT('map:components.map.MarkersListComponent.iz_foto_30cc8944')}</span>
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept={EXIF_IMAGE_INPUT_ACCEPT}
                                    onChange={handlePhotoSelected}
                                    style={styles.fileInputHidden as React.CSSProperties}
                                />
                            </>
                        ) : null}
                        <div style={styles.headerBadge}>{markers.length}</div>
                    </div>
                </div>
                {markers.length > 0 && (
                    <div style={styles.searchRow}>
                        <Feather name="search" size={14} color={colors.textMuted} />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={i18nT('map:components.map.MarkersListComponent.poisk_po_adresu_418399ea')}
                            style={styles.searchInput}
                        />
                    </div>
                )}
                {markers.length > 0 && onAddMarkerFromPhoto ? (
                    <div
                        role="button"
                        tabIndex={0}
                        aria-label={i18nT('map:components.map.MarkersListComponent.dobavit_tochki_iz_foto_peretaschite_foto_syu_f225fa62')}
                        onClick={handleAddFromPhotoClick}
                        onKeyDown={handleDropZoneKeyDown}
                        style={{
                            ...(styles.dropZone as React.CSSProperties),
                            ...(styles.dropZoneCompact as React.CSSProperties),
                            ...(isDragOver ? (styles.dropZoneActive as React.CSSProperties) : {}),
                            marginBottom: 0,
                        }}
                    >
                        <div style={styles.dropZoneCompactIcon as React.CSSProperties}>
                            <Feather name="image" size={16} color={colors.primaryDark} />
                        </div>
                        <div style={styles.dropZoneCompactText as React.CSSProperties}>
                            <div style={styles.dropZoneTitle}>{i18nT('map:components.map.MarkersListComponent.peretaschite_foto_syuda_2a4ca511')}</div>
                            <div style={styles.dropZoneHint}>{i18nT('map:components.map.MarkersListComponent.ili_nazhmite_chtoby_vybrat_koordinaty_iz_exi_b1c912b3')}</div>
                        </div>
                    </div>
                ) : null}
            </div>
            {markers.length === 0 ? (
                <>
                    <p style={styles.emptyText}>
                        {i18nT('map:components.map.MarkersListComponent.poka_net_ni_odnoy_tochki_nazhmite_na_kartu_c_0df3e43c')}</p>
                    {onAddMarkerFromPhoto ? (
                        <div
                            role="button"
                            tabIndex={0}
                            aria-label={i18nT('map:components.map.MarkersListComponent.dobavit_tochki_iz_foto_peretaschite_foto_syu_f225fa62')}
                            onClick={handleAddFromPhotoClick}
                            onKeyDown={handleDropZoneKeyDown}
                            style={{
                                ...(styles.dropZone as React.CSSProperties),
                                ...(isDragOver ? (styles.dropZoneActive as React.CSSProperties) : {}),
                                marginTop: '12px',
                            }}
                        >
                            <div style={styles.dropZoneIcon as React.CSSProperties}>
                                <Feather name="image" size={20} color={colors.primaryDark} />
                            </div>
                            <div style={styles.dropZoneTitle}>{i18nT('map:components.map.MarkersListComponent.peretaschite_foto_syuda_2a4ca511')}</div>
                            <div style={styles.dropZoneHint}>
                                {i18nT('map:components.map.MarkersListComponent.ili_nazhmite_chtoby_vybrat_tochki_dobavyatsy_dcd11896')}</div>
                        </div>
                    ) : null}
                </>
            ) : (
                <div style={styles.list}>
                    {filteredMarkers.length === 0 ? (
                        <div style={styles.emptySearchState}>
                            <div style={styles.emptySearchTitle}>{i18nT('map:components.map.MarkersListComponent.nichego_ne_naydeno_713c909b')}</div>
                            <div style={styles.emptySearchText}>{i18nT('map:components.map.MarkersListComponent.proverte_adres_ili_ochistite_poisk_c68b1024')}</div>
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                style={styles.clearSearchButton}
                            >
                                {i18nT('map:components.map.MarkersListComponent.ochistit_poisk_dd1cdf6a')}</button>
                        </div>
                    ) : filteredMarkers.map(({ marker, index }) => {
                        const isEditing = editingIndex === index;

                        const hasCategories = marker.categories && marker.categories.length > 0;
                        const categoriesLabel = hasCategories
                            ? (marker.categories
                                  .map((catId: any) => {
                                      const targetId = String(catId);
                                      const found = categoryTravelAddress.find((c: any) => String(c.id) === targetId);
                                      return found?.name ?? null;
                                  })
                                  .filter(Boolean)
                                  .slice(0, 2)
                                  .join(', ') || i18nT('map:components.map.MarkersListComponent.kategorii_vybrany_5cae87f4'))
                            : i18nT('map:components.map.MarkersListComponent.kategorii_ne_vybrany_a50ecfb7');
                        const imageUrl = getTravelPointImageUrl(marker.image);
                        const hasImage = imageUrl.length > 0;

                        const isActive = activeIndex === index;

                        return (
                            <div
                                key={index}
                                id={`marker-${index}`}
                                style={{
                                    ...(styles.markerItem as React.CSSProperties),
                                    ...(isEditing ? (styles.editingItem as React.CSSProperties) : {}),
                                    ...(isActive ? (styles.activeItem as React.CSSProperties) : {}),
                                }}
                                onClick={() => setActiveIndex?.(index)}
                            >
                                <div style={styles.row}>
                                    <div style={styles.indexBadge}>{index + 1}</div>
                                    <div style={styles.thumbnailWrapper}>
                                        {hasImage ? (
                                            <ImageCardMedia
                                                src={imageUrl}
                                                fit="contain"
                                                blurBackground
                                                allowCriticalWebBlur
                                                loading="lazy"
                                                priority="low"
                                                borderRadius={10}
                                                style={styles.previewMedia as any}
                                            />
                                        ) : (
                                            <div
                                                style={styles.placeholderImage}
                                                aria-hidden="true"
                                            />
                                        )}
                                        </div>
                                    <div style={styles.previewText}>
                                        <div style={styles.markerTitle} title={marker.address || i18nT('map:components.map.MarkersListComponent.bez_adresa_d9cfb4f0')}>
                                            {marker.address || i18nT('map:components.map.MarkersListComponent.bez_adresa_d9cfb4f0')}
                                        </div>
                                        <div style={styles.metaRow}>
                                            <span style={styles.badge}>{categoriesLabel}</span>
                                            {hasImage && <span style={styles.badgeMuted}>{i18nT('map:components.map.MarkersListComponent.est_foto_6531b724')}</span>}
                                        </div>
                                    </div>
                                    <div style={styles.actions}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onEdit(index);
                                            }}
                                            style={styles.editButton}
                                            type="button"
                                        >
                                            <Feather name="edit-2" size={13} color={colors.primaryDark} />
                                            <span>{i18nT('map:components.map.MarkersListComponent.redaktirovat_6de468c0')}</span>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRemove(index);
                                            }}
                                            style={styles.deleteButton}
                                            type="button"
                                        >
                                            <Feather name="trash-2" size={13} color={colors.dangerDark} />
                                            <span>{i18nT('map:components.map.MarkersListComponent.udalit_316dc2c9')}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {editingIndex !== null && markers[editingIndex] && (
                <EditMarkerModal
                    marker={markers[editingIndex]}
                    index={editingIndex}
                    categoryTravelAddress={categoryTravelAddress}
                    handleMarkerChange={handleMarkerChange}
                    handleImageUpload={handleImageUpload}
                    handleMarkerSave={handleMarkerSave}
                    onClose={() => setEditingIndex(null)}
                    onRemove={onRemove}
                    styles={styles}
                    colors={colors}
                />
            )}
        </div>
    );
};


export default React.memo(MarkersListComponent);
