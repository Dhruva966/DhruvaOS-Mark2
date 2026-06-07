'use client';

import { useState, useRef, useEffect } from 'react';
import Drew from './Drew';
import { transcribeAudio, speakText } from '@/lib/HermesAPI';

type State = 'idle' | 'listening' | 'thinking' | 'speaking';

export default function VoiceInterface() {
  const [state, setState] = useState<State>('idle');
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioPlaybackRef.current = new Audio();
  }, []);

  const startListening = async () => {
    try {
      console.log('[Drew] startListening called');
      setIsListening(true);
      setState('listening');
      setTranscript('');
      audioChunksRef.current = [];

      console.log('[Drew] Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('[Drew] Microphone access granted', stream);
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      console.log('[Drew] MediaRecorder created');

      mediaRecorder.ondataavailable = (event) => {
        console.log('[Drew] Audio data available:', event.data.size);
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        console.log('[Drew] Recording stopped');
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        console.log('[Drew] Audio blob created:', audioBlob.size);

        // Transcribe
        setState('thinking');
        console.log('[Drew] Transcribing...');
        const userText = await transcribeAudio(audioBlob);
        console.log('[Drew] Transcribed:', userText);
        setTranscript(userText);

        // Generate response (Phase 2: wire to real Hermes WebSocket)
        if (userText.trim()) {
          const responseText = `I heard: "${userText}". That's interesting!`;

          setState('speaking');
          console.log('[Drew] Speaking:', responseText);
          const audioUrl = await speakText(responseText);
          console.log('[Drew] TTS response:', audioUrl);

          if (audioPlaybackRef.current && audioUrl) {
            audioPlaybackRef.current.src = audioUrl;
            await audioPlaybackRef.current.play();
            audioPlaybackRef.current.onended = () => {
              console.log('[Drew] Speaking finished');
              setState('idle');
              setIsListening(false);
            };
          } else {
            console.warn('[Drew] No audio URL or audio element');
            setState('idle');
            setIsListening(false);
          }
        } else {
          console.log('[Drew] No text to respond to');
          setState('idle');
          setIsListening(false);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('[Drew] MediaRecorder error:', event.error);
      };

      console.log('[Drew] Starting recording...');
      mediaRecorder.start();
      console.log('[Drew] Recording started');
    } catch (error) {
      console.error('[Drew] Error accessing microphone:', error);
      setState('idle');
      setIsListening(false);
      alert(`Microphone error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
    }
  };

  const handleDrewClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="w-full h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background accents */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center gap-8 h-full">
        {/* Drew Avatar */}
        <div onClick={handleDrewClick} className="cursor-pointer">
          <Drew state={state} isActive={isListening} />
        </div>

        {/* Transcript display */}
        <div className="max-w-lg text-center">
          <div className="text-white/70 text-sm mb-2">
            {state === 'idle' && 'Click Drew to start'}
            {state === 'listening' && 'Listening...'}
            {state === 'thinking' && 'Processing...'}
            {state === 'speaking' && 'Drew is speaking...'}
          </div>
          {transcript && (
            <div className="bg-white/10 backdrop-blur border border-white/20 rounded-lg p-4 text-white">
              <p className="text-sm">{transcript}</p>
            </div>
          )}
        </div>

        {/* Status info */}
        <div className="text-white/50 text-xs mt-8">
          State: {state} | Listening: {isListening ? 'Yes' : 'No'}
        </div>
      </div>
    </div>
  );
}
