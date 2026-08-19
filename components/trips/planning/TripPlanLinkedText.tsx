// components/trips/planning/TripPlanLinkedText.tsx
//
// #1494: описание поездки и описания точек маршрута — рабочий документ (телефоны,
// адреса, номера броней), поэтому текст обязан выделяться, а ссылки обязаны быть
// НАСТОЯЩИМИ ссылками. Раньше сегмент-ссылка рендерился как `Text` + `onPress`:
// на web это не `<a href>`, поэтому не работали открытие в новой вкладке через
// контекстное меню, средняя кнопка мыши и «копировать адрес ссылки», а
// responder-обработчики RNW ещё и мешали выделению текста вокруг ссылки.
import React from 'react';
import { Platform, Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';

import { normalizeExternalUrl } from '@/utils/externalLinks';
import { handleRichTextLinkPress, resolveInternalHref } from '@/utils/internalLinks';

// Домены без протокола (`metravel.by/travels/123`) распознаём по закрытому списку
// TLD: без него ссылкой становится любое «слово.слово». Список двухуровневый.
// COMMON_TLDS — те, ради которых стоит линковать даже голый домен без пути
// (`booking.com`). EXTRA_TLDS добавляются только когда за доменом идёт
// путь/запрос: `readme.md`, `main.rs`, `script.sh` совпадают с живыми TLD, и без
// этого разделения имя файла превращалось бы в ссылку.
const COMMON_TLDS = [
  'by', 'ru', 'ua', 'pl', 'lt', 'lv', 'ee', 'kz', 'de', 'com', 'org', 'net',
  'info', 'eu', 'io', 'app', 'travel', 'online', 'store', 'shop', 'site',
];

const EXTRA_TLDS = [
  'md', 'ge', 'am', 'az', 'su', 'at', 'ch', 'cz', 'sk', 'hu', 'ro', 'bg', 'rs',
  'hr', 'si', 'gr', 'tr', 'fr', 'es', 'it', 'pt', 'nl', 'be', 'dk', 'se', 'no',
  'fi', 'is', 'ie', 'uk', 'us', 'ca', 'au', 'nz', 'jp', 'cn', 'in', 'br', 'mx',
  'il', 'ae', 'th', 'biz', 'pro', 'name', 'mobi', 'asia', 'me', 'co', 'dev',
  'blog', 'tech', 'life', 'art', 'tv', 'cc', 'xyz', 'club', 'space', 'world', 'guide',
];

// Метка домена без вложенного квантификатора и с ограниченным повтором: форма
// `(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+` даёт катастрофический откат — на
// склеенной строке из латиницы и точек разбор описания вставал на секунды.
const DOMAIN_LABELS = '(?:[A-Za-z0-9][A-Za-z0-9-]{0,62}\\.){1,8}';
// TLD только в нижнем регистре: иначе `water.It`/`cash.In` — обычный текст с
// пропущенным пробелом после точки — становятся ссылками.
const TLD_BOUNDARY = '(?![A-Za-z0-9-])';
const URL_TAIL = '[^\\s<>"«»]*';
// Хвост схемы и `www.` обязателен: со звёздочкой обрывки «https://» и «www.»
// из живого текста сами становились кандидатами и доезжали до анкора на
// несуществующий хост (`https://www/`) плюс мусорного чипа в блоке «Ссылки».
const REQUIRED_TAIL = '[^\\s<>"«»]+';

const URL_PATTERN = new RegExp(
  [
    // явный протокол (регистр схемы значения не имеет)
    `[Hh][Tt][Tt][Pp][Ss]?:\\/\\/${REQUIRED_TAIL}`,
    // www без протокола
    `[Ww]{3}\\.${REQUIRED_TAIL}`,
    // голый домен с путём/запросом — здесь допустим весь список TLD
    `${DOMAIN_LABELS}(?:${[...COMMON_TLDS, ...EXTRA_TLDS].join('|')})${TLD_BOUNDARY}[/?#]${URL_TAIL}`,
    // голый домен без пути — только частые TLD, чтобы имя файла не стало ссылкой
    `${DOMAIN_LABELS}(?:${COMMON_TLDS.join('|')})${TLD_BOUNDARY}`,
  ].join('|'),
  'g',
);

const TRAILING_CHARACTER = /[),.;:!?'"»]/;

/**
 * Отделяет от кандидата хвостовую пунктуацию предложения. Закрывающая скобка
 * срезается только как непарная: в `https://ru.wikipedia.org/wiki/Браслав_(озеро)`
 * она часть адреса, и слепая срезка уводила ссылку на 404.
 */
const splitTrailingPunctuation = (raw: string): { clean: string; trailing: string } => {
  let clean = raw;
  let trailing = '';

  while (clean) {
    const last = clean[clean.length - 1];
    if (!TRAILING_CHARACTER.test(last)) break;
    if (last === ')') {
      const opened = (clean.match(/\(/g) ?? []).length;
      const closed = (clean.match(/\)/g) ?? []).length;
      if (opened >= closed) break;
    }
    trailing = last + trailing;
    clean = clean.slice(0, -1);
  }

  return { clean, trailing };
};
// `foo@example.com` и `path/example.com` — не самостоятельные ссылки: голый домен
// засчитывается только тогда, когда слева от него нет продолжения другого токена.
const ATTACHED_PREFIX = /[@\w./-]$/;

export type TripPlanLink = {
  /** Абсолютный безопасный URL (через контракт `utils/externalLinks`). */
  url: string;
  /** Значение для `<a href>`: внутренний путь для metravel.by, иначе абсолютный URL. */
  href: string;
  /** Внутренняя ссылка на metravel.by — открывается внутри приложения. */
  internal: boolean;
  /** Домен для чипа в блоке «Ссылки». */
  domain: string;
};

export type TripPlanTextSegment =
  | { type: 'text'; text: string }
  | ({ type: 'link'; text: string } & TripPlanLink);

// `https://` дописывается ТОЛЬКО голому домену. Слепой префикс любой строки
// обошёл бы блокировку опасных схем в `getSafeExternalUrl`: `javascript:alert(1)`
// превращался в разбираемый `https://javascript:alert(1)`.
const BARE_DOMAIN_START = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?:[/?#]|$)/i;

const normalizeUrl = (value: string): string =>
  BARE_DOMAIN_START.test(value) ? `https://${value}` : value;

const extractDomain = (absoluteUrl: string): string =>
  (/^https?:\/\/([^/?#]+)/i.exec(absoluteUrl)?.[1] ?? absoluteUrl).replace(/^www\./i, '');

/**
 * Ссылка из сырого фрагмента текста или `null`, если это не безопасная ссылка.
 * URL нормализуется через `utils/externalLinks` (единый контракт внешних ссылок,
 * он же отсекает `javascript:`/`data:`), внутренние адреса — через
 * `utils/internalLinks`, чтобы metravel.by открывался внутри приложения.
 */
export const resolveTripPlanLink = (raw: string): TripPlanLink | null => {
  const absolute = normalizeExternalUrl(normalizeUrl(raw));
  if (!absolute) return null;
  // хост без точки — не адрес, а обрывок текста (`https://www/`, `https://https//`)
  if (!/^https?:\/\/[^/?#]*\.[^/?#]/i.test(absolute)) return null;
  const internalPath = resolveInternalHref(absolute);
  return {
    url: absolute,
    href: internalPath ?? absolute,
    internal: Boolean(internalPath),
    domain: extractDomain(absolute),
  };
};

export const splitTripPlanLinkedText = (value: string): TripPlanTextSegment[] => {
  const segments: TripPlanTextSegment[] = [];
  let lastIndex = 0;

  const pushText = (text: string) => {
    if (!text) return;
    const previous = segments[segments.length - 1];
    if (previous?.type === 'text') {
      previous.text += text;
      return;
    }
    segments.push({ type: 'text', text });
  };

  for (const match of value.matchAll(URL_PATTERN)) {
    const raw = match[0] ?? '';
    const index = match.index ?? 0;
    if (!raw) continue;

    // хвост письма/пути: `mail@example.com`, `mail@www.example.com`, `example.com/a/b.com`.
    // Явный протокол проверку не проходит только формально — он самодостаточен.
    const hasProtocol = /^https?:\/\//i.test(raw);
    if (!hasProtocol && index > 0 && ATTACHED_PREFIX.test(value[index - 1])) continue;

    const { clean, trailing } = splitTrailingPunctuation(raw);
    const link = clean ? resolveTripPlanLink(clean) : null;

    if (index > lastIndex) {
      pushText(value.slice(lastIndex, index));
    }

    if (link) {
      segments.push({ type: 'link', text: clean, ...link });
      pushText(trailing);
    } else {
      pushText(raw);
    }

    lastIndex = index + raw.length;
  }

  if (lastIndex < value.length) {
    pushText(value.slice(lastIndex));
  }

  return segments.length ? segments : [{ type: 'text', text: value }];
};

/** Уникальные ссылки текста в порядке появления — для блока «Ссылки». */
export const extractTripPlanLinks = (value: string): TripPlanLink[] => {
  const seen = new Set<string>();
  const links: TripPlanLink[] = [];
  for (const segment of splitTripPlanLinkedText(value)) {
    if (segment.type !== 'link' || seen.has(segment.url)) continue;
    seen.add(segment.url);
    links.push({ url: segment.url, href: segment.href, internal: segment.internal, domain: segment.domain });
  }
  return links;
};

type WebAnchorProps = {
  href?: string;
  hrefAttrs?: { target?: string; rel?: string; download?: string };
};

export type TripPlanLinkElementProps = TextProps & WebAnchorProps;

/**
 * Пропсы кликабельного сегмента. На web отдаём `href`/`hrefAttrs` — RNW рендерит
 * настоящий `<a>`, и вся штатная механика браузера (новая вкладка, средняя
 * кнопка, «копировать адрес ссылки») работает без нашего JS. На native `<a>` нет,
 * поэтому остаётся `onPress` через общий обработчик ссылок rich-текста.
 */
export const buildTripPlanLinkProps = (
  link: TripPlanLink,
  platformOS: typeof Platform.OS = Platform.OS,
): TripPlanLinkElementProps => {
  if (platformOS === 'web') {
    return {
      accessibilityRole: 'link',
      href: link.href,
      // внутренние ссылки остаются в текущей вкладке — это навигация по сайту
      hrefAttrs: link.internal ? undefined : { target: '_blank', rel: 'noopener' },
    };
  }
  return {
    accessibilityRole: 'link',
    onPress: () => handleRichTextLinkPress(link.href),
  };
};

// RN #22811: на Android selectable-текст перехватывает тапы и ломает нажатие на
// вложенные ссылки. Тот же обход уже применён в `components/travel/StableContent.native.tsx`.
export const isTripPlanTextSelectable = (platformOS: typeof Platform.OS = Platform.OS): boolean =>
  platformOS !== 'android';

const LinkText = Text as React.ComponentType<TripPlanLinkElementProps>;

interface Props {
  text: string;
  style?: StyleProp<TextStyle>;
  linkStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
  testID?: string;
}

export default function TripPlanLinkedText({
  text,
  style,
  linkStyle,
  numberOfLines,
  testID,
}: Props) {
  const segments = splitTripPlanLinkedText(text);

  return (
    <Text
      style={style}
      numberOfLines={numberOfLines}
      testID={testID}
      selectable={isTripPlanTextSelectable()}
    >
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <React.Fragment key={`${index}-text`}>{segment.text}</React.Fragment>;
        }

        return (
          <LinkText
            key={`${index}-${segment.url}`}
            style={linkStyle}
            {...buildTripPlanLinkProps(segment)}
          >
            {segment.text}
          </LinkText>
        );
      })}
    </Text>
  );
}
