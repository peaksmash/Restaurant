import React, { useState } from 'react';
import type { CrosssellSuggestion } from '../suggestions';

interface CrosssellChipProps {
  suggestions: CrosssellSuggestion[];
  onAccept: (ruleId: string, productId: string) => void;
  onDismiss: (ruleId: string) => void;
}

function FoodIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" width={size} height={size} aria-hidden="true">
      <line x1="7" y1="2" x2="7" y2="8" /><line x1="5" y1="2" x2="5" y2="6" />
      <line x1="9" y1="2" x2="9" y2="6" /><path d="M5 6 Q7 8 7 8 Q9 6 9 6" />
      <line x1="7" y1="8" x2="7" y2="22" />
      <path d="M16 2 C18 4 19 6 19 9 L16 10 L16 22" />
    </svg>
  );
}

function ChipImage({ suggestion }: { suggestion: CrosssellSuggestion }) {
  const [failed, setFailed] = useState(false);

  if (suggestion.product.imageUrl && !failed) {
    return (
      <img
        className="crosssell-chip-v2-img"
        src={suggestion.product.imageUrl}
        alt={suggestion.product.name}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className="crosssell-chip-v2-placeholder">
      <FoodIcon size={32} />
    </div>
  );
}

export function CrosssellChip({ suggestions, onAccept, onDismiss }: CrosssellChipProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="crosssell-section">
      <div className="crosssell-section-title">También te puede gustar</div>
      <div className="crosssell-chips-row">
        {suggestions.map((s) => (
          <div
            key={s.ruleId}
            className="crosssell-chip-v2"
            onClick={() => onAccept(s.ruleId, s.product.id)}
          >
            <ChipImage suggestion={s} />
            <div className="crosssell-chip-v2-body">
              <div className="crosssell-chip-v2-name">{s.product.name}</div>
              <div className="crosssell-chip-v2-price">
                {(s.product.price / 100).toFixed(2)} €
              </div>
              <button
                className="crosssell-chip-v2-add"
                onClick={(e) => { e.stopPropagation(); onAccept(s.ruleId, s.product.id); }}
                type="button"
              >
                + Añadir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
