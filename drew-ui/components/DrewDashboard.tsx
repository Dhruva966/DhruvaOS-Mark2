'use client';

import { useState, useEffect, useCallback } from 'react';
import VoiceInterface, { ConversationTurn } from './VoiceInterface';
import ConversationTranscript from './ConversationTranscript';
import SystemStatus from './SystemStatus';
import CronList from './CronList';
import MemoryStats from './MemoryStats';
import ActivityFeed from './ActivityFeed';
import IdleScreensaver from './IdleScreensaver';
import type { CronJob } from '@/app/api/drew/crons/route';

// ── Types ──────────────────────────────────────────────────────────────────

interface StatusData {
  hermes: boolean;
  gbrain: boolean;
  timestamp: string;
}

interface CronsData {
  crons: CronJob[];
  raw?: string;
  error?: string;
}

interface MemoryData {
  total_entries: number | null;
  last_dream: string | null;
  status: string;
  version: string | null;
  error?: string;
}

interface ActivityData {
  activity: string[];
  error?: string;
}

// ── Polling interval ───────────────────────────────────────────────────────

const POLL_MS = 30_000;

// ── Component ─────────────────────────────────────────────────────────────

export default function DrewDashboard() {
  const [history, setHistory] = useState<ConversationTurn[]>([]);

  const [status, setStatus] = useState<StatusData | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const [crons, setCrons] = useState<CronsData | null>(null);
  const [cronsLoading, setCronsLoading] = useState(true);

  const [memory, setMemory] = useState<MemoryData | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(true);

  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);

  const [now, setNow] = useState(() => new Date());

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch all panel data
  const fetchAll = useCallback(async () => {
    const jsonOrThrow = async (r: Response) => {
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    };
    const [s, c, m, a] = await Promise.allSettled([
      fetch('/api/drew/status').then(jsonOrThrow),
      fetch('/api/drew/crons').then(jsonOrThrow),
      fetch('/api/drew/memory').then(jsonOrThrow),
      fetch('/api/drew/activity').then(jsonOrThrow),
    ]);

    setStatusLoading(false);
    if (s.status === 'fulfilled') setStatus(s.value as StatusData);

    setCronsLoading(false);
    if (c.status === 'fulfilled') setCrons(c.value as CronsData);

    setMemoryLoading(false);
    if (m.status === 'fulfilled') setMemory(m.value as MemoryData);

    setActivityLoading(false);
    if (a.status === 'fulfilled') setActivity(a.value as ActivityData);
  }, []);

  useEffect(() => {
    fetchAll();
    const poll = setInterval(fetchAll, POLL_MS);
    return () => clearInterval(poll);
  }, [fetchAll]);

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const bothActive = status?.hermes && status?.gbrain;

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      <IdleScreensaver />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex-none flex items-center justify-between px-5 py-3 border-b border-zinc-900">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-light tracking-wide text-white">Drew</h1>
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${
                statusLoading
                  ? 'bg-zinc-600 animate-pulse'
                  : bothActive
                  ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
                  : 'bg-red-500'
              }`}
            />
            <span className="text-zinc-500 text-xs">
              {statusLoading ? '...' : bothActive ? 'all systems active' : 'degraded'}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-zinc-400 text-sm tabular-nums">{timeStr}</div>
          <div className="text-zinc-700 text-xs">{dateStr}</div>
        </div>
      </header>

      {/* ── Info panels ────────────────────────────────────────────────── */}
      <div className="flex-none grid grid-cols-2 lg:grid-cols-4 gap-3 px-4 pt-4 pb-2">
        <SystemStatus
          hermes={status?.hermes ?? null}
          gbrain={status?.gbrain ?? null}
          timestamp={status?.timestamp ?? null}
          loading={statusLoading}
        />
        <CronList
          crons={crons?.crons ?? []}
          raw={crons?.raw}
          error={crons?.error}
          loading={cronsLoading}
        />
        <MemoryStats
          totalEntries={memory?.total_entries ?? null}
          lastDream={memory?.last_dream ?? null}
          status={memory?.status ?? 'loading'}
          version={memory?.version ?? null}
          loading={memoryLoading}
        />
        <ActivityFeed
          activity={activity?.activity ?? []}
          error={activity?.error}
          loading={activityLoading}
        />
      </div>

      {/* ── Conversation section ────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 mx-4 mb-24 flex flex-col bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="flex-none flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
          <span className="text-zinc-400 text-xs uppercase tracking-widest font-medium">Conversation</span>
          {history.length > 0 && (
            <button
              className="text-zinc-700 hover:text-zinc-400 text-xs transition-colors"
              onClick={() => setHistory([])}
            >
              clear
            </button>
          )}
        </div>
        <ConversationTranscript history={history} />
      </div>

      {/* Voice interface — renders Drew orb (fixed bottom-right) */}
      <VoiceInterface history={history} onHistoryChange={setHistory} />
    </div>
  );
}
