import { useState } from 'react'
import type { BundleSuggestion, SuggestedProduct } from '@/suggestions'
import { formatEuro } from '@/lib/utils'

interface Props {
  bundle: BundleSuggestion
  onAccept: (ruleId: string, productIds: string[]) => void
  onDismiss: () => void
}

function ProductImage({ product }: { product: SuggestedProduct }) {
  const [failed, setFailed] = useState(false)

  if (product.imageUrl && !failed) {
    return <img className="bundle-product-img" src={product.imageUrl} alt={product.name} onError={() => setFailed(true)} />
  }

  return <div className="bundle-product-img bundle-product-img-placeholder" aria-hidden="true" />
}

export function BundleCard({ bundle, onAccept, onDismiss }: Props) {
  const productIds = bundle.products.map((product) => product.id)
  const finalPrice = bundle.bundlePrice ?? bundle.totalIndividual
  const savings = Math.max(bundle.totalIndividual - finalPrice, 0)

  return (
    <section className="bundle-card">
      <p className="bundle-card-header">Menu recomendado</p>
      <div className="bundle-products" aria-hidden="true">
        {bundle.products.map((product, index) => (
          <div key={product.id} className="bundle-products-fragment">
            <ProductImage product={product} />
            {index < bundle.products.length - 1 && <span className="bundle-product-sep">+</span>}
          </div>
        ))}
      </div>
      <p className="bundle-names">{bundle.products.map((product) => product.name).join(' + ')}</p>
      <div className="bundle-price-row">
        {bundle.bundlePrice != null && <span className="bundle-price-old">{formatEuro(bundle.totalIndividual)}</span>}
        <span className="bundle-price-new">{formatEuro(finalPrice)}</span>
        {savings > 0 && <span className="bundle-price-save">Ahorras {formatEuro(savings)}</span>}
      </div>
      <button className="bundle-btn-accept" onClick={() => onAccept(bundle.ruleId, productIds)}>
        Anadir menu completo
      </button>
      <button className="bundle-btn-dismiss" onClick={onDismiss}>
        Solo este producto
      </button>
    </section>
  )
}
