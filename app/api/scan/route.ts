import { NextResponse } from 'next/server'
import { validateAndCorrectLabel, type ExtractedLabel } from '@/lib/validateLabel'

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing GROQ_API_KEY in .env.local' }, { status: 500 })
  }

  const { dataUrl } = await request.json()

  if (!dataUrl) {
    return NextResponse.json({ error: 'Missing dataUrl' }, { status: 400 })
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'qwen/qwen3.8-27b',
      messages: [
        {
          role: 'system',
          content: `You are a data-extraction assistant for TeaZenTea boba tea order labels. You will be given a photo of a printed order label. Extract structured data following these rules:

LABEL STRUCTURE:
- Line 1: order identifier (e.g. "SP #190 Delivery" or "Kiosk #176 Pickup"), often followed by a page indicator like "1/2".
- Line 2: customer name.
- Line 3 (bold, may wrap to 2 lines): the drink/item name.
- Remaining lines: modifiers, comma-separated, possibly across multiple lines.

CRITICAL — DO NOT CONFUSE PAGE INDICATOR WITH MODIFIER QUANTITY:
- The page indicator (format "N/M", e.g. "1/2", "2/2") appears ONLY on the first line, next to or below the order identifier (e.g. "Kiosk #176 Pickup ... 2/2"). It means "this is label N of M total labels for this order" — it is NEVER part of any modifier and must NEVER be attached to a topping/modifier as a quantity.
- A modifier quantity ONLY exists when the label explicitly shows a number directly attached to a modifier word using the pattern "Nx <modifier>" (e.g. "2x Boba") appearing in the modifier section (after the drink name), not in the header section.
- If you do not see "Nx" written immediately before a modifier word IN THE MODIFIER LINES, assume quantity = 1. Do not infer quantity from any number elsewhere on the label.
- Treat the header block (order id, page indicator, customer name) and the body block (drink name + modifiers) as fully separate — numbers from the header must never populate any field under "modifiers".

KNOWN MODIFIER CATEGORIES AND VALID VALUES (ground truth — use this to classify, not general knowledge):
- Topping: Boba, Double Boba, Light Boba, Crystal Boba, Jelly - Coffee, Jelly - Lychee, Jelly - Mango Star, Jelly - Sakura Pink Heart, Popping Lychee, Popping Mango, Popping Strawberry, Creme Brulee, Herbal/Grass, Pudding, Foam - Egg Foam, Foam - Matcha, Foam - Sea Salt Cheese Crema, Foam - Tiramisu, Foam - Ube Taro, Extra Shot of Coffee, Extra Shot of Matcha
- Sweetness: Regular Sugar, 75% Sweet, 50% Sweet, 25% Sweet, None Sweet, Extra Sweet, 100% Sweet
- Ice: Regular Ice, Less Ice, Extra Ice, None Ice
- Tea Flavor (only for Green Tea/Black Tea/Milk base items): Classic/No Flavor, Chocolate, Coconut, Coffee, Dragon Fruit, Honeydew, Honey, Honey Lemon, Lychee, Mango, Matcha, Mocha, Passion Fruit, Peach, Pineapple, Rose, Strawberry, Taro, Watermelon

IMPORTANT: there is no separate "Milk Base" or "Tea Base" modifier — that information is already part of the drink_name itself (e.g. "Black Milk Tea", "Green Tea"). Do not invent a milk_base or tea_base field.

A term never appears in more than one category above — if you read something that isn't an exact or near-exact match to one of these lists, correct it to the closest valid value.

OUTPUT FORMAT — return ONLY valid JSON, no markdown fences, no commentary:

{
  "order_id": string | null,
  "page": string | null,
  "customer_name": string | null,
  "drink_name": string,
  "modifiers": {
    "topping": [{"name": string, "quantity": number}],
    "sweet": string | null,
    "ice": string | null,
    "tea_flavor": string | null
  },
  "unrecognized_text": [string]
}

Missing category → null (or [] for topping).`,
        },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            { type: 'text', text: 'Extract this order label. Return ONLY valid JSON.' },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 2048,
    }),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    let errBody
    try { errBody = JSON.parse(errText) } catch { errBody = { error: errText || `API error ${response.status}` } }
    return NextResponse.json(errBody, { status: response.status })
  }

  const data = await response.json()
  const raw = data.choices?.[0]?.message?.content
  if (!raw) {
    return NextResponse.json({ error: 'No content in API response' }, { status: 502 })
  }

  try {
    // strip markdown fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(cleaned)

    // validate + fuzzy-correct against real menu data
    const { label, corrections, warnings } = validateAndCorrectLabel(parsed as ExtractedLabel)

    return NextResponse.json({
      ...label,
      _validation: { corrections, warnings },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response', raw }, { status: 502 })
  }
}
