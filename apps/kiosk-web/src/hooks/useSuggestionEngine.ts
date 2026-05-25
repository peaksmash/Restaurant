import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CatalogProduct, KioskCartItem } from '../api';
import {
  fetchSuggestionsConfig,
  recordSuggestionEvent,
  type BundleSuggestion,
  type CompositionModalData,
  type CompositionSection,
  type CrosssellSuggestion,
  type LastminuteItem,
  type SuggestionOutcome,
  type SuggestionsConfig,
  type SuggestedProduct,
  type UpsellSuggestion,
} from '../suggestions';

export type SuggestionCatalogProduct = CatalogProduct & {
  categoryId?: string;
  categoryName?: string;
};

interface UseSuggestionEngineArgs {
  catalog: SuggestionCatalogProduct[];
  cartItems: KioskCartItem[];
  sessionId: string;
}

interface UseSuggestionEngineResult {
  activeUpsell: UpsellSuggestion | null;
  activeCrosssells: CrosssellSuggestion[];
  lastminuteItems: LastminuteItem[];
  activeBundle: BundleSuggestion | null;
  activeComposition: CompositionModalData | null;
  currentTimeSlot: string;
  triggerUpsell: (productId: string) => void;
  triggerBundle: (productId: string) => void;
  triggerComposition: (productId: string, productCategoryId: string) => boolean;
  acceptUpsell: () => void;
  dismissUpsell: (outcome: 'ignored' | 'rejected') => void;
  acceptCrosssell: (ruleId: string, productId: string) => void;
  dismissCrosssell: (ruleId: string) => void;
  acceptLastminute: (ruleId: string, productId: string) => void;
  acceptBundle: () => void;
  dismissBundle: () => void;
  acceptComposition: (selectedProductIds: string[]) => void;
  dismissComposition: () => void;
  onAddProduct: ((productId: string) => void) | null;
  setOnAddProduct: (fn: (productId: string) => void) => void;
}

function matchesTimeSlot(ruleTimeSlot: string, currentTimeSlot: string) {
  return ruleTimeSlot === 'all' || ruleTimeSlot === currentTimeSlot;
}

function toSuggestedProduct(product: SuggestionCatalogProduct): SuggestedProduct {
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    imageUrl: product.imageUrl,
    categoryId: product.categoryId,
    categoryName: product.categoryName,
  };
}

export function useSuggestionEngine({
  catalog,
  cartItems,
  sessionId,
}: UseSuggestionEngineArgs): UseSuggestionEngineResult {
  const [config, setConfig] = useState<SuggestionsConfig | null>(null);
  const [activeUpsell, setActiveUpsell] = useState<UpsellSuggestion | null>(null);
  const [activeCrosssells, setActiveCrosssells] = useState<CrosssellSuggestion[]>([]);
  const [activeBundle, setActiveBundle] = useState<BundleSuggestion | null>(null);
  const [activeComposition, setActiveComposition] = useState<CompositionModalData | null>(null);
  const [dismissedCrosssells, setDismissedCrosssells] = useState<Set<string>>(new Set());
  const onAddProductRef = useRef<((productId: string) => void) | null>(null);
  const shownRuleIdsRef = useRef<Set<string>>(new Set());

  const catalogById = useMemo(() => {
    const map = new Map<string, SuggestionCatalogProduct>();
    for (const product of catalog) {
      map.set(product.id, product);
    }
    return map;
  }, [catalog]);

  const catalogByCategory = useMemo(() => {
    const map = new Map<string, SuggestionCatalogProduct[]>();
    for (const product of catalog) {
      if (!product.categoryId) {
        continue;
      }
      const items = map.get(product.categoryId) ?? [];
      items.push(product);
      map.set(product.categoryId, items);
    }
    return map;
  }, [catalog]);

  const cartProductIds = useMemo(() => new Set(cartItems.map((item) => item.productId)), [cartItems]);

  const cartCategoryIds = useMemo(() => {
    const result = new Set<string>();
    for (const item of cartItems) {
      const categoryId = catalogById.get(item.productId)?.categoryId;
      if (categoryId) {
        result.add(categoryId);
      }
    }
    return result;
  }, [cartItems, catalogById]);

  const currentTimeSlot = config?.timeSlot ?? 'all';

  const safeRecordEvent = useCallback((event: Parameters<typeof recordSuggestionEvent>[0]) => {
    void recordSuggestionEvent(event).catch(() => {});
  }, []);

  const setOnAddProduct = useCallback((fn: (productId: string) => void) => {
    onAddProductRef.current = fn;
  }, []);

  useEffect(() => {
    shownRuleIdsRef.current = new Set();
    setDismissedCrosssells(new Set());
    setActiveUpsell(null);
    setActiveCrosssells([]);
    setActiveBundle(null);
    setActiveComposition(null);
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      try {
        const next = await fetchSuggestionsConfig();
        if (!cancelled) setConfig(next);
      } catch {
        if (!cancelled) setConfig(null);
      }
    }

    void loadConfig();
    // Refresca cada 2 minutos para que los cambios del admin se reflejen sin recargar
    const interval = window.setInterval(() => { void loadConfig(); }, 2 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const lastminuteItems = useMemo<LastminuteItem[]>(() => {
    if (!config) {
      return [];
    }

    try {
      return config.lastminute
        .filter((item) => item.isActive && matchesTimeSlot(item.timeSlot, currentTimeSlot))
        .sort((a, b) => a.position - b.position)
        .map((item) => {
          const product = catalogById.get(item.productId);
          if (!product || cartProductIds.has(product.id)) {
            return null;
          }
          return {
            ruleId: item.id,
            product: toSuggestedProduct(product),
          };
        })
        .filter((item): item is LastminuteItem => item != null)
        .slice(0, 3);
    } catch {
      return [];
    }
  }, [catalogById, cartProductIds, config, currentTimeSlot]);

  useEffect(() => {
    for (const item of lastminuteItems) {
      if (shownRuleIdsRef.current.has(item.ruleId)) {
        continue;
      }
      shownRuleIdsRef.current.add(item.ruleId);
      safeRecordEvent({
        sessionId,
        engine: 'lastminute',
        ruleId: item.ruleId,
        suggestedProductId: item.product.id,
        outcome: 'shown',
      });
    }
  }, [lastminuteItems, safeRecordEvent, sessionId]);

  const triggerUpsell = useCallback((productId: string) => {
    try {
      if (!config || activeUpsell || activeComposition) {
        return;
      }

      const rule = [...config.upsell]
        .filter((item) =>
          item.isActive &&
          item.triggerProductId === productId &&
          matchesTimeSlot(item.timeSlot, config.timeSlot) &&
          !shownRuleIdsRef.current.has(item.id),
        )
        .sort((a, b) => b.priority - a.priority)[0];

      if (!rule) {
        return;
      }

      const suggestedProduct = catalogById.get(rule.suggestProductId);
      if (!suggestedProduct || cartProductIds.has(suggestedProduct.id)) {
        return;
      }

      const suggestion: UpsellSuggestion = {
        ruleId: rule.id,
        product: toSuggestedProduct(suggestedProduct),
        triggerProductName: catalogById.get(productId)?.name ?? '',
      };

      shownRuleIdsRef.current.add(rule.id);
      setActiveUpsell(suggestion);
      safeRecordEvent({
        sessionId,
        engine: 'upsell',
        ruleId: rule.id,
        suggestedProductId: suggestedProduct.id,
        outcome: 'shown',
      });
    } catch {
      setActiveUpsell(null);
    }
  }, [activeComposition, activeUpsell, catalogById, cartProductIds, config, safeRecordEvent, sessionId]);

  const triggerComposition = useCallback((productId: string, productCategoryId: string) => {
    try {
      if (!config || !productCategoryId) {
        return false;
      }

      const rule = config.compositionRules.find((item) => item.isActive && item.triggerCategoryId === productCategoryId);
      if (!rule) {
        setActiveComposition(null);
        return false;
      }

      const triggerProduct = catalogById.get(productId);
      if (!triggerProduct) {
        setActiveComposition(null);
        return false;
      }

      const sections: CompositionSection[] = rule.sections
        .map((section) => {
          const products = (catalogByCategory.get(section.categoryId) ?? [])
            .filter((product) => product.enabled && product.id !== productId)
            .slice(0, Math.max(section.maxVisible, 1) * 3)
            .map(toSuggestedProduct);

          if (products.length === 0) {
            return null;
          }

          return {
            categoryId: section.categoryId,
            categoryName: section.categoryName,
            label: section.label,
            maxVisible: section.maxVisible,
            products,
          };
        })
        .filter((section): section is CompositionSection => section != null);

      if (sections.length === 0) {
        setActiveComposition(null);
        return false;
      }

      const data: CompositionModalData = {
        ruleId: rule.id,
        bannerTitle: rule.bannerTitle ?? '¿Lo hacemos un menú?',
        triggerProduct: toSuggestedProduct(triggerProduct),
        sections,
        selectedProducts: {},
      };

      shownRuleIdsRef.current.add(rule.id);
      setActiveComposition(data);
      safeRecordEvent({
        sessionId,
        engine: 'composition',
        ruleId: rule.id,
        suggestedProductId: productId,
        outcome: 'shown',
      });
      return true;
    } catch {
      setActiveComposition(null);
      return false;
    }
  }, [catalogByCategory, catalogById, config, safeRecordEvent, sessionId]);

  const acceptUpsell = useCallback(() => {
    try {
      if (!activeUpsell) {
        return;
      }

      safeRecordEvent({
        sessionId,
        engine: 'upsell',
        ruleId: activeUpsell.ruleId,
        suggestedProductId: activeUpsell.product.id,
        outcome: 'accepted',
      });
      onAddProductRef.current?.(activeUpsell.product.id);
      setActiveUpsell(null);
    } catch {
      setActiveUpsell(null);
    }
  }, [activeUpsell, safeRecordEvent, sessionId]);

  const dismissUpsell = useCallback((outcome: SuggestionOutcome) => {
    try {
      if (!activeUpsell) {
        return;
      }

      safeRecordEvent({
        sessionId,
        engine: 'upsell',
        ruleId: activeUpsell.ruleId,
        suggestedProductId: activeUpsell.product.id,
        outcome,
      });
      setActiveUpsell(null);
    } catch {
      setActiveUpsell(null);
    }
  }, [activeUpsell, safeRecordEvent, sessionId]);

  useEffect(() => {
    try {
      if (!config || cartItems.length >= 4) {
        setActiveCrosssells([]);
        return;
      }

      const next = config.crosssell
        .filter((rule) =>
          rule.isActive &&
          matchesTimeSlot(rule.timeSlot, currentTimeSlot) &&
          !dismissedCrosssells.has(rule.id) &&
          cartCategoryIds.has(rule.ifHasCategoryId) &&
          !cartCategoryIds.has(rule.ifMissingCategoryId),
        )
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 2)
        .map((rule) => {
          const product = catalogById.get(rule.suggestProductId);
          if (!product || cartProductIds.has(product.id)) {
            return null;
          }

          const missingCategoryName =
            catalog.find((item) => item.categoryId === rule.ifMissingCategoryId)?.categoryName ??
            'algo más';

          return {
            ruleId: rule.id,
            product: toSuggestedProduct(product),
            reason: `¿Sin ${missingCategoryName}?`,
          } satisfies CrosssellSuggestion;
        })
        .filter((item): item is CrosssellSuggestion => item != null);

      for (const suggestion of next) {
        if (shownRuleIdsRef.current.has(suggestion.ruleId)) {
          continue;
        }
        shownRuleIdsRef.current.add(suggestion.ruleId);
        safeRecordEvent({
          sessionId,
          engine: 'crosssell',
          ruleId: suggestion.ruleId,
          suggestedProductId: suggestion.product.id,
          outcome: 'shown',
        });
      }

      setActiveCrosssells(next);
    } catch {
      setActiveCrosssells([]);
    }
  }, [
    cartCategoryIds,
    cartItems.length,
    cartProductIds,
    catalog,
    catalogById,
    config,
    currentTimeSlot,
    dismissedCrosssells,
    safeRecordEvent,
    sessionId,
  ]);

  const acceptCrosssell = useCallback((ruleId: string, productId: string) => {
    try {
      safeRecordEvent({
        sessionId,
        engine: 'crosssell',
        ruleId,
        suggestedProductId: productId,
        outcome: 'accepted',
      });
      onAddProductRef.current?.(productId);
      setDismissedCrosssells((prev) => new Set(prev).add(ruleId));
    } catch {
      setDismissedCrosssells((prev) => new Set(prev).add(ruleId));
    }
  }, [safeRecordEvent, sessionId]);

  const dismissCrosssell = useCallback((ruleId: string) => {
    try {
      const suggestion = activeCrosssells.find((item) => item.ruleId === ruleId);
      if (suggestion) {
        safeRecordEvent({
          sessionId,
          engine: 'crosssell',
          ruleId,
          suggestedProductId: suggestion.product.id,
          outcome: 'ignored',
        });
      }
      setDismissedCrosssells((prev) => new Set(prev).add(ruleId));
    } catch {
      setDismissedCrosssells((prev) => new Set(prev).add(ruleId));
    }
  }, [activeCrosssells, safeRecordEvent, sessionId]);

  const acceptLastminute = useCallback((ruleId: string, productId: string) => {
    try {
      safeRecordEvent({
        sessionId,
        engine: 'lastminute',
        ruleId,
        suggestedProductId: productId,
        outcome: 'accepted',
      });
      onAddProductRef.current?.(productId);
    } catch {
      return;
    }
  }, [safeRecordEvent, sessionId]);

  const triggerBundle = useCallback((productId: string) => {
    try {
      if (!config) {
        setActiveBundle(null);
        return;
      }

      const rule = config.bundles.find((item) => item.isActive && item.triggerProductId === productId);
      if (!rule) {
        setActiveBundle(null);
        return;
      }

      const products = rule.productIds
        .map((id) => catalogById.get(id))
        .filter((product): product is SuggestionCatalogProduct => product != null);

      if (products.length === 0) {
        setActiveBundle(null);
        return;
      }

      const bundle: BundleSuggestion = {
        ruleId: rule.id,
        name: rule.name,
        products: products.map(toSuggestedProduct),
        bundlePrice: rule.bundlePrice ?? undefined,
        totalIndividual: products.reduce((sum, item) => sum + item.price, 0),
      };

      setActiveBundle(bundle);
      safeRecordEvent({
        sessionId,
        engine: 'bundle',
        ruleId: rule.id,
        suggestedProductId: products[0]?.id ?? productId,
        outcome: 'shown',
      });
    } catch {
      setActiveBundle(null);
    }
  }, [catalogById, config, safeRecordEvent, sessionId]);

  const acceptBundle = useCallback(() => {
    try {
      if (!activeBundle) {
        return;
      }

      safeRecordEvent({
        sessionId,
        engine: 'bundle',
        ruleId: activeBundle.ruleId,
        suggestedProductId: activeBundle.products[0]?.id ?? '',
        outcome: 'accepted',
      });
      for (const product of activeBundle.products) {
        onAddProductRef.current?.(product.id);
      }
      setActiveBundle(null);
    } catch {
      setActiveBundle(null);
    }
  }, [activeBundle, safeRecordEvent, sessionId]);

  const dismissBundle = useCallback(() => {
    try {
      if (!activeBundle) {
        return;
      }

      safeRecordEvent({
        sessionId,
        engine: 'bundle',
        ruleId: activeBundle.ruleId,
        suggestedProductId: activeBundle.products[0]?.id ?? '',
        outcome: 'ignored',
      });
      setActiveBundle(null);
    } catch {
      setActiveBundle(null);
    }
  }, [activeBundle, safeRecordEvent, sessionId]);

  const acceptComposition = useCallback((selectedProductIds: string[]) => {
    try {
      if (!activeComposition) {
        return;
      }

      for (const productId of selectedProductIds) {
        onAddProductRef.current?.(productId);
      }

      safeRecordEvent({
        sessionId,
        engine: 'composition',
        ruleId: activeComposition.ruleId,
        suggestedProductId: selectedProductIds[0] ?? activeComposition.triggerProduct.id,
        outcome: 'accepted',
      });
      setActiveComposition(null);
    } catch {
      setActiveComposition(null);
    }
  }, [activeComposition, safeRecordEvent, sessionId]);

  const dismissComposition = useCallback(() => {
    try {
      if (!activeComposition) {
        return;
      }

      safeRecordEvent({
        sessionId,
        engine: 'composition',
        ruleId: activeComposition.ruleId,
        suggestedProductId: activeComposition.triggerProduct.id,
        outcome: 'ignored',
      });
      setActiveComposition(null);
    } catch {
      setActiveComposition(null);
    }
  }, [activeComposition, safeRecordEvent, sessionId]);

  return {
    activeUpsell,
    activeCrosssells,
    lastminuteItems,
    activeBundle,
    activeComposition,
    currentTimeSlot,
    triggerUpsell,
    triggerBundle,
    triggerComposition,
    acceptUpsell,
    dismissUpsell,
    acceptCrosssell,
    dismissCrosssell,
    acceptLastminute,
    acceptBundle,
    dismissBundle,
    acceptComposition,
    dismissComposition,
    onAddProduct: onAddProductRef.current,
    setOnAddProduct,
  };
}
