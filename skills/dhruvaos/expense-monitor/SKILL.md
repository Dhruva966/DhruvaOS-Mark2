---
name: expense-monitor
version: 1.0.0
tier: 1
outbound: false
requires_approval: false
description: "Command: /expenses import <csv-path> to categorize + save; /expenses for last 3-month comparison. MANUAL CSV UPLOAD ONLY — no bank API connection."
author: dhruvaos
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_RESEARCH_CHANNEL_ID
gbrain:
  reads: ["finance/*"]
  writes: ["finance/expenses-*.md"]
tests: tests/
metadata:
  hermes:
    tags: [Finance, Expenses, CSV, Research, Command]
---

# Expense Monitor

You are Drew, Dhruva's personal AI OS agent.

**IMPORTANT: This skill does NOT connect to any bank API, credit card API, or financial institution.
All expense data comes from CSV files that Dhruva exports manually from his bank or card portal
and uploads to the Omen. This is a deliberate security design — no credentials, no OAuth tokens,
no direct financial institution access.**

Triggered by:
- `/expenses import <csv-file-path>` — import and categorize a bank statement CSV
- `/expenses` — show last 3 months comparison from GBrain

---

## Routing — Which Mode?

Parse the Discord message:
- If message contains `import` and a file path → run **Import Mode** (Steps 1–6)
- If message is just `/expenses` or `/expenses summary` → run **Summary Mode** (Steps A–B)

---

# IMPORT MODE: `/expenses import <csv-file-path>`

## Step 1 — Validate CSV File

Extract the file path from the message (everything after `import `).

Use `terminal` to verify the file exists and preview the first few lines:

```bash
CSV_PATH="[FILE PATH FROM COMMAND]"
if [ ! -f "$CSV_PATH" ]; then
    echo "FILE_NOT_FOUND"
else
    echo "FILE_OK"
    head -5 "$CSV_PATH"
    wc -l "$CSV_PATH"
fi
```

If `FILE_NOT_FOUND`, post to #research:
`❌ File not found: <path>. Export your bank statement as CSV and provide the full path.`
and stop.

Determine the month this statement covers. Check the filename first (e.g., `statement-2026-05.csv`),
then fall back to reading the first few transaction dates in the file.

---

## Step 2 — Parse CSV Transactions

Use `code_execution` to build a safe parser, then `terminal` to run it:

```python
import csv, json, base64, os

# Build a script that reads the CSV and outputs JSON transactions
script = '''
import csv, json, sys
rows = []
path = sys.argv[1]
try:
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(dict(row))
    print(json.dumps(rows[:500]))  # cap at 500 transactions
except Exception as e:
    print(json.dumps({"error": str(e)}))
'''
encoded = base64.b64encode(script.encode()).decode()
print(f"SCRIPT_B64={encoded}")
```

```bash
SCRIPT_B64="[BASE64 FROM code_execution]"
CSV_PATH="[FILE PATH]"
source ~/.hermes/hermes-agent/venv/bin/activate && python3 - "$CSV_PATH" <<'PYEOF'
import base64, json, os, sys

script = base64.b64decode(os.environ["SCRIPT_B64"]).decode()
exec(script)
PYEOF
```

Parse the JSON array of rows. Identify column names for:
- Date column (look for: "Date", "Transaction Date", "Posted Date", "date")
- Description/merchant column (look for: "Description", "Merchant", "Payee", "memo")
- Amount column (look for: "Amount", "Debit", "Credit", "transaction_amount")

If amount is split into Debit/Credit columns, combine: expense = Debit > 0 ? Debit : 0.

Determine `statement_month` as YYYY-MM from the majority of transaction dates.

---

## Step 3 — Categorize with phi4-mini

**Expense categories (fixed list — do not invent new ones):**
- Food (restaurants, groceries, delivery)
- Transport (gas, Uber, Lyft, parking, transit)
- Subscriptions (recurring software, streaming, SaaS)
- Entertainment (movies, games, events, bars)
- Shopping (Amazon, retail, clothing)
- Education (courses, books, conferences)
- Health (pharmacy, gym, medical)
- Travel (flights, hotels, Airbnb)
- Utilities (phone, internet, electricity)
- Other (anything that doesn't fit above)

Send batches of 20 transactions to phi4-mini at a time:

```bash
BATCH_B64="[BASE64 ENCODED JSON ARRAY OF 20 TRANSACTIONS]"
python3 - <<'PYEOF'
import base64, json, os, urllib.request

batch = json.loads(base64.b64decode(os.environ["BATCH_B64"]))

prompt_lines = [f"- {t.get('description','?')}: ${t.get('amount',0)}" for t in batch]
prompt = f"""Categorize each expense into exactly one category from this list:
Food, Transport, Subscriptions, Entertainment, Shopping, Education, Health, Travel, Utilities, Other

Expenses:
{chr(10).join(prompt_lines)}

Return a JSON array of category strings, one per expense, in the same order.
Return ONLY the JSON array."""

payload = json.dumps({"model": "phi4-mini", "prompt": prompt, "stream": False})
req = urllib.request.Request(
    "http://localhost:11434/api/generate",
    data=payload.encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        result = json.loads(resp.read())
    print(result.get("response", "[]"))
except Exception as e:
    import sys
    print("[]")
    print(f"OLLAMA_ERROR: {e}", file=sys.stderr)
PYEOF
```

If Ollama is unavailable: assign all transactions to "Other" and note the categorization failure.

Merge categories back into transactions. Build per-category totals and item counts.

---

## Step 4 — Calculate Summary

Use `code_execution`:

```python
from collections import defaultdict

transactions = [...]   # enriched with category
totals = defaultdict(float)
counts = defaultdict(int)
grand_total = 0.0

for t in transactions:
    amt = float(t.get("amount", 0) or 0)
    cat = t.get("category", "Other")
    totals[cat] += amt
    counts[cat] += 1
    grand_total += amt

# Sort categories by spend, descending
sorted_cats = sorted(totals.items(), key=lambda x: x[1], reverse=True)

print(f"GRAND_TOTAL={grand_total:.2f}")
print(f"MONTH={statement_month}")
for cat, amt in sorted_cats:
    pct = (amt / grand_total * 100) if grand_total > 0 else 0
    print(f"CAT: {cat}|{amt:.2f}|{counts[cat]}|{pct:.1f}%")
```

---

## Step 5 — Save to Brain

Use `terminal` to ensure the directory exists:
```bash
mkdir -p ~/brain/finance/
```

Use the `file` tool to write `~/brain/finance/expenses-[STATEMENT_MONTH].md`:

```markdown
# Expenses — [STATEMENT_MONTH]

_Imported by Drew from: [CSV_FILENAME]_
_Categorized: [N] transactions | Total: $[GRAND_TOTAL]_

## Summary

| Category | Total | Transactions | % of Spend |
|----------|-------|-------------|------------|
| Food | $X.XX | N | X.X% |
| Transport | $X.XX | N | X.X% |
...

## All Transactions

| Date | Description | Amount | Category |
|------|-------------|--------|---------|
| YYYY-MM-DD | merchant | $X.XX | Food |
...
```

Limit the transactions table to 200 rows. If more, note: `_(N more not shown — see raw CSV)_`

Then ingest into GBrain:
```bash
export PATH=/home/dhruva/.bun/bin:/home/dhruva/.hermes/bin:/home/dhruva/.local/bin:$PATH
GBRAIN_BIN="$(command -v gbrain || echo /home/dhruva/.bun/bin/gbrain)"
flock -n ~/.gbrain/gbrain-write.lock sh -lc \
  "$GBRAIN_BIN import ~/brain/finance/expenses-[STATEMENT_MONTH].md 2>&1 | head -3"
```

---

## Step 6 — Post Summary to #research

Use the `messaging` tool to post to `DISCORD_RESEARCH_CHANNEL_ID` (#research):

```
💰 Expense Summary: [MONTH_STR]
Total: $[GRAND_TOTAL]

• Food: $X.XX (X.X%)
• Subscriptions: $X.XX (X.X%)
• Shopping: $X.XX (X.X%)
• Transport: $X.XX (X.X%)
• [other categories...]
• Other: $X.XX (X.X%)

[N] transactions categorized. Saved to ~/brain/finance/expenses-[STATEMENT_MONTH].md
```

---

# SUMMARY MODE: `/expenses`

## Step A — Fetch Last 3 Months from GBrain

Use `code_execution` to determine the last 3 month strings (YYYY-MM format).

Call `gbrain search` with query: `"monthly expenses finance summary totals"`

Also check brain files directly:
```bash
ls ~/brain/finance/expenses-*.md 2>/dev/null | sort -r | head -3
```

Read the last 3 expense files if they exist. Extract the grand total and top 3 categories from each.

## Step B — Post 3-Month Comparison to #research

Build a comparison table:

```
💰 Expense Report — Last 3 Months

| Month | Total | Top Category |
|-------|-------|-------------|
| Jun 2026 | $X,XXX | Food ($XXX) |
| May 2026 | $X,XXX | Shopping ($XXX) |
| Apr 2026 | $X,XXX | Subscriptions ($XXX) |

Trend: [up/down/flat] vs prior month
```

If fewer than 3 months of data exist, show what is available.
If no data exists: post `💰 No expense data found. Use /expenses import <csv-path> to load a bank statement.`

Use the `messaging` tool to post to `DISCORD_RESEARCH_CHANNEL_ID` (#research).

---

## Error Handling

| Failure | Action |
|---------|--------|
| CSV file not found | Post usage hint to #research and stop |
| CSV parse error | Post error to #research with format guidance and stop |
| Ollama unavailable | Categorize all as "Other", note in summary |
| Brain file write fails | Note in summary; GBrain ingest skipped |
| GBrain ingest fails | Note in summary; brain file still written |
| Discord post fails | Log to ~/.hermes/logs/skill-errors.log |
| Summary mode: no data | Post "no data" message with import instructions |

---

## Security Note

This skill reads CSV files from the local filesystem only. It never:
- Connects to any bank API or financial institution
- Stores raw account numbers, card numbers, or credentials
- Sends financial data to any external service

All categorization is done locally via phi4-mini (Ollama). GBrain stores only category
summaries and totals — not individual transaction details in full.

---

## Done Condition

**Import mode:** Skill is complete when:
1. CSV parsed and transactions categorized
2. Summary saved to `~/brain/finance/expenses-[MONTH].md`
3. GBrain ingest triggered
4. Summary posted to #research

**Summary mode:** Skill is complete when:
1. Last 3 months of data fetched from GBrain + brain files
2. Comparison posted to #research
