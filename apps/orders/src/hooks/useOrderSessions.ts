import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Channel, OperationalStatus, OperationalTicket, OrderSession, PrintStatus } from '@kiosk/types';
import {
  confirmCashPayment,
  createPaymentJob,
  getOperationalTickets,
  getOrderSessionEvents,
  getOrderSessions,
  getPaymentDevices,
  getPaymentJob,
  markOperationalTicketSoundPlayed,
  printOperationalTicket,
  recoverOrderSession,
  reprintOperationalTicket,
  sendOrderSessionToLast,
  updateLiveLastOrderStatus,
  updateOrderSessionStatus,
} from '../api';
import {
  formatChannelLabel,
  formatOperationalStatusLabel,
  formatPaymentModeLabel,
  formatPaymentStatusLabel,
  formatPrintStatusLabel,
  formatSyncStatusLabel,
  isCashierRescue,
  isIncidentOrder,
  isKitchenOrder,
  isVisibleOperationalOrder,
  MOCK_ORDERS,
} from '../mock/orders';
import type {
  OrdersDataSourceMode,
  OrdersEventTimelineState,
  OrdersSessionRecord,
} from '../types';

interface RecoveryState {
  searching: boolean;
  error: string | null;
}

interface ConfirmationState {
  confirmingOrderId: string | null;
  message: string | null;
  error: string | null;
}

interface LastSyncActionState {
  sendingOrderId: string | null;
  message: string | null;
  error: string | null;
}

interface StatusActionState {
  updatingOrderId: string | null;
  message: string | null;
  error: string | null;
}

interface HistoryState {
  loading: boolean;
  error: string | null;
}

interface PaymentJobUiState {
  jobId: string;
  provider: 'cashdro' | 'artemis';
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  error: string | null;
  message: string | null;
}

interface PrintActionState {
  loading: boolean;
  message: string | null;
  error: string | null;
  previewHtml: string | null;
  previewSvg: string | null;
  printStatus: PrintStatus | null;
}

function normalizeOrderSession(order: OrderSession): OrdersSessionRecord {
  return {
    ...order,
    recordType: 'order_session',
    ticketId: null,
    linkedOrderSessionId: order.orderSessionId,
    liveTabId: null,
    tableName: order.tableNameSnapshot ?? null,
    sourceLabel: order.source ?? null,
    pickupTypeLabel: null,
    printStatus: null,
    soundPolicy: null,
    soundPlayedAt: null,
    firstSeenAt: null,
    lastSeenAt: null,
    rawSourceHash: null,
    previewSvg: null,
  };
}

function mapTicketSourceToChannel(source: OperationalTicket['source']): Channel {
  switch (source) {
    case 'qr_order':
      return 'qr_order';
    case 'kiosk':
      return 'kiosk';
    case 'manual':
      return 'manual';
    case 'glovo':
      return 'glovo';
    case 'uber':
      return 'uber';
    case 'deliveroo':
      return 'deliveroo';
    case 'just_eat':
      return 'just_eat';
    case 'pos':
    case 'last_pos':
      return 'pos';
    default:
      return 'manual';
  }
}

function normalizeOperationalTicket(ticket: OperationalTicket): OrdersSessionRecord {
  return {
    recordType: 'operational_ticket',
    ticketId: ticket.ticketId,
    linkedOrderSessionId: ticket.orderSessionId ?? null,
    liveTabId: ticket.lastTabId ?? null,
    orderSessionId: ticket.ticketId,
    externalId: ticket.displayNumber,
    organizationId: '',
    locationId: '',
    brandId: '',
    catalogId: '',
    tableId: null,
    lastTableId: null,
    tableNameSnapshot: ticket.tableName ?? null,
    tableName: ticket.tableName ?? null,
    channel: mapTicketSourceToChannel(ticket.source),
    source: ticket.sourceLabel,
    restaurantSlug: null,
    operationalStatus: (ticket.operationalStatus as OperationalStatus) ?? 'pending',
    paymentStatus: ticket.paid ? 'paid' : 'unpaid',
    lastSyncStatus: ticket.lastTabId ? 'sent' : 'not_sent',
    customer: ticket.customerName
      ? {
          name: ticket.customerName,
          phoneNumber: null,
          surname: null,
          email: null,
        }
      : null,
    notes: ticket.notes ?? null,
    items: ticket.items.map((item, itemIndex) => ({
      id: `${ticket.ticketId}-item-${itemIndex}`,
      productId: `${ticket.ticketId}-product-${itemIndex}`,
      productName: item.name,
      type: 'PRODUCT',
      quantity: item.quantity,
      unitPrice: item.unitPrice ?? 0,
      totalPrice: item.totalPrice ?? 0,
      notes: item.notes ?? null,
      modifiers: item.modifiers.map((modifier, modifierIndex) => ({
        modifierId: `${ticket.ticketId}-modifier-${itemIndex}-${modifierIndex}`,
        modifierName: modifier.name,
        quantity: modifier.quantity,
        unitPrice: modifier.unitPrice ?? 0,
        totalPrice: modifier.totalPrice ?? 0,
      })),
      promotionId: item.hasPromotionAdjustment ? `promo-${itemIndex}` : null,
      promotion: item.promotionLabel
        ? {
            promotionId: `promo-${itemIndex}`,
            promotionName: item.promotionLabel,
            discountAmount: 0,
            discountType: item.promotionDiscountType ?? null,
            label: item.promotionLabel,
          }
        : null,
    })),
    subtotal: ticket.subtotal ?? ticket.total ?? 0,
    discountTotal: ticket.discountTotal ?? 0,
    total: ticket.total ?? 0,
    currency: ticket.currency ?? 'EUR',
    paymentMode: ticket.source === 'qr_order' || ticket.source === 'kiosk' ? 'online' : 'staff_internal',
    stripePaymentIntentId: null,
    stripeCheckoutSessionId: null,
    pin4: null,
    qrToken: null,
    expiresAt: null,
    preparationTimeMode: null,
    suggestedPreparationMinutes: null,
    confirmedPreparationMinutes: null,
    estimatedReadyAt: ticket.estimatedReadyAt ?? null,
    pickupTimeSyncedToLast: null,
    pickupTimeSyncStatus: null,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    acceptedAt: null,
    readyAt: null,
    sourceLabel: ticket.sourceLabel,
    pickupTypeLabel: null,
    printStatus: ticket.printStatus,
    soundPolicy: ticket.soundPolicy,
    soundPlayedAt: ticket.soundPlayedAt ?? null,
    firstSeenAt: ticket.firstSeenAt,
    lastSeenAt: ticket.lastSeenAt,
    rawSourceHash: ticket.rawSourceHash ?? null,
    previewSvg: null,
  };
}

function sortByUpdatedAtDesc(items: OrdersSessionRecord[]) {
  return [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function isPaidNotSent(order: OrdersSessionRecord) {
  return order.paymentStatus === 'paid' && order.lastSyncStatus === 'not_sent';
}

function getTwentyFourHoursAgoIso() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

function getStartOfDayIso() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

function buildFallbackState() {
  const fallback = sortByUpdatedAtDesc(MOCK_ORDERS);
  const recentThreshold = new Date(getTwentyFourHoursAgoIso()).getTime();
  const todayThreshold = new Date(getStartOfDayIso()).getTime();
  const activeOrders = fallback.filter(isVisibleOperationalOrder);
  const kitchenOrders = fallback.filter(isKitchenOrder);
  const incidentOrders = fallback.filter(
    (order) => isIncidentOrder(order) && new Date(order.updatedAt).getTime() >= recentThreshold,
  );
  const cashierOrders = fallback
    .filter((order) => isCashierRescue(order) && order.paymentMode === 'cashier')
    .filter((order) => new Date(order.updatedAt).getTime() >= recentThreshold);
  const historyOrders = fallback.filter((order) => new Date(order.createdAt).getTime() >= todayThreshold);

  return {
    activeOrders,
    kitchenOrders,
    incidentOrders,
    cashierOrders,
    historyOrders,
  };
}

function openBrowserPrintPreview(html: string | null) {
  if (!html) {
    return;
  }

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;border:none;visibility:hidden;';
  iframe.src = url;

  iframe.addEventListener('load', () => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 1000);
  }, { once: true });

  document.body.appendChild(iframe);
}

export function useOrderSessions() {
  const [mode, setMode] = useState<OrdersDataSourceMode>('real');
  const [loading, setLoading] = useState(true);
  const [bannerMessage, setBannerMessage] = useState('Conectado a Last real, OrderSession real y ticket operativo real');
  const [activeOrders, setActiveOrders] = useState<OrdersSessionRecord[]>([]);
  const [kitchenOrders, setKitchenOrders] = useState<OrdersSessionRecord[]>([]);
  const [incidentOrders, setIncidentOrders] = useState<OrdersSessionRecord[]>([]);
  const [cashierOrders, setCashierOrders] = useState<OrdersSessionRecord[]>([]);
  const [historyOrders, setHistoryOrders] = useState<OrdersSessionRecord[]>([]);
  const [historyState, setHistoryState] = useState<HistoryState>({
    loading: false,
    error: null,
  });
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [recoveryState, setRecoveryState] = useState<RecoveryState>({
    searching: false,
    error: null,
  });
  const [confirmationState, setConfirmationState] = useState<ConfirmationState>({
    confirmingOrderId: null,
    message: null,
    error: null,
  });
  const [lastSyncState, setLastSyncState] = useState<LastSyncActionState>({
    sendingOrderId: null,
    message: null,
    error: null,
  });
  const [statusActionState, setStatusActionState] = useState<StatusActionState>({
    updatingOrderId: null,
    message: null,
    error: null,
  });
  const [paymentJobState, setPaymentJobState] = useState<Record<string, PaymentJobUiState>>({});
  const [eventTimeline, setEventTimeline] = useState<Record<string, OrdersEventTimelineState>>({});
  const [printActionState, setPrintActionState] = useState<Record<string, PrintActionState>>({});
  const confirmIdempotencyKeysRef = useRef<Record<string, string>>({});
  const paymentJobTimersRef = useRef<Record<string, number>>({});

  const applyFallback = useCallback((message: string) => {
    const fallback = buildFallbackState();
    setMode('demo');
    setBannerMessage('Modo demo — sin backend real');
    setConnectionError(message);
    setActiveOrders(fallback.activeOrders);
    setKitchenOrders(fallback.kitchenOrders);
    setIncidentOrders(fallback.incidentOrders);
    setCashierOrders(fallback.cashierOrders);
    setHistoryOrders(fallback.historyOrders);
  }, []);

  const load = useCallback(async () => {
    try {
      const last24hIso = getTwentyFourHoursAgoIso();
      const [ticketResult, incidentResult, cashierResult] = await Promise.allSettled([
        getOperationalTickets({
          activeOnly: true,
        }),
        getOrderSessions({
          paymentStatus: 'paid',
          lastSyncStatus: 'sync_failed',
          since: last24hIso,
          limit: 100,
        }),
        getOrderSessions({
          paymentStatus: 'unpaid',
          lastSyncStatus: 'not_sent',
          paymentMode: 'cashier',
          since: last24hIso,
          limit: 100,
        }),
      ]);

      const tickets = ticketResult.status === 'fulfilled' ? ticketResult.value : [];
      const incidentResponse = incidentResult.status === 'fulfilled' ? incidentResult.value : { items: [] };
      const cashierResponse = cashierResult.status === 'fulfilled' ? cashierResult.value : { items: [] };

      const ticketsError =
        ticketResult.status === 'rejected'
          ? ticketResult.reason instanceof Error
            ? ticketResult.reason.message
            : 'No se pudieron leer las comandas operativas.'
          : null;
      const orderSessionError =
        incidentResult.status === 'rejected' || cashierResult.status === 'rejected'
          ? 'OrderSession no responde del todo.'
          : null;

      const normalizedTickets = sortByUpdatedAtDesc(tickets.map(normalizeOperationalTicket));
      const active = normalizedTickets.filter(isVisibleOperationalOrder);
      const kitchen = active.filter(isKitchenOrder);
      const incidents = sortByUpdatedAtDesc(incidentResponse.items.map(normalizeOrderSession)).filter(isIncidentOrder);
      const pending = sortByUpdatedAtDesc(cashierResponse.items.map(normalizeOrderSession)).filter(
        (order) => isCashierRescue(order) && order.paymentMode === 'cashier',
      );

      setMode('real');
      setBannerMessage('Conectado a Last real, OrderSession real y ticket operativo real');
      setConnectionError(ticketsError ?? orderSessionError ?? null);
      setActiveOrders(active);
      setKitchenOrders(kitchen);
      setIncidentOrders(incidents);
      setCashierOrders(pending);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo leer el backend real.';
      if (import.meta.env.DEV) {
        applyFallback(message);
      } else {
        setMode('real');
        setBannerMessage('Conectado a Last real, OrderSession real y ticket operativo real');
        setConnectionError(message);
        setActiveOrders([]);
        setKitchenOrders([]);
        setIncidentOrders([]);
        setCashierOrders([]);
      }
    } finally {
      setLoading(false);
    }
  }, [applyFallback]);

  const loadHistoryOrders = useCallback(async () => {
    if (mode === 'demo') {
      setHistoryState({ loading: false, error: null });
      setHistoryOrders(buildFallbackState().historyOrders);
      return;
    }

    setHistoryState({ loading: true, error: null });
    try {
      const history = await getOperationalTickets({
        since: getStartOfDayIso(),
        activeOnly: false,
      });
      setHistoryOrders(sortByUpdatedAtDesc(history.map(normalizeOperationalTicket)));
      setHistoryState({ loading: false, error: null });
    } catch (error) {
      setHistoryState({
        loading: false,
        error: error instanceof Error ? error.message : 'No se pudo leer el historial operativo.',
      });
    }
  }, [mode]);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => {
      void load();
    }, 10_000);
    return () => {
      window.clearInterval(interval);
      for (const timer of Object.values(paymentJobTimersRef.current)) {
        window.clearInterval(timer);
      }
      paymentJobTimersRef.current = {};
    };
  }, [load]);

  const allOrdersIndex = useMemo(() => {
    const index = new Map<string, OrdersSessionRecord>();
    for (const order of [...activeOrders, ...incidentOrders, ...cashierOrders, ...historyOrders]) {
      index.set(order.orderSessionId, order);
    }
    return index;
  }, [activeOrders, incidentOrders, cashierOrders, historyOrders]);

  const getOrderById = useCallback(
    (orderSessionId: string | null) => {
      if (!orderSessionId) return null;
      return allOrdersIndex.get(orderSessionId) ?? null;
    },
    [allOrdersIndex],
  );

  const searchRecovery = useCallback(
    async (tokenOrCode: string) => {
      const normalized = tokenOrCode.trim();
      if (!normalized) {
        setRecoveryState({ searching: false, error: 'Introduce un PIN4 o un código de rescate.' });
        return null;
      }

      if (mode === 'demo') {
        setRecoveryState({ searching: false, error: null });
        const localMatch = buildFallbackState().cashierOrders.find(
          (order) => order.pin4 === normalized || order.qrToken === normalized,
        );
        if (!localMatch) {
          setRecoveryState({ searching: false, error: 'No existe ninguna cuenta recuperable con ese código.' });
          return null;
        }
        return localMatch;
      }

      setRecoveryState({ searching: true, error: null });
      try {
        const recovered = await recoverOrderSession(normalized);
        const session = normalizeOrderSession({
          ...recovered.orderSession,
          tableNameSnapshot: recovered.tableName ?? recovered.orderSession.tableNameSnapshot ?? null,
        });
        setRecoveryState({ searching: false, error: null });
        return session;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo recuperar la cuenta.';
        setRecoveryState({ searching: false, error: message });
        return null;
      }
    },
    [mode],
  );

  const confirmPendingCashPayment = useCallback(
    async (order: OrdersSessionRecord) => {
      if (mode === 'demo') {
        setConfirmationState({
          confirmingOrderId: null,
          message: 'Modo demo — confirmación de pago no disponible.',
          error: null,
        });
        return null;
      }

      const stableKey = confirmIdempotencyKeysRef.current[order.orderSessionId] ?? `cash-confirm-${order.orderSessionId}`;
      confirmIdempotencyKeysRef.current[order.orderSessionId] = stableKey;

      setConfirmationState({
        confirmingOrderId: order.orderSessionId,
        message: null,
        error: null,
      });
      setLastSyncState((current) => ({ ...current, message: null, error: null }));
      setStatusActionState((current) => ({ ...current, message: null, error: null }));

      try {
        const response = await confirmCashPayment(order.orderSessionId, order.total, stableKey);
        const updatedOrder = normalizeOrderSession(response.orderSession);
        setConfirmationState({
          confirmingOrderId: null,
          message:
            updatedOrder.lastSyncStatus === 'sent'
              ? 'Pago confirmado. Pedido enviado a cocina.'
              : 'Pago confirmado. Incidencia al enviar a cocina.',
          error: null,
        });
        await load();
        return updatedOrder;
      } catch (error) {
        setConfirmationState({
          confirmingOrderId: null,
          message: null,
          error: error instanceof Error ? error.message : 'No se pudo confirmar el pago.',
        });
        return null;
      }
    },
    [load, mode],
  );

  const sendToLast = useCallback(
    async (order: OrdersSessionRecord) => {
      if (mode === 'demo') {
        setLastSyncState({
          sendingOrderId: null,
          message: null,
          error: 'Modo demo — envío a Last no disponible.',
        });
        return null;
      }

      setLastSyncState({
        sendingOrderId: order.orderSessionId,
        message: null,
        error: null,
      });
      setConfirmationState((current) => ({ ...current, message: null, error: null }));
      setStatusActionState((current) => ({ ...current, message: null, error: null }));

      try {
        const response = await sendOrderSessionToLast(order.orderSessionId);
        const updatedOrder = normalizeOrderSession(response.orderSession);

        if (updatedOrder.lastSyncStatus === 'sent') {
          setLastSyncState({
            sendingOrderId: null,
            message: 'Enviado a Last correctamente.',
            error: null,
          });
        } else {
          setLastSyncState({
            sendingOrderId: null,
            message: null,
            error: response.error ?? 'No se pudo enviar a Last todavía.',
          });
        }

        await load();
        return updatedOrder;
      } catch (error) {
        setLastSyncState({
          sendingOrderId: null,
          message: null,
          error: error instanceof Error ? error.message : 'No se pudo enviar a Last.',
        });
        await load();
        return null;
      }
    },
    [load, mode],
  );

  const updateOperationalStatus = useCallback(
    async (order: OrdersSessionRecord, operationalStatus: OperationalStatus) => {
      if (mode === 'demo') {
        setStatusActionState({
          updatingOrderId: null,
          message: null,
          error: 'Modo demo — cambio de estado no disponible.',
        });
        return null;
      }

      setStatusActionState({
        updatingOrderId: order.orderSessionId,
        message: null,
        error: null,
      });
      setConfirmationState((current) => ({ ...current, message: null, error: null }));
      setLastSyncState((current) => ({ ...current, message: null, error: null }));

      try {
        const resolvedUpdated =
          order.recordType !== 'order_session' && order.liveTabId
            ? await updateLiveLastOrderStatus(order.liveTabId, operationalStatus).then(() => ({
                ...order,
                operationalStatus,
                updatedAt: new Date().toISOString(),
              }))
            : normalizeOrderSession(await updateOrderSessionStatus(order.orderSessionId, operationalStatus));

        setStatusActionState({
          updatingOrderId: null,
          message: `Estado actualizado a ${formatOperationalStatusLabel(resolvedUpdated.operationalStatus)}.`,
          error: null,
        });
        await load();
        return resolvedUpdated;
      } catch (error) {
        setStatusActionState({
          updatingOrderId: null,
          message: null,
          error: error instanceof Error ? error.message : 'No se pudo actualizar el estado.',
        });
        await load();
        return null;
      }
    },
    [load, mode],
  );

  const loadOrderEvents = useCallback(
    async (recordId: string) => {
      if (!recordId) {
        return;
      }

      const order = allOrdersIndex.get(recordId);
      const targetOrderSessionId =
        order?.recordType === 'order_session'
          ? order.orderSessionId
          : order?.recordType === 'operational_ticket'
            ? order.linkedOrderSessionId ?? null
            : null;

      if (mode === 'demo' || !targetOrderSessionId) {
        setEventTimeline((current) => ({
          ...current,
          [recordId]: {
            loading: false,
            error: null,
            events: [],
          },
        }));
        return;
      }

      setEventTimeline((current) => ({
        ...current,
        [recordId]: {
          loading: true,
          error: null,
          events: current[recordId]?.events ?? [],
        },
      }));

      try {
        const response = await getOrderSessionEvents(targetOrderSessionId);
        setEventTimeline((current) => ({
          ...current,
          [recordId]: {
            loading: false,
            error: null,
            events: response.events,
          },
        }));
      } catch (error) {
        setEventTimeline((current) => ({
          ...current,
          [recordId]: {
            loading: false,
            error: error instanceof Error ? error.message : 'No se pudo cargar el historial.',
            events: current[recordId]?.events ?? [],
          },
        }));
      }
    },
    [allOrdersIndex, mode],
  );

  const runPrint = useCallback(
    async (ticketId: string, force = false) => {
      if (!ticketId || mode === 'demo') {
        setPrintActionState((current) => ({
          ...current,
          [ticketId]: {
            loading: false,
            message: null,
            error: 'Modo demo — la impresión real de comandas no está disponible.',
            previewHtml: null,
            previewSvg: null,
            printStatus: null,
          },
        }));
        return null;
      }

      setPrintActionState((current) => ({
        ...current,
        [ticketId]: {
          ...(current[ticketId] ?? {
            loading: false,
            message: null,
            error: null,
            previewHtml: null,
            previewSvg: null,
            printStatus: null,
          }),
          loading: true,
          message: null,
          error: null,
        },
      }));

      try {
        const response = force ? await reprintOperationalTicket(ticketId) : await printOperationalTicket(ticketId, false);
        setPrintActionState((current) => ({
          ...current,
          [ticketId]: {
            loading: false,
            message: response.message,
            error: null,
            previewHtml: response.previewHtml,
            previewSvg: response.previewSvg,
            printStatus: response.ticket.printStatus,
          },
        }));
        openBrowserPrintPreview(response.previewHtml);
        await load();
        return response;
      } catch (error) {
        setPrintActionState((current) => ({
          ...current,
          [ticketId]: {
            loading: false,
            message: null,
            error: error instanceof Error ? error.message : 'No se pudo imprimir la comanda.',
            previewHtml: current[ticketId]?.previewHtml ?? null,
            previewSvg: current[ticketId]?.previewSvg ?? null,
            printStatus: current[ticketId]?.printStatus ?? null,
          },
        }));
        return null;
      }
    },
    [load, mode],
  );

  const markTicketSound = useCallback(async (ticketId: string) => {
    if (!ticketId || mode !== 'real') {
      return null;
    }
    try {
      await markOperationalTicketSoundPlayed(ticketId);
      await load();
      return true;
    } catch {
      return false;
    }
  }, [load, mode]);

  const pollPaymentJob = useCallback(
    (orderSessionId: string, jobId: string, provider: 'cashdro' | 'artemis') => {
      const existingTimer = paymentJobTimersRef.current[orderSessionId];
      if (existingTimer) {
        window.clearInterval(existingTimer);
      }

      const intervalId = window.setInterval(async () => {
        try {
          const job = await getPaymentJob(jobId);
          setPaymentJobState((current) => ({
            ...current,
            [orderSessionId]: {
              jobId: job.id,
              provider,
              status: job.status,
              error: job.errorMessage ?? null,
              message:
                job.status === 'queued'
                  ? 'Esperando turno de cobro.'
                  : job.status === 'running'
                    ? 'Procesando cobro.'
                    : job.status === 'completed'
                      ? 'Cobro completado.'
                      : null,
            },
          }));

          if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
            window.clearInterval(intervalId);
            delete paymentJobTimersRef.current[orderSessionId];
            await load();
          }
        } catch (error) {
          setPaymentJobState((current) => ({
            ...current,
            [orderSessionId]: {
              jobId,
              provider,
              status: 'failed',
              error: error instanceof Error ? error.message : 'No se pudo consultar el estado del cobro.',
              message: null,
            },
          }));
          window.clearInterval(intervalId);
          delete paymentJobTimersRef.current[orderSessionId];
        }
      }, 1500);

      paymentJobTimersRef.current[orderSessionId] = intervalId;
    },
    [load],
  );

  const startDevicePayment = useCallback(
    async (order: OrdersSessionRecord, provider: 'cashdro' | 'artemis') => {
      if (mode === 'demo') {
        setPaymentJobState((current) => ({
          ...current,
          [order.orderSessionId]: {
            jobId: 'demo',
            provider,
            status: 'failed',
            error: 'Modo demo de Orders: el cobro por dispositivo no está disponible aquí.',
            message: null,
          },
        }));
        return null;
      }

      try {
        const devices = await getPaymentDevices(order.locationId);
        const device = devices.find((item) => item.provider === provider && item.isActive);
        if (!device) {
          throw new Error('No hay un dispositivo activo para este método de pago.');
        }

        const job = await createPaymentJob({
          orderSessionId: order.orderSessionId,
          locationId: order.locationId,
          deviceId: device.id,
          provider,
          idempotencyKey: `${provider}-${order.orderSessionId}`,
        });

        setPaymentJobState((current) => ({
          ...current,
          [order.orderSessionId]: {
            jobId: job.id,
            provider,
            status: job.status,
            error: null,
            message: job.status === 'queued' ? 'Esperando turno de cobro.' : 'Procesando cobro.',
          },
        }));

        if (job.status === 'queued' || job.status === 'running') {
          pollPaymentJob(order.orderSessionId, job.id, provider);
        } else {
          await load();
        }

        return job;
      } catch (error) {
        setPaymentJobState((current) => ({
          ...current,
          [order.orderSessionId]: {
            jobId: '',
            provider,
            status: 'failed',
            error: error instanceof Error ? error.message : 'No se pudo iniciar el cobro.',
            message: null,
          },
        }));
        return null;
      }
    },
    [load, mode, pollPaymentJob],
  );

  return {
    activeOrders,
    kitchenOrders,
    incidentOrders,
    cashierOrders,
    historyOrders,
    loading,
    mode,
    bannerMessage,
    connectionError,
    getOrderById,
    refresh: load,
    searchRecovery,
    recoveryState,
    historyState,
    loadHistoryOrders,
    confirmPendingCashPayment,
    confirmationState,
    sendToLast,
    lastSyncState,
    updateOperationalStatus,
    statusActionState,
    paymentJobState,
    startDevicePayment,
    loadOrderEvents,
    eventTimeline,
    printActionState,
    printTicket: (ticketId: string) => runPrint(ticketId, false),
    reprintTicket: (ticketId: string) => runPrint(ticketId, true),
    markTicketSound,
    helpers: {
      formatChannelLabel,
      formatOperationalStatusLabel,
      formatPaymentModeLabel,
      formatPaymentStatusLabel,
      formatPrintStatusLabel,
      formatSyncStatusLabel,
      isPaidNotSent,
    },
  };
}
