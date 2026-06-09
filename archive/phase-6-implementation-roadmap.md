# Phase 6 Implementation Roadmap
## Jarvis Voice Interface — Task Breakdown

**Status:** Detailed planning phase  
**Target start:** After Phase 5 completion (Cloudflare Tunnel + outbound actions)  
**Estimated duration:** 6 weeks total (4 weeks Phase 6a Mac+Omen, 2 weeks Phase 6b iOS prep)  

---

## Phase 6a.1: Drew-UI Mac Desktop (Weeks 1–2)

Goal: Transform existing drew-ui from prototype to production-ready voice interface.

### 6a.1.0 — Setup & Cleanup

**Task:** Establish foundation for Phase 6a work.

**Work:**
- [ ] Create feature branch: `codex/phase-6a-mac-desktop`
- [ ] Update `drew-ui/CLAUDE.md` with Phase 6 patterns
- [ ] Bump dependencies: `npm update && npm run lint`
- [ ] Add test infrastructure: Jest + React Testing Library setup
- [ ] Create `.env.example` template for Hermes URL configuration

**Verify:**
```bash
cd drew-ui
npm run lint
npm run test -- --coverage
# Coverage target: ≥80% for core logic
```

**Done condition:** Repo clean, no linter errors, test infra in place.

---

### 6a.1.1 — Hermes API Client Refactor

**Task:** Replace mock response generator with real Hermes WebSocket integration.

**Current code:**
- `lib/HermesAPI.ts` has mock `generateResponse()`
- `VoiceInterface.tsx` reads mocked responses

**Changes:**

```typescript
// lib/HermesAPI.ts — NEW
export interface ConversationMessage {
  id: string;
  timestamp: number;
  type: 'transcribed' | 'thinking' | 'executing' | 'final' | 'error';
  content: string;
  metadata?: {
    task_id?: string;
    approval_required?: boolean;
  };
}

export class HermesConversationClient {
  private ws: WebSocket | null = null;
  private messageQueue: string[] = [];

  async connect(baseUrl: string): Promise<void> {
    const wsUrl = baseUrl.replace(/^http/, 'ws') + '/api/chat';
    this.ws = new WebSocket(wsUrl);
    // ... setup handlers
  }

  async sendMessage(text: string): Promise<AsyncGenerator<ConversationMessage>> {
    // yields each streaming response as it arrives
    if (!this.ws) throw new Error('Not connected');
    this.ws.send(JSON.stringify({ text, user_id: 'voice-user' }));
    // generator pattern allows `for await` in React
  }

  disconnect(): void {
    this.ws?.close();
  }
}

export async function* streamConversation(
  baseUrl: string,
  userText: string
): AsyncGenerator<ConversationMessage> {
  // Wrapper for React hooks
  const client = new HermesConversationClient();
  await client.connect(baseUrl);
  for await (const msg of client.sendMessage(userText)) {
    yield msg;
  }
  client.disconnect();
}
```

**New test file:** `lib/__tests__/HermesAPI.test.ts`
```typescript
describe('HermesConversationClient', () => {
  it('connects to WebSocket and streams responses', async () => {
    const client = new HermesConversationClient();
    // mock WebSocket
    // verify message flow
  });

  it('handles connection error gracefully', async () => {
    // fallback to mock
  });
});
```

**Refactor:** `VoiceInterface.tsx`
```typescript
// Old: generateResponse(userText) → synchronous mock string
// New: streamConversation(baseUrl, userText) → async generator of messages

const handleConversation = async (userText: string) => {
  setState('thinking');
  try {
    for await (const msg of streamConversation(HERMES_URL, userText)) {
      if (msg.type === 'thinking') setState('thinking');
      if (msg.type === 'executing') setState('executing'); // NEW state?
      if (msg.type === 'final') {
        setTranscript(msg.content);
        setState('speaking');
        // ... TTS
      }
      if (msg.type === 'error') {
        setState('error');
        // fallback to Discord link
      }
    }
  } catch (err) {
    // fallback
  }
};
```

**Verify:**
```bash
# Unit tests
npm run test -- lib/__tests__/HermesAPI.test.ts

# Integration: local dev with Hermes running
npm run dev
# Open http://localhost:3002
# Click Drew, speak, verify real response (not mock)
# Check console: should see WebSocket messages, not mock generator
```

**Done condition:** Real Hermes conversation works in dev; fallback to mock if Hermes offline; tests pass.

---

### 6a.1.2 — Conversation Panel Component

**Task:** Display conversation history in a sidebar.

**New file:** `components/ConversationPanel.tsx`

```typescript
interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: {
    task_id?: string;
  };
}

interface ConversationPanelProps {
  messages: ConversationMessage[];
  isLoading: boolean;
}

export default function ConversationPanel({ messages, isLoading }: ConversationPanelProps) {
  return (
    <div className="flex flex-col h-full bg-white/5 backdrop-blur border-l border-white/10">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <h2 className="text-sm font-semibold text-white">Conversation</h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2 p-4">
        {messages.length === 0 ? (
          <div className="text-white/50 text-sm">Click Drew to start</div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={msg.role === 'user' ? 'text-right' : ''}>
              <div className={`inline-block max-w-xs p-2 rounded text-sm ${
                msg.role === 'user'
                  ? 'bg-blue-500/20 text-blue-100'
                  : 'bg-purple-500/20 text-purple-100'
              }`}>
                {msg.content}
              </div>
              {msg.metadata?.task_id && (
                <div className="text-xs text-yellow-400/70 mt-1">
                  Task: {msg.metadata.task_id}
                </div>
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="text-white/50 text-sm">Thinking...</div>
        )}
      </div>
    </div>
  );
}
```

**Integration into `page.tsx`:**

```typescript
export default function Home() {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen">
      {isSidebarOpen && (
        <div className="w-64">
          <ConversationPanel messages={messages} isLoading={state === 'thinking'} />
        </div>
      )}
      <div className="flex-1">
        <VoiceInterface onNewMessage={(msg) => setMessages([...messages, msg])} />
      </div>
    </div>
  );
}
```

**Verify:**
```bash
npm run test -- components/__tests__/ConversationPanel.test.tsx
npm run dev
# Open browser, click Drew, speak, verify history appears
```

**Done condition:** Sidebar shows last 10 exchanges; updates in real-time; doesn't break responsive layout.

---

### 6a.1.3 — Screensaver Mode

**Task:** Create minimal always-on screensaver variant of Drew.

**New file:** `app/screensaver/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import Drew from '@/components/Drew';
import { useState as useVoiceState } from 'react';

export default function ScreensaverPage() {
  const [state, setState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [isListening, setIsListening] = useState(false);
  const [idleTimeout, setIdleTimeout] = useState<number | null>(null);

  // Detect user activity → wake from screensaver
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'touchstart'];
    const handleActivity = () => {
      if (state === 'idle' && !isListening) {
        console.log('Activity detected, waking screensaver');
        // Optionally navigate to main app
        // window.location.href = '/';
      }
      // Reset idle timeout
      if (idleTimeout) clearTimeout(idleTimeout);
    };

    events.forEach(event => window.addEventListener(event, handleActivity));
    return () => events.forEach(event => window.removeEventListener(event, handleActivity));
  }, [state, isListening, idleTimeout]);

  // Minimal render: just the bubble, no sidebar, no transcript
  return (
    <div className="w-full h-screen bg-black flex items-center justify-center">
      {/* CPU-minimal background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 opacity-50" />

      {/* Drew bubble */}
      <div className="relative z-10">
        <Drew state={state} isActive={isListening} />
      </div>

      {/* Debug info (dev only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-4 left-4 text-white/30 text-xs">
          Screensaver mode | State: {state}
        </div>
      )}
    </div>
  );
}
```

**CSS optimization:**
```css
/* globals.css — add for screensaver mode */
@media (prefers-reduced-motion) {
  /* respects system accessibility settings */
  * {
    animation: none !important;
    transition: none !important;
  }
}

/* Disable non-essential rendering */
.screensaver {
  contain: strict; /* CSS containment */
  will-change: auto; /* avoid GPU thrashing */
}
```

**Idle detection hook:** `hooks/useIdleDetector.ts`

```typescript
export function useIdleDetector(threshold: number = 3 * 60 * 1000) {
  const [isIdle, setIsIdle] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const resetTimeout = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setIsIdle(false);
      timeoutRef.current = setTimeout(() => setIsIdle(true), threshold);
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetTimeout));

    // Initial idle state
    timeoutRef.current = setTimeout(() => setIsIdle(true), threshold);

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimeout));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [threshold]);

  return isIdle;
}
```

**Verify:**
- [ ] Navigate to `/screensaver`
- [ ] Verify Drew bubble renders and animates (idle state)
- [ ] Activity detected → wake message in console (dev)
- [ ] No sidebar, no transcript panel
- [ ] CSS containment doesn't break animations
- [ ] CPU/GPU usage minimal (<1% idle)

**Done condition:** Screensaver page loads, stays animated, <1% CPU idle, wakes on activity.

---

### 6a.1.4 — Task Executor Component

**Task:** Show running task progress (for Gojo integration & future task delegation).

**New file:** `components/TaskExecutor.tsx`

```typescript
interface TaskStatus {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  progress: number; // 0–100
  output: string[];
  startedAt: number;
  completedAt?: number;
}

interface TaskExecutorProps {
  task: TaskStatus | null;
  isVisible: boolean;
}

export default function TaskExecutor({ task, isVisible }: TaskExecutorProps) {
  if (!task || !isVisible) return null;

  const elapsed = task.completedAt
    ? (task.completedAt - task.startedAt) / 1000
    : (Date.now() - task.startedAt) / 1000;

  return (
    <div className="fixed bottom-4 left-4 w-96 bg-slate-800 border border-slate-600 rounded-lg p-4 max-h-64 overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-white font-semibold text-sm">{task.name}</h3>
          <p className="text-white/50 text-xs">
            {task.status === 'running' ? 'Running' : task.status}
            {' '} ({elapsed.toFixed(1)}s)
          </p>
        </div>
        <div className="text-right">
          <div className="text-white text-xs font-mono">{task.progress}%</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-700 rounded-full h-1.5 mb-3">
        <div
          className="bg-blue-500 h-1.5 rounded-full transition-all"
          style={{ width: `${task.progress}%` }}
        />
      </div>

      {/* Output */}
      <div className="bg-black rounded text-white/70 text-xs font-mono space-y-1 max-h-40 overflow-y-auto">
        {task.output.slice(-5).map((line, i) => (
          <div key={i} className="whitespace-pre-wrap break-words">
            {line}
          </div>
        ))}
      </div>

      {task.status === 'error' && (
        <div className="mt-2 text-red-400 text-xs">
          Error: check console or Discord #corrections
        </div>
      )}
    </div>
  );
}
```

**Integration:** `VoiceInterface.tsx`
```typescript
const [currentTask, setCurrentTask] = useState<TaskStatus | null>(null);

const handleMessage = (msg: ConversationMessage) => {
  if (msg.metadata?.task_id) {
    setCurrentTask({
      id: msg.metadata.task_id,
      name: `Task ${msg.metadata.task_id}`,
      status: 'running',
      progress: 0,
      output: [msg.content],
      startedAt: Date.now(),
    });
  }
};

return (
  <>
    <VoiceInterface {...props} />
    <TaskExecutor task={currentTask} isVisible={!!currentTask} />
  </>
);
```

**Verify:**
```bash
npm run test -- components/__tests__/TaskExecutor.test.tsx
# Mock a task, verify progress bar updates, output appends
```

**Done condition:** Task display updates in real-time, shows output tail, CPU/GPU doesn't spike.

---

### 6a.1.5 — Error Boundary & Fallback

**Task:** Handle Hermes offline gracefully; fallback to Discord.

**New file:** `components/ErrorBoundary.tsx`

```typescript
import { ReactNode, Component, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
          <div className="text-center max-w-lg">
            <h1 className="text-white text-2xl font-bold mb-4">Drew is resting</h1>
            <p className="text-white/70 mb-6">
              Something went wrong. Please try refreshing, or reach out in Discord.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => window.location.reload()}
                className="block w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Refresh
              </button>
              <a
                href="https://discord.gg/your-server"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-center"
              >
                Open Discord
              </a>
            </div>
            {process.env.NODE_ENV === 'development' && (
              <pre className="mt-4 bg-red-900/20 text-red-100 p-2 rounded text-xs overflow-auto">
                {this.state.error?.message}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Also:** Health check on page load.

```typescript
// hooks/useHermesHealth.ts
export function useHermesHealth(baseUrl: string) {
  const [isHealthy, setIsHealthy] = useState(true);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${baseUrl}/health`, { method: 'GET' });
        setIsHealthy(res.ok);
      } catch {
        setIsHealthy(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 5 * 60 * 1000); // 5min
    return () => clearInterval(interval);
  }, [baseUrl]);

  return isHealthy;
}
```

**Verify:**
```bash
npm run test -- components/__tests__/ErrorBoundary.test.tsx
# Kill Hermes, refresh, verify fallback UI appears
```

**Done condition:** If Hermes offline, graceful error shown; fallback link to Discord works.

---

### 6a.1.6 — Deployment (Vercel)

**Task:** Deploy drew-ui to Vercel for public access.

**Steps:**

1. Create Vercel project: `vercel link`
2. Set environment variables:
   ```bash
   vercel env add NEXT_PUBLIC_HERMES_URL
   # Value: http://100.119.229.11:8642 (Omen Tailscale IP)
   ```
3. Deploy: `vercel deploy --prod`
4. Configure custom domain (if applicable)
   ```bash
   vercel domains add drew.yourdomain.com
   ```

**Alternative:** Self-host on Omen
```bash
cd drew-ui
npm run build
npm start
# Or via PM2:
pm2 start "npm start" --name drew-ui --cwd /home/dhruva/DhruvaOS\ Mark\ 2/drew-ui
```

**Via Cloudflare Tunnel:**
```bash
# ~/.cloudflared/config.yml
tunnel: drew-tunnel
credentials-file: /home/dhruva/.cloudflared/<uuid>.json

ingress:
  - hostname: drew.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
```

**Verify:**
```bash
# Remote: curl https://drew.yourdomain.com
# should return 200 + HTML
curl -s https://drew.yourdomain.com | head -c 100
```

**Done condition:** Accessible at public URL; Hermes connects via Tailscale; no CORS errors.

---

### 6a.1.7 — Integration Testing

**Task:** End-to-end test of full voice loop.

**Test file:** `drew-ui/__tests__/e2e.test.ts`

```typescript
describe('Drew Voice Interface (E2E)', () => {
  test('full voice loop: click → listen → transcribe → respond → speak', async () => {
    // Mock Hermes WebSocket
    const mockServer = new WS('ws://localhost:3000/api/chat');

    // 1. Navigate to page
    // 2. Click Drew bubble
    // 3. Verify 'listening' state
    // 4. Simulate audio input
    // 5. Verify WebSocket message sent
    // 6. Mock response from Hermes
    // 7. Verify 'thinking' → 'speaking' state
    // 8. Verify TTS called
    // 9. Verify transcript displayed
  });

  test('fallback to mock when Hermes offline', async () => {
    // Don't start WebSocket
    // Click Drew
    // Verify it falls back to mock response
    // Verify console warns about offline mode
  });

  test('screensaver mode activates after 3min idle', async () => {
    // Navigate to /screensaver
    // Wait 3min (mock time)
    // Verify Drew is in 'idle' state
    // Simulate activity
    // Verify wake behavior (optional redirect)
  });

  test('conversation panel updates in real time', async () => {
    // Send message
    // Verify sidebar updates immediately
    // Verify history persists across re-renders
  });
});
```

**Verify:**
```bash
npm run test:e2e
# All tests pass
```

**Done condition:** All E2E tests pass; manual testing successful.

---

## Phase 6a.2: Omen Desktop (Electron) (Weeks 3–4)

Goal: Wrap drew-ui in Electron for native Omen desktop app.

### 6a.2.0 — Scaffold Electron Project

**Task:** Create new `omen-voice/` service with Electron boilerplate.

**New directory:** `omen-voice/`

```bash
mkdir omen-voice
cd omen-voice
npm init -y
npm install --save-dev electron electron-builder typescript ts-node
npm install framer-motion react react-dom zustand
```

**Key files:**

- `main.ts` — Electron main process
- `preload.ts` — IPC bridge
- `src/windows/bubble.ts` — floating bubble window
- `src/windows/terminal.ts` — task output pane
- `package.json` — with `build` & `start` scripts

**package.json:**
```json
{
  "name": "omen-voice",
  "version": "0.1.0",
  "main": "dist/main.js",
  "scripts": {
    "dev": "electron .",
    "build": "tsc && electron-builder",
    "start": "npm run build && electron dist/main.js"
  },
  "build": {
    "appId": "com.dhruvaos.omen-voice",
    "productName": "Drew",
    "files": [
      "dist/**/*",
      "node_modules/**/*"
    ],
    "linux": {
      "target": ["deb"],
      "category": "Utility"
    }
  }
}
```

**main.ts:**
```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { createBubbleWindow, createTerminalWindow } from './src/windows';

let bubbleWindow: BrowserWindow | null = null;
let terminalWindow: BrowserWindow | null = null;

app.on('ready', () => {
  bubbleWindow = createBubbleWindow();
  terminalWindow = createTerminalWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers (see 6a.2.2)
ipcMain.handle('read-file', async (_, filePath: string) => {
  // ...
});
```

**Verify:**
```bash
cd omen-voice
npm run dev
# Electron window should appear
```

**Done condition:** Electron boots, main process runs, no errors.

---

### 6a.2.1 — Window Management

**Task:** Create floating bubble window + docked terminal pane.

**New file:** `src/windows/bubble.ts`

```typescript
import { BrowserWindow } from 'electron';
import path from 'path';

export function createBubbleWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 320,
    height: 320,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  // Load drew-ui screensaver page
  window.loadURL('http://localhost:3000/screensaver');

  window.webContents.openDevTools({ mode: 'detach' });

  return window;
}
```

**New file:** `src/windows/terminal.ts`

```typescript
import { BrowserWindow } from 'electron';
import path from 'path';

export function createTerminalWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1000,
    height: 600,
    x: 0,
    y: 0,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  window.loadURL('http://localhost:3000/terminal'); // NEW route in drew-ui

  return window;
}
```

**Terminal page:** `drew-ui/app/terminal/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import Terminal from '@/components/Terminal';

export default function TerminalPage() {
  const [output, setOutput] = useState<string[]>([]);

  useEffect(() => {
    // Listen for IPC messages from Electron main
    window.electron?.onTaskOutput((line: string) => {
      setOutput(prev => [...prev, line]);
    });
  }, []);

  return (
    <div className="w-full h-screen bg-black">
      <Terminal lines={output} />
    </div>
  );
}
```

**Verify:**
```bash
cd omen-voice && npm run dev
# Two windows appear: floating bubble + terminal
```

**Done condition:** Both windows render, communicate via IPC.

---

### 6a.2.2 — IPC Handlers

**Task:** Bridge Electron main process with drew-ui frontend.

**New file:** `src/ipc/handlers.ts`

```typescript
import { ipcMain } from 'electron';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Read file from disk
ipcMain.handle('read-file', async (_, filePath: string) => {
  if (!isAllowedPath(filePath)) throw new Error('Path not allowed');
  return fs.readFileSync(filePath, 'utf-8');
});

// Execute shell command
ipcMain.handle('run-command', async (_, cmd: string, cwd?: string) => {
  if (!isAllowedCommand(cmd)) throw new Error('Command not allowed');
  try {
    const result = execSync(cmd, {
      cwd: cwd || process.cwd(),
      encoding: 'utf-8',
    });
    return { success: true, output: result };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Create git worktree
ipcMain.handle('create-worktree', async (_, repoPath: string, branchName: string) => {
  const cmd = `git -C "${repoPath}" worktree add ".claude/worktrees/${branchName}" -b "${branchName}"`;
  return ipcMain.invoke('run-command', cmd);
});

// Allowlist for security
function isAllowedPath(filePath: string): boolean {
  const allowed = [
    '/home/dhruva/DhruvaOS Mark 2',
    '/home/dhruva/Insforge',
  ];
  return allowed.some(prefix => filePath.startsWith(prefix));
}

function isAllowedCommand(cmd: string): boolean {
  const blocked = ['rm -rf /', 'sudo', 'dd', ':(){:|:&:};:'];
  return !blocked.some(b => cmd.includes(b));
}
```

**IPC types:** `src/ipc/types.ts`

```typescript
export interface ElectronAPI {
  readFile: (path: string) => Promise<string>;
  runCommand: (cmd: string, cwd?: string) => Promise<{ success: boolean; output?: string; error?: string }>;
  createWorktree: (repo: string, branch: string) => Promise<any>;
  onTaskOutput: (callback: (line: string) => void) => void;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}
```

**Preload script:** `preload.ts`

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  readFile: (path: string) => ipcRenderer.invoke('read-file', path),
  runCommand: (cmd: string, cwd?: string) => ipcRenderer.invoke('run-command', cmd, cwd),
  createWorktree: (repo: string, branch: string) => ipcRenderer.invoke('create-worktree', repo, branch),
  onTaskOutput: (callback: (line: string) => void) => {
    ipcRenderer.on('task-output', (_, line) => callback(line));
  },
});
```

**Verify:**
```typescript
// In drew-ui component
const readFile = async () => {
  const content = await window.electron?.readFile('/home/dhruva/DhruvaOS Mark 2/README.md');
  console.log(content);
};

// Should succeed if running in Electron; undefined if running in browser
```

**Done condition:** IPC calls work; security allowlist in place; no arbitrary code execution.

---

### 6a.2.3 — Build & Distribute

**Task:** Create production Electron build.

**Steps:**

```bash
cd omen-voice

# Build
npm run build

# Creates .deb for Ubuntu
# dist/omen-voice_1.0.0_amd64.deb

# Install on Omen
scp dist/omen-voice_1.0.0_amd64.deb dhruva@100.119.229.11:~/
ssh dhruva@100.119.229.11 'sudo dpkg -i ~/omen-voice_1.0.0_amd64.deb'

# Auto-start via systemd or PM2
pm2 start "omen-voice" --name omen-voice
```

**Systemd service alternative:** `/etc/systemd/user/omen-voice.service`

```ini
[Unit]
Description=Drew Voice Interface
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/omen-voice
Restart=on-failure

[Install]
WantedBy=default.target
```

```bash
systemctl --user enable omen-voice
systemctl --user start omen-voice
```

**Verify:**
```bash
# On Mac, SSH into Omen
ssh dhruva@100.119.229.11

# Check process
ps aux | grep omen-voice

# Check it's listening
lsof -i :3000  # or wherever drew-ui is served
```

**Done condition:** `.deb` built, installed, auto-starts, windows appear.

---

## Phase 6b.0 — iOS Prep (Weeks 5–6, after 6a complete)

Goal: Design & prototype native Swift app with WebSocket to Hermes.

### 6b.0.1 — Swift Project Scaffold

**Task:** Create new iOS app target.

```bash
# New Xcode project
# File → New → Project → iOS App
# Name: Jarvis, Language: Swift, Interface: SwiftUI

# Or via CLI:
xcodegen --spec project.yml  # if using xcodeproj templates
```

**Key files:**

```
jarvis-ios/
├── Jarvis.xcodeproj
├── Jarvis/
│   ├── JarvisApp.swift       (entry point)
│   ├── Views/
│   │   ├── ContentView.swift (main UI)
│   │   ├── BubbleView.swift  (Drew avatar)
│   │   └── ConversationView.swift
│   ├── Models/
│   │   ├── Message.swift
│   │   └── ConversationState.swift
│   ├── Services/
│   │   ├── HermesWebSocketService.swift
│   │   ├── AudioService.swift
│   │   └── PermissionManager.swift
│   └── Utilities/
│       └── Logger.swift
└── JarvisTests/
```

### 6b.0.2 — WebSocket Client (Swift)

**New file:** `Jarvis/Services/HermesWebSocketService.swift`

```swift
import Foundation
import Combine

class HermesWebSocketService: NSObject, URLSessionWebSocketDelegate, ObservableObject {
  @Published var state: ConversationState = .idle
  @Published var messages: [Message] = []

  private var webSocket: URLSessionWebSocket?
  private let hermesURL = "ws://100.119.229.11:8642/api/chat"

  func connect() async throws {
    let url = URL(string: hermesURL)!
    let session = URLSession(configuration: .default, delegate: self, delegateQueue: .main)
    webSocket = session.webSocketTask(with: url)
    webSocket?.resume()

    Task {
      await receiveMessages()
    }
  }

  func send(text: String) async throws {
    let message = ["text": text, "user_id": "voice-user"]
    let data = try JSONEncoder().encode(message)
    let jsonString = String(data: data, encoding: .utf8) ?? ""
    try await webSocket?.send(.string(jsonString))
  }

  private func receiveMessages() async {
    while let message = try? await webSocket?.receive() {
      switch message {
      case .string(let jsonString):
        let decoder = JSONDecoder()
        if let response = try? decoder.decode(ChatResponse.self, from: jsonString.data(using: .utf8)!) {
          DispatchQueue.main.async {
            self.messages.append(Message(role: .assistant, content: response.content))
            self.state = response.type == .final ? .idle : .thinking
          }
        }
      default:
        break
      }
    }
  }

  func disconnect() {
    webSocket?.cancel(with: .goingAway, reason: nil)
  }
}
```

### 6b.0.3 — Audio Service

**New file:** `Jarvis/Services/AudioService.swift`

```swift
import AVFoundation
import Speech

class AudioService: NSObject, AVAudioRecorderDelegate {
  @Published var isRecording = false
  
  private var audioRecorder: AVAudioRecorder?
  private let speechRecognizer = SFSpeechRecognizer()

  func requestMicrophonePermission() async -> Bool {
    let status = AVAudioApplication.shared.recordingGranted
    if status == .granted { return true }

    // Request permission
    let granted = try? await AVAudioApplication.requestRecordPermission()
    return granted ?? false
  }

  func startRecording() throws {
    let audioSession = AVAudioSession.sharedInstance()
    try audioSession.setCategory(.record, mode: .default, options: [])
    try audioSession.setActive(true)

    let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    let audioURL = documentsPath.appendingPathComponent("temp_audio.m4a")

    let settings: [String: Any] = [
      AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
      AVSampleRateKey: 44100.0,
      AVNumberOfChannelsKey: 1,
    ]

    audioRecorder = try AVAudioRecorder(url: audioURL, settings: settings)
    audioRecorder?.record()
    isRecording = true
  }

  func stopRecording() -> URL? {
    audioRecorder?.stop()
    isRecording = false
    return audioRecorder?.url
  }
}
```

### 6b.0.4 — SwiftUI View

**New file:** `Jarvis/Views/ContentView.swift`

```swift
import SwiftUI

struct ContentView: View {
  @StateObject var hermesService = HermesWebSocketService()
  @StateObject var audioService = AudioService()
  @State var transcript = ""

  var body: some View {
    ZStack {
      // Background
      LinearGradient(
        gradient: Gradient(colors: [.black, .purple.opacity(0.3)]),
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
      .ignoresSafeArea()

      VStack {
        // Top: Status
        HStack {
          Text("Drew")
            .font(.headline)
            .foregroundColor(.white)
          Spacer()
          Circle()
            .fill(hermesService.state == .idle ? Color.green : Color.blue)
            .frame(width: 8, height: 8)
        }
        .padding()

        Spacer()

        // Center: Bubble
        BubbleView(state: hermesService.state)
          .onTapGesture {
            Task {
              if audioService.isRecording {
                if let url = audioService.stopRecording() {
                  // Transcribe & send
                }
              } else {
                try audioService.startRecording()
              }
            }
          }

        Spacer()

        // Bottom: Transcript
        VStack(alignment: .leading) {
          Text("Last message:")
            .font(.caption)
            .foregroundColor(.white.opacity(0.7))
          Text(transcript)
            .font(.body)
            .foregroundColor(.white)
        }
        .padding()
        .background(.white.opacity(0.1))
        .cornerRadius(8)
        .padding()
      }
    }
    .task {
      try? await hermesService.connect()
    }
  }
}
```

**Done condition:** App compiles, shows bubble, WebSocket connects (in simulator or device).

---

## Final: Integration & Testing

### Complete Test Matrix

| Surface | Unit Tests | Integration | E2E | Coverage |
|---------|------------|-------------|-----|----------|
| Drew-UI (Mac) | ✅ 80%+ | ✅ WebSocket mock | ✅ Full voice loop | 85%+ |
| Omen Electron | ✅ 70%+ | ✅ IPC handlers | ✅ File read + worktree | 75%+ |
| iOS (Phase 6b) | ✅ 60%+ | ⏳ Device test | ⏳ After Phase 6a | 60%+ |

### Success Criteria Checklist

**Phase 6a complete when:**

- [ ] Drew-UI deployed to `drew.yourdomain.com`
- [ ] Screensaver mode working (zero CPU idle)
- [ ] Real Hermes conversation via WebSocket (not mocks)
- [ ] Omen Electron app boots, shows bubble + terminal
- [ ] IPC handlers secure (allowlist, no RCE)
- [ ] Conversation history in sidebar
- [ ] Task executor shows progress
- [ ] Error boundary + fallback to Discord
- [ ] All E2E tests pass
- [ ] Hermes quality firewall gate fires for outbound
- [ ] Documentation updated (ARCHITECTURE.md, DEPLOYMENT.md)

**Phase 6b prep complete when:**

- [ ] iOS project scaffolded
- [ ] WebSocket client working in Swift
- [ ] Audio capture working (AVAudioSession)
- [ ] SwiftUI views rendering
- [ ] Device testing plan in place

---

## Estimated Timeline

| Phase | Duration | Lead task | Blocker |
|-------|----------|-----------|---------|
| 6a.1.0 | 1d | Setup + cleanup | None |
| 6a.1.1 | 3d | Hermes API refactor | Real Hermes `/api/chat` WS endpoint ready |
| 6a.1.2 | 2d | Conversation panel | None |
| 6a.1.3 | 2d | Screensaver mode | CSS containment works (test on old Mac) |
| 6a.1.4 | 2d | Task executor | None |
| 6a.1.5 | 2d | Error boundary | None |
| 6a.1.6 | 1d | Vercel deploy | DNS/domain configured |
| 6a.1.7 | 2d | E2E tests | All components stable |
| 6a.2.0 | 2d | Electron scaffold | Node/Electron work on Omen (verify) |
| 6a.2.1 | 2d | Window mgmt | drew-ui screensaver page working |
| 6a.2.2 | 3d | IPC handlers | Security review passed |
| 6a.2.3 | 2d | Build + distribute | electron-builder working |
| 6b.0 prep | 3d | iOS scaffold | Xcode setup, Swift review |
| **Total Phase 6a** | **~4 weeks** | | |
| **Total Phase 6b** | **~2 weeks** | | Phase 6a complete + tested |

---

## References

- [Jarvis Voice Architecture](./jarvis-voice-interface-architecture.md)
- [Electron Documentation](https://www.electronjs.org/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [SwiftUI Tutorials](https://developer.apple.com/tutorials/swiftui)

---

**Document version:** 1.0  
**Last updated:** June 8, 2026  
**Owner:** Dhruva Vutukury  
**Status:** Ready for Phase 6a kickoff after Phase 5 completion
