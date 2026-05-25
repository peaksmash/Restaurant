import type { KioskCartItem } from './api';

/**
 * Central cart pricing helpers.
 * All visual totals (cart bar, cart review footer, line subtotals) use these.
 * The real `item.unitPrice` is never modified — POST /api/orders always sends it as-is.
 */

/** Sum of modifier priceImpacts for ONE unit of a cart line. */
export function modifiersTotal(item: KioskCartItem): number {
  return item.modifiers.reduce((s, m) => s + m.priceImpact * (m.quantity ?? 1), 0);
}

/**
 * Discounted BASE price (product only, no modifiers) for display.
 * Respects displayPrice from the backend for percentage / currency promos.
 * For 2x1 promos, displayPrice === product.price so this returns the full base price.
 */
export function unitBasePrice(item: KioskCartItem): number {
  const modExtra = modifiersTotal(item);
  const base = item.unitPrice - modExtra;
  return item.displayPrice != null && item.displayPrice < base ? item.displayPrice : base;
}

/**
 * Visual price per unit (base + modifiers).
 * For percentage / currency promos: less than item.unitPrice.
 * For 2x1: equals item.unitPrice (the per-unit discount is quantity-based, not per-unit).
 */
export function unitDisplayPrice(item: KioskCartItem): number {
  return unitBasePrice(item) + modifiersTotal(item);
}

/**
 * Full line total with NO promotion applied.
 * Used as the struck-through "original" price when a discount is active.
 */
export function getCartLineOriginalTotal(item: KioskCartItem): number {
  return item.quantity * item.unitPrice;
}

/**
 * Line total with promotion fully applied.
 *
 * 2x1: every other base unit is free; modifiers charged per unit always.
 *   paidUnits = ceil(qty / 2)
 *   total = paidUnits * basePrice + qty * modifiersTotal
 *
 * percentage / currency: flat per-unit visual price already in unitDisplayPrice.
 *   total = qty * unitDisplayPrice
 */
export function getCartLineDiscountedTotal(item: KioskCartItem): number {
  const base = unitBasePrice(item);
  const mods = modifiersTotal(item);
  const qty = item.quantity;

  if (item.promotion?.discountType === '2x1') {
    const paidUnits = Math.ceil(qty / 2);
    return paidUnits * base + qty * mods;
  }

  return qty * (base + mods);
}

/** Whether the line has an active promotion reducing its total. */
export function lineHasDiscount(item: KioskCartItem): boolean {
  return getCartLineDiscountedTotal(item) < getCartLineOriginalTotal(item);
}

/** Visual grand total for the entire cart (all promotions applied). */
export function getCartTotal(items: KioskCartItem[]): number {
  return items.reduce((s, item) => s + getCartLineDiscountedTotal(item), 0);
}
