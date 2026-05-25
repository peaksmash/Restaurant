import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCartStore } from '@/store/useCartStore'
import { useRestaurantStore } from '@/store/useRestaurantStore'
import styles from './LandingPage.module.css'

export default function LandingPage() {
  const navigate = useNavigate()
  const { setMode } = useCartStore()
  const { config, load } = useRestaurantStore()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    void load()
  }, [load])

  const restaurantName = formatRestaurantName(config?.restaurantName)

  return (
    <div className={styles.page}>
      <div className={styles.glowA} />
      <div className={styles.glowB} />

      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.logoWrap}>
            {config?.logoUrl && !failed ? (
              <img className={styles.logoImg} src={config.logoUrl} alt={restaurantName} onError={() => setFailed(true)} />
            ) : (
              <div className={styles.logoFallback}>{restaurantName.trim()[0]?.toUpperCase() ?? 'R'}</div>
            )}
          </div>

          <div className={styles.eyebrow}>
            <BurgerIcon />
            Pedido online
          </div>
          <h1 className={styles.title}>{restaurantName}</h1>
          <p className={styles.subtitle}>
            Elige cómo quieres pedir y entra directamente al menú.
          </p>

          <div className={styles.restaurant}>
            <span className={styles.restaurantLabel}>Selecciona una opción</span>
          </div>
        </section>

        <div className={styles.actions}>
          <button
            className={styles.modeCard}
            type="button"
            onClick={() => {
              setMode('domicilio')
              navigate('/menu')
            }}
          >
            <span className={styles.modeIcon}><DeliveryIcon /></span>
            <span className={styles.modeContent}>
              <span className={styles.modeTitle}>Domicilio</span>
              <span className={styles.modeText}>Entrega a domicilio con zona y tarifa real.</span>
            </span>
            <span className={styles.modeArrow}><ArrowRightIcon /></span>
          </button>

          <button
            className={styles.modeCard}
            type="button"
            onClick={() => {
              setMode('recoger')
              navigate('/menu')
            }}
          >
            <span className={styles.modeIcon}><BagIcon /></span>
            <span className={styles.modeContent}>
              <span className={styles.modeTitle}>Recoger</span>
              <span className={styles.modeText}>Haz tu pedido y recógelo en el local.</span>
            </span>
            <span className={styles.modeArrow}><ArrowRightIcon /></span>
          </button>
        </div>
      </div>
    </div>
  )
}

function BurgerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 10a8 8 0 0 1 16 0" />
      <path d="M4 10h16" />
      <path d="M5 14h14" />
      <path d="M6 18h12" />
    </svg>
  )
}

function DeliveryIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 16V6a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v9h2" />
      <path d="M15 8h3l4 4v4h-2" />
      <circle cx="6.5" cy="17.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  )
}

function BagIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 7V6a6 6 0 0 1 12 0v1" />
      <path d="M5 7h14l-1 13H6L5 7Z" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="M13 5l7 7-7 7" />
    </svg>
  )
}

function formatRestaurantName(value: string | undefined | null) {
  const raw = (value || 'Tu restaurante').trim()
  return raw
    .replace(/\s+location$/i, '')
    .replace(/\s+store$/i, '')
    .replace(/\s+restaurant$/i, '')
    .trim() || 'Tu restaurante'
}
