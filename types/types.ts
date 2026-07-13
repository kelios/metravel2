// Типы для gallery и travelAddress
export type GalleryItem = string | {
    id: number;
    url: string;
    caption?: string;
    // Print-grade вариант (≥2500px) для PDF-книги; для старых фото бэк отдаёт == url (BE #307)
    print_url?: string;
    updated_at?: string;
}

// #709: серверный canonical rich-text — safe_html уже санитизирован бэком,
// клиент рендерит его без полного normalize+sanitize pipeline (дешёвый guard остаётся).
export type ServerRichTextBlock = {
    safe_html: string
    plain_text: string
}

export type ServerRichTextTocItem = {
    id: string
    level: number
    text: string
}

export type ServerRichText = {
    description?: (ServerRichTextBlock & { toc?: ServerRichTextTocItem[] }) | null
    plus?: ServerRichTextBlock | null
    minus?: ServerRichTextBlock | null
    recommendation?: ServerRichTextBlock | null
}

export type TravelAddressItem = string | {
    id: number;
    name: string;
    description?: string;
    coords?: string;
    lat?: number;
    lng?: number;
}

// #715: backend media variants manifest в payload travel (media.cover/gallery/address_images).
// URL внутри относительные (`/travel-image/...?w=640&q=75&fit=cover`) — резолвятся
// через utils/travelMediaVariants. Поле опционально: старый payload его не содержит.
export type TravelMediaImage = {
    id: number
    alt?: string | null
    dominant_color?: string | null
    blurhash?: string | null
    lqip_url?: string | null
    // Имена вида thumb_160 / card_640 / hero_1920 / print_2500 / original
    variants?: Record<string, string> | null
    srcset?: string | null
    sizes_hint?: string | null
    updated_at?: string | null
}

export type TravelMedia = {
    cover?: TravelMediaImage | null
    gallery?: TravelMediaImage[] | null
    address_images?: Record<string, TravelMediaImage> | null
}

export type Travel = {
    id: number
    slug: string

    name: string
    travel_image_thumb_url: string
    travel_image_thumb_small_url: string
    // Print-grade обложка (≥2500px) для PDF-книги; fallback на thumb если бэк не отдал (BE #307)
    travel_image_print_url?: string
    url: string
    youtube_link: string
    userName: string
    authorRank?: {
        level: number
        title: string
    } | null
    description: string
    recommendation: string
    plus: string
    minus: string
    // #709: canonical rich-text с бэка; отсутствует на старом payload
    rich_text?: ServerRichText | null
    cityName: string
    countryName: string
    countUnicIpView: string
    // Рейтинг путешествия
    rating?: number | null
    rating_count?: number
    user_rating?: number | null
    comment_count?: number | null
    comments_count?: number | null
    thread_id?: number | null
    comment_thread_id?: number | null
    // ✅ ИСПРАВЛЕНО: Поддержка обоих форматов для обратной совместимости
    gallery: GalleryItem[]
    travelAddress: TravelAddressItem[]
    // #715: backend media variants manifest; отсутствует на старом payload
    media?: TravelMedia | null
    userIds: string
    year: string
    monthName: string
    number_days: number
    companions: string[]
    coordsMeTravel?: Array<{
        lat: number
        lng: number
        title?: string
        description?: string
        coord?: string
    }>

    // Опциональный скрин карты для PDF (data URL или абсолютный URL)
    mapImageUrl?: string

    countryCode: string
    // Дополнительные поля, которые могут приходить из API
    user?: {
        id: number;
        name: string;
        first_name?: string;
        last_name?: string;
        avatar?: string;
    }
    created_at?: string
    updated_at?: string
    publish?: boolean | number | null
    moderation?: boolean | number | null
    publication_status?: 'draft' | 'approved' | 'published' | string | null
    engagementStats?: {
        favoritesCount: number | null
        wishlistCount: number | null
        visitedCount: number | null
        plannedCount: number | null
    }
}

export type TravelCoords = {
    address?: string
    categoryName: string
    coord?: string
    lat: string
    lng: string
    travelImageThumbUrl: string
    travelImageLandscapeUrl?: string
    imageUrl?: string
    urlTravel: string
    articleUrl?: string
}

export type TravelInfo = {
    name: string
    url: string
    publish: boolean
    moderation: boolean
    countryName: string
    travel_image_thumb_url: string
    travel_image_thumb_small_url: string
    slug: string
    id: number
}

export type TravelsMap = {
    [key: string]: TravelInfo
}

export type TravelsForMap = {
    [key: number]: TravelCoords
}

export type Travels = {
    data: Array<{
        id: number
        slug: string

        name: string
        travel_image_thumb_url: string
        travel_image_thumb_small_url: string
        url: string

        userName: string
        description: string
        cityName: string
        countryName: string
        countUnicIpView: string
    }>
    total: number
}

export type Articles = {
    data: Article[]
    total: number
}

export type Article = {
    id?: number
    slug?: string
    url?: string
    name: string
    description: string
    // #709: canonical rich-text с бэка; отсутствует на старом payload
    rich_text?: ServerRichText | null
    article_image_thumb_url: string
    article_image_thumb_small_url: string
    article_type: ArticleType
    // Рейтинг статьи
    rating?: number | null
    rating_count?: number
    user_rating?: number | null
}

export type ArticleType = {
    id: number
    name: string
    status: number
    created_at: number
    updated_at: number
}

export type Filters = {
    countries: string[]
    categories: string[]
    categoryTravelAddress: string[]
    companions: string[]
    complexity: string[]
    month: string[]
    over_nights_stay: string[]
    sortings?: Array<{
        id: string
        name: string
        sortBy?: string
        sortOrder?: 'asc' | 'desc'
    }>
    transports: string[]
    year: string
    user_id?: number
}

export type FeedbackData = {
    name: string
    email: string
    message: string
}

export type FiltersContextType = {
    filters: Filters;
    updateFilters: (newFilters: Partial<Filters>) => void;
}

export interface FormValues {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
}

export interface TravelFilters {
    countries: Array<{ country_id: string; title_ru: string }>;
    categories: Array<{ id: string; name: string }>;
    transports: Array<{ id: string; name: string }>;
    complexity: Array<{ id: string; name: string }>;
    companions: Array<{ id: string; name: string }>;
    over_nights_stay: Array<{ id: string; name: string }>;
    month: Array<{ id: string; name: string }>;
}


export interface TravelFormData {
    id?: string | null;
    slug?: string;
    name?: string;
    countries: string[];
    cities: string[];
    over_nights_stay: string[];
    complexity: string[];
    companions: string[];
    description?: string | null;
    plus?: string | null;
    minus?: string | null;
    recommendation?: string | null;
    youtube_link?: string | null;
    gallery?: GalleryItem[];
    categories: string[];
    countryIds: string[];
    travelAddressIds: string[];
    travelAddressCity: string[];
    travelAddressCountry: string[];
    travelAddressAdress: string[];
    travelAddressCategory: string[];
    coordsMeTravel: any[];
    thumbs200ForCollectionArr: string[];
    travelImageThumbUrlArr: string[];
    // Backend compatibility (legacy typo in serializer contract)
    travelImageThumbUrArr?: string[];
    travelImageAddress: string[];
    categoriesIds: string[];
    transports: string[];
    month: string[];
    year?: string;
    visitedDate?: string;
    budget?: string;
    number_peoples?: string;
    number_days?: string;
    visa: boolean;
    publish: boolean;
    moderation?: boolean;
    travel_image_thumb_url?: string | null;
    travel_image_thumb_small_url?: string | null;

}

export interface MarkerData {
    id: number | null; // Добавляем поле id
    lat: number;
    lng: number;
    country: number | null;
    address: string;
    categories: number[];
    image: string | null;
}
