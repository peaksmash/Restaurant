import React from 'react';
import type { OrderSessionEvent } from '@kiosk/types';

interface OrderHistoryTimelineProps {
  loading: boolean;
  error: string | null;
  events: OrderSessionEvent[];
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

function getEventLabel(event: OrderSessionEvent) {
  switch (event.type) {
    case 'order_session_created':
      return 'Pedido creado';
    case 'recovery_created':
      return 'Código de rescate generado';
    case 'recovery_order_found':
      return 'Pedido recuperado';
    case 'payment_succeeded':
      return 'Pago confirmado';
    case 'payment_demo_succeeded':
      return 'Pago confirmado en modo demo';
    case 'cashdro_payment_started':
      return 'Cobro CashDro iniciado';
    case 'cashdro_payment_completed':
      return 'Cobro CashDro completado';
    case 'cashdro_payment_cancelled':
      return 'Cobro CashDro cancelado';
    case 'last_sync_started':
      return 'Envío a Last iniciado';
    case 'last_sync_succeeded':
      return 'Enviado a Last';
    case 'last_sync_failed':
      return 'Error al enviar a Last';
    case 'order_status_updated':
      return 'Estado actualizado';
    default:
      return event.type;
  }
}

function getEventDescription(event: OrderSessionEvent) {
  if (event.type === 'order_status_updated' && event.rawJson) {
    const from = typeof event.rawJson.from === 'string' ? event.rawJson.from : null;
    const to = typeof event.rawJson.to === 'string' ? event.rawJson.to : null;
    if (from && to) {
      return `${from} -> ${to}`;
    }
  }

  if (event.type === 'last_sync_failed' && event.rawJson) {
    const message = typeof event.rawJson.message === 'string' ? event.rawJson.message : null;
    if (message) {
      return message;
    }
  }

  if (event.type === 'payment_succeeded' && event.rawJson) {
    const provider = typeof event.rawJson.paymentProvider === 'string' ? event.rawJson.paymentProvider : null;
    if (provider) {
      return `Método: ${provider}`;
    }
  }

  return null;
}

export function OrderHistoryTimeline({ loading, error, events }: OrderHistoryTimelineProps) {
  return (
    <section className="ops-section">
      <div className="ops-history-header">
        <h3>Historial</h3>
        {loading ? <span className="ops-history-loading">Cargando...</span> : null}
      </div>

      {error ? <div className="ops-inline-notice error">{error}</div> : null}

      {!loading && events.length === 0 ? (
        <p className="detail-note">Sin eventos registrados</p>
      ) : (
        <div className="ops-history-timeline">
          {events.map((event) => (
            <article key={event.id} className="ops-history-item">
              <div className="ops-history-dot" aria-hidden="true" />
              <div className="ops-history-content">
                <div className="ops-history-meta">
                  <strong>{getEventLabel(event)}</strong>
                  <span>{formatDateTime(event.createdAt)}</span>
                </div>
                <div className="ops-history-type">{event.type}</div>
                {getEventDescription(event) ? <p>{getEventDescription(event)}</p> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
