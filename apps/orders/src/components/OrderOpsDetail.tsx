import React, { useState } from 'react';
import type { OperationalStatus, PrintStatus } from '@kiosk/types';
import { getOperationalTicketPreview } from '../api';
import {
  formatChannelLabel,
  formatOperationalStatusLabel,
  formatPrintStatusLabel,
  resolveDisplayChannel,
} from '../mock/orders';
import type { OrdersDataSourceMode, OrdersPageDetailMode, OrdersSessionRecord } from '../types';

interface OrderOpsDetailProps {
  order: OrdersSessionRecord | null;
  mode?: OrdersPageDetailMode;
  dataSourceMode: OrdersDataSourceMode;
  confirmPaymentMessage?: string | null;
  confirmPaymentError?: string | null;
  confirmingOrderId?: string | null;
  sendToLastMessage?: string | null;
  sendToLastError?: string | null;
  sendingToLastOrderId?: string | null;
  statusActionMessage?: string | null;
  statusActionError?: string | null;
  updatingStatusOrderId?: string | null;
  paymentJobState?: {
    status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
    provider: 'cashdro' | 'artemis';
    error: string | null;
    message: string | null;
  } | null;
  printState?: {
    loading: boolean;
    message: string | null;
    error: string | null;
    printStatus: PrintStatus | null;
  } | null;
  onConfirmPayment?: (order: OrdersSessionRecord) => void;
  onSendToLast?: (order: OrdersSessionRecord) => void;
  onUpdateStatus?: (order: OrdersSessionRecord, operationalStatus: OperationalStatus) => void;
  onStartDevicePayment?: (order: OrdersSessionRecord, provider: 'cashdro' | 'artemis') => void;
  onPrintTicket?: (ticketId: string) => void;
  onReprintTicket?: (ticketId: string) => void;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value / 100);
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getPrimaryLabel(order: OrdersSessionRecord) {
  const tableName = order.tableName || order.tableNameSnapshot;
  if (tableName) return `Mesa ${tableName}`;
  return order.customer?.name || order.sourceLabel || formatChannelLabel(resolveDisplayChannel(order));
}

function getSecondaryLabel(order: OrdersSessionRecord) {
  const parts = [];
  if (order.customer?.name) {
    parts.push(order.customer.name);
  }
  parts.push(order.sourceLabel || formatChannelLabel(resolveDisplayChannel(order)));
  return parts.join(' · ');
}

function getNextOperationalStatuses(current: OrdersSessionRecord['operationalStatus']): OperationalStatus[] {
  switch (current) {
    case 'pending':
      return ['accepted', 'cancelled'];
    case 'accepted':
      return ['preparing', 'cancelled'];
    case 'preparing':
      return ['ready', 'cancelled'];
    case 'ready':
      return ['delivered', 'cancelled'];
    default:
      return [];
  }
}

export function OrderOpsDetail({
  order,
  mode = 'orders',
  dataSourceMode,
  confirmPaymentMessage = null,
  confirmPaymentError = null,
  confirmingOrderId = null,
  sendToLastMessage = null,
  sendToLastError = null,
  sendingToLastOrderId = null,
  statusActionMessage = null,
  statusActionError = null,
  updatingStatusOrderId = null,
  paymentJobState = null,
  printState = null,
  onConfirmPayment,
  onSendToLast,
  onUpdateStatus,
  onStartDevicePayment,
  onPrintTicket,
  onReprintTicket,
}: OrderOpsDetailProps) {
  const [previewSvg, setPreviewSvg] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  async function handlePreview(ticketId: string) {
    setPreviewLoading(true);
    try {
      const res = await getOperationalTicketPreview(ticketId);
      setPreviewSvg(res.previewSvg);
    } catch {
      // silencioso — si falla no hay modal
    } finally {
      setPreviewLoading(false);
    }
  }

  if (!order) {
    return <div className="ops-detail panel-empty">Selecciona un pedido para ver su detalle.</div>;
  }

  const displayChannel = resolveDisplayChannel(order);
  const hidePrices = mode === 'kitchen' || order.recordType === 'operational_ticket';
  const canConfirmCashPayment =
    mode === 'pending' &&
    dataSourceMode === 'real' &&
    order.recordType === 'order_session' &&
    order.paymentMode === 'cashier' &&
    order.paymentStatus === 'unpaid' &&
    order.lastSyncStatus === 'not_sent';
  const canSendToLast =
    order.recordType === 'order_session' &&
    dataSourceMode === 'real' &&
    order.paymentStatus === 'paid' &&
    (order.lastSyncStatus === 'not_sent' || order.lastSyncStatus === 'sync_failed');
  const canUpdateOperationalStatus =
    dataSourceMode === 'real' &&
    order.paymentStatus === 'paid' &&
    order.lastSyncStatus === 'sent';
  const canPrintTicket = order.recordType === 'operational_ticket' && Boolean(order.ticketId);
  const nextStatuses = getNextOperationalStatuses(order.operationalStatus);
  const isUpdatingCurrentOrder = updatingStatusOrderId === order.orderSessionId;

  return (
    <section className="ops-detail">
      <div className="ops-detail-header">
        <div>
          <p className="section-kicker">Pedido {order.externalId}</p>
          <h2>{getPrimaryLabel(order)}</h2>
          <p className="detail-note">{getSecondaryLabel(order)}</p>
        </div>
        <span className={`state-pill state-${order.operationalStatus}`}>
          {formatOperationalStatusLabel(order.operationalStatus)}
        </span>
      </div>

      {confirmPaymentMessage ? <div className="ops-inline-notice success">{confirmPaymentMessage}</div> : null}
      {confirmPaymentError ? <div className="ops-inline-notice error">{confirmPaymentError}</div> : null}
      {sendToLastMessage ? <div className="ops-inline-notice success">{sendToLastMessage}</div> : null}
      {sendToLastError ? <div className="ops-inline-notice error">{sendToLastError}</div> : null}
      {statusActionMessage ? <div className="ops-inline-notice success">{statusActionMessage}</div> : null}
      {statusActionError ? <div className="ops-inline-notice error">{statusActionError}</div> : null}
      {paymentJobState?.message ? <div className="ops-inline-notice success">{paymentJobState.message}</div> : null}
      {paymentJobState?.error ? <div className="ops-inline-notice error">{paymentJobState.error}</div> : null}
      {printState?.message ? <div className="ops-inline-notice success">{printState.message}</div> : null}
      {printState?.error ? <div className="ops-inline-notice error">{printState.error}</div> : null}

      <div className="ops-grid">
        <div>
          <span className="meta-label">Canal</span>
          <strong>{formatChannelLabel(displayChannel)}</strong>
        </div>
        <div>
          <span className="meta-label">Hora</span>
          <strong>{formatDateTime(order.createdAt)}</strong>
        </div>
        <div>
          <span className="meta-label">Listo aprox.</span>
          <strong>{formatDateTime(order.estimatedReadyAt)}</strong>
        </div>
        <div>
          <span className="meta-label">Total</span>
          <strong>{hidePrices ? 'Oculto en cocina' : formatCurrency(order.total)}</strong>
        </div>
        {order.recordType === 'operational_ticket' ? (
          <div>
            <span className="meta-label">Impresión</span>
            <strong>{formatPrintStatusLabel(printState?.printStatus ?? order.printStatus)}</strong>
          </div>
        ) : null}
        <div>
          <span className="meta-label">Pago</span>
          <strong style={{ color: order.paymentStatus === 'paid' ? '#15803d' : '#b91c1c' }}>
            {order.paymentStatus === 'paid' ? 'Cobrado' : 'Pendiente'}
          </strong>
        </div>
        <div>
          <span className="meta-label">Sync Last</span>
          <strong style={{
            color: order.lastSyncStatus === 'sent'
              ? '#15803d'
              : order.lastSyncStatus === 'sync_failed'
              ? '#c2410c'
              : '#6b7280'
          }}>
            {order.lastSyncStatus === 'sent'
              ? 'Enviado'
              : order.lastSyncStatus === 'sync_failed'
              ? 'Fallido'
              : 'No enviado'}
          </strong>
        </div>
      </div>

      <div className="ops-section">
        <h3>Pedido</h3>
        {order.items.map((item) => (
          <div key={item.id} className="ops-item-row">
            <div>
              <strong>{item.quantity} x {item.productName}</strong>
              {item.notes ? <p>{item.notes}</p> : null}
              {item.modifiers.length > 0 ? (
                <p>{item.modifiers.map((modifier) => `${modifier.quantity}x ${modifier.modifierName}`).join(' / ')}</p>
              ) : null}
            </div>
            <span>{hidePrices ? 'Comanda' : formatCurrency(item.totalPrice)}</span>
          </div>
        ))}
      </div>

      {canPrintTicket ? (
        <div className="ops-section">
          <h3>Comanda</h3>
          <p className="detail-note">Impresión unificada de la comanda con el formato operativo del sistema.</p>
          <div className="ops-action-strip">
            <button
              type="button"
              className="ops-mock-btn"
              disabled={printState?.loading || !order.ticketId}
              onClick={() => {
                if (order.ticketId && onPrintTicket) {
                  onPrintTicket(order.ticketId);
                }
              }}
            >
              {printState?.loading ? 'Preparando...' : 'Imprimir'}
            </button>
            <button
              type="button"
              className="ops-mock-btn"
              disabled={printState?.loading || !order.ticketId}
              onClick={() => {
                if (order.ticketId && onReprintTicket) {
                  onReprintTicket(order.ticketId);
                }
              }}
            >
              Reimprimir comanda
            </button>
            <button
              type="button"
              className="ops-mock-btn"
              disabled={previewLoading || !order.ticketId}
              onClick={() => {
                if (order.ticketId) {
                  void handlePreview(order.ticketId);
                }
              }}
            >
              {previewLoading ? 'Cargando...' : '👁 Ver comanda'}
            </button>
          </div>
        </div>
      ) : null}

      {previewSvg ? (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.72)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setPreviewSvg(null)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 16, padding: 16,
              maxWidth: 520, width: '100%',
              position: 'relative',
              boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewSvg(null)}
              style={{
                position: 'sticky', top: 0, float: 'right',
                background: '#f2f4f7', border: 'none', borderRadius: 8,
                width: 32, height: 32, cursor: 'pointer',
                fontSize: 16, fontWeight: 700, color: '#344054',
              }}
            >
              ✕
            </button>
            {/* SVG escalado al ancho del modal */}
            <div style={{ lineHeight: 0, clear: 'both' }}>
              <img
                src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(previewSvg)}`}
                alt="Vista previa de comanda"
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {order.notes ? (
        <div className="ops-section">
          <h3>Notas</h3>
          <p>{order.notes}</p>
        </div>
      ) : null}

      <div className="ops-section">
        <h3>Cambiar estado</h3>
        <div className="ops-action-strip">
          <button
            type="button"
            className="ops-mock-btn"
            disabled={!canUpdateOperationalStatus || isUpdatingCurrentOrder || !nextStatuses.includes('accepted')}
            onClick={() => {
              if (canUpdateOperationalStatus && onUpdateStatus && nextStatuses.includes('accepted')) {
                onUpdateStatus(order, 'accepted');
              }
            }}
          >
            {order.operationalStatus === 'accepted' ? 'Aceptado' : 'Aceptar'}
          </button>
          <button
            type="button"
            className="ops-mock-btn"
            disabled={!canUpdateOperationalStatus || isUpdatingCurrentOrder || !nextStatuses.includes('preparing')}
            onClick={() => {
              if (canUpdateOperationalStatus && onUpdateStatus && nextStatuses.includes('preparing')) {
                onUpdateStatus(order, 'preparing');
              }
            }}
          >
            {order.operationalStatus === 'preparing' ? 'En cocina' : 'Pasar a cocina'}
          </button>
          <button
            type="button"
            className="ops-mock-btn"
            disabled={!canUpdateOperationalStatus || isUpdatingCurrentOrder || !nextStatuses.includes('ready')}
            onClick={() => {
              if (canUpdateOperationalStatus && onUpdateStatus && nextStatuses.includes('ready')) {
                onUpdateStatus(order, 'ready');
              }
            }}
          >
            {order.operationalStatus === 'ready' ? 'Listo' : 'Marcar listo'}
          </button>
          {nextStatuses.includes('delivered') ? (
            <button
              type="button"
              className="ops-mock-btn success"
              disabled={!canUpdateOperationalStatus || isUpdatingCurrentOrder}
              onClick={() => {
                if (canUpdateOperationalStatus && onUpdateStatus) {
                  onUpdateStatus(order, 'delivered');
                }
              }}
            >
              {isUpdatingCurrentOrder ? 'Actualizando...' : 'Entregar'}
            </button>
          ) : null}
          {nextStatuses.includes('cancelled') ? (
            <button
              type="button"
              className="ops-mock-btn"
              disabled={!canUpdateOperationalStatus || isUpdatingCurrentOrder}
              onClick={() => {
                if (canUpdateOperationalStatus && onUpdateStatus) {
                  onUpdateStatus(order, 'cancelled');
                }
              }}
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </div>

      {mode === 'incidents' ? (
        <div className="ops-section">
          <h3>Incidencia</h3>
          <p className="detail-note">El pedido está pagado, pero hubo un fallo al enviarlo a Last.</p>
          <div className="ops-action-strip">
            <button
              type="button"
              className="ops-mock-btn danger"
              disabled={!canSendToLast || sendingToLastOrderId === order.orderSessionId}
              onClick={() => {
                if (canSendToLast && onSendToLast) {
                  onSendToLast(order);
                }
              }}
            >
              {sendingToLastOrderId === order.orderSessionId ? 'Reintentando...' : 'Reintentar envío a Last'}
            </button>
          </div>
        </div>
      ) : null}

      {mode === 'pending' ? (
        <div className="ops-section">
          <h3>Cobro</h3>
          <p className="detail-note">Este pedido está pendiente de cobro.</p>
          <div className="ops-grid">
            <div>
              <span className="meta-label">PIN4</span>
              <strong>{order.pin4 || '-'}</strong>
            </div>
            <div>
              <span className="meta-label">Código de rescate</span>
              <strong>{order.qrToken || '-'}</strong>
            </div>
          </div>
          <div className="ops-action-strip">
            <button
              type="button"
              className="ops-mock-btn"
              disabled={!canConfirmCashPayment || paymentJobState?.status === 'queued' || paymentJobState?.status === 'running'}
              onClick={() => {
                if (canConfirmCashPayment && onStartDevicePayment) {
                  onStartDevicePayment(order, 'cashdro');
                }
              }}
            >
              {paymentJobState?.provider === 'cashdro' && (paymentJobState.status === 'queued' || paymentJobState.status === 'running')
                ? paymentJobState.status === 'queued'
                  ? 'Esperando turno'
                  : 'Procesando cobro'
                : 'Cobrar en efectivo'}
            </button>
            <button
              type="button"
              className="ops-mock-btn"
              disabled={!canConfirmCashPayment || paymentJobState?.status === 'queued' || paymentJobState?.status === 'running'}
              onClick={() => {
                if (canConfirmCashPayment && onStartDevicePayment) {
                  onStartDevicePayment(order, 'artemis');
                }
              }}
            >
              {paymentJobState?.provider === 'artemis' && (paymentJobState.status === 'queued' || paymentJobState.status === 'running')
                ? paymentJobState.status === 'queued'
                  ? 'Esperando turno'
                  : 'Procesando tarjeta'
                : 'Cobrar con tarjeta'}
            </button>
            <button
              type="button"
              className="ops-mock-btn success"
              disabled={
                !canConfirmCashPayment ||
                confirmingOrderId === order.orderSessionId ||
                paymentJobState?.status === 'queued' ||
                paymentJobState?.status === 'running'
              }
              onClick={() => {
                if (canConfirmCashPayment && onConfirmPayment) {
                  onConfirmPayment(order);
                }
              }}
            >
              {confirmingOrderId === order.orderSessionId ? 'Confirmando cobro...' : 'Confirmar cobro'}
            </button>
            {order.paymentStatus === 'paid' && order.lastSyncStatus === 'not_sent' ? (
              <button
                type="button"
                className="ops-mock-btn success"
                disabled={!canSendToLast || sendingToLastOrderId === order.orderSessionId}
                onClick={() => {
                  if (canSendToLast && onSendToLast) {
                    onSendToLast(order);
                  }
                }}
              >
                {sendingToLastOrderId === order.orderSessionId ? 'Enviando...' : 'Enviar a Last'}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
