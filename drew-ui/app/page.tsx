import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-24">
        <div className="max-w-2xl w-full space-y-12">
          <div className="space-y-4">
            <h1 className="text-5xl font-light tracking-tight">Dhruva Vutukury</h1>
            <p className="text-zinc-400 text-lg">UCLA ECE · AI systems · edge inference</p>
          </div>

          <div className="space-y-2 text-zinc-300 text-base leading-relaxed max-w-lg">
            <p>
              Building autonomous AI systems that run locally and think for themselves.
              DhruvaOS is my personal AI that handles my digital life 24/7.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href="https://github.com/Dhruva966"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-3 border border-zinc-800 rounded-lg text-sm text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
            >
              GitHub →
            </a>
            <a
              href="mailto:vutukurydhruva@gmail.com"
              className="px-5 py-3 border border-zinc-800 rounded-lg text-sm text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
            >
              Email →
            </a>
          </div>

          <div className="pt-4 border-t border-zinc-900">
            <p className="text-xs text-zinc-700 mb-4 uppercase tracking-widest">Internal</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Link
                href="/drew"
                className="px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-colors text-center"
              >
                Drew
              </Link>
              <Link
                href="/content"
                className="px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-colors text-center"
              >
                Content OS
              </Link>
              <Link
                href="/jarvis"
                className="px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-colors text-center"
              >
                Jarvis
              </Link>
            </div>
          </div>
        </div>
      </div>

      <footer className="px-6 py-6 text-center text-xs text-zinc-800">
        DhruvaOS
      </footer>
    </main>
  );
}
