import type { CartaLine } from '../pages/CartaCartPage';

function lineModifiersTotal(line: CartaLine): number {
  return line.modifiers.reduce((sum, modifier) => sum + modifier.price * (modifier.quantity ?? 1), 0);
}

export function getLineOriginalUnitPrice(line: CartaLine) {
  return line.product.price + lineModifiersTotal(line);
}

export function getLineDisplayUnitPrice(line: CartaLine) {
  const base = line.product.price;
  const displayBase =
    line.product.displayPrice != null && line.product.displayPrice < base
      ? line.product.displayPrice
      : base;

  return displayBase + lineModifiersTotal(line);
}

export function getLineOriginalTotal(line: CartaLine) {
  return line.quantity * getLineOriginalUnitPrice(line);
}

export function getLineDiscountedTotal(line: CartaLine) {
  return line.quantity * getLineDisplayUnitPrice(line);
}

export function getCartOriginalTotal(lines: CartaLine[]) {
  return lines.reduce((sum, line) => sum + getLineOriginalTotal(line), 0);
}

export function getCartDiscountedTotal(lines: CartaLine[]) {
  return lines.reduce((sum, line) => sum + getLineDiscountedTotal(line), 0);
}
