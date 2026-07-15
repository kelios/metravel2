import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { getFormatLocale, translate as i18nT } from '@/i18n'


type SpeechRecognitionAlternativeLike = {
  transcript?: string;
};

type SpeechRecognitionResultLike = {
  0?: SpeechRecognitionAlternativeLike;
  isFinal?: boolean;
};

type SpeechRecognitionResultListLike = {
  length: number;
  [index: number]: SpeechRecognitionResultLike | undefined;
};

type SpeechRecognitionEventLike = {
  results?: SpeechRecognitionResultListLike;
  resultIndex?: number;
};

type SpeechRecognitionErrorEventLike = {
  error?: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && typeof error.message === 'string' ? error.message : fallback;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (Platform.OS !== 'web') return null;
  if (typeof window === 'undefined') return null;
  const w = window as SpeechRecognitionWindow;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as SpeechRecognitionCtor | null;
}

export function useWebSpeechDictation(options?: { lang?: string; continuous?: boolean }) {
  const ctor = useMemo(() => getSpeechRecognitionCtor(), []);
  const isSupported = !!ctor;

  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const lang = options?.lang ?? getFormatLocale();
  const continuous = options?.continuous ?? true;

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalTextRef = useRef<((text: string) => void) | null>(null);
  const runningRef = useRef(false);

  const bindFinalTextHandler = useCallback((handler: (text: string) => void) => {
    onFinalTextRef.current = handler;
  }, []);

  useEffect(() => {
    if (!ctor) return;
    const recognition = new ctor();
    recognitionRef.current = recognition;

    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      try {
        let interim = '';
        let finalText = '';
        const results = event.results;
        const startIndex = Number.isFinite(event.resultIndex) ? Number(event.resultIndex) : 0;
        if (results && typeof results.length === 'number') {
          for (let i = startIndex; i < results.length; i += 1) {
            const res = results[i];
            const transcript = String(res?.[0]?.transcript ?? '');
            if (res?.isFinal) finalText += transcript;
            else interim += transcript;
          }
        }

        setInterimText(interim.trim());

        const cleanedFinal = finalText.trim();
        if (cleanedFinal && onFinalTextRef.current) {
          onFinalTextRef.current(cleanedFinal);
        }
      } catch (e: unknown) {
        setError(getErrorMessage(e, i18nT('shared:hooks.useWebSpeechDictation.oshibka_raspoznavaniya_rechi_caa0cc14')));
      }
    };

    recognition.onend = () => {
      runningRef.current = false;
      setIsListening(false);
      setInterimText('');
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      const message = typeof event.error === 'string' ? event.error : i18nT('shared:hooks.useWebSpeechDictation.oshibka_raspoznavaniya_rechi_caa0cc14');
      runningRef.current = false;
      setError(message);
      setIsListening(false);
    };

    return () => {
      try {
        recognition.onresult = null;
        recognition.onend = null;
        recognition.onerror = null;
        recognition.stop();
      } catch {
        // noop
      } finally {
        runningRef.current = false;
        recognitionRef.current = null;
      }
    };
  }, [ctor]);

  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognition.lang = lang;
    recognition.continuous = continuous;
  }, [lang, continuous]);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    if (runningRef.current) return;
    if (__DEV__ && !onFinalTextRef.current) {
      console.warn(
        'useWebSpeechDictation: bindFinalTextHandler не вызван до start() — финальный текст будет потерян',
      );
    }
    setError(null);
    setInterimText('');
    try {
      recognitionRef.current.start();
      runningRef.current = true;
      setIsListening(true);
    } catch (e: unknown) {
      runningRef.current = false;
      setError(getErrorMessage(e, i18nT('shared:hooks.useWebSpeechDictation.ne_udalos_zapustit_diktovku_e02629cd')));
      setIsListening(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      // noop
    } finally {
      runningRef.current = false;
      setIsListening(false);
      setInterimText('');
    }
  }, []);

  return useMemo(() => ({
    isSupported,
    isListening,
    interimText,
    error,
    start,
    stop,
    bindFinalTextHandler,
  }), [isSupported, isListening, interimText, error, start, stop, bindFinalTextHandler]);
}
