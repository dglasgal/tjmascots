#!/usr/bin/env python3
"""Move Marty the Monkey from store 119 (LA Palms) to store 184 (Chatsworth)
and append an entry to events.json so /recent shows the move."""

import json
from datetime import date

MASCOTS = 'src/data/mascots.json'
STORES = 'src/data/tj-stores.json'
EVENTS = 'src/data/events.json'

# Look up store 184 so we use the canonical city/state from the stores file.
with open(STORES) as f:
    stores = {s['store_number']: s for s in json.load(f)}
target = stores.get('184')
if not target:
    raise SystemExit('Store 184 not in tj-stores.json — cannot proceed.')

# Find Marty and move him.
with open(MASCOTS) as f:
    data = json.load(f)

marty = None
for m in data['mascots']:
    if (m.get('name') or '').lower() == 'marty':
        marty = m
        break

if not marty:
    raise SystemExit('No Marty found in mascots.json.')

old_store_number = marty.get('store_number')
old_store = marty.get('store')
print(f"Before: id={marty['id']}  store_number={old_store_number}  store={old_store!r}")

marty['store_number'] = '184'
marty['store'] = target['city']     # "Chatsworth"
marty['state'] = target['state']    # "CA"

with open(MASCOTS, 'w') as f:
    json.dump(data, f, indent=2)
    f.write('\n')

print(f"After:  id={marty['id']}  store_number={marty['store_number']}  store={marty['store']!r}")

# Append a "notes" event to events.json so the /recent feed reflects the move.
with open(EVENTS) as f:
    events_data = json.load(f)

today = date.today().isoformat()
events_data['events'].insert(0, {
    'date': today,
    'kind': 'notes',
    'mascot_id': marty['id'],
    'store_number': '184',
    'summary': f"Marty the monkey moved from #{old_store_number} {old_store} → #184 {target['city']}",
    'reason': 'Correcting the store assignment for Marty — the original submission landed under the wrong store number.',
})

with open(EVENTS, 'w') as f:
    json.dump(events_data, f, indent=2)
    f.write('\n')

print('Logged the move in events.json.')
