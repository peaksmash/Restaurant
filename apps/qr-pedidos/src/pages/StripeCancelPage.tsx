import { useSearchParams, useNavigate } from 'react-router-dom'
import styles from './StripeStatusPage.module.css'

export default function StripeCancelPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const orderSessionId = searchParams.get('orderSessionId')

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={`${styles.iconWrap} ${styles.iconWrapError}`}>
          <CancelIcon />
        </div>
        <div className={styles.title}>Pago cancelado</div>
        <div className={styles.text}>
          Has cancelado el pago. Tu pedido no ha sido procesado.
          {orderSessionId ? ` Pedido ${orderSessionId}.` : ''}
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.primaryBtn} onClick={() => navigate('/menu')}>
            Volver al menu
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={() => navigate('/pedidos')}>
            Ver mis pedidos
          </button>
        </div>
      </div>
    </div>
  )
}

function CancelIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9 9 15" />
      <path d="m9 9 6 6" />
    </svg>
  )
}
