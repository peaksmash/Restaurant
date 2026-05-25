import { useState } from 'react'
import { createPortal } from 'react-dom'
import { BundleCard } from '@/components/suggestions/BundleCard'
import { useToastStore } from '@/store/useToastStore'
import { formatEuro } from '@/lib/utils'
import type { LastProduct, LastModifier, CartModifier } from '@/types'
import type { BundleSuggestion } from '@/suggestions'
import styles from './ProductModal.module.css'

interface Props {
  product: LastProduct
  bundle?: BundleSuggestion | null
  onAcceptBundle?: () => void
  onDismissBundle?: () => void
  onClose: () => void
  onAdd: (payload: {
    product: LastProduct
    qty: number
    modifiers: CartModifier[]
    notes?: string
  }) => void
}

export default function ProductModal({
  product,
  bundle,
  onAcceptBundle,
  onDismissBundle,
  onClose,
  onAdd,
}: Props) {
  const [qty, setQty] = useState(1)
  const [notes, setNotes] = useState('')
  const [selections, setSelections] = useState<Record<string, string[]>>({})
  const showToast = useToastStore((state) => state.show)

  const groups = product.modifierGroupsFull || []

  const toggleModifier = (groupId: string, modId: string, max: number) => {
    setSelections((prev) => {
      const current = prev[groupId] || []
      const index = current.indexOf(modId)
      if (index > -1) {
        return { ...prev, [groupId]: current.filter((id) => id !== modId) }
      }
      if (max === 1) {
        return { ...prev, [groupId]: [modId] }
      }
      if (current.length >= max) {
        return prev
      }
      return { ...prev, [groupId]: [...current, modId] }
    })
  }

  const modifiersExtra = groups.reduce((sum, group) => {
    return sum + (selections[group.id] || []).reduce((accumulator, modifierId) => {
      const modifier = group.modifiers.find((item) => item.id === modifierId)
      return accumulator + (modifier?.priceImpact || 0)
    }, 0)
  }, 0)

  const linePrice = (product.price + modifiersExtra) * qty

  const handleAdd = () => {
    for (const group of groups) {
      if (group.min > 0 && (selections[group.id]?.length || 0) < group.min) {
        showToast(`⚠️ Elige al menos ${group.min} opción en "${group.name}"`)
        return
      }
    }

    const modifiers: CartModifier[] = groups.flatMap((group) =>
      (selections[group.id] || []).map((modifierId) => {
        const modifier = group.modifiers.find((item) => item.id === modifierId) as LastModifier
        return {
          id: modifier.id,
          groupId: group.id,
          name: modifier.name,
          priceImpact: modifier.priceImpact,
        }
      }),
    )

    onAdd({
      product,
      qty,
      modifiers,
      notes: notes.trim() || undefined,
    })

    showToast(`✅ ${product.name} añadido`)
    onClose()
  }

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(event) => event.stopPropagation()}>
        <div className={styles.handle} />

        {product.imageUrl ? (
          <img className={styles.img} src={product.imageUrl} alt={product.name} />
        ) : (
          <div className={styles.imgPlaceholder}>{product.emoji || '🍽️'}</div>
        )}

        <div className={styles.body}>
          <h2 className={styles.title}>{product.name}</h2>
          {product.description && <p className={styles.desc}>{product.description}</p>}
          <div className={styles.basePrice}>{formatEuro(product.price)}</div>

          {bundle && onAcceptBundle && onDismissBundle && (
            <BundleCard
              bundle={bundle}
              onAccept={() => onAcceptBundle()}
              onDismiss={onDismissBundle}
            />
          )}

          {groups.map((group) => (
            <div key={group.id} className={styles.group}>
              <div className={styles.groupHeader}>
                <span className={styles.groupTitle}>{group.name}</span>
                <span className={styles.groupMeta}>
                  {group.min > 0 ? (
                    <span className={styles.required}>Obligatorio</span>
                  ) : (
                    <span className={styles.optional}>Opcional</span>
                  )}
                  {group.max > 1 && <span className={styles.maxInfo}>Máx. {group.max}</span>}
                </span>
              </div>

              {group.modifiers.filter((modifier) => modifier.enabled).map((modifier) => {
                const selected = (selections[group.id] || []).includes(modifier.id)
                return (
                  <div
                    key={modifier.id}
                    className={`${styles.optionRow} ${selected ? styles.optionSelected : ''}`}
                    onClick={() => toggleModifier(group.id, modifier.id, group.max)}
                  >
                    <span className={styles.optionName}>{modifier.name}</span>
                    <div className={styles.optionRight}>
                      {modifier.priceImpact > 0 && (
                        <span className={styles.optionPrice}>+{formatEuro(modifier.priceImpact)}</span>
                      )}
                      <div className={`${styles.check} ${selected ? styles.checked : ''}`}>
                        {selected && '✓'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}

          <div className={styles.group}>
            <div className={styles.groupHeader}>
              <span className={styles.groupTitle}>Notas</span>
              <span className={styles.optional}>Opcional</span>
            </div>
            <textarea
              className={styles.notes}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Sin cebolla, salsa aparte, etc."
              rows={3}
            />
          </div>
        </div>

        <div className={styles.footer}>
          <div className={styles.qtyCtrl}>
            <button className={styles.qtyBtn} onClick={() => setQty((value) => Math.max(1, value - 1))}>−</button>
            <span className={styles.qtyNum}>{qty}</span>
            <button className={styles.qtyBtn} onClick={() => setQty((value) => value + 1)}>+</button>
          </div>
          <button className={styles.addBtn} onClick={handleAdd}>
            <span>Añadir</span>
            <span className={styles.addBtnPrice}>{formatEuro(linePrice)}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
