// src/components/layout/BottomNav.tsx
import { useLocation, useNavigate } from 'react-router-dom'
import { useCartStore } from '@/store/useCartStore'
import styles from './BottomNav.module.css'

const TABS = [
  {
    id: 'menu',
    path: '/menu',
    label: 'Menú',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    id: 'cart',
    path: '/cesta',
    label: 'Cesta',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
      </svg>
    ),
  },
  {
    id: 'pedidos',
    path: '/pedidos',
    label: 'Pedidos',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
    ),
  },
  {
    id: 'perfil',
    path: '/perfil',
    label: 'Perfil',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const totalItems = useCartStore(s => s.totalItems())

  return (
    <nav className={styles.nav}>
      {TABS.map(tab => {
        const isActive = pathname.startsWith(tab.path)
        return (
          <button
            key={tab.id}
            className={`${styles.btn} ${isActive ? styles.active : ''}`}
            onClick={() => navigate(tab.path)}
          >
            <div className={styles.iconWrap}>
              {tab.icon}
              {tab.id === 'cart' && totalItems > 0 && (
                <span className={styles.badge}>{totalItems}</span>
              )}
            </div>
            <span className={styles.label}>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
