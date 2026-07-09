import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import { openExternalUrl } from '@/utils/externalLinks';

const URL_PATTERN = /((?:https?:\/\/|www\.)[^\s<]+)/gi;
const TRAILING_PUNCTUATION = /[),.;:!?]+$/;

export type TripPlanTextSegment =
  | { type: 'text'; text: string }
  | { type: 'link'; text: string; url: string };

const normalizeUrl = (value: string): string =>
  /^www\./i.test(value) ? `https://${value}` : value;

export const splitTripPlanLinkedText = (value: string): TripPlanTextSegment[] => {
  const segments: TripPlanTextSegment[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(URL_PATTERN)) {
    const raw = match[0] ?? '';
    const index = match.index ?? 0;
    if (!raw) continue;

    if (index > lastIndex) {
      segments.push({ type: 'text', text: value.slice(lastIndex, index) });
    }

    const trailing = raw.match(TRAILING_PUNCTUATION)?.[0] ?? '';
    const clean = trailing ? raw.slice(0, -trailing.length) : raw;
    if (clean) {
      segments.push({ type: 'link', text: clean, url: normalizeUrl(clean) });
    }
    if (trailing) {
      segments.push({ type: 'text', text: trailing });
    }
    lastIndex = index + raw.length;
  }

  if (lastIndex < value.length) {
    segments.push({ type: 'text', text: value.slice(lastIndex) });
  }

  return segments.length ? segments : [{ type: 'text', text: value }];
};

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
    <Text style={style} numberOfLines={numberOfLines} testID={testID}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <React.Fragment key={`${index}-text`}>{segment.text}</React.Fragment>;
        }

        return (
          <Text
            key={`${index}-${segment.url}`}
            accessibilityRole="link"
            style={linkStyle}
            onPress={() => {
              void openExternalUrl(segment.url);
            }}
          >
            {segment.text}
          </Text>
        );
      })}
    </Text>
  );
}
