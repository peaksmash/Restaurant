import React from 'react';
import type { OrderSession } from '@kiosk/types';
import { FullPageHeader } from '../components/FullPageHeader';
import { getLineDisplayUnitPrice } from '../lib/cartPricing';
import type { CartaProduct } from '../mock/menu';

export interface CartaLineModifier {
  modifierGroupId: string;
  modifierOptionId: string;
  name: string;
  price: number;
  quantity?: number;
  groupName?: string;
}

export interface CartaLine {
  id: string;
  product: CartaProduct;
  quantity: number;
  modifiers: CartaLineModifier[];
  comments?: string;
}

interface CartaCartPageProps {
  lines: CartaLine[];
  totalPrice: number;
  connectionMode: 'real' | 'demo';
  connectionMessage: string;
  createError?: string | null;
  creating?: boolean;
  createdOrder?: OrderSession | null;
  onClose: () => void;
  onChangeQty: (lineId: string, delta: number) => void;
  onEditLine: (lineId: string) => void;
  onCreatePendingOrder: () => void;
  onGoToPending: () => void;
  onResetCreatedOrder: () => void;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value / 100);
}

function formatOperationalStatus(status: OrderSession['operationalStatus']) {
  switch (status) {
    case 'pending':
      return 'Pendiente';
    case 'accepted':
      return 'Aceptado';
    case 'preparing':
      return 'Preparando';
    case 'ready':
      return 'Listo';
    case 'delivered':
      return 'Entregado';
    case 'cancelled':
      return 'Cancelado';
    default:
      return status;
  }
}

function renderModifierLabel(modifier: CartaLineModifier) {
  const base = modifier.groupName ? `${modifier.groupName}: ${modifier.name}` : modifier.name;
  return modifier.price > 0 ? `${base} (+${formatCurrency(modifier.price)})` : base;
}

export function CartaCartPage({
  lines,
  totalPrice,
  connectionMode,
  connectionMessage,
  createError = null,
  creating = false,
  createdOrder = null,
  onClose,
  onChangeQty,
  onEditLine,
  onCreatePendingOrder,
  onGoToPending,
  onResetCreatedOrder,
}: CartaCartPageProps) {
  const [checkoutOpen, setCheckoutOpen] = React.useState(false);

  return (
    <div className="orders-page">
      <FullPageHeader
        title="Mini Comandero"
        subtitle={
          connectionMode === 'real'
            ? 'Pantalla separada de cesta para empleado. Crea OrderSession real pendiente sin tocar pagos externos.'
            : 'Modo demo — sin backend real. La cuenta no se crea realmente.'
        }
        onClose={onClose}
      />

      <section className="cart-fullscreen">
        <div className="carta-summary">
          <div className="meta-pill-wrap">
            <span className={`meta-pill ${connectionMode === 'real' ? 'meta-pill-real' : 'meta-pill-demo'}`}>
              {connectionMessage}
            </span>
          </div>

          <div className="carta-summary-lines">
            {lines.length === 0 ? (
              <div className="panel-empty">Todavía no hay productos en esta cuenta.</div>
            ) : (
              lines.map((line) => (
                <div key={line.id} className="carta-summary-line cart-page-line">
                  <div className="cart-line-content">
                    <strong>{line.product.name}</strong>
                    <p>{formatCurrency(getLineDisplayUnitPrice(line))} unidad</p>
                    {line.modifiers.length > 0 ? (
                      <div className="carta-line-modifiers">
                        {line.modifiers.map((modifier) => (
                          <span
                            key={`${line.id}-${modifier.modifierGroupId}-${modifier.modifierOptionId}`}
                            className="carta-line-modifier-chip"
                          >
                            {renderModifierLabel(modifier)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {line.comments ? <p className="detail-note">{line.comments}</p> : null}
                  </div>

                  <div className="carta-line-actions">
                    <button type="button" className="ghost-btn cart-edit-btn" onClick={() => onEditLine(line.id)}>
                      Editar
                    </button>
                    <div className="carta-qty-control">
                      <button type="button" onClick={() => onChangeQty(line.id, -1)}>−</button>
                      <span>{line.quantity}</span>
                      <button type="button" onClick={() => onChangeQty(line.id, 1)}>+</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="carta-summary-total">
            <span>Total</span>
            <strong>{formatCurrency(totalPrice)}</strong>
          </div>

          {createError ? <div className="ops-inline-notice error">{createError}</div> : null}

          {createdOrder ? (
            <div className="ops-inline-notice success">
              <strong>Pedido creado. Pendiente de pago y envío a Last.</strong>
              <div className="mini-kiosk-created-meta">
                <span>OrderSession: {createdOrder.orderSessionId}</span>
                <span>Total: {formatCurrency(createdOrder.total)}</span>
                <span>Estado: {formatOperationalStatus(createdOrder.operationalStatus)}</span>
              </div>
            </div>
          ) : (
            <p className="detail-note">
              Mini Kiosko crea una OrderSession real en backend y la deja pendiente de pago. No envía a Last automáticamente.
            </p>
          )}

          {createdOrder ? (
            <div className="checkout-options">
              <button type="button" className="checkout-option" onClick={onGoToPending}>
                <strong>Ir a Cobros pendientes</strong>
                <span>La cuenta ya debe aparecer en pendientes para continuar el flujo de cobro.</span>
              </button>
              <button
                type="button"
                className="checkout-option"
                onClick={() => {
                  onResetCreatedOrder();
                  onClose();
                }}
              >
                <strong>Nueva cuenta</strong>
                <span>Cierra esta cesta y empieza otra desde Mini Kiosko.</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="primary-btn strong"
              disabled={lines.length === 0}
              onClick={() => setCheckoutOpen(true)}
            >
              Terminar pedido
            </button>
          )}
        </div>
      </section>

      {checkoutOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div className="checkout-modal" role="dialog" aria-modal="true" aria-label="Finalizar cuenta Mini Kiosko">
            <div className="incoming-modal-top">
              <div>
                <p className="section-kicker">Finalizar cuenta</p>
                <h2>Elegir salida</h2>
              </div>
              <button
                type="button"
                className="incoming-close-btn"
                onClick={() => setCheckoutOpen(false)}
                aria-label="Cerrar modal"
              >
                ×
              </button>
            </div>

            <div className="checkout-options">
              <button type="button" className="checkout-option disabled" disabled>
                <strong>Cobro interno directo (TODO)</strong>
                <span>La creación inmediata como pagado/manual seguirá pendiente hasta cerrar el flujo de cobro interno.</span>
              </button>
              <button
                type="button"
                className="checkout-option"
                onClick={() => {
                  setCheckoutOpen(false);
                  onCreatePendingOrder();
                }}
                disabled={connectionMode !== 'real' || creating}
              >
                <strong>{creating ? 'Creando cuenta…' : 'Dejar pendiente de pago'}</strong>
                <span>Crea OrderSession real con channel manual y paymentMode cashier para que aparezca en Cobros pendientes.</span>
              </button>
              <button type="button" className="checkout-option disabled" disabled>
                <strong>Pagar con Cashdro / tarjeta (TODO)</strong>
                <span>Sin Stripe, Cashdro ni hardware en esta fase.</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
