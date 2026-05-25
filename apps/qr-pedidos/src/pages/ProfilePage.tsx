import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import { useCustomerStore } from '@/store/useCustomerStore'
import styles from './ProfilePage.module.css'

export default function ProfilePage() {
  const { user, logout } = useAuthStore()
  const customer = useCustomerStore((state) => state.customer)
  const points = useCustomerStore((state) => state.customer?.points ?? null)
  const refreshPoints = useCustomerStore((state) => state.refreshPoints)
  const navigate = useNavigate()

  useEffect(() => {
    if (!customer) {
      return
    }

    void refreshPoints()
  }, [customer?.id, refreshPoints])

  const initials = user?.name
    ? user.name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const guestName = localStorage.getItem('qrp_guest_name')
  const guestPhone = localStorage.getItem('qrp_guest_phone')
  const displayName = user?.name || guestName || 'Invitado'
  const displayContact = user?.email || user?.phone || guestPhone || 'Sin sesión iniciada'

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        {user?.photoURL ? (
          <img className={styles.avatarImg} src={user.photoURL} alt={displayName} />
        ) : (
          <div className={styles.avatarInitials}>{initials}</div>
        )}
        <div className={styles.userCopy}>
          <div className={styles.eyebrow}>Tu cuenta</div>
          <div className={styles.userName}>{displayName}</div>
          <div className={styles.userEmail}>{displayContact}</div>
        </div>
        {!user && (
          <button className={styles.loginBtn} onClick={() => navigate('/bienvenida')}>
            Iniciar sesión
          </button>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Mi cuenta</div>
        <button className={styles.row} onClick={() => navigate('/pedidos')}>
          <div className={styles.rowIcon}><OrdersIcon /></div>
          <span className={styles.rowLabel}>Mis pedidos</span>
          <ChevronRight />
        </button>
        <div className={styles.row}>
          <div className={styles.rowIcon}><StarIcon /></div>
          <span className={styles.rowLabel}>Puntos de fidelidad</span>
          <span className={styles.rowValue}>{points == null ? 'Sin vincular' : `${points} pts`}</span>
        </div>
        <div className={styles.row}>
          <div className={styles.rowIcon}><LocationIcon /></div>
          <span className={styles.rowLabel}>Dirección guardada</span>
          <span className={styles.rowValue}>
            {localStorage.getItem('qrp-cart') ? 'Disponible en tu próxima compra' : 'Aún no guardada'}
          </span>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Ayuda</div>
        <div className={styles.row}>
          <div className={styles.rowIcon}><ChatIcon /></div>
          <span className={styles.rowLabel}>Contactar con el restaurante</span>
          <ChevronRight />
        </div>
        <div className={styles.row}>
          <div className={styles.rowIcon}><DocumentIcon /></div>
          <span className={styles.rowLabel}>Términos y privacidad</span>
          <ChevronRight />
        </div>
      </div>

      {user && (
        <div className={styles.section}>
          <button className={styles.logoutBtn} onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function OrdersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <path d="M3 6h18" />
      <path d="M9 10h6" />
      <path d="M9 14h6" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3 2.7 5.47 6.03.88-4.36 4.25 1.03 6-5.4-2.84-5.4 2.84 1.03-6L3.27 9.35l6.03-.88L12 3Z" />
    </svg>
  )
}

function LocationIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" />
    </svg>
  )
}

function DocumentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  )
}
