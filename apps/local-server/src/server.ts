import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { pathToFileURL } from 'node:url';
import { ConfigStoreError } from './config.js';
import { HttpError, isHttpError } from './last-app.js';
import { registerConfigRoutes } from './routes/config.js';
import { registerOrderSessionRoutes } from './routes/orderSessions.js';
import { registerRescueRoutes } from './routes/rescue.js';
import { registerTableQrMappingRoutes } from './routes/tableQrMappings.js';
import { registerLastRoutes } from './routes/last.js';
import { registerLegacyOrdersRoutes } from './routes/legacyOrders.js';
import { registerPaymentDeviceRoutes } from './routes/paymentDevices.js';
import { registerQrOrdersRoutes } from './routes/qrOrders.js';
import { registerOperationalTicketRoutes } from './routes/operationalTickets.js';
import { registerSuggestionsRoutes } from './routes/suggestions.js';
import { registerStripeWebhookRoutes } from './routes/stripeWebhook.js';

function getAllowedOrigins() {
  const envOrigins = process.env.ALLOWED_ORIGINS?.trim();
  if (envOrigins) {
    return envOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  return [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3002',
    'http://127.0.0.1:3002',
    'http://localhost:3003',
    'http://127.0.0.1:3003',
    'http://localhost:3004',
    'http://127.0.0.1:3004',
    'http://192.168.1.80:3000',
  ];
}

export function buildServer() {
  const app = Fastify({ logger: true });
  const allowedOrigins = new Set(getAllowedOrigins());

  app.register(cors, {
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      callback(null, allowedOrigins.has(origin));
    },
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError || isHttpError(error)) {
      reply.status(error.statusCode).send({
        error: error.message,
      });
      return;
    }

    if (error instanceof ConfigStoreError) {
      reply.status(503).send({
        error: error.message,
      });
      return;
    }

    app.log.error(error);

    reply.status(500).send({
      error: 'Unexpected server error.',
    });
  });

  registerConfigRoutes(app);
  registerOrderSessionRoutes(app);
  registerRescueRoutes(app);
  registerTableQrMappingRoutes(app);
  registerLastRoutes(app);
  registerLegacyOrdersRoutes(app);
  registerPaymentDeviceRoutes(app);
  registerQrOrdersRoutes(app);
  registerOperationalTicketRoutes(app);
  registerSuggestionsRoutes(app);
  registerStripeWebhookRoutes(app);

  return app;
}

async function start() {
  const app = buildServer();

  try {
    await app.listen({ host: '0.0.0.0', port: 3001 });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  void start();
}
