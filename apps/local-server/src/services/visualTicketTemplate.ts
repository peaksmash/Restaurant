import type { OperationalTicket } from '@kiosk/types';

const SVG_W = 720;
const H_PAD = 32;

type FulfillType = 'dine_in' | 'takeaway' | 'delivery';

const DELIVERY_SOURCES = new Set<string>(['glovo', 'uber', 'just_eat', 'deliveroo']);

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  } catch {
    return '—';
  }
}

function formatMoney(total: number | null | undefined, currency: string | null | undefined): string | null {
  if (typeof total !== 'number' || !currency) return null;
  try {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(total / 100);
  } catch {
    return null;
  }
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}\u2026` : text;
}

/** "K-K678" → "K678",  "K-678" → "K678",  "K678" → "K678" */
function formatOrderNumber(raw: string): string {
  return raw.replace(/^([A-Za-z]+)-\1?/i, '$1').replace(/-/g, '');
}

/**
 * Abbreviates middle names so the result fits maxLen.
 * "JOSE ANTONIO RANEA" → "JOSE A. RANEA"
 * "JOSE ANTONIO CARLOS RANEA" → "JOSE A. C. RANEA"
 */
function abbreviateName(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name;
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 2) return truncate(name, maxLen);
  const abbreviated = [
    parts[0],
    ...parts.slice(1, -1).map((p) => `${p[0].toUpperCase()}.`),
    parts[parts.length - 1],
  ].join(' ');
  return abbreviated.length <= maxLen ? abbreviated : truncate(abbreviated, maxLen);
}

function resolveFulfillment(ticket: OperationalTicket): { type: FulfillType; platformLabel: string | null } {
  if (DELIVERY_SOURCES.has(ticket.source)) {
    const raw = ticket.sourceLabel ?? ticket.source;
    return { type: 'delivery', platformLabel: raw.toUpperCase() };
  }
  if (ticket.tableName) {
    return { type: 'dine_in', platformLabel: null };
  }
  return { type: 'takeaway', platformLabel: null };
}

export function renderTicketSvg(ticket: OperationalTicket): string {
  const fulfill = resolveFulfillment(ticket);

  // --- Section heights ---
  const HEADER_H         = 200;  // two rows: number + name
  const FULFILL_H        = fulfill.type === 'delivery' ? 100 : 80;
  const TIMES_H          = 64;
  const NOTES_H          = 110;  // notes BOX above items (when present)
  const NOTES_GAP        = 20;
  const ITEMS_TOP_GAP    = 32;
  const ITEM_NAME_H      = 68;   // bigger items (font-size 48)
  const PROMO_ROW_H      = 34;
  const MOD_ROW_H        = 50;   // bigger modifiers (font-size 32)
  const ITEM_NOTE_ROW_H  = 42;
  const ITEM_GAP_H       = 20;
  const ITEMS_BOTTOM_GAP = 32;
  const PROMO_WARN_TITLE_H = 36;
  const PROMO_WARN_ROW_H   = 34;
  const PROMO_WARN_GAP     = 20;
  const SUMMARY_ROW_H    = 56;
  const SUMMARY_PAD      = 40;
  const BOTTOM_PAD       = 36;

  const hasNotes = Boolean(ticket.notes);

  // --- Dynamic heights ---
  const itemsHeight = ticket.items.reduce((sum, item, idx) => {
    const gap = idx < ticket.items.length - 1 ? ITEM_GAP_H : 0;
    return (
      sum +
      ITEM_NAME_H +
      (item.promotionLabel ? PROMO_ROW_H : 0) +
      item.modifiers.length * MOD_ROW_H +
      (item.notes ? ITEM_NOTE_ROW_H : 0) +
      gap
    );
  }, 0);

  // Summary
  const subtotalLabel   = formatMoney(ticket.subtotal ?? null, ticket.currency ?? null);
  const totalLabel      = formatMoney(ticket.total ?? null, ticket.currency ?? null);
  const hasPromos       = typeof ticket.discountTotal === 'number' && ticket.discountTotal !== 0;
  const promoAmountLabel = hasPromos
    ? formatMoney(Math.abs(ticket.discountTotal!), ticket.currency ?? null)
    : null;
  const summaryRowCount =
    (subtotalLabel !== null ? 1 : 0) +
    (promoAmountLabel !== null ? 1 : 0) +
    (totalLabel !== null ? 1 : 0);
  const SUMMARY_H = summaryRowCount > 0 ? summaryRowCount * SUMMARY_ROW_H + SUMMARY_PAD : 0;

  // Promo warnings
  const adjustedItems = ticket.items.filter((item) => item.hasPromotionAdjustment);
  const PROMO_WARN_H = adjustedItems.length > 0
    ? PROMO_WARN_TITLE_H + adjustedItems.length * PROMO_WARN_ROW_H + PROMO_WARN_GAP
    : 0;

  const totalH =
    HEADER_H + FULFILL_H + TIMES_H +
    (hasNotes ? NOTES_H + NOTES_GAP : 0) +
    ITEMS_TOP_GAP + itemsHeight + ITEMS_BOTTOM_GAP +
    PROMO_WARN_H +
    SUMMARY_H +
    BOTTOM_PAD;

  // --- Y anchors ---
  const Y_FULFILL     = HEADER_H;
  const Y_TIMES       = Y_FULFILL + FULFILL_H;
  const Y_NOTES_BOX   = Y_TIMES + TIMES_H;
  const Y_ITEMS_START = Y_NOTES_BOX + (hasNotes ? NOTES_H + NOTES_GAP : 0) + ITEMS_TOP_GAP;
  const Y_PROMO_WARN  = Y_ITEMS_START + itemsHeight + ITEMS_BOTTOM_GAP;
  const Y_SUMMARY     = Y_PROMO_WARN + PROMO_WARN_H;

  const clipId = `tc${ticket.ticketId.replace(/-/g, '').slice(0, 12)}`;

  // --- Header ---
  // Full black rectangle, no top-corner rounding (clipPath has rx=0)
  const orderNum = formatOrderNumber(ticket.displayNumber);
  const rawName  = ticket.customerName ?? '';
  const nameDisplay = rawName ? abbreviateName(rawName.toUpperCase(), 18) : '';

  const headerEl = [
    `<rect width="${SVG_W}" height="${HEADER_H}" fill="#101828"/>`,
    // Order number — large, top-left
    `<text x="${H_PAD}" y="92" font-size="80" font-weight="800" fill="#ffffff" letter-spacing="-1">${escapeXml(orderNum)}</text>`,
    // Customer name — triple of original (26→78px), bottom of header, abbreviated
    nameDisplay
      ? `<text x="${H_PAD}" y="${HEADER_H - 22}" font-size="72" font-weight="800" fill="#ffffff" letter-spacing="-1">${escapeXml(nameDisplay)}</text>`
      : '',
  ].filter(Boolean).join('\n  ');

  // --- Fulfillment strip — CENTRADO ---
  let fulfillEl: string;
  const cx = Math.round(SVG_W / 2);
  if (fulfill.type === 'dine_in') {
    const txt = `MESA ${ticket.tableName!.toUpperCase()}  ·  TOMAR AQUÍ`;
    fulfillEl = [
      `<rect x="0" y="${Y_FULFILL}" width="${SVG_W}" height="${FULFILL_H}" fill="#f0fdf4"/>`,
      `<text x="${cx}" y="${Y_FULFILL + 50}" font-size="34" font-weight="800" fill="#166534" text-anchor="middle">${escapeXml(truncate(txt, 32))}</text>`,
    ].join('\n  ');
  } else if (fulfill.type === 'takeaway') {
    fulfillEl = [
      `<rect x="0" y="${Y_FULFILL}" width="${SVG_W}" height="${FULFILL_H}" fill="#eff8ff"/>`,
      `<text x="${cx}" y="${Y_FULFILL + 50}" font-size="40" font-weight="800" fill="#175cd3" text-anchor="middle">LLEVAR</text>`,
    ].join('\n  ');
  } else {
    fulfillEl = [
      `<rect x="0" y="${Y_FULFILL}" width="${SVG_W}" height="${FULFILL_H}" fill="#fff7ed"/>`,
      `<text x="${cx}" y="${Y_FULFILL + 38}" font-size="26" font-weight="700" fill="#9a3412" text-anchor="middle">${escapeXml(fulfill.platformLabel ?? 'PLATAFORMA')}</text>`,
      `<text x="${cx}" y="${Y_FULFILL + 78}" font-size="34" font-weight="800" fill="#9a3412" text-anchor="middle">DOMICILIO</text>`,
    ].join('\n  ');
  }

  // --- Times strip ---
  const entradaTime = formatTime(ticket.createdAt);
  const estTime  = ticket.estimatedReadyAt ? formatTime(ticket.estimatedReadyAt) : '—';
  const estColor = ticket.estimatedReadyAt ? '#101828' : '#98a2b3';
  const timesEl = [
    `<rect x="0" y="${Y_TIMES}" width="${SVG_W}" height="${TIMES_H}" fill="#f9fafb"/>`,
    `<line x1="0" y1="${Y_TIMES}" x2="${SVG_W}" y2="${Y_TIMES}" stroke="#e4e7ec" stroke-width="1"/>`,
    `<line x1="0" y1="${Y_TIMES + TIMES_H}" x2="${SVG_W}" y2="${Y_TIMES + TIMES_H}" stroke="#e4e7ec" stroke-width="1"/>`,
    `<text x="${H_PAD}" y="${Y_TIMES + 40}" font-size="19" font-weight="700" fill="#667085">ENTRADA:</text>`,
    `<text x="${H_PAD + 112}" y="${Y_TIMES + 40}" font-size="24" font-weight="700" fill="#101828">${escapeXml(entradaTime)}</text>`,
    `<text x="${Math.round(SVG_W / 2) + 20}" y="${Y_TIMES + 40}" font-size="19" font-weight="700" fill="#667085">ENTREGA EST.:</text>`,
    `<text x="${SVG_W - H_PAD}" y="${Y_TIMES + 40}" font-size="24" font-weight="700" text-anchor="end" fill="${estColor}">${escapeXml(estTime)}</text>`,
  ].join('\n  ');

  // --- Notes ABOVE items — centradas, con puntos, doble tamaño ---
  const notesElems: string[] = [];
  if (hasNotes && ticket.notes) {
    const by = Y_NOTES_BOX + 12;
    const bh = NOTES_H - 12;
    notesElems.push(
      `<rect x="0" y="${Y_NOTES_BOX}" width="${SVG_W}" height="${NOTES_H}" fill="#fffbeb"/>`,
      `<line x1="0" y1="${Y_NOTES_BOX}" x2="${SVG_W}" y2="${Y_NOTES_BOX}" stroke="#f59e0b" stroke-width="3"/>`,
      `<line x1="0" y1="${Y_NOTES_BOX + NOTES_H}" x2="${SVG_W}" y2="${Y_NOTES_BOX + NOTES_H}" stroke="#f59e0b" stroke-width="3"/>`,
      // Puntos decorativos
      `<text x="${cx}" y="${by + 34}" font-size="22" font-weight="700" fill="#b45309" text-anchor="middle">· · · NOTAS · · ·</text>`,
      // Texto de nota: doble de grande (era 22, ahora 40), centrado
      `<text x="${cx}" y="${by + bh - 14}" font-size="40" font-weight="700" fill="#92400e" text-anchor="middle">${escapeXml(truncate(ticket.notes, 28))}</text>`,
    );
  }

  // --- Items ---
  let itemY = Y_ITEMS_START;
  const itemElems: string[] = [];
  for (let i = 0; i < ticket.items.length; i++) {
    const item = ticket.items[i];
    const isLast = i === ticket.items.length - 1;

    const visibleQty = item.displayedQuantity ?? item.quantity;
    const asterisk = item.hasPromotionAdjustment ? '*' : '';
    // Format: "2X WATER" — multiplicador con X pegada
    const label = `${visibleQty}X ${item.name.toUpperCase()}${asterisk}`;
    const lineTotalLabel = formatMoney(item.totalPrice ?? null, ticket.currency ?? null);
    const itemBaseline = itemY + 50;

    itemElems.push(
      // Item nombre — doble de grande (era 26, ahora 48)
      `<text x="${H_PAD}" y="${itemBaseline}" font-size="48" font-weight="800" fill="#101828">${escapeXml(truncate(label, lineTotalLabel ? 22 : 28))}</text>`
    );
    if (lineTotalLabel) {
      itemElems.push(
        `<text x="${SVG_W - H_PAD}" y="${itemBaseline}" font-size="40" font-weight="700" text-anchor="end" fill="#101828">${escapeXml(lineTotalLabel)}</text>`
      );
    }
    itemY += ITEM_NAME_H;

    // Promotion badge
    if (item.promotionLabel) {
      itemElems.push(
        `<text x="${H_PAD + 16}" y="${itemY + 24}" font-size="22" font-weight="700" fill="#7c3aed">★ ${escapeXml(truncate(item.promotionLabel, 36))}</text>`
      );
      itemY += PROMO_ROW_H;
    }

    // Modifiers — grandes, en mayúsculas, claros, debajo
    for (const mod of item.modifiers) {
      const qty = mod.quantity > 1 ? `${mod.quantity}X ` : '';
      const modLabel = `+ ${qty}${mod.name.toUpperCase()}`;
      const modPriceLabel = (mod.totalPrice != null && mod.totalPrice > 0)
        ? formatMoney(mod.totalPrice, ticket.currency ?? null)
        : null;
      const modBaseline = itemY + 36;

      itemElems.push(
        `<text x="${H_PAD + 24}" y="${modBaseline}" font-size="32" font-weight="700" fill="#344054">${escapeXml(truncate(modLabel, modPriceLabel ? 30 : 38))}</text>`
      );
      if (modPriceLabel) {
        itemElems.push(
          `<text x="${SVG_W - H_PAD}" y="${modBaseline}" font-size="28" font-weight="600" text-anchor="end" fill="#475467">+${escapeXml(modPriceLabel)}</text>`
        );
      }
      itemY += MOD_ROW_H;
    }

    // Item note
    if (item.notes) {
      itemElems.push(
        `<text x="${H_PAD + 24}" y="${itemY + 30}" font-size="26" fill="#b54708">NOTA: ${escapeXml(truncate(item.notes, 36))}</text>`
      );
      itemY += ITEM_NOTE_ROW_H;
    }

    if (!isLast) {
      itemElems.push(
        `<line x1="${H_PAD}" y1="${itemY + 6}" x2="${SVG_W - H_PAD}" y2="${itemY + 6}" stroke="#e4e7ec" stroke-width="2"/>`
      );
      itemY += ITEM_GAP_H;
    }
  }

  // --- Promo warnings ---
  const promoWarnElems: string[] = [];
  if (adjustedItems.length > 0) {
    let warnY = Y_PROMO_WARN;
    promoWarnElems.push(
      `<line x1="${H_PAD}" y1="${warnY}" x2="${SVG_W - H_PAD}" y2="${warnY}" stroke="#e4e7ec" stroke-width="1"/>`,
      `<text x="${H_PAD}" y="${warnY + 26}" font-size="16" font-weight="700" fill="#6941c6">AVISOS DE PROMOCIÓN</text>`
    );
    warnY += PROMO_WARN_TITLE_H;
    for (const item of adjustedItems) {
      const orig = item.originalQuantity ?? item.quantity;
      const displayed = item.displayedQuantity ?? item.quantity;
      const promoTag = item.promotionLabel ?? '2x1';
      const msg = `* CLIENTE PIDIÓ ${orig} ${item.name.toUpperCase()}. SE PINTAN ${displayed} POR PROMO ${promoTag}.`;
      promoWarnElems.push(
        `<text x="${H_PAD}" y="${warnY + 22}" font-size="17" fill="#7c3aed">${escapeXml(truncate(msg, 58))}</text>`
      );
      warnY += PROMO_WARN_ROW_H;
    }
  }

  // --- Summary ---
  const summaryElems: string[] = [];
  if (summaryRowCount > 0) {
    const sepY = Y_SUMMARY + 12;
    summaryElems.push(
      `<line x1="${H_PAD}" y1="${sepY}" x2="${SVG_W - H_PAD}" y2="${sepY}" stroke="#e4e7ec" stroke-width="3"/>`
    );

    let rowY = sepY + 12 + SUMMARY_ROW_H;

    if (subtotalLabel) {
      summaryElems.push(
        `<text x="${H_PAD}" y="${rowY}" font-size="26" font-weight="600" fill="#667085">SUBTOTAL</text>`,
        `<text x="${SVG_W - H_PAD}" y="${rowY}" font-size="26" font-weight="600" text-anchor="end" fill="#344054">${escapeXml(subtotalLabel)}</text>`
      );
      rowY += SUMMARY_ROW_H;
    }

    if (promoAmountLabel) {
      summaryElems.push(
        `<text x="${H_PAD}" y="${rowY}" font-size="26" font-weight="600" fill="#667085">PROMOS</text>`,
        `<text x="${SVG_W - H_PAD}" y="${rowY}" font-size="26" font-weight="600" text-anchor="end" fill="#067647">-${escapeXml(promoAmountLabel)}</text>`
      );
      rowY += SUMMARY_ROW_H;
    }

    if (totalLabel) {
      summaryElems.push(
        // Total más grande (era 26/30, ahora 36/48)
        `<text x="${H_PAD}" y="${rowY}" font-size="36" font-weight="800" fill="#101828">TOTAL</text>`,
        `<text x="${SVG_W - H_PAD}" y="${rowY}" font-size="48" font-weight="800" text-anchor="end" fill="#101828">${escapeXml(totalLabel)}</text>`
      );
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${totalH}" viewBox="0 0 ${SVG_W} ${totalH}" role="img" aria-label="Comanda ${escapeXml(orderNum)}">
  <defs>
    <clipPath id="${clipId}">
      <rect width="${SVG_W}" height="${totalH}"/>
    </clipPath>
  </defs>
  <style>text { font-family: Arial, Helvetica, sans-serif; }</style>
  <g clip-path="url(#${clipId})">
    <rect width="${SVG_W}" height="${totalH}" fill="#ffffff"/>

    <!-- Header: negro de punta a punta, sin bordes redondeados -->
    ${headerEl}

    <!-- Franja de tipo pedido: centrada -->
    ${fulfillEl}

    <!-- Horarios -->
    ${timesEl}

    <!-- Notas generales ENCIMA de los artículos -->
    ${notesElems.join('\n    ')}

    <!-- Artículos -->
    ${itemElems.join('\n    ')}

    <!-- Avisos de promoción -->
    ${promoWarnElems.join('\n    ')}

    <!-- Resumen de importes -->
    ${summaryElems.join('\n    ')}
  </g>
</svg>`;
}
