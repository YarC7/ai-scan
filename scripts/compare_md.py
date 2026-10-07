# Compare TEAZENTEA_Smoothie_Recipe_Chart.md against generated lib/recipes.json.
# Run: python scripts/compare_md.py

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from xlsx2recipes import ALIAS

LABELS = ['Liquid Creamer', 'Heavy Cream', 'Flavor/Syrup/Powder', 'Cane Sugar', 'Fruit', 'Ice']


def main():
    recipes = json.loads(Path('lib/recipes.json').read_text(encoding='utf-8'))
    md = Path('TEAZENTEA_Smoothie_Recipe_Chart.md').read_text(encoding='utf-8')

    # excel item name -> recipes.json key (aliased or itself)
    rev = {item: target for item, target in ALIAS.items()}
    for k in recipes:
        rev.setdefault(k, k)

    problems = []
    checked = 0

    for block in re.split(r'^## ', md, flags=re.M)[1:]:
        lines = block.strip().splitlines()
        item = lines[0].strip()
        im = re.search(r'\*\*Instructions:\*\* (.+)', block)
        if not im:
            problems.append(f'{item}: no Instructions line in md')
            continue
        instr = im.group(1).strip()

        key = rev.get(item)
        if key not in recipes:
            problems.append(f'{item}: not in recipes.json')
            continue

        entry = recipes[key]
        json_instr = entry['rows'].get('100% Sweet', {}).get('instructions')
        if json_instr != instr:
            problems.append(f'{item}: instructions differ\n    md   : {instr}\n    json : {json_instr}')

        for line in lines:
            m = re.match(r'^\| (100% Sweet|50% Sweet|None Sweet) \| (.+) \|$', line)
            if not m:
                continue
            sweet, cells = m.group(1), [c.strip() for c in m.group(2).split('|')]
            md_ing = {lab: c for lab, c in zip(LABELS, cells) if c and c != '—'}
            row = entry['rows'].get(sweet)
            if not row:
                problems.append(f'{item}/{sweet}: row missing in json')
                continue
            json_ing = {i['label']: i['value'] for i in row['ingredients']}
            if md_ing != json_ing:
                problems.append(
                    f'{item}/{sweet}: ingredients differ\n'
                    f'    md   : {md_ing}\n    json : {json_ing}'
                )
            checked += 1

    if problems:
        print(f'DIFFS ({len(problems)}):')
        for p in problems:
            print('-', p)
        sys.exit(1)
    print(f'OK: md == recipes.json ({checked} rows checked)')


if __name__ == '__main__':
    main()
