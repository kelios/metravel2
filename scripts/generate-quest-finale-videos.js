#!/usr/bin/env node
/**
 * Генерация финальных видео квестов (Ken Burns по обложке) + постеров.
 *
 * Видео: 1280x720, ~17s, 3 сегмента zoompan с xfade, без надписей.
 * Поздравление и город рисует интерфейс на языке игрока (#2207). Ролик немой: backend-профиль финалов запрещает
 * аудиодорожку (см. scripts/quest-finale-video-profile.js).
 *
 * Требования:
 *   - ffmpeg (путь через env FFMPEG_PATH или в PATH)
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
const API_BASE = 'https://metravel.by';
const ASSETS_DIR = path.resolve(__dirname, '..', 'assets', 'quests');

const args = process.argv.slice(2);
const questIdArg = args.find(a => a.startsWith('--quest-id='));
const ONLY_QUEST_ID = questIdArg ? questIdArg.split('=')[1] : null;
const POSTERS_EXISTING = args.includes('--posters-existing');

// finaleId — проверенный маппинг quest_id -> id в /api/quest-finales/ (текст финала сверен 2026-06-10)
const QUESTS = [
    { questId: 'warsaw-syrenka', dir: 'warsawSyrenka', finaleId: 6 },
    { questId: 'grodno-royal', dir: 'grodnoRoyal', finaleId: 7 },
    { questId: 'brest-fortress', dir: 'brestFortress', finaleId: 8 },
    { questId: 'vitebsk-chagall', dir: 'vitebskChagall', finaleId: 9 },
    { questId: 'mogilev-stargazer', dir: 'mogilevStargazer', finaleId: 10 },
    { questId: 'lida-castle', dir: 'lidaCastle', finaleId: 11 },
    { questId: 'mir-castle', dir: 'mirCastle', finaleId: 12 },
    { questId: 'nesvizh-radziwill', dir: 'nesvizhRadziwill', finaleId: 13 },
    { questId: 'polotsk-ancient', dir: 'polotskAncient', finaleId: 14 },
    { questId: 'gomel-palace', dir: 'gomelPalace', finaleId: 15 },
    { questId: 'kossovo-ruzhany-palaces', dir: 'kossovoRuzhanyPalaces', finaleId: 16 },
    { questId: 'wroclaw-gnomes', dir: 'wroclawGnomes', finaleId: 17 },
    { questId: 'gdansk-amber', dir: 'gdanskAmber', finaleId: 18 },
    { questId: 'poznan-goats', dir: 'poznanGoats', finaleId: 19 },
    { questId: 'lublin-old-town', dir: 'lublinOldTown', finaleId: 20 },
    { questId: 'torun-copernicus', dir: 'torunCopernicus', finaleId: 21 },
    { questId: 'vilnius-old-town', dir: 'vilniusOldTown', finaleId: 22 },
    { questId: 'trakai-castle', dir: 'trakaiCastle', finaleId: 23 },
    { questId: 'prague-old-town', dir: 'pragueOldTown', finaleId: 24 },
    { questId: 'lviv-old-town', dir: 'lvivOldTown', finaleId: 25 },
    // finaleId — сверенный идентификатор финала, не вычисляется из id квеста.
    // Перед заливкой сверь: GET /api/quests/by-quest-id/<id>/ → finale.video_url ещё null.
    { questId: 'minsk-loshitsa', dir: 'minskLoshitsa', finaleId: 26 },
    { questId: 'minsk-traktorny', dir: 'minskTraktorny', finaleId: 27 },
    { questId: 'minsk-dvoriki', dir: 'minskDvoriki', finaleId: 28 },
    { questId: 'krakow-kazimierz', dir: 'krakowKazimierz', finaleId: 29 },
    { questId: 'krakow-podgorze', dir: 'krakowPodgorze', finaleId: 30 },
    { questId: 'krakow-nowahuta', dir: 'krakowNowaHuta', finaleId: 31 },
    { questId: 'minsk-cipher', dir: 'minskCipher', finaleId: 32 },
    { questId: 'bialystok-zamenhof', dir: 'bialystokZamenhof', finaleId: 35 },
    { questId: 'kaunas-capital', dir: 'kaunasCapital', finaleId: 36 },
    { questId: 'pinsk-polesie', dir: 'pinskPolesie', finaleId: 37 },
    { questId: 'tbilisi-warm-city', dir: 'tbilisiWarmCity', finaleId: 38 },
    { questId: 'istanbul-empires', dir: 'istanbulEmpires', finaleId: 39 },
    { questId: 'novogrudok-crown', dir: 'novogrudokCrown', finaleId: 40 },
    { questId: 'batumi-golden-fleece', dir: 'batumiGoldenFleece', finaleId: 41 },
    { questId: 'bobruisk-beaver-odessa', dir: 'bobruiskBeaverOdessa', finaleId: 42 },
    { questId: 'budapest-two-cities', dir: 'budapestTwoCities', finaleId: 43 },
    { questId: 'oshmyany-crossroads', dir: 'oshmyanyCrossroads', finaleId: 44 },
    { questId: 'kutaisi-golden-age', dir: 'kutaisiGoldenAge', finaleId: 45 },
    { questId: 'antalya-kaleici', dir: 'antalyaKaleici', finaleId: 46 },
    { questId: 'istanbul-galata', dir: 'istanbulGalata', finaleId: 47 },
    { questId: 'paris-point-zero', dir: 'parisPointZero', finaleId: 48 },
    { questId: 'amsterdam-on-piles', dir: 'amsterdamOnPiles', finaleId: 49 },
    { questId: 'berlin-wall-line', dir: 'berlinWallLine', finaleId: 50 },
    { questId: 'brest-lantern', dir: 'brestLantern', finaleId: 51 },
    { questId: 'vitebsk-avangard', dir: 'vitebskAvangard', finaleId: 52 },
    { questId: 'grodno-gorodnitsa', dir: 'grodnoGorodnitsa', finaleId: 53 },
    { questId: 'lisbon-terramoto', dir: 'lisbonTerramoto', finaleId: 54 },
    { questId: 'porto-port-wine', dir: 'portoPortWine', finaleId: 55 },
    { questId: 'mersin-cotton-port', dir: 'mersinCottonPort', finaleId: 56 },
    { questId: 'barcelona-barri-gotic', dir: 'barcelonaBarriGotic', finaleId: 57 },
    { questId: 'athens-athena-poseidon', dir: 'athensAthenaPoseidon', finaleId: 58 },
    { questId: 'limassol-lionheart', dir: 'limassolLionheart', finaleId: 59 },
    { questId: 'dubrovnik-libertas', dir: 'dubrovnikLibertas', finaleId: 60 },
    { questId: 'bucharest-curtea-veche', dir: 'bucharestCurteaVeche', finaleId: 61 },
    { questId: 'belgrade-white-city', dir: 'belgradeWhiteCity', finaleId: 62 },
    { questId: 'sarajevo-meeting-of-cultures', dir: 'sarajevoMeetingOfCultures', finaleId: 63 },
    { questId: 'sofia-serdica-underfoot', dir: 'sofiaSerdicaUnderfoot', finaleId: 64 },
    { questId: 'spb-guardians', dir: 'spbGuardians', finaleId: 65 },
    { questId: 'malaga-picasso-mar', dir: 'malagaPicassoMar', finaleId: 66 },
    { questId: 'lubcha-castle-revival', dir: 'lubchaCastleRevival', finaleId: 67 },
    { questId: 'baranovichi-dva-goroda', dir: 'baranovichiDvaGoroda', finaleId: 68 },
    { questId: 'gervyaty-kostel', dir: 'gervyatyKostel', finaleId: 69 },
    { questId: 'zheludok-palace', dir: 'zheludokPalace', finaleId: 70 },
    { questId: 'shchuchin-versal', dir: 'shchuchinVersal', finaleId: 71 },
    { questId: 'braslav-mezh-ozyor', dir: 'braslavMezhOzyor', finaleId: 72 },
    { questId: 'slavgorod-blue-krinica', dir: 'slavgorodBlueKrinica', finaleId: 73 },
    { questId: 'golshany-black-monk', dir: 'golshanyBlackMonk', finaleId: 74 },
    { questId: 'svityaz-sunken-city', dir: 'svityazSunkenCity', finaleId: 75 },
    { questId: 'turov-growing-crosses', dir: 'turovGrowingCrosses', finaleId: 76 },
    { questId: 'yelnya-bog-bells', dir: 'yelnyaBogBells', finaleId: 77 },
    { questId: 'krevo-walled-maiden', dir: 'krevoWalledMaiden', finaleId: 78 },
    { questId: 'zhirovichi-icon-pear', dir: 'zhirovichiIconPear', finaleId: 86 },
    { questId: 'lepel-tsmok', dir: 'lepelTsmok', finaleId: 87 },
    { questId: 'vyaloe-tyshkevich-curse', dir: 'vyaloeTyshkevichCurse', finaleId: 88 },
    { questId: 'kamenets-white-tower', dir: 'kamenetsWhiteTower', finaleId: 89 },
    { questId: 'myadel-obet-i-ozernicy', dir: 'myadelObetIOzernicy', finaleId: 93 },
    // Волна «Польские легенды» — финалы-видео (finaleId == числовой id квеста)
    { questId: 'swiety-krzyz-lysa-gora', dir: 'swietyKrzyzLysaGora', finaleId: 79 },
    { questId: 'ojcow-lokietek', dir: 'ojcowLokietek', finaleId: 80 },
    { questId: 'niedzica-skarb-inkow', dir: 'niedzicaSkarbInkow', finaleId: 81 },
    { questId: 'zakopane-spiacy-rycerze', dir: 'zakopaneSpiacyRycerze', finaleId: 82 },
    { questId: 'kruszwica-mysia-wieza', dir: 'kruszwicaMysiaWieza', finaleId: 83 },
    { questId: 'karpacz-duch-gor', dir: 'karpaczDuchGor', finaleId: 84 },
    { questId: 'leczyca-boruta', dir: 'leczycaBoruta', finaleId: 85 },
    { questId: 'malbork-marienburg', dir: 'malborkMarienburg', finaleId: 90 },
    { questId: 'kazimierz-dolny-kogut', dir: 'kazimierzDolnyKogut', finaleId: 91 },
    { questId: 'sleza-swieta-gora', dir: 'slezaSwietaGora', finaleId: 92 },
    { questId: 'tallinn-vana-toomas', dir: 'tallinnVanaToomas', finaleId: 94 },
    { questId: 'riga-unfinished-city', dir: 'rigaUnfinishedCity', finaleId: 95 },
    { questId: 'minsk-kids-bronze-friends', dir: 'minskKidsBronzeFriends', finaleId: 96 },
    { questId: 'brest-kids-fonari', dir: 'brestKidsFonari', finaleId: 97 },
    { questId: 'grodno-kids-zveri', dir: 'grodnoKidsZveri', finaleId: 98 },
    { questId: 'gomel-kids-park-secrets', dir: 'gomelKidsParkSecrets', finaleId: 99 },
    { questId: 'vitebsk-kids-skazki', dir: 'vitebskKidsSkazki', finaleId: 100 },
    { questId: 'mogilev-kids-mogislav', dir: 'mogilevKidsMogislav', finaleId: 101 },
    { questId: 'brest-kids-garden-song', dir: 'brestKidsGardenSong', finaleId: 102 },
    { questId: 'brest-teens-erased-city', dir: 'brestTeensErasedCity', finaleId: 103 },
    { questId: 'grodno-kids-park-orchestra', dir: 'grodnoKidsParkOrchestra', finaleId: 104 },
    { questId: 'grodno-teens-time-capsule', dir: 'grodnoTeensTimeCapsule', finaleId: 105 },
    { questId: 'gomel-kids-lost-playbill', dir: 'gomelKidsLostPlaybill', finaleId: 106 },
    { questId: 'gomel-teens-city-blueprint', dir: 'gomelTeensCityBlueprint', finaleId: 107 },
    { questId: 'vitebsk-kids-living-drawing', dir: 'vitebskKidsLivingDrawing', finaleId: 108 },
    { questId: 'vitebsk-teens-street-art-map', dir: 'vitebskTeensStreetArtMap', finaleId: 109 },
    { questId: 'mogilev-kids-lion-ball', dir: 'mogilevKidsLionBall', finaleId: 110 },
    { questId: 'mogilev-teens-symbol-code', dir: 'mogilevTeensSymbolCode', finaleId: 111 },
    { questId: 'luninets-railway', dir: 'luninetsRailway', finaleId: 112 },
    { questId: 'luninets-bike-polesie', dir: 'luninetsBikePolesie', finaleId: 113 },
    { questId: 'luninets-bike-beloe', dir: 'luninetsBikeBeloe', finaleId: 114 },
    { questId: 'minsk-kids-zvezdochka', dir: 'minskKidsZvezdochka', finaleId: 115 },
    { questId: 'minsk-teens-oktyabrskaya', dir: 'minskTeensOktyabrskaya', finaleId: 116 },
    { questId: 'glubokoe-cherry-baron', dir: 'glubokoeCherryBaron', finaleId: 117 },
    { questId: 'mozyr-polesie-capital', dir: 'mozyrPolesieCapital', finaleId: 118 },
    { questId: 'minsk-cinema', dir: 'minskCinema', finaleId: 119 },
    { questId: 'vienna-imperial-secrets', dir: 'viennaSecrets', finaleId: 120 },
    { questId: 'bielsko-biala-cartoon-vienna', dir: 'bielskoBialaCartoonVienna', finaleId: 121 },
    { questId: 'szklarska-poreba-glass-town', dir: 'szklarskaPorebaGlassTown', finaleId: 122 },
    { questId: 'banska-stiavnica-silver-love', dir: 'banskaStiavnicaSilverLove', finaleId: 123 },
    { questId: 'vlora-independence', dir: 'vloraIndependence', finaleId: 124 },
    { questId: 'krakow-bike-tyniec', dir: 'krakowBikeTyniec', finaleId: 125 },
    { questId: 'krakow-bike-pradnik', dir: 'krakowBikePradnik', finaleId: 126 },
    { questId: 'krakow-bike-wanda', dir: 'krakowBikeWanda', finaleId: 127 },
    // Волна C: детские 8-10 Польша/Литва (2026-07-17)
    { questId: 'krakow-kids-dragon-keeper', dir: 'krakowKidsDragonKeeper', finaleId: 128 },
    { questId: 'warsaw-kids-bazyliszek', dir: 'warsawKidsBazyliszek', finaleId: 129 },
    { questId: 'wroclaw-kids-gnome-service', dir: 'wroclawKidsGnomeService', finaleId: 130 },
    { questId: 'vilnius-kids-iron-wolf', dir: 'vilniusKidsIronWolf', finaleId: 131 },
    // Кино-квесты Балтии (2026-07-18)
    { questId: 'vilnius-cinema', dir: 'vilniusCinema', finaleId: 132 },
    { questId: 'riga-cinema', dir: 'rigaCinema', finaleId: 133 },
    { questId: 'tallinn-cinema', dir: 'tallinnCinema', finaleId: 134 },
    { questId: 'lodz-murals', dir: 'lodzMurals', finaleId: 135 },
    { questId: 'gniezno-white-eagle', dir: 'gnieznoWhiteEagle', finaleId: 136 },
    { questId: 'sasino-stilo', dir: 'sasinoStilo', finaleId: 137 },
    { questId: 'hel-jurata-amber', dir: 'helJurataAmber', finaleId: 138 },
    // Италия, Молдова, Бенилюкс, Дания, Хель (2026-08-30)
    { questId: 'hel-fishermen', dir: 'helFishermen', finaleId: 139 },
    { questId: 'bratislava-coronation-crown', dir: 'bratislavaCoronationCrown', finaleId: 140 },
    { questId: 'rome-mouth-of-truth', dir: 'romeMouthOfTruth', finaleId: 141 },
    { questId: 'venice-lion-of-saint-mark', dir: 'veniceLionOfSaintMark', finaleId: 142 },
    { questId: 'naples-blood-of-san-gennaro', dir: 'naplesBloodOfSanGennaro', finaleId: 143 },
    { questId: 'milan-rebuilt-city', dir: 'milanRebuiltCity', finaleId: 144 },
    { questId: 'florence-guilds-renaissance', dir: 'florenceGuildsRenaissance', finaleId: 145 },
    { questId: 'chisinau-white-stone', dir: 'chisinauWhiteStone', finaleId: 146 },
    { questId: 'orheiul-vechi-rock-monastery', dir: 'orheiulVechiRockMonastery', finaleId: 147 },
    { questId: 'soroca-round-fortress', dir: 'sorocaRoundFortress', finaleId: 148 },
    { questId: 'luxembourg-melusina', dir: 'luxembourgMelusina', finaleId: 149 },
    { questId: 'brussels-zwanze', dir: 'brusselsZwanze', finaleId: 150 },
    { questId: 'copenhagen-from-the-sea', dir: 'copenhagenFromTheSea', finaleId: 151 },
    { questId: 'bruges-sleeping-city', dir: 'brugesSleepingCity', finaleId: 152 },
    { questId: 'ghent-stolen-lamb', dir: 'ghentStolenLamb', finaleId: 153 },
    { questId: 'antwerp-thrown-hand', dir: 'antwerpThrownHand', finaleId: 154 },
    { questId: 'helsingor-sound-toll', dir: 'helsingorSoundToll', finaleId: 155 },
    { questId: 'odense-ugly-duckling', dir: 'odenseUglyDuckling', finaleId: 156 },
    { questId: 'zagreb-gric-vjestice', dir: 'zagrebGricVjestice', finaleId: 163 },
    { questId: 'split-dioklecijanova-palaca', dir: 'splitDioklecijanovaPalaca', finaleId: 164 },
    { questId: 'ogulin-grad-bajki', dir: 'ogulinGradBajki', finaleId: 165 },
    { questId: 'slunj-rastoke-selo-na-slapovima', dir: 'slunjRastokeSeloNaSlapovima', finaleId: 166 },
    // Озёра, велоквесты и Явожно (2026-09-02)
    { questId: 'khotomlya-emerald-lakes', dir: 'khotomlyaEmeraldLakes', finaleId: 158 },
    { questId: 'jaworzno-grodek', dir: 'jaworznoGrodek', finaleId: 159 },
    { questId: 'baranovichi-bike-manors', dir: 'baranovichiBikeManors', finaleId: 160 },
    { questId: 'krakow-zakrzowek', dir: 'krakowZakrzowek', finaleId: 161 },
    { questId: 'grodno-bike-forts', dir: 'grodnoBikeForts', finaleId: 162 },
    // Средняя Азия, Чехия, Германия, Россия (2026-09-05)
    { questId: 'bukhara-tower-and-nasreddin', dir: 'bukharaTowerAndNasreddin', finaleId: 167 },
    { questId: 'turkestan-yasawi', dir: 'turkestanYasawi', finaleId: 168 },
    { questId: 'samarkand-timur-legends', dir: 'samarkandTimurLegends', finaleId: 169 },
    { questId: 'cesky-krumlov-white-lady', dir: 'ceskyKrumlovWhiteLady', finaleId: 170 },
    { questId: 'almaty-apple-city', dir: 'almatyAppleCity', finaleId: 171 },
    { questId: 'prague-vysehrad-libuse', dir: 'pragueVysehradLibuse', finaleId: 172 },
    { questId: 'khiva-ichan-kala', dir: 'khivaIchanKala', finaleId: 173 },
    { questId: 'astana-samruk-tree', dir: 'astanaSamrukTree', finaleId: 174 },
    { questId: 'brno-dragon-and-wheel', dir: 'brnoDragonAndWheel', finaleId: 175 },
    { questId: 'kutna-hora-silver', dir: 'kutnaHoraSilver', finaleId: 176 },
    { questId: 'karlovy-vary-deer-leap', dir: 'karlovyVaryDeerLeap', finaleId: 177 },
    { questId: 'cologne-heinzelmaennchen', dir: 'cologneHeinzelmaennchen', finaleId: 178 },
    { questId: 'kazan-zilant-syuyumbike', dir: 'kazanZilantSyuyumbike', finaleId: 179 },
    { questId: 'moscow-kremlin-legends', dir: 'moscowKremlinLegends', finaleId: 180 },
    { questId: 'kaliningrad-kant-bridges', dir: 'kaliningradKantBridges', finaleId: 181 },
    { questId: 'munich-devils-footstep', dir: 'munichDevilsFootstep', finaleId: 182 },
    { questId: 'bremen-town-musicians', dir: 'bremenTownMusicians', finaleId: 183 },
    // Эстония, Литва, Казахстан, Сербия, Израиль, Латвия (2026-09-23)
    { questId: 'tallinn-secret-window', dir: 'tallinnSecretWindow', finaleId: 184 },
    { questId: 'tartu-bridge-wish', dir: 'tartuBridgeWish', finaleId: 185 },
    { questId: 'haapsalu-ilon-memory', dir: 'haapsaluIlonMemory', finaleId: 186 },
    { questId: 'kuressaare-giants-catch', dir: 'kuressaareGiantsCatch', finaleId: 187 },
    { questId: 'parnu-seaside-promise', dir: 'parnuSeasidePromise', finaleId: 188 },
    { questId: 'kaunas-modernist-letter', dir: 'kaunasModernistLetter', finaleId: 189 },
    { questId: 'klaipeda-port-keepers', dir: 'klaipedaPortKeepers', finaleId: 190 },
    { questId: 'palanga-birute-pines', dir: 'palangaBirutePines', finaleId: 191 },
    { questId: 'almaty-city-soundtrack', dir: 'almatyCitySoundtrack', finaleId: 192 },
    { questId: 'taraz-city-letter', dir: 'tarazCityLetter', finaleId: 193 },
    { questId: 'shymkent-common-sky', dir: 'shymkentCommonSky', finaleId: 194 },
    { questId: 'novi-sad-zmaj-notebook', dir: 'noviSadZmajNotebook', finaleId: 195 },
    { questId: 'nis-eight-seals', dir: 'nisEightSeals', finaleId: 196 },
    { questId: 'subotica-flowering-city', dir: 'suboticaFloweringCity', finaleId: 197 },
    { questId: 'sremski-karlovci-return', dir: 'sremskiKarlovciReturn', finaleId: 198 },
    { questId: 'jerusalem-city-gates', dir: 'jerusalemCityGates', finaleId: 199 },
    { questId: 'jaffa-sea-wish', dir: 'jaffaSeaWish', finaleId: 200 },
    { questId: 'akko-hidden-city-letter', dir: 'akkoHiddenCityLetter', finaleId: 201 },
    { questId: 'haifa-eight-views', dir: 'haifaEightViews', finaleId: 202 },
    { questId: 'safed-old-quarter-light', dir: 'safedOldQuarterLight', finaleId: 203 },
    { questId: 'riga-eisenstein-facades', dir: 'rigaEisensteinFacades', finaleId: 204 },
    { questId: 'cesis-light-through-ages', dir: 'cesisLightThroughAges', finaleId: 205 },
    { questId: 'kuldiga-water-stone', dir: 'kuldigaWaterStone', finaleId: 206 },
    { questId: 'turaida-valley-song', dir: 'turaidaValleySong', finaleId: 207 },
    { questId: 'liepaja-wind-melody', dir: 'liepajaWindMelody', finaleId: 208 },
    // Пафос: finaleId НЕ равен id квеста (220/221/222) — сверено по тексту финала 2026-10-04
    { questId: 'paphos-nea-paphos', dir: 'paphosNeaPaphos', finaleId: 219 },
    { questId: 'paphos-ktima', dir: 'paphosKtima', finaleId: 220 },
    { questId: 'paphos-myths-in-stone', dir: 'paphosMythsInStone', finaleId: 221 },
    // Венгрия: finaleId совпадает с id квеста (209–218) — сверено по тексту финала 2026-10-05
    { questId: 'sopron-faithful-town', dir: 'sopronFaithfulTown', finaleId: 209 },
    { questId: 'keszthely-festetics-helikon', dir: 'keszthelyFesteticsHelikon', finaleId: 210 },
    { questId: 'heviz-warm-lake', dir: 'hevizWarmLake', finaleId: 211 },
    { questId: 'pecs-sopianae-zsolnay', dir: 'pecsSopianaeZsolnay', finaleId: 212 },
    { questId: 'veszprem-queens-castle', dir: 'veszpremQueensCastle', finaleId: 213 },
    { questId: 'eger-bulls-blood', dir: 'egerBullsBlood', finaleId: 214 },
    { questId: 'tihany-echo-abbey', dir: 'tihanyEchoAbbey', finaleId: 215 },
    { questId: 'koszeg-jurisics-siege', dir: 'koszegJurisicsSiege', finaleId: 216 },
    { questId: 'szentendre-serbian-artists', dir: 'szentendreSerbianArtists', finaleId: 217 },
    { questId: 'visegrad-kings-congress', dir: 'visegradKingsCongress', finaleId: 218 },
    // Волна D1–D3: finaleId сдвинут относительно id квеста (225–232, 236–239) — сверено по тексту финала 2026-10-05
    { questId: 'oslo-hallvard', dir: 'osloHallvard', finaleId: 222 },
    { questId: 'zurich-felix-regula', dir: 'zurichFelixRegula', finaleId: 223 },
    { questId: 'stockholm-gamla-stan', dir: 'stockholmGamlaStan', finaleId: 224 },
    { questId: 'veliky-novgorod-sadko', dir: 'velikyNovgorodSadko', finaleId: 225 },
    { questId: 'bergen-bryggen-hansa', dir: 'bergenBryggenHansa', finaleId: 226 },
    { questId: 'lucerne-pilatus-dragon', dir: 'lucernePilatusDragon', finaleId: 227 },
    { questId: 'madrid-oso-austrias', dir: 'madridOsoAustrias', finaleId: 228 },
    { questId: 'zaslavl-rogneda', dir: 'zaslavlRogneda', finaleId: 229 },
    { questId: 'tokyo-asakusa-kannon', dir: 'tokyoAsakusaKannon', finaleId: 233 },
    { questId: 'new-york-new-amsterdam', dir: 'newYorkNewAmsterdam', finaleId: 234 },
    { questId: 'beijing-drum-bell-hutongs', dir: 'beijingDrumBellHutongs', finaleId: 235 },
    { questId: 'baku-icheri-sheher', dir: 'bakuIcheriSheher', finaleId: 236 },
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
function run(cmdArgs, label) {
    const r = spawnSync(FFMPEG, cmdArgs, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
    if (r.status !== 0) {
        throw new Error(`ffmpeg failed (${label}): ${(r.stderr || '').slice(-800)}`);
    }
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

// Единственный filtergraph: подписи принадлежат UI, а не пикселям.
function buildFinaleVideoFilter() {
    const seg1f = Math.round(SEG1 * FPS), seg2f = Math.round(SEG2 * FPS), seg3f = Math.round(SEG3 * FPS);
    const filter = [
        `[0:v]scale=2560:-2,setsar=1[base]`,
        `[base]split=3[s1][s2][s3]`,
        `[s1]zoompan=z='1+0.12*on/${seg1f}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=${seg1f}:s=1280x720:fps=${FPS},trim=duration=${SEG1},setpts=PTS-STARTPTS[v1]`,
        `[s2]zoompan=z=1.15:x='(iw-iw/zoom)*on/${seg2f}':y='(ih-ih/zoom)/2':d=${seg2f}:s=1280x720:fps=${FPS},trim=duration=${SEG2},setpts=PTS-STARTPTS[v2]`,
        `[s3]zoompan=z='1.15-0.10*on/${seg3f}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=${seg3f}:s=1280x720:fps=${FPS},trim=duration=${SEG3},setpts=PTS-STARTPTS[v3]`,
        `[v1][v2]xfade=transition=fade:duration=${XFADE}:offset=${(SEG1 - XFADE).toFixed(2)}[x1]`,
        `[x1][v3]xfade=transition=fade:duration=${XFADE}:offset=${(SEG1 + SEG2 - 2 * XFADE).toFixed(2)}[vout]`,
    ].join(';');
    return filter;
}

function generateVideo(coverPath, outPath) {
    run([
        '-y', '-hide_banner', '-loglevel', 'error',
        '-i', coverPath,
        '-filter_complex', buildFinaleVideoFilter(),
        '-map', '[vout]',
        '-t', DURATION.toFixed(2),
        ...videoEncodeArgs(),
        outPath,
    ], path.basename(outPath));
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
        generateVideo(coverPath, videoPath);
        const video = assertFileCompliant(videoPath);
        generatePosterFromImage(coverPath, posterPath);
        console.log(`✅ ${q.questId}: finale.mp4 (${sizeMB(videoPath)} MB, ${video.durationSeconds.toFixed(1)}s, ${Math.round(video.bitrateBps / 1000)} kbps) + poster.jpg (${sizeMB(posterPath)} MB)`);
    }
    console.log('\n✅ Готово');
}

if (require.main === module) {
    main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
}

module.exports = { QUESTS, EXISTING_VIDEO_QUESTS, ASSETS_DIR, FPS, DURATION, buildFinaleVideoFilter };
