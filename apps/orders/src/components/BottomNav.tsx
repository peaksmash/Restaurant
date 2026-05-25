import React from 'react';

export type OrdersPageId = 'carta' | 'orders' | 'pending';

interface BottomNavProps {
  activePage: OrdersPageId;
  ordersBadge?: number;
  onChangePage: (page: OrdersPageId) => void;
}

const ITEMS: Array<{ id: OrdersPageId; label: string }> = [
  { id: 'carta', label: 'Carta' },
  { id: 'orders', label: 'Pedidos' },
  { id: 'pending', label: 'Pendientes' },
];

export function BottomNav({ activePage, ordersBadge = 0, onChangePage }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Navegación principal orders">
      {ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`bottom-nav-btn${activePage === item.id ? ' active' : ''}${item.id === 'orders' && ordersBadge > 0 ? ' has-badge' : ''}`}
          onClick={() => onChangePage(item.id)}
        >
          <span>{item.label}</span>
          {item.id === 'orders' && ordersBadge > 0 ? <span className="bottom-nav-badge">{ordersBadge}</span> : null}
        </button>
      ))}
    </nav>
  );
}
