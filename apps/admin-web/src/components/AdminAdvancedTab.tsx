import React from 'react';
import type { AdminPaymentDevice, AdminPaymentJob, LocalConfig } from '../api';
import { KioskSettingsTab } from './KioskSettingsTab';
import { OrdersTab } from './OrdersTab';
import { SetupTab } from './SetupTab';

interface Props {
  config: LocalConfig;
  paymentDevices: AdminPaymentDevice[];
  paymentJobs: AdminPaymentJob[];
  onConfigChange: (config: LocalConfig) => void;
}

export function AdminAdvancedTab({ config, paymentDevices, paymentJobs, onConfigChange }: Props) {
  return (
    <div className="tab-content">
      <div className="page-hero">
        <div>
          <h1>Diagnóstico avanzado</h1>
          <p>Aquí puedes ver la información técnica básica sin mostrar secretos.</p>
        </div>
      </div>

      <details className="advanced-panel" open={false}>
        <summary>Datos técnicos del local</summary>
        <div className="card">
          <div className="status-list">
            <div className="status-row">
              <span className="status-row-label">Location ID</span>
              <span className="mono-id">{config.lastApp.locationId || '—'}</span>
            </div>
            <div className="status-row">
              <span className="status-row-label">Organization ID</span>
              <span className="mono-id">{config.lastApp.organizationId || '—'}</span>
            </div>
            <div className="status-row">
              <span className="status-row-label">Brand ID</span>
              <span className="mono-id">{config.lastApp.brandId || '—'}</span>
            </div>
            <div className="status-row">
              <span className="status-row-label">Catalog ID</span>
              <span className="mono-id">{config.lastApp.catalogId || '—'}</span>
            </div>
            <div className="status-row">
              <span className="status-row-label">Modo demo forzado</span>
              <span className={`badge ${config.paymentsDemoForced ? 'badge-blue' : 'badge-gray'}`}>
                {config.paymentsDemoForced ? 'Sí' : 'No'}
              </span>
            </div>
          </div>
        </div>
      </details>

      <details className="advanced-panel">
        <summary>Dispositivos de pago</summary>
        <div className="card">
          {paymentDevices.length === 0 ? (
            <p className="hint">No hay dispositivos creados.</p>
          ) : (
            <div className="advanced-list">
              {paymentDevices.map((device) => (
                <div key={device.id} className="advanced-row">
                  <div>
                    <strong>{device.displayName}</strong>
                    <p className="hint">
                      {device.provider} · {device.mode} · {device.isActive ? 'active' : 'inactive'}
                    </p>
                  </div>
                  <div className="advanced-meta">
                    <span className="mono-id">{device.locationId}</span>
                    <span className="mono-id">{device.id.slice(0, 12)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </details>

      <details className="advanced-panel">
        <summary>Cola de cobros</summary>
        <div className="card">
          {paymentJobs.length === 0 ? (
            <p className="hint">No hay cobros en cola.</p>
          ) : (
            <div className="advanced-list">
              {paymentJobs.slice(0, 20).map((job) => (
                <div key={job.id} className="advanced-row">
                  <div>
                    <strong>{job.status}</strong>
                    <p className="hint">{job.provider}</p>
                  </div>
                  <div className="advanced-meta">
                    <span className="mono-id">{job.locationId}</span>
                    <span className="mono-id">{job.deviceId.slice(0, 12)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </details>

      <details className="advanced-panel">
        <summary>Configuración técnica de Last</summary>
        <SetupTab config={config} onConfigChange={onConfigChange} />
      </details>

      <details className="advanced-panel">
        <summary>Ajustes técnicos del kiosko</summary>
        <KioskSettingsTab config={config} onConfigChange={onConfigChange} />
      </details>

      <details className="advanced-panel">
        <summary>Pedidos heredados</summary>
        <OrdersTab />
      </details>
    </div>
  );
}
