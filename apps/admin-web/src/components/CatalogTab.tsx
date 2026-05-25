import React, { useState } from 'react';
import type { CatalogDiagnostics, CatalogResult } from '../api';
import { getCatalog, getCatalogDiagnostics } from '../api';

function money(cents: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

export function CatalogTab() {
  const [result, setResult] = useState<CatalogResult | null>(null);
  const [diagnostics, setDiagnostics] = useState<CatalogDiagnostics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    setResult(null);
    setDiagnostics(null);

    try {
      const [catalog, diagnosticsResult] = await Promise.all([
        getCatalog(),
        getCatalogDiagnostics(),
      ]);

      setResult(catalog);
      setDiagnostics(diagnosticsResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el catálogo');
    } finally {
      setLoading(false);
    }
  }

  const productCount = (result?.categories ?? []).reduce(
    (sum, cat) => sum + (cat.products?.length ?? 0),
    0,
  );

  return (
    <div className="tab-content">
      <div className="card">
        <p className="hint">
          Verifica que el catálogo se puede cargar correctamente desde Last.app.
        </p>

        <button className="btn btn-secondary" onClick={load} disabled={loading}>
          {loading ? 'Cargando catálogo…' : 'Probar catálogo'}
        </button>

        {result && (
          <>
            {result.fromCache && (
              <div className="infobox infobox-warn">Mostrando catálogo cacheado.</div>
            )}

            <div className="stat-grid">
              <div className="stat-card">
                <span className="stat-value">{result.categories.length}</span>
                <span className="stat-label">Categorías</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{productCount}</span>
                <span className="stat-label">Productos</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{result.modifierGroups.length}</span>
                <span className="stat-label">Grupos modificadores</span>
              </div>
            </div>
          </>
        )}

        {diagnostics && (
          <div className="card" style={{ marginTop: 24 }}>
            <div className="card-header">
              <h3>Diagnóstico de catálogo</h3>
            </div>

            <div className="stat-grid">
              <div className="stat-card">
                <span className="stat-value">{diagnostics.catalogId || '—'}</span>
                <span className="stat-label">Catalog ID</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{diagnostics.catalogName || '—'}</span>
                <span className="stat-label">Nombre catálogo</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{diagnostics.categoriesCount}</span>
                <span className="stat-label">Categorías</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{diagnostics.productsCount}</span>
                <span className="stat-label">Productos</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{diagnostics.productsWithImageCount}</span>
                <span className="stat-label">Productos con imagen</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{diagnostics.productsWithoutImageCount}</span>
                <span className="stat-label">Productos sin imagen</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{diagnostics.productsWithModifiersCount}</span>
                <span className="stat-label">Productos con modificadores</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{diagnostics.disabledProductsCount}</span>
                <span className="stat-label">Productos deshabilitados</span>
              </div>
            </div>

            <p className="hint" style={{ marginTop: 16 }}>
              Si un producto no aparece en el kiosko, revisa que esté asignado al catálogo seleccionado en Last.app.
            </p>

            {diagnostics.warnings.length > 0 && (
              <div className="infobox infobox-warn" style={{ marginTop: 16 }}>
                <strong>Warnings</strong>
                <ul style={{ margin: '8px 0 0 18px' }}>
                  {diagnostics.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ marginTop: 20, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '10px 8px' }}>Nombre</th>
                    <th style={{ textAlign: 'left', padding: '10px 8px' }}>Categoría</th>
                    <th style={{ textAlign: 'left', padding: '10px 8px' }}>Precio</th>
                    <th style={{ textAlign: 'left', padding: '10px 8px' }}>Imagen Sí/No</th>
                    <th style={{ textAlign: 'left', padding: '10px 8px' }}>Modificadores número</th>
                    <th style={{ textAlign: 'left', padding: '10px 8px' }}>Enabled</th>
                  </tr>
                </thead>
                <tbody>
                  {diagnostics.products.map((product) => (
                    <tr key={product.id || `${product.categoryName}-${product.name}`}>
                      <td style={{ padding: '10px 8px', borderTop: '1px solid #e5e7eb' }}>{product.name || '—'}</td>
                      <td style={{ padding: '10px 8px', borderTop: '1px solid #e5e7eb' }}>{product.categoryName || '—'}</td>
                      <td style={{ padding: '10px 8px', borderTop: '1px solid #e5e7eb' }}>{money(product.price)}</td>
                      <td style={{ padding: '10px 8px', borderTop: '1px solid #e5e7eb' }}>{product.hasImage ? 'Sí' : 'No'}</td>
                      <td style={{ padding: '10px 8px', borderTop: '1px solid #e5e7eb' }}>{product.modifierGroupsCount}</td>
                      <td style={{ padding: '10px 8px', borderTop: '1px solid #e5e7eb' }}>{product.enabled ? 'Sí' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error && <p className="msg msg-error">{error}</p>}
      </div>
    </div>
  );
}
