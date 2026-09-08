import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing NVIDIA_API_KEY in .env.local' }, { status: 500 })
  }

  const { dataUrl } = await request.json()

  if (!dataUrl) {
    return NextResponse.json({ error: 'Missing dataUrl' }, { status: 400 })
  }

  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'meta/llama-3.2-11b-vision-instruct',
      messages: [
        {
          role: 'system',
          content: `You are a data-extraction assistant for boba tea order labels. You will be given a photo of a printed order label. Extract structured data following these rules:

LABEL STRUCTURE:
- Line 1: order identifier (e.g. "SP #190 Delivery" or "Kiosk #176 Pickup"), often followed by a page indicator like "1/2".
- Line 2: customer name.
- Line 3 (bold, may wrap to 2 lines): the drink/item name.
- Remaining lines: modifiers, comma-separated, possibly across multiple lines.

MODIFIER RULES:
- Each modifier string belongs to exactly ONE category: Topping, Sweet, Ice, Tea Base, Milk Base (there may be others not listed here — classify by meaning, not just this list).
- The SAME modifier text never appears in more than one category (e.g. "Boba" is always Topping, never Sweet).
- A modifier may have a quantity prefix like "2x Boba" — extract the base name and quantity separately.
- Order of modifiers on the label reflects customer selection order, NOT category order. Do not assume position implies category.
- If text looks like a print/scan artifact (blur, dropped letter, doubled letter — e.g. "Nutel a" for "Nutella"), correct it to the most likely intended word using common boba tea terminology, and record the correction in "notes".
- Never invent a modifier that isn't visibly present or a clear correction of visible text.

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
    "tea_base": string | null,
    "milk_base": string | null
  },
  "unrecognized_text": [string],
  "confidence": "high" | "medium" | "low",
  "notes": string | null
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
    return NextResponse.json(await response.json(), { status: response.status })
  }

  const data = await response.json()
  const raw = data.choices?.[0]?.message?.content
  if (!raw) {
    return NextResponse.json({ error: 'No content in API response' }, { status: 502 })
  }

  try {
    // strip markdown fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const label = JSON.parse(cleaned)
    return NextResponse.json(label)
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response', raw }, { status: 502 })
  }
}
