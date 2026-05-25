import React, { useCallback, useEffect, useState } from 'react';
import type { AdminPaymentDevice, AdminPaymentJob, AdminTableQrMapping, LocalConfig } from './api';
import { getConfig, getPaymentDevices, getPaymentJobs, getTableQrMappings } from './api';
import { AdminAdvancedTab } from './components/AdminAdvancedTab';
import { BrandTab } from './components/BrandTab';
import { AdminHomeTab } from './components/AdminHomeTab';
import { SuggestionsTab } from './components/SuggestionsTab';
import { AdminKiosksTab } from './components/AdminKiosksTab';
import { AdminPaymentsTab } from './components/AdminPaymentsTab';
import { AdminPrintingTab } from './components/AdminPrintingTab';
import { QrTablesTab } from './components/QrTablesTab';
import type { TabId } from './components/TabBar';
import { Sidebar } from './components/TabBar';
import { getGeneralReadiness } from './lib/adminDashboard';

interface DashboardState {
  config: LocalConfig;
  paymentDevices: AdminPaymentDevice[];
  paymentJobs: AdminPaymentJob[];
  mappings: AdminTableQrMapping[];
  warnings: string[];
}

export function App() {
  const [dashboard, setDashboard] = useState<DashboardState | null>(null);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<TabId>('home');

  const loadDashboard = useCallback(async () => {
    setLoadError('');
    try {
      const config = await getConfig();
      const warnings: string[] = [];

      const [paymentDevicesResult, paymentJobsResult, mappingsResult] = await Promise.allSettled([
        getPaymentDevices(),
        getPaymentJobs(),
        getTableQrMappings(),
      ]);

      const paymentDevices =
        paymentDevicesResult.status === 'fulfilled' ? paymentDevicesResult.value : [];
      if (paymentDevicesResult.status === 'rejected') {
        warnings.push(
          'No se pudo cargar la sección de pagos. Reinicia el backend para activar las rutas nuevas del panel.'
        );
      }

      const paymentJobs = paymentJobsResult.status === 'fulfilled' ? paymentJobsResult.value : [];
      if (paymentJobsResult.status === 'rejected' && paymentDevicesResult.status === 'fulfilled') {
        warnings.push(
          'No se pudo leer el estado de la cola de cobros. Reinicia el backend para usar el panel completo.'
        );
      }

      const mappings = mappingsResult.status === 'fulfilled' ? mappingsResult.value : [];
      if (mappingsResult.status === 'rejected') {
        warnings.push('No se pudo cargar el estado de las mesas QR.');
      }

      setDashboard({ config, paymentDevices, paymentJobs, mappings, warnings });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'No se pudo conectar a la API.');
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleConfigChange = useCallback((config: LocalConfig) => {
    setDashboard((current) =>
      current
        ? {
            ...current,
            config,
          }
        : null
    );
    void loadDashboard();
  }, [loadDashboard]);

  const handleRefresh = useCallback(async () => {
    await loadDashboard();
  }, [loadDashboard]);

  if (!dashboard && !loadError) {
    return (
      <div className="shell">
        <div className="fullpage-center">
          <div className="spinner" />
          <p className="hint">Conectando con la API...</p>
        </div>
      </div>
    );
  }

  if (loadError || !dashboard) {
    return (
      <div className="shell">
        <div className="fullpage-center">
          <p className="error-big-icon">!</p>
          <h2>No se puede conectar</h2>
          <p className="hint">{loadError || 'No se pudo cargar el panel.'}</p>
          <p className="hint">
            Asegúrate de que la API está accesible y que la configuración de entorno es correcta.
          </p>
          <button className="btn btn-primary" onClick={() => void loadDashboard()}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const { config, paymentDevices, paymentJobs, mappings, warnings } = dashboard;
  const readiness = getGeneralReadiness(config, mappings, paymentDevices);
  const showAlert = readiness.tone !== 'green';

  return (
    <div className="admin-shell">
      <Sidebar
        active={tab}
        onChange={setTab}
        showAlert={showAlert}
        restaurantName={config.restaurantName}
        readinessTone={readiness.tone}
      />

      <main className="admin-main">
        {warnings.length > 0 ? (
          <div className="card admin-warning-strip">
            {warnings.map((warning) => (
              <p key={warning} className="msg msg-error">{warning}</p>
            ))}
          </div>
        ) : null}
        {tab === 'home' && (
          <AdminHomeTab
            config={config}
            paymentDevices={paymentDevices}
            paymentJobs={paymentJobs}
            mappings={mappings}
            onNavigate={setTab}
          />
        )}
        {tab === 'qr-tables' && <QrTablesTab onDataChange={() => void handleRefresh()} />}
        {tab === 'suggestions' && <SuggestionsTab />}
        {tab === 'payments' && (
          <AdminPaymentsTab
            config={config}
            paymentDevices={paymentDevices}
            paymentJobs={paymentJobs}
            onConfigChange={handleConfigChange}
            onRefresh={handleRefresh}
          />
        )}
        {tab === 'kiosks' && (
          <AdminKiosksTab
            config={config}
            paymentDevices={paymentDevices}
            paymentJobs={paymentJobs}
          />
        )}
        {tab === 'printing' && <AdminPrintingTab config={config} onConfigChange={handleConfigChange} />}
        {tab === 'brand' && <BrandTab config={config} onConfigChange={handleConfigChange} />}
        {tab === 'advanced' && (
          <AdminAdvancedTab
            config={config}
            paymentDevices={paymentDevices}
            paymentJobs={paymentJobs}
            onConfigChange={handleConfigChange}
          />
        )}
      </main>
    </div>
  );
}
