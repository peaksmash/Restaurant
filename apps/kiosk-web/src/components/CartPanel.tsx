import React from 'react';
import type { KioskCartItem } from '../api';
import type { CrosssellSuggestion } from '../suggestions';
import { CrosssellChip } from './CrosssellChip';

interface Props {
  cart: KioskCartItem[];
  orderMode?: 'eatIn' | 'takeAway';
  sending: boolean;
  crosssellSuggestions?: CrosssellSuggestion[];
  onChangeQty: (cartKey: string, delta: number) => void;
  onAcceptCrosssell?: (ruleId: string, productId: string) => void;
  onDismissCrosssell?: (ruleId: string) => void;
  onSend: () => void;
}

function money(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export function CartPanel({
  cart,
  orderMode,
  sending,
  crosssellSuggestions = [],
  onChangeQty,
  onAcceptCrosssell,
  onDismissCrosssell,
  onSend,
}: Props) {
  const total = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const empty = cart.length === 0;

  return (
    <aside className="cart-panel">
      <div className="cart-header">
        <h2 className="cart-title">Tu pedido</h2>
        {orderMode && (
          <span className="cart-mode-badge">
            {orderMode === 'eatIn' ? '🪑 Aquí' : '🛍 Llevar'}
          </span>
        )}
      </div>

      <div className="cart-items">
        {empty ? (
          <p className="cart-empty">Aún no has añadido nada.</p>
        ) : (
          cart.map((item) => (
            <div key={item.cartKey} className="cart-line">
              <div className="cart-line-info">
                <span className="cart-line-name">{item.name}</span>
                <span className="cart-line-price">{money(item.unitPrice * item.quantity)}</span>
              </div>

              {item.modifiers.length > 0 && (
                <ul className="cart-line-modifiers">
                  {item.modifiers.map((m) => (
                    <li key={m.id}>
                      {m.name}
                      {m.priceImpact > 0 && (
                        <span className="mod-price"> +{money(m.priceImpact)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {item.comments && (
                <p className="cart-line-comment">📝 {item.comments}</p>
              )}

              <div className="qty-control">
                <button
                  className="qty-btn"
                  onClick={() => onChangeQty(item.cartKey, -1)}
                  aria-label="Quitar uno"
                >
                  −
                </button>
                <span className="qty-value">{item.quantity}</span>
                <button
                  className="qty-btn"
                  onClick={() => onChangeQty(item.cartKey, +1)}
                  aria-label="Añadir uno"
                >
                  +
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {crosssellSuggestions.length > 0 && onAcceptCrosssell && onDismissCrosssell && (
        <CrosssellChip
          suggestions={crosssellSuggestions}
          onAccept={onAcceptCrosssell}
          onDismiss={onDismissCrosssell}
        />
      )}

      <div className="cart-footer">
        <div className="cart-total">
          <span>Total</span>
          <strong>{money(total)}</strong>
        </div>
        <button
          className="btn-send"
          disabled={empty || sending}
          onClick={onSend}
        >
          {sending ? 'Enviando pedido…' : 'Enviar pedido'}
        </button>
      </div>
    </aside>
  );
}
