import React, { useCallback, useEffect, useState } from 'react';
import type {
  BundleRule,
  CatalogCategoryForSuggestions,
  CatalogProductForSuggestions,
  CompositionRule,
  CompositionSection,
  CrosssellRule,
  LastminuteItem,
  SuggestionStats,
  TimeSlot,
  UpsellRule,
} from '../api';
import {
  createBundleRule,
  createCompositionRule,
  createCrosssellRule,
  createLastminuteItem,
  createUpsellRule,
  deleteBundleRule,
  deleteCompositionRule,
  deleteCrosssellRule,
  deleteLastminuteItem,
  deleteUpsellRule,
  getCatalogForSuggestions,
  getCompositionRules,
  getSuggestionStats,
  listBundleRules,
  listCrosssellRules,
  listLastminuteItems,
  listUpsellRules,
  updateBundleRule,
  updateCompositionRule,
  updateCrosssellRule,
  updateLastminuteItem,
  updateUpsellRule,
} from '../api';

type Section = 'upsell' | 'crosssell' | 'lastminute' | 'bundles' | 'composition' | 'stats';

const TIME_SLOT_LABELS: Record<TimeSlot, string> = {
  all: 'Siempre',
  breakfast: 'Desayuno (7-11h)',
  lunch: 'Comida (11-16h)',
  snack: 'Merienda (16-20h)',
  dinner: 'Cena (20-24h)',
};

const ALL_SLOTS: TimeSlot[] = ['all', 'breakfast', 'lunch', 'snack', 'dinner'];

function LayoutGridIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

const NAV_ITEMS: Array<{ id: Section; label: string; icon?: React.ReactNode }> = [
  { id: 'upsell', label: 'Upsell' },
  { id: 'crosssell', label: 'Cross-sell' },
  { id: 'lastminute', label: 'Last minute' },
  { id: 'bundles', label: 'Bundles' },
  { id: 'composition', label: 'Modal Menú', icon: <LayoutGridIcon /> },
  { id: 'stats', label: 'Estadísticas' },
];

// ── Shared style for "editing" form state ─────────────────────────────────────

const EDITING_FORM_STYLE: React.CSSProperties = {
  borderLeft: '3px solid var(--color-primary, #2563eb)',
  paddingLeft: 14,
};

function FormTitle({ editingId }: { editingId: string | null }) {
  return (
    <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: editingId ? 'var(--color-primary, #2563eb)' : 'inherit' }}>
      {editingId ? 'Editando regla' : 'Nueva regla'}
    </p>
  );
}

function ActionButtons({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <button
        className="btn btn-secondary"
        style={{ padding: '4px 10px', fontSize: 12 }}
        onClick={onEdit}
      >
        Editar
      </button>
      <button
        className="btn btn-secondary"
        style={{ padding: '4px 10px', fontSize: 12 }}
        onClick={onDelete}
      >
        Eliminar
      </button>
    </div>
  );
}

// ── Product selector (grouped by category) ───────────────────────────────────

function ProductSelect({
  products,
  value,
  onChange,
  placeholder = 'Seleccionar producto…',
}: {
  products: CatalogProductForSuggestions[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const grouped = products.reduce<Map<string, CatalogProductForSuggestions[]>>((acc, p) => {
    const key = p.categoryName || 'Sin categoría';
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key)!.push(p);
    return acc;
  }, new Map());

  return (
    <select
      className="suggestions-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {Array.from(grouped.entries()).map(([cat, items]) => (
        <optgroup key={cat} label={cat}>
          {items.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SuggestionsTab() {
  const [section, setSection] = useState<Section>('upsell');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [products, setProducts] = useState<CatalogProductForSuggestions[]>([]);
  const [categories, setCategories] = useState<CatalogCategoryForSuggestions[]>([]);
  const [upsellRules, setUpsellRules] = useState<UpsellRule[]>([]);
  const [crosssellRules, setCrosssellRules] = useState<CrosssellRule[]>([]);
  const [lastminuteItems, setLastminuteItems] = useState<LastminuteItem[]>([]);
  const [bundleRules, setBundleRules] = useState<BundleRule[]>([]);
  const [compositionRules, setCompositionRules] = useState<CompositionRule[]>([]);
  const [stats, setStats] = useState<SuggestionStats | null>(null);

  const findProduct = useCallback(
    (id: string) => products.find((p) => p.id === id)?.name ?? id,
    [products]
  );

  const findCategory = useCallback(
    (id: string) => categories.find((c) => c.id === id)?.name ?? id,
    [categories]
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [catalog, upsell, crosssell, lastminute, bundles, composition, statsData] = await Promise.all([
        getCatalogForSuggestions(),
        listUpsellRules(),
        listCrosssellRules(),
        listLastminuteItems(),
        listBundleRules(),
        getCompositionRules(),
        getSuggestionStats(),
      ]);
      setProducts(catalog.products);
      setCategories(catalog.categories);
      setUpsellRules(upsell);
      setCrosssellRules(crosssell);
      setLastminuteItems(lastminute);
      setBundleRules(bundles);
      setCompositionRules(composition);
      setStats(statsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando sugerencias');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  if (loading) {
    return (
      <div className="tab-content">
        <div className="fullpage-center">
          <div className="spinner" />
          <p className="hint">Cargando catálogo…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tab-content">
        <div className="fullpage-center">
          <p className="error-big-icon">!</p>
          <h2>Error al cargar</h2>
          <p className="hint">{error}</p>
          <button className="btn btn-primary" onClick={() => void loadAll()}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-content">
      <div className="page-header">
        <h1>Sugerencias inteligentes</h1>
      </div>

      <div className="suggestions-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`suggestions-nav-btn${section === item.id ? ' active' : ''}`}
            onClick={() => setSection(item.id)}
            style={item.icon ? { display: 'inline-flex', alignItems: 'center', gap: 8 } : undefined}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {section === 'stats' && (
        <StatsSection stats={stats} findProduct={findProduct} />
      )}
      {section === 'upsell' && (
        <UpsellSection
          products={products}
          rules={upsellRules}
          setRules={setUpsellRules}
          findProduct={findProduct}
        />
      )}
      {section === 'crosssell' && (
        <CrosssellSection
          products={products}
          categories={categories}
          rules={crosssellRules}
          setRules={setCrosssellRules}
          findProduct={findProduct}
          findCategory={findCategory}
        />
      )}
      {section === 'lastminute' && (
        <LastminuteSection
          products={products}
          items={lastminuteItems}
          setItems={setLastminuteItems}
          findProduct={findProduct}
        />
      )}
      {section === 'bundles' && (
        <BundlesSection
          products={products}
          rules={bundleRules}
          setRules={setBundleRules}
          findProduct={findProduct}
        />
      )}
      {section === 'composition' && (
        <CompositionRulesSection
          categories={categories}
          rules={compositionRules}
          setRules={setCompositionRules}
          findCategory={findCategory}
        />
      )}
    </div>
  );
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function rateClass(rate: number) {
  if (rate >= 30) return 'badge-green';
  if (rate >= 10) return 'badge-amber';
  return 'badge-red';
}

function StatsSection({
  stats,
  findProduct,
}: {
  stats: SuggestionStats | null;
  findProduct: (id: string) => string;
}) {
  if (!stats) return <p className="hint">Sin datos aún.</p>;

  const engines = ['upsell', 'crosssell', 'lastminute', 'bundle'] as const;
  const engineLabels: Record<string, string> = {
    upsell: 'Upsell',
    crosssell: 'Cross-sell',
    lastminute: 'Last minute',
    bundle: 'Bundles',
  };

  return (
    <div>
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: 24 }}>
        {engines.map((eng) => {
          const d = stats.byEngine[eng];
          return (
            <div key={eng} className="kpi-card">
              <div className="kpi-label">{engineLabels[eng]}</div>
              <div className="kpi-value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {d.rate}%
                <span className={`badge ${rateClass(d.rate)}`} style={{ fontSize: 11 }}>
                  {d.rate >= 30 ? 'Buena' : d.rate >= 10 ? 'Media' : 'Baja'}
                </span>
              </div>
              <div className="kpi-sub">{d.accepted} aceptadas / {d.shown} mostradas</div>
              <div className="stat-rate-bar">
                <div className="stat-rate-fill" style={{ width: `${Math.min(d.rate, 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <section className="card">
          <div className="card-header"><h2>Top aceptadas</h2></div>
          <table className="suggestions-table">
            <thead>
              <tr><th>Producto</th><th>Aceptaciones</th></tr>
            </thead>
            <tbody>
              {stats.topAccepted.length === 0 ? (
                <tr><td colSpan={2} className="hint" style={{ padding: 12 }}>Sin datos</td></tr>
              ) : (
                stats.topAccepted.map((r) => (
                  <tr key={r.productId}>
                    <td>{findProduct(r.productId)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{r.count}</span>
                        <div className="stat-rate-bar" style={{ flex: 1 }}>
                          <div
                            className="stat-rate-fill"
                            style={{ width: `${Math.min((r.count / (stats.topAccepted[0]?.count || 1)) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="card">
          <div className="card-header"><h2>Top ignoradas</h2></div>
          <table className="suggestions-table">
            <thead>
              <tr><th>Producto</th><th>Ignoradas</th></tr>
            </thead>
            <tbody>
              {stats.topIgnored.length === 0 ? (
                <tr><td colSpan={2} className="hint" style={{ padding: 12 }}>Sin datos</td></tr>
              ) : (
                stats.topIgnored.map((r) => (
                  <tr key={r.productId}>
                    <td>{findProduct(r.productId)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{r.count}</span>
                        <div className="stat-rate-bar" style={{ flex: 1 }}>
                          <div
                            className="stat-rate-fill"
                            style={{ width: `${Math.min((r.count / (stats.topIgnored[0]?.count || 1)) * 100, 100)}%`, background: 'var(--color-text-muted)' }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

// ── Upsell ────────────────────────────────────────────────────────────────────

const UPSELL_DEFAULTS = { triggerProductId: '', suggestProductId: '', timeSlot: 'all' as TimeSlot, priority: 0 };

function UpsellSection({
  products,
  rules,
  setRules,
  findProduct,
}: {
  products: CatalogProductForSuggestions[];
  rules: UpsellRule[];
  setRules: React.Dispatch<React.SetStateAction<UpsellRule[]>>;
  findProduct: (id: string) => string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(UPSELL_DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  function handleCancel() {
    setShowForm(false);
    setEditingId(null);
    setForm(UPSELL_DEFAULTS);
    setFormError('');
  }

  function handleEdit(rule: UpsellRule) {
    setEditingId(rule.id);
    setForm({ triggerProductId: rule.triggerProductId, suggestProductId: rule.suggestProductId, timeSlot: rule.timeSlot, priority: rule.priority });
    setShowForm(true);
    setFormError('');
    setDeleteError('');
  }

  async function handleSave() {
    if (!form.triggerProductId || !form.suggestProductId) {
      setFormError('Selecciona ambos productos.');
      return;
    }
    if (form.triggerProductId === form.suggestProductId) {
      setFormError('El producto activador y el sugerido deben ser distintos.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editingId) {
        const updated = await updateUpsellRule(editingId, form);
        setRules((prev) => prev.map((r) => (r.id === editingId ? updated : r)));
      } else {
        const created = await createUpsellRule({ ...form, isActive: true });
        setRules((prev) => [...prev, created]);
      }
      handleCancel();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(rule: UpsellRule) {
    const updated = await updateUpsellRule(rule.id, { isActive: !rule.isActive });
    setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta regla?')) return;
    setDeleteError('');
    try {
      await deleteUpsellRule(id);
      const fresh = await listUpsellRules();
      setRules(fresh);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>Reglas Upsell</h2>
        <button
          className="btn btn-primary"
          onClick={() => {
            if (showForm) {
              handleCancel();
            } else {
              setEditingId(null);
              setForm(UPSELL_DEFAULTS);
              setShowForm(true);
              setFormError('');
              setDeleteError('');
            }
          }}
        >
          {showForm ? 'Cancelar' : 'Nueva regla'}
        </button>
      </div>

      {showForm && (
        <div className="suggestions-form" style={editingId ? EDITING_FORM_STYLE : undefined}>
          <FormTitle editingId={editingId} />
          <div className="suggestions-form-row">
            <div>
              <label className="setup-label">Cuando añadan:</label>
              <ProductSelect
                products={products}
                value={form.triggerProductId}
                onChange={(v) => setForm((f) => ({ ...f, triggerProductId: v }))}
              />
            </div>
            <div>
              <label className="setup-label">Sugerir:</label>
              <ProductSelect
                products={products}
                value={form.suggestProductId}
                onChange={(v) => setForm((f) => ({ ...f, suggestProductId: v }))}
              />
            </div>
          </div>
          <div className="suggestions-form-row">
            <div>
              <label className="setup-label">Franja horaria:</label>
              <select
                className="suggestions-select"
                value={form.timeSlot}
                onChange={(e) => setForm((f) => ({ ...f, timeSlot: e.target.value as TimeSlot }))}
              >
                {ALL_SLOTS.map((s) => <option key={s} value={s}>{TIME_SLOT_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="setup-label">Prioridad:</label>
              <input
                type="number"
                className="suggestions-input"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
              />
            </div>
          </div>
          {formError && <p className="msg msg-error">{formError}</p>}
          <div className="suggestions-form-actions">
            <button className="btn btn-primary" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Guardando…' : editingId ? 'Actualizar' : 'Guardar'}
            </button>
            <button className="btn btn-secondary" onClick={handleCancel}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {deleteError && <p className="msg msg-error" style={{ margin: '8px 0' }}>{deleteError}</p>}

      <table className="suggestions-table">
        <thead>
          <tr>
            <th>Cuando añadan</th>
            <th>Sugerir</th>
            <th>Franja</th>
            <th>Prioridad</th>
            <th>Activa</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rules.length === 0 ? (
            <tr><td colSpan={6} style={{ padding: 16, color: 'var(--color-text-muted)', textAlign: 'center' }}>Sin reglas aún</td></tr>
          ) : (
            rules.map((rule) => (
              <tr key={rule.id}>
                <td>{findProduct(rule.triggerProductId)}</td>
                <td>{findProduct(rule.suggestProductId)}</td>
                <td>{TIME_SLOT_LABELS[rule.timeSlot]}</td>
                <td>{rule.priority}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={rule.isActive}
                    onChange={() => void handleToggle(rule)}
                  />
                </td>
                <td>
                  <ActionButtons
                    onEdit={() => handleEdit(rule)}
                    onDelete={() => void handleDelete(rule.id)}
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

// ── Cross-sell ────────────────────────────────────────────────────────────────

const CROSSSELL_DEFAULTS = {
  ifHasCategoryId: '',
  ifMissingCategoryId: '',
  suggestProductId: '',
  timeSlot: 'all' as TimeSlot,
  priority: 0,
};

function CrosssellSection({
  products,
  categories,
  rules,
  setRules,
  findProduct,
  findCategory,
}: {
  products: CatalogProductForSuggestions[];
  categories: CatalogCategoryForSuggestions[];
  rules: CrosssellRule[];
  setRules: React.Dispatch<React.SetStateAction<CrosssellRule[]>>;
  findProduct: (id: string) => string;
  findCategory: (id: string) => string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(CROSSSELL_DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  function handleCancel() {
    setShowForm(false);
    setEditingId(null);
    setForm(CROSSSELL_DEFAULTS);
    setFormError('');
  }

  function handleEdit(rule: CrosssellRule) {
    setEditingId(rule.id);
    setForm({
      ifHasCategoryId: rule.ifHasCategoryId,
      ifMissingCategoryId: rule.ifMissingCategoryId,
      suggestProductId: rule.suggestProductId,
      timeSlot: rule.timeSlot,
      priority: rule.priority,
    });
    setShowForm(true);
    setFormError('');
    setDeleteError('');
  }

  async function handleSave() {
    if (!form.ifHasCategoryId || !form.ifMissingCategoryId || !form.suggestProductId) {
      setFormError('Completa todos los campos.');
      return;
    }
    if (form.ifHasCategoryId === form.ifMissingCategoryId) {
      setFormError('Las categorías "tiene" y "le falta" deben ser distintas.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editingId) {
        const updated = await updateCrosssellRule(editingId, form);
        setRules((prev) => prev.map((r) => (r.id === editingId ? updated : r)));
      } else {
        const created = await createCrosssellRule({ ...form, isActive: true });
        setRules((prev) => [...prev, created]);
      }
      handleCancel();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(rule: CrosssellRule) {
    const updated = await updateCrosssellRule(rule.id, { isActive: !rule.isActive });
    setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta regla?')) return;
    setDeleteError('');
    try {
      await deleteCrosssellRule(id);
      const fresh = await listCrosssellRules();
      setRules(fresh);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>Reglas Cross-sell</h2>
        <button
          className="btn btn-primary"
          onClick={() => {
            if (showForm) {
              handleCancel();
            } else {
              setEditingId(null);
              setForm(CROSSSELL_DEFAULTS);
              setShowForm(true);
              setFormError('');
              setDeleteError('');
            }
          }}
        >
          {showForm ? 'Cancelar' : 'Nueva regla'}
        </button>
      </div>

      {showForm && (
        <div className="suggestions-form" style={editingId ? EDITING_FORM_STYLE : undefined}>
          <FormTitle editingId={editingId} />
          <div className="suggestions-form-row">
            <div>
              <label className="setup-label">Si el carrito tiene categoría:</label>
              <select
                className="suggestions-select"
                value={form.ifHasCategoryId}
                onChange={(e) => setForm((f) => ({ ...f, ifHasCategoryId: e.target.value }))}
              >
                <option value="">Seleccionar categoría…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="setup-label">Y le falta categoría:</label>
              <select
                className="suggestions-select"
                value={form.ifMissingCategoryId}
                onChange={(e) => setForm((f) => ({ ...f, ifMissingCategoryId: e.target.value }))}
              >
                <option value="">Seleccionar categoría…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="suggestions-form-row">
            <div>
              <label className="setup-label">Sugerir este producto:</label>
              <ProductSelect
                products={products}
                value={form.suggestProductId}
                onChange={(v) => setForm((f) => ({ ...f, suggestProductId: v }))}
              />
            </div>
            <div>
              <label className="setup-label">Franja horaria:</label>
              <select
                className="suggestions-select"
                value={form.timeSlot}
                onChange={(e) => setForm((f) => ({ ...f, timeSlot: e.target.value as TimeSlot }))}
              >
                {ALL_SLOTS.map((s) => <option key={s} value={s}>{TIME_SLOT_LABELS[s]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="setup-label">Prioridad:</label>
            <input
              type="number"
              className="suggestions-input"
              style={{ maxWidth: 120 }}
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
            />
          </div>
          {formError && <p className="msg msg-error">{formError}</p>}
          <div className="suggestions-form-actions">
            <button className="btn btn-primary" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Guardando…' : editingId ? 'Actualizar' : 'Guardar'}
            </button>
            <button className="btn btn-secondary" onClick={handleCancel}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {deleteError && <p className="msg msg-error" style={{ margin: '8px 0' }}>{deleteError}</p>}

      <table className="suggestions-table">
        <thead>
          <tr>
            <th>Si tiene</th>
            <th>Le falta</th>
            <th>Sugerir</th>
            <th>Franja</th>
            <th>Activa</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rules.length === 0 ? (
            <tr><td colSpan={6} style={{ padding: 16, color: 'var(--color-text-muted)', textAlign: 'center' }}>Sin reglas aún</td></tr>
          ) : (
            rules.map((rule) => (
              <tr key={rule.id}>
                <td>{findCategory(rule.ifHasCategoryId)}</td>
                <td>{findCategory(rule.ifMissingCategoryId)}</td>
                <td>{findProduct(rule.suggestProductId)}</td>
                <td>{TIME_SLOT_LABELS[rule.timeSlot]}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={rule.isActive}
                    onChange={() => void handleToggle(rule)}
                  />
                </td>
                <td>
                  <ActionButtons
                    onEdit={() => handleEdit(rule)}
                    onDelete={() => void handleDelete(rule.id)}
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

// ── Last minute ───────────────────────────────────────────────────────────────

function LastminuteSection({
  products,
  items,
  setItems,
  findProduct,
}: {
  products: CatalogProductForSuggestions[];
  items: LastminuteItem[];
  setItems: React.Dispatch<React.SetStateAction<LastminuteItem[]>>;
  findProduct: (id: string) => string;
}) {
  const [addingSlot, setAddingSlot] = useState<TimeSlot | null>(null);
  const [addProductId, setAddProductId] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  async function handleAdd(slot: TimeSlot) {
    if (!addProductId) { setFormError('Selecciona un producto.'); return; }
    const slotItems = items.filter((i) => i.timeSlot === slot);
    if (slotItems.length >= 3) { setFormError('Máximo 3 productos por franja.'); return; }
    setSaving(true);
    setFormError('');
    try {
      const created = await createLastminuteItem({
        productId: addProductId,
        timeSlot: slot,
        position: slotItems.length,
        isActive: true,
      });
      setItems((prev) => [...prev, created]);
      setAddingSlot(null);
      setAddProductId('');
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(item: LastminuteItem) {
    const updated = await updateLastminuteItem(item.id, { isActive: !item.isActive });
    setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este producto?')) return;
    setDeleteError('');
    try {
      await deleteLastminuteItem(id);
      const fresh = await listLastminuteItems();
      setItems(fresh);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>Productos Last Minute</h2>
      </div>
      <p className="hint" style={{ marginBottom: 16 }}>
        Máximo 3 productos por franja. Se muestran justo antes de pagar.
      </p>

      {deleteError && <p className="msg msg-error" style={{ marginBottom: 12 }}>{deleteError}</p>}

      {ALL_SLOTS.map((slot) => {
        const slotItems = items
          .filter((i) => i.timeSlot === slot)
          .sort((a, b) => a.position - b.position);
        const isAdding = addingSlot === slot;

        return (
          <div key={slot} className="lastminute-slot-section">
            <div className="lastminute-slot-title">{TIME_SLOT_LABELS[slot]}</div>

            {slotItems.map((item, idx) => {
              const prod = products.find((p) => p.id === item.productId);
              return (
                <div key={item.id} className="lastminute-item-row">
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 12, minWidth: 16 }}>
                    {idx + 1}
                  </span>
                  {prod?.imageUrl ? (
                    <img className="lastminute-item-img" src={prod.imageUrl} alt={prod.name} />
                  ) : (
                    <div className="lastminute-item-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                      🍽
                    </div>
                  )}
                  <span style={{ flex: 1, fontSize: 13 }}>{findProduct(item.productId)}</span>
                  <input
                    type="checkbox"
                    checked={item.isActive}
                    title="Activo"
                    onChange={() => void handleToggle(item)}
                  />
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: 12 }}
                    onClick={() => void handleDelete(item.id)}
                  >
                    Eliminar
                  </button>
                </div>
              );
            })}

            {slotItems.length < 3 && !isAdding && (
              <button
                className="btn btn-secondary"
                style={{ marginTop: 8, fontSize: 13 }}
                onClick={() => { setAddingSlot(slot); setAddProductId(''); setFormError(''); }}
              >
                + Añadir producto
              </button>
            )}

            {isAdding && (
              <div className="suggestions-form" style={{ marginTop: 8 }}>
                <ProductSelect
                  products={products}
                  value={addProductId}
                  onChange={setAddProductId}
                />
                {formError && <p className="msg msg-error">{formError}</p>}
                <div className="suggestions-form-actions">
                  <button className="btn btn-primary" onClick={() => void handleAdd(slot)} disabled={saving}>
                    {saving ? 'Guardando…' : 'Añadir'}
                  </button>
                  <button className="btn btn-secondary" onClick={() => { setAddingSlot(null); setFormError(''); }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

// ── Bundles ───────────────────────────────────────────────────────────────────

const BUNDLE_DEFAULTS = {
  name: '',
  triggerProductId: '',
  productIds: [] as string[],
  bundlePrice: '',
};

function BundlesSection({
  products,
  rules,
  setRules,
  findProduct,
}: {
  products: CatalogProductForSuggestions[];
  rules: BundleRule[];
  setRules: React.Dispatch<React.SetStateAction<BundleRule[]>>;
  findProduct: (id: string) => string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(BUNDLE_DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  function handleCancel() {
    setShowForm(false);
    setEditingId(null);
    setForm(BUNDLE_DEFAULTS);
    setFormError('');
  }

  function handleEdit(rule: BundleRule) {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      triggerProductId: rule.triggerProductId ?? '',
      productIds: [...rule.productIds],
      bundlePrice: rule.bundlePrice != null ? String(rule.bundlePrice) : '',
    });
    setShowForm(true);
    setFormError('');
    setDeleteError('');
  }

  function toggleProductId(id: string) {
    setForm((f) => ({
      ...f,
      productIds: f.productIds.includes(id)
        ? f.productIds.filter((p) => p !== id)
        : f.productIds.length < 5
          ? [...f.productIds, id]
          : f.productIds,
    }));
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError('El nombre es obligatorio.'); return; }
    if (!form.triggerProductId) { setFormError('Selecciona un producto activador.'); return; }
    if (form.productIds.length < 2) { setFormError('Selecciona al menos 2 productos para el bundle.'); return; }
    setSaving(true);
    setFormError('');
    try {
      const bundlePrice = form.bundlePrice.trim() ? Number(form.bundlePrice) : null;
      if (editingId) {
        const updated = await updateBundleRule(editingId, {
          name: form.name.trim(),
          triggerProductId: form.triggerProductId,
          productIds: form.productIds,
          bundlePrice,
        });
        setRules((prev) => prev.map((r) => (r.id === editingId ? updated : r)));
      } else {
        const created = await createBundleRule({
          name: form.name.trim(),
          triggerProductId: form.triggerProductId,
          productIds: form.productIds,
          bundlePrice,
          isActive: true,
        });
        setRules((prev) => [...prev, created]);
      }
      handleCancel();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(rule: BundleRule) {
    const updated = await updateBundleRule(rule.id, { isActive: !rule.isActive });
    setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este bundle?')) return;
    setDeleteError('');
    try {
      await deleteBundleRule(id);
      const fresh = await listBundleRules();
      setRules(fresh);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>Bundles</h2>
        <button
          className="btn btn-primary"
          onClick={() => {
            if (showForm) {
              handleCancel();
            } else {
              setEditingId(null);
              setForm(BUNDLE_DEFAULTS);
              setShowForm(true);
              setFormError('');
              setDeleteError('');
            }
          }}
        >
          {showForm ? 'Cancelar' : 'Nuevo bundle'}
        </button>
      </div>

      {showForm && (
        <div className="suggestions-form" style={editingId ? EDITING_FORM_STYLE : undefined}>
          <FormTitle editingId={editingId} />
          <div className="suggestions-form-row">
            <div>
              <label className="setup-label">Nombre del menú:</label>
              <input
                type="text"
                className="suggestions-input"
                placeholder="Ej: Menú Completo"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="setup-label">Producto que activa el bundle:</label>
              <ProductSelect
                products={products}
                value={form.triggerProductId}
                onChange={(v) => setForm((f) => ({ ...f, triggerProductId: v }))}
              />
            </div>
          </div>

          <div>
            <label className="setup-label">
              Productos del bundle (mín. 2, máx. 5 — {form.productIds.length} seleccionados):
            </label>
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 6, padding: 8 }}>
              {products.map((p) => (
                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={form.productIds.includes(p.id)}
                    onChange={() => toggleProductId(p.id)}
                    disabled={!form.productIds.includes(p.id) && form.productIds.length >= 5}
                  />
                  <span>{p.name}</span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{p.categoryName}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="setup-label">Precio especial (€) — opcional:</label>
            <input
              type="number"
              className="suggestions-input"
              style={{ maxWidth: 150 }}
              placeholder="Dejar vacío = precio individual"
              value={form.bundlePrice}
              onChange={(e) => setForm((f) => ({ ...f, bundlePrice: e.target.value }))}
            />
          </div>

          {formError && <p className="msg msg-error">{formError}</p>}
          <div className="suggestions-form-actions">
            <button className="btn btn-primary" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Guardando…' : editingId ? 'Actualizar' : 'Guardar'}
            </button>
            <button className="btn btn-secondary" onClick={handleCancel}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {deleteError && <p className="msg msg-error" style={{ margin: '8px 0' }}>{deleteError}</p>}

      <table className="suggestions-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Productos</th>
            <th>Precio</th>
            <th>Activado por</th>
            <th>Activa</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rules.length === 0 ? (
            <tr><td colSpan={6} style={{ padding: 16, color: 'var(--color-text-muted)', textAlign: 'center' }}>Sin bundles aún</td></tr>
          ) : (
            rules.map((rule) => (
              <tr key={rule.id}>
                <td style={{ fontWeight: 500 }}>{rule.name}</td>
                <td style={{ fontSize: 12, maxWidth: 200 }}>
                  {rule.productIds.map((id) => findProduct(id)).join(', ')}
                </td>
                <td>{rule.bundlePrice != null ? `${rule.bundlePrice.toFixed(2)} €` : '—'}</td>
                <td>{rule.triggerProductId ? findProduct(rule.triggerProductId) : '—'}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={rule.isActive}
                    onChange={() => void handleToggle(rule)}
                  />
                </td>
                <td>
                  <ActionButtons
                    onEdit={() => handleEdit(rule)}
                    onDelete={() => void handleDelete(rule.id)}
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

// ── Composition modal rules ───────────────────────────────────────────────────

const COMPOSITION_SECTION_DEFAULT: CompositionSection = {
  categoryId: '',
  categoryName: '',
  label: '',
  maxVisible: 2,
};

function CompositionRulesSection({
  categories,
  rules,
  setRules,
  findCategory,
}: {
  categories: CatalogCategoryForSuggestions[];
  rules: CompositionRule[];
  setRules: React.Dispatch<React.SetStateAction<CompositionRule[]>>;
  findCategory: (id: string) => string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [triggerCategoryId, setTriggerCategoryId] = useState('');
  const [bannerTitle, setBannerTitle] = useState('¿Lo hacemos un menú?');
  const [sections, setSections] = useState<CompositionSection[]>([{ ...COMPOSITION_SECTION_DEFAULT }]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  function resetForm() {
    setEditingId(null);
    setTriggerCategoryId('');
    setBannerTitle('¿Lo hacemos un menú?');
    setSections([{ ...COMPOSITION_SECTION_DEFAULT }]);
    setFormError('');
  }

  function handleCancel() {
    setShowForm(false);
    resetForm();
  }

  function handleEdit(rule: CompositionRule) {
    setEditingId(rule.id);
    setTriggerCategoryId(rule.triggerCategoryId);
    setBannerTitle(rule.bannerTitle ?? '¿Lo hacemos un menú?');
    setSections(rule.sections.map((s) => ({ ...s })));
    setShowForm(true);
    setFormError('');
    setDeleteError('');
  }

  function updateSection(index: number, patch: Partial<CompositionSection>) {
    setSections((prev) => prev.map((section, currentIndex) => (
      currentIndex === index ? { ...section, ...patch } : section
    )));
  }

  function addSection() {
    setSections((prev) => (
      prev.length >= 3 ? prev : [...prev, { ...COMPOSITION_SECTION_DEFAULT }]
    ));
  }

  function removeSection(index: number) {
    setSections((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  }

  async function handleSave() {
    if (!triggerCategoryId) {
      setFormError('Selecciona la categoría principal.');
      return;
    }

    const cleanedSections = sections
      .map((section) => ({
        categoryId: section.categoryId,
        categoryName: section.categoryName,
        label: section.label.trim(),
        maxVisible: Math.min(Math.max(Number(section.maxVisible) || 2, 1), 4),
      }))
      .filter((section) => section.categoryId && section.label);

    if (cleanedSections.length === 0) {
      setFormError('Añade al menos una sección válida.');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      if (editingId) {
        const updated = await updateCompositionRule(editingId, {
          triggerCategoryId,
          triggerCategoryName: findCategory(triggerCategoryId),
          bannerTitle: bannerTitle.trim() || '¿Lo hacemos un menú?',
          sections: cleanedSections,
        });
        setRules((prev) => prev.map((r) => (r.id === editingId ? updated : r)));
      } else {
        const created = await createCompositionRule({
          triggerCategoryId,
          triggerCategoryName: findCategory(triggerCategoryId),
          bannerTitle: bannerTitle.trim() || '¿Lo hacemos un menú?',
          sections: cleanedSections,
          isActive: true,
        });
        setRules((prev) => [...prev, created]);
      }
      handleCancel();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(rule: CompositionRule) {
    const updated = await updateCompositionRule(rule.id, { isActive: !rule.isActive });
    setRules((prev) => prev.map((item) => (item.id === rule.id ? updated : item)));
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta regla de modal?')) return;
    setDeleteError('');
    try {
      await deleteCompositionRule(id);
      const fresh = await getCompositionRules();
      setRules(fresh);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>Modal Menú</h2>
        <button
          className="btn btn-primary"
          onClick={() => {
            if (showForm) {
              handleCancel();
            } else {
              resetForm();
              setShowForm(true);
              setDeleteError('');
            }
          }}
        >
          {showForm ? 'Cancelar' : 'Nueva regla'}
        </button>
      </div>

      {showForm && (
        <div className="suggestions-form" style={editingId ? EDITING_FORM_STYLE : undefined}>
          <FormTitle editingId={editingId} />
          <div>
            <label className="setup-label">Título del banner (lo que ve el cliente):</label>
            <input
              type="text"
              className="suggestions-input"
              placeholder="¿Lo hacemos un menú?"
              value={bannerTitle}
              onChange={(e) => setBannerTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="setup-label">Categoría principal (la que dispara el modal):</label>
            <select
              className="suggestions-select"
              value={triggerCategoryId}
              onChange={(event) => setTriggerCategoryId(event.target.value)}
            >
              <option value="">Seleccionar categoría…</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <label className="setup-label">Secciones del modal:</label>
            {sections.map((section, index) => (
              <div key={`${index}-${section.categoryId}`} className="card" style={{ padding: 14 }}>
                <div className="suggestions-form-row">
                  <div>
                    <label className="setup-label">Categoría a mostrar:</label>
                    <select
                      className="suggestions-select"
                      value={section.categoryId}
                      onChange={(event) => {
                        const category = categories.find((item) => item.id === event.target.value);
                        updateSection(index, {
                          categoryId: event.target.value,
                          categoryName: category?.name ?? '',
                        });
                      }}
                    >
                      <option value="">Seleccionar categoría…</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="setup-label">Título de la sección:</label>
                    <input
                      type="text"
                      className="suggestions-input"
                      placeholder="Acompañamientos"
                      value={section.label}
                      onChange={(event) => updateSection(index, { label: event.target.value })}
                    />
                  </div>
                </div>

                <div className="suggestions-form-row">
                  <div>
                    <label className="setup-label">Máx. productos visibles inicialmente:</label>
                    <input
                      type="number"
                      min={1}
                      max={4}
                      className="suggestions-input"
                      value={section.maxVisible}
                      onChange={(event) => updateSection(index, { maxVisible: Number(event.target.value) })}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'end' }}>
                    <button
                      className="btn btn-secondary"
                      disabled={sections.length === 1}
                      onClick={() => removeSection(index)}
                    >
                      Eliminar sección
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {sections.length < 3 && (
              <button className="btn btn-secondary" onClick={addSection}>
                + Añadir sección
              </button>
            )}
          </div>

          {formError && <p className="msg msg-error">{formError}</p>}
          <div className="suggestions-form-actions">
            <button className="btn btn-primary" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Guardando…' : editingId ? 'Actualizar regla' : 'Guardar regla'}
            </button>
            <button className="btn btn-secondary" onClick={handleCancel}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {deleteError && <p className="msg msg-error" style={{ margin: '8px 0' }}>{deleteError}</p>}

      <table className="suggestions-table">
        <thead>
          <tr>
            <th>Categoría principal</th>
            <th>Secciones</th>
            <th>Activa</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rules.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ padding: 16, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                Sin reglas de composición aún
              </td>
            </tr>
          ) : (
            rules.map((rule) => (
              <tr key={rule.id}>
                <td>{findCategory(rule.triggerCategoryId)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {rule.sections.map((section) => (
                      <span key={`${rule.id}-${section.categoryId}-${section.label}`} className="pill pill-gray">
                        {section.label} ({section.maxVisible})
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={rule.isActive}
                    onChange={() => void handleToggle(rule)}
                  />
                </td>
                <td>
                  <ActionButtons
                    onEdit={() => handleEdit(rule)}
                    onDelete={() => void handleDelete(rule.id)}
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
