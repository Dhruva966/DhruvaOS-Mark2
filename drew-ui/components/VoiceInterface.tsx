'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Drew from './Drew';

const API_TIMEOUT_MS = 30_000;

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface VoiceInterfaceProps {
  onTurnAdded?: (turn: ConversationTurn) => void;
  history: ConversationTurn[];
  onHistoryChange: (history: ConversationTurn[]) => void;
}

export default function VoiceInterface({ history, onHistoryChange }: VoiceInterfaceProps) {
  const [state, setState] = useState<VoiceState>('idle');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Track the active object URL so it can be revoked on interrupt or unmount
  const activeBlobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    audioRef.current = new Audio();
    return () => {
      audioRef.current?.pause();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }
    };
  }, []);

  const handleRecordingStop = useCallback(async () => {
    const stream = streamRef.current;
    if (stream) stream.getTracks().forEach((t) => t.stop());

    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    setError(null);

    // Step 1: Transcribe
    setState('thinking');
    let userText = '';
    try {
      const fd = new FormData();
      fd.append('file', audioBlob, 'audio.webm');
      const res = await fetch('/api/voice/transcribe', { method: 'POST', body: fd, signal: AbortSignal.timeout(API_TIMEOUT_MS) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? res.statusText);
      }
      const data = await res.json();
      userText = data.text?.trim() ?? '';
    } catch (err) {
      setError(`Transcription failed: ${err instanceof Error ? err.message : String(err)}`);
      setState('idle');
      setIsListening(false);
      return;
    }

    if (!userText) {
      setState('idle');
      setIsListening(false);
      return;
    }

    // Add user turn (build the NEW history for the chat request)
    const newHistory: ConversationTurn[] = [
      ...history,
      { role: 'user', content: userText, timestamp: Date.now() },
    ];
    onHistoryChange(newHistory);

    // Step 2: Chat
    let responseText = '';
    try {
      const apiHistory = newHistory.slice(-10).map((t) => ({ role: t.role, content: t.content }));
      const res = await fetch('/api/voice/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: userText, history: apiHistory.slice(0, -1) }),
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? res.statusText);
      }
      const data = await res.json();
      responseText = data.response?.trim() ?? '';
    } catch (err) {
      setError(`Chat failed: ${err instanceof Error ? err.message : String(err)}`);
      setState('idle');
      setIsListening(false);
      return;
    }

    if (!responseText) {
      setState('idle');
      setIsListening(false);
      return;
    }

    // Add assistant turn
    onHistoryChange([
      ...newHistory,
      { role: 'assistant', content: responseText, timestamp: Date.now() },
    ]);

    // Step 3: Speak
    setState('speaking');
    try {
      const res = await fetch('/api/voice/speak', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: responseText }),
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? res.statusText);
      }
      const audioBlob2 = await res.blob();
      const url = URL.createObjectURL(audioBlob2);
      // Revoke any previous URL before replacing
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
      }
      activeBlobUrlRef.current = url;
      if (audioRef.current) {
        audioRef.current.src = url;
        await audioRef.current.play();
        audioRef.current.onended = () => {
          URL.revokeObjectURL(url);
          activeBlobUrlRef.current = null;
          setState('idle');
          setIsListening(false);
        };
      }
    } catch (err) {
      setError(`TTS failed: ${err instanceof Error ? err.message : String(err)}`);
      setState('idle');
      setIsListening(false);
    }
  }, [history, onHistoryChange]);

  const startListening = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = handleRecordingStop;
      recorder.start();

      setIsListening(true);
      setState('listening');
    } catch (err) {
      setError(`Mic error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [handleRecordingStop]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
    }
  }, [isListening]);

  const handleOrbClick = () => {
    if (state === 'speaking') {
      audioRef.current?.pause();
      // Revoke the active object URL when playback is interrupted
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }
      setState('idle');
      setIsListening(false);
      return;
    }
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <>
      {/* Fixed Drew orb — bottom right, always visible */}
      <div onClick={handleOrbClick}>
        <Drew state={state} isActive={isListening} />
      </div>

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-40 right-8 z-50 max-w-xs bg-red-900/90 border border-red-700 text-red-100 text-xs rounded-lg p-3 shadow-lg">
          {error}
          <button
            className="ml-2 text-red-300 hover:text-white"
            onClick={() => setError(null)}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
