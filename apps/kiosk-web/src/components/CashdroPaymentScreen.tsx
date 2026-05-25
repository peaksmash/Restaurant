import React from 'react';
import type { CashdroPaymentSnapshot, OrderSession } from '../api';

interface Props {
  session: OrderSession;
  payment: CashdroPaymentSnapshot | null;
  polling: boolean;
  errorMessage?: string;
  onCancel: () => void;
}

function money(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function getTitle(payment: CashdroPaymentSnapshot | null) {
  if (!payment) return 'Preparando cobro';
  if (payment.workflowStatus === 'dispensing_change') return 'Toma el cambio';
  if (payment.workflowStatus === 'completed') return 'Pago efectuado';
  if (payment.workflowStatus === 'cancelled') return 'Cobro cancelado';
  if (payment.workflowStatus === 'failed') return 'Incidencia en el cobro';
  return 'Introduce dinero';
}

export function CashdroPaymentScreen({ session, payment, polling, errorMessage, onCancel }: Props) {
  const title = getTitle(payment);

  return (
    <div className="recovery-screen">
      <header className="customer-header">
        <button type="button" className="detail-back" onClick={onCancel} aria-label="Cancelar cobro">
          Cancelar
        </button>
        <div className="customer-title">Cobro en efectivo</div>
      </header>

      <div className="recovery-body">
        <div className="recovery-card cashdro-card">
          <p className="section-kicker">Pedido {session.externalId}</p>
          <h1 className="cashdro-title">{title}</h1>
          <p className="cashdro-copy">{payment?.customerMessage ?? 'Conectando con el cajón automático...'}</p>

          <div className="cashdro-amounts">
            <div>
              <span className="recovery-label">Total</span>
              <strong>{money(payment?.total ?? session.total)}</strong>
            </div>
            <div>
              <span className="recovery-label">Entregado</span>
              <strong>{money(payment?.totalIn ?? 0)}</strong>
            </div>
            <div>
              <span className="recovery-label">{(payment?.changeDue ?? 0) > 0 ? 'Cambio' : 'Falta'}</span>
              <strong>{money((payment?.changeDue ?? 0) > 0 ? payment?.changeDue ?? 0 : payment?.amountRemaining ?? session.total)}</strong>
            </div>
          </div>

          {payment?.operationId ? (
            <div className="cashdro-meta">
              <span>Operación {payment.operationId}</span>
              {payment.aliasId ? <span>Alias {payment.aliasId}</span> : null}
            </div>
          ) : null}

          {errorMessage ? <p className="recovery-error">{errorMessage}</p> : null}

          <div className="cashdro-footer">
            <span className={`cashdro-status ${polling ? 'is-live' : ''}`}>
              {polling ? 'Actualizando...' : 'Esperando estado'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
