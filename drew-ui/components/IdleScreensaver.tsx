'use client';

import { useEffect, useState } from 'react';

const IDLE_MS = 90_000; // 90s idle → screensaver

export default function IdleScreensaver() {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const reset = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), IDLE_MS);
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    timer = setTimeout(() => setIdle(true), IDLE_MS);

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, []);

  if (!idle) return null;

  return (
    <div
      className="fixed inset-0 z-[100] cursor-pointer"
      onClick={() => setIdle(false)}
    >
      {/* Fade-in overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fadeIn_1s_ease_forwards]" />

      {/* Jarvis 3D brain as screensaver */}
      <iframe
        src="/jarvis/"
        className="w-full h-full border-none"
        title="Jarvis Screensaver"
        tabIndex={-1}
      />

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/25 text-xs tracking-widest uppercase pointer-events-none">
        Click to return to Drew
      </div>
    </div>
  );
}
