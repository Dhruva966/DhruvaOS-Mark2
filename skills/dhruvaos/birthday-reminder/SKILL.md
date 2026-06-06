---
name: birthday-reminder
version: 1.0.0
tier: 0
outbound: false
requires_approval: false
description: "Daily 8am: check GBrain + brain/people/ frontmatter for upcoming birthdays (today + 7-day window); post to #alerts."
author: dhruvaos
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_ALERTS_CHANNEL_ID
gbrain:
  reads: ["people/*"]
  writes: []
tests: tests/
metadata:
  hermes:
    tags: [Relationships, People, Birthdays, Alerts, Daily]
---

# Birthday Reminder

You are Drew, Dhruva's personal AI OS agent. This skill runs daily at 8:00am Pacific.
Check all known people for birthdays today or within the next 7 days. Post an alert if found.

This is an INTERNAL alert to Discord only. Nothing is sent to any contact.
No approval gate needed. Auto-post directly.

Brain format supported: `birthday: YYYY-MM-DD` in people file frontmatter.
Partial dates (`birthday: --MM-DD`) are also supported (year unknown — no age calculation).

---

## Step 0 — Determine Today's Date and 7-Day Window

Use `code_execution`:

```python
from datetime import datetime, timedelta, timezone

tz_offset = -7  # Pacific Daylight Time
from datetime import timezone
import datetime as dt

now = dt.datetime.now(dt.timezone(dt.timedelta(hours=tz_offset)))
today = now.date()
window = [today + dt.timedelta(days=i) for i in range(8)]  # today through 7 days out

print(f"TODAY={today.isoformat()}")
print(f"TODAY_MONTH={today.month}")
print(f"TODAY_DAY={today.day}")
for d in window:
    print(f"WINDOW_DAY={d.month}-{d.day}")
```

---

## Step 1 — Search GBrain for Birthday Entries

Call `gbrain search` with query: `"birthday born birth date people"`

Also call `gbrain search` with query: `"birthday {MONTH}" ` — substituting the current month name
(e.g., "birthday June").

Collect all results. For each entry, extract any `birthday:` field or text mentioning a birthday date.

---

## Step 2 — Scan Brain People Files

Use `terminal` to grep for birthday fields across all people files:

```bash
grep -r "^birthday:" ~/brain/people/ 2>/dev/null | sed 's|.*people/||;s|/.*:birthday:||'
```

Output format expected: `<slug-or-path> YYYY-MM-DD` or `<slug> --MM-DD`

Parse each line. Extract:
- Person name/slug (from path)
- Birthday value (YYYY-MM-DD or --MM-DD)

If `~/brain/people/` does not exist or is empty, continue with GBrain results only.

---

## Step 3 — Classify Upcoming Birthdays

Use `code_execution` to classify:

```python
import datetime as dt

today_month = [TODAY_MONTH]
today_day = [TODAY_DAY]
today_year = [TODAY_YEAR]

people = [...]  # list of {"name": ..., "birthday": "YYYY-MM-DD" or "--MM-DD", "tier": ...}

today_bd = []      # birthday is TODAY
upcoming_bd = []   # birthday in 1-7 days

for p in people:
    bday_raw = p.get("birthday", "")
    if not bday_raw:
        continue

    # Handle partial dates (--MM-DD format)
    if bday_raw.startswith("--"):
        bday_raw = f"{today_year}{bday_raw}"  # fill in current year

    try:
        bday = dt.date.fromisoformat(bday_raw)
    except ValueError:
        continue

    # Normalize to current year for comparison
    try:
        bday_this_year = bday.replace(year=today_year)
    except ValueError:
        # Feb 29 on non-leap year — use Feb 28
        bday_this_year = dt.date(today_year, 2, 28)

    today_date = dt.date(today_year, today_month, today_day)
    delta = (bday_this_year - today_date).days

    birth_year = bday.year if not bday_raw.startswith(str(today_year) + "--") else None
    age = (today_year - birth_year) if birth_year and birth_year != today_year else None

    if delta == 0:
        today_bd.append({**p, "age": age, "date_str": bday_this_year.strftime("%B %-d")})
    elif 1 <= delta <= 7:
        upcoming_bd.append({**p, "days_away": delta, "age": age,
                            "date_str": bday_this_year.strftime("%B %-d")})

print(f"TODAY_COUNT={len(today_bd)}")
print(f"UPCOMING_COUNT={len(upcoming_bd)}")
for b in today_bd:
    age_str = f" They turn {b['age']}." if b.get("age") else ""
    print(f"TODAY_BD: {b['name']}|{b['date_str']}|{age_str}|{b.get('tier','')}")
for b in upcoming_bd:
    age_str = f" (turns {b['age']})" if b.get("age") else ""
    print(f"UPCOMING_BD: {b['name']}|{b['days_away']}|{b['date_str']}{age_str}|{b.get('tier','')}")
```

---

## Step 4 — Post to #alerts (Only If Birthdays Found)

**If both TODAY_COUNT and UPCOMING_COUNT are 0: stop here. Silent exit. Do NOT post.**

Build alert message(s). Keep each under 1800 characters.

**For birthdays TODAY:**
```
🎂 Today is <Name>'s birthday! They turn <age>.
```
(Omit "They turn <age>" if year of birth is unknown.)

If relationship tier = "friend" or "close friend", append a suggested message snippet:
```
💬 Suggested message: "Happy birthday, <Name>! Hope you have an amazing day 🎉"
```

**For upcoming birthdays (1–7 days out):**
```
🎂 <Name>'s birthday in <N> days (<Month Day>)
```
If relationship tier = "friend", append:
```
💬 Suggested message: "Hey <Name>, thinking of you ahead of your birthday!"
```

Post ONE Discord message per birthday (today's birthdays first, then upcoming).
Use the `messaging` tool with channel `DISCORD_ALERTS_CHANNEL_ID` (#alerts).

Do NOT combine all birthdays into a single message if it would exceed 1800 characters.
Send separate messages instead.

---

## Step 5 — Log Completion

```bash
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] birthday-reminder: today=N upcoming=M" \
  >> ~/.hermes/logs/skill-errors.log
```

Replace N with today_bd count, M with upcoming_bd count.

---

## Error Handling

| Failure | Action |
|---------|--------|
| GBrain returns no results | Continue with brain file grep only |
| `~/brain/people/` missing | Continue with GBrain results only |
| Both sources empty | Silent exit — no birthdays tracked yet |
| Date parse failure on a person | Skip that person silently |
| Discord post fails | Log to ~/.hermes/logs/skill-errors.log |

---

## Done Condition

Skill is complete when:
1. GBrain search + brain people files both checked
2. Either: birthday alert(s) posted to #alerts, OR silent exit (no upcoming birthdays)
3. Completion logged to skill-errors.log
