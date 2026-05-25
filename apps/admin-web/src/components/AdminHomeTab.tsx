import React from 'react';
import type { AdminPaymentDevice, AdminPaymentJob, AdminTableQrMapping, LocalConfig } from '../api';
import {
  getActiveQrCount,
  getDevicePresentation,
  getGeneralReadiness,
  getLocationGroups,
  getNextRecommendedStep,
  getPaymentsHeadline,
  getPrintingStatus,
} from '../lib/adminDashboard';
import type { TabId } from './TabBar';

interface Props {
  config: LocalConfig;
  paymentDevices: AdminPaymentDevice[];
  paymentJobs: AdminPaymentJob[];
  mappings: AdminTableQrMapping[];
  onNavigate: (tab: TabId) => void;
}

function toneClass(tone: 'green' | 'amber' | 'gray' | 'red') {
  if (tone === 'green') return 'badge-green';
  if (tone === 'amber') return 'badge-amber';
  if (tone === 'red') return 'badge-red';
  return 'badge-gray';
}

export function AdminHomeTab({ config, paymentDevices, paymentJobs, mappings, onNavigate }: Props) {
  const readiness = getGeneralReadiness(config, mappings, paymentDevices);
  const payments = getPaymentsHeadline(config, paymentDevices);
  const printing = getPrintingStatus(config);
  const activeQrCount = getActiveQrCount(mappings);
  const locationGroups = getLocationGroups(config, paymentDevices, paymentJobs);
  const currentLocation = locationGroups[0];
  const cardDevice = getDevicePresentation('artemis', currentLocation?.devices ?? [], currentLocation?.jobs ?? []);
  const cashDevice = getDevicePresentation('cashdro', currentLocation?.devices ?? [], currentLocation?.jobs ?? []);
  const nextStep = getNextRecommendedStep(config, mappings, paymentDevices);

  return (
    <div className="tab-content">

      <div className="page-header">
        <h1>Inicio</h1>
      </div>

      {readiness.tone !== 'green' && nextStep ? (
        <div className="notice-banner">
          <span>💡</span>
          <span>{nextStep}</span>
        </div>
      ) : null}

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Estado general</div>
          <div className="kpi-value">{readiness.title}</div>
          <div className="kpi-sub">{readiness.description}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Modo de pago</div>
          <div className="kpi-value">{payments.title}</div>
          <div className="kpi-sub">{payments.description}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Impresión</div>
          <div className="kpi-value">{printing.title}</div>
          <div className="kpi-sub">{printing.description}</div>
        </div>
      </div>

      <section className="card">
        <div className="card-header">
          <h2>Verificaciones</h2>
          {readiness.tone === 'green' ? (
            <span className="badge badge-green">Todo correcto</span>
          ) : (
            <span className="badge badge-amber">Requiere atención</span>
          )}
        </div>
        <div className="status-list">
          <div className="status-row">
            <span className="status-row-label">Conexión con Last</span>
            <span className={`badge ${readiness.checks.lastReady ? 'badge-green' : 'badge-red'}`}>
              {readiness.checks.lastReady ? '✓ Lista' : '✗ Pendiente'}
            </span>
          </div>
          <div className="status-row">
            <span className="status-row-label">Pagos configurados</span>
            <span className={`badge ${readiness.checks.paymentsDefined ? 'badge-green' : 'badge-red'}`}>
              {readiness.checks.paymentsDefined ? '✓ Sí' : '✗ Pendiente'}
            </span>
          </div>
          <div className="status-row">
            <span className="status-row-label">Mesas QR ({activeQrCount} activas)</span>
            <span className={`badge ${readiness.checks.qrReady ? 'badge-green' : 'badge-red'}`}>
              {readiness.checks.qrReady ? '✓ Listas' : '✗ Pendiente'}
            </span>
          </div>
          {config.paymentsDemoForced ? (
            <div className="status-row">
              <span className="status-row-label">Modo demo</span>
              <span className="badge badge-amber">Forzado por servidor</span>
            </div>
          ) : null}
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2>Dispositivos de pago</h2>
          <span className="badge badge-gray">{currentLocation?.label ?? 'Local actual'}</span>
        </div>
        <div className="devices-grid">
          {[cardDevice, cashDevice].map((dev) => (
            <div key={dev.provider} className="device-card">
              <div className="device-card-header">
                <span className="device-card-name">{dev.title}</span>
                <span className={`badge ${toneClass(dev.setupTone)}`}>{dev.setupStatus}</span>
              </div>
              <div className="device-card-meta">Cola: {dev.queueLabel}</div>
              {dev.latestFailure ? (
                <div className="device-card-error">{dev.latestFailure}</div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <div className="quick-actions">
        <button className="btn btn-secondary" onClick={() => onNavigate('payments')}>
          Configurar pagos
        </button>
        <button className="btn btn-secondary" onClick={() => onNavigate('qr-tables')}>
          Ver mesas QR
        </button>
        <button className="btn btn-secondary" onClick={() => onNavigate('printing')}>
          Configurar impresión
        </button>
      </div>

    </div>
  );
}
