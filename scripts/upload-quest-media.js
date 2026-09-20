#!/usr/bin/env node
/**
 * Скрипт загрузки медиа-файлов квестов на бэкенд.
 *
 * Загружает обложку квеста (cover.png) через поле cover_image и проверяет cover_url.
 * Остальные медиа показывает в отчёте; при попытке загрузки сообщает об отказе:
 * для них нужны отдельные эндпоинты шагов и финала.
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

const { describeQuestCoverVerdict, inspectQuestCover } = require('./lib/questCoverAspect');

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
        stepImages: {},
        finaleVideo: 'krakowDragon.mp4',
        finalePoster: null,
    },
    {
        quest_id: 'pakocim-voices',
        assetsDir: 'pakocim',
        cover: 'cover.png',
        stepImages: {},
        finaleVideo: 'prokocim.mp4',
        finalePoster: null,
    },
    {
        quest_id: 'barkovshchina-spirits',
        assetsDir: 'barkovshchina',
        cover: 'cover.png',
        stepImages: {},
        finaleVideo: 'forest.mp4',
        finalePoster: null,
    },
    {
        quest_id: 'minsk-cmok',
        assetsDir: 'minskDragon',
        cover: 'cover.png',
        stepImages: {},
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

// ===================== MAIN =====================

async function main() {
    console.log('=== Загрузка медиа-файлов квестов ===');
    console.log(`API: ${API_BASE}`);
    console.log(`Режим: ${isDryRun ? 'DRY RUN' : 'ЗАГРУЗКА'}`);
    console.log(`Токен: ${TOKEN ? 'указан' : 'не указан'}`);
    console.log('');

    let totalFiles = 0;
    let totalSize = 0;
    /** #1987: отказы гейта пропорции — итогом и ненулевым кодом выхода. */
    const rejectedCovers = [];
    const failedUploads = [];
    const reportFailure = (questId, media, message) => {
        const failure = `${questId}: ${media}: ${message}`;
        failedUploads.push(failure);
        console.error(`  ❌ ${failure}`);
    };

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
            // #1987: пропорцию показываем в самом отчёте, чтобы квадратный кадр
            // был виден ещё в dry-run, а не только когда заливка уже упала.
            const verdict = inspectQuestCover(coverPath);
            const mark = verdict.ok ? '' : '⚠️  ОТКЛОНЁН ГЕЙТОМ: ';
            console.log(`  cover: ${quest.cover} (${size} MB) — ${mark}${describeQuestCoverVerdict(verdict)}`);
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
            // #1987: отклонённая обложка не должна уносить с собой видео и
            // картинки шагов того же квеста, поэтому гейт срабатывает ДО
            // запроса бандла и снимает с заливки только сам cover.
            let coverAllowed = fileExists(coverPath);
            if (coverAllowed) {
                const verdict = inspectQuestCover(coverPath);
                if (!verdict.ok) {
                    coverAllowed = false;
                    rejectedCovers.push(`${quest.quest_id}: ${describeQuestCoverVerdict(verdict)}`);
                    console.error(`  ❌ cover отклонён гейтом пропорции — ${describeQuestCoverVerdict(verdict)}`);
                }
            }
            try {
                // Получаем текущий бандл
                const bundle = await fetchQuestBundle(quest.quest_id);
                const questDbId = bundle.id;
                console.log(`  DB id: ${questDbId}`);

                // Пробуем загрузить cover через multipart PATCH
                if (coverAllowed) {
                    try {
                        await uploadFile(
                            `${API_BASE}/api/quests/${questDbId}/`,
                            'cover_image',
                            coverPath
                        );
                        const updated = await fetchQuestBundle(quest.quest_id);
                        if (typeof updated.cover_url !== 'string' || !updated.cover_url.trim()
                            || updated.cover_url === bundle.cover_url) {
                            throw new Error('после PATCH cover_url отсутствует или не изменился; загрузка не подтверждена');
                        }
                        console.log(`  ✅ cover загружен`);
                    } catch (err) {
                        reportFailure(quest.quest_id, 'cover', err.message);
                    }
                }

                // QuestWriteSerializer игнорирует finale_video и steps даже при HTTP 200.
                if (quest.finaleVideo) {
                    const videoPath = path.join(questDir, quest.finaleVideo);
                    if (fileExists(videoPath)) {
                        reportFailure(quest.quest_id, 'video',
                            'загрузка этим скриптом не поддерживается; нужен PATCH /api/quest-finales/{id}/ с полем video');
                    }
                }
                for (const [stepId, imgFile] of Object.entries(quest.stepImages)) {
                    if (fileExists(path.join(questDir, imgFile))) {
                        reportFailure(quest.quest_id, `step ${stepId}`,
                            'загрузка этим скриптом не поддерживается; нужен PATCH /api/quest-steps/{id}/ с полем image');
                    }
                }
                if (quest.finalePoster && fileExists(path.join(questDir, quest.finalePoster))) {
                    reportFailure(quest.quest_id, 'poster',
                        'загрузка этим скриптом не поддерживается; нужен PATCH /api/quest-finales/{id}/ с полем poster');
                }

            } catch (err) {
                reportFailure(quest.quest_id, 'bundle', err.message);
            }
        }
    }

    console.log(`\n=== Итого ===`);
    console.log(`Файлов: ${totalFiles}`);
    console.log(`Размер: ~${totalSize.toFixed(1)} MB`);
    if (rejectedCovers.length) {
        // Иначе отказ — одна строка среди сотен при зелёном коде выхода, то
        // есть ровно то «прошло пайплайн молча», ради которого гейт и заведён.
        console.error(`\nОтклонено гейтом пропорции обложек: ${rejectedCovers.length}`);
        for (const line of rejectedCovers) console.error(`  - ${line}`);
        process.exitCode = 1;
    }
    if (failedUploads.length) {
        console.error(`\nНе подтверждено загрузок: ${failedUploads.length}`);
        for (const line of failedUploads) console.error(`  - ${line}`);
        process.exitCode = 1;
    }

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

        console.log('Само копирование файлов не обновляет БД. Этот скрипт загружает только cover_image;');
        console.log('для шагов нужен PATCH /api/quest-steps/{id}/ (image), для финала — /api/quest-finales/{id}/ (video/poster).');
    }
}

main().catch(err => {
    console.error('Ошибка:', err);
    process.exit(1);
});
