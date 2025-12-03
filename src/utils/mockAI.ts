import { fetchTravels } from '@/src/api/travelsApi';
import { fetchArticles } from '@/src/api/articles';

// Словари для распознавания намерений
const COUNTRIES = {
    'польша': 'Польша',
    'poland': 'Польша',
    'беларусь': 'Беларусь',
    'belarus': 'Беларусь',
    'украина': 'Украина',
    'ukraine': 'Украина',
    'литва': 'Литва',
    'lithuania': 'Литва',
    'латвия': 'Латвия',
    'latvia': 'Латвия',
    'чехия': 'Чехия',
    'czech': 'Чехия',
    'словакия': 'Словакия',
    'slovakia': 'Словакия',
    'германия': 'Германия',
    'germany': 'Германия',
    'австрия': 'Австрия',
    'austria': 'Австрия',
};

const CITIES = {
    'краков': 'Краков',
    'krakow': 'Краков',
    'варшава': 'Варшава',
    'warsaw': 'Варшава',
    'минск': 'Минск',
    'minsk': 'Минск',
    'вильнюс': 'Вильнюс',
    'vilnius': 'Вильнюс',
    'рига': 'Рига',
    'riga': 'Рига',
    'прага': 'Прага',
    'prague': 'Прага',
    'берлин': 'Берлин',
    'berlin': 'Берлин',
    'вена': 'Вена',
    'vienna': 'Вена',
};

const INTENT_KEYWORDS = {
    search: ['найди', 'найти', 'ищи', 'поиск', 'покажи', 'показать', 'статьи', 'статья'],
    route: ['маршрут', 'route', 'подбери', 'подобрать', 'план', 'itinerary', 'дней', 'дня', 'день'],
    recommend: ['рекомендации', 'рекомендую', 'совет', 'советы', 'что посмотреть', 'куда поехать', 'лучшие места', 'достопримечательности', 'что посетить', 'куда сходить'],
    photo: ['фото', 'photo', 'фотографии', 'красивые места', 'instagram', 'инстаграм'],
    popular: ['популярные', 'популярное', 'топ', 'лучшие', 'best', 'top', 'самые красивые', 'самый красивый', 'самая красивая'],
};

// Извлечение ключевых слов из текста
function extractKeywords(text: string): {
    country?: string;
    city?: string;
    intent?: 'search' | 'route' | 'recommend' | 'photo' | 'popular';
    days?: number;
    query?: string;
} {
    const lowerText = text.toLowerCase();
    const result: any = {};

    // Поиск страны
    for (const [key, value] of Object.entries(COUNTRIES)) {
        if (lowerText.includes(key)) {
            result.country = value;
            break;
        }
    }

    // Поиск города
    for (const [key, value] of Object.entries(CITIES)) {
        if (lowerText.includes(key)) {
            result.city = value;
            break;
        }
    }

    // Определение намерения
    for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
        if (keywords.some(kw => lowerText.includes(kw))) {
            result.intent = intent as any;
            break;
        }
    }

    // Извлечение количества дней
    const daysMatch = lowerText.match(/(\d+)\s*(дн|дня|дней|day|days)/);
    if (daysMatch) {
        result.days = parseInt(daysMatch[1], 10);
    }

    // Специальная обработка запросов о замках и достопримечательностях
    if (lowerText.includes('замок') || lowerText.includes('замки') || lowerText.includes('castle') || lowerText.includes('castles')) {
        result.query = 'замки';
        // Если упоминается Беларусь, всегда устанавливаем страну
        if (lowerText.includes('беларусь') || lowerText.includes('belarus') || lowerText.includes('белорус')) {
            result.country = 'Беларусь';
        }
    }
    
    // Специальная обработка запросов о Минске
    if (lowerText.includes('минск') || lowerText.includes('minsk')) {
        result.city = 'Минск';
        if (lowerText.includes('посмотреть') || lowerText.includes('достопримечательности') || lowerText.includes('что')) {
            result.intent = 'recommend';
        }
    }

    // Общий поисковый запрос (если не найдено специфичных ключевых слов)
    if (!result.country && !result.city && !result.query) {
        const words = text.split(/\s+/).filter(w => w.length > 3);
        if (words.length > 0) {
            result.query = words.join(' ');
        }
    }

    return result;
}

// Формирование ответа на основе найденных данных
function formatResponse(
    intent: string | undefined,
    travels: any[],
    articles: any[],
    keywords: ReturnType<typeof extractKeywords>
): string {
    const SITE = process.env.EXPO_PUBLIC_SITE_URL || 'https://metravel.by';
    let response = '';
    const links: Array<{ title: string; url: string; type: 'travel' | 'article' }> = [];

    if (intent === 'search' || intent === 'recommend' || intent === 'popular') {
        // Специальная обработка для запросов о популярных местах
        if (intent === 'popular' && keywords.query === 'замки') {
            response = 'Вот самые красивые замки';
            if (keywords.country) {
                response += ` ${keywords.country}`;
            }
            response += ':\n\n';
        } else if (intent === 'recommend' && keywords.city === 'Минск') {
            response = 'Вот что можно посмотреть в Минске:\n\n';
        }
        
        if (travels.length > 0) {
            if (!response || (!response.includes('Вот') && !response.includes('Нашёл'))) {
                const count = travels.length;
                response += `Нашёл ${count} ${count === 1 ? 'путешествие' : count < 5 ? 'путешествия' : 'путешествий'}:\n\n`;
            }
            // Показываем все найденные результаты (уже ограничены до 5 для замков)
            travels.forEach((travel) => {
                const url = travel.slug 
                    ? `${SITE}/travels/${travel.slug}`
                    : `${SITE}/travels/${travel.id}`;
                links.push({
                    title: travel.name || 'Путешествие',
                    url,
                    type: 'travel',
                });
            });
        }

        if (articles.length > 0) {
            if (response) response += '\n\n';
            response += `Также нашёл ${articles.length} ${articles.length === 1 ? 'статью' : 'статей'}:\n\n`;
            articles.slice(0, 3).forEach((article) => {
                const url = article.slug 
                    ? `${SITE}/articles/${article.slug}`
                    : `${SITE}/articles/${article.id}`;
                links.push({
                    title: article.title || 'Статья',
                    url,
                    type: 'article',
                });
            });
        }

        if (travels.length === 0 && articles.length === 0) {
            response = 'К сожалению, ничего не нашёл по вашему запросу. Попробуйте переформулировать вопрос или уточнить страну/город.';
        }
    } else if (intent === 'route') {
        if (travels.length > 0) {
            response += `Подобрал ${travels.length} ${travels.length === 1 ? 'маршрут' : 'маршрутов'}`;
            if (keywords.days) {
                response += ` на ${keywords.days} ${keywords.days === 1 ? 'день' : keywords.days < 5 ? 'дня' : 'дней'}`;
            }
            response += ':\n\n';
            travels.slice(0, 5).forEach((travel) => {
                const url = travel.slug 
                    ? `${SITE}/travels/${travel.slug}`
                    : `${SITE}/travels/${travel.id}`;
                links.push({
                    title: travel.name || 'Маршрут',
                    url,
                    type: 'travel',
                });
            });
        } else {
            response = 'К сожалению, не нашёл подходящих маршрутов. Попробуйте указать страну или город.';
        }
    } else if (intent === 'photo') {
        if (travels.length > 0) {
            response += `Нашёл ${travels.length} ${travels.length === 1 ? 'место' : 'мест'} с красивыми фотографиями:\n\n`;
            travels
                .filter(t => t.gallery && t.gallery.length > 0)
                .slice(0, 5)
                .forEach((travel) => {
                    const url = travel.slug 
                        ? `${SITE}/travels/${travel.slug}`
                        : `${SITE}/travels/${travel.id}`;
                    links.push({
                        title: travel.name || 'Место для фото',
                        url,
                        type: 'travel',
                    });
                });
        } else {
            response = 'Не нашёл мест с фотографиями. Попробуйте указать другую страну или город.';
        }
    } else {
        // Общий ответ
        if (travels.length > 0 || articles.length > 0) {
            response = 'Вот что я нашёл:\n\n';
            if (travels.length > 0) {
                travels.slice(0, 3).forEach((travel) => {
                    const url = travel.slug 
                        ? `${SITE}/travels/${travel.slug}`
                        : `${SITE}/travels/${travel.id}`;
                    links.push({
                        title: travel.name || 'Путешествие',
                        url,
                        type: 'travel',
                    });
                });
            }
            if (articles.length > 0) {
                articles.slice(0, 2).forEach((article) => {
                    const url = article.slug 
                        ? `${SITE}/articles/${article.slug}`
                        : `${SITE}/articles/${article.id}`;
                    links.push({
                        title: article.title || 'Статья',
                        url,
                        type: 'article',
                    });
                });
            }
        } else {
            response = 'Попробуйте задать вопрос более конкретно. Например:\n• "Что посмотреть в Минске?"\n• "Самые красивые замки Беларуси"\n• "Найди статьи про Польшу"\n• "Подбери маршрут на 3 дня"';
        }
    }

    // Форматируем ссылки в markdown
    const formattedLinks = links.map(link => `[${link.title}](${link.url})`).join('\n');
    if (formattedLinks) {
        response += '\n\n' + formattedLinks;
    }

    return response;
}

// Основная функция мок-AI
export async function mockAIMessage(userMessage: string): Promise<{
    reply: string;
    links?: Array<{ title: string; url: string; type: 'travel' | 'article' }>;
}> {
    // Имитация задержки для реалистичности
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));

    const keywords = extractKeywords(userMessage);
    
    try {
        // Формируем параметры поиска
        const searchParams: Record<string, any> = {
            publish: 1,
            moderation: 1,
        };

        // Поиск путешествий
        let searchQuery = '';
        // Специальная обработка для запросов о замках Беларуси
        if (keywords.query === 'замки' && keywords.country === 'Беларусь') {
            // Ищем по стране и ключевому слову
            searchQuery = 'Беларусь замки';
        } else if (keywords.query && (keywords.country || keywords.city)) {
            // Комбинируем запрос с городом/страной для лучших результатов
            searchQuery = `${keywords.country || keywords.city} ${keywords.query}`.trim();
        } else {
            searchQuery = keywords.country || keywords.city || keywords.query || '';
        }
        
        // Для запросов о замках увеличиваем количество результатов для лучшего поиска
        const itemsPerPage = (keywords.query === 'замки' && keywords.country === 'Беларусь') ? 20 : 10;
        const travelsResult = await fetchTravels(0, itemsPerPage, searchQuery, searchParams);
        let travels = Array.isArray(travelsResult) 
            ? travelsResult 
            : (travelsResult?.data || []);
        
        // Для запросов о замках фильтруем и ограничиваем до 5 результатов
        if (keywords.query === 'замки' && keywords.country === 'Беларусь') {
            // Фильтруем результаты, которые содержат слова связанные с замками
            const castleKeywords = ['замок', 'замки', 'castle', 'крепость', 'дворец', 'palace', 'fortress', 'мирский', 'несвиж', 'крев', 'лида', 'новогрудок'];
            const filteredTravels = travels.filter(travel => {
                const name = (travel.name || '').toLowerCase();
                const description = (travel.description || '').toLowerCase();
                const location = (travel.location || '').toLowerCase();
                return castleKeywords.some(keyword => 
                    name.includes(keyword) || 
                    description.includes(keyword) || 
                    location.includes(keyword)
                );
            });
            
            // Если после фильтрации есть результаты, используем их, иначе берем первые результаты
            travels = filteredTravels.length > 0 ? filteredTravels.slice(0, 5) : travels.slice(0, 5);
        }

        // Поиск статей
        // fetchArticles не поддерживает поисковый запрос напрямую, используем только фильтры
        const articlesResult = await fetchArticles(0, 10, searchParams);
        const articles = Array.isArray(articlesResult?.data)
            ? articlesResult.data
            : [];

        // Формируем ответ
        const replyText = formatResponse(keywords.intent, travels, articles, keywords);

        // Извлекаем ссылки из ответа
        const links: Array<{ title: string; url: string; type: 'travel' | 'article' }> = [];
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        let match;
        while ((match = linkRegex.exec(replyText)) !== null) {
            const [, title, url] = match;
            links.push({
                title,
                url: url.startsWith('http') ? url : `${process.env.EXPO_PUBLIC_SITE_URL || 'https://metravel.by'}${url}`,
                type: url.includes('/travels/') ? 'travel' : 'article',
            });
        }

        return {
            reply: replyText,
            links: links.length > 0 ? links : undefined,
        };
    } catch (error) {
        console.error('Ошибка в mockAI:', error);
        return {
            reply: 'Произошла ошибка при поиске. Попробуйте переформулировать вопрос или попробовать позже.',
        };
    }
}
