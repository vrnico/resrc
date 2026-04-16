#!/usr/bin/env python3
"""Extract JSON array from Gemini response and save to output file."""
import sys
import json
import re

def extract_json(text):
    text = text.strip()
    # Try direct parse first
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return data
    except Exception:
        pass

    # Try to find a JSON array in the text
    match = re.search(r'\[.*\]', text, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group(0))
            if isinstance(data, list):
                return data
        except Exception:
            pass

    return []

if __name__ == '__main__':
    input_file = sys.argv[1]
    output_file = sys.argv[2]

    with open(input_file, 'r') as f:
        text = f.read()

    data = extract_json(text)

    with open(output_file, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"Saved {len(data)} resources to {output_file}")
