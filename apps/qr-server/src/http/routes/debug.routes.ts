import type { FastifyInstance } from 'fastify';
import { loadEnv } from '../../config/env.js';
import { runFirebaseAdminDiagnostic } from '../../config/firebaseAdmin.js';

export function registerDebugRoutes(app: FastifyInstance) {
  app.get('/api/debug/firebase', async () => {
    const env = loadEnv();
    return runFirebaseAdminDiagnostic(env);
  });
}
