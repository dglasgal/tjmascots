#!/usr/bin/env python3
"""Swap name/animal fields on the mascot at store 119 (the submitter typed
them in the wrong slots — name should be Molly, animal should be Monkey)."""

import json
import sys

PATH = 'src/data/mascots.json'

with open(PATH) as f:
    data = json.load(f)

fixed_ids = []
for m in data['mascots']:
    if m.get('store_number') == '119' and (m.get('name') or '').lower() == 'monkey':
        # Swap and normalize capitalization
        old_name = m['name']
        old_animal = m['animal']
        m['name'] = old_animal.strip().title()   # → "Molly"
        m['animal'] = old_name.strip().title()   # → "Monkey"
        m['photo'] = m.get('photo')  # leave filename alone — same mascot
        fixed_ids.append((m['id'], m['name'], m['animal']))

if not fixed_ids:
    print('No swap needed — no mascot at #119 with name=Monkey found.')
    sys.exit(0)

with open(PATH, 'w') as f:
    json.dump(data, f, indent=2)
    f.write('\n')

for mid, name, animal in fixed_ids:
    print(f'Fixed mascot {mid}: name → {name!r}, animal → {animal!r}')
