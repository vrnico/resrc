#!/usr/bin/env python3
"""Run GA resource discovery for batches 1-8."""

import json
import subprocess
import sys
import os
import re

BATCHES_FILE = "scripts/discovery/data/ga-batches.json"
OUTPUT_DIR = "scripts/discovery/data/output/GA"

os.makedirs(OUTPUT_DIR, exist_ok=True)

with open(BATCHES_FILE) as f:
    all_batches = json.load(f)

START_BATCH = int(sys.argv[1]) if len(sys.argv) > 1 else 1
END_BATCH = int(sys.argv[2]) if len(sys.argv) > 2 else 8

for batch_num in range(START_BATCH, END_BATCH + 1):
    batch_idx = batch_num - 1
    batch = all_batches[batch_idx]
    zips = " ".join(item["zip"] for item in batch)

    prompt = f"""Search the web for local community resources (food pantries, food banks, emergency shelters, housing assistance, and other social services) serving these GA zip codes: {zips}.

For each zip code, search for 'food pantry [zip]', 'food bank [zip]', 'emergency shelter [zip]', 'housing assistance [zip]'.

For each resource found, record: name, description (1-2 sentences), address, phone, url, categorySlug, and zipCode.

Valid categorySlug values: food | housing | healthcare | transportation | employment | utilities | legal | crisis | community

Skip national chains (Walmart, Costco), government benefit portals (benefits.gov, etc), and out-of-state results. Include local nonprofits, churches, community orgs, rescue missions.

Respond with ONLY a valid JSON array — no markdown, no explanation, no code fences. Example format:
[{{"name":"...","description":"...","address":"...","phone":"...","url":"https://...","categorySlug":"food","zipCode":"NNNNN"}}]

If no resources are found, respond with an empty array: []"""

    print(f"\n=== Batch {batch_num} ({len(batch)} zips: {zips}) ===", flush=True)

    try:
        result = subprocess.run(
            ["gemini", "-m", "gemini-2.5-flash", "--approval-mode", "yolo"],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=180
        )
        raw = result.stdout.strip()
    except subprocess.TimeoutExpired:
        print(f"  TIMEOUT for batch {batch_num}, saving empty array", flush=True)
        raw = "[]"
    except Exception as e:
        print(f"  ERROR for batch {batch_num}: {e}, saving empty array", flush=True)
        raw = "[]"

    # Extract JSON array from response
    # Try to find JSON array in the response
    json_data = []
    if raw:
        # Strip markdown code fences if present
        cleaned = re.sub(r'^```(?:json)?\s*', '', raw, flags=re.MULTILINE)
        cleaned = re.sub(r'```\s*$', '', cleaned, flags=re.MULTILINE).strip()

        # Find the first [ and last ] to extract the array
        start = cleaned.find('[')
        end = cleaned.rfind(']')
        if start != -1 and end != -1 and end > start:
            array_str = cleaned[start:end+1]
            try:
                json_data = json.loads(array_str)
            except json.JSONDecodeError as e:
                print(f"  JSON parse error: {e}", flush=True)
                print(f"  Raw (first 200 chars): {raw[:200]}", flush=True)
                json_data = []

    output_path = os.path.join(OUTPUT_DIR, f"batch-{batch_num:03d}.json")
    with open(output_path, "w") as f:
        json.dump(json_data, f, indent=2)

    print(f"  Found {len(json_data)} resources -> {output_path}", flush=True)

print("\nAll batches complete.", flush=True)
