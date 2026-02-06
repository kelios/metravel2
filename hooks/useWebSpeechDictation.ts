import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: any) => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (Platform.OS !== 'web') return null;
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as SpeechRecognitionCtor | null;
}

export function useWebSpeechDictation(options?: { lang?: string; continuous?: boolean }) {
  const ctor = useMemo(() => getSpeechRecognitionCtor(), []);
  const isSupported = !!ctor;

  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const lang = options?.lang ?? 'ru-RU';
  const continuous = options?.continuous ?? true;

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalTextRef = useRef<((text: string) => void) | null>(null);

  const bindFinalTextHandler = useCallback((handler: (text: string) => void) => {
    onFinalTextRef.current = handler;
  }, []);

  useEffect(() => {
    if (!ctor) return;
    const recognition = new ctor();
    recognitionRef.current = recognition;

    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      try {
        let interim = '';
        let finalText = '';
        const results = event?.results;
        const startIndex = Number.isFinite(event?.resultIndex) ? Number(event.resultIndex) : 0;
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
      } catch (e: any) {
        setError(e?.message ? String(e.message) : 'Ошибка распознавания речи');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText('');
    };

    recognition.onerror = (event: any) => {
      const message = typeof event?.error === 'string' ? event.error : 'Ошибка распознавания речи';
      setError(message);
      setIsListening(false);
    };

    return () => {
      try {
        recognition.onresult = null as any;
        recognition.onend = null as any;
        recognition.onerror = null as any;
        recognition.stop();
      } catch {
        // noop
      } finally {
        recognitionRef.current = null;
      }
    };
  }, [ctor, lang, continuous]);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    setError(null);
    setInterimText('');
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e: any) {
      setError(e?.message ? String(e.message) : 'Не удалось запустить диктовку');
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
      setIsListening(false);
      setInterimText('');
    }
  }, []);

  return {
    isSupported,
    isListening,
    interimText,
    error,
    start,
    stop,
    bindFinalTextHandler,
  };
}
