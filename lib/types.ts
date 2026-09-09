export interface ToppingItem {
  name: string
  quantity: number
}

export interface Modifiers {
  topping: ToppingItem[]
  sweet: string | null
  ice: string | null
  tea_flavor: string | null
}

export interface OrderLabel {
  order_id: string | null
  page: string | null
  customer_name: string | null
  drink_name: string
  modifiers: Modifiers
  unrecognized_text: string[]
}
