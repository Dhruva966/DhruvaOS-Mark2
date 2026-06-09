#!/bin/bash
# Switch Hermes TTS provider from Edge (local) to ElevenLabs
# Run this on Omen to enable Drew avatar voice

set -e

CONFIG="$HOME/.hermes/config.yaml"

if [ ! -f "$CONFIG" ]; then
  echo "Error: $CONFIG not found"
  exit 1
fi

echo "Switching Hermes TTS provider to ElevenLabs..."

# Switch TTS provider from edge to elevenlabs
sed -i.bak 's/^  provider: edge$/  provider: elevenlabs/' "$CONFIG"

# Enable auto_tts (optional, for future voice-only mode)
sed -i '' 's/^  auto_tts: false$/  auto_tts: true/' "$CONFIG" || true

# Restart Hermes
echo "Restarting Hermes..."
systemctl --user restart hermes-gateway

echo "Done. Hermes now uses ElevenLabs TTS."
echo "Health check:"
sleep 2
curl -s http://localhost:8642/health | jq . || echo "Hermes health endpoint (checking...)"
