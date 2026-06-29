// components/map/EditMarkerModal.tsx
// C3.2: Extracted from MarkersListComponent.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import Feather from '@expo/vector-icons/Feather';
import { MarkerData } from '@/types/types';
import PhotoUploadWithPreview from '@/components/travel/PhotoUploadWithPreview';
import MultiSelectField from '@/components/forms/MultiSelectField';
import { isPointCategoryCreateEnabled } from '@/config/featureFlags';
import { createPointCategory } from '@/api/misc';
import type { useThemedColors } from '@/hooks/useTheme';

const MultiSelectFieldAny: any = MultiSelectField;

export interface EditMarkerModalProps {
    marker: MarkerData;
    index: number;
    categoryTravelAddress: { id: number | string; name: string }[];
    handleMarkerChange: (index: number, field: string, value: string | string[]) => void;
    handleImageUpload: (index: number, imageUrl: string) => void;
    handleMarkerSave?: (index: number, payload: { address: string; categories: string[]; image: string }) => Promise<void> | void;
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
    handleMarkerSave,
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
    const [localImage, setLocalImage] = useState<string>(marker.image || '');
    const [extraCategories, setExtraCategories] = useState<{ id: string; name: string }[]>([]);

    useEffect(() => {
        setAddress(marker.address || '');
        setCategories(normalizeCategories(marker.categories));
        setLocalImage(marker.image || '');
        setExtraCategories([]);
    }, [marker, index, normalizeCategories]);

    const categoryItems = useMemo(() => {
        const seen = new Set(normalizedCategoryItems.map((c) => String(c.id)));
        return [...normalizedCategoryItems, ...extraCategories.filter((c) => !seen.has(c.id))];
    }, [normalizedCategoryItems, extraCategories]);

    const allowCreateCategory = isPointCategoryCreateEnabled();
    const handleCreateCategory = useCallback(async (name: string): Promise<string> => {
        const created = await createPointCategory(name);
        const idStr = String(created.id);
        setExtraCategories((prev) =>
            prev.some((c) => c.id === idStr) ? prev : [...prev, { id: idStr, name: created.name }],
        );
        return idStr;
    }, []);

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

    const handleSave = async () => {
        const trimmedAddress = address.trim().slice(0, 100);
        if (handleMarkerSave) {
            await handleMarkerSave(index, {
                address: trimmedAddress,
                categories,
                image: localImage,
            });
        } else {
            handleMarkerChange(index, 'address', trimmedAddress);
            handleMarkerChange(index, 'categories', categories);
            handleMarkerChange(index, 'image', localImage);
        }
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
                            onChange={(e) => setAddress(e.target.value.slice(0, 100))}
                            maxLength={100}
                            style={styles.input}
                            placeholder="Например: Парковка у озера Sucha"
                        />
                        <div style={{...styles.fieldHint, fontSize: '0.85em', color: colors.textMuted}}>
                            Можно оставить адрес из карты или сократить до понятного названия места. ({address.length}/100)
                        </div>
                    </div>

                    <div style={styles.field}>
                        <label style={styles.fieldLabel}>Категории точки</label>
                        <MultiSelectFieldAny
                            label=""
                            items={categoryItems}
                            value={categories}
                            onChange={(selected: any) => {
                                const next = normalizeCategories(selected as any[]);
                                setCategories(next);
                                handleMarkerChange(index, 'categories', next);
                            }}
                            allowCreate={allowCreateCategory}
                            onCreateItem={handleCreateCategory}
                            createLabel="Добавить категорию"
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
                                onClick={() => {
                                    void handleSave();
                                }}
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

export default React.memo(EditMarkerModal);
