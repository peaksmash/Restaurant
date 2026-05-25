import React, { useState } from 'react';
import type { KioskCartItem } from '../api';
import {
  getCartLineDiscountedTotal,
  getCartLineOriginalTotal,
  lineHasDiscount,
  unitDisplayPrice,
} from '../cartPricing';
import { ArrowLeftIcon, PlusIcon, MinusIcon, TrashIcon, PencilIcon } from '../Icons';
import { getPromotionBadgeMeta } from '../promotionBadge';

interface Props {
  cart: KioskCartItem[];
  cartTotal: number;
  contextLabel: string;
  onChangeQty: (cartKey: string, delta: number) => void;
  onEditItem: (item: KioskCartItem) => void;
  onBack: () => void;
  onConfirm: () => void;
}

function money(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}


function ImageThumb({ imageUrl, name }: { imageUrl?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (imageUrl && !failed) {
    return (
      <img
        className="cart-thumb-img"
        src={imageUrl}
        alt={name}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div className="cart-thumb-placeholder">
      {name.trim()[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

export function CartReviewScreen({
  cart,
  cartTotal,
  contextLabel,
  onChangeQty,
  onEditItem,
  onBack,
  onConfirm,
}: Props) {
  const empty = cart.length === 0;

  return (
    <div className="cart-screen">
      <header className="cart-screen-header">
        <button className="detail-back" onClick={onBack} aria-label="Volver">
          <ArrowLeftIcon size={24} />
        </button>
        <h2 className="cart-screen-title">Tu pedido</h2>
        <span className="cart-mode-badge">{contextLabel}</span>
      </header>

      <div className="cart-screen-items">
        {empty ? (
          <p className="cart-empty">No has añadido nada todavía.</p>
        ) : (
          cart.map((item) => {
            const is2x1 = item.promotion?.discountType === '2x1';
            const lineOriginal = getCartLineOriginalTotal(item);
            const lineDiscounted = getCartLineDiscountedTotal(item);
            const hasDiscount = lineHasDiscount(item);

            // Unit price per ud. — for percentage/currency promos, less than item.unitPrice.
            // For 2x1, equals item.unitPrice (no per-unit reduction; discount is qty-based).
            const vUnit = unitDisplayPrice(item);
            const unitHasDiscount = vUnit < item.unitPrice;

            const promoBadge = getPromotionBadgeMeta(item.promotion);

            // 2x1 hint text shown below the badge
            const hint2x1 =
              is2x1 && item.quantity === 1
                ? 'Añade 1 más para aplicar 2x1'
                : is2x1 && item.quantity >= 2
                  ? '2x1 aplicado'
                  : null;

            return (
              <div key={item.cartKey} className="cart-line">
                {/* Thumbnail */}
                <div className="cart-line-thumb">
                  <ImageThumb imageUrl={item.imageUrl} name={item.name} />
                </div>

                {/* Content */}
                <div className="cart-line-content">
                  {/* Name + line total */}
                  <div className="cart-line-header">
                    <div className="cart-line-name-wrap">
                      <span className="cart-line-name">{item.name}</span>
                      {promoBadge && (
                          <span className={`cart-line-promo-badge ${promoBadge.colorClass}`}>
                            {promoBadge.label}
                          </span>
                        )}
                      {hint2x1 && (
                        <span className={`cart-2x1-hint${item.quantity >= 2 ? ' cart-2x1-applied' : ''}`}>
                          {hint2x1}
                        </span>
                      )}
                    </div>
                    <div className="cart-line-total-wrap">
                      {hasDiscount && (
                        <span className="cart-line-total-old">{money(lineOriginal)}</span>
                      )}
                      <span className={`cart-line-total${hasDiscount ? ' cart-line-total-promo' : ''}`}>
                        {money(lineDiscounted)}
                      </span>
                    </div>
                  </div>

                  {/* Modifiers */}
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

                  {/* Comment */}
                  {item.comments && (
                    <p className="cart-line-comment">{item.comments}</p>
                  )}

                  {/* Controls: qty stepper + unit price + action buttons */}
                  <div className="cart-line-controls">
                    <div className="qty-control">
                      <button
                        className="qty-btn"
                        onClick={() => onChangeQty(item.cartKey, -1)}
                        aria-label="Quitar uno"
                      >
                        <MinusIcon size={15} />
                      </button>
                      <span className="qty-value">{item.quantity}</span>
                      <button
                        className="qty-btn"
                        onClick={() => onChangeQty(item.cartKey, +1)}
                        aria-label="Añadir uno"
                      >
                        <PlusIcon size={15} />
                      </button>
                    </div>

                    <div className="cart-line-actions">
                      <div className="cart-line-unit-price-block">
                        {unitHasDiscount && (
                          <span className="cart-line-unit-price-old">{money(item.unitPrice)}</span>
                        )}
                        <span className={`cart-line-unit-price${unitHasDiscount ? ' cart-line-unit-price-promo' : ''}`}>
                          {money(vUnit)} / ud.
                        </span>
                      </div>
                      {item.modifiers.length > 0 && (
                        <button
                          className="cart-action-btn"
                          onClick={() => onEditItem(item)}
                          aria-label="Editar"
                        >
                          <PencilIcon size={15} />
                        </button>
                      )}
                      <button
                        className="cart-action-btn cart-action-delete"
                        onClick={() => onChangeQty(item.cartKey, -item.quantity)}
                        aria-label="Eliminar"
                      >
                        <TrashIcon size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="cart-screen-footer">
        <div className="cart-total-row">
          <span>Total</span>
          <strong>{money(cartTotal)}</strong>
        </div>
        <button
          className="btn-primary cart-confirm-btn"
          disabled={empty}
          onClick={onConfirm}
        >
          Confirmar pedido
        </button>
      </div>
    </div>
  );
}
