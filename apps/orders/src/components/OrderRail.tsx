import React from 'react';
import type { OperationalStatus } from '@kiosk/types';
import type { OrdersSessionRecord } from '../types';
import { formatChannelLabel, formatOperationalStatusLabel, formatPrintStatusLabel, resolveDisplayChannel } from '../mock/orders';

interface OrderRailProps {
  orders: OrdersSessionRecord[];
  selectedOrderId: string | null;
  onSelect: (orderId: string) => void;
  onAdvanceStatus?: (order: OrdersSessionRecord, nextStatus: OperationalStatus) => void;
  updatingOrderId?: string | null;
}

function formatTime(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getDisplayHeading(order: OrdersSessionRecord) {
  return order.externalId;
}

function getDisplaySubheading(order: OrdersSessionRecord) {
  const parts = [];
  const tableName = order.tableName || order.tableNameSnapshot;

  if (tableName) {
    parts.push(`Mesa ${tableName}`);
  }

  if (order.customer?.name) {
    parts.push(order.customer.name);
  }

  if (!tableName && !order.customer?.name) {
    parts.push(order.sourceLabel || formatChannelLabel(order.channel));
  }

  return parts.join(' · ');
}

function getNextStatus(current: OrdersSessionRecord['operationalStatus']): OperationalStatus | null {
  switch (current) {
    case 'pending':
      return 'accepted';
    case 'accepted':
      return 'preparing';
    case 'preparing':
      return 'ready';
    case 'ready':
      return 'delivered';
    default:
      return null;
  }
}

export function OrderRail({ orders, selectedOrderId, onSelect, onAdvanceStatus, updatingOrderId = null }: OrderRailProps) {
  if (orders.length === 0) {
    return <div className="panel-empty">No hay pedidos en esta vista.</div>;
  }

  return (
    <div className="order-rail">
      {orders.map((order) => {
        const displayChannel = resolveDisplayChannel(order);
        const nextStatus = getNextStatus(order.operationalStatus);
        const canAdvance =
          order.recordType !== 'order_session' &&
          Boolean(order.liveTabId) &&
          nextStatus !== null &&
          typeof onAdvanceStatus === 'function';
        const isUpdating = updatingOrderId === order.orderSessionId;

        return (
          <div
            key={order.orderSessionId}
            role="button"
            tabIndex={0}
            className={`rail-card${selectedOrderId === order.orderSessionId ? ' active' : ''}`}
            onClick={() => onSelect(order.orderSessionId)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(order.orderSessionId);
              }
            }}
          >
            <div className="rail-card-head">
            <div>
              <h3>{getDisplayHeading(order)}</h3>
              <p className="detail-note">{getDisplaySubheading(order)}</p>
            </div>
              <button
                type="button"
                className={`state-pill state-${order.operationalStatus}${canAdvance ? ' clickable' : ''}`}
                disabled={!canAdvance || isUpdating}
                onClick={(event) => {
                  event.stopPropagation();
                  if (canAdvance && nextStatus && onAdvanceStatus) {
                    onAdvanceStatus(order, nextStatus);
                  }
                }}
              >
                {isUpdating ? 'Actualizando...' : formatOperationalStatusLabel(order.operationalStatus)}
              </button>
            </div>

            <div className="rail-card-meta">
              <span>{formatChannelLabel(displayChannel)}</span>
              <span>{order.items.length} productos</span>
              <span>{formatTime(order.createdAt)}</span>
              {order.recordType === 'operational_ticket' ? <span>{formatPrintStatusLabel(order.printStatus)}</span> : null}
              {order.paymentStatus === 'unpaid' ? (
                <span style={{ color: '#991b1b', background: '#fee2e2', borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 600 }}>Sin cobrar</span>
              ) : order.paymentStatus === 'paid' && order.lastSyncStatus === 'sync_failed' ? (
                <span style={{ color: '#92400e', background: '#fef3c7', borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 600 }}>Sync fallido</span>
              ) : order.paymentStatus === 'paid' && order.lastSyncStatus === 'not_sent' ? (
                <span style={{ color: '#1e3a8a', background: '#dbeafe', borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 600 }}>Pdte. Last</span>
              ) : null}
            </div>

            <div className="rail-card-times">
              <span>Total {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(order.total / 100)}</span>
              <span>{order.estimatedReadyAt ? `Listo ${formatTime(order.estimatedReadyAt)}` : 'Sin hora estimada'}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
