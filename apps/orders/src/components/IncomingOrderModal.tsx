import React from 'react';
import type { OrdersSessionRecord } from '../types';

interface IncomingOrderModalProps {
  order: OrdersSessionRecord | null;
  prepMinutes: number;
  onChangePrepMinutes: (minutes: number) => void;
  onAccept: () => void;
  onClose: () => void;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value / 100);
}

export function IncomingOrderModal({
  order,
  prepMinutes,
  onChangePrepMinutes,
  onAccept,
  onClose,
}: IncomingOrderModalProps) {
  if (!order) return null;

  const quickTimes = [10, 20, 25, 35];

  function decreaseMinutes() {
    onChangePrepMinutes(Math.max(5, prepMinutes - 5));
  }

  function increaseMinutes() {
    onChangePrepMinutes(Math.min(60, prepMinutes + 5));
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="incoming-modal" role="dialog" aria-modal="true" aria-label="Pedido entrante">
        <div className="incoming-modal-top">
          <div>
            <p className="section-kicker">Pedido entrante</p>
            <h2>{order.externalId}</h2>
          </div>
          <button type="button" className="incoming-close-btn" onClick={onClose} aria-label="Cerrar modal">
            X
          </button>
        </div>

        <div className="incoming-summary-line">
          <span>{order.tableName || order.tableNameSnapshot || 'Sin mesa'}</span>
          <span>{order.customer?.name || 'Cliente'}</span>
          <span>{formatCurrency(order.total)}</span>
        </div>

        <div className="incoming-time-wrap">
          <button type="button" className="time-step-btn" onClick={decreaseMinutes} aria-label="Menos tiempo">
            -
          </button>

          <div className="incoming-time-core">
            <div className="incoming-time-orb" aria-live="polite">
              <span className="incoming-time-value">{prepMinutes}</span>
              <span className="incoming-time-unit">min</span>
            </div>
          </div>

          <button type="button" className="time-step-btn" onClick={increaseMinutes} aria-label="Mas tiempo">
            +
          </button>
        </div>

        <div className="incoming-quick-times">
          {quickTimes.map((time) => (
            <button
              key={time}
              type="button"
              className={`quick-time-chip${prepMinutes === time ? ' active' : ''}`}
              onClick={() => onChangePrepMinutes(time)}
            >
              {time}m
            </button>
          ))}
        </div>

        <p className="incoming-copy compact">
          En produccion, este tiempo se enviara a Last con la aceptacion real del pedido.
        </p>

        <div className="incoming-actions compact">
          <button type="button" className="ghost-btn light" onClick={onClose}>
            Cerrar
          </button>
          <button type="button" className="primary-btn strong" onClick={onAccept}>
            Abrir pedido
          </button>
        </div>
      </div>
    </div>
  );
}
