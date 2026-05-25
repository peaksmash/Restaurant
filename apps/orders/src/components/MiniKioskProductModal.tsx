import React, { useMemo, useState } from 'react';
import type { MiniKioskModifier, MiniKioskModifierGroup } from '../api';
import type { CartaProduct } from '../mock/menu';
import type { CartaLine, CartaLineModifier } from '../pages/CartaCartPage';

interface Props {
  product: CartaProduct;
  groups: MiniKioskModifierGroup[];
  initialLine?: CartaLine | null;
  onConfirm: (modifiers: CartaLineModifier[]) => void;
  onClose: () => void;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value / 100);
}

function buildInitialSelections(initialLine: CartaLine | null | undefined) {
  const next = new Map<string, Set<string>>();
  for (const modifier of initialLine?.modifiers ?? []) {
    const current = new Set(next.get(modifier.modifierGroupId) ?? []);
    current.add(modifier.modifierOptionId);
    next.set(modifier.modifierGroupId, current);
  }
  return next;
}

export function MiniKioskProductModal({ product, groups, initialLine = null, onConfirm, onClose }: Props) {
  const [selections, setSelections] = useState<Map<string, Set<string>>>(() => buildInitialSelections(initialLine));
  const [error, setError] = useState('');

  function toggleModifier(group: MiniKioskModifierGroup, modifier: MiniKioskModifier) {
    setSelections((prev) => {
      const next = new Map(prev);
      const current = new Set(next.get(group.id) ?? []);
      const isSelected = current.has(modifier.id);

      if (isSelected) {
        current.delete(modifier.id);
      } else {
        const max = group.max ?? Number.POSITIVE_INFINITY;
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

  const selectedModifiers = useMemo(() => {
    const result: CartaLineModifier[] = [];

    for (const group of groups) {
      const selectedIds = selections.get(group.id) ?? new Set<string>();
      for (const modifier of group.modifiers) {
        if (!selectedIds.has(modifier.id)) continue;
        result.push({
          modifierGroupId: group.id,
          modifierOptionId: modifier.id,
          name: modifier.name,
          price: modifier.priceImpact,
          quantity: 1,
          groupName: group.name,
        });
      }
    }

    return result;
  }, [groups, selections]);

  const modifiersTotal = useMemo(
    () => selectedModifiers.reduce((sum, modifier) => sum + modifier.price * (modifier.quantity ?? 1), 0),
    [selectedModifiers],
  );

  function handleConfirm() {
    for (const group of groups) {
      const min = group.min ?? 0;
      const max = group.max ?? Number.POSITIVE_INFINITY;
      const selected = selections.get(group.id)?.size ?? 0;

      if (selected < min) {
        setError(`Elige al menos ${min} opción en "${group.name}".`);
        return;
      }

      if (selected > max) {
        setError(`No puedes elegir más de ${max} opciones en "${group.name}".`);
        return;
      }
    }

    onConfirm(selectedModifiers);
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="mini-kiosk-modal" role="dialog" aria-modal="true" aria-label={`Configurar ${product.name}`}>
        <div className="incoming-modal-top">
          <div>
            <p className="section-kicker">Configurar producto</p>
            <h2>{product.name}</h2>
            {product.description ? <p className="detail-note">{product.description}</p> : null}
          </div>
          <button type="button" className="incoming-close-btn" onClick={onClose} aria-label="Cerrar modal">
            ×
          </button>
        </div>

        <div className="mini-kiosk-modal-body">
          {groups.map((group) => {
            const selected = selections.get(group.id) ?? new Set<string>();
            const required = (group.min ?? 0) > 0;
            const singleChoice = (group.max ?? Number.POSITIVE_INFINITY) === 1;

            return (
              <section key={group.id} className="mini-kiosk-modifier-group">
                <div className="mini-kiosk-modifier-header">
                  <div>
                    <strong>{group.name}</strong>
                    <div className="mini-kiosk-modifier-hints">
                      {required ? <span>Obligatorio</span> : <span>Opcional</span>}
                      {group.min != null ? <span>Mín. {group.min}</span> : null}
                      {group.max != null ? <span>Máx. {group.max}</span> : null}
                    </div>
                  </div>
                  <span className="mini-kiosk-modifier-mode">{singleChoice ? 'Una opción' : 'Varias opciones'}</span>
                </div>

                <div className="mini-kiosk-modifier-options">
                  {group.modifiers.map((modifier) => {
                    const isSelected = selected.has(modifier.id);
                    return (
                      <button
                        key={modifier.id}
                        type="button"
                        className={`mini-kiosk-modifier-option${isSelected ? ' active' : ''}`}
                        onClick={() => toggleModifier(group, modifier)}
                      >
                        <div>
                          <strong>{modifier.name}</strong>
                          <span>{modifier.priceImpact > 0 ? `+${formatCurrency(modifier.priceImpact)}` : 'Sin coste extra'}</span>
                        </div>
                        <span className="mini-kiosk-modifier-check">{isSelected ? '✓' : singleChoice ? '○' : '+'}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <div className="mini-kiosk-modal-footer">
          {selectedModifiers.length > 0 ? (
            <div className="carta-line-modifiers">
              {selectedModifiers.map((modifier) => (
                <span
                  key={`${modifier.modifierGroupId}-${modifier.modifierOptionId}`}
                  className="carta-line-modifier-chip"
                >
                  {modifier.groupName ? `${modifier.groupName}: ` : ''}
                  {modifier.name}
                  {modifier.price > 0 ? ` (+${formatCurrency(modifier.price)})` : ''}
                </span>
              ))}
            </div>
          ) : null}
          {error ? <div className="ops-inline-notice error">{error}</div> : null}
          <button type="button" className="primary-btn strong" onClick={handleConfirm}>
            {initialLine ? 'Actualizar producto' : 'Añadir al carrito'} · {formatCurrency(product.price + modifiersTotal)}
          </button>
        </div>
      </div>
    </div>
  );
}
