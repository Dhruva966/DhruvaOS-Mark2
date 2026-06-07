// Hermes API client
// Connects to Hermes running on Omen via Tailscale
// For voice conversation, uses Hermes chat API + WebSocket (Phase 2 TODO: integrate real conversation)

const HERMES_BASE_URL = process.env.NEXT_PUBLIC_HERMES_URL || 'http://localhost:8642';

// Simple response generator until WebSocket integration (Phase 2 TODO)
function generateResponse(userText: string): string {
  const responses = [
    `You said: "${userText}". I heard you loud and clear!`,
    `Interesting thought: "${userText}". Tell me more.`,
    `Got it: "${userText}". That's noted.`,
    `I understand: "${userText}". What else?`,
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.wav');

    console.log(`[API] Transcribing to ${HERMES_BASE_URL}/api/audio/transcribe`);
    const response = await fetch(`${HERMES_BASE_URL}/api/audio/transcribe`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Transcription failed: ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.text || data.transcript || '';
    console.log('[API] Transcribed:', text);
    return text;
  } catch (error) {
    console.error('[API] Transcription error:', error);
    // Fallback for testing without Hermes
    console.log('[API] Using mock transcription for testing');
    return 'Hello Drew, this is a test message.';
  }
}

export async function speakText(text: string): Promise<string> {
  try {
    console.log(`[API] Speaking to ${HERMES_BASE_URL}/api/audio/speak`);
    const response = await fetch(`${HERMES_BASE_URL}/api/audio/speak`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        provider: 'elevenlabs', // use ElevenLabs
      }),
    });

    if (!response.ok) {
      throw new Error(`TTS failed: ${response.statusText}`);
    }

    // Response should be audio blob or URL
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('audio')) {
      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      console.log('[API] TTS audio received');
      return url;
    } else {
      const data = await response.json();
      console.log('[API] TTS response:', data);
      return data.audio_url || data.url || '';
    }
  } catch (error) {
    console.error('[API] TTS error:', error);
    // Fallback: generate a silent audio file for testing
    console.log('[API] Using fallback silent audio for testing');
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.5, audioContext.sampleRate);
    const blob = await new Promise<Blob>((resolve) => {
      const offlineContext = new OfflineAudioContext(1, audioContext.sampleRate * 0.5, audioContext.sampleRate);
      const source = offlineContext.createBufferSource();
      source.buffer = buffer;
      source.connect(offlineContext.destination);
      source.start(0);
      offlineContext.startRendering().then((renderedBuffer) => {
        const channelData = renderedBuffer.getChannelData(0);
        const wav = encodeWAV(channelData, renderedBuffer.sampleRate);
        resolve(new Blob([wav], { type: 'audio/wav' }));
      });
    });
    return URL.createObjectURL(blob);
  }
}

// Helper to encode PCM data to WAV
function encodeWAV(channelData: Float32Array, sampleRate: number): ArrayBuffer {
  const length = channelData.length;
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * 2, true);

  let index = 44;
  for (let i = 0; i < length; i++) {
    view.setInt16(index, channelData[i] < 0 ? channelData[i] * 0x8000 : channelData[i] * 0x7fff, true);
    index += 2;
  }

  return buffer;
}

// Health check
export async function checkHermesHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${HERMES_BASE_URL}/health`, {
      method: 'GET',
    });
    return response.ok;
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
}
