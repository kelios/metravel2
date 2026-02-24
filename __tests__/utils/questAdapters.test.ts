import {
  normalize,
  buildAnswerChecker,
  fixMediaUrl,
  adaptStep,
  adaptFinale,
  adaptCity,
  adaptMeta,
} from '@/utils/questAdapters';

describe('questAdapters', () => {
  describe('normalize', () => {
    it('lowercases and trims', () => {
      expect(normalize('  Hello World  ')).toBe('hello world');
    });

    it('removes punctuation', () => {
      expect(normalize('Привет, мир!')).toBe('привет мир');
    });

    it('replaces ё with е', () => {
      expect(normalize('ёлка')).toBe('елка');
    });

    it('collapses multiple spaces', () => {
      expect(normalize('a   b   c')).toBe('a b c');
    });
  });

  describe('buildAnswerChecker', () => {
    it('any: always returns true', () => {
      const check = buildAnswerChecker('any', '');
      expect(check('anything')).toBe(true);
      expect(check('')).toBe(true);
    });

    it('exact: matches normalized string', () => {
      const check = buildAnswerChecker('exact', 'дракон');
      expect(check('Дракон')).toBe(true);
      expect(check('  дракон  ')).toBe(true);
      expect(check('кот')).toBe(false);
    });

    it('exact: matches number as string', () => {
      const check = buildAnswerChecker('exact', '42');
      expect(check('42')).toBe(true);
    });

    it('exact_any: matches any of variants', () => {
      const check = buildAnswerChecker('exact_any', '["кот","собака"]');
      expect(check('Кот')).toBe(true);
      expect(check('собака')).toBe(true);
      expect(check('рыба')).toBe(false);
    });

    it('exact_any: returns false for invalid JSON', () => {
      const check = buildAnswerChecker('exact_any', 'not json');
      expect(check('anything')).toBe(false);
    });

    it('range: checks number in range', () => {
      const check = buildAnswerChecker('range', '{"min":10,"max":20}');
      expect(check('15')).toBe(true);
      expect(check('10')).toBe(true);
      expect(check('20')).toBe(true);
      expect(check('5')).toBe(false);
      expect(check('abc')).toBe(false);
    });

    it('range: returns false for invalid JSON', () => {
      const check = buildAnswerChecker('range', 'bad');
      expect(check('15')).toBe(false);
    });

    it('any_text: checks minimum length', () => {
      const check = buildAnswerChecker('any_text', '{"min_length":3}');
      expect(check('abc')).toBe(true);
      expect(check('ab')).toBe(false);
    });

    it('any_text: defaults to length > 0', () => {
      const check = buildAnswerChecker('any_text', 'bad json');
      expect(check('x')).toBe(true);
      expect(check('  ')).toBe(false);
    });

    it('any_number: checks if input is a number', () => {
      const check = buildAnswerChecker('any_number', '');
      expect(check('42')).toBe(true);
      expect(check('abc')).toBe(false);
    });

    it('approx: checks approximate match', () => {
      const check = buildAnswerChecker('approx', '{"target":50.5,"tolerance":0.5}');
      expect(check('50.3')).toBe(true);
      expect(check('51.5')).toBe(false);
    });

    it('unknown type: returns false', () => {
      const check = buildAnswerChecker('unknown_type', '');
      expect(check('anything')).toBe(false);
    });
  });

  describe('fixMediaUrl', () => {
    it('returns undefined for null/undefined/empty', () => {
      expect(fixMediaUrl(null)).toBeUndefined();
      expect(fixMediaUrl(undefined)).toBeUndefined();
      expect(fixMediaUrl('')).toBeUndefined();
    });

    it('returns normal URL as-is', () => {
      expect(fixMediaUrl('https://cdn.com/img.jpg')).toBe('https://cdn.com/img.jpg');
    });

    it('fixes double-host URL', () => {
      expect(fixMediaUrl('http://localhost:8000https://s3.aws.com/img.jpg')).toBe(
        'https://s3.aws.com/img.jpg',
      );
    });

    it('fixes malformed https://hosthttps://real-url shape from backend', () => {
      expect(fixMediaUrl('https://metravel.byhttps://cdn.example.com/video.mp4')).toBe(
        'https://cdn.example.com/video.mp4',
      );
    });

    it('does not alter valid urls that contain https in query params', () => {
      const url = 'https://metravel.by/media/video.mp4?next=https://example.com/watch';
      expect(fixMediaUrl(url)).toBe(url);
    });
  });

  describe('adaptStep', () => {
    it('converts API step to frontend format', () => {
      const apiStep = {
        id: 1,
        step_id: 'step-1',
        title: 'Шаг 1',
        location: 'Площадь',
        story: 'История',
        task: 'Задание',
        hint: 'Подсказка',
        lat: '50.0617',
        lng: '19.9383',
        maps_url: 'https://maps.google.com',
        image_url: 'https://img.com/1.jpg',
        answer_type: 'exact',
        answer_value: 'дракон',
      };

      const result = adaptStep(apiStep as any);
      expect(result.id).toBe('step-1');
      expect(result.title).toBe('Шаг 1');
      expect(result.lat).toBeCloseTo(50.0617);
      expect(result.lng).toBeCloseTo(19.9383);
      expect(result.hint).toBe('Подсказка');
      expect(result.image).toBe('https://img.com/1.jpg');
      expect(typeof result.answer).toBe('function');
      expect(result.answer('Дракон')).toBe(true);
    });

    it('parses lat/lng from numbers', () => {
      const step = adaptStep({
        id: 2,
        title: 'T',
        location: 'L',
        story: 'S',
        task: 'T',
        lat: 51.5,
        lng: 20.1,
        answer_type: 'any',
        answer_value: '',
      } as any);
      expect(step.lat).toBe(51.5);
      expect(step.lng).toBe(20.1);
    });
  });

  describe('adaptFinale', () => {
    it('converts API finale', () => {
      const result = adaptFinale({
        text: 'Поздравляем!',
        video_url: 'https://cdn.com/video.mp4',
        poster_url: null,
      } as any);
      expect(result.text).toBe('Поздравляем!');
      expect(result.video).toBe('https://cdn.com/video.mp4');
      expect(result.poster).toBeUndefined();
    });
  });

  describe('adaptCity', () => {
    it('converts API city with string coords', () => {
      const result = adaptCity({ name: 'Kraków', lat: '50.0617', lng: '19.9383' } as any);
      expect(result.name).toBe('Kraków');
      expect(result.lat).toBeCloseTo(50.0617);
      expect(result.lng).toBeCloseTo(19.9383);
    });
  });

  describe('adaptMeta', () => {
    it('converts API meta to frontend format', () => {
      const result = adaptMeta({
        quest_id: 'krakow-dragon',
        title: 'Тайна дракона',
        points: '100',
        city_id: 'krakow',
        lat: '50.06',
        lng: '19.94',
        duration_min: 60,
        difficulty: 'medium',
        tags: { history: true, walking: true },
        pet_friendly: true,
        cover_url: 'https://img.com/cover.jpg',
      } as any);

      expect(result.id).toBe('krakow-dragon');
      expect(result.title).toBe('Тайна дракона');
      expect(result.points).toBe(100);
      expect(result.tags).toEqual(['history', 'walking']);
      expect(result.petFriendly).toBe(true);
      expect(result.cover).toBe('https://img.com/cover.jpg');
    });

    it('handles missing optional fields', () => {
      const result = adaptMeta({
        quest_id: 'q1',
        title: 'Q',
        points: 0,
        city_id: 'c',
        lat: 0,
        lng: 0,
      } as any);
      expect(result.durationMin).toBeUndefined();
      expect(result.difficulty).toBeUndefined();
      expect(result.tags).toBeUndefined();
    });
  });
});
