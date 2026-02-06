#!/usr/bin/env node
/**
 * Скрипт загрузки медиа-файлов квестов на бэкенд.
 *
 * Загружает:
 *   - cover_url      — обложка квеста (cover.png)
 *   - image_url      — картинки шагов (1.png, 2.png, ...)
 *   - video_url      — видео финала (.mp4)
 *
 * Использование:
 *   node scripts/upload-quest-media.js [--dry-run] [--api-url=http://192.168.50.36] [--token=xxx]
 *
 * --dry-run   — только показать, что будет загружено
 * --api-url   — базовый URL бэкенда (по умолчанию http://192.168.50.36)
 * --token     — токен авторизации
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const apiUrlArg = args.find(a => a.startsWith('--api-url='));
const tokenArg = args.find(a => a.startsWith('--token='));
const API_BASE = apiUrlArg ? apiUrlArg.split('=')[1] : 'http://192.168.50.36';
const TOKEN = tokenArg ? tokenArg.split('=')[1] : null;

const ASSETS_DIR = path.resolve(__dirname, '..', 'assets', 'quests');

// ===================== МАППИНГ КВЕСТОВ → ФАЙЛОВ =====================

const QUEST_MEDIA = [
    {
        quest_id: 'krakow-dragon',
        assetsDir: 'krakowDragon',
        cover: 'cover.png',
        // Маппинг step_id → файл картинки
        stepImages: {
            '1-rynek': '1.png',
            '2-mariacki': '2.png',
            '3-sukiennice': '3.png',
            '4-barbakan': '4.png',
            '5-kazimierz': '5.png',
            '6-wawel': '6.png',
            '7-smocza-jama': '7.png',
        },
        finaleVideo: 'krakowDragon.mp4',
        finalePoster: null,
    },
    {
        quest_id: 'pakocim-voices',
        assetsDir: 'pakocim',
        cover: 'cover.png',
        stepImages: {
            '1-herb': '1.png',
            '2-palace': '1.png',
            '3-pond': '1.png',
            '4-oak': '1.png',
            '5-hedgehog': '1.png',
            '6-birdhouses': '1.png',
            '7-slona-woda': '1.png',
            '8-fort': '1.png',
            '9-bridge': '1.png',
            'bonus-cafe': '1.png',
        },
        finaleVideo: 'prokocim.mp4',
        finalePoster: null,
    },
    {
        quest_id: 'barkovshchina-spirits',
        assetsDir: 'barkovshchina',
        cover: 'cover.png',
        stepImages: {
            'point-1': '1.png',
            'point-1-2': '1.png',
            'point-2': '1.png',
            'point-2-2': '1.png',
            'point-3': '1.png',
            'point-3-2': '1.png',
        },
        finaleVideo: 'forest.mp4',
        finalePoster: null,
    },
    {
        quest_id: 'minsk-cmok',
        assetsDir: 'minskDragon',
        cover: 'cover.png',
        stepImages: {
            '1-forest-memory': '1.png',
            '2-sun-memory': '1.png',
            '3-star-memory': '1.png',
            '4-voice-memory': '1.png',
            '5-memory-memory': '1.png',
            '6-word-memory': '1.png',
            '7-water-memory': '1.png',
        },
        finaleVideo: 'minskDragon.mp4',
        finalePoster: null,
    },
];

// ===================== УТИЛИТЫ =====================

function fileExists(filePath) {
    try {
        return fs.statSync(filePath).isFile();
    } catch {
        return false;
    }
}

function fileSizeMB(filePath) {
    try {
        const stat = fs.statSync(filePath);
        return (stat.size / (1024 * 1024)).toFixed(2);
    } catch {
        return '?';
    }
}

/**
 * Загружает файл на бэкенд через multipart/form-data.
 * Использует встроенный fetch (Node 18+) или undici.
 */
async function uploadFile(url, fieldName, filePath, extraFields = {}) {
    const { FormData, File } = await getFormDataImpl();

    const form = new FormData();
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const mimeType = getMimeType(fileName);

    form.append(fieldName, new File([fileBuffer], fileName, { type: mimeType }));

    for (const [key, value] of Object.entries(extraFields)) {
        form.append(key, String(value));
    }

    const headers = {};
    if (TOKEN) {
        headers['Authorization'] = `Token ${TOKEN}`;
    }

    const response = await fetch(url, {
        method: 'PATCH',
        headers,
        body: form,
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
    }

    return response.json();
}

async function getFormDataImpl() {
    // Node 18+ has global FormData and File
    if (typeof globalThis.FormData !== 'undefined' && typeof globalThis.File !== 'undefined') {
        return { FormData: globalThis.FormData, File: globalThis.File };
    }
    // Fallback: try undici
    try {
        const undici = require('undici');
        return { FormData: undici.FormData, File: undici.File };
    } catch {
        throw new Error(
            'FormData not available. Use Node.js 18+ or install undici: npm i undici'
        );
    }
}

function getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const types = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
    };
    return types[ext] || 'application/octet-stream';
}

/**
 * Получает текущий бандл квеста с бэкенда.
 */
async function fetchQuestBundle(questId) {
    const headers = {};
    if (TOKEN) headers['Authorization'] = `Token ${TOKEN}`;

    const response = await fetch(`${API_BASE}/api/quests/by-quest-id/${questId}/`, { headers });
    if (!response.ok) {
        throw new Error(`Failed to fetch quest ${questId}: HTTP ${response.status}`);
    }
    return response.json();
}

/**
 * Обновляет квест через PATCH (JSON).
 */
async function patchQuestJson(questDbId, data) {
    const headers = { 'Content-Type': 'application/json' };
    if (TOKEN) headers['Authorization'] = `Token ${TOKEN}`;

    const response = await fetch(`${API_BASE}/api/quests/${questDbId}/`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`PATCH failed for quest ${questDbId}: HTTP ${response.status}: ${text}`);
    }
    return response.json();
}

// ===================== СТРАТЕГИЯ ЗАГРУЗКИ =====================
//
// Бэкенд Django REST Framework может принимать файлы через:
//   1) multipart/form-data на PATCH /api/quests/{id}/ — для cover_url, video_url, poster_url
//   2) JSON PATCH с URL строками — если файлы уже доступны по URL
//
// Поскольку image_url хранится внутри JSON-поля steps, мы не можем загрузить
// файлы напрямую через multipart. Стратегия:
//
//   Шаг 1: Загрузить медиа-файлы в /media/ директорию бэкенда
//           (через отдельный эндпоинт или multipart PATCH)
//   Шаг 2: Обновить steps JSON с URL загруженных файлов
//
// Если бэкенд не поддерживает прямую загрузку файлов,
// скрипт выведет команды для ручной загрузки через Django admin или scp.

// ===================== MAIN =====================

async function main() {
    console.log('=== Загрузка медиа-файлов квестов ===');
    console.log(`API: ${API_BASE}`);
    console.log(`Режим: ${isDryRun ? 'DRY RUN' : 'ЗАГРУЗКА'}`);
    console.log(`Токен: ${TOKEN ? 'указан' : 'не указан'}`);
    console.log('');

    let totalFiles = 0;
    let totalSize = 0;

    for (const quest of QUEST_MEDIA) {
        const questDir = path.join(ASSETS_DIR, quest.assetsDir);
        console.log(`\n--- ${quest.quest_id} (${quest.assetsDir}/) ---`);

        if (!fs.existsSync(questDir)) {
            console.log(`  SKIP: директория ${questDir} не найдена`);
            continue;
        }

        // 1. Обложка
        const coverPath = path.join(questDir, quest.cover);
        if (fileExists(coverPath)) {
            const size = fileSizeMB(coverPath);
            console.log(`  cover: ${quest.cover} (${size} MB)`);
            totalFiles++;
            totalSize += parseFloat(size);
        } else {
            console.log(`  cover: НЕ НАЙДЕН (${quest.cover})`);
        }

        // 2. Картинки шагов
        const uniqueImages = new Set();
        for (const [stepId, imgFile] of Object.entries(quest.stepImages)) {
            const imgPath = path.join(questDir, imgFile);
            if (fileExists(imgPath)) {
                if (!uniqueImages.has(imgFile)) {
                    const size = fileSizeMB(imgPath);
                    console.log(`  step image: ${imgFile} (${size} MB) → шаги: ${
                        Object.entries(quest.stepImages)
                            .filter(([, f]) => f === imgFile)
                            .map(([id]) => id)
                            .join(', ')
                    }`);
                    totalFiles++;
                    totalSize += parseFloat(size);
                    uniqueImages.add(imgFile);
                }
            } else {
                console.log(`  step image: НЕ НАЙДЕН ${imgFile} (шаг ${stepId})`);
            }
        }

        // 3. Видео финала
        if (quest.finaleVideo) {
            const videoPath = path.join(questDir, quest.finaleVideo);
            if (fileExists(videoPath)) {
                const size = fileSizeMB(videoPath);
                console.log(`  video: ${quest.finaleVideo} (${size} MB)`);
                totalFiles++;
                totalSize += parseFloat(size);
            } else {
                console.log(`  video: НЕ НАЙДЕН (${quest.finaleVideo})`);
            }
        }

        // 4. Постер финала
        if (quest.finalePoster) {
            const posterPath = path.join(questDir, quest.finalePoster);
            if (fileExists(posterPath)) {
                const size = fileSizeMB(posterPath);
                console.log(`  poster: ${quest.finalePoster} (${size} MB)`);
                totalFiles++;
                totalSize += parseFloat(size);
            } else {
                console.log(`  poster: НЕ НАЙДЕН (${quest.finalePoster})`);
            }
        }

        // === ЗАГРУЗКА ===
        if (!isDryRun) {
            try {
                // Получаем текущий бандл
                const bundle = await fetchQuestBundle(quest.quest_id);
                const questDbId = bundle.id;
                console.log(`  DB id: ${questDbId}`);

                // Пробуем загрузить cover через multipart PATCH
                if (fileExists(coverPath)) {
                    try {
                        await uploadFile(
                            `${API_BASE}/api/quests/${questDbId}/`,
                            'cover',
                            coverPath
                        );
                        console.log(`  ✅ cover загружен`);
                    } catch (err) {
                        console.log(`  ⚠️  cover: multipart PATCH не сработал (${err.message})`);
                        console.log(`     Попробуем альтернативный подход...`);

                        // Альтернатива: загрузить файл и обновить URL вручную
                        // Формируем URL для медиа-файла
                        const mediaUrl = `${API_BASE}/media/quests/${quest.quest_id}/cover.png`;
                        console.log(`     Целевой URL: ${mediaUrl}`);
                    }
                }

                // Загружаем видео финала
                if (quest.finaleVideo) {
                    const videoPath = path.join(questDir, quest.finaleVideo);
                    if (fileExists(videoPath)) {
                        try {
                            await uploadFile(
                                `${API_BASE}/api/quests/${questDbId}/`,
                                'finale_video',
                                videoPath
                            );
                            console.log(`  ✅ video загружен`);
                        } catch (err) {
                            console.log(`  ⚠️  video: multipart PATCH не сработал (${err.message})`);
                        }
                    }
                }

                // Обновляем steps с image_url
                const steps = typeof bundle.steps === 'string'
                    ? JSON.parse(bundle.steps)
                    : bundle.steps;

                let stepsUpdated = false;
                for (const step of steps) {
                    const imgFile = quest.stepImages[step.id];
                    if (imgFile) {
                        const imgPath = path.join(questDir, imgFile);
                        if (fileExists(imgPath)) {
                            // Формируем URL для медиа-файла на бэкенде
                            step.image_url = `${API_BASE}/media/quests/${quest.quest_id}/${imgFile}`;
                            stepsUpdated = true;
                        }
                    }
                }

                if (stepsUpdated) {
                    try {
                        await patchQuestJson(questDbId, {
                            steps: JSON.stringify(steps),
                        });
                        console.log(`  ✅ steps image_url обновлены`);
                    } catch (err) {
                        console.log(`  ⚠️  steps update: ${err.message}`);
                    }
                }

            } catch (err) {
                console.error(`  ❌ Ошибка: ${err.message}`);
            }
        }
    }

    console.log(`\n=== Итого ===`);
    console.log(`Файлов: ${totalFiles}`);
    console.log(`Размер: ~${totalSize.toFixed(1)} MB`);

    if (isDryRun) {
        console.log('\n=== Команды для ручной загрузки (scp) ===');
        console.log('Если бэкенд не поддерживает multipart upload, скопируйте файлы вручную:\n');

        for (const quest of QUEST_MEDIA) {
            const questDir = path.join(ASSETS_DIR, quest.assetsDir);
            if (!fs.existsSync(questDir)) continue;

            const targetDir = `/var/www/metravel/media/quests/${quest.quest_id}/`;
            console.log(`# ${quest.quest_id}`);
            console.log(`ssh server "mkdir -p ${targetDir}"`);

            // Cover
            if (fileExists(path.join(questDir, quest.cover))) {
                console.log(`scp ${path.join(questDir, quest.cover)} server:${targetDir}`);
            }

            // Unique step images
            const uniqueImgs = [...new Set(Object.values(quest.stepImages))];
            for (const img of uniqueImgs) {
                if (fileExists(path.join(questDir, img))) {
                    console.log(`scp ${path.join(questDir, img)} server:${targetDir}`);
                }
            }

            // Video
            if (quest.finaleVideo && fileExists(path.join(questDir, quest.finaleVideo))) {
                console.log(`scp ${path.join(questDir, quest.finaleVideo)} server:${targetDir}`);
            }

            console.log('');
        }

        console.log('После загрузки файлов запустите скрипт без --dry-run для обновления URL в БД.');
    }
}

main().catch(err => {
    console.error('Ошибка:', err);
    process.exit(1);
});
