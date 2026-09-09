// lib/validateLabel.ts
//
// Validates and auto-corrects the structured JSON returned by the vision
// model against the real TeaZenTea menu data (drink names + modifier
// options), pulled from the Snackpass API. This catches:
//   - OCR/print errors (e.g. "Nutel a" -> "Nutella")
//   - miscategorized modifiers (e.g. model puts "Crystal Boba" under tea_flavor)
//   - the model hallucinating a value that isn't a real menu option
//
// Put teazentea-modifiers.json next to this file (or adjust the import path)
// and call validateAndCorrectLabel(rawModelOutput) after you JSON.parse the
// model's response, before you trust/store it.

import modifierData from './teazentea-modifiers.json';

// ---------- Types ----------

export interface ToppingItem {
  name: string;
  quantity: number;
}

export interface ExtractedLabel {
  order_id: string | null;
  page: string | null;
  customer_name: string | null;
  drink_name: string;
  modifiers: {
    topping: ToppingItem[];
    sweet: string | null;
    ice: string | null;
    tea_flavor: string | null;
  };
  unrecognized_text: string[];
  confidence: 'high' | 'medium' | 'low';
  notes: string | null;
}

export interface ValidationResult {
  label: ExtractedLabel; // corrected copy — the input is never mutated
  corrections: string[]; // human-readable log of every auto-fix applied
  warnings: string[]; // things that could not be confidently matched
}

// ---------- Ground-truth dictionary (loaded from crawled menu data) ----------

const CATEGORIES = modifierData.modifier_categories as Record<string, string[]>;
const ALL_DRINK_NAMES = modifierData.all_drink_names as string[];
const DRINK_TO_CATEGORIES = modifierData.drink_name_to_categories as Record<string, string[]>;

const TOPPING_OPTIONS = CATEGORIES['Topping'] ?? [];
const SWEETNESS_OPTIONS = CATEGORIES['Sweetness'] ?? [];
const ICE_OPTIONS = CATEGORIES['Ice'] ?? [];
const TEA_FLAVOR_OPTIONS = CATEGORIES['Tea Flavor'] ?? [];

// Minimum similarity (0-1) to accept a fuzzy match. Below this, we leave the
// value as-is and raise a warning instead of guessing.
const FUZZY_THRESHOLD = 0.72;

// ---------- Fuzzy matching (Levenshtein-based) ----------

function levenshtein(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  const prev = new Array(bl + 1);
  const curr = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;

  for (let i = 1; i <= al; i++) {
    curr[0] = i;
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost // substitution
      );
    }
    for (let j = 0; j <= bl; j++) prev[j] = curr[j];
  }
  return prev[bl];
}

function similarity(a: string, b: string): number {
  const an = a.trim().toLowerCase();
  const bn = b.trim().toLowerCase();
  if (an === bn) return 1;
  const maxLen = Math.max(an.length, bn.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(an, bn) / maxLen;
}

interface MatchResult {
  match: string;
  score: number;
}

/** Finds the closest candidate to `value`. Returns null if nothing clears FUZZY_THRESHOLD. */
function findBestMatch(value: string, candidates: string[]): MatchResult | null {
  let best: MatchResult | null = null;
  for (const candidate of candidates) {
    const score = similarity(value, candidate);
    if (!best || score > best.score) {
      best = { match: candidate, score };
    }
  }
  if (best && best.score >= FUZZY_THRESHOLD) return best;
  return null;
}

// ---------- Field-level validators ----------

function validateField(
  value: string | null,
  candidates: string[],
  fieldLabel: string,
  corrections: string[],
  warnings: string[]
): string | null {
  if (value === null || value.trim() === '') return null;

  const exact = candidates.find((c) => c.toLowerCase() === value.trim().toLowerCase());
  if (exact) return exact;

  const best = findBestMatch(value, candidates);
  if (best) {
    if (best.match.toLowerCase() !== value.trim().toLowerCase()) {
      corrections.push(
        `${fieldLabel}: "${value}" -> "${best.match}" (similarity ${best.score.toFixed(2)})`
      );
    }
    return best.match;
  }

  warnings.push(`${fieldLabel}: "${value}" did not match any known option (left as-is)`);
  return value;
}

function validateToppings(
  toppings: ToppingItem[],
  corrections: string[],
  warnings: string[]
): ToppingItem[] {
  return toppings.map((t) => {
    const corrected = validateField(t.name, TOPPING_OPTIONS, 'topping', corrections, warnings);
    return { name: corrected ?? t.name, quantity: t.quantity };
  });
}

function validateDrinkName(
  name: string,
  corrections: string[],
  warnings: string[]
): string {
  const exact = ALL_DRINK_NAMES.find((n) => n.toLowerCase() === name.trim().toLowerCase());
  if (exact) return exact;

  const best = findBestMatch(name, ALL_DRINK_NAMES);
  if (best) {
    if (best.match.toLowerCase() !== name.trim().toLowerCase()) {
      corrections.push(`drink_name: "${name}" -> "${best.match}" (similarity ${best.score.toFixed(2)})`);
    }
    return best.match;
  }

  warnings.push(`drink_name: "${name}" did not match any known menu item (left as-is)`);
  return name;
}

// ---------- Main entry point ----------

export function validateAndCorrectLabel(raw: ExtractedLabel): ValidationResult {
  const corrections: string[] = [];
  const warnings: string[] = [];

  const drink_name = validateDrinkName(raw.drink_name, corrections, warnings);

  const topping = validateToppings(raw.modifiers.topping ?? [], corrections, warnings);
  const sweet = validateField(raw.modifiers.sweet, SWEETNESS_OPTIONS, 'sweet', corrections, warnings);
  const ice = validateField(raw.modifiers.ice, ICE_OPTIONS, 'ice', corrections, warnings);
  const tea_flavor = validateField(
    raw.modifiers.tea_flavor,
    TEA_FLAVOR_OPTIONS,
    'tea_flavor',
    corrections,
    warnings
  );

  // Cross-check: flag (don't delete) a field the resolved drink shouldn't have.
  // e.g. tea_flavor filled in for a drink that has no "Tea Flavor" addon group.
  const expectedCategories = DRINK_TO_CATEGORIES[drink_name] ?? [];
  if (tea_flavor && !expectedCategories.includes('Tea Flavor')) {
    warnings.push(
      `tea_flavor "${tea_flavor}" was extracted but "${drink_name}" has no Tea Flavor option on the menu — double-check this label`
    );
  }
  if (sweet && !expectedCategories.includes('Sweetness')) {
    warnings.push(
      `sweet "${sweet}" was extracted but "${drink_name}" has no Sweetness option on the menu — double-check this label`
    );
  }
  if (ice && !expectedCategories.includes('Ice')) {
    warnings.push(
      `ice "${ice}" was extracted but "${drink_name}" has no Ice option on the menu — double-check this label`
    );
  }

  const label: ExtractedLabel = {
    ...raw,
    drink_name,
    modifiers: { topping, sweet, ice, tea_flavor },
  };

  return { label, corrections, warnings };
}
