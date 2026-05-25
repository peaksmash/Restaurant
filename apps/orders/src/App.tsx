import React, { useEffect, useMemo, useState } from 'react';
import type { OperationalStatus } from '@kiosk/types';
import type { MiniKioskModifierGroup } from './api';
import { BottomNav, type OrdersPageId } from './components/BottomNav';
import { MiniKioskProductModal } from './components/MiniKioskProductModal';
import { ScaffoldBanner } from './components/ScaffoldBanner';
import { useMiniKiosk } from './hooks/useMiniKiosk';
import { useNewOrderSound } from './hooks/useNewOrderSound';
import { useOrderSessions } from './hooks/useOrderSessions';
import { getCartDiscountedTotal } from './lib/cartPricing';
import { CartaPage } from './pages/CartaPage';
import { CartaCartPage, type CartaLine, type CartaLineModifier } from './pages/CartaCartPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { OrdersBoardPage } from './pages/OrdersBoardPage';
import { PendingPage } from './pages/PendingPage';
import type { CartaProduct } from './mock/menu';
import type { OrdersBoardView, OrdersHistoryChannelFilter, OrdersSessionRecord } from './types';

function buildCartaLineSignature(productId: string, modifiers: CartaLineModifier[], comments = '') {
  const modifierKey = modifiers
    .slice()
    .sort((left, right) => {
      const leftKey = `${left.modifierGroupId}:${left.modifierOptionId}`;
      const rightKey = `${right.modifierGroupId}:${right.modifierOptionId}`;
      return leftKey.localeCompare(rightKey);
    })
    .map((modifier) => `${modifier.modifierGroupId}:${modifier.modifierOptionId}:${modifier.quantity ?? 1}`)
    .join('|');

  return `${productId}::${modifierKey}::${comments.trim()}`;
}

function buildCartaLine(product: CartaProduct, modifiers: CartaLineModifier[], quantity = 1): CartaLine {
  return {
    id: `carta-${crypto.randomUUID()}`,
    product,
    quantity,
    modifiers,
  };
}

export function App() {
  const [activePage, setActivePage] = useState<OrdersPageId>('orders');
  const [detailView, setDetailView] = useState<'none' | 'order' | 'pending' | 'cart'>('none');
  const [cartaLines, setCartaLines] = useState<CartaLine[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [pendingDetailOrder, setPendingDetailOrder] = useState<OrdersSessionRecord | null>(null);
  const [ordersView, setOrdersView] = useState<OrdersBoardView>('active');
  const [historyChannelFilter, setHistoryChannelFilter] = useState<OrdersHistoryChannelFilter>('all');
  const [selectedCartaProduct, setSelectedCartaProduct] = useState<CartaProduct | null>(null);
  const [editingCartaLineId, setEditingCartaLineId] = useState<string | null>(null);
  const {
    mode: miniKioskMode,
    loading: miniKioskLoading,
    connectionMessage: miniKioskConnectionMessage,
    connectionError: miniKioskConnectionError,
    config: miniKioskConfig,
    categories: miniKioskCategories,
    modifierGroups: miniKioskModifierGroups,
    createPendingOrder,
    createState: miniKioskCreateState,
    clearCreatedOrder,
  } = useMiniKiosk();
  const {
    activeOrders,
    kitchenOrders,
    incidentOrders,
    cashierOrders,
    historyOrders,
    mode,
    bannerMessage,
    connectionError,
    getOrderById,
    historyState,
    loadHistoryOrders,
    searchRecovery,
    recoveryState,
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
    printTicket,
    reprintTicket,
    markTicketSound,
    refresh: refreshOrderSessions,
  } = useOrderSessions();

  const ordersBannerMessage = useMemo(() => {
    if (miniKioskConfig?.paymentsSimulated) {
      return `${bannerMessage} · pagos en modo demo`;
    }
    return bannerMessage;
  }, [bannerMessage, miniKioskConfig?.paymentsSimulated]);

  const pendingIncomingCount = useMemo(
    () => activeOrders.filter((order) => order.operationalStatus === 'pending').length,
    [activeOrders],
  );

  const selectedOrder = useMemo(() => getOrderById(selectedOrderId), [getOrderById, selectedOrderId]);

  const selectedPendingOrder = useMemo(() => {
    if (pendingDetailOrder?.orderSessionId === selectedOrderId) {
      return pendingDetailOrder;
    }
    return getOrderById(selectedOrderId) ?? pendingDetailOrder ?? null;
  }, [getOrderById, pendingDetailOrder, selectedOrderId]);

  useNewOrderSound(activeOrders, mode, markTicketSound);

  const cartaTotalPrice = useMemo(() => getCartDiscountedTotal(cartaLines), [cartaLines]);
  const modifierGroupsById = useMemo(
    () => new Map<string, MiniKioskModifierGroup>(miniKioskModifierGroups.map((group) => [group.id, group])),
    [miniKioskModifierGroups],
  );
  const editingCartaLine = useMemo(
    () => cartaLines.find((line) => line.id === editingCartaLineId) ?? null,
    [cartaLines, editingCartaLineId],
  );

  useEffect(() => {
    if (activePage === 'orders' && ordersView === 'history') {
      void loadHistoryOrders();
    }
  }, [activePage, loadHistoryOrders, ordersView]);

  function resetMiniKioskCreatedOrderIfNeeded() {
    if (miniKioskCreateState.createdOrder) {
      clearCreatedOrder();
    }
  }

  function closeCartaConfigurator() {
    setSelectedCartaProduct(null);
    setEditingCartaLineId(null);
  }

  function getProductModifierGroups(product: CartaProduct) {
    return (product.modifierGroups ?? [])
      .map((groupId) => modifierGroupsById.get(groupId))
      .filter((group): group is MiniKioskModifierGroup => group != null);
  }

  function productHasModifiers(product: CartaProduct) {
    return getProductModifierGroups(product).length > 0;
  }

  function openCartaConfigurator(product: CartaProduct, lineId: string | null = null) {
    setSelectedCartaProduct(product);
    setEditingCartaLineId(lineId);
  }

  function insertOrMergeCartaLine(nextLine: CartaLine, editingLineId: string | null = null) {
    setCartaLines((current) => {
      const signature = buildCartaLineSignature(nextLine.product.id, nextLine.modifiers, nextLine.comments);
      const withoutEditing = editingLineId ? current.filter((line) => line.id !== editingLineId) : [...current];
      const existing = withoutEditing.find(
        (line) => buildCartaLineSignature(line.product.id, line.modifiers, line.comments) === signature,
      );

      if (existing) {
        return withoutEditing.map((line) =>
          line.id === existing.id ? { ...line, quantity: line.quantity + nextLine.quantity } : line,
        );
      }

      return [...withoutEditing, nextLine];
    });
  }

  function addCartaProduct(product: CartaProduct) {
    resetMiniKioskCreatedOrderIfNeeded();

    if (productHasModifiers(product)) {
      openCartaConfigurator(product);
      return;
    }

    setCartaLines((current) => {
      const existing = current.find((line) => line.product.id === product.id && line.modifiers.length === 0 && !line.comments);
      if (existing) {
        return current.map((line) =>
          line.id === existing.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }

      return [...current, buildCartaLine(product, [])];
    });
  }

  function removeCartaProductUnit(productId: string) {
    resetMiniKioskCreatedOrderIfNeeded();

    setCartaLines((current) => {
      const index = [...current].reverse().findIndex((line) => line.product.id === productId);
      if (index === -1) {
        return current;
      }

      const realIndex = current.length - 1 - index;
      return current
        .map((line, lineIndex) => {
          if (lineIndex !== realIndex) {
            return line;
          }
          return { ...line, quantity: line.quantity - 1 };
        })
        .filter((line) => line.quantity > 0);
    });
  }

  function changeCartaLineQty(lineId: string, delta: number) {
    resetMiniKioskCreatedOrderIfNeeded();

    setCartaLines((current) =>
      current
        .map((line) => (line.id === lineId ? { ...line, quantity: line.quantity + delta } : line))
        .filter((line) => line.quantity > 0),
    );
  }

  function editCartaLine(lineId: string) {
    const line = cartaLines.find((candidate) => candidate.id === lineId);
    if (!line || !productHasModifiers(line.product)) {
      return;
    }

    resetMiniKioskCreatedOrderIfNeeded();
    openCartaConfigurator(line.product, lineId);
  }

  function handleCartaModifiersConfirm(modifiers: CartaLineModifier[]) {
    if (!selectedCartaProduct) {
      return;
    }

    resetMiniKioskCreatedOrderIfNeeded();

    if (editingCartaLine) {
      insertOrMergeCartaLine(
        {
          ...editingCartaLine,
          product: selectedCartaProduct,
          modifiers,
        },
        editingCartaLine.id,
      );
    } else {
      insertOrMergeCartaLine(buildCartaLine(selectedCartaProduct, modifiers));
    }

    closeCartaConfigurator();
  }

  async function handleRecoverOrder(tokenOrCode: string) {
    const found = await searchRecovery(tokenOrCode);
    if (!found) return;

    setSelectedOrderId(found.orderSessionId);
    setPendingDetailOrder(found);
    setDetailView('pending');
  }

  async function handleConfirmPending(order: OrdersSessionRecord) {
    const updated = await confirmPendingCashPayment(order);
    if (!updated) return;

    setSelectedOrderId(updated.orderSessionId);
    setPendingDetailOrder({
      ...updated,
      tableName: order.tableName ?? updated.tableNameSnapshot ?? null,
    });
  }

  async function handleSendToLast(order: OrdersSessionRecord) {
    const updated = await sendToLast(order);
    if (!updated) return;

    if (updated.lastSyncStatus === 'sent') {
      setPendingDetailOrder(null);
      setActivePage('orders');
      setOrdersView('active');
      setSelectedOrderId(updated.orderSessionId);
      setDetailView('none');
      return;
    }

    setSelectedOrderId(updated.orderSessionId);
    setPendingDetailOrder({
      ...updated,
      tableName: order.tableName ?? updated.tableNameSnapshot ?? null,
    });
    setActivePage('orders');
    setOrdersView('incidents');
    setDetailView('order');
  }

  async function handleUpdateStatus(order: OrdersSessionRecord, operationalStatus: OperationalStatus) {
    const updated = await updateOperationalStatus(order, operationalStatus);
    if (!updated) return;

    setSelectedOrderId(updated.orderSessionId);
    if (detailView === 'pending') {
      setPendingDetailOrder({
        ...updated,
        tableName: order.tableName ?? updated.tableNameSnapshot ?? null,
      });
      return;
    }

    if (updated.operationalStatus === 'cancelled') {
      setDetailView('none');
    }
  }

  async function handleCreateMiniKioskPendingOrder() {
    const created = await createPendingOrder(cartaLines);
    if (!created) return;

    await refreshOrderSessions();
    setSelectedOrderId(created.orderSessionId);
  }

  return (
    <div className="orders-app">
      <ScaffoldBanner message={ordersBannerMessage} mode={mode} />

      <div className="orders-stage">
        {activePage === 'carta' && detailView === 'none' ? (
          <CartaPage
            categories={miniKioskCategories}
            loading={miniKioskLoading}
            connectionMode={miniKioskMode}
            connectionMessage={miniKioskConnectionMessage}
            connectionError={miniKioskConnectionError}
            restaurantName={miniKioskConfig?.restaurantName ?? null}
            lines={cartaLines}
            onOpenCart={() => setDetailView('cart')}
            onAddProduct={addCartaProduct}
            onChangeQty={removeCartaProductUnit}
            productHasModifiers={productHasModifiers}
          />
        ) : null}
        {activePage === 'carta' && detailView === 'cart' ? (
          <CartaCartPage
            lines={cartaLines}
            totalPrice={cartaTotalPrice}
            connectionMode={miniKioskMode}
            connectionMessage={miniKioskConnectionMessage}
            createError={miniKioskCreateState.error}
            creating={miniKioskCreateState.creating}
            createdOrder={miniKioskCreateState.createdOrder}
            onClose={() => setDetailView('none')}
            onChangeQty={changeCartaLineQty}
            onEditLine={editCartaLine}
            onCreatePendingOrder={handleCreateMiniKioskPendingOrder}
            onGoToPending={() => {
              if (!miniKioskCreateState.createdOrder) return;
              setPendingDetailOrder({
                ...miniKioskCreateState.createdOrder,
                tableName: miniKioskCreateState.createdOrder.tableNameSnapshot ?? null,
              });
              setSelectedOrderId(miniKioskCreateState.createdOrder.orderSessionId);
              setDetailView('pending');
              setActivePage('pending');
            }}
            onResetCreatedOrder={() => {
              clearCreatedOrder();
              setCartaLines([]);
            }}
          />
        ) : null}
        {activePage === 'orders' ? (
          detailView === 'order' ? (
            <OrderDetailPage
              order={selectedOrder}
              mode={ordersView === 'kitchen' ? 'kitchen' : ordersView === 'incidents' ? 'incidents' : 'orders'}
              dataSourceMode={mode}
              sendToLastMessage={lastSyncState.message}
              sendToLastError={lastSyncState.error}
              sendingToLastOrderId={lastSyncState.sendingOrderId}
              statusActionMessage={statusActionState.message}
              statusActionError={statusActionState.error}
              updatingStatusOrderId={statusActionState.updatingOrderId}
              printState={selectedOrder?.ticketId ? printActionState[selectedOrder.ticketId] ?? null : null}
              eventTimeline={selectedOrder ? eventTimeline[selectedOrder.orderSessionId] ?? null : null}
              onSendToLast={handleSendToLast}
              onUpdateStatus={handleUpdateStatus}
              onLoadEvents={loadOrderEvents}
              onPrintTicket={printTicket}
              onReprintTicket={reprintTicket}
              onClose={() => setDetailView('none')}
            />
          ) : (
            <OrdersBoardPage
              activeOrders={activeOrders}
              kitchenOrders={kitchenOrders}
              incidentOrders={incidentOrders}
              historyOrders={historyOrders}
              selectedOrderId={selectedOrderId}
              currentView={ordersView}
              historyChannelFilter={historyChannelFilter}
              dataSourceMode={mode}
              connectionError={ordersView === 'history' ? historyState.error : connectionError}
              updatingOrderId={statusActionState.updatingOrderId}
              onChangeView={setOrdersView}
              onChangeHistoryChannelFilter={setHistoryChannelFilter}
              onSelectOrder={(orderId) => {
                setSelectedOrderId(orderId);
                setDetailView('order');
              }}
              onAdvanceStatus={handleUpdateStatus}
            />
          )
        ) : null}
        {activePage === 'pending' ? (
          detailView === 'pending' ? (
            <OrderDetailPage
              order={selectedPendingOrder}
              mode="pending"
              dataSourceMode={mode}
              confirmPaymentMessage={confirmationState.message}
              confirmPaymentError={confirmationState.error}
              confirmingOrderId={confirmationState.confirmingOrderId}
              sendToLastMessage={lastSyncState.message}
              sendToLastError={lastSyncState.error}
              sendingToLastOrderId={lastSyncState.sendingOrderId}
              statusActionMessage={statusActionState.message}
              statusActionError={statusActionState.error}
              updatingStatusOrderId={statusActionState.updatingOrderId}
              paymentJobState={selectedPendingOrder ? paymentJobState[selectedPendingOrder.orderSessionId] ?? null : null}
              printState={selectedPendingOrder?.ticketId ? printActionState[selectedPendingOrder.ticketId] ?? null : null}
              eventTimeline={selectedPendingOrder ? eventTimeline[selectedPendingOrder.orderSessionId] ?? null : null}
              onConfirmPayment={handleConfirmPending}
              onSendToLast={handleSendToLast}
              onUpdateStatus={handleUpdateStatus}
              onStartDevicePayment={startDevicePayment}
              onLoadEvents={loadOrderEvents}
              onPrintTicket={printTicket}
              onReprintTicket={reprintTicket}
              onClose={() => {
                setDetailView('none');
                setPendingDetailOrder(null);
              }}
            />
          ) : (
            <PendingPage
              orders={cashierOrders}
              selectedOrderId={selectedOrderId}
              dataSourceMode={mode}
              recoverySearching={recoveryState.searching}
              recoveryError={recoveryState.error}
              connectionError={connectionError}
              onRecoverOrder={handleRecoverOrder}
              onSelectOrder={(orderId) => {
                setSelectedOrderId(orderId);
                setPendingDetailOrder(null);
                setDetailView('pending');
              }}
            />
          )
        ) : null}
      </div>

      <BottomNav
        activePage={activePage}
        ordersBadge={pendingIncomingCount}
        onChangePage={(page) => {
          setActivePage(page);
          setDetailView('none');
          setPendingDetailOrder(null);
          closeCartaConfigurator();
          if (page !== 'orders') {
            setOrdersView('active');
            setHistoryChannelFilter('all');
          }
        }}
      />

      {selectedCartaProduct ? (
        <MiniKioskProductModal
          product={selectedCartaProduct}
          groups={getProductModifierGroups(selectedCartaProduct)}
          initialLine={editingCartaLine}
          onConfirm={handleCartaModifiersConfirm}
          onClose={closeCartaConfigurator}
        />
      ) : null}
    </div>
  );
}
