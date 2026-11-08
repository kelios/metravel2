import React, { useCallback } from 'react';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { translate as i18nT } from '@/i18n';
import HeartToggleButton, { type HeartToggleVariant } from './HeartToggleButton';


type FavoriteButtonProps = {
    id: string | number;
    type: 'travel' | 'article';
    title: string;
    imageUrl?: string;
    url: string;
    country?: string;
    city?: string;
    size?: number;
    color?: string;
    variant?: HeartToggleVariant;
    style?: any;
};

const FAVORITE_INTENT_SOURCE = 'favorite_button';

/** ♥ статьи: «Хочу поехать» через useFavoriteToggle; вид — общий HeartToggleButton. */
function FavoriteButton({
    id,
    type,
    title,
    imageUrl,
    url,
    country,
    city,
    size,
    color,
    variant = 'plain',
    style,
}: FavoriteButtonProps) {
    const { isFavorite, toggle, pending: isPending } = useFavoriteToggle({ id, type });
    const isFav = isFavorite(id, type);

    // Оба варианта (overlay и plain) идут через useFavoriteToggle: отклик одинаковый.
    const handlePress = useCallback(() => {
        void toggle({
            id,
            type,
            title,
            url,
            imageUrl,
            country,
            city,
            source: FAVORITE_INTENT_SOURCE,
        });
    }, [toggle, id, type, title, url, imageUrl, country, city]);

    return (
        <HeartToggleButton
            active={isFav}
            onPress={handlePress}
            pending={isPending}
            size={size}
            color={color}
            variant={variant}
            style={style}
            overlayLabel={isFav
                ? i18nT('travel:components.travel.OptimizedFavoriteButton.udalit_iz_hochu_poehat_2f50b03f')
                : i18nT('travel:components.travel.OptimizedFavoriteButton.dobavit_v_hochu_poehat_c9b63a42')}
            plainLabel={isFav
                ? i18nT('travel:components.travel.FavoriteButton.udalit_iz_hochu_poehat_b6ff82c1')
                : i18nT('travel:components.travel.FavoriteButton.dobavit_v_hochu_poehat_fbf5211c')}
            plainAccessibilityLabel={isFav
                ? i18nT('travel:components.travel.FavoriteButton.udalit_value1_iz_hochu_poehat_70288eb2', { value1: title })
                : i18nT('travel:components.travel.FavoriteButton.dobavit_value1_v_hochu_poehat_c698c838', { value1: title })}
            plainAccessibilityHint={isFav
                ? i18nT('travel:components.travel.FavoriteButton.udalyaet_element_iz_hochu_poehat_0c985c36')
                : i18nT('travel:components.travel.FavoriteButton.dobavlyaet_element_v_hochu_poehat_31cd24d0')}
        />
    );
}

export default React.memo(FavoriteButton);
