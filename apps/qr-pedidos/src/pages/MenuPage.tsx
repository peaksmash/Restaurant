import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ProductModal from '@/components/menu/ProductModal'
import { getPromotionBadgeMeta } from '@/lib/promotionBadge'
import { formatEuro } from '@/lib/utils'
import { useCartStore } from '@/store/useCartStore'
import { useRestaurantStore } from '@/store/useRestaurantStore'
import type { BundleSuggestion } from '@/suggestions'
import type { CartModifier, LastModifierGroup, LastProduct } from '@/types'
import styles from './MenuPage.module.css'

interface SuggestionEngineLike {
  activeBundle: BundleSuggestion | null
  triggerBundle: (productId: string) => void
  dismissBundle: () => void
  acceptBundle: () => void
  triggerUpsell: (productId: string) => void
  triggerComposition: (productId: string, productCategoryId: string) => boolean
}

interface Props {
  suggestionEngine: SuggestionEngineLike
}

export default function MenuPage({ suggestionEngine }: Props) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { catalog, config, load, loading } = useRestaurantStore()
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [modalProduct, setModalProduct] = useState<LastProduct | null>(null)
  const categoryRefs = useRef<Record<string, HTMLElement | null>>({})
  const upsellTimeoutRef = useRef<number | null>(null)
  const [logoFailed, setLogoFailed] = useState(false)

  const {
    items,
    mode,
    setTable,
    addItem,
    changeQty,
    totalItems,
    subtotal,
  } = useCartStore()

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const tableId = params.get('table')
    const tableName = params.get('tableName') || params.get('mesa')
    if (tableId && tableName) {
      setTable(tableId, tableName)
    }
  }, [params, setTable])

  useEffect(() => () => {
    if (upsellTimeoutRef.current != null) {
      window.clearTimeout(upsellTimeoutRef.current)
    }
  }, [])

  const categories = useMemo(() => {
    if (!catalog) {
      return []
    }

    const modifierGroupMap: Record<string, LastModifierGroup> = {}
    catalog.modifierGroups.forEach((group) => {
      modifierGroupMap[group.id] = group
    })

    return catalog.categories
      .filter((category) => category.enabled)
      .map((category) => ({
        ...category,
        products: category.products
          .filter((product) => product.enabled)
          .map((product) => ({
            ...product,
            modifierGroupsFull: (product.modifierGroups || [])
              .map((id) => modifierGroupMap[id])
              .filter(Boolean),
          })),
      }))
  }, [catalog])

  useEffect(() => {
    if (!activeCategory && categories.length > 0) {
      setActiveCategory(categories[0].id)
    }
  }, [activeCategory, categories])

  const restaurantName = config?.restaurantName || 'Tu restaurante'
  const logoUrl = config?.logoUrl || null
  const cartCount = totalItems()
  const cartTotal = subtotal()
  const isTableMode = mode === 'mesa'
  const modeLabel = isTableMode ? 'Mesa' : mode === 'domicilio' ? 'Domicilio' : 'Recoger'
  const modeDescription = isTableMode
    ? 'Pedido desde QR'
    : mode === 'domicilio'
      ? 'Entrega a domicilio'
      : 'Recogida en local'

  function scrollToCategory(categoryId: string) {
    setActiveCategory(categoryId)
    categoryRefs.current[categoryId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function addProduct(
    product: LastProduct,
    modifiers: CartModifier[] = [],
    qty = 1,
    notes?: string,
    triggerSuggestions = true,
  ) {
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      qty,
      imageUrl: product.imageUrl,
      emoji: product.emoji,
      modifiers,
      notes,
    })

    const category = categories.find((entry) => entry.products.some((candidate) => candidate.id === product.id))
    const productCategoryId = category?.id ?? ''
    const openedComposition = triggerSuggestions
      ? suggestionEngine.triggerComposition(product.id, productCategoryId)
      : false

    if (!openedComposition && triggerSuggestions) {
      if (upsellTimeoutRef.current != null) {
        window.clearTimeout(upsellTimeoutRef.current)
      }

      upsellTimeoutRef.current = window.setTimeout(() => {
        suggestionEngine.triggerUpsell(product.id)
      }, 1500)
    }
  }

  function handleProductPress(product: LastProduct) {
    const hasModifiers = (product.modifierGroupsFull?.length ?? 0) > 0
    if (hasModifiers) {
      suggestionEngine.triggerBundle(product.id)
      setModalProduct(product)
      return
    }

    addProduct(product)
  }

  if (loading && categories.length === 0) {
    return (
      <div className={styles.loading}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.topBanner}>
        <div className={styles.brandBlock}>
          <div className={styles.brandLogo}>
            {logoUrl && !logoFailed ? (
              <img
                className={styles.brandLogoImg}
                src={logoUrl}
                alt={restaurantName}
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <div className={styles.brandLogoFallback}>{restaurantName.trim()[0]?.toUpperCase() ?? 'R'}</div>
            )}
          </div>
          <div className={styles.brandCopy}>
            <div className={styles.brandName}>{restaurantName}</div>
            <div className={styles.brandSub}>{modeDescription}</div>
          </div>
        </div>

        {!isTableMode && (
          <button className={styles.modePill} type="button" onClick={() => navigate('/')}>
            {modeLabel}
          </button>
        )}
      </header>

      <div className={styles.categoriesBar}>
        <div className={styles.categoriesScroller}>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`${styles.categoryPill} ${activeCategory === category.id ? styles.categoryPillActive : ''}`}
              onClick={() => scrollToCategory(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.content}>
        {categories.map((category) => (
          <section
            key={category.id}
            ref={(element) => {
              categoryRefs.current[category.id] = element
            }}
            className={styles.categorySection}
          >
            <div className={styles.categoryHeader}>
              <h2 className={styles.categoryTitle}>{category.name}</h2>
            </div>

            <div className={styles.productGrid}>
              {category.products.map((product) => {
                const qty = items
                  .filter((item) => item.productId === product.id)
                  .reduce((sum, item) => sum + item.qty, 0)
                const badge = getPromotionBadgeMeta(product.promotion)
                const hasPromoPrice = product.displayPrice != null && product.displayPrice < product.price

                return (
                  <article key={product.id} className={styles.productCard} onClick={() => handleProductPress(product)}>
                    <div className={styles.productMedia}>
                      {product.imageUrl ? (
                        <img className={styles.productImg} src={product.imageUrl} alt={product.name} />
                      ) : (
                        <div className={styles.productImgFallback}>
                          {product.emoji || product.name.trim()[0]?.toUpperCase() || 'P'}
                        </div>
                      )}
                      {badge && <span className={`${styles.promoBadge} ${styles[badge.colorClass]}`}>{badge.label}</span>}
                    </div>

                    <div className={styles.productBody}>
                      <h3 className={styles.productName}>{product.name}</h3>
                      {product.description && <p className={styles.productDesc}>{product.description}</p>}
                      <div className={styles.productFooter}>
                        <div className={styles.priceBlock}>
                          {hasPromoPrice && <span className={styles.priceOld}>{formatEuro(product.price)}</span>}
                          <span className={`${styles.price} ${hasPromoPrice ? styles.pricePromo : ''}`}>
                            {formatEuro(hasPromoPrice ? product.displayPrice ?? product.price : product.price)}
                          </span>
                        </div>

                        {qty > 0 ? (
                          <div className={styles.qtyControl} onClick={(event) => event.stopPropagation()}>
                            <button
                              className={styles.qtyBtn}
                              onClick={() => changeQty(items.find((item) => item.productId === product.id)?.cartItemId || '', -1)}
                            >
                              −
                            </button>
                            <span className={styles.qtyValue}>{qty}</span>
                            <button className={styles.qtyBtn} onClick={() => handleProductPress(product)}>+</button>
                          </div>
                        ) : (
                          <button className={styles.addBtn} type="button">
                            <PlusIcon />
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ))}

        <div style={{ height: cartCount > 0 ? 120 : 24 }} />
      </div>

      {cartCount > 0 && (
        <div className={styles.floatCartShelf}>
          <button className={styles.floatCart} onClick={() => navigate('/cesta')}>
            <span className={styles.floatCartIcon}><BagIcon /></span>
            <span className={styles.floatCartLabel}>Ver cesta · {cartCount} {cartCount === 1 ? 'producto' : 'productos'}</span>
            <span className={styles.floatCartPrice}>{formatEuro(cartTotal)}</span>
          </button>
        </div>
      )}

      {modalProduct && (
        <ProductModal
          product={modalProduct}
          bundle={
            suggestionEngine.activeBundle?.products.some((product) => product.id === modalProduct.id)
              ? suggestionEngine.activeBundle
              : null
          }
          onAcceptBundle={() => {
            suggestionEngine.acceptBundle()
            setModalProduct(null)
          }}
          onDismissBundle={() => suggestionEngine.dismissBundle()}
          onClose={() => {
            suggestionEngine.dismissBundle()
            setModalProduct(null)
          }}
          onAdd={({ product, qty, modifiers, notes }) => addProduct(product, modifiers, qty, notes)}
        />
      )}
    </div>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

function BagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 7V6a6 6 0 0 1 12 0v1" />
      <path d="M5 7h14l-1 13H6L5 7Z" />
    </svg>
  )
}
