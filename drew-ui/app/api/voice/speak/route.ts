import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

const ELEVEN_VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? '21m00Tcm4TlvDq8ikWAM';

export async function POST(request: NextRequest) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;

  let body: { text: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { text } = body;
  if (!text?.trim()) {
    return NextResponse.json({ error: 'No text provided' }, { status: 400 });
  }
  // Cap at 2000 chars (~2 min of audio) to prevent unbounded API spend
  if (text.length > 2000) {
    return NextResponse.json({ error: 'Text too long (max 2000 chars)' }, { status: 400 });
  }

  // Try ElevenLabs first
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  if (elevenKey) {
    try {
      const el = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': elevenKey,
            'content-type': 'application/json',
            accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_monolingual_v1',
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        }
      );
      if (el.ok) {
        const audio = await el.arrayBuffer();
        return new NextResponse(audio, {
          headers: { 'Content-Type': 'audio/mpeg' },
        });
      }
    } catch {
      // fall through to OpenAI
    }
  }

  // Fallback: OpenAI TTS
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ error: 'No TTS API keys configured (ELEVENLABS_API_KEY or OPENAI_API_KEY)' }, { status: 500 });
  }

  let tts: Response;
  try {
    tts = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: 'tts-1', input: text, voice: 'alloy' }),
    });
  } catch (err) {
    return NextResponse.json({ error: `TTS request failed: ${err}` }, { status: 502 });
  }

  if (!tts.ok) {
    const err = await tts.text();
    return NextResponse.json({ error: `OpenAI TTS: ${err}` }, { status: 502 });
  }

  const audio = await tts.arrayBuffer();
  return new NextResponse(audio, {
    headers: { 'Content-Type': 'audio/mpeg' },
  });
}
