'use client'

import { useState, useRef, useEffect } from 'react'
import { scanLabel } from '@/lib/api'
import type { OrderLabel } from '@/lib/types'
import { loadHistory, saveToHistory, clearHistory, exportCSV, exportPDF } from '@/lib/export'

type State =
  | { step: 'idle' }
  | { step: 'preview'; dataUrl: string }
  | { step: 'loading'; dataUrl: string }
  | { step: 'result'; dataUrl: string; result: OrderLabel }
  | { step: 'error'; dataUrl: string | null; error: string }

export default function App() {
  const [state, setState] = useState<State>({ step: 'idle' })
  const [showRaw, setShowRaw] = useState(false)
  const [history, setHistory] = useState<OrderLabel[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setHistory(loadHistory())
    setMounted(true)
  }, [])
  const [showHistory, setShowHistory] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setState({ step: 'preview', dataUrl: reader.result as string })
    reader.readAsDataURL(file)
  }

  async function handleScan() {
    if (state.step !== 'preview') return
    setState({ step: 'loading', dataUrl: state.dataUrl })
    try {
      const result = await scanLabel(state.dataUrl)
      const updated = saveToHistory(result)
      setHistory(updated)
      setState({ step: 'result', dataUrl: state.dataUrl, result })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setState({ step: 'error', dataUrl: state.dataUrl, error: msg })
    }
  }

  function handleReset() {
    setState({ step: 'idle' })
    setShowRaw(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleClearHistory() {
    clearHistory()
    setHistory([])
  }

  return (
    <div className="app">
      <h1>AI Scan</h1>
      <p className="subtitle">Scan a boba tea order label</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="file-input"
        id="camera"
      />

      {state.step === 'idle' && (
        <label htmlFor="camera" className="scan-btn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          Open Camera
        </label>
      )}

      {state.step === 'preview' && (
        <div className="preview">
          <img src={state.dataUrl} alt="Captured label" />
          <div className="actions">
            <button className="scan-btn" onClick={handleScan}>Extract</button>
            <button className="reset-btn" onClick={handleReset}>Retake</button>
          </div>
        </div>
      )}

      {state.step === 'loading' && (
        <div className="preview">
          <img src={state.dataUrl} alt="Captured label" />
          <div className="spinner" />
          <p className="loading-text">Scanning...</p>
        </div>
      )}

      {state.step === 'result' && (
        <div className="result">
          <div className="result-img">
            <img src={state.dataUrl} alt="Captured label" />
          </div>
          <ResultCard result={state.result} showRaw={showRaw} onToggleRaw={() => setShowRaw(!showRaw)} />
          <button className="scan-btn" onClick={handleReset}>Scan Another</button>
        </div>
      )}

      {state.step === 'error' && (
        <div className="error-state">
          {state.dataUrl && <img src={state.dataUrl} alt="Captured label" className="error-img" />}
          <p className="error-msg">{state.error}</p>
          <div className="actions">
            {state.dataUrl && <button className="scan-btn" onClick={handleScan}>Retry</button>}
            <button className="reset-btn" onClick={handleReset}>Start Over</button>
          </div>
        </div>
      )}

      {mounted && history.length > 0 && (
        <div className="history-section">
          <div className="history-header">
            <button className="history-toggle" onClick={() => setShowHistory(!showHistory)}>
              {showHistory ? '▼' : '▶'} History ({history.length})
            </button>
            <div className="export-btns">
              <button className="export-btn csv" onClick={() => exportCSV(history)}>📊 Excel</button>
              <button className="export-btn pdf" onClick={() => exportPDF(history)}>📄 PDF</button>
              <button className="export-btn clear" onClick={handleClearHistory}>🗑 Clear</button>
            </div>
          </div>

          {showHistory && (
            <div className="history-list">
              {history.map((item, i) => (
                <div key={i} className="history-item">
                  <span className="history-num">#{i + 1}</span>
                  <div className="history-info">
                    <span className="history-drink">{item.drink_name}</span>
                    {item.customer_name && <span className="history-customer">{item.customer_name}</span>}
                    {item.order_id && <span className="history-order">{item.order_id}</span>}
                  </div>
                  <span className={`history-conf history-conf-${item.confidence}`}>{item.confidence}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ResultCard({ result, showRaw, onToggleRaw }: { result: OrderLabel; showRaw: boolean; onToggleRaw: () => void }) {
  const confidenceColor = { high: '#16a34a', medium: '#ca8a04', low: '#dc2626' }[result.confidence]

  return (
    <div className="result-card">
      <div className="result-header">
        <span className="confidence" style={{ color: confidenceColor }}>● {result.confidence}</span>
        {result.order_id && <span className="order-id">{result.order_id}</span>}
        {result.page && <span className="page">{result.page}</span>}
      </div>
      {result.customer_name && <p className="customer">{result.customer_name}</p>}
      <h2 className="drink">{result.drink_name}</h2>
      <div className="modifiers">
        {result.modifiers?.topping?.length > 0 && (
          <ModRow label="Topping" value={result.modifiers.topping.map(t => t.quantity > 1 ? `${t.quantity}x ${t.name}` : t.name).join(', ')} />
        )}
        {result.modifiers?.sweet && <ModRow label="Sweet" value={result.modifiers.sweet} />}
        {result.modifiers?.ice && <ModRow label="Ice" value={result.modifiers.ice} />}
        {result.modifiers?.tea_base && <ModRow label="Tea" value={result.modifiers.tea_base} />}
        {result.modifiers?.milk_base && <ModRow label="Milk" value={result.modifiers.milk_base} />}
      </div>
      {result.notes && <p className="notes">📝 {result.notes}</p>}
      {result.unrecognized_text?.length > 0 && <p className="unrecognized">Unrecognized: {result.unrecognized_text.join(', ')}</p>}
      <button className="raw-toggle" onClick={onToggleRaw}>{showRaw ? 'Hide' : 'Show'} Raw JSON</button>
      {showRaw && <pre className="raw-json">{JSON.stringify(result, null, 2)}</pre>}
    </div>
  )
}

function ModRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mod-row">
      <span className="mod-label">{label}</span>
      <span className="mod-value">{value}</span>
    </div>
  )
}
