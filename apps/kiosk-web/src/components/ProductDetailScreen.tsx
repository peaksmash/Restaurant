import React, { useState } from 'react';
import type { CatalogProduct, Modifier, ModifierGroup } from '../api';
import type { BundleSuggestion } from '../suggestions';
import { BundleCard } from './BundleCard';
import { ArrowLeftIcon, PlusIcon, MinusIcon } from '../Icons';

interface Props {
  product: CatalogProduct;
  groups: ModifierGroup[];
  productCommentsEnabled: boolean;
  theme: string;
  bundle?: BundleSuggestion | null;
  onAcceptBundle?: () => void;
  onDismissBundle?: () => void;
  onConfirm: (product: CatalogProduct, selectedModifiers: Modifier[], comments: string) => void;
  onCancel: () => void;
}

function money(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function ProductImage({ product }: { product: CatalogProduct }) {
  const [failed, setFailed] = useState(false);
  if (product.imageUrl && !failed) {
    return (
      <img
        className="detail-img"
        src={product.imageUrl}
        alt={product.name}
        onError={() => setFailed(true)}
      />
    );
  }
  const initial = product.name.trim()[0]?.toUpperCase() ?? '?';
  return (
    <div className="detail-img-placeholder" aria-hidden="true">
      <span>{initial}</span>
    </div>
  );
}

export function ProductDetailScreen({
  product,
  groups,
  productCommentsEnabled,
  theme,
  bundle,
  onAcceptBundle,
  onDismissBundle,
  onConfirm,
  onCancel,
}: Props) {
  const [selections, setSelections] = useState<Map<string, Set<string>>>(new Map());
  const [comments, setComments] = useState('');
  const [error, setError] = useState('');

  function toggleModifier(group: ModifierGroup, modifier: Modifier) {
    setSelections((prev) => {
      const next = new Map(prev);
      const current = new Set(next.get(group.id) ?? []);
      const isSelected = current.has(modifier.id);

      if (isSelected) {
        current.delete(modifier.id);
      } else {
        const max = group.max ?? Infinity;
        if (max === 1) {
          current.clear();
          current.add(modifier.id);
        } else if (current.size < max) {
          current.add(modifier.id);
        }
      }
      next.set(group.id, current);
      return next;
    });
    setError('');
  }

  function getSelectedModifiers(): Modifier[] {
    const result: Modifier[] = [];
    for (const group of groups) {
      const selected = selections.get(group.id) ?? new Set();
      for (const mod of group.modifiers) {
        if (selected.has(mod.id)) result.push(mod);
      }
    }
    return result;
  }

  function handleConfirm() {
    for (const group of groups) {
      const min = group.min ?? 0;
      const selected = selections.get(group.id)?.size ?? 0;
      if (selected < min) {
        setError(`Elige al menos ${min} opción en "${group.name}"`);
        return;
      }
    }
    onConfirm(product, getSelectedModifiers(), comments);
  }

  const selectedMods = getSelectedModifiers();
  const modExtra = selectedMods.reduce((sum, m) => sum + (m.priceImpact ?? 0), 0);
  const totalPrice = product.price + modExtra;

  return (
    <div className="detail-screen">
      <button className="detail-back" onClick={onCancel} aria-label="Volver">
        <ArrowLeftIcon size={32} />
      </button>

      <div className="detail-scroll">
        <ProductImage product={product} />

        <div className="detail-info">
          <h2 className="detail-name">{product.name}</h2>
          {product.description && <p className="detail-desc">{product.description}</p>}

          {/* Allergens — shown in all themes when present, styled specially in morado */}
          {product.allergens && product.allergens.length > 0 && (
            <div className="detail-allergens">
              <span className="detail-allergens-label">Alérgenos: </span>
              <div className="product-allergens">
                {product.allergens.map((a) => (
                  <span key={a} className="allergen-badge">{a}</span>
                ))}
              </div>
            </div>
          )}

          <p className="detail-base-price">{money(product.price)}</p>
        </div>

        {bundle && onAcceptBundle && onDismissBundle && (
          <BundleCard
            bundle={bundle}
            onAccept={() => onAcceptBundle()}
            onDismiss={onDismissBundle}
          />
        )}

        {groups.map((group) => {
          const selected = selections.get(group.id) ?? new Set();
          const isRadio = (group.max ?? Infinity) === 1;
          return (
            <div key={group.id} className="modifier-group">
              <div className="modifier-group-header">
                <span className="modifier-group-name">{group.name}</span>
                {group.min != null && group.min > 0 && (
                  <span className="modifier-group-required">Obligatorio</span>
                )}
                {!isRadio && group.max != null && (
                  <span className="modifier-group-hint">Elige hasta {group.max}</span>
                )}
              </div>
              <div className="modifier-options">
                {group.modifiers.map((mod) => {
                  const isSelected = selected.has(mod.id);
                  return (
                    <button
                      key={mod.id}
                      className={`modifier-option${isSelected ? ' selected' : ''}`}
                      onClick={() => toggleModifier(group, mod)}
                    >
                      <span className="modifier-check">
                        {isRadio ? (
                          <span className={`radio-dot${isSelected ? ' active' : ''}`} />
                        ) : isSelected ? (
                          <MinusIcon size={28} />
                        ) : (
                          <PlusIcon size={28} />
                        )}
                      </span>
                      <span className="modifier-name">{mod.name}</span>
                      {mod.priceImpact > 0 && (
                        <span className="modifier-price">+{money(mod.priceImpact)}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {productCommentsEnabled && (
          <div className="detail-comments">
            <label className="detail-comments-label" htmlFor="product-comments">
              Comentario (opcional)
            </label>
            <textarea
              id="product-comments"
              className="detail-comments-input"
              rows={2}
              maxLength={200}
              placeholder="Sin cebolla, extra picante…"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </div>
        )}

        <div style={{ height: '100px' }} />
      </div>

      <div className="detail-footer">
        {error && <p className="detail-error">{error}</p>}
        <button className="btn-detail-confirm" onClick={handleConfirm}>
          Añadir al pedido · {money(totalPrice)}
        </button>
      </div>
    </div>
  );
}
