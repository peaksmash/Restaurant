export interface SuggestedProduct {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  categoryId?: string;
  categoryName?: string;
}

export interface UpsellSuggestion {
  ruleId: string;
  product: SuggestedProduct;
  triggerProductName: string;
  priceDiff?: number;
}

export interface CrosssellSuggestion {
  ruleId: string;
  product: SuggestedProduct;
  reason: string;
}

export interface LastminuteItem {
  ruleId: string;
  product: SuggestedProduct;
}

export interface BundleSuggestion {
  ruleId: string;
  name: string;
  products: SuggestedProduct[];
  bundlePrice?: number;
  totalIndividual: number;
}

export type SuggestionOutcome = 'accepted' | 'ignored' | 'rejected';

function resolveApiBase() {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  return '';
}

const API = resolveApiBase();

export interface BackendUpsellRule {
  id: string;
  triggerProductId: string;
  suggestProductId: string;
  timeSlot: string;
  priority: number;
  isActive: boolean;
}

export interface BackendCrosssellRule {
  id: string;
  ifHasCategoryId: string;
  ifMissingCategoryId: string;
  suggestProductId: string;
  timeSlot: string;
  priority: number;
  isActive: boolean;
}

export interface BackendLastminuteItem {
  id: string;
  productId: string;
  timeSlot: string;
  position: number;
  isActive: boolean;
}

export interface BackendBundleRule {
  id: string;
  name: string;
  productIds: string[];
  bundlePrice: number | null;
  triggerProductId: string | null;
  isActive: boolean;
}

export interface CompositionSection {
  categoryId: string;
  categoryName: string;
  label: string;
  maxVisible: number;
  products: SuggestedProduct[];
}

export interface CompositionModalData {
  ruleId: string;
  bannerTitle: string;
  triggerProduct: SuggestedProduct;
  sections: CompositionSection[];
  selectedProducts: Record<string, string | null>;
}

export interface BackendCompositionRule {
  id: string;
  triggerCategoryId: string;
  triggerCategoryName: string;
  bannerTitle?: string;
  sections: CompositionSection[];
  isActive: boolean;
}

// Field names match exactly what GET /api/suggestions returns
export interface SuggestionsConfig {
  upsell: BackendUpsellRule[];
  crosssell: BackendCrosssellRule[];
  lastminute: BackendLastminuteItem[];
  bundles: BackendBundleRule[];
  compositionRules: BackendCompositionRule[];
  timeSlot: string;
}

export async function fetchSuggestionsConfig(): Promise<SuggestionsConfig> {
  const res = await fetch(`${API}/api/suggestions`);
  if (!res.ok) throw new Error('Failed to fetch suggestions');
  return res.json();
}

export async function recordSuggestionEvent(event: {
  sessionId: string;
  engine: 'upsell' | 'crosssell' | 'lastminute' | 'bundle' | 'composition';
  ruleId: string;
  suggestedProductId: string;
  outcome: 'shown' | 'accepted' | 'ignored' | 'rejected';
}): Promise<void> {
  await fetch(`${API}/api/suggestions/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  }).catch(() => {});
}
