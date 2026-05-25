import type { FastifyInstance } from 'fastify';
import { readRuntimeConfig } from '../config.js';
import { getOrderById, listOrderEvents, listRecentOrders } from '../db.js';
import { createOrderInLast, HttpError, type CreateOrderPayload } from '../last-app.js';

export function registerLegacyOrdersRoutes(app: FastifyInstance) {
  app.post<{ Body: CreateOrderPayload }>('/api/orders', async (request) => {
    const config = readRuntimeConfig();
    return createOrderInLast(config, request.body);
  });

  app.get('/api/orders', async () => {
    return listRecentOrders(50);
  });

  app.get<{ Params: { id: string } }>('/api/orders/:id', async (request, reply) => {
    const order = getOrderById(request.params.id);

    if (!order) {
      return reply.status(404).send({
        success: false,
        error: 'Order not found'
      });
    }

    return {
      order,
      events: listOrderEvents(request.params.id)
    };
  });
}
