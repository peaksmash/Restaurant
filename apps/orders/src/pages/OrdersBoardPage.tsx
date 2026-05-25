import React from 'react';
import type { OperationalStatus } from '@kiosk/types';
import { OrderRail } from '../components/OrderRail';
import { resolveDisplayChannel } from '../mock/orders';
import type {
  OrdersBoardView,
  OrdersDataSourceMode,
  OrdersHistoryChannelFilter,
  OrdersSessionRecord,
} from '../types';

interface OrdersBoardPageProps {
  activeOrders: OrdersSessionRecord[];
  kitchenOrders: OrdersSessionRecord[];
  incidentOrders: OrdersSessionRecord[];
  historyOrders: OrdersSessionRecord[];
  selectedOrderId: string | null;
  currentView: OrdersBoardView;
  historyChannelFilter: OrdersHistoryChannelFilter;
  dataSourceMode: OrdersDataSourceMode;
  connectionError?: string | null;
  updatingOrderId?: string | null;
  onChangeView: (view: OrdersBoardView) => void;
  onChangeHistoryChannelFilter: (filter: OrdersHistoryChannelFilter) => void;
  onSelectOrder: (orderId: string) => void;
  onAdvanceStatus: (order: OrdersSessionRecord, nextStatus: OperationalStatus) => void;
}

export function OrdersBoardPage({
  activeOrders,
  kitchenOrders,
  incidentOrders,
  historyOrders,
  selectedOrderId,
  currentView,
  historyChannelFilter,
  dataSourceMode,
  connectionError = null,
  updatingOrderId = null,
  onChangeView,
  onChangeHistoryChannelFilter,
  onSelectOrder,
  onAdvanceStatus,
}: OrdersBoardPageProps) {
  const visibleOrders =
    currentView === 'kitchen'
      ? kitchenOrders
      : currentView === 'incidents'
        ? incidentOrders
        : currentView === 'history'
          ? historyOrders.filter((order) => historyChannelFilter === 'all' || resolveDisplayChannel(order) === historyChannelFilter)
          : activeOrders;

  return (
    <div className="orders-page">
      <header className="page-header">
        <div>
          <p className="section-kicker">Operacion</p>
          <h1>Pedidos</h1>
          <p className="page-copy">
            {dataSourceMode === 'real'
              ? currentView === 'history'
                ? 'Historial del día con comandas normalizadas y filtro por canal.'
                : currentView === 'incidents'
                  ? 'Incidencias de las últimas 24 horas.'
                  : 'Comandas operativas normalizadas a partir de Last y de los pedidos propios ya sincronizados.'
              : 'Modo demo explícito mientras el backend real no responde en desarrollo.'}
          </p>
          {connectionError ? <p className="detail-note">{connectionError}</p> : null}
        </div>
        <div className="page-meta">
          <span className="meta-pill">
            {dataSourceMode === 'real' ? 'Actualizacion automatica cada 10s' : 'Actualizacion automatica cada 10s (demo)'}
          </span>
        </div>
      </header>

      <div className="orders-subnav">
        <button
          type="button"
          className={`orders-subnav-btn${currentView === 'active' ? ' active' : ''}`}
          onClick={() => onChangeView('active')}
        >
          Activos
        </button>
        <button
          type="button"
          className={`orders-subnav-btn${currentView === 'kitchen' ? ' active' : ''}`}
          onClick={() => onChangeView('kitchen')}
        >
          Kitchen
        </button>
        <button
          type="button"
          className={`orders-subnav-btn${currentView === 'incidents' ? ' active' : ''}`}
          onClick={() => onChangeView('incidents')}
        >
          Incidencias
        </button>
        <button
          type="button"
          className={`orders-subnav-btn${currentView === 'history' ? ' active' : ''}`}
          onClick={() => onChangeView('history')}
        >
          Historial
        </button>
      </div>

      {currentView === 'history' ? (
        <div className="orders-subnav secondary">
          {([
            ['all', 'Todos'],
            ['kiosk', 'Kiosko'],
            ['qr_order', 'QR'],
            ['uber', 'Uber'],
            ['glovo', 'Glovo'],
            ['just_eat', 'Just Eat'],
            ['deliveroo', 'Deliveroo'],
            ['manual', 'Comandero'],
          ] as Array<[OrdersHistoryChannelFilter, string]>).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`orders-subnav-btn${historyChannelFilter === value ? ' active' : ''}`}
              onClick={() => onChangeHistoryChannelFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="orders-board">
        <OrderRail
          orders={visibleOrders}
          selectedOrderId={selectedOrderId}
          onSelect={onSelectOrder}
          onAdvanceStatus={currentView === 'incidents' ? undefined : onAdvanceStatus}
          updatingOrderId={updatingOrderId}
        />
      </div>
    </div>
  );
}
