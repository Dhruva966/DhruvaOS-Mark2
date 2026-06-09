import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Failed to parse form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'No audio file in "file" field' }, { status: 400 });
  }
  // Cap at 10 MB — Whisper max is 25 MB but voice UI recordings are <1 MB
  const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
  if (file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: 'Audio file too large (max 10 MB)' }, { status: 400 });
  }

  const whisperForm = new FormData();
  whisperForm.append('file', file, 'audio.webm');
  whisperForm.append('model', 'whisper-1');

  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: whisperForm,
    });
  } catch (err) {
    return NextResponse.json({ error: `Whisper request failed: ${err}` }, { status: 502 });
  }

  if (!response.ok) {
    const err = await response.text();
    return NextResponse.json({ error: `Whisper API: ${err}` }, { status: 502 });
  }

  const data = await response.json();
  return NextResponse.json({ text: data.text ?? '' });
}
