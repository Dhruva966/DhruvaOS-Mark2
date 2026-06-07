---
name: youtube-video-create
version: 1.0.0
tier: 2
outbound: true
requires_approval: true
description: "Create a YouTube video: interview → research → script → thumbnail → upload. Approval required before every upload."
schedule: null
gbrain:
  reads: ["projects/*", "goals/*", "resources/research-*.md"]
  writes: ["resources/youtube-scripts-{{date}}.md"]
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - ANTHROPIC_API_KEY
    - DISCORD_CORRECTIONS_CHANNEL_ID
    - YOUTUBE_CHANNEL_ID
    - FAL_KEY
metadata:
  hermes:
    tags: [YouTube, Outbound, ContentOS, Quality-Firewall, Phase5]
---

# YouTube Video Create (ContentOS)

**Quality firewall: Tier 2 mandatory. Approval required TWICE — once for script, once for upload. No exceptions.**

Triggered by: `/video <seed idea>` in Discord.
Example: `/video I want to talk about building a personal AI system`

This skill NEVER uploads without explicit 👍 approval in #corrections.

---

## Step 0 — Prerequisites check

```python
import os
missing = [v for v in [
    "DISCORD_CORRECTIONS_CHANNEL_ID",
    "YOUTUBE_CHANNEL_ID",
    "FAL_KEY",
] if not os.environ.get(v)]
if missing:
    raise SystemExit(f"Missing env vars: {missing}. Add to ~/.hermes/.env and restart Hermes.")
```

---

## Step 1 — Interview (3-5 targeted questions)

Post to `DISCORD_CORRECTIONS_CHANNEL_ID`:

```
🎬 YouTube video — let me ask a few questions before I draft the script.

Topic: {seed_idea}

1. Who is the target audience? (builders, students, general tech curious)
2. What's the ONE key insight or takeaway you want them to leave with?
3. Do you have a personal story or experience to anchor this?
4. How long should the video be? (5 min / 10 min / 15+ min)
5. Any specific format preference? (talking head, screenshare walkthrough, slides)

Reply in one message — I'll use your answers to shape the script.
```

Use the `clarify` tool to wait for Dhruva's reply. Timeout: 30 minutes.

Parse the response into:
- `audience`, `key_insight`, `personal_story`, `duration_target`, `format_style`

---

## Step 2 — Research

```python
topic = seed_idea

# GBrain searches
results_topic = gbrain_search(topic)
results_projects = gbrain_search("projects I've built related to: " + topic)
results_trajectory = gbrain_think("What has Dhruva built or learned recently that's most relevant to: " + topic)

# Exa search for external context
exa_results = exa_search(query=topic + " developer tutorial 2025", num_results=3)
exa_content = exa_get_contents(urls=[r.url for r in exa_results[:3]])
```

Synthesize into a `research_brief` (3-5 key points from brain + external).

---

## Step 3 — Content brief + FIRST APPROVAL

Generate a content brief (NOT the full script yet):

```
🎬 [APPROVAL REQUIRED] youtube-video-create — Content Brief

Topic: {topic}
Title: {proposed_title}
Format: {format_style}
Target length: {duration_target}
Audience: {audience}

## Hook (first 30 seconds)
{hook_text}

## Structure
1. {section_1_title} (~{time}min) — {one_line_description}
2. {section_2_title} (~{time}min) — {one_line_description}
3. {section_3_title} (~{time}min) — {one_line_description}
[...up to 5 sections]

## Key Insight
{key_insight}

## CTA
{call_to_action}

Approval ID: {brief_approval_id}
Expires: {expires} (15 min)

React 👍 to generate full script · Reply /deny {brief_approval_id} to rework
```

**HARD STOP.** Wait for 👍. Validate:
- Reactor is `DISCORD_ALLOWED_USER`
- Not expired
- Message unedited

If rejected: post "Brief rejected — re-run /video to start over."

---

## Step 4 — Generate full script (Tier 2)

Using Sonnet, expand the approved brief into a full script:

```python
script_prompt = f"""
Write a complete YouTube video script for Dhruva Vutukury.

Topic: {topic}
Title: {title}
Format: {format_style}
Target duration: {duration_target}
Audience: {audience}

Content brief:
{approved_brief}

Research context:
{research_brief}

Personal story/experience: {personal_story}

Rules:
- First-person, authentic voice — NOT corporate
- Hook must grab attention in first 10 seconds (question, surprising fact, or bold claim)
- Each section: [VISUAL NOTE: description of what's shown] then spoken words
- Include natural transition phrases between sections
- End with specific CTA: subscribe + share + one actionable thing to try
- Do NOT mention DhruvaOS, Drew, or personal AI systems by name
- Tone: smart builder talking to other curious builders
"""
full_script = sonnet_generate(script_prompt)
```

Generate metadata:
```python
import hashlib, secrets
from datetime import datetime, timezone, timedelta

title = "<generated SEO-friendly title, ≤70 chars>"
description = "<3-4 paragraph description with timestamps + links>"
tags = ["<tag1>", ..., "<tag10>"]  # max 10 relevant tags

script_approval_id = secrets.token_hex(8)
content_hash = hashlib.sha256(full_script.encode()).hexdigest()[:16]
expires_dt = datetime.now(timezone.utc) + timedelta(minutes=15)
expires = expires_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
```

Save script to brain:
```python
brain_path = f"~/brain/resources/youtube-scripts-{datetime.now().strftime('%Y-%m-%d')}.md"
# Write with frontmatter: title, date, tags, source=youtube-video-create
```

---

## Step 5 — Script approval (SECOND HARD STOP)

Post to `DISCORD_CORRECTIONS_CHANNEL_ID`:

```
📝 [APPROVAL REQUIRED] youtube-video-create — Full Script

Title: {title}
Duration estimate: {duration_target}
Approval ID: {script_approval_id}
Content SHA-256: {content_hash}
Expires: {expires} (15 min)

---
{full_script[:1800]}
[... truncated — full script saved to brain/resources/youtube-scripts-{date}.md]
---

React 👍 to generate thumbnail + queue for upload · Reply /deny {script_approval_id} to discard
```

Validate same rules as Step 3. If denied: discard and stop.

---

## Step 6 — Generate thumbnail (fal.ai FLUX)

```python
import os, requests, json

fal_key = os.environ["FAL_KEY"]
title_short = title[:60]

thumbnail_prompt = f"""
YouTube thumbnail for a tech video titled: "{title_short}"
Style: bold typography, dark background, tech aesthetic
Colors: deep navy or dark gradient with bright accent (electric blue or orange)
No faces. Include: large readable text with the key phrase from the title.
Clean, professional, high-contrast — optimized for small screen legibility.
16:9 aspect ratio, 1280x720.
"""

response = requests.post(
    "https://fal.run/fal-ai/flux/schnell",
    headers={"Authorization": f"Key {fal_key}", "Content-Type": "application/json"},
    json={
        "prompt": thumbnail_prompt,
        "image_size": "landscape_16_9",
        "num_inference_steps": 4,
        "num_images": 1,
    },
    timeout=60,
)
result = response.json()
thumbnail_url = result["images"][0]["url"]

# Download thumbnail
import urllib.request
thumbnail_path = f"/tmp/thumbnail-{script_approval_id}.jpg"
urllib.request.urlretrieve(thumbnail_url, thumbnail_path)
```

If fal.ai fails: continue without thumbnail (note in confirmation message).

---

## Step 7 — Video assembly (text-on-screen via ffmpeg)

For initial builds, create a simple title-card video with the script text displayed section by section. Full video rendering with voice/B-roll is Phase 6 work.

```bash
# Generate a simple placeholder video (30s title card)
ffmpeg -f lavfi -i color=c=0x0a0e27:size=1280x720:rate=30 \
  -vf "drawtext=text='{title_escaped}':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2" \
  -t 30 -y /tmp/video-{script_approval_id}.mp4 2>/dev/null

video_path = f"/tmp/video-{script_approval_id}.mp4"
```

Note in upload confirmation that this is a placeholder — replace with recorded video before setting to public.

---

## Step 8 — Upload to YouTube (THIRD HARD STOP for upload)

Post upload confirmation to #corrections:

```
🚀 [APPROVAL REQUIRED] youtube-video-create — Upload

Title: {title}
Privacy: unlisted (change to public after review on youtube.com)
Thumbnail: {thumbnail_path if thumbnail_url else 'none generated'}
Video file: {video_path}
Approval ID: {upload_approval_id}
Expires: {expires_upload} (10 min)

Note: Video uploads as UNLISTED. Review on youtube.com, set thumbnail manually,
then change to Public when ready.

React 👍 to upload · Reply /deny {upload_approval_id} to discard
```

After 👍:

```python
import subprocess, json

result_json = subprocess.check_output([
    "python3", "/home/dhruva/.hermes/scripts/youtube-upload.py",
    "--file", video_path,
    "--title", title,
    "--description", description,
    "--tags", ",".join(tags),
    "--privacy", "unlisted",
], text=True)
result = json.loads(result_json)
```

Report to XPosterOS:
```python
requests.post(
    f"{os.environ.get('XPOSTEROS_API_URL', 'http://127.0.0.1:8081')}/platforms/youtube/published",
    headers={"Authorization": f"Bearer {os.environ['XPOSTEROS_API_TOKEN']}"},
    json={
        "approval_id": upload_approval_id,
        "video_id": result["video_id"],
        "video_url": result["video_url"],
        "status": result["status"],
    },
    timeout=10,
)
```

---

## Step 9 — Confirm

Post to #corrections:
```
✅ YouTube video uploaded

Title: {title}
URL: {video_url}
Privacy: unlisted — review and set thumbnail at youtube.com/studio
Script saved: brain/resources/youtube-scripts-{date}.md

To go public: open YouTube Studio → Videos → find "{title}" → set thumbnail → Publish
```

---

## Error handling

| Failure | Action |
|---------|--------|
| Missing env vars | Stop before interview, list which vars are missing |
| Interview timeout (30 min) | Discard, post "Interview timed out" |
| Brief not approved (15 min) | Discard, post "Brief expired — re-run /video" |
| Script not approved (15 min) | Discard, post "Script expired — re-run /video" |
| fal.ai thumbnail fails | Continue without thumbnail, note in upload confirmation |
| ffmpeg not found | Post error with install command: `sudo apt install ffmpeg` |
| youtube-upload.py fails (token) | Post OAuth re-auth instructions (see Prerequisites) |
| Upload approval timeout | Discard, post "Upload window expired — re-run /video when ready" |

**Never upload silently.** Always 3-approval flow: brief → script → upload.

---

## Prerequisites for first use

1. **YouTube channel**: create at youtube.com (manual — Dhruva does this)

2. **YouTube OAuth** (extend existing Google OAuth token):
   - Open the Mac-side OAuth setup script: `~/.hermes/scripts/gmail-oauth-setup.py`
   - Add `https://www.googleapis.com/auth/youtube.upload` to SCOPES list
   - Re-run the script to get an updated `token.json` with YouTube scope
   - `scp ~/.hermes/token.json dhruva@100.119.229.11:~/.hermes/token.json`

3. **fal.ai API key**:
   - Sign up at fal.ai → dashboard → API keys → copy key
   - Add to `~/.hermes/.env`: `FAL_KEY=your_key_here`
   - Also add to `~/xposteros/.env`: `FAL_KEY=your_key_here`

4. **YouTube Channel ID**:
   - Open youtube.com/account_advanced → copy Channel ID (starts with `UC`)
   - Add to `~/.hermes/.env`: `YOUTUBE_CHANNEL_ID=UCxxxxx`

5. **ffmpeg** (for placeholder video generation):
   ```bash
   sudo apt install ffmpeg
   ```

6. **Google API Python libs** (in Hermes venv):
   ```bash
   source ~/.hermes/.venv/bin/activate
   pip install google-api-python-client google-auth-oauthlib google-auth-httplib2 moviepy
   ```

7. P3.3 quality firewall gate must pass before this skill goes live.
