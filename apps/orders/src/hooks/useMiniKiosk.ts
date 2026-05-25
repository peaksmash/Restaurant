import { useCallback, useEffect, useMemo, useState } from 'react';
import type { OrderSession } from '@kiosk/types';
import { createMiniKioskOrderSession, getMiniKioskCatalog, getMiniKioskConfig, type MiniKioskCatalog, type MiniKioskConfig } from '../api';
import { getCartDiscountedTotal, getCartOriginalTotal, getLineOriginalTotal, getLineOriginalUnitPrice } from '../lib/cartPricing';
import { MOCK_CARTA_CATEGORIES, type CartaCategory } from '../mock/menu';
import type { CartaLine } from '../pages/CartaCartPage';

type MiniKioskMode = 'real' | 'demo';

interface CreateState {
  creating: boolean;
  error: string | null;
  createdOrder: OrderSession | null;
}

function normalizeCategories(categories: CartaCategory[]) {
  return categories
    .filter((category) => category.enabled !== false)
    .map((category) => ({
      ...category,
      products: (category.products ?? []).filter((product) => product.enabled !== false),
    }))
    .filter((category) => category.products.length > 0);
}

function buildExternalId() {
  return `mini-kiosk-${crypto.randomUUID()}`;
}

export function useMiniKiosk() {
  const [mode, setMode] = useState<MiniKioskMode>('real');
  const [loading, setLoading] = useState(true);
  const [connectionMessage, setConnectionMessage] = useState('Conectado a catálogo/config real');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [config, setConfig] = useState<MiniKioskConfig | null>(null);
  const [catalog, setCatalog] = useState<MiniKioskCatalog>({
    categories: [],
    modifierGroups: [],
  });
  const [createState, setCreateState] = useState<CreateState>({
    creating: false,
    error: null,
    createdOrder: null,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setConnectionError(null);

    try {
      const [realConfig, realCatalog] = await Promise.all([getMiniKioskConfig(), getMiniKioskCatalog()]);
      setMode('real');
      setConnectionMessage(
        realConfig.paymentsSimulated
          ? 'Conectado a catálogo/config real · pagos en modo demo'
          : 'Conectado a catálogo/config real',
      );
      setConfig(realConfig);
      setCatalog(realCatalog);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cargar Mini Kiosko.';

      if (import.meta.env.DEV) {
        setMode('demo');
        setConnectionMessage('Modo demo — sin backend real');
        setConnectionError(message);
        setConfig(null);
        setCatalog({
          categories: MOCK_CARTA_CATEGORIES,
          modifierGroups: [],
        });
      } else {
        setMode('real');
        setConnectionMessage('Conectado a catálogo/config real');
        setConnectionError(message);
        setConfig(null);
        setCatalog({
          categories: [],
          modifierGroups: [],
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(() => normalizeCategories(catalog.categories), [catalog.categories]);

  const createPendingOrder = useCallback(async (lines: CartaLine[]) => {
    if (mode !== 'real') {
      setCreateState({
        creating: false,
        error: 'Modo demo — la creación real de pedidos no está disponible.',
        createdOrder: null,
      });
      return null;
    }

    if (lines.length === 0) {
      setCreateState({
        creating: false,
        error: 'Añade al menos un producto antes de crear la cuenta.',
        createdOrder: null,
      });
      return null;
    }

    setCreateState({
      creating: true,
      error: null,
      createdOrder: null,
    });

    try {
      const subtotal = getCartOriginalTotal(lines);
      const total = getCartDiscountedTotal(lines);
      const createdOrder = await createMiniKioskOrderSession({
        externalId: buildExternalId(),
        notes: null,
        items: lines.map((line) => ({
          id: line.id,
          productId: line.product.id,
          productName: line.product.name,
          type: line.product.type ?? 'PRODUCT',
          quantity: line.quantity,
          unitPrice: getLineOriginalUnitPrice(line),
          totalPrice: getLineOriginalTotal(line),
          notes: line.comments ?? null,
          promotionId: line.product.promotion?.id ?? null,
          promotion: line.product.promotion?.id
            ? {
                promotionId: line.product.promotion.id,
                promotionName: line.product.promotion.name ?? line.product.promotion.label ?? '',
                discountAmount: line.product.promotion.discountAmount ?? 0,
                discountType: line.product.promotion.discountType ?? null,
                label: line.product.promotion.label ?? null,
              }
            : null,
          modifiers: line.modifiers.map((modifier) => ({
            modifierGroupId: modifier.modifierGroupId,
            modifierOptionId: modifier.modifierOptionId,
            name: modifier.name,
            price: modifier.price,
            quantity: modifier.quantity ?? 1,
          })),
        })),
        subtotal,
        discountTotal: subtotal - total,
        total,
        currency: 'EUR',
      });

      setCreateState({
        creating: false,
        error: null,
        createdOrder,
      });
      return createdOrder;
    } catch (error) {
      setCreateState({
        creating: false,
        error: error instanceof Error ? error.message : 'No se pudo crear la cuenta.',
        createdOrder: null,
      });
      return null;
    }
  }, [mode]);

  const clearCreatedOrder = useCallback(() => {
    setCreateState((current) => ({
      ...current,
      createdOrder: null,
      error: null,
    }));
  }, []);

  return {
    mode,
    loading,
    connectionMessage,
    connectionError,
    config,
    categories,
    modifierGroups: catalog.modifierGroups,
    createPendingOrder,
    createState,
    clearCreatedOrder,
    refresh: load,
  };
}
