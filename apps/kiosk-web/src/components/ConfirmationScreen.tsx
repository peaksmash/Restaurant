import React from 'react';
import type { OrderMode, OrderTotals } from '../api';
import { CheckIcon, SparklesIcon } from '../Icons';

interface Props {
  orderCode: string;
  customerName?: string;
  orderMode: OrderMode;
  totals?: OrderTotals;
  onNewOrder: () => void;
}

function money(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export function ConfirmationScreen({ orderCode, customerName, orderMode, totals, onNewOrder }: Props) {
  return (
    <div className="fullscreen-center confirmation confirmation-screen-pro">
      <div className="confirmation-chip">
        <SparklesIcon size={20} />
        <span>Recogida del pedido</span>
      </div>

      <div className="confirm-checkmark confirmation-checkmark-pro">
        <CheckIcon size={52} />
      </div>

      <div className="confirmation-copy-block">
        {customerName ? (
          <h1 className="confirm-title confirmation-title-pro">Gracias, {customerName}</h1>
        ) : (
          <h1 className="confirm-title confirmation-title-pro">Pago confirmado</h1>
        )}
        <p className="confirm-subtitle confirmation-subtitle-pro">
          Tu pedido ya esta en marcha. Guarda este codigo para recogerlo.
        </p>
      </div>

      <div className="confirmation-ticket-card">
        <span className="recovery-label">Codigo del pedido</span>
        <div className="confirm-code confirmation-code-pro">{orderCode}</div>
        <p className="confirmation-ticket-note">
          Ensenalo cuando aparezca en pantalla o cuando te lo pida el equipo.
        </p>
      </div>

      <p className="confirm-mode confirmation-mode-pro">
        {orderMode === 'eatIn' ? 'Comer aqui' : 'Para llevar'}
      </p>

      {totals?.total != null && (
        <div className="confirm-totals confirmation-totals-pro">
          <div className="confirm-totals-row">
            <span>Total</span>
            <span>{money(totals.total)}</span>
          </div>
          {totals.discountTotal != null && totals.discountTotal > 0 && (
            <div className="confirm-totals-row confirm-totals-discount">
              <span>Descuento</span>
              <span>-{money(totals.discountTotal)}</span>
            </div>
          )}
          {totals.tax != null && totals.tax > 0 && (
            <div className="confirm-totals-row confirm-totals-tax">
              <span>Impuestos</span>
              <span>{money(totals.tax)}</span>
            </div>
          )}
        </div>
      )}

      <p className="confirm-hint confirmation-hint-pro">Recoge tu pedido cuando escuches o veas tu numero.</p>

      <button className="btn-primary confirm-btn" onClick={onNewOrder}>
        Nuevo pedido
      </button>
    </div>
  );
}
