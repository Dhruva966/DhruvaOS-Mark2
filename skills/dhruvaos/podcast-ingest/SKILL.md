---
name: podcast-ingest
version: 1.0.0
tier: 2
outbound: false
requires_approval: false
description: "Ingest a podcast/audio URL or file: download → local Whisper STT → Sonnet synthesis → brain/resources/media/ → GBrain embed → connection-detector → #research."
schedule: null
author: dhruvaos
platforms: [linux]
prerequisites:
  env_vars:
    - ANTHROPIC_API_KEY
    - DISCORD_RESEARCH_CHANNEL_ID
gbrain:
  reads: ["resources/media/*"]
  writes: ["resources/media/YYYY-MM-DD-<title-slug>.md"]
tests: tests/
metadata:
  hermes:
    tags: [Ingest, Podcast, Audio, Whisper, STT, GBrain, Discord, Research, Command]
---

# Podcast Ingest

Triggered by `/ingest <audio-url-or-file-path>` in any Discord channel.

Examples:
- `/ingest https://example.com/podcast/episode-123.mp3`
- `/ingest /home/dhruva/Downloads/my-podcast.mp3`

Distinguishes audio from YouTube URLs (YouTube is handled by youtube-ingest).
Downloads audio if URL, transcribes via local Whisper STT, synthesizes via Sonnet,
saves to brain, embeds in GBrain, triggers connection-detector.

---

## Step 0 — Parse Input and Route

Parse everything after `/ingest` as the input string (trim whitespace).

```python
import re
from pathlib import Path

raw_input = "<input from command>"
source = raw_input.strip()

# Reject YouTube URLs — those go to youtube-ingest
YT_PATTERNS = [r"youtube\.com", r"youtu\.be"]
if any(re.search(p, source) for p in YT_PATTERNS):
    messaging.post(
        channel_id=DISCORD_RESEARCH_CHANNEL_ID,
        content="❌ YouTube URLs → use `/ingest <youtube-url>` (handled by youtube-ingest skill).",
    )
    stop()

# Determine if URL or local file
is_url = source.startswith("http://") or source.startswith("https://")
is_file = not is_url and Path(source).expanduser().exists()

if not is_url and not is_file:
    messaging.post(
        channel_id=DISCORD_RESEARCH_CHANNEL_ID,
        content=f"❌ Not a valid URL or file path: `{source}`\nUsage: `/ingest <audio-url-or-file>`",
    )
    stop()
```

---

## Step 1 — Deduplication Check

Before downloading anything, search GBrain for an existing ingest of this source:

```python
search_term = source if len(source) < 200 else source[-100:]
search_result = gbrain_search(f"podcast audio ingest {search_term}")

if any_match(search_result, min_confidence=0.85):
    existing_title = extract_title_from_result(search_result)
    messaging.post(
        channel_id=DISCORD_RESEARCH_CHANNEL_ID,
        content=f"⚠️ Already in brain: {existing_title}\nSkipping re-ingest.",
    )
    stop()
```

If GBrain search fails: log warning and continue (do not block on search failure).

---

## Step 2 — Download Audio (URL path only)

If input is a URL:

```python
import hashlib
import requests
from pathlib import Path

url_hash = hashlib.sha256(source.encode()).hexdigest()[:12]
tmp_path = Path(f"/tmp/podcast-{url_hash}.mp3")

try:
    print(f"[podcast-ingest] Downloading {source} → {tmp_path}")
    with requests.get(source, stream=True, timeout=30, allow_redirects=True) as resp:
        resp.raise_for_status()
        content_type = resp.headers.get("Content-Type", "")
        # Accept audio/* and application/octet-stream
        if "text/html" in content_type:
            raise ValueError(f"URL returned HTML, not audio: {content_type}")
        total = 0
        MAX_BYTES = 500 * 1024 * 1024  # 500 MB hard cap
        with tmp_path.open("wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    total += len(chunk)
                    if total > MAX_BYTES:
                        raise ValueError("Audio file exceeds 500 MB size cap")
    audio_path = tmp_path
    print(f"[podcast-ingest] Downloaded {total / 1024 / 1024:.1f} MB")
except Exception as e:
    messaging.post(
        channel_id=DISCORD_RESEARCH_CHANNEL_ID,
        content=f"❌ Failed to download audio: {e}",
    )
    stop()
```

If input is a local file path: set `audio_path = Path(source).expanduser().resolve()` directly.
Skip the download step.

---

## Step 3 — Transcribe via Local Whisper STT

Hermes is configured with `stt.provider: local` — use the built-in `whisper_transcribe` tool:

```python
try:
    print(f"[podcast-ingest] Transcribing {audio_path} via local Whisper...")
    transcript_result = whisper_transcribe(str(audio_path))
    # transcript_result is a dict: {"text": "...", "language": "en", "duration_s": 1234}
    transcript_text = transcript_result.get("text", "")
    duration_s = transcript_result.get("duration_s", 0)
    language = transcript_result.get("language", "en")
    if not transcript_text:
        raise ValueError("Whisper returned empty transcript")
    print(f"[podcast-ingest] Transcript: {len(transcript_text)} chars, {duration_s}s, lang={language}")
except Exception as e:
    messaging.post(
        channel_id=DISCORD_RESEARCH_CHANNEL_ID,
        content=f"❌ Whisper transcription failed: {e}\nFile: {audio_path}",
    )
    # Attempt cleanup before stopping
    if is_url and tmp_path.exists():
        tmp_path.unlink(missing_ok=True)
    stop()
```

Cap transcript at **12,000 characters** to avoid token overflow. If longer, take the first 8,000
chars + last 4,000 chars (preserve intro and conclusion):

```python
if len(transcript_text) > 12000:
    transcript_text = transcript_text[:8000] + "\n...[middle truncated]...\n" + transcript_text[-4000:]
```

**Duration formatting:**

```python
duration_min = duration_s // 60
duration_sec = duration_s % 60
duration_str = f"{duration_min}m {duration_sec}s" if duration_s else "unknown"
```

---

## Step 4 — Extract Episode Metadata

Infer title and show name from the source URL or filename:

```python
from urllib.parse import urlparse
import re
from datetime import datetime
import pytz

tz = pytz.timezone("America/Los_Angeles")
today_str = datetime.now(tz).strftime("%Y-%m-%d")

if is_url:
    path_part = urlparse(source).path
    raw_name  = path_part.rstrip("/").split("/")[-1]
else:
    raw_name = Path(audio_path).stem

# Clean up filename to readable title
title = re.sub(r"[-_]+", " ", raw_name).strip()
title = re.sub(r"\.(mp3|mp4|m4a|wav|ogg|opus|flac)$", "", title, flags=re.IGNORECASE)
title = title.title() if title == title.lower() else title
if not title:
    title = f"Podcast {today_str}"

slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:60]
```

---

## Step 5 — Sonnet Synthesis (Tier 2)

Call Claude Sonnet (Tier 2) to synthesize the transcript into structured notes.
Use Tier 2 here because podcast transcripts often require more nuanced reasoning than
video captions (no visual cues, may be informal speech, background noise artifacts).

**Synthesis prompt:**

```
Synthesize this podcast/audio transcript for Dhruva, a UCLA ECE student building a personal AI OS.

Title/Filename: {title}
Source: {source}
Duration: {duration_str}
Ingested: {today_str}
Language: {language}

Transcript:
{transcript_text}

Return a JSON object:
{
  "title": "<clean episode title>",
  "show": "<podcast show name if detectable, else 'Unknown'>",
  "key_points": [
    "bullet 1 — specific, actionable insight",
    "bullet 2",
    "bullet 3",
    "bullet 4",
    "bullet 5"
  ],
  "notable_quotes": [
    "direct quote or paraphrase 1",
    "direct quote or paraphrase 2",
    "direct quote or paraphrase 3"
  ],
  "main_takeaway": "<2-3 sentence summary of the core message>",
  "relevance": "<1-2 sentences: why this is relevant to Dhruva's AI OS work or UCLA ECE studies>"
}
```

If synthesis fails: post error to Discord and proceed to cleanup. Synthesis failure is not silent.

---

## Step 6 — Write to Brain

```python
import re
from pathlib import Path

brain_media_dir = Path.home() / "brain" / "resources" / "media"
brain_media_dir.mkdir(parents=True, exist_ok=True)

final_slug = re.sub(r"[^a-z0-9]+", "-", synthesis["title"].lower()).strip("-")[:60] or slug
filepath = brain_media_dir / f"{today_str}-{final_slug}.md"

# Safety: resolve path stays within brain/resources/media/
resolved = filepath.resolve()
if not str(resolved).startswith(str(brain_media_dir.resolve()) + "/"):
    raise ValueError("Unsafe brain output path")

content = f"""# {synthesis['title']}

*Source: {source}*
*Show: {synthesis['show']} | Duration: {duration_str} | Language: {language}*
*Ingested: {today_str}*

## Key Points
{chr(10).join("- " + p for p in synthesis['key_points'])}

## Notable Quotes
{chr(10).join("- " + q for q in synthesis['notable_quotes'])}

## Main Takeaway
{synthesis['main_takeaway']}

## Relevance to Dhruva's Work
{synthesis['relevance']}
"""

filepath.write_text(content, encoding="utf-8")
print(f"[podcast-ingest] Written to {resolved}")
```

---

## Step 7 — GBrain Ingest

```python
import subprocess

gbrain_bin = subprocess.run(
    ["command", "-v", "gbrain"], capture_output=True, text=True
).stdout.strip() or "/home/dhruva/.bun/bin/gbrain"

subprocess.run(
    f"flock -n ~/.gbrain/gbrain-write.lock sh -lc "
    f"'{gbrain_bin} import {resolved} 2>&1 && {gbrain_bin} embed --stale 2>&1'",
    shell=True, timeout=60,
)
```

If the lock is busy: log "GBrain ingest queued" and note in Discord post. Do not wait.

---

## Step 8 — Clean Up Temp File

If the audio was downloaded from a URL (not a local file), delete the temp file:

```python
if is_url and tmp_path.exists():
    try:
        tmp_path.unlink()
        print(f"[podcast-ingest] Cleaned up {tmp_path}")
    except Exception as e:
        print(f"[podcast-ingest] WARN: cleanup failed for {tmp_path}: {e}")
```

Always attempt cleanup even if earlier steps failed — do not leave large audio files in /tmp.

---

## Step 9 — Post to #research

Post confirmation to `DISCORD_RESEARCH_CHANNEL_ID` (#research):

```
🎙️ Ingested: {synthesis['title']}

**Show:** {synthesis['show']} | {duration_str}
**Takeaway:** {synthesis['main_takeaway']}

Saved to ~/brain/resources/media/{today_str}-{final_slug}.md
```

Keep under 1800 characters. No approval needed — internal ingest confirmation.

---

## Step 10 — Run connection-detector

After the Discord post, trigger the connection-detector skill:

```python
hermes.run_skill(
    "connection-detector",
    args={"brain_file": str(resolved)},
)
```

Connection enrichment is best-effort — do not block on failure.

---

## Error Handling

| Failure | Action |
|---------|--------|
| YouTube URL passed | Redirect to youtube-ingest via Discord message and stop |
| Invalid URL or file | Post usage hint to Discord and stop |
| GBrain dedup search fails | Log warning, continue with ingest |
| Duplicate detected | Post "Already in brain" and stop |
| Download fails | Post error to Discord, skip cleanup (no file to delete), stop |
| Download exceeds 500 MB cap | Post error to Discord and stop |
| URL returns HTML not audio | Post error to Discord and stop |
| Whisper transcription fails | Post error, attempt cleanup, stop |
| Synthesis fails | Post error to Discord; attempt cleanup; stop |
| Brain file write fails | Log error; note in Discord post; attempt cleanup |
| GBrain ingest fails | File write is durable — log and continue |
| Cleanup fails | Log warning only — not a fatal error |
| Discord post fails | Log to ~/.hermes/logs/skill-errors.log |
| connection-detector unavailable | Log warning; ingest still complete |

Always clean up the temp audio file in /tmp regardless of which step fails.

---

## Done Condition

Skill is complete when:
1. Audio source validated (URL or file) and not a YouTube URL
2. Deduplication check passed
3. Audio downloaded (if URL) or resolved (if local file)
4. Transcription complete via local Whisper
5. Temp file cleaned up (if URL)
6. Synthesis complete
7. Brain file written to `~/brain/resources/media/{today_str}-{final_slug}.md`
8. GBrain ingest attempted
9. Discord confirmation posted to `DISCORD_RESEARCH_CHANNEL_ID`
10. connection-detector triggered (best-effort)
