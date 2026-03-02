import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import Feather from '@expo/vector-icons/Feather';
import { MarkerData } from "@/types/types";
import PhotoUploadWithPreview from '@/components/travel/PhotoUploadWithPreview';
import MultiSelectField from '@/components/forms/MultiSelectField';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { useThemedColors } from '@/hooks/useTheme';
import { normalizeMediaUrl } from '@/utils/mediaUrl';
import { useStyles } from './markersListStyles';

const MultiSelectFieldAny: any = MultiSelectField;
 
interface MarkersListComponentProps {
    markers: MarkerData[];
    categoryTravelAddress: { id: number | string; name: string }[];
    handleMarkerChange: (index: number, field: string, value: string | string[]) => void;
    handleImageUpload: (index: number, imageUrl: string) => void;
    handleMarkerRemove: (index: number) => void;
    editingIndex: number | null;
    setEditingIndex: (index: number | null) => void;
    activeIndex?: number | null;
    setActiveIndex?: (index: number | null) => void;
    onAddMarkerFromPhoto?: (file: File) => void | Promise<void>;
}
const normalizeImageUrl = (url?: string | null) => normalizeMediaUrl(url);


const MarkersListComponent: React.FC<MarkersListComponentProps> = ({
                                                               markers,
                                                               categoryTravelAddress,
                                                               handleMarkerChange,
                                                               handleImageUpload,
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
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const onRemove = useCallback((index: number) => handleMarkerRemove(index), [handleMarkerRemove]);
    const onEdit = useCallback((index: number) => {
        setEditingIndex(index);
        setActiveIndex?.(index);
    }, [setEditingIndex, setActiveIndex]);

    const filteredMarkers = useMemo(
        () =>
            markers
                .map((marker, index) => ({ marker, index }))
                .filter(({ marker }) => {
                    if (!search.trim()) return true;
                    const q = search.toLowerCase();
                    return (marker.address || '').toLowerCase().includes(q);
                }),
        [markers, search],
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

    return (
        <div style={styles.container}>
            <div style={styles.headerRow}>
                <div style={styles.headerTitle}>Точки</div>
                <div style={styles.headerRight}>
                    {onAddMarkerFromPhoto ? (
                        <>
                            <button
                                type="button"
                                onClick={handleAddFromPhotoClick}
                                style={styles.addFromPhotoButton as React.CSSProperties}
                                title="Добавить точку из геолокации фото (EXIF)"
                            >
                                <Feather name="camera" size={14} color={colors.textMuted} />
                                <span>Из фото</span>
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
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
                        placeholder="Поиск по адресу"
                        style={styles.searchInput}
                    />
                </div>
            )}
            {markers.length === 0 ? (
                <p style={styles.emptyText}>
                    Пока нет ни одной точки маршрута. Нажмите на карту, чтобы добавить первую.
                </p>
            ) : (
                <div style={styles.list}>
                    {filteredMarkers.map(({ marker, index }) => {
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
                                  .join(', ') || 'Категории выбраны')
                            : 'Категории не выбраны';
                        // Проверяем, что image не пустая строка
                        const hasImage = marker.image && marker.image.trim().length > 0;

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
                                                src={normalizeImageUrl(marker.image)}
                                                fit="contain"
                                                blurBackground
                                                loading="lazy"
                                                priority="low"
                                                borderRadius={10}
                                                style={styles.previewMedia as any}
                                            />
                                        ) : (
                                            <div style={styles.placeholderImage} aria-label="Нет фото" />
                                        )}
                                        </div>
                                    <div style={styles.previewText}>
                                        <div style={styles.markerTitle} title={marker.address || 'Без адреса'}>
                                            {marker.address || 'Без адреса'}
                                        </div>
                                        <div style={styles.metaRow}>
                                            <span style={styles.badge}>{categoriesLabel}</span>
                                            {hasImage && <span style={styles.badgeMuted}>Есть фото</span>}
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
                                            <span>Редактировать</span>
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
                                            <span>Удалить</span>
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
                    onClose={() => setEditingIndex(null)}
                    onRemove={onRemove}
                    styles={styles}
                    colors={colors}
                />
            )}
        </div>
    );
};

interface EditMarkerModalProps {
    marker: MarkerData;
    index: number;
    categoryTravelAddress: { id: number | string; name: string }[];
    handleMarkerChange: (index: number, field: string, value: string | string[]) => void;
    handleImageUpload: (index: number, imageUrl: string) => void;
    onClose: () => void;
    onRemove: (index: number) => void;
    styles: any;
    colors: ReturnType<typeof useThemedColors>;
}
 

const EditMarkerModal: React.FC<EditMarkerModalProps> = ({
                                                             marker,
                                                             index,
                                                             categoryTravelAddress,
                                                             handleMarkerChange,
                                                             handleImageUpload,
                                                             onClose,
                                                             onRemove,
                                                             styles,
                                                             colors,
                                                         }) => {
    const normalizedCategoryItems = useMemo(
        () => categoryTravelAddress.map((cat) => ({ ...cat, id: String(cat.id) })),
        [categoryTravelAddress],
    );

    const normalizeCategories = useCallback(
        (cats?: any[]) => (Array.isArray(cats) ? cats.map((c) => String(c)) : []),
        [],
    );

    const [address, setAddress] = useState<string>(marker.address || '');
    const [categories, setCategories] = useState<any[]>(normalizeCategories(marker.categories));
    // ✅ FIX: Локальное состояние для изображения, чтобы превью обновлялось сразу после загрузки
    const [localImage, setLocalImage] = useState<string>(marker.image || '');

    useEffect(() => {
        setAddress(marker.address || '');
        setCategories(normalizeCategories(marker.categories));
        setLocalImage(marker.image || '');
    }, [marker, index, normalizeCategories]);
    
    // ✅ FIX: Обертка для handleImageUpload, которая также обновляет локальное состояние
    const handleLocalImageUpload = useCallback((imageUrl: string) => {
        setLocalImage(imageUrl);
        handleImageUpload(index, imageUrl);
    }, [handleImageUpload, index]);

    if (typeof document === 'undefined') return null;

    const persistEdits = () => {
        handleMarkerChange(index, 'address', address);
        handleMarkerChange(index, 'categories', categories);
        handleMarkerChange(index, 'image', localImage);
    };

    const handleClose = () => {
        persistEdits();
        onClose();
    };

    const handleSave = () => {
        persistEdits();
        onClose();
    };

    const handleDelete = () => {
        const shortAddr = address || marker.address || 'эту точку';
        const confirmed = window.confirm(`Удалить точку "${shortAddr}" из маршрута? Это действие нельзя отменить.`);
        if (!confirmed) return;
        onRemove(index);
        onClose();
    };

    return ReactDOM.createPortal(
        <div style={styles.modalOverlay}>
            <div style={styles.modalBackdrop} onClick={handleClose} />
            <div style={styles.modalContent}>
                <div style={styles.editForm}>
                    <div style={styles.editHeader}>
                        <div>
                            <div style={styles.editTitle}>Точка #{index + 1}</div>
                            <div style={styles.editSubtitle}>{marker.address || 'Без адреса'}</div>
                        </div>
                        <button
                            type="button"
                            onClick={handleClose}
                            style={styles.closeIconButton}
                        >
                            ×
                        </button>
                    </div>

                    <div style={styles.helperText}>
                        Опишите место так, чтобы вы сами через год быстро поняли, что здесь смотреть или делать.
                    </div>

                    <div style={styles.field}>
                        <label style={styles.fieldLabel}>Адрес точки</label>
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            style={styles.input}
                            placeholder="Например: Парковка у озера Sucha"
                        />
                        <div style={styles.fieldHint}>
                            Можно оставить адрес из карты или сократить до понятного названия места.
                        </div>
                    </div>

                    <div style={styles.field}>
                        <label style={styles.fieldLabel}>Категории точки</label>
                        <MultiSelectFieldAny
                            label=""
                            items={normalizedCategoryItems}
                            value={categories}
                            onChange={(selected: any) => {
                                const next = normalizeCategories(selected as any[]);
                                setCategories(next);
                                handleMarkerChange(index, 'categories', next);
                            }}
                            labelField="name"
                            valueField="id"
                            placeholder="Выберите..."
                            style={styles.multiSelect}
                            placeholderStyle={styles.multiSelectPlaceholder}
                            selectedTextStyle={styles.multiSelectSelectedText}
                            inputSearchStyle={styles.multiSelectSearchInput}
                            containerStyle={styles.multiSelectDropdownContainer}
                        />
                        <div style={styles.fieldHint}>
                            Выберите категории, которые описывают эту точку маршрута.
                        </div>
                    </div>

                    <div style={styles.field}>
                        <label style={styles.fieldLabel}>Изображение точки</label>
                        {marker.id != null ? (
                            <>
                                <PhotoUploadWithPreview
                                    collection="travelImageAddress"
                                    idTravel={String(marker.id)}
                                    oldImage={localImage}
                                    onUpload={handleLocalImageUpload}
                                    placeholder="Перетащите фото точки маршрута"
                                    maxSizeMB={10}
                                />
                                <div style={styles.fieldHint}>
                                    Фото поможет путешественникам узнать место. Можно загрузить одно главное изображение.
                                </div>
                            </>
                        ) : (
                            <div style={styles.fieldHint}>
                                Сначала сохраните маршрут, затем откройте точку снова — после этого можно загрузить фото.
                            </div>
                        )}
                    </div>

                    <div style={styles.actionsRow}>
                        <div style={styles.primaryActions}>
                            <button
                                type="button"
                                onClick={handleSave}
                                style={styles.primaryButton}
                            >
                                Сохранить
                            </button>
                            <button
                                type="button"
                                onClick={handleClose}
                                style={styles.secondaryButton}
                            >
                                Отмена
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={handleDelete}
                            style={styles.deleteTextButton}
                        >
                            <Feather name="trash-2" size={14} color={colors.danger} />
                            <span>Удалить точку</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};


export default React.memo(MarkersListComponent);
