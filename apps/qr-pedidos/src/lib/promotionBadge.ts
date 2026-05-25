export interface PromotionBadgeMeta {
  label: string
  colorClass: 'promoColor2x1' | 'promoColorPercentage' | 'promoColorCurrency' | 'promoColorOther'
}

interface PromotionLike {
  discountType?: string
  label?: string
  name?: string
  discountAmount?: number
}

export function getPromotionBadgeMeta(promotion: PromotionLike | null | undefined): PromotionBadgeMeta | null {
  if (!promotion) {
    return null
  }

  const { discountType, label, name, discountAmount } = promotion

  if (discountType === '2x1') {
    return { label: '2x1', colorClass: 'promoColor2x1' }
  }

  if (discountType === 'percentage') {
    return {
      label: label ?? (discountAmount != null ? `-${discountAmount}%` : 'Oferta'),
      colorClass: 'promoColorPercentage',
    }
  }

  if (discountType === 'currency') {
    return { label: label ?? 'Descuento', colorClass: 'promoColorCurrency' }
  }

  return { label: label ?? name ?? 'Promo', colorClass: 'promoColorOther' }
}
