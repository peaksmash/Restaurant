/** Badge metadata for promotion display — used in product cards and cart lines. */

export interface PromotionBadgeMeta {
  label: string;
  /** CSS modifier class that sets the badge background color. */
  colorClass: 'promo-color--2x1' | 'promo-color--percentage' | 'promo-color--currency' | 'promo-color--other';
}

interface PromotionLike {
  discountType?: string;
  label?: string;
  name?: string;
  discountAmount?: number;
}

/**
 * Centralised badge label + color for any promotion shape.
 * Returns null if no promotion is provided.
 */
export function getPromotionBadgeMeta(
  promotion: PromotionLike | null | undefined,
): PromotionBadgeMeta | null {
  if (!promotion) return null;

  const { discountType, label, name, discountAmount } = promotion;

  if (discountType === '2x1') {
    return { label: '2x1', colorClass: 'promo-color--2x1' };
  }

  if (discountType === 'percentage') {
    const text = label ?? (discountAmount != null ? `-${discountAmount}%` : 'Oferta');
    return { label: text, colorClass: 'promo-color--percentage' };
  }

  if (discountType === 'currency') {
    return { label: label ?? 'Descuento', colorClass: 'promo-color--currency' };
  }

  return { label: label ?? name ?? 'Promo', colorClass: 'promo-color--other' };
}
