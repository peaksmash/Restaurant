import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getQrOrderSession } from '@/lib/api'
import type { QrOrderSessionStatus } from '@/lib/api'
import { formatEuro } from '@/lib/utils'
import styles from './OrderStatusPage.module.css'

const POLL_INTERVAL_MS = 3000

export default function OrderStatusPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const redirectStatus = searchParams.get('redirect_status') // set by Stripe after redirect
  const [session, setSession] = useState<QrOrderSessionStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = () => {
    if (!id) return
    getQrOrderSession(id)
      .then((data) => {
        setSession(data)
        setError(null)
        // Stop polling once payment is confirmed or definitively failed
        if (data.paymentStatus === 'paid' || data.paymentStatus === 'refunded') {
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
        }
      })
      .catch(() => {
        setError('No se pudo obtener el estado del pedido')
      })
  }

  useEffect(() => {
    if (!id) return
    poll()
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [id])

  const paymentStatus = session?.paymentStatus ?? (redirectStatus === 'succeeded' ? 'paid' : redirectStatus === 'failed' ? 'payment_failed' : 'payment_pending')
  const isPaid = paymentStatus === 'paid' || redirectStatus === 'succeeded'
  const isFailed = paymentStatus === 'payment_failed' || redirectStatus === 'failed'

  return (
    <div className={styles.page}>
      <div className={`${styles.iconWrap} ${isPaid ? styles.iconOk : isFailed ? styles.iconFailed : styles.iconPending}`}>
        {isPaid ? <CheckIcon /> : isFailed ? <XIcon /> : <ClockIcon />}
      </div>

      <h1 className={styles.title}>
        {isPaid
          ? '¡Pedido recibido!'
          : isFailed
            ? 'Pago no completado'
            : 'Procesando tu pedido...'}
      </h1>

      <p className={styles.sub}>
        {isPaid
          ? 'Estamos preparándolo. Te avisaremos cuando esté listo.'
          : isFailed
            ? 'El pago no se ha podido completar. Puedes intentarlo de nuevo.'
            : 'Confirmando tu pago. Esto solo tardará un momento.'}
      </p>

      {session && (
        <div className={styles.infoCard}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Pedido</span>
            <span className={styles.infoVal}>#{id?.slice(-6).toUpperCase()}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Total</span>
            <span className={styles.infoVal}>{formatEuro(session.totals.total)}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Estado</span>
            <span className={`${styles.badge} ${isPaid ? styles.badgePaid : isFailed ? styles.badgeFailed : styles.badgePending}`}>
              {isPaid ? 'Pagado' : isFailed ? 'Fallido' : 'Pendiente'}
            </span>
          </div>
        </div>
      )}

      {error && !session && (
        <div className={styles.infoCard} style={{ color: '#888', fontSize: 14 }}>
          {error}
        </div>
      )}

      <div className={styles.actions}>
        {isPaid && (
          <button className={styles.primaryBtn} onClick={() => navigate('/pedidos')}>
            Ver mis pedidos
          </button>
        )}
        {isFailed && (
          <button className={styles.primaryBtn} onClick={() => navigate('/cesta')}>
            Volver a la cesta
          </button>
        )}
        <button className={styles.secondaryBtn} onClick={() => navigate('/menu')}>
          Ir al menú
        </button>
      </div>

      {!isPaid && !isFailed && (
        <p className={styles.pollingNote}>Actualizando cada {POLL_INTERVAL_MS / 1000}s...</p>
      )}
    </div>
  )
}

function CheckIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}
