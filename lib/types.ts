export interface Modifiers {
  topping: { name: string; quantity: number }[]
  sweet: string | null
  ice: string | null
  tea_base: string | null
  milk_base: string | null
}

export interface OrderLabel {
  order_id: string | null
  page: string | null
  customer_name: string | null
  drink_name: string
  modifiers: Modifiers
  unrecognized_text: string[]
  confidence: 'high' | 'medium' | 'low'
  notes: string | null
}
