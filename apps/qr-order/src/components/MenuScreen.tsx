import React, { useEffect, useRef, useState } from 'react';
import type { CatalogCategory, CatalogProduct, KioskCartItem } from '../api';
import { CheckIcon, ShoppingBagIcon, PlusIcon, MinusIcon } from '../Icons';
import { getPromotionBadgeMeta } from '../promotionBadge';

// ── Helper: single source of truth for "does this product need the detail screen?" ──

export function productNeedsDetail(
  product: CatalogProduct,
  modifiersEnabled: boolean,
  productCommentsEnabled: boolean,
): boolean {
  return Boolean(
    (modifiersEnabled &&
      Array.isArray(product.modifierGroups) &&
      product.modifierGroups.length > 0) ||
    productCommentsEnabled
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  categories: CatalogCategory[];
  cart: KioskCartItem[];
  cartTotal: number;
  contextLabel: string;
  theme: string;
  restaurantName: string;
  logoUrl?: string;
  modifiersEnabled: boolean;
  productCommentsEnabled: boolean;
  cartQuantityByProductId: Map<string, number>;
  addedSignal: number;
  lastAddedProductId: string | null;
  lastAddedFromDetail: boolean;
  /** Called when a product should be added directly (no modifiers needed). */
  onAddToCart: (product: CatalogProduct) => void;
  /** Called when a product needs modifier selection before adding. */
  onOpenDetail: (product: CatalogProduct) => void;
  onRemoveLast: (productId: string) => void;
  onViewCart: () => void;
  onConsumeAddedFromDetail: () => void;
  tableLabel: string;
}

function money(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

// ── Image components ──────────────────────────────────────────────────────────

function ProductImg({ product }: { product: CatalogProduct }) {
  const [failed, setFailed] = useState(false);
  if (product.imageUrl && !failed) {
    return (
      <img
        className="product-img"
        src={product.imageUrl}
        alt={product.name}
        onError={() => setFailed(true)}
      />
    );
  }
  const initial = product.name.trim()[0]?.toUpperCase() ?? '?';
  return <div className="product-img-placeholder"><span>{initial}</span></div>;
}

function LogoBadge({ logoUrl, name }: { logoUrl?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (logoUrl && !failed) {
    return <img className="banner-logo-img" src={logoUrl} alt={name} onError={() => setFailed(true)} />;
  }
  return <div className="banner-logo-fallback">{name.trim()[0]?.toUpperCase() ?? 'R'}</div>;
}

// ── ProductCard ───────────────────────────────────────────────────────────────

interface CardProps {
  product: CatalogProduct;
  qty: number;
  theme: string;
  isFlashing: boolean;
  hasModifiers: boolean;
  onPress: () => void;
  onPressAdd: (e: React.MouseEvent) => void;
  onPressRemove: (e: React.MouseEvent) => void;
}

function ProductCard({
  product,
  qty,
  theme,
  isFlashing,
  hasModifiers,
  onPress,
  onPressAdd,
  onPressRemove,
}: CardProps) {
  const promoBadge = getPromotionBadgeMeta(product.promotion);
  const effectivePrice =
    product.displayPrice != null && product.displayPrice < product.price
      ? product.displayPrice
      : null;
  const isSimple = theme === 'simple';
  const isMorado = theme === 'morado';

  return (
    <div
      role="button"
      tabIndex={0}
      className={`product-card${isFlashing ? ' card-flash' : ''}`}
      onClick={onPress}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPress(); } }}
    >
      {/* Image area — promo badge + flash overlay */}
      <div className="product-card-img-wrap">
        <ProductImg product={product} />
        {promoBadge && (
          <span className={`promo-badge ${promoBadge.colorClass}`}>{promoBadge.label}</span>
        )}
        {isFlashing && (
          <div className="card-flash-overlay" aria-hidden="true">
            <CheckIcon size={28} color="#fff" />
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="product-card-body">
        <span className="product-name">{product.name}</span>

        {isMorado && product.description && (
          <span className="product-desc">{product.description}</span>
        )}
        {isMorado && product.allergens && product.allergens.length > 0 && (
          <div className="product-allergens">
            {product.allergens.map((a) => (
              <span key={a} className="allergen-badge">{a}</span>
            ))}
          </div>
        )}
        {isMorado && hasModifiers && (
          <span className="modifier-badge-card">Personalizable</span>
        )}

        {/* Footer: price + counter or add icon */}
        <div className="product-card-footer">
          <div className="product-price-block">
            {effectivePrice != null ? (
              <>
                <span className="product-price-old">{money(product.price)}</span>
                <span className="product-price product-price-promo">{money(effectivePrice)}</span>
              </>
            ) : (
              <span className="product-price">{money(product.price)}</span>
            )}
          </div>

          {qty > 0 ? (
            <div
              className="card-qty-control"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              role="group"
            >
              <button
                className="card-qty-btn"
                onClick={onPressRemove}
                aria-label="Quitar uno"
                type="button"
              >
                <MinusIcon size={13} />
              </button>
              <span className="card-qty-value">{qty}</span>
              <button
                className="card-qty-btn"
                onClick={onPressAdd}
                aria-label="Añadir uno"
                type="button"
              >
                <PlusIcon size={13} />
              </button>
            </div>
          ) : !isSimple ? (
            <span className="product-add-btn" aria-hidden="true">
              <PlusIcon size={15} />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── MenuScreen ────────────────────────────────────────────────────────────────

export function MenuScreen({
  categories,
  cart,
  cartTotal,
  contextLabel,
  theme,
  restaurantName,
  logoUrl,
  modifiersEnabled,
  productCommentsEnabled,
  cartQuantityByProductId,
  addedSignal,
  lastAddedProductId,
  lastAddedFromDetail,
  onAddToCart,
  onOpenDetail,
  onRemoveLast,
  onViewCart,
  onConsumeAddedFromDetail,
  tableLabel,
}: Props) {
  const [selectedCategoryId, setSelectedCategoryId] = useState(categories[0]?.id ?? '');
  const [flashId, setFlashId] = useState<string | null>(null);
  const [toastKey, setToastKey] = useState(0);

  const cartBarRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);

  // ── Cart bar pulse helper ──────────────────────────────────────────────────
  function pulseCartBar() {
    const el = cartBarRef.current;
    if (!el) return;
    el.classList.remove('cart-bar--pulse');
    void el.offsetHeight; // force reflow so animation restarts
    el.classList.add('cart-bar--pulse');
  }

  // ── Flash a card briefly ──────────────────────────────────────────────────
  function flashCard(productId: string) {
    setFlashId(productId);
    setTimeout(() => setFlashId(null), 420);
  }

  // ── Unified product press handler ──────────────────────────────────────────
  function handleProductPress(product: CatalogProduct) {
    const hasModifiers = productNeedsDetail(product, modifiersEnabled, productCommentsEnabled);

    if (import.meta.env.DEV) {
      console.log('PRODUCT_CARD_CLICK', product.name, product.id);
      console.log('PRODUCT_HAS_MODIFIERS', product.name, hasModifiers,
        '| modifiersEnabled:', modifiersEnabled,
        '| modifierGroups:', product.modifierGroups);
    }

    if (hasModifiers) {
      if (import.meta.env.DEV) console.log('OPEN_PRODUCT_DETAIL', product.name);
      onOpenDetail(product);
      return;
    }

    if (import.meta.env.DEV) console.log('ADD_DIRECT_TO_CART', product.name);
    flashCard(product.id);
    onAddToCart(product);
    // pulseCartBar fires via addedSignal effect after onAddToCart updates state
  }

  // ── + button press (when counter is visible) ──────────────────────────────
  function handlePressAdd(product: CatalogProduct, e: React.MouseEvent) {
    e.stopPropagation();
    handleProductPress(product);
  }

  // ── - button press ────────────────────────────────────────────────────────
  function handlePressRemove(productId: string, e: React.MouseEvent) {
    e.stopPropagation();
    onRemoveLast(productId);
  }

  // ── Pulse cart bar on every direct add (skip the initial mount) ───────────
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    pulseCartBar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addedSignal]);

  // ── Handle return from product-detail: flash card + toast + pulse ─────────
  useEffect(() => {
    if (!lastAddedProductId || !lastAddedFromDetail) return;
    flashCard(lastAddedProductId);
    setToastKey((k) => k + 1);
    pulseCartBar();
    onConsumeAddedFromDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAddedProductId, lastAddedFromDetail]);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const products = (selectedCategory?.products ?? []).filter((p) => p.enabled);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const hasCart = cartCount > 0;
  const contextBadgeLabel = contextLabel;

  // ── Toast ──────────────────────────────────────────────────────────────────
  const Toast =
    toastKey > 0 ? (
      <div
        key={toastKey}
        className="added-toast"
        onAnimationEnd={() => setToastKey(0)}
      >
        Añadido al pedido
      </div>
    ) : null;

  // ── Cart bar ───────────────────────────────────────────────────────────────
  const CartBar = hasCart ? (
    <div className="cart-bar" ref={cartBarRef}>
      <button className="cart-bar-btn" onClick={onViewCart} type="button">
        <span className="cart-bar-icon"><ShoppingBagIcon size={22} /></span>
        <span className="cart-bar-label">
          Ver cesta
          <span className="cart-bar-count">
            {' '}· {cartCount} {cartCount === 1 ? 'producto' : 'productos'}
          </span>
        </span>
        <span className="cart-bar-total">{money(cartTotal)}</span>
      </button>
    </div>
  ) : null;

  // ── Product grid ───────────────────────────────────────────────────────────
  const Grid =
    products.length === 0 ? (
      <p className="empty-hint">No hay productos en esta categoría.</p>
    ) : (
      <div className="product-grid">
        {products.map((product) => {
          const hasModifiers = productNeedsDetail(product, modifiersEnabled, productCommentsEnabled);
          return (
            <ProductCard
              key={product.id}
              product={product}
              qty={cartQuantityByProductId.get(product.id) ?? 0}
              theme={theme}
              isFlashing={flashId === product.id}
              hasModifiers={hasModifiers}
              onPress={() => handleProductPress(product)}
              onPressAdd={(e) => handlePressAdd(product, e)}
              onPressRemove={(e) => handlePressRemove(product.id, e)}
            />
          );
        })}
      </div>
    );

  // ── principal: sidebar layout ──────────────────────────────────────────────
  if (theme === 'principal') {
    return (
      <div className="menu-screen">
        <header className="principal-banner">
          <LogoBadge logoUrl={logoUrl} name={restaurantName} />
          {restaurantName && <span className="banner-name">{restaurantName}</span>}
          <span className="mode-badge">{contextBadgeLabel}</span>
        </header>

        <div className="menu-body">
          <nav className="principal-sidebar">
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={`principal-cat${selectedCategoryId === cat.id ? ' active' : ''}`}
                onClick={() => setSelectedCategoryId(cat.id)}
                type="button"
              >
                {cat.name}
              </button>
            ))}
          </nav>
          <main className="product-area">{Grid}</main>
        </div>

        {Toast}
        {CartBar}
      </div>
    );
  }

  // ── Standard layout: moderno / simple / morado ─────────────────────────────
  return (
    <div className="menu-screen">
      <header className="menu-header">
        <span className="menu-table-label">{tableLabel}</span>
        <span className="mode-badge">{contextBadgeLabel}</span>
      </header>

      <nav className="category-nav">
        <div className="category-tabs">
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`category-tab${selectedCategoryId === cat.id ? ' active' : ''}`}
              onClick={() => setSelectedCategoryId(cat.id)}
              type="button"
            >
              {cat.name}
            </button>
          ))}
        </div>
      </nav>

      <main className="product-area">{Grid}</main>
      {Toast}
      {CartBar}
    </div>
  );
}
