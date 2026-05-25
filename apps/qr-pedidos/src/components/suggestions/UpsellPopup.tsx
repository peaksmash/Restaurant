import { useEffect, useMemo, useRef, useState } from 'react'
import type { SuggestedProduct, UpsellSuggestion } from '@/suggestions'
import { formatEuro } from '@/lib/utils'

interface Props {
  suggestion: UpsellSuggestion
  onAccept: (ruleId: string, productId: string) => void
  onDismiss: (ruleId: string, outcome: 'ignored' | 'rejected') => void
  autoCloseSecs?: number
}

function ProductImage({ product }: { product: SuggestedProduct }) {
  const [failed, setFailed] = useState(false)

  if (product.imageUrl && !failed) {
    return <img className="upsell-img" src={product.imageUrl} alt={product.name} onError={() => setFailed(true)} />
  }

  return <div className="upsell-img upsell-img-placeholder" aria-hidden="true" />
}

export function UpsellPopup({ suggestion, onAccept, onDismiss, autoCloseSecs = 6 }: Props) {
  const durationMs = Math.max(autoCloseSecs, 1) * 1000
  const dismissedRef = useRef(false)
  const startTimeRef = useRef(Date.now())
  const [progressPercent, setProgressPercent] = useState(100)

  useEffect(() => {
    dismissedRef.current = false
    startTimeRef.current = Date.now()
    setProgressPercent(100)

    const intervalId = window.setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      const nextPercent = Math.max(0, 100 - (elapsed / durationMs) * 100)
      setProgressPercent(nextPercent)

      if (elapsed >= durationMs && !dismissedRef.current) {
        dismissedRef.current = true
        window.clearInterval(intervalId)
        onDismiss(suggestion.ruleId, 'ignored')
      }
    }, 100)

    return () => window.clearInterval(intervalId)
  }, [durationMs, onDismiss, suggestion.ruleId])

  const priceLabel = useMemo(() => {
    if (typeof suggestion.priceDiff === 'number') {
      return `Solo ${formatEuro(suggestion.priceDiff)} mas`
    }
    return formatEuro(suggestion.product.price)
  }, [suggestion.priceDiff, suggestion.product.price])

  function handleDismiss(outcome: 'ignored' | 'rejected') {
    dismissedRef.current = true
    onDismiss(suggestion.ruleId, outcome)
  }

  return (
    <div className="upsell-backdrop" onClick={() => handleDismiss('ignored')} aria-hidden="true">
      <div className="upsell-popup" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <p className="upsell-kicker">¿Lo acompanas con esto?</p>
        <ProductImage product={suggestion.product} />
        <h2 className="upsell-name">{suggestion.product.name}</h2>
        <p className={suggestion.priceDiff != null ? 'upsell-price' : 'upsell-price-normal'}>{priceLabel}</p>
        <button className="upsell-btn-accept" onClick={() => onAccept(suggestion.ruleId, suggestion.product.id)}>
          Si, anadir
        </button>
        <button className="upsell-btn-dismiss" onClick={() => handleDismiss('rejected')}>
          No gracias
        </button>
        <div className="upsell-progress-bar" aria-hidden="true">
          <div className="upsell-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>
    </div>
  )
}
