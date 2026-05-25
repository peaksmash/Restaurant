import { useState } from 'react'
import type { CrosssellSuggestion } from '@/suggestions'
import { formatEuro } from '@/lib/utils'

interface Props {
  suggestions: CrosssellSuggestion[]
  onAccept: (ruleId: string, productId: string) => void
  onDismiss: (ruleId: string) => void
}

function ChipImage({ suggestion }: { suggestion: CrosssellSuggestion }) {
  const [failed, setFailed] = useState(false)

  if (suggestion.product.imageUrl && !failed) {
    return (
      <img
        className="crosssell-chip-v2-img"
        src={suggestion.product.imageUrl}
        alt={suggestion.product.name}
        onError={() => setFailed(true)}
      />
    )
  }

  return <div className="crosssell-chip-v2-placeholder" aria-hidden="true" />
}

export function CrosssellChip({ suggestions, onAccept, onDismiss: _onDismiss }: Props) {
  if (suggestions.length === 0) {
    return null
  }

  return (
    <div className="crosssell-section">
      <div className="crosssell-section-title">Completa tu pedido</div>
      <div className="crosssell-chips-row">
        {suggestions.map((suggestion) => (
          <div
            key={suggestion.ruleId}
            className="crosssell-chip-v2"
            onClick={() => onAccept(suggestion.ruleId, suggestion.product.id)}
          >
            <ChipImage suggestion={suggestion} />
            <div className="crosssell-chip-v2-body">
              <div className="crosssell-chip-v2-reason">{suggestion.reason}</div>
              <div className="crosssell-chip-v2-name">{suggestion.product.name}</div>
              <div className="crosssell-chip-v2-price">{formatEuro(suggestion.product.price)}</div>
              <button
                className="crosssell-chip-v2-add"
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onAccept(suggestion.ruleId, suggestion.product.id)
                }}
              >
                Anadir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
