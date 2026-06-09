'use client';

import { useEffect, useRef } from 'react';
import type { ConversationTurn } from './VoiceInterface';

interface ConversationTranscriptProps {
  history: ConversationTurn[];
}

export default function ConversationTranscript({ history }: ConversationTranscriptProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  if (history.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-700 text-sm">
        Hold the orb to talk to Drew
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-700">
      {history.map((turn, i) => (
        <div
          key={i}
          className={`flex gap-2 ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          {turn.role === 'assistant' && (
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
  );
}
