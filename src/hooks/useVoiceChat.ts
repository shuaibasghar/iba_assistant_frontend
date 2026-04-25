'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type RecognitionCtor = new () => SpeechRecognition;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechToText() {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  /** Set true before {@link cancelVoiceInput} + abort so onend skips onFinal and runs onCancel */
  const userCancelledRef = useRef(false);
  const onCancelThisSessionRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    setIsSupported(!!getRecognitionCtor());
  }, []);

  const startListening = useCallback(
    (onInterim: (text: string) => void, onFinal: (text: string) => void, onCancel?: () => void) => {
      setVoiceError(null);
      userCancelledRef.current = false;
      onCancelThisSessionRef.current = onCancel;
      const Ctor = getRecognitionCtor();
      if (!Ctor) {
        setVoiceError('Voice input is not supported in this browser. Try Chrome or Edge.');
        return;
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          /* ignore */
        }
      }

      const rec = new Ctor();
      recognitionRef.current = rec;
      rec.lang = 'en-IN';
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      let accumulatedFinal = '';

      rec.onresult = (event: SpeechRecognitionEvent) => {
        let chunkInterim = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const res = event.results[i];
          const part = res[0]?.transcript ?? '';
          if (res.isFinal) {
            accumulatedFinal += part;
          } else {
            chunkInterim += part;
          }
        }
        const display = (accumulatedFinal + (chunkInterim ? ' ' + chunkInterim : '')).trim();
        onInterim(display);
      };

      rec.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === 'aborted' || event.error === 'not-allowed') {
          if (event.error === 'not-allowed') {
            setVoiceError('Microphone access denied. Allow the mic in your browser settings.');
          }
          setIsListening(false);
          return;
        }
        if (event.error === 'no-speech') {
          return;
        }
        setVoiceError(event.message || `Speech: ${event.error}`);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
        if (userCancelledRef.current) {
          userCancelledRef.current = false;
          const run = onCancelThisSessionRef.current;
          onCancelThisSessionRef.current = undefined;
          run?.();
          return;
        }
        onCancelThisSessionRef.current = undefined;
        const done = accumulatedFinal.trim();
        if (done) {
          onFinal(done);
        }
      };

      try {
        rec.start();
        setIsListening(true);
      } catch (e) {
        setVoiceError(e instanceof Error ? e.message : 'Could not start microphone.');
        setIsListening(false);
      }
    },
    []
  );

  /** End dictation: recognition stops and the final transcript is passed to onFinal (no send) */
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  /** Abandon voice input: restore previous text, never send. */
  const cancelVoiceInput = useCallback(() => {
    userCancelledRef.current = true;
    const run = onCancelThisSessionRef.current;
    onCancelThisSessionRef.current = undefined;
    run?.();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  useEffect(() => () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        /* ignore */
      }
    }
  }, []);

  return {
    isListening,
    isSupported,
    voiceError,
    setVoiceError,
    startListening,
    stopListening,
    cancelVoiceInput,
  };
}

export function useTextToSpeech() {
  const speakingIdRef = useRef<string | null>(null);
  const [activeSpeechId, setActiveSpeechId] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    speakingIdRef.current = null;
    setActiveSpeechId(null);
  }, []);

  const speak = useCallback((id: string, text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const plain = text.replace(/\s+/g, ' ').trim();
    if (!plain) return;

    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(plain);
    u.lang = 'en-IN';
    u.rate = 0.95;
    speakingIdRef.current = id;
    setActiveSpeechId(id);
    u.onend = () => {
      if (speakingIdRef.current === id) {
        speakingIdRef.current = null;
        setActiveSpeechId(null);
      }
    };
    u.onerror = () => {
      if (speakingIdRef.current === id) {
        speakingIdRef.current = null;
        setActiveSpeechId(null);
      }
    };
    window.speechSynthesis.speak(u);
  }, []);

  return { speak, stop, activeSpeechId };
}
