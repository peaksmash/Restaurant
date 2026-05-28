import Fastify from 'fastify';
import cors from '@fastify/cors';
import { pathToFileURL } from 'node:url';
import { loadEnv } from './config/env.js';
import { registerErrorHandler } from './http/middleware/errorHandler.js';
import { registerDebugRoutes } from './http/routes/debug.routes.js';
import { registerHealthRoutes } from './http/routes/health.routes.js';
import { registerTenantRoutes } from './http/routes/tenant.routes.js';
import { registerOrderSessionsRoutes } from './http/routes/orderSessions.routes.js';
import { registerStripeRoutes } from './http/routes/stripe.routes.js';

export function buildApp() {
  const env = loadEnv();
  const app = Fastify({
    logger: true,
  });

  app.register(cors, {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      callback(null, env.allowedOrigins.includes(origin));
    },
  });

  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, function (req, body, done) {
    try {
      const json = JSON.parse(body.toString());
      (req as any).rawBody = body;
      done(null, json);
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  registerErrorHandler(app);
  registerHealthRoutes(app);
  registerTenantRoutes(app);
  registerOrderSessionsRoutes(app);
  registerStripeRoutes(app);
  registerDebugRoutes(app);

  return { app, env };
}

async function start() {
  const { app, env } = buildApp();

  try {
    await app.listen({
      host: '0.0.0.0',
      port: env.port,
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  void start();
}
