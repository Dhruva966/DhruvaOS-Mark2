'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ChatInput, { type VoiceState } from './ChatInput';
import ChatMessage, { type ConversationTurn, type MessageCard } from './ChatMessage';
import WidgetBar from './WidgetBar';
import IdleScreensaver from './IdleScreensaver';

// ── Types ─────────────────────────────────────────────────────────────────────

interface StatusData { hermes: boolean; gbrain: boolean }
interface MemoryData { total_entries: number | null }

// ── Clock hook ────────────────────────────────────────────────────────────────

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function DrewDashboard() {
  // ── Conversation ─────────────────────────────────────────────────────────
  // historyRef is authoritative (no stale-closure issues). history is for rendering.
  const historyRef = useRef<ConversationTurn[]>([]);
  const [history, setHistory] = useState<ConversationTurn[]>([]);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const pushHistory = useCallback((turn: ConversationTurn) => {
    historyRef.current = [...historyRef.current, turn];
    setHistory([...historyRef.current]);
  }, []);

  const replaceLast = useCallback((turn: ConversationTurn) => {
    const all = historyRef.current;
    const idx = all.findLastIndex((t) => t.role === 'assistant');
    const next = idx >= 0 ? [...all.slice(0, idx), turn, ...all.slice(idx + 1)] : [...all, turn];
    historyRef.current = next;
    setHistory([...next]);
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  // ── Dashboard data ────────────────────────────────────────────────────────
  const [status, setStatus] = useState<StatusData | null>(null);
  const [memory, setMemory] = useState<MemoryData | null>(null);
  const [cronCount, setCronCount] = useState(0);
  const [lastActivity, setLastActivity] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [s, c, m, a] = await Promise.allSettled([
      fetch('/api/drew/status').then((r) => r.json()),
      fetch('/api/drew/crons').then((r) => r.json()),
      fetch('/api/drew/memory').then((r) => r.json()),
      fetch('/api/drew/activity').then((r) => r.json()),
    ]);
    if (s.status === 'fulfilled') setStatus(s.value);
    if (c.status === 'fulfilled') setCronCount((c.value.crons ?? []).length);
    if (m.status === 'fulfilled') setMemory(m.value);
    if (a.status === 'fulfilled') {
      const lines: string[] = a.value.activity ?? [];
      setLastActivity(lines[lines.length - 1] ?? null);
    }
    setDataLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  // ── Core: send message → parse commands → update dashboard ───────────────
  const busyRef = useRef(false);
  const [isSending, setIsSending] = useState(false);

  const sendMessage = useCallback(async (text: string): Promise<string | null> => {
    if (busyRef.current) return null;
    busyRef.current = true;
    setIsSending(true);

    pushHistory({ role: 'user', content: text, timestamp: Date.now() });
    // Placeholder while waiting
    pushHistory({ role: 'assistant', content: '…', timestamp: Date.now() });

    let responseText = '';
    let cards: MessageCard[] = [];

    try {
      // Build context from current history (exclude placeholder)
      const apiHistory = historyRef.current
        .filter((t) => t.content !== '…')
        .slice(-12)
        .map((t) => ({ role: t.role, content: t.content }));

      const res = await fetch('/api/voice/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text, history: apiHistory.slice(0, -1) }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? res.statusText);
      }

      const data = await res.json();
      responseText = data.response ?? '';
      cards = data.cards ?? [];

      // If Drew issued widget commands, refresh data
      if ((data.widgetCommands ?? []).length > 0) fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      cards = [{ type: 'error', message: msg }];
      responseText = 'Something went wrong.';
    }

    replaceLast({
      role: 'assistant',
      content: responseText,
      timestamp: Date.now(),
      cards: cards.length > 0 ? cards : undefined,
    });

    busyRef.current = false;
    setIsSending(false);
    return responseText;
  }, [pushHistory, replaceLast, fetchData]);

  // ── Voice pipeline ────────────────────────────────────────────────────────
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Ref so recorder.onstop closure always has the latest sendMessage
  const sendMessageRef = useRef(sendMessage);
  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);

  useEffect(() => {
    audioRef.current = new Audio();
    return () => { audioRef.current?.pause(); };
  }, []);

  const onRecordingStop = useCallback(async () => {
    setVoiceState('thinking');
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });

    let transcript = '';
    try {
      const fd = new FormData();
      fd.append('file', blob, 'audio.webm');
      const res = await fetch('/api/voice/transcribe', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(res.statusText);
      transcript = (await res.json()).text?.trim() ?? '';
    } catch {
      setVoiceState('idle');
      return;
    }

    if (!transcript) { setVoiceState('idle'); return; }

    const responseText = await sendMessageRef.current(transcript);
    if (!responseText) { setVoiceState('idle'); return; }

    setVoiceState('speaking');
    try {
      const res = await fetch('/api/voice/speak', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: responseText }),
      });
      if (!res.ok) throw new Error(res.statusText);
      const url = URL.createObjectURL(await res.blob());
      if (audioRef.current) {
        audioRef.current.src = url;
        await audioRef.current.play();
        audioRef.current.onended = () => { URL.revokeObjectURL(url); setVoiceState('idle'); };
      }
    } catch {
      setVoiceState('idle');
    }
  }, []);

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = onRecordingStop;
      rec.start();
      setVoiceState('listening');
    } catch (e) { console.error('Mic:', e); }
  }, [onRecordingStop]);

  const stopListening = useCallback(() => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const handleVoiceToggle = useCallback(() => {
    if (voiceState === 'speaking') { audioRef.current?.pause(); setVoiceState('idle'); }
    else if (voiceState === 'listening') stopListening();
    else if (voiceState === 'idle' && !isSending) startListening();
  }, [voiceState, isSending, startListening, stopListening]);

  // ── Clock ─────────────────────────────────────────────────────────────────
  const now = useNow();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-black text-white">
      <IdleScreensaver />

      {/* Header */}
      <header className="flex flex-none items-center justify-between border-b border-zinc-900 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-light tracking-wide">Drew</span>
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${
            dataLoading ? 'animate-pulse bg-zinc-600'
            : status?.hermes && status?.gbrain ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
            : 'bg-red-500'
          }`} />
          {isSending && <span className="animate-pulse text-xs text-zinc-600">thinking…</span>}
        </div>
        <div className="text-right">
          <div className="tabular-nums text-sm text-zinc-400">{timeStr}</div>
          <div className="text-xs text-zinc-700">{dateStr}</div>
        </div>
      </header>

      {/* Widget bar */}
      <WidgetBar
        hermes={status?.hermes ?? null}
        gbrain={status?.gbrain ?? null}
        memoryEntries={memory?.total_entries ?? null}
        cronCount={cronCount}
        lastActivity={lastActivity}
        loading={dataLoading}
      />

      {/* Chat area */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        {history.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <div className="text-4xl font-extralight text-zinc-800">○</div>
            <p className="text-sm text-zinc-600">Type or speak to start</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {[
                "What's running right now?",
                'Search memory for voice RL',
                'Show my cron jobs',
                'Run morning briefing',
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-600 transition-colors hover:border-zinc-700 hover:text-zinc-400"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {history.map((turn, i) => <ChatMessage key={i} turn={turn} />)}
            <div ref={chatBottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        disabled={isSending}
        voiceState={voiceState}
        onVoiceToggle={handleVoiceToggle}
      />
    </div>
  );
}
