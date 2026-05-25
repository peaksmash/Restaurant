import React from 'react';
import type { OrderSession } from '@kiosk/types';

interface Props {
  session: OrderSession;
  tableName?: string | null;
  sending: boolean;
  artemisEnabled?: boolean;
  cashdroEnabled?: boolean;
  paymentsSimulated?: boolean;
  message?: string;
  errorMessage?: string;
  onBack: () => void;
  onConfirmCash: () => void;
  onStartArtemisPayment?: () => void;
  onStartCashdroPayment?: () => void;
}

function money(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export function RecoveryDetailScreen({
  session,
  tableName,
  sending,
  artemisEnabled = false,
  cashdroEnabled = false,
  paymentsSimulated = false,
  message,
  errorMessage,
  onBack,
  onConfirmCash,
  onStartArtemisPayment,
  onStartCashdroPayment,
}: Props) {
  const showArtemis = artemisEnabled || paymentsSimulated;
  const showCashdro = cashdroEnabled || paymentsSimulated;
  const hasDeviceOption = showArtemis || showCashdro;

  return (
    <div className="recovery-screen">
      <header className="customer-header">
        <button type="button" className="detail-back" onClick={onBack} aria-label="Volver">
          Volver
        </button>
        <div className="customer-title">Cobro pendiente</div>
      </header>

      <div className="recovery-body">
        <div className="recovery-card">
          <div className="recovery-summary-grid">
            <div>
              <span className="recovery-label">Mesa</span>
              <strong>{tableName || session.tableNameSnapshot || 'Sin mesa'}</strong>
            </div>
            <div>
              <span className="recovery-label">Cliente</span>
              <strong>{session.customer?.name || 'Sin nombre'}</strong>
            </div>
            <div>
              <span className="recovery-label">PIN4</span>
              <strong>{session.pin4 || '--'}</strong>
            </div>
            <div>
              <span className="recovery-label">Código</span>
              <strong>{session.qrToken || '--'}</strong>
            </div>
          </div>

          <div className="recovery-items">
            {session.items.map((item) => (
              <div key={item.id} className="recovery-item-row">
                <div>
                  <strong>
                    {item.quantity} x {item.productName}
                  </strong>
                  {item.modifiers.length > 0 ? (
                    <p>
                      {item.modifiers.map((modifier) => `${modifier.quantity}x ${modifier.modifierName}`).join(', ')}
                    </p>
                  ) : null}
                </div>
                <span>{money(item.totalPrice)}</span>
              </div>
            ))}
          </div>

          <div className="recovery-total-row">
            <span>Total</span>
            <strong>{money(session.total)}</strong>
          </div>

          {paymentsSimulated ? (
            <p className="recovery-copy">Modo demo activo. No se cobrará dinero real.</p>
          ) : null}
          {message ? <p className="recovery-success">{message}</p> : null}
          {errorMessage ? <p className="recovery-error">{errorMessage}</p> : null}

          {showArtemis ? (
            <button
              type="button"
              className="btn-primary recovery-submit-btn"
              disabled={sending}
              onClick={onStartArtemisPayment}
            >
              {sending ? 'Conectando...' : 'Cobrar con tarjeta'}
            </button>
          ) : null}

          {showCashdro ? (
            <button
              type="button"
              className={`btn-primary recovery-submit-btn${showArtemis ? ' recovery-secondary-btn' : ''}`}
              disabled={sending}
              onClick={onStartCashdroPayment}
            >
              {sending ? 'Conectando...' : 'Cobrar en efectivo'}
            </button>
          ) : null}

          <button
            type="button"
            className={`btn-primary recovery-submit-btn${hasDeviceOption ? ' recovery-secondary-btn' : ''}`}
            disabled={sending}
            onClick={onConfirmCash}
          >
            {sending ? 'Confirmando...' : hasDeviceOption ? 'Efectivo manual de emergencia' : 'Confirmar cobro en efectivo'}
          </button>
        </div>
      </div>
    </div>
  );
}
