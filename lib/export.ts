import { jsPDF } from 'jspdf'
import type { OrderLabel } from './types'

const STORAGE_KEY = 'ai-scan-history'

export function loadHistory(): OrderLabel[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

export function saveToHistory(item: OrderLabel): OrderLabel[] {
  const history = loadHistory()
  history.push(item)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  return history
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY)
}

function flattenRow(item: OrderLabel) {
  const toppings = item.modifiers.topping
    .map(t => t.quantity > 1 ? `${t.quantity}x ${t.name}` : t.name)
    .join(', ')
  return {
    order_id: item.order_id ?? '',
    page: item.page ?? '',
    customer_name: item.customer_name ?? '',
    drink_name: item.drink_name,
    topping: toppings,
    sweet: item.modifiers.sweet ?? '',
    ice: item.modifiers.ice ?? '',
    tea_flavor: item.modifiers.tea_flavor ?? '',
    confidence: item.confidence,
    notes: item.notes ?? '',
  }
}

export function exportCSV(items: OrderLabel[]) {
  const headers = ['Order ID', 'Page', 'Customer', 'Drink', 'Topping', 'Sweet', 'Ice', 'Tea Flavor', 'Confidence', 'Notes']
  const rows = items.map(item => {
    const r = flattenRow(item)
    return [r.order_id, r.page, r.customer_name, r.drink_name, r.topping, r.sweet, r.ice, r.tea_flavor, r.confidence, r.notes]
  })

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  downloadBlob(blob, `scan-results-${Date.now()}.csv`)
}

export function exportPDF(items: OrderLabel[]) {
  const doc = new jsPDF({ orientation: items.length > 5 ? 'landscape' : 'portrait' })

  doc.setFontSize(16)
  doc.text('AI Scan - Order Label Results', 14, 20)

  doc.setFontSize(9)
  doc.text(`Exported: ${new Date().toLocaleString()} | Total: ${items.length} items`, 14, 28)

  let y = 38

  items.forEach((item, i) => {
    if (y > 260) {
      doc.addPage()
      y = 20
    }

    const r = flattenRow(item)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(`${i + 1}. ${r.drink_name || 'Unknown'}`, 14, y)
    y += 6

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const details: string[] = [
      r.order_id ? `Order: ${r.order_id}` : '',
      r.customer_name ? `Customer: ${r.customer_name}` : '',
      r.topping ? `Topping: ${r.topping}` : '',
      r.sweet ? `Sweet: ${r.sweet}` : '',
      r.ice ? `Ice: ${r.ice}` : '',
      r.tea_flavor ? `Flavor: ${r.tea_flavor}` : '',
      `Confidence: ${r.confidence}`,
      r.notes ? `Notes: ${r.notes}` : '',
    ].filter(Boolean)

    details.forEach(d => {
      if (y > 270) { doc.addPage(); y = 20 }
      doc.text(`  ${d}`, 14, y)
      y += 5
    })

    y += 4
  })

  doc.save(`scan-results-${Date.now()}.pdf`)
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
