import React, { useEffect, useState } from 'react';
import type { Order } from '../api';
import { getOrders } from '../api';

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function money(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    created: 'badge-blue',
    sent: 'badge-blue',
    completed: 'badge-green',
    failed: 'badge-red',
    error: 'badge-red',
  };
  const cls = map[status] ?? 'badge-gray';
  return <span className={`badge ${cls}`}>{status}</span>;
}

export function OrdersTab() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setOrders(await getOrders());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      // Treat 404 as "endpoint not implemented yet"
      if (msg.includes('404') || msg.includes('not found')) {
        setError('__not_implemented__');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  if (loading) {
    return (
      <div className="tab-content">
        <div className="card center-content">
          <div className="spinner" />
          <p className="hint">Cargando pedidos…</p>
        </div>
      </div>
    );
  }

  if (error === '__not_implemented__') {
    return (
      <div className="tab-content">
        <div className="card center-content">
          <p className="not-impl-icon">📦</p>
          <p className="hint">Histórico de pedidos pendiente de backend.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tab-content">
        <div className="card">
          <p className="msg msg-error">{error}</p>
          <button className="btn btn-secondary" onClick={load}>Reintentar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-content">
      <div className="card">
        <div className="card-header">
          <h2>Pedidos recientes</h2>
          <button className="btn btn-secondary btn-sm" onClick={load}>↻ Actualizar</button>
        </div>

        {orders && orders.length === 0 ? (
          <p className="hint">No hay pedidos todavía.</p>
        ) : (
          <div className="table-wrapper">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {(orders ?? []).map((order) => (
                  <tr key={order.id}>
                    <td className="mono-id">{order.orderCode ?? '—'}</td>
                    <td>{order.customerName ?? <span className="muted">—</span>}</td>
                    <td className="td-right">{money(order.total)}</td>
                    <td><StatusBadge status={order.status} /></td>
                    <td className="muted">{formatDate(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
