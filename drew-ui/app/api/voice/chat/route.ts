import { NextRequest, NextResponse } from 'next/server';

interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  message: string;
  history?: HistoryMessage[];
}

const SYSTEM_PROMPT =
  "You are Drew, Dhruva's personal AI assistant. You are concise, sharp, and helpful. " +
  "Dhruva is a UCLA ECE student who builds autonomous AI systems that run locally. " +
  "Keep responses short for voice — 1-3 sentences max. Be direct, no filler.";

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { message, history = [] } = body;
  if (!message?.trim()) {
    return NextResponse.json({ error: 'No message provided' }, { status: 400 });
  }
  // Cap message length to prevent token-stuffing via the API
  if (message.length > 4000) {
    return NextResponse.json({ error: 'Message too long (max 4000 chars)' }, { status: 400 });
  }

  // Keep last 10 turns to avoid token bloat; also cap history item length
  const trimmedHistory = history
    .slice(-10)
    .map((m: HistoryMessage) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content.slice(0, 4000) : '',
    }));
  const messages = [
    ...trimmedHistory,
    { role: 'user' as const, content: message },
  ];

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });
  } catch (err) {
    return NextResponse.json({ error: `Anthropic request failed: ${err}` }, { status: 502 });
  }

  if (!response.ok) {
    const err = await response.text();
    return NextResponse.json({ error: `Anthropic API: ${err}` }, { status: 502 });
  }

  const data = await response.json();
  const responseText: string = data.content?.[0]?.text ?? '';
  return NextResponse.json({ response: responseText });
}
