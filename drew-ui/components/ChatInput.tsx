'use client';

import { useRef, useState } from 'react';

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  voiceState: VoiceState;
  onVoiceToggle: () => void;
}

export default function ChatInput({ onSend, disabled, voiceState, onVoiceToggle }: ChatInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isVoiceActive = voiceState !== 'idle';
  const canSend = text.trim() && !disabled && !isVoiceActive;

  const handleSubmit = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 128) + 'px';
  };

  const voicePlaceholder =
    voiceState === 'listening' ? 'Listening…' :
    voiceState === 'thinking' ? 'Processing…' :
    voiceState === 'speaking' ? 'Drew is speaking…' :
    'Ask Drew anything…';

  return (
    <div className="flex-none px-4 pb-5 pt-2">
      <div
        className={`flex items-end gap-2 rounded-2xl border px-3 py-2.5 transition-colors ${
          voiceState === 'listening'
            ? 'border-blue-500/60 bg-zinc-900'
            : voiceState === 'thinking'
            ? 'border-amber-500/40 bg-zinc-900'
            : voiceState === 'speaking'
            ? 'border-pink-500/40 bg-zinc-900'
            : 'border-zinc-700 bg-zinc-900 focus-within:border-zinc-500'
        }`}
      >
        {/* Voice button */}
        <button
          type="button"
          onClick={onVoiceToggle}
          disabled={disabled && voiceState === 'idle'}
          className={`mb-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full transition-all ${
            voiceState === 'listening'
              ? 'animate-pulse bg-blue-600 text-white'
              : voiceState === 'thinking'
              ? 'bg-amber-600/70 text-white'
              : voiceState === 'speaking'
              ? 'bg-pink-600/70 text-white'
              : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
          }`}
          title={isVoiceActive ? 'Stop' : 'Voice input'}
        >
          {voiceState === 'listening' ? (
            /* stop square */
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <rect x="1" y="1" width="10" height="10" rx="1.5" />
            </svg>
          ) : (
            /* mic */
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3zm6 9a1 1 0 0 1 2 0 8 8 0 0 1-7 7.938V21h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.062A8 8 0 0 1 4 11a1 1 0 1 1 2 0 6 6 0 0 0 12 0z" />
            </svg>
          )}
        </button>

        {/* Text area */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={voicePlaceholder}
          disabled={disabled || isVoiceActive}
          rows={1}
          className="min-h-[24px] flex-1 resize-none bg-transparent text-sm leading-relaxed text-zinc-200 outline-none placeholder-zinc-600 disabled:cursor-default"
          style={{ height: '24px', maxHeight: '128px' }}
        />

        {/* Send button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSend}
          className={`mb-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full transition-colors ${
            canSend
              ? 'bg-white text-black hover:bg-zinc-200'
              : 'cursor-not-allowed bg-zinc-800 text-zinc-600'
          }`}
          title="Send"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3l9 9h-6v9h-6v-9H3z" />
          </svg>
        </button>
      </div>

      {isVoiceActive && (
        <p className="mt-1.5 text-center text-[11px] text-zinc-600">
          {voiceState === 'listening' && 'Recording — tap mic to stop'}
          {voiceState === 'thinking' && 'Thinking…'}
          {voiceState === 'speaking' && 'Speaking — tap mic to stop'}
        </p>
      )}
    </div>
  );
}
