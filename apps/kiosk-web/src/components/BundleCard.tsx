import React, { useState } from 'react';
import type { BundleSuggestion, SuggestedProduct } from '../suggestions';

interface BundleCardProps {
  bundle: BundleSuggestion;
  onAccept: (ruleId: string, productIds: string[]) => void;
  onDismiss: () => void;
}

function formatPrice(price: number) {
  return `${(price / 100).toFixed(2)} €`;
}

function BundleProductImage({ product }: { product: SuggestedProduct }) {
  const [failed, setFailed] = useState(false);

  if (product.imageUrl && !failed) {
    return (
      <img
        className="bundle-product-img"
        src={product.imageUrl}
        alt={product.name}
        onError={() => setFailed(true)}
      />
    );
  }

  return <div className="bundle-product-img bundle-product-img-placeholder" aria-hidden="true" />;
}

export function BundleCard({ bundle, onAccept, onDismiss }: BundleCardProps) {
  const productIds = bundle.products.map((product) => product.id);
  const finalPrice = bundle.bundlePrice ?? bundle.totalIndividual;
  const savings = Math.max(bundle.totalIndividual - finalPrice, 0);

  return (
    <section className="bundle-card">
      <p className="bundle-card-header">🎁 {bundle.name}</p>

      <div className="bundle-products" aria-hidden="true">
        {bundle.products.map((product, index) => (
          <React.Fragment key={product.id}>
            <BundleProductImage product={product} />
            {index < bundle.products.length - 1 && <span className="bundle-product-sep">+</span>}
          </React.Fragment>
        ))}
      </div>

      <p className="bundle-names">{bundle.products.map((product) => product.name).join(' + ')}</p>

      <div className="bundle-price-row">
        {bundle.bundlePrice != null && (
          <span className="bundle-price-old">{formatPrice(bundle.totalIndividual)}</span>
        )}
        <span className="bundle-price-new">{formatPrice(finalPrice)}</span>
        {savings > 0 && (
          <span className="bundle-price-save">Ahorras {formatPrice(savings)}</span>
        )}
      </div>

      <button
        className="bundle-btn-accept"
        onClick={() => onAccept(bundle.ruleId, productIds)}
      >
        Añadir menú completo
      </button>
      <button className="bundle-btn-dismiss" onClick={onDismiss}>
        Solo este producto
      </button>
    </section>
  );
}
