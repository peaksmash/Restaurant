import React from 'react';

export type TabId = 'home' | 'qr-tables' | 'payments' | 'kiosks' | 'suggestions' | 'printing' | 'brand' | 'advanced';

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

interface Props {
  active: TabId;
  onChange: (id: TabId) => void;
  showAlert: boolean;
  restaurantName?: string;
  readinessTone?: 'green' | 'amber' | 'gray' | 'red';
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'home',
    label: 'Inicio',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>
        <polyline points="9,21 9,12 15,12 15,21"/>
      </svg>
    ),
  },
  {
    id: 'payments',
    label: 'Pagos',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
        <line x1="1" y1="10" x2="23" y2="10"/>
      </svg>
    ),
  },
  {
    id: 'qr-tables',
    label: 'Mesas QR',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/>
        <rect x="14" y="3" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/>
        <path d="M14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    id: 'kiosks',
    label: 'Kioskos',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    ),
  },
  {
    id: 'suggestions',
    label: 'Sugerencias',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/>
      </svg>
    ),
  },
  {
    id: 'printing',
    label: 'Impresión',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6,9 6,2 18,2 18,9"/>
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
        <rect x="6" y="14" width="12" height="8"/>
      </svg>
    ),
  },
  {
    id: 'brand',
    label: 'Marca',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <circle cx="12" cy="10" r="3"/>
        <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/>
      </svg>
    ),
  },
  {
    id: 'advanced',
    label: 'Diagnóstico',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.77 3.77z"/>
      </svg>
    ),
  },
];

export function Sidebar({ active, onChange, showAlert, restaurantName, readinessTone }: Props) {
  const isSystemOk = readinessTone === 'green';

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
            <path d="M7 2v20"/>
            <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
          </svg>
          <span className="sidebar-name">{restaurantName || 'Mi restaurante'}</span>
        </div>
        <div className="sidebar-subtitle">Panel de control</div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`sidebar-item${active === item.id ? ' active' : ''}`}
            onClick={() => onChange(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.id === 'home' && showAlert && <span className="sidebar-alert-dot" />}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-row">
          <span className="sidebar-version">v1.0</span>
          <span className={`sidebar-status-pill ${isSystemOk ? 'sidebar-status-pill--ok' : 'sidebar-status-pill--warn'}`}>
            {isSystemOk ? 'Listo' : 'Revisar'}
          </span>
        </div>
      </div>
    </aside>
  );
}

// Backwards-compatible re-export so existing imports keep working
export { Sidebar as TabBar };
