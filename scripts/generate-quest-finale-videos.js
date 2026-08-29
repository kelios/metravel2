#!/usr/bin/env node
/**
 * Генерация финальных видео квестов (Ken Burns по обложке) + постеров.
 *
 * Видео: 1280x720, ~17s, 3 сегмента zoompan с xfade, текст «Квест пройден!»
 * + название города. Ролик немой: backend-профиль финалов запрещает
 * аудиодорожку (см. scripts/quest-finale-video-profile.js).
 *
 * Требования:
 *   - ffmpeg (путь через env FFMPEG_PATH или в PATH)
 *   - ffmpeg без drawtext (homebrew) → нужен python3 с PIL: env PYTHON_PATH
 *   - обложки в assets/quests/<dir>/cover.png (warsaw-syrenka скачивается с прода)
 *
 * Запуск:
 *   FFMPEG_PATH=... node scripts/generate-quest-finale-videos.js [--quest-id=...] [--posters-existing]
 *
 * Выход: assets/quests/<dir>/finale.mp4 + poster.jpg (каталог в .gitignore).
 * --posters-existing: для 5 старых квестов с видео извлекает постер из прод-видео.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const { videoEncodeArgs, assertFileCompliant } = require('./quest-finale-video-profile.js');

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
// PIL нужен только для fallback-оверлея (ffmpeg без drawtext). На macOS PIL есть
// в /usr/bin/python3, а homebrew-python обычно без него — отсюда env-override.
const PYTHON = process.env.PYTHON_PATH || 'python3';
const API_BASE = 'https://metravel.by';
const ASSETS_DIR = path.resolve(__dirname, '..', 'assets', 'quests');

const args = process.argv.slice(2);
const questIdArg = args.find(a => a.startsWith('--quest-id='));
const ONLY_QUEST_ID = questIdArg ? questIdArg.split('=')[1] : null;
const POSTERS_EXISTING = args.includes('--posters-existing');

// finaleId — проверенный маппинг quest_id -> id в /api/quest-finales/ (текст финала сверен 2026-06-10)
const QUESTS = [
    { questId: 'warsaw-syrenka', dir: 'warsawSyrenka', city: 'Варшава', finaleId: 6 },
    { questId: 'grodno-royal', dir: 'grodnoRoyal', city: 'Гродно', finaleId: 7 },
    { questId: 'brest-fortress', dir: 'brestFortress', city: 'Брест', finaleId: 8 },
    { questId: 'vitebsk-chagall', dir: 'vitebskChagall', city: 'Витебск', finaleId: 9 },
    { questId: 'mogilev-stargazer', dir: 'mogilevStargazer', city: 'Могилёв', finaleId: 10 },
    { questId: 'lida-castle', dir: 'lidaCastle', city: 'Лида', finaleId: 11 },
    { questId: 'mir-castle', dir: 'mirCastle', city: 'Мир', finaleId: 12 },
    { questId: 'nesvizh-radziwill', dir: 'nesvizhRadziwill', city: 'Несвиж', finaleId: 13 },
    { questId: 'polotsk-ancient', dir: 'polotskAncient', city: 'Полоцк', finaleId: 14 },
    { questId: 'gomel-palace', dir: 'gomelPalace', city: 'Гомель', finaleId: 15 },
    { questId: 'kossovo-ruzhany-palaces', dir: 'kossovoRuzhanyPalaces', city: 'Коссово и Ружаны', finaleId: 16 },
    { questId: 'wroclaw-gnomes', dir: 'wroclawGnomes', city: 'Вроцлав', finaleId: 17 },
    { questId: 'gdansk-amber', dir: 'gdanskAmber', city: 'Гданьск', finaleId: 18 },
    { questId: 'poznan-goats', dir: 'poznanGoats', city: 'Познань', finaleId: 19 },
    { questId: 'lublin-old-town', dir: 'lublinOldTown', city: 'Люблин', finaleId: 20 },
    { questId: 'torun-copernicus', dir: 'torunCopernicus', city: 'Торунь', finaleId: 21 },
    { questId: 'vilnius-old-town', dir: 'vilniusOldTown', city: 'Вильнюс', finaleId: 22 },
    { questId: 'trakai-castle', dir: 'trakaiCastle', city: 'Тракай', finaleId: 23 },
    { questId: 'prague-old-town', dir: 'pragueOldTown', city: 'Прага', finaleId: 24 },
    { questId: 'lviv-old-town', dir: 'lvivOldTown', city: 'Львов', finaleId: 25 },
    // finaleId == числовой id квеста (finale создаётся OneToOne вместе с квестом).
    // Перед заливкой сверь: GET /api/quests/by-quest-id/<id>/ → finale.video_url ещё null.
    { questId: 'minsk-loshitsa', dir: 'minskLoshitsa', city: 'Минск', finaleId: 26 },
    { questId: 'minsk-traktorny', dir: 'minskTraktorny', city: 'Минск', finaleId: 27 },
    { questId: 'minsk-dvoriki', dir: 'minskDvoriki', city: 'Минск', finaleId: 28 },
    { questId: 'krakow-kazimierz', dir: 'krakowKazimierz', city: 'Краков', finaleId: 29 },
    { questId: 'krakow-podgorze', dir: 'krakowPodgorze', city: 'Краков', finaleId: 30 },
    { questId: 'krakow-nowahuta', dir: 'krakowNowaHuta', city: 'Краков', finaleId: 31 },
    { questId: 'minsk-cipher', dir: 'minskCipher', city: 'Минск', finaleId: 32 },
    { questId: 'bialystok-zamenhof', dir: 'bialystokZamenhof', city: 'Белосток', finaleId: 35 },
    { questId: 'kaunas-capital', dir: 'kaunasCapital', city: 'Каунас', finaleId: 36 },
    { questId: 'pinsk-polesie', dir: 'pinskPolesie', city: 'Пинск', finaleId: 37 },
    { questId: 'tbilisi-warm-city', dir: 'tbilisiWarmCity', city: 'Тбилиси', finaleId: 38 },
    { questId: 'istanbul-empires', dir: 'istanbulEmpires', city: 'Стамбул', finaleId: 39 },
    { questId: 'novogrudok-crown', dir: 'novogrudokCrown', city: 'Новогрудок', finaleId: 40 },
    { questId: 'batumi-golden-fleece', dir: 'batumiGoldenFleece', city: 'Батуми', finaleId: 41 },
    { questId: 'bobruisk-beaver-odessa', dir: 'bobruiskBeaverOdessa', city: 'Бобруйск', finaleId: 42 },
    { questId: 'budapest-two-cities', dir: 'budapestTwoCities', city: 'Будапешт', finaleId: 43 },
    { questId: 'oshmyany-crossroads', dir: 'oshmyanyCrossroads', city: 'Ошмяны', finaleId: 44 },
    { questId: 'kutaisi-golden-age', dir: 'kutaisiGoldenAge', city: 'Кутаиси', finaleId: 45 },
    { questId: 'antalya-kaleici', dir: 'antalyaKaleici', city: 'Анталья', finaleId: 46 },
    { questId: 'istanbul-galata', dir: 'istanbulGalata', city: 'Стамбул', finaleId: 47 },
    { questId: 'paris-point-zero', dir: 'parisPointZero', city: 'Париж', finaleId: 48 },
    { questId: 'amsterdam-on-piles', dir: 'amsterdamOnPiles', city: 'Амстердам', finaleId: 49 },
    { questId: 'berlin-wall-line', dir: 'berlinWallLine', city: 'Берлин', finaleId: 50 },
    { questId: 'brest-lantern', dir: 'brestLantern', city: 'Брест', finaleId: 51 },
    { questId: 'vitebsk-avangard', dir: 'vitebskAvangard', city: 'Витебск', finaleId: 52 },
    { questId: 'grodno-gorodnitsa', dir: 'grodnoGorodnitsa', city: 'Гродно', finaleId: 53 },
    { questId: 'lisbon-terramoto', dir: 'lisbonTerramoto', city: 'Лиссабон', finaleId: 54 },
    { questId: 'porto-port-wine', dir: 'portoPortWine', city: 'Порту', finaleId: 55 },
    { questId: 'mersin-cotton-port', dir: 'mersinCottonPort', city: 'Мерсин', finaleId: 56 },
    { questId: 'barcelona-barri-gotic', dir: 'barcelonaBarriGotic', city: 'Барселона', finaleId: 57 },
    { questId: 'athens-athena-poseidon', dir: 'athensAthenaPoseidon', city: 'Афины', finaleId: 58 },
    { questId: 'limassol-lionheart', dir: 'limassolLionheart', city: 'Лимасол', finaleId: 59 },
    { questId: 'dubrovnik-libertas', dir: 'dubrovnikLibertas', city: 'Дубровник', finaleId: 60 },
    { questId: 'bucharest-curtea-veche', dir: 'bucharestCurteaVeche', city: 'Бухарест', finaleId: 61 },
    { questId: 'belgrade-white-city', dir: 'belgradeWhiteCity', city: 'Белград', finaleId: 62 },
    { questId: 'sarajevo-meeting-of-cultures', dir: 'sarajevoMeetingOfCultures', city: 'Сараево', finaleId: 63 },
    { questId: 'sofia-serdica-underfoot', dir: 'sofiaSerdicaUnderfoot', city: 'София', finaleId: 64 },
    { questId: 'spb-guardians', dir: 'spbGuardians', city: 'Санкт-Петербург', finaleId: 65 },
    { questId: 'malaga-picasso-mar', dir: 'malagaPicassoMar', city: 'Малага', finaleId: 66 },
    { questId: 'lubcha-castle-revival', dir: 'lubchaCastleRevival', city: 'Любча', finaleId: 67 },
    { questId: 'baranovichi-dva-goroda', dir: 'baranovichiDvaGoroda', city: 'Барановичи', finaleId: 68 },
    { questId: 'gervyaty-kostel', dir: 'gervyatyKostel', city: 'Гервяты', finaleId: 69 },
    { questId: 'zheludok-palace', dir: 'zheludokPalace', city: 'Желудок', finaleId: 70 },
    { questId: 'shchuchin-versal', dir: 'shchuchinVersal', city: 'Щучин', finaleId: 71 },
    { questId: 'braslav-mezh-ozyor', dir: 'braslavMezhOzyor', city: 'Браслав', finaleId: 72 },
    { questId: 'slavgorod-blue-krinica', dir: 'slavgorodBlueKrinica', city: 'Голубая криница', finaleId: 73 },
    { questId: 'golshany-black-monk', dir: 'golshanyBlackMonk', city: 'Гольшаны', finaleId: 74 },
    { questId: 'svityaz-sunken-city', dir: 'svityazSunkenCity', city: 'озеро Свитязь', finaleId: 75 },
    { questId: 'turov-growing-crosses', dir: 'turovGrowingCrosses', city: 'Туров', finaleId: 76 },
    { questId: 'yelnya-bog-bells', dir: 'yelnyaBogBells', city: 'болото Ельня', finaleId: 77 },
    { questId: 'krevo-walled-maiden', dir: 'krevoWalledMaiden', city: 'Крево', finaleId: 78 },
    { questId: 'zhirovichi-icon-pear', dir: 'zhirovichiIconPear', city: 'Жировичи', finaleId: 86 },
    { questId: 'lepel-tsmok', dir: 'lepelTsmok', city: 'Лепель', finaleId: 87 },
    { questId: 'vyaloe-tyshkevich-curse', dir: 'vyaloeTyshkevichCurse', city: 'урочище Вялое', finaleId: 88 },
    { questId: 'kamenets-white-tower', dir: 'kamenetsWhiteTower', city: 'Каменец', finaleId: 89 },
    { questId: 'myadel-obet-i-ozernicy', dir: 'myadelObetIOzernicy', city: 'Мядель', finaleId: 93 },
    // Волна «Польские легенды» — финалы-видео (finaleId == числовой id квеста)
    { questId: 'swiety-krzyz-lysa-gora', dir: 'swietyKrzyzLysaGora', city: 'Лыса-Гура', finaleId: 79 },
    { questId: 'ojcow-lokietek', dir: 'ojcowLokietek', city: 'Ойцув', finaleId: 80 },
    { questId: 'niedzica-skarb-inkow', dir: 'niedzicaSkarbInkow', city: 'Недзица', finaleId: 81 },
    { questId: 'zakopane-spiacy-rycerze', dir: 'zakopaneSpiacyRycerze', city: 'Закопане', finaleId: 82 },
    { questId: 'kruszwica-mysia-wieza', dir: 'kruszwicaMysiaWieza', city: 'Крушвица', finaleId: 83 },
    { questId: 'karpacz-duch-gor', dir: 'karpaczDuchGor', city: 'Карпач', finaleId: 84 },
    { questId: 'leczyca-boruta', dir: 'leczycaBoruta', city: 'Ленчица', finaleId: 85 },
    { questId: 'malbork-marienburg', dir: 'malborkMarienburg', city: 'Мальборк', finaleId: 90 },
    { questId: 'kazimierz-dolny-kogut', dir: 'kazimierzDolnyKogut', city: 'Казимеж-Дольны', finaleId: 91 },
    { questId: 'sleza-swieta-gora', dir: 'slezaSwietaGora', city: 'Сленжа', finaleId: 92 },
    { questId: 'tallinn-vana-toomas', dir: 'tallinnVanaToomas', city: 'Таллин', finaleId: 94 },
    { questId: 'riga-unfinished-city', dir: 'rigaUnfinishedCity', city: 'Рига', finaleId: 95 },
    { questId: 'minsk-kids-bronze-friends', dir: 'minskKidsBronzeFriends', city: 'Минск', finaleId: 96 },
    { questId: 'brest-kids-fonari', dir: 'brestKidsFonari', city: 'Брест', finaleId: 97 },
    { questId: 'grodno-kids-zveri', dir: 'grodnoKidsZveri', city: 'Гродно', finaleId: 98 },
    { questId: 'gomel-kids-park-secrets', dir: 'gomelKidsParkSecrets', city: 'Гомель', finaleId: 99 },
    { questId: 'vitebsk-kids-skazki', dir: 'vitebskKidsSkazki', city: 'Витебск', finaleId: 100 },
    { questId: 'mogilev-kids-mogislav', dir: 'mogilevKidsMogislav', city: 'Могилёв', finaleId: 101 },
    { questId: 'brest-kids-garden-song', dir: 'brestKidsGardenSong', city: 'Брест', finaleId: 102 },
    { questId: 'brest-teens-erased-city', dir: 'brestTeensErasedCity', city: 'Брест', finaleId: 103 },
    { questId: 'grodno-kids-park-orchestra', dir: 'grodnoKidsParkOrchestra', city: 'Гродно', finaleId: 104 },
    { questId: 'grodno-teens-time-capsule', dir: 'grodnoTeensTimeCapsule', city: 'Гродно', finaleId: 105 },
    { questId: 'gomel-kids-lost-playbill', dir: 'gomelKidsLostPlaybill', city: 'Гомель', finaleId: 106 },
    { questId: 'gomel-teens-city-blueprint', dir: 'gomelTeensCityBlueprint', city: 'Гомель', finaleId: 107 },
    { questId: 'vitebsk-kids-living-drawing', dir: 'vitebskKidsLivingDrawing', city: 'Витебск', finaleId: 108 },
    { questId: 'vitebsk-teens-street-art-map', dir: 'vitebskTeensStreetArtMap', city: 'Витебск', finaleId: 109 },
    { questId: 'mogilev-kids-lion-ball', dir: 'mogilevKidsLionBall', city: 'Могилёв', finaleId: 110 },
    { questId: 'mogilev-teens-symbol-code', dir: 'mogilevTeensSymbolCode', city: 'Могилёв', finaleId: 111 },
    { questId: 'luninets-railway', dir: 'luninetsRailway', city: 'Лунинец', finaleId: 112 },
    { questId: 'luninets-bike-polesie', dir: 'luninetsBikePolesie', city: 'Кожан-Городок и Лахва', finaleId: 113 },
    { questId: 'luninets-bike-beloe', dir: 'luninetsBikeBeloe', city: 'Белое озеро', finaleId: 114 },
    { questId: 'minsk-kids-zvezdochka', dir: 'minskKidsZvezdochka', city: 'Минск', finaleId: 115 },
    { questId: 'minsk-teens-oktyabrskaya', dir: 'minskTeensOktyabrskaya', city: 'Минск', finaleId: 116 },
    { questId: 'glubokoe-cherry-baron', dir: 'glubokoeCherryBaron', city: 'Глубокое', finaleId: 117 },
    { questId: 'mozyr-polesie-capital', dir: 'mozyrPolesieCapital', city: 'Мозырь', finaleId: 118 },
    { questId: 'minsk-cinema', dir: 'minskCinema', city: 'Минск', finaleId: 119 },
    { questId: 'vienna-imperial-secrets', dir: 'viennaSecrets', city: 'Вена', finaleId: 120 },
    { questId: 'bielsko-biala-cartoon-vienna', dir: 'bielskoBialaCartoonVienna', city: 'Бельско-Бяла', finaleId: 121 },
    { questId: 'szklarska-poreba-glass-town', dir: 'szklarskaPorebaGlassTown', city: 'Шклярска-Поремба', finaleId: 122 },
    { questId: 'banska-stiavnica-silver-love', dir: 'banskaStiavnicaSilverLove', city: 'Банска-Штявница', finaleId: 123 },
    { questId: 'vlora-independence', dir: 'vloraIndependence', city: 'Влёра', finaleId: 124 },
    { questId: 'krakow-bike-tyniec', dir: 'krakowBikeTyniec', city: 'Краков', finaleId: 125 },
    { questId: 'krakow-bike-pradnik', dir: 'krakowBikePradnik', city: 'Краков', finaleId: 126 },
    { questId: 'krakow-bike-wanda', dir: 'krakowBikeWanda', city: 'Краков', finaleId: 127 },
    // Волна C: детские 8-10 Польша/Литва (2026-07-17)
    { questId: 'krakow-kids-dragon-keeper', dir: 'krakowKidsDragonKeeper', city: 'Краков', finaleId: 128 },
    { questId: 'warsaw-kids-bazyliszek', dir: 'warsawKidsBazyliszek', city: 'Варшава', finaleId: 129 },
    { questId: 'wroclaw-kids-gnome-service', dir: 'wroclawKidsGnomeService', city: 'Вроцлав', finaleId: 130 },
    { questId: 'vilnius-kids-iron-wolf', dir: 'vilniusKidsIronWolf', city: 'Вильнюс', finaleId: 131 },
    // Кино-квесты Балтии (2026-07-18)
    { questId: 'vilnius-cinema', dir: 'vilniusCinema', city: 'Вильнюс', finaleId: 132 },
    { questId: 'riga-cinema', dir: 'rigaCinema', city: 'Рига', finaleId: 133 },
    { questId: 'tallinn-cinema', dir: 'tallinnCinema', city: 'Таллин', finaleId: 134 },
    { questId: 'lodz-murals', dir: 'lodzMurals', city: 'Лодзь', finaleId: 135 },
    { questId: 'gniezno-white-eagle', dir: 'gnieznoWhiteEagle', city: 'Гнезно', finaleId: 136 },
    { questId: 'sasino-stilo', dir: 'sasinoStilo', city: 'Сашино', finaleId: 137 },
    { questId: 'hel-jurata-amber', dir: 'helJurataAmber', city: 'Хель', finaleId: 138 },
    // Италия, Молдова, Бенилюкс, Дания, Хель (2026-08-30)
    { questId: 'hel-fishermen', dir: 'helFishermen', city: 'Хель', finaleId: 139 },
    { questId: 'bratislava-coronation-crown', dir: 'bratislavaCoronationCrown', city: 'Братислава', finaleId: 140 },
    { questId: 'rome-mouth-of-truth', dir: 'romeMouthOfTruth', city: 'Рим', finaleId: 141 },
    { questId: 'venice-lion-of-saint-mark', dir: 'veniceLionOfSaintMark', city: 'Венеция', finaleId: 142 },
    { questId: 'naples-blood-of-san-gennaro', dir: 'naplesBloodOfSanGennaro', city: 'Неаполь', finaleId: 143 },
    { questId: 'milan-rebuilt-city', dir: 'milanRebuiltCity', city: 'Милан', finaleId: 144 },
    { questId: 'florence-guilds-renaissance', dir: 'florenceGuildsRenaissance', city: 'Флоренция', finaleId: 145 },
    { questId: 'chisinau-white-stone', dir: 'chisinauWhiteStone', city: 'Кишинёв', finaleId: 146 },
    { questId: 'orheiul-vechi-rock-monastery', dir: 'orheiulVechiRockMonastery', city: 'Старый Орхей', finaleId: 147 },
    { questId: 'soroca-round-fortress', dir: 'sorocaRoundFortress', city: 'Сороки', finaleId: 148 },
    { questId: 'luxembourg-melusina', dir: 'luxembourgMelusina', city: 'Люксембург', finaleId: 149 },
    { questId: 'brussels-zwanze', dir: 'brusselsZwanze', city: 'Брюссель', finaleId: 150 },
    { questId: 'copenhagen-from-the-sea', dir: 'copenhagenFromTheSea', city: 'Копенгаген', finaleId: 151 },
    { questId: 'bruges-sleeping-city', dir: 'brugesSleepingCity', city: 'Брюгге', finaleId: 152 },
    { questId: 'ghent-stolen-lamb', dir: 'ghentStolenLamb', city: 'Гент', finaleId: 153 },
    { questId: 'antwerp-thrown-hand', dir: 'antwerpThrownHand', city: 'Антверпен', finaleId: 154 },
    { questId: 'helsingor-sound-toll', dir: 'helsingorSoundToll', city: 'Хельсингёр', finaleId: 155 },
    { questId: 'odense-ugly-duckling', dir: 'odenseUglyDuckling', city: 'Оденсе', finaleId: 156 },
];

// Старые квесты с готовым видео — нужен только постер (кадр из видео)
const EXISTING_VIDEO_QUESTS = [
    { questId: 'krakow-dragon', dir: 'krakowDragon', finaleId: 1 },
    { questId: 'pakocim-voices', dir: 'pakocim', finaleId: 2 },
    { questId: 'barkovshchina-spirits', dir: 'barkovshchina', finaleId: 3 },
    { questId: 'minsk-cmok', dir: 'minskDragon', finaleId: 4 },
    { questId: 'yerevan-ararat', dir: 'yerevanArarat', finaleId: 5 },
];

const FPS = 25;
const SEG1 = 6.52, SEG2 = 6.52, SEG3 = 5.52, XFADE = 0.8;
const DURATION = SEG1 + SEG2 + SEG3 - 2 * XFADE; // ~16.96s
// Шрифты переопределяемы через env (кроссплатформенно). Дефолт — Windows.
// macOS: FONT_BOLD_PATH='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
const FONT_BOLD = process.env.FONT_BOLD_PATH || 'C\\:/Windows/Fonts/arialbd.ttf';
const FONT_REG = process.env.FONT_REG_PATH || 'C\\:/Windows/Fonts/arial.ttf';

function run(cmdArgs, label) {
    const r = spawnSync(FFMPEG, cmdArgs, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
    if (r.status !== 0) {
        throw new Error(`ffmpeg failed (${label}): ${(r.stderr || '').slice(-800)}`);
    }
}

function writeTextFile(text) {
    const f = path.join(os.tmpdir(), `qf-${Math.random().toString(36).slice(2)}.txt`);
    fs.writeFileSync(f, text, 'utf8');
    return f;
}

async function download(url, dest) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`download ${r.status}: ${url.split('?')[0]}`);
    fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
}

async function fetchBundle(questId) {
    const r = await fetch(`${API_BASE}/api/quests/by-quest-id/${questId}/`);
    if (!r.ok) throw new Error(`bundle ${questId}: HTTP ${r.status}`);
    return r.json();
}

async function fetchCoverUrl(questId) {
    const q = await fetchBundle(questId);
    if (!q.cover_url) throw new Error(`no cover_url for ${questId}`);
    return q.cover_url;
}

// ffmpeg без libfreetype (нет drawtext, напр. homebrew-сборка) → текст рендерим
// в прозрачный PNG через python3+PIL и накладываем overlay-ом с fade-in.
let _hasDrawtext = null;
function hasDrawtext() {
    if (_hasDrawtext === null) {
        const r = spawnSync(FFMPEG, ['-hide_banner', '-filters'], { encoding: 'utf8' });
        _hasDrawtext = (r.stdout || '').includes('drawtext');
    }
    return _hasDrawtext;
}

function renderTextOverlayPng(cityLabel) {
    const out = path.join(os.tmpdir(), `qf-overlay-${Math.random().toString(36).slice(2)}.png`);
    const py = [
        'import sys',
        'from PIL import Image, ImageDraw, ImageFont',
        'W,H=1280,720',
        'img=Image.new("RGBA",(W,H),(0,0,0,0))',
        'd=ImageDraw.Draw(img)',
        `fb=ImageFont.truetype(sys.argv[1],64)`,
        `fr=ImageFont.truetype(sys.argv[2],40)`,
        'def line(text,font,y):',
        '    w=d.textlength(text,font=font)',
        '    d.text(((W-w)/2,y),text,font=font,fill=(255,255,255,255),stroke_width=2,stroke_fill=(0,0,0,140))',
        `line("Квест пройден!",fb,H-220)`,
        `line(sys.argv[4],fr,H-130)`,
        'img.save(sys.argv[3])',
    ].join('\n');
    const fontBold = process.env.FONT_BOLD_PATH || '/System/Library/Fonts/Supplemental/Arial Bold.ttf';
    const fontReg = process.env.FONT_REG_PATH || '/System/Library/Fonts/Supplemental/Arial.ttf';
    const r = spawnSync(PYTHON, ['-c', py, fontBold, fontReg, out, cityLabel], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`overlay png failed (${PYTHON}, нужен PIL — задай PYTHON_PATH): ${r.stderr}`);
    return out;
}

function generateVideoOverlay(coverPath, outPath, cityLabel) {
    const overlayPng = renderTextOverlayPng(cityLabel);
    const seg1f = Math.round(SEG1 * FPS), seg2f = Math.round(SEG2 * FPS), seg3f = Math.round(SEG3 * FPS);
    const textStart = SEG1 + SEG2 - 2 * XFADE + 1; // 12.44 — после второго xfade
    const filter = [
        `[0:v]scale=2560:-2,setsar=1[base]`,
        `[base]split=3[s1][s2][s3]`,
        `[s1]zoompan=z='1+0.12*on/${seg1f}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=${seg1f}:s=1280x720:fps=${FPS},trim=duration=${SEG1},setpts=PTS-STARTPTS[v1]`,
        `[s2]zoompan=z=1.15:x='(iw-iw/zoom)*on/${seg2f}':y='(ih-ih/zoom)/2':d=${seg2f}:s=1280x720:fps=${FPS},trim=duration=${SEG2},setpts=PTS-STARTPTS[v2]`,
        `[s3]zoompan=z='1.15-0.10*on/${seg3f}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=${seg3f}:s=1280x720:fps=${FPS},trim=duration=${SEG3},setpts=PTS-STARTPTS[v3]`,
        `[v1][v2]xfade=transition=fade:duration=${XFADE}:offset=${(SEG1 - XFADE).toFixed(2)}[x1]`,
        `[x1][v3]xfade=transition=fade:duration=${XFADE}:offset=${(SEG1 + SEG2 - 2 * XFADE).toFixed(2)}[x2]`,
        `[1:v]format=rgba,fade=t=in:st=${textStart.toFixed(2)}:d=0.8:alpha=1[txt]`,
        `[x2][txt]overlay=0:0:format=auto[vout]`,
    ].join(';');

    run([
        '-y', '-hide_banner', '-loglevel', 'error',
        '-i', coverPath,
        '-loop', '1', '-framerate', String(FPS), '-t', DURATION.toFixed(2), '-i', overlayPng,
        '-filter_complex', filter,
        '-map', '[vout]',
        '-t', DURATION.toFixed(2),
        ...videoEncodeArgs(),
        outPath,
    ], path.basename(outPath));

    fs.unlinkSync(overlayPng);
}

function generateVideo(coverPath, outPath, cityLabel) {
    if (!hasDrawtext()) return generateVideoOverlay(coverPath, outPath, cityLabel);
    const line1 = writeTextFile('Квест пройден!');
    const line2 = writeTextFile(cityLabel);
    const seg1f = Math.round(SEG1 * FPS), seg2f = Math.round(SEG2 * FPS), seg3f = Math.round(SEG3 * FPS);
    const textStart = SEG1 + SEG2 - 2 * XFADE + 1; // после второго xfade
    const filter = [
        `[0:v]scale=2560:-2,setsar=1[base]`,
        `[base]split=3[s1][s2][s3]`,
        `[s1]zoompan=z='1+0.12*on/${seg1f}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=${seg1f}:s=1280x720:fps=${FPS},trim=duration=${SEG1},setpts=PTS-STARTPTS[v1]`,
        `[s2]zoompan=z=1.15:x='(iw-iw/zoom)*on/${seg2f}':y='(ih-ih/zoom)/2':d=${seg2f}:s=1280x720:fps=${FPS},trim=duration=${SEG2},setpts=PTS-STARTPTS[v2]`,
        `[s3]zoompan=z='1.15-0.10*on/${seg3f}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=${seg3f}:s=1280x720:fps=${FPS},trim=duration=${SEG3},setpts=PTS-STARTPTS[v3]`,
        `[v1][v2]xfade=transition=fade:duration=${XFADE}:offset=${(SEG1 - XFADE).toFixed(2)}[x1]`,
        `[x1][v3]xfade=transition=fade:duration=${XFADE}:offset=${(SEG1 + SEG2 - 2 * XFADE).toFixed(2)}[x2]`,
        `[x2]drawbox=y=ih-230:h=230:color=black@0.0:t=fill:enable=0,` +
            `drawtext=fontfile='${FONT_BOLD}':textfile='${line1.replace(/\\/g, '/').replace(/:/g, '\\:')}':fontsize=64:fontcolor=white:borderw=2:bordercolor=black@0.55:x=(w-text_w)/2:y=h-220:alpha='if(lt(t,${textStart}),0,min(1,(t-${textStart})/0.8))',` +
            `drawtext=fontfile='${FONT_REG}':textfile='${line2.replace(/\\/g, '/').replace(/:/g, '\\:')}':fontsize=40:fontcolor=white:borderw=2:bordercolor=black@0.55:x=(w-text_w)/2:y=h-130:alpha='if(lt(t,${textStart + 0.4}),0,min(1,(t-${textStart + 0.4})/0.8))'[vout]`,
    ].join(';');

    run([
        '-y', '-hide_banner', '-loglevel', 'error',
        '-i', coverPath,
        '-filter_complex', filter,
        '-map', '[vout]',
        '-t', DURATION.toFixed(2),
        ...videoEncodeArgs(),
        outPath,
    ], path.basename(outPath));

    fs.unlinkSync(line1);
    fs.unlinkSync(line2);
}

function generatePosterFromImage(coverPath, outPath) {
    run([
        '-y', '-hide_banner', '-loglevel', 'error',
        '-i', coverPath,
        '-vf', 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720',
        '-frames:v', '1', '-q:v', '3',
        outPath,
    ], path.basename(outPath));
}

function generatePosterFromVideo(videoPath, outPath) {
    run([
        '-y', '-hide_banner', '-loglevel', 'error',
        '-ss', '1', '-i', videoPath,
        '-vf', 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720',
        '-frames:v', '1', '-q:v', '3',
        outPath,
    ], path.basename(outPath));
}

function sizeMB(f) { return (fs.statSync(f).size / 1048576).toFixed(2); }

async function main() {
    if (POSTERS_EXISTING) {
        console.log('🎞  Постеры для квестов с готовым видео\n');
        for (const q of EXISTING_VIDEO_QUESTS) {
            if (ONLY_QUEST_ID && q.questId !== ONLY_QUEST_ID) continue;
            const dir = path.join(ASSETS_DIR, q.dir);
            fs.mkdirSync(dir, { recursive: true });
            const bundle = await fetchBundle(q.questId);
            const videoUrl = bundle.finale && bundle.finale.video_url;
            if (!videoUrl) { console.log(`⚠️  ${q.questId}: нет video_url`); continue; }
            const tmpVideo = path.join(os.tmpdir(), `qf-${q.questId}.mp4`);
            await download(videoUrl, tmpVideo);
            const posterPath = path.join(dir, 'poster.jpg');
            generatePosterFromVideo(tmpVideo, posterPath);
            fs.unlinkSync(tmpVideo);
            console.log(`✅ ${q.questId}: poster.jpg (${sizeMB(posterPath)} MB)`);
        }
        return;
    }

    console.log('🎬 Генерация финальных видео\n');
    for (const q of QUESTS) {
        if (ONLY_QUEST_ID && q.questId !== ONLY_QUEST_ID) continue;
        const dir = path.join(ASSETS_DIR, q.dir);
        fs.mkdirSync(dir, { recursive: true });
        let coverPath = path.join(dir, 'cover.png');
        if (!fs.existsSync(coverPath)) {
            console.log(`⬇️  ${q.questId}: качаю обложку с прода`);
            await download(await fetchCoverUrl(q.questId), coverPath);
        }
        const videoPath = path.join(dir, 'finale.mp4');
        const posterPath = path.join(dir, 'poster.jpg');
        generateVideo(coverPath, videoPath, q.city);
        const video = assertFileCompliant(videoPath);
        generatePosterFromImage(coverPath, posterPath);
        console.log(`✅ ${q.questId}: finale.mp4 (${sizeMB(videoPath)} MB, ${video.durationSeconds.toFixed(1)}s, ${Math.round(video.bitrateBps / 1000)} kbps) + poster.jpg (${sizeMB(posterPath)} MB)`);
    }
    console.log('\n✅ Готово');
}

if (require.main === module) {
    main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
}

module.exports = { QUESTS, EXISTING_VIDEO_QUESTS, ASSETS_DIR, FPS, FONT_BOLD, FONT_REG, hasDrawtext, renderTextOverlayPng };
