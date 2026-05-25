import type { FastifyInstance } from 'fastify';
import { readConfig, readRuntimeConfig, saveConfig, saveSetupAutoConfig, saveSetupSelection, type LocalConfig } from '../config.js';
import {
  buildAutoSetupPatch,
  fetchCatalog,
  fetchCatalogDiagnostics,
  fetchCatalogWithPromotions,
  fetchPromotions,
  fetchSetupOptions,
  type SetupAutoPayload,
  type SetupSelectionPayload
} from '../last-app.js';

export function registerConfigRoutes(app: FastifyInstance) {
  app.get('/api/health', async () => ({ status: 'ok' }));

  app.get('/api/config', async () => {
    return readConfig();
  });

  app.put<{ Body: LocalConfig | Record<string, unknown> }>('/api/config', async (request) => {
    return saveConfig(request.body);
  });

  app.get('/api/catalog', async () => {
    const config = readRuntimeConfig();
    return fetchCatalog(config);
  });

  app.get('/api/catalog/diagnostics', async () => {
    const config = readRuntimeConfig();
    return fetchCatalogDiagnostics(config);
  });

  app.get('/api/promotions', async () => {
    const config = readRuntimeConfig();
    return fetchPromotions(config);
  });

  app.get('/api/catalog-with-promotions', async () => {
    const config = readRuntimeConfig();
    return fetchCatalogWithPromotions(config);
  });

  app.get('/api/setup/options', async () => {
    const config = readRuntimeConfig();
    return fetchSetupOptions(config);
  });

  app.put<{ Body: SetupSelectionPayload }>('/api/setup/selection', async (request) => {
    return saveSetupSelection(request.body);
  });

  app.post<{ Body: SetupAutoPayload }>('/api/setup/auto', async (request) => {
    const config = readRuntimeConfig();
    const patch = await buildAutoSetupPatch(config, request.body);
    return saveSetupAutoConfig(patch);
  });
}
