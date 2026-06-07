---
name: youtube-ingest
version: 1.0.0
tier: 1
outbound: false
requires_approval: false
description: "Ingest a YouTube video: transcript → Sonnet synthesis → brain/resources/video/ → GBrain embed → connection-detector → #research."
schedule: null
author: dhruvaos
platforms: [linux]
prerequisites:
  env_vars:
    - EXA_API_KEY
    - ANTHROPIC_API_KEY
    - DISCORD_RESEARCH_CHANNEL_ID
gbrain:
  reads: ["resources/video/*"]
  writes: ["resources/video/YYYY-MM-DD-<title-slug>.md"]
tests: tests/
metadata:
  hermes:
    tags: [Ingest, YouTube, Transcript, GBrain, Discord, Research, Command]
---

# YouTube Ingest

Triggered by `/ingest <youtube-url>` in any Discord channel.
Accepts: `youtube.com/watch?v=`, `youtube.com/shorts/`, `youtu.be/` URLs.
Example: `/ingest https://www.youtube.com/watch?v=dQw4w9WgXcQ`

Extracts the transcript, synthesizes key insights via Sonnet, saves to brain,
embeds in GBrain, then auto-runs connection-detector to surface related concepts.

---

## Step 0 — Parse and Validate URL

Parse everything after `/ingest` as the URL string (trim whitespace).

```python
import re

raw_url = "<url from command>"
url = raw_url.strip()

# Accept both youtube.com and youtu.be
YT_PATTERNS = [
    r"(?:https?://)?(?:www\.)?youtube\.com/watch\?.*v=([A-Za-z0-9_-]{11})",
    r"(?:https?://)?youtu\.be/([A-Za-z0-9_-]{11})",
    r"(?:https?://)?(?:www\.)?youtube\.com/shorts/([A-Za-z0-9_-]{11})",
]

video_id = None
for pattern in YT_PATTERNS:
    m = re.search(pattern, url)
    if m:
        video_id = m.group(1)
        break

if not video_id:
    messaging.post(
        channel_id=DISCORD_RESEARCH_CHANNEL_ID,
        content=f"❌ Not a valid YouTube URL: `{url}`\nUsage: `/ingest <youtube-url>`",
    )
    stop()
```

---

## Step 1 — Deduplication Check

Before fetching anything, search GBrain for an existing ingest of this video:

```python
search_result = gbrain_search(f"youtube {video_id}")
# Also search by URL pattern
search_result2 = gbrain_search(f"youtube.com/watch?v={video_id}")

if any_match(search_result, search_result2, min_confidence=0.85):
    existing_title = extract_title_from_result(search_result)
    messaging.post(
        channel_id=DISCORD_RESEARCH_CHANNEL_ID,
        content=f"⚠️ Already in brain: {existing_title}\nSkipping re-ingest.",
    )
    stop()
```

If GBrain search fails: log warning and continue (do not block ingest on search failure).

---

## Step 2 — Fetch Transcript

Use `youtube_transcript_api` Python library (free, no API key needed):

```python
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound
import json

transcript_text = None
transcript_source = None

try:
    transcript_list = YouTubeTranscriptApi.get_transcript(video_id, languages=["en", "en-US", "en-GB"])
    # Join segments into a single string; each segment has {"text": ..., "start": ..., "duration": ...}
    transcript_text = " ".join(seg["text"].replace("\n", " ") for seg in transcript_list)
    transcript_source = "youtube_transcript_api"
    print(f"[youtube-ingest] Transcript: {len(transcript_text)} chars via {transcript_source}")
except (TranscriptsDisabled, NoTranscriptFound) as e:
    print(f"[youtube-ingest] No transcript available: {e} — will try Exa fallback")
except Exception as e:
    print(f"[youtube-ingest] Transcript fetch error: {e} — will try Exa fallback")
```

**If no transcript:** fall back to Exa contents of the video page URL to get the description:

```python
if transcript_text is None:
    try:
        exa_result = exa_contents(url, max_chars=3000)
        transcript_text = exa_result.get("text", "")
        transcript_source = "exa_fallback_description"
        if not transcript_text:
            raise ValueError("Exa returned empty content")
    except Exception as e:
        messaging.post(
            channel_id=DISCORD_RESEARCH_CHANNEL_ID,
            content=f"❌ Could not get transcript or description for {url}\nError: {e}",
        )
        stop()
```

Cap transcript at **12,000 characters** to avoid token overflow. If longer, take the first 8,000
chars + last 4,000 chars (preserve intro and conclusion context):

```python
if len(transcript_text) > 12000:
    transcript_text = transcript_text[:8000] + "\n...[middle truncated]...\n" + transcript_text[-4000:]
```

---

## Step 3 — Fetch Video Metadata

Use `yt-dlp` to get structured metadata (title, channel, duration, upload date):

```python
import subprocess
import json

try:
    result = subprocess.run(
        ["yt-dlp", "--dump-json", "--no-playlist", url],
        capture_output=True, text=True, timeout=30,
    )
    meta = json.loads(result.stdout)
    title       = meta.get("title", "Unknown Title")
    channel     = meta.get("uploader") or meta.get("channel", "Unknown Channel")
    duration_s  = meta.get("duration", 0)
    upload_date = meta.get("upload_date", "")  # YYYYMMDD format
    if upload_date and len(upload_date) == 8:
        upload_date = f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:8]}"
    duration_str = f"{duration_s // 60}m {duration_s % 60}s" if duration_s else "unknown"
except Exception as e:
    print(f"[youtube-ingest] yt-dlp metadata failed: {e} — using URL as title fallback")
    title        = f"YouTube video {video_id}"
    channel      = "Unknown"
    duration_str = "unknown"
    upload_date  = ""
```

If `yt-dlp` is not installed, fall back to Exa search for the video title:
```python
exa_meta = exa_search(f"youtube {video_id} site:youtube.com", num_results=1)
title = exa_meta[0].get("title", f"YouTube video {video_id}") if exa_meta else f"YouTube video {video_id}"
```

---

## Step 4 — Sonnet Synthesis (Tier 1)

Call GPT-4o-mini (Tier 1) to synthesize the transcript into structured notes.

**Synthesis prompt:**

```
Synthesize this YouTube video for Dhruva, a UCLA ECE student building a personal AI OS.

Title: {title}
Channel: {channel}
Duration: {duration_str}
Upload date: {upload_date}
Transcript source: {transcript_source}

Transcript:
{transcript_text}

Return a JSON object:
{
  "title": "<exact video title>",
  "channel": "<channel name>",
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

If synthesis fails: post error to Discord and stop. Synthesis is the core value of this skill.

---

## Step 5 — Write to Brain

```python
import re
from pathlib import Path
from datetime import datetime
import pytz

tz = pytz.timezone("America/Los_Angeles")
today_str = datetime.now(tz).strftime("%Y-%m-%d")

slug = re.sub(r"[^a-z0-9]+", "-", synthesis["title"].lower()).strip("-")[:60]
brain_video_dir = Path.home() / "brain" / "resources" / "video"
brain_video_dir.mkdir(parents=True, exist_ok=True)
filepath = brain_video_dir / f"{today_str}-{slug}.md"

# Safety: resolve path stays within brain/resources/video/
resolved = filepath.resolve()
if not str(resolved).startswith(str(brain_video_dir.resolve()) + "/"):
    raise ValueError("Unsafe brain output path")

content = f"""# {synthesis['title']}

*Source: YouTube | Channel: {synthesis['channel']} | Duration: {duration_str}*
*Upload date: {upload_date} | Ingested: {today_str}*
*URL: {url}*
*Transcript via: {transcript_source}*

## Key Points
- {chr(10).join("- " + p for p in synthesis['key_points'])}

## Notable Quotes
- {chr(10).join("- " + q for q in synthesis['notable_quotes'])}

## Main Takeaway
{synthesis['main_takeaway']}

## Relevance to Dhruva's Work
{synthesis['relevance']}
"""

filepath.write_text(content, encoding="utf-8")
print(f"[youtube-ingest] Written to {resolved}")
```

---

## Step 6 — GBrain Ingest

Ingest the new brain file immediately:

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

If the lock is busy (dream cycle running): log "GBrain ingest queued" and note in Discord post.
Do not wait — the file write is durable.

---

## Step 7 — Post to #research

Post confirmation to `DISCORD_RESEARCH_CHANNEL_ID` (#research):

```
📹 Ingested: {title}

**Channel:** {channel} | {duration_str}
**Takeaway:** {main_takeaway}

Saved to ~/brain/resources/video/{today_str}-{slug}.md
```

Keep under 1800 characters. No approval needed — internal ingest confirmation.

---

## Step 8 — Run connection-detector

After the Discord post, trigger the connection-detector skill to find related brain nodes.

Call connection-detector with the newly written file path as argument:

```python
hermes.run_skill(
    "connection-detector",
    args={"brain_file": str(resolved)},
)
```

If connection-detector is not available or fails: log a warning. The ingest is still complete.
Connection enrichment is best-effort — do not block the ingest on it.

---

## Error Handling

| Failure | Action |
|---------|--------|
| Invalid YouTube URL | Post usage hint to Discord and stop |
| GBrain dedup search fails | Log warning, continue with ingest |
| Duplicate detected | Post "Already in brain" message and stop |
| No transcript + Exa fallback empty | Post error to Discord and stop |
| yt-dlp metadata fails | Use URL-based title fallback, continue |
| Sonnet synthesis fails | Post error to Discord and stop |
| Brain file write fails | Log error; note in Discord post |
| GBrain ingest fails | File write is durable — log and continue |
| Discord post fails | Log to ~/.hermes/logs/skill-errors.log |
| connection-detector unavailable | Log warning; ingest still complete |

---

## Done Condition

Skill is complete when:
1. Video ID extracted and validated
2. Deduplication check passed
3. Transcript obtained (api or Exa fallback)
4. Metadata fetched
5. Synthesis complete
6. Brain file written to `~/brain/resources/video/{today_str}-{slug}.md`
7. GBrain ingest attempted
8. Discord confirmation posted to `DISCORD_RESEARCH_CHANNEL_ID`
9. connection-detector triggered (best-effort)
