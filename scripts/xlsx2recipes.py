# Convert TeaZenTea recipe chart xlsx -> lib/recipes.json
# Run: python scripts/xlsx2recipes.py [path/to/chart.xlsx]
# Regenerate when a new monthly chart lands in public/.

import json
import sys
from pathlib import Path

import openpyxl

# Excel Item name -> menu drink_name (must match lib/teazentea-modifiers.json).
# Items not listed and not already a menu name stay keyed as-is (unreachable -> no recipe shown).
ALIAS = {
    "Avocado": "Avocado Smoothie",
    "Banana": "Banana Smoothie",
    "Chocolate": "Chocolate Smoothie",
    "Chocolate Strawberry": "Chocolate Strawberry Smoothie",
    "Coffee": "Coffee Smoothie",
    "Dragon Fruit": "Dragon Fruit Smoothie",
    "Honeydew": "Honeydew Smoothie",
    "Mango": "Mango Smoothie",
    "Matcha": "Matcha Smoothie",
    "Mocha": "Mocha Frappe Smoothie",
    "Okinawa Smoothie": "Okinawa Brown Sugar Smoothie",
    "Sunset Biscoff Smoothie": "Sun-Kissed Biscoff Smoothie",
}

# Known source-chart typos (Excel/md both carry them). Applied at convert time
# so regenerating from a new monthly chart keeps the fix.
# (drink_key, sweet_level, ingredient_label) -> corrected value
VALUE_FIXES = {
    ("Chocolate Strawberry Smoothie", "None Sweet", "Fruit"): "75g",
    ("Strawberry Banana Smoothie", "100% Sweet", "Ice"): "290g",
    ("Strawberry Banana Smoothie", "50% Sweet", "Ice"): "290g",
    ("Strawberry Banana Smoothie", "None Sweet", "Ice"): "290g",
}
INGREDIENT_LABELS = [
    "Liquid Creamer",
    "Heavy Cream",
    "Flavor/Syrup/Powder",
    "Cane Sugar",
    "Fruit",
    "Ice",
]


def cell(v):
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else next(
        Path("public").glob("*.xlsx")
    )
    out = Path("lib/recipes.json")

    wb = openpyxl.load_workbook(src, data_only=True)
    recipes = {}
    skipped = []

    for ws in wb.worksheets:
        rows = list(ws.iter_rows(values_only=True))
        note = cell(rows[0][1]) if rows else None  # sheet-level note, e.g. stabilizer rule
        # header = Item | Sweet Level | <ingredients...> | Instructions
        current_item = None
        current_key = None
        current_instr = None

        # ponytail: assumes row0 = sheet note, row1 = header. New chart layout? adjust start index.
        for row in rows[2:]:
            item = cell(row[0])
            if item and item != current_item:  # item repeats on every row of its group
                current_item = item
                current_key = ALIAS.get(item, item)
                current_instr = None
                recipes.setdefault(current_key, {"note": note, "rows": {}})

            sweet = cell(row[1]) if len(row) > 1 else None
            if not current_item or not sweet:
                continue  # blank ingredient row under same item

            instr = cell(row[8]) if len(row) > 8 else None
            if instr:
                current_instr = instr  # forward-fill: only first row per item carries it

            ingredients = []
            for i, label in enumerate(INGREDIENT_LABELS, start=2):
                val = cell(row[i]) if len(row) > i else None
                if val:
                    fix = VALUE_FIXES.get((current_key, sweet, label))
                    if fix:
                        val = fix
                    ingredients.append({"label": label, "value": val})

            recipes[current_key]["rows"][sweet] = {
                "ingredients": ingredients,
                "instructions": current_instr or "",
            }

    # menu cross-check: which keys can a scanned label actually hit?
    menu = json.loads(Path("lib/teazentea-modifiers.json").read_text(encoding="utf-8"))[
        "all_drink_names"
    ]
    menu_set = set(menu)
    for key in recipes:
        if key not in menu_set:
            skipped.append(key)

    assert recipes, "no recipes parsed"
    for key, entry in recipes.items():
        assert entry["rows"], f"{key}: no sweet-level rows"
        assert any(r["instructions"] for r in entry["rows"].values()), f"{key}: no instructions"

    out.write_text(json.dumps(recipes, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {out} ({len(recipes)} drinks)")
    if skipped:
        print("not on menu (never matched by scan):", ", ".join(skipped))


if __name__ == "__main__":
    main()
