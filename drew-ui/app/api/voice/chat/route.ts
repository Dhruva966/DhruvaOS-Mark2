import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface DashboardCommand {
  type: 'gbrain_search' | 'gbrain_think' | 'discord_messages' | 'dispatch_skill' | 'pin_widget' | 'unpin_widget';
  query?: string;
  skill?: string;
  widget?: string;
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Drew, the AI brain of DhruvaOS — Dhruva's personal AI operating system.

Context:
- Dhruva Vutukury: UCLA ECE student (starting Fall 2026), building autonomous AI systems
- DhruvaOS: Hermes Agent (task automation, skills, crons) + GBrain (compounding personal memory)
- Runs 24/7 on HP Omen 15 (Ubuntu 24.04, GTX 1660 Ti), accessible via Tailscale
- Voice mode: keep responses to 1–3 sentences unless explicitly asked for more

ALWAYS respond with valid JSON — no markdown fences, no preamble, just the raw JSON object:
{
  "message": "Your natural language response here",
  "commands": []
}

Available dashboard commands (add to "commands" array when relevant):
- {"type": "gbrain_search", "query": "<search terms>"} — search GBrain memory
- {"type": "gbrain_think", "query": "<question>"} — temporal reasoning over memory
- {"type": "discord_messages"} — fetch recent Discord messages
- {"type": "dispatch_skill", "skill": "<skill-name>"} — trigger a Hermes skill
- {"type": "pin_widget", "widget": "<memory|crons|activity|status>"} — show widget in status bar
- {"type": "unpin_widget", "widget": "<name>"} — remove widget from status bar

Use commands when Dhruva asks to see data, search memory, run a skill, or configure the dashboard.
Only include commands that will surface real data — never include them just for show.

Deployed skills: morning-briefing, evening-summary, paper-monitor, research-synthesis, linkedin-post, youtube-video-create, meeting-prep-brief, xposteros-control, personal-site-update.`;

// ── GBrain search via MCP HTTP (port 3131) ────────────────────────────────────
// The gbrain CLI is unreliable on Omen due to a PGLite/WASM issue.
// The HTTP MCP server at port 3131 is the correct path.

async function runGBrainSearch(query: string): Promise<{ entries: object[]; total: number; error?: string }> {
  const safe = query.replace(/[;&|`$(){}[\]\\<>!*?#~]/g, ' ').trim().substring(0, 200);
  if (!safe) return { entries: [], total: 0, error: 'empty query' };

  const gbrainUrl = process.env.GBRAIN_URL ?? 'http://127.0.0.1:3131';
  const token = process.env.MCP_GBRAIN_API_KEY ?? process.env.GBRAIN_MCP_TOKEN;

  try {
    const res = await fetch(`${gbrainUrl}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json, text/event-stream',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'search', arguments: { query: safe, limit: 8 } },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return { entries: [], total: 0, error: `GBrain HTTP ${res.status}` };
    }

    // Response arrives as SSE — extract data: lines
    const text = await res.text();
    for (const line of text.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      try {
        const envelope = JSON.parse(line.slice(6));
        const rawText = envelope?.result?.content?.[0]?.text;
        if (!rawText) continue;
        const chunks = JSON.parse(rawText);
        if (!Array.isArray(chunks)) continue;
        const entries = chunks.map((c: Record<string, unknown>) => ({
          title: c.title as string | undefined,
          body: c.chunk_text as string | undefined,
          score: c.score as number | undefined,
        }));
        return { entries, total: entries.length };
      } catch { continue; }
    }

    return { entries: [], total: 0, error: 'no results parsed' };
  } catch (err) {
    return {
      entries: [],
      total: 0,
      error: `GBrain unavailable: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`,
    };
  }
}

// ── Hermes skill dispatch via /v1/runs ────────────────────────────────────────

async function dispatchSkill(skillName: string): Promise<{ status: string; job_id?: string; output?: string; error?: string }> {
  const safe = skillName.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 80);
  if (!safe) return { status: 'error', error: 'invalid skill name' };

  const hermesUrl = process.env.HERMES_URL ?? 'http://127.0.0.1:8642';
  const apiKey = process.env.HERMES_API_KEY;

  try {
    const res = await fetch(`${hermesUrl}/v1/runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ input: `Run the ${safe} skill now.` }),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      const body = await res.text();
      return { status: 'error', error: `Hermes HTTP ${res.status}: ${body.slice(0, 120)}` };
    }

    const data = await res.json();
    return { status: 'started', job_id: data.run_id, output: `Run started (${data.run_id?.slice(0, 12) ?? '?'})` };
  } catch (err) {
    return {
      status: 'error',
      error: `Hermes unavailable: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`,
    };
  }
}

// ── Parse Drew's JSON response ────────────────────────────────────────────────

function parseDrewResponse(raw: string): { message: string; commands: DashboardCommand[] } {
  const text = raw.trim();

  if (text.startsWith('{')) {
    try {
      const p = JSON.parse(text);
      if (typeof p.message === 'string') {
        return { message: p.message, commands: Array.isArray(p.commands) ? p.commands : [] };
      }
    } catch { /* next */ }
  }

  const match = text.match(/\{[\s\S]*"message"[\s\S]*\}/);
  if (match) {
    try {
      const p = JSON.parse(match[0]);
      if (typeof p.message === 'string') {
        return { message: p.message, commands: Array.isArray(p.commands) ? p.commands : [] };
      }
    } catch { /* fall through */ }
  }

  return { message: text, commands: [] };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  let body: { message: string; history?: HistoryMessage[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { message, history = [] } = body;
  if (!message?.trim()) return NextResponse.json({ error: 'No message provided' }, { status: 400 });
  if (message.length > 4000) return NextResponse.json({ error: 'Message too long' }, { status: 400 });

  const trimmedHistory = history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-10)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));

  const messages = [...trimmedHistory, { role: 'user' as const, content: message }];

  // ── Claude call ───────────────────────────────────────────────────────────
  let claudeRaw = '';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Anthropic API: ${err}` }, { status: 502 });
    }
    const data = await res.json();
    claudeRaw = data.content?.[0]?.text ?? '';
  } catch (err) {
    return NextResponse.json({ error: `Anthropic request failed: ${err}` }, { status: 502 });
  }

  // ── Parse + execute commands ──────────────────────────────────────────────
  const { message: responseText, commands } = parseDrewResponse(claudeRaw);
  const cards: object[] = [];
  const widgetCommands: { type: 'pin' | 'unpin'; widget: string }[] = [];

  await Promise.allSettled(
    commands.map(async (cmd) => {
      switch (cmd.type) {
        case 'gbrain_search':
        case 'gbrain_think': {
          const results = await runGBrainSearch(cmd.query ?? '');
          cards.push({ type: 'gbrain_results', query: cmd.query ?? '', ...results });
          break;
        }
        case 'dispatch_skill': {
          const result = await dispatchSkill(cmd.skill ?? '');
          cards.push({ type: 'skill_output', data: { skill: cmd.skill ?? 'unknown', ...result } });
          break;
        }
        case 'discord_messages':
          cards.push({ type: 'discord_messages', messages: [], error: 'Discord fetch not yet wired' });
          break;
        case 'pin_widget':
          if (cmd.widget) widgetCommands.push({ type: 'pin', widget: cmd.widget });
          break;
        case 'unpin_widget':
          if (cmd.widget) widgetCommands.push({ type: 'unpin', widget: cmd.widget });
          break;
      }
    })
  );

  return NextResponse.json({ response: responseText, cards, widgetCommands });
}
