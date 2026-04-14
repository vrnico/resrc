#!/usr/bin/env bash
# Run Gemini CLI one batch at a time for a given state.
#
# Usage:
#   bash scripts/discovery/run-gemini-batches.sh --state NY
#   bash scripts/discovery/run-gemini-batches.sh --state NY --start 3   # resume from batch 003
#
# Gemini writes search results to stdout as JSON; this script saves them
# to scripts/discovery/data/output/{STATE}/batch-NNN.json

set -euo pipefail

STATE=""
START=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --state) STATE="${2^^}"; shift 2 ;;
    --start) START="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [[ -z "$STATE" ]]; then
  echo "Usage: bash $0 --state NY [--start N]"
  exit 1
fi

BATCHES_FILE="scripts/discovery/data/${STATE,,}-batches.json"
OUTPUT_DIR="scripts/discovery/data/output/$STATE"

if [[ ! -f "$BATCHES_FILE" ]]; then
  echo "Batch file not found: $BATCHES_FILE"
  echo "Run: npx tsx scripts/discovery/prep-batches.ts --state $STATE"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

TOTAL=$(python3 -c "import json; print(len(json.load(open('$BATCHES_FILE'))))")
echo "[$STATE] $TOTAL batches total, starting from batch $START"
echo ""

for (( i=START; i<=TOTAL; i++ )); do
  BATCH_NUM=$(printf "%03d" "$i")
  OUT_FILE="$OUTPUT_DIR/batch-$BATCH_NUM.json"

  # Skip if already has content
  if [[ -f "$OUT_FILE" && -s "$OUT_FILE" ]]; then
    SIZE=$(wc -c < "$OUT_FILE")
    if [[ "$SIZE" -gt 10 ]]; then
      COUNT=$(python3 -c "import json; print(len(json.load(open('$OUT_FILE'))))" 2>/dev/null || echo "?")
      echo "[$BATCH_NUM/$TOTAL] Skipping — already has $COUNT resources"
      continue
    fi
  fi

  # Extract zip codes and county info for this batch
  BATCH_INFO=$(python3 -c "
import json
batches = json.load(open('$BATCHES_FILE'))
b = batches[$((i-1))]
zips = [z['zip'] for z in b]
counties = list(dict.fromkeys(z['county'] for z in b))
print('Zips: ' + ', '.join(zips))
print('Counties: ' + ', '.join(counties))
")

  ZIPS=$(python3 -c "
import json
batches = json.load(open('$BATCHES_FILE'))
b = batches[$((i-1))]
print(' '.join(z['zip'] for z in b))
")

  echo "[$BATCH_NUM/$TOTAL] $BATCH_INFO"

  PROMPT="Search the web for local community resources (food pantries, food banks, emergency shelters, housing assistance, and other social services) serving these $STATE zip codes: $ZIPS.

For each zip code, search for 'food pantry [zip]', 'food bank [zip]', 'emergency shelter [zip]', 'housing assistance [zip]'.

For each resource found, record: name, description (1-2 sentences), address, phone, url, categorySlug, and zipCode.

Valid categorySlug values: food | housing | healthcare | transportation | employment | utilities | legal | crisis | community

Skip national chains (Walmart, Costco), government benefit portals (benefits.gov, etc), and out-of-state results. Include local nonprofits, churches, community orgs, rescue missions.

Respond with ONLY a valid JSON array — no markdown, no explanation, no code fences. Example format:
[{\"name\":\"...\",\"description\":\"...\",\"address\":\"...\",\"phone\":\"...\",\"url\":\"https://...\",\"categorySlug\":\"food\",\"zipCode\":\"NNNNN\"}]

If no resources are found, respond with an empty array: []"

  # Call Gemini and capture output
  RESPONSE=$(echo "$PROMPT" | gemini --approval-mode yolo 2>/dev/null || echo "[]")

  # Extract JSON array from response (strip any surrounding text)
  JSON=$(echo "$RESPONSE" | python3 -c "
import sys, json, re
text = sys.stdin.read()
# Try to find a JSON array in the response
match = re.search(r'\[.*\]', text, re.DOTALL)
if match:
    try:
        parsed = json.loads(match.group())
        print(json.dumps(parsed, indent=2))
    except:
        print('[]')
else:
    print('[]')
")

  COUNT=$(echo "$JSON" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo 0)
  echo "  → $COUNT resources found"
  echo "$JSON" > "$OUT_FILE"

  # Brief pause to avoid rate limiting
  sleep 2
done

echo ""
echo "[$STATE] Done! Run:"
echo "  npx tsx scripts/discovery/upsert-claude-search.ts --state $STATE --dry-run"
