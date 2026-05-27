import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMyOrders } from '@/lib/api'
import { useAuthStore } from '@/store/useAuthStore'
import { formatEuro } from '@/lib/utils'
import type { StoredOrder } from '@/types'
import styles from './OrdersPage.module.css'

const STATUS_LABELS: Record<string, string> = {
  new: 'Recibido',
  pending: 'Recibido',
  accepted: 'Aceptado',
  preparing: 'Preparando',
  ready: 'Listo',
  delivering: 'En camino',
  delivered: 'Entregado',
  closed: 'Completado',
  cancelled: 'Cancelado',
  // Last App statuses
  CREATED: 'Recibido',
  KITCHEN: 'Preparando',
  READY_TO_PICKUP: 'Listo',
  ON_DELIVERY: 'En camino',
  DELIVERED: 'Entregado',
  CLOSED: 'Completado',
  CANCELLED: 'Cancelado',
}

const STATUS_CLASS: Record<string, string> = {
  delivered: 'green', DELIVERED: 'green',
  closed: 'green', CLOSED: 'green',
  cancelled: 'red', CANCELLED: 'red',
}

export default function OrdersPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const uid = (!user?.isAnonymous && user?.uid) ? user.uid : null

  const [orders, setOrders] = useState<StoredOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    if (!uid) {
      // Invitado: localStorage
      try {
        const local = JSON.parse(localStorage.getItem('qrp_orders') || '[]') as StoredOrder[]
        setOrders(local)
      } catch {
        setOrders([])
      }
      setLoading(false)
      return
    }

    getMyOrders(uid)
      .then(({ orders: fetched }) => {
        if (!cancelled) setOrders(fetched)
      })
      .catch(() => {
        if (!cancelled) setOrders([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [uid])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Historial</div>
          <h1 className={styles.title}>Mis pedidos</h1>
        </div>
      </div>

      {loading ? (
        <div className={styles.empty} style={{ opacity: 0.4 }}>Cargando...</div>
      ) : orders.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}><BoxIcon /></div>
          <div className={styles.emptyTitle}>Todavía no has pedido</div>
          <div className={styles.emptySub}>Cuando hagas tu primer pedido aparecerá aquí con su seguimiento.</div>
          <button className={styles.emptyBtn} onClick={() => navigate('/menu')}>
            Ir al menú
          </button>
        </div>
      ) : (
        <div className={styles.list}>
          {orders.map((order, index) => {
            const statusLabel = STATUS_LABELS[order.status ?? ''] ?? order.status ?? 'Procesando'
            const statusClass = STATUS_CLASS[order.status ?? ''] ?? 'orange'
            return (
              <div
                key={order.id || index}
                className={`${styles.card} fu`}
                style={{ animationDelay: `${index * 0.05}s` }}
                onClick={() => navigate(`/pedidos/${order.id}`, { state: { order } })}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.cardCodeWrap}>
                    <span className={styles.cardCode}>
                      {order.code || `#${order.id?.slice(-4).toUpperCase()}`}
                    </span>
                    <span className={styles.cardDate}>
                      {new Date(order.createdAt).toLocaleDateString('es-ES', {
                        day: 'numeric', month: 'short',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <span className={`${styles.cardStatus} ${styles[statusClass]}`}>{statusLabel}</span>
                </div>

                <div className={styles.cardItems}>
                  {(order.items || [])
                    .map((item) => `${item.qty ?? item.quantity ?? 0}× ${item.name ?? item.productName ?? 'Producto'}`)
                    .join(' · ')}
                </div>

                <div className={styles.cardFooter}>
                  <span className={styles.cardMode}>
                    <span className={styles.cardModeIcon}>
                      {order.mode === 'mesa' ? <TableIcon /> : order.mode === 'recoger' ? <BagIcon /> : <DeliveryIcon />}
                    </span>
                    {order.mode === 'mesa' ? 'Mesa' : order.mode === 'recoger' ? 'Recoger' : 'Domicilio'}
                  </span>
                  <span className={styles.cardTotal}>{formatEuro(order.total || 0)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function BoxIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8.5 12 13 3 8.5" /><path d="M3 8.5 12 4l9 4.5v7L12 20l-9-4.5v-7Z" /><path d="M12 13v7" />
    </svg>
  )
}
function DeliveryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 16V6a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v9h2" /><path d="M15 8h3l4 4v4h-2" />
      <circle cx="6.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  )
}
function BagIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 7V6a6 6 0 0 1 12 0v1" /><path d="M5 7h14l-1 13H6L5 7Z" />
    </svg>
  )
}
function TableIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10h18" /><path d="M5 10v9" /><path d="M19 10v9" /><path d="M8 5h8a2 2 0 0 1 2 2v3H6V7a2 2 0 0 1 2-2Z" />
    </svg>
  )
}
