import type { FastifyInstance } from 'fastify';
import {
  createPaymentDevice,
  listPaymentDevices,
  setPaymentDeviceActive,
  updatePaymentDevice
} from '../services/paymentDeviceService.js';
import { cancelPaymentJob, createPaymentJob, getPaymentJob, listPaymentJobs } from '../services/paymentJobService.js';
import { HttpError } from '../last-app.js';

export function registerPaymentDeviceRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: {
      locationId?: string;
      provider?: string;
      activeOnly?: string;
    };
  }>('/api/payment-devices', async (request) => {
    return listPaymentDevices({
      locationId: request.query.locationId,
      provider: request.query.provider,
      activeOnly: request.query.activeOnly === 'true'
    });
  });

  app.post<{
    Body: {
      locationId: string;
      provider: string;
      displayName: string;
      mode: string;
      configured?: boolean;
      isActive?: boolean;
      configJson?: Record<string, unknown> | string | null;
    };
  }>('/api/payment-devices', async (request) => {
    return createPaymentDevice(request.body);
  });

  app.patch<{
    Params: { id: string };
    Body: {
      displayName?: string;
      mode?: string;
      configured?: boolean;
      isActive?: boolean;
      configJson?: Record<string, unknown> | string | null;
    };
  }>('/api/payment-devices/:id', async (request) => {
    const body = request.body ?? {};
    if (typeof body.isActive === 'boolean' && Object.keys(body).length === 1) {
      return setPaymentDeviceActive(request.params.id, body.isActive);
    }

    return updatePaymentDevice(request.params.id, body);
  });

  app.get<{
    Querystring: {
      locationId?: string;
      deviceId?: string;
      orderSessionId?: string;
      status?: string;
    };
  }>('/api/payment-jobs', async (request) => {
    return listPaymentJobs({
      locationId: request.query.locationId,
      deviceId: request.query.deviceId,
      orderSessionId: request.query.orderSessionId,
      status: request.query.status as never
    });
  });

  app.get<{ Params: { id: string } }>('/api/payment-jobs/:id', async (request) => {
    const job = getPaymentJob(request.params.id);
    if (!job) {
      throw new HttpError(404, 'Payment job not found', { code: 'payment_job_not_found' });
    }
    return job;
  });

  app.post<{
    Body: {
      orderSessionId: string;
      locationId: string;
      deviceId: string;
      provider: string;
      idempotencyKey: string;
      requestPayloadJson?: Record<string, unknown> | null;
    };
  }>('/api/payment-jobs', async (request) => {
    return createPaymentJob(request.body);
  });

  app.post<{ Params: { id: string } }>('/api/payment-jobs/:id/cancel', async (request) => {
    return cancelPaymentJob(request.params.id);
  });
}
