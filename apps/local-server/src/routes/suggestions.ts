import type { FastifyInstance } from 'fastify';
import {
  createBundleRule,
  createCompositionRule,
  createCrosssellRule,
  createLastminuteItem,
  createSuggestionEvent,
  createUpsellRule,
  deleteBundleRule,
  deleteCompositionRule,
  deleteCrosssellRule,
  deleteLastminuteItem,
  deleteUpsellRule,
  getAllCompositionRules,
  getBundleRuleById,
  getCompositionRuleById,
  getCrosssellRuleById,
  getLastminuteItemById,
  getSuggestionStats,
  getUpsellRuleById,
  listBundleRules,
  listCrosssellRules,
  listLastminuteItems,
  listUpsellRules,
  updateBundleRule,
  updateCompositionRule,
  updateCrosssellRule,
  updateLastminuteItem,
  updateUpsellRule,
} from '../db.js';
import type { CompositionSection, SuggestionEngine, SuggestionOutcome, SuggestionTimeSlot } from '../db.js';
import { HttpError } from '../last-app.js';

function currentTimeSlot(): SuggestionTimeSlot {
  const h = new Date().getHours();
  if (h >= 7 && h < 11) return 'breakfast';
  if (h >= 11 && h < 16) return 'lunch';
  if (h >= 16 && h < 20) return 'snack';
  if (h >= 20 && h < 24) return 'dinner';
  return 'all';
}

const VALID_TIME_SLOTS: SuggestionTimeSlot[] = ['all', 'breakfast', 'lunch', 'snack', 'dinner'];
const VALID_ENGINES: SuggestionEngine[] = ['upsell', 'crosssell', 'lastminute', 'bundle', 'composition'];
const VALID_OUTCOMES: SuggestionOutcome[] = ['shown', 'accepted', 'ignored', 'rejected'];

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, `Missing or empty field: ${field}`);
  }
  return value.trim();
}

function optionalTimeSlot(value: unknown): SuggestionTimeSlot {
  if (value === undefined || value === null) return 'all';
  if (typeof value === 'string' && (VALID_TIME_SLOTS as string[]).includes(value)) {
    return value as SuggestionTimeSlot;
  }
  throw new HttpError(400, `Invalid timeSlot. Must be one of: ${VALID_TIME_SLOTS.join(', ')}`);
}

export function registerSuggestionsRoutes(app: FastifyInstance) {
  // ── GET /api/suggestions ──────────────────────────────────────────────────
  // Returns active rules for the current time slot (or all if ?timeSlot=all)
  app.get<{ Querystring: { timeSlot?: string; productIds?: string; categoryIds?: string } }>(
    '/api/suggestions',
    async (request) => {
      const slot = request.query.timeSlot
        ? optionalTimeSlot(request.query.timeSlot)
        : currentTimeSlot();

      const upsell = listUpsellRules(true).filter(
        (r) => r.timeSlot === 'all' || r.timeSlot === slot
      );
      const crosssell = listCrosssellRules(true).filter(
        (r) => r.timeSlot === 'all' || r.timeSlot === slot
      );
      const lastminute = listLastminuteItems(true).filter(
        (r) => r.timeSlot === 'all' || r.timeSlot === slot
      );
      const bundles = listBundleRules(true);

      const compositionRules = getAllCompositionRules().filter((r) => r.isActive);

      return { timeSlot: slot, upsell, crosssell, lastminute, bundles, compositionRules };
    }
  );

  // ── POST /api/suggestions/event ───────────────────────────────────────────
  app.post<{ Body: { sessionId?: string; engine?: string; ruleId?: string; suggestedProductId?: string; outcome?: string } }>(
    '/api/suggestions/event',
    async (request) => {
      const sessionId = requireString(request.body?.sessionId, 'sessionId');
      const ruleId = requireString(request.body?.ruleId, 'ruleId');
      const suggestedProductId = requireString(request.body?.suggestedProductId, 'suggestedProductId');

      const engine = request.body?.engine;
      if (!engine || !(VALID_ENGINES as string[]).includes(engine)) {
        throw new HttpError(400, `Invalid engine. Must be one of: ${VALID_ENGINES.join(', ')}`);
      }

      const outcome = request.body?.outcome;
      if (!outcome || !(VALID_OUTCOMES as string[]).includes(outcome)) {
        throw new HttpError(400, `Invalid outcome. Must be one of: ${VALID_OUTCOMES.join(', ')}`);
      }

      return createSuggestionEvent({
        sessionId,
        engine: engine as SuggestionEngine,
        ruleId,
        suggestedProductId,
        outcome: outcome as SuggestionOutcome,
      });
    }
  );

  // ── GET /api/suggestions/stats ────────────────────────────────────────────
  app.get('/api/suggestions/stats', async () => {
    return getSuggestionStats();
  });

  // ── Upsell rules CRUD ─────────────────────────────────────────────────────
  app.get('/api/suggestions/upsell', async () => listUpsellRules());

  app.post<{ Body: { triggerProductId?: string; suggestProductId?: string; timeSlot?: unknown; priority?: unknown; isActive?: unknown } }>(
    '/api/suggestions/upsell',
    async (request) => {
      const triggerProductId = requireString(request.body?.triggerProductId, 'triggerProductId');
      const suggestProductId = requireString(request.body?.suggestProductId, 'suggestProductId');
      const timeSlot = optionalTimeSlot(request.body?.timeSlot);
      const priority = typeof request.body?.priority === 'number' ? request.body.priority : 0;
      const isActive = request.body?.isActive !== false;
      return createUpsellRule({ triggerProductId, suggestProductId, timeSlot, priority, isActive });
    }
  );

  app.patch<{ Params: { id: string }; Body: { triggerProductId?: string; suggestProductId?: string; timeSlot?: unknown; priority?: unknown; isActive?: unknown } }>(
    '/api/suggestions/upsell/:id',
    async (request) => {
      const rule = getUpsellRuleById(request.params.id);
      if (!rule) throw new HttpError(404, 'Upsell rule not found');
      const timeSlot = request.body?.timeSlot !== undefined ? optionalTimeSlot(request.body.timeSlot) : undefined;
      const updated = updateUpsellRule(request.params.id, {
        triggerProductId: typeof request.body?.triggerProductId === 'string' ? request.body.triggerProductId.trim() : undefined,
        suggestProductId: typeof request.body?.suggestProductId === 'string' ? request.body.suggestProductId.trim() : undefined,
        timeSlot,
        priority: typeof request.body?.priority === 'number' ? request.body.priority : undefined,
        isActive: typeof request.body?.isActive === 'boolean' ? request.body.isActive : undefined,
      });
      return updated;
    }
  );

  app.delete<{ Params: { id: string } }>('/api/suggestions/upsell/:id', async (request, reply) => {
    const deleted = deleteUpsellRule(request.params.id);
    if (!deleted) throw new HttpError(404, 'Upsell rule not found');
    return reply.status(204).send();
  });

  // ── Cross-sell rules CRUD ─────────────────────────────────────────────────
  app.get('/api/suggestions/crosssell', async () => listCrosssellRules());

  app.post<{ Body: { ifHasCategoryId?: string; ifMissingCategoryId?: string; suggestProductId?: string; timeSlot?: unknown; priority?: unknown; isActive?: unknown } }>(
    '/api/suggestions/crosssell',
    async (request) => {
      const ifHasCategoryId = requireString(request.body?.ifHasCategoryId, 'ifHasCategoryId');
      const ifMissingCategoryId = requireString(request.body?.ifMissingCategoryId, 'ifMissingCategoryId');
      const suggestProductId = requireString(request.body?.suggestProductId, 'suggestProductId');
      const timeSlot = optionalTimeSlot(request.body?.timeSlot);
      const priority = typeof request.body?.priority === 'number' ? request.body.priority : 0;
      const isActive = request.body?.isActive !== false;
      return createCrosssellRule({ ifHasCategoryId, ifMissingCategoryId, suggestProductId, timeSlot, priority, isActive });
    }
  );

  app.patch<{ Params: { id: string }; Body: { ifHasCategoryId?: string; ifMissingCategoryId?: string; suggestProductId?: string; timeSlot?: unknown; priority?: unknown; isActive?: unknown } }>(
    '/api/suggestions/crosssell/:id',
    async (request) => {
      const rule = getCrosssellRuleById(request.params.id);
      if (!rule) throw new HttpError(404, 'Cross-sell rule not found');
      const timeSlot = request.body?.timeSlot !== undefined ? optionalTimeSlot(request.body.timeSlot) : undefined;
      const updated = updateCrosssellRule(request.params.id, {
        ifHasCategoryId: typeof request.body?.ifHasCategoryId === 'string' ? request.body.ifHasCategoryId.trim() : undefined,
        ifMissingCategoryId: typeof request.body?.ifMissingCategoryId === 'string' ? request.body.ifMissingCategoryId.trim() : undefined,
        suggestProductId: typeof request.body?.suggestProductId === 'string' ? request.body.suggestProductId.trim() : undefined,
        timeSlot,
        priority: typeof request.body?.priority === 'number' ? request.body.priority : undefined,
        isActive: typeof request.body?.isActive === 'boolean' ? request.body.isActive : undefined,
      });
      return updated;
    }
  );

  app.delete<{ Params: { id: string } }>('/api/suggestions/crosssell/:id', async (request, reply) => {
    const deleted = deleteCrosssellRule(request.params.id);
    if (!deleted) throw new HttpError(404, 'Cross-sell rule not found');
    return reply.status(204).send();
  });

  // ── Last-minute items CRUD ────────────────────────────────────────────────
  app.get('/api/suggestions/lastminute', async () => listLastminuteItems());

  app.post<{ Body: { productId?: string; timeSlot?: unknown; position?: unknown; isActive?: unknown } }>(
    '/api/suggestions/lastminute',
    async (request) => {
      const productId = requireString(request.body?.productId, 'productId');
      const timeSlot = optionalTimeSlot(request.body?.timeSlot);
      const position = typeof request.body?.position === 'number' ? request.body.position : 0;
      const isActive = request.body?.isActive !== false;
      return createLastminuteItem({ productId, timeSlot, position, isActive });
    }
  );

  app.patch<{ Params: { id: string }; Body: { productId?: string; timeSlot?: unknown; position?: unknown; isActive?: unknown } }>(
    '/api/suggestions/lastminute/:id',
    async (request) => {
      const item = getLastminuteItemById(request.params.id);
      if (!item) throw new HttpError(404, 'Last-minute item not found');
      const timeSlot = request.body?.timeSlot !== undefined ? optionalTimeSlot(request.body.timeSlot) : undefined;
      const updated = updateLastminuteItem(request.params.id, {
        productId: typeof request.body?.productId === 'string' ? request.body.productId.trim() : undefined,
        timeSlot,
        position: typeof request.body?.position === 'number' ? request.body.position : undefined,
        isActive: typeof request.body?.isActive === 'boolean' ? request.body.isActive : undefined,
      });
      return updated;
    }
  );

  app.delete<{ Params: { id: string } }>('/api/suggestions/lastminute/:id', async (request, reply) => {
    const deleted = deleteLastminuteItem(request.params.id);
    if (!deleted) throw new HttpError(404, 'Last-minute item not found');
    return reply.status(204).send();
  });

  // ── Bundle rules CRUD ─────────────────────────────────────────────────────
  app.get('/api/suggestions/bundles', async () => listBundleRules());

  app.post<{ Body: { name?: string; productIds?: unknown; bundlePrice?: unknown; triggerProductId?: unknown; isActive?: unknown } }>(
    '/api/suggestions/bundles',
    async (request) => {
      const name = requireString(request.body?.name, 'name');
      const productIds = request.body?.productIds;
      if (!Array.isArray(productIds) || productIds.length === 0) {
        throw new HttpError(400, 'productIds must be a non-empty array');
      }
      const bundlePrice = typeof request.body?.bundlePrice === 'number' ? request.body.bundlePrice : null;
      const triggerProductId = typeof request.body?.triggerProductId === 'string' ? request.body.triggerProductId.trim() || null : null;
      const isActive = request.body?.isActive !== false;
      return createBundleRule({ name, productIds: productIds as string[], bundlePrice, triggerProductId, isActive });
    }
  );

  app.patch<{ Params: { id: string }; Body: { name?: string; productIds?: unknown; bundlePrice?: unknown; triggerProductId?: unknown; isActive?: unknown } }>(
    '/api/suggestions/bundles/:id',
    async (request) => {
      const rule = getBundleRuleById(request.params.id);
      if (!rule) throw new HttpError(404, 'Bundle rule not found');
      const productIds = request.body?.productIds;
      if (productIds !== undefined && !Array.isArray(productIds)) {
        throw new HttpError(400, 'productIds must be an array');
      }
      const updated = updateBundleRule(request.params.id, {
        name: typeof request.body?.name === 'string' ? request.body.name.trim() : undefined,
        productIds: Array.isArray(productIds) ? (productIds as string[]) : undefined,
        bundlePrice: request.body?.bundlePrice === undefined ? undefined : (typeof request.body.bundlePrice === 'number' ? request.body.bundlePrice : null),
        triggerProductId: request.body?.triggerProductId === undefined ? undefined : (typeof request.body.triggerProductId === 'string' ? request.body.triggerProductId.trim() || null : null),
        isActive: typeof request.body?.isActive === 'boolean' ? request.body.isActive : undefined,
      });
      return updated;
    }
  );

  app.delete<{ Params: { id: string } }>('/api/suggestions/bundles/:id', async (request, reply) => {
    const deleted = deleteBundleRule(request.params.id);
    if (!deleted) throw new HttpError(404, 'Bundle rule not found');
    return reply.status(204).send();
  });

  // ── Composition modal rules CRUD ──────────────────────────────────────────
  app.get('/api/suggestions/composition-rules', async () => getAllCompositionRules());

  app.post<{ Body: { triggerCategoryId?: string; triggerCategoryName?: string; bannerTitle?: string; sections?: unknown; isActive?: unknown } }>(
    '/api/suggestions/composition-rules',
    async (request) => {
      const triggerCategoryId = requireString(request.body?.triggerCategoryId, 'triggerCategoryId');
      const triggerCategoryName = requireString(request.body?.triggerCategoryName, 'triggerCategoryName');
      const bannerTitle = typeof request.body?.bannerTitle === 'string' && request.body.bannerTitle.trim()
        ? request.body.bannerTitle.trim()
        : '¿Lo hacemos un menú?';
      const rawSections = request.body?.sections;
      if (!Array.isArray(rawSections)) {
        throw new HttpError(400, 'sections must be an array');
      }
      const sections: CompositionSection[] = rawSections.map((s: unknown) => {
        const sec = s as Record<string, unknown>;
        return {
          categoryId: String(sec.categoryId ?? ''),
          categoryName: String(sec.categoryName ?? ''),
          label: String(sec.label ?? ''),
          maxVisible: typeof sec.maxVisible === 'number' ? sec.maxVisible : 2,
        };
      });
      const isActive = request.body?.isActive !== false;
      return createCompositionRule({ triggerCategoryId, triggerCategoryName, bannerTitle, sections, isActive });
    }
  );

  app.patch<{ Params: { id: string }; Body: { triggerCategoryId?: string; triggerCategoryName?: string; bannerTitle?: string; sections?: unknown; isActive?: unknown } }>(
    '/api/suggestions/composition-rules/:id',
    async (request) => {
      const rule = getCompositionRuleById(request.params.id);
      if (!rule) throw new HttpError(404, 'Composition modal rule not found');

      const rawSections = request.body?.sections;
      let sections: CompositionSection[] | undefined;
      if (rawSections !== undefined) {
        if (!Array.isArray(rawSections)) {
          throw new HttpError(400, 'sections must be an array');
        }
        sections = rawSections.map((s: unknown) => {
          const sec = s as Record<string, unknown>;
          return {
            categoryId: String(sec.categoryId ?? ''),
            categoryName: String(sec.categoryName ?? ''),
            label: String(sec.label ?? ''),
            maxVisible: typeof sec.maxVisible === 'number' ? sec.maxVisible : 2,
          };
        });
      }

      const updated = updateCompositionRule(request.params.id, {
        triggerCategoryId: typeof request.body?.triggerCategoryId === 'string' ? request.body.triggerCategoryId.trim() : undefined,
        triggerCategoryName: typeof request.body?.triggerCategoryName === 'string' ? request.body.triggerCategoryName.trim() : undefined,
        bannerTitle: typeof request.body?.bannerTitle === 'string' ? request.body.bannerTitle.trim() || undefined : undefined,
        sections,
        isActive: typeof request.body?.isActive === 'boolean' ? request.body.isActive : undefined,
      });
      return updated;
    }
  );

  app.delete<{ Params: { id: string } }>('/api/suggestions/composition-rules/:id', async (request, reply) => {
    const deleted = deleteCompositionRule(request.params.id);
    if (!deleted) throw new HttpError(404, 'Composition modal rule not found');
    return reply.status(204).send();
  });
}
