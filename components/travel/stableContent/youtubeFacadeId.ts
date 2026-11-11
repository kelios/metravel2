// Один формат id ролика для фасада YouTube в теле статьи (#3264). `htmlTransform`
// пишет id в `data-yt`, `useWebEffects` проверяет его перед сборкой адреса плеера;
// пока форматы жили в двух регулярках (`{6,}` и `{6,20}`), длинный id получал
// фасад, который по клику ничего не открывал.
const VIDEO_ID = '[A-Za-z0-9_-]{6,20}'
// Граница справа: id длиннее формата не обрезается до первых 20 знаков.
const BOUNDED_VIDEO_ID = `(${VIDEO_ID})(?![A-Za-z0-9_-])`

export const YOUTUBE_FACADE_VIDEO_ID_RE = new RegExp(`^${VIDEO_ID}$`)

const VIDEO_ID_SOURCES = [
  // Канонический вид, в который `buildYoutubeEmbedHtmlFromUrl` приводит ЛЮБОЙ
  // ролик, — `/embed/<id>` без query. Без этой ветки id не извлекался ни разу,
  // и вместо лёгкого фасада на страницу вставал живой плеер (по одному на видео).
  new RegExp(`/embed/${BOUNDED_VIDEO_ID}`, 'i'),
  new RegExp(`[?&]v=${BOUNDED_VIDEO_ID}`, 'i'),
  new RegExp(`youtu\\.be/${BOUNDED_VIDEO_ID}`, 'i'),
]

export const extractYouTubeFacadeVideoId = (src: string): string | undefined => {
  for (const source of VIDEO_ID_SOURCES) {
    const id = source.exec(src)?.[1]
    if (id) return id
  }
  return undefined
}
