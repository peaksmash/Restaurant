import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getOrderSession } from '@/lib/api'
import { useCustomerStore } from '@/store/useCustomerStore'
import type { StoredOrder } from '@/types'
import styles from './StripeStatusPage.module.css'

type SuccessState = 'generic' | 'pending' | 'timeout' | 'failed'

export default function StripeSuccessPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const syncAfterOrder = useCustomerStore((state) => state.syncAfterOrder)
  const customer = useCustomerStore((state) => state.customer)
  const pendingOrderId = sessionStorage.getItem('stripe_pending_order')
  const [status, setStatus] = useState<SuccessState>(pendingOrderId ? 'pending' : 'generic')
  const confirmedRef = useRef(false)
  const settledRef = useRef(false)
  const stripeSessionId = searchParams.get('session_id')
  const orderSessionId = searchParams.get('orderSessionId')

  useEffect(() => {
    if (!pendingOrderId) {
      return
    }

    let cancelled = false

    const poll = async () => {
      const session = await getOrderSession(pendingOrderId).catch(() => null)
      if (cancelled || settledRef.current || !session) {
        return
      }

      if (session.paymentStatus === 'payment_failed') {
        settledRef.current = true
        setStatus('failed')
        return
      }

      if (session.paymentStatus !== 'paid' || confirmedRef.current) {
        return
      }

      confirmedRef.current = true
      settledRef.current = true
      sessionStorage.removeItem('stripe_pending_order')

      if (customer) {
        await syncAfterOrder(session.total || 0).catch(() => undefined)
      }

      if (!cancelled) {
        navigate(`/pedidos/${pendingOrderId}`, {
          replace: true,
          state: { order: session as StoredOrder },
        })
      }
    }

    void poll()
    const intervalId = window.setInterval(() => {
      void poll()
    }, 3_000)
    const timeoutId = window.setTimeout(() => {
      if (!cancelled && !confirmedRef.current) {
        settledRef.current = true
        setStatus('timeout')
      }
    }, 90_000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.clearTimeout(timeoutId)
    }
  }, [customer, navigate, pendingOrderId, syncAfterOrder])

  if (status === 'failed') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={`${styles.iconWrap} ${styles.iconWrapError}`}>
            <ErrorIcon />
          </div>
          <div className={styles.title}>Pago no completado</div>
          <div className={styles.text}>El pago no pudo procesarse. Puedes volver al menu y hacer un nuevo intento.</div>
          <div className={styles.actions}>
            <button type="button" className={styles.primaryBtn} onClick={() => navigate('/menu')}>
              Volver al menu
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'timeout') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.iconWrap}>
            <ClockIcon />
          </div>
          <div className={styles.title}>Pago en proceso</div>
          <div className={styles.text}>Tu pago esta siendo procesado. Recibiras confirmacion en breve.</div>
          <div className={styles.actions}>
            <button type="button" className={styles.primaryBtn} onClick={() => navigate('/pedidos')}>
              Ver mis pedidos
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'generic') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.iconWrap}>
            <CheckIcon />
          </div>
          <div className={styles.title}>Vuelta desde el pago</div>
          <div className={styles.text}>
            Si tu pago ya se ha confirmado, veras el pedido actualizado en unos instantes.
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.primaryBtn} onClick={() => navigate('/pedidos')}>
              Ver mis pedidos
            </button>
            <button type="button" className={styles.secondaryBtn} onClick={() => navigate('/menu')}>
              Volver al menu
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.iconWrap}>
          <ClockIcon />
        </div>
        <div className={styles.title}>Confirmando tu pago...</div>
        <div className={styles.text}>
          Estamos esperando la confirmacion segura del cobro desde el backend.
        </div>
        {(stripeSessionId || orderSessionId) && (
          <div className={styles.text}>
            Pedido {pendingOrderId ?? orderSessionId ?? 'pendiente'} en comprobacion.
          </div>
        )}
        <div className={styles.spinnerWrap}>
          <div className="spinner" />
        </div>
      </div>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9 9 15" />
      <path d="m9 9 6 6" />
    </svg>
  )
}
