import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { getOrderSession, getOrderStatus } from '@/lib/api'
import { buildQrDataUrl } from '@/lib/qrCode'
import { formatEuro } from '@/lib/utils'
import type { OrderStatusResponse, StoredOrder, StoredOrderItem } from '@/types'
import styles from './OrderTrackingPage.module.css'

const STATUS_LABELS: Record<string, string> = {
  CREATED: 'Recibido',
  KITCHEN: 'En cocina',
  READY_TO_PICKUP: 'Listo para recoger',
  ON_DELIVERY: 'En camino',
  DELIVERED: 'Entregado',
  CLOSED: 'Completado',
  CANCELLED: 'Cancelado',
  new: 'Recibido',
  accepted: 'Aceptado',
  preparing: 'Preparando',
}

const STEPS = [
  { key: 'received', label: 'Recibido', statuses: ['CREATED', 'new', 'accepted'] },
  { key: 'kitchen', label: 'Preparando', statuses: ['KITCHEN', 'preparing'] },
  { key: 'ready', label: 'Listo', statuses: ['READY_TO_PICKUP', 'ON_DELIVERY'] },
  { key: 'done', label: 'Entregado', statuses: ['DELIVERED', 'CLOSED'] },
]

function getStepIndex(status: string): number {
  for (let index = STEPS.length - 1; index >= 0; index -= 1) {
    if (STEPS[index].statuses.includes(status)) {
      return index
    }
  }
  return 0
}

export default function OrderTrackingPage() {
  const { id } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const [order, setOrder] = useState<StoredOrder | null>((state as { order?: StoredOrder } | null)?.order || null)
  const [status, setStatus] = useState<string>(((state as { order?: StoredOrder } | null)?.order?.status) || 'CREATED')
  const [paymentStatus, setPaymentStatus] = useState<string | null>((state as { order?: StoredOrder } | null)?.order?.paymentStatus ?? null)
  const [deliveryStatuses, setDeliveryStatuses] = useState<Array<Record<string, unknown>>>([])
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      return
    }

    let cancelled = false

    const poll = async () => {
      const [session, remoteStatus] = await Promise.all([
        getOrderSession(id).catch(() => null),
        getOrderStatus(id).catch(() => null),
      ])

      if (cancelled) {
        return
      }

      if (session) {
        setOrder((previous) => ({ ...(previous ?? { id, items: [], total: 0, mode: 'recoger', createdAt: new Date().toISOString() }), ...session }))
        if (session.paymentStatus) {
          setPaymentStatus(session.paymentStatus)
        }
      }

      if (remoteStatus?.delivery?.statuses) {
        setDeliveryStatuses(remoteStatus.delivery.statuses)
      }

      const nextStatus =
        remoteStatus?.status ||
        session?.lastSyncStatus ||
        session?.status ||
        'CREATED'

      setStatus(nextStatus)
      syncOrderHistory(id, nextStatus)
    }

    void poll()
    const timer = window.setInterval(poll, 15_000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [id])

  const rescueToken = order?.qrToken ?? null
  useEffect(() => {
    if (!rescueToken) {
      setQrDataUrl(null)
      return
    }
    buildQrDataUrl(rescueToken, 220).then(setQrDataUrl).catch(() => setQrDataUrl(null))
  }, [rescueToken])

  const stepIdx = getStepIndex(status)
  const isCancelled = status === 'CANCELLED'
  const deliveryTimeline = useMemo(
    () =>
      deliveryStatuses
        .map((entry, index) => ({
          id: `${index}_${String(entry.status ?? entry.name ?? entry.label ?? 'status')}`,
          label: String(entry.label ?? entry.status ?? entry.name ?? 'Actualizacion'),
          detail: String(entry.description ?? entry.timestamp ?? entry.createdAt ?? ''),
        }))
        .filter((entry) => entry.label.trim().length > 0),
    [deliveryStatuses],
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/pedidos')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className={styles.headerTitle}>Seguimiento</h1>
      </div>

      <div className={`${styles.statusHero} fu`}>
        <div className={styles.statusCode}>
          Pedido {order?.code || order?.operationalCode || `#${id?.slice(-4).toUpperCase()}`}
        </div>
        <div className={`${styles.statusLabel} ${isCancelled ? styles.cancelled : ''}`}>
          {STATUS_LABELS[status] || status}
        </div>
        <div className={styles.statusSub}>
          {isCancelled
            ? 'Tu pedido ha sido cancelado'
            : stepIdx === 3
              ? 'Buen provecho'
              : stepIdx === 2
                ? order?.mode === 'domicilio'
                  ? 'El repartidor esta en camino'
                  : 'Tu pedido esta listo para recoger'
                : stepIdx === 1
                  ? 'Estamos preparando tu pedido'
                  : 'Hemos recibido tu pedido'}
        </div>
      </div>

      {paymentStatus === 'payment_pending' && (
        <div className={styles.paymentBanner}>
          <span className={styles.paymentBannerIcon}><PendingIcon /></span>
          <span>Esperando confirmacion del pago...</span>
        </div>
      )}

      {paymentStatus === 'payment_failed' && (
        <div className={`${styles.paymentBanner} ${styles.paymentBannerError}`}>
          <span className={styles.paymentBannerIcon}><ErrorIcon /></span>
          <div className={styles.paymentBannerContent}>
            <span>El pago no pudo procesarse.</span>
            <button type="button" className={styles.paymentBannerBtn} onClick={() => navigate('/menu')}>
              Volver al menu
            </button>
          </div>
        </div>
      )}

      {order?.paymentMode === 'cashier' &&
        paymentStatus !== 'paid' &&
        order.pin4 &&
        order.qrToken && (
          <div className={styles.rescueCard}>
            <div className={styles.rescueHeader}>
              <PendingPayIcon />
              <span className={styles.rescueTitle}>Pendiente de pago en barra</span>
            </div>
            <p className={styles.rescueInfo}>
              Tu pedido esta guardado pero no enviado a cocina. Se activa cuando pagues en barra, kiosko o el personal confirme el cobro.
            </p>
            <div className={styles.rescuePin}>{order.pin4}</div>
            <div className={styles.rescueCode}>{order.qrToken}</div>
            {qrDataUrl && (
              <img src={qrDataUrl} alt="Codigo QR de pago" className={styles.rescueQr} />
            )}
            {order.expiresAt && (
              <div className={styles.rescueExpiry}>
                Valido hasta {new Date(order.expiresAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
            <button
              type="button"
              className={styles.rescueDownloadBtn}
              onClick={() => handleDownloadCode(order)}
            >
              Descargar codigo
            </button>
          </div>
        )}

      {!isCancelled && (
        <div className={styles.stepsWrap}>
          {STEPS.map((step, index) => (
            <div key={step.key} className={styles.stepGroup}>
              <div className={styles.step}>
                <div
                  className={`${styles.dot}
                    ${index < stepIdx ? styles.dotDone : ''}
                    ${index === stepIdx ? styles.dotCurrent : ''}
                  `}
                >
                  {index < stepIdx && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <div
                  className={`${styles.stepLabel}
                    ${index < stepIdx ? styles.stepLabelDone : ''}
                    ${index === stepIdx ? styles.stepLabelCurrent : ''}
                  `}
                >
                  {step.label}
                </div>
              </div>
              {index < STEPS.length - 1 && (
                <div className={`${styles.line} ${index < stepIdx ? styles.lineDone : ''}`} />
              )}
            </div>
          ))}
        </div>
      )}

      {deliveryTimeline.length > 0 && (
        <div className={styles.deliverySection}>
          <div className={styles.sectionTitle}>Seguimiento de reparto</div>
          <div className={styles.deliveryTimeline}>
            {deliveryTimeline.map((entry) => (
              <div key={entry.id} className={styles.deliveryRow}>
                <span className={styles.deliveryDot} />
                <div className={styles.deliveryText}>
                  <div className={styles.deliveryLabel}>{entry.label}</div>
                  {entry.detail && <div className={styles.deliveryDetail}>{entry.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {order?.items && (
        <div className={styles.itemsSection}>
          <div className={styles.sectionTitle}>Resumen del pedido</div>
          {order.items.map((item, index) => {
            const modExtra = (item.modifiers || []).reduce(
              (sum: number, modifier) => sum + (modifier.priceImpact || 0),
              0,
            )
            const unitPrice = (item.price || item.unitPrice || 0) + modExtra
            const qty = item.qty || item.quantity || 0

            return (
              <div key={`${item.name ?? item.productName ?? 'item'}_${index}`} className={styles.item}>
                <span className={styles.itemQty}>{qty}×</span>
                <span className={styles.itemName}>{item.name || item.productName}</span>
                <span className={styles.itemPrice}>{formatEuro(unitPrice * qty)}</span>
              </div>
            )
          })}
          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>Total</span>
            <span className={styles.totalVal}>{formatEuro(order.total || 0)}</span>
          </div>
        </div>
      )}

      <div className={styles.ctaWrap}>
        <button className={styles.ctaBtn} onClick={() => navigate('/menu')}>
          Hacer otro pedido
        </button>
      </div>
    </div>
  )
}

async function handleDownloadCode(order: StoredOrder) {
  if (!order.pin4 || !order.qrToken) return

  const W = 1200
  const H = 820
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Background
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, W, H)

  // Accent bar at top
  ctx.fillStyle = '#f59e0b'
  ctx.fillRect(0, 0, W, 8)

  // Title
  ctx.fillStyle = '#94a3b8'
  ctx.font = '700 32px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('PENDIENTE DE PAGO EN BARRA', W / 2, 70)

  // PIN label
  ctx.fillStyle = '#64748b'
  ctx.font = '600 24px system-ui, sans-serif'
  ctx.fillText('PIN DE PAGO', W / 2, 130)

  // PIN value
  ctx.fillStyle = '#f59e0b'
  ctx.font = '900 160px system-ui, sans-serif'
  ctx.fillText(order.pin4, W / 2, 310)

  // QR
  const qrUrl = await buildQrDataUrl(order.qrToken, 280)
  const qrImg = new Image()
  await new Promise<void>((resolve) => {
    qrImg.onload = () => resolve()
    qrImg.src = qrUrl
  })
  const qrX = (W - 280) / 2
  ctx.fillStyle = '#ffffff'
  ctx.roundRect(qrX - 12, 338, 304, 304, 16)
  ctx.fill()
  ctx.drawImage(qrImg, qrX, 350, 280, 280)

  // Alpha-numeric code
  ctx.fillStyle = '#94a3b8'
  ctx.font = '600 20px monospace, system-ui'
  ctx.fillText(order.qrToken, W / 2, 690)

  // Bottom note
  ctx.fillStyle = '#475569'
  ctx.font = '500 18px system-ui, sans-serif'
  ctx.fillText('Muestra este codigo en barra o kiosko para pagar y activar tu pedido', W / 2, 760)

  const link = document.createElement('a')
  link.download = `pedido-${order.pin4}-codigo.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

function syncOrderHistory(orderId: string, status: string) {
  const raw = localStorage.getItem('qrp_orders')
  if (!raw) {
    return
  }

  const orders = JSON.parse(raw) as StoredOrder[]
  const nextOrders = orders.map((entry) =>
    entry.id === orderId ? { ...entry, status } : entry,
  )

  localStorage.setItem('qrp_orders', JSON.stringify(nextOrders))
}

function PendingPayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01" />
      <path d="M18 12h.01" />
    </svg>
  )
}

function PendingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9 9 15" />
      <path d="m9 9 6 6" />
    </svg>
  )
}
