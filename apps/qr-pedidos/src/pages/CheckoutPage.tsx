import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { createOrderSessionDraft, createPaymentIntent } from '@/lib/api'
import type { LastDeliveryInput, LastDeliveryAreaSnapshot } from '@/lib/api'
import { findMatchingDeliveryArea, getDeliveryAreaFee, getEnabledDeliveryAreas } from '@/lib/delivery'
import { formatEuro } from '@/lib/utils'
import { useCartStore } from '@/store/useCartStore'
import { useRestaurantStore } from '@/store/useRestaurantStore'
import styles from './CheckoutPage.module.css'

const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY ?? ''
const stripePromise = STRIPE_KEY ? loadStripe(STRIPE_KEY) : null

const QR_SERVER_TENANT = import.meta.env.VITE_QR_SERVER_TENANT as string
const QR_SERVER_LOCATION_KEY = import.meta.env.VITE_QR_SERVER_LOCATION_KEY as string

export default function CheckoutPage() {
  const navigate = useNavigate()
  const { items, mode, address, addressLat, addressLng, subtotal } = useCartStore()
  const { locationInfo, orderMode: bootstrapOrderMode } = useRestaurantStore()

  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [orderSessionId, setOrderSessionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const enabledDeliveryAreas = getEnabledDeliveryAreas(locationInfo?.deliveryAreas)
  const matchedDeliveryArea = mode === 'domicilio'
    ? findMatchingDeliveryArea(enabledDeliveryAreas, addressLat, addressLng)
    : null
  const deliveryFee = mode === 'domicilio' ? getDeliveryAreaFee(matchedDeliveryArea) : 0
  const sub = subtotal()
  const total = sub + deliveryFee

  useEffect(() => {
    if (items.length === 0) {
      navigate('/cesta', { replace: true })
      return
    }
    if (!stripePromise) {
      setError('Stripe no está configurado. Contacta con el restaurante.')
      setLoading(false)
      return
    }

    let cancelled = false

    const init = async () => {
      try {
        const draftItems = items.map((item) => {
          const modifiersTotal = item.modifiers.reduce((sum, m) => sum + m.priceImpact, 0)
          const unitPrice = item.price + modifiersTotal
          return {
            productId: item.productId,
            productName: item.name,
            quantity: item.qty,
            unitPrice,
            totalPrice: unitPrice * item.qty,
            notes: item.notes ?? null,
            modifiers: item.modifiers.map((m) => ({
              modifierId: m.id,
              modifierName: m.name,
              quantity: 1,
              unitPrice: m.priceImpact,
              totalPrice: m.priceImpact,
            })),
          }
        })

        let lastDeliveryInput: LastDeliveryInput | null = null
        let lastDeliveryAreaSnapshot: LastDeliveryAreaSnapshot | null = null

        if (mode === 'domicilio' && addressLat != null && addressLng != null) {
          const fee = matchedDeliveryArea?.deliveryFee ?? deliveryFee
          lastDeliveryInput = {
            address,
            details: null,
            latitude: addressLat,
            longitude: addressLng,
            fee,
            external: false,
          }
          if (matchedDeliveryArea) {
            lastDeliveryAreaSnapshot = {
              id: matchedDeliveryArea.id ?? null,
              name: matchedDeliveryArea.name ?? null,
              deliveryFee: fee,
              minimumBasket: matchedDeliveryArea.minimumBasket ?? 0,
              estimatedDeliveryMinutes: matchedDeliveryArea.estimatedDeliveryMinutes ?? 0,
            }
          }
        }

        const session = await createOrderSessionDraft({
          tenant: QR_SERVER_TENANT,
          locationKey: QR_SERVER_LOCATION_KEY,
          orderMode: bootstrapOrderMode,
          paymentMode: 'online',
          items: draftItems,
          totals: { subtotal: sub, deliveryFee, total, currency: 'EUR' },
          lastDeliveryInput,
          lastDeliveryAreaSnapshot,
        })

        if (cancelled) return
        setOrderSessionId(session.orderSessionId)

        const intent = await createPaymentIntent(session.orderSessionId)
        if (cancelled) return
        setClientSecret(intent.clientSecret)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error al preparar el pago')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void init()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className={styles.centerState}>
        <div className="spinner" />
        <div className={styles.stateSub}>Preparando tu pago...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.centerState}>
        <div className={styles.stateTitle}>No se pudo iniciar el pago</div>
        <div className={styles.stateSub}>{error}</div>
        <button className={styles.retryBtn} onClick={() => navigate('/cesta')}>
          Volver a la cesta
        </button>
      </div>
    )
  }

  if (!clientSecret || !stripePromise || !orderSessionId) {
    return null
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/cesta')} type="button" aria-label="Volver">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className={styles.title}>Pago</h1>
      </div>

      <div className={styles.scroll}>
        <div className={styles.orderSummary}>
          <div className={styles.summaryTitle}>Resumen</div>
          <div className={styles.summaryRow}>
            <span>Subtotal</span>
            <span>{formatEuro(sub)}</span>
          </div>
          {mode === 'domicilio' && (
            <div className={styles.summaryRow}>
              <span>Envío</span>
              <span>{formatEuro(deliveryFee)}</span>
            </div>
          )}
          <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
            <span>Total</span>
            <span>{formatEuro(total)}</span>
          </div>
        </div>

        <div className={styles.paymentCard}>
          <div className={styles.paymentTitle}>Datos de pago</div>
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: { theme: 'stripe', variables: { colorPrimary: '#ffc200', borderRadius: '8px' } },
            }}
          >
            <CheckoutForm orderSessionId={orderSessionId} total={total} />
          </Elements>
        </div>
      </div>
    </div>
  )
}

// ── Checkout form (must live inside <Elements>) ─────────────────

function CheckoutForm({ orderSessionId, total }: { orderSessionId: string; total: number }) {
  const stripe = useStripe()
  const elements = useElements()
  const clearCart = useCartStore((s) => s.clearCart)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setPaying(true)
    setError(null)

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/order-status/${orderSessionId}`,
      },
    })

    // confirmPayment only resolves here on error — success triggers redirect
    if (stripeError) {
      setError(stripeError.message ?? 'Error al procesar el pago')
      setPaying(false)
    } else {
      clearCart()
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <PaymentElement />
      {error && <div className={styles.errorBox}>{error}</div>}
      <button
        type="submit"
        className={styles.submitBtn}
        disabled={!stripe || !elements || paying}
      >
        {paying ? (
          <>
            <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
            <span>Procesando...</span>
          </>
        ) : (
          `Pagar ${formatEuro(total)}`
        )}
      </button>
    </form>
  )
}
