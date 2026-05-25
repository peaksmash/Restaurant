import React, { useEffect } from 'react';
import type { OperationalStatus, PrintStatus } from '@kiosk/types';
import { OrderHistoryTimeline } from '../components/OrderHistoryTimeline';
import { OrderOpsDetail } from '../components/OrderOpsDetail';
import { FullPageHeader } from '../components/FullPageHeader';
import type {
  OrdersDataSourceMode,
  OrdersEventTimelineState,
  OrdersPageDetailMode,
  OrdersSessionRecord,
} from '../types';

interface OrderDetailPageProps {
  order: OrdersSessionRecord | null;
  mode?: OrdersPageDetailMode;
  dataSourceMode: OrdersDataSourceMode;
  confirmPaymentMessage?: string | null;
  confirmPaymentError?: string | null;
  confirmingOrderId?: string | null;
  sendToLastMessage?: string | null;
  sendToLastError?: string | null;
  sendingToLastOrderId?: string | null;
  statusActionMessage?: string | null;
  statusActionError?: string | null;
  updatingStatusOrderId?: string | null;
  paymentJobState?: {
    status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
    provider: 'cashdro' | 'artemis';
    error: string | null;
    message: string | null;
  } | null;
  printState?: {
    loading: boolean;
    message: string | null;
    error: string | null;
    printStatus: PrintStatus | null;
  } | null;
  eventTimeline?: OrdersEventTimelineState | null;
  onConfirmPayment?: (order: OrdersSessionRecord) => void;
  onSendToLast?: (order: OrdersSessionRecord) => void;
  onUpdateStatus?: (order: OrdersSessionRecord, operationalStatus: OperationalStatus) => void;
  onStartDevicePayment?: (order: OrdersSessionRecord, provider: 'cashdro' | 'artemis') => void;
  onLoadEvents?: (orderSessionId: string) => void;
  onPrintTicket?: (ticketId: string) => void;
  onReprintTicket?: (ticketId: string) => void;
  onClose: () => void;
}

export function OrderDetailPage({
  order,
  mode = 'orders',
  dataSourceMode,
  confirmPaymentMessage = null,
  confirmPaymentError = null,
  confirmingOrderId = null,
  sendToLastMessage = null,
  sendToLastError = null,
  sendingToLastOrderId = null,
  statusActionMessage = null,
  statusActionError = null,
  updatingStatusOrderId = null,
  paymentJobState = null,
  printState = null,
  eventTimeline = null,
  onConfirmPayment,
  onSendToLast,
  onUpdateStatus,
  onStartDevicePayment,
  onLoadEvents,
  onPrintTicket,
  onReprintTicket,
  onClose,
}: OrderDetailPageProps) {
  useEffect(() => {
    if (order?.orderSessionId && onLoadEvents) {
      onLoadEvents(order.orderSessionId);
    }
  }, [onLoadEvents, order?.orderSessionId]);

  return (
    <div className="orders-page">
      <FullPageHeader
        title={mode === 'pending' ? 'Cobro pendiente' : mode === 'incidents' ? 'Incidencia' : mode === 'kitchen' ? 'Kitchen' : 'Pedido'}
        subtitle={
          mode === 'pending'
            ? 'Detalle completo del cobro pendiente o recuperado.'
            : mode === 'incidents'
              ? 'Pedido pagado con fallo de sincronizacion o pendiente de envio a Last.'
              : mode === 'kitchen'
                ? 'Vista completa para cocina, con importes ocultos.'
                : 'Detalle completo del pedido seleccionado.'
        }
        onClose={onClose}
      />

      <section className="detail-fullscreen">
        <OrderOpsDetail
          order={order}
          mode={mode}
          dataSourceMode={dataSourceMode}
          confirmPaymentMessage={confirmPaymentMessage}
          confirmPaymentError={confirmPaymentError}
          confirmingOrderId={confirmingOrderId}
          sendToLastMessage={sendToLastMessage}
          sendToLastError={sendToLastError}
          sendingToLastOrderId={sendingToLastOrderId}
          statusActionMessage={statusActionMessage}
          statusActionError={statusActionError}
          updatingStatusOrderId={updatingStatusOrderId}
          paymentJobState={paymentJobState}
          printState={printState}
          onConfirmPayment={onConfirmPayment}
          onSendToLast={onSendToLast}
          onUpdateStatus={onUpdateStatus}
          onStartDevicePayment={onStartDevicePayment}
          onPrintTicket={onPrintTicket}
          onReprintTicket={onReprintTicket}
        />
        <OrderHistoryTimeline
          loading={eventTimeline?.loading ?? false}
          error={eventTimeline?.error ?? null}
          events={eventTimeline?.events ?? []}
        />
      </section>
    </div>
  );
}
