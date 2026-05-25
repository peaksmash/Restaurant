import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OrderSession } from '@kiosk/types';
import {
  buildCartKey,
  cartToOrderSessionItems,
  confirmRecoveredOrderPayment,
  createKioskOrderSession,
  createPaymentJob,
  fetchCatalog,
  fetchConfig,
  getPaymentJob,
  listPaymentDevices,
  recoverPendingOrder,
} from './api';
import { getCartLineOriginalTotal, getCartTotal } from './cartPricing';
import type {
  CatalogCategory,
  CatalogProduct,
  Customer,
  PaymentDeviceView,
  PaymentJobView,
  KioskCartItem,
  KioskConfig,
  Modifier,
  ModifierGroup,
  OrderMode,
  OrderTotals,
  RecoveryLookupResponse,
} from './api';
import { CartReviewScreen } from './components/CartReviewScreen';
import { CompositionModal } from './components/CompositionModal';
import { ConfirmationScreen } from './components/ConfirmationScreen';
import { CustomerScreen } from './components/CustomerScreen';
import { ErrorScreen } from './components/ErrorScreen';
import { LastMinuteScreen } from './components/LastMinuteScreen';
import { LoadingScreen } from './components/LoadingScreen';
import { MenuScreen } from './components/MenuScreen';
import { PaymentMethodScreen } from './components/PaymentMethodScreen';
import { ProductDetailScreen } from './components/ProductDetailScreen';
import { RecoveryConfirmedScreen } from './components/RecoveryConfirmedScreen';
import { RecoveryDetailScreen } from './components/RecoveryDetailScreen';
import { RecoveryEntryScreen } from './components/RecoveryEntryScreen';
import { PaymentJobScreen } from './components/PaymentJobScreen';
import { UpsellPopup } from './components/UpsellPopup';
import { WelcomeBrandScreen } from './components/WelcomeBrandScreen';
import { WelcomeScreen } from './components/WelcomeScreen';
import { useSuggestionEngine } from './hooks/useSuggestionEngine';

type Screen =
  | 'loading'
  | 'error'
  | 'welcome-brand'
  | 'welcome'
  | 'menu'
  | 'product-detail'
  | 'cart-review'
  | 'customer'
  | 'last-minute'
  | 'payment-method'
  | 'new-order-payment-job'
  | 'confirmation'
  | 'recovery-entry'
  | 'recovery-detail'
  | 'recovery-payment-job'
  | 'recovery-confirmed';

function normalizeTheme(raw: string | undefined): string {
  if (!raw) return 'principal';
  if (raw === 'mcdonalds') return 'moderno';
  if (raw === 'advanced') return 'morado';
  if (['principal', 'moderno', 'simple', 'morado'].includes(raw)) return raw;
  return 'principal';
}

function getAvailablePaymentMethods(
  devices: PaymentDeviceView[],
  paymentsSimulated: boolean
): { artemisEnabled: boolean; cashdroEnabled: boolean } {
  const artemisEnabled =
    paymentsSimulated || devices.some((d) => d.provider === 'artemis' && d.isActive);
  const cashdroEnabled =
    paymentsSimulated || devices.some((d) => d.provider === 'cashdro' && d.isActive);
  return { artemisEnabled, cashdroEnabled };
}

export function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const [config, setConfig] = useState<KioskConfig | null>(null);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [allModifierGroups, setAllModifierGroups] = useState<ModifierGroup[]>([]);

  const [orderMode, setOrderMode] = useState<OrderMode>('takeAway');
  const [cart, setCart] = useState<KioskCartItem[]>([]);
  const [orderCode, setOrderCode] = useState('');
  const [orderTotals, setOrderTotals] = useState<OrderTotals | undefined>();
  const [customerName, setCustomerName] = useState<string | undefined>();
  const [sending, setSending] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [addedSignal, setAddedSignal] = useState(0);
  const [lastAddedProductId, setLastAddedProductId] = useState<string | null>(null);
  const [lastAddedFromDetail, setLastAddedFromDetail] = useState(false);
  const [suggestionSessionId, setSuggestionSessionId] = useState(
    () => `kiosk-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );

  // New order payment flow
  const [newOrderSession, setNewOrderSession] = useState<OrderSession | null>(null);
  const [pendingCustomer, setPendingCustomer] = useState<Customer | undefined>();
  const [pendingNotes, setPendingNotes] = useState('');
  const [newOrderError, setNewOrderError] = useState('');

  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoverySearching, setRecoverySearching] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [recoveredOrder, setRecoveredOrder] = useState<RecoveryLookupResponse | null>(null);
  const [recoveryConfirming, setRecoveryConfirming] = useState(false);
  const [recoveryConfirmationMessage, setRecoveryConfirmationMessage] = useState('Pago confirmado. Pedido enviado a cocina.');
  const [paymentDevices, setPaymentDevices] = useState<PaymentDeviceView[]>([]);
  const [paymentJob, setPaymentJob] = useState<PaymentJobView | null>(null);
  const [paymentJobPolling, setPaymentJobPolling] = useState(false);
  const recoveryIdempotencyRef = useRef<Record<string, string>>({});

  const modifierGroupsById = useMemo<Map<string, ModifierGroup>>(() => {
    const map = new Map<string, ModifierGroup>();
    for (const g of allModifierGroups) map.set(g.id, g);
    return map;
  }, [allModifierGroups]);

  const cartTotal = useMemo(() => getCartTotal(cart), [cart]);
  const enabledCategories = useMemo(() => categories.filter((c) => c.enabled), [categories]);

  const cartQuantityByProductId = useMemo<Map<string, number>>(() => {
    const map = new Map<string, number>();
    for (const item of cart) {
      map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity);
    }
    return map;
  }, [cart]);

  const lastCartItemByProductId = useMemo<Map<string, KioskCartItem>>(() => {
    const map = new Map<string, KioskCartItem>();
    for (const item of cart) map.set(item.productId, item);
    return map;
  }, [cart]);

  const modifiersEnabled = config?.kiosk.features.modifiers ?? true;
  const productCommentsEnabled = config?.kiosk.notes.productCommentsEnabled ?? false;
  const theme = normalizeTheme(config?.kiosk.theme);
  const restaurantName = config?.restaurantName ?? '';
  const logoUrl = config?.logoUrl;

  const productModifierGroups: ModifierGroup[] = useMemo(() => {
    if (!selectedProduct) return [];
    return (selectedProduct.modifierGroups ?? [])
      .map((id) => modifierGroupsById.get(id))
      .filter((g): g is ModifierGroup => g != null);
  }, [selectedProduct, modifierGroupsById]);

  const suggestionCatalog = useMemo(() => {
    return enabledCategories.flatMap((category) =>
      category.products.map((product) => ({
        ...product,
        categoryId: category.id,
        categoryName: category.name,
      })),
    );
  }, [enabledCategories]);

  const suggestionEngine = useSuggestionEngine({
    catalog: suggestionCatalog,
    cartItems: cart,
    sessionId: suggestionSessionId,
  });

  const upsellTimeoutRef = useRef<number | null>(null);
  const activeCompositionRef = useRef(false);

  useEffect(() => {
    activeCompositionRef.current = suggestionEngine.activeComposition != null;
  }, [suggestionEngine.activeComposition]);

  useEffect(() => {
    suggestionEngine.setOnAddProduct((productId: string) => {
      const product = suggestionCatalog.find((item) => item.id === productId);
      if (!product) {
        return;
      }
      addProductToCart(product, [], '', {
        closeDetail: false,
        triggerUpsellDelayMs: null,
        triggerComposition: false,
      });
    });
  }, [suggestionCatalog, suggestionEngine]);

  useEffect(() => {
    if (screen === 'last-minute' && suggestionEngine.lastminuteItems.length === 0) {
      setScreen('payment-method');
    }
  }, [screen, suggestionEngine.lastminuteItems.length]);

  useEffect(() => {
    return () => {
      if (upsellTimeoutRef.current != null) {
        window.clearTimeout(upsellTimeoutRef.current);
      }
    };
  }, []);

  const loadData = useCallback(async () => {
    setScreen('loading');
    setErrorMessage('');
    try {
      const [cfg, catalog] = await Promise.all([fetchConfig(), fetchCatalog()]);
      setConfig(cfg);
      if (cfg.lastApp.locationId) {
        try {
          setPaymentDevices(await listPaymentDevices(cfg.lastApp.locationId));
        } catch {
          setPaymentDevices([]);
        }
      } else {
        setPaymentDevices([]);
      }
      const enabled = (catalog.categories ?? []).filter((c) => c.enabled);
      setCategories(enabled);
      setAllModifierGroups(catalog.modifierGroups ?? []);

      const enableEatIn = cfg.kiosk.enableEatIn ?? true;
      const enableTakeAway = cfg.kiosk.enableTakeAway ?? true;

      if (enableEatIn && enableTakeAway) {
        setOrderMode(cfg.kiosk.defaultOrderMode === 'eatIn' ? 'eatIn' : 'takeAway');
      } else {
        setOrderMode(enableEatIn ? 'eatIn' : 'takeAway');
      }
      setScreen('welcome-brand');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error desconocido');
      setScreen('error');
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (screen !== 'recovery-payment-job' || !recoveredOrder || !paymentJob) {
      return;
    }

    let stopped = false;
    const interval = window.setInterval(async () => {
      if (stopped) return;
      try {
        setPaymentJobPolling(true);
        const next = await getPaymentJob(paymentJob.id);
        if (stopped) return;
        setPaymentJob(next);

        if (next.status === 'completed') {
          let lastSyncStatus: string | null = null;
          if (next.responsePayloadJson) {
            try {
              const parsed = JSON.parse(next.responsePayloadJson) as { lastSyncStatus?: string };
              lastSyncStatus = parsed.lastSyncStatus ?? null;
            } catch {
              lastSyncStatus = null;
            }
          }
          setRecoveryConfirmationMessage(
            lastSyncStatus === 'sent'
              ? 'Pago confirmado. Pedido enviado a cocina.'
              : 'Pago confirmado. Incidencia al enviar a cocina.',
          );
          setScreen('recovery-confirmed');
          return;
        }

        if (next.status === 'failed' || next.status === 'cancelled') {
          setRecoveryError(next.errorMessage ?? 'No se pudo completar el cobro.');
          setScreen('recovery-detail');
        }
      } catch (error) {
        if (!stopped) {
          setRecoveryError(error instanceof Error ? error.message : 'No se pudo consultar el estado del cobro.');
        }
      } finally {
        if (!stopped) {
          setPaymentJobPolling(false);
        }
      }
    }, 1500);

    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [paymentJob, recoveredOrder, screen]);

  // Polling for new kiosk order payment jobs
  useEffect(() => {
    if (screen !== 'new-order-payment-job' || !newOrderSession || !paymentJob) {
      return;
    }

    let stopped = false;
    const interval = window.setInterval(async () => {
      if (stopped) return;
      try {
        setPaymentJobPolling(true);
        const next = await getPaymentJob(paymentJob.id);
        if (stopped) return;
        setPaymentJob(next);

        if (next.status === 'completed') {
          let code = newOrderSession.externalId;
          if (next.responsePayloadJson) {
            try {
              const parsed = JSON.parse(next.responsePayloadJson) as { lastCode?: string };
              if (parsed.lastCode) code = parsed.lastCode;
            } catch { /* ok */ }
          }
          setOrderCode(code);
          setCart([]);
          setNewOrderSession(null);
          setScreen('confirmation');
          return;
        }

        if (next.status === 'failed' || next.status === 'cancelled') {
          setNewOrderError(next.errorMessage ?? 'No se pudo completar el cobro.');
          setScreen('payment-method');
        }
      } catch (error) {
        if (!stopped) {
          setNewOrderError(error instanceof Error ? error.message : 'No se pudo consultar el estado del cobro.');
        }
      } finally {
        if (!stopped) setPaymentJobPolling(false);
      }
    }, 1500);

    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [paymentJob, newOrderSession, screen]);

  function onBrandStart() {
    setSuggestionSessionId(`kiosk-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const enableEatIn = config?.kiosk.enableEatIn ?? true;
    const enableTakeAway = config?.kiosk.enableTakeAway ?? true;
    if (enableEatIn && enableTakeAway) {
      setScreen('welcome');
    } else {
      setCart([]);
      setScreen('menu');
    }
  }

  function onModeSelect(mode: OrderMode) {
    setSuggestionSessionId(`kiosk-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    setOrderMode(mode);
    setCart([]);
    setScreen('menu');
  }

  function onChangeMode() {
    const enableEatIn = config?.kiosk.enableEatIn ?? true;
    const enableTakeAway = config?.kiosk.enableTakeAway ?? true;
    if (enableEatIn && enableTakeAway) setScreen('welcome');
  }

  function openProductDetail(product: CatalogProduct) {
    setSelectedProduct(product);
    suggestionEngine.triggerBundle(product.id);
    setScreen('product-detail');
  }

  function addProductToCart(
    product: CatalogProduct,
    selectedModifiers: Modifier[],
    comments: string,
    options?: {
      closeDetail?: boolean;
      triggerUpsellDelayMs?: number | null;
      triggerComposition?: boolean;
    },
  ) {
    const fromDetail = screen === 'product-detail';
    const cartKey = buildCartKey(product.id, selectedModifiers.map((m) => m.id), comments);
    const modifierExtra = selectedModifiers.reduce((sum, m) => sum + (m.priceImpact ?? 0), 0);
    const unitPrice = product.price + modifierExtra;
    const closeDetail = options?.closeDetail ?? true;
    const triggerUpsellDelayMs = options?.triggerUpsellDelayMs ?? 1500;
    const shouldTriggerComposition = options?.triggerComposition ?? true;

    setCart((prev) => {
      const existing = prev.find((i) => i.cartKey === cartKey);
      if (existing) {
        return prev.map((i) =>
          i.cartKey === cartKey ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      const newItem: KioskCartItem = {
        cartKey,
        productId: product.id,
        name: product.name,
        unitPrice,
        quantity: 1,
        type: product.type,
        modifiers: selectedModifiers.map((m) => ({
          id: m.id,
          name: m.name,
          priceImpact: m.priceImpact,
          quantity: 1,
        })),
        comments: comments.trim() || undefined,
        imageUrl: product.imageUrl,
        displayPrice: product.displayPrice,
        promotion: product.promotion,
        promotionId: product.promotion?.id,
      };
      return [...prev, newItem];
    });
    setAddedSignal((s) => s + 1);
    setLastAddedProductId(product.id);
    setLastAddedFromDetail(fromDetail);

    const productCategoryId =
      suggestionCatalog.find((item) => item.id === product.id)?.categoryId ?? '';
    const openedComposition = shouldTriggerComposition
      ? suggestionEngine.triggerComposition(product.id, productCategoryId)
      : false;

    if (closeDetail) {
      setSelectedProduct(null);
      setScreen('menu');
      if (suggestionEngine.activeBundle) {
        suggestionEngine.dismissBundle();
      }
    }

    if (triggerUpsellDelayMs != null && !openedComposition) {
      if (upsellTimeoutRef.current != null) {
        window.clearTimeout(upsellTimeoutRef.current);
      }
      upsellTimeoutRef.current = window.setTimeout(() => {
        if (!activeCompositionRef.current) {
          suggestionEngine.triggerUpsell(product.id);
        }
      }, triggerUpsellDelayMs);
    }
  }

  function addToCart(product: CatalogProduct, selectedModifiers: Modifier[], comments: string) {
    addProductToCart(product, selectedModifiers, comments);
  }

  function changeQty(cartKey: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => (i.cartKey === cartKey ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  }

  function removeLastOfProduct(productId: string) {
    const item = lastCartItemByProductId.get(productId);
    if (item) changeQty(item.cartKey, -1);
  }

  function editCartItem(item: KioskCartItem) {
    setCart((prev) => prev.filter((i) => i.cartKey !== item.cartKey));
    const product = enabledCategories.flatMap((c) => c.products).find((p) => p.id === item.productId);
    if (!product) { setScreen('menu'); return; }
    const hasGroups = (product.modifierGroups?.length ?? 0) > 0;
    if (modifiersEnabled && hasGroups) {
      setSelectedProduct(product);
      setScreen('product-detail');
    } else {
      setScreen('menu');
    }
  }

  function doSend(customer: Customer, notes: string) {
    setPendingCustomer(customer);
    setPendingNotes(notes);
    setNewOrderError('');
    setPaymentJob(null);
    setScreen(suggestionEngine.lastminuteItems.length > 0 ? 'last-minute' : 'payment-method');
  }

  async function doStartNewOrderPayment(provider: 'cashdro' | 'artemis') {
    if (!config?.lastApp.locationId || !pendingCustomer) return;

    const paymentsSimulated = Boolean(config.paymentsSimulated);
    const device =
      paymentDevices.find((d) => d.provider === provider && d.isActive) ??
      (paymentsSimulated ? paymentDevices.find((d) => d.provider === provider) : undefined);

    if (!device) {
      setNewOrderError(
        paymentsSimulated
          ? 'Crea un dispositivo de prueba en el panel de administración para probar este método.'
          : 'No hay un dispositivo activo para este método de pago.',
      );
      return;
    }

    setSending(true);
    setNewOrderError('');
    try {
      const subtotal = cart.reduce((s, item) => s + getCartLineOriginalTotal(item), 0);
      const total = getCartTotal(cart);

      const session = await createKioskOrderSession({
        externalId: `kiosk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        source: config.kiosk.source ?? null,
        customer: pendingCustomer,
        notes: pendingNotes || null,
        items: cartToOrderSessionItems(cart),
        subtotal,
        discountTotal: subtotal - total,
        total,
        currency: 'EUR',
      });

      setNewOrderSession(session);
      setCustomerName(pendingCustomer.name);
      setOrderTotals({ total, discountTotal: subtotal - total });

      const job = await createPaymentJob({
        orderSessionId: session.orderSessionId,
        locationId: config.lastApp.locationId,
        deviceId: device.id,
        provider,
        idempotencyKey: `kiosk-${provider}-${session.orderSessionId}`,
      });
      setPaymentJob(job);
      setScreen('new-order-payment-job');
    } catch (error) {
      setNewOrderError(error instanceof Error ? error.message : 'No se pudo iniciar el cobro.');
    } finally {
      setSending(false);
    }
  }

  async function handleRecoveryLookup() {
    const code = recoveryCode.trim();
    if (!code) {
      setRecoveryError('Introduce un PIN4 o un código válido.');
      return;
    }

    setRecoverySearching(true);
    setRecoveryError('');
    try {
      const recovered = await recoverPendingOrder(code);
      setRecoveredOrder(recovered);
      setScreen('recovery-detail');
    } catch (error) {
      setRecoveryError(error instanceof Error ? error.message : 'No se pudo recuperar la cuenta.');
    } finally {
      setRecoverySearching(false);
    }
  }

  async function handleConfirmRecoveredPayment() {
    if (!recoveredOrder) return;

    const idempotencyKey =
      recoveryIdempotencyRef.current[recoveredOrder.orderSession.orderSessionId] ??
      `kiosk-recovery-${recoveredOrder.orderSession.orderSessionId}`;
    recoveryIdempotencyRef.current[recoveredOrder.orderSession.orderSessionId] = idempotencyKey;

    setRecoveryConfirming(true);
    setRecoveryError('');

    try {
      const response = await confirmRecoveredOrderPayment(
        recoveredOrder.orderSession.orderSessionId,
        recoveredOrder.orderSession.total,
        idempotencyKey,
      );
      setRecoveryConfirmationMessage(
        response.lastSyncStatus === 'sent'
          ? 'Pago confirmado. Pedido enviado a cocina.'
          : 'Pago confirmado. Incidencia al enviar a cocina.',
      );
      setScreen('recovery-confirmed');
    } catch (error) {
      setRecoveryError(error instanceof Error ? error.message : 'No se pudo confirmar el pago.');
    } finally {
      setRecoveryConfirming(false);
    }
  }

  async function handleStartDevicePayment(provider: 'cashdro' | 'artemis') {
    if (!recoveredOrder || !config?.lastApp.locationId) return;
    setRecoveryConfirming(true);
    setRecoveryError('');
    const paymentsSimulated = Boolean(config.paymentsSimulated);
    try {
      const device =
        paymentDevices.find((item) => item.provider === provider && item.isActive) ??
        (paymentsSimulated ? paymentDevices.find((item) => item.provider === provider) : undefined);
      if (!device) {
        throw new Error(
          paymentsSimulated
            ? 'Crea un dispositivo de prueba en el panel de administración para probar este método.'
            : 'No hay un dispositivo activo para este método de pago.',
        );
      }

      const response = await createPaymentJob({
        orderSessionId: recoveredOrder.orderSession.orderSessionId,
        locationId: config.lastApp.locationId,
        deviceId: device.id,
        provider,
        idempotencyKey: `${provider}-${recoveredOrder.orderSession.orderSessionId}`,
      });
      setPaymentJob(response);
      setScreen('recovery-payment-job');
    } catch (error) {
      setRecoveryError(error instanceof Error ? error.message : 'No se pudo iniciar el cobro.');
    } finally {
      setRecoveryConfirming(false);
    }
  }

  function handleLeavePaymentJob() {
    if (!recoveredOrder) {
      setScreen('recovery-detail');
      return;
    }
    setPaymentJob(null);
    setPaymentJobPolling(false);
    setScreen('recovery-detail');
  }

  function resetRecoveryFlow() {
    setRecoveryCode('');
    setRecoveryError('');
    setRecoveredOrder(null);
    setRecoveryConfirming(false);
    setRecoverySearching(false);
    setPaymentJob(null);
    setPaymentJobPolling(false);
    setRecoveryConfirmationMessage('Pago confirmado. Pedido enviado a cocina.');
    setScreen('welcome');
  }

  function startNewOrder() {
    setOrderCode('');
    setCustomerName(undefined);
    setOrderTotals(undefined);
    setCart([]);
    setNewOrderSession(null);
    setPendingCustomer(undefined);
    setPendingNotes('');
    setNewOrderError('');
    setPaymentJob(null);
    setPaymentJobPolling(false);
    setSuggestionSessionId(`kiosk-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    setScreen('welcome-brand');
  }

  const activeCompositionNode = suggestionEngine.activeComposition ? (
    <CompositionModal
      data={suggestionEngine.activeComposition}
      onConfirm={suggestionEngine.acceptComposition}
      onDismiss={suggestionEngine.dismissComposition}
    />
  ) : null;

  const activeUpsellNode = !suggestionEngine.activeComposition && suggestionEngine.activeUpsell ? (
    <UpsellPopup
      suggestion={suggestionEngine.activeUpsell}
      onAccept={() => suggestionEngine.acceptUpsell()}
      onDismiss={(_, outcome) => suggestionEngine.dismissUpsell(outcome)}
    />
  ) : null;

  if (screen === 'loading') return <LoadingScreen />;
  if (screen === 'error') return <ErrorScreen message={errorMessage} onRetry={loadData} />;

  if (screen === 'welcome-brand' && config) {
    return <WelcomeBrandScreen config={config} onStart={onBrandStart} />;
  }

  if (screen === 'welcome') {
    return (
      <WelcomeScreen
        restaurantName={restaurantName}
        onSelect={onModeSelect}
        onOpenRecovery={() => {
          setRecoveryCode('');
          setRecoveryError('');
          setRecoveredOrder(null);
          setScreen('recovery-entry');
        }}
      />
    );
  }

  if (screen === 'recovery-entry') {
    return (
      <RecoveryEntryScreen
        value={recoveryCode}
        searching={recoverySearching}
        errorMessage={recoveryError}
        onChangeValue={setRecoveryCode}
        onSubmit={() => { void handleRecoveryLookup(); }}
        onBack={() => setScreen('welcome')}
      />
    );
  }

  if (screen === 'recovery-detail' && recoveredOrder) {
    const { artemisEnabled, cashdroEnabled } = getAvailablePaymentMethods(
      paymentDevices,
      Boolean(config?.paymentsSimulated),
    );
    return (
      <RecoveryDetailScreen
        session={recoveredOrder.orderSession}
        tableName={recoveredOrder.tableName}
        sending={recoveryConfirming}
        artemisEnabled={artemisEnabled}
        cashdroEnabled={cashdroEnabled}
        paymentsSimulated={Boolean(config?.paymentsSimulated)}
        errorMessage={recoveryError}
        onBack={() => setScreen('recovery-entry')}
        onConfirmCash={() => { void handleConfirmRecoveredPayment(); }}
        onStartArtemisPayment={() => { void handleStartDevicePayment('artemis'); }}
        onStartCashdroPayment={() => { void handleStartDevicePayment('cashdro'); }}
      />
    );
  }

  if (screen === 'recovery-payment-job' && recoveredOrder) {
    return (
      <PaymentJobScreen
        session={recoveredOrder.orderSession}
        job={paymentJob}
        polling={paymentJobPolling}
        errorMessage={recoveryError}
        onCancel={handleLeavePaymentJob}
      />
    );
  }

  if (screen === 'recovery-confirmed') {
    return <RecoveryConfirmedScreen message={recoveryConfirmationMessage} onDone={resetRecoveryFlow} />;
  }

  if (screen === 'confirmation') {
    return (
      <ConfirmationScreen
        orderCode={orderCode}
        customerName={customerName}
        orderMode={orderMode}
        totals={orderTotals}
        onNewOrder={startNewOrder}
      />
    );
  }

  if (screen === 'product-detail' && selectedProduct) {
    return (
      <>
        <ProductDetailScreen
          product={selectedProduct}
          groups={productModifierGroups}
          productCommentsEnabled={productCommentsEnabled}
          theme={theme}
          bundle={
            suggestionEngine.activeBundle?.products.some((product) => product.id === selectedProduct.id)
              ? suggestionEngine.activeBundle
              : null
          }
          onAcceptBundle={() => {
            suggestionEngine.acceptBundle();
            setSelectedProduct(null);
            setScreen('menu');
          }}
          onDismissBundle={() => suggestionEngine.dismissBundle()}
          onConfirm={(product, mods, comments) => addToCart(product, mods, comments)}
          onCancel={() => {
            if (suggestionEngine.activeBundle) {
              suggestionEngine.dismissBundle();
            }
            setSelectedProduct(null);
            setScreen('menu');
          }}
        />
        {activeCompositionNode}
        {activeUpsellNode}
      </>
    );
  }

  if (screen === 'cart-review') {
    return (
      <>
        <CartReviewScreen
          cart={cart}
          cartTotal={cartTotal}
          orderMode={orderMode}
          crosssellSuggestions={suggestionEngine.activeCrosssells}
          onChangeQty={changeQty}
          onEditItem={editCartItem}
          onAcceptCrosssell={suggestionEngine.acceptCrosssell}
          onDismissCrosssell={suggestionEngine.dismissCrosssell}
          onBack={() => setScreen('menu')}
          onConfirm={() => setScreen('customer')}
        />
        {activeCompositionNode}
        {activeUpsellNode}
      </>
    );
  }

  if (screen === 'customer' && config) {
    return (
      <CustomerScreen
        config={config}
        sending={sending}
        onConfirm={doSend}
        onBack={() => setScreen('cart-review')}
      />
    );
  }

  if (screen === 'payment-method' && config) {
    const { artemisEnabled, cashdroEnabled } = getAvailablePaymentMethods(
      paymentDevices,
      Boolean(config.paymentsSimulated),
    );
    return (
      <PaymentMethodScreen
        cartTotal={cartTotal}
        paymentsSimulated={Boolean(config.paymentsSimulated)}
        artemisEnabled={artemisEnabled}
        cashdroEnabled={cashdroEnabled}
        sending={sending}
        errorMessage={newOrderError}
        onBack={() => setScreen('customer')}
        onSelectArtemis={() => { void doStartNewOrderPayment('artemis'); }}
        onSelectCashdro={() => { void doStartNewOrderPayment('cashdro'); }}
      />
    );
  }

  if (screen === 'last-minute') {
    return (
      <>
        <LastMinuteScreen
          items={suggestionEngine.lastminuteItems}
          timeSlot={suggestionEngine.currentTimeSlot}
          onAdd={suggestionEngine.acceptLastminute}
          onContinue={() => setScreen('payment-method')}
        />
        {activeCompositionNode}
        {activeUpsellNode}
      </>
    );
  }

  if (screen === 'new-order-payment-job' && newOrderSession) {
    return (
      <PaymentJobScreen
        session={newOrderSession}
        job={paymentJob}
        polling={paymentJobPolling}
        errorMessage={newOrderError}
        onCancel={() => {
          setPaymentJob(null);
          setPaymentJobPolling(false);
          setNewOrderError('');
          setScreen('payment-method');
        }}
      />
    );
  }

  return (
    <>
      <MenuScreen
        categories={enabledCategories}
        cart={cart}
        cartTotal={cartTotal}
        orderMode={orderMode}
        theme={theme}
        restaurantName={restaurantName}
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
        onChangeMode={onChangeMode}
        onConsumeAddedFromDetail={() => {
          setLastAddedProductId(null);
          setLastAddedFromDetail(false);
        }}
      />
      {activeCompositionNode}
      {activeUpsellNode}
    </>
  );
}
