// Hermes API client
// Connects to Hermes running on Omen via Tailscale

const HERMES_BASE_URL = process.env.NEXT_PUBLIC_HERMES_URL || 'http://localhost:8642';

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.wav');

    const response = await fetch(`${HERMES_BASE_URL}/api/audio/transcribe`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Transcription failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.text || data.transcript || '';
  } catch (error) {
    console.error('Transcription error:', error);
    return '';
  }
}

export async function speakText(text: string): Promise<string> {
  try {
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
      return URL.createObjectURL(audioBlob);
    } else {
      const data = await response.json();
      return data.audio_url || data.url || '';
    }
  } catch (error) {
    console.error('TTS error:', error);
    return '';
  }
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
