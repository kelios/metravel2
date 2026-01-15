// data/krakow/krakowDragon.ts
import type { QuestStep, QuestFinale } from '@/components/quests/QuestWizard';

const normalize = (s: string) =>
    s.toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[.,;:!?'„”"–—-]/g, '')
        .replace('ё', 'е')
        .trim();

// util to avoid bundler crash if asset missing
function tryImage<T>(fn: () => T): T | null {
    try { return fn(); } catch { return null as any; }
}

const IMG1 = tryImage(() => require('@/assets/quests/krakowDragon/1.png'));
const IMG2 = tryImage(() => require('@/assets/quests/krakowDragon/2.png'));
const IMG3 = tryImage(() => require('@/assets/quests/krakowDragon/3.png'));
const IMG4 = tryImage(() => require('@/assets/quests/krakowDragon/4.png'));
const IMG5 = tryImage(() => require('@/assets/quests/krakowDragon/5.png'));
const IMG6 = tryImage(() => require('@/assets/quests/krakowDragon/6.png'));
const IMG7 = tryImage(() => require('@/assets/quests/krakowDragon/7.png'));
const VIDEO = (() => { try { return require('@/assets/quests/krakowDragon/krakowDragon.mp4'); } catch { return null; } })();

export const KRAKOW_DRAGON_INTRO: QuestStep = {
    id: 'intro',
    title: 'Как пройти квест?',
    location: 'Начало приключения',
    story: `Этот квест — путешествие по Кракову, где оживает легенда о Вавельском драконе.

Что делать:
1) Прочитай легенду и задание для каждой точки.
2) Найди место на карте.
3) Осмотрись и выполни задание.
4) Введи ответ — откроется следующий шаг.

Подсказки: подсказывают направление, но не выдают ответ.

Финал: после всех испытаний — встреча с драконом!`,
    task: 'Нажми «Начать квест», чтобы отправиться в путь.',
    hint: undefined,
    answer: () => true,
    lat: 0, lng: 0, mapsUrl: '', image: null,
};

export const KRAKOW_DRAGON_STEPS: QuestStep[] = [
    {
        id: '1-rynek',
        title: 'Рыночная площадь — пробуждение легенды',
        location: 'Rynek Główny',
        story: 'Сердце Кракова бьётся здесь. У подножия «Eros Bendato» шепчут о чудовище, что жил под Вавелем. Если заметил голову — смотри на её сторону: там первый след. Эхо мелодии трубача направит дальше — к Мариацкому костёлу.',
        task: 'Посмотри на Суконные ряды напротив «Eros Bendato». Считай окна над аркадами только со стороны, где стоит голова. Сколько их?',
        hint: 'Смотри на «свою» половину рядов со стороны головы. Окна идут подряд, высоко.',
        answer: s => { const n = parseInt(s,10); return !Number.isNaN(n) && n >= 21 && n <= 23; },
        lat: 50.061697, lng: 19.937117,
        mapsUrl: 'https://maps.google.com/?q=Rynek%20G%C5%82%C3%B3wny%20Krak%C3%B3w',
        image: IMG1,
    },
    {
        id: '2-mariacki',
        title: 'Мариацкий костёл — оборванная мелодия',
        location: 'Bazylika Mariacka',
        story: 'Трубач каждый час поднимал тревогу, но стрела прервала его песнь. С тех пор мелодия всегда обрывается — и повторяется снова и снова. Отзвуки приведут тебя к печати города в Суконных рядах.',
        task: 'Сколько раз он слышен в течение суток?',
        hint: 'Подумай о том, сколько раз сменяется часовая стрелка.',
        answer: s => parseInt(s,10) === 24,
        lat: 50.061721, lng: 19.939094,
        mapsUrl: 'https://maps.google.com/?q=St%20Mary%27s%20Basilica%20Krakow',
        image: IMG2,
    },
    {
        id: '3-sukiennice',
        title: 'Суконные ряды — печать города',
        location: 'Sukiennice',
        story: 'На фасадах и внутри рядов — герб-печать, что веками оберегала город от бед. В её башнях заключена сила. Три стража укажут путь к северной границе — к Флорианским воротам.',
        task: 'Сколько башен на гербе города? Введи число.',
        hint: 'Герб можно найти не только снаружи — пройдись внутри вдоль рядов и присмотрись к эмблемам.',
        answer: s => parseInt(s,10) === 3,
        lat: 50.061667, lng: 19.937373,
        mapsUrl: 'https://maps.google.com/?q=Sukiennice%20Krakow',
        image: IMG3,
    },
    {
        id: '4-barbakan',
        title: 'Флорианские ворота — страж на рубеже',
        location: 'Флорианские ворота',
        story: 'Северный вход города охраняет птица силы. Её барельеф смотрит в сторону Барбака — напоминание о линиях обороны. Найдёшь её — свет в Казимежe подскажет следующий след.',
        task: 'Найди барельеф над порталом Флорианских ворот. Какая птица охраняет вход со стороны Барбака?',
        hint: 'Крылья раскинуты, взгляд строгий — символ власти и защиты.',
        answer: s => normalize(s) === 'орел',
        lat: 50.06551229826169, lng: 19.941680331885227,
        mapsUrl: 'https://maps.google.com/?q=Florian%20Gate%20Krakow',
        image: IMG4,
    },
    {
        id: '5-kazimierz',
        title: 'Казимеж — перекрёсток голосов',
        location: 'Старая синагога',
        story: 'В этих кварталах легенду рассказывали по-разному, и правду о драконе отражали ночные огни на фасадах. Свет укажет путь к мосту между небом и землёй.',
        task: 'Сколько источников света освещают этот фасад ночью?',
        hint: 'Считай отдельные точки света, а не блики.',
        answer: s => { const n = parseInt(s,10); return !Number.isNaN(n) && n >= 2 && n <= 4; },
        lat: 50.05152733785882, lng: 19.94864899181073,
        mapsUrl: 'https://maps.google.com/?q=Old%20Synagogue%20Krakow',
        image: IMG5,
    },
    {
        id: '6-wawel',
        title: 'Мост между небом и землёй',
        location: 'Мост (см. карту)',
        story: 'Говорят, этот мост соединяет земное и небесное. Даже здесь чувствуется дыхание легенды — смотри внимательнее: драконьи мотивы продолжают путь к логову.',
        task: 'Сколько драконов охраняют мост?',
        hint: 'Осмотрись по торцам и декоративным элементам',
        answer: s => parseInt(s,10) === 1,
        lat: 50.046563, lng: 19.947499,
        mapsUrl: 'https://maps.google.com/?q=50.046563,19.947499',
        image: IMG6,
    },
    {
        id: '7-smocza-jama',
        title: 'Smocza Jama — логово чудовища',
        location: 'Пещера дракона',
        story: 'Вот она — Smocza Jama. Двигайся именно к входу в пещеру: короткая каменная лестница ведёт прямо к порогу.',
        task: 'Дойди до входа в пещеру и посчитай ступени, которые ведут до порога. Сколько ступеней до пещеры?',
        hint: 'Считай только до входа (внутри не нужно). Ответ — двузначное число.',
        answer: s => parseInt(s,10) === 12,
        lat: 50.05317524594176, lng: 19.93359915663944,
        mapsUrl: 'https://maps.google.com/?q=Smocza%20Jama%20Krakow',
        image: IMG7,
    },
];

export const KRAKOW_DRAGON_FINALE: QuestFinale = {
    text:   'Ты прошёл путь легенды! Под холмом спал дракон, но его дух не исчез. ' +
        'Он живёт в каждом камне, в шуме Вислы и в сердце Кракова. ' +
        'Пока звучит история — дракон просыпается вновь, напоминая: сила города — в единстве его людей и в их памяти.',
    video: VIDEO,
};

// удобные реэкспорты, если где-то пригодится normalize/tryImage
export { normalize, tryImage };
