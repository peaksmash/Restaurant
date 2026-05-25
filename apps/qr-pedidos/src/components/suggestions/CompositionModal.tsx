import { useEffect, useMemo, useState } from 'react'
import type { CompositionModalData, CompositionSection, SuggestedProduct } from '@/suggestions'
import { formatEuro } from '@/lib/utils'

interface Props {
  data: CompositionModalData
  onConfirm: (selectedProductIds: string[]) => void
  onDismiss: () => void
}

function ProductImage({ product, className }: { product: SuggestedProduct; className: string }) {
  const [failed, setFailed] = useState(false)

  if (product.imageUrl && !failed) {
    return <img className={className} src={product.imageUrl} alt={product.name} onError={() => setFailed(true)} />
  }

  return <div className={`${className} composition-placeholder`} aria-hidden="true" />
}

function SectionRow({
  section,
  selectedProductId,
  onToggle,
}: {
  section: CompositionSection
  selectedProductId: string | null
  onToggle: (sectionId: string, productId: string) => void
}) {
  return (
    <section className="composition-section">
      <h2 className="composition-section-label">{section.label}</h2>
      <div className="composition-products-row">
        {section.products.map((product) => {
          const isSelected = selectedProductId === product.id
          return (
            <button
              key={product.id}
              type="button"
              className={`composition-product-card${isSelected ? ' selected' : ''}`}
              onClick={() => onToggle(section.categoryId, product.id)}
            >
              <div className="composition-product-card-media">
                <ProductImage product={product} className="composition-product-card-img" />
                {isSelected && <span className="composition-product-card-check">✓</span>}
              </div>
              <div className="composition-product-card-body">
                <div className="composition-product-card-name">{product.name}</div>
                <div className="composition-product-card-price">{formatEuro(product.price)}</div>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function CompositionModal({ data, onConfirm, onDismiss }: Props) {
  const [selectedProducts, setSelectedProducts] = useState<Record<string, string | null>>(data.selectedProducts)

  useEffect(() => {
    setSelectedProducts(data.selectedProducts)
  }, [data])

  const selectedItems = useMemo(() => {
    const selectedIds = Object.values(selectedProducts).filter((value): value is string => Boolean(value))
    const selectedList = data.sections
      .flatMap((section) => section.products)
      .filter((product) => selectedIds.includes(product.id))

    return {
      ids: selectedIds,
      total: data.triggerProduct.price + selectedList.reduce((sum, product) => sum + product.price, 0),
    }
  }, [data.sections, data.triggerProduct.price, selectedProducts])

  return (
    <div className="composition-backdrop" onClick={onDismiss}>
      <div className="composition-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="composition-close-btn" aria-label="Cerrar" onClick={onDismiss}>
          ×
        </button>
        <div className="composition-header">
          <ProductImage product={data.triggerProduct} className="composition-product-img" />
          <div className="composition-product-copy">
            <h1 className="composition-product-name">{data.triggerProduct.name}</h1>
            <p className="composition-product-price">{formatEuro(data.triggerProduct.price)}</p>
          </div>
        </div>

        <div className="composition-banner">
          <span className="composition-banner-icon" aria-hidden="true">✦</span>
          <div>
            <div className="composition-banner-title">{data.bannerTitle}</div>
            <div className="composition-banner-sub">Anade lo que quieras y completa tu pedido</div>
          </div>
        </div>

        <div className="composition-sections">
          {data.sections.map((section) => (
            <SectionRow
              key={section.categoryId}
              section={section}
              selectedProductId={selectedProducts[section.categoryId] ?? null}
              onToggle={(sectionId, productId) =>
                setSelectedProducts((prev) => ({
                  ...prev,
                  [sectionId]: prev[sectionId] === productId ? null : productId,
                }))
              }
            />
          ))}
        </div>

        <div className="composition-actions">
          <button type="button" className="composition-btn-confirm" onClick={() => onConfirm(selectedItems.ids)}>
            Anadir al pedido · {formatEuro(selectedItems.total)}
          </button>
          <button type="button" className="composition-btn-dismiss" onClick={onDismiss}>
            Continuar sin anadir
          </button>
        </div>
      </div>
    </div>
  )
}
