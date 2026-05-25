import type { FastifyInstance } from 'fastify';
import { cancelCashdroPayment, getCashdroPaymentStatus, startCashdroPayment } from '../services/cashdroService.js';
import { confirmCashierOrderSessionPayment, recoverOrderSessionByTokenOrCode, type ConfirmCashPaymentInput } from '../services/recoveryService.js';
import { sendOrderSessionToLast } from '../services/lastSyncService.js';

export function registerRescueRoutes(app: FastifyInstance) {
  app.get<{ Params: { tokenOrCode: string } }>('/api/order-sessions/recovery/:tokenOrCode', async (request) => {
    return recoverOrderSessionByTokenOrCode(request.params.tokenOrCode);
  });

  app.post<{
    Params: { id: string };
    Body: ConfirmCashPaymentInput;
  }>('/api/order-sessions/:id/confirm-payment', async (request) => {
    return confirmCashierOrderSessionPayment(request.params.id, request.body);
  });

  app.post<{ Params: { id: string } }>('/api/order-sessions/:id/send-to-last', async (request) => {
    return sendOrderSessionToLast(request.params.id);
  });

  app.post<{ Params: { id: string } }>('/api/order-sessions/:id/cashdro/start', async (request) => {
    return startCashdroPayment(request.params.id);
  });

  app.get<{ Params: { id: string } }>('/api/order-sessions/:id/cashdro', async (request) => {
    return getCashdroPaymentStatus(request.params.id);
  });

  app.post<{ Params: { id: string } }>('/api/order-sessions/:id/cashdro/cancel', async (request) => {
    return cancelCashdroPayment(request.params.id);
  });
}
