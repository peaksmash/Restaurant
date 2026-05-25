import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckIcon, SparklesIcon } from '../Icons';
import type { CompositionModalData, CompositionSection, SuggestedProduct } from '../suggestions';

interface CompositionModalProps {
  data: CompositionModalData;
  onConfirm: (selectedProductIds: string[]) => void;
  onDismiss: () => void;
}

function formatPrice(price: number) {
  return `${(price / 100).toFixed(2)} €`;
}

function ProductImage({
  product,
  className,
}: {
  product: SuggestedProduct;
  className: string;
}) {
  const [failed, setFailed] = useState(false);

  if (product.imageUrl && !failed) {
    return (
      <img
        className={className}
        src={product.imageUrl}
        alt={product.name}
        onError={() => setFailed(true)}
      />
    );
  }

  return <div className={`${className} composition-placeholder`} aria-hidden="true" />;
}

function CarouselRow({
  section,
  selectedProductId,
  onToggle,
}: {
  section: CompositionSection;
  selectedProductId: string | null;
  onToggle: (sectionId: string, productId: string) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [centerIdx, setCenterIdx] = useState(0);

  function handleScroll() {
    const el = rowRef.current;
    if (!el) return;
    // card width (200) + gap (14)
    const step = 214;
    const idx = Math.round(el.scrollLeft / step);
    setCenterIdx(Math.max(0, Math.min(idx, section.products.length - 1)));
  }

  return (
    <div
      ref={rowRef}
      className="composition-products-row"
      onScroll={handleScroll}
    >
      {section.products.map((product, idx) => {
        const isSelected = selectedProductId === product.id;
        const dist = Math.abs(idx - centerIdx);
        const opacity = dist === 0 ? 1 : dist === 1 ? 0.45 : 0.25;
        const scale = dist === 0 ? 1 : 0.95;

        return (
          <button
            key={product.id}
            type="button"
            className={`composition-product-card${isSelected ? ' selected' : ''}`}
            style={{ opacity, transform: `scale(${scale})`, transition: 'opacity 0.2s, transform 0.2s' }}
            onClick={() => onToggle(section.categoryId, product.id)}
          >
            <div className="composition-product-card-media">
              <ProductImage product={product} className="composition-product-card-img" />
              {isSelected && (
                <span className="composition-product-card-check" aria-hidden="true">
                  <CheckIcon size={12} color="#111" />
                </span>
              )}
            </div>

            <div className="composition-product-card-body">
              <div className="composition-product-card-name">{product.name}</div>
              <div className="composition-product-card-price">{formatPrice(product.price)}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function CompositionSectionRow({
  section,
  selectedProductId,
  onToggle,
}: {
  section: CompositionSection;
  selectedProductId: string | null;
  onToggle: (sectionId: string, productId: string) => void;
}) {
  return (
    <section className="composition-section">
      <h2 className="composition-section-label">{section.label}</h2>
      <CarouselRow
        section={section}
        selectedProductId={selectedProductId}
        onToggle={onToggle}
      />
    </section>
  );
}

export function CompositionModal({ data, onConfirm, onDismiss }: CompositionModalProps) {
  const [selectedProducts, setSelectedProducts] = useState<Record<string, string | null>>(data.selectedProducts);

  useEffect(() => {
    setSelectedProducts(data.selectedProducts);
  }, [data]);

  const selectedItems = useMemo(() => {
    const selectedIds = Object.values(selectedProducts).filter((value): value is string => Boolean(value));
    const selectedList = data.sections
      .flatMap((section) => section.products)
      .filter((product) => selectedIds.includes(product.id));

    return {
      ids: selectedIds,
      count: 1 + selectedIds.length,
      total: data.triggerProduct.price + selectedList.reduce((sum, product) => sum + product.price, 0),
    };
  }, [data.sections, data.triggerProduct.price, selectedProducts]);

  function toggleProduct(sectionId: string, productId: string) {
    setSelectedProducts((prev) => ({
      ...prev,
      [sectionId]: prev[sectionId] === productId ? null : productId,
    }));
  }

  return (
    <div className="composition-backdrop" role="presentation" onClick={onDismiss}>
      <div
        className="composition-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="composition-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          className="composition-close-btn"
          aria-label="Cerrar"
          onClick={onDismiss}
        >
          ✕
        </button>

        <div className="composition-header">
          <ProductImage product={data.triggerProduct} className="composition-product-img" />
          <div className="composition-product-copy">
            <h1 id="composition-modal-title" className="composition-product-name">
              {data.triggerProduct.name}
            </h1>
            <p className="composition-product-price">{formatPrice(data.triggerProduct.price)}</p>
          </div>
        </div>

        <div className="composition-banner">
          <span className="composition-banner-icon" aria-hidden="true">
            <SparklesIcon size={28} color="var(--kiosk-accent)" />
          </span>
          <div className="composition-banner-title">{data.bannerTitle}</div>
        </div>

        <div className="composition-sections">
          {data.sections.map((section) => (
            <CompositionSectionRow
              key={section.categoryId}
              section={section}
              selectedProductId={selectedProducts[section.categoryId] ?? null}
              onToggle={toggleProduct}
            />
          ))}
        </div>

        <div className="composition-actions">
          <button
            type="button"
            className="composition-btn-confirm"
            onClick={() => onConfirm(selectedItems.ids)}
          >
            Añadir al pedido
            {selectedItems.count > 1 && (
              <span className="composition-btn-price"> · {formatPrice(selectedItems.total)}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
