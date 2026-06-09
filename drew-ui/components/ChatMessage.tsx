'use client';

// ── Card types ────────────────────────────────────────────────────────────────

export interface GBrainEntry {
  id?: string;
  title?: string;
  body?: string;
  content?: string;
  created_at?: string;
  score?: number;
}

export interface DiscordMessage {
  id?: string;
  author: string;
  content: string;
  timestamp: string;
  channel?: string;
}

export interface SkillResult {
  skill: string;
  status: 'started' | 'completed' | 'error' | 'pending';
  output?: string;
  error?: string;
  job_id?: string;
}

export type MessageCard =
  | { type: 'gbrain_results'; query: string; entries: GBrainEntry[]; total?: number; error?: string }
  | { type: 'discord_messages'; messages: DiscordMessage[]; error?: string }
  | { type: 'skill_output'; data: SkillResult }
  | { type: 'error'; message: string };

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  cards?: MessageCard[];
}

// ── Card renderers ────────────────────────────────────────────────────────────

function GBrainCard({ query, entries, total, error }: Extract<MessageCard, { type: 'gbrain_results' }>) {
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900/80">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <span className="text-[11px] font-medium text-zinc-400">GBrain · "{query}"</span>
        {total !== undefined && (
          <span className="text-[10px] text-zinc-600">{total} results</span>
        )}
      </div>
      {error && <div className="px-3 py-2.5 text-xs text-red-400">{error}</div>}
      {!error && entries.length === 0 && (
        <div className="px-3 py-2.5 text-xs text-zinc-600">No results found</div>
      )}
      {entries.slice(0, 6).map((entry, i) => (
        <div key={i} className="border-b border-zinc-800/60 px-3 py-2 last:border-0">
          <div className="text-xs font-medium leading-snug text-zinc-200">
            {entry.title ?? (entry.body ?? entry.content ?? '').substring(0, 80)}
          </div>
          {entry.title && (entry.body ?? entry.content) && (
            <div className="mt-0.5 line-clamp-2 text-[11px] text-zinc-500">
              {(entry.body ?? entry.content ?? '').substring(0, 120)}
            </div>
          )}
          {entry.created_at && (
            <div className="mt-0.5 text-[10px] text-zinc-700">
              {new Date(entry.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DiscordCard({ messages, error }: Extract<MessageCard, { type: 'discord_messages' }>) {
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900/80">
      <div className="border-b border-zinc-800 px-3 py-2">
        <span className="text-[11px] font-medium text-zinc-400">Discord</span>
      </div>
      {error && <div className="px-3 py-2.5 text-xs text-red-400">{error}</div>}
      {!error && messages.length === 0 && (
        <div className="px-3 py-2.5 text-xs text-zinc-600">No recent messages</div>
      )}
      {messages.map((msg, i) => (
        <div key={i} className="border-b border-zinc-800/60 px-3 py-2 last:border-0">
          <div className="mb-0.5 flex items-baseline gap-1.5">
            <span className="text-[11px] font-medium text-zinc-300">{msg.author}</span>
            {msg.channel && (
              <span className="text-[10px] text-zinc-700">#{msg.channel}</span>
            )}
            <span className="ml-auto text-[10px] text-zinc-700">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="text-xs leading-relaxed text-zinc-300">{msg.content}</div>
        </div>
      ))}
    </div>
  );
}

function SkillCard({ data }: Extract<MessageCard, { type: 'skill_output' }>) {
  const dotColor =
    data.status === 'completed' ? 'bg-emerald-400' :
    data.status === 'error' ? 'bg-red-500' :
    'animate-pulse bg-amber-400';

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900/80">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
        <span className={`h-2 w-2 rounded-full ${dotColor}`} />
        <span className="text-[11px] font-medium text-zinc-400">Skill · {data.skill}</span>
        <span className="ml-auto text-[10px] text-zinc-600">{data.status}</span>
      </div>
      {data.output && (
        <pre className="max-h-40 overflow-x-auto px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-300 whitespace-pre-wrap">
          {data.output}
        </pre>
      )}
      {data.error && (
        <div className="px-3 py-2 text-xs text-red-400">{data.error}</div>
      )}
      {data.job_id && (
        <div className="border-t border-zinc-800 px-3 py-1.5 font-mono text-[10px] text-zinc-700">
          job: {data.job_id}
        </div>
      )}
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

interface ChatMessageProps {
  turn: ConversationTurn;
}

export default function ChatMessage({ turn }: ChatMessageProps) {
  const isUser = turn.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full border border-violet-500/30 bg-violet-600/20">
          <span className="text-[10px] font-bold text-violet-300">D</span>
        </div>
      )}

      <div className={`flex max-w-[85%] flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? 'rounded-br-sm bg-zinc-800 text-zinc-200'
              : 'rounded-bl-sm text-zinc-100'
          }`}
        >
          {turn.content}
        </div>

        {turn.cards?.map((card, i) => {
          switch (card.type) {
            case 'gbrain_results': return <GBrainCard key={i} {...card} />;
            case 'discord_messages': return <DiscordCard key={i} {...card} />;
            case 'skill_output': return <SkillCard key={i} {...card} />;
            case 'error': return (
              <div key={i} className="mt-1 rounded-xl border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs text-red-400">
                {card.message}
              </div>
            );
            default: return null;
          }
        })}

        <time className="px-1 text-[10px] text-zinc-700">
          {new Date(turn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </time>
      </div>

      {isUser && (
        <div className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full border border-blue-500/30 bg-blue-600/20">
          <span className="text-[10px] font-bold text-blue-300">Y</span>
        </div>
      )}
    </div>
  );
}
