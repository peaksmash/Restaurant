import React, { useMemo, useState } from 'react';
import { OrderRail } from '../components/OrderRail';
import type { OrdersDataSourceMode, OrdersSessionRecord } from '../types';

interface PendingPageProps {
  orders: OrdersSessionRecord[];
  selectedOrderId: string | null;
  dataSourceMode: OrdersDataSourceMode;
  recoveryError?: string | null;
  connectionError?: string | null;
  recoverySearching?: boolean;
  onSelectOrder: (orderId: string) => void;
  onRecoverOrder: (tokenOrCode: string) => Promise<void>;
}

export function PendingPage({
  orders,
  selectedOrderId,
  dataSourceMode,
  recoveryError = null,
  connectionError = null,
  recoverySearching = false,
  onSelectOrder,
  onRecoverOrder,
}: PendingPageProps) {
  const [query, setQuery] = useState('');

  const filteredOrders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return orders;

    return orders.filter((order) => {
      const haystack = [
        order.pin4,
        order.qrToken,
        order.externalId,
        order.tableName,
        order.tableNameSnapshot,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalized);
    });
  }, [orders, query]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onRecoverOrder(query);
  }

  return (
    <div className="orders-page">
      <header className="page-header">
        <div>
          <p className="section-kicker">Cobro pendiente</p>
          <h1>Pendientes</h1>
          <p className="page-copy">
            Cuentas pendientes de cobro aún no enviadas a Last. Aquí solo mostramos las últimas 24 horas.
          </p>
          {connectionError ? <p className="detail-note">{connectionError}</p> : null}
        </div>
      </header>

      <div className="pending-toolbar">
        <form className="pending-actions" onSubmit={handleSubmit}>
          <label className="search-field">
            Buscar por PIN4 o código
            <input
              type="text"
              value={query}
              placeholder="Ej. 5501 o rqt_..."
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button type="submit" className="primary-btn" disabled={recoverySearching || query.trim().length === 0}>
            {recoverySearching ? 'Buscando...' : 'Recuperar cuenta'}
          </button>
        </form>

        <div className="pending-toolbar-copy">
          <p className="detail-note">
            {dataSourceMode === 'real'
              ? 'Cobros pendientes reales de las últimas 24 horas.'
              : 'Modo demo — sin backend real. El rescate usa datos locales de ejemplo.'}
          </p>
          {recoveryError ? <p className="detail-note error-copy">{recoveryError}</p> : null}
        </div>
      </div>

      <div className="orders-board">
        <OrderRail orders={filteredOrders} selectedOrderId={selectedOrderId} onSelect={onSelectOrder} />
      </div>
    </div>
  );
}
