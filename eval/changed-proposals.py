"""Print JSON Lines for changed proposal sets on the audited sample.

python3 eval/changed-proposals.py baseline.jsonl current.jsonl prior-grades.tsv
The grade table from the baseline commit identifies the sample and old judgment.
"""
import argparse
import csv
import json
from pathlib import Path


def predictions(path):
    rows = {}
    with path.open() as source:
        for item in map(json.loads, source):
            key = (item['source'], item['row'])
            if key in rows:
                raise ValueError(f'Duplicate dataset row {key}')
            rows[key] = item
    return rows


def proposals(row):
    prediction = row['prediction']
    return {item['sop'].replace('\r\n', '\n').strip()
            for item in [prediction, *prediction.get('alternatives', [])]
            if item.get('sop', '').strip()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('baseline', 'current', 'grades'):
        parser.add_argument(name, type=Path)
    args = parser.parse_args()
    before, after = predictions(args.baseline), predictions(args.current)
    with args.grades.open(newline='') as table:
        for grade in csv.DictReader(table, delimiter='\t'):
            key = (grade['source'], int(grade['row']))
            old, new = before[key], after[key]
            if old['text'] != new['text'] or old['sop'] != new['sop']:
                raise ValueError(f'Changed utterance or annotation at {key}')
            original, current = proposals(old), proposals(new)
            if original != current:
                print(json.dumps(dict(grade, text=new['text'], reference=new['sop'],
                                      retained=sorted(original & current),
                                      added=sorted(current - original),
                                      removed=sorted(original - current)), ensure_ascii=False))


if __name__ == '__main__':
    main()
