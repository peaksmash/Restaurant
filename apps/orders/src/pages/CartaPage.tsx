import React, { useEffect, useMemo, useState } from 'react';
import { getCartDiscountedTotal } from '../lib/cartPricing';
import type { CartaCategory, CartaProduct } from '../mock/menu';
import type { CartaLine } from './CartaCartPage';

interface CartaPageProps {
  categories: CartaCategory[];
  loading: boolean;
  connectionMode: 'real' | 'demo';
  connectionMessage: string;
  connectionError?: string | null;
  restaurantName?: string | null;
  lines: CartaLine[];
  onOpenCart: () => void;
  onAddProduct: (product: CartaProduct) => void;
  onChangeQty: (productId: string, delta: number) => void;
  productHasModifiers?: (product: CartaProduct) => boolean;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value / 100);
}

export function CartaPage({
  categories,
  loading,
  connectionMode,
  connectionMessage,
  connectionError = null,
  restaurantName = null,
  lines,
  onOpenCart,
  onAddProduct,
  onChangeQty,
  productHasModifiers,
}: CartaPageProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState(categories[0]?.id ?? '');

  useEffect(() => {
    if (!selectedCategoryId && categories[0]?.id) {
      setSelectedCategoryId(categories[0].id);
      return;
    }

    if (selectedCategoryId && !categories.some((category) => category.id === selectedCategoryId)) {
      setSelectedCategoryId(categories[0]?.id ?? '');
    }
  }, [categories, selectedCategoryId]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? categories[0],
    [categories, selectedCategoryId],
  );

  const totalItems = useMemo(() => lines.reduce((sum, line) => sum + line.quantity, 0), [lines]);
  const totalPrice = useMemo(() => getCartDiscountedTotal(lines), [lines]);

  return (
    <div className="orders-page carta-page">
      <header className="page-header carta-header">
        <div>
          <p className="section-kicker">Mini Kiosko / Mini Comandero</p>
          <h1>Carta</h1>
          <p className="page-copy">
            Uso interno por empleado cuando un cliente no sabe pedir desde kiosko.
            {restaurantName ? ` ${restaurantName}.` : ''}
          </p>
        </div>
        <div className="page-meta">
          <span className={`meta-pill ${connectionMode === 'real' ? 'meta-pill-real' : 'meta-pill-demo'}`}>
            {connectionMessage}
          </span>
        </div>
      </header>

      {connectionError ? <div className="ops-inline-notice error">{connectionError}</div> : null}

      {categories.length > 0 ? (
        <nav className="carta-category-nav">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`carta-category-btn${selectedCategoryId === category.id ? ' active' : ''}`}
              onClick={() => setSelectedCategoryId(category.id)}
            >
              {category.name}
            </button>
          ))}
        </nav>
      ) : null}

      <div className="carta-layout">
        <section className="carta-products">
          {loading ? (
            <div className="panel-empty">Cargando catálogo real…</div>
          ) : !selectedCategory ? (
            <div className="panel-empty">No hay productos disponibles para Mini Kiosko.</div>
          ) : (
            <div className="carta-product-grid">
              {selectedCategory.products.map((product) => {
                const qty = lines
                  .filter((line) => line.product.id === product.id)
                  .reduce((sum, line) => sum + line.quantity, 0);
                const hasModifiers = productHasModifiers?.(product) ?? false;
                const displayPrice =
                  product.displayPrice != null && product.displayPrice < product.price ? product.displayPrice : product.price;

                return (
                  <article key={product.id} className="carta-product-card">
                    <div>
                      <h3>{product.name}</h3>
                      {product.description ? <p>{product.description}</p> : null}
                      {hasModifiers ? <p className="detail-note">Disponible con configuración de modifiers.</p> : null}
                    </div>

                    <div className="carta-product-footer">
                      <strong>{formatCurrency(displayPrice)}</strong>
                      {qty > 0 ? (
                        <div className="carta-qty-control">
                          <button type="button" onClick={() => onChangeQty(product.id, -1)}>−</button>
                          <span>{qty}</span>
                          <button type="button" onClick={() => onAddProduct(product)}>+</button>
                        </div>
                      ) : (
                        <button type="button" className="carta-add-btn" onClick={() => onAddProduct(product)}>
                          {hasModifiers ? 'Configurar' : 'Añadir'}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="carta-summary compact">
          <h2>Mini Comandero</h2>
          <p className="detail-note">
            {connectionMode === 'real'
              ? 'Conectado a catálogo/config real. La cuenta se crea como OrderSession pendiente y no se envía a Last automáticamente.'
              : 'Modo demo explícito. La cesta se abre en pantalla aparte, pero no crea OrderSession real.'}
          </p>
          <div className="carta-summary-total">
            <span>Total</span>
            <strong>{formatCurrency(totalPrice)}</strong>
          </div>
          <button type="button" className="primary-btn strong" disabled={lines.length === 0} onClick={onOpenCart}>
            Ver cuenta
          </button>
        </aside>
      </div>

      {totalItems > 0 ? (
        <button type="button" className="carta-cart-bar" onClick={onOpenCart}>
          <span>{totalItems} productos</span>
          <strong>{formatCurrency(totalPrice)}</strong>
        </button>
      ) : null}
    </div>
  );
}
