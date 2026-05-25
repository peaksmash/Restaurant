import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CustomerInfo, TableResolveResponse } from '@kiosk/types';
import {
  buildCartKey,
  createQrOrderSession,
  fetchCatalog,
  fetchConfig,
  getRestaurantLogo,
  getRestaurantName,
  resolveTableByQrToken,
} from './api';
import {
  getCartTotal,
  getCartLineDiscountedTotal,
  getCartLineOriginalTotal,
} from './cartPricing';
import type {
  CatalogCategory,
  CatalogProduct,
  Customer,
  KioskConfig,
  Modifier,
  ModifierGroup,
  QrCartItem,
} from './api';
import { CartReviewScreen } from './components/CartReviewScreen';
import { ConfirmationScreen } from './components/ConfirmationScreen';
import { CustomerScreen } from './components/CustomerScreen';
import { ErrorScreen } from './components/ErrorScreen';
import { MenuScreen } from './components/MenuScreen';
import { ProductDetailScreen } from './components/ProductDetailScreen';
import { TableIntroScreen } from './components/TableIntroScreen';
import { buildQrCartStorageKey, clearStoredCart, loadStoredCart, saveStoredCart } from './lib/cartStorage';
import type { QrCartState, QrOrderConfirmation, QrResolvedTable, VisualTheme } from './types';

type Screen = 'loading' | 'error' | 'table-intro' | 'menu' | 'product-detail' | 'cart-review' | 'customer' | 'confirmation';

function normalizeTheme(raw: string | undefined): VisualTheme {
  if (!raw) return 'principal';
  if (raw === 'mcdonalds') return 'moderno';
  if (raw === 'advanced') return 'morado';
  if (raw === 'principal' || raw === 'moderno' || raw === 'simple' || raw === 'morado') return raw;
  return 'principal';
}

function getQrTokenFromLocation() {
  const params = new URLSearchParams(window.location.search);
  return params.get('qrToken')?.trim() || '';
}

function emptyCartState(): QrCartState {
  return {
    cart: [],
    customer: {},
    generalNotes: '',
    paymentMode: 'online',
  };
}

export function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const [table, setTable] = useState<QrResolvedTable | null>(null);
  const [config, setConfig] = useState<KioskConfig | null>(null);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [allModifierGroups, setAllModifierGroups] = useState<ModifierGroup[]>([]);

  const [cartState, setCartState] = useState<QrCartState>(emptyCartState);
  const [confirmation, setConfirmation] = useState<QrOrderConfirmation | null>(null);
  const [confirmationCustomerName, setConfirmationCustomerName] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [addedSignal, setAddedSignal] = useState(0);
  const [lastAddedProductId, setLastAddedProductId] = useState<string | null>(null);
  const [lastAddedFromDetail, setLastAddedFromDetail] = useState(false);
  const [resolvedQrToken] = useState(() => getQrTokenFromLocation());
  const checkoutExternalIdRef = useRef<string | null>(null);

  const modifierGroupsById = useMemo(() => {
    const map = new Map<string, ModifierGroup>();
    for (const group of allModifierGroups) map.set(group.id, group);
    return map;
  }, [allModifierGroups]);

  const cartTotal = useMemo(() => getCartTotal(cartState.cart), [cartState.cart]);
  const cartDiscountTotal = useMemo(
    () => cartState.cart.reduce((sum, item) => sum + (getCartLineOriginalTotal(item) - getCartLineDiscountedTotal(item)), 0),
    [cartState.cart],
  );
  const cartQuantityByProductId = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of cartState.cart) {
      map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity);
    }
    return map;
  }, [cartState.cart]);
  const lastCartItemByProductId = useMemo(() => {
    const map = new Map<string, QrCartItem>();
    for (const item of cartState.cart) map.set(item.productId, item);
    return map;
  }, [cartState.cart]);

  const modifiersEnabled = config?.kiosk.features.modifiers ?? true;
  const productCommentsEnabled = config?.kiosk.notes.productCommentsEnabled ?? false;
  const theme = normalizeTheme(config?.kiosk.theme);
  const restaurantName = getRestaurantName(config);
  const logoUrl = getRestaurantLogo(config) ?? undefined;
  const tableLabel = table?.tableName ?? 'Mesa';
  const checkoutEnabled = Boolean(table && config);
  const checkoutDisabledMessage = 'No se puede crear la sesión del pedido en este momento.';

  const productModifierGroups = useMemo(() => {
    if (!selectedProduct) return [];
    return (selectedProduct.modifierGroups ?? [])
      .map((id) => modifierGroupsById.get(id))
      .filter((group): group is ModifierGroup => group != null);
  }, [selectedProduct, modifierGroupsById]);

  const enabledCategories = useMemo(
    () => categories.filter((category) => category.enabled),
    [categories],
  );

  const loadData = useCallback(async () => {
    setScreen('loading');
    setErrorMessage('');

    try {
      if (!resolvedQrToken) {
        throw new Error('QR no válido. Falta el token de mesa.');
      }

      const resolvedTable: QrResolvedTable = await resolveTableByQrToken(resolvedQrToken);
      const [cfg, catalog] = await Promise.all([fetchConfig(), fetchCatalog()]);
      setTable(resolvedTable);
      setConfig(cfg);
      setCategories((catalog.categories ?? []).filter((category) => category.enabled));
      setAllModifierGroups(catalog.modifierGroups ?? []);
      setScreen('table-intro');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Error desconocido');
      setScreen('error');
    }
  }, [resolvedQrToken]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!table) return;
    const key = buildQrCartStorageKey(resolvedQrToken, table.tableId);
    const stored = loadStoredCart(key);
    if (stored) setCartState(stored);
  }, [resolvedQrToken, table]);

  useEffect(() => {
    if (!table) return;
    const key = buildQrCartStorageKey(resolvedQrToken, table.tableId);
    saveStoredCart(key, cartState);
  }, [cartState, resolvedQrToken, table]);

  useEffect(() => {
    checkoutExternalIdRef.current = null;
  }, [cartState.cart, cartState.customer, cartState.generalNotes, cartState.paymentMode, table?.tableId]);

  function openProductDetail(product: CatalogProduct) {
    setSelectedProduct(product);
    setScreen('product-detail');
  }

  function productNeedsDetail(product: CatalogProduct) {
    return Boolean(
      (modifiersEnabled && Array.isArray(product.modifierGroups) && product.modifierGroups.length > 0) ||
      productCommentsEnabled
    );
  }

  function addToCart(product: CatalogProduct, selectedModifiers: Modifier[], comments: string) {
    const fromDetail = screen === 'product-detail';
    const cartKey = buildCartKey(product.id, selectedModifiers.map((modifier) => modifier.id), comments);
    const modifierExtra = selectedModifiers.reduce((sum, modifier) => sum + (modifier.priceImpact ?? 0), 0);
    const unitPrice = product.price + modifierExtra;

    setCartState((previous) => {
      const existing = previous.cart.find((item) => item.cartKey === cartKey);
      if (existing) {
        return {
          ...previous,
          cart: previous.cart.map((item) =>
            item.cartKey === cartKey ? { ...item, quantity: item.quantity + 1 } : item,
          ),
        };
      }

      const newItem: QrCartItem = {
        cartKey,
        productId: product.id,
        name: product.name,
        unitPrice,
        quantity: 1,
        type: product.type,
        modifiers: selectedModifiers.map((modifier) => ({
          id: modifier.id,
          name: modifier.name,
          priceImpact: modifier.priceImpact,
          quantity: 1,
        })),
        comments: comments.trim() || undefined,
        imageUrl: product.imageUrl,
        displayPrice: product.displayPrice,
        promotion: product.promotion,
        promotionId: product.promotion?.id,
      };

      return {
        ...previous,
        cart: [...previous.cart, newItem],
      };
    });

    setAddedSignal((value) => value + 1);
    setLastAddedProductId(product.id);
    setLastAddedFromDetail(fromDetail);
    setSelectedProduct(null);
    setScreen('menu');
  }

  function changeQty(cartKey: string, delta: number) {
    setCartState((previous) => ({
      ...previous,
      cart: previous.cart
        .map((item) => (item.cartKey === cartKey ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0),
    }));
  }

  function removeLastOfProduct(productId: string) {
    const item = lastCartItemByProductId.get(productId);
    if (item) changeQty(item.cartKey, -1);
  }

  function editCartItem(item: QrCartItem) {
    setCartState((previous) => ({
      ...previous,
      cart: previous.cart.filter((cartItem) => cartItem.cartKey !== item.cartKey),
    }));

    const product = enabledCategories.flatMap((category) => category.products).find((candidate) => candidate.id === item.productId);
    if (!product) {
      setScreen('menu');
      return;
    }

    if (productNeedsDetail(product)) {
      setSelectedProduct(product);
      setScreen('product-detail');
      return;
    }

    setScreen('menu');
  }

  async function doSend(customer: Customer, notes: string, paymentMode: 'online' | 'cashier') {
    if (!table) return;

    setSending(true);
    try {
      const externalId = checkoutExternalIdRef.current ?? `qro_${crypto.randomUUID()}`;
      checkoutExternalIdRef.current = externalId;

      const result = await createQrOrderSession({
        externalId,
        table: table as TableResolveResponse,
        customer,
        generalNotes: notes,
        paymentMode,
        items: cartState.cart,
        currency: 'EUR',
        subtotal: cartTotal + cartDiscountTotal,
        discountTotal: cartDiscountTotal,
        total: cartTotal,
      });

      setConfirmation({
        ...result,
        tableName: table.tableName,
      });
      setConfirmationCustomerName(customer.name ?? undefined);
      clearStoredCart(buildQrCartStorageKey(resolvedQrToken, table.tableId));
      setCartState(emptyCartState());
      checkoutExternalIdRef.current = null;
      setScreen('confirmation');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Error al crear el pedido');
      setScreen('error');
    } finally {
      setSending(false);
    }
  }

  function startNewOrder() {
    setConfirmation(null);
    setConfirmationCustomerName(undefined);
    setCartState(emptyCartState());
    checkoutExternalIdRef.current = null;
    setScreen('menu');
  }

  if (screen === 'loading' || (screen === 'table-intro' && table)) {
    return (
      <TableIntroScreen
        loading={screen === 'loading'}
        logoUrl={logoUrl}
        restaurantName={(table?.restaurantName || restaurantName)}
        tableName={table?.tableName || 'Tu mesa'}
        onContinue={() => setScreen('menu')}
      />
    );
  }
  if (screen === 'error') return <ErrorScreen message={errorMessage} onRetry={loadData} />;

  if (screen === 'confirmation' && confirmation) {
    return (
      <ConfirmationScreen
        orderCode={confirmation.orderCode}
        customerName={confirmationCustomerName}
        contextLabel={tableLabel}
        totals={{
          total: confirmation.total,
          discountTotal: confirmation.discountTotal,
          tax: 0,
        }}
        estimatedReadyAt={confirmation.estimatedReadyAt}
        paymentMode={confirmation.paymentMode}
        paymentStatus={confirmation.paymentStatus}
        lastSyncStatus={confirmation.lastSyncStatus}
        pin4={confirmation.pin4}
        rescueToken={confirmation.qrToken}
        expiresAt={confirmation.expiresAt}
        onNewOrder={startNewOrder}
      />
    );
  }

  if (screen === 'product-detail' && selectedProduct) {
    return (
      <ProductDetailScreen
        product={selectedProduct}
        groups={productModifierGroups}
        productCommentsEnabled={productCommentsEnabled}
        theme={theme}
        onConfirm={(product, modifiers, comments) => addToCart(product, modifiers, comments)}
        onCancel={() => {
          setSelectedProduct(null);
          setScreen('menu');
        }}
      />
    );
  }

  if (screen === 'cart-review') {
    return (
      <CartReviewScreen
        cart={cartState.cart}
        cartTotal={cartTotal}
        contextLabel={tableLabel}
        onChangeQty={changeQty}
        onEditItem={editCartItem}
        onBack={() => setScreen('menu')}
        onConfirm={() => setScreen('customer')}
      />
    );
  }

  if (screen === 'customer' && config) {
    return (
      <CustomerScreen
        config={config}
        sending={sending}
        initialCustomer={cartState.customer}
        initialNotes={cartState.generalNotes}
        initialPaymentMode={cartState.paymentMode}
        checkoutEnabled={checkoutEnabled}
        checkoutDemoMode={Boolean(config.paymentsSimulated)}
        checkoutDisabledMessage={checkoutDisabledMessage}
        onConfirm={(customer: CustomerInfo, notes: string, paymentMode) => {
          setCartState((previous) => ({
            ...previous,
            customer,
            generalNotes: notes,
            paymentMode,
          }));
          void doSend(customer, notes, paymentMode);
        }}
        onBack={() => setScreen('cart-review')}
      />
    );
  }

  return (
    <MenuScreen
      categories={enabledCategories}
      cart={cartState.cart}
      cartTotal={cartTotal}
      contextLabel={tableLabel}
      theme={theme}
      restaurantName={table?.restaurantName || restaurantName}
      logoUrl={logoUrl}
      modifiersEnabled={modifiersEnabled}
      productCommentsEnabled={productCommentsEnabled}
      cartQuantityByProductId={cartQuantityByProductId}
      addedSignal={addedSignal}
      lastAddedProductId={lastAddedProductId}
      lastAddedFromDetail={lastAddedFromDetail}
      onAddToCart={(product) => addToCart(product, [], '')}
      onOpenDetail={openProductDetail}
      onRemoveLast={removeLastOfProduct}
      onViewCart={() => setScreen('cart-review')}
      onConsumeAddedFromDetail={() => {
        setLastAddedProductId(null);
        setLastAddedFromDetail(false);
      }}
      tableLabel={tableLabel}
    />
  );
}
