'use client'

import { useState, useRef, useEffect } from 'react'
import { Camera, Eye, EyeOff } from 'lucide-react'
import { RateLimitError, scanLabel } from '@/lib/api'
import type { OrderLabel } from '@/lib/types'
import { loadHistory, saveToHistory, clearHistory, exportCSV, exportPDF } from '@/lib/export'

type State =
  | { step: 'idle' }
  | { step: 'loading'; dataUrl: string }
  | { step: 'result'; dataUrl: string; result: OrderLabel }
  | { step: 'error'; dataUrl: string | null; error: string; rateLimited: boolean; retryAfterSeconds: number | null }

const EASE = 'ease-[cubic-bezier(0.16,1,0.3,1)]'
const CARD = 'w-full max-w-[400px]'
const BTN = `inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl text-[17px] font-semibold transition-transform duration-300 ${EASE} active:scale-[0.98]`

export default function App() {
  const [state, setState] = useState<State>({ step: 'idle' })
  const [history, setHistory] = useState<OrderLabel[]>([])
  const [mounted, setMounted] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)

  useEffect(() => {
    setHistory(loadHistory())
    setMounted(true)
  }, [])

  useEffect(() => {
    if (countdown === null) return
    if (countdown <= 0) {
      setCountdown(null)
      return
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const [showHistory, setShowHistory] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function runScan(dataUrl: string) {
    setState({ step: 'loading', dataUrl })
    scanLabel(dataUrl).then((result) => {
      setCountdown(null)
      const updated = saveToHistory(result)
      setHistory(updated)
      setState({ step: 'result', dataUrl, result })
    }).catch((err) => {
      if (err instanceof RateLimitError) {
        setCountdown(err.retryAfterSeconds)
        setState({
          step: 'error',
          dataUrl,
          error: 'Too many requests — the AI service is rate limited.',
          rateLimited: true,
          retryAfterSeconds: err.retryAfterSeconds,
        })
      } else {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        setState({ step: 'error', dataUrl, error: msg, rateLimited: false, retryAfterSeconds: null })
      }
    })
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    compressImage(file, 1024, 0.7).then(runScan)
  }

  function handleReset() {
    setState({ step: 'idle' })
    setCountdown(null)
    if (inputRef.current) {
      inputRef.current.value = ''
      // Trigger the camera input to open
      inputRef.current.click()
    }
  }

  function handleClearHistory() {
    clearHistory()
    setHistory([])
  }

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col items-center gap-4 px-4 pt-7 pb-[calc(28px+env(safe-area-inset-bottom))]">
      <div className="flex w-full max-w-[400px] items-center gap-3 text-left">
        <img src="/icon.png" alt="TeaZenTea" className="size-11 flex-none rounded-full object-cover shadow-[0_8px_20px_-8px_rgba(8,6,13,0.4)]" />
        <div>
          <h1 className="text-2xl leading-tight font-semibold tracking-tight text-(--text-h)">AI Scan</h1>
          <p className="mt-0.5 text-sm text-(--text)">Scan a boba tea order label</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        id="camera"
      />
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        id="upload"
      />

      {state.step === 'idle' && (
        <div className={`mt-3 flex ${CARD} gap-3`}>
          <label htmlFor="camera" className={`${BTN} cursor-pointer bg-(--accent-soft) text-(--accent-ink)`}>
            <Camera size={24} />
            Scan
          </label>
        </div>
      )}

      {state.step === 'loading' && (
        <div className={`flex ${CARD} flex-col items-center gap-4`}>
          <img src={state.dataUrl} alt="Captured label" className="aspect-[4/3] w-full rounded-[20px] border border-(--border) object-cover" />
          <div className="flex w-full flex-col gap-2.5" aria-hidden="true">
            <div className="skel h-[26px] w-[70%]" />
            <div className="skel h-[14px]" />
            <div className="skel h-[14px] w-[45%]" />
          </div>
          <p className="text-base text-(--text)">Scanning...</p>
        </div>
      )}

      {state.step === 'result' && (
        <div className={`flex ${CARD} flex-col items-center gap-4`}>
          <div className="w-full">
            <img src={state.dataUrl} alt="Captured label" className="aspect-[4/3] w-full rounded-[20px] border border-(--border) object-cover" />
          </div>
          <ResultCard result={state.result} />
          <button className={`${BTN} w-full cursor-pointer bg-(--accent-soft) text-(--accent-ink)`} onClick={handleReset}>Scan Another</button>
        </div>
      )}

      {state.step === 'error' && (
        <div className={`flex ${CARD} flex-col items-center gap-3`}>
          {state.dataUrl && <img src={state.dataUrl} alt="Captured label" className="aspect-[4/3] w-full rounded-[20px] border border-(--border) object-cover opacity-60" />}
          <p className="text-center text-[15px] text-red-600">{state.error}</p>
          {state.rateLimited && countdown !== null && (
            <div className="flex flex-col items-center gap-2.5">
              <div className="relative size-16">
                <svg width="64" height="64" viewBox="0 0 64 64" className="block">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="var(--border)" strokeWidth="4" />
                  <circle
                    cx="32" cy="32" r="28" fill="none"
                    stroke="var(--accent)" strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 28}
                    strokeDashoffset={state.retryAfterSeconds ? 2 * Math.PI * 28 * (1 - countdown / state.retryAfterSeconds) : 0}
                    transform="rotate(-90 32 32)"
                    style={{ transition: 'stroke-dashoffset 1s linear' }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center font-(--mono) text-base font-bold text-(--text-h)">{countdown}s</span>
              </div>
              <p className="text-center text-sm text-(--text)">Rate limited — you can retry in {countdown}s</p>
            </div>
          )}
          {state.rateLimited && state.retryAfterSeconds !== null && countdown === null && (
            <p className="text-center text-sm font-semibold text-green-600">You can retry now.</p>
          )}
          <div className={`mt-3 flex ${CARD} gap-3`}>
            {state.dataUrl && (
              <button
                className={`${BTN} cursor-pointer bg-(--accent-soft) text-(--accent-ink) disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-none`}
                disabled={countdown !== null && countdown > 0}
                onClick={() => runScan(state.dataUrl!)}
              >
                {countdown !== null && countdown > 0 ? `Retry in ${countdown}s` : 'Retry'}
              </button>
            )}
            <button className={`${BTN} cursor-pointer border-[1.5px] border-(--border) bg-transparent text-(--text-h)`} onClick={handleReset}>Start Over</button>
          </div>
        </div>
      )}

      {mounted && history.length > 0 && (
        <div className="mt-6 w-full max-w-[500px] border-t border-(--border) pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button className="cursor-pointer bg-transparent py-1 text-base font-semibold text-(--text-h)" onClick={() => setShowHistory(!showHistory)}>
              {showHistory ? '▼' : '▶'} History ({history.length})
            </button>
            <div className="flex gap-1.5">
              <button className="min-h-10 cursor-pointer rounded-[10px] border border-(--border) bg-(--bg) px-3 py-1.5 text-[13px] font-semibold text-(--text-h) transition active:scale-[0.97]" onClick={() => exportCSV(history)}>Excel</button>
              <button className="min-h-10 cursor-pointer rounded-[10px] border border-(--border) bg-(--bg) px-3 py-1.5 text-[13px] font-semibold text-(--text-h) transition active:scale-[0.97]" onClick={() => exportPDF(history)}>PDF</button>
              <button className="min-h-10 cursor-pointer rounded-[10px] border border-red-300 bg-(--bg) px-3 py-1.5 text-[13px] font-semibold text-red-600 transition active:scale-[0.97]" onClick={handleClearHistory}>Clear</button>
            </div>
          </div>

          {showHistory && (
            <div className="mt-3 flex flex-col gap-2">
              {history.map((item, i) => {
                const open = expanded === i
                return (
                  <div
                    key={i}
                    className={`grid cursor-pointer grid-cols-[auto_1fr_auto] items-start gap-3 rounded-[14px] border bg-(--bg) py-3 pr-2.5 pl-3.5 text-sm shadow-[0_10px_24px_-20px_rgba(8,6,13,0.35)] transition-transform duration-300 ${EASE} active:scale-[0.99] ${open ? 'border-(--accent-border)' : 'border-(--border)'}`}
                    onClick={() => setExpanded(open ? null : i)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(open ? null : i) } }}
                  >
                    <span className="mt-px font-(--mono) text-xs font-bold whitespace-nowrap rounded-full border border-(--accent-border) bg-(--accent-bg) px-2 py-[3px] text-(--accent)">#{i + 1}</span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-[15px] font-semibold tracking-tight text-(--text-h)">{item.drink_name}</span>
                      <span className="truncate text-[13px] text-(--text)">
                        {[item.customer_name, item.order_id].filter(Boolean).join(' · ')}
                      </span>
                      {open && (
                        <div className="mt-2.5 flex flex-col gap-2.5 border-t border-(--border) pt-2.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col gap-2">
                            {item.modifiers?.topping?.length > 0 && (
                              <ModRow label="Topping" value={item.modifiers.topping.map(t => t.quantity > 1 ? `${t.quantity}x ${t.name}` : t.name).join(', ')} />
                            )}
                            {item.modifiers?.sweet && <ModRow label="Sweet" value={item.modifiers.sweet} />}
                            {item.modifiers?.ice && <ModRow label="Ice" value={item.modifiers.ice} />}
                            {item.modifiers?.tea_flavor && <ModRow label="Flavor" value={item.modifiers.tea_flavor} />}
                          </div>
                          {item.recipe
                            ? <RecipeCard recipe={item.recipe} />
                            : <p className="mt-4 rounded-xl border border-dashed border-(--accent-border) bg-(--accent-bg) p-3 text-sm text-(--text)">No recipe available for “{item.drink_name}” yet.</p>}
                        </div>
                      )}
                    </div>
                    <button
                      className={`inline-flex size-10 flex-none cursor-pointer items-center justify-center rounded-xl border border-transparent bg-transparent text-(--text) transition active:scale-[0.94] ${open ? 'border-(--accent-border) bg-(--accent-bg) text-(--accent)' : ''}`}
                      aria-label={open ? 'Hide details' : 'Show details'}
                      aria-expanded={open}
                      onClick={(e) => { e.stopPropagation(); setExpanded(open ? null : i) }}
                    >
                      {open ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ResultCard({ result }: { result: OrderLabel }) {
  return (
    <div className="w-full rounded-[20px] border border-(--border) bg-(--code-bg) p-5 text-left shadow-[0_20px_40px_-24px_rgba(8,6,13,0.25)]">
      <div className="mb-2 flex items-center gap-3 text-sm text-(--text)">
        {result.order_id && <span>{result.order_id}</span>}
        {result.page && <span>{result.page}</span>}
      </div>
      {result.customer_name && <p className="mb-1 text-base text-(--text)">{result.customer_name}</p>}
      <h2 className="mb-4 text-[22px] leading-[1.18] font-bold text-(--text-h)">{result.drink_name}</h2>
      <div className="flex flex-col gap-2">
        {result.modifiers?.topping?.length > 0 && (
          <ModRow label="Topping" value={result.modifiers.topping.map(t => t.quantity > 1 ? `${t.quantity}x ${t.name}` : t.name).join(', ')} />
        )}
        {result.modifiers?.sweet && <ModRow label="Sweet" value={result.modifiers.sweet} />}
        {result.modifiers?.ice && <ModRow label="Ice" value={result.modifiers.ice} />}
        {result.modifiers?.tea_flavor && <ModRow label="Flavor" value={result.modifiers.tea_flavor} />}
      </div>
      {result.unrecognized_text?.length > 0 && <p className="mt-2 text-[13px] text-(--text) opacity-70">Unrecognized: {result.unrecognized_text.join(', ')}</p>}
      {result.recipe
        ? <RecipeCard recipe={result.recipe} />
        : <p className="mt-4 rounded-xl border border-dashed border-(--accent-border) bg-(--accent-bg) p-3 text-sm text-(--text)">No recipe available for “{result.drink_name}” yet.</p>}
    </div>
  )
}

function ModRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-[15px]">
      <span className="min-w-[60px] font-semibold text-(--text-h)">{label}</span>
      <span className="text-(--text)">{value}</span>
    </div>
  )
}

function RecipeCard({ recipe }: { recipe: NonNullable<OrderLabel['recipe']> }) {
  if (!recipe) return null
  return (
    <div className="mt-4 border-t border-(--border) pt-4">
      <div className="mb-2 flex items-center gap-2.5">
        <h3 className="text-base font-bold text-(--text-h)">Recipe</h3>
        <span className="rounded-full border border-(--border) px-2 py-0.5 text-xs font-semibold text-(--text)">{recipe.sweet}</span>
      </div>
      {recipe.note && <p className="mb-2.5 text-[13px] text-(--text) italic">{recipe.note}</p>}
      <ul className="m-0 mb-3 flex list-none flex-col gap-1.5 p-0">
        {recipe.ingredients.map((ing, i) => (
          <li key={i} className="flex justify-between gap-3 text-sm">
            <span className="font-medium text-(--text-h)">{ing.label}</span>
            <span className="font-semibold text-(--text-h)">{ing.value}</span>
          </li>
        ))}
      </ul>
      <ol className="recipe-steps">
        {recipe.steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
    </div>
  )
}

function compressImage(file: File, maxDim: number, quality: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.src = URL.createObjectURL(file)
  })
}
