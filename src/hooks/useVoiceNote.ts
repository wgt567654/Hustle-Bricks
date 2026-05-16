"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionEvent = {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

export function useVoiceNote() {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recogRef = useRef<SpeechRecognitionInstance | null>(null);
  const onTranscriptRef = useRef<((text: string) => void) | null>(null);

  const supported = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const start = useCallback((onTranscript: (text: string) => void) => {
    if (!supported) return;
    setError(null);
    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    const recog = new SpeechRecognition();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = "en-US";

    onTranscriptRef.current = onTranscript;

    recog.onresult = (e) => {
      let interimText = "";
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          finalText += text;
        } else {
          interimText += text;
        }
      }
      if (finalText) {
        onTranscriptRef.current?.(finalText);
        setInterim("");
      } else {
        setInterim(interimText);
      }
    };

    recog.onerror = (e) => {
      setError(e.error === "not-allowed" ? "Microphone access denied" : "Voice recognition error");
      setListening(false);
      setInterim("");
    };

    recog.onend = () => {
      setListening(false);
      setInterim("");
    };

    recogRef.current = recog;
    recog.start();
    setListening(true);
  }, [supported]);

  const stop = useCallback(() => {
    recogRef.current?.stop();
    setListening(false);
    setInterim("");
  }, []);

  useEffect(() => {
    return () => { recogRef.current?.stop(); };
  }, []);

  return { listening, interim, error, supported, start, stop };
}
