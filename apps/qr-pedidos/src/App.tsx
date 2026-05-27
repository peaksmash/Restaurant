import { useEffect, useMemo } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { CompositionModal } from '@/components/suggestions/CompositionModal'
import { UpsellPopup } from '@/components/suggestions/UpsellPopup'
import AppShell from '@/components/layout/AppShell'
import BottomNav from '@/components/layout/BottomNav'
import Toast from '@/components/ui/Toast'
import PhoneSetupModal from '@/components/ui/PhoneSetupModal'
import { useSuggestionEngine } from '@/hooks/useSuggestionEngine'
import LandingPage from '@/pages/LandingPage'
import CartPage from '@/pages/CartPage'
import MenuPage from '@/pages/MenuPage'
import OrdersPage from '@/pages/OrdersPage'
import OrderTrackingPage from '@/pages/OrderTrackingPage'
import ProfilePage from '@/pages/ProfilePage'
import StripeCancelPage from '@/pages/StripeCancelPage'
import StripeSuccessPage from '@/pages/StripeSuccessPage'
import WelcomePage from '@/pages/WelcomePage'
import { useAuthStore } from '@/store/useAuthStore'
import { useCartStore } from '@/store/useCartStore'
import { useRestaurantStore } from '@/store/useRestaurantStore'

export default function App() {
  const { init, loading } = useAuthStore()
  const cartItems = useCartStore((state) => state.items)
  const addItem = useCartStore((state) => state.addItem)
  const { catalog, load } = useRestaurantStore()

  useEffect(() => {
    const unsub = init()
    return unsub
  }, [init])

  useEffect(() => {
    void load()
  }, [load])

  const suggestionCatalog = useMemo(() => {
    if (!catalog) {
      return []
    }

    return catalog.categories.flatMap((category) =>
      category.products.map((product) => ({
        ...product,
        categoryId: category.id,
        categoryName: category.name,
      })),
    )
  }, [catalog])

  const suggestionEngine = useSuggestionEngine({
    catalog: suggestionCatalog,
    cartItems,
    sessionId: 'qr-pedidos-session',
  })

  useEffect(() => {
    suggestionEngine.setOnAddProduct((productId: string) => {
      const product = suggestionCatalog.find((item) => item.id === productId)
      if (!product) {
        return
      }

      addItem({
        productId: product.id,
        name: product.name,
        price: product.price,
        qty: 1,
        imageUrl: product.imageUrl,
        emoji: product.emoji,
        modifiers: [],
      })
    })
  }, [addItem, suggestionCatalog, suggestionEngine])

  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/bienvenida" element={<WelcomePage />} />
        <Route path="/menu" element={<WithNav><MenuPage suggestionEngine={suggestionEngine} /></WithNav>} />
        <Route path="/cesta" element={<CartPage suggestionEngine={suggestionEngine} />} />
        <Route path="/pedidos" element={<WithNav><OrdersPage /></WithNav>} />
        <Route path="/pedidos/:id" element={<OrderTrackingPage />} />
        <Route path="/pedido/success" element={<StripeSuccessPage />} />
        <Route path="/pedido/cancel" element={<StripeCancelPage />} />
        <Route path="/perfil" element={<WithNav><ProfilePage /></WithNav>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {suggestionEngine.activeComposition && (
        <CompositionModal
          data={suggestionEngine.activeComposition}
          onConfirm={suggestionEngine.acceptComposition}
          onDismiss={suggestionEngine.dismissComposition}
        />
      )}
      {!suggestionEngine.activeComposition && suggestionEngine.activeUpsell && (
        <UpsellPopup
          suggestion={suggestionEngine.activeUpsell}
          onAccept={() => suggestionEngine.acceptUpsell()}
          onDismiss={(_, outcome) => suggestionEngine.dismissUpsell(outcome)}
        />
      )}
      <PhoneSetupModal />
      <Toast />
    </AppShell>
  )
}

function WithNav({
  children,
  noNav = false,
}: {
  children: React.ReactNode
  noNav?: boolean
}) {
  return (
    <>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
      {!noNav && <BottomNav />}
    </>
  )
}
