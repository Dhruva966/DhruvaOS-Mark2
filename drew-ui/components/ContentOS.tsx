'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type RecordState = 'idle' | 'listening' | 'processing' | 'speaking';

interface Turn {
  role: 'user' | 'drew';
  content: string;
  ts: number;
}

function autoTitle(turns: Turn[]): string {
  const first = turns.find((t) => t.role === 'user');
  if (!first) return 'Brainstorm session';
  const words = first.content.trim().split(/\s+/).slice(0, 8).join(' ');
  return words.length < first.content.length ? `${words}...` : words;
}

function isQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t.endsWith('?') || /\bdrew\b/.test(t);
}

export default function ContentOS() {
  const [recordState, setRecordState] = useState<RecordState>('idle');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [chatMode, setChatMode] = useState(false);
  const [title, setTitle] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'sending' | 'ok' | 'error' | 'offline'>('idle');
  const [submitMsg, setSubmitMsg] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const historyRef = useRef<Turn[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Keep historyRef in sync so callbacks always see current turns
  useEffect(() => {
    historyRef.current = turns;
  }, [turns]);

  useEffect(() => {
    audioRef.current = new Audio();
    return () => { audioRef.current?.pause(); };
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  const addTurn = useCallback((role: 'user' | 'drew', content: string) => {
    const turn: Turn = { role, content, ts: Date.now() };
    setTurns((prev) => [...prev, turn]);
    return turn;
  }, []);

  const speakText = useCallback(async (text: string): Promise<void> => {
    setRecordState('speaking');
    try {
      const res = await fetch('/api/voice/speak', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(res.statusText);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.src = url;
        await audioRef.current.play();
        await new Promise<void>((resolve) => {
          if (audioRef.current) {
            audioRef.current.onended = () => { URL.revokeObjectURL(url); resolve(); };
          } else {
            resolve();
          }
        });
      }
    } catch {
      // TTS failure is non-fatal — transcript already visible
    } finally {
      setRecordState('idle');
    }
  }, []);

  const handleRecordingStop = useCallback(async () => {
    const stream = streamRef.current;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    audioChunksRef.current = [];
    setError(null);
    setRecordState('processing');

    // Transcribe
    let userText = '';
    try {
      const fd = new FormData();
      fd.append('file', audioBlob, 'audio.webm');
      const res = await fetch('/api/voice/transcribe', { method: 'POST', body: fd });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
      userText = ((await res.json()).text ?? '').trim();
    } catch (err) {
      setError(`Transcription: ${err instanceof Error ? err.message : String(err)}`);
      setRecordState('idle');
      return;
    }

    if (!userText) { setRecordState('idle'); return; }

    addTurn('user', userText);

    const shouldRespond = chatMode || isQuestion(userText);
    if (!shouldRespond) { setRecordState('idle'); return; }

    // Chat
    const currentHistory = historyRef.current;
    const apiHistory = currentHistory.slice(-10).map((t) => ({
      role: t.role === 'drew' ? 'assistant' : 'user',
      content: t.content,
    }));

    let responseText = '';
    try {
      const res = await fetch('/api/content/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: userText, history: apiHistory }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
      responseText = ((await res.json()).response ?? '').trim();
    } catch (err) {
      setError(`Chat: ${err instanceof Error ? err.message : String(err)}`);
      setRecordState('idle');
      return;
    }

    if (!responseText || responseText.toLowerCase() === 'noted.') {
      if (responseText) addTurn('drew', responseText);
      setRecordState('idle');
      return;
    }

    addTurn('drew', responseText);
    await speakText(responseText);
  }, [chatMode, addTurn, speakText]);

  const startListening = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = handleRecordingStop;
      recorder.start();
      setRecordState('listening');
    } catch (err) {
      setError(`Mic: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [handleRecordingStop]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && recordState === 'listening') {
      mediaRecorderRef.current.stop();
      setRecordState('processing');
    }
  }, [recordState]);

  const toggleRecording = useCallback(() => {
    if (recordState === 'speaking') {
      audioRef.current?.pause();
      setRecordState('idle');
      return;
    }
    if (recordState === 'listening') {
      stopListening();
    } else if (recordState === 'idle') {
      startListening();
    }
  }, [recordState, startListening, stopListening]);

  // Space hotkey — skip when focus is inside an input/textarea
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      toggleRecording();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleRecording]);

  const handleSubmit = async () => {
    if (turns.length === 0) return;
    const t = title.trim() || autoTitle(turns);
    const raw = turns.map((x) => `[${x.role === 'drew' ? 'Drew' : 'You'}] ${x.content}`).join('\n\n');
    setSubmitState('sending');
    try {
      const res = await fetch('/api/content/braindump', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: t, raw_content: raw }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.offline || res.status === 503) {
        setSubmitState('offline');
        setSubmitMsg('XPosterOS unreachable. Transcript copied to clipboard.');
        await navigator.clipboard.writeText(`${t}\n\n${raw}`).catch(() => {});
      } else if (!res.ok) {
        throw new Error(data.error ?? res.statusText);
      } else {
        setSubmitState('ok');
        setSubmitMsg('Brain dump sent to XPosterOS.');
      }
    } catch (err) {
      setSubmitState('error');
      setSubmitMsg(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleClear = () => {
    audioRef.current?.pause();
    setRecordState('idle');
    setTurns([]);
    setTitle('');
    setSubmitState('idle');
    setSubmitMsg('');
    setError(null);
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const stateLabel: Record<RecordState, string> = {
    idle: 'idle',
    listening: 'listening',
    processing: 'thinking',
    speaking: 'speaking',
  };

  const stateColor: Record<RecordState, string> = {
    idle: 'bg-zinc-600',
    listening: 'bg-blue-400',
    processing: 'bg-amber-400',
    speaking: 'bg-violet-400',
  };

  const canSubmit = turns.length > 0 && recordState === 'idle' && submitState !== 'sending';

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">

      {/* Header */}
      <header className="flex-none flex items-center justify-between px-5 py-3 border-b border-zinc-900">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-light tracking-wide">Content OS</h1>
          <div className="flex items-center gap-1.5">
            <span className={`inline-block w-1.5 h-1.5 rounded-full transition-colors ${stateColor[recordState]} ${recordState === 'listening' ? 'animate-pulse' : ''}`} />
            <span className="text-zinc-500 text-xs">{stateLabel[recordState]}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Chat mode toggle */}
          <button
            onClick={() => setChatMode((v) => !v)}
            className={`text-xs px-2.5 py-1 rounded border transition-colors ${
              chatMode
                ? 'bg-violet-900/50 border-violet-700 text-violet-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {chatMode ? 'Chat mode' : 'Brainstorm mode'}
          </button>
          {/* XPosterOS link */}
          <a
            href="/xposteros"
            className="text-xs text-zinc-700 hover:text-zinc-400 transition-colors"
          >
            XPosterOS →
          </a>
        </div>
      </header>

      {/* Transcript */}
      <div className="flex-1 min-h-0 mx-4 mt-4 mb-2 flex flex-col bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="flex-none flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
          <span className="text-zinc-400 text-xs uppercase tracking-widest font-medium">
            Session
          </span>
          {turns.length > 0 && (
            <button
              className="text-zinc-700 hover:text-zinc-400 text-xs transition-colors"
              onClick={handleClear}
            >
              clear
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {turns.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-zinc-700 text-sm space-y-2">
              <p>Press <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-400">Space</kbd> to brainstorm</p>
              <p className="text-xs text-zinc-800">Drew responds if you ask a question or use chat mode</p>
            </div>
          )}
          {turns.map((turn, i) => (
            <div
              key={i}
              className={`flex gap-2 ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {turn.role === 'drew' && (
                <div className="w-6 h-6 rounded-full bg-violet-600/40 border border-violet-500/50 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[9px] text-violet-300 font-bold">D</span>
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                  turn.role === 'user'
                    ? 'bg-blue-600/20 border border-blue-500/20 text-blue-100'
                    : 'bg-zinc-800/80 border border-zinc-700/50 text-zinc-200'
                }`}
              >
                {turn.content}
              </div>
              {turn.role === 'user' && (
                <div className="w-6 h-6 rounded-full bg-blue-600/40 border border-blue-500/50 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[9px] text-blue-300 font-bold">Y</span>
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Recording bar */}
      <AnimatePresence>
        {recordState === 'listening' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mx-4 mb-2 px-4 py-2 bg-blue-900/30 border border-blue-700/50 rounded-lg flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-blue-300 text-xs">Recording — press Space to stop</span>
            <div className="ml-auto flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-0.5 bg-blue-400 rounded-full"
                  animate={{ height: ['4px', `${8 + i * 4}px`, '4px'] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                />
              ))}
            </div>
          </motion.div>
        )}
        {recordState === 'processing' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mx-4 mb-2 px-4 py-2 bg-amber-900/30 border border-amber-700/50 rounded-lg flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-amber-300 text-xs">Processing...</span>
          </motion.div>
        )}
        {recordState === 'speaking' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mx-4 mb-2 px-4 py-2 bg-violet-900/30 border border-violet-700/50 rounded-lg flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
            <span className="text-violet-300 text-xs">Drew speaking — press Space to interrupt</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mx-4 mb-2 px-4 py-2 bg-red-900/40 border border-red-700/50 rounded-lg flex items-center gap-2"
          >
            <span className="text-red-300 text-xs flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200 text-xs">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer: submit */}
      <div className="flex-none px-4 pb-4 pt-1 flex items-center gap-2">
        <button
          onClick={toggleRecording}
          disabled={recordState === 'processing'}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            recordState === 'listening'
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : recordState === 'speaking'
              ? 'bg-violet-600 hover:bg-violet-700 text-white'
              : recordState === 'processing'
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${stateColor[recordState]}`} />
          {recordState === 'idle' && 'Talk  [Space]'}
          {recordState === 'listening' && 'Stop  [Space]'}
          {recordState === 'processing' && 'Processing...'}
          {recordState === 'speaking' && 'Interrupt  [Space]'}
        </button>

        {turns.length > 0 && recordState === 'idle' && (
          <>
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={autoTitle(turns)}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-zinc-600"
            />
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                submitState === 'ok'
                  ? 'bg-emerald-800/60 text-emerald-300 border border-emerald-700/50'
                  : submitState === 'offline'
                  ? 'bg-amber-800/60 text-amber-300 border border-amber-700/50'
                  : submitState === 'error'
                  ? 'bg-red-800/60 text-red-300 border border-red-700/50'
                  : canSubmit
                  ? 'bg-violet-700 hover:bg-violet-600 text-white'
                  : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
              }`}
            >
              {submitState === 'sending' && 'Sending...'}
              {submitState === 'ok' && 'Sent ✓'}
              {submitState === 'offline' && 'Copied ✓'}
              {submitState === 'error' && 'Failed'}
              {(submitState === 'idle') && 'Submit brain dump'}
            </button>
          </>
        )}

        {submitMsg && (
          <span className={`text-xs ${submitState === 'ok' ? 'text-emerald-400' : submitState === 'offline' ? 'text-amber-400' : 'text-red-400'}`}>
            {submitMsg}
          </span>
        )}
      </div>
    </div>
  );
}
