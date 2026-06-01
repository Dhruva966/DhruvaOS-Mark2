# Discord Channel Definitions

## Channel List

Create these 6 channels in your DhruvaOS Discord server. Exact names matter (Hermes routes by channel name).

| Channel | Purpose | Hermes posts here | Dhruva commands here |
|---------|---------|-------------------|---------------------|
| `#briefings` | Morning/evening briefings, conversational responses | Daily auto + on demand | Conversation, questions |
| `#tasks` | Task list, prioritization, status | After /tasks + morning briefing | /tasks, /email triage |
| `#research` | Research synthesis outputs | After /research | /research |
| `#alerts` | System alerts (credit watchdog, errors) | Auto on critical events | Acknowledgments |
| `#charlie` | Charlie's Cleaners (stub — future) | Not yet | Not yet |
| `#corrections` | **OUTBOUND APPROVAL GATE** + behavioral corrections | Outbound previews | 👍 approve, /deny, /correct |

## Setup Steps

1. Create Discord server (or use existing)
2. Create Text Channels: briefings, tasks, research, alerts, charlie, corrections
3. Set channel permissions: only Dhruva + DhruvaOS bot
4. In Hermes config, map channel IDs:
   ```yaml
   discord:
     channels:
       briefings: "<channel-id>"
       tasks: "<channel-id>"
       research: "<channel-id>"
       alerts: "<channel-id>"
       charlie: "<channel-id>"
       corrections: "<channel-id>"
   ```

## Getting Channel IDs

1. Discord Settings → Advanced → Enable Developer Mode
2. Right-click channel → Copy Channel ID
