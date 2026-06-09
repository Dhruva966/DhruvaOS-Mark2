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
  "You are Drew, Dhruva's content creation partner. Dhruva is brainstorming social media posts for X, LinkedIn, or YouTube. " +
  "Dhruva builds autonomous AI systems, studies ECE at UCLA, and posts about AI, edge computing, and building in public. " +
  "Your role: only respond when directly asked a question or addressed by name. " +
  "If no question is asked, respond with exactly the word 'noted.' and nothing else. " +
  "When asked, give sharp 2-3 sentence responses — refine angles, suggest hooks, identify what's interesting. " +
  "Be direct, no filler. Think like a smart collaborator who knows his work.";

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

  const trimmedHistory = history.slice(-10);
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
        max_tokens: 256,
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
