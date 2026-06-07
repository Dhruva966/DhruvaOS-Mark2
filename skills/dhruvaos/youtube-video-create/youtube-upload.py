#!/usr/bin/env python3
"""Upload a video file to YouTube via Data API v3.

Usage:
  python3 youtube-upload.py \
    --file /path/to/video.mp4 \
    --title "Video Title" \
    --description "Description text" \
    --tags "tag1,tag2" \
    --channel-id UCxxxxxx \
    [--privacy public|unlisted|private] \
    [--dry-run]

Requires:
  ~/.hermes/.env: YOUTUBE_CHANNEL_ID, GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET
  ~/.hermes/token.json: OAuth token with youtube.upload scope
  pip install google-api-python-client google-auth-oauthlib
"""

import argparse
import json
import os
import sys
from pathlib import Path

ENV_FILE = Path.home() / ".hermes" / ".env"
TOKEN_FILE = Path.home() / ".hermes" / "token.json"
SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/youtube.upload",
]


def load_env(path: Path) -> dict:
    env = {}
    if not path.exists():
        return env
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip()
    return env


def get_credentials():
    try:
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request
        from google_auth_oauthlib.flow import InstalledAppFlow
    except ImportError:
        print("ERROR: Install google libs: pip install google-api-python-client google-auth-oauthlib", file=sys.stderr)
        sys.exit(1)

    creds = None
    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            TOKEN_FILE.write_text(creds.to_json())
        else:
            print("ERROR: No valid token. Re-run OAuth flow on Mac:", file=sys.stderr)
            print("  python3 ~/.hermes/scripts/gmail-oauth-setup.py", file=sys.stderr)
            print("  (ensure youtube.upload scope is included in SCOPES)", file=sys.stderr)
            sys.exit(1)

    return creds


def upload_video(file_path: str, title: str, description: str, tags: list,
                 privacy: str, channel_id: str, dry_run: bool) -> dict:
    if dry_run:
        return {
            "dry_run": True,
            "video_id": "DRY_RUN_VIDEO_ID",
            "video_url": "https://youtube.com/watch?v=DRY_RUN_VIDEO_ID",
            "title": title,
            "status": "dry_run",
        }

    if not Path(file_path).exists():
        print(f"ERROR: Video file not found: {file_path}", file=sys.stderr)
        sys.exit(1)

    try:
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaFileUpload
    except ImportError:
        print("ERROR: Install google-api-python-client", file=sys.stderr)
        sys.exit(1)

    creds = get_credentials()
    youtube = build("youtube", "v3", credentials=creds)

    body = {
        "snippet": {
            "title": title[:100],
            "description": description[:5000],
            "tags": tags[:500],
            "categoryId": "28",  # Science & Technology
        },
        "status": {
            "privacyStatus": privacy,
            "selfDeclaredMadeForKids": False,
        },
    }

    media = MediaFileUpload(file_path, chunksize=-1, resumable=True)
    request = youtube.videos().insert(
        part="snippet,status",
        body=body,
        media_body=media,
    )

    print(f"Uploading: {title}", file=sys.stderr)
    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            print(f"Progress: {int(status.progress() * 100)}%", file=sys.stderr)

    video_id = response["id"]
    video_url = f"https://youtube.com/watch?v={video_id}"
    print(f"Uploaded: {video_url}", file=sys.stderr)

    return {
        "dry_run": False,
        "video_id": video_id,
        "video_url": video_url,
        "title": title,
        "status": "published",
    }


def main():
    parser = argparse.ArgumentParser(description="Upload video to YouTube")
    parser.add_argument("--file", required=True)
    parser.add_argument("--title", required=True)
    parser.add_argument("--description", default="")
    parser.add_argument("--tags", default="")
    parser.add_argument("--privacy", default="unlisted", choices=["public", "unlisted", "private"])
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    env = load_env(ENV_FILE)
    channel_id = env.get("YOUTUBE_CHANNEL_ID", "")

    tags = [t.strip() for t in args.tags.split(",") if t.strip()] if args.tags else []

    result = upload_video(
        file_path=args.file,
        title=args.title,
        description=args.description,
        tags=tags,
        privacy=args.privacy,
        channel_id=channel_id,
        dry_run=args.dry_run,
    )
    print(json.dumps(result))


if __name__ == "__main__":
    main()
